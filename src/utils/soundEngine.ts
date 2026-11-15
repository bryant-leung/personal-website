/**
 * Zero-dependency Web Audio engine. BGM is an original procedural dark orchestral waltz (G harmonic minor, 3/4)
 * in a synthetic concert hall: staccato string ostinato, cello + timpani downbeats, formant choir, a bowed solo
 * violin, and an operatic soprano that enters for the climax (bars 9–16).
 * If a local file exists at the configured BGM URL it is crossfaded in and looped instead.
 * No AudioContext exists until the user enables sound, so autoplay policies are respected.
 */

const BPM = 136
const BEAT = 60 / BPM
const EIGHTH = BEAT / 2
const FADE = 0.4
const XFADE = 1.5
const MASTER_GAIN = 0.55
const MUSIC_GAIN = 0.72
const REVERB_SECONDS = 2.4

type Chord = { bass: number; notes: number[]; late?: number[] }
// Gm – Gm/F – Ebmaj7 – D7 – Cm7 – Gm/D – Ebmaj7 – D7sus4→D7 (late = second half of the bar).
const CHORDS: Chord[] = [
  { bass: 31, notes: [55, 58, 62] },
  { bass: 29, notes: [53, 55, 58, 62] },
  { bass: 27, notes: [51, 55, 58, 62] },
  { bass: 38, notes: [54, 57, 60, 62] },
  { bass: 36, notes: [51, 55, 58, 60] },
  { bass: 38, notes: [50, 55, 58, 62] },
  { bass: 27, notes: [51, 55, 58, 62] },
  { bass: 38, notes: [50, 55, 57, 60], late: [50, 54, 57, 60] },
]
// Ostinato chord-tone index per eighth (1 & 2 & 3 &).
const OSTINATO = [0, 2, 1, 3, 2, 1]
const LOOP_STEPS = 96
const CLIMAX_STEP = 48 // bar 9

// Original 8-bar baroque violin theme: [midi, length in eighths], six eighths per bar.
// Played as written in bars 1–8, an octave higher with doubling + tremolo in bars 9–16.
const THEME: [number, number][] = [
  [67, 2], [70, 1], [74, 1], [79, 2],
  [77, 3], [74, 1], [70, 2],
  [79, 4], [75, 2],
  [78, 2], [81, 2], [74, 2],
  [75, 3], [74, 1], [72, 2],
  [70, 2], [74, 2], [79, 2],
  [82, 3], [79, 1], [75, 2],
  [74, 3], [69, 1], [66, 2],
]

type Vowel = 'ah' | 'oh' | 'ee'
const FORMANTS: Record<Vowel, [number, number, number]> = {
  ah: [730, 1090, 2440],
  oh: [570, 840, 2410],
  ee: [270, 2290, 3010],
}
// Original soprano counter-melody for bars 9–16, opening Bb5→A5→G5→F#5→G5: [midi, eighths, vowel].
const SOPRANO: [number, number, Vowel][] = [
  [82, 4, 'ah'], [81, 2, 'oh'],
  [79, 6, 'ah'],
  [82, 3, 'oh'], [79, 3, 'ee'],
  [78, 4, 'ah'], [81, 2, 'oh'],
  [79, 6, 'ah'],
  [82, 3, 'oh'], [86, 3, 'ah'],
  [87, 4, 'ah'], [86, 2, 'ee'],
  [84, 2, 'oh'], [81, 2, 'ah'], [78, 2, 'oh'],
]

const at = <T extends [number, number, ...unknown[]]>(events: T[], offset: number) => {
  const map = new Map<number, T>()
  events.reduce((step, ev) => (map.set(step, ev), step + ev[1]), offset)
  return map
}
const VIOLIN_AT = new Map([...at(THEME, 0)].concat([...at(THEME, CLIMAX_STEP)].map(([s, [n, l]]) => [s, [n + 12, l]])))
const SOPRANO_AT = at(SOPRANO, CLIMAX_STEP)

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

