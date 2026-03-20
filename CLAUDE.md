# Writer's Block – Claude Context

Mobile word game built with React Native + Expo (iOS/Android/Web) where players reconstruct public domain novels word by word. The keyboard interface shows the next candidate word per letter; correct placements lock into the passage, and connected phrases can cascade into place automatically as the book assembles through play.

## Core Data Structures

- **Word object**
  - Represents each token in the book with both raw and canonical forms, indices, structural boundaries, and per-word attempt history.
- **Lexicon entry**
  - Unified structure for both single words and multi-word phrases with counts, lockedCount, and discovery timestamps.
- **Game config**
  - Tunable parameters for phrase extraction and parsing behavior (min/max phrase length, cross-paragraph rules, contractions/hyphens handling) without touching parser internals.
- **Book config**
  - Per-book metadata (ID, author, Gutenberg markers, structural regexes) and flags for visibility, AI usage, and local-only handling for copyrighted texts.

## Books

- **His Family (Poole, 1918)** – parser stress test, ugly formatting.
- **The Great Gatsby (Fitzgerald, 1925)** – primary development book, culturally familiar.
- **The Age of Innocence (Wharton, 1921)** – first public launch book.
- **The Old Man and the Sea (Hemingway)** – local device only, never deployed (copyright).

## Game Flow and Cascade Triggers

Players fill one active slot at a time. Correct placements lock words and can form phrases. Cascades may trigger via:

1. Correct placement in passage: adjacent locked words form a valid phrase.
2. Wrong guess: creates a valid phrase with an adjacent word elsewhere in the text.
3. Lexicon sort mode switch: new ordering reveals adjacencies matching real phrases.
4. Manual lexicon chaining: player chains words; the game validates in real time.

Word states: placed (locked, green underline), active slot (gold pulse), empty slot (grey proportional block), ghost slot (partial letters from wrong guesses, rust red), and greyed word (wrong guess, struck through).

## POC Scope

**In scope (for POC):**

- **Phase 0**: Data pipeline – parse Gutenberg text to word-object JSON, build lexicon from config.
- **Phase 1**: Pure game logic – placement, cascade checks, lexicon updates (no UI coupling).
- **Phase 2**: Passage display – scrollable renderer with correct word states.
- **Phase 3**: Keyboard – QWERTY layout, candidate words, hint strip, single-instance highlighting.
- **Phase 4**: Cascade animation – sequential locking, ~150–200 ms between words.
- **Phase 5**: Lexicon panel – bottom sheet, counts, and sort modes (A–Z, recently discovered, text order; length sort can be toggled on later).
- **Phase 6**: Persistence – AsyncStorage so progress survives app close.
- **Phase 7**: Shareable Block – end-of-session card with chosen phrase and cascaded passage.
- **Phase 8**: POC hardening – read mode, reveal tokens, basic session tracking.

**Out of POC:**

- AI layer (Anthropic API integration).
- Daily puzzle mode.
- Advanced length sort mode and cosmetic polish.
- Multiple-book UX, social features, backend infrastructure, and user accounts.

## POC Success Metric

- **Goal**: 10 distinct users complete at least one session **and** return within 7 days.
- Defined upfront and used to decide whether to invest beyond the POC.

## Frontend state & UI (Expo app)

- **Redux**: `configureStore` in `writers-block/src/state/store.ts` — **session** slice (persisted) + **RTK Query** `baseApi` (`writers-block/src/state/api/baseApi.ts`). New endpoints use `injectEndpoints` on `baseApi`.
- **Hooks**: `useAppDispatch` / `useAppSelector` from `writers-block/src/state/hooks.ts` — do not use untyped `useDispatch`/`useSelector` in app code.
- **Cursor rules**: `.cursor/rules/redux-rtk-query.mdc` (RTK + RTK Query + layering) and `.cursor/rules/react-native-components.mdc` (component size ~50 lines, composition, memo/list perf).
- **Design / wireframes**: `.cursor/rules/design-wireframes-figma.mdc` — how Figma/wireframe output relates to the Expo app (tokens, motion intent, RN mapping). **Reference assets** live in **`Wbwireframes/`** at the repo root (same workspace; not shipped with the Expo app). Treat exported code there as a **spec**, not copy-paste source.

