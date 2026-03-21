import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { LexiconWordChip } from './LexiconWordChip';

type LexiconMergingChipProps = {
  entryKey: string;
  display: string;
  remaining: number;
  isPhrase: boolean;
  selected: boolean;
  onChipTap: () => void;
  registerTarget: (key: string, node: View | null) => void;
  onDragEnd: (fromKey: string, absoluteX: number, absoluteY: number) => void;
  registerCascadeAnchor?: (key: string, node: View | null) => void;
  collapseCascadeEntryKey?: string | null;
  cascadePreviewKeys?: ReadonlySet<string> | null;
};

export function LexiconMergingChip({
  entryKey,
  display,
  remaining,
  isPhrase,
  selected,
  onChipTap,
  registerTarget,
  onDragEnd,
  registerCascadeAnchor,
  collapseCascadeEntryKey,
  cascadePreviewKeys,
}: LexiconMergingChipProps) {
  const setTargetRef = useCallback(
    (node: View | null) => {
      registerTarget(entryKey, node);
      registerCascadeAnchor?.(entryKey, node);
    },
    [entryKey, registerCascadeAnchor, registerTarget]
  );

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const z = useSharedValue(1);

  const finishDrag = useCallback(
    (ax: number, ay: number) => {
      onDragEnd(entryKey, ax, ay);
    },
    [entryKey, onDragEnd]
  );

  const fireTap = useCallback(() => {
    void Haptics.selectionAsync();
    onChipTap();
  }, [onChipTap]);

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(fireTap)();
      }),
    [fireTap]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(14)
        .maxPointers(1)
        .onStart(() => {
          z.value = 50;
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY;
        })
        .onEnd((e) => {
          runOnJS(finishDrag)(e.absoluteX, e.absoluteY);
        })
        .onFinalize(() => {
          z.value = 1;
          tx.value = withSpring(0, { damping: 18, stiffness: 220 });
          ty.value = withSpring(0, { damping: 18, stiffness: 220 });
        }),
    [finishDrag, tx, ty, z]
  );

  const composed = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: z.value,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={dragStyle}>
        <View ref={setTargetRef} collapsable={false} style={{ alignSelf: 'flex-start' }}>
          <LexiconWordChip
            word={display}
            remaining={remaining}
            variant={isPhrase ? 'phrase' : 'single'}
            interactive={false}
            selected={selected}
            hideBodyForCascade={collapseCascadeEntryKey === entryKey}
            cascadePreview={!!cascadePreviewKeys?.has(entryKey)}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
