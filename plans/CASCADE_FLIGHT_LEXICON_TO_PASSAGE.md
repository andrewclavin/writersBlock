# Plan: Cascade flight (lexicon → passage)

## Context

Selection cascade now has a **first-pass measured flight** path: `CascadeFlightOverlay` + keyboard/lexicon anchors (see `usePlayFromParsedWords` and `CASCADE_*` constants in `selectionCascade.ts`). This doc still applies to **refinements** (pixel-perfect chip parity, off-screen scroll, reduce-motion).

This doc sketches how to replace or augment that with **layout-measured** flights from real UI sources (lexicon chips, and optionally keyboard row candidates) to passage targets.

## Product intent

- **On-screen targets:** a visible “ghost” or label travels from the bank chip (or nearest bank affordance) into the matching passage slot, timed with the lock.
- **Off-screen targets:** the flight should still read clearly—e.g. move toward the passage region and **down** (scroll direction) so the user understands words are landing below the fold; optionally auto-scroll the passage after the flight completes (tunable, may feel heavy-handed).
- **Phrases:** a single phrase chip might unlock multiple consecutive slots. Options: one arc that “splits,” sequential sub-flights per token, or a single capsule landing on the phrase group—needs UX + implementation tradeoffs.

## Technical approach (recommended direction)

### 1. Single overlay layer

- Render a **sibling overlay** above passage + lexicon (e.g. absolutely positioned `View` in the Play shell, or a small portal-like subtree at `play.tsx` root) so z-index and coordinates stay consistent.
- Each flight is a lightweight child (e.g. `Text` in a rounded pill matching chip styling) driven by animation only—not a second copy of full `LexiconWordChip` unless we need pixel parity.

### 2. Coordinates: `measureInWindow` / `measureLayout`

- **Sources:** lexicon list items and/or keyboard letter row bounds. On layout (or on cascade start), store `{ x, y, width, height }` in a ref map keyed by:
  - single word: canonical string **plus** disambiguator if duplicates (instance index or “first visible chip” policy), or
  - phrase: phrase key string.
- **Targets:** `PassageWord` (or inner slot ref) reports the same per `slotIndex`.
- Use **`measureInWindow`** on both ends for the same frame of reference (works across siblings). Alternative: `measureLayout` relative to a common ancestor if we attach refs to a shared container—fewer platform quirks but tighter coupling.

**Platforms:** verify web (`react-native-web`) behavior; polyfill or fallback to passage-only motion if measurement is flaky.

### 3. Animation stack

- Project already includes **`react-native-reanimated`**. Prefer Reanimated shared values + `withDelay` / `withTiming` for staggered multi-flight orchestration (runs on UI thread, easier chaining than many `Animated` timers).
- Durations live on `selectionCascade.ts` as `CASCADE_SOURCE_HIDE_BEAT_MS`, `CASCADE_BETWEEN_UNITS_MS`, `CASCADE_FLIGHT_DURATION_MS`; optional future `cascadeMotion.ts` if more surfaces share them.

### 4. Orchestration API (hook or reducer-adjacent)

- Input: ordered list of cascade events, e.g. `{ slotIndex, canonical, sourceKind: 'lexicon' | 'keyboard' | 'synthetic', phraseSpan?: … }[]`.
- Steps:
  1. Lock state updates as today (Redux).
  2. Emit flight plan: resolve start rect (or synthetic start if chip not measured / drawer closed).
  3. Run animations; on complete, clear overlay and optionally **scroll** `PassageBody` `ScrollView` to `slotIndex` (e.g. `scrollTo` with measured offset map or `findNodeHandle` + UIManager—pick one strategy per platform).

### 5. Fallbacks (explicit policy)

| Condition | Behavior |
|-----------|----------|
| Lexicon drawer closed | Synthetic start: bottom-left above keyboard, or last known chip rect cached from when drawer was open |
| No ref for word (duplicate chips) | First matching chip in visual order, or bank “pile” anchor point |
| Measurement returns 0,0 | Defer to current `PassageWord` internal fly-in only for that slot |

Document the chosen policy in code comments so tuning stays consistent.

## Files likely touched (later)

- `app/(tabs)/play.tsx` — overlay host, optional scroll ref to passage.
- `components/game/passage/PassageBody.tsx` — expose `onSlotLayout` or ref registry for slot indices.
- `components/game/lexicon/LexiconDrawer.tsx` / `LexiconWordChip.tsx` — report chip layouts for keys in cascade.
- `components/game/usePlayFromParsedWords.ts` — emit richer cascade payload than `number[]` when flights are enabled.
- New: `components/game/cascade/CascadeFlightOverlay.tsx` (or similar) + `useCascadeFlights.ts`.

## Open questions

1. **Auto-scroll:** always, only when target off-screen, or never for POC?
2. **Concurrent cascades:** if selection cascade and phrase-window lock overlap in one frame, single batch or two visual layers?
3. **Reduced motion:** respect system “reduce motion” and skip flight (instant lock + optional opacity fade only).
4. **Performance:** cap simultaneous flying nodes (e.g. max 6) and queue the rest as instant locks or shortened trails.

## Out of scope for this note

- Pixel-perfect match to wireframes (`Wbwireframes`)—treat as reference only.
- Backend or persistence changes.

---

*Status: planning only. Placeholder passage motion remains until this is implemented.*
