'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

if (process.stdin.isTTY) {
  console.error('pre-push: git passes the refs being pushed on stdin. Push not sent.');
  process.exit(1);
}

const chunks = [];
process.stdin.on('data', chunk => chunks.push(chunk));
process.stdin.on('end', () => {
  const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(line => line.trim() !== '');
  const pushing = lines.some(line => {
    const localSha = line.trim().split(/\s+/)[1] || '';
    return !/^0+$/.test(localSha);
  });
  if (!pushing) process.exit(0);

  console.error('pre-push: running npm run check. A failure blocks this push.');
  const result = spawnSync('npm', ['run', 'check'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  process.exit(result.status == null ? 1 : result.status);
});
