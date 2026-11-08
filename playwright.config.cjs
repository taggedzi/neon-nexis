const os = require('node:os');
const { defineConfig } = require('@playwright/test');
const { enabledUrl, sampleUrl } = require('./tools/ci/browser-ports.cjs');

const cores = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;
const workerLimit = Number(process.env.NEON_TEST_WORKERS ?? 2);
if (!Number.isInteger(workerLimit) || workerLimit < 1 || workerLimit > 4) {
  throw Error('NEON_TEST_WORKERS must be an integer from 1 to 4');
}

module.exports = defineConfig({
  testDir: './tools/ci',
  testMatch: '*.spec.cjs',
  timeout: 60000,
  // Keep co-op concurrency bounded: each test can open several game pages.
  // Shared progression scenarios can open four clients each. Larger local
  // pools caused introduction/setup timeouts; explicit overrides remain 1–4.
  fullyParallel: true,
  workers: Math.max(1, Math.min(workerLimit, cores)),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: enabledUrl,
    viewport: { width: 1280, height: 720 },
    // Tracing records every successful test too, even when the result is later
    // discarded. Enable it when diagnosing a failure rather than on every push.
    trace: process.env.NEON_TEST_TRACE === '1' ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    // Full Chromium headless preserves native locked-pointer input on Linux.
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox', launchOptions: {
      // Disposable, same-machine integration profiles use direct loopback
      // candidates instead of depending on host-network multicast discovery.
      firefoxUserPrefs: {
        'media.peerconnection.ice.loopback': true,
        'media.peerconnection.ice.obfuscate_host_addresses': false
      }
    } } }
  ],
  webServer: [
    {
      command: 'node tools/ci/serve-php.cjs enabled',
      url: enabledUrl,
      reuseExistingServer: false
    },
    {
      command: 'node tools/ci/serve-php.cjs sample',
      url: sampleUrl,
      reuseExistingServer: false
    }
  ]
});
