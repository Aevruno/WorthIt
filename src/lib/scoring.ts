import type { Comparison, Criterion, Option } from '../types'

export interface Contribution {
  criterionId: string
  enteredScore: number
  effectiveScore: number
  normalizedWeight: number
  weightedScore: number
}

export interface RankedOption {
  optionId: string
  rank: number
  score: number
  contributions: Contribution[]
}

export interface ScoringResult {
  ranked: RankedOption[]
  /** Null when first place is tied. */
  winner: RankedOption | null
  /** All options tied for first, including a sole winner. */
  leaders: RankedOption[]
}

/**
 * Weighted sums of equal real values can differ in floating point
 * (e.g. 1/3 + 2/3 + 1 vs 1 + 2/3 + 1/3). Treat totals this close as tied.
 */
const TIE_TOLERANCE = 1e-9

function sameScore(a: number, b: number): boolean {
  return Math.abs(a - b) <= TIE_TOLERANCE
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const ids = items.map((item) => item.id)
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error(`${label} IDs must be nonempty and unique`)
  }
}

function validate(criteria: Criterion[], options: Option[]): number {
  if (criteria.length === 0 || options.length === 0) {
    throw new Error('At least one criterion and option are required')
  }
  assertUniqueIds(criteria, 'Criterion')
  assertUniqueIds(options, 'Option')

  for (const criterion of criteria) {
    if (!Number.isFinite(criterion.importance) || criterion.importance < 0) {
      throw new Error(`Invalid importance for criterion ${criterion.id}`)
    }
  }
  const totalImportance = criteria.reduce((sum, criterion) => sum + criterion.importance, 0)
  if (!Number.isFinite(totalImportance) || totalImportance <= 0) {
    throw new Error('Criteria must have positive total importance')
  }

  for (const option of options) {
    for (const criterion of criteria) {
      const score = option.scores[criterion.id]
      if (!Number.isFinite(score) || score < 0 || score > 10) {
        throw new Error(`Missing or invalid score for option ${option.id}, criterion ${criterion.id}`)
      }
    }
  }
  return totalImportance
}

/** Scores only user-entered values. Scores are 0–10; lower-is-better criteria are inverted. */
export function scoreComparison(comparison: Pick<Comparison, 'options' | 'criteria'>): ScoringResult {
  const { options, criteria } = comparison
  const totalImportance = validate(criteria, options)

  const ranked = options.map((option, index) => {
    const contributions = criteria.map((criterion) => {
      const enteredScore = option.scores[criterion.id]
      const effectiveScore = criterion.higherIsBetter ? enteredScore : 10 - enteredScore
      const normalizedWeight = criterion.importance / totalImportance
      return {
        criterionId: criterion.id,
        enteredScore,
        effectiveScore,
        normalizedWeight,
        weightedScore: effectiveScore * normalizedWeight,
      }
    })
    return {
      optionId: option.id,
      rank: 0,
      score: contributions.reduce((sum, item) => sum + item.weightedScore, 0),
      contributions,
      index,
    }
  })

  ranked.sort((a, b) => (sameScore(a.score, b.score) ? a.index - b.index : b.score - a.score))
  let rank = 1
  const withRanks: RankedOption[] = ranked.map(({ index: _index, ...item }, position) => {
    if (position > 0 && !sameScore(item.score, ranked[position - 1].score)) rank = position + 1
    return { ...item, rank }
  })
  const leaders = withRanks.filter((item) => item.rank === 1)
  return { ranked: withRanks, winner: leaders.length === 1 ? leaders[0] : null, leaders }
}
