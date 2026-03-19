import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { BookId, BookSessionState, SessionState } from './types';

function createDefaultBookSessionState(): BookSessionState {
  return {
    lockedContextSignature: null,
    activeSlotIndex: null,
    wordBankPhraseDrafts: [],
    attemptsBySlotIndex: {},
    lockedSlotIndices: [],
  };
}

function ensureBookState(state: SessionState, bookId: BookId): BookSessionState {
  if (!state.byBookId[bookId]) state.byBookId[bookId] = createDefaultBookSessionState();
  return state.byBookId[bookId];
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
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

