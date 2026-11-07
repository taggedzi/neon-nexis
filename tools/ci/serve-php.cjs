'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const { enabledPort, samplePort } = require('./browser-ports.cjs');

const root = path.resolve(__dirname, '..', '..');
const publicRoot = path.resolve(root, process.env.SERVE_DIR || '.');
if (publicRoot !== root && !publicRoot.startsWith(root + path.sep)) {
  throw Error('SERVE_DIR must be inside the repository');
}
if (!fs.existsSync(path.join(publicRoot, 'index.html'))) {
  throw Error('SERVE_DIR must contain the staged index.html');
}
const mode = process.argv[2] === 'sample' ? 'sample' : 'enabled';
const port = mode === 'sample' ? samplePort : enabledPort;
const config = mode === 'sample'
  ? path.join(root, 'php', 'coop-config.sample.php')
  : path.join(root, 'tools', 'fixtures', 'coop-config.enabled.php');
const database = path.join(os.tmpdir(), 'neon-nexis-playwright-' + mode + '.sqlite');

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  fs.rmSync(database + suffix, { force: true });
}

const child = spawn('php', [
  '-d', 'opcache.enable=0',
  '-S', '127.0.0.1:' + port,
  '-t', publicRoot,
  path.join(root, 'tools', 'ci', 'serve-router.php')
], {
  cwd: root,
  env: { ...process.env, NEON_COOP_CONFIG: config, NEON_COOP_DB: database },
  stdio: ['ignore', 'inherit', 'pipe']
});

// PHP emits two access-log lines for every poll and asset request. Keep startup,
// warnings and HTTP errors visible without flooding the terminal on good runs.
const accessLog = /^\[[^\]]+\] 127\.0\.0\.1:\d+ (?:Accepted|Closing|\[2\d\d\]: .*)$/;
createInterface({ input: child.stderr }).on('line', line => {
  if (process.env.NEON_TEST_TRACE === '1' || !accessLog.test(line)) {
    process.stderr.write(line + '\n');
  }
});

child.on('close', code => {
  process.exit(code == null ? 1 : code);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
