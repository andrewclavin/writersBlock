import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GameChrome } from '@/constants/gameChrome';

export type CascadeFlightRect = { x: number; y: number; w: number; h: number };

type CascadeFlightOverlayProps = {
  flight: null | {
    id: number;
    label: string;
    from: CascadeFlightRect;
    to: CascadeFlightRect;
    /** Mid-flight, pass behind the lexicon glass (drawer open). */
    dipBehindDrawer: boolean;
  };
  durationMs: number;
  onFinished: () => void;
};

/**
 * Full-screen overlay: one flying “chip” at a time, linear path from source to passage.
 */
export function CascadeFlightOverlay({
  flight,
  durationMs,
  onFinished,
}: CascadeFlightOverlayProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const dipBehind = useSharedValue(0);

  useEffect(() => {
    if (!flight) {
      opacity.value = 0;
      progress.value = 0;
      dipBehind.value = 0;
      return;
    }

    dipBehind.value = flight.dipBehindDrawer ? 1 : 0;
    const { from, to } = flight;
    const startX = from.x + from.w / 2;
    const startY = from.y + from.h / 2;
    const endX = to.x + to.w / 2;
    const endY = to.y + to.h / 2;

    tx.value = startX;
    ty.value = startY;
    opacity.value = 0;
    progress.value = 0;

    opacity.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) });
    progress.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
    tx.value = withTiming(endX, { duration: durationMs, easing: Easing.linear });
    ty.value = withTiming(
      endY,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onFinished)();
      }
    );

    return () => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(opacity);
      cancelAnimation(progress);
    };
  }, [dipBehind, durationMs, flight, flight?.id, onFinished, opacity, progress, tx, ty]);

  const layerZStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const behind = dipBehind.value === 1 && p > 0.32 && p < 0.68;
    return { zIndex: behind ? 28 : 220 };
  });

  const chipStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: tx.value,
    top: ty.value,
    opacity: opacity.value,
    transform: [{ translateX: -40 }, { translateY: -14 }],
  }));

  if (!flight) {
    return null;
  }

  return (
    <Animated.View style={[styles.layer, layerZStyle]} pointerEvents="none">
      <Animated.View style={[styles.chip, chipStyle]}>
        <Text style={styles.chipText} numberOfLines={2}>
          {flight.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  chip: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GameChrome.keyboardKeyBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  chipText: {
    fontFamily: 'Georgia',
    fontSize: 14,
    fontWeight: '500',
    color: GameChrome.passageText,
    textAlign: 'center',
  },
});
