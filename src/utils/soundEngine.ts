/**
 * Zero-dependency Web Audio engine. BGM is an original procedural dark orchestral waltz (G harmonic minor, 3/4)
 * in a synthetic concert hall: staccato string ostinato, cello + timpani downbeats, formant choir, a bowed solo
 * violin with a ghost violin echoing it a bar behind, a high angelic choir halo, and an operatic soprano that
 * enters for the climax (bars 9–16). Bars 1–4 are sparse; bars 5–8 add the strings, a bass "oo" drone and a
 * celesta echo of the theme.
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

type Vowel = 'ah' | 'oh' | 'ee' | 'oo'
const FORMANTS: Record<Vowel, [number, number, number]> = {
  ah: [730, 1090, 2440],
  oh: [570, 840, 2410],
  ee: [270, 2290, 3010],
  oo: [300, 870, 2240],
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
// Ghost violin: the theme one bar late, an octave below the lead (so original pitch under the climax).
const ECHO_AT = new Map(
  [...at(THEME, 6)]
    .map(([s, [n, l]]) => [s, [n - 12, l]] as [number, [number, number]])
    .concat([...at(THEME, CLIMAX_STEP + 6)].filter(([s]) => s < LOOP_STEPS)),
)

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
let loopBuf: Promise<AudioBuffer> | null = null
let loopSource: AudioBufferSourceNode | null = null
let loopReady: AudioBuffer | null = null
let livePasses: GainNode[] = [] // passes scheduled live while the loop renders
let passEnd = 0
let suspendTimer: number | null = null
let nextTime = 0
let stepIndex = 0
let enabled = false
let violin: Violin | null = null
let ghost: Violin | null = null

let bgmUrl: string | null = '/audio/bgm.mp3'
let bgmBuffer: AudioBuffer | null | undefined // undefined = not tried yet, null = unavailable
let bgmSource: AudioBufferSourceNode | null = null
let bgmGain: GainNode | null = null

/** Point the engine at a different local audio file, or null to always use the synthesizer. */
export function configureBgm(url: string | null): void {
  bgmUrl = url
  bgmBuffer = undefined
}

