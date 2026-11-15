// PR #4: violin automation pruned each note (with a Firefox fallback) and scheduler resyncs after throttling.
// Run: npm run e2e -- e2e/pr-4-violin-automation-prune.spec.ts
import { expect, test } from '@playwright/test'

declare global {
  interface Window { __holds: number; __cancels: number }
}

test('stale automation is cleared with cancelAndHoldAtTime', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:entrance-done', '1')
    window.__holds = 0
    const orig = AudioParam.prototype.cancelAndHoldAtTime
    AudioParam.prototype.cancelAndHoldAtTime = function (this: AudioParam, t: number) {
      window.__holds++
      return orig.call(this, t)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__holds), { timeout: 10_000 }).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('falls back to cancelScheduledValues when cancelAndHoldAtTime is missing (Firefox)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:entrance-done', '1')
    window.__cancels = 0
    // @ts-expect-error simulate Firefox
    delete AudioParam.prototype.cancelAndHoldAtTime
    const orig = AudioParam.prototype.cancelScheduledValues
    AudioParam.prototype.cancelScheduledValues = function (this: AudioParam, t: number) {
      window.__cancels++
      return orig.call(this, t)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.__cancels), { timeout: 10_000 }).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
