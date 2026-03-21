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
  lockSlotIndices,
  recordAttempt,
  resetBookSession,
  setActiveSlotIndex,
  setLastBookId,
} from '@/src/state/session/sessionSlice';
import type { BookId } from '@/src/state/session/types';
import { store } from '@/src/state/store';
import type { CascadePlanUnit } from '@/src/game/selectionCascade';
import {
  CASCADE_BETWEEN_ROUNDS_MS,
  CASCADE_BETWEEN_UNITS_MS,
  CASCADE_FLIGHT_DURATION_MS,
  CASCADE_PREVIEW_MS,
  CASCADE_SOURCE_HIDE_BEAT_MS,
  computeGreedyCascadeRound,
} from '@/src/game/selectionCascade';

import { buildAnimCascadeQueue } from './cascade/buildCascadeAnimQueue';
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
  resolveValidLexiconMerge,
} from './lexicon/lexiconMergeLogic';
import type { KeyboardLetterCandidate } from './samplePassageLogic';
import {
  buildWordModelFromParsedBook,
  computeNextWordsByLetter,
  computePlacedWordCounts,
} from './samplePassageLogic';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type UsePlayFromParsedWordsOptions = {
  /** Distance from screen bottom to keyboard top — improves cascade flight origin fallback. */
  keyboardBottomOffset?: number;
  /** For cascade flight z-order (dip behind lexicon glass mid-path). */
  getLexiconDrawerOpen?: () => boolean;
};

