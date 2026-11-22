import type { Comparison, Criterion, Option } from '../../../types'

/**
 * SAMPLE DATA for the Results developer preview and tests only.
 * Names are invented; every number stands in for what a user would enter.
 */
type Sample = Pick<Comparison, 'options' | 'criteria'>

const laptopCriteria: Criterion[] = [
  { id: 'battery', name: 'Battery life', importance: 5, higherIsBetter: true },
  { id: 'performance', name: 'Performance', importance: 4, higherIsBetter: true },
  { id: 'portability', name: 'Portability', importance: 3, higherIsBetter: true },
  { id: 'value', name: 'Value for money', importance: 3, higherIsBetter: true },
]

const aero = (battery: number): Option => ({
  id: 'aero', name: 'Aero 13', subtitle: '13-inch ultralight', price: 1099,
  scores: { battery, performance: 6, portability: 9, value: 6 },
})
const zen: Option = { id: 'zen', name: 'Zen 14', price: 899, scores: { battery: 7, performance: 7, portability: 7, value: 9 } }
const volt: Option = { id: 'volt', name: 'Volt 15', price: 1299, scores: { battery: 5, performance: 10, portability: 4, value: 6 } }

export const samples = {
  /** Aero 79.3, Zen 74, Volt 63.3 — clear winner with tradeoffs and flips. */
  normal: { criteria: laptopCriteria, options: [aero(10), zen, volt] },
  /** Aero 76, Zen 74 — close result. */
  close: { criteria: laptopCriteria, options: [aero(9), zen, volt] },
  /** Aero 9/6/8 vs Volt 8/6/9 on equal weights — exact tie (exercises the floating-point tie fix). */
  tie: {
    criteria: laptopCriteria.slice(0, 3).map((criterion) => ({ ...criterion, importance: 3 })),
    options: [
      { ...aero(9), scores: { battery: 9, performance: 6, portability: 8 } },
      { ...volt, scores: { battery: 8, performance: 6, portability: 9 } },
      { ...zen, scores: { battery: 6, performance: 6, portability: 6 } },
    ],
  },
  /** Aero beats both alternatives everywhere — dominant, stable winner, no tradeoffs. */
  dominant: {
    criteria: laptopCriteria,
    options: [
      { ...aero(9), scores: { battery: 9, performance: 9, portability: 10, value: 8 } },
      { ...zen, scores: { battery: 5, performance: 6, portability: 5, value: 6 } },
      { ...volt, scores: { battery: 4, performance: 7, portability: 3, value: 5 } },
    ],
  },
  /** A lower-is-better criterion and no prices. */
  lowerIsBetter: {
    criteria: [
      { id: 'commute', name: 'Commute time', importance: 4, higherIsBetter: false },
      { id: 'space', name: 'Space', importance: 3, higherIsBetter: true },
      { id: 'light', name: 'Natural light', importance: 2, higherIsBetter: true },
    ],
    options: [
      { id: 'oak', name: 'Oak Street flat', scores: { commute: 2, space: 6, light: 8 } },
      { id: 'harbor', name: 'Harbor loft', scores: { commute: 6, space: 9, light: 7 } },
    ],
  },
  /** Zen is missing a Performance score. */
  incomplete: {
    criteria: laptopCriteria,
    options: [aero(10), { ...zen, scores: { battery: 7, portability: 7, value: 9 } }],
  },
  empty: null,
} satisfies Record<string, Sample | null>

export type SampleName = keyof typeof samples
