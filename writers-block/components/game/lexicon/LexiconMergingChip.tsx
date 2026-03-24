import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { LexiconWordChip } from './LexiconWordChip';

type LexiconMergingChipProps = {
  entryKey: string;
  display: string;
  remaining: number;
  isPhrase: boolean;
  selected: boolean;
  onChipTap: () => void;
  registerTarget: (key: string, node: View | null) => void;
  /** Unused: merge is tap-to-link only (no drag across the page). */
  onDragEnd?: (fromKey: string, absoluteX: number, absoluteY: number) => void;
  registerCascadeAnchor?: (key: string, node: View | null) => void;
  collapseCascadeEntryKey?: string | null;
  cascadePreviewKeys?: ReadonlySet<string> | null;
  cascadeHideCharByKey?: ReadonlyMap<string, number> | null;
  cascadeGlowByKey?: ReadonlyMap<string, number> | null;
};

export function LexiconMergingChip({
  entryKey,
  display,
  remaining,
  isPhrase,
  selected,
  onChipTap,
  registerTarget,
  onDragEnd: _onDragEnd,
  registerCascadeAnchor,
  collapseCascadeEntryKey,
  cascadePreviewKeys,
  cascadeHideCharByKey,
  cascadeGlowByKey,
}: LexiconMergingChipProps) {
  const setTargetRef = useCallback(
    (node: View | null) => {
      registerTarget(entryKey, node);
      registerCascadeAnchor?.(entryKey, node);
    },
    [entryKey, registerCascadeAnchor, registerTarget]
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

  const composed = useMemo(() => tap, [tap]);

  return (
    <GestureDetector gesture={composed}>
      <View>
        <View ref={setTargetRef} collapsable={false} style={{ alignSelf: 'flex-start' }}>
          <LexiconWordChip
            word={display}
            remaining={remaining}
            variant={isPhrase ? 'phrase' : 'single'}
            interactive={false}
            selected={selected}
            hideBodyForCascade={collapseCascadeEntryKey === entryKey}
            cascadePreview={!!cascadePreviewKeys?.has(entryKey)}
            cascadeHideCharCount={
              cascadeHideCharByKey != null && cascadeHideCharByKey.has(entryKey)
                ? cascadeHideCharByKey.get(entryKey)!
                : undefined
            }
            cascadeGlowStrength={cascadeGlowByKey?.get(entryKey) ?? 0}
          />
        </View>
      </View>
    </GestureDetector>
  );
}
