import type { BookSessionState } from '../state/session/types';

/**
 * Minimal word shape for placement: the book JSON includes more fields.
 */
export type WordForPlacement = {
  canonical: string;
};

export type WordPlacementAttemptOutcome =
  | 'correct'
  | 'wrong'
  | 'no_active_slot'
  | 'slot_already_locked'
  | 'invalid_slot_index';

function cloneBookSession(session: BookSessionState): BookSessionState {
  return {
    ...session,
    wordBankPhraseDrafts: [...session.wordBankPhraseDrafts],
    attemptsBySlotIndex: { ...session.attemptsBySlotIndex },
    lockedSlotIndices: [...session.lockedSlotIndices],
  };
}

/**
 * Pure session update for a single placement try at the active slot.
 *
 * - Correct: appends the slot index to `lockedSlotIndices` (string keys).
 * - Wrong: appends `canonicalGuess` to `attemptsBySlotIndex` for that slot.
 *
 * Returns the input `session` reference when the state is unchanged.
 */
export function applyWordPlacementAttempt(
  session: BookSessionState,
  words: WordForPlacement[],
  canonicalGuess: string
): { state: BookSessionState; outcome: WordPlacementAttemptOutcome } {
  const active = session.activeSlotIndex;
  if (active === null) {
    return { state: session, outcome: 'no_active_slot' };
  }

  if (active < 0 || active >= words.length) {
    return { state: session, outcome: 'invalid_slot_index' };
  }

  const slotKey = String(active);
  if (session.lockedSlotIndices.includes(slotKey)) {
    return { state: session, outcome: 'slot_already_locked' };
  }

  const expected = words[active].canonical;
  if (canonicalGuess === expected) {
    const next = cloneBookSession(session);
    next.lockedSlotIndices = [...next.lockedSlotIndices, slotKey];
    return { state: next, outcome: 'correct' };
  }

  const next = cloneBookSession(session);
  const prev = next.attemptsBySlotIndex[slotKey] ?? [];
  next.attemptsBySlotIndex[slotKey] = [...prev, canonicalGuess];
  return { state: next, outcome: 'wrong' };
}
