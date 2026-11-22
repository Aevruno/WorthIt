import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Comparison } from '../types'
import { createResultCard, shareResultCard } from './share'

const comparison: Comparison = {
  id: 'c', title: 'Private title', category: 'Tech',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  criteria: [{ id: 'battery', name: 'Battery', importance: 3, higherIsBetter: true }],
  options: [
    { id: 'a', name: 'A', scores: { battery: 8 } },
    { id: 'b', name: 'B', scores: { battery: 5 } },
  ],
}

describe('result card', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('shares only the winner, score, and top priorities', () => {
    const card = createResultCard(comparison)!
    expect(card.text).toContain('WORTHIT\n')
    expect(card.text).toContain('My winner:\nA')
    expect(card.text).toContain('Score:\n8.0 / 10')
    expect(card.text).toContain('Top priorities:\nBattery')
    expect(card.text).toContain('What would you choose?')
    expect(card.text).not.toContain('Private title')
  })

  it('does not offer a winner for a tie or missing scores', () => {
    expect(createResultCard({ ...comparison, options: [comparison.options[0], { ...comparison.options[1], scores: { battery: 8 } }] })).toBeNull()
    expect(createResultCard({ ...comparison, options: [comparison.options[0], { ...comparison.options[1], scores: {} }] })).toBeNull()
  })

  it('copies the concise card when browser sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const card = createResultCard(comparison)!
    expect(await shareResultCard(card)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(card.text)
  })
})
