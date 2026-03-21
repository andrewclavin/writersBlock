import type { KeyboardLetterCandidate } from '@/components/game/samplePassageLogic';

/** How many disjoint passage spans fully match `phraseKey` with every slot locked. */
export function countFullyPlacedPhraseSpans(
  phraseKey: string,
  canonicalBySlot: readonly string[],
  placedWords: ReadonlySet<number>
): number {
  const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
  const L = tokens.length;
  if (L < 2) return 0;
  let n = 0;
  for (let S = 0; S <= canonicalBySlot.length - L; S++) {
    let ok = true;
    for (let j = 0; j < L; j++) {
      const idx = S + j;
      const c = canonicalBySlot[idx];
      if (!c || c !== tokens[j] || !placedWords.has(idx)) {
        ok = false;
        break;
      }
    }
    if (ok) n += 1;
  }
  return n;
}

/**
 * Phrase chips still “in the word bank”: raw merge counts minus one per fully
 * realized instance in the passage (same token span, all slots placed).
 * Redux keeps gross counts; this is derived for UI + eligibility.
 */
export function computeEffectivePhraseBankCounts(
  raw: Record<string, number>,
  canonicalBySlot: readonly string[],
  placedWords: ReadonlySet<number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [phraseKey, bankCount] of Object.entries(raw)) {
    if (!bankCount || bankCount <= 0) continue;
    const placedSpans = countFullyPlacedPhraseSpans(phraseKey, canonicalBySlot, placedWords);
    const rem = Math.max(0, bankCount - placedSpans);
    if (rem > 0) out[phraseKey] = rem;
  }
  return out;
}

export type LexiconPhraseWindow = {
  start: number;
  length: number;
  /** Exact key in `lexiconManualPhraseCounts` (spacing preserved). */
  phraseKey: string;
};

/**
 * When the active slot lies inside a multi-word manual phrase that matches the
 * book and still has bank count, keyboard + passage treat the span as one unit.
 *
 * **Position-anchored:** only phrases whose **full token sequence** matches a
 * contiguous run of **passage slots** `[S, S+L)` that contains `selectedSlotIndex`
 * qualify. A banked phrase that appears elsewhere (even identical text, e.g.
 * another “the …” in the novel) does **not** activate unless the cursor is inside
 * that occurrence’s slot span. Same-word collisions are impossible by design.
 *
 * @param canonicalBySlot from `buildCanonicalBySlot` — index === passage slot.
 * @param phraseBankCounts effective remaining per phrase (e.g. from `computeEffectivePhraseBankCounts`).
 */
export function findActiveLexiconPhraseWindow(
  selectedSlotIndex: number,
  canonicalBySlot: readonly string[],
  phraseBankCounts: Record<string, number>,
  placedWords: ReadonlySet<number>
): LexiconPhraseWindow | null {
  if (placedWords.has(selectedSlotIndex)) return null;

  const candidates: LexiconPhraseWindow[] = [];

  for (const [phraseKey, count] of Object.entries(phraseBankCounts)) {
    if (!count || count <= 0) continue;
    const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    const L = tokens.length;

    for (let S = 0; S <= canonicalBySlot.length - L; S++) {
      let match = true;
      for (let j = 0; j < L; j++) {
        const c = canonicalBySlot[S + j];
        if (!c || c !== tokens[j]) {
          match = false;
          break;
        }
      }
      if (!match) continue;
      if (selectedSlotIndex < S || selectedSlotIndex > S + L - 1) continue;

      let anyUnplaced = false;
      for (let j = 0; j < L; j++) {
        if (!placedWords.has(S + j)) {
          anyUnplaced = true;
          break;
        }
      }
      if (!anyUnplaced) continue;

      candidates.push({ start: S, length: L, phraseKey });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      b.length - a.length || a.start - b.start || a.phraseKey.localeCompare(b.phraseKey)
  );
  return candidates[0]!;
}

/** Single-letter keyboard: only the slot’s expected word, labeled with full phrase context. */
export function buildPhraseLockedKeyboardMap(
  selectedSlotIndex: number,
  window: LexiconPhraseWindow,
  phraseBankCounts: Record<string, number>
): Map<string, KeyboardLetterCandidate> {
  if ((phraseBankCounts[window.phraseKey] ?? 0) <= 0) return new Map();

  const tokens = window.phraseKey.trim().split(/\s+/).filter(Boolean);
  const rel = selectedSlotIndex - window.start;
  if (rel < 0 || rel >= tokens.length) return new Map();

  const expectedWord = tokens[rel]!;
  const letter = expectedWord[0]!.toUpperCase();

  const phrasePrefix = rel > 0 ? `${tokens.slice(0, rel).join(' ')} ` : undefined;
  const phraseSuffix =
    rel < tokens.length - 1 ? ` ${tokens.slice(rel + 1).join(' ')}` : undefined;

  const map = new Map<string, KeyboardLetterCandidate>();
  map.set(letter, {
    word: expectedWord,
    index: selectedSlotIndex,
    phrasePrefix,
    phraseSuffix,
  });
  return map;
}

function candidateFromOtherBankPhrase(
  phraseKey: string,
  selectedSlotIndex: number
): KeyboardLetterCandidate {
  const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
  const w0 = tokens[0]!;
  const phraseSuffix = tokens.length > 1 ? ` ${tokens.slice(1).join(' ')}` : undefined;
  return {
    word: w0,
    index: selectedSlotIndex,
    phraseSuffix,
  };
}

/**
 * Phrase-at-slot mode: always includes the passage-correct candidate, plus other
 * multi-word bank phrases on distinct letters whose first word does not start with
 * any of the first letters of words in the correct phrase (so distractors don’t
 * collide on T/Q for “the quick” while still showing e.g. “brown fox” on B).
 */
export function buildPhraseAwareKeyboardMap(
  selectedSlotIndex: number,
  activeWindow: LexiconPhraseWindow,
  phraseBankCounts: Record<string, number>
): Map<string, KeyboardLetterCandidate> {
  const map = new Map<string, KeyboardLetterCandidate>();

  const correctMap = buildPhraseLockedKeyboardMap(
    selectedSlotIndex,
    activeWindow,
    phraseBankCounts
  );
  for (const [letter, cand] of correctMap) {
    map.set(letter, cand);
  }
  if (map.size === 0) return map;

  const correctTokens = activeWindow.phraseKey.trim().split(/\s+/).filter(Boolean);
  const firstLettersInCorrectPhrase = new Set<string>();
  for (const t of correctTokens) {
    const L = t[0]?.toUpperCase();
    if (L) firstLettersInCorrectPhrase.add(L);
  }

  const otherKeys = Object.keys(phraseBankCounts)
    .filter((k) => (phraseBankCounts[k] ?? 0) > 0)
    .filter((k) => k.trim().split(/\s+/).filter(Boolean).length >= 2)
    .filter((k) => k !== activeWindow.phraseKey)
    .sort((a, b) => a.localeCompare(b));

  for (const phraseKey of otherKeys) {
    const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
    const letter = tokens[0]![0]!.toUpperCase();
    if (map.has(letter)) continue;
    if (firstLettersInCorrectPhrase.has(letter)) continue;
    map.set(letter, candidateFromOtherBankPhrase(phraseKey, selectedSlotIndex));
  }

  return map;
}
