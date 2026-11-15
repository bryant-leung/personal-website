// PR #9: procedural BGM is rendered offline once and looped on the audio thread, so a hidden (throttled) tab keeps
// playing, and turning sound off always silences it.
// Run: npm run e2e -- e2e/pr-9-bgm-offline-render.spec.ts
import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window { __loops: { duration: number; channels: number }[]; __renders: number }
}

// Records every looping buffer source that starts on a live AudioContext, and every offline render.
async function instrument(page: Page) {
  await page.route('**/audio/bgm.mp3', (r) => r.fulfill({ status: 404 })) // exercise the procedural engine, not the cached file
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:entrance-done', '1')
    window.__loops = []
    window.__renders = 0
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: number[]) {
      // Skip the 1 s noise buffer that SFX loop.
      if (this.loop && this.buffer && this.buffer.duration > 2 && this.context instanceof AudioContext)
        window.__loops.push({ duration: this.buffer.duration, channels: this.buffer.numberOfChannels })
      return start.apply(this, a as never)
    }
    const render = OfflineAudioContext.prototype.startRendering
    OfflineAudioContext.prototype.startRendering = function (this: OfflineAudioContext) {
      window.__renders++
      return render.call(this)
    }
  })
}

// The offline render takes ~12 s headless (longer with parallel workers), so allow for it.
test.describe.configure({ timeout: 90_000 })

// 96 eighth notes at 136 BPM.
const LOOP_SECONDS = (96 * 60) / 136 / 2

test('music plays as one looping 21 s stereo buffer', async ({ page }) => {
  await instrument(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__loops.length), { timeout: 40_000 }).toBe(1)
  const [loop] = await page.evaluate(() => window.__loops)
  expect(loop.duration).toBeCloseTo(LOOP_SECONDS, 2)
  expect(loop.channels).toBe(2)
})

test('music starts with page timers frozen (throttled hidden tab)', async ({ page }) => {
  await instrument(page)
  await page.clock.install()
  await page.goto('/')
  await page.clock.pauseAt(Date.now() + 1000)
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__loops.length), { timeout: 40_000 }).toBe(1)
})

test('toggling sound off and on reuses the rendered loop', async ({ page }) => {
  await instrument(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__loops.length), { timeout: 40_000 }).toBe(1)
  await page.getByRole('button', { name: 'Turn sound off' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__loops.length), { timeout: 40_000 }).toBe(2)
  expect(await page.evaluate(() => window.__renders)).toBe(1)
})

test('first pass plays live within a second while the loop renders', async ({ page }) => {
  await instrument(page)
  await page.addInitScript(() => {
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...a: number[]) {
      if (this.context instanceof AudioContext) (window as unknown as { __live: number }).__live ??= performance.now()
      return start.apply(this, a as never)
    }
  })
  await page.goto('/')
  const clicked = await page.evaluate(() => performance.now())
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __live?: number }).__live)).toBeDefined()
  const live = await page.evaluate(() => (window as unknown as { __live: number }).__live)
  expect(live - clicked).toBeLessThan(1000)
  expect(await page.evaluate(() => window.__loops.length)).toBe(0) // rendered loop not ready yet
})

test('turning sound off straight after on stays silent', async ({ page }) => {
  await instrument(page)
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume
    AudioContext.prototype.resume = function (this: AudioContext) {
      ;(window as unknown as { __ctx: AudioContext }).__ctx = this
      return new Promise((r) => setTimeout(r, 800)).then(() => resume.call(this)) // slow resume, as on mobile
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await page.getByRole('button', { name: 'Turn sound off' }).click()
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => (window as unknown as { __ctx: AudioContext }).__ctx.state)).not.toBe('running')
})
