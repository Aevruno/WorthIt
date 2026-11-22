import { useEffect, useState } from 'react'
import { scoreComparison } from '../../lib/scoring'
import type { Comparison } from '../../types'
import {
  buildComparison,
  createDraft,
  createId,
  draftFromComparison,
  type CategoryLabel,
  type ComparisonDraft,
} from './comparisonDraft'
import {
  loadRecentComparisons,
  openDefaultPersistence,
  saveComparison,
  type ComparisonPersistence,
  type RecentLoad,
} from './comparisonStorage'
import { CriteriaScreen } from './CriteriaScreen'
import { HomeScreen } from './HomeScreen'
import { ScoreScreen } from './ScoreScreen'
import { SetupScreen } from './SetupScreen'
import './comparison.css'

type Screen = 'home' | 'setup' | 'criteria' | 'score'
type StepScreen = Exclude<Screen, 'home'>

export interface ComparisonFlowProps {
  /** Called with a complete, scorable, saved (when possible) comparison. Show Results from here. */
  onComplete: (comparison: Comparison) => void
  /**
   * Opens straight into editing this comparison (e.g. Saved → Open). Read once on mount:
   * give the component `key={comparison.id}` to switch to a different one.
   */
  initialComparison?: Comparison
  /** Where "back" goes when leaving an edit of `initialComparison`. Without it, back goes to the flow's Home. */
  onExit?: () => void
  /** Defaults to the foundation localStorage store. Pass `null` to run without saving. */
  persistence?: ComparisonPersistence | null
}

interface DraftSession {
  id: string
  createdAt: string
  mode: 'create' | 'edit'
  draft: ComparisonDraft
  /** Notes from loading a saved comparison into the editor (shown on the first step). */
  adjustments: string[]
}

function editSession(comparison: Comparison): DraftSession {
  const { draft, adjustments } = draftFromComparison(comparison)
  return { id: comparison.id, createdAt: comparison.createdAt, mode: 'edit', draft, adjustments }
}

export function ComparisonFlow({ onComplete, initialComparison, onExit, persistence: injected }: ComparisonFlowProps) {
  const [persistence] = useState<ComparisonPersistence | null>(() =>
    injected === undefined ? openDefaultPersistence() : injected,
  )
  const [session, setSession] = useState<DraftSession | null>(() =>
    initialComparison ? editSession(initialComparison) : null,
  )
  const [screen, setScreen] = useState<Screen>(initialComparison ? 'setup' : 'home')
  const [lastScreen, setLastScreen] = useState<StepScreen>('setup')
  const [recent, setRecent] = useState<RecentLoad>(() => loadRecentComparisons(persistence))
  const [finishError, setFinishError] = useState<string>()
  const [unsaved, setUnsaved] = useState<Comparison | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (screen === 'home') setRecent(loadRecentComparisons(persistence))
  }, [screen, persistence])

  function goTo(next: Screen) {
    if (next !== 'home') setLastScreen(next)
    setScreen(next)
  }

  function begin(next: DraftSession) {
    setSession(next)
    setFinishError(undefined)
    setUnsaved(null)
    goTo('setup')
  }

  function startNew(category?: CategoryLabel) {
    begin({ id: createId(), createdAt: new Date().toISOString(), mode: 'create', draft: createDraft(category), adjustments: [] })
  }

  function updateDraft(draft: ComparisonDraft) {
    setSession((current) => (current ? { ...current, draft } : current))
    // Any edit after a failed save means the pending unsaved result is out of date.
    setUnsaved(null)
    setFinishError(undefined)
  }

  function leaveSetup() {
    if (onExit && initialComparison && session?.id === initialComparison.id) onExit()
    else goTo('home')
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
      // Same engine Results uses; fail here rather than on the Results page.
      scoreComparison(comparison)
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Something is still missing. Check your scores.')
      return
    }

    const saved = saveComparison(persistence, comparison)
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
          onStart={startNew}
          onViewRecent={onComplete}
          onEditRecent={(comparison) => begin(editSession(comparison))}
          draftTitle={session?.draft.title}
          draftIsEdit={session?.mode === 'edit'}
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
          mode={session.mode}
          adjustments={session.adjustments}
          onChange={updateDraft}
          onBack={leaveSetup}
          backLabel={onExit && initialComparison && session.id === initialComparison.id ? 'Back' : 'Back to home'}
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
