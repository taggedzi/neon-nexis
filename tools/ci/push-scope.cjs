'use strict';

const { isCommitSha } = require('./branch-sync.cjs');

function isDocumentation(file) {
  return /^[^/]+\.md$/.test(file) || /^docs\/.+\.md$/.test(file) || file === 'LICENSE';
}

// Any unknown ref, failed Git query, or non-document path keeps the full suite.
// Compare existing refs with their remote tip; new branches with current main.
function documentationOnlyPush(lines, git) {
  function output(args) {
    const result = git(args);
    return result.status === 0 ? result.stdout : null;
  }
  function paths(args) {
    const value = output(args);
    return value === null ? null : value.split('\0').filter(Boolean);
  }
  let changed = false;
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) {return false;}
    const [, localSha, remoteRef, remoteSha] = parts;
    if (/^0+$/.test(localSha)) {continue;}
    if (!remoteRef.startsWith('refs/heads/')
      || !isCommitSha(localSha) || !isCommitSha(remoteSha)) {return false;}
    let base = remoteSha;
    if (/^0+$/.test(base)) {
      base = output(['merge-base', 'origin/main', localSha]);
      if (base === null) {return false;}
      base = base.trim();
      if (!isCommitSha(base)) {return false;}
    }
    const files = paths(['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', base, localSha, '--']);
    if (files === null || files.some(file => !isDocumentation(file))) {return false;}
    changed ||= files.length > 0;
  }
  if (!changed) {return false;}
  // The suite runs in the checkout: do not skip around uncommitted code changes.
  const dirty = paths(['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', 'HEAD', '--']);
  const untracked = paths(['ls-files', '--others', '--exclude-standard', '-z']);
  return dirty !== null && untracked !== null
    && [...dirty, ...untracked].every(isDocumentation);
}

module.exports = { documentationOnlyPush };
