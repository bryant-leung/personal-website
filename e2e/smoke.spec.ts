// Smoke: intro and labyrinth render. Run: npm run e2e -- e2e/smoke.spec.ts
import { expect, test } from '@playwright/test'

test('intro renders on first visit', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Intro' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('labyrinth renders after the intro has been seen', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('portfolio:entrance-done', '1'))
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Labyrinth stages' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replay intro' })).toBeVisible()
})
