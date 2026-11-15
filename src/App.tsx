import { Suspense, lazy, useCallback, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ENTRANCE_DONE_KEY } from './components/entranceKey'
import { LabyrinthNav } from './components/LabyrinthNav'

const EntranceSequence = lazy(() =>
  import('./components/EntranceSequence').then((m) => ({ default: m.EntranceSequence })),
)

function hasSeenEntrance(): boolean {
  try {
    return sessionStorage.getItem(ENTRANCE_DONE_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [entered, setEntered] = useState<boolean>(hasSeenEntrance)

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(ENTRANCE_DONE_KEY, '1')
    } catch {
      /* storage unavailable: still proceed */
    }
    setEntered(true)
  }, [])

  // The hero scroller stays mounted over the labyrinth; re-activating it scrolls back to 0px.
  const replay = () => setEntered(false)

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07070a]">
      <LabyrinthNav />
      <Suspense fallback={null}>
        <EntranceSequence active={!entered} onComplete={handleComplete} />
      </Suspense>
      {entered && (
        <button
          type="button"
          onClick={replay}
          aria-label="Replay intro"
          title="Replay intro"
          className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-[#f5b942]/70 bg-[#0b0914]/70 px-4 py-2 text-sm font-medium tracking-wide text-[#f5b942] shadow-[0_0_18px_rgba(245,185,66,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-[#e2d9f3] hover:text-[#e2d9f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Replay intro
        </button>
      )}
    </div>
  )
}
