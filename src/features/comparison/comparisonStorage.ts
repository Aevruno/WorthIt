import { scoreComparison } from '../../lib/scoring'
import { createLocalComparisonStore, type ComparisonStore } from '../../state/comparisonStore'
import type { Comparison } from '../../types'

/**
 * Thin, failure-tolerant wrapper around the shared store for the comparison flow.
 * The shared adapter lets storage errors propagate (quota, disabled storage),
 * so every call here turns them into a value the UI can show.
 */

export function openComparisonStore(): ComparisonStore | null {
  try {
    // Accessing `window.localStorage` itself throws when storage is blocked.
    return createLocalComparisonStore(window.localStorage)
  } catch {
    return null
  }
}

export interface RecentComparison {
  comparison: Comparison
  /** False when the saved record can't be scored (e.g. missing scores). */
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

export function loadRecentComparisons(store: ComparisonStore | null, limit = RECENT_LIMIT): RecentLoad {
  if (!store) return { status: 'unavailable' }
  try {
    const items = [...store.list()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((comparison) => ({ comparison, viewable: isScorable(comparison) }))
    return { status: 'ok', items }
  } catch {
    return { status: 'unavailable' }
  }
}

export type SaveOutcome = { ok: true } | { ok: false; message: string }

export function saveComparison(store: ComparisonStore | null, comparison: Comparison): SaveOutcome {
  if (!store) return { ok: false, message: 'Saving isn’t available in this browser, so this comparison won’t be kept on this device.' }
  try {
    store.save(comparison)
    return { ok: true }
  } catch {
    return { ok: false, message: 'We couldn’t save this comparison on this device (storage may be full or blocked).' }
  }
}