type Violin = {
  nodes: AudioScheduledSourceNode[]
  freq: AudioParam[]
  gain: GainNode
  vib: GainNode
  trem: GainNode
  high: GainNode
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let reverbIn: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let schedTimer: number | null = null
let suspendTimer: number | null = null
let nextTime = 0
let stepIndex = 0
let enabled = false
let violin: Violin | null = null

let bgmUrl: string | null = '/audio/bgm.mp3'
let bgmBuffer: AudioBuffer | null | undefined // undefined = not tried yet, null = unavailable
let bgmSource: AudioBufferSourceNode | null = null
let bgmGain: GainNode | null = null

/** Point the engine at a different local audio file, or null to always use the synthesizer. */
export function configureBgm(url: string | null): void {
  bgmUrl = url
  bgmBuffer = undefined
}

function hallImpulse(c: AudioContext): AudioBuffer {
  const len = Math.floor(c.sampleRate * REVERB_SECONDS)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-5 * i) / len)
  }
  return ir
}

function build(): AudioContext {
  const c = new AudioContext()
  master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)

  // Music-only glue compressor + soft limit, so the full climax never clips; SFX bypass it into master.
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 12
  comp.ratio.value = 4
  comp.attack.value = 0.01
  comp.release.value = 0.25
  const limit = c.createDynamicsCompressor()
  limit.threshold.value = -3
  limit.knee.value = 0
  limit.ratio.value = 20
  limit.attack.value = 0.002
  limit.release.value = 0.1
  musicBus = c.createGain()
  musicBus.gain.value = MUSIC_GAIN
  musicBus.connect(comp).connect(limit).connect(master)

  // Wet/dry hall: instruments send to reverbIn; the dry signal goes straight to musicBus.
  reverbIn = c.createGain()
  const conv = c.createConvolver()
  conv.buffer = hallImpulse(c)
  const wet = c.createGain()
  wet.gain.value = 0.45
  reverbIn.connect(conv).connect(wet).connect(musicBus)

  bgmGain = c.createGain()
  bgmGain.gain.value = 0
  bgmGain.connect(master)

  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return c
}

/** Output node with dry + reverb send. */
function channel(dry: number, send: number): GainNode {
  const c = ctx!
  const g = c.createGain()
  const d = c.createGain()
  d.gain.value = dry
  const s = c.createGain()
  s.gain.value = send
  g.connect(d).connect(musicBus!)
  g.connect(s).connect(reverbIn!)
  return g
}

function voice(type: OscillatorType, freq: number, t: number, peak: number, attack: number, len: number, dest: AudioNode, detune = 0) {
  const o = ctx!.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  const g = ctx!.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + len + 0.05)
}

/** Tight staccato string pulse: detuned saw pair, lowpass sweeping 1800→320 Hz. */
function stringPulse(note: number, t: number, accent: boolean) {
  const lp = ctx!.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(1800, t)
  lp.frequency.exponentialRampToValueAtTime(320, t + 0.13)
  lp.connect(channel(1, 0.35))
  const peak = accent ? 0.075 : 0.05
  voice('sawtooth', midi(note), t, peak, 0.004, 0.17, lp, -7)
  voice('sawtooth', midi(note), t, peak, 0.004, 0.17, lp, 7)
}

/** Cello sub root plus timpani; `heavy` on every fourth bar. */
function downbeat(note: number, t: number, heavy: boolean) {
  const c = ctx!
  const out = channel(1, 0.5)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  lp.connect(out)
  voice('sine', midi(note), t, 0.3, 0.03, BEAT * 3, lp)
  voice('sawtooth', midi(note + 12), t, 0.05, 0.05, BEAT * 2.4, lp)

  const k = heavy ? 1.8 : 1
  const timp = c.createOscillator()
  timp.type = 'sine'
  timp.frequency.setValueAtTime(midi(note + 12) * 1.15, t)
  timp.frequency.exponentialRampToValueAtTime(midi(note + 12), t + 0.12)
  const tg = c.createGain()
  tg.gain.setValueAtTime(0.0001, t)
  tg.gain.exponentialRampToValueAtTime(0.22 * k, t + 0.01)
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 * k)
  timp.connect(tg).connect(out)
  timp.start(t)
  timp.stop(t + 1.2 * k)

  const n = c.createBufferSource()
  n.buffer = noiseBuf
  const nlp = c.createBiquadFilter()
  nlp.type = 'lowpass'
  nlp.frequency.value = 220
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.02)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 * k)
  n.connect(nlp).connect(ng).connect(out)
  n.start(t, Math.random() * 0.4, 0.6 * k)
}

