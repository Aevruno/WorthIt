import { describe, expect, it } from 'vitest'
import { scoreComparison } from '../../lib/scoring'
import { gapText, pointsFormatter, summarizeResult } from './summarizeResult'
import { samples } from './preview/sampleComparisons'

function decided(sample: Parameters<typeof summarizeResult>[0], settings?: Parameters<typeof summarizeResult>[1]) {
  const summary = summarizeResult(sample, settings)
  if (summary.kind !== 'decided') throw new Error(`expected decided, got ${summary.kind}`)
  return summary
}

describe('summarizeResult', () => {
  it('returns empty when there is no comparison', () => {
    expect(summarizeResult(null)).toEqual({ kind: 'empty' })
    expect(summarizeResult(undefined)).toEqual({ kind: 'empty' })
    expect(summarizeResult({ options: [], criteria: [] })).toEqual({ kind: 'empty' })
  })

  it('explains what is missing instead of scoring an incomplete comparison', () => {
    expect(summarizeResult(samples.incomplete)).toEqual({
      kind: 'incomplete',
      problems: ['Zen 14 still needs a 0–10 score for Performance.'],
    })
    const one = summarizeResult({ criteria: samples.normal.criteria, options: [samples.normal.options[0]] })
    expect(one).toMatchObject({ kind: 'incomplete', problems: ['Add at least two options to compare.'] })
    const noCriteria = summarizeResult({ criteria: [], options: samples.normal.options })
    expect(noCriteria).toMatchObject({ kind: 'incomplete', problems: ['Add at least one priority to score your options on.'] })
    const zero = summarizeResult({ ...samples.normal, criteria: samples.normal.criteria.map((c) => ({ ...c, importance: 0 })) })
    expect(zero).toMatchObject({ kind: 'incomplete', problems: ['Give at least one priority some importance.'] })
  })

  it('handles malformed data (e.g. from storage) without throwing', () => {
    const damaged = { kind: 'incomplete', problems: [expect.stringContaining('damaged')] }
    const bad: unknown[] = [
      { options: 'nope', criteria: [] },
      { options: [null], criteria: samples.normal.criteria },
      { options: [{ id: 'a', name: 'A' }], criteria: samples.normal.criteria }, // no scores object
      { options: samples.normal.options, criteria: [{ id: 'x', name: 'X', importance: '5', higherIsBetter: true }] },
      'not a comparison',
    ]
    for (const value of bad) {
      expect(summarizeResult(value as Parameters<typeof summarizeResult>[0])).toEqual(damaged)
    }
  })

  it('lists invalid scores and importance as problems', () => {
    const [aero, zen] = samples.normal.options
    const problems = (comparison: Parameters<typeof summarizeResult>[0]) => {
      const summary = summarizeResult(comparison)
      return summary.kind === 'incomplete' ? summary.problems : []
    }
    expect(problems({ ...samples.normal, options: [{ ...aero, scores: { ...aero.scores, battery: Number.NaN } }, zen] }))
      .toEqual(['Aero 13 still needs a 0–10 score for Battery life.'])
    expect(problems({ ...samples.normal, options: [aero, { ...zen, scores: { ...zen.scores, value: 11 } }] }))
      .toEqual(['Zen 14 still needs a 0–10 score for Value for money.'])
    expect(problems({ ...samples.normal, criteria: [{ ...samples.normal.criteria[0], importance: -1 }, ...samples.normal.criteria.slice(1)] }))
      .toEqual(['Every priority needs an importance of zero or more.'])
  })

  it('gives blank names neutral labels so sentences stay readable', () => {
    const [aero, zen] = samples.normal.options
    const incomplete = summarizeResult({ ...samples.normal, options: [aero, { ...zen, name: '  ', scores: {} }] })
    expect(incomplete).toMatchObject({ problems: [expect.stringMatching(/^Option 2 still needs/)] })
    const summary = decided({ ...samples.normal, options: [{ ...aero, name: '' }, zen] })
    expect(summary.winner.name).toBe('Option 1')
  })

  it('falls back to a generic message if the engine rejects data the checks missed', () => {
    const duplicate = { ...samples.normal, options: [samples.normal.options[0], samples.normal.options[0]] }
    expect(summarizeResult(duplicate)).toMatchObject({ kind: 'incomplete' })
  })

  it('summarizes a clear winner from the shared engine', () => {
    const summary = decided(samples.normal)
    const engine = scoreComparison(samples.normal)
    expect(summary.closeness).toBe('clear')
    expect(summary.winner).toMatchObject({ id: 'aero', name: 'Aero 13', price: 1099, rank: 1 })
    expect(summary.winner.points).toBeCloseTo(engine.ranked[0].score * 10)
    expect(summary.runnerUp.id).toBe('zen')
    expect(summary.gapPoints).toBeCloseTo(5.333, 2)
    expect(summary.reasons.map((reason) => reason.title)).toEqual([
      'Best on your top priority: Battery life',
      'Strong Portability score',
    ])
  })

  it('builds contribution rows that add up to the winner score', () => {
    const summary = decided(samples.normal)
    const total = summary.contributions.reduce((sum, row) => sum + row.points, 0)
    expect(total).toBeCloseTo(summary.winner.points)
    const maxTotal = summary.contributions.reduce((sum, row) => sum + row.maxPoints, 0)
    expect(maxTotal).toBeCloseTo(100)
    expect(summary.contributions[0]).toMatchObject({ name: 'Battery life', enteredScore: 10 })
  })

  it('lists tradeoffs where other options beat the winner, biggest point impact first', () => {
    const summary = decided(samples.normal)
    expect(summary.tradeoffs.map((t) => [t.option.name, t.items.map((i) => [i.criterionName, i.theirScore, i.winnerScore])])).toEqual([
      // Value: (9-6) × 3/15 × 10 = 6 pts; Performance: (7-6) × 4/15 × 10 ≈ 2.7 pts
      ['Zen 14', [['Value for money', 9, 6], ['Performance', 7, 6]]],
      ['Volt 15', [['Performance', 10, 6]]],
    ])
    const zen = summary.tradeoffs[0].items
    expect(zen[0].points).toBeCloseTo(6)
    expect(zen[1].points).toBeCloseTo(2.667, 2)
    expect(zen.every((item) => !item.minor)).toBe(true)
  })

  it('labels tiny tradeoffs as minor instead of hiding them', () => {
    const summary = decided({
      criteria: [
        { id: 'main', name: 'Main', importance: 10, higherIsBetter: true },
        { id: 'tiny', name: 'Tiny', importance: 0.1, higherIsBetter: true },
      ],
      options: [
        { id: 'a', name: 'A', scores: { main: 9, tiny: 5 } },
        { id: 'b', name: 'B', scores: { main: 6, tiny: 6 } },
      ],
    })
    expect(summary.tradeoffs).toHaveLength(1)
    expect(summary.tradeoffs[0].items[0]).toMatchObject({ criterionName: 'Tiny', minor: true })
    expect(summary.tradeoffs[0].items[0].points).toBeLessThan(1)
  })

  it('limits winner changes to the UI importance scale', () => {
    const scale = { min: 1, max: 10, step: 1 }
    for (const sample of [samples.normal, samples.close, samples.lowerIsBetter]) {
      const summary = decided(sample, { importanceScale: scale })
      expect(summary.minImportance).toBe(1)
      expect(summary.maxImportance).toBe(10)
      for (const change of summary.changes!) {
        expect(Number.isInteger(change.toImportance)).toBe(true)
        expect(change.toImportance).toBeGreaterThanOrEqual(1)
        expect(change.toImportance).toBeLessThanOrEqual(10)
        const criterion = sample.criteria.find((item) => item.name === change.criterionName)!
        const rerun = scoreComparison({
          options: sample.options,
          criteria: sample.criteria.map((item) => (item.id === criterion.id ? { ...item, importance: change.toImportance } : item)),
        })
        expect(sample.options.find((option) => option.id === rerun.winner?.optionId)?.name).toBe(change.challengerName)
      }
    }
  })

  it('only claims winner changes that the shared engine confirms', () => {
    for (const sample of [samples.normal, samples.close, samples.lowerIsBetter]) {
      const summary = decided(sample)
      expect(summary.changes?.length).toBeGreaterThan(0)
      for (const change of summary.changes!) {
        const criterion = sample.criteria.find((item) => item.name === change.criterionName)!
        const rerun = scoreComparison({
          options: sample.options,
          criteria: sample.criteria.map((item) => (item.id === criterion.id ? { ...item, importance: change.toImportance } : item)),
        })
        const winnerName = sample.options.find((option) => option.id === rerun.winner?.optionId)?.name
        expect(winnerName).toBe(change.challengerName)
      }
    }
  })

  it('flags changes that would need more importance than the current top priority', () => {
    const summary = decided(samples.normal)
    const value = summary.changes!.find((change) => change.criterionName === 'Value for money')!
    expect(value).toMatchObject({ direction: 'increase', exceedsTopPriority: true, fromImportance: 3 })
    expect(value.toImportance).toBeGreaterThan(5)
    expect(summary.topPriorityName).toBe('Battery life')
  })

  it('marks a close result as close', () => {
    const summary = decided(samples.close)
    expect(summary.closeness).toBe('close')
    expect(summary.gapPoints).toBeCloseTo(2)
  })

  it('reports a dominant, stable winner with no tradeoffs', () => {
    const summary = decided(samples.dominant)
    expect(summary.closeness).toBe('dominant')
    expect(summary.tradeoffs).toEqual([])
    expect(summary.changes).toEqual([])
    expect(summary.maxImportance).toBe(10)
  })

  it('handles lower-is-better criteria in reasons and tradeoffs', () => {
    const summary = decided(samples.lowerIsBetter)
    expect(summary.reasons[0]).toEqual({
      title: 'Best on your top priority: Commute time',
      detail: 'You rated it 2/10 (lower is better), better than every other option.',
    })
    expect(summary.winner.price).toBeUndefined()
  })

  it('reports a tie without picking a winner, with what separates the leaders', () => {
    const summary = summarizeResult(samples.tie)
    expect(summary.kind).toBe('tie')
    if (summary.kind !== 'tie') return
    expect(summary.leaders.map((item) => item.name)).toEqual(['Aero 13', 'Volt 15'])
    expect(summary.differences.map((d) => [d.criterionName, d.bestNames])).toEqual([
      ['Battery life', ['Aero 13']],
      ['Portability', ['Volt 15']],
    ])
  })
})

describe('score display helpers', () => {
  it('uses whole numbers unless rounding would hide a difference', () => {
    expect(pointsFormatter([79.33, 74])(79.33)).toBe('79')
    expect(pointsFormatter([88.4, 88.0])(88.4)).toBe('88.4')
    expect(pointsFormatter([88.4, 88.0])(88.0)).toBe('88.0')
  })

  it('describes the gap using the numbers that are shown', () => {
    expect(gapText(79.33, 74)).toBe('5 points behind')
    expect(gapText(76, 74)).toBe('Only 2 points behind')
    expect(gapText(88.4, 87.4)).toBe('Only 1 point behind')
    expect(gapText(88.4, 88.0)).toBe('Only 0.4 points behind')
    expect(gapText(88.4, 86.6)).toBe('Only 1 point behind') // shown as 88 vs 87
  })
})
