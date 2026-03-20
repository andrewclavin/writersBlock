import { StyleSheet, View } from 'react-native';
import { LetterKey } from './LetterKey';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

type GameKeyboardProps = {
  nextWordsByLetter: Map<string, { word: string; index: number }>;
  onWordSelect: (index: number) => void;
  /** Distance from physical bottom of screen to top of keyboard block (tab bar + footer chrome). */
  bottomOffset: number;
};

export function GameKeyboard({ nextWordsByLetter, onWordSelect, bottomOffset }: GameKeyboardProps) {
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
                wordIndex={data?.index}
                onWordSelect={onWordSelect}
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
