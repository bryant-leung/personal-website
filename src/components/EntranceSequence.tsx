/**
 * Scroll-driven hero: a 200vh scroller laid over LabyrinthNav. Scrolling (or the CTA) scrubs a GSAP
 * timeline that dissolves the Soul Gem seal into violet/crimson smoke and parts the gothic planes,
 * leaving the stage transparent. At the end it calls onComplete and stops taking pointer events,
 * so the labyrinth underneath gets the wheel. Setting `active` again smooth-scrolls back to the top.
 */
import { useEffect, useMemo, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TwinLizardSeal } from './TwinLizardSeal'
import { playSmokeWhoosh } from '../utils/soundEngine'

export { ENTRANCE_DONE_KEY } from './entranceKey'

gsap.registerPlugin(ScrollTrigger)

const SERIF = '"Cormorant Garamond", "Bodoni Moda", Didot, "Bodoni 72", "Times New Roman", serif'
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

/** A row of gothic spires with lancet windows, rising from the bottom of a 400×600 box. */
function spirePath(seed: number): string {
  let d = 'M0 600'
  let x = 0
  let i = seed
  while (x < 400) {
    const w = 46 + ((i * 37) % 40)
    const h = 200 + ((i * 113) % 230)
    const top = 600 - h
    d += ` L${x} ${top + 60} L${x + w * 0.15} ${top + 40} L${x + w / 2} ${top - 70 - ((i * 29) % 60)} L${x + w * 0.85} ${top + 40} L${x + w} ${top + 60}`
    x += w
    i += 1
  }
  return `${d} L400 600 Z`
}

function windows(seed: number) {
  return Array.from({ length: 7 }, (_, k) => {
    const x = 20 + ((seed * 53 + k * 61) % 340)
    const y = 330 + ((seed * 31 + k * 97) % 230)
    return <path key={k} d={`M${x} ${y + 40} V${y + 12} Q${x + 7} ${y} ${x + 14} ${y + 12} V${y + 40} Z`} />
  })
}

function Spires({ seed, fill, edge, flip }: { seed: number; fill: string; edge: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice" className="h-full w-full" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d={spirePath(seed)} fill={fill} stroke={edge} strokeWidth={1.2} />
      <g fill={edge} opacity={0.5}>{windows(seed)}</g>
    </svg>
  )
}

/** Crossed steel I-beams over a ruined skyline, lower-left corner of a 600×600 box (mirror for the right). */
function Girders() {
  const beam = (x1: number, y1: number, x2: number, y2: number, w: number, k: number) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const nx = -Math.sin(a) * w
    const ny = Math.cos(a) * w
    const len = Math.hypot(x2 - x1, y2 - y1)
    const lattice = Array.from({ length: Math.floor(len / (w * 2.4)) }, (_, j) => {
      const t0 = (j * w * 2.4) / len
      const t1 = ((j + 1) * w * 2.4) / len
      const p = (t: number, s: number) => `${(x1 + (x2 - x1) * t + nx * s).toFixed(1)} ${(y1 + (y2 - y1) * t + ny * s).toFixed(1)}`
      return `M${p(t0, -1)} L${p(t1, 1)} M${p(t1, -1)} L${p(t1, 1)}`
    }).join(' ')
    return (
      <g key={k}>
        <path d={`M${x1 + nx} ${y1 + ny} L${x2 + nx} ${y2 + ny} L${x2 - nx} ${y2 - ny} L${x1 - nx} ${y1 - ny} Z`} fill="#07060b" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="1.2" />
        <path d={lattice} fill="none" stroke="#f5b942" strokeOpacity="0.16" strokeWidth="0.8" />
      </g>
    )
  }
  return (
    <svg viewBox="0 0 600 600" preserveAspectRatio="xMinYMax meet" className="h-full w-full overflow-visible" aria-hidden="true">
      {/* Ruined towers: broken tops, a few lit windows. */}
      <path
        d="M0 600 V330 L40 320 L52 290 L70 335 L110 340 V250 L128 236 L140 262 L172 258 V600 Z M190 600 V380 L230 372 L238 350 L262 384 L290 390 V600 Z"
        fill="#06050a"
        stroke="#f5b942"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      <g fill="#d97706" opacity="0.35">
        {[[20, 380], [86, 410], [128, 300], [146, 470], [214, 430], [260, 500]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="7" height="12" />
        ))}
      </g>
      {beam(-40, 560, 470, 70, 9, 0)}
      {beam(-20, 250, 360, 520, 7, 1)}
      {beam(150, 600, 330, 150, 6, 2)}
    </svg>
  )
}

