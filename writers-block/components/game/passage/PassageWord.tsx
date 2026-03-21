import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';

type PassageWordProps = {
  word: string;
  slotIndex: number;
  isPlaced: boolean;
  /** Active slot: keyboard + placement target; any slot, including already placed. */
  isSelected: boolean;
  /** When a parent phrase group draws the blue ring, hide the per-slot ring. */
  suppressActiveRing?: boolean;
  onSlotAnchorRef?: (slotIndex: number, node: View | null) => void;
  /** Lexicon-sourced cascade: brief green on this slot + matching chip only. */
  cascadePreview?: boolean;
  onSelectSlot: (index: number) => void;
};

export function PassageWord({
  word,
  slotIndex,
  isPlaced,
  isSelected,
  suppressActiveRing = false,
  onSlotAnchorRef,
  cascadePreview = false,
  onSelectSlot,
}: PassageWordProps) {
  const { width: winW } = useWindowDimensions();
  const fontSize = winW >= 768 ? 18 : winW >= 640 ? 17 : 16;
  const lineHeight = Math.round(fontSize * 1.65);

  /** Wireframe: ring only on the current empty slot (`isCurrent && !isPlaced`). */
  const showActiveRing = isSelected && !isPlaced && !suppressActiveRing;
  const ringStyle = showActiveRing ? styles.slotSelected : null;
  const offsetWrap = showActiveRing ? styles.ringOffsetWrap : null;

  return (
    <View
      ref={(n) => onSlotAnchorRef?.(slotIndex, n)}
      collapsable={false}
      style={styles.wrap}>
      <View style={offsetWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Word ${slotIndex + 1}`}
          accessibilityState={{ selected: isSelected }}
          hitSlop={4}
          onPress={() => onSelectSlot(slotIndex)}
          onFocus={() => onSelectSlot(slotIndex)}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}>
          <View style={[styles.slot, ringStyle]}>
            {!isPlaced && (
              <View
                style={[
                  styles.pill,
                  cascadePreview && styles.pillCascadePreview,
                  {
                    top: fontSize * 0.2,
                    bottom: fontSize * 0.15,
                    left: fontSize * 0.08,
                    right: fontSize * 0.08,
                  },
                ]}
              />
            )}
            <Text
              style={[
                styles.word,
                { fontSize, lineHeight },
                !isPlaced && styles.wordConcealed,
              ]}>
              {word}
            </Text>
          </View>
        </Pressable>
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
  ringOffsetWrap: {
    padding: 1,
    borderRadius: 4,
    backgroundColor: GameChrome.ringOffsetBackground,
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
