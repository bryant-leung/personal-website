// PR #4: full CV PDF removed from the site; CV is offered on request by email.
// Run: npm run e2e -- e2e/pr-4-cv-on-request.spec.ts
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

test('resume node offers CV by email, with no PDF embed or download', async ({ page }) => {
  const panel = await open(page, 'Contact & CV', 'Resume')
  await expect(panel).toContainText('available on request')
  await expect(panel.getByRole('link', { name: 'Request my CV' })).toHaveAttribute('href', /^mailto:.+\?subject=CV%20request$/)
  await expect(panel.locator('iframe')).toHaveCount(0)
  await expect(panel.locator('a[download], a[href$=".pdf"]')).toHaveCount(0)
})

test('intro node has Request my CV instead of Download CV', async ({ page }) => {
  const panel = await open(page, 'Profile', 'Intro')
  await expect(panel.getByRole('link', { name: 'Request my CV' })).toBeVisible()
  await expect(panel.getByText('Download CV')).toHaveCount(0)
})

test('/cv.pdf is no longer served as a PDF', async ({ request }) => {
  const res = await request.get('/cv.pdf')
  expect(res.headers()['content-type'] ?? '').not.toContain('application/pdf')
})
