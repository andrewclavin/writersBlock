import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GameChrome } from '@/constants/gameChrome';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LetterKeyProps = {
  letter: string;
  hasWord: boolean;
  word?: string;
  /** Raw form from the passage slot (with capitalization + punctuation) for display. */
  displayWord?: string;
  /** Grey fragments around `word` for lexicon phrase display (typing still uses `word`). */
  phrasePrefix?: string;
  phraseSuffix?: string;
  wordIndex?: number;
  onWordSelect: (index: number, pressedWord: string) => void;
  /** Web: keyboard / Tab — show selected key without submitting until Enter / full word + Space. */
  isHighlighted?: boolean;
  onLetterFocus?: (wordIndex: number, word: string) => void;
  /** Web: when Tab leaves the keyboard region, parent clears highlight. */
  onLetterBlurCheckLeave?: () => void;
  /** Selection-cascade: hide candidate word during beat (key chrome stays). */
  hideWordBody?: boolean;
  onLetterAnchorRef?: (node: View | null) => void;
};

const KEY_HORIZONTAL_PAD = 24;

/** Generous first-pass width so we rarely clip before `onTextLayout` runs. */
function estimateKeyWidth(word: string, fontSize: number): number {
  const letterSpacingExtra = 0.5 * Math.max(0, word.length - 1);
  const charEstimate = word.length * fontSize * 0.82;
  return Math.max(48, Math.ceil(KEY_HORIZONTAL_PAD + charEstimate + letterSpacingExtra + 8));
}

function readLineWidth(data: TextLayoutEventData): number {
  const line = data.lines[0];
  if (line && typeof line.width === 'number') return line.width;
  return 0;
}

export function LetterKey({
  letter,
  hasWord,
  word,
  displayWord,
  phrasePrefix,
  phraseSuffix,
  wordIndex,
  onWordSelect,
  isHighlighted,
  onLetterFocus,
  onLetterBlurCheckLeave,
  hideWordBody = false,
  onLetterAnchorRef,
}: LetterKeyProps) {
  const { width: winW } = useWindowDimensions();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const compact = winW < 640;
  const emptyW = compact ? 36 : 40;
  const emptyH = compact ? 48 : 56;
  const filledH = emptyH;
  const fontSize = compact ? 12 : 14;

  const [minKeyWidth, setMinKeyWidth] = useState(48);

  const displayForWidth =
    hasWord && word ? `${phrasePrefix ?? ''}${displayWord ?? word}${phraseSuffix ?? ''}` : '';
  const phraseLinked = !!(phrasePrefix || phraseSuffix);

  useEffect(() => {
    if (!hasWord || !word) return;
    setMinKeyWidth(estimateKeyWidth(displayForWidth, fontSize));
  }, [displayForWidth, fontSize, hasWord, word]);

  const pressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  if (!hasWord || !word) {
    return (
      <View style={[styles.emptyKey, { width: emptyW, height: emptyH }]}>
        <Text style={styles.emptyLetter}>{letter}</Text>
      </View>
    );
  }

  const shown = displayWord ?? word;
  const first = shown.charAt(0);
  const rest = shown.slice(1);

  const webFocusProps =
    Platform.OS === 'web' && hasWord && word && wordIndex !== undefined
      ? {
          tabIndex: 0 as const,
          testID: `game-letter-${letter}`,
          onFocus: () => onLetterFocus?.(wordIndex, word),
          onBlur: () => {
            requestAnimationFrame(() => onLetterBlurCheckLeave?.());
          },
        }
      : Platform.OS === 'web'
        ? { tabIndex: -1 as const }
        : {};

  return (
    <View
      ref={(n) => onLetterAnchorRef?.(n)}
      collapsable={false}
      style={{ alignSelf: 'center' }}>
      <AnimatedPressable
        {...webFocusProps}
        accessibilityRole="button"
        accessibilityLabel={word ? `${letter}, ${word}` : letter}
        accessibilityState={{ selected: !!isHighlighted }}
        style={[
          styles.key,
          animStyle,
          isHighlighted && styles.keyHighlighted,
          {
            minWidth: minKeyWidth,
            height: filledH,
            paddingHorizontal: 12,
            flexShrink: 0,
            alignSelf: 'center',
          },
        ]}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (wordIndex !== undefined && word) onWordSelect(wordIndex, word);
        }}>
        <Text
          style={[styles.keyWordLine, { fontSize }, hideWordBody && styles.keyWordHidden]}
          numberOfLines={phraseLinked ? 2 : 1}
          onTextLayout={(e) => {
            const w = readLineWidth(e.nativeEvent);
            if (w <= 0) return;
            const needed = Math.ceil(w) + KEY_HORIZONTAL_PAD;
            setMinKeyWidth((prev) => (needed > prev ? needed : prev));
          }}>
          {phrasePrefix ? <Text style={styles.keyPhraseContext}>{phrasePrefix}</Text> : null}
          <Text style={styles.keyWordFirst}>{first}</Text>
          <Text style={styles.keyWordRest}>{rest}</Text>
          {phraseSuffix ? <Text style={styles.keyPhraseContext}>{phraseSuffix}</Text> : null}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyKey: {
    borderRadius: 999,
    backgroundColor: GameChrome.keyboardEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLetter: {
    fontFamily: 'Georgia',
    fontSize: 16,
    color: GameChrome.keyboardEmptyLetter,
  },
  key: {
    borderRadius: 999,
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
  },
  keyHighlighted: {
    borderWidth: 2,
    borderColor: GameChrome.activeRing,
  },
  keyWordLine: {
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
    flexShrink: 0,
    includeFontPadding: false,
  },
  keyWordFirst: {
    color: GameChrome.keyboardHint,
    fontWeight: '400',
  },
  keyWordRest: {
    color: GameChrome.keyboardWordRest,
    fontWeight: '400',
  },
  keyPhraseContext: {
    color: GameChrome.keyboardWordRest,
    fontWeight: '400',
    opacity: 0.85,
  },
  keyWordHidden: {
    opacity: 0,
  },
});
