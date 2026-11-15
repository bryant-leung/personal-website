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

/* ── Canyon of skyscrapers in 1-point perspective. Each half uses a 500×800 box whose vanishing point (500, 400)
   sits on the viewport's centre line; `slice` keeps it there at any aspect without distorting the windows. ── */
const VP = [500, 400] as const
const BOT = 1600
const toVP = (x: number, y: number, s: number): [number, number] => [x + (VP[0] - x) * s, y + (VP[1] - y) * s]
const hash = (a: number, b: number, seed: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}
const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`

type TowerSpec = { fx: number; top: number; k: number; seed: number }

/** A tower: flat front face (x ≤ fx) and an inner side face receding to the VP by depth fraction `k`. */
function Tower({ fx, top, k, seed }: TowerSpec) {
  const cols = 13
  const zEnd = k / (1 - k) // screen fraction s = z / (z + 1): equal real spacing foreshortens toward the VP
  const s = (j: number) => {
    const z = (j / cols) * zEnd
    return z / (z + 1)
  }
  const lit: string[] = []
  const ember: string[] = []
  const dark: string[] = []
  const bucket = (i: number, j: number) => {
    const r = hash(i, j, seed)
    return r > 0.93 ? lit : r > 0.87 ? ember : r > 0.35 ? dark : null
  }
  for (let y = top + 14, i = 0; y < 900; y += 15, i++) {
    for (let j = 0; j < cols; j++) {
      const b = bucket(i, j)
      if (!b) continue
      const s0 = s(j + 0.3)
      const s1 = s(j + 0.7)
      b.push(`M${pt(toVP(fx, y, s0))} L${pt(toVP(fx, y, s1))} L${pt(toVP(fx, y + 7, s1))} L${pt(toVP(fx, y + 7, s0))}Z`)
    }
    for (let x = fx - 14, j = 100; x > 0; x -= 12, j++) {
      const b = bucket(i, j)
      if (b) b.push(`M${x} ${y}h5v7h-5Z`)
    }
  }
  const side = `M${fx} ${top} L${pt(toVP(fx, top, k))} L${pt(toVP(fx, BOT, k))} L${fx} ${BOT}Z`
  const gid = `side-${seed}`
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={fx} y1="0" x2={toVP(fx, top, k)[0]} y2="0">
          <stop offset="0" stopColor="#0b0709" />
          <stop offset="1" stopColor="#3a1308" />
        </linearGradient>
      </defs>
      <rect x={-200} y={top} width={fx + 200} height={BOT - top} fill="#07050a" />
      <path d={side} fill={`url(#${gid})`} />
      <path d={dark.join('')} fill="#1a0d10" />
      <path d={ember.join('')} fill="#dc2626" opacity="0.45" />
      <path d={lit.join('')} fill="#f59e0b" opacity="0.6" />
      {/* Backlit rim along the canyon-facing edges */}
      <path d={`M${fx} ${BOT} V${top} L${pt(toVP(fx, top, k))}`} fill="none" stroke="#fb923c" strokeOpacity="0.75" strokeWidth="1.4" />
      <path d={`M-200 ${top} H${fx}`} stroke="#f97316" strokeOpacity="0.35" strokeWidth="1" />
    </g>
  )
}

const TOWERS: Record<'l' | 'r', { far: TowerSpec[]; near: TowerSpec }> = {
  l: { far: [{ fx: 360, top: 330, k: 0.62, seed: 1 }, { fx: 285, top: 255, k: 0.5, seed: 2 }], near: { fx: 160, top: 150, k: 0.4, seed: 3 } },
  r: { far: [{ fx: 350, top: 310, k: 0.6, seed: 4 }, { fx: 270, top: 230, k: 0.5, seed: 5 }], near: { fx: 175, top: 175, k: 0.38, seed: 6 } },
}

function HalfSvg({ flip, children }: { flip?: boolean; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 500 800" preserveAspectRatio="xMaxYMid slice" className="h-full w-full" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      {children}
    </svg>
  )
}

function Skyline({ side, layer }: { side: 'l' | 'r'; layer: 'far' | 'near' }) {
  const t = TOWERS[side]
  return <HalfSvg flip={side === 'r'}>{layer === 'far' ? t.far.map((s) => <Tower key={s.seed} {...s} />) : <Tower {...t.near} />}</HalfSvg>
}

