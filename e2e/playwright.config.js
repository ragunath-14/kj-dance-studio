// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const API_PORT = 5101;   // the e2e backend (your normal dev backend on 5001 is never touched)
const WEB_PORT = 5174;   // the e2e copy of the site (your normal dev site on 5173 is never touched)

module.exports = defineConfig({
  testDir: './tests',
  // One shared throwaway database, so tests run one after another and each seeds its own data.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalTeardown: require.resolve('./support/global-teardown.js'),

  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    // Uses the Google Chrome installed on the machine (no browser download). Set E2E_BROWSER=chromium to use Playwright's own.
    channel: process.env.E2E_BROWSER === 'chromium' ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-IN',
    // The admin site asks window.confirm() questions; each test answers them explicitly where it matters.
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_BROWSER === 'chromium' ? undefined : 'chrome', viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec\.js/ },
    { name: 'mobile',  use: { ...devices['Pixel 7'], channel: process.env.E2E_BROWSER === 'chromium' ? undefined : 'chrome' }, testMatch: /mobile\.spec\.js/ },
  ],

  webServer: [
    {
      // Resets the throwaway database, seeds the admin user, then starts the real backend.
      command: 'node support/start-backend.js',
      url: `http://127.0.0.1:${API_PORT}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      cwd: '../frontend',
      env: { VITE_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      timeout: 90_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
