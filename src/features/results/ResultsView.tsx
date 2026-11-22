import type { Comparison } from '../../types'
import { RegretCheck } from './RegretCheck'
import {
  formatNumber,
  gapText,
  pointsFormatter,
  scoreText,
  summarizeResult,
  type ContributionRow,
  type ImportanceScale,
  type OptionSummary,
  type ResultSummary,
  type WinnerChange,
} from './summarizeResult'
import './results.css'

export interface ResultsViewProps {
  /** The comparison to explain. Null/undefined shows the empty state. Malformed data shows a recoverable message. */
  comparison: Pick<Comparison, 'options' | 'criteria'> | null | undefined
  /** Navigate back to editing. When omitted, no edit button is shown. */
  onEditComparison?: () => void
  /**
   * The importance values your comparison UI allows (e.g. `{ min: 1, max: 10, step: 1 }`), so
   * "What would change the winner?" only suggests changes people can actually make.
   */
  importanceScale?: ImportanceScale
  /** Formats `Option.price` (which carries no currency). Defaults to a plain localized number. */
  formatPrice?: (price: number) => string
}

const defaultPriceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const defaultFormatPrice = (price: number) => defaultPriceFormat.format(price)
const ACCENTS = 4

function Crown() {
  return (
    <svg className="results-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" />
    </svg>
  )
}

function Check() {
  return (
    <svg className="results-check" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7.6 13.2L4.4 10l-1.4 1.4 4.6 4.6 9.4-9.4L15.6 5.2z" fill="currentColor" />
    </svg>
  )
}

function ScoreRing({ points, label }: { points: number; label: string }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, points))
  return (
    <div className="score-ring" role="img" aria-label={`${label}: ${Math.round(points)} out of 100`}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="score-ring-track" cx="60" cy="60" r={radius} />
        <circle
          className="score-ring-fill"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span className="score-ring-value" aria-hidden="true">
        <strong>{Math.round(points)}</strong>
        <small>/ 100</small>
      </span>
    </div>
  )
}

function EditButton({ onEdit, children }: { onEdit?: () => void; children: string }) {
  if (!onEdit) return null
  return <button type="button" className="results-button" onClick={onEdit}>{children}</button>
}

function Ranking({ ranking, format }: { ranking: OptionSummary[]; format: (points: number) => string }) {
  return (
    <section className="results-card" aria-labelledby="results-ranking">
      <h3 id="results-ranking">Full ranking</h3>
      <ol className="ranking">
        {ranking.map((item) => (
          <li key={item.id}>
            <span className="ranking-rank" aria-hidden="true">{item.rank}</span>
            <span className="ranking-name">
              {item.name}
              <span className="visually-hidden">, rank {item.rank}{ranking.filter((other) => other.rank === item.rank).length > 1 ? ' (tied)' : ''}</span>
            </span>
            <span className="ranking-points">{format(item.points)}<small> / 100</small></span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ContributionBars({ rows }: { rows: ContributionRow[] }) {
  const largest = Math.max(...rows.map((row) => row.maxPoints))
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.criterionId} className="bar">
          <div className="bar-label">
            <span>{row.name}</span>
            <span className="bar-value">
              {formatNumber(row.points)} of {formatNumber(row.maxPoints)} pts
            </span>
          </div>
          <div className="bar-track" style={{ width: `${(row.maxPoints / largest) * 100}%` }} aria-hidden="true">
            <div className="bar-fill" style={{ width: `${row.maxPoints === 0 ? 0 : (row.points / row.maxPoints) * 100}%` }} />
          </div>
          <p className="bar-note">You rated it {scoreText(row.enteredScore, row.higherIsBetter)}</p>
        </li>
      ))}
    </ul>
  )
}

function changeSentence(change: WinnerChange, topPriorityName: string): string {
  const to = formatNumber(change.toImportance)
  const from = formatNumber(change.fromImportance)
  if (change.direction === 'decrease') {
    return change.toImportance === 0
      ? `If ${change.criterionName} didn’t matter to you at all, ${change.challengerName} would take the lead.`
      : `If ${change.criterionName} mattered less (importance ${from} → ${to}), ${change.challengerName} would take the lead.`
  }
  if (change.fromImportance === 0) {
    return `If you started caring about ${change.criterionName} (importance 0 → ${to}), ${change.challengerName} would take the lead.`
  }
  const base = `If ${change.criterionName} mattered more (importance ${from} → ${to}), ${change.challengerName} would take the lead.`
  return change.exceedsTopPriority ? `${base} That’s more than ${topPriorityName}, your current top priority.` : base
}

interface DecidedProps {
  summary: Extract<ResultSummary, { kind: 'decided' }>
  onEditComparison?: () => void
  formatPrice: (price: number) => string
}