function hallImpulse(c: BaseAudioContext): AudioBuffer {
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
function stringPulse(note: number, t: number, accent: boolean, level = 1) {
  const lp = ctx!.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(1800, t)
  lp.frequency.exponentialRampToValueAtTime(320, t + 0.13)
  lp.connect(channel(1, 0.35))
  const peak = (accent ? 0.075 : 0.05) * level
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

function violinNote(violin: Violin | null, note: number, t: number, len: number, prev: number | null, climax: boolean, level = 1) {
  if (!violin) return
  const leap = prev === null ? 0 : Math.abs(note - prev)
  const glide = leap > 4 ? 0.045 : 0.01 // portamento only on dramatic leaps
  // Persistent params: drop stale automation so the event timeline doesn't grow for the whole session.
  ;[...violin.freq, violin.gain.gain, violin.vib.gain].forEach((p) => prune(p, t))
  violin.freq.forEach((f, i) => f.setTargetAtTime(midi(note) * (i < 2 ? 1 : 2), t, glide))
  // Bow change: brief dip, then a ~110 ms swell to full, easing back as the stroke travels.
  const peak = (climax ? 0.085 : 0.07) * level
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


type OperaOpts = { peak: number; attack: number; from: Vowel; to: Vowel; vibrato: number; dry: number; send: number; breath?: number; release?: number }

/** One sung note: saw/pulse/saw at -10/0/+10 cents through three parallel formant bandpasses (F1–F3)
 *  that morph from one vowel to the next, with 6.2 Hz vibrato blooming in after the onset. */
function createOperaVoice(note: number, t: number, len: number, o: OperaOpts) {
  const c = ctx!
  // Humanise: each singer is a little early/late, slightly off pitch, with their own vibrato speed and vowel shape.
  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  t += rand(0, 0.03)
  const tune = rand(-8, 8)
  const shape = rand(0.94, 1.06)
  const src = c.createGain()
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(o.peak, t + o.attack)
  env.gain.setTargetAtTime(o.peak * 0.8, t + o.attack, len * 0.4)
  env.gain.setTargetAtTime(0.0001, t + len, o.release ?? 0.12)
  env.connect(channel(o.dry, o.send))
  FORMANTS[o.from].forEach((f, i) => {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = [7, 10, 12][i]
    bp.frequency.setValueAtTime(f * shape, t)
    bp.frequency.linearRampToValueAtTime(FORMANTS[o.to][i] * shape, t + Math.max(0.2, len * 0.8))
    const g = c.createGain()
    g.gain.value = [1, 0.55, 0.3][i]
    src.connect(bp).connect(g).connect(env)
  })
  const lfo = c.createOscillator()
  lfo.frequency.value = rand(5.4, 6.6)
  const depth = c.createGain()
  depth.gain.setValueAtTime(0, t)
  depth.gain.linearRampToValueAtTime(o.vibrato, t + 0.35)
  lfo.connect(depth)
  // Slow wander in pitch and loudness, as a held human note never sits still.
  const drift = c.createOscillator()
  drift.frequency.value = rand(0.2, 0.6)
  const driftCents = c.createGain()
  driftCents.gain.value = rand(3, 7)
  drift.connect(driftCents)
  const swell = c.createGain()
  swell.gain.value = o.peak * rand(0.06, 0.12)
  drift.connect(swell).connect(env.gain)
  const end = t + len + 0.6
  const oscs = ([['sawtooth', -10], ['square', 0], ['sawtooth', 10]] as const).map(([type, detune]) => {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.value = midi(note)
    // Scoop up into the note from ~30 cents flat, like a singer settling on pitch.
    osc.detune.setValueAtTime(detune + tune - rand(20, 40), t)
    osc.detune.linearRampToValueAtTime(detune + tune, t + rand(0.06, 0.12))
    depth.connect(osc.detune)
    driftCents.connect(osc.detune)
    osc.connect(src)
    return osc
  })
  // Breath: looped noise through the same formants, so the vowel carries air like a real voice.
  if (o.breath) {
    const air = c.createBufferSource()
    air.buffer = noiseBuf
    air.loop = true
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const ag = c.createGain()
    ag.gain.value = o.breath
    air.connect(hp).connect(ag).connect(src)
    air.start(t, Math.random() * 0.5)
    air.stop(end)
  }
  ;[lfo, drift, ...oscs].forEach((n) => {
    n.start(t)
    n.stop(end)
  })
}

// Recorded choir (Sonatina Symphonic Orchestra "Chorus", CC Sampling Plus 1.0): men G2–F#4, women G4–C6.
// Only loaded by the offline BGM capture in dev; the shipped site plays the mixed bgm.mp3 or the synth voices.
let choirSamples: Map<number, AudioBuffer> | null = null
const SAMPLE_GAIN = 3.2
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

async function loadChoirSamples(base: string): Promise<number> {
  const dec = new OfflineAudioContext(2, 1, 44100)
  const map = new Map<number, AudioBuffer>()
  await Promise.all(
    Array.from({ length: 84 - 43 + 1 }, (_, i) => 43 + i).map(async (m) => {
      const name = `chorus-${m >= 67 ? 'female' : 'male'}-${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}.wav`
      const buf = await dec.decodeAudioData(await (await fetch(base + encodeURIComponent(name))).arrayBuffer())
      // Normalise each recording to the same RMS so every pitch sits at one level.
      let sum = 0
      for (let ch = 0; ch < buf.numberOfChannels; ch++) for (const v of buf.getChannelData(ch)) sum += v * v
      const k = 0.1 / Math.sqrt(sum / (buf.length * buf.numberOfChannels))
      for (let ch = 0; ch < buf.numberOfChannels; ch++) buf.getChannelData(ch).forEach((v, j, a) => (a[j] = v * k))
      map.set(m, buf)
    }),
  )
  choirSamples = map
  loopBuf = null // re-render with the recorded choir
  loopReady = null
  return map.size
}
if (import.meta.env.DEV) (window as unknown as { __loadChoir: typeof loadChoirSamples }).__loadChoir = loadChoirSamples

/** One recorded choir note, pitched from the nearest sample and humanised like the synth voices. */
function sampleVoice(note: number, t: number, len: number, o: OperaOpts, samples: Map<number, AudioBuffer>) {
  const c = ctx!
  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  t = Math.max(0, t + rand(-0.01, 0.01)) // loose ensemble, but centred on the beat
  const base = Math.min(84, Math.max(43, note))
  const src = c.createBufferSource()
  src.buffer = samples.get(base)!
  const cents = (note - base) * 100 + rand(-8, 8)
  src.detune.setValueAtTime(cents - rand(10, 20), t)
  src.detune.linearRampToValueAtTime(cents, t + rand(0.03, 0.06))
  const env = c.createGain()
  const peak = o.peak * SAMPLE_GAIN
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.08, o.attack))
  env.gain.setTargetAtTime(peak * 0.85, t + o.attack, len * 0.5)
  const release = o.release ?? 0.15
  env.gain.setTargetAtTime(0.0001, t + len, release)
  src.connect(env).connect(channel(o.dry, o.send))
  src.start(t, rand(0.25, 0.4)) // past the recorded swell (full level by 0.22 s), so the note speaks on time
  src.stop(t + len + release * 6)
}

/** Choir parts use the recorded choir when it is loaded, else the formant synth. */
function choirVoice(note: number, t: number, len: number, o: OperaOpts) {
  if (t < 0) [len, t] = [len + t, 0] // the loop's first chord can't lead in before time zero
  if (choirSamples) sampleVoice(note, t, len, o, choirSamples)
  else createOperaVoice(note, t, len, o)
}

/** Choir chord held legato: each chord swells in under the last one's fade, so the singing never stops.
 *  Lifts an octave in the climax. */
const LEGATO = 0.35
const LEAD = 0.1 // chords start just ahead of the beat so they are at full level on it, not behind the melody
function choir(notes: number[], t: number, len: number, climax: boolean) {
  notes.forEach((n) =>
    choirVoice(n + (climax ? 12 : 0), t - LEAD, len + LEAD + LEGATO, {
      peak: climax ? 0.04 : 0.045,
      attack: 0.15,
      from: 'oh',
      to: 'ah',
      vibrato: 12,
      dry: 0.5,
      send: 1,
      release: LEGATO,
    }),
  )
}

/** Angelic halo above the choir: a lone high "ee" in bars 1–8, opening to a two-octave-up triad in the climax. */
function angels(notes: number[], t: number, climax: boolean) {
  const voices = climax ? notes.slice(-3).map((n) => n + 24) : [notes[notes.length - 1] + 12]
  voices.forEach((n) =>
    createOperaVoice(n, t, BEAT * 3 + 0.3, {
      peak: climax ? 0.011 : 0.014,
      attack: 1.1,
      from: 'ee',
      to: 'ah',
      vibrato: 20,
      dry: 0.1,
      send: 1.6,
      breath: 0.5,
    }),
  )
}

/** Soft "s" onset just ahead of a sung syllable. */
function sibilant(t: number, peak: number) {
  const c = ctx!
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 5200
  const s0 = Math.max(0, t - 0.03)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, s0)
  g.gain.exponentialRampToValueAtTime(peak, s0 + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.08)
  src.connect(bp).connect(g).connect(channel(0.3, 1))
  src.start(s0, Math.random() * 0.4, 0.1)
}

