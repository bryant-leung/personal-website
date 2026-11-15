// PR #1: sound toggle and procedural BGM/SFX. Run: npm run e2e -- e2e/pr-1-2d-entrance-sound.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Probe = { ctxs: AudioContext[]; ticks: number }
declare global {
  interface Window { __audio: Probe }
}

// Records every AudioContext and every 50 ms noise burst (the clock tick's escapement click).
async function instrument(page: Page, entered: boolean) {
  await page.addInitScript((skipIntro) => {
    if (skipIntro) sessionStorage.setItem('portfolio:entrance-done', '1')
    const probe: Probe = { ctxs: [], ticks: 0 }
    window.__audio = probe
    const Base = window.AudioContext
    window.AudioContext = class extends Base {
      constructor(opts?: AudioContextOptions) {
        super(opts)
        probe.ctxs.push(this)
      }
    }
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when?: number, offset?: number, duration?: number) {
      if (duration === 0.05) probe.ticks++
      return start.call(this, when, offset, duration)
    }
  }, entered)
}

const ctxState = (page: Page) => page.evaluate(() => window.__audio.ctxs[0]?.state ?? 'none')

test('page loads muted with no audio context', async ({ page }) => {
  await instrument(page, false)
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Turn sound on' })
  await expect(toggle).toHaveText('SOUND OFF')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => window.__audio.ctxs.length)).toBe(0)
})

test('turning sound on starts the audio engine', async ({ page }) => {
  await instrument(page, false)
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toHaveText('SOUND ON')
  await expect.poll(() => ctxState(page)).toBe('running')
})

test('turning sound off fades out and suspends the engine', async ({ page }) => {
  await instrument(page, false)
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => ctxState(page)).toBe('running')
  await page.getByRole('button', { name: 'Turn sound off' }).click()
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toHaveText('SOUND OFF')
  await expect.poll(() => ctxState(page)).toBe('suspended')
})

test('switching stage plays a clock tick only when sound is on', async ({ page }) => {
  await instrument(page, true)
  await page.goto('/')
  const next = page.getByRole('button', { name: 'Next stage' })
  await next.click()
  expect(await page.evaluate(() => window.__audio.ticks)).toBe(0)
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => ctxState(page)).toBe('running')
  await next.click()
  await expect.poll(() => page.evaluate(() => window.__audio.ticks)).toBe(1)
})
