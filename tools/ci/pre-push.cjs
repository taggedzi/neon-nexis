'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { branchUpdates, isCommitSha, syncFailure } = require('./branch-sync.cjs');

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

  const updates = branchUpdates(lines);
  if (updates.length > 0) {
    const failure = branchSyncFailure(updates);
    if (failure) {
      console.error(failure);
      process.exit(1);
    }
  }

  console.error('pre-push: running npm run check. A failure blocks this push.');
  const result = spawnSync('npm', ['run', 'check'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  process.exit(result.status == null ? 1 : result.status);
});

function git(args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  });
}

function branchSyncFailure(updates) {
  const fetched = git(['fetch', '--no-tags', 'origin', 'main']);
  if (fetched.status !== 0) {
    const detail = (fetched.stderr || fetched.stdout || 'git fetch failed').trim();
    return 'pre-push: could not fetch origin/main. Push not sent.\n' + detail;
  }
  for (const update of updates) {
    if (!isCommitSha(update.localSha)) {
      return syncFailure(update, { containsMain: false, hasMergeSinceMain: false });
    }
    const ancestor = git(['merge-base', '--is-ancestor', 'origin/main', update.localSha]);
    if (ancestor.status !== 0 && ancestor.status !== 1) {
      const detail = (ancestor.stderr || 'git merge-base failed').trim();
      return 'pre-push: could not compare the branch with origin/main. Push not sent.\n' + detail;
    }
    if (ancestor.status === 1) {
      return syncFailure(update, { containsMain: false, hasMergeSinceMain: false });
    }
    const merges = git(['rev-list', '--merges', 'origin/main..' + update.localSha]);
    if (merges.status !== 0) {
      const detail = (merges.stderr || 'git rev-list failed').trim();
      return 'pre-push: could not inspect merge commits. Push not sent.\n' + detail;
    }
    const failure = syncFailure(update, {
      containsMain: true,
      hasMergeSinceMain: merges.stdout.trim() !== ''
    });
    if (failure) return failure;
  }
  return '';
}
