import { useEffect, useRef, useState } from 'react'
import {
  IMPORTANCE_LABELS,
  MAX_SCORE,
  MIN_SCORE,
  firstIncompleteCriterion,
  formatPrice,
  getScore,
  importanceLevel,
  isCriterionComplete,
  parsePrice,
  scoreProgress,
  setScore,
  type ComparisonDraft,
} from './comparisonDraft'
import { OptionBadge, StepHeader } from './ui'

interface ScoreScreenProps {
  draft: ComparisonDraft
  onChange: (draft: ComparisonDraft) => void
  onBack: () => void
  onFinish: () => void
  finishError?: string
  onFinishAnyway?: () => void
}

const SCORE_VALUES = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, index) => MIN_SCORE + index)

export function ScoreScreen({ draft, onChange, onBack, onFinish, finishError, onFinishAnyway }: ScoreScreenProps) {
  const [index, setIndex] = useState(() => Math.max(0, firstIncompleteCriterion(draft)))
  const cardHeadingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const progress = scoreProgress(draft)
  const safeIndex = Math.min(index, Math.max(0, draft.criteria.length - 1))
  const criterion = draft.criteria[safeIndex]
  const isLast = safeIndex === draft.criteria.length - 1

  // Move focus to the criterion heading when switching cards (not on first render; StepHeader handles that).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    cardHeadingRef.current?.focus()
  }, [safeIndex])

  if (!criterion || draft.options.length === 0) {
    return (
      <div className="wi-screen">
        <StepHeader step={3} totalSteps={3} title="Score each option" onBack={onBack} backLabel="Back to priorities" />
        <div className="wi-empty">
          <p>You need at least one criterion and two options before scoring.</p>
          <button type="button" className="wi-btn wi-btn--secondary" onClick={onBack}>Go back</button>
        </div>
      </div>
    )
  }

  const level = importanceLevel(criterion.importance)
  const criterionDone = isCriterionComplete(draft, criterion.id)
  const nextIncomplete = firstIncompleteCriterion(draft)

  return (
    <div className="wi-screen wi-score">
      <StepHeader
        step={3}
        totalSteps={3}
        title="Score each option"
        subtitle="Rate how well each option does on each thing, from 0 to 10. 10 means best for you, even for price."
        onBack={onBack}
        backLabel="Back to priorities"
      />

      <div className="wi-score-progress">
        <p className="wi-score-progress__text" aria-live="polite">
          <strong>{progress.completedCriteria}</strong> of {progress.totalCriteria} criteria completed
        </p>
        <div className="wi-score-progress__track" aria-hidden="true">
          <span
            className="wi-score-progress__fill"
            style={{ width: `${(progress.completedCriteria / progress.totalCriteria) * 100}%` }}
          />
        </div>
        <nav aria-label="Criteria" className="wi-criterion-tabs">
          {draft.criteria.map((item, itemIndex) => {
            const done = isCriterionComplete(draft, item.id)
            return (
              <button
                key={item.id}
                type="button"
                className={`wi-criterion-tab${itemIndex === safeIndex ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                aria-current={itemIndex === safeIndex ? 'step' : undefined}
                onClick={() => setIndex(itemIndex)}
              >
                {done && <span aria-hidden="true">✓ </span>}
                {item.name}
                <span className="wi-visually-hidden">{done ? ' (done)' : ' (not scored yet)'}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <section key={criterion.id} className={`wi-card wi-score-card wi-level--${level}`} aria-labelledby="wi-score-card-title">
        <div className="wi-score-card__head">
          <p className="wi-score-card__count">
            Criterion {safeIndex + 1} of {draft.criteria.length}
          </p>
          <h2 id="wi-score-card-title" className="wi-score-card__title" tabIndex={-1} ref={cardHeadingRef}>
            {criterion.name}
          </h2>
          <span className="wi-importance-tag">
            {IMPORTANCE_LABELS[level]} · {criterion.importance}/10
          </span>
          {!criterion.higherIsBetter && (
            <p className="wi-direction-note">
              <strong>Lower is better here.</strong> This comparison was saved that way, so 0 is the best score for{' '}
              {criterion.name}.
            </p>
          )}
        </div>

        <div className="wi-score-options">
          {draft.options.map((option, optionIndex) => {
            const value = getScore(draft, option.id, criterion.id)
            const price = parsePrice(option.price)
            const detail = [option.subtitle.trim(), price.ok && price.value !== undefined ? formatPrice(price.value) : '']
              .filter(Boolean)
              .join(' · ')
            return (
              <fieldset key={option.id} className={`wi-score-option${value === undefined ? ' is-missing' : ''}`}>
                <legend className="wi-score-option__legend">
                  <OptionBadge name={option.name} index={optionIndex} size="sm" />
                  <span className="wi-score-option__name">{option.name.trim()}</span>
                  <span className="wi-visually-hidden">score for {criterion.name}</span>
                  <span className="wi-score-option__value" aria-hidden="true">
                    {value === undefined ? '– / 10' : `${value} / 10`}
                  </span>
                </legend>
                {detail && <p className="wi-score-option__detail">{detail}</p>}
                <div className="wi-score-scale">
                  {SCORE_VALUES.map((score) => (
                    <label key={score} className={`wi-score-chip${value === score ? ' is-selected' : ''}`}>
                      <input
                        type="radio"
                        className="wi-visually-hidden"
                        name={`wi-score-${criterion.id}-${option.id}`}
                        value={score}
                        checked={value === score}
                        onChange={() => onChange(setScore(draft, option.id, criterion.id, score))}
                      />
                      <span>{score}</span>
                    </label>
                  ))}
                </div>
                <div className="wi-score-scale__ends" aria-hidden="true">
                  <span>{criterion.higherIsBetter ? 'Poor' : 'Best'}</span>
                  <span>{criterion.higherIsBetter ? 'Great' : 'Worst'}</span>
                </div>
              </fieldset>
            )
          })}
        </div>

        <div className="wi-score-card__nav">
          <button
            type="button"
            className="wi-btn wi-btn--ghost"
            onClick={() => setIndex(safeIndex - 1)}
            disabled={safeIndex === 0}
          >
            <span aria-hidden="true">←</span> Previous
          </button>
          {!isLast && (
            <button
              type="button"
              className={`wi-btn ${criterionDone ? 'wi-btn--secondary' : 'wi-btn--ghost'}`}
              onClick={() => setIndex(safeIndex + 1)}
            >
              Next criterion <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </section>

      <div className="wi-action-bar">
        <div className="wi-action-bar__inner">
          {progress.complete ? (
            <p className="wi-action-bar__status" aria-live="polite">All scored. Ready when you are!</p>
          ) : (
            <p className="wi-action-bar__status" aria-live="polite">
              {progress.missingScores} score{progress.missingScores === 1 ? '' : 's'} still missing
              {nextIncomplete >= 0 && nextIncomplete !== safeIndex && (
                <>
                  {' · '}
                  <button type="button" className="wi-link" onClick={() => setIndex(nextIncomplete)}>
                    Go to {draft.criteria[nextIncomplete].name}
                  </button>
                </>
              )}
            </p>
          )}
          {finishError && (
            <div className="wi-field-error" role="alert">
              <p>{finishError}</p>
              {onFinishAnyway && (
                <button type="button" className="wi-link" onClick={onFinishAnyway}>
                  See results without saving
                </button>
              )}
            </div>
          )}
          <button type="button" className="wi-btn wi-btn--primary wi-btn--winner" onClick={onFinish} disabled={!progress.complete}>
            <span aria-hidden="true">🏆</span> See My Winner
          </button>
        </div>
      </div>
    </div>
  )
}