/** Play session driven by `*.words.json` rows; progress persisted per `bookId` in Redux session slice. */
export function usePlayFromParsedWords(
  bookWords: ParsedBookWord[],
  bookId: BookId,
  options?: UsePlayFromParsedWordsOptions
) {
  const keyboardBottomOffset = options?.keyboardBottomOffset ?? 176;
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

  const [cascadeVisualHold, setCascadeVisualHold] = useState<Set<number> | null>(null);
  const [cascadeEarlyReveal, setCascadeEarlyReveal] = useState<Set<number> | null>(null);
  const [cascadeHideKeyboardLetter, setCascadeHideKeyboardLetter] = useState<string | null>(null);
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

  const keyboardFallbackRect = useCallback((): CascadeFlightRect => {
    const { width: W, height: H } = Dimensions.get('window');
    const y = H - keyboardBottomOffset - 72;
    return { x: W * 0.5 - 28, y, w: 56, h: 52 };
  }, [keyboardBottomOffset]);

  const bankFallbackRect = useCallback((): CascadeFlightRect => {
    const { height: H } = Dimensions.get('window');
    return { x: 20, y: H * 0.38, w: 72, h: 44 };
  }, []);

  const { displayTokens, wordInfos, wordCounts } = useMemo(
    () => buildWordModelFromParsedBook(bookWords),
    [bookWords]
  );

  const bookCanonicals = useMemo(() => buildBookCanonicalSequence(bookWords), [bookWords]);
  const canonicalBySlot = useMemo(() => buildCanonicalBySlot(bookWords), [bookWords]);

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
          eff
        );
        if (phraseMap.size > 0) return new Map(phraseMap);
      }
      return new Map(
        computeNextWordsByLetter(wordInfos, placed, selectedSlotIndex)
      );
    },
    [bookId, canonicalBySlot, wordInfos]
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

      try {
        for (let idx = 0; idx < queue.length; idx++) {
          const unit = queue[idx]!;
          if (gen !== cascadeGenRef.current) return;

          const accel = Math.min(idx, 6);

          if (unit.source === 'bank') {
            setCascadePreviewSlots(new Set(unit.slotIndices));
            setCascadePreviewLexiconKeys(new Set([unit.lexiconKey]));
            await sleep(Math.max(CASCADE_PREVIEW_MS - accel * 30, 80));
            if (gen !== cascadeGenRef.current) return;
            setCascadePreviewSlots(null);
            setCascadePreviewLexiconKeys(null);
          }

          setCascadeHideKeyboardLetter(null);
          setCollapseLexiconKey(null);

          if (unit.source === 'keyboard' && unit.letter) {
            setCascadeHideKeyboardLetter(unit.letter);
          } else {
            setCollapseLexiconKey(unit.lexiconKey);
          }
          await sleep(Math.max(CASCADE_SOURCE_HIDE_BEAT_MS - accel * 20, 50));
          if (gen !== cascadeGenRef.current) return;

          const fromNode =
            unit.source === 'keyboard' && unit.letter
              ? letterAnchorRef.current.get(unit.letter)
              : lexiconAnchorRef.current.get(unit.lexiconKey);

          const from = await measureNodeInWindow(
            fromNode ?? null,
            unit.source === 'keyboard' ? keyboardFallbackRect() : bankFallbackRect()
          );

          const targetSlot = unit.slotIndices[0]!;
          const slotNode = slotAnchorRef.current.get(targetSlot);
          const { width: W, height: H } = Dimensions.get('window');
          const to = await measureNodeInWindow(slotNode ?? null, {
            x: W * 0.35,
            y: H * 0.28,
            w: 48,
            h: 22,
          });

          setCascadeHideKeyboardLetter(null);
          setCollapseLexiconKey(null);

          flightIdRef.current += 1;
          const id = flightIdRef.current;
          const dip = dipBehindDrawer && unit.source === 'bank';

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

          // Reveal word in passage immediately after landing
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
        setCascadeHideKeyboardLetter(null);
        setCollapseLexiconKey(null);
      }
    },
    [bankFallbackRect, canonicalBySlot, keyboardFallbackRect]
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
        effectivePhraseBankCounts
      );
      if (phraseMap.size > 0) return phraseMap;
    }
    return computeNextWordsByLetter(wordInfos, placedWords, selectedSlotIndex);
  }, [
    activePhraseWindow,
    effectivePhraseBankCounts,
    placedWords,
    selectedSlotIndex,
    wordInfos,
  ]);

  useEffect(() => {
    if (slotCount <= 0) return;
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
        remaining: total - (placedWordCounts.get(word) || 0) - (consumed[word] || 0),
      }))
      .filter((e) => e.remaining > 0);
  }, [bookState?.lexiconMergeSinglesConsumed, placedWordCounts, wordCounts]);

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
        (wordCounts.get(word) || 0) -
        (placedWordCounts.get(word) || 0) -
        (mergeConsumed[word] || 0);

      const canTake = (key: string) => {
        if (key.includes(' ')) return (effectivePhrases[key] ?? 0) >= 1;
        return singleRemaining(key) >= 1;
      };

      if (!canTake(resolved.leftKey) || !canTake(resolved.rightKey)) return false;

      dispatch(
        applyLexiconPhraseMerge({
          bookId,
          leftKey: resolved.leftKey,
          rightKey: resolved.rightKey,
          mergedPhrase: resolved.mergedPhrase,
        })
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const after = store.getState().session.byBookId[bookId];
      const lockedAfter = after?.lockedSlotIndices ?? [];
      const placedAfterMerge = new Set(
        lockedAfter
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 0 && n < slotCount)
      );
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
        dispatch(
          recordAttempt({ bookId, slotIndex: selected, guessRaw: pressedWord })
        );
        return;
      }

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

      if (phraseWindow && phraseWindow.length > 1 && plan0.length === 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [bookId, canonicalBySlot, dispatch, slotCount, wordCounts, wordInfos]
  );

  const selectSlot = useCallback(
    (index: number) => {
      if (index < 0 || index >= slotCount) return;
      dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: index }));
    },
    [bookId, dispatch, slotCount]
  );

  const handleReset = useCallback(() => {
    cascadeGenRef.current += 1;
    flightResolveRef.current?.();
    flightResolveRef.current = null;
    setCascadeFlight(null);
    setCascadeVisualHold(null);
    setCascadeEarlyReveal(null);
    setCascadeHideKeyboardLetter(null);
    setCollapseLexiconKey(null);
    setCascadePreviewSlots(null);
    setCascadePreviewLexiconKeys(null);
    dispatch(resetBookSession({ bookId }));
  }, [bookId, dispatch]);

  const totalActualWords = wordInfos.length;
  const placedActualWords = wordInfos.filter((info) => placedWords.has(info.originalIndex)).length;
  const progress = totalActualWords > 0 ? (placedActualWords / totalActualWords) * 100 : 0;

  return {
    words: displayTokens,
    wordInfos,
    wordCounts,
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
    cascadeHideKeyboardLetter,
    collapseLexiconKey,
    cascadeFlight,
    onCascadeFlightFinished,
    cascadeFlightDurationMs: CASCADE_FLIGHT_DURATION_MS,
    cascadePreviewSlots,
    cascadePreviewLexiconKeys,
  };
}
