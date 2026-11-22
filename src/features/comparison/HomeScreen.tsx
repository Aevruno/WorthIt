import type { Comparison } from '../../types'
import { CATEGORIES, type CategoryLabel } from './comparisonDraft'
import type { RecentLoad } from './comparisonStorage'
import { accentFor } from './ui'

interface HomeScreenProps {
  recent: RecentLoad
  onStart: (category?: CategoryLabel) => void
  onViewRecent: (comparison: Comparison) => void
  onEditRecent: (comparison: Comparison) => void
  /** Present when an unfinished comparison exists in this session. */
  draftTitle?: string
  draftIsEdit?: boolean
  onResume?: () => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export function HomeScreen({
  recent,
  onStart,
  onViewRecent,
  onEditRecent,
  draftTitle,
  draftIsEdit,
  onResume,
}: HomeScreenProps) {
  return (
    <div className="wi-screen wi-home">
      {onResume && (
        <div className="wi-resume" role="status">
          <p>
            <span aria-hidden="true">✏️ </span>
            {draftIsEdit ? 'Unsaved edits' : 'Unfinished'}: {draftTitle?.trim() || 'your comparison'}
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
        <RecentList recent={recent} onView={onViewRecent} onEdit={onEditRecent} />
      </section>
    </div>
  )
}

interface RecentListProps {
  recent: RecentLoad
  onView: (comparison: Comparison) => void
  onEdit: (comparison: Comparison) => void
}

function RecentList({ recent, onView, onEdit }: RecentListProps) {
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
        const titleId = `wi-recent-${comparison.id}`
        return (
          <li key={comparison.id} className="wi-recent">
            <span className="wi-recent__title" id={titleId}>{comparison.title}</span>
            <span className="wi-recent__meta">
              {comparison.category} · {comparison.options.length} options · {formatDate(comparison.updatedAt)}
              {!viewable && <> · <strong>needs scores</strong></>}
            </span>
            <span className="wi-recent__actions">
              <button
                type="button"
                className="wi-btn wi-btn--ghost wi-btn--sm"
                onClick={() => onEdit(comparison)}
                aria-describedby={titleId}
              >
                {viewable ? 'Edit' : 'Finish it'}
              </button>
              {viewable && (
                <button
                  type="button"
                  className="wi-btn wi-btn--secondary wi-btn--sm"
                  onClick={() => onView(comparison)}
                  aria-describedby={titleId}
                >
                  See result
                </button>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
