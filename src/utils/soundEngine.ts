/**
 * Zero-dependency Web Audio engine: an original procedural 3/4 baroque waltz (G harmonic minor) with bass, plucks, choir pad and celesta lead,
 * plus clockwork SFX. No AudioContext exists until the user enables sound, so autoplay policies are respected.
 */

const BPM = 138
const BEAT = 60 / BPM
const EIGHTH = BEAT / 2
const FADE = 0.4
const MASTER_GAIN = 0.55

type Chord = { bass: number; notes: number[] }
// G harmonic minor, 8 bars of 3/4: Gm – Gm/F – Ebmaj7 – Cm7 – D7sus4 – D7 – Ebmaj7 – D7.
const CHORDS: Chord[] = [
  { bass: 43, notes: [55, 58, 62] },
  { bass: 41, notes: [55, 58, 62] },
  { bass: 39, notes: [51, 55, 58, 62] },
  { bass: 36, notes: [48, 51, 55, 58] },
  { bass: 38, notes: [50, 55, 57, 60] },
  { bass: 38, notes: [50, 54, 57, 60] },
  { bass: 39, notes: [51, 55, 58, 62] },
  { bass: 38, notes: [50, 54, 57, 60] },
]
// Original 16-bar celesta lead: [midi, length in eighths], six eighths per bar.
// Minor-sixth leaps D5→Bb5 (bars 1, 9); suspensions Eb5→D5 (3, 11) and F#5→G5 (16).
const MELODY: [number, number][] = [
  [74, 2], [82, 4],
  [81, 1], [79, 1], [74, 2], [70, 2],
  [75, 2], [74, 2], [79, 2],
  [72, 2], [75, 1], [74, 1], [72, 2],
  [79, 3], [81, 1], [79, 2],
  [78, 4], [81, 2],
  [82, 2], [79, 2], [75, 2],
  [74, 2], [78, 2], [81, 2],
  [74, 2], [82, 3], [81, 1],
  [79, 2], [74, 2], [70, 2],
  [75, 3], [74, 3],
  [72, 2], [75, 2], [79, 2],
  [84, 2], [82, 2], [81, 2],
  [78, 3], [81, 1], [84, 2],
  [82, 2], [79, 2], [75, 1], [74, 1],
  [78, 4], [79, 2],
]
const LOOP_STEPS = 96
const MELODY_AT = new Map<number, [number, number]>()
MELODY.reduce((step, ev) => (MELODY_AT.set(step, ev), step + ev[1]), 0)

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let delayIn: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let schedTimer: number | null = null
let suspendTimer: number | null = null
let nextTime = 0
let stepIndex = 0
let enabled = false

function build(): AudioContext {
  const c = new AudioContext()
  master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)

  musicBus = c.createGain()
  musicBus.gain.value = 0.8
  musicBus.connect(master)

  // Stereo ping-pong delay tail for the bells.
  delayIn = c.createGain()
  delayIn.gain.value = 0.28
  const dl = c.createDelay(1)
  const dr = c.createDelay(1)
  dl.delayTime.value = BEAT * 0.75
  dr.delayTime.value = BEAT * 0.75
  const fb = c.createGain()
  fb.gain.value = 0.38
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3200
  const merger = c.createChannelMerger(2)
  delayIn.connect(tone).connect(dl)
  dl.connect(dr)
  dr.connect(fb).connect(dl)
  dl.connect(merger, 0, 0)
  dr.connect(merger, 0, 1)
  merger.connect(musicBus)

  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return c
}

function bell(freq: number, t: number, vel: number, len = 1.6) {
  if (!ctx || !musicBus || !delayIn) return
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(vel, t + 0.004)
  env.gain.exponentialRampToValueAtTime(0.0001, t + len)
  const body = ctx.createOscillator()
  body.type = 'sine'
  body.frequency.value = freq
  // Inharmonic overtone gives the music-box tine its metallic shimmer.
  const over = ctx.createOscillator()
  over.type = 'triangle'
  over.frequency.value = freq * 2.76
  const overGain = ctx.createGain()
  overGain.gain.setValueAtTime(0.18, t)
  overGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  body.connect(env)
  over.connect(overGain).connect(env)
  env.connect(musicBus)
  env.connect(delayIn)
  body.start(t)
  over.start(t)
  body.stop(t + len + 0.1)
  over.stop(t + len + 0.1)
}

function voice(type: OscillatorType, freq: number, t: number, peak: number, attack: number, len: number, dest: AudioNode, detune = 0) {
  if (!ctx) return
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + len + 0.05)
}

