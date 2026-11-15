/**
 * CubeViewport: owns the active face and renders it as a 3D cube (desktop)
 * or a sliding 2D card (mobile). Also drives the ambient background, the
 * --accent/--border/... CSS variables, keyboard and swipe/wheel navigation.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode, TouchEvent, WheelEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { themes, FACE_COUNT, TURN_DURATION } from '../data/themes'
import type { FaceTheme } from '../data/themes'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { NavigationCompass } from './NavigationCompass'
import { IntroFace } from './faces/IntroFace'
import { ProjectsFace } from './faces/ProjectsFace'
import { ExperienceFace } from './faces/ExperienceFace'
import { ContactFace } from './faces/ContactFace'
import type { FaceProps } from './faces/FaceProps'

const FACES: readonly ComponentType<FaceProps>[] = [IntroFace, ProjectsFace, ExperienceFace, ContactFace]
const EASE = [0.22, 1, 0.36, 1] as const
const STAGE_W = 'min(92vw, 1400px)'
/** How far the prism dollies back mid-turn so the leading corner clears the camera. */
const TURN_PULL = -120
const COMPASS_RESERVE = 96
/** Minimum gap between turns, so one trackpad swipe never skips two faces. */
const TURN_COOLDOWN_MS = 450
/** Wheel events closer together than this belong to the same gesture (incl. macOS inertia). */
const WHEEL_GESTURE_GAP_MS = 180
const WHEEL_THRESHOLD = 30
const CSS_VARS = [
  ['--accent', 'accentPrimary'],
  ['--border', 'borderColor'],
  ['--glow', 'accentGlow'],
  ['--text-primary', 'textPrimary'],
  ['--text-muted', 'textMuted'],
] as const

const mod = (n: number) => ((n % FACE_COUNT) + FACE_COUNT) % FACE_COUNT

/**
 * Themed glass panel shared by the cube faces and mobile cards. Each face owns a
 * `.face-scroll` overflow-y-auto area; the panel guarantees it scrolls on its own
 * and keeps generous bottom padding so the last line never sits on the border.
 */
function Panel({ theme, children }: { theme: FaceTheme; children: ReactNode }) {
  return (
    <div
      className="h-full w-full overflow-hidden rounded-2xl backdrop-blur-xl [&_.face-scroll]:overflow-y-auto [&_.face-scroll]:overscroll-contain [&_.face-scroll]:pb-20 md:[&_.face-scroll]:pb-24"
      style={{
        background: theme.surfaceBg,
        border: `1px solid ${theme.borderColor}`,
        boxShadow: `inset 0 0 60px -20px ${theme.accentGlow}, 0 0 40px -16px ${theme.accentGlow}`,
      }}
    >
      {children}
    </div>
  )
}

