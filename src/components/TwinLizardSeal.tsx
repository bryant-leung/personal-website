import { useEffect, useId, useMemo, useRef } from 'react'
import { bodyPath, eyePoints, legsPath, polarPt, type Pt } from './lizardGeometry'

const OBSIDIAN = '#050507'
const GOLD = '#f5b942'
const CRIMSON = '#e11d48'

/** One lizard: head at 90° (3 o'clock), arched body running anticlockwise, tail spiralling inward. */
function sealSpine(): Pt[] {
  return Array.from({ length: 48 }, (_, k) => {
    const u = k / 47
    const tail = u > 0.55 ? ((u - 0.55) / 0.45) ** 1.5 * 22 : 0
    return polarPt(90 - u * 200, 66 + 3.5 * Math.sin(u * Math.PI * 3) - tail)
  })
}

interface Props {
  size?: number | string
  className?: string
  /** 0 = eyes unlit, 1 = default glow, >1 brighter. */
  eyeGlowIntensity?: number
  /** Seconds per revolution; 0 disables idle rotation. */
  period?: number
  /** Change this value to fire a rotational kick + eye flash. */
  boostKey?: number
  reducedMotion?: boolean
}

/** Twin obsidian lizards curled head-to-tail in a gold-rimmed yin-yang seal. */
export function TwinLizardSeal({ size = '100%', className, eyeGlowIntensity = 1, period = 35, boostKey, reducedMotion = false }: Props) {
  const id = useId()
  const rotor = useRef<SVGGElement>(null)
  const halos = useRef<SVGGElement>(null)
  const kin = useRef({ angle: 0, boost: 0, flash: 0, last: boostKey })

  const shape = useMemo(() => {
    const spine = sealSpine()
    return { body: bodyPath(spine, 9), legs: legsPath(spine, 9, 10, true), eyes: eyePoints(spine, 9) }
  }, [])

  useEffect(() => {
    const k = kin.current
    if (boostKey === k.last) return
    k.last = boostKey
    k.boost += 260
    k.flash = 1
  }, [boostKey])

  useEffect(() => {
    let raf = 0
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const k = kin.current
      const speed = reducedMotion || !period ? 0 : 360 / period
      k.angle = (k.angle + dt * (speed + (reducedMotion ? 0 : k.boost))) % 360
      k.boost *= Math.exp(-dt * 3.5)
      k.flash *= Math.exp(-dt * 2.5)
      rotor.current?.setAttribute('transform', `rotate(${k.angle.toFixed(2)})`)
      if (halos.current) halos.current.style.opacity = String(Math.min(1, 0.55 * eyeGlowIntensity + k.flash))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [period, reducedMotion, eyeGlowIntensity])

  const lizard = (rot: number) => (
    <g data-seal-lizard key={rot}>
      <g transform={`rotate(${rot})`}>
        {/* Gold rim: same shapes stroked wider underneath. */}
        <path d={shape.legs} fill="none" stroke={GOLD} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={shape.body} fill={OBSIDIAN} stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round" />
        <path d={shape.legs} fill="none" stroke={OBSIDIAN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={shape.body} fill={OBSIDIAN} />
        <g filter={`url(#${id}-glow)`}>
          {shape.eyes.map((e, i) => (
            <circle key={i} cx={e.x} cy={e.y} r="1.6" fill={CRIMSON} />
          ))}
        </g>
      </g>
    </g>
  )

  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} className={`overflow-visible ${className ?? ''}`} aria-hidden="true">
      <defs>
        <filter id={`${id}-glow`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor={CRIMSON} stopOpacity="0.9" />
          <stop offset="1" stopColor={CRIMSON} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={rotor}>
        {[0, 180].map(lizard)}
        <g ref={halos} style={{ mixBlendMode: 'screen' }}>
          {[0, 180].flatMap((rot) =>
            shape.eyes.map((e, i) => (
              <circle key={`${rot}-${i}`} cx={e.x} cy={e.y} r="6" fill={`url(#${id}-halo)`} transform={`rotate(${rot})`} />
            )),
          )}
        </g>
      </g>
    </svg>
  )
}
