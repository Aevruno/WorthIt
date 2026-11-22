import { scoreComparison } from '../../lib/scoring'
import { createLocalComparisonStore, type ComparisonStore } from '../../state/comparisonStore'
import type { Comparison } from '../../types'

/**
 * What the comparison flow needs from persistence. Method names deliberately match
 * the saved feature's `createComparisonStorage` (src/lib/storage.ts, feature/saved-and-sharing),
 * so at integration that object can be passed straight in:
 *
 *   <ComparisonFlow persistence={createComparisonStorage(window.localStorage)} ... />
 *
 * Until then the flow uses the foundation store (src/state/comparisonStore.ts). Both use
 * the same localStorage key and record format, so data written by either is readable by both.
 */
export interface ComparisonPersistence {
  /** Most recently updated first. */
  getRecentComparisons(limit?: number): Comparison[]
  /** Inserts or replaces by `id`. May throw (storage full or blocked). */
  saveComparison(comparison: Comparison): unknown
}

/** Adapts the foundation store to `ComparisonPersistence`. */
export function persistenceFromStore(store: ComparisonStore): ComparisonPersistence {
  return {
    getRecentComparisons(limit = RECENT_LIMIT) {
      return [...store.list()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, Math.max(0, limit))
    },
    saveComparison(comparison) {
      store.save(comparison)
    },
  }
}

/** Default persistence for the browser, or null when storage is unavailable. */
export function openDefaultPersistence(): ComparisonPersistence | null {
  try {
    // Accessing `window.localStorage` itself throws when storage is blocked.
    return persistenceFromStore(createLocalComparisonStore(window.localStorage))
  } catch {
    return null
  }
}

export interface RecentComparison {
  comparison: Comparison
  /** False when the saved record can't be scored yet (e.g. missing scores). It can still be edited. */
  viewable: boolean
}

export type RecentLoad =
  | { status: 'ok'; items: RecentComparison[] }
  | { status: 'unavailable' }

export const RECENT_LIMIT = 4

export function isScorable(comparison: Comparison): boolean {
  try {
    scoreComparison(comparison)
    return true
  } catch {
    return false
  }
}

export function loadRecentComparisons(persistence: ComparisonPersistence | null, limit = RECENT_LIMIT): RecentLoad {
  if (!persistence) return { status: 'unavailable' }
  try {
    const items = persistence
      .getRecentComparisons(limit)
      .slice(0, limit)
      .map((comparison) => ({ comparison, viewable: isScorable(comparison) }))
    return { status: 'ok', items }
  } catch {
    return { status: 'unavailable' }
  }
}

export type SaveOutcome = { ok: true } | { ok: false; message: string }

export function saveComparison(persistence: ComparisonPersistence | null, comparison: Comparison): SaveOutcome {
  if (!persistence) {
    return { ok: false, message: 'Saving isn’t available in this browser, so this comparison won’t be kept on this device.' }
  }
  try {
    persistence.saveComparison(comparison)
    return { ok: true }
  } catch {
    return { ok: false, message: 'We couldn’t save this comparison on this device (storage may be full or blocked).' }
  }
}
