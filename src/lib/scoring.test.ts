import { describe, expect, it } from 'vitest'
import type { Criterion, Option } from '../types'
import { scoreComparison } from './scoring'

const criteria: Criterion[] = [
  { id: 'battery', name: 'Battery', importance: 3, higherIsBetter: true },
  { id: 'price', name: 'Cost rating', importance: 1, higherIsBetter: false },
]

const options: Option[] = [
  { id: 'a', name: 'A', scores: { battery: 8, price: 8 } },
  { id: 'b', name: 'B', scores: { battery: 5, price: 2 } },
]

describe('scoreComparison', () => {
  it('normalizes weights and exposes contributions for an explainable winner', () => {
    const result = scoreComparison({ criteria, options })
    expect(result.winner?.optionId).toBe('a')
    expect(result.ranked.map((item) => item.optionId)).toEqual(['a', 'b'])
    expect(result.ranked[0].score).toBe(6.5)
    expect(result.ranked[0].contributions).toEqual([
      { criterionId: 'battery', enteredScore: 8, effectiveScore: 8, normalizedWeight: 0.75, weightedScore: 6 },
      { criterionId: 'price', enteredScore: 8, effectiveScore: 2, normalizedWeight: 0.25, weightedScore: 0.5 },
    ])
  })

  it('identifies ties without choosing an arbitrary winner', () => {
    const result = scoreComparison({ criteria: [criteria[0]], options: [
      { id: 'a', name: 'A', scores: { battery: 7 } },
      { id: 'b', name: 'B', scores: { battery: 7 } },
    ] })
    expect(result.winner).toBeNull()
    expect(result.leaders.map((item) => item.optionId)).toEqual(['a', 'b'])
    expect(result.ranked.map((item) => item.rank)).toEqual([1, 1])
  })

  it('changes the winner when priorities change', () => {
    const result = scoreComparison({ criteria: [
      { ...criteria[0], importance: 1 },
      { ...criteria[1], importance: 3 },
    ], options })
    expect(result.winner?.optionId).toBe('b')
  })

  it('handles extreme weighting and a zero-weight criterion', () => {
    const result = scoreComparison({ criteria: [
      { ...criteria[0], importance: 1_000_000 },
      { ...criteria[1], importance: 0 },
    ], options })
    expect(result.winner?.optionId).toBe('a')
    expect(result.ranked[0].score).toBe(8)
    expect(result.ranked[0].contributions[1].weightedScore).toBe(0)
  })

  it.each([
    [{ ...options[0], scores: { battery: 8 } }, options[1]],
    [{ ...options[0], scores: { battery: 11, price: 2 } }, options[1]],
    [{ ...options[0], scores: { battery: Number.NaN, price: 2 } }, options[1]],
  ])('rejects missing or invalid scores', (first, second) => {
    expect(() => scoreComparison({ criteria, options: [first, second] })).toThrow(/score/)
  })

  it('rejects zero or invalid total importance and duplicate IDs', () => {
    expect(() => scoreComparison({ criteria: criteria.map((item) => ({ ...item, importance: 0 })), options })).toThrow(/importance/)
    expect(() => scoreComparison({ criteria: [{ ...criteria[0], importance: -1 }], options })).toThrow(/importance/)
    expect(() => scoreComparison({ criteria, options: [options[0], options[0]] })).toThrow(/IDs/)
  })
})
