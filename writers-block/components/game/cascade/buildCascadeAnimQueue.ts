import type { KeyboardLetterCandidate } from '@/components/game/samplePassageLogic';
import type { CascadePlanUnit } from '@/src/game/selectionCascade';

export type AnimCascadeUnit = {
  slotIndices: number[];
  /** Text on the flying chip. */
  displayLabel: string;
  kind: 'word' | 'phrase';
  source: 'keyboard' | 'bank';
  /** Letter key when `source === 'keyboard'`. */
  letter?: string;
  /** Matches lexicon chip `word` prop (single or phrase string). */
  lexiconKey: string;
};

function tokensAtSlots(
  unit: CascadePlanUnit,
  canonicalBySlot: readonly string[]
): string[] {
  return unit.slotIndices.map((i) => canonicalBySlot[i] ?? '');
}

/**
 * Whether this unit’s first token appears on the keyboard snapshot at the phrase span’s start slot.
 */
function keyboardLetterForUnit(
  unit: CascadePlanUnit,
  snap: ReadonlyMap<string, KeyboardLetterCandidate>,
  canonicalBySlot: readonly string[]
): string | undefined {
  const S = unit.slotIndices[0];
  if (S === undefined) return undefined;
  const tokens = tokensAtSlots(unit, canonicalBySlot);
  if (tokens.length === 0 || !tokens[0]) return undefined;

  for (const [letter, c] of snap) {
    if (c.index !== S || c.word !== tokens[0]) continue;
    if (tokens.length === 1) return letter;
    const rest = tokens.slice(1).join(' ');
    const suff = (c.phraseSuffix ?? '').trim();
    if (suff === rest) return letter;
  }
  return undefined;
}

/**
 * Keyboard-sourced units first (keeping their cascade order), then word-bank units.
 */
export function buildAnimCascadeQueue(
  plan: CascadePlanUnit[],
  _keyboardSnapshot: ReadonlyMap<string, KeyboardLetterCandidate>,
  canonicalBySlot: readonly string[]
): AnimCascadeUnit[] {
  return plan.map((u) => {
    const displayLabel =
      u.kind === 'word'
        ? u.label
        : tokensAtSlots(u, canonicalBySlot).join(' ');
    return {
      slotIndices: u.slotIndices,
      displayLabel,
      kind: u.kind,
      source: 'bank' as const,
      lexiconKey: u.label,
    };
  });
}
