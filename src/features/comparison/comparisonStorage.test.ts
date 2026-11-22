import { describe, expect, it } from 'vitest'
import { createLocalComparisonStore, type ComparisonStore } from '../../state/comparisonStore'
import type { Comparison } from '../../types'
import { loadRecentComparisons, saveComparison } from './comparisonStorage'

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

describe('loadRecentComparisons', () => {
  it('reports unavailable when there is no store', () => {
    expect(loadRecentComparisons(null)).toEqual({ status: 'unavailable' })
  })

  it('returns an empty list with nothing saved', () => {
    expect(loadRecentComparisons(createLocalComparisonStore(new MemoryStorage()))).toEqual({ status: 'ok', items: [] })
  })

  it('lists newest first, limited, and marks unscorable records', () => {
    const store = createLocalComparisonStore(new MemoryStorage())
    store.save(comparison('old', '2026-01-01T00:00:00.000Z'))
    store.save(comparison('new', '2026-03-01T00:00:00.000Z'))
    store.save(comparison('mid', '2026-02-01T00:00:00.000Z', false))

    const result = loadRecentComparisons(store, 2)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.items.map((item) => item.comparison.id)).toEqual(['new', 'mid'])
    expect(result.items.map((item) => item.viewable)).toEqual([true, false])
  })

  it('reports unavailable when reading throws', () => {
    const broken: ComparisonStore = {
      list: () => { throw new Error('SecurityError') },
      save: () => undefined,
      remove: () => undefined,
    }
    expect(loadRecentComparisons(broken)).toEqual({ status: 'unavailable' })
  })
})

describe('saveComparison', () => {
  it('saves through the shared store', () => {
    const storage = new MemoryStorage()
    const store = createLocalComparisonStore(storage)
    expect(saveComparison(store, comparison('x', '2026-01-01T00:00:00.000Z'))).toEqual({ ok: true })
    expect(store.list().map((item) => item.id)).toEqual(['x'])
  })

  it('turns storage failures into a readable message', () => {
    const storage = new MemoryStorage()
    storage.failWrites = true
    const outcome = saveComparison(createLocalComparisonStore(storage), comparison('x', '2026-01-01T00:00:00.000Z'))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toMatch(/couldn’t save/)
    expect(saveComparison(null, comparison('y', '2026-01-01T00:00:00.000Z')).ok).toBe(false)
  })
})
