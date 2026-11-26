import { createRef, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
  Hammer,
  Layers,
  Link2,
  Mail,
  Microscope,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'
import { profile, type ExperienceEntry } from '../data/profile'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { polarPt } from './lizardGeometry'
import { TwinLizardSeal } from './TwinLizardSeal'
import { playClockTick } from '../utils/soundEngine'

/* ── Motion constants: wheel and label counter-rotation must share these exactly. ── */
const TURN_MS = 900
const TURN_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const WHEEL_LOCK_MS = TURN_MS
const WHEEL_THRESHOLD = 40

/* ── Palette ── */
const GOLD = '#f5b942'
const SLATE = '#8b84b0'
const CRIMSON = '#e0457b'

const THEME_VARS: [string, string][] = [
  ['--accent', GOLD],
  ['--border', 'rgba(245, 185, 66, 0.3)'],
  ['--glow', 'rgba(245, 185, 66, 0.45)'],
  ['--text-primary', '#f7f1e3'],
  ['--text-muted', '#a39fbf'],
]

/* ── Content model ── */
interface DetailItem {
  heading?: string
  meta?: string
  text?: string
  bullets?: string[]
  links?: { label: string; href: string }[]
}

interface Action {
  label: string
  href: string
  kind: 'external' | 'mail' | 'download'
}

interface LabNode {
  id: string
  title: string
  icon: LucideIcon
  summary: string
  tags: string[]
  items: DetailItem[]
  actions: Action[]
}

interface Chapter {
  numeral: string
  title: string
  jpTitle: string
  blurb: string
  nodes: LabNode[]
}

const github = profile.socials.find((s) => s.icon === 'github')
const builds = profile.projects.filter((p) => !p.hackathon)
const hackathons = profile.projects.filter((p) => p.hackathon)
const education = profile.experience.filter((e) => e.kind === 'education')
const roles = profile.experience.filter((e) => e.kind === 'work')
const leadership = profile.experience.filter((e) => e.kind === 'leadership')
const skill = (category: string) => profile.skills.find((s) => s.category === category)?.items ?? []
const techGroups = profile.skills.filter((s) => s.category !== 'Certifications' && s.category !== 'Spoken')
const fyp = profile.projects.find((p) => p.id === 'graphrag-disaster')!
const finalYearModules = education[0]?.bullets.find((b) => b.startsWith('Final year'))
const cvAction: Action = {
  label: 'Download CV',
  href: '/Bryant-Leung-CV.pdf',
  kind: 'download',
}
const fullCvAction: Action = {
  label: 'Request full CV',
  href: `mailto:${profile.email}?subject=${encodeURIComponent('Full CV request')}`,
  kind: 'mail',
}
const mailAction: Action = { label: profile.email, href: `mailto:${profile.email}`, kind: 'mail' }

const toItem = (e: ExperienceEntry): DetailItem => ({
  heading: e.role,
  meta: `${e.org} · ${e.period}`,
  text: e.summary,
  bullets: e.bullets,
})

const CHAPTERS: Chapter[] = [
  {
    numeral: 'I',
    title: 'Profile',
    jpTitle: 'プロフィール',
    blurb: 'Who I am, where I study, and what I research.',
    nodes: [
      {
        id: 'intro',
        title: 'Intro',
        icon: User,
        summary: profile.tagline,
        tags: [profile.location, ...skill('Spoken')],
        items: [{ heading: profile.name, meta: profile.role }, ...profile.bio.map((text) => ({ text }))],
        actions: [cvAction, mailAction],
      },
      {
        id: 'education',
        title: 'Education',
        icon: GraduationCap,
        summary: education[0]?.summary ?? '',
        tags: education.map((e) => e.org),
        items: education.map(toItem),
        actions: [],
      },
      {
        id: 'research',
        title: 'Research Focus',
        icon: Microscope,
        summary: fyp.description,
        tags: fyp.tech,
        items: [
          { heading: fyp.title, meta: `Final-year project · ${fyp.year}`, bullets: fyp.highlights },
          ...(finalYearModules ? [{ heading: 'Final-year modules', text: finalYearModules.replace(/^Final year:\s*/, '') }] : []),
        ],
        actions: fyp.links.map((l) => ({ ...l, kind: 'external' as const })),
      },
    ],
  },
  {
    numeral: 'II',
    title: 'Projects',
    jpTitle: 'プロジェクト',
    blurb: 'Things I have built, end to end.',
    nodes: [
      {
        id: 'featured',
        title: 'Featured Builds',
        icon: Hammer,
        summary: 'Four systems I designed and shipped, each built so you can check its working.',
        tags: [...new Set(builds.flatMap((p) => p.tech))].slice(0, 8),
        items: builds.map((p) => ({
          heading: p.title,
          meta: p.jpTitle ? `${p.year} · ${p.jpTitle}` : `${p.year}`,
          text: p.tagline,
          bullets: p.highlights,
          links: p.links,
        })),
        actions: [],
      },
      {
        id: 'hackathons',
        title: 'Hackathons',
        icon: Cpu,
        summary: 'Team builds made against the clock.',
        tags: [...new Set(hackathons.flatMap((p) => p.tech))],
        items: hackathons.map((p) => ({
          heading: p.title,
          meta: p.year,
          text: p.tagline,
          bullets: p.highlights,
          links: p.links,
        })),
        actions: [],
      },
      {
        id: 'open-source',
        title: 'Open Source',
        icon: FolderGit2,
        summary: 'Public code lives on GitHub.',
        tags: [...new Set(profile.projects.filter((p) => p.links.length).flatMap((p) => p.tech))],
        items: profile.projects
          .filter((p) => p.links.length)
          .map((p) => ({ heading: p.title, meta: p.year, text: p.description, links: p.links })),
        actions: github ? [{ label: 'GitHub profile', href: github.href, kind: 'external' as const }] : [],
      },
    ],
  },
  {
    numeral: 'III',
    title: 'Experience & Stack',
    jpTitle: '経歴・スキル',
    blurb: 'Roles I have held and the tools I reach for.',
    nodes: [
      {
        id: 'roles',
        title: 'Experience & Leadership',
        icon: Briefcase,
        summary: roles[0]?.summary ?? '',
        tags: roles.map((e) => e.period),
        items: [...roles, ...leadership].map(toItem),
        actions: [],
      },
      {
        id: 'stack',
        title: 'Core Technologies',
        icon: Layers,
        summary: 'Languages, frameworks and tools I use day to day.',
        tags: skill('Languages'),
        items: techGroups.map((g) => ({ heading: g.category, text: g.items.join(' · ') })),
        actions: [],
      },
      {
        id: 'certifications',
        title: 'Certifications',
        icon: Award,
        summary: 'Courses and credentials, plus the languages I speak.',
        tags: skill('Spoken'),
        items: [
          ...skill('Certifications').map((c) => ({ text: c })),
          { heading: 'Spoken languages', text: skill('Spoken').join(' · ') },
        ],
        actions: [],
      },
    ],
  },
  {
    numeral: 'IV',
    title: 'Contact & CV',
    jpTitle: '連絡先',
    blurb: 'Download my CV, find me online, or write to me.',
    nodes: [
      {
        id: 'resume',
        title: 'Resume',
        icon: FileText,
        summary: 'A public version of my CV is a download away. Email me if you would like the full version.',
        tags: ['PDF'],
        items: [],
        actions: [cvAction, fullCvAction],
      },
      {
        id: 'profiles',
        title: 'GitHub / LinkedIn',
        icon: Link2,
        summary: 'Code and career history.',
        tags: profile.socials.map((s) => s.label),
        items: profile.socials.map((s) => ({ heading: s.label, text: s.href.replace(/^https?:\/\/(www\.)?/, '') })),
        actions: profile.socials.map((s) => ({ label: s.label, href: s.href, kind: 'external' as const })),
      },
      {
        id: 'contact',
        title: 'Direct Contact',
        icon: Mail,
        summary: `Email is the fastest way to reach me. Based in ${profile.location}.`,
        tags: [profile.location],
        items: [{ heading: 'Email', text: profile.email }],
        actions: [mailAction],
      },
    ],
  },
]

/* ── Geometry (wheel frame: degrees clockwise from 12 o'clock, radius in units of R = 100) ── */
const mod4 = (n: number) => ((n % 4) + 4) % 4

/** Quadrant q occupies wheel angles [-90q, -90q + 90], so +90° per step brings it to the 12→3 o'clock arc. */
const nodeAngle = (q: number, i: number, n: number) => -q * 90 + (90 * (i + 0.5)) / n
const nodeRadius = (i: number) => (i % 2 === 0 ? 84 : 76)

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

/** Curve along the circumference between two nodes, interpolating angle and radius. */
function arcPath(a1: number, r1: number, a2: number, r2: number) {
  const delta = ((((a2 - a1) % 360) + 540) % 360) - 180
  const pts = Array.from({ length: 17 }, (_, k) => {
    const t = k / 16
    const p = polar(a1 + delta * t, r1 + (r2 - r1) * t)
    return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  })
  return `M ${pts.join(' L ')}`
}

interface PlacedNode {
  node: LabNode
  q: number
  angle: number
  r: number
}

const PLACED: PlacedNode[] = CHAPTERS.flatMap((c, q) =>
  c.nodes.map((node, i) => ({ node, q, angle: nodeAngle(q, i, c.nodes.length), r: nodeRadius(i) })),
)

/** Every pair of nodes adjacent on the circumference, across quadrant boundaries too. */
const SEGMENTS = (() => {
  const ring = [...PLACED].sort((a, b) => mod360(a.angle) - mod360(b.angle))
  return ring.map((from, k) => ({ from, to: ring[(k + 1) % ring.length] }))
})()

function mod360(a: number) {
  return ((a % 360) + 360) % 360
}

/* ── Layout ── */
function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/**
 * Pivot sits low-left (often off-screen) so the 12→3 o'clock quarter-arc cuts diagonally across
 * the free area. Wide screens reserve a right column for the detail panel; narrow screens a bottom sheet.
 */
function computeLayout(w: number, h: number) {
  const wide = w >= 768
  if (wide) {
    const panelW = Math.min(400, w * 0.36)
    const avail = w - panelW - 32
    const R = Math.min(h * 0.72, avail * 0.6)
    return { wide, panelW, R, cx: avail * 0.92 - R, cy: h * 0.08 + R }
  }
  const R = Math.min(w * 0.78, h * 0.5)
  return { wide, panelW: w, R, cx: w * 0.86 - R, cy: h * 0.1 + R }
}

/* ── Component ── */
export function LabyrinthNav() {
  const reduced = useReducedMotion()
  const { w, h } = useViewport()
  const layout = useMemo(() => computeLayout(w, h), [w, h])
  const glowId = useId()

  // Unbounded: IV → I keeps turning forward (270° → 360°) instead of unwinding.
  const [step, setStep] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const active = mod4(step)
  const chapter = CHAPTERS[active]
  const selected = PLACED.find((p) => p.node.id === selectedId) ?? null
  const firstStage = useRef(true)
  useEffect(() => {
    if (firstStage.current) firstStage.current = false
    else playClockTick()
  }, [active])

  const turnTo = useCallback((q: number) => {
    setStep((s) => {
      const d = mod4(q - mod4(s))
      return s + (d === 3 ? -1 : d)
    })
  }, [])
  const next = useCallback(() => {
    setStep((s) => s + 1)
    setSelectedId(null)
  }, [])
  const prev = useCallback(() => {
    setStep((s) => s - 1)
    setSelectedId(null)
  }, [])
  const goTo = useCallback(
    (q: number) => {
      turnTo(q)
      setSelectedId(null)
    },
    [turnTo],
  )
  const pickNode = (p: PlacedNode) => {
    if (p.q !== active) turnTo(p.q)
    setSelectedId((id) => (id === p.node.id && p.q === active ? null : p.node.id))
  }

  // Gold theme for shared chrome (e.g. App's replay button); restored on unmount.
  useEffect(() => {
    const style = document.documentElement.style
    const before = THEME_VARS.map(([k]) => [k, style.getPropertyValue(k)] as const)
    THEME_VARS.forEach(([k, v]) => style.setProperty(k, v))
    return () => before.forEach(([k, v]) => (v ? style.setProperty(k, v) : style.removeProperty(k)))
  }, [])

  // Keyboard: arrows step, Escape closes the panel. Arrows inside the panel are left to scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'Escape') return setSelectedId(null)
      if (t?.closest('[data-labyrinth-panel]')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  // Debounced wheel/trackpad: accumulate delta, step once per turn duration.
  const wheel = useRef({ acc: 0, lockedUntil: 0, idle: 0 })
  const onWheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement).closest('[data-labyrinth-panel]')) return
    const st = wheel.current
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    window.clearTimeout(st.idle)
    st.idle = window.setTimeout(() => (st.acc = 0), 200)
    if (e.timeStamp < st.lockedUntil) return
    st.acc += delta
    if (Math.abs(st.acc) < WHEEL_THRESHOLD) return
    if (st.acc > 0) next()
    else prev()
    st.acc = 0
    st.lockedUntil = e.timeStamp + WHEEL_LOCK_MS
  }
  useEffect(() => () => window.clearTimeout(wheel.current.idle), [])

  const turn = reduced ? 'none' : `transform ${TURN_MS}ms ${TURN_EASE}`
  const { R, cx, cy, wide } = layout
  const nodeSize = wide ? 44 : 40
  const lizard = useLizardTraversal(step, reduced, turn, R)
  // Mobile sheet stops just below the lowest active label (≈ cy − 0.2R + label height + gap); HUD takes ~70px.
  const sheetMax = Math.max(h * 0.55, h - 70 - (cy - 0.2 * R + 48))

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden bg-[#0b0914] text-[#f7f1e3] select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.6 }}
      onWheel={onWheel}
    >
      {/* Theatre backdrop: plum spotlight, curtain vignettes. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(91,33,122,0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(245,185,66,0.08),transparent_50%)]" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#3a0d24]/50 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#3a0d24]/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.6))]" />
      </div>

      {/* Corner crests: watermarks only, hidden on phones so wheel labels stay clear. */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
        <div className="absolute -top-3 right-3 transition-opacity duration-500" style={{ opacity: selected ? 0.04 : 0.16 }}>
          <CharacterCrest slug="ultimate-madoka" size={150} />
        </div>
        <div className="absolute bottom-4 right-4" style={{ opacity: 0.24 }}>
          <CharacterCrest slug="devil-homura" size={wide ? 240 : 180} />
        </div>
        {/* Counterweight medallion nested in the same corner frame; kicks on every stage change. */}
        <div className="absolute bottom-4 right-4 flex items-center justify-center" style={{ opacity: 0.32, width: wide ? 240 : 180, height: wide ? 240 : 180 }}>
          <TwinLizardSeal size="62%" period={60} boostKey={step} eyeGlowIntensity={1.2} reducedMotion={reduced} />
        </div>
        <div className="absolute" style={{ opacity: 0.14, left: Math.max(8, cx - 95), top: Math.min(h - 200, cy - 95) }}>
          <CharacterCrest slug="alter-sayaka" size={190} />
        </div>
      </div>

      {/* Identity block: upper-left, outside the wheel rim. */}
      <div className={`absolute flex items-center ${wide ? 'left-6 top-4 gap-3' : 'left-3 top-3 gap-2'}`}>
        <CharacterCrest slug="kaiten-homura" size={wide ? 64 : 40} />
        <div>
          <p className={`font-serif leading-none tracking-[0.18em] text-[#f7f1e3] ${wide ? 'text-2xl' : 'text-base'}`}>BRYANT LEUNG</p>
          <p className={`mt-1 uppercase tracking-[0.3em] text-[#f5b942]/80 ${wide ? 'text-[10px]' : 'text-[8px]'}`}>Computer Science &amp; AI</p>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Stage {chapter.numeral} of IV: {chapter.title}
      </p>

      {/* Rotating wheel */}
      <div
        className="absolute"
        style={
          {
            left: cx - R,
            top: cy - R,
            width: 2 * R,
            height: 2 * R,
            transform: `rotate(${step * 90}deg)`,
            transition: turn,
            '--step': step,
          } as CSSProperties
        }
      >
        <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Layer 1: base dial */}
          {Array.from({ length: 12 }, (_, k) => {
            const a = polar(k * 30 + 15, 9)
            const b = polar(k * 30 + 15, 34)
            return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SLATE} strokeOpacity="0.2" strokeWidth="0.35" />
          })}

          {/* Quadrant dividers */}
          {[0, 90, 180, 270].map((deg) => {
            const a = polar(deg, 9)
            const b = polar(deg, 99.5)
            return (
              <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeOpacity="0.22" strokeWidth="0.3" strokeDasharray="2 1.5" />
            )
          })}

          {/* Engraved stage numerals on the rim (decorative; HUD carries the readable titles). */}
          {CHAPTERS.map((c, q) => {
            const p = polar(-q * 90 + 45, 62)
            return (
              <text
                key={c.numeral}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="5"
                fontFamily="Georgia, serif"
                fill={q === active ? GOLD : SLATE}
                fillOpacity={q === active ? 0.22 : 0.12}
                transform={`rotate(${-q * 90 + 45} ${p.x} ${p.y})`}
              >
                {c.numeral}
              </text>
            )
          })}
        </svg>

        {/* Layer 2: lizard beneath the brass */}
        {lizard.under}

        {/* Layer 3: clockwork rings and hub (occlude the under-layer lizard) */}
        <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {/* Opaque backing bands: what the brass physically hides when the lizard dives under. */}
          <g fill="none" stroke="#0b0914" strokeOpacity="0.82">
            <circle r="96.5" strokeWidth="6.5" />
            {[90, 70, 52].map((r) => <circle key={r} r={r} strokeWidth="2.6" />)}
            <circle r="35.75" strokeWidth="3.5" />
          </g>

          {/* Rim and clock ticks */}
          <circle r="99.5" fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="0.4" />
          {Array.from({ length: 60 }, (_, k) => {
            const major = k % 5 === 0
            const a = polar(k * 6, major ? 93.5 : 96)
            const b = polar(k * 6, 99)
            return (
              <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeOpacity={major ? 0.45 : 0.18} strokeWidth={major ? 0.5 : 0.25} />
            )
          })}

          {/* Concentric dashed rings */}
          {[90, 70, 52].map((r) => (
            <circle key={r} r={r} fill="none" stroke={SLATE} strokeOpacity="0.28" strokeWidth="0.25" strokeDasharray="1.2 1.8" />
          ))}

          <circle r="34" fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="0.5" />
          {Array.from({ length: 40 }, (_, k) => {
            const a = polar(k * 9, 34)
            const b = polar(k * 9, 37.5)
            return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeOpacity="0.16" strokeWidth="1.6" />
          })}
          <circle r="9" fill="#120d20" stroke={GOLD} strokeOpacity="0.4" strokeWidth="0.5" />
          <g className="animate-[spin_90s_linear_infinite]">
            <circle r="5.5" fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="0.35" strokeDasharray="0.9 0.9" />
          </g>

          {/* Paths between circumference-adjacent nodes */}
          {SEGMENTS.map(({ from, to }) => {
            const inner = from.q === active && to.q === active
            const bridge = !inner && (from.q === active || to.q === active)
            const hot = selected && (from === selected || to === selected) && inner
            return (
              <path
                key={`${from.node.id}-${to.node.id}`}
                d={arcPath(from.angle, from.r, to.angle, to.r)}
                fill="none"
                stroke={hot ? CRIMSON : inner || bridge ? GOLD : SLATE}
                strokeOpacity={inner ? 0.9 : bridge ? 0.5 : 0.3}
                strokeWidth={inner ? 0.7 : 0.45}
                strokeDasharray={inner ? undefined : '1.5 1.2'}
                strokeLinecap="round"
                filter={inner ? `url(#${glowId})` : undefined}
                style={{ transition: 'stroke 400ms, stroke-opacity 400ms' }}
              />
            )
          })}
        </svg>

        {/* Layer 4: lizard on the clock face */}
        {lizard.over}

        {/* Layer 5 — Nodes: positioned in the rotating frame, contents counter-rotated to stay level. */}
        {PLACED.map((p) => {
          const pos = polar(p.angle, p.r)
          const isActive = p.q === active
          const isSelected = p.node.id === selectedId
          const Icon = p.node.icon
          return (
            <div
              key={p.node.id}
              className="absolute"
              style={{
                left: `${50 + pos.x / 2}%`,
                top: `${50 + pos.y / 2}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 3 : isActive ? 2 : 1,
              }}
            >
              <div
                className="relative transition-opacity duration-500"
                style={{
                  transform: 'rotate(calc(-90deg * var(--step)))',
                  transition: reduced ? 'none' : `transform ${TURN_MS}ms ${TURN_EASE}, opacity 500ms`,
                  opacity: isActive ? 1 : 0.45,
                }}
              >
                <button
                  type="button"
                  onClick={() => pickNode(p)}
                  tabIndex={isActive ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={`${p.node.title} — ${CHAPTERS[p.q].title}`}
                  className="group relative flex items-center justify-center rounded-full border transition-[background-color,border-color,box-shadow,transform] duration-300 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5b942]"
                  style={{
                    width: nodeSize,
                    height: nodeSize,
                    borderColor: isSelected ? CRIMSON : isActive ? GOLD : SLATE,
                    background: isSelected ? 'rgba(224,69,123,0.22)' : isActive ? 'rgba(245,185,66,0.12)' : 'rgba(20,15,36,0.85)',
                    boxShadow: isSelected
                      ? `0 0 0 4px rgba(224,69,123,0.18), 0 0 24px rgba(224,69,123,0.55)`
                      : isActive
                        ? `0 0 18px rgba(245,185,66,0.35)`
                        : 'none',
                    color: isSelected ? '#ffd1e0' : isActive ? GOLD : SLATE,
                  }}
                >
                  <span className="pointer-events-none absolute inset-1 rounded-full border border-current opacity-25" aria-hidden="true" />
                  <Icon size={wide ? 18 : 16} aria-hidden="true" />
                </button>
                <span
                  className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-center font-medium tracking-wide ${
                    wide ? 'text-[13px]' : 'text-[11px]'
                  }`}
                  style={{
                    color: isSelected ? '#ffd1e0' : isActive ? '#f7f1e3' : SLATE,
                    background: isActive ? 'rgba(11,9,20,0.7)' : 'transparent',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {p.node.title}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stage title, fixed inside the active quadrant's interior. */}
      <div
        className="pointer-events-none absolute"
        style={{ left: cx + 0.2 * R, top: cy - 0.27 * R, width: 0.46 * R, transform: 'translateY(-50%)' }}
        aria-hidden="true"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={reduced ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 10 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#f5b942]/75">Stage {chapter.numeral}</p>
            <h1 className={`font-serif leading-tight text-[#f7f1e3] ${wide ? 'text-4xl lg:text-5xl' : 'text-2xl'}`}>{chapter.title}</h1>
            <p className="font-jp mt-1 text-xs tracking-widest text-[#e0457b]/80">{chapter.jpTitle}</p>
            {wide && <p className="mt-2 text-sm text-[#a39fbf]">{chapter.blurb}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop detail panel: right column, clear of the arc. */}
      {wide && (
        <div className="pointer-events-none absolute bottom-6 right-6 top-16 flex items-start" style={{ width: layout.panelW }}>
          <AnimatePresence mode="wait">
            {selected && (
              <DetailPanel key={selected.node.id} placed={selected} onClose={() => setSelectedId(null)} reduced={reduced} wide />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* HUD (and mobile bottom sheet stacked above it). */}
      <div className={`absolute flex flex-col gap-2 ${wide ? 'bottom-6 left-6' : 'inset-x-3 bottom-3'}`}>
        {!wide && (
          <AnimatePresence mode="wait">
            {selected && <DetailPanel key={selected.node.id} placed={selected} onClose={() => setSelectedId(null)} reduced={reduced} wide={false} maxHeight={sheetMax} />}
          </AnimatePresence>
        )}
        <nav
          aria-label="Labyrinth stages"
          className="flex items-center justify-between gap-1 rounded-2xl border border-[#f5b942]/20 bg-[#140f24]/70 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <HudButton label="Previous stage" onClick={prev}>
            <ChevronLeft size={18} aria-hidden="true" />
          </HudButton>
          <ol className="flex items-center gap-1">
            {CHAPTERS.map((c, q) => {
              const on = q === active
              return (
                <li key={c.numeral}>
                  <button
                    type="button"
                    onClick={() => goTo(q)}
                    aria-current={on ? 'step' : undefined}
                    aria-label={`Stage ${c.numeral}: ${c.title}`}
                    className={`flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#f5b942] ${
                      on ? 'bg-[#f5b942]/15 text-[#f5b942]' : 'text-[#a39fbf] hover:bg-white/5 hover:text-[#f7f1e3]'
                    }`}
                  >
                    <span className="font-serif text-[15px]">{c.numeral}</span>
                    <span className={on ? 'whitespace-nowrap' : 'hidden whitespace-nowrap xl:inline'}>{c.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <HudButton label="Next stage" onClick={next}>
            <ChevronRight size={18} aria-hidden="true" />
          </HudButton>
        </nav>
        {wide && <p className="pl-2 text-[11px] tracking-wide text-[#a39fbf]/70">← → or scroll to turn the stage · click a node to open it</p>}
      </div>
    </motion.div>
  )
}

function HudButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#f5b942] transition-colors hover:bg-[#f5b942]/15 focus-visible:outline-2 focus-visible:outline-[#f5b942]"
    >
      {children}
    </button>
  )
}

function DetailPanel({
  placed,
  onClose,
  reduced,
  wide,
  maxHeight,
}: {
  placed: PlacedNode
  onClose: () => void
  reduced: boolean
  wide: boolean
  maxHeight?: number
}) {
  const { node, q } = placed
  const c = CHAPTERS[q]
  const headingId = useId()
  const offset = wide ? { x: 24, y: 0 } : { x: 0, y: 24 }
  return (
    <motion.section
      data-labyrinth-panel
      role="region"
      aria-labelledby={headingId}
      initial={reduced ? false : { opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, ...offset }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`face-scroll pointer-events-auto w-full select-text overflow-y-auto rounded-2xl border border-[#f5b942]/25 bg-[#140f24]/65 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl ${
        wide ? 'max-h-full' : ''
      }`}
      style={wide ? undefined : { maxHeight }}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#e0457b]">
            {c.numeral} · {c.title}
          </p>
          <h2 id={headingId} className="mt-1 font-serif text-2xl text-[#f7f1e3]">
            {node.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#a39fbf] transition hover:text-[#f7f1e3] focus-visible:outline-2 focus-visible:outline-[#f5b942]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {node.summary && <p className="text-sm leading-relaxed text-[#d9d3e8]">{node.summary}</p>}

      {node.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {node.tags.map((t) => (
            <li key={t} className="rounded-full border border-[#f5b942]/30 bg-[#f5b942]/10 px-2 py-0.5 text-[11px] text-[#f5d38a]">
              {t}
            </li>
          ))}
        </ul>
      )}

      {node.items.length > 0 && (
        <ul className="mt-4 space-y-4">
          {node.items.map((it, k) => (
            <li key={k} className="border-l border-[#f5b942]/25 pl-3">
              {it.heading && <h3 className="text-sm font-semibold text-[#f7f1e3]">{it.heading}</h3>}
              {it.meta && <p className="text-xs text-[#a39fbf]">{it.meta}</p>}
              {it.text && <p className="mt-1 text-sm leading-relaxed text-[#d9d3e8]">{it.text}</p>}
              {it.bullets && it.bullets.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-[#c9c2dc] marker:text-[#f5b942]/60">
                  {it.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {it.links && it.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {it.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#f5b942]/40 bg-[#f5b942]/10 px-2.5 py-1 text-xs text-[#f5b942] transition hover:bg-[#f5b942]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b942]"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {node.actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {node.actions.map((a) => {
            const Icon = a.kind === 'mail' ? Mail : a.kind === 'download' ? Download : ExternalLink
            return (
              <a
                key={`${a.kind}-${a.label}`}
                href={a.href}
                {...(a.kind === 'external' ? { target: '_blank', rel: 'noreferrer' } : {})}
                {...(a.kind === 'download' ? { download: 'Bryant-Leung-CV.pdf' } : {})}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#f5b942]/40 bg-[#f5b942]/10 px-3 py-1.5 text-sm text-[#f5b942] transition hover:bg-[#f5b942]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b942]"
              >
                <Icon size={14} aria-hidden="true" />
                {a.label}
              </a>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}

/* ── Character crests: gold-engraved renders in a stained-glass diamond frame. ── */
const LAVENDER = '#e2d9f3'
const CREST_FILTER = 'brightness(0) saturate(100%) invert(76%) sepia(48%) saturate(634%) hue-rotate(356deg)'
const CREST_MASK = 'radial-gradient(circle at 50% 45%, #000 48%, transparent 72%)'
const DIAMOND = (r: number) => `0,${-r} ${r},0 0,${r} ${-r},0`
const CARDINALS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

function CharacterCrest({ slug, size }: { slug: string; size: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        {/* Stained-glass panes at each diamond point, lavender diagonal facets between them. */}
        {CARDINALS.map(([x, y]) => (
          <polygon key={`p${x}${y}`} points={`${x * 47},${y * 47} ${x * 33 - y * 8},${y * 33 - x * 8} ${x * 33 + y * 8},${y * 33 + x * 8}`} fill={GOLD} fillOpacity="0.22" stroke={GOLD} strokeWidth="0.5" />
        ))}
        {CARDINALS.map(([x, y]) => {
          const [dx, dy] = [(x - y) * 0.5, (y + x) * 0.5]
          return <polygon key={`f${x}${y}`} points={`${dx * 46},${dy * 46} ${dx * 38 + (x + y) * 4},${dy * 38 + (y - x) * 4} ${dx * 34},${dy * 34} ${dx * 38 - (x + y) * 4},${dy * 38 - (y - x) * 4}`} fill={LAVENDER} fillOpacity="0.08" stroke={LAVENDER} strokeOpacity="0.45" strokeWidth="0.3" />
        })}
        <polygon points={DIAMOND(48)} fill="none" stroke={GOLD} strokeWidth="0.9" />
        <polygon points={DIAMOND(44)} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.35" />
        <circle r="34" fill="#0b0914" fillOpacity="0.55" stroke={GOLD} strokeWidth="0.7" />
        <circle r="31.5" fill="none" stroke={LAVENDER} strokeOpacity="0.35" strokeWidth="0.25" strokeDasharray="0.8 1.2" />
        {CARDINALS.map(([x, y]) => (
          <circle key={`d${x}${y}`} cx={x * 51} cy={y * 51} r="1.1" fill={GOLD} />
        ))}
      </svg>
      <div className="absolute inset-[19%] overflow-hidden rounded-full">
        {failed ? (
          <CrestEmblem />
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}crests/${slug}.png`}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-contain object-top"
            style={{ filter: CREST_FILTER, maskImage: CREST_MASK, WebkitMaskImage: CREST_MASK }}
          />
        )}
      </div>
    </div>
  )
}

/** Fallback when a render is missing: runic diamond so no broken-image icon ever shows. */
function CrestEmblem() {
  return (
    <svg viewBox="-50 -50 100 100" className="h-full w-full">
      <polygon points={DIAMOND(34)} fill="none" stroke={GOLD} strokeWidth="1.6" />
      <polygon points={DIAMOND(22)} fill={GOLD} fillOpacity="0.12" stroke={GOLD} strokeWidth="1" />
      <path d="M0 -34 V34 M-34 0 H34" stroke={LAVENDER} strokeOpacity="0.5" strokeWidth="0.6" />
      <circle r="7" fill="none" stroke={GOLD} strokeWidth="1.2" />
      <path d="M-3 -16 L0 -11 L3 -16 M-3 16 L0 11 L3 16 M-16 -3 L-11 0 L-16 3 M16 -3 L11 0 L16 3" fill="none" stroke={GOLD} strokeWidth="1" strokeLinejoin="round" />
      <circle r="2" fill={GOLD} />
    </svg>
  )
}

/* ── Persistent gecko: a 20-point spine laid along a curve, split segment-by-segment over/under the brass. ── */
/** Waypoint in screen space (active quadrant at 12→3): angle (deg clockwise from 12), radius, depth (1 over, 0 under). */
type Waypoint = [number, number, number]
type DPt = { x: number; y: number; d: number }
type P = { x: number; y: number }

const LIZ_SEG = 20
const LIZ_PX = 200
const UNDER_INSET = 0.985
const UNDER_WIDTH = 0.9
const UNDER_OPACITY = 0.55
const SPARK_MS = 280
const RUN_MS = 1100
const CLAW_MS = 300
const SWING = (36 * Math.PI) / 180
/** Resting sprawl per leg (rad, + = forward): front braced forward, hind tucked back, slightly asymmetric. */
const REST_ANG = [0.42, 0.26, -0.3, -0.18]
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) // power2.inOut
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}
const HIP_U = 95 / 200

/** Waypoints along an arc; `wave` adds a sinusoidal radial S-curve. */
function arc(a0: number, a1: number, r0: number, r1: number, d: number | ((t: number) => number), wave = 0, n = 10): Waypoint[] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n
    return [a0 + (a1 - a0) * t, r0 + (r1 - r0) * t + wave * Math.sin(t * Math.PI * 2), typeof d === 'number' ? d : d(t)]
  })
}

/** Indexed by active quadrant; the final ~60 units of each path are the curled resting pose (head last). */
const STAGE_POSES: { pts: Waypoint[] }[] = [
  // I: under the hub band → curls along the upper-left inner dial between hub and dashed track.
  { pts: [[-150, 20, 1], [-125, 30, 0], [-110, 40, 1], ...arc(-100, -15, 46, 43, 1, 2)] },
  // II: S-curve along the lower-right inner dial, head angled up toward the active nodes.
  { pts: [[175, 30, 1], [150, 36, 0], [135, 42, 1], ...arc(125, 84, 44, 61, 1, 4)] },
  // III: tail curls in across the tick ring (under) → coils along the upper-right gold bezel (over).
  { pts: [[55, 60, 1], [72, 80, 1], [78, 89, 0], ...arc(74, 20, 95, 102.5, (t) => (t < 0.25 ? 0 : 1), 0, 12)] },
  // IV: tail trails beneath the gold bezel → body wraps along the lower-right outer perimeter.
  { pts: [[140, 70, 1], [134, 86, 1], ...arc(128, 90, 96, 103.5, (t) => (t < 0.35 ? 0 : 1), 0, 12)] },
]


/** Catmull-Rom through the waypoints, depth interpolated as a sharp step around each crossing. */
function samplePath(wps: Waypoint[]): DPt[] {
  const p = wps.map(([a, r, d]) => ({ ...polarPt(a, r), d }))
  const out: DPt[] = []
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[Math.min(p.length - 1, i + 2)]
    for (let k = 0; k < 8; k++) {
      const t = k / 8
      const t2 = t * t
      const t3 = t2 * t
      const cr = (a: number, b: number, c: number, e: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3)
      const s = Math.min(1, Math.max(0, (t - 0.35) / 0.3))
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), d: p1.d + (p2.d - p1.d) * s * s * (3 - 2 * s) })
    }
  }
  const last = p[p.length - 1]
  out.push({ x: last.x, y: last.y, d: last.d })
  return out
}

/** Polyline with cumulative arc length; `at(s)` interpolates, extrapolating before the start. */
function track(pts: DPt[]) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum[cum.length - 1]
  const at = (s: number): DPt => {
    if (s <= 0) {
      const [a, b] = pts
      const l = cum[1] || 1
      return { x: a.x + ((a.x - b.x) / l) * -s, y: a.y + ((a.y - b.y) / l) * -s, d: a.d }
    }
    if (s >= total) return pts[pts.length - 1]
    let i = 1
    while (cum[i] < s) i++
    const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    const a = pts[i - 1]
    const b = pts[i]
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, d: a.d + (b.d - a.d) * u }
  }
  return { at, total }
}

const perchTrack = (q: number) => track(samplePath(STAGE_POSES[q].pts))

/** Gecko half-width (× scale), u = 0 snout → 1 tail tip: triangular head, slim neck, sinuous torso, whip tail. */
function geckoWidth(u: number) {
  if (u < 0.075) return 0.45 + (u / 0.075) * 0.55
  if (u < 0.12) return 1 - ((u - 0.075) / 0.045) * 0.55
  if (u < HIP_U) return 0.45 + 0.28 * Math.sin(((u - 0.12) / (HIP_U - 0.12)) * Math.PI)
  return 0.45 * (1 - (u - HIP_U) / (1 - HIP_U)) ** 1.3 + 0.025
}

const f2 = (n: number) => n.toFixed(2)

/** Unit tangent (towards the head) and left normal at spine index k. */
function spineFrame(sp: P[], k: number) {
  const a = sp[Math.max(0, k - 1)]
  const b = sp[Math.min(sp.length - 1, k + 1)]
  const len = Math.hypot(a.x - b.x, a.y - b.y) || 1
  const t = { x: (a.x - b.x) / len, y: (a.y - b.y) / len }
  return { t, n: { x: -t.y, y: t.x } }
}

/** Closed outline over spine indices [a, b]; snout cap when the run starts at the head. */
function runOutline(sp: P[], a: number, b: number, w: number) {
  const left: string[] = []
  const right: string[] = []
  for (let k = a; k <= b; k++) {
    const { n } = spineFrame(sp, k)
    const hw = geckoWidth(k / (sp.length - 1)) * w
    left.push(`${f2(sp[k].x + n.x * hw)} ${f2(sp[k].y + n.y * hw)}`)
    right.unshift(`${f2(sp[k].x - n.x * hw)} ${f2(sp[k].y - n.y * hw)}`)
  }
  let cap = ''
  if (a === 0) {
    const { t } = spineFrame(sp, 0)
    cap = `${f2(sp[0].x + t.x * w * 1.1)} ${f2(sp[0].y + t.y * w * 1.1)} L `
  }
  return `M ${cap}${left.join(' L ')} L ${right.join(' L ')} Z`
}

/** One bent leg: angled upper limb → elbow/knee → forearm → three splayed toes; `ang` sweeps it about the hip (+ = forward). */
function legPath(sp: P[], u: number, side: 1 | -1, front: boolean, w: number, len: number, ang: number) {
  const k = Math.round(u * (sp.length - 1))
  const { t, n } = spineFrame(sp, k)
  const dir = front ? 1 : -1
  const hw = geckoWidth(u) * w * 0.85
  const hip = { x: sp[k].x + n.x * side * hw, y: sp[k].y + n.y * side * hw }
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  const bend = 1 - 0.3 * Math.max(0, ang / SWING) // elbow/knee folds inward on the reach
  // Local (forward, outward) offset → rotated by ang → world.
  const at = (o: P, a: number, b: number) => {
    const f = a * c + b * sn
    const s = b * c - a * sn
    return { x: o.x + t.x * f + n.x * side * s, y: o.y + t.y * f + n.y * side * s }
  }
  const knee = at(hip, -len * 0.35 * dir, len * 0.6 * bend)
  const foot = at(hip, -len * 0.35 * dir + len * 0.5 * dir, len * 0.6 * bend + len * 0.2)
  let d = `M ${f2(hip.x)} ${f2(hip.y)} L ${f2(knee.x)} ${f2(knee.y)} L ${f2(foot.x)} ${f2(foot.y)}`
  const base = Math.atan2(foot.y - knee.y, foot.x - knee.x)
  for (const off of [-0.75, 0, 0.75]) {
    const a = base + off
    d += ` M ${f2(foot.x)} ${f2(foot.y)} l ${f2(Math.cos(a) * len * 0.26)} ${f2(Math.sin(a) * len * 0.26)}`
  }
  return { d, foot }
}

/** [u, side (1 = left), front, diagonal pair (1 = FL+HR, -1 = FR+HL)] */
const LEGS: [number, 1 | -1, boolean, 1 | -1][] = [
  [0.15, 1, true, 1],
  [0.15, -1, true, -1],
  [0.43, 1, false, -1],
  [0.43, -1, false, 1],
]

function useLizardTraversal(step: number, reduced: boolean, turn: string, R: number) {
  const [L] = useState(() => {
    const mk = () => ({ g: createRef<SVGGElement>(), body: createRef<SVGPathElement>(), legs: createRef<SVGPathElement>(), ink: createRef<SVGPathElement>(), eyes: createRef<SVGGElement>() })
    return { under: mk(), over: mk() }
  })
  const spark = useRef<SVGGElement>(null)
  const claws = useRef<SVGGElement>(null)
  // ~200px snout to tail tip in wheel units (100 units = R px), capped so it fits small dials.
  const len = Math.min(60, Math.max(28, (LIZ_PX * 100) / Math.max(1, R)))
  const lenRef = useRef(len)
  useEffect(() => {
    lenRef.current = len
  }, [len])
  const st = useRef({
    q: mod4(step),
    tr: perchTrack(mod4(step)),
    start: 0,
    ms: 0,
    head: 0,
    from: 0,
    spine: [] as DPt[],
    lastD: 1,
    spark: { x: 0, y: 0, t0: -1e9 },
    dist: 0,
    lastHead: 0,
    rest: 1,
    plant: 0,
    claws: Array.from({ length: 4 }, () => ({ x: 0, y: 0, t0: -1e9 })),
    clawI: 0,
    raf: 0,
  })

  // Draw one frame; `head` is the arc-length position of the snout, `idle` blends in the tail curl.
  const draw = useCallback(
    (now: number, idle: number) => {
      const s = st.current
      const len = lenRef.current
      // Gait is driven by arc distance travelled, so feet never skate through the ease-in/out.
      s.dist += Math.abs(s.head - s.lastHead)
      s.lastHead = s.head
      const phase = (s.dist / (len * 0.32)) * Math.PI * 2
      const run = 1 - s.rest
      const spine = Array.from({ length: LIZ_SEG }, (_, k) => {
        const u = k / (LIZ_SEG - 1)
        const p = s.tr.at(s.head - u * len)
        if (!idle && !run) return p
        const a = s.tr.at(s.head - u * len + 0.5)
        const dx = a.x - p.x
        const dy = a.y - p.y
        const l = Math.hypot(dx, dy) || 1
        const tail = Math.max(0, u - 0.35) / 0.65
        const curl = idle * len * 0.07 * tail * tail * Math.sin(now / 650 - u * 6)
        const sway = run * len * 0.025 * Math.sin(phase - u * Math.PI * 1.5) * Math.min(1, u * 4) // hip S-wave synced to footfalls
        const w = curl + sway
        return { x: p.x - (dy / l) * w, y: p.y + (dx / l) * w, d: p.d }
      })
      s.spine = spine
      const headD = spine[1].d
      if ((s.lastD - 0.5) * (headD - 0.5) < 0) s.spark = { x: spine[1].x, y: spine[1].y, t0: now }
      s.lastD = headD

      const over = spine.map((p) => p.d >= 0.5)
      const angs = LEGS.map(([, , , pair], i) => run * SWING * pair * Math.sin(phase) + s.rest * REST_ANG[i])
      // Footfall at each swing extreme: the reaching pair plants; claw glints where it lands on the brass.
      const plant = run > 0.05 ? Math.floor((phase - Math.PI / 2) / Math.PI) : s.plant
      const planting = plant !== s.plant ? (plant % 2 === 0 ? 1 : -1) : 0
      s.plant = plant
      const eyePulse = 0.7 + 0.3 * Math.sin(now / 900)
      for (const [layer, isOver] of [
        [L.over, true],
        [L.under, false],
      ] as const) {
        const sp = isOver ? spine : spine.map((p) => ({ x: p.x * UNDER_INSET, y: p.y * UNDER_INSET }))
        const w = len * 0.05 * (isOver ? 1 : UNDER_WIDTH)
        // Contiguous runs on this layer, each extended one point so the seam overlaps the other layer.
        const runs: string[] = []
        for (let k = 0; k < LIZ_SEG; k++) {
          if (over[k] !== isOver) continue
          const a = Math.max(0, k - (k > 0 ? 1 : 0))
          let b = k
          while (b + 1 < LIZ_SEG && over[b + 1] === isOver) b++
          runs.push(runOutline(sp, a, Math.min(LIZ_SEG - 1, b + 1), w))
          k = b
        }
        layer.body.current?.setAttribute('d', runs.join(' '))
        const legs = LEGS.map((leg, i) => [leg, i] as const)
          .filter(([[u]]) => over[Math.round(u * (LIZ_SEG - 1))] === isOver)
          .map(([[u, side, front, pair], i]) => {
            const { d, foot } = legPath(sp, u, side, front, w, len * 0.11, angs[i])
            if (isOver && planting === pair) {
              s.claws[s.clawI] = { x: foot.x, y: foot.y, t0: now }
              s.clawI = (s.clawI + 1) % s.claws.length
            }
            return d
          })
          .join(' ')
        layer.legs.current?.setAttribute('d', legs)
        layer.ink.current?.setAttribute('d', legs)
        const { n } = spineFrame(sp, 1)
        const ew = geckoWidth(0.05) * w * 0.6
        ;[1, -1].forEach((side, i) => {
          const c = layer.eyes.current?.children[i]
          c?.setAttribute('cx', f2(sp[1].x + n.x * ew * side))
          c?.setAttribute('cy', f2(sp[1].y + n.y * ew * side))
          c?.setAttribute('r', f2(w * 0.22))
        })
        layer.eyes.current?.setAttribute('opacity', over[1] === isOver ? eyePulse.toFixed(3) : '0')
        layer.g.current?.setAttribute('opacity', isOver ? '1' : String(UNDER_OPACITY))
      }

      const k = (now - s.spark.t0) / SPARK_MS
      const g = spark.current
      if (g) {
        g.setAttribute('opacity', k >= 0 && k < 1 ? (1 - k).toFixed(3) : '0')
        g.setAttribute('transform', `translate(${f2(s.spark.x)} ${f2(s.spark.y)}) scale(${(0.4 + 1.6 * Math.min(1, Math.max(0, k))).toFixed(3)})`)
      }
      s.claws.forEach((c, i) => {
        const e = claws.current?.children[i]
        const kc = (now - c.t0) / CLAW_MS
        e?.setAttribute('opacity', kc >= 0 && kc < 1 ? (0.45 * (1 - kc)).toFixed(3) : '0')
        e?.setAttribute('transform', `translate(${f2(c.x)} ${f2(c.y)}) scale(${(0.6 + 0.6 * Math.min(1, Math.max(0, kc))).toFixed(3)})`)
      })
    },
    [L.over, L.under],
  )

  // Stage change: new track from the current body through the stage's waypoints into its resting pose.
  useEffect(() => {
    const s = st.current
    const q = mod4(step)
    if (q === s.q) return
    s.q = q
    if (reduced) {
      s.tr = perchTrack(q)
      s.head = s.lastHead = s.tr.total
      draw(0, 0)
      return
    }
    // Interrupted mid-run: the new track starts from the live spine, so position and heading carry over.
    const tail = s.spine.length ? [...s.spine].reverse() : []
    const path = samplePath(STAGE_POSES[q].pts)
    s.tr = track([...tail, ...path])
    s.head = s.from = tail.length ? track(tail).total : 0
    s.lastHead = s.head
    s.start = performance.now()
    s.ms = RUN_MS
  }, [step, reduced, draw])

  // Resize changes the body length; redraw the reduced-motion perch.
  useEffect(() => {
    if (reduced) draw(0, 0)
  }, [len, reduced, draw])

  // One loop: run when travelling, idle tail curl and eye pulse when perched.
  useEffect(() => {
    const s = st.current
    s.head = s.lastHead = s.tr.total
    if (reduced) {
      draw(0, 0)
      return
    }
    const tick = (now: number) => {
      const t = s.ms ? Math.min(1, (now - s.start) / s.ms) : 1
      if (t < 1) {
        const p = easeInOut(t)
        s.head = s.from + (s.tr.total - s.from) * p
        s.rest = smooth((p - 0.85) / 0.15) // blend stride into the resting sprawl on arrival
        draw(now, 0)
      } else {
        if (s.ms) {
          s.head = s.tr.total
          s.rest = 1
          s.ms = 0
          s.start = now
        }
        draw(now, Math.min(1, (now - s.start) / 600))
      }
      s.raf = requestAnimationFrame(tick)
    }
    s.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(s.raf)
  }, [reduced, draw])

  const layerStyle: CSSProperties = { transform: 'rotate(calc(-90deg * var(--step)))', transition: turn }
  const svg = (layer: typeof L.over, over: boolean) => (
    <div className="pointer-events-none absolute inset-0" style={layerStyle}>
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <g ref={layer.g} opacity="0" style={over ? { filter: 'drop-shadow(0.8px 1.4px 1px rgba(0,0,0,0.75))' } : undefined}>
          <path ref={layer.legs} fill="none" stroke={GOLD} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path ref={layer.ink} fill="none" stroke="#050507" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
          <path ref={layer.body} fill="#050507" stroke={GOLD} strokeWidth={over ? 0.45 : 0.35} strokeLinejoin="round" />
          <g ref={layer.eyes} fill="#e11d48" style={over ? { filter: 'drop-shadow(0 0 1.2px #e11d48)' } : undefined}>
            <circle r="0.5" />
            <circle r="0.5" />
          </g>
        </g>
        {over && (
          <g ref={spark} opacity="0">
            <path d="M0 -2.4 L0.5 -0.5 L2.4 0 L0.5 0.5 L0 2.4 L-0.5 0.5 L-2.4 0 L-0.5 -0.5 Z" fill={GOLD} />
            <circle r="0.7" fill="#e11d48" />
          </g>
        )}
        {over && (
          <g ref={claws}>
            {[GOLD, '#e11d48', GOLD, '#e11d48'].map((fill, i) => (
              <path key={i} opacity="0" d="M0 -0.9 L0.2 -0.2 L0.9 0 L0.2 0.2 L0 0.9 L-0.2 0.2 L-0.9 0 L-0.2 -0.2 Z" fill={fill} />
            ))}
          </g>
        )}
      </svg>
    </div>
  )
  return { under: svg(L.under, false), over: svg(L.over, true) }
}
