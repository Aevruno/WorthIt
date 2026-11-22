import type { Comparison } from '../../types'
import { CATEGORIES, type CategoryLabel } from './comparisonDraft'
import type { RecentLoad } from './comparisonStorage'
import { accentFor } from './ui'

interface HomeScreenProps {
  recent: RecentLoad
  onStart: (category?: CategoryLabel) => void
  onOpenRecent: (comparison: Comparison) => void
  /** Present when an unfinished comparison exists in this session. */
  draftTitle?: string
  onResume?: () => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export function HomeScreen({ recent, onStart, onOpenRecent, draftTitle, onResume }: HomeScreenProps) {
  return (
    <div className="wi-screen wi-home">
      {onResume && (
        <div className="wi-resume" role="status">
          <p>
            <span aria-hidden="true">✏️ </span>
            Unfinished: {draftTitle?.trim() || 'your comparison'}
          </p>
          <button type="button" className="wi-btn wi-btn--secondary" onClick={onResume}>
            Continue
          </button>
        </div>
      )}
      <section className="wi-hero" aria-labelledby="wi-home-title">
        <p className="wi-brand">
          <span className="wi-brand__mark" aria-hidden="true">W</span>
          WorthIt
        </p>
        <h1 id="wi-home-title" className="wi-hero__title">
          What are you <span className="wi-gradient-text">comparing</span> today?
        </h1>
        <p className="wi-hero__lede">
          Pick what matters to you, score your options, and see which one actually fits.
        </p>
        <button type="button" className="wi-btn wi-btn--primary wi-btn--xl" onClick={() => onStart()}>
          Start a comparison
          <span aria-hidden="true" className="wi-btn__arrow">→</span>
        </button>
      </section>

      <section className="wi-section" aria-labelledby="wi-categories-title">
        <h2 id="wi-categories-title" className="wi-section__title">Jump in by category</h2>
        <ul className="wi-category-grid">
          {CATEGORIES.map((category, index) => (
            <li key={category.label}>
              <button
                type="button"
                className={`wi-category wi-category--${accentFor(index)}`}
                onClick={() => onStart(category.label)}
              >
                <span className="wi-category__emoji" aria-hidden="true">{category.emoji}</span>
                <span className="wi-category__label">{category.label}</span>
                <span className="wi-category__hint">{category.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="wi-section" aria-labelledby="wi-recent-title">
        <h2 id="wi-recent-title" className="wi-section__title">Recent comparisons</h2>
        <RecentList recent={recent} onOpen={onOpenRecent} />
      </section>
    </div>
  )
}

function RecentList({ recent, onOpen }: { recent: RecentLoad; onOpen: (comparison: Comparison) => void }) {
  if (recent.status === 'unavailable') {
    return (
      <p className="wi-empty">
        Saved comparisons aren’t available in this browser (storage is blocked or turned off). You can still
        compare. It just won’t be kept on this device.
      </p>
    )
  }
  if (recent.items.length === 0) {
    return (
      <div className="wi-empty">
        <span className="wi-empty__emoji" aria-hidden="true">🗂️</span>
        <p>No comparisons yet. The ones you finish are saved here, on this device only.</p>
      </div>
    )
  }
  return (
    <ul className="wi-recent-list">
      {recent.items.map(({ comparison, viewable }) => {
        const meta = `${comparison.category} · ${comparison.options.length} options · ${formatDate(comparison.updatedAt)}`
        return (
          <li key={comparison.id}>
            {viewable ? (
              <button type="button" className="wi-recent" onClick={() => onOpen(comparison)}>
                <span className="wi-recent__title">{comparison.title}</span>
                <span className="wi-recent__meta">{meta}</span>
                <span className="wi-recent__cta" aria-hidden="true">See result →</span>
              </button>
            ) : (
              <div className="wi-recent is-disabled">
                <span className="wi-recent__title">{comparison.title}</span>
                <span className="wi-recent__meta">{meta}</span>
                <span className="wi-recent__cta">Incomplete, can’t show a result</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