/** Steel lattice truss between two points: twin chords, zig-zag web, warm rim on the sky-facing chord. */
function truss(x1: number, y1: number, x2: number, y2: number, w: number) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const nx = (-(y2 - y1) / len) * w
  const ny = ((x2 - x1) / len) * w
  const n = Math.max(2, Math.round(len / (w * 2)))
  const at = (t: number, sgn: number) => `${(x1 + (x2 - x1) * t + nx * sgn).toFixed(1)} ${(y1 + (y2 - y1) * t + ny * sgn).toFixed(1)}`
  let web = ''
  for (let j = 0; j < n; j++) web += `M${at(j / n, -1)} L${at((j + 0.5) / n, 1)} L${at((j + 1) / n, -1)}`
  return (
    <g>
      <path d={web} fill="none" stroke="#0a0608" strokeWidth="1.6" />
      <path d={web} fill="none" stroke="#f59e0b" strokeOpacity="0.22" strokeWidth="0.6" />
      <path d={`M${at(0, 1)} L${at(1, 1)}`} stroke="#0a0608" strokeWidth="2.4" />
      <path d={`M${at(0, -1)} L${at(1, -1)}`} stroke="#0a0608" strokeWidth="2.4" />
      <path d={`M${at(0, -1)} L${at(1, -1)}`} stroke="#fbbf24" strokeOpacity="0.7" strokeWidth="0.9" />
    </g>
  )
}

/** Rooftop tower crane: mast, jib cantilevered inward over the canyon, counter-jib and stay cables. */
function Cranes({ side }: { side: 'l' | 'r' }) {
  const { near, far } = TOWERS[side]
  const crane = (x: number, roof: number, mast: number, reach: number, rise: number, k: number) => {
    const top = roof - mast
    return (
      <g key={k}>
        {truss(x, roof, x, top, 5)}
        {truss(x, top, x + reach, top - rise, 4)}
        {truss(x, top, x - reach * 0.3, top + rise * 0.15, 3.5)}
        <rect x={x - reach * 0.3 - 10} y={top + rise * 0.15 - 4} width="16" height="12" fill="#07050a" stroke="#f97316" strokeOpacity="0.4" strokeWidth="0.8" />
        <path d={`M${x} ${top - 40} L${x + reach * 0.95} ${top - rise * 0.95} M${x} ${top - 40} L${x + reach * 0.5} ${top - rise * 0.5} M${x} ${top - 40} L${x - reach * 0.3} ${top + rise * 0.15} M${x} ${top - 40} V${top}`} stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="0.6" />
        <path d={`M${x + reach * 0.7} ${top - rise * 0.7} v${mast * 0.6}`} stroke="#1a0d10" strokeWidth="0.8" />
      </g>
    )
  }
  return (
    <HalfSvg flip={side === 'r'}>
      {crane(near.fx - 50, near.top, 120, 330, 150, 0)}
      {crane(far[1].fx - 30, far[1].top, 70, 170, 50, 1)}
    </HalfSvg>
  )
}

