'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
if (!fs.existsSync(path.join(root, '.git'))) process.exit(0);

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'inherit'
});
if (result.status !== 0) process.exit(result.status == null ? 1 : result.status);
console.log('pre-push hook installed (.githooks).');
