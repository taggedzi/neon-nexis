const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Exercise the actual staging command, rather than duplicating its filtering.
execFileSync(process.execPath, ['tools/ci/package.cjs'], { stdio: 'pipe' });
assert.equal(fs.existsSync('dist/js/dev.js'), false);
assert.equal(fs.readFileSync('dist/index.html', 'utf8').includes('js/dev.js'), false);
console.log('Dev entry point absent from staged package.');
