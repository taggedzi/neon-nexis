const assert = require('node:assert/strict');
const { releaseVersion } = require('./ci/release-version.cjs');

assert.equal(releaseVersion(new Date('2026-10-30T02:00:00Z'), 1), '2026.10.29.0001');
assert.equal(releaseVersion(new Date('2026-10-30T04:00:00Z'), 42), '2026.10.30.0042');
assert.equal(releaseVersion(new Date('2026-01-01T04:59:00Z'), 9999), '2025.12.31.9999');
assert.equal(releaseVersion(new Date('2026-01-01T05:00:00Z'), 2), '2026.01.01.0002');
for (const invalid of [0, -1, 10000, 1.5, undefined, 'garbage']) {
  assert.throws(() => releaseVersion(new Date(), invalid));
}
console.log('Release versions: New York midnight, year boundary, padding and bounds passed.');
