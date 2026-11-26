// PR #15: link-preview metadata, a header CV button on every stage, trimmed marks on the site.
// Run: npm run e2e -- e2e/pr-15-link-preview-header-cv.spec.ts
import { expect, test } from '@playwright/test'

const cvButton = 'a[download][aria-label="Download CV"]'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('portfolio:entrance-done', '1'))
  await page.goto('/')
})

test('page has Open Graph and Twitter card metadata with an image', async ({ page }) => {
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-image\.png$/)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https:\/\//)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
})

test('og-image.png is served as a 1200x630 PNG', async ({ request }) => {
  const res = await request.get('/og-image.png')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
  const body = await res.body()
  expect(body.readUInt32BE(16)).toBe(1200)
  expect(body.readUInt32BE(20)).toBe(630)
})

test('header CV button downloads the PDF from any stage (desktop)', async ({ page }) => {
  await expect(page.locator(cvButton)).toHaveAttribute('href', '/Bryant-Leung-CV.pdf')
  await page.getByRole('button', { name: /^Stage .*: Projects$/ }).click()
  await expect(page.locator(cvButton)).toBeVisible()
})

test('header CV button is visible during the intro (desktop)', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.removeItem('portfolio:entrance-done'))
  await page.goto('/')
  await expect(page.locator(cvButton)).toBeVisible()
})

test('education lists credits, year averages and highest marks only', async ({ page }) => {
  await page.getByRole('button', { name: /^Stage .*: Profile$/ }).click()
  await page.getByRole('button', { name: 'Education — Profile' }).click()
  const panel = page.locator('[data-labyrinth-panel]')
  await expect(panel).toContainText('240 of 240 credits')
  await expect(panel).not.toContainText('Security and Networks 75%')
})

test.describe('mobile 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test('header CV button is hidden so the name is not overlapped', async ({ page }) => {
    await expect(page.locator(cvButton)).toBeHidden()
  })
})
