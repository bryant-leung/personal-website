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
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="0.5" stopColor="#581c87" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <path id="rune-ring" d="M0,-168 a168,168 0 1,1 -0.01,0" />
      </defs>
      <circle r="190" fill="none" stroke="#f5b942" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle r="178" fill="none" stroke="#f5b942" strokeOpacity="0.6" strokeWidth="1.4" strokeDasharray="2 6" />
      <text fill="#f5b942" fillOpacity="0.7" fontSize="13" letterSpacing="6">
        <textPath href="#rune-ring">{RUNES + RUNES}</textPath>
      </text>
      <circle r="150" fill="url(#orb-body)" />
      <circle r="150" fill="url(#orb-rim)" />
      <g stroke="#f5b942" strokeOpacity="0.5" strokeWidth="0.8" fill="none">
        <polygon points="0,-118 102,59 -102,59" />
        <polygon points="0,118 102,-59 -102,-59" />
      </g>
      <path d="M0 -62 L34 -10 L0 66 L-34 -10 Z" fill="url(#gem)" stroke="#f5b942" strokeWidth="1.5" />
      <path d="M-34 -10 L34 -10 M0 -62 L0 66" stroke="#fde68a" strokeOpacity="0.4" strokeWidth="0.8" />
      <ellipse cx="-38" cy="-78" rx="70" ry="34" fill="url(#orb-gloss)" transform="rotate(-24 -38 -78)" />
      <circle cx="58" cy="70" r="6" fill="#f5b942" fillOpacity="0.35" />
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

      ScrollTrigger.create({
        scroller: wrap,
        trigger: inner,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        animation: tl,
        onUpdate: (self) => {
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

          {/* Far plane */}
          <div data-plane="far-l" className="absolute bottom-0 left-0 h-[85%] w-[38%] opacity-70">
            <Spires seed={3} fill="#120b20" edge="#3b2560" />
          </div>
          <div data-plane="far-r" className="absolute bottom-0 right-0 h-[85%] w-[38%] opacity-70">
            <Spires seed={7} fill="#120b20" edge="#3b2560" flip />
          </div>

          {/* Seal, smoke, particles, rings */}
          <div className="absolute inset-0 flex items-center justify-center">
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
            <div data-orb className="relative h-[min(62vmin,520px)] w-[min(62vmin,520px)] drop-shadow-[0_0_60px_rgba(124,58,237,0.45)]">
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

          {/* Editorial type */}
          <div data-hero-text className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center" style={{ fontFamily: SERIF }}>
            <h1 className="text-[clamp(3.2rem,13vw,11rem)] leading-[0.85] font-light tracking-[0.04em] text-[#f7f1e3] mix-blend-difference">
              BRYANT
              <br />
              LEUNG
            </h1>
            <p className="mt-6 text-[clamp(0.7rem,1.6vw,1rem)] tracking-[0.5em] text-[#f5b942]">COMPUTER SCIENCE &amp; AI ENGINEER</p>
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
