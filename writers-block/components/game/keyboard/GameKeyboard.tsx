import { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { KeyboardLetterCandidate } from '@/components/game/samplePassageLogic';

import { LetterKey } from './LetterKey';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

type GameKeyboardProps = {
  nextWordsByLetter: Map<string, KeyboardLetterCandidate>;
  onWordSelect: (index: number, pressedWord: string) => void;
  /** Distance from physical bottom of screen to top of keyboard block (tab bar + footer chrome). */
  bottomOffset: number;
  /** When false, the keyboard is not rendered (e.g. lexicon drawer is open). */
  visible?: boolean;
  /** Web: index of the key candidate selected via typing or Tab (not yet committed). */
  highlightedWordIndex?: number | null;
  /** Web: disambiguate when several keys share the same slot index (phrase + bank distractors). */
  highlightedCandidateWord?: string | null;
  onLetterFocusHighlight?: (wordIndex: number, word: string) => void;
  /** Web: clear typing highlight when focus leaves all letter keys. */
  onClearLetterHighlight?: () => void;
  cascadeHideLetter?: string | null;
  registerLetterCascadeAnchor?: (letter: string, node: View | null) => void;
};

export function GameKeyboard({
  nextWordsByLetter,
  onWordSelect,
  bottomOffset,
  visible = true,
  highlightedWordIndex = null,
  highlightedCandidateWord = null,
  onLetterFocusHighlight,
  onClearLetterHighlight,
  cascadeHideLetter = null,
  registerLetterCascadeAnchor,
}: GameKeyboardProps) {
  const onLetterBlurCheckLeave = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.activeElement;
    if (el && 'closest' in el && typeof el.closest === 'function') {
      if (el.closest('[data-testid^="game-letter-"]')) return;
    }
    onClearLetterHighlight?.();
  }, [onClearLetterHighlight]);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
      {ROWS.map((row, rowIndex) => (
        <View
          key={row.join('')}
          style={[
            styles.row,
            rowIndex === 1 && { paddingLeft: 24 },
            rowIndex === 2 && { paddingLeft: 48 },
          ]}>
          {row.map((letter) => {
            const data = nextWordsByLetter.get(letter);
            return (
              <LetterKey
                key={letter}
                letter={letter}
                hasWord={!!data}
                word={data?.word}
                displayWord={data?.displayWord}
                phrasePrefix={data?.phrasePrefix}
                phraseSuffix={data?.phraseSuffix}
                wordIndex={data?.index}
                onWordSelect={onWordSelect}
                isHighlighted={
                  data != null &&
                  highlightedWordIndex != null &&
                  highlightedWordIndex === data.index &&
                  (highlightedCandidateWord == null || highlightedCandidateWord === data.word)
                }
                onLetterFocus={onLetterFocusHighlight}
                onLetterBlurCheckLeave={onLetterBlurCheckLeave}
                hideWordBody={cascadeHideLetter === letter}
                onLetterAnchorRef={(node) => registerLetterCascadeAnchor?.(letter, node)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