/** Cadence swell over a D7 bar: rising filtered cymbal wash plus a crescendo timpani roll on D. */
function cadenceSwell(t: number) {
  const c = ctx!
  const len = BEAT * 3
  const out = channel(0.6, 0.9)
  const cym = c.createBufferSource()
  cym.buffer = noiseBuf
  cym.loop = true
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(3000, t)
  hp.frequency.exponentialRampToValueAtTime(7000, t + len)
  const cg = c.createGain()
  cg.gain.setValueAtTime(0.0001, t)
  cg.gain.exponentialRampToValueAtTime(0.09, t + len)
  cg.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6)
  cym.connect(hp).connect(cg).connect(out)
  cym.start(t)
  cym.stop(t + len + 0.7)
  for (let i = 0; i < 12; i++) {
    const s = t + (i * len) / 12
    voice('sine', midi(38), s, 0.03 + i * 0.012, 0.005, 0.18, out)
  }
}

/** Persistent bowed violin: detuned saw pair (+ optional octave doubling) through body resonances, with
 *  delayed vibrato bloom and an 11 Hz tremolo stage that the arrangement opens in the climax. */
function createViolinVoice(): Violin {
  const c = ctx!
  const gain = c.createGain()
  gain.gain.value = 0.0001
  const trem = c.createGain()
  trem.gain.value = 1
  const body: [BiquadFilterType, number, number, number][] = [
    ['highpass', 190, 0.7, 0],
    ['peaking', 280, 3, 4],
    ['peaking', 460, 2.5, 3],
    ['peaking', 2400, 2, 5],
    ['highshelf', 4200, 0.7, 3],
    ['lowpass', 8000, 0.7, 0],
  ]
  const chain = body.reduce<AudioNode>((prev, [type, f, q, g]) => {
    const bq = c.createBiquadFilter()
    bq.type = type
    bq.frequency.value = f
    bq.Q.value = q
    bq.gain.value = g
    return prev.connect(bq)
  }, gain)
  chain.connect(trem).connect(channel(0.75, 0.8))

  const vibLfo = c.createOscillator()
  vibLfo.frequency.value = 5.8
  const vib = c.createGain()
  vib.gain.value = 0
  vibLfo.connect(vib)

  const tremLfo = c.createOscillator()
  tremLfo.frequency.value = 11
  const tremDepth = c.createGain()
  tremDepth.gain.value = 0
  tremLfo.connect(tremDepth).connect(trem.gain)

  const high = c.createGain()
  high.gain.value = 0
  high.connect(gain)
  const saws = [-6, 6, -6, 6].map((detune, i) => {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = detune
    o.frequency.value = midi(67) * (i < 2 ? 1 : 2)
    vib.connect(o.detune)
    o.connect(i < 2 ? gain : high)
    return o
  })
  const nodes = [vibLfo, tremLfo, ...saws]
  nodes.forEach((n) => n.start())
  return { nodes, freq: saws.map((o) => o.frequency), gain, vib, trem: tremDepth, high }
}

/** Clear automation from `t` on; Firefox lacks cancelAndHoldAtTime. */
function prune(p: AudioParam, t: number) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t)
  else p.cancelScheduledValues(t)
}

