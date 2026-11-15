// PR #3: hackathon work split out of Featured Builds into its own Hackathons node.
// Run: npm run e2e -- e2e/pr-3-hackathons-split.spec.ts
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

test('featured builds lists four personal projects, not the hackathon', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Featured Builds')
  await expect(panel).toContainText('Four systems')
  await expect(panel).not.toContainText('Decode and Detect')
})

test('hackathons node shows Decode and Detect with its repo link', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Hackathons')
  await expect(panel).toContainText('Decode and Detect')
  await expect(panel.locator('a[href="https://github.com/bryant-leung/gradient-descent-cbt-hackathon"]')).toHaveCount(1)
})

test('AI / Systems Work node is gone', async ({ page }) => {
  await page.getByRole('button', { name: /^Stage .*: Projects$/ }).click()
  await expect(page.getByRole('button', { name: 'AI / Systems Work — Projects' })).toHaveCount(0)
})
