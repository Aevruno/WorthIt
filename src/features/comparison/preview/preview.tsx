/**
 * Developer-only harness for the comparison flow, since App.tsx is wired up on the integration branch.
 * Run `npm run dev` and open /src/features/comparison/preview/index.html
 * Not part of the production build (Vite only builds the root index.html).
 */
import { StrictMode, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../styles/global.css'
import { scoreComparison } from '../../../lib/scoring'
import type { Comparison } from '../../../types'
import { ComparisonFlow } from '../ComparisonFlow'
import { openDefaultPersistence } from '../comparisonStorage'
import { editableSample } from './sampleComparison'

type View = { name: 'flow'; editing?: Comparison; key: number } | { name: 'done'; comparison: Comparison }

const bar: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 16px',
  background: '#141a46', color: '#fff', fontSize: 14, fontFamily: 'system-ui, sans-serif',
}
const barButton: CSSProperties = { minHeight: 44, padding: '0 14px', borderRadius: 999, border: 0, fontWeight: 700, cursor: 'pointer' }

function Preview() {
  const [view, setView] = useState<View>({ name: 'flow', key: 0 })
  const restart = (editing?: Comparison) => setView({ name: 'flow', editing, key: Date.now() })

  return (
    <>
      <div style={bar} role="region" aria-label="Developer preview controls">
        <strong>Dev preview</strong>
        <button type="button" style={barButton} onClick={() => restart()}>Flow home</button>
        <button type="button" style={barButton} onClick={() => restart(editableSample())}>
          Edit sample (lower-is-better, fractional score)
        </button>
        <button
          type="button"
          style={barButton}
          onClick={() => {
            try { window.localStorage.removeItem('worthit.comparisons.v1') } catch { /* storage blocked */ }
            restart()
          }}
        >
          Clear saved data
        </button>
      </div>

      {view.name === 'flow' ? (
        <ComparisonFlow
          key={view.key}
          initialComparison={view.editing}
          onExit={view.editing ? () => restart() : undefined}
          persistence={openDefaultPersistence()}
          onComplete={(comparison) => setView({ name: 'done', comparison })}
        />
      ) : (
        <Done comparison={view.comparison} onEdit={() => restart(view.comparison)} onHome={() => restart()} />
      )}
    </>
  )
}

/** Stand-in for the Results screen (owned by feature/results): just proves the handoff works. */
function Done({ comparison, onEdit, onHome }: { comparison: Comparison; onEdit: () => void; onHome: () => void }) {
  const result = scoreComparison(comparison)
  const nameOf = (id: string) => comparison.options.find((option) => option.id === id)?.name ?? id
  return (
    <main className="shell" style={{ paddingTop: 32 }}>
      <p className="eyebrow">Handoff received (Results is another feature)</p>
      <h1 style={{ fontSize: '2rem' }}>{comparison.title}</h1>
      <ol data-testid="ranking">
        {result.ranked.map((item) => (
          <li key={item.optionId}>
            {nameOf(item.optionId)}: {item.score.toFixed(2)} / 10 {item.rank === 1 && result.winner ? '🏆' : ''}
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={barButton} onClick={onEdit}>Edit this comparison</button>
        <button type="button" style={barButton} onClick={onHome}>Back to flow home</button>
      </div>
      <details style={{ marginTop: 24 }}>
        <summary>Saved record</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(comparison, null, 2)}</pre>
      </details>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>)
