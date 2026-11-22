# Foundation contracts

`src/types/comparison.ts` defines the shared `Comparison`, `Option`, and `Criterion` records. IDs are stable strings. Timestamps are ISO 8601 strings. A score is a user-entered number on a 0–10 scale; `Option.scores` maps criterion IDs to those scores. `Criterion.importance` is nonnegative. An importance of zero excludes that criterion from the total.

`src/lib/scoring.ts` normalizes importance by the sum of weights. For `higherIsBetter: false`, it converts an entered score to `10 - score` before weighting. The output is on a 0–10 scale and includes each contribution. Totals within 1e-9 of each other are treated as tied (to absorb floating-point error); ties share a rank, and a tie for first has no sole winner. Missing, out-of-range, or nonfinite scores and invalid weights cause an error instead of a misleading result. The future comparison form should validate before calling it.

`analyzeSensitivity` answers "what would change the winner?". It varies one criterion's importance at a time (raised up to 2x the current highest importance by default, or lowered to 0), finds where another option first ties the winner, and reports the nearest step-aligned importance (0.1 by default) at which re-running `scoreComparison` confirms a different sole winner. Flips that cannot be confirmed are omitted. Ties return no flips.

`src/state/comparisonStore.ts` defines a storage contract and a browser localStorage adapter. The key is versioned. This is local device persistence only; sharing or export has not been implemented. Storage errors from quota or disabled browser storage propagate to callers and should be handled in feature UI.

Feature folders describe ownership. Shared contracts and the app entry point should be changed deliberately and called out in PRs.
