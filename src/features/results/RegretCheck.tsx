import { useId, useRef, useState } from 'react'

type Feeling = 'confident' | 'unsure' | 'doubtful'

interface Question {
  id: string
  prompt: string
  answers: Array<{ label: string; feeling: Feeling }>
  /** Shown after answering, per feeling. */
  responses: Record<Feeling, string>
}

export interface RegretCheckProps {
  winnerName: string
  runnerUpName: string
  winnerPrice?: number
  /** A priority where another option beat the winner. */
  tradeoff?: { criterionName: string; betterOptionName: string }
  /** The winner's biggest contributor. */
  winnerStrength?: string
  /** Formats prices; defaults to a plain localized whole number. */
  formatPrice?: (price: number) => string
}

const defaultPriceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const defaultFormatPrice = (price: number) => defaultPriceFormat.format(price)

function buildQuestions({ winnerName, runnerUpName, winnerPrice, tradeoff, winnerStrength, formatPrice }: RegretCheckProps): Question[] {
  const format = formatPrice ?? defaultFormatPrice
  const questions: Question[] = []
  questions.push(winnerPrice !== undefined && winnerPrice > 0
    ? {
        id: 'price',
        prompt: `Would you still choose ${winnerName} if it cost 10% more (about ${format(winnerPrice * 1.1)} instead of ${format(winnerPrice)})?`,
        answers: [
          { label: 'Yes, still worth it', feeling: 'confident' },
          { label: 'Maybe', feeling: 'unsure' },
          { label: 'Probably not', feeling: 'doubtful' },
        ],
        responses: {
          confident: 'You value it beyond its price tag. That’s a strong signal.',
          unsure: 'Price is doing some of the work here. Make sure the winner’s strengths are ones you’ll actually use.',
          doubtful: `Price matters more than your scores might show. Take another look at ${runnerUpName}, or give price more importance.`,
        },
      }
    : {
        id: 'future',
        prompt: `Picture yourself three months from now. Would you still be glad you chose ${winnerName}?`,
        answers: [
          { label: 'Yes, definitely', feeling: 'confident' },
          { label: 'Maybe', feeling: 'unsure' },
          { label: 'Probably not', feeling: 'doubtful' },
        ],
        responses: {
          confident: 'Your gut agrees with your scores. That’s a good sign.',
          unsure: 'Some hesitation is normal. Is there a priority you left out?',
          doubtful: 'Your gut is pushing back. A priority might be missing or weighted too low.',
        },
      })

  if (tradeoff) {
    const gain = winnerStrength && winnerStrength !== tradeoff.criterionName ? `${winnerName}’s ${winnerStrength}` : winnerName
    questions.push({
      id: 'tradeoff',
      prompt: `Would you regret giving up ${tradeoff.betterOptionName}’s better ${tradeoff.criterionName} for ${gain}?`,
      answers: [
        { label: 'No, I’m fine with that', feeling: 'confident' },
        { label: 'Maybe', feeling: 'unsure' },
        { label: 'Yes, probably', feeling: 'doubtful' },
      ],
      responses: {
        confident: 'You’ve accepted the tradeoff. That’s what a good decision looks like.',
        unsure: `Try giving ${tradeoff.criterionName} a bit more importance and see whether the result changes.`,
        doubtful: `${tradeoff.criterionName} may matter more to you than you scored it. ${tradeoff.betterOptionName} deserves a second look.`,
      },
    })
  }
  return questions
}

const summaries: Record<Feeling, string> = {
  confident: 'Your scores and your gut agree. You can feel good about this one.',
  unsure: 'You’re mostly there. A little doubt is normal, especially on a close call.',
  doubtful: 'Your gut disagrees with the numbers. That’s useful to know: adjust your priorities and see if a different option wins.',
}

/** Reflection only. Answers are not saved and never change the score. */
export function RegretCheck(props: RegretCheckProps) {
  const questions = buildQuestions(props)
  const [answers, setAnswers] = useState<Record<string, Feeling>>({})
  const baseId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  function clearAnswers() {
    setAnswers({})
    // The clear button disappears once nothing is answered; keep keyboard focus in the check.
    containerRef.current?.querySelector<HTMLInputElement>('input[type=radio]')?.focus()
  }
  const answered = questions.filter((question) => answers[question.id])
  const overall: Feeling | null = answered.length < questions.length
    ? null
    : (['doubtful', 'unsure', 'confident'] as const).find((feeling) =>
        questions.some((question) => answers[question.id] === feeling)) ?? null

  return (
    <div className="regret" ref={containerRef}>
      {questions.map((question) => {
        const name = `${baseId}-${question.id}`
        const feeling = answers[question.id]
        return (
          <fieldset key={question.id} className="regret-question">
            <legend>{question.prompt}</legend>
            <div className="regret-answers">
              {question.answers.map((answer) => (
                <label key={answer.label} className={`regret-answer regret-answer--${answer.feeling}`}>
                  <input
                    type="radio"
                    name={name}
                    value={answer.feeling}
                    checked={feeling === answer.feeling}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: answer.feeling }))}
                  />
                  <span>{answer.label}</span>
                </label>
              ))}
            </div>
            <p className="regret-response" aria-live="polite">
              {feeling ? question.responses[feeling] : ''}
            </p>
          </fieldset>
        )
      })}
      <div className="regret-footer" aria-live="polite">
        {overall && <p className={`regret-summary regret-summary--${overall}`}><strong>Overall:</strong> {summaries[overall]}</p>}
        {answered.length > 0 && (
          <button type="button" className="results-button results-button--ghost" onClick={clearAnswers}>
            Clear answers
          </button>
        )}
      </div>
      <p className="regret-note">This is just for you. Your answers aren’t saved and don’t change the score.</p>
    </div>
  )
}
