import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GameChrome } from '@/constants/gameChrome';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LexiconWordChipProps = {
  word: string;
  remaining: number;
  onPress: () => void;
};

export function LexiconWordChip({ word, remaining, onPress }: LexiconWordChipProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[styles.chip, animStyle]}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}>
      <Text style={styles.word}>{word}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{remaining}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'relative',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GameChrome.chipBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  word: {
    fontFamily: 'Georgia',
    fontSize: 14,
    color: GameChrome.passageText,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: GameChrome.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});
