import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  View,
} from 'react-native';

import type { ParsedBookWord } from '@/src/data/bookTypes';
import { useAppDispatch, useAppSelector } from '@/src/state/hooks';
import {
  applyLexiconPhraseMerge,
  createDefaultBookSessionState,
  lockSlotIndices,
  recordAttempt,
  replaceBookSession,
  resetBookSession,
  setActiveSlotIndex,
  setLastBookId,
} from '@/src/state/session/sessionSlice';
import type { BookId, BookSessionState } from '@/src/state/session/types';
import { store } from '@/src/state/store';
import type { CascadePlanUnit } from '@/src/game/selectionCascade';
import {
  CASCADE_BETWEEN_ROUNDS_MS,
  CASCADE_BETWEEN_UNITS_MS,
  CASCADE_FLIGHT_DURATION_MS,
  CASCADE_KEYBOARD_BETWEEN_UNITS_MS,
  CASCADE_KEYBOARD_CHAR_INTERVAL_MS,
  CASCADE_PREVIEW_MS,
  CASCADE_SOURCE_HIDE_BEAT_MS,
  computeGreedyCascadeRound,
} from '@/src/game/selectionCascade';

import {
  buildAnimCascadeQueue,
  type AnimCascadeUnit,
} from './cascade/buildCascadeAnimQueue';
import type { CascadeFlightRect } from './cascade/CascadeFlightOverlay';
import { measureNodeInWindow } from './cascade/measureNode';
import {
  buildPhraseAwareKeyboardMap,
  computeEffectivePhraseBankCounts,
  findActiveLexiconPhraseWindow,
} from './lexicon/lexiconPhraseKeyboard';
import {
  buildBookCanonicalSequence,
  buildCanonicalBySlot,
  detectAutoChainPhrases,
  findAllPhraseOccurrenceSlots,
  resolveValidLexiconMerge,
} from './lexicon/lexiconMergeLogic';
import type { KeyboardLetterCandidate } from './samplePassageLogic';
import {
  buildVariantDisplayMap,
  buildWordModelFromParsedBook,
  computeNextWordsByLetter,
  computePlacedWordCounts,
} from './samplePassageLogic';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function cloneBookSession(s: BookSessionState): BookSessionState {
  return JSON.parse(JSON.stringify(s)) as BookSessionState;
}

/** How many leading graphemes to show per slot for a joined `slotIndices` string with spaces. */
function slotRevealCountsFromGlobal(
  slotIndices: readonly number[],
  globalG: number,
  displayTokens: readonly string[]
): Map<number, number> {
  const map = new Map<number, number>();
  let g = globalG;
  for (let s = 0; s < slotIndices.length; s++) {
    const idx = slotIndices[s]!;
    const w = displayTokens[idx] ?? '';
    if (g <= 0) {
      map.set(idx, 0);
      continue;
    }
    const take = Math.min(g, w.length);
    map.set(idx, take);
    g -= take;
    if (s < slotIndices.length - 1 && g > 0) {
      g -= 1;
    }
  }
  return map;
}

export type UsePlayFromParsedWordsOptions = {
  /** For cascade flight z-order (dip behind lexicon glass mid-path). */
  getLexiconDrawerOpen?: () => boolean;
};

