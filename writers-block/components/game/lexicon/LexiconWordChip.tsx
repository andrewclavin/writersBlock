import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GameChrome } from '@/constants/gameChrome';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LexiconWordChipProps = {
  word: string;
  remaining: number;
  onPress?: () => void;
  /** Multi-word bank entries use a slightly wider chip and wrapped label. */
  variant?: 'single' | 'phrase';
  /** When false, outer press handling is done by a parent `GestureDetector`. */
  interactive?: boolean;
  /** Lexicon merge selection (tap-to-link). */
  selected?: boolean;
  /** Selection-cascade: hide label during "chip -> passage" beat (chip chrome stays). */
  hideBodyForCascade?: boolean;
  /** Brief green preview right before this chip flies to the passage slot. */
  cascadePreview?: boolean;
};

export function LexiconWordChip({
  word,
  remaining,
  onPress,
  variant = 'single',
  interactive = true,
  selected = false,
  hideBodyForCascade = false,
  cascadePreview = false,
}: LexiconWordChipProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const chipVisual = [
    styles.chip,
    cascadePreview && styles.chipCascadePreview,
    selected && styles.chipSelected,
    animStyle,
  ];

  const inner = (
    <>
      <Text
        style={[
          styles.word,
          variant === 'phrase' && styles.wordPhrase,
          cascadePreview && styles.wordCascadePreview,
          hideBodyForCascade && styles.wordHidden,
        ]}
        numberOfLines={variant === 'phrase' ? 2 : 1}>
        {word}
      </Text>
      <View style={[styles.badge, hideBodyForCascade && styles.badgeHidden]}>
        <Text style={styles.badgeText}>{remaining}</Text>
      </View>
    </>
  );

  if (!interactive) {
    return (
      <Animated.View style={chipVisual}>
        {inner}
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      style={chipVisual}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}>
      {inner}
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
  chipSelected: {
    borderWidth: 2,
    borderColor: GameChrome.activeRing,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipCascadePreview: {
    borderColor: GameChrome.cascadePreviewBorder,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  word: {
    fontFamily: 'Georgia',
    fontSize: 14,
    color: GameChrome.passageText,
  },
  wordPhrase: {
    maxWidth: 168,
  },
  wordCascadePreview: {
    color: GameChrome.cascadePreviewWord,
  },
  wordHidden: {
    opacity: 0,
  },
  badgeHidden: {
    opacity: 0,
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
