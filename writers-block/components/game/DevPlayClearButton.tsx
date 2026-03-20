import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';

type DevPlayClearButtonProps = {
  onClear: () => void;
  top: number;
  right: number;
};

const CLEAR_MESSAGE = 'This removes all progress for this book on this device.';

/** Dev-only control: confirm before wiping persisted play state for the current book. */
export function DevPlayClearButton({ onClear, top, right }: DevPlayClearButtonProps) {
  const confirm = () => {
    // `react-native-web` implements `Alert.alert` as a no-op.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Clear game?\n\n${CLEAR_MESSAGE}`)) {
        onClear();
      }
      return;
    }
    Alert.alert('Clear game?', CLEAR_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: onClear },
    ]);
  };

  return (
    <Pressable
      accessibilityLabel="Clear game progress"
      accessibilityRole="button"
      hitSlop={12}
      onPress={confirm}
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
