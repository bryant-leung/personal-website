/**
 * EntranceSequence: an ~8s real-time 3D cut-in rebuilt shot-for-shot from the
 * reference clip, using the rigged Homura model (/homura_akemi_-_3d_model.glb).
 *
 *   0  0.0–1.0  Boots step across golden pillar tops high above a sunset city
 *   1  1.0–2.0  Wide low angle: tiny figure atop a huge tilted golden monolith
 *   2  2.0–3.0  Low-angle dutch close-up against sunset clouds
 *   3  3.0–4.0  3D speed-line tunnel rushing past the lens, brief black
 *   4  4.0–5.3  Looking up at a giant dark cube tumbling down out of a pale sky
 *   5  5.3–6.0  Night city: tiny figure diving with a crimson ribbon trail
 *   6  6.0–6.7  Golden monolith between towers, light streaks from above
 *   7  6.7–7.0  Impact light-burst + shockwave ring                      (DOM)
 *   8  7.0–8.0  Explosion, white-out, dissolve into cube face 0
 *
 * Everything is driven by one timeline `t` (seconds since the model is ready), so
 * camera, clips and effects stay frame-locked. In dev, `?intro-t=2.4` freezes the
 * timeline at that time for visual checks. Calls onComplete exactly once.
 */
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ErrorInfo, MutableRefObject, ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { motion } from 'framer-motion'
import { SkipForward } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion'

export { ENTRANCE_DONE_KEY } from './entranceKey'

const MODEL_URL = '/homura_akemi_-_3d_model.glb'
/** Character is normalised to this height (world units) whatever the file's units. */
const CHAR_H = 1.6
const LOAD_TIMEOUT_MS = 20000
const EXIT_S = 0.45

/** Dev-only: freeze the timeline at ?intro-t=<seconds> to compare against reference frames. */
const FREEZE_T: number | null = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('intro-t')
  return v === null || !Number.isFinite(Number(v)) ? null : Number(v)
})()

// ---- timeline ----------------------------------------------------------------
type Mood = 'sunset' | 'bright' | 'sky' | 'night' | 'street'
interface Shot { start: number; end: number; mood: Mood }
const SHOTS: Shot[] = [
  { start: 0, end: 1.0, mood: 'sunset' },
  { start: 1.0, end: 2.0, mood: 'bright' },
  { start: 2.0, end: 3.0, mood: 'sunset' },
  { start: 3.0, end: 4.0, mood: 'night' },
  { start: 4.0, end: 5.3, mood: 'sky' },
  { start: 5.3, end: 6.0, mood: 'night' },
  { start: 6.0, end: 6.7, mood: 'street' },
  { start: 6.7, end: 7.0, mood: 'night' },
  { start: 7.0, end: 8.0, mood: 'street' },
]
const END = SHOTS[SHOTS.length - 1].end
const shotAt = (t: number) => {
  const i = SHOTS.findIndex((s) => t < s.end)
  return i === -1 ? SHOTS.length - 1 : i
}

interface Palette {
  horizon: string; mid: string; top: string; cloud: string; cloudLit: string; clouds: number
  fog: string; fogNear: number; fogFar: number; hemiSky: string; hemiGround: string; hemi: number; rim: number
}
const MOODS: Record<Mood, Palette> = {
  sunset: { horizon: '#ff6a2b', mid: '#ff9e5e', top: '#ffe2b8', cloud: '#7a4630', cloudLit: '#ffd29d', clouds: 1, fog: '#ff9e5e', fogNear: 8, fogFar: 70, hemiSky: '#ffe3c2', hemiGround: '#6b3f2e', hemi: 0.85, rim: 2.5 },
  bright: { horizon: '#ffc58a', mid: '#ffd29d', top: '#fff6e6', cloud: '#a87a52', cloudLit: '#fff0d8', clouds: 0.45, fog: '#ffd29d', fogNear: 40, fogFar: 260, hemiSky: '#fff1dc', hemiGround: '#7a5236', hemi: 0.9, rim: 2.5 },
  sky: { horizon: '#ffc993', mid: '#eeb08a', top: '#6f74a8', cloud: '#7a5a6a', cloudLit: '#ffdcb4', clouds: 0.75, fog: '#f3eee6', fogNear: 60, fogFar: 400, hemiSky: '#f4f1ea', hemiGround: '#6b5444', hemi: 0.9, rim: 2.5 },
  night: { horizon: '#4a1f16', mid: '#1f0f0c', top: '#0a0607', cloud: '#170b09', cloudLit: '#4a2418', clouds: 0.4, fog: '#1b0e0b', fogNear: 4, fogFar: 48, hemiSky: '#4a2a22', hemiGround: '#0d0706', hemi: 0.5, rim: 1.2 },
  street: { horizon: '#ff5a24', mid: '#ff9050', top: '#ffd29d', cloud: '#6a3524', cloudLit: '#ffc78a', clouds: 1, fog: '#c8653a', fogNear: 12, fogFar: 85, hemiSky: '#ffd6aa', hemiGround: '#4a2a1e', hemi: 0.8, rim: 2.5 },
}

// ---- deterministic randomness -------------------------------------------------
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
const clamp01 = (u: number) => Math.min(Math.max(u, 0), 1)

// ---- set placement --------------------------------------------------------------
const PILLAR_TOP = 20
const MONO_B = new THREE.Vector3(200, 0, 0) // tilted monolith set (shots 1–2), top at y = 30
const CHAR_ON_B = new THREE.Vector3(195.4, 30, 5.4)
const CUBE_SET = new THREE.Vector3(400, 0, 0)
const MONO_C = new THREE.Vector3(-14, 0, -20) // golden monolith in the city (shots 6, 8)

