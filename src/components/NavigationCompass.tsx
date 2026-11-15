/**
 * NavigationCompass: floating bottom pill used to turn the cube.
 * Chevrons step one face; tabs jump to a face; the glyph rotates with the cube.
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { themes, FACE_COUNT, TURN_DURATION } from '../data/themes'
import type { FaceTheme } from '../data/themes'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface NavigationCompassProps {
  activeIndex: number
  onSelect: (index: number) => void
  theme: FaceTheme
}

export function NavigationCompass({ activeIndex, onSelect, theme }: NavigationCompassProps) {
  const reduced = useReducedMotion()

  // Cumulative glyph angle so wrapping 3 -> 0 keeps spinning the same way.
  const [angle, setAngle] = useState(-activeIndex * 90)
  const prevIndex = useRef(activeIndex)
  useEffect(() => {
    let d = (((activeIndex - prevIndex.current) % FACE_COUNT) + FACE_COUNT) % FACE_COUNT
    if (d === 3) d = -1
    prevIndex.current = activeIndex
    if (d !== 0) setAngle((a) => a - d * 90)
  }, [activeIndex])

  const step = (dir: 1 | -1) => onSelect((activeIndex + dir + FACE_COUNT) % FACE_COUNT)
  const iconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

  return (
    <nav
      aria-label="Sections"
      className="fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-black/40 px-1.5 py-1.5 backdrop-blur-xl"
      style={{ boxShadow: `0 0 28px -6px ${theme.accentGlow}` }}
    >
      <button type="button" aria-label="Previous section" className={iconBtn} onClick={() => step(-1)}>
        <ChevronLeft size={18} />
      </button>

      <div className="hidden items-center gap-2 px-2 sm:flex" aria-hidden="true">
        <motion.svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          animate={{ rotate: angle }}
          transition={{ duration: reduced ? 0 : TURN_DURATION, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx="12" cy="12" r="10" stroke={theme.accentPrimary} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M12 3 L14.6 12 H9.4 Z" fill={theme.accentPrimary} />
          <path d="M12 21 L9.4 12 H14.6 Z" fill={theme.textMuted} fillOpacity="0.6" />
          <circle cx="12" cy="12" r="1.3" fill={theme.textPrimary} />
        </motion.svg>
        <span className="w-9 font-mono text-xs tabular-nums" style={{ color: theme.accentPrimary }}>
          {theme.angleLabel}
        </span>
      </div>

      <div role="tablist" aria-label="Cube faces" className="flex items-center">
        {themes.map((t, i) => {
          const active = i === activeIndex
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(i)}
              className="relative flex flex-col items-center rounded-full px-2.5 py-1 leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-4"
              style={{ color: active ? theme.textPrimary : theme.textMuted }}
            >
              <span className="text-xs font-medium sm:text-sm">{t.label}</span>
              <span className="font-jp text-[10px] text-[var(--text-muted)]">{t.jpLabel}</span>
              {active && (
                <motion.span
                  layoutId="compass-indicator"
                  className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full"
                  style={{ background: theme.accentPrimary, boxShadow: `0 0 8px ${theme.accentGlow}` }}
                  transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          )
        })}
      </div>

      <button type="button" aria-label="Next section" className={iconBtn} onClick={() => step(1)}>
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
