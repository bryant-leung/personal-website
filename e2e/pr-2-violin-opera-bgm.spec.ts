// PR #2: bowed violin, operatic soprano/choir and climax layers in the procedural BGM.
// Run: npm run e2e -- e2e/pr-2-violin-opera-bgm.spec.ts
import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window { __params: Set<number>; __direct: Set<number>; __comps: number }
}

// Records every AudioParam value the engine sets (rounded to 0.01), direct `.value` sets separately,
// and every compressor created.
async function instrument(page: Page) {
  await page.route('**/audio/bgm.mp3', (r) => r.fulfill({ status: 404 })) // exercise the procedural engine, not the cached file
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:entrance-done', '1')
    const seen = new Set<number>()
    const direct = new Set<number>()
    window.__params = seen
    window.__direct = direct
    window.__comps = 0
    const note = (v: number) => seen.add(Math.round(v * 100) / 100)
    const proto = AudioParam.prototype
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')!
    Object.defineProperty(proto, 'value', {
      ...desc,
      set(v: number) {
        note(v)
        direct.add(Math.round(v * 100) / 100)
        desc.set!.call(this, v)
      },
    })
    for (const m of ['setValueAtTime', 'setTargetAtTime'] as const) {
      const orig = proto[m] as (...a: number[]) => AudioParam
      proto[m] = function (this: AudioParam, v: number, ...rest: number[]) {
        note(v)
        return orig.call(this, v, ...rest)
      } as never
    }
    const make = AudioContext.prototype.createDynamicsCompressor
    AudioContext.prototype.createDynamicsCompressor = function () {
      window.__comps++
      return make.call(this)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
}

const has = (page: Page, v: number) => page.evaluate((x) => window.__params.has(x), v)

test('violin voice uses body resonances and 5.8 Hz vibrato', async ({ page }) => {
  await instrument(page)
  for (const v of [280, 460, 2400, 4200, 5.8, 11]) await expect.poll(() => has(page, v)).toBe(true)
})

// Voices are humanised: each singer's formants vary ±6% and vibrato 5.4–6.6 Hz.
const hasIn = (page: Page, lo: number, hi: number) =>
  page.evaluate(([a, b]) => [...window.__params].some((v) => v >= a && v <= b), [lo, hi])

test('choir sings through humanised vowel formants and vibrato', async ({ page }) => {
  await instrument(page)
  for (const f of [570, 840, 2410]) await expect.poll(() => hasIn(page, f * 0.94, f * 1.06)).toBe(true)
  await expect.poll(() => hasIn(page, 5.4, 6.6)).toBe(true)
})

test('music bus runs through a compressor and limiter', async ({ page }) => {
  await instrument(page)
  await expect.poll(() => page.evaluate(() => window.__comps)).toBe(2)
})

test('climax at bar 9 brings in soprano Bb5 and string tremolo', async ({ page }) => {
  await instrument(page)
  // The whole loop is rendered offline up front, so the climax layers are set during that render.
  // Only soprano oscillators set frequency directly at Bb5 (932.33 Hz); the violin glides via setTargetAtTime.
  await expect.poll(() => has(page, 0.38)).toBe(true) // tremolo depth
  await expect.poll(() => page.evaluate(() => window.__direct.has(932.33))).toBe(true)
})