// ---- sky dome -----------------------------------------------------------------
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uTop; uniform vec3 uCloud; uniform vec3 uCloudLit;
uniform vec3 uSunDir; uniform float uClouds; uniform float uTime; uniform float uSun;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(-0.05, 0.22, h));
  col = mix(col, uTop, smoothstep(0.18, 0.85, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  if (h > -0.08) {
    vec2 uv = d.xz / (h + 0.22) * 1.3 + vec2(uTime * 0.03, 0.0);
    float c = fbm(uv);
    float m = smoothstep(0.48, 0.74, c) * uClouds * smoothstep(-0.08, 0.1, h);
    float edge = smoothstep(0.48, 0.6, c) - smoothstep(0.6, 0.8, c);
    vec3 cc = mix(uCloud, uCloudLit, clamp(pow(s, 3.0) * 0.8 + edge * 0.6, 0.0, 1.0));
    col = mix(col, cc, m * 0.85);
    // Second, broader layer lower in the sky: layered golden-hour banks.
    vec2 uv2 = vec2(d.x * 0.6, d.z * 1.4) / (h + 0.12) + vec2(uTime * 0.012, 3.7);
    float c2 = fbm(uv2);
    float m2 = smoothstep(0.5, 0.7, c2) * uClouds * smoothstep(-0.06, 0.04, h) * (1.0 - smoothstep(0.25, 0.6, h));
    vec3 cc2 = mix(uCloud * 0.9, uCloudLit * vec3(1.0, 0.86, 0.68), clamp(pow(s, 2.0) * 0.9 + (1.0 - smoothstep(0.5, 0.64, c2)) * 0.5, 0.0, 1.0));
    col = mix(col, cc2, m2 * 0.75);
  }
  col += vec3(1.0, 0.72, 0.42) * pow(s, 6.0) * 0.35 * uSun;
  col += vec3(1.0, 0.92, 0.75) * pow(s, 180.0) * 1.6 * uSun;
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

function makeSkyUniforms() {
  return {
      uHorizon: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
      uCloud: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      uClouds: { value: 1 },
      uTime: { value: 0 },
      uSun: { value: 1 },
  }
}

// ---- city -------------------------------------------------------------------------
function makeWindowTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#140d0b'
  g.fillRect(0, 0, 64, 256)
  const r = rng(7)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 6; x++) {
      const v = r()
      g.fillStyle = v < 0.42 ? (v < 0.2 ? '#ffd27a' : '#ffad4a') : '#2a1c17'
      g.fillRect(4 + x * 10, 3 + y * 8, 6, 4)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Building { x: number; z: number; w: number; d: number; h: number }
const BUILDINGS: Building[] = (() => {
  const r = rng(42)
  const out: Building[] = []
  for (let gx = -16; gx <= 16; gx++) {
    for (let gz = -16; gz <= 16; gz++) {
      const x = gx * 2.4 + (r() - 0.5) * 0.4
      const z = gz * 2.4 + (r() - 0.5) * 0.4
      // Keep a street open in front of the golden monolith so shots 6 and 8 can see it.
      if (Math.abs(x - MONO_C.x) < 3.2 && z > MONO_C.z - 3.2 && z < MONO_C.z + 30) continue
      out.push({ x, z, w: 1.4 + r() * 0.7, d: 1.4 + r() * 0.7, h: 1.2 + Math.pow(r(), 2) * 8 })
    }
  }
  // Skyscrapers framing the golden monolith (shot 6)
  ;[[-6, -2], [6, -1], [-8.5, -6], [8, -6], [-5, -9], [5.5, -10]].forEach(([dx, dz], i) =>
    out.push({ x: MONO_C.x + dx, z: MONO_C.z + dz, w: 3, d: 3, h: 16 + ((i * 37) % 9) }),
  )
  return out
})()

function City({ groupRef }: { groupRef: MutableRefObject<THREE.Group | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { geometry, materials } = useMemo(() => {
    const win = makeWindowTexture()
    const side = new THREE.MeshLambertMaterial({ color: '#3a2620', emissive: '#ffffff', emissiveMap: win, emissiveIntensity: 1.5 })
    const top = new THREE.MeshLambertMaterial({ color: '#5a3c30' })
    return { geometry: new THREE.BoxGeometry(1, 1, 1), materials: [side, side, top, top, side, side] }
  }, [])
  useLayoutEffect(() => {
    const m = meshRef.current
    if (!m) return
    const o = new THREE.Object3D()
    BUILDINGS.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z)
      o.scale.set(b.w, b.h, b.d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    return () => {
      geometry.dispose()
      materials[0].emissiveMap?.dispose()
      materials[0].dispose()
      materials[2].dispose()
    }
  }, [geometry, materials])
  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geometry, materials, BUILDINGS.length]} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#1c120f" />
      </mesh>
    </group>
  )
}

