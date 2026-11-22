import type { Comparison } from '../types'
import { scoreComparison } from './scoring'

export interface ResultCard {
  text: string
  winnerName: string
  score: number
  topPriorities: string[]
}

/** Returns null for incomplete comparisons or a first-place tie. */
export function createResultCard(comparison: Comparison): ResultCard | null {
  if (comparison.options.length < 2) return null
  try {
    const result = scoreComparison(comparison)
    if (!result.winner) return null
    const winner = comparison.options.find((option) => option.id === result.winner?.optionId)
    if (!winner) return null
    const topPriorities = [...comparison.criteria]
      .filter((criterion) => criterion.importance > 0)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
      .map((criterion) => criterion.name)
    const score = result.winner.score
    return {
      winnerName: winner.name,
      score,
      topPriorities,
      text: `WORTHIT\n\nMy winner:\n${winner.name}\n\nScore:\n${score.toFixed(1)} / 10\n\nTop priorities:\n${topPriorities.join('\n')}\n\nWhat would you choose?`,
    }
  } catch {
    return null
  }
}

/** Only the concise result card is shared; comparison details and notes stay local. */
export async function shareResultCard(card: ResultCard): Promise<'shared' | 'copied' | 'manual'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'WorthIt result', text: card.text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'manual'
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(card.text)
      return 'copied'
    } catch {
      // Manual copy remains available to the caller.
    }
  }
  return 'manual'
}
