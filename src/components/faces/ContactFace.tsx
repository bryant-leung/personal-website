/**
 * ContactFace (-270°): Moonlit Silver / Deep Navy / Subtle Rose.
 * Calm nocturnal finish: moon + horizon, copyable email, socials, CV download, interests.
 */
import { useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Check, Copy, Download, Globe, Guitar, Mail, Music, Tv } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { profile } from '../../data/profile'
import type { FaceProps } from './FaceProps'

/** lucide dropped brand icons, so GitHub and LinkedIn are minimal inline SVGs. */
const GithubIcon: ComponentType<LucideProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.500-1.100-1.500-.9-.6.1-.6.1-.6 1 .1 1.500 1 1.500 1 .9 1.500 2.300 1.100 2.900.8.1-.7.4-1.100.6-1.400-2.200-.3-4.600-1.100-4.600-5 0-1.100.4-2 1-2.700-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.800 1a9.600 9.600 0 0 1 5 0c1.900-1.300 2.800-1 2.800-1 .5 1.400.2 2.400.1 2.700.6.7 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.3.7.9.7 1.900v2.800c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
  </svg>
)
const LinkedinIcon: ComponentType<LucideProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.500 8.500h3.500V20H4.500V8.500ZM6.200 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm4.300 5.500h3.300v1.600c.5-.9 1.700-1.900 3.500-1.900 3.600 0 4.200 2.400 4.200 5.400V20h-3.500v-5.700c0-1.400 0-3.100-1.900-3.100s-2.200 1.500-2.200 3V20H10.500V8.500Z" />
  </svg>
)

const socialIcons: Record<(typeof profile.socials)[number]['icon'], ComponentType<LucideProps>> = {
  github: GithubIcon,
  linkedin: LinkedinIcon,
  mail: Mail,
  globe: Globe,
}

const interestIcons: Record<(typeof profile.interests)[number]['icon'], ComponentType<LucideProps>> = {
  guitar: Guitar,
  music: Music,
  tv: Tv,
}

export function ContactFace({ theme }: FaceProps) {
  const [copied, setCopied] = useState(false)
  const emailRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
    } catch {
      // Fallback: select the text so the user can copy manually.
      const el = emailRef.current
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const card = { border: `1px solid ${theme.borderColor}`, background: 'rgba(255,255,255,0.03)' }

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ color: theme.textPrimary }}>
      {/* Moon + horizon */}
      <svg
        className="pointer-events-none absolute right-6 top-6 h-20 w-20 md:h-28 md:w-28"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <defs>
          <mask id="contact-crescent">
            <rect width="100" height="100" fill="white" />
            <circle cx="62" cy="42" r="30" fill="black" />
          </mask>
        </defs>
        <circle cx="46" cy="50" r="32" fill={theme.accentPrimary} mask="url(#contact-crescent)" />
        <circle cx="82" cy="18" r="1.5" fill={theme.accentSecondary} />
        <circle cx="90" cy="40" r="1" fill={theme.accentPrimary} />
      </svg>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-12 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.borderColor}, transparent)` }}
      />

      <div className="face-scroll h-full overflow-y-auto px-6 py-10 md:px-12 md:py-12">
        <header className="mb-8">
          <p className="font-jp text-sm tracking-[0.3em]" style={{ color: theme.accentSecondary }}>
            {theme.jpLabel}
          </p>
          <h2 className="mt-1 text-4xl font-light tracking-tight md:text-5xl">Contact</h2>
        </header>

        <div className="max-w-xl space-y-5">
          {/* Email */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg p-4" style={card}>
            <a href={`mailto:${profile.email}`} className="min-w-0 flex-1 break-all font-mono text-sm md:text-base">
              <span ref={emailRef}>{profile.email}</span>
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
              style={{ border: `1px solid ${theme.borderColor}`, color: theme.textPrimary }}
              aria-label="Copy email address"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Socials */}
          <ul className="flex flex-wrap gap-3">
            {profile.socials.map((s) => {
              const Icon = socialIcons[s.icon]
              return (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                    style={{ border: `1px solid ${theme.borderColor}`, color: theme.textMuted }}
                  >
                    <Icon size={16} />
                    {s.label}
                  </a>
                </li>
              )
            })}
          </ul>

          {/* CV */}
          <a
            href={profile.cvPath}
            download
            className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium"
            style={{
              background: theme.accentPrimary,
              color: '#0b1226',
              boxShadow: `0 0 24px ${theme.accentGlow}`,
            }}
          >
            <Download size={16} />
            Download CV
          </a>

          {/* Beyond Code */}
          <section className="rounded-lg p-4" style={card}>
            <h3 className="text-sm font-medium">
              Beyond Code <span className="font-jp ml-2" style={{ color: theme.textMuted }}>コードの向こう</span>
            </h3>
            <ul className="mt-3 space-y-3">
              {profile.interests.map((it) => {
                const Icon = interestIcons[it.icon]
                return (
                  <li key={it.title} className="flex items-start gap-3">
                    <span className="mt-0.5" style={{ color: theme.accentSecondary }}>
                      <Icon size={16} />
                    </span>
                    <span className="text-sm">
                      {it.title} <span className="font-jp text-xs" style={{ color: theme.textMuted }}>{it.jpTitle}</span>
                      <span className="block text-xs" style={{ color: theme.textMuted }}>{it.blurb}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <p className="mt-10 font-mono text-xs" style={{ color: theme.textMuted }}>
          © {new Date().getFullYear()} {profile.name}
        </p>
      </div>
    </div>
  )
}
