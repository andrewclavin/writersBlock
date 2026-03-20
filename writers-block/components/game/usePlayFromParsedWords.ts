import { useCallback, useMemo, useState } from 'react';

import type { ParsedBookWord } from '@/src/data/bookTypes';

import {
  buildWordModelFromParsedBook,
  computeNextWordsByLetter,
  computePlacedWordCounts,
} from './samplePassageLogic';

/** Play session driven by `*.words.json` rows (canonical + raw + index). */
export function usePlayFromParsedWords(bookWords: ParsedBookWord[]) {
  const [placedWords, setPlacedWords] = useState<Set<number>>(() => new Set());
  const [currentPosition, setCurrentPosition] = useState(0);

  const { displayTokens, wordInfos, wordCounts } = useMemo(
    () => buildWordModelFromParsedBook(bookWords),
    [bookWords]
  );

  const slotCount = displayTokens.length;

  const nextWordsByLetter = useMemo(
    () => computeNextWordsByLetter(wordInfos, placedWords, currentPosition),
    [wordInfos, placedWords, currentPosition]
  );

  const placedWordCounts = useMemo(
    () => computePlacedWordCounts(wordInfos, placedWords),
    [wordInfos, placedWords]
  );

  const handleWordSelect = useCallback(
    (index: number) => {
      let targetIndex = currentPosition;
      while (targetIndex < slotCount && placedWords.has(targetIndex)) {
        targetIndex++;
      }
      if (targetIndex === index) {
        setPlacedWords((prev) => new Set([...prev, index]));
        setCurrentPosition(targetIndex + 1);
      }
    },
    [currentPosition, placedWords, slotCount]
  );

  const handleReset = useCallback(() => {
    setPlacedWords(new Set());
    setCurrentPosition(0);
  }, []);

  const totalActualWords = wordInfos.length;
  const placedActualWords = wordInfos.filter((info) => placedWords.has(info.originalIndex)).length;
  const progress = totalActualWords > 0 ? (placedActualWords / totalActualWords) * 100 : 0;

  return {
    words: displayTokens,
    wordInfos,
    wordCounts,
    nextWordsByLetter,
    placedWordCounts,
    placedWords,
    currentPosition,
    handleWordSelect,
    handleReset,
    progress,
    totalActualWords,
    placedActualWords,
  };
}
