# Comparison

Owns creating and editing comparisons: options, criteria, importance, and scores. Uses the shared contracts in `src/types/`, the store in `src/state/comparisonStore.ts`, and the scoring engine in `src/lib/scoring.ts` without changing them.

**Mounting it in the app:** see [INTEGRATION.md](INTEGRATION.md). This feature doesn't touch `App.tsx`.

## Screens

1. **Home** (`HomeScreen.tsx`): headline, "Start a comparison", category shortcuts, recent comparisons with **Edit** / **See result** (records still missing scores offer **Finish it**), and a banner to continue an unfinished or unsaved edit.
2. **Start / Edit a comparison** (`SetupScreen.tsx`): title, category, and 2–5 options (name, optional price, optional note). In edit mode it lists anything adjusted while loading.
3. **What matters most** (`CriteriaScreen.tsx`): category suggestions plus custom criteria (up to 8), each with a 1–10 importance slider.
4. **Score each option** (`ScoreScreen.tsx`): one criterion card at a time with 0–10 score buttons per option, plus progress. "See My Winner" enables only when every score is entered.

`ComparisonFlow.tsx` holds the draft (new or edited) and the current screen. On finish it builds a `Comparison`, checks it with `scoreComparison`, saves it, and calls `onComplete(comparison)`.

## Logic

| File | What | Tests |
| --- | --- | --- |
| `comparisonDraft.ts` | Draft state, validation (duplicates, prices, limits), progress, `buildComparison`, `draftFromComparison` | `comparisonDraft.test.ts`, `comparisonEdit.test.ts` |
| `comparisonStorage.ts` | `ComparisonPersistence` interface (matches the saved feature's API), foundation adapter, error handling | `comparisonStorage.test.ts` |

## Decisions

- **Scores** are whole numbers 0–10, matching the shared contract.
- **Direction:** new criteria are saved with `higherIsBetter: true`. The score screen says "10 means best for you, even for price". Editing keeps each criterion's saved direction, and the score card labels lower-is-better ones.
- **Editing never silently changes data.** Anything adjusted to fit the editor is listed on the first step, and nothing is saved until finish. Examples: importance outside 1–10, fractional scores, an unknown category.
- **No emoji field:** options show a colored initial badge because the shared `Option` type has no emoji field.
- **Prices** are optional, displayed as USD, and never used in scoring.
- **Styles** live in `comparison.css`, scoped with the `wi-` prefix.

## Dev preview

Run `npm run dev`, then open `/src/features/comparison/preview/index.html`. It uses the real localStorage store, plus an invented sample (`preview/sampleComparison.ts`) for testing edits. It's not part of the production build.
