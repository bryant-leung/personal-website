// PR #3: labyrinth copy aligned with the CV; project links go to each repo.
// Run: npm run e2e -- e2e/pr-3-cv-content-links.spec.ts
import { expect, test, type Page } from '@playwright/test'

const GH = 'https://github.com/bryant-leung'

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

test('featured builds link to each project repo, not the profile', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Featured Builds')
  await expect(panel).toContainText('Five systems')
  await expect(panel).toContainText('Decode and Detect')
  const hrefs = await panel.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  expect(hrefs).toEqual(expect.arrayContaining([
    `${GH}/jimaku-kasane`,
    `${GH}/Hazard-Reporting-Interactive-Map`,
    `${GH}/gradient-descent-cbt-hackathon`,
  ]))
  expect(hrefs).not.toContain(GH)
})

test('research focus has no repo link for the private FYP', async ({ page }) => {
  const panel = await open(page, 'Profile', 'Research Focus')
  await expect(panel.locator('a[href*="github.com"]')).toHaveCount(0)
})

test('experience lists work and leadership, not the hackathon', async ({ page }) => {
  const panel = await open(page, 'Experience & Stack', 'Experience & Leadership')
  await expect(panel).toContainText('Career Secretary')
  await expect(panel).toContainText('Vice-Chairman, Diocesan Media Group')
  await expect(panel).not.toContainText('Decode and Detect')
})

test('education shows full CV module marks', async ({ page }) => {
  const panel = await open(page, 'Profile', 'Education')
  await expect(panel).toContainText('Security and Networks 75%')
})
