# Saved

Owns locally saved comparisons and sharing. `SavedComparisonsPage` is a page component that accepts `onOpen(comparison)` so the app router can connect it to the comparison flow. It is intentionally not mounted in `App.tsx` in this feature branch.

Use `createComparisonStorage(window.localStorage)` from `src/lib/storage.ts` for saving, updating, listing, recent items, opening, renaming, duplicating, deleting, and clearing. Storage is browser-only. Write errors propagate so callers can report disabled or full storage. Malformed stored records are skipped during reads; the next write replaces malformed data with valid records.

Use `createResultCard` and `shareResultCard` from `src/lib/share.ts` for a concise winner result. Sharing uses the browser Share API, then clipboard, then selectable text. Incomplete comparisons and ties have no sole winner card.