/** Low cathedral drone: a quiet bass "oo" held through every bar, overlapping into the next. */
function drone(bass: number, t: number) {
  choirVoice(bass + 12, t - LEAD, BEAT * 3 + LEAD + LEGATO, { peak: 0.03, attack: 0.15, from: 'oo', to: 'oo', vibrato: 6, dry: 0.25, send: 1.2, release: LEGATO })
}

/** Celesta: sine bell with a bright 4th partial and a fast decay, mostly into the hall. */
function celesta(note: number, t: number) {
  const out = channel(0.4, 1.3)
  voice('sine', midi(note), t, 0.05, 0.004, 1.4, out)
  voice('sine', midi(note) * 4, t, 0.012, 0.002, 0.35, out)
}
const CELESTA_FROM = 24 // bars 5–8: glassy echo of the theme
const STRINGS_FROM = 24 // bars 1–4 stay sparse; the ostinato enters at bar 5

// Original choir melody over bars 5–8 and 13–16 (Cm7 – Gm/D – Ebmaj7 – D7sus4→D7): [midi, eighths, vowel].
const CHANT: [number, number, Vowel][] = [
  [63, 2, 'ah'], [62, 2, 'ee'], [60, 2, 'oh'],
  [62, 4, 'ah'], [58, 2, 'oo'],
  [58, 2, 'ee'], [63, 2, 'ah'], [67, 2, 'oh'],
  [67, 3, 'ah'], [66, 3, 'oo'],
]
const CHANT_AT = new Map([...at(CHANT, 24), ...at(CHANT, 72)])
const chanting = (step: number) => (step >= 24 && step < 48) || step >= 72

