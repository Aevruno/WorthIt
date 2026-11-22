import { beforeEach, describe, expect, it } from 'vitest'
import type { Comparison } from '../types'
import { createComparisonStorage } from './storage'

const KEY = 'worthit.comparisons.v1'
const example: Comparison = {
  id: 'first', title: 'Laptop choice', category: 'Tech',
  options: [{ id: 'a', name: 'Model A', scores: { battery: 8 } }],
  criteria: [{ id: 'battery', name: 'Battery', importance: 3, higherIsBetter: true }],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key) },
    setItem: (key, value) => { data.set(key, value) },
  }
}

describe('comparison storage', () => {
  let storage: Storage
  let repository: ReturnType<typeof createComparisonStorage>
  beforeEach(() => {
    storage = memoryStorage()
    repository = createComparisonStorage(storage, () => new Date('2026-02-01T00:00:00.000Z'), () => 'copy-id')
  })

  it('returns an empty list when storage is empty', () => {
    expect(repository.getSavedComparisons()).toEqual([])
    expect(repository.getRecentComparisons()).toEqual([])
  })

  it('saves and loads a comparison across repository instances', () => {
    repository.saveComparison(example)
    expect(createComparisonStorage(storage).getComparison('first')?.title).toBe('Laptop choice')
    expect(repository.getSavedComparisons()).toHaveLength(1)
  })

  it('updates and renames without losing the creation date', () => {
    repository.saveComparison(example)
    repository.saveComparison({ ...example, title: 'New choice', createdAt: '2027-01-01T00:00:00.000Z' })
    repository.renameComparison('first', '  Final choice  ')
    expect(repository.getSavedComparisons()).toMatchObject([{ title: 'Final choice', createdAt: example.createdAt, updatedAt: '2026-02-01T00:00:00.000Z' }])
  })

  it('deletes one and clears all saved comparisons', () => {
    repository.saveComparison(example)
    repository.saveComparison({ ...example, id: 'second' })
    expect(repository.deleteComparison('first')).toBe(true)
    expect(repository.getSavedComparisons().map((item) => item.id)).toEqual(['second'])
    repository.clearSavedComparisons()
    expect(repository.getSavedComparisons()).toEqual([])
  })

  it('duplicates with a new ID and independent nested data', () => {
    repository.saveComparison(example)
    const duplicate = repository.duplicateComparison('first')!
    expect(duplicate).toMatchObject({ id: 'copy-id', title: 'Laptop choice (copy)' })
    duplicate.options[0].scores.battery = 1
    expect(repository.getComparison('copy-id')?.options[0].scores.battery).toBe(8)
    expect(repository.getComparison('first')?.options[0].scores.battery).toBe(8)
  })

  it('recovers from invalid JSON and skips invalid records', () => {
    storage.setItem(KEY, '{broken')
    expect(repository.getSavedComparisons()).toEqual([])
    repository.saveComparison(example)
    storage.setItem(KEY, JSON.stringify([{ id: 'broken' }, example]))
    expect(repository.getSavedComparisons().map((item) => item.id)).toEqual(['first'])
  })

  it('returns recent comparisons ordered by edit time', () => {
    repository.saveComparison(example)
    const later = createComparisonStorage(storage, () => new Date('2026-03-01T00:00:00.000Z'))
    later.saveComparison({ ...example, id: 'second' })
    expect(repository.getRecentComparisons(1).map((item) => item.id)).toEqual(['second'])
  })
})