/** Play session driven by `*.words.json` rows; progress persisted per `bookId` in Redux session slice. */
export function usePlayFromParsedWords(
  bookWords: ParsedBookWord[],
  bookId: BookId,
  options?: UsePlayFromParsedWordsOptions
) {
  const getLexiconDrawerOpenRef = useRef(options?.getLexiconDrawerOpen);
  getLexiconDrawerOpenRef.current = options?.getLexiconDrawerOpen;
  const dispatch = useAppDispatch();
  const bookState = useAppSelector((s) => s.session.byBookId[bookId]);

  const letterAnchorRef = useRef(new Map<string, View>());
  const slotAnchorRef = useRef(new Map<number, View>());
  const lexiconAnchorRef = useRef(new Map<string, View>());
  const cascadeGenRef = useRef(0);
  const flightIdRef = useRef(0);
  const flightResolveRef = useRef<(() => void) | null>(null);
  /** Skip one auto-cascade run after dev undo/redo restore (avoid re-filling undon locks). */
  const suppressNextCascadeRef = useRef(false);
  const undoPastRef = useRef<BookSessionState[]>([]);
  const undoFutureRef = useRef<BookSessionState[]>([]);
  const [, setUndoRedoBump] = useState(0);
  const bumpUndoRedoHistory = useCallback(() => setUndoRedoBump((n) => n + 1), []);

  const [cascadeVisualHold, setCascadeVisualHold] = useState<Set<number> | null>(null);
  const [cascadeEarlyReveal, setCascadeEarlyReveal] = useState<Set<number> | null>(null);
  const [cascadeHideKeyboard, setCascadeHideKeyboard] = useState<{
    letter: string;
    charCount: number;
  } | null>(null);
  const [cascadeRevealBySlot, setCascadeRevealBySlot] = useState<Map<number, number> | null>(null);
  const [collapseLexiconKey, setCollapseLexiconKey] = useState<string | null>(null);
  const [cascadePreviewSlots, setCascadePreviewSlots] = useState<Set<number> | null>(null);
  const [cascadePreviewLexiconKeys, setCascadePreviewLexiconKeys] = useState<Set<string> | null>(
    null
  );
  const [cascadeFlight, setCascadeFlight] = useState<null | {
    id: number;
    label: string;
    from: CascadeFlightRect;
    to: CascadeFlightRect;
    dipBehindDrawer: boolean;
  }>(null);

  const registerLetterCascadeAnchor = useCallback((letter: string, node: View | null) => {
    if (node) letterAnchorRef.current.set(letter, node);
    else letterAnchorRef.current.delete(letter);
  }, []);

  const registerSlotCascadeAnchor = useCallback((slot: number, node: View | null) => {
    if (node) slotAnchorRef.current.set(slot, node);
    else slotAnchorRef.current.delete(slot);
  }, []);

  const registerLexiconCascadeAnchor = useCallback((key: string, node: View | null) => {
    if (node) lexiconAnchorRef.current.set(key, node);
    else lexiconAnchorRef.current.delete(key);
  }, []);

  const onCascadeFlightFinished = useCallback(() => {
    flightResolveRef.current?.();
    flightResolveRef.current = null;
    setCascadeFlight(null);
  }, []);

  const clearCascadeAnimLocal = useCallback(() => {
    cascadeGenRef.current += 1;
    flightResolveRef.current?.();
    flightResolveRef.current = null;
    setCascadeFlight(null);
    setCascadeVisualHold(null);
    setCascadeEarlyReveal(null);
    setCascadeHideKeyboard(null);
    setCascadeRevealBySlot(null);
    setCollapseLexiconKey(null);
    setCascadePreviewSlots(null);
    setCascadePreviewLexiconKeys(null);
  }, []);

  const bankFallbackRect = useCallback((): CascadeFlightRect => {
    const { height: H } = Dimensions.get('window');
    return { x: 20, y: H * 0.38, w: 72, h: 44 };
  }, []);

  const { displayTokens, wordInfos, wordCounts, paragraphBreakIndices } = useMemo(
    () => buildWordModelFromParsedBook(bookWords),
    [bookWords]
  );

  const bookCanonicals = useMemo(() => buildBookCanonicalSequence(bookWords), [bookWords]);
  const canonicalBySlot = useMemo(() => buildCanonicalBySlot(bookWords), [bookWords]);
  const variantDisplayMap = useMemo(() => buildVariantDisplayMap(bookWords), [bookWords]);

  const slotCount = displayTokens.length;

  const buildKeyboardSnapshot = useCallback(
    (placed: Set<number>, selectedSlotIndex: number) => {
      const manual =
        store.getState().session.byBookId[bookId]?.lexiconManualPhraseCounts ?? {};
      const eff = computeEffectivePhraseBankCounts(manual, canonicalBySlot, placed);
      const window = findActiveLexiconPhraseWindow(
        selectedSlotIndex,
        canonicalBySlot,
        eff,
        placed
      );
      if (window) {
        const phraseMap = buildPhraseAwareKeyboardMap(
          selectedSlotIndex,
          window,
          eff,
          canonicalBySlot,
          placed,
          displayTokens
        );
        if (phraseMap.size > 0) return new Map(phraseMap);
      }
      return new Map(
        computeNextWordsByLetter(wordInfos, placed, selectedSlotIndex, displayTokens)
      );
    },
    [bookId, canonicalBySlot, displayTokens, wordInfos]
  );

  const runKeyboardCascadePhase = useCallback(
    async (units: AnimCascadeUnit[], gen: number) => {
      for (let uIdx = 0; uIdx < units.length; uIdx++) {
        const unit = units[uIdx]!;
        if (gen !== cascadeGenRef.current) return;
        const letter = unit.letter;
        if (!letter) continue;
        const keyStr = unit.keyboardRevealString ?? unit.displayLabel;
        const n = [...keyStr].length;
        if (n === 0) continue;

        const accel = Math.min(uIdx, 6);

        for (let step = 0; step <= n; step++) {
          if (gen !== cascadeGenRef.current) return;
          const hideCount = Math.min(step + 1, n);
          const revealG = Math.min(step, n);
          setCascadeHideKeyboard({ letter, charCount: hideCount });
          setCascadeRevealBySlot(
            slotRevealCountsFromGlobal(unit.slotIndices, revealG, displayTokens)
          );
          await sleep(Math.max(CASCADE_KEYBOARD_CHAR_INTERVAL_MS - accel * 5, 25));
        }

        setCascadeHideKeyboard(null);
        setCascadeRevealBySlot(null);

        setCascadeEarlyReveal((prev) => {
          const next = new Set(prev ?? []);
          for (const si of unit.slotIndices) next.add(si);
          return next;
        });
        setCascadeVisualHold((prev) => {
          if (!prev) return null;
          const next = new Set(prev);
          for (const si of unit.slotIndices) next.delete(si);
          return next.size > 0 ? next : null;
        });

        await sleep(Math.max(CASCADE_KEYBOARD_BETWEEN_UNITS_MS - accel * 15, 60));
      }
    },
    [displayTokens]
  );

  const runSingleRoundCascadeFlights = useCallback(
    async (
      plan: CascadePlanUnit[],
      keyboardSnapshot: Map<string, KeyboardLetterCandidate>,
      gen: number,
      dipBehindDrawer: boolean
    ) => {
      const hold = new Set(plan.flatMap((u) => u.slotIndices));
      setCascadeVisualHold(hold);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const queue = buildAnimCascadeQueue(plan, keyboardSnapshot, canonicalBySlot);
      const keyboardUnits = queue.filter((u) => u.source === 'keyboard');
      const bankUnits = queue.filter((u) => u.source === 'bank');

      try {
        await runKeyboardCascadePhase(keyboardUnits, gen);
        if (gen !== cascadeGenRef.current) return;

        for (let idx = 0; idx < bankUnits.length; idx++) {
          const unit = bankUnits[idx]!;
          if (gen !== cascadeGenRef.current) return;

          const accel = Math.min(idx, 6);

          setCascadePreviewSlots(new Set(unit.slotIndices));
          setCascadePreviewLexiconKeys(new Set([unit.lexiconKey]));
          await sleep(Math.max(CASCADE_PREVIEW_MS - accel * 30, 80));
          if (gen !== cascadeGenRef.current) return;
          setCascadePreviewSlots(null);
          setCascadePreviewLexiconKeys(null);

          setCascadeHideKeyboard(null);
          setCollapseLexiconKey(unit.lexiconKey);
          await sleep(Math.max(CASCADE_SOURCE_HIDE_BEAT_MS - accel * 20, 50));
          if (gen !== cascadeGenRef.current) return;

          const fromNode = lexiconAnchorRef.current.get(unit.lexiconKey);
          const from = await measureNodeInWindow(fromNode ?? null, bankFallbackRect());

          const targetSlot = unit.slotIndices[0]!;
          const slotNode = slotAnchorRef.current.get(targetSlot);
          const { width: W, height: H } = Dimensions.get('window');
          const to = await measureNodeInWindow(slotNode ?? null, {
            x: W * 0.35,
            y: H * 0.28,
            w: 48,
            h: 22,
          });

          setCollapseLexiconKey(null);

          flightIdRef.current += 1;
          const id = flightIdRef.current;
          const dip = dipBehindDrawer;

          await new Promise<void>((resolve) => {
            flightResolveRef.current = resolve;
            setCascadeFlight({
              id,
              label: unit.displayLabel,
              from,
              to,
              dipBehindDrawer: dip,
            });
          });

          if (gen !== cascadeGenRef.current) return;

          setCascadeEarlyReveal((prev) => {
            const next = new Set(prev ?? []);
            for (const si of unit.slotIndices) next.add(si);
            return next;
          });
          setCascadeVisualHold((prev) => {
            if (!prev) return null;
            const next = new Set(prev);
            for (const si of unit.slotIndices) next.delete(si);
            return next.size > 0 ? next : null;
          });

          await sleep(Math.max(CASCADE_BETWEEN_UNITS_MS - accel * 30, 60));
        }
      } finally {
        setCascadePreviewSlots(null);
        setCascadePreviewLexiconKeys(null);
        setCascadeVisualHold(null);
        setCascadeEarlyReveal(null);
        setCascadeHideKeyboard(null);
        setCascadeRevealBySlot(null);
        setCollapseLexiconKey(null);
      }
    },
    [bankFallbackRect, canonicalBySlot, runKeyboardCascadePhase]
  );

  const runGreedyCascadeMultiRound = useCallback(
    async (initialPlaced: Set<number>) => {
      if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }

      cascadeGenRef.current += 1;
      const gen = cascadeGenRef.current;
      let work = new Set(initialPlaced);
      let anyRound = false;
      const drawerOpen = getLexiconDrawerOpenRef.current?.() ?? false;
      const snapshotBeforeCascade = cloneBookSession(
        store.getState().session.byBookId[bookId] ?? createDefaultBookSessionState()
      );

      while (gen === cascadeGenRef.current) {
        const s = store.getState().session.byBookId[bookId];
        const mergeConsumed = s?.lexiconMergeSinglesConsumed ?? {};
        const manualPhrases = s?.lexiconManualPhraseCounts ?? {};
        const plan = computeGreedyCascadeRound(
          canonicalBySlot,
          work,
          wordCounts,
          mergeConsumed,
          manualPhrases
        );
        if (plan.length === 0) break;
        anyRound = true;

        const rawSel = s?.activeSlotIndex ?? 0;
        const sel =
          slotCount <= 0 ? 0 : Math.min(Math.max(0, rawSel), slotCount - 1);
        const keyboardSnap = buildKeyboardSnapshot(work, sel);

        await runSingleRoundCascadeFlights(plan, keyboardSnap, gen, drawerOpen);
        if (gen !== cascadeGenRef.current) return;

        for (const u of plan) {
          for (const si of u.slotIndices) work.add(si);
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCascadeEarlyReveal(null);
        dispatch(
          lockSlotIndices({
            bookId,
            lockedSlotIndices: [...work]
              .map(String)
              .sort((a, b) => Number(a) - Number(b)),
          })
        );

        await sleep(CASCADE_BETWEEN_ROUNDS_MS);
      }

      const cascadePlacedNewWords = [...work].some((si) => !initialPlaced.has(si));

      if (anyRound && cascadePlacedNewWords) {
        undoPastRef.current = [...undoPastRef.current, snapshotBeforeCascade];
        bumpUndoRedoHistory();
      }

      if (anyRound) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const s2 = store.getState().session.byBookId[bookId];
        const keys = s2?.lockedSlotIndices ?? [];
        const placedNow = new Set(
          keys
            .map(Number)
            .filter((n) => Number.isFinite(n) && n >= 0 && n < slotCount)
        );
        let nextSel = slotCount > 0 ? slotCount - 1 : 0;
        for (let i = 0; i < slotCount; i++) {
          if (!placedNow.has(i)) {
            nextSel = i;
            break;
          }
        }
        dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: nextSel }));
      }
    },
    [
      bookId,
      buildKeyboardSnapshot,
      bumpUndoRedoHistory,
      canonicalBySlot,
      dispatch,
      runSingleRoundCascadeFlights,
      slotCount,
      wordCounts,
    ]
  );

  useEffect(() => {
    dispatch(setLastBookId(bookId));
  }, [bookId, dispatch]);

  const placedWords = useMemo(() => {
    const keys = bookState?.lockedSlotIndices ?? [];
    return new Set(
      keys
        .map(Number)
        .filter((i) => Number.isFinite(i) && i >= 0 && i < slotCount)
    );
  }, [bookState?.lockedSlotIndices, slotCount]);

  const passagePlacedWords = useMemo(() => {
    const hasHold = cascadeVisualHold?.size;
    const hasReveal = cascadeEarlyReveal?.size;
    if (!hasHold && !hasReveal) return placedWords;
    const out = new Set<number>();
    for (const i of placedWords) {
      if (!cascadeVisualHold?.has(i)) out.add(i);
    }
    if (hasReveal) {
      for (const i of cascadeEarlyReveal) out.add(i);
    }
    return out;
  }, [placedWords, cascadeVisualHold, cascadeEarlyReveal]);

  const rawSelected = bookState?.activeSlotIndex;
  const selectedSlotIndex = useMemo(() => {
    if (slotCount <= 0) return 0;
    const s = rawSelected ?? 0;
    return Math.min(Math.max(0, s), slotCount - 1);
  }, [rawSelected, slotCount]);

  useEffect(() => {
    if (slotCount <= 0) return;
    const locked = bookState?.lockedSlotIndices;
    if (!locked?.length) return;
    const valid = locked.filter((k) => {
      const n = Number(k);
      return Number.isFinite(n) && n >= 0 && n < slotCount;
    });
    if (valid.length !== locked.length) {
      dispatch(lockSlotIndices({ bookId, lockedSlotIndices: valid }));
    }
  }, [bookId, bookState?.lockedSlotIndices, dispatch, slotCount]);

  useEffect(() => {
    if (slotCount <= 0) return;
    if (rawSelected == null) return;
    if (rawSelected === selectedSlotIndex) return;
    dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: selectedSlotIndex }));
  }, [bookId, dispatch, rawSelected, selectedSlotIndex, slotCount]);

  const manualPhraseCounts = bookState?.lexiconManualPhraseCounts ?? {};

  const effectivePhraseBankCounts = useMemo(
    () => computeEffectivePhraseBankCounts(manualPhraseCounts, canonicalBySlot, placedWords),
    [canonicalBySlot, manualPhraseCounts, placedWords]
  );

  const activePhraseWindow = useMemo(
    () =>
      findActiveLexiconPhraseWindow(
        selectedSlotIndex,
        canonicalBySlot,
        effectivePhraseBankCounts,
        placedWords
      ),
    [canonicalBySlot, effectivePhraseBankCounts, placedWords, selectedSlotIndex]
  );

  const activePhraseSpan = useMemo(
    () =>
      activePhraseWindow && activePhraseWindow.length > 1
        ? { start: activePhraseWindow.start, length: activePhraseWindow.length }
        : null,
    [activePhraseWindow]
  );

  const nextWordsByLetter = useMemo(() => {
    if (activePhraseWindow) {
      const phraseMap = buildPhraseAwareKeyboardMap(
        selectedSlotIndex,
        activePhraseWindow,
        effectivePhraseBankCounts,
        canonicalBySlot,
        placedWords,
        displayTokens
      );
      if (phraseMap.size > 0) return phraseMap;
    }
    return computeNextWordsByLetter(wordInfos, placedWords, selectedSlotIndex, displayTokens);
  }, [
    activePhraseWindow,
    canonicalBySlot,
    displayTokens,
    effectivePhraseBankCounts,
    placedWords,
    selectedSlotIndex,
    wordInfos,
  ]);

  useEffect(() => {
    if (slotCount <= 0) return;
    if (suppressNextCascadeRef.current) {
      suppressNextCascadeRef.current = false;
      return;
    }
    const s = store.getState().session.byBookId[bookId];
    const keys = s?.lockedSlotIndices ?? [];
    const currentPlaced = new Set(
      keys
        .map(Number)
        .filter((n) => Number.isFinite(n) && n >= 0 && n < slotCount)
    );
    const mergeConsumed = s?.lexiconMergeSinglesConsumed ?? {};
    const manualPhrases = s?.lexiconManualPhraseCounts ?? {};
    const plan0 = computeGreedyCascadeRound(
      canonicalBySlot,
      currentPlaced,
      wordCounts,
      mergeConsumed,
      manualPhrases
    );
    if (plan0.length === 0) return;

    void runGreedyCascadeMultiRound(new Set(currentPlaced));
  }, [
    bookId,
    bookState?.lockedSlotIndices,
    canonicalBySlot,
    runGreedyCascadeMultiRound,
    slotCount,
    wordCounts,
  ]);

  const placedWordCounts = useMemo(
    () => computePlacedWordCounts(wordInfos, placedWords),
    [wordInfos, placedWords]
  );

  const lexiconWordEntries = useMemo(() => {
    const consumed = bookState?.lexiconMergeSinglesConsumed ?? {};
    return Array.from(wordCounts.entries())
      .map(([word, total]) => ({
        word,
        remaining: Math.max(0, total - Math.max(placedWordCounts.get(word) || 0, consumed[word] || 0)),
        display: variantDisplayMap.get(word),
      }))
      .filter((e) => e.remaining > 0);
  }, [bookState?.lexiconMergeSinglesConsumed, placedWordCounts, variantDisplayMap, wordCounts]);

  const lexiconPhraseEntries = useMemo(
    () =>
      Object.entries(effectivePhraseBankCounts).map(([phrase, remaining]) => ({
        phrase,
        remaining,
      })),
    [effectivePhraseBankCounts]
  );

  const tryMergeLexiconKeys = useCallback(
    (keyA: string, keyB: string): boolean => {
      if (keyA === keyB) return false;
      const resolved = resolveValidLexiconMerge(keyA, keyB, bookCanonicals);
      if (!resolved) return false;

      const s = store.getState().session.byBookId[bookId];
      const mergeConsumed = s?.lexiconMergeSinglesConsumed ?? {};
      const manualPhrases = s?.lexiconManualPhraseCounts ?? {};
      const locked = s?.lockedSlotIndices ?? [];
      const placedNow = new Set(
        locked
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 0 && n < slotCount)
      );
      const effectivePhrases = computeEffectivePhraseBankCounts(
        manualPhrases,
        canonicalBySlot,
        placedNow
      );

      const singleRemaining = (word: string) =>
        Math.max(0,
          (wordCounts.get(word) || 0) -
          Math.max(placedWordCounts.get(word) || 0, mergeConsumed[word] || 0)
        );

      const canTake = (key: string) => {
        if (key.includes(' ')) return (effectivePhrases[key] ?? 0) >= 1;
        return singleRemaining(key) >= 1;
      };

      if (!canTake(resolved.leftKey) || !canTake(resolved.rightKey)) return false;

      undoPastRef.current = [];
      undoFutureRef.current = [];
      bumpUndoRedoHistory();

      const phraseTokens = resolved.mergedPhrase.split(/\s+/);
      const allOccurrences = findAllPhraseOccurrenceSlots(canonicalBySlot, phraseTokens);
      const totalOccurrences = allOccurrences.length;

      dispatch(
        applyLexiconPhraseMerge({
          bookId,
          leftKey: resolved.leftKey,
          rightKey: resolved.rightKey,
          mergedPhrase: resolved.mergedPhrase,
          totalOccurrences,
        })
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-chain: detect overlapping phrases that form longer phrases.
      let latestPhrase = resolved.mergedPhrase;
      for (let round = 0; round < 10; round++) {
        const st = store.getState().session.byBookId[bookId];
        const currentPhrases = st?.lexiconManualPhraseCounts ?? {};
        const chains = detectAutoChainPhrases(latestPhrase, currentPhrases, canonicalBySlot);
        if (chains.length === 0) break;
        for (const ch of chains) {
          dispatch(
            applyLexiconPhraseMerge({
              bookId,
              leftKey: ch.leftKey,
              rightKey: ch.rightKey,
              mergedPhrase: ch.mergedPhrase,
              totalOccurrences: ch.totalOccurrences,
            })
          );
          latestPhrase = ch.mergedPhrase;
        }
      }

      // Auto-lock any phrase instance where at least one word is already placed.
      const stAfterChain = store.getState().session.byBookId[bookId];
      const manualAfterChain = stAfterChain?.lexiconManualPhraseCounts ?? {};
      const autoLock = new Set(placedNow);
      for (const [pk, cnt] of Object.entries(manualAfterChain)) {
        if (!cnt || cnt <= 0) continue;
        const pTokens = pk.trim().split(/\s+/).filter(Boolean);
        const occs = findAllPhraseOccurrenceSlots(canonicalBySlot, pTokens);
        for (const occ of occs) {
          if (occ.some((si) => placedNow.has(si))) {
            for (const si of occ) autoLock.add(si);
          }
        }
      }
      if (autoLock.size > placedNow.size) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        dispatch(
          lockSlotIndices({
            bookId,
            lockedSlotIndices: [...autoLock]
              .map(String)
              .sort((a, b) => Number(a) - Number(b)),
          })
        );
      }

      const placedAfterMerge = autoLock;
      const after = store.getState().session.byBookId[bookId];
      const consumedAfter = after?.lexiconMergeSinglesConsumed ?? {};
      const manualAfter = after?.lexiconManualPhraseCounts ?? {};
      const planAfterMerge = computeGreedyCascadeRound(
        canonicalBySlot,
        placedAfterMerge,
        wordCounts,
        consumedAfter,
        manualAfter
      );
      if (planAfterMerge.length > 0) {
        void runGreedyCascadeMultiRound(placedAfterMerge);
      }
      return true;
    },
    [
      bookCanonicals,
      bookId,
      bumpUndoRedoHistory,
      canonicalBySlot,
      dispatch,
      placedWordCounts,
      runGreedyCascadeMultiRound,
      slotCount,
      wordCounts,
    ]
  );

  const handleWordSelect = useCallback(
    (wordIndex: number, pressedWord: string) => {
      if (slotCount <= 0) return;
      const s = store.getState().session.byBookId[bookId];
      const keys = s?.lockedSlotIndices ?? [];
      const currentPlaced = new Set(
        keys
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 0 && n < slotCount)
      );
      const raw = s?.activeSlotIndex ?? 0;
      const selected = Math.min(Math.max(0, raw), slotCount - 1);
      if (wordIndex !== selected) return;
      if (currentPlaced.has(selected)) return;
      const expected = wordInfos.find((w) => w.originalIndex === selected)?.word;
      if (!expected || pressedWord !== expected) {
        undoFutureRef.current = [];
        bumpUndoRedoHistory();
        dispatch(
          recordAttempt({ bookId, slotIndex: selected, guessRaw: pressedWord })
        );
        return;
      }

      const sessionBeforeMove = cloneBookSession(
        store.getState().session.byBookId[bookId] ?? createDefaultBookSessionState()
      );

      const manualPhrases = s?.lexiconManualPhraseCounts ?? {};
      const effectivePhrases = computeEffectivePhraseBankCounts(
        manualPhrases,
        canonicalBySlot,
        currentPlaced
      );
      const phraseWindow = findActiveLexiconPhraseWindow(
        selected,
        canonicalBySlot,
        effectivePhrases,
        currentPlaced
      );

      const nextPlacedSet = new Set(currentPlaced);

      if (phraseWindow) {
        const tokens = phraseWindow.phraseKey.trim().split(/\s+/).filter(Boolean);
        for (let j = 0; j < phraseWindow.length; j++) {
          const idx = phraseWindow.start + j;
          if (idx < 0 || idx >= slotCount) continue;
          if (nextPlacedSet.has(idx)) continue;
          const slotExpected = wordInfos.find((w) => w.originalIndex === idx)?.word;
          if (slotExpected !== tokens[j]) continue;
          nextPlacedSet.add(idx);
        }
      } else {
        nextPlacedSet.add(selected);
      }

      const placedAfterManual = new Set(nextPlacedSet);
      const mergeConsumed = s?.lexiconMergeSinglesConsumed ?? {};
      const plan0 = computeGreedyCascadeRound(
        canonicalBySlot,
        placedAfterManual,
        wordCounts,
        mergeConsumed,
        manualPhrases
      );

      const sortedLocked = [...placedAfterManual]
        .map(String)
        .sort((a, b) => Number(a) - Number(b));
      dispatch(lockSlotIndices({ bookId, lockedSlotIndices: sortedLocked }));

      let nextSel = slotCount > 0 ? slotCount - 1 : 0;
      for (let i = 0; i < slotCount; i++) {
        if (!placedAfterManual.has(i)) {
          nextSel = i;
          break;
        }
      }
      dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: nextSel }));

      undoPastRef.current = [...undoPastRef.current, sessionBeforeMove];
      undoFutureRef.current = [];
      bumpUndoRedoHistory();

      if (phraseWindow && phraseWindow.length > 1 && plan0.length === 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [bookId, bumpUndoRedoHistory, canonicalBySlot, dispatch, slotCount, wordCounts, wordInfos]
  );

  const selectSlot = useCallback(
    (index: number) => {
      if (index < 0 || index >= slotCount) return;
      undoFutureRef.current = [];
      bumpUndoRedoHistory();
      dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: index }));
    },
    [bookId, bumpUndoRedoHistory, dispatch, slotCount]
  );

  const handleReset = useCallback(() => {
    undoPastRef.current = [];
    undoFutureRef.current = [];
    bumpUndoRedoHistory();
    clearCascadeAnimLocal();
    dispatch(resetBookSession({ bookId }));
  }, [bookId, bumpUndoRedoHistory, clearCascadeAnimLocal, dispatch]);

  const devUndo = useCallback(() => {
    const past = undoPastRef.current;
    if (past.length === 0) return;
    const target = past[past.length - 1]!;
    const current = cloneBookSession(
      store.getState().session.byBookId[bookId] ?? createDefaultBookSessionState()
    );
    undoPastRef.current = past.slice(0, -1);
    undoFutureRef.current = [...undoFutureRef.current, current];
    bumpUndoRedoHistory();
    suppressNextCascadeRef.current = true;
    clearCascadeAnimLocal();
    dispatch(replaceBookSession({ bookId, bookSession: cloneBookSession(target) }));
  }, [bookId, bumpUndoRedoHistory, clearCascadeAnimLocal, dispatch]);

  const devRedo = useCallback(() => {
    const fut = undoFutureRef.current;
    if (fut.length === 0) return;
    const target = fut[fut.length - 1]!;
    const current = cloneBookSession(
      store.getState().session.byBookId[bookId] ?? createDefaultBookSessionState()
    );
    undoFutureRef.current = fut.slice(0, -1);
    undoPastRef.current = [...undoPastRef.current, current];
    bumpUndoRedoHistory();
    suppressNextCascadeRef.current = true;
    clearCascadeAnimLocal();
    dispatch(replaceBookSession({ bookId, bookSession: cloneBookSession(target) }));
  }, [bookId, bumpUndoRedoHistory, clearCascadeAnimLocal, dispatch]);

  const totalActualWords = wordInfos.length;
  const placedActualWords = wordInfos.filter((info) => placedWords.has(info.originalIndex)).length;
  const progress = totalActualWords > 0 ? (placedActualWords / totalActualWords) * 100 : 0;

  return {
    words: displayTokens,
    wordInfos,
    wordCounts,
    paragraphBreakIndices,
    nextWordsByLetter,
    activePhraseSpan,
    placedWordCounts,
    lexiconWordEntries,
    lexiconPhraseEntries,
    tryMergeLexiconKeys,
    placedWords,
    passagePlacedWords,
    selectedSlotIndex,
    selectSlot,
    handleWordSelect,
    handleReset,
    progress,
    totalActualWords,
    placedActualWords,
    registerLetterCascadeAnchor,
    registerSlotCascadeAnchor,
    registerLexiconCascadeAnchor,
    cascadeHideKeyboard,
    cascadeRevealBySlot,
    collapseLexiconKey,
    cascadeFlight,
    onCascadeFlightFinished,
    cascadeFlightDurationMs: CASCADE_FLIGHT_DURATION_MS,
    cascadePreviewSlots,
    cascadePreviewLexiconKeys,
    canDevUndo: undoPastRef.current.length > 0,
    canDevRedo: undoFutureRef.current.length > 0,
    devUndo,
    devRedo,
  };
}
