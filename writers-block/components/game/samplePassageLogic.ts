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
  return { wordInfos, wordCounts, displayTokens };
}

export type KeyboardLetterCandidate = {
  /** Canonical token expected at `index` (typing + placement). */
  word: string;
  index: number;
  /** Grey prefix before `word` when showing a lexicon-linked phrase on the key. */
  phrasePrefix?: string;
  /** Grey suffix after `word` on the same key. */
  phraseSuffix?: string;
};

/** Nearest unplaced word per letter at or after `fromSlotIndex`, in passage order. */
export function computeNextWordsByLetter(
  wordInfos: WordInfo[],
  placedWords: Set<number>,
  fromSlotIndex: number
): Map<string, KeyboardLetterCandidate> {
  const map = new Map<string, KeyboardLetterCandidate>();
  const unplacedWords = wordInfos.filter(
    (info) => !placedWords.has(info.originalIndex) && info.originalIndex >= fromSlotIndex
  );
  const sorted = [...unplacedWords].sort((a, b) => a.originalIndex - b.originalIndex);
  sorted.forEach((info) => {
    const firstLetter = info.word[0].toUpperCase();
    if (!map.has(firstLetter)) {
      map.set(firstLetter, { word: info.word, index: info.originalIndex });
    }
  });
  return map;
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