function violinNote(note: number, t: number, len: number, prev: number | null, climax: boolean) {
  if (!violin) return
  const leap = prev === null ? 0 : Math.abs(note - prev)
  const glide = leap > 4 ? 0.045 : 0.01 // portamento only on dramatic leaps
  // Persistent params: drop stale automation so the event timeline doesn't grow for the whole session.
  ;[...violin.freq, violin.gain.gain, violin.vib.gain].forEach((p) => prune(p, t))
  violin.freq.forEach((f, i) => f.setTargetAtTime(midi(note) * (i < 2 ? 1 : 2), t, glide))
  // Bow change: brief dip, then a ~110 ms swell to full, easing back as the stroke travels.
  const peak = climax ? 0.085 : 0.07
  const g = violin.gain.gain
  g.setTargetAtTime(peak * 0.45, t, 0.012)
  g.setTargetAtTime(peak, t + 0.025, 0.03)
  g.setTargetAtTime(peak * 0.72, t + Math.max(0.15, len * 0.65), 0.18)
  // Vibrato blooms ~160 ms after the note starts.
  violin.vib.gain.setTargetAtTime(0, t, 0.01)
  violin.vib.gain.setTargetAtTime(climax ? 22 : 16, t + 0.16, 0.08)
}

/** Open or close the climax layers: octave doubling and 11 Hz tremolo. */
function violinSection(t: number, climax: boolean) {
  if (!violin) return
  prune(violin.high.gain, t)
  prune(violin.trem.gain, t)
  violin.high.gain.setTargetAtTime(climax ? 0.3 : 0, t, 0.2)
  violin.trem.gain.setTargetAtTime(climax ? 0.38 : 0, t, 0.2)
}

function stopViolin() {
  violin?.nodes.forEach((o) => o.stop())
  violin?.gain.disconnect()
  violin = null
}

type OperaOpts = { peak: number; attack: number; from: Vowel; to: Vowel; vibrato: number; dry: number; send: number }

/** One sung note: saw/pulse/saw at -10/0/+10 cents through three parallel formant bandpasses (F1–F3)
 *  that morph from one vowel to the next, with 6.2 Hz vibrato blooming in after the onset. */
function createOperaVoice(note: number, t: number, len: number, o: OperaOpts) {
  const c = ctx!
  const src = c.createGain()
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(o.peak, t + o.attack)
  env.gain.setTargetAtTime(o.peak * 0.8, t + o.attack, len * 0.4)
  env.gain.setTargetAtTime(0.0001, t + len, 0.12)
  env.connect(channel(o.dry, o.send))
  FORMANTS[o.from].forEach((f, i) => {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = [7, 10, 12][i]
    bp.frequency.setValueAtTime(f, t)
    bp.frequency.linearRampToValueAtTime(FORMANTS[o.to][i], t + Math.max(0.2, len * 0.8))
    const g = c.createGain()
    g.gain.value = [1, 0.55, 0.3][i]
    src.connect(bp).connect(g).connect(env)
  })
  const lfo = c.createOscillator()
  lfo.frequency.value = 6.2
  const depth = c.createGain()
  depth.gain.setValueAtTime(0, t)
  depth.gain.linearRampToValueAtTime(o.vibrato, t + 0.35)
  lfo.connect(depth)
  const end = t + len + 0.6
  const oscs = ([['sawtooth', -10], ['square', 0], ['sawtooth', 10]] as const).map(([type, detune]) => {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.value = midi(note)
    osc.detune.value = detune
    depth.connect(osc.detune)
    osc.connect(src)
    return osc
  })
  ;[lfo, ...oscs].forEach((n) => {
    n.start(t)
    n.stop(end)
  })
}

/** Dark choir chord: slow "oh"→"ah" voices, mostly into the hall; lifts an octave in the climax. */
function choir(notes: number[], t: number, climax: boolean) {
  notes.forEach((n) =>
    createOperaVoice(n + (climax ? 12 : 0), t, BEAT * 3, {
      peak: climax ? 0.022 : 0.028,
      attack: 0.6,
      from: 'oh',
      to: 'ah',
      vibrato: 12,
      dry: 0.3,
      send: 1,
    }),
  )
}

const HIGH_VIBRATO = new Set([2, 3, 7, 10]) // D, Eb, G, Bb
function sopranoNote(note: number, t: number, len: number, from: Vowel, to: Vowel) {
  const wide = note >= 74 && HIGH_VIBRATO.has(note % 12) && len >= BEAT * 1.5
  createOperaVoice(note, t, len, { peak: 0.06, attack: 0.18, from, to, vibrato: wide ? 55 : 35, dry: 0.45, send: 1.2 })
}

