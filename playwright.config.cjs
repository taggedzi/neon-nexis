const os = require('node:os');
const { defineConfig } = require('@playwright/test');

const cores = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;

module.exports = defineConfig({
  testDir: './tools/ci',
  testMatch: '*.spec.cjs',
  timeout: 60000,
  // The co-op file is almost the whole suite, and its tests use separate rooms
  // on one PHP server. Run them side by side, but stop at 4 so that server
  // and the machine are not flooded.
  fullyParallel: true,
  workers: Math.max(1, Math.min(4, cores)),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure'
  },
  projects: [
    // Full Chromium headless preserves native locked-pointer input on Linux.
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } }
  ],
  webServer: [
    {
      command: 'node tools/ci/serve-php.cjs enabled',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false
    },
    {
      command: 'node tools/ci/serve-php.cjs sample',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false
    }
  ]
});
