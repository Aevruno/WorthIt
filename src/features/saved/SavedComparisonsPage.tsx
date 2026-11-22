import { useEffect, useState } from 'react'
import type { Comparison } from '../../types'
import { createComparisonStorage } from '../../lib/storage'
import { createResultCard, shareResultCard } from '../../lib/share'
import styles from './SavedComparisonsPage.module.css'

export interface SavedComparisonsPageProps {
  /** Caller owns navigation to the comparison flow. */
  onOpen: (comparison: Comparison) => void
}

export function SavedComparisonsPage({ onOpen }: SavedComparisonsPageProps) {
  const [items, setItems] = useState<Comparison[]>([])
  const [message, setMessage] = useState('')
  const [manualShareText, setManualShareText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const repository = () => createComparisonStorage(window.localStorage)

  function refresh() {
    try {
      setItems(repository().getSavedComparisons())
      setLoaded(true)
      setMessage('')
    } catch {
      setLoaded(true)
      setMessage('Saved comparisons could not be read on this device.')
    }
  }

  // Re-read on mount so changes made in the comparison flow appear on return.
  useEffect(() => { refresh() }, [])

  function act(action: () => void) {
    try {
      action()
      refresh()
    } catch {
      setMessage('The change could not be saved on this device. Check browser storage settings or free space.')
    }
  }

  async function share(comparison: Comparison) {
    const card = createResultCard(comparison)
    if (!card) return
    const result = await shareResultCard(card)
    if (result === 'manual') {
      setManualShareText(card.text)
      setMessage('Copy the result text below to share it.')
    } else {
      setManualShareText('')
      setMessage(result === 'copied' ? 'Result copied to clipboard.' : 'Result shared.')
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Your decisions</p>
          <h1>Saved comparisons</h1>
          <p>Saved on this device.</p>
        </div>
        {items.length > 0 && <button className={styles.danger} onClick={() => {
          if (window.confirm('Delete all saved comparisons on this device? This cannot be undone.')) {
            act(() => repository().clearSavedComparisons())
          }
        }}>Clear all</button>}
      </div>
      {message && <p role="status" className={styles.message}>{message}</p>}
      {manualShareText && <textarea aria-label="Result text to copy" readOnly value={manualShareText} className={styles.shareText} onFocus={(event) => event.currentTarget.select()} />}
      {loaded && items.length === 0 && <div className={styles.empty}><h2>Your comparisons will show up here.</h2><p>Create a comparison to save your decisions for later.</p></div>}
      <div className={styles.list}>
        {items.map((comparison) => {
          const card = createResultCard(comparison)
          return <article key={comparison.id} className={styles.card}>
            <div className={styles.cardMain}>
              <p className={styles.category}>{comparison.category || 'Uncategorized'}</p>
              <h2>{comparison.title}</h2>
              <p className={styles.meta}>Edited {new Date(comparison.updatedAt).toLocaleDateString()} · {comparison.options.length} options</p>
              <p className={styles.winner}>{card ? `Winner: ${card.winnerName} · ${card.score.toFixed(1)} / 10` : 'Winner pending'}</p>
            </div>
            <div className={styles.actions}>
              <button onClick={() => onOpen(comparison)}>Open</button>
              <button onClick={() => act(() => { repository().duplicateComparison(comparison.id) })}>Duplicate</button>
              <button onClick={() => {
                const title = window.prompt('Rename comparison', comparison.title)
                if (title !== null) act(() => { repository().renameComparison(comparison.id, title) })
              }}>Rename</button>
              {card && <button onClick={() => { void share(comparison) }}>Share result</button>}
              <button className={styles.danger} onClick={() => {
                if (window.confirm(`Delete “${comparison.title}”? This cannot be undone.`)) {
                  act(() => { repository().deleteComparison(comparison.id) })
                }
              }}>Delete</button>
            </div>
          </article>
        })}
      </div>
    </main>
  )
}
