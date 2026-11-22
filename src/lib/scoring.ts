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

export interface WinnerFlip {
  criterionId: string
  /** Whether this criterion's importance must rise or fall to change the winner. */
  direction: 'increase' | 'decrease'
  /** The option that becomes the sole winner at `flipImportance`. */
  challengerId: string
  currentImportance: number
  /** Importance at which the first challenger exactly ties the current winner. */
  tieImportance: number
  /**
   * Importance (a multiple of `step`, just past the tie point) at which
   * `scoreComparison` was actually re-run and returned `challengerId` as the sole winner.
   */
  flipImportance: number
}

export interface SensitivityOptions {
  /** Highest importance considered when raising a criterion. Defaults to 2x the current highest importance. */
  maxImportance?: number
  /** Granularity of reported `flipImportance` values. Defaults to 0.1. */
  step?: number
}

export interface SensitivityResult {
  /** Current sole winner, or null when first place is tied (no flips are computed for ties). */
  winnerId: string | null
  /** At most one flip per criterion and direction, smallest change first. Empty means the winner is stable. */
  flips: WinnerFlip[]
  /** The upper bound that was applied to increases. */
  maxImportance: number
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Finds the smallest single-criterion importance change that would change the winner.
 * Each criterion is varied on its own (others fixed): raised up to `maxImportance`, or lowered to 0.
 * Every reported flip is confirmed by re-running `scoreComparison` at `flipImportance`.
 */
export function analyzeSensitivity(
  comparison: Pick<Comparison, 'options' | 'criteria'>,
  settings: SensitivityOptions = {},
): SensitivityResult {
  const { options, criteria } = comparison
  const base = scoreComparison(comparison)
  const topImportance = Math.max(...criteria.map((criterion) => criterion.importance))
  const maxImportance = settings.maxImportance ?? topImportance * 2
  const step = settings.step ?? 0.1
  if (!Number.isFinite(maxImportance) || maxImportance < 0) throw new Error('maxImportance must be a nonnegative number')
  if (!Number.isFinite(step) || step <= 0) throw new Error('step must be a positive number')
  if (!base.winner) return { winnerId: null, flips: [], maxImportance }

  const winnerId = base.winner.optionId
  const effective = new Map(base.ranked.map((item) => [
    item.optionId,
    new Map(item.contributions.map((contribution) => [contribution.criterionId, contribution.effectiveScore])),
  ]))
  const eff = (optionId: string, criterionId: string) => effective.get(optionId)!.get(criterionId)!

  function winnerAt(criterionId: string, importance: number): string | null {
    try {
      return scoreComparison({
        options,
        criteria: criteria.map((item) => (item.id === criterionId ? { ...item, importance } : item)),
      }).winner?.optionId ?? null
    } catch {
      return null // e.g. total importance would become zero
    }
  }

  const flips: WinnerFlip[] = []
  for (const criterion of criteria) {
    // Unnormalized weighted sum over the other criteria. Totals only change sign of their
    // difference where these sums plus importance * effectiveScore are equal.
    const rest = (optionId: string) => criteria.reduce(
      (sum, other) => (other.id === criterion.id ? sum : sum + other.importance * eff(optionId, other.id)),
      0,
    )
    const winnerRest = rest(winnerId)
    const winnerScore = eff(winnerId, criterion.id)
    let increaseTie: number | null = null
    let decreaseTie: number | null = null

    for (const option of options) {
      if (option.id === winnerId) continue
      const score = eff(option.id, criterion.id)
      if (score === winnerScore) continue
      const tie = (winnerRest - rest(option.id)) / (score - winnerScore)
      if (score > winnerScore && tie > criterion.importance) {
        increaseTie = increaseTie === null ? tie : Math.min(increaseTie, tie)
      } else if (score < winnerScore && tie < criterion.importance && tie >= 0) {
        decreaseTie = decreaseTie === null ? tie : Math.max(decreaseTie, tie)
      }
    }

    const candidates: Array<['increase' | 'decrease', number | null]> = [['increase', increaseTie], ['decrease', decreaseTie]]
    for (const [direction, tie] of candidates) {
      if (tie === null) continue
      // Try the first few step-aligned values past the tie point; keep the first verified flip.
      for (let attempt = 0; attempt < 3; attempt++) {
        const flipImportance = direction === 'increase'
          ? roundTo((Math.floor(tie / step) + 1 + attempt) * step, step)
          : roundTo((Math.ceil(tie / step) - 1 - attempt) * step, step)
        if (direction === 'increase' && flipImportance > maxImportance) break
        if (direction === 'decrease' && flipImportance < 0) break
        const challengerId = winnerAt(criterion.id, flipImportance)
        if (challengerId !== null && challengerId !== winnerId) {
          flips.push({
            criterionId: criterion.id,
            direction,
            challengerId,
            currentImportance: criterion.importance,
            tieImportance: tie,
            flipImportance,
          })
          break
        }
      }
    }
  }

  const size = (flip: WinnerFlip) => Math.abs(flip.flipImportance - flip.currentImportance)
  flips.sort((a, b) => size(a) - size(b))
  return { winnerId, flips, maxImportance }
}
