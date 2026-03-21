import type { ParsedBookWord } from '@/src/data/bookTypes';

/** Canonical tokens in passage order (contiguous stream of in-text words). */
export function buildBookCanonicalSequence(bookWords: ParsedBookWord[]): string[] {
  return [...bookWords].sort((a, b) => a.index - b.index).map((w) => w.canonical);
}

/**
 * `result[slotIndex]` = canonical token at that passage slot, or `''` if the slot
 * has no word (punctuation-only gap, etc.). Use this whenever logic keys off
 * **`selectedSlotIndex` / `placedWords`** (keyboard phrase mode, cascade lock).
 *
 * `buildBookCanonicalSequence` is a **dense** word stream (no holes); do not use
 * its array offsets as slot indices.
 */
export function buildCanonicalBySlot(bookWords: ParsedBookWord[]): string[] {
  const sorted = [...bookWords].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) return [];
  const slotCount = sorted[sorted.length - 1]!.index + 1;
  const out: string[] = Array(slotCount).fill('');
  for (const w of sorted) {
    out[w.index] = w.canonical;
  }
  return out;
}

export function phraseOccursConsecutively(
  bookCanonicals: readonly string[],
  phraseWords: readonly string[]
): boolean {
  const m = phraseWords.length;
  if (m === 0) return false;
  outer: for (let i = 0; i <= bookCanonicals.length - m; i++) {
    for (let j = 0; j < m; j++) {
      if (bookCanonicals[i + j] !== phraseWords[j]) continue outer;
    }
    return true;
  }
  return false;
}

function firstPhraseIndex(bookCanonicals: readonly string[], phraseWords: readonly string[]): number {
  const m = phraseWords.length;
  if (m === 0) return Number.POSITIVE_INFINITY;
  outer: for (let i = 0; i <= bookCanonicals.length - m; i++) {
    for (let j = 0; j < m; j++) {
      if (bookCanonicals[i + j] !== phraseWords[j]) continue outer;
    }
    return i;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Validates drag-merge of two lexicon keys (single word or space-joined phrase).
 * Returns ordered parts and merged phrase when either concatenation appears in the book.
 */
export function resolveValidLexiconMerge(
  keyA: string,
  keyB: string,
  bookCanonicals: readonly string[]
): { leftKey: string; rightKey: string; mergedPhrase: string } | null {
  const aWords = keyA.trim().split(/\s+/).filter(Boolean);
  const bWords = keyB.trim().split(/\s+/).filter(Boolean);
  if (aWords.length === 0 || bWords.length === 0) return null;

  const ab = [...aWords, ...bWords];
  const ba = [...bWords, ...aWords];
  const okAb = phraseOccursConsecutively(bookCanonicals, ab);
  const okBa = phraseOccursConsecutively(bookCanonicals, ba);

  if (okAb && !okBa) {
    return { leftKey: keyA, rightKey: keyB, mergedPhrase: ab.join(' ') };
  }
  if (okBa && !okAb) {
    return { leftKey: keyB, rightKey: keyA, mergedPhrase: ba.join(' ') };
  }
  if (okAb && okBa) {
    const iAb = firstPhraseIndex(bookCanonicals, ab);
    const iBa = firstPhraseIndex(bookCanonicals, ba);
    if (iAb <= iBa) {
      return { leftKey: keyA, rightKey: keyB, mergedPhrase: ab.join(' ') };
    }
    return { leftKey: keyB, rightKey: keyA, mergedPhrase: ba.join(' ') };
  }
  return null;
}
