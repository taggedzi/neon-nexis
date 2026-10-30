const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tools/ci',
  testMatch: '*.spec.cjs',
  timeout: 60000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } }
  ],
  webServer: [
    {
      command: 'node tools/ci/server.cjs',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false
    },
    {
      command: 'node server/coop-server.cjs',
      url: 'http://127.0.0.1:8787',
      reuseExistingServer: false
    }
  ]
});
