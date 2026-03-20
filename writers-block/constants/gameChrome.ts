/** Colors / motion hints from `Wbwireframes` chrome (not full shadcn theme). */
export const GameChrome = {
  passageText: '#111827',
  passageMuted: '#9CA3AF',
  slotPill: 'rgba(156, 163, 175, 0.55)',
  activeRing: '#3B82F6',
  progressTrack: '#E5E7EB',
  progressGradientStart: '#A855F7',
  progressGradientEnd: '#EC4899',
  marker: '#2563EB',
  keyboardEmpty: 'rgba(229, 231, 235, 0.4)',
  keyboardKeyBorder: '#E5E7EB',
  drawerToggleStart: '#F97316',
  drawerToggleEnd: '#EC4899',
  drawerBorder: 'rgba(229, 231, 235, 0.5)',
  chipBorder: '#E5E7EB',
  badge: '#94A3B8',
} as const;

export const GameMotion = {
  progressMs: 500,
  markerMs: 300,
  drawerSpring: { damping: 25, stiffness: 200 },
} as const;
