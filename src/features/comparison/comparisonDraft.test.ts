import { describe, expect, it } from 'vitest'
import { scoreComparison } from '../../lib/scoring'
import {
  MAX_CRITERIA,
  MAX_OPTIONS,
  SUGGESTED_CRITERIA,
  addCriterion,
  addOption,
  buildComparison,
  createDraft,
  firstIncompleteCriterion,
  importanceLevel,
  importanceShare,
  parsePrice,
  removeCriterion,
  removeOption,
  scoreProgress,
  setImportance,
  setScore,
  updateOption,
  validateCriteria,
  validateNewCriterionName,
  validateSetup,
  type ComparisonDraft,
} from './comparisonDraft'

function sequentialIds() {
  let next = 0
  return () => `id-${++next}`
}

function laptopDraft(): ComparisonDraft {
  let draft = createDraft('Tech', sequentialIds())
  draft = { ...draft, title: 'Which laptop should I buy?' }
  const [a, b] = draft.options
  draft = updateOption(draft, a.id, { name: 'MacBook Air', price: '1,099' })
  draft = updateOption(draft, b.id, { name: 'ASUS Zenbook', subtitle: '14-inch OLED' })
  draft = addOption(draft, 'opt-xps')
  draft = updateOption(draft, 'opt-xps', { name: 'Dell XPS' })
  draft = addCriterion(draft, 'Battery Life', 'crit-battery')
  draft = addCriterion(draft, 'Price', 'crit-price')
  return draft
}

function scoreAll(draft: ComparisonDraft, score = 7): ComparisonDraft {
  let result = draft
  for (const option of draft.options) {
    for (const criterion of draft.criteria) result = setScore(result, option.id, criterion.id, score)
  }
  return result
}

describe('createDraft', () => {
  it('starts with two blank options and no criteria', () => {
    const draft = createDraft('Gaming', sequentialIds())
    expect(draft.category).toBe('Gaming')
    expect(draft.options).toHaveLength(2)
    expect(draft.options.map((option) => option.id)).toEqual(['id-1', 'id-2'])
    expect(draft.criteria).toEqual([])
  })

  it('has category suggestions from the brief', () => {
    expect(SUGGESTED_CRITERIA.Tech).toEqual(['Price', 'Performance', 'Battery Life', 'Portability', 'Design'])
    expect(SUGGESTED_CRITERIA.Cars).toContain('Fuel Economy')
  })
})

describe('parsePrice', () => {
  it('accepts blank, plain, comma, and dollar formats', () => {
    expect(parsePrice('')).toEqual({ ok: true, value: undefined })
    expect(parsePrice('  ')).toEqual({ ok: true, value: undefined })
    expect(parsePrice('999')).toEqual({ ok: true, value: 999 })
    expect(parsePrice('1,299.99')).toEqual({ ok: true, value: 1299.99 })
    expect(parsePrice('$1,299')).toEqual({ ok: true, value: 1299 })
  })

  it('rejects negatives, text, and too many decimals', () => {
    for (const input of ['-5', 'abc', '12.345', '1.2.3', '$', 'Infinity']) {
      expect(parsePrice(input).ok).toBe(false)
    }
  })
})

describe('validateSetup', () => {
  it('requires a title', () => {
    const draft = laptopDraft()
    expect(validateSetup({ ...draft, title: '   ' }).title).toMatch(/title/i)
    expect(validateSetup(draft).valid).toBe(true)
  })

  it('explains no options and one option differently', () => {
    const none = validateSetup({ title: 'x', options: [] })
    expect(none.valid).toBe(false)
    expect(none.options).toBe('Add at least two options to compare.')

    const one = validateSetup({ title: 'x', options: [{ id: 'a', name: 'Only', price: '', subtitle: '' }] })
    expect(one.valid).toBe(false)
    expect(one.options).toMatch(/one more option/)
  })

  it('flags blank names', () => {
    const draft = createDraft('Tech', sequentialIds())
    const result = validateSetup({ ...draft, title: 't' })
    expect(result.valid).toBe(false)
    expect(result.perOption['id-1'].name).toMatch(/name/)
  })

  it('flags duplicate names ignoring case and extra spaces', () => {
    let draft = laptopDraft()
    draft = updateOption(draft, 'opt-xps', { name: '  macbook   AIR ' })
    const result = validateSetup(draft)
    expect(result.valid).toBe(false)
    const flagged = Object.values(result.perOption).filter((errors) => errors.name?.includes('already have'))
    expect(flagged).toHaveLength(2)
  })

  it('flags an invalid price but allows a blank one', () => {
    let draft = laptopDraft()
    draft = updateOption(draft, 'opt-xps', { price: 'cheap' })
    expect(validateSetup(draft).perOption['opt-xps'].price).toMatch(/price/i)
    draft = updateOption(draft, 'opt-xps', { price: '' })
    expect(validateSetup(draft).valid).toBe(true)
  })
})

