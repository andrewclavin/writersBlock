import { ScrollView, StyleSheet, View } from 'react-native';

import { PassageWord } from './PassageWord';

type PassageBodyProps = {
  words: string[];
  placedWords: Set<number>;
  currentPosition: number;
  bottomInset: number;
};

export function PassageBody({ words, placedWords, currentPosition, bottomInset }: PassageBodyProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.flow}>
          {words.map((word, index) => (
            <PassageWord
              key={`${index}-${word}`}
              word={word}
              isPlaced={placedWords.has(index)}
              isCurrent={index === currentPosition}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  inner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
});
