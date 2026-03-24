import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';
import { computePillFrame } from '@/constants/passageFocusChrome';

import { PassageFocusRingOverlay } from './PassageFocusRingOverlay';

/** Pixels the cascade halo extends past the grey pill on each side (ring, not center fill). */
const CASCADE_HALO_OUTSET = 6;

type PassageWordProps = {
  word: string;
  slotIndex: number;
  isPlaced: boolean;
  isSelected: boolean;
  showFocusRing?: boolean;
  onSlotAnchorRef?: (slotIndex: number, node: View | null) => void;
  cascadePreview?: boolean;
  /** 0–1 sage halo strength around the grey pill (not a fill on the pill). */
  cascadePillAttractStrength?: number;
  /** 0–1 grey pill compresses toward the right (right edge fixed) before letters. */
  cascadeGreySquash?: number;
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
  cascadePillAttractStrength = 0,
  cascadeGreySquash = 0,
  cascadeRevealCharCount,
  onSelectSlot,
}: PassageWordProps) {
  const { width: winW } = useWindowDimensions();
  const fontSize = winW >= 768 ? 18 : winW >= 640 ? 17 : 16;
  const lineHeight = Math.round(fontSize * 1.65);
  const pill = computePillFrame(fontSize, lineHeight);
  const [slotLayoutW, setSlotLayoutW] = useState(0);

  const innerPillW = Math.max(0, slotLayoutW - 2 * pill.insetH);
  const squash = Math.max(0, Math.min(1, cascadeGreySquash));
  const greyLeft =
    slotLayoutW > 0 ? pill.insetH + squash * innerPillW : pill.insetH;

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
        <View
          style={styles.slot}
          onLayout={(e) => setSlotLayoutW(e.nativeEvent.layout.width)}>
          {!isPlaced && squash < 0.999 && (
            <>
              {cascadePillAttractStrength > 0.02 && slotLayoutW > 0 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.cascadeHalo,
                    {
                      left: greyLeft - CASCADE_HALO_OUTSET,
                      right: pill.insetH - CASCADE_HALO_OUTSET,
                      bottom: pill.bottom - CASCADE_HALO_OUTSET,
                      height: pill.height + 2 * CASCADE_HALO_OUTSET,
                      borderRadius: 3 + CASCADE_HALO_OUTSET,
                      opacity: cascadePillAttractStrength,
                      ...(Platform.OS === 'ios'
                        ? {
                            shadowColor: GameChrome.cascadeHaloShadow,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.62,
                            shadowRadius: 7,
                          }
                        : null),
                    },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.pill,
                  cascadePreview && styles.pillCascadePreview,
                  styles.pillAboveHalo,
                  {
                    bottom: pill.bottom,
                    height: pill.height,
                    left: greyLeft,
                    right: pill.insetH,
                  },
                ]}
              />
            </>
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
  cascadeHalo: {
    position: 'absolute',
    backgroundColor: GameChrome.cascadeHaloFill,
  },
  pill: {
    position: 'absolute',
    borderRadius: 3,
    backgroundColor: GameChrome.slotPill,
  },
  pillAboveHalo: {
    zIndex: 1,
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