let prevViolin: number | null = null
function schedule() {
  if (!ctx) return
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05 // resync after throttling, no burst
  while (nextTime < ctx.currentTime + 1.2) {
    const step = stepIndex % LOOP_STEPS
    const pos = step % 6
    const barNo = Math.floor(step / 6)
    const climax = step >= CLIMAX_STEP
    const chord = CHORDS[barNo % CHORDS.length]
    const tones = chord.late && pos >= 3 ? chord.late : chord.notes
    if (step === 0 || step === CLIMAX_STEP) violinSection(nextTime, climax)
    if (pos === 0) {
      downbeat(chord.bass, nextTime, barNo % 4 === 0)
      choir(chord.notes, nextTime, climax)
      if (climax && barNo % 4 === 3) cadenceSwell(nextTime)
    }
    if (pos === 3 && chord.late) choir(chord.late, nextTime, climax)
    stringPulse(tones[OSTINATO[pos] % tones.length], nextTime, pos % 2 === 0)
    const v = VIOLIN_AT.get(step)
    if (v) {
      violinNote(v[0], nextTime, v[1] * EIGHTH, prevViolin, climax)
      prevViolin = v[0]
    }
    const s = SOPRANO_AT.get(step)
    if (s) {
      const i = SOPRANO.indexOf(s)
      sopranoNote(s[0], nextTime, s[1] * EIGHTH, s[2], SOPRANO[(i + 1) % SOPRANO.length][2])
    }
    nextTime += EIGHTH
    stepIndex++
  }
}

function startProcedural() {
  if (!ctx || schedTimer !== null) return
  musicBus!.gain.cancelScheduledValues(ctx.currentTime)
  musicBus!.gain.setValueAtTime(MUSIC_GAIN, ctx.currentTime)
  nextTime = ctx.currentTime + 0.1
  stepIndex = 0
  prevViolin = null
  violin = createViolinVoice()
  schedTimer = window.setInterval(schedule, 60)
  schedule()
}

function stopProcedural() {
  if (schedTimer !== null) clearInterval(schedTimer)
  schedTimer = null
  stopViolin()
}
async function loadBgm(): Promise<AudioBuffer | null> {
  if (bgmBuffer !== undefined || !bgmUrl || !ctx) return bgmBuffer ?? null
  try {
    const res = await fetch(bgmUrl)
    // SPA rewrites answer missing files with index.html, so require an audio content type.
    if (!res.ok || !res.headers.get('content-type')?.startsWith('audio')) throw new Error('no bgm')
    bgmBuffer = await ctx.decodeAudioData(await res.arrayBuffer())
  } catch {
    bgmBuffer = null
  }
  return bgmBuffer
}

function startFile(buf: AudioBuffer, crossfade: boolean) {
  const c = ctx!
  const now = c.currentTime
  bgmSource = c.createBufferSource()
  bgmSource.buffer = buf
  bgmSource.loop = true
  bgmSource.connect(bgmGain!)
  bgmSource.start()
  bgmGain!.gain.cancelScheduledValues(now)
  bgmGain!.gain.setValueAtTime(crossfade ? 0 : 1, now)
  if (crossfade) {
    bgmGain!.gain.linearRampToValueAtTime(1, now + XFADE)
    musicBus!.gain.setValueAtTime(musicBus!.gain.value, now)
    musicBus!.gain.linearRampToValueAtTime(0, now + XFADE)
    window.setTimeout(() => {
      if (bgmSource) stopProcedural()
    }, XFADE * 1000 + 100)
  }
}

function stopFile() {
  bgmSource?.stop()
  bgmSource?.disconnect()
  bgmSource = null
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
    if (!bgmSource) {
      if (bgmBuffer) startFile(bgmBuffer, false)
      else {
        startProcedural()
        // Fall forward to the local file if it turns up; otherwise the synthesizer keeps playing.
        void loadBgm().then((buf) => {
          if (buf && enabled && !bgmSource) startFile(buf, true)
        })
      }
    }
    ramp(MASTER_GAIN)
  } else if (ctx) {
    ramp(0)
    suspendTimer = window.setTimeout(() => {
      suspendTimer = null
      stopProcedural()
      stopFile()
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
