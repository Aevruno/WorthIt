# Integrating the comparison flow

This branch does **not** touch `src/App.tsx`. Mounting the flow is left to the integration branch. Everything needed is exported from `src/features/comparison/index.ts`.

## Component

```tsx
import { ComparisonFlow } from './features/comparison'

<ComparisonFlow
  onComplete={(comparison) => showResults(comparison)}  // required
  initialComparison={comparisonToEdit}                   // optional: open straight into editing
  onExit={() => goBack()}                                // optional: "back" from editing initialComparison
  persistence={storage}                                  // optional: see below
/>
```

| Prop | What it does |
| --- | --- |
| `onComplete(comparison)` | Called when the user taps **See My Winner** (after it's saved), or **See result** on a recent comparison. The comparison is complete and passes `scoreComparison`. |
| `initialComparison` | Opens the editor on this comparison. Saving keeps its `id` and `createdAt`, so it **updates** the saved record. Read once on mount, so give the component `key={comparison.id}` to switch. |
| `onExit` | Only used when editing `initialComparison`: the first step's back button calls this instead of going to the flow's Home. |
| `persistence` | Defaults to the foundation store (`src/state/comparisonStore.ts`). Pass `null` to run without saving. Read once on mount. |

Without `initialComparison`, the flow starts on its own Home screen. Home has Start, category shortcuts, and recent comparisons with **Edit** and **See result** buttons.

## Persistence (saved feature)

`ComparisonPersistence` needs only two methods, named to match `createComparisonStorage` in `src/lib/storage.ts` (Codex, `feature/saved-and-sharing`):

```ts
interface ComparisonPersistence {
  getRecentComparisons(limit?: number): Comparison[]
  saveComparison(comparison: Comparison): unknown
}
```

Once that branch is merged, pass it straight in:

```tsx
import { createComparisonStorage } from './lib/storage'

<ComparisonFlow persistence={createComparisonStorage(window.localStorage)} ... />
```

Both stores use the same localStorage key (`worthit.comparisons.v1`) and record shape, so records written by either one are readable by the other. Codex's `saveComparison` also sets `updatedAt` itself. That's fine; the flow doesn't depend on it.

Reading `window.localStorage` throws when storage is blocked, so wrap that call site in `try`/`catch` and pass `null` on failure. The flow then shows its "saving isn't available" state.

## Suggested wiring (for the integration branch)

```tsx
type View =
  | { name: 'compare'; editing?: Comparison }
  | { name: 'results'; comparison: Comparison }
  | { name: 'saved' }

// compare:  <ComparisonFlow key={view.editing?.id ?? 'new'} initialComparison={view.editing}
//             onExit={() => setView({ name: 'saved' })}
//             onComplete={(c) => setView({ name: 'results', comparison: c })} />
// results:  <ResultsView comparison={view.comparison}
//             onEditComparison={() => setView({ name: 'compare', editing: view.comparison })} />
// saved:    <SavedComparisonsPage onOpen={(c) => setView({ name: 'compare', editing: c })} />
```

`ResultsView` (`feature/results`) and `SavedComparisonsPage` (`feature/saved-and-sharing`) already have the `onEditComparison` and `onOpen` callbacks this needs.

## Editing rules

`draftFromComparison` loads a saved comparison without silently changing it:

- **Kept as-is:** ids, `createdAt`, option prices and notes, and each criterion's `higherIsBetter`. The score screen labels lower-is-better criteria.
- **Adjusted to fit the editor, with a notice listing each change:**
  - importance outside whole numbers 1–10 is clamped or rounded
  - fractional scores are rounded
  - an unknown category is shown as Other
- **Validation:** more than 5 options or 8 criteria, or duplicate names, are flagged and must be fixed before saving.

## Dev preview

Run `npm run dev`, then open `/src/features/comparison/preview/index.html`. It's not part of the production build. The page uses the real foundation store and adds buttons to load an editable sample, including a lower-is-better criterion and a fractional score.
