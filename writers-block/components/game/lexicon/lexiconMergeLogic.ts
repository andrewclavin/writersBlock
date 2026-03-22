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
/**
 * Returns every contiguous run of `phraseTokens` in `canonicalBySlot`,
 * as arrays of slot indices (one array per occurrence).
 */
export function findAllPhraseOccurrenceSlots(
  canonicalBySlot: readonly string[],
  phraseTokens: readonly string[]
): number[][] {
  const L = phraseTokens.length;
  if (L === 0) return [];
  const results: number[][] = [];
  outer: for (let i = 0; i <= canonicalBySlot.length - L; i++) {
    for (let j = 0; j < L; j++) {
      if (canonicalBySlot[i + j] !== phraseTokens[j]) continue outer;
    }
    const slots: number[] = [];
    for (let j = 0; j < L; j++) slots.push(i + j);
    results.push(slots);
  }
  return results;
}

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

function countOccurrences(
  canonicalBySlot: readonly string[],
  tokens: readonly string[]
): number {
  const L = tokens.length;
  if (L === 0) return 0;
  let n = 0;
  outer: for (let i = 0; i <= canonicalBySlot.length - L; i++) {
    for (let j = 0; j < L; j++) {
      if (canonicalBySlot[i + j] !== tokens[j]) continue outer;
    }
    n++;
  }
  return n;
}

export type AutoChainResult = {
  leftKey: string;
  rightKey: string;
  mergedPhrase: string;
  totalOccurrences: number;
};

/**
 * After a new phrase is created, detect overlapping phrase pairs that should
 * auto-chain into longer phrases.
 *
 * **Simple case**: a-b exists, b-c just merged (or vice versa). If every
 * occurrence of b-c in the text is part of a-b-c, auto-create a-b-c.
 *
 * **All-variants-covered case**: a-b exists, and a-b only appears as a-b-X
 * in the text. If every distinct X variant's tail (b-X) is already a phrase,
 * auto-create all a-b-X variants.
 */
export function detectAutoChainPhrases(
  newPhrase: string,
  allPhrases: Readonly<Record<string, number>>,
  canonicalBySlot: readonly string[]
): AutoChainResult[] {
  const results: AutoChainResult[] = [];
  const newTokens = newPhrase.trim().split(/\s+/).filter(Boolean);
  if (newTokens.length < 2) return results;

  const phraseKeys = Object.keys(allPhrases).filter(
    (k) => (allPhrases[k] ?? 0) > 0
  );

  // Simple case: try extending on the left (existing a-b + new b-c → a-b-c)
  for (const existingKey of phraseKeys) {
    if (existingKey === newPhrase) continue;
    const existingTokens = existingKey.trim().split(/\s+/).filter(Boolean);
    if (existingTokens.length < 1) continue;

    // Check if existing phrase's tail overlaps with new phrase's head.
    // E.g., existing = [a, b], new = [b, c] → overlap on [b] → merged = [a, b, c]
    const maxOverlap = Math.min(existingTokens.length, newTokens.length);
    for (let ov = 1; ov < maxOverlap + 1 && ov <= existingTokens.length && ov <= newTokens.length; ov++) {
      const existingTail = existingTokens.slice(existingTokens.length - ov);
      const newHead = newTokens.slice(0, ov);
      if (existingTail.join(' ') !== newHead.join(' ')) continue;

      const merged = [...existingTokens, ...newTokens.slice(ov)];
      const mergedKey = merged.join(' ');
      if ((allPhrases[mergedKey] ?? 0) > 0) continue; // already exists

      const mergedCount = countOccurrences(canonicalBySlot, merged);
      if (mergedCount === 0) continue;

      const newCount = countOccurrences(canonicalBySlot, newTokens);
      if (newCount === mergedCount) {
        results.push({
          leftKey: existingKey,
          rightKey: newPhrase,
          mergedPhrase: mergedKey,
          totalOccurrences: mergedCount,
        });
      }
    }

    // Reverse: new phrase's tail overlaps with existing phrase's head.
    // E.g., new = [a, b], existing = [b, c] → merged = [a, b, c]
    for (let ov = 1; ov < Math.min(newTokens.length, existingTokens.length) + 1 && ov <= newTokens.length && ov <= existingTokens.length; ov++) {
      const newTail = newTokens.slice(newTokens.length - ov);
      const existingHead = existingTokens.slice(0, ov);
      if (newTail.join(' ') !== existingHead.join(' ')) continue;

      const merged = [...newTokens, ...existingTokens.slice(ov)];
      const mergedKey = merged.join(' ');
      if ((allPhrases[mergedKey] ?? 0) > 0) continue;

      const mergedCount = countOccurrences(canonicalBySlot, merged);
      if (mergedCount === 0) continue;

      const existingCount = countOccurrences(canonicalBySlot, existingTokens);
      if (existingCount === mergedCount) {
        results.push({
          leftKey: newPhrase,
          rightKey: existingKey,
          mergedPhrase: mergedKey,
          totalOccurrences: mergedCount,
        });
      }
    }
  }

  // All-variants-covered case: for each 2-word phrase a-b, check if all
  // text continuations a-b-X have their tail b-X covered by existing phrases.
  for (const existingKey of phraseKeys) {
    const existingTokens = existingKey.trim().split(/\s+/).filter(Boolean);
    if (existingTokens.length < 2) continue;

    // Find all distinct next-word continuations in the text
    const L = existingTokens.length;
    const continuations = new Map<string, number>(); // nextWord → count
    for (let S = 0; S <= canonicalBySlot.length - L - 1; S++) {
      let match = true;
      for (let j = 0; j < L; j++) {
        if (canonicalBySlot[S + j] !== existingTokens[j]) { match = false; break; }
      }
      if (!match) continue;
      const next = canonicalBySlot[S + L] ?? '';
      if (!next) continue;
      continuations.set(next, (continuations.get(next) ?? 0) + 1);
    }
    if (continuations.size === 0) continue;

    // Check if every continuation's tail phrase exists in the bank
    let allCovered = true;
    const toCreate: AutoChainResult[] = [];
    for (const [nextWord, cnt] of continuations) {
      const tailKey = existingTokens.slice(existingTokens.length - 1).join(' ') + ' ' + nextWord;
      const tailTokens = tailKey.split(' ');
      const tailInBank = phraseKeys.some((k) => {
        const kt = k.trim().split(/\s+/).filter(Boolean);
        return kt.length === tailTokens.length && kt.every((t, i) => t === tailTokens[i]);
      });
      if (!tailInBank) { allCovered = false; break; }

      const mergedTokens = [...existingTokens, nextWord];
      const mergedKey = mergedTokens.join(' ');
      if ((allPhrases[mergedKey] ?? 0) > 0) continue; // already exists
      if (results.some((r) => r.mergedPhrase === mergedKey)) continue; // already found

      toCreate.push({
        leftKey: existingKey,
        rightKey: tailKey,
        mergedPhrase: mergedKey,
        totalOccurrences: cnt,
      });
    }
    if (allCovered && toCreate.length > 0) {
      // Sort by first occurrence in text
      toCreate.sort((a, b) => {
        const aTokens = a.mergedPhrase.split(' ');
        const bTokens = b.mergedPhrase.split(' ');
        return firstPhraseIndex(canonicalBySlot, aTokens) - firstPhraseIndex(canonicalBySlot, bTokens);
      });
      results.push(...toCreate);
    }
  }

  // Deduplicate by mergedPhrase
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.mergedPhrase)) return false;
    seen.add(r.mergedPhrase);
    return true;
  });
}
