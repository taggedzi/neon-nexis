'use strict';

function isCommitSha(value) {
  return /^[0-9a-f]{40}$/i.test(value) || /^[0-9a-f]{64}$/i.test(value);
}

function branchUpdates(lines) {
  const updates = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [localRef, localSha, remoteRef] = parts;
    if (/^0+$/.test(localSha)) continue;
    if (!remoteRef.startsWith('refs/heads/')) continue;
    updates.push({ localRef, localSha, remoteRef });
  }
  return updates;
}

function syncFailure(update, state) {
  if (!isCommitSha(update.localSha)) {
    return 'pre-push: ' + update.remoteRef + ' did not name a commit. Push not sent.';
  }
  if (!state.containsMain) {
    return 'pre-push: ' + update.remoteRef + ' does not contain origin/main. '
      + 'Rebase onto origin/main, then push. Do not merge main into the branch. Push not sent.';
  }
  if (state.hasMergeSinceMain) {
    return 'pre-push: ' + update.remoteRef + ' contains a merge commit that is not on origin/main. '
      + 'Rebase onto origin/main so the pull request can be rebased. '
      + 'Do not merge main into the branch. Push not sent.';
  }
  return '';
}

module.exports = { branchUpdates, isCommitSha, syncFailure };
