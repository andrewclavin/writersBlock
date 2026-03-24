import type { ViewStyle } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';

/**
 * Passage focus ring + pill geometry shared across single-word and phrase-group slots.
 *
 * RN draws borders **inward**: the outer edge of the View IS the outer edge of the
 * stroke, and the inner visible edge = outer + borderWidth.  So to get `ringClearance`
 * pixels of visible space between the pill and the ring stroke, the View edge must be
 * positioned at  pill_edge − clearance − borderWidth.
 */
export const passageFocusChrome = {
  ringClearance: 2,
  ringBorderWidth: 2,
  slotCornerRadius: 3,
  ringZIndex: 2,
  ringColor: GameChrome.activeRing,
} as const;

export function passageFocusRingOuterRadius(
  clearance: number = passageFocusChrome.ringClearance
): number {
  return passageFocusChrome.slotCornerRadius + clearance;
}

// ---------------------------------------------------------------------------
// Pill frame — computed from font metrics, shared by PassageWord & PassageBody
// ---------------------------------------------------------------------------

export type PassagePillFrame = {
  insetH: number;
  bottom: number;
  height: number;
};

/** Compute pill geometry from font metrics so every consumer stays in sync. */
export function computePillFrame(fontSize: number, lineHeight: number): PassagePillFrame {
  const halfLeading = (lineHeight - fontSize) / 2;
  return {
    insetH: fontSize * 0.08,
    /** Bottom of pill ≈ typographic baseline (half-leading + descender band). */
    bottom: halfLeading + Math.round(fontSize * 0.18),
    /** Baseline → ascender; covers the main letter body. */
    height: Math.round(fontSize * 0.82),
  };
}

// ---------------------------------------------------------------------------
// Ring style — single-word slot
// ---------------------------------------------------------------------------

/**
 * Absolute overlay inside the word `slot` View.  Positions relative to the
 * pill so clearance is visually even on all four sides.
 */
export function passageFocusRingPillStyle(
  pill: PassagePillFrame,
  clearance: number = passageFocusChrome.ringClearance
): ViewStyle {
  const c = passageFocusChrome;
  const outset = clearance + c.ringBorderWidth;
  return {
    position: 'absolute',
    left: pill.insetH - outset,
    right: pill.insetH - outset,
    bottom: pill.bottom - outset,
    height: pill.height + 2 * outset,
    borderWidth: c.ringBorderWidth,
    borderColor: c.ringColor,
    borderRadius: passageFocusRingOuterRadius(clearance),
    backgroundColor: 'transparent',
    zIndex: c.ringZIndex,
  };
}

// ---------------------------------------------------------------------------
// Ring style — phrase group
// ---------------------------------------------------------------------------

/**
 * Absolute overlay inside the `phraseGroup` View.  Uses the same pill frame
 * and clearance; assumes word wraps have NO trailing margin (use `columnGap`
 * on the group instead) so left/right insets are symmetric.
 */
export function passageFocusPhraseRingStyle(
  pill: PassagePillFrame,
  lineHeight: number,
  clearance: number = passageFocusChrome.ringClearance
): ViewStyle {
  const c = passageFocusChrome;
  const outset = clearance + c.ringBorderWidth;
  const pillTopInSlot = lineHeight - pill.bottom - pill.height;
  return {
    position: 'absolute',
    left: pill.insetH - outset,
    right: pill.insetH - outset,
    top: pillTopInSlot - outset,
    bottom: pill.bottom - outset,
    borderWidth: c.ringBorderWidth,
    borderColor: c.ringColor,
    borderRadius: passageFocusRingOuterRadius(clearance),
    backgroundColor: 'transparent',
    zIndex: c.ringZIndex,
  };
}
