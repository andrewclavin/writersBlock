/**
 * Subset of parser output used by gameplay and RTK book bundle.
 * Full JSON may include more fields; we only type what the client relies on.
 */
export type ParsedBookWord = {
  index: number;
  raw: string;
  canonical: string;
};

export type BookJsonBundle = {
  words: ParsedBookWord[];
  lexicon: unknown[];
};
