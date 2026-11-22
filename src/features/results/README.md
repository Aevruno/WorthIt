# Results

Owns ranking, contribution explanations, and tradeoff views. The scoring engine returns user-entered score contributions; this feature should explain them without inventing product facts.

## Usage

```tsx
import { ResultsView } from './features/results'

<ResultsView comparison={comparison} onEditComparison={() => goToComparison()} />
```

- `comparison`: a `Comparison` (only `options` and `criteria` are read), or `null`/`undefined` for the empty state.
- `onEditComparison` (optional): when omitted, no edit button is rendered, so there are no dead controls.

The view has no persisted state. Wiring it into `App.tsx` (shared) is left to the app owner.

## How results are derived

`summarizeResult.ts` turns a comparison into what the screen shows. It only calls the shared engine (`scoreComparison`, `analyzeSensitivity` in `src/lib/scoring.ts`). It never computes its own ranking.

| State | When |
| --- | --- |
| `empty` | No comparison, or no options and no priorities |
| `incomplete` | Fewer than 2 options, no priorities, no positive importance, or missing/invalid 0–10 scores (each problem is listed) |
| `tie` | The engine reports no sole winner. Shows the leaders and the priorities that separate them |
| `decided` | A sole winner, with `closeness` of `close` (< 5 pts on the 0–100 scale), `clear`, or `dominant` (≥ 20 pts) |

- **WorthIt score** is the engine score × 10, shown out of 100. When rounding would make two different scores look equal, one decimal is shown.
- **Why it won** only states facts from the user's scores and importance: best on the top priority, strong scores (≥ 7/10) on heavily weighted priorities, and how many priorities it beat the runner-up on.
- **Tradeoffs** lists every priority where another option scored better than the winner.
- **What would change the winner?** comes from `analyzeSensitivity`. Every line is a scenario the engine re-ran and confirmed. If there are no flips, the screen says the winner holds up and states the range checked.
- **Regret Check** is reflection only. Answers aren't saved and don't affect scoring.

## Developer preview

`npm run dev`, then open `/src/features/results/preview/index.html?scenario=normal` (scenarios: `normal`, `close`, `tie`, `dominant`, `lowerIsBetter`, `incomplete`, `empty`). It uses invented sample data from `preview/sampleComparisons.ts`, which the tests also use. It's not part of the production build.
