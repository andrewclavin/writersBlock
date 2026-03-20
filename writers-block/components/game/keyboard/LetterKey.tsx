import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GameChrome } from '@/constants/gameChrome';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LetterKeyProps = {
  letter: string;
  hasWord: boolean;
  word?: string;
  wordIndex?: number;
  onWordSelect: (index: number) => void;
};

export function LetterKey({ letter, hasWord, word, wordIndex, onWordSelect }: LetterKeyProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  if (!hasWord) {
    return (
      <View style={styles.emptyKey}>
        <Text style={styles.emptyLetter}>{letter}</Text>
      </View>
    );
  }

  return (
    <AnimatedPressable
      style={[styles.key, animStyle]}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (wordIndex !== undefined) onWordSelect(wordIndex);
      }}>
      <Text style={styles.keyLetter}>{letter}</Text>
      <Text style={styles.keyWord} numberOfLines={1}>
        {word}
      </Text>
    </AnimatedPressable>
  );
}

const KEY = 56;

const styles = StyleSheet.create({
  emptyKey: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    backgroundColor: GameChrome.keyboardEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLetter: {
    fontFamily: 'Georgia',
    fontSize: 22,
    color: '#D1D5DB',
  },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GameChrome.keyboardKeyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    paddingHorizontal: 4,
  },
  keyLetter: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: GameChrome.passageText,
  },
  keyWord: {
    fontSize: 10,
    color: '#4B5563',
    maxWidth: KEY - 8,
    marginTop: 2,
  },
});
