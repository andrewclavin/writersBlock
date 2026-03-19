import type { BookId } from '../state/session/types';

/**
 * Pure game/session boundary types.
 *
 * The actual reducers live in Redux slices; this file exists so the eventual
 * game logic can depend on stable types without importing Redux Toolkit.
 */
export interface LockedContext {
  bookId: BookId;
  lockedContextSignature: string | null;
}

