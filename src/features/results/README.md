# Results

Owns ranking, contribution explanations, and tradeoff views. The scoring engine returns user-entered score contributions; this feature should explain them without inventing product facts.

## Exports

```ts
import { ResultsView, summarizeResult } from './features/results'
import type { ResultsViewProps, ResultSummary, ImportanceScale } from './features/results'
```

| Prop | Required | Purpose |
| --- | --- | --- |
| `comparison` | yes | A `Comparison` (only `options` and `criteria` are read). `null`/`undefined` shows the empty state. Malformed data (e.g. from storage) shows a recoverable "Almost there" message instead of throwing. |
| `onEditComparison` | no | Navigate back to editing. When omitted, no edit button is rendered, so there are no dead controls. |
| `importanceScale` | no | `{ min, max, step }` the comparison UI allows. "What would change the winner?" then only suggests changes people can make. Defaults: 0 to 2× the top importance, step 0.1. |
| `formatPrice` | no | Formats `Option.price`, which has no currency in the shared type. Defaults to a plain localized number. |

The view has no persisted state and renders headings from `h2` down, so it fits under a page `h1`. `ResultsPlaceholder.tsx` is kept on purpose, because `feature/comparison-flow`'s `App.tsx` still imports it. Delete it in the integration branch once nothing imports it.

## Integration note (for the integration branch)

Not wired into `App.tsx` here (shared file). With `feature/comparison-flow` (#4) merged, the change in `App.tsx` is:

```tsx
import { ResultsView } from './features/results'
import { formatPrice, MAX_IMPORTANCE, MIN_IMPORTANCE } from './features/comparison/comparisonDraft'

// inside the `view.name === 'results'` branch, replacing <ResultsPlaceholder />:
<ResultsView
  comparison={view.comparison}
  onEditComparison={() => setView({ name: 'compare' })}
  importanceScale={{ min: MIN_IMPORTANCE, max: MAX_IMPORTANCE, step: 1 }} // slider is whole numbers 1–10
  formatPrice={formatPrice} // comparison flow displays prices as USD
/>
```

- **Saved comparisons** (`feature/saved-and-sharing`): `SavedComparisonsPage` takes `onOpen(comparison)`. Route it to the same `results` view. Stored data is handled defensively here.
- **Comparison flow "open recent"** passes stored comparisons straight through without checking them. This is fine: incomplete or damaged ones show "Almost there".

### Open coordination items
1. **Score scale mismatch.** Results shows the WorthIt score out of **100** (engine × 10). `src/lib/share.ts` on `feature/saved-and-sharing` shares **"x.x / 10"**. The team should pick one before integration. Results keeps /100 (per the Results brief) until then.
2. **Two storage layers on one key.** `src/state/comparisonStore.ts` (used by the comparison flow) and `src/lib/storage.ts` (saved branch) both read and rewrite `worthit.comparisons.v1` with different validation. Not a Results file, flagged for the owners.
3. **Tie fix.** `feature/saved-and-sharing` does not yet include #1, so `createResultCard` can still name a sole winner for floating-point-equal totals until it's rebased.

## How results are derived

`summarizeResult.ts` turns a comparison into what the screen shows. It only calls the shared engine (`scoreComparison`, `analyzeSensitivity` in `src/lib/scoring.ts`). It never computes its own ranking.

| State | When |
| --- | --- |
| `empty` | No comparison, or no options and no priorities |
| `incomplete` | Damaged data, fewer than 2 options, no priorities, invalid or no positive importance, or missing/invalid 0–10 scores (each problem is listed) |
| `tie` | The engine reports no sole winner. Shows the leaders and the priorities that separate them |
| `decided` | A sole winner, with `closeness` of `close` (< 5 pts on the 0–100 scale), `clear`, or `dominant` (≥ 20 pts) |

- **WorthIt score** is the engine score × 10, shown out of 100. When rounding would make two different scores look equal, one decimal is shown.
- **Why it won** only states facts from the user's scores and importance: best on the top priority, strong scores (≥ 7/10) on heavily weighted priorities, and how many priorities it beat the runner-up on.
- **Contribution bars** show each priority's points toward the winner's score. They add up to the score.
- **Tradeoffs** list every priority where another option scored better than the winner, sorted by how many points that advantage is worth. Advantages under 1 point are labelled "minor", not hidden.
- **What would change the winner?** comes from `analyzeSensitivity`. Every line is a scenario the engine re-ran and confirmed, within `importanceScale`. If there are no flips, the screen says the winner holds up and states the range checked.
- **Regret Check** is reflection only. Answers aren't saved and don't affect scoring.
- Blank option or priority names are shown as "Option N" / "Priority N" so sentences stay readable.

## Developer preview

`npm run dev`, then open `/src/features/results/preview/index.html?scenario=normal` (scenarios: `normal`, `close`, `tie`, `dominant`, `lowerIsBetter`, `incomplete`, `empty`). It uses invented sample data from `preview/sampleComparisons.ts`, which the tests also use, plus the comparison flow's 1–10 importance scale and USD formatting. It's not part of the production build.
