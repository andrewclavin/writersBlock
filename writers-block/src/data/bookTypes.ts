/**
 * Subset of parser output used by gameplay and RTK book bundle.
 * Full JSON may include more fields; we only type what the client relies on.
 */
export type ParsedBookWord = {
  index: number;
  raw: string;
  canonical: string;
  /** Structural boundary immediately before this word (from parser). */
  boundaryBefore?: 'paragraph' | 'section' | 'chapter' | 'part' | null;
};

export type BookJsonBundle = {
  words: ParsedBookWord[];
  lexicon: unknown[];
};
