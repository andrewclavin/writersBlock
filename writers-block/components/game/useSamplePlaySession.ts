import { useCallback, useMemo, useState } from 'react';

import {
  buildWordModel,
  computeNextWordsByLetter,
  computePlacedWordCounts,
  parseText,
  SAMPLE_PASSAGE,
} from './samplePassageLogic';

export function useSamplePlaySession(passageText: string = SAMPLE_PASSAGE) {
  const [placedWords, setPlacedWords] = useState<Set<number>>(() => new Set());
  const [currentPosition, setCurrentPosition] = useState(0);

  const words = useMemo(() => parseText(passageText), [passageText]);
  const { wordInfos, wordCounts } = useMemo(() => buildWordModel(words), [words]);

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
      while (targetIndex < words.length && placedWords.has(targetIndex)) {
        targetIndex++;
      }
      if (targetIndex === index) {
        setPlacedWords((prev) => new Set([...prev, index]));
        setCurrentPosition(targetIndex + 1);
      }
    },
    [currentPosition, placedWords, words.length]
  );

  const handleReset = useCallback(() => {
    setPlacedWords(new Set());
    setCurrentPosition(0);
  }, []);

  const totalActualWords = wordInfos.length;
  const placedActualWords = wordInfos.filter((info) => placedWords.has(info.originalIndex)).length;
  const progress = totalActualWords > 0 ? (placedActualWords / totalActualWords) * 100 : 0;

  return {
    words,
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
