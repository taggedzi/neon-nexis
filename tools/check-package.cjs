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
const env = {
  ...process.env, GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '', GITHUB_SHA: 'package-regression',
  NEON_COOP_CONFIG: '', NEON_COOP_DB: ''
};

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
  for (const name of ['.htaccess', 'coop.php', 'coop-cleanup.php', 'coop-config.sample.php', 'lib', 'router.php']) {
    fs.cpSync(path.join(root, 'php', name), path.join(scratch, 'php', name), { recursive: true });
  }
  const configPath = path.join(scratch, 'php/coop-config.php');
  const enabledConfig = '<?php // enabled => false is only a comment\nreturn ["enabled" => true, "iceServers" => [["urls" => "stun:stun.example.com:3478"]], "fixtureSecret" => "private-fixture"];\n';
  const disabled = stage(['--with-coop']);
  assert.equal([...disabled.keys()].some(name => name.startsWith('php/')), false, 'sample disables PHP staging');
  fs.writeFileSync(configPath, enabledConfig);
  fs.writeFileSync(path.join(scratch, 'php', 'private-backup.txt'), 'do not publish');
  const enabled = stage(['--minify', '--with-coop']);
  assert.deepEqual([...enabled.keys()].filter(name => name.startsWith('php/')), [
    'php/.htaccess', 'php/coop-cleanup.php', 'php/coop-config.php', 'php/coop-config.sample.php',
    'php/coop.php', 'php/lib/config.php', 'php/lib/credentials.php', 'php/lib/http.php', 'php/lib/store.php'
  ]);
  assert.equal(enabled.get('php/coop-config.php').toString(), enabledConfig);
  assert.deepEqual(enabled.get('php/.htaccess'), fs.readFileSync(path.join(root, 'php/.htaccess')));
  assert.equal([...enabled].some(([name, bytes]) => !name.startsWith('php/') && bytes.includes('private-fixture')), false);
  const status = JSON.parse(execFileSync(process.env.PHP_PATH || 'php', [path.join(scratch, 'dist/php/coop.php')], {
    cwd: scratch, env: { ...env, NEON_COOP_DB: path.join(scratch, 'lobbies.sqlite') }, encoding: 'utf8'
  }));
  assert.equal(status.enabled, true, 'staged endpoint loads its own config and dependencies');
  assert.equal(JSON.stringify(status).includes('private-fixture'), false);
  execFileSync(process.env.PHP_PATH || 'php', [path.join(scratch, 'dist/php/coop-cleanup.php')], {
    cwd: scratch, env: { ...env, NEON_COOP_DB: path.join(scratch, 'lobbies.sqlite') }
  });
  const normal = stage(['--no-minify']);
  assert.equal([...normal.keys()].some(name => name.startsWith('php/')), false, 'public builds ignore enabled private config');
  fs.writeFileSync(configPath, '<?php // enabled => true is only a comment\nreturn ["enabled" => false];\n');
  assert.equal([...stage(['--with-coop']).keys()].some(name => name.startsWith('php/')), false);
  // An explicitly selected deployment config is packaged under the runtime default name.
  const override = path.join(scratch, 'deployment-config.php');
  fs.writeFileSync(override, enabledConfig);
  const selected = stage(['--with-coop'], { NEON_COOP_CONFIG: override });
  assert.equal(selected.get('php/coop-config.php').toString(), enabledConfig);
  const previous = fs.readFileSync(path.join(scratch, 'dist/php/coop-config.php'));
  const fail = overrides => spawnSync(process.execPath, [command, '--with-coop'], {
    cwd: scratch, env: { ...env, ...overrides }, encoding: 'utf8'
  });
  const ci = fail({ GITHUB_ACTIONS: 'true' });
  assert.notEqual(ci.status, 0);
  assert.match(ci.stderr, /local only/);
  const missingPhp = fail({ PHP_PATH: path.join(scratch, 'missing-php') });
  assert.notEqual(missingPhp.status, 0);
  assert.match(missingPhp.stderr, /PHP_PATH/);
  fs.writeFileSync(configPath, '<?php private-fixture invalid syntax');
  const invalid = fail({});
  assert.notEqual(invalid.status, 0);
  assert.equal((invalid.stdout + invalid.stderr).includes('private-fixture'), false, 'errors do not print config secrets');
  assert.deepEqual(fs.readFileSync(path.join(scratch, 'dist/php/coop-config.php')), previous, 'failed config checks preserve dist');
  console.log('Package modes: syntax, size reductions, load order, stamp, license, source isolation, and public allowlist passed.');
  console.log('Website co-op: enabled/disabled configs, PHP allowlist, dotfile, private config isolation, overrides and failure handling passed.');
} finally {
  // This exact temporary child was created above; never remove a computed parent.
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(scratch).startsWith('neon-package-'));
  fs.rmSync(scratch, { recursive: true, force: true });
}
