import type { Comparison, Option } from '../../types'
import { analyzeSensitivity, scoreComparison, type Contribution, type RankedOption } from '../../lib/scoring'

/** Gaps on the 0–100 WorthIt scale. Below CLOSE_GAP is "close"; at or above DOMINANT_GAP is "dominant". */
export const CLOSE_GAP = 5
export const DOMINANT_GAP = 20

export interface OptionSummary {
  id: string
  name: string
  subtitle?: string
  price?: number
  /** WorthIt score on a 0–100 scale (engine score × 10). */
  points: number
  rank: number
}

export interface Reason {
  title: string
  detail: string
}

export interface ContributionRow {
  criterionId: string
  name: string
  /** Points this criterion added to the winner's 0–100 score. */
  points: number
  /** Most points this criterion could add (its share of your priorities). */
  maxPoints: number
  enteredScore: number
  higherIsBetter: boolean
}

export interface TradeoffItem {
  criterionName: string
  higherIsBetter: boolean
  theirScore: number
  winnerScore: number
}

export interface Tradeoff {
  option: OptionSummary
  items: TradeoffItem[]
}

export interface WinnerChange {
  criterionName: string
  direction: 'increase' | 'decrease'
  challengerName: string
  fromImportance: number
  toImportance: number
  /** True when the criterion would need more importance than your current top priority has. */
  exceedsTopPriority: boolean
}

export interface TieDifference {
  criterionName: string
  higherIsBetter: boolean
  bestNames: string[]
  scores: Array<{ name: string; score: number }>
}

export type Closeness = 'close' | 'clear' | 'dominant'

export type ResultSummary =
  | { kind: 'empty' }
  | { kind: 'incomplete'; problems: string[] }
  | {
      kind: 'tie'
      leaders: OptionSummary[]
      ranking: OptionSummary[]
      differences: TieDifference[]
    }
  | {
      kind: 'decided'
      closeness: Closeness
      winner: OptionSummary
      runnerUp: OptionSummary
      ranking: OptionSummary[]
      /** winner.points − runnerUp.points */
      gapPoints: number
      reasons: Reason[]
      contributions: ContributionRow[]
      tradeoffs: Tradeoff[]
      /** Null when sensitivity analysis could not run. */
      changes: WinnerChange[] | null
      /** Upper importance bound the sensitivity analysis applied to increases. */
      maxImportance: number
      topPriorityName: string
    }

function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 10
}

export function formatNumber(value: number, maxDecimals = 1): string {
  return Number(value.toFixed(maxDecimals)).toString()
}

/** "8/10" or "2/10 (lower is better)". */
export function scoreText(score: number, higherIsBetter: boolean): string {
  return `${formatNumber(score)}/10${higherIsBetter ? '' : ' (lower is better)'}`
}

/** Human-readable reasons the comparison cannot be scored yet. Empty when it can. */
export function findProblems(comparison: Pick<Comparison, 'options' | 'criteria'>): string[] {
  const { options, criteria } = comparison
  const problems: string[] = []
  if (options.length < 2) problems.push('Add at least two options to compare.')
  if (criteria.length === 0) problems.push('Add at least one priority to score your options on.')
  if (criteria.some((criterion) => !Number.isFinite(criterion.importance) || criterion.importance < 0)) {
    problems.push('Every priority needs an importance of zero or more.')
  } else if (criteria.length > 0 && !criteria.some((criterion) => criterion.importance > 0)) {
    problems.push('Give at least one priority some importance.')
  }
  for (const option of options) {
    const missing = criteria.filter((criterion) => !isValidScore(option.scores[criterion.id]))
    if (missing.length > 0) {
      const label = option.name.trim() || 'An option'
      problems.push(`${label} still needs a 0–10 score for ${missing.map((criterion) => criterion.name).join(', ')}.`)
    }
  }
  return problems
}

function summarizeOption(option: Option, ranked: RankedOption): OptionSummary {
  return {
    id: option.id,
    name: option.name,
    subtitle: option.subtitle,
    price: option.price !== undefined && Number.isFinite(option.price) ? option.price : undefined,
    points: ranked.score * 10,
    rank: ranked.rank,
  }
}

