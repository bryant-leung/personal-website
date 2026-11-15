// PR #11: intro backdrop becomes a perspective canyon of towers, with twin seals and the display fonts loaded.
// Run: npm run e2e -- e2e/pr-11-entrance-canyon.spec.ts
import { expect, test } from '@playwright/test'

test('canyon towers render on both sides of the intro', async ({ page }) => {
  await page.goto('/')
  const intro = page.getByRole('region', { name: 'Intro' })
  await expect(intro).toBeVisible()
  // Each tower's receding side face uses a side-<seed> gradient.
  expect(await intro.locator('linearGradient[id^="side-"]').count()).toBeGreaterThanOrEqual(2)
})

test('twin seals render with unique ids', async ({ page }) => {
  await page.goto('/')
  const intro = page.getByRole('region', { name: 'Intro' })
  await expect(intro.locator('#orb-l-rune-ring')).toHaveCount(1)
  await expect(intro.locator('#orb-r-rune-ring')).toHaveCount(1)
})

test('display fonts are requested from Google Fonts', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]')).toHaveAttribute('href', /Cormorant\+Garamond/)
})