function Decided({ summary, onEditComparison, formatPrice }: DecidedProps) {
  const { winner, runnerUp, closeness } = summary
  const format = pointsFormatter([winner.points, runnerUp.points])
  const rankingFormat = pointsFormatter(summary.ranking.map((item) => item.points))
  const strongest = [...summary.contributions].sort((a, b) => b.points - a.points)[0]
  const firstTradeoff = summary.tradeoffs.find((tradeoff) => tradeoff.option.id === runnerUp.id) ?? summary.tradeoffs[0]

  return (
    <>
      <section className={`results-hero results-hero--${closeness}`} aria-labelledby="results-title">
        <div className="results-hero-main">
          <h2 id="results-title" className="results-kicker"><Crown /> Your Winner</h2>
          <p className="results-winner-name">{winner.name}</p>
          {winner.subtitle && <p className="results-winner-subtitle">{winner.subtitle}</p>}
          {winner.price !== undefined && (
            <p className="results-price"><span>Price</span> {formatPrice(winner.price)}</p>
          )}
          <p className={`results-badge results-badge--${closeness}`}>
            {closeness === 'close' && <><span aria-hidden="true">≈ </span>This one is close</>}
            {closeness === 'clear' && <><span aria-hidden="true">↑ </span>Clear lead</>}
            {closeness === 'dominant' && <><span aria-hidden="true">★ </span>Decisive win</>}
          </p>
        </div>
        <ScoreRing points={winner.points} label="WorthIt score" />
      </section>

      {closeness === 'close' && (
        <section className="results-card results-close" aria-labelledby="results-close-title">
          <h3 id="results-close-title">This one is close</h3>
          <p>
            The scores are near enough that a small change in how you rate things could flip the result.
            Treat {winner.name} as a slight favorite, not a sure thing.
          </p>
          <dl className="results-versus">
            <div><dt>{winner.name}</dt><dd>{format(winner.points)}</dd></div>
            <div><dt>{runnerUp.name}</dt><dd>{format(runnerUp.points)}</dd></div>
          </dl>
        </section>
      )}

      <div className="results-grid">
        <section className="results-card" aria-labelledby="results-why">
          <h3 id="results-why">Why it won</h3>
          <ul className="reasons">
            {summary.reasons.map((reason) => (
              <li key={reason.title}>
                <Check />
                <div>
                  <p className="reason-title">{reason.title}</p>
                  {reason.detail && <p className="reason-detail">{reason.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
          <h4 className="results-subheading">Where its {format(winner.points)} points came from</h4>
          <ContributionBars rows={summary.contributions} />
          <p className="results-footnote">Bar length shows how much each priority counts. Fill shows how much the winner earned.</p>
        </section>

        <section className="results-card results-runner" aria-labelledby="results-runner-title">
          <h3 id="results-runner-title">Runner Up</h3>
          <p className="results-runner-name">{runnerUp.name}</p>
          <p className="results-runner-score">{format(runnerUp.points)} <small>/ 100</small></p>
          <p className="results-runner-gap">{gapText(winner.points, runnerUp.points)}</p>
          <div className="gap-meter" aria-hidden="true">
            {[{ item: winner, kind: 'winner' }, { item: runnerUp, kind: 'runner' }].map(({ item, kind }) => (
              <div key={kind} className="gap-meter-row">
                <span className="gap-meter-label">
                  <span>{item.name}</span>
                  <span>{format(item.points)}</span>
                </span>
                <span className="gap-meter-track">
                  <span className={`gap-meter-${kind}`} style={{ width: `${Math.min(100, Math.max(0, item.points))}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="results-card" aria-labelledby="results-tradeoffs">
        <h3 id="results-tradeoffs">Tradeoffs</h3>
        {summary.tradeoffs.length === 0 ? (
          <p>
            {winner.name} scored at least as well as every other option on every priority you weighted.
            Based on your scores, there’s no tradeoff to make.
          </p>
        ) : (
          <>
            <p>{winner.name} won overall. However:</p>
            <ul className="tradeoffs">
              {summary.tradeoffs.map((tradeoff, index) => (
                <li key={tradeoff.option.id} className={`tradeoff tradeoff--${index % ACCENTS}`}>
                  <p className="tradeoff-option">
                    <span className="tradeoff-icon" aria-hidden="true">▲</span>
                    {tradeoff.option.name} scored better on
                  </p>
                  <ul className="tradeoff-items">
                    {tradeoff.items.map((item) => (
                      <li key={item.criterionName} className={item.minor ? 'tradeoff-item--minor' : undefined}>
                        <strong>{item.criterionName}</strong>{' '}
                        <span className="tradeoff-scores">
                          {formatNumber(item.theirScore)} vs {formatNumber(item.winnerScore)}{item.higherIsBetter ? '' : ', lower is better'}
                        </span>
                        <span className="tradeoff-impact">
                          {item.minor ? ' · minor, under 1 pt' : ` · worth ${formatNumber(item.points)} pts`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="results-card" aria-labelledby="results-change">
        <h3 id="results-change">What would change the winner?</h3>
        {summary.changes === null && <p>We couldn’t run this check for this comparison.</p>}
        {summary.changes !== null && summary.changes.length === 0 && (
          <p>
            <strong>{winner.name} holds up.</strong> Changing how much any single priority matters, anywhere from{' '}
            {summary.minImportance === 0 ? 'not at all' : `importance ${formatNumber(summary.minImportance)}`}{' '}
            up to {formatNumber(summary.maxImportance)}, keeps {winner.name} in first place.
          </p>
        )}
        {summary.changes !== null && summary.changes.length > 0 && (
          <>
            <ul className="changes">
              {summary.changes.map((change) => (
                <li key={`${change.criterionName}-${change.direction}`}>
                  <span className="change-icon" aria-hidden="true">{change.direction === 'increase' ? '↑' : '↓'}</span>
                  {changeSentence(change, summary.topPriorityName)}
                </li>
              ))}
            </ul>
            <p className="results-footnote">Each line changes one priority and keeps your other scores and priorities the same.</p>
          </>
        )}
      </section>

      <section className="results-card" aria-labelledby="results-regret">
        <h3 id="results-regret">Regret Check</h3>
        <p>Before you commit, a quick gut check.</p>
        <RegretCheck
          winnerName={winner.name}
          runnerUpName={runnerUp.name}
          winnerPrice={winner.price}
          formatPrice={formatPrice}
          winnerStrength={strongest?.name}
          tradeoff={firstTradeoff ? { criterionName: firstTradeoff.items[0].criterionName, betterOptionName: firstTradeoff.option.name } : undefined}
        />
      </section>

      {summary.ranking.length > 2 && <Ranking ranking={summary.ranking} format={rankingFormat} />}

      <EditButton onEdit={onEditComparison}>Adjust scores or priorities</EditButton>
    </>
  )
}

function Tie({ summary, onEditComparison }: { summary: Extract<ResultSummary, { kind: 'tie' }>; onEditComparison?: () => void }) {
  const format = pointsFormatter(summary.ranking.map((item) => item.points))
  const names = summary.leaders.map((item) => item.name)
  const joined = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
  return (
    <>
      <section className="results-hero results-hero--tie" aria-labelledby="results-title">
        <div className="results-hero-main">
          <h2 id="results-title" className="results-kicker"><span aria-hidden="true">=</span> It’s a tie</h2>
          <p className="results-winner-name">{joined}</p>
          <p className="results-hero-copy">
            Based on your scores and priorities, these options came out equal. WorthIt won’t pick one when the numbers don’t.
          </p>
        </div>
        <dl className="results-versus results-versus--hero">
          {summary.leaders.map((item) => (
            <div key={item.id}><dt>{item.name}</dt><dd>{format(item.points)}</dd></div>
          ))}
        </dl>
      </section>

      <section className="results-card" aria-labelledby="results-separate">
        <h3 id="results-separate">What separates them</h3>
        {summary.differences.length === 0 ? (
          <p>They received the same score on every priority. Add a priority that tells them apart.</p>
        ) : (
          <>
            <ul className="tradeoffs">
              {summary.differences.map((difference, index) => (
                <li key={difference.criterionName} className={`tradeoff tradeoff--${index % ACCENTS}`}>
                  <p className="tradeoff-option">
                    <span className="tradeoff-icon" aria-hidden="true">▲</span>
                    {difference.bestNames.join(' and ')} scored better on <strong>{difference.criterionName}</strong>
                  </p>
                  <p className="tradeoff-scores">
                    {difference.scores.map((item) => `${item.name} ${formatNumber(item.score)}`).join(' · ')}
                    {difference.higherIsBetter ? '' : ' (lower is better)'}
                  </p>
                </li>
              ))}
            </ul>
            <p className="results-footnote">Whichever of these matters more to you should decide it. Give it more importance and the tie will break.</p>
          </>
        )}
      </section>

      {summary.ranking.length > summary.leaders.length && <Ranking ranking={summary.ranking} format={format} />}
      <EditButton onEdit={onEditComparison}>Adjust scores or priorities</EditButton>
    </>
  )
}

/** The Results screen. Pure presentation over the shared scoring engine; owns no persisted state. */
export function ResultsView({ comparison, onEditComparison, importanceScale, formatPrice = defaultFormatPrice }: ResultsViewProps) {
  const summary = summarizeResult(comparison, { importanceScale })
  return (
    <div className="results">
      {summary.kind === 'empty' && (
        <section className="results-card results-state" aria-labelledby="results-title">
          <h2 id="results-title">No comparison yet</h2>
          <p>Add a few options and the priorities you care about, score them, and your result will appear here.</p>
          <EditButton onEdit={onEditComparison}>Start a comparison</EditButton>
        </section>
      )}
      {summary.kind === 'incomplete' && (
        <section className="results-card results-state" aria-labelledby="results-title">
          <h2 id="results-title">Almost there</h2>
          <p>WorthIt needs a bit more before it can show a result:</p>
          <ul className="results-problems">
            {summary.problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
          <EditButton onEdit={onEditComparison}>Finish your comparison</EditButton>
        </section>
      )}
      {summary.kind === 'tie' && <Tie summary={summary} onEditComparison={onEditComparison} />}
      {summary.kind === 'decided' && <Decided summary={summary} onEditComparison={onEditComparison} formatPrice={formatPrice} />}
    </div>
  )
}
