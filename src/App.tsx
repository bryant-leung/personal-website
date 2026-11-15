import { Suspense, lazy, useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { ENTRANCE_DONE_KEY } from './components/entranceKey'
import { LabyrinthNav } from './components/LabyrinthNav'

// Three.js and the model only load when the intro actually plays (not on reloads that skip it).
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
  // Bumped on Replay so both the entrance and the cube remount fresh (labyrinth back on stage I).
  const [run, setRun] = useState(0)

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(ENTRANCE_DONE_KEY, '1')
    } catch {
      /* storage unavailable: still proceed */
    }
    setEntered(true)
  }, [])

  const replay = () => {
    setRun((n) => n + 1)
    setEntered(false)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07070a]">
      {/* Sync mode: the entrance fades out over the labyrinth as it fades in, in the same rect. */}
      <AnimatePresence>
        {entered ? (
          <LabyrinthNav key={`labyrinth-${run}`} />
        ) : (
          <Suspense key={`entrance-${run}`} fallback={null}>
            <EntranceSequence onComplete={handleComplete} />
          </Suspense>
        )}
      </AnimatePresence>

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
