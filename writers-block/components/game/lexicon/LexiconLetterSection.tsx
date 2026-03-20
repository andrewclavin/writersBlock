import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LexiconWordChip } from './LexiconWordChip';

type WordEntry = { word: string; remaining: number };

type LexiconLetterSectionProps = {
  letter: string;
  wordsForLetter: WordEntry[];
  expanded: boolean;
  onToggleLetter: (letter: string) => void;
  onWordPress: (word: string) => void;
};

export function LexiconLetterSection({
  letter,
  wordsForLetter,
  expanded,
  onToggleLetter,
  onWordPress,
}: LexiconLetterSectionProps) {
  const sortedWords = useMemo(() => {
    const list = [...wordsForLetter];
    if (expanded) {
      return list.sort((a, b) => a.word.localeCompare(b.word));
    }
    return list.sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.word.localeCompare(b.word);
    });
  }, [wordsForLetter, expanded]);

  const previewWords = sortedWords.slice(0, 3);
  const displayWords = expanded ? sortedWords : previewWords;
  const overflow = wordsForLetter.length - previewWords.length;

  if (wordsForLetter.length === 0) return null;

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onToggleLetter(letter)}
          style={({ pressed }) => [styles.letterBtn, pressed && styles.letterBtnPressed]}>
          <Text style={styles.letterText}>{letter}</Text>
        </Pressable>
        <View style={styles.chips}>
          {!expanded ? (
            <>
              {previewWords.map(({ word, remaining }) => (
                <LexiconWordChip
                  key={word}
                  word={word}
                  remaining={remaining}
                  onPress={() => onWordPress(word)}
                />
              ))}
              {overflow > 0 && <Text style={styles.more}>+{overflow}</Text>}
            </>
          ) : (
            displayWords.slice(0, Math.min(3, displayWords.length)).map(({ word, remaining }) => (
              <LexiconWordChip
                key={word}
                word={word}
                remaining={remaining}
                onPress={() => onWordPress(word)}
              />
            ))
          )}
        </View>
      </View>
      {expanded && displayWords.length > 3 && (
        <View style={styles.expandedRow}>
          {displayWords.slice(3).map(({ word, remaining }) => (
            <LexiconWordChip
              key={word}
              word={word}
              remaining={remaining}
              onPress={() => onWordPress(word)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  letterBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBtnPressed: {
    borderColor: '#9CA3AF',
  },
  letterText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  more: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 52,
  },
});
