import type { Comparison, Criterion, Option } from '../types'

const KEY = 'worthit.comparisons.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOption(value: unknown): value is Option {
  return isRecord(value) && typeof value.id === 'string' && !!value.id.trim() &&
    typeof value.name === 'string' && isRecord(value.scores) &&
    (value.price === undefined || (typeof value.price === 'number' && Number.isFinite(value.price))) &&
    (value.subtitle === undefined || typeof value.subtitle === 'string') &&
    Object.values(value.scores).every((score) => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 10)
}

function isCriterion(value: unknown): value is Criterion {
  return isRecord(value) && typeof value.id === 'string' && !!value.id.trim() &&
    typeof value.name === 'string' && typeof value.importance === 'number' &&
    Number.isFinite(value.importance) && value.importance >= 0 &&
    typeof value.higherIsBetter === 'boolean'
}

function isComparison(value: unknown): value is Comparison {
  return isRecord(value) && typeof value.id === 'string' && !!value.id.trim() &&
    typeof value.title === 'string' && typeof value.category === 'string' &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) &&
    Array.isArray(value.options) && value.options.every(isOption) &&
    Array.isArray(value.criteria) && value.criteria.every(isCriterion)
}

function clone(comparison: Comparison): Comparison {
  return {
    ...comparison,
    options: comparison.options.map((option) => ({ ...option, scores: { ...option.scores } })),
    criteria: comparison.criteria.map((criterion) => ({ ...criterion })),
  }
}

/** Browser persistence API. Construct with localStorage; inject a Storage in tests. */
export function createComparisonStorage(storage: Storage, now: () => Date = () => new Date(), createId: () => string = () => crypto.randomUUID()) {
  function getSavedComparisons(): Comparison[] {
    const raw = storage.getItem(KEY)
    if (raw === null) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const seen = new Set<string>()
      return parsed.filter((item): item is Comparison => {
        if (!isComparison(item) || seen.has(item.id)) return false
        seen.add(item.id)
        return true
      }).map(clone).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    } catch {
      return []
    }
  }

  function write(comparisons: Comparison[]): void {
    storage.setItem(KEY, JSON.stringify(comparisons))
  }

  function getComparison(id: string): Comparison | undefined {
    return getSavedComparisons().find((item) => item.id === id)
  }

  function saveComparison(comparison: Comparison): Comparison {
    if (!isComparison(comparison)) throw new Error('Invalid comparison')
    const existing = getComparison(comparison.id)
    const saved = clone({
      ...comparison,
      createdAt: existing?.createdAt ?? comparison.createdAt,
      updatedAt: now().toISOString(),
    })
    write([saved, ...getSavedComparisons().filter((item) => item.id !== saved.id)])
    return clone(saved)
  }

  function deleteComparison(id: string): boolean {
    const all = getSavedComparisons()
    if (!all.some((item) => item.id === id)) return false
    write(all.filter((item) => item.id !== id))
    return true
  }

  function renameComparison(id: string, title: string): Comparison | undefined {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Enter a comparison title')
    const existing = getComparison(id)
    return existing ? saveComparison({ ...existing, title: trimmed }) : undefined
  }

  function duplicateComparison(id: string): Comparison | undefined {
    const existing = getComparison(id)
    if (!existing) return undefined
    const timestamp = now().toISOString()
    const newId = createId()
    if (!newId || getComparison(newId)) throw new Error('Could not create a unique comparison ID')
    return saveComparison({ ...existing, id: newId, title: `${existing.title} (copy)`, createdAt: timestamp, updatedAt: timestamp })
  }

  return {
    getSavedComparisons,
    getRecentComparisons: (limit = 5) => getSavedComparisons().slice(0, Math.max(0, limit)),
    getComparison,
    saveComparison,
    deleteComparison,
    renameComparison,
    duplicateComparison,
    clearSavedComparisons: () => write([]),
  }
}
