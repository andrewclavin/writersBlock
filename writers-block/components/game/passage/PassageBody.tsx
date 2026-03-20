import { ScrollView, StyleSheet, View } from 'react-native';

import { PassageWord } from './PassageWord';

type PassageBodyProps = {
  words: string[];
  placedWords: Set<number>;
  selectedSlotIndex: number;
  onSelectSlot: (index: number) => void;
  bottomInset: number;
};

export function PassageBody({
  words,
  placedWords,
  selectedSlotIndex,
  onSelectSlot,
  bottomInset,
}: PassageBodyProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.flow}>
          {words.map((word, index) => {
            const isPlaced = placedWords.has(index);
            return (
              <PassageWord
                key={`${index}-${word}`}
                word={word}
                slotIndex={index}
                isPlaced={isPlaced}
                isSelected={index === selectedSlotIndex}
                onSelectSlot={onSelectSlot}
              />
            );
          })}
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
