// PR #14: public CV PDF is downloadable; the full CV stays on request by email.
// Run: npm run e2e -- e2e/pr-14-public-cv.spec.ts
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, stage: string, node: string) {
  await page.getByRole('button', { name: new RegExp(`^Stage .*: ${stage}$`) }).click()
  await page.getByRole('button', { name: `${node} — ${stage}` }).click()
  const panel = page.locator('[data-labyrinth-panel]')
  await expect(panel).toBeVisible()
  return panel
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('portfolio:entrance-done', '1'))
  await page.goto('/')
})

test('resume node offers the PDF download and a full-CV request', async ({ page }) => {
  const panel = await open(page, 'Contact & CV', 'Resume')
  const dl = panel.getByRole('link', { name: 'Download CV' })
  await expect(dl).toHaveAttribute('href', '/Bryant-Leung-CV.pdf')
  await expect(dl).toHaveAttribute('download', 'Bryant-Leung-CV.pdf')
  await expect(panel.getByRole('link', { name: 'Request full CV' })).toHaveAttribute('href', /^mailto:.+\?subject=Full%20CV%20request$/)
  await expect(panel.locator('iframe')).toHaveCount(0)
})

test('intro node has Download CV', async ({ page }) => {
  const panel = await open(page, 'Profile', 'Intro')
  await expect(panel.getByRole('link', { name: 'Download CV' })).toHaveAttribute('href', '/Bryant-Leung-CV.pdf')
})

test('/Bryant-Leung-CV.pdf is served as a PDF', async ({ request }) => {
  const res = await request.get('/Bryant-Leung-CV.pdf')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/pdf')
})

test('legacy /cv.pdf is still not served as a PDF', async ({ request }) => {
  const res = await request.get('/cv.pdf')
  expect(res.headers()['content-type'] ?? '').not.toContain('application/pdf')
})
