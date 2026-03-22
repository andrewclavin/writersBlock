import { computeEffectivePhraseBankCounts } from '@/components/game/lexicon/lexiconPhraseKeyboard';

/** Key / lexicon chip: word hidden before the flying label appears. */
export const CASCADE_SOURCE_HIDE_BEAT_MS = 175;
/** Pause after one unit lands before the next begins. */
export const CASCADE_BETWEEN_UNITS_MS = 235;
/** Linear move from source to passage slot. */
export const CASCADE_FLIGHT_DURATION_MS = 400;
/** Green preview on passage + lexicon chip before a bank flight. */
export const CASCADE_PREVIEW_MS = 300;
/** Pause after a round locks so the word bank can ease before the next check. */
export const CASCADE_BETWEEN_ROUNDS_MS = 220;

export type SelectionBankUnit =
  | { kind: 'word'; sortKey: string }
  | { kind: 'phrase'; sortKey: string; tokens: string[] };

function collectSortedBankUnits(
  wordCounts: ReadonlyMap<string, number>,
  placedWordCounts: ReadonlyMap<string, number>,
  lexiconMergeSinglesConsumed: Readonly<Record<string, number>>,
  effectivePhraseBankCounts: Readonly<Record<string, number>>
): SelectionBankUnit[] {
  const units: SelectionBankUnit[] = [];

  for (const [word, total] of wordCounts) {
    const placed = placedWordCounts.get(word) ?? 0;
    const consumed = lexiconMergeSinglesConsumed[word] ?? 0;
    let rem = Math.max(0, total - Math.max(placed, consumed));
    while (rem > 0) {
      units.push({ kind: 'word', sortKey: word });
      rem--;
    }
  }

  for (const [phraseKey, count] of Object.entries(effectivePhraseBankCounts)) {
    if (!count || count <= 0) continue;
    const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    for (let k = 0; k < count; k++) {
      units.push({ kind: 'phrase', sortKey: phraseKey, tokens });
    }
  }

  return units.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function placedWordCountsFromSlots(
  canonicalBySlot: readonly string[],
  placedSlots: ReadonlySet<number>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const idx of placedSlots) {
    const w = canonicalBySlot[idx] ?? '';
    if (!w) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
}

export type CascadePlanUnit = {
  kind: 'word' | 'phrase';
  slotIndices: number[];
  label: string;
};

/**
 * Finds phrase bank entries where a passage occurrence is partially placed
 * (at least one slot locked, at least one empty). Returns plan units covering
 * only the empty slots — those are the ones that need to fly in.
 */
function collectPartialPhraseCascades(
  effectivePhraseBankCounts: Readonly<Record<string, number>>,
  canonicalBySlot: readonly string[],
  placedWords: ReadonlySet<number>
): CascadePlanUnit[] {
  const plan: CascadePlanUnit[] = [];
  for (const [phraseKey, count] of Object.entries(effectivePhraseBankCounts)) {
    if (!count || count <= 0) continue;
    const tokens = phraseKey.trim().split(/\s+/).filter(Boolean);
    const L = tokens.length;
    if (L < 2) continue;
    for (let S = 0; S <= canonicalBySlot.length - L; S++) {
      let match = true;
      for (let j = 0; j < L; j++) {
        if (canonicalBySlot[S + j] !== tokens[j]) { match = false; break; }
      }
      if (!match) continue;
      const emptyInSpan: number[] = [];
      let anyPlaced = false;
      for (let j = 0; j < L; j++) {
        if (placedWords.has(S + j)) anyPlaced = true;
        else emptyInSpan.push(S + j);
      }
      if (anyPlaced && emptyInSpan.length > 0) {
        plan.push({ kind: 'phrase', slotIndices: emptyInSpan, label: phraseKey });
      }
    }
  }
  plan.sort((a, b) => a.slotIndices[0]! - b.slotIndices[0]!);
  return plan;
}

/**
 * **Lockstep selection cascade** — Walk the alphabetically sorted bank and the
 * empty passage slots in parallel.  Bank entry #N is compared to empty slot #N.
 * If the entry's token(s) match the slot(s), it cascades and the slot cursor
 * advances by the number of consumed slots (1 for a word, L for a phrase).
 * On mismatch both cursors advance by 1 — mismatched entries are skipped,
 * not searched elsewhere.
 *
 * Example (tiny fixture, "the" not yet placed, "brown fox jumps" merged):
 *   Bank: ["brown fox jumps", "quick", "the"]
 *   Empty: [slot0("the"), slot1("quick"), slot2("brown"), slot3("fox"), slot4("jumps")]
 *   Entry 0 vs slot 0: "brown" != "the"  -> skip
 *   Entry 1 vs slot 1: "quick" == "quick" -> CASCADE
 *   Entry 2 vs slot 2: "the"  != "brown" -> skip
 *   Result: only "quick" cascades.
 */
export function computeGreedyCascadeRound(
  canonicalBySlot: readonly string[],
  placedWords: ReadonlySet<number>,
  wordCounts: ReadonlyMap<string, number>,
  lexiconMergeSinglesConsumed: Readonly<Record<string, number>>,
  manualPhraseCounts: Readonly<Record<string, number>>
): CascadePlanUnit[] {
  const placedWordCounts = placedWordCountsFromSlots(canonicalBySlot, placedWords);
  const effectivePhraseBankCounts = computeEffectivePhraseBankCounts(
    manualPhraseCounts,
    canonicalBySlot,
    placedWords
  );
  const bankUnits = collectSortedBankUnits(
    wordCounts,
    placedWordCounts,
    lexiconMergeSinglesConsumed,
    effectivePhraseBankCounts
  );

  // Phase 1: partially-placed phrases — some slots already locked, rest cascade in.
  const partials = collectPartialPhraseCascades(
    effectivePhraseBankCounts,
    canonicalBySlot,
    placedWords
  );
  const partialSlots = new Set(partials.flatMap((u) => u.slotIndices));

  // Phase 2: lockstep walk for fully-empty matches.
  const emptySlots: number[] = [];
  for (let i = 0; i < canonicalBySlot.length; i++) {
    if (!placedWords.has(i) && !partialSlots.has(i)) emptySlots.push(i);
  }
  if (emptySlots.length === 0 && partials.length === 0 && bankUnits.length === 0) return [];

  const lockstep: CascadePlanUnit[] = [];
  let j = 0;

  for (let i = 0; i < bankUnits.length && j < emptySlots.length; i++) {
    const u = bankUnits[i]!;

    if (u.kind === 'word') {
      const token = canonicalBySlot[emptySlots[j]!] ?? '';
      if (token === u.sortKey) {
        lockstep.push({ kind: 'word', slotIndices: [emptySlots[j]!], label: u.sortKey });
      }
      j += 1;
    } else {
      const L = u.tokens.length;
      if (j + L <= emptySlots.length) {
        let ok = true;
        for (let k = 0; k < L; k++) {
          if ((canonicalBySlot[emptySlots[j + k]!] ?? '') !== u.tokens[k]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          lockstep.push({
            kind: 'phrase',
            slotIndices: emptySlots.slice(j, j + L),
            label: u.sortKey,
          });
          j += L;
        } else {
          j += 1;
        }
      } else {
        j += 1;
      }
    }
  }

  return [...partials, ...lockstep];
}

/**
 * All slot indices that would lock across repeated lockstep rounds (simulated placement).
 */
export function computeSelectionCascadeSlotIndices(
  canonicalBySlot: readonly string[],
  placedWords: ReadonlySet<number>,
  wordCounts: ReadonlyMap<string, number>,
  lexiconMergeSinglesConsumed: Readonly<Record<string, number>>,
  manualPhraseCounts: Readonly<Record<string, number>>
): number[] {
  const all: number[] = [];
  const sim = new Set(placedWords);
  while (true) {
    const round = computeGreedyCascadeRound(
      canonicalBySlot,
      sim,
      wordCounts,
      lexiconMergeSinglesConsumed,
      manualPhraseCounts
    );
    if (round.length === 0) break;
    for (const u of round) {
      for (const si of u.slotIndices) {
        all.push(si);
        sim.add(si);
      }
    }
  }
  return all;
}