describe('options', () => {
  it('caps options at the maximum', () => {
    let draft = laptopDraft()
    for (let index = 0; index < 10; index += 1) draft = addOption(draft, `extra-${index}`)
    expect(draft.options).toHaveLength(MAX_OPTIONS)
  })

  it('removing an option also drops its scores', () => {
    const draft = scoreAll(laptopDraft())
    const removed = removeOption(draft, 'opt-xps')
    expect(removed.options.map((option) => option.name)).toEqual(['MacBook Air', 'ASUS Zenbook'])
    expect(removed.scores['opt-xps']).toBeUndefined()
  })
})

describe('criteria', () => {
  it('rejects duplicate and blank custom criteria', () => {
    const draft = laptopDraft()
    expect(validateNewCriterionName('battery  life', draft.criteria)).toMatch(/already/)
    expect(validateNewCriterionName('   ', draft.criteria)).toBeDefined()
    expect(validateNewCriterionName('Warranty', draft.criteria)).toBeUndefined()
    expect(addCriterion(draft, 'PRICE').criteria).toHaveLength(2)
  })

  it('caps the number of criteria', () => {
    let draft = createDraft('Other', sequentialIds())
    for (let index = 0; index < MAX_CRITERIA + 3; index += 1) draft = addCriterion(draft, `Thing ${index}`)
    expect(draft.criteria).toHaveLength(MAX_CRITERIA)
  })

  it('requires at least one criterion', () => {
    expect(validateCriteria([])).toMatch(/at least one/)
    expect(validateCriteria(laptopDraft().criteria)).toBeUndefined()
  })

  it('clamps importance to 1–10 whole numbers', () => {
    let draft = laptopDraft()
    draft = setImportance(draft, 'crit-battery', 42)
    expect(draft.criteria[0].importance).toBe(10)
    draft = setImportance(draft, 'crit-battery', -3)
    expect(draft.criteria[0].importance).toBe(1)
    draft = setImportance(draft, 'crit-battery', 6.6)
    expect(draft.criteria[0].importance).toBe(7)
  })

  it('describes importance levels and shares', () => {
    expect(importanceLevel(1)).toBe('low')
    expect(importanceLevel(5)).toBe('medium')
    expect(importanceLevel(8)).toBe('high')
    expect(importanceLevel(10)).toBe('top')
    let draft = setImportance(laptopDraft(), 'crit-battery', 9)
    draft = setImportance(draft, 'crit-price', 3)
    expect(importanceShare(draft.criteria[0], draft.criteria)).toBe(75)
    expect(importanceShare(draft.criteria[1], draft.criteria)).toBe(25)
  })

  it('removing a criterion also drops its scores', () => {
    const draft = removeCriterion(scoreAll(laptopDraft()), 'crit-price')
    expect(draft.criteria.map((criterion) => criterion.id)).toEqual(['crit-battery'])
    for (const option of draft.options) expect(draft.scores[option.id]).toEqual({ 'crit-battery': 7 })
  })
})