/** Beat 1: warm cello/sub root. */
function bass(note: number, t: number) {
  if (!ctx || !musicBus) return
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  lp.connect(musicBus)
  voice('sine', midi(note), t, 0.22, 0.02, BEAT * 2.6, lp)
  voice('sawtooth', midi(note + 12), t, 0.04, 0.03, BEAT * 1.8, lp)
}

/** Beats 2–3: detached harpsichord/music-box chord pluck. */
function pluck(notes: number[], t: number) {
  if (!ctx || !musicBus) return
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 300
  hp.connect(musicBus)
  notes.forEach((n) => voice('triangle', midi(n + 12), t, 0.035, 0.003, 0.22, hp))
}

/** Dark choir/string pad: detuned triangle+saw through 720 Hz and 1250 Hz formant bandpasses. */
function choir(notes: number[], t: number) {
  if (!ctx || !musicBus || !delayIn) return
  const sum = ctx.createGain()
  sum.gain.value = 1
  const out = ctx.createGain()
  out.gain.value = 0.5
  ;[720, 1250].forEach((f, i) => {
    const bp = ctx!.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = 6
    const g = ctx!.createGain()
    g.gain.value = i ? 0.6 : 1
    sum.connect(bp).connect(g).connect(out)
  })
  out.connect(musicBus)
  out.connect(delayIn)
  const len = BEAT * 3 + 0.9
  notes.forEach((n) => {
    voice('triangle', midi(n), t, 0.05, 0.6, len, sum, -8)
    voice('sawtooth', midi(n), t, 0.03, 0.6, len, sum, 8)
  })
}

function schedule() {
  if (!ctx) return
  while (nextTime < ctx.currentTime + 0.25) {
    const step = stepIndex % LOOP_STEPS
    const pos = step % 6
    const chord = CHORDS[Math.floor(step / 6) % CHORDS.length]
    if (pos === 0) {
      bass(chord.bass, nextTime)
      choir(chord.notes, nextTime)
    } else if (pos === 2 || pos === 4) pluck(chord.notes, nextTime)
    const lead = MELODY_AT.get(step)
    if (lead) bell(midi(lead[0]), nextTime, 0.13, Math.max(0.6, lead[1] * EIGHTH * 1.6))
    nextTime += EIGHTH
    stepIndex++
  }
}

function ramp(to: number) {
  if (!ctx || !master) return
  const now = ctx.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setValueAtTime(master.gain.value, now)
  master.gain.linearRampToValueAtTime(to, now + FADE)
}

export function isSoundEnabled(): boolean {
  return enabled
}

export async function setSoundEnabled(on: boolean): Promise<void> {
  if (on === enabled) return
  enabled = on
  if (on) {
    if (suspendTimer !== null) {
      clearTimeout(suspendTimer)
      suspendTimer = null
    }
    ctx ??= build()
    await ctx.resume()
    if (schedTimer === null) {
      nextTime = ctx.currentTime + 0.1
      stepIndex = 0
      schedTimer = window.setInterval(schedule, 60)
      schedule()
    }
    ramp(MASTER_GAIN)
  } else if (ctx) {
    ramp(0)
    suspendTimer = window.setTimeout(() => {
      suspendTimer = null
      if (schedTimer !== null) clearInterval(schedTimer)
      schedTimer = null
      void ctx?.suspend()
    }, FADE * 1000 + 50)
  }
}

/** Short metallic escapement tick with a faint chime. */
export function playClockTick(): void {
  if (!enabled || !ctx || !master || !noiseBuf) return
  const t = ctx.currentTime
  const click = ctx.createBufferSource()
  click.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3800
  bp.Q.value = 8
  const cg = ctx.createGain()
  cg.gain.setValueAtTime(0.5, t)
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
  click.connect(bp).connect(cg).connect(master)
  click.start(t, Math.random() * 0.5, 0.05)

  const chime = ctx.createOscillator()
  chime.type = 'sine'
  chime.frequency.value = 2093
  const chg = ctx.createGain()
  chg.gain.setValueAtTime(0.0001, t)
  chg.gain.exponentialRampToValueAtTime(0.05, t + 0.003)
  chg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  chime.connect(chg).connect(master)
  chime.start(t)
  chime.stop(t + 0.55)
}

/** Soft filtered-noise swell for the orb-to-labyrinth transition. */
export function playSmokeWhoosh(): void {
  if (!enabled || !ctx || !master || !noiseBuf) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 1.2
  lp.frequency.setValueAtTime(300, t)
  lp.frequency.exponentialRampToValueAtTime(2400, t + 0.7)
  lp.frequency.exponentialRampToValueAtTime(400, t + 1.6)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
  src.connect(lp).connect(g).connect(master)
  src.start(t)
  src.stop(t + 1.7)
}
