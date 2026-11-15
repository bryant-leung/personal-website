/**
 * ExperienceFace (-180°, Golden Hour Amber / Warm Slate).
 * Timeline of work / hackathon / education on the left, skills on the right.
 * Decorative low-sun SVG + skyline hairline sit behind the content.
 * Entries reveal in a stagger when `active`.
 */
import { motion } from 'framer-motion'
import { Briefcase, GraduationCap, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { profile } from '../../data/profile'
import type { ExperienceEntry } from '../../data/profile'
import type { FaceTheme } from '../../data/themes'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { FaceProps } from './FaceProps'

type Kind = ExperienceEntry['kind']

const KIND_ICON: Record<Kind, LucideIcon> = {
  work: Briefcase,
  hackathon: Trophy,
  education: GraduationCap,
}
const KIND_LABEL: Record<Kind, string> = {
  work: 'Work',
  hackathon: 'Hackathon',
  education: 'Education',
}

function kindColor(kind: Kind, theme: FaceTheme): string {
  if (kind === 'work') return theme.accentPrimary
  if (kind === 'hackathon') return theme.accentSecondary
  return theme.textMuted
}

/** Low sun, soft rays and a thin skyline hairline. Purely decorative. */
function SunBackdrop({ theme }: { theme: FaceTheme }) {
  const rays = [-62, -46, -30, -14, 0, 14, 30, 46, 62]
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <radialGradient id="exp-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.accentPrimary} stopOpacity="0.55" />
          <stop offset="60%" stopColor={theme.accentSecondary} stopOpacity="0.15" />
          <stop offset="100%" stopColor={theme.accentSecondary} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="exp-ray" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={theme.accentPrimary} stopOpacity="0.22" />
          <stop offset="100%" stopColor={theme.accentPrimary} stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="400" cy="560" r="190" fill="url(#exp-sun)" />
      <circle cx="400" cy="560" r="38" fill={theme.accentPrimary} opacity="0.35" />
      {rays.map((deg) => (
        <polygon
          key={deg}
          points="394,560 406,560 420,20 380,20"
          fill="url(#exp-ray)"
          transform={`rotate(${deg} 400 560)`}
        />
      ))}
      <path
        d="M0 560 H60 V535 H80 V548 H120 V520 H138 V548 H190 V530 H215 V500 H225 V530 H270 V545 H330 V525 H350 V548 H460 V528 H485 V505 H495 V528 H540 V546 H610 V522 H632 V548 H690 V536 H720 V550 H800"
        fill="none"
        stroke={theme.accentPrimary}
        strokeOpacity="0.35"
        strokeWidth="1"
      />
    </svg>
  )
}

export function ExperienceFace({ theme, active }: FaceProps) {
  const reduced = useReducedMotion()
  const animate = reduced || active ? 'show' : 'hide'
  const item = (i: number) => ({
    hide: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: reduced ? 0 : 0.1 + i * 0.1 } },
  })

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ color: theme.textPrimary }}>
      <SunBackdrop theme={theme} />
      <div className="face-scroll relative h-full w-full overflow-y-auto p-5 md:p-8">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-semibold md:text-3xl">Experience &amp; Stack</h2>
          <span className="text-lg" style={{ color: theme.accentPrimary }}>
            {theme.jpLabel}
          </span>
        </header>

        <ul className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: theme.textMuted }}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: kindColor(k, theme) }} />
              {KIND_LABEL[k]}
            </li>
          ))}
        </ul>

        <div className="grid gap-8 md:grid-cols-5">
          <ol
            className="relative ml-2 border-l md:col-span-3"
            style={{ borderColor: theme.borderColor }}
          >
            {profile.experience.map((e, i) => {
              const Icon = KIND_ICON[e.kind]
              const color = kindColor(e.kind, theme)
              return (
                <motion.li
                  key={`${e.org}-${e.role}`}
                  className="relative mb-7 pl-6 last:mb-0"
                  variants={item(i)}
                  initial="hide"
                  animate={animate}
                >
                  <span
                    className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${theme.accentGlow}` }}
                  />
                  <p className="font-mono text-xs" style={{ color: theme.textMuted }}>
                    {e.period}
                  </p>
                  <h3 className="mt-0.5 flex items-start gap-2 font-semibold">
                    <Icon size={16} className="mt-1 shrink-0" style={{ color }} aria-hidden />
                    <span>{e.role}</span>
                  </h3>
                  <p className="text-sm" style={{ color: theme.accentPrimary }}>
                    {e.org}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
                    {e.summary}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm marker:text-[var(--m)]"
                    style={{ ['--m' as string]: color }}>
                    {e.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </motion.li>
              )
            })}
          </ol>

          <div className="space-y-4 md:col-span-2">
            {profile.skills.map((g, i) => (
              <motion.section
                key={g.category}
                className="rounded-xl border p-4"
                style={{ borderColor: theme.borderColor, background: 'rgba(0,0,0,0.18)' }}
                variants={item(i + profile.experience.length)}
                initial="hide"
                animate={animate}
              >
                <h3 className="mb-2 text-sm font-semibold" style={{ color: theme.accentPrimary }}>
                  {g.category}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {g.items.map((s) => (
                    <li
                      key={s}
                      className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-[var(--glow)]"
                      style={{ borderColor: theme.borderColor, ['--glow' as string]: theme.accentGlow }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
