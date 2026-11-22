import { ComparisonPlaceholder } from './features/comparison/ComparisonPlaceholder'
import { ResultsPlaceholder } from './features/results/ResultsPlaceholder'
import { SavedPlaceholder } from './features/saved/SavedPlaceholder'

export default function App() {
  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Aevruno</p>
        <h1>WorthIt</h1>
        <p>Make decisions around what matters to you.</p>
      </header>
      <section aria-label="Planned features" className="feature-grid">
        <ComparisonPlaceholder />
        <ResultsPlaceholder />
        <SavedPlaceholder />
      </section>
      <p className="note">This is the project foundation. Comparison tools are coming next.</p>
    </main>
  )
}
