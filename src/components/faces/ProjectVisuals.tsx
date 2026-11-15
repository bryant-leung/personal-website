/**
 * Code-rendered mini previews for project cards. Pure inline SVG, no external assets.
 * Each preview uses a 160x100 viewBox (16:10) and scales to its container.
 */
import { useId } from 'react'
import { motion } from 'framer-motion'
import type { ProjectVisual as ProjectVisualKind } from '../../data/profile'
import type { FaceTheme } from '../../data/themes'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const PANEL_BG = 'rgba(8, 12, 32, 0.85)'

// ---- graph ---------------------------------------------------------------
const NODES: [number, number][] = [
  [20, 28], [48, 16], [78, 30], [108, 14], [138, 30],
  [34, 58], [66, 62], [100, 56], [132, 62],
]
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 5], [2, 6], [5, 6], [6, 7], [3, 7], [7, 8], [4, 8], [2, 7],
]
const PULSE_EDGES: [number, number][] = [[1, 2], [6, 7]]
const TICKS = [16, 36, 56, 76, 96, 116, 136]

function GraphVisual({ theme }: { theme: FaceTheme }) {
  const reduced = useReducedMotion()
  const glow = useId()
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label="Spatio-temporal knowledge graph preview">
      <defs>
        <filter id={glow} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="160" height="100" fill={PANEL_BG} />
      {EDGES.map(([a, b], i) => (
        <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
          stroke={theme.accentSecondary} strokeOpacity={0.55} strokeWidth={0.8} />
      ))}
      {NODES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 3} fill={theme.accentPrimary} filter={`url(#${glow})`} />
      ))}
      {!reduced && PULSE_EDGES.map(([a, b], i) => (
        <motion.circle key={i} r={1.8} fill="#fff" filter={`url(#${glow})`}
          initial={{ cx: NODES[a][0], cy: NODES[a][1] }}
          animate={{ cx: [NODES[a][0], NODES[b][0]], cy: [NODES[a][1], NODES[b][1]] }}
          transition={{ duration: 2, delay: i * 0.9, repeat: Infinity, ease: 'linear' }} />
      ))}
      {/* time axis */}
      <line x1="10" y1="86" x2="150" y2="86" stroke={theme.textMuted} strokeOpacity={0.6} strokeWidth={0.6} />
      {TICKS.map((x, i) => (
        <line key={x} x1={x} y1="86" x2={x} y2={i % 2 === 0 ? 92 : 90} stroke={theme.textMuted} strokeOpacity={0.7} strokeWidth={0.6} />
      ))}
    </svg>
  )
}

// ---- subtitles -----------------------------------------------------------
function SubtitlesVisual({ theme }: { theme: FaceTheme }) {
  const reduced = useReducedMotion()
  const clipId = useId()
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label="Dual subtitle video player preview">
      <defs>
        <linearGradient id={`${clipId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#0b1226" />
        </linearGradient>
        <clipPath id={clipId}>
          <motion.rect x="20" y="66" height="14" initial={{ width: reduced ? 120 : 0 }}
            animate={{ width: reduced ? 120 : [0, 120, 120, 0] }}
            transition={{ duration: 6, times: [0, 0.4, 0.9, 1], repeat: Infinity, ease: 'linear' }} />
        </clipPath>
      </defs>
      <rect width="160" height="100" fill={PANEL_BG} />
      <rect x="8" y="8" width="144" height="84" rx="6" fill={`url(#${clipId}-bg)`} stroke={theme.borderColor} strokeWidth={0.8} />
      <circle cx="80" cy="30" r="9" fill="rgba(255,255,255,0.12)" />
      <path d="M77 25.5 L85 30 L77 34.5 Z" fill="#fff" fillOpacity={0.85} />
      {/* subtitles */}
      <text x="80" y="55" textAnchor="middle" fontSize="8" fill="#fff" className="font-jp">
        「大丈夫、きっと間に合う」
      </text>
      <text x="80" y="75" textAnchor="middle" fontSize="6.5" fill={theme.accentPrimary} clipPath={`url(#${clipId})`}>
        &quot;It&apos;s okay, we&apos;ll make it in time.&quot;
      </text>
      {/* progress bar */}
      <rect x="16" y="84" width="128" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      <rect x="16" y="84" width="52" height="2" rx="1" fill={theme.accentPrimary} />
      <circle cx="68" cy="85" r="2.2" fill={theme.accentPrimary} />
    </svg>
  )
}

// ---- map -----------------------------------------------------------------
const BLOCKS = [
  '12,14 56,10 62,40 16,46',
  '70,12 118,16 112,44 66,40',
  '14,54 60,50 66,78 20,82',
  '76,52 124,50 130,76 82,80',
  '126,16 150,18 148,44 120,42',
]
const ROADS = ['8,48 70,46 152,48', '64,8 66,46 72,90', '116,10 120,46 128,92', '8,84 80,82 152,80']
const PINS: { x: number; y: number; sev: 'high' | 'mid' | 'low' }[] = [
  { x: 40, y: 34, sev: 'high' },
  { x: 92, y: 30, sev: 'mid' },
  { x: 104, y: 68, sev: 'low' },
]

function MapVisual({ theme }: { theme: FaceTheme }) {
  const reduced = useReducedMotion()
  const colour = { high: '#fb7185', mid: theme.accentSecondary, low: theme.accentPrimary }
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label="Incident map preview">
      <rect width="160" height="100" fill={PANEL_BG} />
      {BLOCKS.map((p, i) => (
        <polygon key={i} points={p} fill={theme.accentSecondary} fillOpacity={0.12} stroke={theme.accentSecondary} strokeOpacity={0.3} strokeWidth={0.5} />
      ))}
      {ROADS.map((p, i) => (
        <polyline key={i} points={p} fill="none" stroke={theme.textMuted} strokeOpacity={0.6} strokeWidth={1} strokeLinejoin="round" />
      ))}
      {PINS.map((p, i) => (
        <g key={i}>
          {!reduced && (
            <motion.circle cx={p.x} cy={p.y} fill="none" stroke={colour[p.sev]} strokeWidth={0.8}
              initial={{ r: 3, opacity: 0.8 }} animate={{ r: [3, 12], opacity: [0.8, 0] }}
              transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: 'easeOut' }} />
          )}
          <path transform={`translate(${p.x} ${p.y + 6})`} fill={colour[p.sev]}
            d="M0 0 C-3 -4 -5 -6.5 -5 -9 A5 5 0 1 1 5 -9 C5 -6.5 3 -4 0 0 Z" />
          <circle cx={p.x} cy={p.y - 3} r={1.6} fill="#0b1226" />
        </g>
      ))}
      {/* legend */}
      <rect x="8" y="88" width="64" height="8" rx="4" fill="rgba(8,12,32,0.8)" stroke={theme.borderColor} strokeWidth={0.5} />
      {(['high', 'mid', 'low'] as const).map((s, i) => (
        <circle key={s} cx={16 + i * 14} cy={92} r={2} fill={colour[s]} />
      ))}
      <rect x="54" y="91" width="14" height="2" rx="1" fill={theme.textMuted} fillOpacity={0.7} />
    </svg>
  )
}

export function ProjectVisual({ kind, theme }: { kind: ProjectVisualKind; theme: FaceTheme }) {
  switch (kind) {
    case 'graph': return <GraphVisual theme={theme} />
    case 'subtitles': return <SubtitlesVisual theme={theme} />
    case 'map': return <MapVisual theme={theme} />
  }
}
