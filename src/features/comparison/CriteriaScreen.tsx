import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  IMPORTANCE_LABELS,
  MAX_CRITERIA,
  MAX_IMPORTANCE,
  MAX_NAME_LENGTH,
  MIN_IMPORTANCE,
  SUGGESTED_CRITERIA,
  addCriterion,
  createId,
  importanceLevel,
  importanceShare,
  normalizeName,
  removeCriterion,
  setImportance,
  validateCriteria,
  validateNewCriterionName,
  type ComparisonDraft,
  type DraftCriterion,
} from './comparisonDraft'
import { FieldError, StepHeader } from './ui'

interface CriteriaScreenProps {
  draft: ComparisonDraft
  onChange: (draft: ComparisonDraft) => void
  onBack: () => void
  onContinue: () => void
}

export function CriteriaScreen({ draft, onChange, onBack, onContinue }: CriteriaScreenProps) {
  const [custom, setCustom] = useState('')
  const [customError, setCustomError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const listError = validateCriteria(draft.criteria)
  const atMax = draft.criteria.length >= MAX_CRITERIA
  const selectedByName = new Map(draft.criteria.map((criterion) => [normalizeName(criterion.name), criterion]))

  function toggleSuggestion(name: string) {
    const existing = selectedByName.get(normalizeName(name))
    if (existing) onChange(removeCriterion(draft, existing.id))
    else if (!atMax) onChange(addCriterion(draft, name, createId()))
  }

  function handleAddCustom(event: FormEvent) {
    event.preventDefault()
    const error = validateNewCriterionName(custom, draft.criteria)
    setCustomError(error)
    if (error) return
    onChange(addCriterion(draft, custom, createId()))
    setCustom('')
  }

  function handleContinue() {
    setSubmitted(true)
    if (!listError) onContinue()
  }

  return (
    <div className="wi-screen wi-criteria">
      <StepHeader
        step={2}
        totalSteps={3}
        title="What matters most to you?"
        subtitle={
          <>
            Pick what you care about for <strong>{draft.title.trim() || 'this comparison'}</strong>, then set how
            much each one counts.
          </>
        }
        onBack={onBack}
        backLabel="Back to options"
      />

      <section className="wi-card" aria-labelledby="wi-suggest-title">
        <h2 id="wi-suggest-title" className="wi-section__title wi-section__title--sm">
          Popular for {draft.category}
        </h2>
        <div className="wi-chip-row">
          {SUGGESTED_CRITERIA[draft.category].map((name) => {
            const selected = selectedByName.has(normalizeName(name))
            return (
              <button
                key={name}
                type="button"
                className={`wi-chip wi-chip--toggle${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                disabled={!selected && atMax}
                onClick={() => toggleSuggestion(name)}
              >
                <span aria-hidden="true">{selected ? '✓' : '＋'}</span> {name}
              </button>
            )
          })}
        </div>

        <form className="wi-custom" onSubmit={handleAddCustom} noValidate>
          <label className="wi-label" htmlFor="wi-custom-criterion">Add your own</label>
          <div className="wi-custom__row">
            <input
              id="wi-custom-criterion"
              className="wi-input"
              value={custom}
              maxLength={MAX_NAME_LENGTH + 10}
              placeholder="e.g. Warranty, Screen size, Vibes"
              onChange={(event) => {
                setCustom(event.target.value)
                if (customError) setCustomError(undefined)
              }}
              aria-invalid={!!customError}
              aria-describedby={customError ? 'wi-custom-error' : undefined}
              autoComplete="off"
            />
            <button type="submit" className="wi-btn wi-btn--secondary">Add</button>
          </div>
          <FieldError id="wi-custom-error" message={customError} />
        </form>
      </section>

      <section aria-labelledby="wi-selected-title">
        <div className="wi-section__head">
          <h2 id="wi-selected-title" className="wi-section__title">Your priorities</h2>
          <span className="wi-pill" aria-live="polite">
            {draft.criteria.length} of {MAX_CRITERIA}
          </span>
        </div>

        {draft.criteria.length === 0 ? (
          <div className="wi-empty">
            <span className="wi-empty__emoji" aria-hidden="true">🎯</span>
            <p>Nothing picked yet. Tap a suggestion above or add your own.</p>
          </div>
        ) : (
          <ul className="wi-criteria-list">
            {draft.criteria.map((criterion) => (
              <CriterionCard
                key={criterion.id}
                criterion={criterion}
                share={importanceShare(criterion, draft.criteria)}
                onImportance={(value) => onChange(setImportance(draft, criterion.id, value))}
                onRemove={() => onChange(removeCriterion(draft, criterion.id))}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="wi-action-bar">
        <div className="wi-action-bar__inner">
          <p className="wi-action-bar__status" aria-live="polite">
            {draft.criteria.length === 0
              ? 'Pick at least one thing that matters'
              : `${draft.criteria.length} ${draft.criteria.length === 1 ? 'thing matters' : 'things matter'} to you`}
          </p>
          {submitted && listError && <p className="wi-field-error" role="alert">{listError}</p>}
          <button
            type="button"
            className={`wi-btn wi-btn--primary${listError ? ' is-blocked' : ''}`}
            onClick={handleContinue}
          >
            Next: score options <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface CriterionCardProps {
  criterion: DraftCriterion
  share: number
  onImportance: (value: number) => void
  onRemove: () => void
}

function CriterionCard({ criterion, share, onImportance, onRemove }: CriterionCardProps) {
  const level = importanceLevel(criterion.importance)
  const sliderId = `wi-importance-${criterion.id}`
  const fill = ((criterion.importance - MIN_IMPORTANCE) / (MAX_IMPORTANCE - MIN_IMPORTANCE)) * 100

  return (
    <li className={`wi-card wi-criterion wi-level--${level}`}>
      <div className="wi-criterion__head">
        <h3 className="wi-criterion__name">{criterion.name}</h3>
        <button
          type="button"
          className="wi-btn wi-btn--ghost wi-btn--icon"
          onClick={onRemove}
          aria-label={`Remove ${criterion.name}`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="wi-importance">
        <span className="wi-importance__value" aria-hidden="true">{criterion.importance}</span>
        <div className="wi-importance__text">
          <span className="wi-importance__label">{IMPORTANCE_LABELS[level]}</span>
          <span className="wi-importance__share">{share}% of your decision</span>
        </div>
      </div>

      <label className="wi-visually-hidden" htmlFor={sliderId}>
        How important is {criterion.name}?
      </label>
      <input
        id={sliderId}
        type="range"
        className="wi-slider"
        min={MIN_IMPORTANCE}
        max={MAX_IMPORTANCE}
        step={1}
        value={criterion.importance}
        onChange={(event) => onImportance(Number(event.target.value))}
        aria-valuetext={`${criterion.importance} out of ${MAX_IMPORTANCE}, ${IMPORTANCE_LABELS[level]}`}
        style={{ '--wi-fill': `${fill}%` } as CSSProperties}
      />
      <div className="wi-slider__scale" aria-hidden="true">
        <span>Meh</span>
        <span>Dealbreaker</span>
      </div>
    </li>
  )
}
