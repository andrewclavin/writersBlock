/** Colors / motion hints aligned with `Wbwireframes` (TextDisplay, AlphabetSelector, WordItinerary, GameHeader). */
export const GameChrome = {
  passageText: '#111827',
  passageMuted: '#9CA3AF',
  slotPill: 'rgba(156, 163, 175, 0.55)',
  activeRing: '#3B82F6',
  ringOffsetBackground: '#FFFFFF',
  /** Slightly cool tint so the bar feels tied to the fill without competing. */
  progressTrack: '#E4EDE7',
  /** Horizontal fill: muted sage -> soft mint (quieter than the old purple->pink). */
  progressGradientStart: '#5FA888',
  progressGradientEnd: '#9FD4B5',
  /** Deep leaf green; reads on both fill and track. */
  marker: '#2D6A4F',
  keyboardEmpty: 'rgba(229, 231, 235, 0.4)',
  keyboardKeyBorder: '#E5E7EB',
  keyboardHint: 'rgba(96, 165, 250, 0.9)',
  keyboardWordRest: '#6B7280',
  keyboardEmptyLetter: '#D1D5DB',
  drawerBorder: 'rgba(229, 231, 235, 0.5)',
  /** Wireframe `bg-white/20` on top of `BlurView`. */
  drawerFrostOverlay: 'rgba(255, 255, 255, 0.2)',
  /** Subtle blur (~wireframe `backdrop-blur-[4px]`); tune per platform. */
  drawerBlurIntensity: 18,
  drawerToggleBlobBorder: '#6B7280',
  chipBorder: '#E5E7EB',
  badge: '#94A3B8',
  /** Brief "this bank unit + its passage slot" green before a lexicon->passage flight. */
  cascadePreviewPillFill: 'rgba(95, 168, 136, 0.14)',
  cascadePreviewBorder: 'rgba(61, 122, 92, 0.55)',
  cascadePreviewWord: '#2D6A4F',
} as const;

export const GameMotion = {
  progressMs: 500,
  markerMs: 300,
  /** Drawer + toggle horizontal motion (wireframe `transition: left 0.3s ease-out`). */
  drawerDurationMs: 300,
} as const;
