import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against a real server + Postgres (test plan §3).
 * Prerequisites: `npm run build`, `npm run db:up`, then run the server with
 *   SERVE_CLIENT=true EMAIL_PROVIDER=console BOOTSTRAP_CC_EMAIL=cc@e2e.test
 * and its stdout redirected to the file named by E2E_SERVER_LOG (codes are read from it).
 * Run: npx playwright test -c e2e
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3999',
    channel: process.env.E2E_BROWSER_CHANNEL ?? 'msedge',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 860 } } },
  ],
});
