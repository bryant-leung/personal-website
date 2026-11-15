/** Shared silhouette geometry for the Tokage-san lizards (seal + stage runner). Units are SVG user units. */
export interface Pt {
  x: number
  y: number
}

/** Degrees clockwise from 12 o'clock. */
export function polarPt(angleDeg: number, r: number): Pt {
  const a = (angleDeg * Math.PI) / 180
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

/** Half-width profile along the body, u = 0 (snout) → 1 (tail tip). */
export function lizardWidth(u: number) {
  if (u < 0.1) return 0.55 + 4.5 * u
  if (u < 0.16) return 1 - (u - 0.1) * 5
  if (u < 0.46) return 0.7 + 0.45 * Math.sin(((u - 0.16) / 0.3) * Math.PI)
  return 0.66 * (1 - (u - 0.46) / 0.54) + 0.04
}

const f = (n: number) => n.toFixed(2)

/** Unit tangent (towards the head) and left normal at spine index k. */
export function frame(spine: Pt[], k: number) {
  const a = spine[Math.max(0, k - 1)]
  const b = spine[Math.min(spine.length - 1, k + 1)]
  const dx = a.x - b.x
  const dy = a.y - b.y
  const len = Math.hypot(dx, dy) || 1
  const t = { x: dx / len, y: dy / len }
  return { t, n: { x: -t.y, y: t.x } }
}

/** Closed body outline around a head-first spine. */
export function bodyPath(spine: Pt[], scale: number) {
  const left: string[] = []
  const right: string[] = []
  spine.forEach((p, k) => {
    const { n } = frame(spine, k)
    const w = lizardWidth(k / (spine.length - 1)) * scale
    left.push(`${f(p.x + n.x * w)} ${f(p.y + n.y * w)}`)
    right.unshift(`${f(p.x - n.x * w)} ${f(p.y - n.y * w)}`)
  })
  const { t } = frame(spine, 0)
  const snout = `${f(spine[0].x + t.x * scale * 0.9)} ${f(spine[0].y + t.y * scale * 0.9)}`
  return `M ${snout} L ${left.join(' L ')} L ${right.join(' L ')} Z`
}

/**
 * Four legs as one stroked path. `splay` = toes and a knee bend (seal);
 * otherwise legs sweep back close to the body (runner).
 */
export function legsPath(spine: Pt[], scale: number, len: number, splay: boolean) {
  const out: string[] = []
  for (const [u, front] of [
    [0.2, true],
    [0.42, false],
  ] as const) {
    const k = Math.round(u * (spine.length - 1))
    const { t, n } = frame(spine, k)
    const w = lizardWidth(u) * scale * 0.8
    for (const s of [1, -1]) {
      const hip = { x: spine[k].x + n.x * s * w, y: spine[k].y + n.y * s * w }
      if (!splay) {
        const foot = { x: hip.x + n.x * s * len * 0.45 - t.x * len, y: hip.y + n.y * s * len * 0.45 - t.y * len }
        out.push(`M ${f(hip.x)} ${f(hip.y)} L ${f(foot.x)} ${f(foot.y)}`)
        continue
      }
      const dir = front ? 1 : -1
      const knee = { x: hip.x + n.x * s * len * 0.7 + t.x * len * 0.25 * dir, y: hip.y + n.y * s * len * 0.7 + t.y * len * 0.25 * dir }
      const foot = { x: knee.x + t.x * len * 0.5 * dir + n.x * s * len * 0.15, y: knee.y + t.y * len * 0.5 * dir + n.y * s * len * 0.15 }
      let d = `M ${f(hip.x)} ${f(hip.y)} L ${f(knee.x)} ${f(knee.y)} L ${f(foot.x)} ${f(foot.y)}`
      // Three fanned toes around the foot's forward direction.
      const base = Math.atan2(foot.y - knee.y, foot.x - knee.x)
      for (const off of [-0.7, 0, 0.7]) {
        const a = base + off
        d += ` M ${f(foot.x)} ${f(foot.y)} l ${f(Math.cos(a) * len * 0.3)} ${f(Math.sin(a) * len * 0.3)}`
      }
      out.push(d)
    }
  }
  return out.join(' ')
}

/** Two eye centres just behind the snout. */
export function eyePoints(spine: Pt[], scale: number): [Pt, Pt] {
  const k = Math.max(1, Math.round(0.05 * (spine.length - 1)))
  const { n } = frame(spine, k)
  const w = lizardWidth(0.05) * scale * 0.55
  const p = spine[k]
  return [
    { x: p.x + n.x * w, y: p.y + n.y * w },
    { x: p.x - n.x * w, y: p.y - n.y * w },
  ]
}
