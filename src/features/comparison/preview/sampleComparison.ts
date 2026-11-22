import type { Comparison } from '../../../types'

/**
 * Invented sample data for the dev preview and tests. Not real product information.
 * Deliberately includes things the editor must handle without silently changing them:
 * a lower-is-better criterion, a fractional score, an out-of-range importance, and a lowercase category.
 */
export function editableSample(): Comparison {
  return {
    id: 'sample-commute',
    title: 'Sample: how should I commute?',
    category: 'other',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    criteria: [
      { id: 'cost', name: 'Monthly cost', importance: 8, higherIsBetter: false },
      { id: 'time', name: 'Travel time', importance: 0, higherIsBetter: false },
      { id: 'fun', name: 'Fun', importance: 4, higherIsBetter: true },
    ],
    options: [
      { id: 'bike', name: 'Bike', price: 40, subtitle: 'Sample option', scores: { cost: 1, time: 6, fun: 9 } },
      { id: 'bus', name: 'Bus', scores: { cost: 4, time: 5.5, fun: 3 } },
      { id: 'car', name: 'Car', price: 350, scores: { cost: 9, time: 3, fun: 6 } },
    ],
  }
}
