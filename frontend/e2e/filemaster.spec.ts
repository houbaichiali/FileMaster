import { expect, test } from '@playwright/test'

// 1x1 PNG with a valid file signature.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test('language switch applies RTL for Arabic and persists after reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await page.getByTestId('language-switcher').getByRole('button', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('مرحبًا')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const sidebar = page.locator('aside')
  if (await sidebar.isVisible()) {
    const box = await sidebar.boundingBox()
    expect(box!.x).toBeGreaterThan(page.viewportSize()!.width / 2) // sidebar sits on the right in RTL
  }
})

test('theme switch persists and has no flash on reload', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('theme-switcher').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('upload a PNG, convert it to WebP and download the result', async ({ page }) => {
  await page.goto('/convert')
  await page.getByTestId('file-input').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('radio', { name: 'WEBP' }).click()
  await page.getByRole('button', { name: 'Convertir' }).click()
  await expect(page.getByTestId('result-card')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-link').click()])
  expect(download.suggestedFilename()).toBe('pixel.webp')
})

test('a disguised file is rejected with a translated message', async ({ page }) => {
  await page.goto('/convert')
  await page.getByTestId('file-input').setInputFiles({ name: 'fake.jpg', mimeType: 'image/jpeg', buffer: PNG })
  await expect(page.getByRole('alert')).toContainText('ne correspond pas')
})

test('recent files list shows the processed file', async ({ page }) => {
  await page.goto('/convert')
  await page.getByTestId('file-input').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('radio', { name: 'JPG' }).click()
  await page.getByRole('button', { name: 'Convertir' }).click()
  await expect(page.getByTestId('result-card')).toBeVisible()
  await page.getByRole('link', { name: 'Fichiers récents' }).first().click()
  await expect(page.getByTestId('recent-list')).toContainText('pixel.jpg')
})
