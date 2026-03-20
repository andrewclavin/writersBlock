import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';

type PassageWordProps = {
  word: string;
  slotIndex: number;
  isPlaced: boolean;
  /** Active slot: keyboard + placement target; any slot, including already placed. */
  isSelected: boolean;
  onSelectSlot: (index: number) => void;
};

export function PassageWord({
  word,
  slotIndex,
  isPlaced,
  isSelected,
  onSelectSlot,
}: PassageWordProps) {
  const ringStyle = isSelected ? styles.slotSelected : null;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Word ${slotIndex + 1}`}
        accessibilityState={{ selected: isSelected }}
        hitSlop={4}
        onPress={() => onSelectSlot(slotIndex)}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}>
        <View style={[styles.slot, ringStyle]}>
          {!isPlaced && <View style={styles.pill} />}
          <Text style={[styles.word, !isPlaced && styles.wordConcealed]}>{word}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 6,
  },
  pressable: {
    borderRadius: 3,
  },
  pressablePressed: {
    opacity: 0.85,
  },
  slot: {
    position: 'relative',
    borderRadius: 3,
    overflow: 'hidden',
  },
  slotSelected: {
    borderWidth: 2,
    borderColor: GameChrome.activeRing,
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    top: 3,
    bottom: 2,
    left: 1,
    right: 1,
    borderRadius: 3,
    backgroundColor: GameChrome.slotPill,
  },
  word: {
    fontFamily: 'Georgia',
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: GameChrome.passageText,
  },
  wordConcealed: {
    color: 'transparent',
  },
});