describe('scoring progress', () => {
  it('counts completed criteria and missing scores', () => {
    let draft = laptopDraft()
    expect(scoreProgress(draft)).toEqual({ completedCriteria: 0, totalCriteria: 2, missingScores: 6, complete: false })

    for (const option of draft.options) draft = setScore(draft, option.id, 'crit-battery', 8)
    expect(scoreProgress(draft)).toMatchObject({ completedCriteria: 1, missingScores: 3, complete: false })
    expect(firstIncompleteCriterion(draft)).toBe(1)

    draft = scoreAll(draft)
    expect(scoreProgress(draft)).toMatchObject({ completedCriteria: 2, missingScores: 0, complete: true })
    expect(firstIncompleteCriterion(draft)).toBe(-1)
  })

  it('accepts the full 0–10 contract range but ignores out-of-range or fractional scores', () => {
    const draft = laptopDraft()
    expect(setScore(draft, 'opt-xps', 'crit-price', 11)).toBe(draft)
    expect(setScore(draft, 'opt-xps', 'crit-price', -1)).toBe(draft)
    expect(setScore(draft, 'opt-xps', 'crit-price', 5.5)).toBe(draft)
    expect(setScore(draft, 'opt-xps', 'crit-price', 0).scores['opt-xps']['crit-price']).toBe(0)
    expect(setScore(draft, 'opt-xps', 'crit-price', 10).scores['opt-xps']['crit-price']).toBe(10)
  })

  it('a new option after scoring makes progress incomplete again', () => {
    const draft = addOption(scoreAll(laptopDraft()), 'opt-new')
    expect(scoreProgress(draft).complete).toBe(false)
  })

  it('is never complete with no criteria', () => {
    expect(scoreProgress(createDraft()).complete).toBe(false)
  })
})

describe('buildComparison', () => {
  const meta = { id: 'cmp-1', now: '2026-11-22T10:00:00.000Z', createdAt: '2026-11-22T09:00:00.000Z' }

  it('refuses to build with missing scores', () => {
    expect(() => buildComparison(laptopDraft(), meta)).toThrow(/Score every option/)
  })

  it('refuses to build with an invalid setup', () => {
    const draft = scoreAll({ ...laptopDraft(), title: '' })
    expect(() => buildComparison(draft, meta)).toThrow()
  })

  it('produces a shared Comparison that the scoring engine accepts', () => {
    let draft = laptopDraft()
    draft = setImportance(draft, 'crit-battery', 9)
    draft = setImportance(draft, 'crit-price', 3)
    const ids = draft.options.map((option) => option.id)
    const entered: Record<string, [number, number]> = {
      [ids[0]]: [9, 4],
      [ids[1]]: [8, 8],
      [ids[2]]: [7, 6],
    }
    for (const [optionId, [battery, price]] of Object.entries(entered)) {
      draft = setScore(draft, optionId, 'crit-battery', battery)
      draft = setScore(draft, optionId, 'crit-price', price)
    }

    const comparison = buildComparison({ ...draft, title: '  Which laptop   should I buy? ' }, meta)
    expect(comparison).toMatchObject({
      id: 'cmp-1',
      title: 'Which laptop should I buy?',
      category: 'Tech',
      createdAt: meta.createdAt,
      updatedAt: meta.now,
    })
    expect(comparison.options[0]).toEqual({ id: ids[0], name: 'MacBook Air', price: 1099, scores: { 'crit-battery': 9, 'crit-price': 4 } })
    expect(comparison.options[1]).toEqual({ id: ids[1], name: 'ASUS Zenbook', subtitle: '14-inch OLED', scores: { 'crit-battery': 8, 'crit-price': 8 } })
    expect(comparison.options[2]).not.toHaveProperty('price')
    expect(comparison.criteria.every((criterion) => criterion.higherIsBetter)).toBe(true)

    const result = scoreComparison(comparison)
    // Zenbook: 8*0.75 + 8*0.25 = 8; MacBook: 9*0.75 + 4*0.25 = 7.75; XPS: 7*0.75 + 6*0.25 = 6.75
    expect(result.winner?.optionId).toBe(ids[1])
    expect(result.ranked.map((item) => item.optionId)).toEqual([ids[1], ids[0], ids[2]])
  })

  it('drops scores left over for criteria that were removed', () => {
    let draft = scoreAll(laptopDraft())
    draft = { ...draft, criteria: draft.criteria.filter((criterion) => criterion.id !== 'crit-price') }
    const comparison = buildComparison(draft, meta)
    for (const option of comparison.options) expect(Object.keys(option.scores)).toEqual(['crit-battery'])
  })
})