/** Left half of the dark soul gem (500×1000, mirrored): orb finial, collar, drooping wing shell, glowing core, pedestal. */
function ArchHalf({ flip }: { flip?: boolean }) {
  const rim = { stroke: '#c084fc', strokeOpacity: 0.35, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const }
  return (
    <svg viewBox="0 0 500 1000" preserveAspectRatio="xMaxYMid meet" className="h-full w-full" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <defs>
        <linearGradient id="gem-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d1828" />
          <stop offset="0.35" stopColor="#09080d" />
          <stop offset="0.75" stopColor="#030304" />
          <stop offset="1" stopColor="#14111c" />
        </linearGradient>
        <radialGradient id="gem-orb" cx="0.85" cy="0.35" r="0.9">
          <stop offset="0" stopColor="#e9d5ff" />
          <stop offset="0.4" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b0764" />
        </radialGradient>
        <linearGradient id="gem-flank" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#161224" />
          <stop offset="0.5" stopColor="#08070d" />
          <stop offset="1" stopColor="#161224" />
        </linearGradient>
        <linearGradient id="gem-panel" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.35" stopColor="#4c1d95" />
          <stop offset="0.75" stopColor="#1a1030" />
          <stop offset="1" stopColor="#0b0912" />
        </linearGradient>
        <filter id="gem-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      {/* Shell with the core cut out, so the spinning crest shows through the heart */}
      <path fillRule="evenodd" d="M500 225 C430 222 340 232 250 255 C150 280 70 320 42 400 C30 440 26 510 48 552 C66 582 105 565 145 540 C185 518 215 545 235 595 C265 670 315 750 355 840 H500 Z M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790 Z" fill="url(#gem-shell)" />
      {/* Finial orb + collar */}
      <path d="M500 50 A62 62 0 0 0 500 174 Z" fill="url(#gem-orb)" />
      <path d="M500 168 H456 C440 182 438 214 456 230 H500 Z" fill="url(#gem-shell)" />
      {/* Arm bridge over the core's shoulder */}
      <path d="M500 255 C440 255 380 268 330 300 C380 296 440 304 500 322 Z" fill="url(#gem-shell)" />
      {/* Pedestal: neck ring then flared foot */}
      <path d="M500 835 H350 C335 850 335 870 352 882 H500 Z" fill="url(#gem-shell)" />
      <path d="M500 880 H330 C290 900 255 935 245 975 L240 1000 H500 Z" fill="url(#gem-shell)" />
      {/* Open rim lines only, so no seam is drawn down the centre */}
      <g fill="none" {...rim}>
        <path d="M500 50 A62 62 0 0 0 500 174 M456 168 C440 182 438 214 456 230" />
        <path d="M500 225 C430 222 340 232 250 255 C150 280 70 320 42 400 C30 440 26 510 48 552 C66 582 105 565 145 540 C185 518 215 545 235 595 C265 670 315 750 355 840" />
        <path d="M500 255 C440 255 380 268 330 300 C380 296 440 304 500 322" />
        <path d="M350 835 C335 850 335 870 352 882 M330 880 C290 900 255 935 245 975 L240 1000" />
      </g>
      {/* Core rim: gold edge with violet bloom, framing the crest */}
      <path d="M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790" fill="none" stroke="#a855f7" strokeOpacity="0.25" strokeWidth="10" filter="url(#gem-glow)" />
      <path d="M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790" fill="none" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {/* Lower side panel filling the gap under the wing: violet-lit outer edge fading to obsidian */}
      <path d="M48 552 C175 585 305 700 352 882 L355 840 C315 750 265 670 235 595 C215 545 185 518 145 540 C105 565 66 582 48 552 Z" fill="url(#gem-panel)" />
      <path d="M48 552 C175 585 305 700 352 882" fill="none" stroke="#a855f7" strokeOpacity="0.45" strokeWidth="12" filter="url(#gem-glow)" />
      <path d="M48 552 C175 585 305 700 352 882" fill="none" stroke="rgba(216, 180, 254, 0.5)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {/* Purple crystal plate set into each tapering flank, below the wing */}
      <path d="M218 550 C242 582 260 627 280 672 C307 737 337 792 362 830 L405 796 C372 756 346 700 326 645 C311 600 296 566 272 542 Z" fill="url(#gem-flank)" stroke="rgba(168, 85, 247, 0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d="M245 560 C275 620 305 700 382 812" fill="none" stroke="#f5f3ff" strokeOpacity="0.08" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {/* Violet sheen on the wing lobe and the tapering flank, like light caught on lacquer */}
      <g fill="none" stroke="rgba(168, 85, 247, 0.35)" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M200 285 C130 310 78 345 62 405" strokeOpacity="1" strokeWidth="2" />
      </g>
      {/* Specular highlights */}
      <g fill="none" stroke="#f5f3ff" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M410 240 C320 245 200 275 110 340" strokeOpacity="0.22" strokeWidth="2" />
        <path d="M60 420 C52 460 52 500 56 530" strokeOpacity="0.12" strokeWidth="1.5" />
        <path d="M470 95 A40 40 0 0 0 450 75" strokeOpacity="0.5" strokeWidth="3" />
        <path d="M290 905 C270 925 262 950 258 975" strokeOpacity="0.15" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

/* ── Canvas layer: falling obsidian feathers and rising embers; swirls into the smoke as `progress` → 1. ── */
const FEATHER = (() => {
  // Unit feather pointing down: quill from (0,-0.5) to (0,0.5), wider left vane, notched edges.
  const p = new Path2D()
  p.moveTo(0, -0.5)
  p.bezierCurveTo(-0.2, -0.38, -0.24, -0.05, -0.17, 0.12)
  p.lineTo(-0.11, 0.1)
  p.bezierCurveTo(-0.14, 0.24, -0.08, 0.36, 0.01, 0.5)
  p.bezierCurveTo(0.09, 0.34, 0.12, 0.16, 0.11, -0.02)
  p.lineTo(0.07, -0.04)
  p.bezierCurveTo(0.12, -0.22, 0.08, -0.38, 0, -0.5)
  p.closePath()
  const q = new Path2D()
  q.moveTo(0.015, 0.58)
  q.quadraticCurveTo(-0.03, 0, 0, -0.5)
  return { vane: p, quill: q }
})()

function useParticleCanvas(canvas: React.RefObject<HTMLCanvasElement | null>, progress: React.RefObject<number>) {
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0
    let h = 0
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = c.clientWidth
      h = c.clientHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const feathers = Array.from({ length: 30 }, (_, i) => {
      const z = i % 3 // 0 far, 2 near
      return { x: Math.random(), y: Math.random(), z, size: [30, 46, 72][z] * rnd(0.8, 1.2), vy: [0.018, 0.028, 0.045][z] * rnd(0.8, 1.2), ph: rnd(0, 6.28), sway: rnd(0.4, 0.9), tilt: rnd(-0.6, 0.6) }
    })
    const embers = Array.from({ length: 40 }, () => ({ x: Math.random(), y: rnd(0.55, 1.05), r: rnd(0.7, 2), vy: rnd(0.02, 0.05), ph: rnd(0, 6.28), gold: Math.random() < 0.6 }))
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = progress.current ?? 0
      ctx.clearRect(0, 0, w, h)
      if (p >= 0.85) return
      const fade = 1 - Math.min(1, Math.max(0, (p - 0.45) / 0.35))
      const swirl = Math.min(1, p / 0.5)
      const cx = w / 2
      const cy = h / 2
      const toward = (x: number, y: number, k: number) => {
        // Spiral around the centre, flung outward with the smoke.
        const dx = x - cx
        const dy = y - cy
        const r = Math.hypot(dx, dy) || 1
        const a = Math.atan2(dy, dx) + swirl * swirl * k
        const rr = r * (1 + swirl * 0.6)
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]
      }
      const t = now / 1000

      for (const f of feathers) {
        f.y += f.vy * dt
        if (f.y > 1.1) {
          f.y = -0.1
          f.x = Math.random()
        }
        const bx = (f.x + Math.sin(t * f.sway + f.ph) * 0.03) * w
        const [x, y] = toward(bx, f.y * h, 2.4 + f.z * 0.6)
        const roll = Math.cos(t * (1.2 + f.z * 0.3) + f.ph) // 3D flutter: squash across the quill
        ctx.save()
        ctx.globalAlpha = fade * [0.7, 0.85, 1][f.z]
        ctx.translate(x, y)
        ctx.rotate(f.tilt + Math.sin(t * f.sway * 1.3 + f.ph) * 0.45 + swirl * 3)
        ctx.scale(f.size * (0.25 + 0.75 * Math.abs(roll)), f.size)
        ctx.lineWidth = 1.6 / f.size
        ctx.fillStyle = '#090812'
        ctx.fill(FEATHER.vane)
        ctx.strokeStyle = roll > 0 ? 'rgba(124, 58, 237, 0.45)' : 'rgba(225, 29, 72, 0.25)'
        ctx.stroke(FEATHER.vane)
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)'
        ctx.stroke(FEATHER.quill)
        ctx.restore()
      }

      for (const e of embers) {
        e.y -= e.vy * dt
        if (e.y < 0.35) {
          e.y = rnd(0.95, 1.05)
          e.x = Math.random()
        }
        const life = Math.min(1, (e.y - 0.35) / 0.3)
        const [x, y] = toward((e.x + Math.sin(t * 0.8 + e.ph) * 0.01) * w, e.y * h, 3.2)
        const flick = 0.6 + 0.4 * Math.sin(t * 6 + e.ph)
        const col = e.gold ? '245, 185, 66' : '225, 29, 72'
        ctx.fillStyle = `rgba(${col}, ${(0.18 * life * flick * fade).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, y, e.r * 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(${col}, ${(0.9 * life * flick * fade).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [canvas, progress])
}

function SoulGemSeal() {
  return (
    <svg viewBox="-200 -200 400 400" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id="orb-body" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#3b1d6e" />
          <stop offset="0.35" stopColor="#140a26" />
          <stop offset="0.8" stopColor="#050507" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id="orb-rim" cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stopColor="#7c3aed" stopOpacity="0" />
          <stop offset="0.96" stopColor="#9333ea" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f5b942" stopOpacity="0.3" />
        </radialGradient>
        <linearGradient id="orb-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e879f9" />
          <stop offset="0.5" stopColor="#c026d3" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="gem-heart" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#c026d3" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#7c3aed" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <path id="rune-ring" d="M0,-168 a168,168 0 1,1 -0.01,0" />
      </defs>
      <circle r="190" fill="none" stroke="#f5b942" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle r="178" fill="none" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="1.4" strokeDasharray="2 6" />
      <text fill="#f5b942" fillOpacity="0.7" fontSize="13">
        <textPath href="#rune-ring" textLength="1050" lengthAdjust="spacing">{RUNES + RUNES}</textPath>
      </text>
      <circle r="150" fill="url(#orb-body)" />
      <circle r="150" fill="url(#orb-rim)" />
      <g stroke="#f5b942" strokeOpacity="0.5" strokeWidth="0.8" fill="none">
        <polygon points="0,-118 102,59 -102,59" />
        <polygon points="0,118 102,-59 -102,-59" />
      </g>
      <ellipse rx="70" ry="95" fill="url(#gem-heart)" />
      <path d="M0 -62 L34 -10 L0 66 L-34 -10 Z" fill="url(#gem)" stroke="#f5b942" strokeWidth="1.5" />
      <path d="M-34 -10 L34 -10 M0 -62 L0 66" stroke="#fde68a" strokeOpacity="0.4" strokeWidth="0.8" />
      <ellipse cx="-38" cy="-78" rx="70" ry="34" fill="url(#orb-gloss)" transform="rotate(-24 -38 -78)" />
    </svg>
  )
}

const SMOKE = [
  { c: '#7c3aed', x: -18, y: -8, s: 46, r: -40 },
  { c: '#9333ea', x: 16, y: 10, s: 52, r: 35 },
  { c: '#e11d48', x: 4, y: -18, s: 38, r: 70 },
  { c: '#7c3aed', x: -6, y: 18, s: 60, r: -80 },
  { c: '#581c87', x: 22, y: -14, s: 44, r: 20 },
  { c: '#e11d48', x: -24, y: 14, s: 34, r: -20 },
]

export function EntranceSequence({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const lenis = useRef<Lenis | null>(null)
  const state = useRef({ active, onComplete })
  const canvas = useRef<HTMLCanvasElement>(null)
  const progress = useRef(0)
  useParticleCanvas(canvas, progress)
  useEffect(() => {
    state.current = { active, onComplete }
  }, [active, onComplete])

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.2
        const dist = 30 + ((i * 17) % 25)
        return { dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, size: 3 + (i % 4) * 2, gold: i % 4 === 0 }
      }),
    [],
  )

  useEffect(() => {
    const wrap = wrapper.current!
    const inner = content.current!
    const l = new Lenis({ wrapper: wrap, content: inner, lerp: 0.09, smoothWheel: true })
    lenis.current = l
    l.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => l.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none' } })
      tl.to('[data-hero-text]', { yPercent: -60, opacity: 0, letterSpacing: '0.4em', duration: 0.35 }, 0)
        .to('[data-hero-cta]', { opacity: 0, y: 30, duration: 0.15 }, 0)
        .to('[data-orb]', { scale: 2.4, rotate: 40, opacity: 0, filter: 'blur(18px)', duration: 0.5, ease: 'power1.in' }, 0.08)
        .to('[data-seal-lizard]', { x: (i) => (i ? -70 : 70), y: (i) => (i ? 50 : -50), scale: 1.5, opacity: 0, transformOrigin: '50% 50%', duration: 0.4, ease: 'power2.in' }, 0.06)
        .fromTo('[data-smoke]', { scale: 0.2, opacity: 0 }, { scale: 4.5, opacity: 0.6, rotate: (i) => SMOKE[i].r, duration: 0.45, stagger: 0.03, ease: 'power2.out' }, 0.15)
        .to('[data-smoke]', { opacity: 0, duration: 0.3, stagger: 0.02 }, 0.62)
        .fromTo('[data-particle]', { x: 0, y: 0, opacity: 0 }, { x: (i) => `${particles[i].dx}vmax`, y: (i) => `${particles[i].dy}vmax`, opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.2)
        .to('[data-particle]', { opacity: 0, duration: 0.2 }, 0.6)
        .fromTo('[data-ring]', { scale: 0.3, opacity: 0 }, { scale: (i) => 3 + i * 1.5, opacity: 0.9, rotate: (i) => (i % 2 ? -90 : 90), duration: 0.5, stagger: 0.06 }, 0.22)
        .to('[data-ring]', { opacity: 0, duration: 0.2 }, 0.7)
        .to('[data-plane="far-l"]', { xPercent: -45, yPercent: 15, scale: 1.1, duration: 0.8 }, 0.1)
        .to('[data-plane="far-r"]', { xPercent: 45, yPercent: 15, scale: 1.1, duration: 0.8 }, 0.1)
        .to('[data-plane="near-l"]', { xPercent: -110, yPercent: 35, scale: 1.3, duration: 0.7 }, 0.05)
        .to('[data-plane="near-r"]', { xPercent: 110, yPercent: 35, scale: 1.3, duration: 0.7 }, 0.05)
        .to('[data-plane]', { opacity: 0, duration: 0.2 }, 0.8)
        .to('[data-backdrop]', { opacity: 0, duration: 0.3 }, 0.7)
        .to('[data-girder="l"]', { xPercent: -80, yPercent: 25, scale: 1.2, duration: 0.75 }, 0.08)
        .to('[data-girder="r"]', { xPercent: 80, yPercent: 25, scale: 1.2, duration: 0.75 }, 0.08)
        .to('[data-arch="l"]', { xPercent: -100, scale: 1.15, duration: 0.65, ease: 'power1.in' }, 0.02)
        .to('[data-arch="r"]', { xPercent: 100, scale: 1.15, duration: 0.65, ease: 'power1.in' }, 0.02)
        .to('[data-girder], [data-arch], [data-particles]', { opacity: 0, duration: 0.15 }, 0.72)

      ScrollTrigger.create({
        scroller: wrap,
        trigger: inner,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        animation: tl,
        onUpdate: (self) => {
          // Whoosh once as the orb dissolves into smoke (scrolling forward past 12%).
          if (progress.current < 0.12 && self.progress >= 0.12) playSmokeWhoosh()
          progress.current = self.progress
          if (self.progress > 0.995 && state.current.active) state.current.onComplete()
        },
      })
    }, wrap)

    // Returning visitor this session: start already scrolled past the hero.
    if (!state.current.active) l.scrollTo('bottom', { immediate: true, force: true })

    return () => {
      ctx.revert()
      gsap.ticker.remove(raf)
      l.destroy()
      lenis.current = null
    }
  }, [particles])

  // Replay: smooth-scroll back to the hero.
  useEffect(() => {
    if (active && wrapper.current && wrapper.current.scrollTop > 0) lenis.current?.scrollTo(0, { duration: 1.6, force: true })
  }, [active])

  const enter = () => lenis.current?.scrollTo('bottom', { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 3) })

  return (
    <div
      ref={wrapper}
      className="fixed inset-0 z-30 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      aria-hidden={!active}
    >
      <div ref={content} className="h-[200vh]">
        <section className="sticky top-0 h-screen w-full overflow-hidden" aria-label="Intro">
          <div data-backdrop className="absolute inset-0 bg-[#050507]" />
          <div data-backdrop className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.16),transparent_60%)]" />

          {/* Smoldering horizon: bottom third only, so the sky behind the title stays obsidian. */}
          <div
            data-backdrop
            className="absolute inset-x-0 bottom-0 h-[42%]"
            style={{
              background:
                'radial-gradient(ellipse 70% 90% at 50% 100%, rgba(217,119,6,0.32), rgba(153,27,27,0.28) 40%, rgba(124,58,237,0.12) 70%, transparent 100%), linear-gradient(to top, rgba(153,27,27,0.22), transparent)',
            }}
          />

          {/* Far plane */}
          <div data-plane="far-l" className="absolute bottom-0 left-0 h-[85%] w-[38%] opacity-70">
            <Spires seed={3} fill="#120b20" edge="#3b2560" />
          </div>
          <div data-plane="far-r" className="absolute bottom-0 right-0 h-[85%] w-[38%] opacity-70">
            <Spires seed={7} fill="#120b20" edge="#3b2560" flip />
          </div>

          {/* Midground: crossed girders over ruined towers */}
          <div data-girder="l" className="absolute bottom-0 left-0 h-[72%] w-[50%] origin-bottom-left">
            <Girders />
          </div>
          <div data-girder="r" className="absolute bottom-0 right-0 h-[72%] w-[50%] origin-bottom-right">
            <div className="h-full w-full -scale-x-100">
              <Girders />
            </div>
          </div>

          {/* Foreground: soul gem shell; the crest sits on top, inside its heart */}
          <div data-arch="l" className="pointer-events-none absolute inset-y-0 left-0 w-1/2 origin-left">
            <ArchHalf />
          </div>
          <div data-arch="r" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 origin-right">
            <ArchHalf flip />
          </div>

          {/* Seal, smoke, particles, rings, centred on the gem heart */}
          <div className="absolute inset-0 flex items-center justify-center pt-[9vh]">
            {SMOKE.map((s, i) => (
              <div
                key={i}
                data-smoke
                className="absolute h-[30vmax] w-[30vmax] rounded-full opacity-0 blur-3xl"
                style={{ background: `radial-gradient(circle, ${s.c}cc 0%, ${s.c}55 35%, transparent 68%)`, transform: `translate(${s.x}vmax, ${s.y}vmax)`, width: `${s.s}vmax`, height: `${s.s}vmax` }}
              />
            ))}
            {[0, 1, 2].map((i) => (
              <svg key={i} data-ring viewBox="-100 -100 200 200" className="absolute h-[22vmin] w-[22vmin] opacity-0" aria-hidden="true">
                <circle r="96" fill="none" stroke="#f5b942" strokeWidth="1" strokeDasharray={i === 1 ? '1 5' : '14 4 2 4'} />
                <circle r="86" fill="none" stroke="#f5b942" strokeOpacity="0.5" strokeWidth="0.6" />
              </svg>
            ))}
            {particles.map((p, i) => (
              <span
                key={i}
                data-particle
                className="absolute rounded-full opacity-0 blur-[1px]"
                style={{ width: p.size, height: p.size, background: p.gold ? '#f5b942' : '#c084fc', boxShadow: `0 0 12px ${p.gold ? '#f5b942' : '#9333ea'}` }}
              />
            ))}
            <div data-orb className="relative h-[min(52vmin,460px)] w-[min(52vmin,460px)] drop-shadow-[0_0_60px_rgba(124,58,237,0.45)]">
              <SoulGemSeal />
              {/* Twin lizards ring the gem core, under the title; kept dim so the serif stays crisp. */}
              <div className="pointer-events-none absolute inset-[12.5%] opacity-80">
                <TwinLizardSeal period={35} />
              </div>
            </div>
          </div>

          {/* Near plane */}
          <div data-plane="near-l" className="absolute -bottom-[5%] -left-[6%] h-[70%] w-[30%]">
            <Spires seed={11} fill="#06050a" edge="#f5b94233" />
          </div>
          <div data-plane="near-r" className="absolute -bottom-[5%] -right-[6%] h-[70%] w-[30%]">
            <Spires seed={5} fill="#06050a" edge="#f5b94233" flip />
          </div>

          {/* Falling feathers and rising embers, behind the title */}
          <canvas ref={canvas} data-particles className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

          {/* Editorial type */}
          <div data-hero-text className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center" style={{ fontFamily: SERIF }}>
            <h1 className="text-[clamp(3.2rem,13vw,11rem)] leading-[0.85] font-light tracking-[0.04em] text-[#f7f1e3] mix-blend-difference">
              BRYANT
              <br />
              LEUNG
            </h1>
            <p className="mt-6 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(5,5,7,0.8),rgba(5,5,7,0.4)_55%,transparent_75%)] px-10 py-3 text-[clamp(0.7rem,1.6vw,1rem)] tracking-[0.5em] text-[#f5b942]">COMPUTER SCIENCE &amp; AI ENGINEER</p>
          </div>

          <div data-hero-cta className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={enter}
              className="rounded-full border border-[#f5b942]/50 bg-[#0b0914]/50 px-6 py-2.5 text-xs tracking-[0.35em] text-[#f5b942] backdrop-blur-md transition hover:border-[#e2d9f3] hover:text-[#e2d9f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
              style={{ fontFamily: SERIF }}
            >
              ENTER LABYRINTH
            </button>
            <span className="text-[10px] tracking-[0.4em] text-[#a39fbf]/60">OR SCROLL</span>
          </div>
        </section>
      </div>
    </div>
  )
}
