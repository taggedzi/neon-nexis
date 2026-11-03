'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { Script } = require('node:vm');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-package-'));
const command = path.join(root, 'tools', 'ci', 'package.cjs');
const env = { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_SHA: 'package-regression' };

function files(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? files(path.join(directory, entry.name), name + '/') : [name];
  }).sort();
}

function stage(args, overrides = {}) {
  execFileSync(process.execPath, [command, ...args], { cwd: scratch, env: { ...env, ...overrides } });
  const output = path.join(scratch, 'dist');
  const names = files(output);
  assert.equal(names.some(name => name.endsWith('.map')), false);
  assert.equal(names.includes('js/dev.js'), false);
  assert.equal(names.some(name => /^(docs|tools|node_modules)\//.test(name)), false);
  assert.ok(names.includes('.nojekyll'));
  assert.deepEqual(fs.readFileSync(path.join(output, 'LICENSE')), fs.readFileSync(path.join(root, 'LICENSE')));
  for (const name of names.filter(name => name.endsWith('.js'))) {
    new Script(fs.readFileSync(path.join(output, name), 'utf8'), { filename: name });
  }
  return new Map(names.map(name => [name, fs.readFileSync(path.join(output, name))]));
}

try {
  for (const name of ['index.html', 'LICENSE', 'js', 'css']) {
    fs.cpSync(path.join(root, name), path.join(scratch, name), { recursive: true });
  }
  const originalUtil = fs.readFileSync(path.join(scratch, 'js/util.js'));
  const plain = stage(['--no-minify']);
  const small = stage(['--minify']);
  assert.deepEqual([...small.keys()], [...plain.keys()]);
  const scripts = data => [...data.get('index.html').toString().matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts(small), scripts(plain));
  assert.equal(scripts(small).includes('js/dev.js'), false);
  for (const type of ['js', 'css', 'html']) {
    const size = data => [...data].filter(([name]) => name.endsWith('.' + type)).reduce((sum, [, bytes]) => sum + bytes.length, 0);
    assert.ok(size(small) < size(plain), type + ' must shrink');
  }
  assert.deepEqual(small.get('release.json'), plain.get('release.json'));
  assert.deepEqual(fs.readFileSync(path.join(scratch, 'js/util.js')), originalUtil);
  const stamped = stage(['--minify'], { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_NUMBER: '42' });
  const release = JSON.parse(stamped.get('release.json'));
  assert.match(release.version, /^\d{4}\.\d{2}\.\d{2}\.0042$/);
  assert.equal(release.commit, 'package-regression');
  assert.ok(stamped.get('js/util.js').toString().includes(release.version));
  const bad = spawnSync(process.execPath, [command, '--unknown'], { cwd: scratch, env, encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Usage:/);
  assert.deepEqual(fs.readFileSync(path.join(scratch, 'dist/release.json')), stamped.get('release.json'));
  console.log('Package modes: syntax, size reductions, load order, stamp, license, source isolation, and public allowlist passed.');
} finally {
  // This exact temporary child was created above; never remove a computed parent.
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(scratch).startsWith('neon-package-'));
  fs.rmSync(scratch, { recursive: true, force: true });
}
