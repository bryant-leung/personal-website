// PR #10: intro frames the seal in a soul-gem shell, and the favicon is the twin-lizard seal.
// Run: npm run e2e -- e2e/pr-10-entrance-soul-gem.spec.ts
import { expect, test } from '@playwright/test'

test('intro shows both halves of the soul-gem shell', async ({ page }) => {
  await page.goto('/')
  const intro = page.getByRole('region', { name: 'Intro' })
  await expect(intro).toBeVisible()
  const shells = intro.locator('svg:has(#gem-shell)')
  await expect(shells).toHaveCount(2)
  for (const s of await shells.all()) await expect(s).toBeVisible()
})

test('seal with its rune ring sits inside the shell', async ({ page }) => {
  await page.goto('/')
  // Seal ids are prefixed per instance since PR #11 (orb-l-rune-ring, orb-r-rune-ring).
  const seals = page.getByRole('region', { name: 'Intro' }).locator('svg:has([id$="rune-ring"])')
  await expect(seals.first()).toBeVisible()
})

test('favicon is the twin-lizard seal', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  const svg = await (await request.get('/favicon.svg')).text()
  expect(svg).toContain('rotate(180)') // second lizard, mirrored around the centre
  expect(svg).toContain('M0 -40 L24 0 L0 40 L-24 0 Z') // central gem
})
