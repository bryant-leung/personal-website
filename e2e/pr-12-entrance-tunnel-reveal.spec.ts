// PR #12: the intro reveal becomes a tunnel zoom; the intact gem rushes past and its rune ring grows into the dial.
// Run: npm run e2e -- e2e/pr-12-entrance-tunnel-reveal.spec.ts
import { expect, test } from '@playwright/test'

test('intro renders one intact seal, not split halves', async ({ page }) => {
  await page.goto('/')
  const intro = page.getByRole('region', { name: 'Intro' })
  await expect(intro.locator('#orb-rune-ring')).toHaveCount(1)
  await expect(intro.locator('[data-orb-half], [data-fissure], [data-veil], [data-ring]')).toHaveCount(0)
})

test('canyon, cranes and gem shell zoom together inside one tunnel layer', async ({ page }) => {
  await page.goto('/')
  const tunnel = page.getByRole('region', { name: 'Intro' }).locator('[data-tunnel]')
  await expect(tunnel).toHaveCount(1)
  await expect(tunnel.locator('[data-plane]')).toHaveCount(4)
  await expect(tunnel.locator('[data-girder]')).toHaveCount(2)
  await expect(tunnel.locator('[data-arch]')).toHaveCount(2)
})

test('scrolling to the end of the intro reveals the labyrinth', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Intro' })).toBeVisible()
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 600)
  await expect(page.getByRole('navigation', { name: 'Labyrinth stages' })).toBeVisible({ timeout: 15000 })
})