/** Sung choir line: women and men an octave apart, each syllable with an "s" onset. */
/** `edge`: first note of a phrase swells in, last note fades out slowly. */
function chant(note: number, t: number, len: number, vowel: Vowel, edge: 'start' | 'end' | null) {
  // Two singers per part with different vibrato depths, so the line sounds like a section, not one synth.
  for (const n of [note, note - 12])
    for (const vibrato of choirSamples ? [16] : [16, 28]) // a recorded section is already many singers
      choirVoice(n, t, len + 0.15, {
        peak: 0.1,
        attack: edge === 'start' ? 0.4 : 0.12,
        from: vowel,
        to: vowel,
        vibrato,
        dry: 0.8,
        send: 0.7,
        breath: 0.3,
        release: edge === 'end' ? 0.6 : 0.2,
      })
  if (edge !== 'start') sibilant(t, 0.06)
}

const HIGH_VIBRATO = new Set([2, 3, 7, 10]) // D, Eb, G, Bb
function sopranoNote(note: number, t: number, len: number, from: Vowel, to: Vowel) {
  const wide = note >= 74 && HIGH_VIBRATO.has(note % 12) && len >= BEAT * 1.5
  createOperaVoice(note, t, len, { peak: 0.06, attack: 0.18, from, to, vibrato: wide ? 55 : 35, dry: 0.45, send: 1.2, breath: 0.35 })
}

let prevViolin: number | null = null
let prevGhost: number | null = null
function scheduleLoop() {
  while (stepIndex < LOOP_STEPS) {
    const step = stepIndex % LOOP_STEPS
    const pos = step % 6
    const barNo = Math.floor(step / 6)
    const climax = step >= CLIMAX_STEP
    const chord = CHORDS[barNo % CHORDS.length]
    const tones = chord.late && pos >= 3 ? chord.late : chord.notes
    if (step === 0 || step === CLIMAX_STEP) violinSection(nextTime, climax)
    if (pos === 0) {
      downbeat(chord.bass, nextTime, barNo % 4 === 0)
      choir(chord.notes, nextTime, chord.late ? EIGHTH * 3 : BEAT * 3, climax)
      drone(chord.bass, nextTime)
      angels(chord.notes, nextTime, climax)
      if (climax && barNo % 4 === 3) cadenceSwell(nextTime)
    }
    if (pos === 3 && chord.late) choir(chord.late, nextTime, EIGHTH * 3, climax)
    if (step >= STRINGS_FROM) stringPulse(tones[OSTINATO[pos] % tones.length], nextTime, pos % 2 === 0, chanting(step) ? 0.5 : 1)
    const v = VIOLIN_AT.get(step)
    if (v && step >= CELESTA_FROM && step < CLIMAX_STEP) celesta(v[0] + 12, nextTime + EIGHTH)
    if (v) {
      violinNote(violin, v[0], nextTime, v[1] * EIGHTH, prevViolin, climax)
      prevViolin = v[0]
    }
    const g = ECHO_AT.get(step)
    if (g) {
      violinNote(ghost, g[0], nextTime, g[1] * EIGHTH, prevGhost, climax, 0.5)
      prevGhost = g[0]
    }
    const ch = CHANT_AT.get(step)
    if (ch) {
      const i = CHANT.indexOf(ch)
      chant(ch[0], nextTime, ch[1] * EIGHTH, ch[2], i === 0 ? 'start' : i === CHANT.length - 1 ? 'end' : null)
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

/** Schedule one full pass of the loop from `t0` into `dest`, with its own hall reverb. Instruments read the
 *  module globals, so they are pointed at `c` while the notes are scheduled (synchronously), then restored. */
function schedulePass(c: BaseAudioContext, dest: AudioNode, t0: number): GainNode {
  const loopLen = LOOP_STEPS * EIGHTH
  const saved = { ctx, musicBus, reverbIn }
  try {
    ctx = c as AudioContext
    const bus = c.createGain()
    bus.connect(dest)
    musicBus = bus
    reverbIn = c.createGain()
    const conv = c.createConvolver()
    conv.buffer = hallImpulse(c)
    const wet = c.createGain()
    wet.gain.value = 0.45
    reverbIn.connect(conv).connect(wet).connect(bus)
    nextTime = t0
    stepIndex = 0
    prevViolin = null
    prevGhost = null
    violin = createViolinVoice()
    ghost = createViolinVoice()
    scheduleLoop()
    // Fade the sustained violins at the wrap; the next pass's first note bows in fresh.
    for (const v of [violin, ghost]) {
      v.gain.gain.setTargetAtTime(0, t0 + loopLen, 0.03)
      v.nodes.forEach((o) => o.stop(t0 + loopLen + 0.5))
    }
    return bus
  } finally {
    ;({ ctx, musicBus, reverbIn } = saved)
    violin = null
    ghost = null
  }
}

/** Render one loop offline so playback needs no main-thread timer; hidden tabs throttle timers and
 *  starved the old lookahead scheduler. */
async function renderLoop(live: AudioContext): Promise<AudioBuffer> {
  const sr = live.sampleRate
  const n = Math.round(LOOP_STEPS * EIGHTH * sr)
  const off = new OfflineAudioContext(2, n + Math.ceil((REVERB_SECONDS + 1) * sr), sr)
  schedulePass(off, off.destination, 0)
  const rendered = await off.startRendering()
  // Fold the reverb tail back onto the start so the loop is seamless.
  const out = live.createBuffer(2, n, sr)
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, n))
    for (let k = n; k < src.length; k++) dst[k % n] += src[k]
  }
  return out
}