/* ── Clockwork floor: toothed gears laid flat and foreshortened with CSS 3D. ── */
function gearPath(cx: number, cy: number, r: number, teeth: number) {
  const ri = r * 0.86
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    const p = (rad: number, ang: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`
    d += `${i ? 'L' : 'M'}${p(ri, a)} L${p(r, a + step * 0.15)} L${p(r, a + step * 0.45)} L${p(ri, a + step * 0.6)}`
  }
  d += 'Z'
  // Hub hole and spoke windows (even-odd)
  const hub = r * 0.18
  d += `M${cx + hub} ${cy} A${hub} ${hub} 0 1 0 ${cx - hub} ${cy} A${hub} ${hub} 0 1 0 ${cx + hub} ${cy}Z`
  const ro = r * 0.68
  const rn = r * 0.3
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2 + 0.2
    const a1 = a0 + Math.PI * 2 * 0.13
    d += `M${cx + Math.cos(a0) * rn} ${cy + Math.sin(a0) * rn} L${cx + Math.cos(a0) * ro} ${cy + Math.sin(a0) * ro} A${ro} ${ro} 0 0 1 ${cx + Math.cos(a1) * ro} ${cy + Math.sin(a1) * ro} L${cx + Math.cos(a1) * rn} ${cy + Math.sin(a1) * rn}Z`
  }
  return d
}

const GEARS = [
  [800, 330, 260, 40],
  [430, 240, 150, 24],
  [1180, 260, 180, 28],
  [180, 420, 120, 18],
  [1440, 430, 140, 20],
  [620, 560, 90, 14],
  [1010, 580, 110, 16],
] as const

function GearFloor() {
  return (
    <div data-backdrop className="pointer-events-none absolute inset-x-0 bottom-0 h-[15%] overflow-hidden" style={{ perspective: '420px' }}>
      <div className="absolute inset-x-[-40%] bottom-0 h-[300%]" style={{ transform: 'rotateX(68deg)', transformOrigin: '50% 100%' }}>
        <svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="gear-metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a2430" />
              <stop offset="0.5" stopColor="#100d14" />
              <stop offset="1" stopColor="#221c26" />
            </linearGradient>
          </defs>
          <rect width="1600" height="700" fill="#08070a" />
          {GEARS.map(([x, y, r, n], i) => (
            <path key={i} d={gearPath(x, y, r, n)} fillRule="evenodd" fill="url(#gear-metal)" stroke="#f59e0b" strokeOpacity="0.18" strokeWidth="2" />
          ))}
        </svg>
      </div>
      {/* Specular pools: the fire above reflected in polished brass */}
      <div className="absolute bottom-[10%] left-[28%] h-[45%] w-[18%] opacity-40 mix-blend-screen" style={{ background: 'radial-gradient(closest-side, #dc2626, transparent)' }} />
      <div className="absolute bottom-[25%] left-[46%] h-[40%] w-[14%] opacity-35 mix-blend-screen" style={{ background: 'radial-gradient(closest-side, #f59e0b, transparent)' }} />
      <div className="absolute bottom-[5%] right-[22%] h-[50%] w-[16%] opacity-30 mix-blend-screen" style={{ background: 'radial-gradient(closest-side, #dc2626, transparent)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050507] via-transparent to-[#050507]/60" />
    </div>
  )
}

/* ── Firestorm sky: layered gradients only. ── */
function FireSky() {
  return (
    <>
      <div
        data-backdrop
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 30% 26% at 50% 46%, #fde68a 0%, #f59e0b 30%, rgba(234,88,12,0.0) 75%), radial-gradient(ellipse 75% 65% at 50% 42%, #ea580c 0%, #b91c1c 40%, #991b1b 60%, transparent 85%), linear-gradient(to bottom, #14070a 0%, #5c1010 30%, #991b1b 50%, #2a0a0a 78%, #050507 100%)',
        }}
      />
      {/* Flame core and smoky corners as plain gradients: no full-screen SVG filters to rasterize */}
      <div
        data-backdrop
        className="absolute inset-0 opacity-55 mix-blend-screen"
        style={{ background: 'radial-gradient(ellipse 34% 30% at 46% 40%, rgba(255,140,30,0.9), transparent 70%), radial-gradient(ellipse 28% 34% at 56% 50%, rgba(255,110,20,0.75), transparent 70%)' }}
      />
      <div
        data-backdrop
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 35%, rgba(20,8,10,0.75) 75%, rgba(10,4,6,0.95) 100%)' }}
      />
      {/* Atmospheric shadow under the title and tagline */}
      <div
        data-backdrop
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 42% 34% at 50% 52%, rgba(5,5,7,0.62), rgba(5,5,7,0.3) 55%, transparent 80%)' }}
      />
    </>
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
      <path d="M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790" fill="none" stroke="#a855f7" strokeOpacity="0.06" strokeWidth="40" strokeLinecap="round" />
      <path d="M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790" fill="none" stroke="#a855f7" strokeOpacity="0.12" strokeWidth="18" strokeLinecap="round" />
      <path d="M500 300 C430 290 350 305 300 340 C270 440 285 580 340 670 C390 740 450 770 500 790" fill="none" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {/* Lower side panel filling the gap under the wing: violet-lit outer edge fading to obsidian */}
      <path d="M48 552 C175 585 305 700 352 882 L355 840 C315 750 265 670 235 595 C215 545 185 518 145 540 C105 565 66 582 48 552 Z" fill="url(#gem-panel)" />
      <path d="M48 552 C175 585 305 700 352 882" fill="none" stroke="#a855f7" strokeOpacity="0.1" strokeWidth="40" strokeLinecap="round" />
      <path d="M48 552 C175 585 305 700 352 882" fill="none" stroke="#a855f7" strokeOpacity="0.2" strokeWidth="16" strokeLinecap="round" />
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
  // Frayed barbs: short strands poking past the vane edge, charred and catching fire.
  const b = new Path2D()
  for (let i = 0; i < 9; i++) {
    const y = -0.36 + i * 0.09
    const side = i % 2 ? 1 : -1
    const reach = side < 0 ? 0.24 : 0.16
    b.moveTo(0, y)
    b.quadraticCurveTo(side * reach * 0.6, y + 0.02, side * reach, y + 0.07)
  }
  return { vane: p, quill: q, barbs: b }
})()

/** Sprite size in px; the feather path spans about ±0.6 units, so 0.6 × scale fits with glow room. */
const SPRITE = 128
const SPRITE_SCALE = 72

/** Burning feathers baked once: obsidian vane, layered crimson/amber glow, glowing barb tips. */
function bakeFeatherSprites() {
  const tints = [
    ['220, 38, 38', '249, 115, 22'],
    ['239, 68, 68', '251, 146, 60'],
    ['190, 18, 60', '245, 158, 11'],
    ['225, 29, 72', '253, 186, 116'],
  ]
  return tints.map(([outer, inner]) => {
    const c = document.createElement('canvas')
    c.width = c.height = SPRITE
    const g = c.getContext('2d')!
    g.translate(SPRITE / 2, SPRITE / 2)
    g.scale(SPRITE_SCALE, SPRITE_SCALE)
    g.lineCap = 'round'
    g.lineWidth = 1.6 / SPRITE_SCALE
    g.shadowColor = 'rgba(254, 240, 138, 0.9)'
    g.shadowBlur = 4
    g.strokeStyle = `rgba(${inner}, 0.8)`
    g.stroke(FEATHER.barbs)
    g.fillStyle = '#09070d'
    g.shadowColor = `rgba(${outer}, 0.9)`
    g.shadowBlur = 16
    g.fill(FEATHER.vane)
    g.shadowColor = `rgba(${inner}, 1)`
    g.shadowBlur = 6
    g.fill(FEATHER.vane)
    g.shadowBlur = 0
    g.lineWidth = 1 / SPRITE_SCALE
    g.strokeStyle = `rgba(${inner}, 0.35)`
    g.stroke(FEATHER.quill)
    return c
  })
}

function ParticleCanvas({ progress }: { progress: React.RefObject<number> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0
    let dpr = 1
    let h = 0
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      w = c.clientWidth
      h = c.clientHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const sprites = bakeFeatherSprites()
    const feathers = Array.from({ length: 30 }, (_, i) => {
      const z = i % 3 // 0 far, 2 near
      return { x: Math.random(), y: Math.random(), z, size: [30, 46, 72][z] * rnd(0.8, 1.2), vy: [0.018, 0.028, 0.045][z] * rnd(0.8, 1.2), ph: rnd(0, 6.28), sway: rnd(0.4, 0.9), tilt: rnd(-0.6, 0.6), sprite: i % sprites.length }
    })
    // Ash and sparks: swirl up and diagonally across the whole viewport.
    const sparks = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.6, 1.9), vx: rnd(0.01, 0.05) * (Math.random() < 0.5 ? -1 : 1), vy: rnd(0.03, 0.08), ph: rnd(0, 6.28), curl: rnd(0.02, 0.05), col: Math.random() < 0.35 ? '220, 38, 38' : Math.random() < 0.5 ? '249, 115, 22' : '254, 215, 102' }))
    // Detonation burst: fixed rays, positioned from progress so scrubbing backwards rewinds it.
    const burst = Array.from({ length: 44 }, (_, i) => ({ a: (i / 44) * Math.PI * 2 + rnd(-0.08, 0.08), v: rnd(0.45, 1), r: rnd(1, 2.6), feather: i % 4 === 0, sprite: i % 4, spin: rnd(-4, 4), col: i % 3 === 0 ? '217, 70, 239' : i % 3 === 1 ? '249, 115, 22' : '254, 240, 138' }))
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = progress.current ?? 0
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
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
        const burn = 0.65 + 0.35 * Math.sin(t * 7 + f.ph * 3) * Math.sin(t * 3.1 + f.ph)
        const unit = f.size / SPRITE_SCALE
        const rot = f.tilt + Math.sin(t * f.sway * 1.3 + f.ph) * 0.45 + swirl * 3
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)
        const sx = unit * (0.25 + 0.75 * Math.abs(roll))
        ctx.globalAlpha = fade * [0.7, 0.85, 1][f.z] * (0.75 + 0.25 * burn)
        ctx.setTransform(dpr * cos * sx, dpr * sin * sx, -dpr * sin * unit, dpr * cos * unit, dpr * x, dpr * y)
        ctx.drawImage(sprites[f.sprite], -SPRITE / 2, -SPRITE / 2)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1

      const k = (p - 0.06) / 0.3
      if (k > 0 && k < 1) {
        const reach = Math.hypot(w, h) * 0.6 * (1 - Math.pow(1 - k, 3))
        const life = 1 - k
        for (const s of burst) {
          const x = cx + Math.cos(s.a) * reach * s.v
          const y = cy + Math.sin(s.a) * reach * s.v
          if (s.feather) {
            const rot = s.a + Math.PI / 2 + k * s.spin
            const unit = 40 / SPRITE_SCALE
            ctx.globalAlpha = life
            ctx.setTransform(dpr * Math.cos(rot) * unit, dpr * Math.sin(rot) * unit, -dpr * Math.sin(rot) * unit, dpr * Math.cos(rot) * unit, dpr * x, dpr * y)
            ctx.drawImage(sprites[s.sprite], -SPRITE / 2, -SPRITE / 2)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.globalAlpha = 1
          } else {
            ctx.strokeStyle = `rgba(${s.col}, ${(0.9 * life).toFixed(3)})`
            ctx.lineWidth = s.r
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x - Math.cos(s.a) * 26 * life, y - Math.sin(s.a) * 26 * life)
            ctx.stroke()
          }
        }
      }

      ctx.globalCompositeOperation = 'lighter'
      for (const e of sparks) {
        e.y -= e.vy * dt
        e.x += (e.vx + Math.sin(t * 1.3 + e.ph) * e.curl) * dt
        if (e.y < -0.05 || e.x < -0.05 || e.x > 1.05) {
          e.y = rnd(0.9, 1.05)
          e.x = Math.random()
        }
        const [x, y] = toward(e.x * w, e.y * h, 3.2)
        const flick = (0.55 + 0.45 * Math.sin(t * 9 + e.ph)) * fade
        ctx.fillStyle = `rgba(${e.col}, ${(0.16 * flick).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, y, e.r * 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(${e.col}, ${(0.95 * flick).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [progress])
  return <canvas ref={canvas} data-particles className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
}

function SoulGemSeal({ uid }: { uid: string }) {
  const id = (n: string) => `${uid}-${n}`
  return (
    <svg viewBox="-200 -200 400 400" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={id('orb-body')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#3b1d6e" />
          <stop offset="0.35" stopColor="#140a26" />
          <stop offset="0.8" stopColor="#050507" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id={id('orb-rim')} cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stopColor="#7c3aed" stopOpacity="0" />
          <stop offset="0.96" stopColor="#581c87" stopOpacity="0.22" />
          <stop offset="1" stopColor="#581c87" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient id={id('orb-gloss')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('gem')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e879f9" />
          <stop offset="0.5" stopColor="#c026d3" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id={id('gem-heart')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#c026d3" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#7c3aed" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <path id={id('rune-ring')} d="M0,-168 a168,168 0 1,1 -0.01,0" />
      </defs>
      <circle r="190" fill="none" stroke="#f5b942" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle r="178" fill="none" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="1.4" strokeDasharray="2 6" />
      <text fill="#f5b942" fillOpacity="0.7" fontSize="13">
        <textPath href={`#${id('rune-ring')}`} textLength="1050" lengthAdjust="spacing">{RUNES + RUNES}</textPath>
      </text>
      <circle r="150" fill={`url(#${id('orb-body')})`} />
      <circle r="150" fill={`url(#${id('orb-rim')})`} />
      <g stroke="#f5b942" strokeOpacity="0.5" strokeWidth="0.8" fill="none">
        <polygon points="0,-118 102,59 -102,59" />
        <polygon points="0,118 102,-59 -102,-59" />
      </g>
      <ellipse rx="70" ry="95" fill={`url(#${id('gem-heart')})`} />
      <path d="M0 -62 L34 -10 L0 66 L-34 -10 Z" fill={`url(#${id('gem')})`} stroke="#f5b942" strokeWidth="1.5" />
      <path d="M-34 -10 L34 -10 M0 -62 L0 66" stroke="#fde68a" strokeOpacity="0.4" strokeWidth="0.8" />
      <ellipse cx="-38" cy="-78" rx="70" ry="34" fill={`url(#${id('orb-gloss')})`} transform="rotate(-24 -38 -78)" />
    </svg>
  )
}

/** Timeline progress where the shockwave peaks. */
const DETONATION = 0.08

/** Molten wall that rises up the towers; slid up from below via yPercent. */
const INFERNO: React.CSSProperties = {
  background: 'linear-gradient(0deg, #fde68a 0%, #f97316 22%, #e11d48 48%, rgba(225, 29, 72, 0.35) 70%, transparent 100%)',
}

const SMOKE = [
  { c: '#7c3aed', x: -18, y: -8, s: 23, r: -40 },
  { c: '#9333ea', x: 16, y: 10, s: 26, r: 35 },
  { c: '#e11d48', x: 4, y: -18, s: 22, r: 70 },
  { c: '#7c3aed', x: -6, y: 18, s: 30, r: -80 },
  { c: '#581c87', x: 22, y: -14, s: 22, r: 20 },
  { c: '#e11d48', x: -24, y: 14, s: 22, r: -20 },
]

export function EntranceSequence({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const lenis = useRef<Lenis | null>(null)
  const state = useRef({ active, onComplete })
  const progress = useRef(0)
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

    // Any forward scroll commits: glide the rest of the way so the intro never stalls mid-split.
    let committed = false
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none' } })
      // Transform and opacity only, so every tween stays on the compositor.
      tl.to('[data-hero-text]', { yPercent: -60, scale: 1.15, opacity: 0, duration: 0.35 }, 0)
        .to('[data-hero-cta]', { opacity: 0, y: 30, duration: 0.15 }, 0)
        // 0–45%: fissure ignites, shockwave, orb halves part, firelight over the receding towers
        .fromTo('[data-fissure]', { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.08, ease: 'power3.out' }, 0)
        .to('[data-fissure]', { opacity: 0, scaleX: 3, duration: 0.15, ease: 'power1.in' }, 0.3)
        .to('[data-orb-half]', { x: (i) => (i ? '70vw' : '-70vw'), rotation: (i) => (i ? 14 : -14), scale: 1.8, duration: 0.39, ease: 'power2.in' }, 0.06)
        .to('[data-orb-half], [data-orb-glow]', { opacity: 0, duration: 0.12 }, 0.33)
        .to('[data-seal-lizard]', { x: (i) => (i ? -70 : 70), y: (i) => (i ? 50 : -50), scale: 1.5, opacity: 0, transformOrigin: '50% 50%', duration: 0.4, ease: 'power2.in' }, 0.06)
        .fromTo('[data-smoke]', { scale: 0.4, opacity: 0 }, { scale: 1.6, opacity: 0.45, rotation: (i) => SMOKE[i].r, duration: 0.45, stagger: 0.03, ease: 'power2.out' }, 0.15)
        .to('[data-smoke]', { opacity: 0, duration: 0.3, stagger: 0.02 }, 0.6)
        .fromTo('[data-particle]', { x: 0, y: 0, opacity: 0 }, { x: (i) => `${particles[i].dx}vmax`, y: (i) => `${particles[i].dy}vmax`, opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.2)
        .to('[data-particle]', { opacity: 0, duration: 0.2 }, 0.6)
        .fromTo('[data-ring]', { scale: 0.3, opacity: 0 }, { scale: (i) => 3 + i * 1.5, opacity: 0.9, rotation: (i) => (i % 2 ? -90 : 90), duration: 0.5, stagger: 0.06 }, 0.22)
        .to('[data-ring]', { opacity: 0, duration: 0.25 }, 0.6)
        .fromTo('[data-inferno]', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 0.6, duration: 0.3, ease: 'power2.out' }, 0.1)
        .to('[data-inferno]', { opacity: 0, duration: 0.2 }, 0.45)
        .to('[data-char]', { opacity: 0.7, duration: 0.25 }, 0.4)
        .to('[data-plane="far-l"]', { xPercent: -45, yPercent: 15, scale: 1.1, duration: 0.6 }, 0.2)
        .to('[data-plane="far-r"]', { xPercent: 45, yPercent: 15, scale: 1.1, duration: 0.6 }, 0.2)
        .to('[data-plane="near-l"]', { xPercent: -110, yPercent: 35, scale: 1.3, duration: 0.55 }, 0.18)
        .to('[data-plane="near-r"]', { xPercent: 110, yPercent: 35, scale: 1.3, duration: 0.55 }, 0.18)
        .to('[data-girder="l"]', { xPercent: -80, yPercent: 25, scale: 1.2, duration: 0.55 }, 0.2)
        .to('[data-girder="r"]', { xPercent: 80, yPercent: 25, scale: 1.2, duration: 0.55 }, 0.2)
        .to('[data-arch="l"]', { xPercent: -100, scale: 1.15, duration: 0.5, ease: 'power1.in' }, 0.04)
        .to('[data-arch="r"]', { xPercent: 100, scale: 1.15, duration: 0.5, ease: 'power1.in' }, 0.04)
        // 35–80%: portal scales in with a violet-gold bloom while the buildings fade out
        .to('[data-plane], [data-girder], [data-arch]', { opacity: 0, duration: 0.35, ease: 'power1.inOut' }, 0.45)
        .fromTo('[data-portal]', { scale: 0.6, rotation: 0, opacity: 0 }, { scale: 1.8, rotation: 180, opacity: 1, duration: 0.45, ease: 'sine.inOut' }, 0.35)
        .fromTo('[data-portal-ring]', { rotation: 0 }, { rotation: -540, duration: 0.65 }, 0.35)
        .to('[data-particles]', { opacity: 0, duration: 0.25 }, 0.6)
        // 65–100%: portal bloom and backdrop crossfade out, revealing LabyrinthNav underneath
        .to('[data-portal]', { opacity: 0, scale: 2.4, duration: 0.35, ease: 'sine.inOut' }, 0.65)
        .to('[data-backdrop]', { opacity: 0, duration: 0.35, ease: 'sine.inOut' }, 0.65)
        .fromTo('[data-veil]', { opacity: 0 }, { opacity: 0.45, duration: 0.15, ease: 'sine.inOut' }, 0.6)
        .to('[data-veil]', { opacity: 0, duration: 0.25, ease: 'sine.inOut' }, 0.75)

      ScrollTrigger.create({
        scroller: wrap,
        trigger: inner,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        animation: tl,
        onUpdate: (self) => {
          // Whoosh once at the detonation peak (scrolling forward).
          if (progress.current < DETONATION && self.progress >= DETONATION) playSmokeWhoosh()
          progress.current = self.progress
          if (self.progress < 0.005) committed = false
          else if (!committed && self.direction > 0 && state.current.active) {
            committed = true
            l.scrollTo('bottom', { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 3), lock: true, force: true })
          }
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
      style={{ pointerEvents: active ? 'auto' : 'none', opacity: active ? 1 : 0 }}
      aria-hidden={!active}
    >
      <div ref={content} className="h-[200vh]">
        <section className="sticky top-0 h-screen w-full overflow-hidden" aria-label="Intro">
          <div data-backdrop className="absolute inset-0 bg-[#050507]" />
          <FireSky />

          {/* Far plane: deeper towers of the canyon */}
          <div data-plane="far-l" className="absolute inset-y-0 left-0 w-1/2">
            <Skyline side="l" layer="far" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
          </div>
          <div data-plane="far-r" className="absolute inset-y-0 right-0 w-1/2">
            <Skyline side="r" layer="far" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
          </div>

          {/* Rooftop cranes cantilevered over the canyon */}
          <div data-girder="l" className="absolute inset-y-0 left-0 w-1/2 origin-bottom-left">
            <Cranes side="l" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
          </div>
          <div data-girder="r" className="absolute inset-y-0 right-0 w-1/2 origin-bottom-right">
            <Cranes side="r" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
          </div>

          <GearFloor />

          {/* Near plane: the towers framing the viewport */}
          <div data-plane="near-l" className="absolute inset-y-0 left-0 w-1/2">
            <Skyline side="l" layer="near" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
          </div>
          <div data-plane="near-r" className="absolute inset-y-0 right-0 w-1/2">
            <Skyline side="r" layer="near" />
            <div data-inferno className="pointer-events-none absolute inset-0 opacity-0" style={INFERNO} />
            <div data-char className="pointer-events-none absolute inset-0 bg-[#050507] opacity-0" />
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
                className="absolute h-[30vmax] w-[30vmax] rounded-full opacity-0"
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
                className="absolute rounded-full opacity-0"
                style={{ width: p.size, height: p.size, background: p.gold ? '#f5b942' : '#c084fc', boxShadow: `0 0 12px ${p.gold ? '#f5b942' : '#9333ea'}` }}
              />
            ))}
            <div data-orb className="relative h-[min(52vmin,460px)] w-[min(52vmin,460px)]">
              <div data-orb-glow className="absolute -inset-[15%] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(88,28,135,0.18), transparent)' }} />
              <div data-orb-half="l" className="will-change-transform absolute inset-0 [clip-path:inset(-20%_50%_-20%_-20%)]">
                <SoulGemSeal uid="orb-l" />
              </div>
              <div data-orb-half="r" className="will-change-transform absolute inset-0 [clip-path:inset(-20%_-20%_-20%_50%)]">
                <SoulGemSeal uid="orb-r" />
              </div>
              {/* Twin lizards ring the gem core, under the title; kept dim so the serif stays crisp. */}
              <div className="pointer-events-none absolute inset-[12.5%] opacity-80">
                <TwinLizardSeal period={35} />
              </div>
              {/* Energy fissure tearing down the seam */}
              <div
                data-fissure
                className="pointer-events-none absolute top-[-15%] left-[calc(50%-40px)] h-[130%] w-[80px] opacity-0"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(245,185,66,0.35) 30%, rgba(217,70,239,0.8) 44%, #fdf4ff 48%, #fdf4ff 52%, rgba(217,70,239,0.8) 56%, rgba(245,185,66,0.35) 70%, transparent)', maskImage: 'linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent)' }}
              />
            </div>
            <div data-portal className="pointer-events-none absolute h-[min(40vmin,360px)] w-[min(40vmin,360px)] opacity-0">
              <svg data-portal-ring viewBox="-200 -200 400 400" className="absolute inset-0 h-full w-full overflow-visible will-change-transform" aria-hidden="true">
                <defs>
                  <path id="portal-runes" d="M0,-120 a120,120 0 1,1 -0.01,0" />
                </defs>
                <circle r="132" fill="none" stroke="#f5b942" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="10 4 2 4" />
                <text fill="#f5b942" fillOpacity="0.6" fontSize="12">
                  <textPath href="#portal-runes" textLength="750" lengthAdjust="spacing">{RUNES + RUNES}</textPath>
                </text>
              </svg>
            </div>
          </div>

          {/* Dark smoke the camera passes through into the labyrinth */}
          <div
            data-veil
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{ background: '#050507' }}
          />

          {/* Falling feathers and rising embers, behind the title */}
          <ParticleCanvas progress={progress} />

          {/* Editorial type */}
          <div data-hero-text className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center" style={{ fontFamily: SERIF }}>
            <h1
              className="bg-[linear-gradient(180deg,#fdfbf7_0%,#f5ebd6_58%,#e2c484_100%)] bg-clip-text text-[clamp(3.2rem,13vw,11rem)] leading-[0.85] font-semibold tracking-[0.04em] text-transparent"
              style={{ filter: 'drop-shadow(0 8px 28px rgba(5, 5, 7, 0.95))' }}
            >
              BRYANT
              <br />
              LEUNG
            </h1>
            <div className="mt-10 flex items-center gap-2 md:mt-14 md:gap-4">
              <span className="h-px w-5 shrink-0 bg-gradient-to-r from-transparent via-[#f5b942]/60 to-transparent md:w-10" />
              <p
                className="rounded-full bg-[radial-gradient(ellipse_at_center,rgba(5,5,7,0.8),rgba(5,5,7,0.4)_55%,transparent_75%)] px-2 py-3 font-sans text-[clamp(0.62rem,1.6vw,1rem)] font-medium tracking-[0.2em] md:px-6 md:tracking-[0.28em] text-[#efe3c8] uppercase"
                style={{ textShadow: '0 2px 14px rgba(5, 5, 7, 0.98)' }}
              >
                COMPUTER SCIENCE &amp; AI ENGINEER
              </p>
              <span className="h-px w-5 shrink-0 bg-gradient-to-r from-transparent via-[#f5b942]/60 to-transparent md:w-10" />
            </div>
          </div>

          <div data-hero-cta className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={enter}
              className="rounded-full border border-[#f5b942]/70 bg-[#050507]/75 px-6 py-2.5 font-sans text-[11px] font-medium tracking-[0.28em] text-[#f7eed8] md:text-xs backdrop-blur-md transition hover:border-[#f5b942] hover:shadow-[0_0_24px_rgba(124,58,237,0.35),inset_0_0_12px_rgba(245,185,66,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2d9f3]"
              >
              ENTER LABYRINTH
            </button>
            <span className="flex flex-col items-center gap-2 font-sans text-[10px] font-medium tracking-[0.28em] text-[#cbb07a] opacity-85">
              OR SCROLL
              <span className="h-4 w-px bg-gradient-to-b from-[#f5b942]/70 to-transparent" aria-hidden="true" />
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
