import type { Comparison } from '../types'

/** Storage contract for the future comparison and saved features. */
export interface ComparisonStore {
  list(): Comparison[]
  save(comparison: Comparison): void
  remove(id: string): void
}

const STORAGE_KEY = 'worthit.comparisons.v1'

/** Browser-only MVP adapter. Call from UI code, not during module initialization. */
export function createLocalComparisonStore(storage: Storage): ComparisonStore {
  function list(): Comparison[] {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is Comparison =>
        typeof item === 'object' && item !== null &&
        typeof item.id === 'string' && typeof item.title === 'string' &&
        typeof item.category === 'string' &&
        Array.isArray(item.options) && Array.isArray(item.criteria) &&
        typeof item.createdAt === 'string' && typeof item.updatedAt === 'string',
      )
    } catch {
      return []
    }
  }

  return {
    list,
    save(comparison) {
      storage.setItem(STORAGE_KEY, JSON.stringify([
        ...list().filter((item) => item.id !== comparison.id),
        comparison,
      ]))
    },
    remove(id) {
      storage.setItem(STORAGE_KEY, JSON.stringify(list().filter((item) => item.id !== id)))
    },
  }
}