function startProcedural() {
  if (!ctx || loopSource || livePasses.length) return
  const c = ctx
  musicBus!.gain.cancelScheduledValues(c.currentTime)
  musicBus!.gain.setValueAtTime(MUSIC_GAIN, c.currentTime)
  if (loopReady) return playLoop(c, loopReady, c.currentTime)
  // The offline render takes several seconds, so play the first pass live (every note is scheduled up
  // front, so throttled timers can't starve it) and hand over to the rendered loop at its boundary.
  queueLivePass(c, c.currentTime + 0.05)
  loopBuf ??= renderLoop(c)
  void loopBuf.then((buf) => {
    loopReady = buf
    if (!enabled || loopSource || bgmSource || ctx !== c || !livePasses.length) return
    const at = Math.max(passEnd, c.currentTime + 0.05)
    livePasses.forEach((p) => p.gain.setTargetAtTime(0, at, 0.02)) // the buffer's folded tail takes over the reverb
    playLoop(c, buf, at)
  })
}

/** Schedule a live pass at `t0`; a second before it ends, queue another if the render still isn't ready.
 *  The check rides an audio-clock `ended` event, not a timer, so hidden-tab throttling can't skip it. */
function queueLivePass(c: AudioContext, t0: number) {
  livePasses.push(schedulePass(c, musicBus!, t0))
  passEnd = t0 + LOOP_STEPS * EIGHTH
  const probe = c.createConstantSource()
  probe.onended = () => {
    if (!loopReady && enabled && ctx === c && livePasses.length && !bgmSource) queueLivePass(c, passEnd)
  }
  probe.start()
  probe.stop(passEnd - 1)
}

function playLoop(c: AudioContext, buf: AudioBuffer, at: number) {
  loopSource = c.createBufferSource()
  loopSource.buffer = buf
  loopSource.loop = true
  loopSource.connect(musicBus!)
  loopSource.start(at)
}

function stopProcedural() {
  livePasses.forEach((p) => p.disconnect())
  livePasses = []
  loopSource?.stop()
  loopSource?.disconnect()
  loopSource = null
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
    if (!enabled) return void ctx.suspend() // turned off while resuming
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

// Dev only: a hot-reloaded module would orphan the old context, leaving music the toggle can no longer stop.
import.meta.hot?.dispose(() => {
  stopProcedural()
  stopFile()
  void ctx?.close()
})