export function CubeViewport() {
  const isDesktop = useIsDesktop()
  const reduced = useReducedMotion()
  // Cumulative step count (can go negative / beyond 4) gives a continuous 360° feel.
  const [steps, setSteps] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const stepsRef = useRef(0)
  const lockUntil = useRef(0)
  const wheelGesture = useRef({ last: 0, fired: false })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const activeIndex = mod(steps)

  const rawRotate = useMotionValue(0)
  const springRotate = useSpring(rawRotate, { stiffness: 70, damping: 18, mass: 1 })
  const pull = useMotionValue(0)

  // Live prism depth: half the stage width, measured so faces meet exactly at the corners.
  const stageRef = useRef<HTMLDivElement>(null)
  const [half, setHalf] = useState(0)
  const halfMV = useMotionValue(0)
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const apply = (w: number) => {
      setHalf(w / 2)
      halfMV.set(w / 2)
    }
    apply(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop, halfMV])

  // Push the prism back by its half-depth so the front face sits on the screen plane.
  const prismTransform = useTransform(
    [reduced ? rawRotate : springRotate, pull, halfMV],
    ([r, p, h]: number[]) => `translateZ(${p - h}px) rotateY(${r}deg)`,
  )

  /** Turn by `delta` faces. Returns false if the cooldown swallowed the turn. */
  const go = useCallback(
    (delta: number): boolean => {
      const now = performance.now()
      if (delta === 0 || now < lockUntil.current) return false
      lockUntil.current = now + TURN_COOLDOWN_MS
      // Cumulative steps: 3 -> 4 rotates -270deg -> -360deg instead of unwinding back to 0.
      stepsRef.current += delta
      setDir(delta > 0 ? 1 : -1)
      setSteps(stepsRef.current)
      rawRotate.set(-90 * stepsRef.current)
      if (!reduced) {
        animate(pull, [pull.get(), TURN_PULL, 0], { duration: TURN_DURATION, times: [0, 0.45, 1], ease: 'easeInOut' })
      }
      return true
    },
    [rawRotate, pull, reduced],
  )

  const rotate = useCallback((d: 1 | -1) => void go(d), [go])

  /** Shortest path to a face index. */
  const select = useCallback(
    (index: number) => {
      let d = mod(index - mod(stepsRef.current))
      if (d === 3) d = -1
      void go(d)
    },
    [go],
  )

  // Tween CSS theme variables in sync with the turn.
  useEffect(() => {
    const root = document.documentElement.style
    const theme = themes[activeIndex]
    const running = CSS_VARS.map(([name, key]) => {
      const to = theme[key]
      const from = root.getPropertyValue(name)
      if (reduced || !from) {
        root.setProperty(name, to)
        return null
      }
      return animate(from, to, {
        duration: TURN_DURATION,
        ease: EASE,
        onUpdate: (v) => root.setProperty(name, v),
      })
    })
    return () => running.forEach((a) => a?.stop())
  }, [activeIndex, reduced])

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (document.querySelector('[data-modal-open]')) return
      go(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // Swipe + trackpad: only clearly horizontal gestures; never preventDefault.
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touchStart.current
    touchStart.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }
  const onWheel = (e: WheelEvent) => {
    const ax = Math.abs(e.deltaX)
    // Vertical-dominant: leave it to the face's own scroll container.
    if (ax <= 1.5 * Math.abs(e.deltaY)) return
    const now = performance.now()
    const g = wheelGesture.current
    // A pause longer than the gap starts a new gesture; inertia events keep the old one alive.
    if (now - g.last > WHEEL_GESTURE_GAP_MS) g.fired = false
    g.last = now
    if (g.fired || ax < WHEEL_THRESHOLD) return
    if (go(e.deltaX > 0 ? 1 : -1)) g.fired = true
  }

  const gestureProps = { onTouchStart, onTouchEnd, onWheel }
  const theme = themes[activeIndex]
  const stageHeight = `min(86vh, calc(100dvh - ${COMPASS_RESERVE + 24}px))`
  const tween = { duration: reduced ? 0 : TURN_DURATION, ease: EASE }

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.6 }}
    >
      {/* Ambient background: stacked gradients crossfaded by opacity. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {themes.map((t, i) => (
          <motion.div
            key={t.id}
            className="absolute inset-0"
            style={{ background: t.bgGradient }}
            initial={false}
            animate={{ opacity: i === activeIndex ? 1 : 0 }}
            transition={tween}
          />
        ))}
      </div>

      {isDesktop ? (
        <div
          className="relative z-10 flex h-full w-full items-center justify-center"
          style={{ paddingBottom: COMPASS_RESERVE, touchAction: 'pan-y' }}
          {...gestureProps}
        >
          <div ref={stageRef} style={{ width: STAGE_W, height: stageHeight, perspective: '1400px' }}>
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d', transform: prismTransform }}
            >
              {themes.map((t, i) => {
                const Face = FACES[i]
                const active = i === activeIndex
                return (
                  <div
                    key={t.id}
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: `rotateY(${i * 90}deg) translateZ(${half}px)`,
                    }}
                    aria-hidden={!active}
                    inert={!active}
                  >
                    <Panel theme={t}>
                      <Face theme={t} active={active} onRotate={rotate} />
                    </Panel>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>
      ) : (
        <div
          className="absolute inset-x-3 top-3 z-10 overflow-hidden"
          style={{ bottom: COMPASS_RESERVE, touchAction: 'pan-y' }}
          {...gestureProps}
        >
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={activeIndex}
              className="absolute inset-0"
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: `${d * 100}%`, opacity: 0 }),
                center: { x: '0%', opacity: 1 },
                exit: (d: number) => ({ x: `${-d * 100}%`, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={tween}
            >
              {(() => {
                const Face = FACES[activeIndex]
                return (
                  <Panel theme={theme}>
                    <Face theme={theme} active onRotate={rotate} />
                  </Panel>
                )
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <NavigationCompass activeIndex={activeIndex} onSelect={select} theme={theme} />
    </motion.div>
  )
}
