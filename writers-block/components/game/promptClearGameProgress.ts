import { Alert, Platform } from 'react-native';

const CLEAR_MESSAGE = 'This removes all progress for this book on this device.';

/** Confirm then run `onClear` (web uses `window.confirm`). */
export function promptClearGameProgress(onClear: () => void): void {
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
}
