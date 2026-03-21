import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { BookId, BookSessionState, SessionState } from './types';

function createDefaultBookSessionState(): BookSessionState {
  return {
    lockedContextSignature: null,
    activeSlotIndex: null,
    wordBankPhraseDrafts: [],
    attemptsBySlotIndex: {},
    lockedSlotIndices: [],
    lexiconMergeSinglesConsumed: {},
    lexiconManualPhraseCounts: {},
  };
}

function ensureBookState(state: SessionState, bookId: BookId): BookSessionState {
  if (!state.byBookId[bookId]) state.byBookId[bookId] = createDefaultBookSessionState();
  const book = state.byBookId[bookId];
  if (!book.lexiconMergeSinglesConsumed) book.lexiconMergeSinglesConsumed = {};
  if (!book.lexiconManualPhraseCounts) book.lexiconManualPhraseCounts = {};
  return book;
}

const initialState: SessionState = {
  lastBookId: null,
  byBookId: {},
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setLastBookId(state, action: PayloadAction<BookId | null>) {
      state.lastBookId = action.payload;
    },
    resetBookSession(state, action: PayloadAction<{ bookId: BookId }>) {
      const { bookId } = action.payload;
      state.byBookId[bookId] = createDefaultBookSessionState();
    },

    setLockedContextSignature(
      state,
      action: PayloadAction<{ bookId: BookId; lockedContextSignature: string | null }>
    ) {
      const { bookId, lockedContextSignature } = action.payload;
      const bookState = ensureBookState(state, bookId);
      bookState.lockedContextSignature = lockedContextSignature;
    },

    setActiveSlotIndex(state, action: PayloadAction<{ bookId: BookId; activeSlotIndex: number | null }>) {
      const { bookId, activeSlotIndex } = action.payload;
      const bookState = ensureBookState(state, bookId);
      bookState.activeSlotIndex = activeSlotIndex;
    },

    setWordBankPhraseDrafts(
      state,
      action: PayloadAction<{ bookId: BookId; wordBankPhraseDrafts: string[] }>
    ) {
      const { bookId, wordBankPhraseDrafts } = action.payload;
      const bookState = ensureBookState(state, bookId);
      bookState.wordBankPhraseDrafts = wordBankPhraseDrafts;
    },

    recordAttempt(
      state,
      action: PayloadAction<{ bookId: BookId; slotIndex: number; guessRaw: string }>
    ) {
      const { bookId, slotIndex, guessRaw } = action.payload;
      const bookState = ensureBookState(state, bookId);
      const key = String(slotIndex);
      if (!bookState.attemptsBySlotIndex[key]) bookState.attemptsBySlotIndex[key] = [];
      bookState.attemptsBySlotIndex[key].push(guessRaw);
    },

    lockSlotIndices(state, action: PayloadAction<{ bookId: BookId; lockedSlotIndices: string[] }>) {
      const { bookId, lockedSlotIndices } = action.payload;
      const bookState = ensureBookState(state, bookId);
      bookState.lockedSlotIndices = lockedSlotIndices;
    },

    applyLexiconPhraseMerge(
      state,
      action: PayloadAction<{
        bookId: BookId;
        leftKey: string;
        rightKey: string;
        mergedPhrase: string;
      }>
    ) {
      const { bookId, leftKey, rightKey, mergedPhrase } = action.payload;
      const bookState = ensureBookState(state, bookId);

      const decMap = (rec: Record<string, number>, key: string) => {
        const next = (rec[key] ?? 0) - 1;
        if (next <= 0) delete rec[key];
        else rec[key] = next;
      };

      const consumeKey = (key: string) => {
        if (key.includes(' ')) decMap(bookState.lexiconManualPhraseCounts, key);
        else {
          const n = (bookState.lexiconMergeSinglesConsumed[key] ?? 0) + 1;
          bookState.lexiconMergeSinglesConsumed[key] = n;
        }
      };

      consumeKey(leftKey);
      consumeKey(rightKey);

      const prev = bookState.lexiconManualPhraseCounts[mergedPhrase] ?? 0;
      bookState.lexiconManualPhraseCounts[mergedPhrase] = prev + 1;
    },
  },
});

export const {
  setLastBookId,
  resetBookSession,
  setLockedContextSignature,
  setActiveSlotIndex,
  setWordBankPhraseDrafts,
  recordAttempt,
  lockSlotIndices,
  applyLexiconPhraseMerge,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

