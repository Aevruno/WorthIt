import { describe, expect, it } from 'vitest'
import { createLocalComparisonStore } from '../../state/comparisonStore'
import type { Comparison } from '../../types'
import {
  loadRecentComparisons,
  persistenceFromStore,
  saveComparison,
  type ComparisonPersistence,
} from './comparisonStorage'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  failWrites = false
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.data.set(key, value)
  }
}

function comparison(id: string, updatedAt: string, scored = true): Comparison {
  return {
    id,
    title: `Comparison ${id}`,
    category: 'Tech',
    options: [
      { id: 'a', name: 'A', scores: scored ? { c: 5 } : {} },
      { id: 'b', name: 'B', scores: scored ? { c: 6 } : {} },
    ],
    criteria: [{ id: 'c', name: 'C', importance: 5, higherIsBetter: true }],
    createdAt: updatedAt,
    updatedAt,
  }
}

/**
 * Same method names and behaviour as `createComparisonStorage` in src/lib/storage.ts
 * (feature/saved-and-sharing, not merged yet): newest-first list, default limit 5,
 * saveComparison stamps updatedAt and returns the saved copy.
 */
function savedFeatureLikeStorage(storage: Storage, now = () => '2026-12-01T00:00:00.000Z') {
  const KEY = 'worthit.comparisons.v1'
  const all = (): Comparison[] => JSON.parse(storage.getItem(KEY) ?? '[]')
  const sorted = () => all().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return {
    getRecentComparisons: (limit = 5) => sorted().slice(0, Math.max(0, limit)),
    saveComparison(item: Comparison): Comparison {
      const saved = { ...item, updatedAt: now() }
      storage.setItem(KEY, JSON.stringify([saved, ...all().filter((other) => other.id !== item.id)]))
      return saved
    },
    deleteComparison: (_id: string) => true,
  }
}

describe('persistenceFromStore (foundation store)', () => {
  it('lists newest first and respects the limit', () => {
    const store = createLocalComparisonStore(new MemoryStorage())
    store.save(comparison('old', '2026-01-01T00:00:00.000Z'))
    store.save(comparison('new', '2026-03-01T00:00:00.000Z'))
    store.save(comparison('mid', '2026-02-01T00:00:00.000Z'))
    const persistence = persistenceFromStore(store)
    expect(persistence.getRecentComparisons(2).map((item) => item.id)).toEqual(['new', 'mid'])
  })

  it('saving the same id replaces the record (edit), not duplicates it', () => {
    const store = createLocalComparisonStore(new MemoryStorage())
    const persistence = persistenceFromStore(store)
    persistence.saveComparison(comparison('x', '2026-01-01T00:00:00.000Z'))
    persistence.saveComparison({ ...comparison('x', '2026-01-02T00:00:00.000Z'), title: 'Renamed' })
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].title).toBe('Renamed')
  })
})

describe('loadRecentComparisons', () => {
  it('reports unavailable when there is no persistence', () => {
    expect(loadRecentComparisons(null)).toEqual({ status: 'unavailable' })
  })

  it('returns an empty list with nothing saved', () => {
    const persistence = persistenceFromStore(createLocalComparisonStore(new MemoryStorage()))
    expect(loadRecentComparisons(persistence)).toEqual({ status: 'ok', items: [] })
  })

  it('marks records that cannot be scored yet (they stay editable)', () => {
    const store = createLocalComparisonStore(new MemoryStorage())
    store.save(comparison('done', '2026-03-01T00:00:00.000Z'))
    store.save(comparison('draft', '2026-02-01T00:00:00.000Z', false))
    const result = loadRecentComparisons(persistenceFromStore(store))
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.items.map((item) => [item.comparison.id, item.viewable])).toEqual([['done', true], ['draft', false]])
  })

  it('caps results even if the backing API ignores the limit', () => {
    const many = Array.from({ length: 10 }, (_, index) => comparison(`c${index}`, `2026-01-0${(index % 9) + 1}T00:00:00.000Z`))
    const sloppy: ComparisonPersistence = { getRecentComparisons: () => many, saveComparison: () => undefined }
    const result = loadRecentComparisons(sloppy, 3)
    expect(result.status === 'ok' && result.items.length).toBe(3)
  })

  it('reports unavailable when reading throws', () => {
    const broken: ComparisonPersistence = {
      getRecentComparisons: () => { throw new Error('SecurityError') },
      saveComparison: () => undefined,
    }
    expect(loadRecentComparisons(broken)).toEqual({ status: 'unavailable' })
  })
})

describe('saveComparison', () => {
  it('saves through the persistence', () => {
    const store = createLocalComparisonStore(new MemoryStorage())
    expect(saveComparison(persistenceFromStore(store), comparison('x', '2026-01-01T00:00:00.000Z'))).toEqual({ ok: true })
    expect(store.list().map((item) => item.id)).toEqual(['x'])
  })

  it('turns storage failures into a readable message', () => {
    const storage = new MemoryStorage()
    storage.failWrites = true
    const outcome = saveComparison(persistenceFromStore(createLocalComparisonStore(storage)), comparison('x', '2026-01-01T00:00:00.000Z'))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toMatch(/couldn’t save/)
    expect(saveComparison(null, comparison('y', '2026-01-01T00:00:00.000Z')).ok).toBe(false)
  })
})

describe('compatibility with the saved feature’s storage API', () => {
  it('accepts an object shaped like createComparisonStorage directly', () => {
    const storage = new MemoryStorage()
    const savedApi = savedFeatureLikeStorage(storage)
    const persistence: ComparisonPersistence = savedApi // compiles: structural match
    expect(saveComparison(persistence, comparison('x', '2026-01-01T00:00:00.000Z'))).toEqual({ ok: true })
    const result = loadRecentComparisons(persistence)
    expect(result.status === 'ok' && result.items.map((item) => item.comparison.id)).toEqual(['x'])
  })

  it('shares data both ways with the foundation store (same key and shape)', () => {
    const storage = new MemoryStorage()
    const foundation = persistenceFromStore(createLocalComparisonStore(storage))
    const savedApi = savedFeatureLikeStorage(storage)

    foundation.saveComparison(comparison('from-flow', '2026-01-01T00:00:00.000Z'))
    expect(savedApi.getRecentComparisons().map((item) => item.id)).toEqual(['from-flow'])

    savedApi.saveComparison(comparison('from-saved', '2026-01-02T00:00:00.000Z'))
    expect(foundation.getRecentComparisons().map((item) => item.id)).toEqual(['from-saved', 'from-flow'])
  })
})
