import { useEffect, useState } from 'react'
import { scoreComparison } from '../../lib/scoring'
import type { Comparison } from '../../types'
import { buildComparison, createDraft, createId, type CategoryLabel, type ComparisonDraft } from './comparisonDraft'
import { loadRecentComparisons, openComparisonStore, saveComparison, type RecentLoad } from './comparisonStorage'
import { CriteriaScreen } from './CriteriaScreen'
import { HomeScreen } from './HomeScreen'
import { ScoreScreen } from './ScoreScreen'
import { SetupScreen } from './SetupScreen'
import './comparison.css'

type Screen = 'home' | 'setup' | 'criteria' | 'score'

interface ComparisonFlowProps {
  /** Called with a complete, scorable comparison. The app uses this to show Results. */
  onComplete: (comparison: Comparison) => void
}

interface DraftSession {
  id: string
  createdAt: string
  draft: ComparisonDraft
}

export function ComparisonFlow({ onComplete }: ComparisonFlowProps) {
  const [store] = useState(openComparisonStore)
  const [screen, setScreen] = useState<Screen>('home')
  const [session, setSession] = useState<DraftSession | null>(null)
  const [recent, setRecent] = useState<RecentLoad>(() => loadRecentComparisons(store))
  const [finishError, setFinishError] = useState<string>()
  const [unsaved, setUnsaved] = useState<Comparison | null>(null)
  const [lastScreen, setLastScreen] = useState<Exclude<Screen, 'home'>>('setup')

  function goTo(next: Screen) {
    if (next !== 'home') setLastScreen(next)
    setScreen(next)
  }

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (screen === 'home') setRecent(loadRecentComparisons(store))
  }, [screen, store])

  function start(category?: CategoryLabel) {
    setSession({ id: createId(), createdAt: new Date().toISOString(), draft: createDraft(category) })
    setFinishError(undefined)
    setUnsaved(null)
    goTo('setup')
  }

  function updateDraft(draft: ComparisonDraft) {
    setSession((current) => (current ? { ...current, draft } : current))
    // Any edit after a failed save means the pending unsaved result is out of date.
    setUnsaved(null)
    setFinishError(undefined)
  }

  function finish() {
    if (!session) return
    let comparison: Comparison
    try {
      comparison = buildComparison(session.draft, {
        id: session.id,
        createdAt: session.createdAt,
        now: new Date().toISOString(),
      })
      // Same engine Results will use; fail here rather than on the Results page.
      scoreComparison(comparison)
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Something is still missing. Check your scores.')
      return
    }

    const saved = saveComparison(store, comparison)
    if (!saved.ok) {
      setFinishError(saved.message)
      setUnsaved(comparison)
      return
    }
    onComplete(comparison)
  }

  if (screen === 'home' || !session) {
    return (
      <div className="wi-app">
        <HomeScreen
          recent={recent}
          onStart={start}
          onOpenRecent={onComplete}
          draftTitle={session?.draft.title}
          onResume={session ? () => goTo(lastScreen) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="wi-app">
      {screen === 'setup' && (
        <SetupScreen
          draft={session.draft}
          onChange={updateDraft}
          onBack={() => goTo('home')}
          onContinue={() => goTo('criteria')}
        />
      )}
      {screen === 'criteria' && (
        <CriteriaScreen
          draft={session.draft}
          onChange={updateDraft}
          onBack={() => goTo('setup')}
          onContinue={() => goTo('score')}
        />
      )}
      {screen === 'score' && (
        <ScoreScreen
          draft={session.draft}
          onChange={updateDraft}
          onBack={() => goTo('criteria')}
          onFinish={finish}
          finishError={finishError}
          onFinishAnyway={unsaved ? () => onComplete(unsaved) : undefined}
        />
      )}
    </div>
  )
}
