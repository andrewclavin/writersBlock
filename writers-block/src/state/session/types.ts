export type BookId = string;

export interface BookSessionState {
  /**
   * Used to prevent mixing attempt history across changed lock contexts.
   * For now it's just a persisted string; the actual signature computation
   * will be introduced alongside the cascade/locking logic.
   */
  lockedContextSignature: string | null;

  /**
   * Which slot is currently active (index into the book's word array).
   * `null` means no active slot selected.
   */
  activeSlotIndex: number | null;

  /**
   * Draft phrase strings built from adjacent locked words (not yet locked
   * into the passage). We persist the drafts so "offline continue" feels
   * seamless.
   */
  wordBankPhraseDrafts: string[];

  /**
   * Attempts keyed by slot index (stored as string for JSON persistence).
   * Each attempt is stored as the raw guess string.
   */
  attemptsBySlotIndex: Record<string, string[]>;

  /**
   * Indices of words that are locked (placed) into the passage.
   * Stored as string for stable JSON serialization.
   */
  lockedSlotIndices: string[];

  /**
   * Singles consumed by manual lexicon drag-merge (still unplaced in passage).
   * Keys are canonical single-word strings.
   */
  lexiconMergeSinglesConsumed: Record<string, number>;

  /**
   * Phrases formed in the word bank via drag-merge. Keys are space-joined
   * canonical tokens (e.g. "quick brown").
   */
  lexiconManualPhraseCounts: Record<string, number>;
}

export interface SessionState {
  lastBookId: BookId | null;
  byBookId: Record<BookId, BookSessionState>;
}

