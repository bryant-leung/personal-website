import { Suspense, lazy, useCallback, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { ENTRANCE_DONE_KEY } from './components/entranceKey'
import { LabyrinthNav } from './components/LabyrinthNav'
import { setSoundEnabled } from './utils/soundEngine'

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

  const [sound, setSound] = useState(false)
  const toggleSound = () => {
    const next = !sound
    setSound(next)
    void setSoundEnabled(next)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07070a]">
      <LabyrinthNav />
      <Suspense fallback={null}>
        <EntranceSequence active={!entered} onComplete={handleComplete} />
      </Suspense>
      <div className="fixed right-3 top-3 z-40 flex items-center gap-2 sm:right-4 sm:top-4 sm:gap-3">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
          className="flex items-center gap-2 rounded-full border border-[#f5b942]/70 bg-[#050507]/80 px-3 py-2.5 sm:px-4 sm:py-2 text-xs font-medium tracking-[0.25em] text-[#f5b942] shadow-[0_0_18px_rgba(245,185,66,0.2)] backdrop-blur-md transition hover:border-[#e2d9f3] hover:text-[#e2d9f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
        >
          <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`w-[2px] rounded-sm bg-current ${sound ? 'eq-bar' : 'h-[3px] opacity-60'}`}
                style={sound ? { animationDelay: `${i * 0.18}s` } : undefined}
              />
            ))}
          </span>
          <span className="hidden sm:inline">{sound ? 'SOUND ON' : 'SOUND OFF'}</span>
        </button>
        <a
          href="/Bryant-Leung-CV.pdf"
          download="Bryant-Leung-CV.pdf"
          aria-label="Download CV"
          title="Download CV"
          className="hidden sm:flex items-center gap-2 rounded-full border border-[#f5b942]/70 bg-[#0b0914]/70 px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium tracking-wide text-[#f5b942] shadow-[0_0_18px_rgba(245,185,66,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-[#e2d9f3] hover:text-[#e2d9f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
        >
          <Download size={15} aria-hidden="true" />
          <span className="hidden sm:inline">CV</span>
        </a>
        {entered && (
          <button
            type="button"
            onClick={replay}
            aria-label="Replay intro"
            title="Replay intro"
            className="flex items-center gap-2 rounded-full border border-[#f5b942]/70 bg-[#0b0914]/70 px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium tracking-wide text-[#f5b942] shadow-[0_0_18px_rgba(245,185,66,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-[#e2d9f3] hover:text-[#e2d9f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Replay intro</span>
          </button>
        )}
      </div>
    </div>
  )
}
