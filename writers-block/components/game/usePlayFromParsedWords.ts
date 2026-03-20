import { useCallback, useEffect, useMemo } from 'react';

import type { ParsedBookWord } from '@/src/data/bookTypes';
import { useAppDispatch, useAppSelector } from '@/src/state/hooks';
import {
  lockSlotIndices,
  resetBookSession,
  setActiveSlotIndex,
  setLastBookId,
} from '@/src/state/session/sessionSlice';
import type { BookId } from '@/src/state/session/types';
import { store } from '@/src/state/store';

import {
  buildWordModelFromParsedBook,
  computeNextWordsByLetter,
  computePlacedWordCounts,
} from './samplePassageLogic';

/** Play session driven by `*.words.json` rows; progress persisted per `bookId` in Redux session slice. */
export function usePlayFromParsedWords(bookWords: ParsedBookWord[], bookId: BookId) {
  const dispatch = useAppDispatch();
  const bookState = useAppSelector((s) => s.session.byBookId[bookId]);

  const { displayTokens, wordInfos, wordCounts } = useMemo(
    () => buildWordModelFromParsedBook(bookWords),
    [bookWords]
  );

  const slotCount = displayTokens.length;

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

  const nextWordsByLetter = useMemo(
    () => computeNextWordsByLetter(wordInfos, placedWords, selectedSlotIndex),
    [wordInfos, placedWords, selectedSlotIndex]
  );

  const placedWordCounts = useMemo(
    () => computePlacedWordCounts(wordInfos, placedWords),
    [wordInfos, placedWords]
  );

  const handleWordSelect = useCallback(
    (wordIndex: number) => {
      if (slotCount <= 0) return;
      const s = store.getState().session.byBookId[bookId];
      const keys = s?.lockedSlotIndices ?? [];
      const currentPlaced = new Set(keys.map(Number).filter((n) => Number.isFinite(n)));
      const raw = s?.activeSlotIndex ?? 0;
      const selected = Math.min(Math.max(0, raw), slotCount - 1);
      if (wordIndex !== selected) return;
      if (currentPlaced.has(selected)) return;
      const nextPlaced = [...currentPlaced, selected]
        .map(String)
        .sort((a, b) => Number(a) - Number(b));
      const nextSel = Math.min(selected + 1, slotCount - 1);
      dispatch(lockSlotIndices({ bookId, lockedSlotIndices: nextPlaced }));
      dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: nextSel }));
    },
    [bookId, dispatch, slotCount]
  );

  const selectSlot = useCallback(
    (index: number) => {
      if (index < 0 || index >= slotCount) return;
      dispatch(setActiveSlotIndex({ bookId, activeSlotIndex: index }));
    },
    [bookId, dispatch, slotCount]
  );

  const handleReset = useCallback(() => {
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
    placedWordCounts,
    placedWords,
    selectedSlotIndex,
    selectSlot,
    handleWordSelect,
    handleReset,
    progress,
    totalActualWords,
    placedActualWords,
  };
}
