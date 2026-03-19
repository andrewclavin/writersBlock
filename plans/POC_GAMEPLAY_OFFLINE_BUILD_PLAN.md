# POC Gameplay Build Plan (Offline-First)

This doc captures the recommended “better ways” as we start turning the offline scaffolding into actual gameplay (slot placement, word locking, cascade checks, and persistence).

## Three Better Ways (apply immediately)

1. **Don’t parse huge `*.words.json` during boot**
   - Best practice: prime and cache JSON first (Web Cache Storage on web), then parse lazily only when the player navigates to the active gameplay view.
   - Why: parsing large arrays in the render/boot path will hurt cold-start time and may compete with rehydrating persisted session state.

2. **Make cache invalidation/versioning explicit**
   - Best practice: treat book JSON like versioned assets and bump the Cache Storage key (and/or URLs) when the underlying book data changes.
   - Why: without a clear version boundary, users can get mismatched cached JSON vs persisted session assumptions (especially around locked contexts).

3. **Keep persisted Redux minimal; store large book data outside Redux**
   - Best practice: persist only “session state” (lastBookId, locked slot indices, attempts history, phrase drafts, locked-context signature).
   - Keep `words/lexicon` as in-memory or in Cache Storage, not in AsyncStorage/Redux.
   - Why: Redux persistence will bloat storage, slow rehydration, and increase the chance of schema mismatch across builds.

## Gameplay Architecture (what we’ll build next)

### A. Persistence boundary (already started)
- `session` slice persisted with `redux-persist` + AsyncStorage (native) and isolated state storage (persisted JSON).
- Persisted fields (target):
  - `lastBookId`
  - per-book: `activeSlotIndex`, `lockedSlotIndices`, `attemptsBySlotIndex`, `wordBankPhraseDrafts`, `lockedContextSignature`

### B. Book data boundary (next)
- `bookDataLoader.loadWordsAndLexicon(bookId)` remains the “single source of truth” for loading book assets.
- We’ll refactor it into two phases:
  - **Prime**: ensure Cache Storage has the JSON (web) and return a “ready” signal.
  - **Load**: parse JSON into runtime structures only when gameplay needs them.

## Milestones (POC Phases 2–4)

### Phase 2: Passage display + word states
- Add a gameplay screen that renders the passage using loaded `words`.
- Word visual states to implement:
  - locked (green underline),
  - active slot (gold pulse),
  - empty slot (grey),
  - ghost slot (partial from wrong guesses),
  - greyed word (wrong guess, struck through).

### Phase 3: Keyboard + candidate words
- Derive the candidate word for the current active slot (from `words` + `lexicon` as needed).
- Dispatch session actions on:
  - guess submit,
  - phrase draft update,
  - lock/cascade changes.

### Phase 4: Cascade checks + sequential animation
- Implement pure game logic for:
  - placement validation,
  - phrase detection from adjacent locked words,
  - wrong-guess phrase creation rules (as described in the Claude context).
- After each validated placement, update persisted session fields and trigger cascade animation sequencing.

## Success Criteria (POC)
- At least 10 distinct users complete one session **and** return within 7 days.
- Offline-first requirement:
  - if the player closes/reopens, their progress/attempts/phrase drafts survive.
  - on web, required book JSON is available offline after first load.

