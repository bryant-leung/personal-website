/**
 * ProjectsFace (-90deg): Shinkai-style twilight. Header, glass project cards with
 * code-rendered previews, and an in-face detail drawer (absolute, never fixed).
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ExternalLink, X } from 'lucide-react'
import { profile } from '../../data/profile'
import type { Project } from '../../data/profile'
import type { FaceTheme } from '../../data/themes'
import { ProjectVisual } from './ProjectVisuals'
import type { FaceProps } from './FaceProps'

const STARS: [number, number, number][] = [
  [8, 10, 0.9], [22, 24, 0.6], [35, 8, 0.7], [52, 18, 0.5], [67, 6, 0.9],
  [78, 22, 0.6], [90, 12, 0.8], [14, 36, 0.5], [60, 34, 0.5], [95, 32, 0.6],
]

/** Static twilight backdrop: stars, glowing sun-disc and a thin horizon. */
function Twilight({ theme }: { theme: FaceTheme }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="proj-sun">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={theme.accentPrimary} stopOpacity="0.6" />
          <stop offset="1" stopColor={theme.accentPrimary} stopOpacity="0" />
        </radialGradient>
      </defs>
      {STARS.map(([x, y, o], i) => <circle key={i} cx={x} cy={y} r={0.25} fill="#fff" opacity={o} />)}
      <circle cx="72" cy="88" r="22" fill="url(#proj-sun)" />
      <line x1="0" y1="88" x2="100" y2="88" stroke={theme.accentPrimary} strokeOpacity={0.5} strokeWidth={0.2} />
    </svg>
  )
}

function TechTags({ tech, theme }: { tech: string[]; theme: FaceTheme }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {tech.map((t) => (
        <span key={t} className="rounded-full border px-2 py-0.5 text-[11px]"
          style={{ borderColor: 'var(--border)', color: theme.textPrimary }}>{t}</span>
      ))}
    </span>
  )
}

function DetailPanel({ project, theme, onClose }: { project: Project; theme: FaceTheme; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-20 flex items-end" data-modal-open="true"
      onWheel={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div role="dialog" aria-modal="true" aria-label={project.title}
        className="face-scroll relative max-h-[88%] w-full overflow-y-auto rounded-t-2xl border p-5 md:p-7"
        style={{ background: theme.surfaceBg, borderColor: theme.borderColor, color: theme.textPrimary, boxShadow: `0 -10px 40px ${theme.accentGlow}` }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold md:text-2xl">{project.title}</h3>
            <p className="font-jp text-sm" style={{ color: theme.textMuted }}>{project.jpTitle} · {project.year}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition hover:bg-white/10"
            style={{ borderColor: theme.borderColor }}>
            <X size={16} aria-hidden="true" /> Close
          </button>
        </div>
        <p className="mt-4 text-sm leading-relaxed md:text-base" style={{ color: theme.textMuted }}>{project.description}</p>
        <ul className="mt-4 space-y-2">
          {project.highlights.map((h) => (
            <li key={h} className="flex gap-2 text-sm">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: theme.accentPrimary }} aria-hidden="true" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4"><TechTags tech={project.tech} theme={theme} /></div>
        <div className="mt-5 flex flex-wrap gap-3">
          {project.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
              style={{ background: theme.accentPrimary, color: '#06101f' }}>
              {l.label} <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export function ProjectsFace({ theme }: FaceProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = profile.projects.find((p) => p.id === openId) ?? null
  const close = () => setOpenId(null)

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ color: theme.textPrimary }}>
      <Twilight theme={theme} />
      <div className="face-scroll relative z-10 h-full w-full overflow-y-auto p-5 md:p-8">
        <header className="mb-5 flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold md:text-3xl">{theme.label}</h2>
          <span className="font-jp text-lg" style={{ color: theme.textMuted }}>{theme.jpLabel}</span>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {profile.projects.map((p) => (
            <motion.button key={p.id} type="button" onClick={() => setOpenId(p.id)}
              whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="flex flex-col overflow-hidden rounded-xl border bg-white/5 text-left backdrop-blur-md"
              style={{ borderColor: theme.borderColor }}>
              <span className="block aspect-[16/10] w-full overflow-hidden border-b" style={{ borderColor: theme.borderColor }}>
                <ProjectVisual kind={p.visual} theme={theme} />
              </span>
              <span className="flex flex-1 flex-col gap-2 p-4">
                <span className="block text-base font-semibold leading-snug">{p.title}</span>
                <span className="font-jp block text-xs" style={{ color: theme.textMuted }}>{p.jpTitle}</span>
                <span className="block text-sm" style={{ color: theme.textMuted }}>{p.tagline}</span>
                <TechTags tech={p.tech} theme={theme} />
                <span className="mt-auto flex items-center justify-between pt-2 text-xs" style={{ color: theme.textMuted }}>
                  <span>{p.year}</span>
                  <span style={{ color: theme.accentPrimary }}>Details →</span>
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {open && <DetailPanel key={open.id} project={open} theme={theme} onClose={close} />}
      </AnimatePresence>
    </div>
  )
}
