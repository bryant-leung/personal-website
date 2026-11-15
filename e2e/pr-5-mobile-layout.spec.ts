// PR #5: mobile layout: header buttons icon-only, taller detail sheet; desktop unchanged.
// Run: npm run e2e -- e2e/pr-5-mobile-layout.spec.ts
import { expect, test, type Page } from '@playwright/test'

const box = async (page: Page, sel: Parameters<Page['locator']>[0]) => (await page.locator(sel).first().boundingBox())!

async function openFeatured(page: Page) {
  await page.getByRole('button', { name: 'Stage II: Projects', exact: true }).click()
  await page.getByRole('button', { name: 'Featured Builds — Projects' }).click()
  const panel = page.locator('[data-labyrinth-panel]')
  await expect(panel).toBeVisible()
  return panel
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('portfolio:entrance-done', '1'))
})

test.describe('mobile 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test('header buttons do not overlap the name and show icons only', async ({ page }) => {
    await page.goto('/')
    const name = await box(page, 'text=BRYANT LEUNG')
    const sound = page.getByRole('button', { name: /Turn sound/ })
    const replay = page.getByRole('button', { name: 'Replay intro' })
    await expect(sound).toBeVisible()
    await expect(replay).toBeVisible()
    await expect(page.getByText('SOUND OFF')).toBeHidden()
    expect((await sound.boundingBox())!.x).toBeGreaterThanOrEqual(name.x + name.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  })

  test('detail sheet is at least 55% of viewport height', async ({ page }) => {
    await page.goto('/')
    const panel = await openFeatured(page)
    await page.waitForTimeout(500)
    expect((await panel.boundingBox())!.height).toBeGreaterThanOrEqual(568 * 0.55 - 1)
  })
})

test.describe('desktop 1440x900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('header buttons keep text labels', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('SOUND OFF')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Replay intro' })).toContainText('Replay intro')
  })
})
