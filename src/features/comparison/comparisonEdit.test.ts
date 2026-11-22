import { describe, expect, it } from 'vitest'
import { scoreComparison } from '../../lib/scoring'
import type { Comparison } from '../../types'
import {
  addOption,
  buildComparison,
  draftFromComparison,
  removeCriterion,
  scoreProgress,
  setScore,
  updateOption,
  validateSetup,
} from './comparisonDraft'
import { editableSample } from './preview/sampleComparison'

const later = '2026-11-22T12:00:00.000Z'

function laptops(): Comparison {
  return {
    id: 'cmp-laptops',
    title: 'Which laptop should I buy?',
    category: 'Tech',
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    criteria: [
      { id: 'battery', name: 'Battery Life', importance: 9, higherIsBetter: true },
      { id: 'price', name: 'Price', importance: 3, higherIsBetter: true },
    ],
    options: [
      { id: 'mba', name: 'MacBook Air', price: 1099, scores: { battery: 9, price: 4 } },
      { id: 'zen', name: 'ASUS Zenbook', subtitle: '14-inch OLED', scores: { battery: 8, price: 8 } },
      { id: 'xps', name: 'Dell XPS', scores: { battery: 7, price: 0 } },
    ],
  }
}

function rebuild(comparison: Comparison, draft = draftFromComparison(comparison).draft): Comparison {
  return buildComparison(draft, { id: comparison.id, createdAt: comparison.createdAt, now: later })
}

describe('draftFromComparison', () => {
  it('round-trips a comparison unchanged except updatedAt', () => {
    const original = laptops()
    const { adjustments } = draftFromComparison(original)
    expect(adjustments).toEqual([])
    expect(rebuild(original)).toEqual({ ...original, updatedAt: later })
  })

  it('keeps id and createdAt so saving updates the same record', () => {
    const original = laptops()
    const edited = rebuild(original)
    expect(edited.id).toBe(original.id)
    expect(edited.createdAt).toBe(original.createdAt)
  })

  it('keeps a 0 score (valid in the shared 0–10 contract)', () => {
    const { draft } = draftFromComparison(laptops())
    expect(draft.scores.xps.price).toBe(0)
    expect(scoreProgress(draft).complete).toBe(true)
  })

  it('preserves lower-is-better criteria so the ranking does not change on edit', () => {
    const sample = editableSample()
    const { draft } = draftFromComparison(sample)
    expect(draft.criteria.map((criterion) => criterion.higherIsBetter)).toEqual([false, false, true])
    const rebuilt = rebuild(sample, draft)
    expect(rebuilt.criteria.map((criterion) => criterion.higherIsBetter)).toEqual([false, false, true])
  })

  it('reports every adjustment instead of changing data silently', () => {
    const { draft, adjustments } = draftFromComparison(editableSample())
    // importance 0 → 1, score 5.5 → 6; the lowercase "other" category matches without a note.
    expect(draft.category).toBe('Other')
    expect(draft.criteria.find((criterion) => criterion.id === 'time')?.importance).toBe(1)
    expect(draft.scores.bus.time).toBe(6)
    expect(adjustments).toHaveLength(2)
    expect(adjustments[0]).toMatch(/Travel time.*importance 0.*now 1/)
    expect(adjustments[1]).toMatch(/1 score was rounded/)
  })

  it('maps unknown categories to Other with a note', () => {
    const { draft, adjustments } = draftFromComparison({ ...laptops(), category: 'Pets' })
    expect(draft.category).toBe('Other')
    expect(adjustments).toEqual([expect.stringMatching(/Category “Pets”.*Other/)])
  })

  it('leaves missing or invalid scores empty so the user is asked for them', () => {
    const original = laptops()
    original.options[1].scores = { battery: 8, price: 12 }
    const { draft } = draftFromComparison(original)
    expect(draft.scores.zen).toEqual({ battery: 8 })
    expect(scoreProgress(draft)).toMatchObject({ complete: false, missingScores: 1 })
    expect(() => rebuild(original, draft)).toThrow(/Score every option/)
  })

  it('surfaces problems in saved data through normal validation', () => {
    const original = laptops()
    original.options[2].name = 'macbook air'
    const { draft } = draftFromComparison(original)
    expect(validateSetup(draft).valid).toBe(false)
  })

  it('converts prices back to editable text', () => {
    const { draft } = draftFromComparison(laptops())
    expect(draft.options.map((option) => option.price)).toEqual(['1099', '', ''])
    expect(draft.options[1].subtitle).toBe('14-inch OLED')
  })
})

describe('editing a saved comparison', () => {
  it('applies edits: rename, new option scored, criterion removed', () => {
    const original = laptops()
    let { draft } = draftFromComparison(original)
    draft = { ...draft, title: 'Laptop for school' }
    draft = updateOption(draft, 'xps', { name: 'Dell XPS 13' })
    draft = addOption(draft, 'fw')
    draft = updateOption(draft, 'fw', { name: 'Framework 13' })
    expect(scoreProgress(draft).complete).toBe(false)
    draft = setScore(draft, 'fw', 'battery', 6)
    draft = removeCriterion(draft, 'price')

    const edited = rebuild(original, draft)
    expect(edited.title).toBe('Laptop for school')
    expect(edited.options.map((option) => option.name)).toEqual(['MacBook Air', 'ASUS Zenbook', 'Dell XPS 13', 'Framework 13'])
    expect(edited.criteria.map((criterion) => criterion.id)).toEqual(['battery'])
    for (const option of edited.options) expect(Object.keys(option.scores)).toEqual(['battery'])
    expect(scoreComparison(edited).winner?.optionId).toBe('mba')
  })

  it('ranks the edited sample the same way the original was ranked (direction preserved)', () => {
    const sample = editableSample()
    // Normalize the original to what the editor will produce (rounded score, clamped importance)…
    const normalized: Comparison = {
      ...sample,
      criteria: sample.criteria.map((criterion) => (criterion.id === 'time' ? { ...criterion, importance: 1 } : criterion)),
      options: sample.options.map((option) =>
        option.id === 'bus' ? { ...option, scores: { ...option.scores, time: 6 } } : option),
    }
    // …and the editor must not change the ranking beyond those reported adjustments.
    const before = scoreComparison(normalized).ranked.map((item) => item.optionId)
    const after = scoreComparison(rebuild(sample)).ranked.map((item) => item.optionId)
    expect(after).toEqual(before)
  })
})
