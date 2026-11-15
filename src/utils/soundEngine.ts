/**
 * Zero-dependency Web Audio engine. BGM is an original procedural dark orchestral waltz (G harmonic minor, 3/4)
 * in a synthetic concert hall: string ostinato, cello + timpani downbeats, choir pad and a legato solo lead.
 * If a local file exists at the configured BGM URL it is crossfaded in and looped instead.
 * No AudioContext exists until the user enables sound, so autoplay policies are respected.
 */

const BPM = 136
const BEAT = 60 / BPM
const EIGHTH = BEAT / 2
const FADE = 0.4
const XFADE = 1.5
const MASTER_GAIN = 0.55
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

// Original 16-bar solo theme: [midi, length in eighths], six eighths per bar.
// Opens with the glide D5→Bb5→A5→G5→F#5→G5.
const MELODY: [number, number][] = [
  [74, 2], [82, 4],
  [81, 2], [79, 2], [78, 1], [79, 1],
  [82, 3], [84, 1], [82, 2],
  [81, 4], [78, 2],
  [79, 2], [75, 2], [72, 2],
  [74, 3], [79, 1], [82, 2],
  [84, 2], [82, 2], [79, 2],
  [81, 4], [78, 2],
  [74, 2], [82, 3], [81, 1],
  [79, 2], [78, 2], [79, 2],
  [79, 2], [82, 2], [86, 2],
  [84, 3], [81, 1], [78, 2],
  [87, 2], [86, 2], [84, 2],
  [82, 3], [81, 1], [79, 2],
  [79, 2], [82, 2], [87, 2],
  [86, 2], [81, 2], [78, 2],
]
const LOOP_STEPS = 96
const MELODY_AT = new Map<number, [number, number]>()
MELODY.reduce((step, ev) => (MELODY_AT.set(step, ev), step + ev[1]), 0)

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

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
let lead: { osc: AudioScheduledSourceNode[]; freq: AudioParam[]; gain: GainNode } | null = null

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

  musicBus = c.createGain()
  musicBus.gain.value = 0.8
  musicBus.connect(master)

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

/** Dark choir: slow-attack detuned voices through ~700 Hz and ~1220 Hz formants, mostly into the hall. */
function choir(notes: number[], t: number) {
  const c = ctx!
  const sum = c.createGain()
  const out = channel(0.35, 1)
  ;[700, 1220].forEach((f, i) => {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = 5
    const g = c.createGain()
    g.gain.value = i ? 0.6 : 1
    sum.connect(bp).connect(g).connect(out)
  })
  const len = BEAT * 3 + 1
  notes.forEach((n) => {
    voice('triangle', midi(n + 12), t, 0.06, 0.7, len, sum, -9)
    voice('sawtooth', midi(n + 12), t, 0.035, 0.7, len, sum, 9)
  })
}

/** One persistent legato voice so pitch can glide; vibrato at 5.5 Hz. */
function startLead() {
  const c = ctx!
  const gain = c.createGain()
  gain.gain.value = 0.0001
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2600
  gain.connect(tone).connect(channel(0.8, 0.7))
  const vib = c.createOscillator()
  vib.frequency.value = 5.5
  const vibAmt = c.createGain()
  vibAmt.gain.value = 16 // cents
  vib.connect(vibAmt)
  const tri = c.createOscillator()
  tri.type = 'triangle'
  const oct = c.createOscillator()
  oct.type = 'sine'
  const octGain = c.createGain()
  octGain.gain.value = 0.25
  ;[tri, oct].forEach((o) => {
    o.frequency.value = midi(74) * (o === oct ? 2 : 1)
    vibAmt.connect(o.detune)
  })
  tri.connect(gain)
  oct.connect(octGain).connect(gain)
  // Breath: band-passed noise riding the same envelope.
  const breath = c.createBufferSource()
  breath.buffer = noiseBuf
  breath.loop = true
  const bbp = c.createBiquadFilter()
  bbp.type = 'bandpass'
  bbp.frequency.value = 1800
  bbp.Q.value = 1.5
  const bg = c.createGain()
  bg.gain.value = 0.05
  breath.connect(bbp).connect(bg).connect(gain)
  ;[vib, tri, oct, breath].forEach((n) => n.start())
  lead = { osc: [vib, tri, oct, breath], freq: [tri.frequency, oct.frequency], gain }
}

function leadNote(note: number, t: number, len: number, prev: number | null) {
  if (!lead) return
  const leap = prev === null ? 0 : Math.abs(note - prev)
  const glide = leap > 2 ? 0.06 : 0.025 // portamento: wider leaps glide longer
  lead.freq[0].setTargetAtTime(midi(note), t, glide)
  lead.freq[1].setTargetAtTime(midi(note) * 2, t, glide)
  lead.gain.gain.setTargetAtTime(0.16, t, 0.05)
  lead.gain.gain.setTargetAtTime(0.11, t + len * 0.6, 0.15)
}

function stopLead() {
  lead?.osc.forEach((o) => o.stop())
  lead?.gain.disconnect()
  lead = null
}

let prevLead: number | null = null
function schedule() {
  if (!ctx) return
  while (nextTime < ctx.currentTime + 0.25) {
    const step = stepIndex % LOOP_STEPS
    const pos = step % 6
    const barNo = Math.floor(step / 6)
    const chord = CHORDS[barNo % CHORDS.length]
    const tones = chord.late && pos >= 3 ? chord.late : chord.notes
    if (pos === 0) {
      downbeat(chord.bass, nextTime, barNo % 4 === 0)
      choir(chord.notes, nextTime)
    }
    if (pos === 3 && chord.late) choir(chord.late, nextTime)
    stringPulse(tones[OSTINATO[pos] % tones.length], nextTime, pos % 2 === 0)
    const m = MELODY_AT.get(step)
    if (m) {
      leadNote(m[0], nextTime, m[1] * EIGHTH, prevLead)
      prevLead = m[0]
    }
    nextTime += EIGHTH
    stepIndex++
  }
}

function startProcedural() {
  if (!ctx || schedTimer !== null) return
  musicBus!.gain.cancelScheduledValues(ctx.currentTime)
  musicBus!.gain.setValueAtTime(0.8, ctx.currentTime)
  nextTime = ctx.currentTime + 0.1
  stepIndex = 0
  prevLead = null
  startLead()
  schedTimer = window.setInterval(schedule, 60)
  schedule()
}

function stopProcedural() {
  if (schedTimer !== null) clearInterval(schedTimer)
  schedTimer = null
  stopLead()
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
