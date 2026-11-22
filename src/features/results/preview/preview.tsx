/**
 * Developer-only preview of the Results screen with labeled sample data.
 * Run `npm run dev` and open /src/features/results/preview/index.html?scenario=normal
 * Not part of the production build (Vite only builds the root index.html).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../styles/global.css'
import { ResultsView } from '../ResultsView'
import { samples, type SampleName } from './sampleComparisons'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const names = Object.keys(samples) as SampleName[]
const requested = new URLSearchParams(window.location.search).get('scenario')
const current: SampleName = names.includes(requested as SampleName) ? (requested as SampleName) : 'normal'

function Preview() {
  return (
    <main className="shell" style={{ paddingTop: 24 }}>
      <nav aria-label="Sample scenarios" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <strong style={{ alignSelf: 'center' }}>Dev preview · sample data:</strong>
        {names.map((name) => (
          <a key={name} href={`?scenario=${name}`} aria-current={name === current ? 'page' : undefined}
            style={{ padding: '10px 14px', minHeight: 44, borderRadius: 999, border: '1px solid #c7d2cc', fontWeight: name === current ? 700 : 400 }}>
            {name}
          </a>
        ))}
      </nav>
      <ResultsView
        comparison={samples[current]}
        onEditComparison={() => window.alert('The comparison screen is owned by another feature.')}
        // Mirrors the comparison flow (feature/comparison-flow): whole-number importance 1–10, USD display prices.
        importanceScale={{ min: 1, max: 10, step: 1 }}
        formatPrice={(price) => usd.format(price)}
      />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>)
