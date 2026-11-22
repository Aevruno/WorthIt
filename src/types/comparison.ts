/** Scores are user-entered numbers from 0 to 10, keyed by criterion ID. */
export interface Option {
  id: string
  name: string
  price?: number
  subtitle?: string
  scores: Record<string, number>
}

/** Importance is a nonnegative weight. Zero excludes a criterion from scoring. */
export interface Criterion {
  id: string
  name: string
  importance: number
  higherIsBetter: boolean
}

export interface Comparison {
  id: string
  title: string
  category: string
  options: Option[]
  criteria: Criterion[]
  createdAt: string
  updatedAt: string
}
