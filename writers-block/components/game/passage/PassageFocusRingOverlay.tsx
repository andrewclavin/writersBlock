import { View } from 'react-native';

import {
  passageFocusChrome,
  passageFocusRingPillStyle,
  type PassagePillFrame,
} from '@/constants/passageFocusChrome';

type PassageFocusRingOverlayProps = {
  visible: boolean;
  clearance?: number;
  pill: PassagePillFrame;
};

/**
 * Even-clearance ring around a single grey pill.
 * Parent must be the word `slot` (`position: 'relative'`, `overflow: 'visible'`).
 */
export function PassageFocusRingOverlay({
  visible,
  clearance = passageFocusChrome.ringClearance,
  pill,
}: PassageFocusRingOverlayProps) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={passageFocusRingPillStyle(pill, clearance)} />
  );
}
