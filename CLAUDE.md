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
5. **Selection cascade** (starter implementation): Uses **greedy rounds** in `computeGreedyCascadeRound` (`writers-block/src/game/selectionCascade.ts`). From the next empty passage slot forward, among **remaining** bank units (singles + phrase chips), pick the **lexicographically smallest `sortKey`** whose token(s) match the next slot(s); consume it and repeat until nothing matches. That entire chain is **one round** (one Redux lock batch after the round’s flights). A **second round** runs after `LayoutAnimation` + `CASCADE_BETWEEN_ROUNDS_MS` if the new bank state again yields matches—e.g. after merges, `quick` can resolve before a phrase that sorts earlier as a single string. **Strict** global multiset ordering (`computeSelectionCascadePlan`) remains in the file for reference but is not the active rule. **Preview:** Slots in the cascade **hold** use grey pills; lexicon chips that will fly from the **bank** this round are grey (`cascadeMuted*`) until their turn. **Only** for each **bank-sourced** unit, `CASCADE_PREVIEW_MS` tints **that** chip + its passage slot(s) sage/green, then the flight runs (keyboard-sourced units get no green preview). **Choreography:** QWERTY-first queue, linear flight; with the **lexicon open**, bank-sourced flights **dip behind** the drawer (`zIndex` ~28 mid-progress). Chips in the active round stay **hidden** in the drawer until the round’s Redux update (`cascadeRoundHiddenLexiconKeys`). Timing: `CASCADE_SOURCE_HIDE_BEAT_MS`, `CASCADE_BETWEEN_UNITS_MS`, `CASCADE_FLIGHT_DURATION_MS`, `CASCADE_BETWEEN_ROUNDS_MS`. Overlay: `components/game/cascade/CascadeFlightOverlay.tsx`.

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
- **Book bundles (RTK Query)**: `writers-block/src/state/api/bookApi.ts` — `useGetBookBundleQuery(bookId)`. **`tiny-fixture`** serves parser-shaped JSON from `writers-block/src/data/fixtures/tiny-book.*.json` (no network). Other ids delegate to `loadWordsAndLexicon` (bundled native `require` or web `/books/...`). Play tab uses the fixture by default until session-driven `bookId` is wired.
- **Hooks**: `useAppDispatch` / `useAppSelector` from `writers-block/src/state/hooks.ts` — do not use untyped `useDispatch`/`useSelector` in app code.
- **Cursor rules**: `.cursor/rules/redux-rtk-query.mdc`, `.cursor/rules/react-native-components.mdc`, `.cursor/rules/future-backend-python.mdc` (optional; Python/ML backend later—keep MVP client decoupled).
- **Design / wireframes**: `.cursor/rules/design-wireframes-figma.mdc`. **Vite/React spec** lives in a **sibling repo** **`Wbwireframes/`** (e.g. `../Wbwireframes` next to `writersBlock` on disk). Cursor **multi-root workspaces** show both folders; searches scoped only to `writersBlock/` will not list those files—use the sibling path when reading the spec. Not shipped with the Expo app; treat as visual/UX reference only (`guidelines/`, `src/app/components/`, `src/styles/theme.css`).

### UI component map (POC) — aligned with `Wbwireframes`

| Wireframe (`Wbwireframes/src/app/components/`) | Expo / RN target | Notes |
|--------------------------------------------------|------------------|--------|
| **`TextDisplay`** + inner `WordSlot` | `components/game/passage/PassageBody.tsx`, `PassageWord.tsx` | Inline passage, serif body, **blank slots** (gray pill) vs **revealed** text; **active** slot ring. Extend for ghost/greyed states from game rules. |
| **`AlphabetSelector`** + `LetterKey` | `components/game/keyboard/GameKeyboard.tsx`, `LetterKey.tsx` | QWERTY rows, staggered indent; key shows **letter + candidate word** when available. |
| **`WordItinerary`** + `DraggableWord` | `components/game/lexicon/LexiconDrawer.tsx`, `LexiconLetterGroup.tsx`, `LexiconWordChip.tsx` | **Left edge** toggle, **spring slide** panel, letter headers, frequency badges. **Ignore** `react-dnd` for POC unless phrase-drag is in scope; use taps + game reducers first. |
| **`GameHeader`** (fixed **bottom** bar) | `components/game/SessionProgressFooter.tsx` (or `PlayFooter.tsx`) | Book title + **gradient progress** + **position marker**; wireframe name is misleading—this is not a top header. |
| **Shell** (current `App.tsx`) | `app/(tabs)/play.tsx` (or stack) | Compose the four regions + safe areas; Redux session + RTK Query book data. |
| **Cascade / share** | `components/game/cascade/`, `components/game/share/` | Not in wireframe repo yet; driven by POC phases. |

**Tokens**: port key colors from `Wbwireframes/src/styles/theme.css` (`:root` / `.dark`) into `constants/theme.ts` or `designTokens.ts` (wireframe also uses Tailwind arbitrary colors on chrome—purple/pink bar, blue marker, orange/pink drawer toggle—capture those as named tokens when implementing).

**Data flow**: screen / shell uses `useAppSelector`, `useAppDispatch`, RTK Query hooks; leaves stay prop-driven. Split files approaching ~100 lines or colocate `usePlaySession.ts`.

