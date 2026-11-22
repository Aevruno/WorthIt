import { useEffect, useRef, type ReactNode } from 'react'

export const ACCENTS = ['blue', 'violet', 'pink', 'coral', 'aqua'] as const
export type Accent = (typeof ACCENTS)[number]

export function accentFor(index: number): Accent {
  return ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]
}

/** Colored initial badge used for options (stands in for an emoji/icon field the shared type doesn't have). */
export function OptionBadge({ name, index, size = 'md' }: { name: string; index: number; size?: 'sm' | 'md' }) {
  const initial = name.trim().charAt(0).toUpperCase() || String(index + 1)
  return (
    <span className={`wi-badge wi-badge--${accentFor(index)} wi-badge--${size}`} aria-hidden="true">
      {initial}
    </span>
  )
}

interface StepHeaderProps {
  step: number
  totalSteps: number
  title: string
  subtitle?: ReactNode
  onBack: () => void
  backLabel: string
}

/** Header for each flow step. Moves focus to the heading when the step appears, for keyboard and screen reader users. */
export function StepHeader({ step, totalSteps, title, subtitle, onBack, backLabel }: StepHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <header className="wi-step-header">
      <div className="wi-step-header__bar">
        <button type="button" className="wi-btn wi-btn--ghost wi-btn--icon" onClick={onBack} aria-label={backLabel}>
          <span aria-hidden="true">←</span>
        </button>
        <div
          className="wi-steps"
          role="progressbar"
          aria-label="Comparison setup progress"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          aria-valuetext={`Step ${step} of ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }, (_, index) => (
            <span key={index} className={`wi-steps__dot${index < step ? ' is-done' : ''}`} />
          ))}
        </div>
        <span className="wi-step-header__count">
          Step {step} of {totalSteps}
        </span>
      </div>
      <h1 className="wi-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h1>
      {subtitle && <p className="wi-lede">{subtitle}</p>}
    </header>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p className="wi-field-error" id={id}>
      {message}
    </p>
  )
}
