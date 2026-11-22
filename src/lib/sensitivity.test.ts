import { describe, expect, it } from 'vitest'
import type { Criterion, Option } from '../types'
import { analyzeSensitivity, scoreComparison } from './scoring'

const criteria: Criterion[] = [
  { id: 'battery', name: 'Battery', importance: 3, higherIsBetter: true },
  { id: 'price', name: 'Cost rating', importance: 1, higherIsBetter: false },
]

// a: 8*0.75 + (10-8)*0.25 = 6.5   b: 5*0.75 + (10-2)*0.25 = 5.75
const options: Option[] = [
  { id: 'a', name: 'A', scores: { battery: 8, price: 8 } },
  { id: 'b', name: 'B', scores: { battery: 5, price: 2 } },
]

function winnerWith(criterionId: string, importance: number, opts = options, crit = criteria) {
  return scoreComparison({
    options: opts,
    criteria: crit.map((item) => (item.id === criterionId ? { ...item, importance } : item)),
  }).winner?.optionId ?? null
}

describe('analyzeSensitivity', () => {
  it('finds the smallest increase and decrease that change the winner', () => {
    const result = analyzeSensitivity({ criteria, options })
    expect(result.winnerId).toBe('a')
    expect(result.maxImportance).toBe(6)
    expect(result.flips).toHaveLength(2)

    const [price, battery] = result.flips
    // price ties at 1.5 (24 + 2w = 15 + 8w); battery ties at 2 (8w + 2 = 5w + 8)
    expect(price).toMatchObject({ criterionId: 'price', direction: 'increase', challengerId: 'b', currentImportance: 1 })
    expect(price.tieImportance).toBeCloseTo(1.5)
    expect(price.flipImportance).toBeCloseTo(1.6)
    expect(battery).toMatchObject({ criterionId: 'battery', direction: 'decrease', challengerId: 'b', currentImportance: 3 })
    expect(battery.tieImportance).toBeCloseTo(2)
    expect(battery.flipImportance).toBeCloseTo(1.9)
  })

  it('only reports flips that scoreComparison confirms', () => {
    const three: Option[] = [
      ...options,
      { id: 'c', name: 'C', scores: { battery: 6, price: 3 } }, // 6.25, overtakes before b
    ]
    const { flips } = analyzeSensitivity({ criteria, options: three }, { maxImportance: 50 })
    expect(flips.map((flip) => [flip.criterionId, flip.challengerId])).toEqual([['price', 'c'], ['battery', 'c']])
    for (const flip of flips) {
      expect(winnerWith(flip.criterionId, flip.flipImportance, three)).toBe(flip.challengerId)
      // Just before the tie point the original winner still leads.
      const before = flip.direction === 'increase' ? flip.tieImportance - 0.01 : flip.tieImportance + 0.01
      expect(winnerWith(flip.criterionId, before, three)).toBe('a')
    }
  })

  it('reports no flips when the winner is better on every criterion', () => {
    const result = analyzeSensitivity({ criteria, options: [
      { id: 'a', name: 'A', scores: { battery: 9, price: 1 } },
      { id: 'b', name: 'B', scores: { battery: 4, price: 6 } },
    ] })
    expect(result.winnerId).toBe('a')
    expect(result.flips).toEqual([])
  })

  it('respects maxImportance for increases', () => {
    const { flips } = analyzeSensitivity({ criteria, options }, { maxImportance: 1.5 })
    expect(flips.map((flip) => flip.criterionId)).toEqual(['battery'])
  })

  it('does not lower a criterion to a total importance of zero', () => {
    const { flips } = analyzeSensitivity({
      criteria: [criteria[0]],
      options,
    })
    expect(flips).toEqual([])
  })

  it('returns no flips for a tie', () => {
    const result = analyzeSensitivity({ criteria: [criteria[0]], options: [
      { id: 'a', name: 'A', scores: { battery: 7 } },
      { id: 'b', name: 'B', scores: { battery: 7 } },
    ] })
    expect(result).toEqual({ winnerId: null, flips: [], minImportance: 0, maxImportance: 6 })
  })

  it('propagates scoring validation and rejects bad settings', () => {
    expect(() => analyzeSensitivity({ criteria, options: [{ ...options[0], scores: { battery: 8 } }, options[1]] })).toThrow(/score/)
    expect(() => analyzeSensitivity({ criteria, options }, { step: 0 })).toThrow(/step/)
    expect(() => analyzeSensitivity({ criteria, options }, { maxImportance: -1 })).toThrow(/maxImportance/)
    expect(() => analyzeSensitivity({ criteria, options }, { minImportance: -1 })).toThrow(/minImportance/)
    expect(() => analyzeSensitivity({ criteria, options }, { minImportance: 5, maxImportance: 4 })).toThrow(/maxImportance/)
  })
})

describe('analyzeSensitivity with a UI importance scale', () => {
  it('reports only whole-number changes inside the slider range', () => {
    const { flips, minImportance, maxImportance } = analyzeSensitivity({ criteria, options }, { minImportance: 1, maxImportance: 10, step: 1 })
    expect({ minImportance, maxImportance }).toEqual({ minImportance: 1, maxImportance: 10 })
    expect(flips.map((flip) => [flip.criterionId, flip.direction, flip.flipImportance])).toEqual([
      ['price', 'increase', 2], // ties at 1.5
      ['battery', 'decrease', 1], // ties at 2
    ])
    for (const flip of flips) expect(winnerWith(flip.criterionId, flip.flipImportance)).toBe('b')
  })

  it('drops decreases that would need to go below minImportance', () => {
    const { flips } = analyzeSensitivity({ criteria, options }, { minImportance: 2, maxImportance: 10, step: 1 })
    expect(flips.map((flip) => flip.criterionId)).toEqual(['price'])
  })
})
