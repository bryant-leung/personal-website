import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent } from 'react'
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
}

interface Action {
  label: string
  href: string
  kind: 'external' | 'download' | 'mail'
}

interface LabNode {
  id: string
  title: string
  icon: LucideIcon
  summary: string
  tags: string[]
  items: DetailItem[]
  actions: Action[]
  embedCv?: boolean
}

interface Chapter {
  numeral: string
  title: string
  jpTitle: string
  blurb: string
  nodes: LabNode[]
}

const github = profile.socials.find((s) => s.icon === 'github')
const education = profile.experience.filter((e) => e.kind === 'education')
const roles = profile.experience.filter((e) => e.kind !== 'education')
const skill = (category: string) => profile.skills.find((s) => s.category === category)?.items ?? []
const techGroups = profile.skills.filter((s) => s.category !== 'Certifications' && s.category !== 'Spoken')
const fyp = profile.projects[0]
const finalYearModules = education[0]?.bullets.find((b) => b.startsWith('Final year'))
const cvActions: Action[] = [
  { label: 'Download CV', href: profile.cvPath, kind: 'download' },
  { label: 'Open in new tab', href: profile.cvPath, kind: 'external' },
]
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
        actions: [cvActions[0], mailAction],
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
        summary: 'Three systems I designed and shipped, each built so you can check its working.',
        tags: [...new Set(profile.projects.flatMap((p) => p.tech))].slice(0, 8),
        items: profile.projects.map((p) => ({
          heading: p.title,
          meta: `${p.year} · ${p.jpTitle}`,
          text: p.tagline,
          bullets: p.highlights,
        })),
        actions: github ? [{ label: 'GitHub', href: github.href, kind: 'external' }] : [],
      },
      {
        id: 'ai-systems',
        title: 'AI / Systems Work',
        icon: Cpu,
        summary: 'Retrieval, speech and risk-scoring pipelines where the model is one checked step, not the whole system.',
        tags: skill('AI / ML'),
        items: [
          ...profile.projects
            .filter((p) => p.visual !== 'map')
            .map((p) => ({ heading: p.title, meta: p.tech.join(' · '), text: p.description })),
          ...roles.filter((e) => e.kind === 'hackathon').map(toItem),
        ],
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
          .map((p) => ({ heading: p.title, meta: p.year, text: p.description })),
        actions: github ? [{ label: 'GitHub profile', href: github.href, kind: 'external' }] : [],
      },
    ],
  },
  {
    numeral: 'III',
    title: 'Experience & Stack',
    jpTitle: '経歴と技術',
    blurb: 'Roles I have held and the tools I reach for.',
    nodes: [
      {
        id: 'roles',
        title: 'Engineering Roles',
        icon: Briefcase,
        summary: roles[0]?.summary ?? '',
        tags: roles.map((e) => e.period),
        items: roles.map(toItem),
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
    blurb: 'Read the CV, find me online, or write to me.',
    nodes: [
      {
        id: 'resume',
        title: 'Resume',
        icon: FileText,
        summary: 'Read my CV here, or download the PDF.',
        tags: ['PDF'],
        items: [],
        actions: cvActions,
        embedCv: true,
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
  // Mobile sheet stops just below the lowest active label (≈ cy − 0.2R + label height + gap); HUD takes ~70px.
  const sheetMax = Math.max(200, h - 70 - (cy - 0.2 * R + 48))

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

          {/* Gear: teeth ring, spokes, hub */}
          <circle r="34" fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="0.5" />
          {Array.from({ length: 40 }, (_, k) => {
            const a = polar(k * 9, 34)
            const b = polar(k * 9, 37.5)
            return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeOpacity="0.16" strokeWidth="1.6" />
          })}
          {Array.from({ length: 12 }, (_, k) => {
            const a = polar(k * 30 + 15, 9)
            const b = polar(k * 30 + 15, 34)
            return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SLATE} strokeOpacity="0.2" strokeWidth="0.35" />
          })}
          <circle r="9" fill="#120d20" stroke={GOLD} strokeOpacity="0.4" strokeWidth="0.5" />
          <g className="animate-[spin_90s_linear_infinite]">
            <circle r="5.5" fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="0.35" strokeDasharray="0.9 0.9" />
          </g>

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

        {/* Nodes: positioned in the rotating frame, contents counter-rotated to stay level. */}
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

      {node.embedCv && (
        <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 bg-white sm:block">
          <iframe src={profile.cvPath} title="CV (PDF)" className="h-[52vh] w-full" />
        </div>
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
            </li>
          ))}
        </ul>
      )}

      {node.actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {node.actions.map((a) => {
            const Icon = a.kind === 'download' ? Download : a.kind === 'mail' ? Mail : ExternalLink
            return (
              <a
                key={`${a.kind}-${a.label}`}
                href={a.href}
                {...(a.kind === 'download' ? { download: '' } : {})}
                {...(a.kind === 'external' ? { target: '_blank', rel: 'noreferrer' } : {})}
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
