import { useState } from 'react'
import { ComparisonFlow } from './features/comparison/ComparisonFlow'
import { ResultsPlaceholder } from './features/results/ResultsPlaceholder'
import type { Comparison } from './types'

type View = { name: 'compare' } | { name: 'results'; comparison: Comparison }

/**
 * Minimal view switch (no router yet). The comparison flow hands a complete,
 * scorable `Comparison` to the results view. The results feature replaces
 * `ResultsPlaceholder` with its real page and receives `view.comparison`.
 */
export default function App() {
  const [view, setView] = useState<View>({ name: 'compare' })

  if (view.name === 'results') {
    return (
      <main className="shell">
        <header>
          <p className="eyebrow">Results</p>
          <h1>{view.comparison.title}</h1>
        </header>
        <ResultsPlaceholder />
        <p className="note">
          <button type="button" onClick={() => setView({ name: 'compare' })}>
            Back to home
          </button>
        </p>
      </main>
    )
  }

  return <ComparisonFlow onComplete={(comparison) => setView({ name: 'results', comparison })} />
}
