import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultsView, type ResultsViewProps } from './ResultsView'
import { samples } from './preview/sampleComparisons'

const render = (comparison: ResultsViewProps['comparison'], onEdit?: () => void) =>
  renderToStaticMarkup(<ResultsView comparison={comparison} onEditComparison={onEdit} />).replace(/<!-- -->/g, '')

describe('ResultsView', () => {
  it('renders every section for a normal result', () => {
    const html = render(samples.normal)
    for (const text of ['Your Winner', 'Aero 13', 'WorthIt score: 79 out of 100', 'Why it won', 'Runner Up', 'Zen 14',
      '5 points behind', 'Tradeoffs', 'Zen 14 scored better on', 'What would change the winner?', 'Regret Check', 'Full ranking']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('If Battery life mattered less (importance 5 → 2.3), Zen 14 would take the lead.')
    expect(html).toContain('That’s more than Battery life, your current top priority.')
    expect(html).toContain('cost 10% more')
  })

  it('makes a close result visibly uncertain', () => {
    const html = render(samples.close)
    expect(html).toContain('This one is close')
    expect(html).toContain('Only 2 points behind')
    expect(html).toContain('slight favorite, not a sure thing')
  })

  it('says clearly when no priority change flips a dominant winner', () => {
    const html = render(samples.dominant)
    expect(html).toContain('Decisive win')
    expect(html).toContain('Aero 13 holds up.')
    expect(html).toContain('there’s no tradeoff to make')
  })

  it('shows a tie without naming a winner', () => {
    const html = render(samples.tie)
    expect(html).toContain('It’s a tie')
    expect(html).not.toContain('Your Winner')
    expect(html).toContain('What separates them')
    expect(html).toContain('76.7')
  })

  it('asks a non-price regret question when there is no price', () => {
    const html = render(samples.lowerIsBetter)
    expect(html).toContain('three months from now')
    expect(html).toContain('Would you regret giving up Harbor loft’s better Space')
  })

  it('renders labelled radio answers for the regret check', () => {
    const html = render(samples.normal)
    expect(html.match(/<input type="radio"/g)?.length).toBe(6)
    expect(html).toContain('<legend>')
  })

  it('renders empty and incomplete states', () => {
    expect(render(null)).toContain('No comparison yet')
    const html = render(samples.incomplete)
    expect(html).toContain('Almost there')
    expect(html).toContain('Zen 14 still needs a 0–10 score for Performance.')
  })

  it('only renders the edit button when a handler is provided', () => {
    expect(render(samples.normal)).not.toContain('<button')
    expect(render(samples.normal, () => {})).toContain('Adjust scores or priorities')
    expect(render(null, () => {})).toContain('Start a comparison')
  })
})
