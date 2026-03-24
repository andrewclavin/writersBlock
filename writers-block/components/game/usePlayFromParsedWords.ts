import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, View } from 'react-native';

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
  CASCADE_GREY_SQUASH_MS,
  CASCADE_GREY_SQUASH_STEPS,
  CASCADE_INITIAL_PASSAGE_RIPPLE_MS,
  CASCADE_KEY_GLOW_STEP_MS,
  CASCADE_KEYBOARD_CHAR_INTERVAL_MS,
  computeGreedyCascadeRound,
} from '@/src/game/selectionCascade';

import {
  buildAnimCascadeQueue,
  type AnimCascadeUnit,
} from './cascade/buildCascadeAnimQueue';
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

function shouldOpenNextCascadeGate(
  unit: AnimCascadeUnit,
  hideCount: number,
  revealG: number
): boolean {
  if (unit.source === 'keyboard') return hideCount >= 3;
  return revealG >= 2;
}

/** Play session driven by `*.words.json` rows; progress persisted per `bookId` in Redux session slice. */
export function usePlayFromParsedWords(bookWords: ParsedBookWord[], bookId: BookId) {
  const dispatch = useAppDispatch();
  const bookState = useAppSelector((s) => s.session.byBookId[bookId]);

  const letterAnchorRef = useRef(new Map<string, View>());
  const slotAnchorRef = useRef(new Map<number, View>());
  const lexiconAnchorRef = useRef(new Map<string, View>());
  const cascadeGenRef = useRef(0);
  /** Skip one auto-cascade run after dev undo/redo restore (avoid re-filling undon locks). */
  const suppressNextCascadeRef = useRef(false);
  const undoPastRef = useRef<BookSessionState[]>([]);
  const undoFutureRef = useRef<BookSessionState[]>([]);
  const [, setUndoRedoBump] = useState(0);
  const bumpUndoRedoHistory = useCallback(() => setUndoRedoBump((n) => n + 1), []);

  const [cascadeVisualHold, setCascadeVisualHold] = useState<Set<number> | null>(null);
  const [cascadeEarlyReveal, setCascadeEarlyReveal] = useState<Set<number> | null>(null);
  const [cascadeLetterHides, setCascadeLetterHides] = useState<Map<string, number> | null>(null);
  const [cascadeLetterGlow, setCascadeLetterGlow] = useState<Map<string, number> | null>(null);
  const [cascadeLexiconHide, setCascadeLexiconHide] = useState<Map<string, number> | null>(null);
  const [cascadeLexiconGlow, setCascadeLexiconGlow] = useState<Map<string, number> | null>(null);
  const [cascadePillAttractBySlot, setCascadePillAttractBySlot] = useState<Map<number, number> | null>(
    null
  );
  const [cascadeRevealBySlot, setCascadeRevealBySlot] = useState<Map<number, number> | null>(null);
  const [cascadeGreySquashBySlot, setCascadeGreySquashBySlot] = useState<Map<number, number> | null>(
    null
  );

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

  const clearCascadeAnimLocal = useCallback(() => {
    cascadeGenRef.current += 1;
    setCascadeVisualHold(null);
    setCascadeEarlyReveal(null);
    setCascadeLetterHides(null);
    setCascadeLetterGlow(null);
    setCascadeLexiconHide(null);
    setCascadeLexiconGlow(null);
    setCascadePillAttractBySlot(null);
    setCascadeRevealBySlot(null);
    setCascadeGreySquashBySlot(null);
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

  const runSingleRoundCascadeLetters = useCallback(
    async (
      plan: CascadePlanUnit[],
      keyboardSnapshot: Map<string, KeyboardLetterCandidate>,
      gen: number
    ) => {
      const hold = new Set(plan.flatMap((u) => u.slotIndices));
      setCascadeVisualHold(hold);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const queue = buildAnimCascadeQueue(plan, keyboardSnapshot, canonicalBySlot);
      const nUnits = queue.length;
      if (nUnits === 0) {
        setCascadeVisualHold(null);
        return;
      }

      const allCascadeSlots = [...hold].sort((a, b) => a - b);
      for (const si of allCascadeSlots) {
        if (gen !== cascadeGenRef.current) return;
        setCascadePillAttractBySlot((prev) => {
          const m = new Map(prev ?? []);
          m.set(si, 1);
          return m;
        });
        await sleep(CASCADE_INITIAL_PASSAGE_RIPPLE_MS);
      }

      const gateWaiters = queue.map(() => {
        let resolveGate!: () => void;
        const p = new Promise<void>((r) => {
          resolveGate = r;
        });
        let fired = false;
        return {
          p,
          open: () => {
            if (fired) return;
            fired = true;
            resolveGate();
          },
        };
      });
      gateWaiters[0]!.open();

      const tUnitStart: number[] = new Array(nUnits).fill(0);
      let delta12: number | null = null;

      const clearPassageAttractForUnit = (unit: AnimCascadeUnit) => {
        setCascadePillAttractBySlot((prev) => {
          const m = new Map(prev ?? []);
          for (const si of unit.slotIndices) m.delete(si);
          return m.size > 0 ? m : null;
        });
      };

      const sourceGlowRamp = async (unit: AnimCascadeUnit) => {
        const steps = [1, 0.88, 0.58, 0.25, 0];
        for (const t of steps) {
          if (gen !== cascadeGenRef.current) return;
          if (unit.source === 'keyboard' && unit.letter) {
            setCascadeLetterGlow((prev) => {
              const m = new Map(prev ?? []);
              m.set(unit.letter!, t);
              return m;
            });
          } else {
            setCascadeLexiconGlow((prev) => {
              const m = new Map(prev ?? []);
              m.set(unit.lexiconKey, t);
              return m;
            });
          }
          await sleep(CASCADE_KEY_GLOW_STEP_MS);
        }
        if (unit.source === 'keyboard' && unit.letter) {
          setCascadeLetterGlow((prev) => {
            const m = new Map(prev ?? []);
            m.delete(unit.letter!);
            return m.size > 0 ? m : null;
          });
        } else {
          setCascadeLexiconGlow((prev) => {
            const m = new Map(prev ?? []);
            m.delete(unit.lexiconKey);
            return m.size > 0 ? m : null;
          });
        }
      };

      const letterLoop = async (
        unit: AnimCascadeUnit,
        unitIndex: number,
        gateNextRef: { v: boolean },
        nextIndex: number | null
      ) => {
        const keyStr =
          unit.source === 'keyboard'
            ? (unit.keyboardRevealString ?? unit.displayLabel)
            : unit.displayLabel;
        const n = [...keyStr].length;
        clearPassageAttractForUnit(unit);

        const squashStepMs = CASCADE_GREY_SQUASH_MS / CASCADE_GREY_SQUASH_STEPS;
        for (let s = 0; s <= CASCADE_GREY_SQUASH_STEPS; s++) {
          if (gen !== cascadeGenRef.current) return;
          const t = s / CASCADE_GREY_SQUASH_STEPS;
          setCascadeGreySquashBySlot((prev) => {
            const m = new Map(prev ?? []);
            for (const si of unit.slotIndices) m.set(si, t);
            return m;
          });
          await sleep(squashStepMs);
        }
        setCascadeGreySquashBySlot((prev) => {
          const m = new Map(prev ?? []);
          for (const si of unit.slotIndices) m.set(si, 1);
          return m;
        });

        if (n === 0) {
          setCascadeGreySquashBySlot((prev) => {
            const m = new Map(prev ?? []);
            for (const si of unit.slotIndices) m.delete(si);
            return m.size > 0 ? m : null;
          });
          return;
        }

        const letter = unit.letter;
        const accel = Math.min(unitIndex, 6);
        const charIv = Math.max(CASCADE_KEYBOARD_CHAR_INTERVAL_MS - accel * 5, 25);

        const tryOpenNext = (hideCount: number, revealG: number) => {
          if (nextIndex == null || gateNextRef.v) return;
          if (shouldOpenNextCascadeGate(unit, hideCount, revealG)) {
            gateNextRef.v = true;
            gateWaiters[nextIndex]!.open();
          }
        };

        for (let step = 0; step <= n; step++) {
          if (gen !== cascadeGenRef.current) return;
          const hideCount = Math.min(step + 1, n);
          const revealG = Math.min(step, n);

          if (unit.source === 'keyboard' && letter) {
            setCascadeLetterHides((prev) => {
              const m = new Map(prev ?? []);
              m.set(letter, hideCount);
              return m;
            });
            const glowDecay = step <= 2 ? Math.max(0, 1 - step * 0.45) : 0;
            if (glowDecay > 0.04) {
              setCascadeLetterGlow((prev) => {
                const m = new Map(prev ?? []);
                m.set(letter, glowDecay);
                return m;
              });
            } else {
              setCascadeLetterGlow((prev) => {
                const m = new Map(prev ?? []);
                m.delete(letter);
                return m.size > 0 ? m : null;
              });
            }
          } else {
            setCascadeLexiconHide((prev) => {
              const m = new Map(prev ?? []);
              m.set(unit.lexiconKey, hideCount);
              return m;
            });
          }

          setCascadeRevealBySlot((prev) => {
            const patch = slotRevealCountsFromGlobal(unit.slotIndices, revealG, displayTokens);
            const m = new Map(prev ?? []);
            for (const [k, v] of patch) m.set(k, v);
            return m;
          });

          tryOpenNext(hideCount, revealG);
          await sleep(charIv);
        }

        if (nextIndex != null && !gateNextRef.v) {
          gateNextRef.v = true;
          gateWaiters[nextIndex]!.open();
        }

        if (unit.source === 'keyboard' && letter) {
          setCascadeLetterHides((prev) => {
            const m = new Map(prev ?? []);
            m.delete(letter);
            return m.size > 0 ? m : null;
          });
          setCascadeLetterGlow((prev) => {
            const m = new Map(prev ?? []);
            m.delete(letter);
            return m.size > 0 ? m : null;
          });
        } else {
          setCascadeLexiconHide((prev) => {
            const m = new Map(prev ?? []);
            m.delete(unit.lexiconKey);
            return m.size > 0 ? m : null;
          });
        }

        setCascadeRevealBySlot((prev) => {
          const m = new Map(prev ?? []);
          for (const si of unit.slotIndices) m.delete(si);
          return m.size > 0 ? m : null;
        });

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

        setCascadeGreySquashBySlot((prev) => {
          const m = new Map(prev ?? []);
          for (const si of unit.slotIndices) m.delete(si);
          return m.size > 0 ? m : null;
        });
      };

      const runUnit = async (k: number) => {
        await gateWaiters[k]!.p;
        if (gen !== cascadeGenRef.current) return;

        if (k >= 2 && delta12 != null && tUnitStart[k - 1]! > 0) {
          const minAt = tUnitStart[k - 1]! + delta12 * Math.pow(0.9, k - 1);
          const w = minAt - performance.now();
          if (w > 0) await sleep(w);
        }

        tUnitStart[k] = performance.now();
        if (k === 1 && tUnitStart[0]! > 0) {
          delta12 = tUnitStart[1]! - tUnitStart[0]!;
        }

        const unit = queue[k]!;
        await sourceGlowRamp(unit);
        if (gen !== cascadeGenRef.current) return;

        const gateNextRef = { v: false };
        const nextIdx = k + 1 < nUnits ? k + 1 : null;
        await letterLoop(unit, k, gateNextRef, nextIdx);
      };

      try {
        await Promise.all(queue.map((_, i) => runUnit(i)));
      } finally {
        setCascadePillAttractBySlot(null);
        setCascadeLetterHides(null);
        setCascadeLetterGlow(null);
        setCascadeLexiconHide(null);
        setCascadeLexiconGlow(null);
        setCascadeRevealBySlot(null);
        setCascadeVisualHold(null);
        setCascadeEarlyReveal(null);
        setCascadeGreySquashBySlot(null);
      }
    },
    [canonicalBySlot, displayTokens]
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

        await runSingleRoundCascadeLetters(plan, keyboardSnap, gen);
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
      runSingleRoundCascadeLetters,
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
    cascadeLetterHides,
    cascadeLetterGlow,
    cascadeLexiconHide,
    cascadeLexiconGlow,
    cascadePillAttractBySlot,
    cascadeGreySquashBySlot,
    cascadeRevealBySlot,
    canDevUndo: undoPastRef.current.length > 0,
    canDevRedo: undoFutureRef.current.length > 0,
    devUndo,
    devRedo,
  };
}
