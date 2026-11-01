const assert = require('node:assert/strict');
const { branchUpdates, syncFailure } = require('./ci/branch-sync.cjs');

const main = 'a'.repeat(40);
const feature = 'b'.repeat(40);
const zero = '0'.repeat(40);
const update = {
  localRef: 'refs/heads/docs/example',
  localSha: feature,
  remoteRef: 'refs/heads/docs/example'
};

assert.deepEqual(branchUpdates([
  'refs/heads/docs/example ' + feature + ' refs/heads/docs/example ' + zero,
  'refs/heads/old ' + zero + ' refs/heads/old ' + main,
  'refs/tags/v1 ' + feature + ' refs/tags/v1 ' + zero,
  'not a push line',
  ''
]), [update]);

assert.equal(syncFailure(update, { containsMain: true, hasMergeSinceMain: false }), '');
assert.match(
  syncFailure(update, { containsMain: false, hasMergeSinceMain: false }),
  /does not contain origin\/main/
);
assert.match(
  syncFailure(update, { containsMain: true, hasMergeSinceMain: true }),
  /merge commit/
);
assert.match(
  syncFailure({ ...update, localSha: 'not-a-commit' }, { containsMain: true, hasMergeSinceMain: false }),
  /did not name a commit/
);

console.log('Branch sync: deletes, tags, stale branches, and merge commits passed.');
