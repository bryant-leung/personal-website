// PR #2: personal website listed as a project, kept out of AI / Systems Work.
// Run: npm run e2e -- e2e/pr-2-personal-website-project.spec.ts
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

test('featured builds lists the personal website with its repo link', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Featured Builds')
  await expect(panel).toContainText('Four systems')
  await expect(panel).toContainText('Personal Website')
  await expect(panel.locator('a[href="https://github.com/bryant-leung/personal-website"]')).toHaveCount(1)
})

test('Hackathons excludes the personal website', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Hackathons')
  await expect(panel).toContainText('Decode and Detect')
  await expect(panel).not.toContainText('Personal Website')
})
