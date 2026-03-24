import type { ParsedBookWord } from '@/src/data/bookTypes';

export const SAMPLE_PASSAGE = `It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.`;

export interface WordInfo {
  word: string;
  originalIndex: number;
  alphabeticalIndex: number;
}

export function parseText(text: string): string[] {
  const regex = /[A-Z][a-z]*'?[a-z]*[.,!?;:]?|[a-z]+'?[a-z]*[.,!?;:]?/g;
  const matches = text.match(regex);
  return matches ?? [];
}

export function buildWordModel(words: string[]) {
  const wordInfos: WordInfo[] = [];
  words.forEach((word, index) => {
    const baseWord = word.toLowerCase().replace(/[.,!?;:'")(—\-\[\]{}]/g, '');
    if (baseWord) {
      wordInfos.push({
        word: baseWord,
        originalIndex: index,
        alphabeticalIndex: 0,
      });
    }
  });

  const sortedInfos = [...wordInfos].sort((a, b) => a.word.localeCompare(b.word));
  sortedInfos.forEach((info, i) => {
    info.alphabeticalIndex = i;
  });

  const wordCounts = new Map<string, number>();
  wordInfos.forEach((info) => {
    wordCounts.set(info.word, (wordCounts.get(info.word) || 0) + 1);
  });

  return { wordInfos, wordCounts };
}

/** Build keyboard / lexicon model from parser JSON (`index`, `raw`, `canonical`). */
export function buildWordModelFromParsedBook(bookWords: ParsedBookWord[]) {
  const sorted = [...bookWords].sort((a, b) => a.index - b.index);
  const wordInfos: WordInfo[] = sorted.map((w) => ({
    word: w.canonical,
    originalIndex: w.index,
    alphabeticalIndex: 0,
  }));
  const sortedAlpha = [...wordInfos].sort(
    (a, b) => a.word.localeCompare(b.word) || a.originalIndex - b.originalIndex
  );
  sortedAlpha.forEach((info, i) => {
    info.alphabeticalIndex = i;
  });
  const wordCounts = new Map<string, number>();
  wordInfos.forEach((info) => {
    wordCounts.set(info.word, (wordCounts.get(info.word) || 0) + 1);
  });
  const slotCount =
    sorted.length === 0 ? 0 : sorted[sorted.length - 1]!.index + 1;
  const displayTokens: string[] = Array(slotCount).fill('\u00A0');
  sorted.forEach((w) => {
    displayTokens[w.index] = w.raw;
  });

  const paragraphBreakIndices = new Set<number>();
  for (const w of sorted) {
    if (w.boundaryBefore === 'paragraph') paragraphBreakIndices.add(w.index);
  }

  return { wordInfos, wordCounts, displayTokens, paragraphBreakIndices };
}

export type KeyboardLetterCandidate = {
  /** Canonical token expected at `index` (typing + placement). */
  word: string;
  index: number;
  /** Raw form from the passage (with capitalization + punctuation) for display. */
  displayWord?: string;
  /** Grey prefix before `word` when showing a lexicon-linked phrase on the key. */
  phrasePrefix?: string;
  /** Grey suffix after `word` on the same key. */
  phraseSuffix?: string;
};

/** Nearest unplaced word per letter at or after `fromSlotIndex`, in passage order. */
export function computeNextWordsByLetter(
  wordInfos: WordInfo[],
  placedWords: Set<number>,
  fromSlotIndex: number,
  displayTokens?: readonly string[]
): Map<string, KeyboardLetterCandidate> {
  const map = new Map<string, KeyboardLetterCandidate>();
  const unplacedWords = wordInfos.filter(
    (info) => !placedWords.has(info.originalIndex) && info.originalIndex >= fromSlotIndex
  );
  const sorted = [...unplacedWords].sort((a, b) => a.originalIndex - b.originalIndex);
  sorted.forEach((info) => {
    const raw = displayTokens?.[info.originalIndex];
    const firstLetter = (raw ?? info.word)[0]!.toUpperCase();
    if (!map.has(firstLetter)) {
      map.set(firstLetter, {
        word: info.word,
        index: info.originalIndex,
        displayWord: raw,
      });
    }
  });
  return map;
}

/**
 * Builds a display string for each canonical word that annotates capitalization
 * and trailing punctuation variants in parentheses.
 *
 * - Single unique raw form → use it as-is (e.g. "Many." stays "Many.")
 * - Multiple variants → `(M)any(.,)` style:
 *   - Leading capital that appears in some (not all) variants → `(X)rest`
 *   - Trailing punctuation collected across variants → `word(.,)`
 */
export function buildVariantDisplayMap(bookWords: ParsedBookWord[]): Map<string, string> {
  const groups = new Map<string, Set<string>>();
  for (const w of bookWords) {
    if (!groups.has(w.canonical)) groups.set(w.canonical, new Set());
    groups.get(w.canonical)!.add(w.raw);
  }

  const result = new Map<string, string>();
  for (const [canonical, rawSet] of groups) {
    if (!canonical) continue;
    const raws = [...rawSet];

    if (raws.length === 1) {
      result.set(canonical, raws[0]!);
      continue;
    }

    // Detect capitalization: does any variant start with uppercase?
    const hasUpper = raws.some((r) => r[0] !== r[0]!.toLowerCase());
    const allUpper = raws.every((r) => r[0] !== r[0]!.toLowerCase());

    // Collect unique trailing punctuation characters
    const trailingPunc = new Set<string>();
    for (const r of raws) {
      const m = r.match(/[.,!?;:]+$/);
      if (m) {
        for (const ch of m[0]) trailingPunc.add(ch);
      }
    }

    // Base is the canonical (all-lowercase, no punctuation)
    let display = canonical;

    if (hasUpper && !allUpper) {
      const cap = canonical[0]!.toUpperCase();
      display = `(${cap})${canonical.slice(1)}`;
    } else if (allUpper) {
      display = canonical[0]!.toUpperCase() + canonical.slice(1);
    }

    if (trailingPunc.size > 0) {
      const sorted = [...trailingPunc].sort();
      display += `(${sorted.join('')})`;
    }

    result.set(canonical, display);
  }
  return result;
}

export function computePlacedWordCounts(
  wordInfos: WordInfo[],
  placedWords: ReadonlySet<number>
): Map<string, number> {
  const counts = new Map<string, number>();
  wordInfos.forEach((info) => {
    if (placedWords.has(info.originalIndex)) {
      counts.set(info.word, (counts.get(info.word) || 0) + 1);
    }
  });
  return counts;
}
