import { defineConfig, devices } from '@playwright/test'

// Starts the real backend (FastAPI) and the built frontend, then drives Chromium.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: [
    { command: 'cd ../backend && python -m uvicorn app.main:app --port 8000', url: 'http://127.0.0.1:8000/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120_000 },
  ],
})
