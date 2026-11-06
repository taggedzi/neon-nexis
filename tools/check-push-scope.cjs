'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { documentationOnlyPush } = require('./ci/push-scope.cjs');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-push-scope-'));
const zero = '0'.repeat(40);
function git(args) {
  return spawnSync('git', args, { cwd: scratch, encoding: 'utf8' });
}
function run(...args) {
  const result = git(args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function write(file, text) {
  fs.mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true });
  fs.writeFileSync(path.join(scratch, file), text);
}
function commit() {
  run('add', '.');
  run('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  return run('rev-parse', 'HEAD');
}
function update(tip, base = zero, ref = 'refs/heads/task') {
  return 'refs/heads/task ' + tip + ' ' + ref + ' ' + base;
}
try {
  run('init', '-q');
  write('game.js', 'original');
  write('README.md', 'original');
  const main = commit();
  run('update-ref', 'refs/remotes/origin/main', main);
  write('docs/guide.md', 'documentation');
  const docs = commit();
  assert.equal(documentationOnlyPush([update(docs)], git), true, 'new documentation branch');
  assert.equal(documentationOnlyPush([update(docs, main)], git), true, 'existing documentation push');
  assert.equal(documentationOnlyPush(['HEAD ' + docs + ' refs/heads/task ' + main], git), true, 'explicit HEAD push');
  assert.equal(documentationOnlyPush([update(docs, main), update(zero, main)], git), true, 'documentation plus deletion');
  assert.equal(documentationOnlyPush([update(zero, main)], git), false, 'deletions handled by hook');
  assert.equal(documentationOnlyPush([update(docs, main, 'refs/tags/v1')], git), false, 'tags run tests');
  assert.equal(documentationOnlyPush([update(docs, 'f'.repeat(40))], git), false, 'missing remote object');
  assert.equal(documentationOnlyPush(['malformed'], git), false);
  assert.equal(documentationOnlyPush([update(docs, docs)], git), false, 'empty push');
  write('notes.md', 'untracked documentation');
  write('README.md', 'dirty documentation');
  assert.equal(documentationOnlyPush([update(docs, main)], git), true, 'uncommitted documentation');
  fs.unlinkSync(path.join(scratch, 'notes.md'));
  run('restore', 'README.md');
  for (const command of ['diff', 'ls-files', 'merge-base']) {
    const failingGit = args => args[0] === command ? { status: 1, stdout: '' } : git(args);
    assert.equal(documentationOnlyPush([update(docs)], failingGit), false, command + ' failure runs tests');
  }
  write('untracked.js', 'code');
  assert.equal(documentationOnlyPush([update(docs, main)], git), false, 'untracked code');
  fs.unlinkSync(path.join(scratch, 'untracked.js'));
  write('game.js', 'dirty code');
  assert.equal(documentationOnlyPush([update(docs, main)], git), false, 'unstaged code');
  run('add', 'game.js');
  assert.equal(documentationOnlyPush([update(docs, main)], git), false, 'staged code');
  const code = commit();
  write('README.md', 'docs follow-up');
  const followup = commit();
  assert.equal(documentationOnlyPush([update(followup)], git), false, 'first push includes earlier code');
  assert.equal(documentationOnlyPush([update(followup, code)], git), true, 'docs follow-up on existing branch');
  assert.equal(documentationOnlyPush([update(followup, code), update(code, docs)], git), false, 'mixed refs');
  run('mv', 'game.js', 'docs/renamed.md');
  const renamed = commit();
  assert.equal(documentationOnlyPush([update(renamed, followup)], git), false, 'rename must check deleted code path');
  run('rm', 'README.md');
  const deleted = commit();
  assert.equal(documentationOnlyPush([update(deleted, renamed)], git), true, 'documentation deletion');
  write('.github/workflows/check.yml', 'workflow change');
  const workflow = commit();
  assert.equal(documentationOnlyPush([update(workflow, deleted)], git), false, 'workflow runs tests');
  write('docs/example.js', 'executable documentation example');
  const example = commit();
  assert.equal(documentationOnlyPush([update(example, workflow)], git), false, 'code under docs runs tests');
  assert.equal(documentationOnlyPush([update(deleted, renamed)], () => ({ status: 1, stdout: '' })), false);
  console.log('Push scope: real Git ranges, new/existing/mixed refs, tags, renames, deletions, dirty files and Git failures passed.');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
