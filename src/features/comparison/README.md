# Comparison

Owns the flow for entering options, criteria, importance, and scores. Uses the shared contracts in `src/types/`, the store in `src/state/comparisonStore.ts`, and the scoring engine in `src/lib/scoring.ts` without changing them.

## Screens

1. **Home** (`HomeScreen.tsx`): headline, "Start a comparison", category shortcuts, recent comparisons read from the shared store, and a "continue" banner for an unfinished draft.
2. **Start a comparison** (`SetupScreen.tsx`): title, category, and 2–5 options (name, optional price, optional note).
3. **What matters most** (`CriteriaScreen.tsx`): category suggestions plus custom criteria (up to 8), each with a 1–10 importance slider.
4. **Score each option** (`ScoreScreen.tsx`): one criterion card at a time with 1–10 score buttons per option, plus progress. "See My Winner" enables only when every score is entered.

`ComparisonFlow.tsx` holds the draft and the current screen. On finish it builds a `Comparison`, checks it with `scoreComparison`, saves it, and calls `onComplete(comparison)`. `App.tsx` uses that callback to show Results.

## Logic

- `comparisonDraft.ts`: pure draft state, validation (duplicates, prices, limits), progress, and `buildComparison`. Covered by `comparisonDraft.test.ts`.
- `comparisonStorage.ts`: turns shared-store errors (blocked or full storage) into UI states. Covered by `comparisonStorage.test.ts`.

## Decisions

- All criteria are saved with `higherIsBetter: true`. The score screen asks how well each option does (10 = best for you), including for price, so users never have to think about inverted scales.
- Scores are whole numbers 1–10 (a subset of the shared 0–10 contract).
- Options show a colored initial badge. There is no emoji field because the shared `Option` type doesn't have one.
- Prices are optional, parsed as USD for display only, and never used in scoring.
- Styles live in `comparison.css`, scoped with the `wi-` prefix.