// ---- pillars for the footsteps shot -------------------------------------------------
// [x, top offset, z]: the walked row sits at PILLAR_TOP; the rest scatter lower like rooftops.
const PILLARS: [number, number, number][] = [
  [-1.6, 0, 0.1], [-0.8, 0, -0.05], [0, 0, 0.08], [0.8, 0, -0.06], [1.6, 0, 0.05],
  [-1.1, -1.4, -1.5], [0.4, -2.2, -1.8], [1.9, -1.1, -1.4], [2.6, -2.8, -0.4], [1.2, -3.2, -3.2],
  [-0.2, -3.6, -3.6], [2.9, -1.9, -2.6], [-1.8, -2.5, 1.6], [3.4, -3.4, 1.0],
]
function Pillars({ groupRef }: { groupRef: MutableRefObject<THREE.Group | null> }) {
  return (
    <group ref={groupRef}>
      {PILLARS.map(([x, dy, z], i) => {
        const top = PILLAR_TOP + dy
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position-y={top / 2 - 0.05}>
              <boxGeometry args={[0.52, top - 0.1, 0.52]} />
              <meshStandardMaterial color="#2a1c16" roughness={0.8} />
            </mesh>
            <mesh position-y={top - 0.05}>
              <boxGeometry args={[0.64, 0.12, 0.64]} />
              <meshStandardMaterial color="#e0a855" emissive="#7a4a14" emissiveIntensity={0.6} metalness={0.4} roughness={0.35} />
            </mesh>
            <mesh position-y={top + 0.012} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.5, 0.5]} />
              <meshBasicMaterial color="#160e0a" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ---- explosion ---------------------------------------------------------------------
interface Puff { dir: THREE.Vector3; speed: number; r: number; delay: number }
const FIRE: Puff[] = (() => {
  const r = rng(99)
  return Array.from({ length: 72 }, () => {
    const a = r() * Math.PI * 2
    const y = 0.05 + r() * 0.9
    const k = Math.sqrt(1 - y * y)
    return { dir: new THREE.Vector3(Math.cos(a) * k, y, Math.sin(a) * k), speed: 4 + r() * 9, r: 1 + r() * 2.2, delay: r() * 0.3 }
  })
})()
const SMOKE: Puff[] = FIRE.slice(0, 24).map((p, i) => ({ ...p, speed: p.speed * 0.8, r: p.r * 1.4, delay: 0.15 + (i % 4) * 0.06 }))
const DEBRIS: Puff[] = (() => {
  const r = rng(5)
  return Array.from({ length: 40 }, () => {
    const a = r() * Math.PI * 2
    const y = 0.2 + r() * 0.8
    const k = Math.sqrt(1 - y * y)
    return { dir: new THREE.Vector3(Math.cos(a) * k, y, Math.sin(a) * k), speed: 6 + r() * 10, r: 0.08 + r() * 0.25, delay: r() * 0.1 }
  })
})()

// Linear HDR colours: only the hot core clears the bloom threshold, the body stays orange-red.
const HOT = new THREE.Color(3.0, 2.0, 0.7)
const ORANGE = new THREE.Color(1.5, 0.32, 0.02)
const EMBER = new THREE.Color(0.8, 0.02, 0.04)

/** Soft, slightly lumpy radial puff used for fire and smoke sprites. */
function makePuffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = rng(11)
  for (let k = 0; k < 7; k++) {
    const x = 64 + (r() - 0.5) * 40
    const y = 64 + (r() - 0.5) * 40
    const rad = 30 + r() * 28
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Explosion({ groupRef, timeRef }: { groupRef: MutableRefObject<THREE.Group | null>; timeRef: MutableRefObject<number> }) {
  const puff = useMemo(() => makePuffTexture(), [])
  useEffect(() => () => puff.dispose(), [puff])
  const fire = useRef<(THREE.Sprite | null)[]>([])
  const smoke = useRef<(THREE.Sprite | null)[]>([])
  const debris = useRef<(THREE.Mesh | null)[]>([])
  const light = useRef<THREE.PointLight>(null)
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const e = timeRef.current - SHOTS[8].start
    if (e < 0 || e > 1.2) return
    FIRE.forEach((p, i) => {
      const m = fire.current[i]
      if (!m) return
      const k = clamp01((e - p.delay) / 0.9)
      const out = 1 - Math.pow(1 - k, 3)
      m.position.copy(p.dir).multiplyScalar(p.speed * out)
      m.scale.setScalar(k <= 0 ? 0.001 : p.r * 2 * (0.4 + out * 1.8))
      const mat = m.material as THREE.SpriteMaterial
      if (i % 3 === 0) {
        // Additive yellow-white core
        tmp.copy(HOT).lerp(ORANGE, clamp01(k * 1.6))
        mat.opacity = k <= 0 ? 0 : 0.85 * (1 - clamp01((k - 0.55) / 0.4))
      } else {
        // Opaque-ish orange -> deep red body
        tmp.copy(ORANGE).lerp(EMBER, clamp01((k - 0.15) / 0.6))
        mat.opacity = k <= 0 ? 0 : 0.92 * (1 - clamp01((k - 0.75) / 0.25))
      }
      mat.color.copy(tmp)
    })
    SMOKE.forEach((p, i) => {
      const m = smoke.current[i]
      if (!m) return
      const k = clamp01((e - p.delay) / 1.0)
      m.position.copy(p.dir).multiplyScalar(p.speed * (1 - Math.pow(1 - k, 2))).add(new THREE.Vector3(0, k * 2, 0))
      m.scale.setScalar(k <= 0 ? 0.001 : p.r * 2 * (0.6 + k * 2.2))
      ;(m.material as THREE.SpriteMaterial).opacity = k <= 0 ? 0 : 0.75 * Math.min(1, k * 4)
    })
    DEBRIS.forEach((p, i) => {
      const m = debris.current[i]
      if (!m) return
      const k = Math.max(0, e - p.delay)
      m.position.set(p.dir.x * p.speed * k, p.dir.y * p.speed * k - 9.8 * 0.5 * k * k, p.dir.z * p.speed * k)
      m.rotation.set(k * 9 + i, k * 7, k * 5)
      m.scale.setScalar(k <= 0 ? 0.001 : p.r)
    })
    if (light.current) light.current.intensity = 60 * Math.exp(-e * 3)
  })

  return (
    <group ref={groupRef} position={[MONO_C.x, 3, MONO_C.z]}>
      <pointLight ref={light} color="#ff9a4a" distance={60} decay={1.2} />
      {SMOKE.map((_, i) => (
        <sprite key={`s${i}`} ref={(m) => { smoke.current[i] = m }}>
          <spriteMaterial map={puff} color="#2a1610" transparent depthWrite={false} fog={false} toneMapped={false} />
        </sprite>
      ))}
      {FIRE.map((_, i) => (
        <sprite key={`f${i}`} ref={(m) => { fire.current[i] = m }}>
          <spriteMaterial map={puff} rotation={i * 2.39} transparent depthWrite={false} fog={false} blending={i % 3 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending} toneMapped={false} />
        </sprite>
      ))}
      {DEBRIS.map((_, i) => (
        <mesh key={`d${i}`} ref={(m) => { debris.current[i] = m }}>
          <boxGeometry args={[1, 0.6, 0.8]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#ff8a3d' : '#2a1a14'} fog={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---- speed-line tunnel (shot 3) -------------------------------------------------------
const TUNNEL = new THREE.Vector3(0, -400, 0)
const TUN_L = 70
interface Streak { a: number; r: number; z: number; speed: number; len: number; color: THREE.Color }
const STREAKS: Streak[] = (() => {
  const r = rng(21)
  return Array.from({ length: 420 }, (_, k) => ({
    a: r() * Math.PI * 2,
    r: 0.6 + Math.pow(r(), 0.7) * 5.5,
    z: r() * TUN_L,
    speed: 30 + r() * 40,
    len: 1.5 + r() * 5,
    color: new THREE.Color(k % 9 === 0 ? '#ff3a5c' : k % 4 === 0 ? '#ffd27a' : '#fff4dc'),
  }))
})()

function Tunnel({ groupRef, timeRef }: { groupRef: MutableRefObject<THREE.Group | null>; timeRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const { geo, mat } = useMemo(
    () => ({
      geo: new THREE.BoxGeometry(0.03, 0.03, 1),
      mat: new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    }),
    [],
  )
  const o = useMemo(() => new THREE.Object3D(), [])
  const c = useMemo(() => new THREE.Color(), [])
  // Create the instance colour buffer before the first compile so it never recompiles mid-shot.
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    STREAKS.forEach((_, k) => m.setColorAt(k, c.setScalar(0)))
    return () => {
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat, c])

  useFrame(() => {
    const m = mesh.current
    const local = timeRef.current - SHOTS[3].start
    if (!m || local < 0 || local > 1) return
    const travel = local + local * local * 1.2 // accelerate into the dive
    STREAKS.forEach((s, k) => {
      const z = ((s.z + travel * s.speed) % TUN_L) - TUN_L + 2 // streaks rush toward and past the lens
      const thick = 1 + s.r * 0.25
      o.position.set(Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, z)
      o.scale.set(thick, thick, s.len * (0.6 + local * 1.4))
      o.updateMatrix()
      m.setMatrixAt(k, o.matrix)
      m.setColorAt(k, c.copy(s.color).multiplyScalar(clamp01((z + TUN_L - 2) / 25) * 1.6)) // fade in from far end
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - clamp01((local - 0.8) / 0.12) // black hold <= 0.1s before the cube
  })

  return (
    <group ref={groupRef} position={[TUNNEL.x, TUNNEL.y, TUNNEL.z]}>
      <instancedMesh ref={mesh} args={[geo, mat, STREAKS.length]} frustumCulled={false} />
    </group>
  )
}

// ---- obsidian rune cube (shot 4) --------------------------------------------------------
function makeRuneTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 512, 512)
  g.lineCap = 'round'
  g.shadowBlur = 10
  // Crisp bevel highlight just inside each face edge
  g.shadowColor = '#ffcf7a'
  g.strokeStyle = 'rgba(255,222,160,0.95)'
  g.lineWidth = 5
  g.strokeRect(10, 10, 492, 492)
  g.strokeStyle = 'rgba(245,185,66,0.45)'
  g.lineWidth = 2
  g.strokeRect(30, 30, 452, 452)
  // Golden rune ring
  g.strokeStyle = 'rgba(245,185,66,0.85)'
  g.lineWidth = 2.5
  ;[150, 118].forEach((rad) => {
    g.beginPath()
    g.arc(256, 256, rad, 0, Math.PI * 2)
    g.stroke()
  })
  const r = rng(77)
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2
    const cx = 256 + Math.cos(a) * 134
    const cy = 256 + Math.sin(a) * 134
    g.beginPath()
    for (let j = 0; j < 3; j++) {
      g.moveTo(cx + (r() - 0.5) * 18, cy + (r() - 0.5) * 18)
      g.lineTo(cx + (r() - 0.5) * 18, cy + (r() - 0.5) * 18)
    }
    g.stroke()
  }
  // Crimson sigil and circuit lines
  g.shadowColor = '#e11d48'
  g.strokeStyle = 'rgba(225,29,72,0.85)'
  g.lineWidth = 2
  ;[-Math.PI / 2, Math.PI / 2].forEach((a0) => {
    // Two interlocked triangles: a hexagram
    g.beginPath()
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k * Math.PI * 2) / 3
      g.lineTo(256 + Math.cos(a) * 104, 256 + Math.sin(a) * 104)
    }
    g.stroke()
  })
  ;[[30, 256, 106, 256], [482, 256, 406, 256], [256, 30, 256, 106], [256, 482, 256, 406]].forEach(([x1, y1, x2, y2]) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function RuneCube({ cubeRef }: { cubeRef: MutableRefObject<THREE.Mesh | null> }) {
  const { geo, tex } = useMemo(() => ({ geo: new RoundedBoxGeometry(16, 16, 16, 4, 0.45), tex: makeRuneTexture() }), [])
  useEffect(
    () => () => {
      geo.dispose()
      tex.dispose()
    },
    [geo, tex],
  )
  return (
    <mesh ref={cubeRef} geometry={geo}>
      <meshStandardMaterial color="#120e16" roughness={0.18} metalness={0.55} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={1.3} />
    </mesh>
  )
}

// ---- crimson ribbon trail (shot 5) -------------------------------------------------------
const FALL_ROT = new THREE.Euler(0.7, -0.8, 0.2)
const fallPath = (u: number, out: THREE.Vector3) =>
  out.set(THREE.MathUtils.lerp(3.5, 6.5, u), THREE.MathUtils.lerp(15, 7.5, u), -2)

const RIB_N = 48
const RIB_VERT = /* glsl */ `
attribute float aFade; attribute float aSide;
varying float vFade; varying float vSide;
void main() {
  vFade = aFade; vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const RIB_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade; varying float vSide;
void main() {
  float edge = 1.0 - vSide * vSide;
  vec3 col = uColor * (edge * 0.8 + pow(edge, 8.0) * 1.6) * vFade;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

function Ribbon({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const { geo, uniforms } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const fade = new Float32Array(RIB_N * 2)
    const side = new Float32Array(RIB_N * 2)
    const index: number[] = []
    for (let k = 0; k < RIB_N; k++) {
      fade[k * 2] = fade[k * 2 + 1] = Math.pow(1 - k / (RIB_N - 1), 1.6)
      side[k * 2] = -1
      side[k * 2 + 1] = 1
      if (k < RIB_N - 1) index.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2)
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIB_N * 6), 3))
    g.setAttribute('aFade', new THREE.BufferAttribute(fade, 1))
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
    g.setIndex(index)
    return { geo: g, uniforms: { uColor: { value: new THREE.Color(1.8, 0.06, 0.2) } } }
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const ptsRef = useRef(Array.from({ length: RIB_N }, () => new THREE.Vector3()))
  const off = useMemo(() => new THREE.Vector3(0, CHAR_H * 0.45, 0).applyEuler(FALL_ROT), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const view = useMemo(() => new THREE.Vector3(), [])
  const sideV = useMemo(() => new THREE.Vector3(), [])

  // Analytic, frame-locked trail: points are the fall path sampled back in time, so it is smooth
  // at any frame rate and under ?intro-t freezes.
  useFrame(({ camera }) => {
    const m = mesh.current
    if (!m) return
    const sh = SHOTS[5]
    const t = timeRef.current
    m.visible = t >= sh.start && t < sh.end
    if (!m.visible) return
    const u = (t - sh.start) / (sh.end - sh.start)
    const pts = ptsRef.current
    pts.forEach((p, k) => {
      const uk = u - k * 0.03
      const w = k / RIB_N
      fallPath(uk, p).add(off)
      p.x += Math.sin(uk * 7 + 1) * 0.35 * w
      p.z += Math.cos(uk * 5) * 0.35 * w
    })
    const pos = m.geometry.attributes.position as THREE.BufferAttribute
    pts.forEach((p, k) => {
      tan.subVectors(pts[Math.max(k - 1, 0)], pts[Math.min(k + 1, RIB_N - 1)])
      view.subVectors(camera.position, p)
      const width = 0.38 * Math.pow(1 - k / RIB_N, 0.5) + 0.02
      sideV.crossVectors(tan, view).normalize().multiplyScalar(width)
      pos.setXYZ(k * 2, p.x - sideV.x, p.y - sideV.y, p.z - sideV.z)
      pos.setXYZ(k * 2 + 1, p.x + sideV.x, p.y + sideV.y, p.z + sideV.z)
    })
    pos.needsUpdate = true
  })

  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        vertexShader={RIB_VERT}
        fragmentShader={RIB_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}

// ---- character -----------------------------------------------------------------------
interface Rig {
  root: THREE.Group
  head: THREE.Object3D | null
  /** Pose the character at `time` seconds into `clip` (deterministic, no mixer clock). */
  pose: (clip: string, time: number, loop: boolean, mix?: { clip: string; time: number; weight: number }) => void
  /** Layer subtle breathing / head / hair sway on top of the current pose. Call after pose(). */
  breathe: (time: number, amount: number) => void
}

/** [bone, local axis, amplitude (rad), frequency, phase] for the procedural idle layer. */
const IDLE_BONES: [string, 'x' | 'y' | 'z', number, number, number][] = [
  ['Spine2_07', 'x', 0.025, 2.1, 0],
  ['Neck_09', 'x', 0.018, 2.1, -0.7],
  ['Head_010', 'y', 0.05, 0.8, 0.3],
  ['Head_010', 'z', 0.02, 1.3, 1.1],
  ['LeftHair1_Ph_011', 'z', 0.06, 2.7, 0],
  ['RightHair1_Ph_016', 'z', 0.06, 2.5, 1.9],
  ['LeftHair3_Ph_013', 'x', 0.05, 2.3, 0.6],
  ['RightHair3_Ph_018', 'x', 0.05, 2.4, 2.4],
]
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

/** Shared fresnel rim for every toon material on the character; the director sets it per shot. */
const RIM = { uRimColor: { value: new THREE.Color('#ffb257') }, uRimStrength: { value: 0.45 } }

function Character({ rigRef, onReady }: { rigRef: MutableRefObject<Rig | null>; onReady: () => void }) {
  const { scene, animations } = useGLTF(MODEL_URL, false)
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])

  // The file's translation/scale tracks are corrupt (each axis is either 0 or the bind value,
  // hips included), which stretches limbs and neck. Keep rotations only: bones stay at bind length.
  const clips = useMemo(
    () =>
      animations.map(
        (src) => new THREE.AnimationClip(src.name, src.duration, src.tracks.filter((tr) => tr.name.endsWith('.quaternion'))),
      ),
    [animations],
  )

  // Unlit (KHR_materials_unlit) -> toon, so the rim/fill lights actually shape her; sRGB albedo.
  const owned = useMemo(() => {
    const mats: THREE.Material[] = []
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      const src = mesh.material as THREE.MeshBasicMaterial
      if (src.map) src.map.colorSpace = THREE.SRGBColorSpace
      const toon = new THREE.MeshToonMaterial({
        map: src.map,
        color: src.color,
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        opacity: src.opacity,
        side: src.side,
      })
      // Warm fresnel rim so hair and silhouette catch the low sun.
      toon.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, RIM)
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {')
          .replace(
            '#include <opaque_fragment>',
            'outgoingLight += uRimColor * uRimStrength * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\n#include <opaque_fragment>',
          )
      }
      mesh.material = toon
      mats.push(toon)
    })
    return mats
  }, [scene])

  useLayoutEffect(() => {
    const o = outer.current
    const g = inner.current
    if (!o || !g) return
    const clip = (name: string) => clips.find((a) => a.name === `armature|${name}`) ?? null
    // Rest rotations for the idle-layer bones, captured before any clip touches them.
    const idleBase = new Map<THREE.Object3D, THREE.Quaternion>()
    const idleBones = IDLE_BONES.flatMap(([n, axis, amp, freq, phase]) => {
      const bone = scene.getObjectByName(n)
      if (!bone) return []
      if (!idleBase.has(bone)) idleBase.set(bone, bone.quaternion.clone())
      return [{ bone, axis: AXES[axis], amp, freq, phase }]
    })
    const dq = new THREE.Quaternion()

    // Measure in a known pose, in local space (StrictMode re-runs this), then normalise
    // height and put the feet on the origin.
    o.position.set(0, 0, 0)
    o.rotation.set(0, 0, 0)
    g.position.set(0, 0, 0)
    g.scale.setScalar(1)
    const idle = clip('idle') ?? clips[0]
    if (idle) {
      mixer.clipAction(idle).play()
      mixer.update(0)
    }
    o.updateMatrixWorld(true) // from the outer group, so the reset scale reaches the bones
    // Precise bounds skin each vertex with skeleton.boneMatrices, which stay zero until the
    // first render: compute them now or the measurement (and the scale) is garbage.
    scene.traverse((obj) => {
      const sm = obj as THREE.SkinnedMesh
      if (sm.isSkinnedMesh) sm.skeleton.update()
    })
    const box = new THREE.Box3().setFromObject(scene, true)
    const s = CHAR_H / Math.max(box.max.y - box.min.y, 1e-6)
    g.scale.setScalar(s)
    g.position.set((-(box.min.x + box.max.x) / 2) * s, -box.min.y * s, (-(box.min.z + box.max.z) / 2) * s)
    mixer.stopAllAction()

    const live = new Set<THREE.AnimationAction>()
    const drive = (name: string, time: number, loop: boolean, weight: number) => {
      const c = clip(name)
      if (!c) return null
      const a = mixer.clipAction(c)
      if (!live.has(a)) {
        a.reset().play()
        live.add(a)
      }
      a.time = loop ? time % c.duration : Math.min(Math.max(time, 0), c.duration - 1e-3)
      a.setEffectiveWeight(weight)
      return a
    }
    rigRef.current = {
      root: o,
      head: scene.getObjectByName('Head_010') ?? null,
      pose(name, time, loop, mix) {
        const w = mix ? clamp01(mix.weight) : 0
        const keep = new Set<THREE.AnimationAction | null>([
          drive(name, time, loop, 1 - w),
          mix && w > 0 ? drive(mix.clip, mix.time, false, w) : null,
        ])
        live.forEach((a) => {
          if (!keep.has(a)) {
            a.stop()
            live.delete(a)
          }
        })
        // Bones without tracks keep last frame's value, so reset the idle layer first.
        idleBase.forEach((q, b) => b.quaternion.copy(q))
        mixer.update(0)
      },
      breathe(time, amount) {
        idleBones.forEach(({ bone, axis, amp, freq, phase }) =>
          bone.quaternion.multiply(dq.setFromAxisAngle(axis, amp * amount * Math.sin(time * freq + phase))),
        )
      },
    }
    onReady()
    return () => {
      rigRef.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
    }
  }, [scene, clips, mixer, rigRef, onReady])

  // Free GPU memory and the loader cache on unmount (Replay reloads from the HTTP cache).
  useEffect(
    () => () => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      owned.forEach((m) => {
        ;(m as THREE.MeshToonMaterial).map?.dispose()
        m.dispose()
      })
      useGLTF.clear(MODEL_URL)
    },
    [scene, owned],
  )

  return (
    <group ref={outer}>
      <group ref={inner}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

// ---- director: drives camera, character, sets and lighting from `t` --------------------
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
interface Cam { pos: THREE.Vector3; target: THREE.Vector3; fov: number; roll: number }

function Director({ onShot, onEnd, fxRef }: { onShot: (i: number) => void; onEnd: () => void; fxRef: MutableRefObject<HTMLDivElement | null> }) {
  const rig = useRef<Rig | null>(null)
  const warmed = useRef(false)
  const startAt = useRef<number | null>(null)
  const ready = useRef(false)
  const lastShot = useRef(-1)
  const ended = useRef(false)
  const timeRef = useRef(0)

  const skyUniforms = useMemo(() => makeSkyUniforms(), [])
  const skyMat = useRef<THREE.ShaderMaterial>(null)
  const skyMesh = useRef<THREE.Mesh>(null)
  const fogRef = useRef<THREE.Fog>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)

  const city = useRef<THREE.Group | null>(null)
  const pillars = useRef<THREE.Group | null>(null)
  const monoB = useRef<THREE.Mesh>(null)
  const monoC = useRef<THREE.Group>(null)
  const cube = useRef<THREE.Mesh | null>(null)
  const boom = useRef<THREE.Group | null>(null)
  const tunnel = useRef<THREE.Group | null>(null)

  const handleReady = useCallback(() => {
    ready.current = true
  }, [])

  const head = useMemo(() => new THREE.Vector3(), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const sideV = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const r = rig.current
    if (!ready.current || !r) return
    // First ready frame: compile every shader while everything is still visible (and the
    // DOM cover is up), so no set or character pops in late on its first cut. The clock
    // starts on the next frame so compile time doesn't eat into shot 0.
    if (!warmed.current) {
      warmed.current = true
      state.gl.compile(state.scene, state.camera)
      return
    }
    if (startAt.current === null) startAt.current = state.clock.elapsedTime
    const t = FREEZE_T ?? state.clock.elapsedTime - startAt.current
    timeRef.current = t
    const i = shotAt(t)
    const sh = SHOTS[i]
    const local = t - sh.start
    const u = clamp01(local / (sh.end - sh.start))

    if (i !== lastShot.current) {
      lastShot.current = i
      onShot(i)
      const p = MOODS[sh.mood]
      const uni = skyMat.current?.uniforms
      if (uni) {
        ;(uni.uHorizon.value as THREE.Color).set(p.horizon)
        ;(uni.uMid.value as THREE.Color).set(p.mid)
        ;(uni.uTop.value as THREE.Color).set(p.top)
        ;(uni.uCloud.value as THREE.Color).set(p.cloud)
        ;(uni.uCloudLit.value as THREE.Color).set(p.cloudLit)
        uni.uClouds.value = p.clouds
        uni.uSun.value = i === 2 ? 0.25 : 1 // no blown-out sun disc behind the close-up
      }
      RIM.uRimStrength.value = i === 2 ? 0.8 : i === 1 ? 0.7 : 0.45
      const fog = fogRef.current
      if (fog) {
        fog.color.set(p.fog)
        fog.near = p.fogNear
        fog.far = p.fogFar
      }
      if (hemi.current) {
        hemi.current.color.set(p.hemiSky)
        hemi.current.groundColor.set(p.hemiGround)
        hemi.current.intensity = p.hemi
      }
      if (rim.current) rim.current.intensity = p.rim
    }
    if (skyMat.current) skyMat.current.uniforms.uTime.value = t
    // Frame-locked progress for the DOM burst (shot 7) and golden bloom fade (shot 8).
    const fx = fxRef.current
    if (fx) {
      fx.style.setProperty('--fx', u.toFixed(4))
      fx.style.setProperty('--fade', (i === 8 ? THREE.MathUtils.smoothstep(u, 0.35, 1) : 0).toFixed(4))
    }

    // Visibility per shot
    const on = (ref: { current: THREE.Object3D | null }, vis: boolean) => {
      if (ref.current) ref.current.visible = vis
    }
    on(city, i === 0 || i === 5 || i === 6 || i === 8)
    on(pillars, i === 0)
    on(monoB, i === 1 || i === 2)
    on(cube, i === 4)
    on(monoC, i === 6)
    on(boom, i === 8)
    on(tunnel, i === 3)
    on(skyMesh, i !== 3)
    r.root.visible = i === 0 || i === 1 || i === 2 || i === 5

    // Character
    const root = r.root
    root.rotation.set(0, 0, 0)
    if (i === 0) {
      root.position.set(THREE.MathUtils.lerp(-0.9, 0.45, u), PILLAR_TOP, 0)
      root.rotation.y = Math.PI / 2
      r.pose('walk', local * 1.25, true)
    } else if (i === 1) {
      root.position.copy(CHAR_ON_B)
      root.rotation.y = 0.35
      r.pose('stan', local, true)
      r.breathe(t, 1)
    } else if (i === 2) {
      root.position.copy(CHAR_ON_B)
      root.rotation.y = 0.32
      // Calm look down at the lens, then the arm sweeps across (blend 0.55s -> 0.7s).
      r.pose('cmm_01', local, false, { clip: 'unionmagic', time: 0.15 + Math.max(0, local - 0.55) * 1.4, weight: (local - 0.55) / 0.15 })
      r.breathe(t, 1)
    } else if (i === 5) {
      fallPath(u, root.position)
      root.rotation.copy(FALL_ROT)
      r.pose('fall', 0, false)
    }
    root.updateMatrixWorld(true)
    if (r.head) r.head.getWorldPosition(head)
    else head.copy(root.position).add(V(0, CHAR_H * 0.88, 0))

    // Props
    if (cube.current) {
      // Ends ~36 units out so its corners (half-diagonal ~14) stay well clear of the near plane.
      cube.current.position.set(CUBE_SET.x, THREE.MathUtils.lerp(84, 38, ease(u)), CUBE_SET.z + 2)
      cube.current.rotation.set(0.5 + u * 0.5, 0.8 + u * 0.6, 0.35 + u * 0.2)
    }

    // Camera per shot
    const e = ease(u)
    let cam: Cam
    switch (i) {
      case 0: {
        const cx = root.position.x
        cam = { pos: V(cx - 0.55, PILLAR_TOP + 1.75, 1.05), target: V(cx + 0.9, PILLAR_TOP - 1.6, -1.9), fov: 50, roll: 0.18 }
        break
      }
      case 1:
        cam = { pos: V(209, 14, 30).lerp(V(208.2, 14.6, 29), e), target: V(197.4, 29.2, 4), fov: 34, roll: -0.58 }
        break
      case 2:
        cam = {
          pos: head.clone().add(V(0.4, -0.72, 1.25).lerp(V(0.34, -0.62, 1.08), e)),
          target: head.clone().add(V(0, -0.06, 0)),
          fov: 32,
          roll: THREE.MathUtils.lerp(-0.32, -0.2, e),
        }
        break
      case 3:
        cam = {
          pos: TUNNEL.clone(),
          target: TUNNEL.clone().add(V(Math.sin(t * 3) * 0.3, Math.cos(t * 2.3) * 0.2, -10)),
          fov: THREE.MathUtils.lerp(70, 92, e),
          roll: local * 0.6,
        }
        break
      case 4:
        cam = { pos: V(CUBE_SET.x, 0, 0), target: V(CUBE_SET.x + 6, 100, 18), fov: 62, roll: 0.1 }
        break
      case 5:
        cam = { pos: V(11, 2.4, 16), target: V(5.5, 8.5, -2), fov: 46, roll: 0 }
        break
      case 6:
        cam = { pos: V(MONO_C.x - 0.4, 0.6, MONO_C.z + 13 - e * 0.8), target: V(MONO_C.x, 10, MONO_C.z), fov: 52, roll: 0 }
        break
      case 8: {
        const shake = (1 - u) * 0.12
        cam = {
          pos: V(MONO_C.x + 1.5 + Math.sin(t * 63) * shake, 4 + Math.cos(t * 51) * shake, MONO_C.z + THREE.MathUtils.lerp(18, 12, e)),
          target: V(MONO_C.x, 6, MONO_C.z),
          fov: 56,
          roll: 0,
        }
        break
      }
      default:
        cam = { pos: V(0, 5, 10), target: V(0, 5, 0), fov: 50, roll: 0 }
    }

    const c = state.camera as THREE.PerspectiveCamera
    c.position.copy(cam.pos)
    c.up.set(0, 1, 0)
    c.lookAt(cam.target)
    c.rotateZ(cam.roll)
    if (c.fov !== cam.fov) {
      c.fov = cam.fov
      c.updateProjectionMatrix()
    }
    skyMesh.current?.position.copy(c.position)

    // Golden rim from behind the subject (relative to camera); soft fill from the camera side.
    fwd.copy(cam.target).sub(cam.pos).normalize()
    rim.current?.position.copy(fwd).multiplyScalar(10).add(V(0, 7, 0))
    fill.current?.position.copy(fwd).multiplyScalar(-10).add(V(2, 3, 0))
    if (skyMat.current) {
      const sun = (skyMat.current.uniforms.uSunDir.value as THREE.Vector3).copy(fwd)
      if (i === 2) sun.addScaledVector(sideV.crossVectors(fwd, c.up).normalize(), 0.55) // sun off her shoulder
      sun.setY(Math.max(sun.y, 0) * 0.4 + 0.08)
    }

    if (FREEZE_T === null && t >= END && !ended.current) {
      ended.current = true
      onEnd()
    }
  })

  return (
    <>
      <fog ref={fogRef} attach="fog" args={['#ff9e5e', 8, 70]} />
      <mesh ref={skyMesh} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[500, 48, 24]} />
        <shaderMaterial
          ref={skyMat}
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          fog={false}
        />
      </mesh>

      <hemisphereLight ref={hemi} />
      <directionalLight ref={rim} color="#ffbe7b" intensity={2.5} />
      <directionalLight ref={fill} color="#fff0e0" intensity={0.35} />

      <City groupRef={city} />
      <Pillars groupRef={pillars} />
      <mesh ref={monoB} position={[MONO_B.x, MONO_B.y, MONO_B.z]}>
        <boxGeometry args={[12, 60, 12]} />
        <meshStandardMaterial color="#d8a65a" emissive="#5a3510" emissiveIntensity={0.35} metalness={0.3} roughness={0.5} />
      </mesh>
      <group ref={monoC} position={[MONO_C.x, 0, MONO_C.z]}>
        <mesh position-y={9}>
          <boxGeometry args={[2.4, 18, 2.4]} />
          <meshStandardMaterial color="#d8a65a" emissive="#6b4310" emissiveIntensity={0.45} metalness={0.5} roughness={0.35} />
        </mesh>
        {[-0.9, -0.3, 0.2, 0.7, 1.1].map((x, k) => (
          <mesh key={k} position={[x, 30, 0.6]}>
            <planeGeometry args={[0.06 + (k % 2) * 0.05, 26]} />
            <meshBasicMaterial color="#ffe3b0" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <RuneCube cubeRef={cube} />
      <Explosion groupRef={boom} timeRef={timeRef} />
      <Tunnel groupRef={tunnel} timeRef={timeRef} />
      <Ribbon timeRef={timeRef} />

      <Sparkles position={[0, PILLAR_TOP, 0]} count={50} scale={[6, 3, 4]} size={3} speed={0.3} color="#ffd9a0" opacity={0.8} />
      <Sparkles position={[CHAR_ON_B.x, CHAR_ON_B.y + 1, CHAR_ON_B.z]} count={70} scale={[8, 4, 8]} size={3} speed={0.3} color="#ffd9a0" opacity={0.8} />

      <Suspense fallback={null}>
        <Character rigRef={rig} onReady={handleReady} />
      </Suspense>

      <EffectComposer>
        <Bloom luminanceThreshold={0.86} luminanceSmoothing={0.1} intensity={0.6} mipmapBlur />
      </EffectComposer>
    </>
  )
}

/** Stops a failed load or WebGL error from blocking the site: falls through to the cube. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// ---- DOM overlays for the 2D beats -----------------------------------------------------
// Driven by the --fx (shot progress) and --fade CSS variables the director writes each frame,
// so they stay frame-locked with the 3D timeline (and with ?intro-t freezes).
const fxVar = (k: number, base = 0) => `calc(${base} + var(--fx, 0) * ${k})`

function Overlay({ shot, fxRef }: { shot: number; fxRef: MutableRefObject<HTMLDivElement | null> }) {
  return (
    <div ref={fxRef} className="pointer-events-none absolute inset-0">
      {shot === 7 && (
        <>
          {/* Full-screen radial light burst */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 58%, #fffef8 0%, #ffeab0 9%, #f5a23a 24%, #8a1c12 50%, #14070a 85%)' }}
          />
          {/* God rays, rotating slightly */}
          <div
            className="absolute inset-[-50%]"
            style={{
              background: 'repeating-conic-gradient(from 0deg at 50% 54%, rgba(255,244,214,0.55) 0deg 1.4deg, rgba(255,244,214,0) 1.4deg 6.5deg)',
              transform: `rotate(calc(var(--fx, 0) * 14deg)) scale(${fxVar(0.25, 1)})`,
              maskImage: 'radial-gradient(circle at 50% 54%, #000 0%, #000 18%, transparent 55%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 54%, #000 0%, #000 18%, transparent 55%)',
              mixBlendMode: 'screen',
            }}
          />
          {/* Expanding shockwave ring */}
          <div
            className="absolute left-1/2 top-[58%] h-[30vmin] w-[30vmin] rounded-full"
            style={{
              transform: `translate(-50%, -50%) scale(${fxVar(5.5, 0.12)})`,
              opacity: fxVar(-0.9, 1),
              border: '2px solid rgba(255,248,230,0.95)',
              boxShadow: '0 0 30px 8px rgba(255,196,110,0.65), inset 0 0 30px 6px rgba(255,196,110,0.5)',
            }}
          />
          {/* White-hot core flash */}
          <div
            className="absolute left-1/2 top-[58%] h-[40vmin] w-[40vmin] rounded-full"
            style={{
              transform: `translate(-50%, -50%) scale(${fxVar(1.6, 0.4)})`,
              opacity: fxVar(-0.7, 1),
              background: 'radial-gradient(circle, #ffffff 0%, rgba(255,250,235,0.9) 25%, rgba(255,220,150,0) 70%)',
            }}
          />
        </>
      )}
      {shot === 8 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: 'var(--fade, 0)',
            background: 'radial-gradient(circle at 50% 45%, #fffdf6 0%, #fff2cf 30%, #ffdc8e 65%, #f5b942 100%)',
          } as CSSProperties}
        />
      )}
    </div>
  )
}

// ---- entrance ----------------------------------------------------------------------------
export function EntranceSequence({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion()
  const done = useRef(false)
  const fxRef = useRef<HTMLDivElement | null>(null)
  const [shot, setShot] = useState(-1)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (FREEZE_T !== null) return
    const id = window.setTimeout(finish, reduced ? 200 : LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [reduced, finish])

  // Once the timeline is running, replace the load timeout with one just past the end.
  useEffect(() => {
    if (shot !== 0 || FREEZE_T !== null) return
    const id = window.setTimeout(finish, (END + 1.5) * 1000)
    return () => window.clearTimeout(id)
  }, [shot, finish])

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-black"
      exit={{ opacity: 0, transition: { duration: EXIT_S, ease: 'easeOut' } }}
      role="presentation"
    >
      {!reduced && (
        <SceneBoundary onError={finish}>
          <Canvas
            flat
            dpr={[1, 1.75]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 55, near: 0.05, far: 1200, position: [0, 21, 1] }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.NoToneMapping
            }}
          >
            <Director onShot={setShot} onEnd={finish} fxRef={fxRef} />
          </Canvas>
        </SceneBoundary>
      )}

      <Overlay shot={shot} fxRef={fxRef} />

      {/* Clean black cover until the model is loaded, shaders are warm and shot 0 has rendered. */}
      {shot === -1 && <div className="absolute inset-0 bg-black" />}

      <button
        type="button"
        onClick={finish}
        aria-label="Skip intro"
        className="absolute bottom-5 right-6 z-10 flex items-center gap-2 rounded-full border border-white/70 bg-black/65 px-4 py-2 text-sm font-medium tracking-wide text-white shadow-[0_2px_14px_rgba(0,0,0,0.55)] ring-1 ring-black/50 backdrop-blur-md transition-colors [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] hover:border-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        Skip
        <SkipForward size={14} aria-hidden="true" />
      </button>
    </motion.div>
  )
}
