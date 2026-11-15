/**
 * IntroFace (0°): Obsidian / Wisteria Violet / Crimson.
 * Shaft-inspired editorial layout: hairlines, corner brackets, negative space.
 * Text staggers in when `active` becomes true.
 */
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { profile } from '../../data/profile'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { FaceProps } from './FaceProps'

/** Concentric thin rings with a crimson arc. */
function Ornament({ ring, accent }: { ring: string; accent: string }) {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 md:h-36 md:w-36" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="56" stroke={ring} strokeWidth="1" />
      <circle cx="60" cy="60" r="40" stroke={ring} strokeWidth="1" />
      <circle cx="60" cy="60" r="24" stroke={ring} strokeWidth="1" />
      <path d="M60 4 A56 56 0 0 1 116 60" stroke={accent} strokeWidth="1.5" strokeLinecap="square" />
      <rect x="56" y="56" width="8" height="8" transform="rotate(45 60 60)" fill={accent} />
    </svg>
  )
}

export function IntroFace({ theme, active, onRotate }: FaceProps) {
  const reduced = useReducedMotion()
  const item = (i: number) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    animate: active || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.6, delay: reduced ? 0 : 0.12 * i, ease: 'easeOut' as const },
  })
  const bracket = { borderColor: theme.accentSecondary }

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ color: theme.textPrimary }}>
      {/* Hairline frame: corner brackets + crimson diagonal */}
      <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t" style={bracket} />
      <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r" style={bracket} />
      <span
        className="pointer-events-none absolute right-0 top-0 h-px w-40 origin-top-right rotate-45"
        style={{ background: theme.accentSecondary }}
      />
      <span className="pointer-events-none absolute bottom-16 left-0 h-px w-1/3" style={{ background: theme.borderColor }} />

      <div className="face-scroll h-full overflow-y-auto px-6 py-10 md:px-14 md:py-14">
        <div className="flex min-h-full flex-col justify-between gap-10">
          <div>
            <div className="mb-8 flex items-start justify-between">
              <span
                className="mt-2 inline-block h-3 w-3 rotate-45 border"
                style={{ borderColor: theme.accentPrimary }}
                aria-hidden="true"
              />
              <Ornament ring={theme.borderColor} accent={theme.accentSecondary} />
            </div>

            <motion.p {...item(0)} className="font-jp text-sm tracking-[0.3em]" style={{ color: theme.accentPrimary }}>
              {profile.jpName}
            </motion.p>
            <motion.h1 {...item(1)} className="mt-2 text-5xl font-light tracking-tight md:text-7xl">
              {profile.name}
            </motion.h1>
            <motion.div {...item(2)} className="mt-5 h-px w-24" style={{ background: theme.accentSecondary }} />
            <motion.p {...item(3)} className="mt-5 text-base md:text-lg">
              {profile.role}
            </motion.p>
            <motion.p {...item(3)} className="font-jp text-sm" style={{ color: theme.textMuted }}>
              {profile.jpRole}
            </motion.p>
            <motion.p
              {...item(4)}
              className="mt-4 font-mono text-xs uppercase tracking-widest"
              style={{ color: theme.textMuted }}
            >
              {profile.location} / {profile.tagline}
            </motion.p>

            <div className="mt-8 max-w-md space-y-4 text-sm leading-relaxed md:text-base" style={{ color: theme.textMuted }}>
              {profile.bio.map((p, i) => (
                <motion.p key={i} {...item(5 + i)}>
                  {p}
                </motion.p>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRotate?.(1)}
            className="group flex w-fit items-center gap-3 self-start border-t pt-4 text-left"
            style={{ borderColor: theme.borderColor, color: theme.textMuted }}
          >
            <span className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-widest">{profile.rotatePrompt}</span>
              <span className="font-jp text-xs">{profile.jpRotatePrompt}</span>
            </span>
            <motion.span
              animate={reduced ? undefined : { x: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: theme.accentSecondary }}
            >
              <ArrowRight size={18} />
            </motion.span>
          </button>
        </div>
      </div>
    </div>
  )
}
