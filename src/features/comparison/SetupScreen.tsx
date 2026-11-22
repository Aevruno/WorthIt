import { useRef, useState } from 'react'
import {
  CATEGORIES,
  MAX_NAME_LENGTH,
  MAX_OPTIONS,
  MAX_SUBTITLE_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_OPTIONS,
  addOption,
  createId,
  removeOption,
  updateOption,
  validateSetup,
  type ComparisonDraft,
  type DraftOption,
  type OptionErrors,
} from './comparisonDraft'
import { FieldError, OptionBadge, StepHeader, accentFor } from './ui'

interface SetupScreenProps {
  draft: ComparisonDraft
  mode: 'create' | 'edit'
  /** Notes from loading a saved comparison (see `draftFromComparison`). */
  adjustments: string[]
  onChange: (draft: ComparisonDraft) => void
  onBack: () => void
  backLabel: string
  onContinue: () => void
}

const TITLE_PLACEHOLDERS: Record<string, string> = {
  Tech: 'Which laptop should I buy?',
  Gaming: 'Which console should I get?',
  Cars: 'Which car fits my life?',
  Travel: 'Where should we go this summer?',
  Other: 'Which one should I pick?',
}

export function SetupScreen({ draft, mode, adjustments, onChange, onBack, backLabel, onContinue }: SetupScreenProps) {
  // When editing a saved comparison, show any existing problems right away.
  const [submitted, setSubmitted] = useState(mode === 'edit')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const listRef = useRef<HTMLOListElement>(null)
  const validation = validateSetup(draft)
  const canAdd = draft.options.length < MAX_OPTIONS
  const remainingToMin = Math.max(0, MIN_OPTIONS - draft.options.length)

  const show = (key: string) => submitted || touched[key]
  const touch = (key: string) => setTouched((current) => (current[key] ? current : { ...current, [key]: true }))

  function handleAdd() {
    const id = createId()
    onChange(addOption(draft, id))
    // Focus the new option's name field once it renders.
    requestAnimationFrame(() => document.getElementById(`wi-option-name-${id}`)?.focus())
  }

  function handleRemove(option: DraftOption, index: number) {
    onChange(removeOption(draft, option.id))
    requestAnimationFrame(() => {
      const fields = listRef.current?.querySelectorAll<HTMLInputElement>('input[data-option-name]')
      if (fields && fields.length > 0) fields[Math.min(index, fields.length - 1)].focus()
      else document.getElementById('wi-add-option')?.focus()
    })
  }

  function handleContinue() {
    setSubmitted(true)
    if (validation.valid) {
      onContinue()
      return
    }
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.wi-setup [aria-invalid="true"]')?.focus())
  }

  return (
    <div className="wi-screen wi-setup">
      <StepHeader
        step={1}
        totalSteps={3}
        title={mode === 'edit' ? 'Edit comparison' : 'Start a comparison'}
        subtitle={
          mode === 'edit'
            ? 'Change anything you like. Your existing priorities and scores are kept.'
            : 'Name it, pick a category, and add the options you’re deciding between.'
        }
        onBack={onBack}
        backLabel={backLabel}
      />

      {adjustments.length > 0 && (
        <div className="wi-notice" role="note">
          <p className="wi-notice__title">A few things were adjusted to fit this editor:</p>
          <ul>
            {adjustments.map((note) => <li key={note}>{note}</li>)}
          </ul>
          <p>Nothing is saved until you finish.</p>
        </div>
      )}

      <section className="wi-card">
        <label className="wi-label" htmlFor="wi-title">Comparison title</label>
        <input
          id="wi-title"
          className="wi-input wi-input--lg"
          value={draft.title}
          maxLength={MAX_TITLE_LENGTH + 20}
          placeholder={TITLE_PLACEHOLDERS[draft.category]}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          onBlur={() => touch('title')}
          aria-invalid={show('title') && !!validation.title}
          aria-describedby={show('title') && validation.title ? 'wi-title-error' : undefined}
          autoComplete="off"
        />
        <FieldError id="wi-title-error" message={show('title') ? validation.title : undefined} />

        <fieldset className="wi-fieldset">
          <legend className="wi-label">Category</legend>
          <div className="wi-chip-row">
            {CATEGORIES.map((category, index) => (
              <label key={category.label} className={`wi-chip wi-chip--${accentFor(index)}`}>
                <input
                  type="radio"
                  name="wi-category"
                  className="wi-visually-hidden"
                  checked={draft.category === category.label}
                  onChange={() => onChange({ ...draft, category: category.label })}
                />
                <span aria-hidden="true">{category.emoji}</span> {category.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="wi-options-title">
        <div className="wi-section__head">
          <h2 id="wi-options-title" className="wi-section__title">Your options</h2>
          <span className="wi-pill" aria-live="polite">
            {draft.options.length} of {MAX_OPTIONS}
          </span>
        </div>

        {draft.options.length === 0 ? (
          <div className="wi-empty">
            <span className="wi-empty__emoji" aria-hidden="true">🤔</span>
            <p>No options yet. Add the things you’re choosing between.</p>
          </div>
        ) : (
          <ol className="wi-option-list" ref={listRef}>
            {draft.options.map((option, index) => (
              <OptionEditor
                key={option.id}
                option={option}
                index={index}
                errors={validation.perOption[option.id]}
                showErrors={(field) => show(`${option.id}:${field}`) || (field === 'name' && isDuplicateError(validation.perOption[option.id]))}
                onTouch={(field) => touch(`${option.id}:${field}`)}
                onChange={(patch) => onChange(updateOption(draft, option.id, patch))}
                onRemove={() => handleRemove(option, index)}
              />
            ))}
          </ol>
        )}

        {canAdd ? (
          <button type="button" id="wi-add-option" className="wi-btn wi-btn--dashed wi-btn--block" onClick={handleAdd}>
            <span aria-hidden="true">＋</span> Add an option
          </button>
        ) : (
          <p className="wi-hint" id="wi-add-option" tabIndex={-1}>
            That’s the max. You can compare up to {MAX_OPTIONS} options at once.
          </p>
        )}
      </section>

      <div className="wi-action-bar">
        <div className="wi-action-bar__inner">
          <p className="wi-action-bar__status" aria-live="polite">
            {remainingToMin > 0
              ? `Add ${remainingToMin} more option${remainingToMin === 1 ? '' : 's'} to continue`
              : submitted && !validation.valid
                ? 'Fix the highlighted fields to continue'
                : `${draft.options.length} options ready`}
          </p>
          {submitted && validation.options && (
            <p className="wi-field-error" role="alert">{validation.options}</p>
          )}
          <button
            type="button"
            className={`wi-btn wi-btn--primary${remainingToMin > 0 ? ' is-blocked' : ''}`}
            onClick={handleContinue}
          >
            Next: what matters <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function isDuplicateError(errors: OptionErrors | undefined): boolean {
  return !!errors?.name?.startsWith('You already have')
}

interface OptionEditorProps {
  option: DraftOption
  index: number
  errors?: OptionErrors
  showErrors: (field: keyof OptionErrors) => boolean
  onTouch: (field: keyof OptionErrors) => void
  onChange: (patch: Partial<Omit<DraftOption, 'id'>>) => void
  onRemove: () => void
}

function OptionEditor({ option, index, errors, showErrors, onTouch, onChange, onRemove }: OptionEditorProps) {
  const nameId = `wi-option-name-${option.id}`
  const priceId = `wi-option-price-${option.id}`
  const subtitleId = `wi-option-subtitle-${option.id}`
  const label = option.name.trim() || `Option ${index + 1}`
  const nameError = showErrors('name') ? errors?.name : undefined
  const priceError = showErrors('price') ? errors?.price : undefined
  const subtitleError = showErrors('subtitle') ? errors?.subtitle : undefined

  return (
    <li className={`wi-card wi-option wi-option--${accentFor(index)}`}>
      <div className="wi-option__head">
        <OptionBadge name={option.name} index={index} />
        <span className="wi-option__number">Option {index + 1}</span>
        <button
          type="button"
          className="wi-btn wi-btn--ghost wi-btn--icon wi-option__remove"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <label className="wi-label" htmlFor={nameId}>Name</label>
      <input
        id={nameId}
        data-option-name
        className="wi-input"
        value={option.name}
        maxLength={MAX_NAME_LENGTH + 10}
        placeholder={index === 0 ? 'e.g. MacBook Air' : index === 1 ? 'e.g. ASUS Zenbook' : 'Name'}
        onChange={(event) => onChange({ name: event.target.value })}
        onBlur={() => onTouch('name')}
        aria-invalid={!!nameError}
        aria-describedby={nameError ? `${nameId}-error` : undefined}
        autoComplete="off"
      />
      <FieldError id={`${nameId}-error`} message={nameError} />

      <div className="wi-option__row">
        <div className="wi-option__field">
          <label className="wi-label" htmlFor={priceId}>
            Price <span className="wi-optional">optional</span>
          </label>
          <div className="wi-input-prefix">
            <span aria-hidden="true">$</span>
            <input
              id={priceId}
              className="wi-input"
              value={option.price}
              inputMode="decimal"
              placeholder="0"
              onChange={(event) => onChange({ price: event.target.value })}
              onBlur={() => onTouch('price')}
              aria-invalid={!!priceError}
              aria-describedby={priceError ? `${priceId}-error` : undefined}
              autoComplete="off"
            />
          </div>
          <FieldError id={`${priceId}-error`} message={priceError} />
        </div>
        <div className="wi-option__field wi-option__field--grow">
          <label className="wi-label" htmlFor={subtitleId}>
            Note <span className="wi-optional">optional</span>
          </label>
          <input
            id={subtitleId}
            className="wi-input"
            value={option.subtitle}
            maxLength={MAX_SUBTITLE_LENGTH + 10}
            placeholder="e.g. 13-inch, 16GB"
            onChange={(event) => onChange({ subtitle: event.target.value })}
            onBlur={() => onTouch('subtitle')}
            aria-invalid={!!subtitleError}
            aria-describedby={subtitleError ? `${subtitleId}-error` : undefined}
            autoComplete="off"
          />
          <FieldError id={`${subtitleId}-error`} message={subtitleError} />
        </div>
      </div>
    </li>
  )
}
