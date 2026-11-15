// PR #1: Japanese kept only for JimakuKasane and the chapter titles; Experience title reads 経歴・スキル.
// Run: npm run e2e -- e2e/pr-1-japanese-copy-cleanup.spec.ts
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

test('only JimakuKasane keeps a Japanese project name', async ({ page }) => {
  const panel = await open(page, 'Projects', 'Featured Builds')
  await expect(panel).toContainText('字幕重ね')
  for (const jp of ['時空間グラフRAG・防災', '市民ハザードマップ', 'XRPL資金洗浄検知']) await expect(panel).not.toContainText(jp)
})

test('Experience chapter title reads 経歴・スキル', async ({ page }) => {
  await page.getByRole('button', { name: /^Stage .*: Experience & Stack$/ }).click()
  await expect(page.getByText('経歴・スキル')).toBeVisible()
  await expect(page.getByText('経歴と技術')).toHaveCount(0)
})
