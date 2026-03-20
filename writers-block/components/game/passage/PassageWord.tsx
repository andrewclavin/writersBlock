import { StyleSheet, Text, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';

type PassageWordProps = {
  word: string;
  isPlaced: boolean;
  isCurrent: boolean;
};

export function PassageWord({ word, isPlaced, isCurrent }: PassageWordProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.slot, isCurrent && !isPlaced && styles.slotActive]}>
        {!isPlaced && <View style={styles.pill} />}
        <Text style={[styles.word, !isPlaced && styles.wordConcealed]}>{word}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 6,
  },
  slot: {
    position: 'relative',
    borderRadius: 3,
    overflow: 'hidden',
  },
  slotActive: {
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
