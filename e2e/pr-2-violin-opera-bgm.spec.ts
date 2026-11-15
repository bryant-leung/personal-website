// PR #2: bowed violin, operatic soprano/choir and climax layers in the procedural BGM.
// Run: npm run e2e -- e2e/pr-2-violin-opera-bgm.spec.ts
import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window { __params: Set<number>; __direct: Set<number>; __comps: number }
}

// Records every AudioParam value the engine sets (rounded to 0.01), direct `.value` sets separately,
// and every compressor created.
async function instrument(page: Page) {
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

test('choir sings through vowel formants with 6.2 Hz vibrato', async ({ page }) => {
  await instrument(page)
  for (const v of [570, 840, 2410, 6.2]) await expect.poll(() => has(page, v)).toBe(true)
})

test('music bus runs through a compressor and limiter', async ({ page }) => {
  await instrument(page)
  await expect.poll(() => page.evaluate(() => window.__comps)).toBe(2)
})

test('climax at bar 9 brings in soprano Bb5 and string tremolo', async ({ page }) => {
  test.setTimeout(40_000)
  await instrument(page)
  // Bar 9 starts ~10.6 s in at 136 BPM. Only soprano oscillators set frequency directly at Bb5 (932.33 Hz);
  // the violin glides via setTargetAtTime.
  const sopranoBb5 = () => page.evaluate(() => window.__direct.has(932.33))
  expect(await sopranoBb5()).toBe(false)
  await expect.poll(() => has(page, 0.38), { timeout: 25_000 }).toBe(true) // tremolo depth
  await expect.poll(sopranoBb5, { timeout: 3_000 }).toBe(true)
})
