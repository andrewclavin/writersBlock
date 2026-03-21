import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { promptClearGameProgress } from '@/components/game/promptClearGameProgress';

type DevPlayClearButtonProps = {
  onClear: () => void;
  top: number;
  right: number;
};

/** Dev-only control: confirm before wiping persisted play state for the current book. */
export function DevPlayClearButton({ onClear, top, right }: DevPlayClearButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Clear game progress"
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => promptClearGameProgress(onClear)}
      style={({ pressed }) => [
        styles.btn,
        { top, right },
        pressed && styles.btnPressed,
      ]}>
      <Ionicons name="trash-outline" size={22} color="#6B7280" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    zIndex: 100,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    elevation: 16,
  },
  btnPressed: {
    opacity: 0.75,
  },
});
