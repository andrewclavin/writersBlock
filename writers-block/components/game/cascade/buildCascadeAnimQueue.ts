import type { KeyboardLetterCandidate } from '@/components/game/samplePassageLogic';
import type { CascadePlanUnit } from '@/src/game/selectionCascade';

export type AnimCascadeUnit = {
  slotIndices: number[];
  /** Text on the flying chip (bank) or passage join (keyboard phrase). */
  displayLabel: string;
  kind: 'word' | 'phrase';
  source: 'keyboard' | 'bank';
  /** Letter key when `source === 'keyboard'`. */
  letter?: string;
  /** Full string shown on that key (prefix + display + suffix) for letter-by-letter hide. */
  keyboardRevealString?: string;
  /** Matches lexicon chip `word` prop (single or phrase string). */
  lexiconKey: string;
};

function tokensAtSlots(
  unit: CascadePlanUnit,
  canonicalBySlot: readonly string[]
): string[] {
  return unit.slotIndices.map((i) => canonicalBySlot[i] ?? '');
}

function keyboardRevealStringFromCandidate(c: KeyboardLetterCandidate): string {
  return `${c.phrasePrefix ?? ''}${c.displayWord ?? c.word}${c.phraseSuffix ?? ''}`;
}

/**
 * Whether this unit’s first slot matches a keyboard key (same index, word, and full phrase on key).
 * If the key shows a longer phrase than this unit, it does not match (skip keyboard cascade).
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
 * Keyboard-sourced units first (same relative order as in the plan), then bank units.
 */
export function buildAnimCascadeQueue(
  plan: CascadePlanUnit[],
  keyboardSnapshot: ReadonlyMap<string, KeyboardLetterCandidate>,
  canonicalBySlot: readonly string[]
): AnimCascadeUnit[] {
  const mapped: AnimCascadeUnit[] = plan.map((u) => {
    const displayLabel =
      u.kind === 'word'
        ? u.label
        : tokensAtSlots(u, canonicalBySlot).join(' ');
    const letter = keyboardLetterForUnit(u, keyboardSnapshot, canonicalBySlot);
    const source = letter ? ('keyboard' as const) : ('bank' as const);
    const cand = letter ? keyboardSnapshot.get(letter) : undefined;
    const keyboardRevealString =
      source === 'keyboard' && cand ? keyboardRevealStringFromCandidate(cand) : undefined;

    return {
      slotIndices: u.slotIndices,
      displayLabel,
      kind: u.kind,
      source,
      letter,
      keyboardRevealString,
      lexiconKey: u.label,
    };
  });

  const keyboard = mapped.filter((u) => u.source === 'keyboard');
  const bank = mapped.filter((u) => u.source === 'bank');
  return [...keyboard, ...bank];
}