function closenessFor(gap: number): Closeness {
  if (gap < CLOSE_GAP) return 'close'
  if (gap >= DOMINANT_GAP) return 'dominant'
  return 'clear'
}

/** Turns a comparison into everything the Results screen shows. Uses only the shared scoring engine. */
export function summarizeResult(comparison: Pick<Comparison, 'options' | 'criteria'> | null | undefined): ResultSummary {
  if (!comparison || (comparison.options.length === 0 && comparison.criteria.length === 0)) return { kind: 'empty' }

  const problems = findProblems(comparison)
  if (problems.length > 0) return { kind: 'incomplete', problems }

  let result: ReturnType<typeof scoreComparison>
  try {
    result = scoreComparison(comparison)
  } catch {
    return { kind: 'incomplete', problems: ['Some of this comparison’s data can’t be scored. Check that every option and priority is filled in.'] }
  }

  const { options, criteria } = comparison
  const optionById = new Map(options.map((option) => [option.id, option]))
  const criterionById = new Map(criteria.map((criterion) => [criterion.id, criterion]))
  const rankedById = new Map(result.ranked.map((item) => [item.optionId, item]))
  const ranking = result.ranked.map((item) => summarizeOption(optionById.get(item.optionId)!, item))
  const summaryById = new Map(ranking.map((item) => [item.id, item]))
  const active = criteria.filter((criterion) => criterion.importance > 0)
  const contribution = (optionId: string, criterionId: string): Contribution =>
    rankedById.get(optionId)!.contributions.find((item) => item.criterionId === criterionId)!

  if (!result.winner) {
    const leaderIds = result.leaders.map((item) => item.optionId)
    const differences: TieDifference[] = []
    for (const criterion of active) {
      const scores = leaderIds.map((id) => contribution(id, criterion.id))
      const best = Math.max(...scores.map((item) => item.effectiveScore))
      if (scores.every((item) => item.effectiveScore === best)) continue
      differences.push({
        criterionName: criterion.name,
        higherIsBetter: criterion.higherIsBetter,
        bestNames: leaderIds.filter((_, index) => scores[index].effectiveScore === best).map((id) => summaryById.get(id)!.name),
        scores: leaderIds.map((id, index) => ({ name: summaryById.get(id)!.name, score: scores[index].enteredScore })),
      })
    }
    return {
      kind: 'tie',
      leaders: leaderIds.map((id) => summaryById.get(id)!),
      ranking,
      differences,
    }
  }

  const winner = summaryById.get(result.winner.optionId)!
  const runnerUp = ranking[1]
  const gapPoints = winner.points - runnerUp.points
  const topImportance = Math.max(...active.map((criterion) => criterion.importance))
  const topCriteria = active.filter((criterion) => criterion.importance === topImportance)

  // Why it won — every statement is derived from entered scores and importance.
  const reasons: Reason[] = []
  const used = new Set<string>()
  const top = topCriteria[0]
  const topLabel = topCriteria.length > 1 ? 'one of your top priorities' : 'your top priority'
  const winnerTop = contribution(winner.id, top.id)
  const othersTop = ranking.filter((item) => item.id !== winner.id).map((item) => contribution(item.id, top.id))
  if (othersTop.every((item) => winnerTop.effectiveScore > item.effectiveScore)) {
    reasons.push({
      title: `Best on ${topLabel}: ${top.name}`,
      detail: `You rated it ${scoreText(winnerTop.enteredScore, top.higherIsBetter)}, better than every other option.`,
    })
    used.add(top.id)
  } else if (winnerTop.effectiveScore >= contribution(runnerUp.id, top.id).effectiveScore) {
    reasons.push({
      title: `Held its own on ${topLabel}: ${top.name}`,
      detail: `${scoreText(winnerTop.enteredScore, top.higherIsBetter)} vs ${runnerUp.name}’s ${formatNumber(contribution(runnerUp.id, top.id).enteredScore)}/10.`,
    })
    used.add(top.id)
  }

  const winnerContributions = rankedById.get(winner.id)!.contributions
  const strong = [...winnerContributions]
    .filter((item) => item.normalizedWeight > 0 && item.effectiveScore >= 7 && !used.has(item.criterionId))
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 2)
  for (const item of strong) {
    const criterion = criterionById.get(item.criterionId)!
    reasons.push({
      title: `Strong ${criterion.name} score`,
      detail: `You rated it ${scoreText(item.enteredScore, criterion.higherIsBetter)}. ${criterion.name} is ${Math.round(item.normalizedWeight * 100)}% of your priorities.`,
    })
  }

  const beats = active.filter((criterion) =>
    contribution(winner.id, criterion.id).effectiveScore > contribution(runnerUp.id, criterion.id).effectiveScore)
  if (active.length > 1 && beats.length > active.length / 2) {
    reasons.push({
      title: `Beat ${runnerUp.name} on ${beats.length} of ${active.length} priorities`,
      detail: beats.map((criterion) => criterion.name).join(', '),
    })
  }
  if (reasons.length === 0) {
    reasons.push({
      title: 'Highest total once your priorities were weighted',
      detail: `No single standout score. Its smaller advantages added up to more than ${runnerUp.name}’s.`,
    })
  }

  const contributions: ContributionRow[] = winnerContributions
    .filter((item) => item.normalizedWeight > 0)
    .map((item) => {
      const criterion = criterionById.get(item.criterionId)!
      return {
        criterionId: item.criterionId,
        name: criterion.name,
        points: item.weightedScore * 10,
        maxPoints: item.normalizedWeight * 100,
        enteredScore: item.enteredScore,
        higherIsBetter: criterion.higherIsBetter,
      }
    })
    .sort((a, b) => b.maxPoints - a.maxPoints || b.points - a.points)

  const tradeoffs: Tradeoff[] = ranking
    .filter((item) => item.id !== winner.id)
    .map((option) => ({
      option,
      items: [...active]
        .sort((a, b) => b.importance - a.importance)
        .filter((criterion) => contribution(option.id, criterion.id).effectiveScore > contribution(winner.id, criterion.id).effectiveScore)
        .map((criterion) => ({
          criterionName: criterion.name,
          higherIsBetter: criterion.higherIsBetter,
          theirScore: contribution(option.id, criterion.id).enteredScore,
          winnerScore: contribution(winner.id, criterion.id).enteredScore,
        })),
    }))
    .filter((tradeoff) => tradeoff.items.length > 0)

  let changes: WinnerChange[] | null = null
  let maxImportance = topImportance * 2
  try {
    const sensitivity = analyzeSensitivity(comparison)
    maxImportance = sensitivity.maxImportance
    changes = sensitivity.flips.slice(0, 3).map((flip) => ({
      criterionName: criterionById.get(flip.criterionId)!.name,
      direction: flip.direction,
      challengerName: summaryById.get(flip.challengerId)!.name,
      fromImportance: flip.currentImportance,
      toImportance: flip.flipImportance,
      exceedsTopPriority: flip.direction === 'increase' && flip.flipImportance > topImportance,
    }))
  } catch {
    changes = null
  }

  return {
    kind: 'decided',
    closeness: closenessFor(gapPoints),
    winner,
    runnerUp,
    ranking,
    gapPoints,
    reasons,
    contributions,
    tradeoffs,
    changes,
    maxImportance,
    topPriorityName: topCriteria.length > 1 ? topCriteria.map((criterion) => criterion.name).join(' / ') : top.name,
  }
}

/** Display a set of 0–100 scores: whole numbers, unless rounding would hide a real difference. */
export function pointsFormatter(values: number[]): (value: number) => string {
  const rounded = values.map((value) => Math.round(value))
  const collides = new Set(rounded).size !== rounded.length
  return (value) => (collides ? value.toFixed(1) : Math.round(value).toString())
}

/** "Only 4 points behind", computed from the numbers actually shown so they always agree. */
export function gapText(winnerPoints: number, runnerUpPoints: number): string {
  const format = pointsFormatter([winnerPoints, runnerUpPoints])
  const shownGap = Number(format(winnerPoints)) - Number(format(runnerUpPoints))
  const gap = formatNumber(shownGap)
  if (shownGap < CLOSE_GAP) return `Only ${gap} ${gap === '1' ? 'point' : 'points'} behind`
  return `${gap} points behind`
}

