import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';
import { computePillFrame } from '@/constants/passageFocusChrome';

import { PassageFocusRingOverlay } from './PassageFocusRingOverlay';

type PassageWordProps = {
  word: string;
  slotIndex: number;
  isPlaced: boolean;
  isSelected: boolean;
  showFocusRing?: boolean;
  onSlotAnchorRef?: (slotIndex: number, node: View | null) => void;
  cascadePreview?: boolean;
  /** Keyboard cascade: reveal this many leading graphemes (rest stay transparent). */
  cascadeRevealCharCount?: number;
  onSelectSlot: (index: number) => void;
};

export function PassageWord({
  word,
  slotIndex,
  isPlaced,
  isSelected,
  showFocusRing = false,
  onSlotAnchorRef,
  cascadePreview = false,
  cascadeRevealCharCount,
  onSelectSlot,
}: PassageWordProps) {
  const { width: winW } = useWindowDimensions();
  const fontSize = winW >= 768 ? 18 : winW >= 640 ? 17 : 16;
  const lineHeight = Math.round(fontSize * 1.65);
  const pill = computePillFrame(fontSize, lineHeight);

  const usePartialReveal =
    !isPlaced && cascadeRevealCharCount !== undefined && cascadeRevealCharCount > 0;
  const graphemes = [...word];
  const revealN = Math.min(cascadeRevealCharCount ?? 0, graphemes.length);

  return (
    <View
      ref={(n) => onSlotAnchorRef?.(slotIndex, n)}
      collapsable={false}
      style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Word ${slotIndex + 1}`}
        accessibilityState={{ selected: isSelected }}
        hitSlop={4}
        onPress={() => onSelectSlot(slotIndex)}
        onFocus={() => onSelectSlot(slotIndex)}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}>
        <View style={styles.slot}>
          {!isPlaced && (
            <View
              style={[
                styles.pill,
                cascadePreview && styles.pillCascadePreview,
                {
                  bottom: pill.bottom,
                  height: pill.height,
                  left: pill.insetH,
                  right: pill.insetH,
                },
              ]}
            />
          )}
          {usePartialReveal ? (
            <Text style={[styles.word, { fontSize, lineHeight }]}>
              {graphemes.map((ch, i) => (
                <Text
                  key={`${slotIndex}-${i}-${ch}`}
                  style={i < revealN ? styles.word : styles.wordConcealed}>
                  {ch}
                </Text>
              ))}
            </Text>
          ) : (
            <Text
              style={[
                styles.word,
                { fontSize, lineHeight },
                !isPlaced && styles.wordConcealed,
              ]}>
              {word}
            </Text>
          )}
          <PassageFocusRingOverlay
            visible={showFocusRing && !isPlaced}
            pill={pill}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
    overflow: 'visible',
  },
  pill: {
    position: 'absolute',
    borderRadius: 3,
    backgroundColor: GameChrome.slotPill,
  },
  pillCascadePreview: {
    backgroundColor: GameChrome.cascadePreviewPillFill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: GameChrome.cascadePreviewBorder,
  },
  word: {
    fontFamily: 'Georgia',
    letterSpacing: -0.176,
    color: GameChrome.passageText,
  },
  wordConcealed: {
    color: 'transparent',
  },
});
