'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { githubReleaseClient } = require('./ci/github-release.cjs');

const context = { version: '2026.11.01.0042', commit: 'a'.repeat(40) };
const assets = ['min', 'full'].map(mode => {
  const data = Buffer.from(mode + ' fixture bytes');
  return { name: `neon-nexus-${context.version}-${mode}.zip`, data, size: data.length,
    sha256: createHash('sha256').update(data).digest('hex') };
});

function fixture(options = {}) {
  let exists = !!options.exists;
  const calls = [], uploaded = [];
  const answer = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const client = githubReleaseClient('release-fixture/example', 'fixture-token', async (address, request) => {
    const url = new URL(address);
    const body = request.body && !Buffer.isBuffer(request.body) ? JSON.parse(request.body) : request.body;
    calls.push({ method: request.method, url, body });
    if (url.pathname.includes('/git/ref/tags/')) {
      if (options.lookupFailure) return answer({}, 500);
      return exists ? answer({ object: { type: 'commit', sha: options.changedTag ? 'b'.repeat(40) : context.commit } }) : answer({}, 404);
    }
    if (url.pathname.endsWith('/git/refs')) {
      assert.equal(request.method, 'POST');
      assert.deepEqual(body, { ref: 'refs/tags/' + context.version, sha: context.commit });
      if (options.race) return answer({}, 422);
      exists = true;
      return answer({}, 201);
    }
    if (url.origin === 'https://uploads.github.com') {
      if (options.uploadFailure && uploaded.length === 1) return answer({}, 502);
      const name = url.searchParams.get('name');
      const expected = assets.find(asset => asset.name === name);
      assert.deepEqual(body, expected.data);
      uploaded.push({ name, size: body.length, state: 'uploaded', digest: 'sha256:' + expected.sha256 });
      return answer({}, 201);
    }
    if (url.pathname.endsWith('/releases/1/assets')) {
      return answer(options.badDigest ? uploaded.map(asset => ({ ...asset, digest: 'wrong' })) : uploaded);
    }
    if (request.method === 'POST' && url.pathname.endsWith('/releases')) {
      assert.equal(body.draft, true);
      assert.equal(body.generate_release_notes, false);
      assert.equal(body.tag_name, context.version);
      assert.equal(body.name, context.version);
      assert.equal(body.body, `Version: ${context.version}\nCommit: ${context.commit}\n`);
      return answer({ id: 1, tag_name: context.version,
        upload_url: (options.badHost ? 'https://example.invalid' : 'https://uploads.github.com') +
          '/repos/release-fixture/example/releases/1/assets{?name,label}' }, 201);
    }
    if (request.method === 'PATCH' && url.pathname.endsWith('/releases/1')) {
      assert.equal(uploaded.length, 2);
      assert.deepEqual(body, { draft: false, make_latest: 'true' });
      return answer({ draft: false, tag_name: context.version });
    }
    throw Error('Unexpected fixture request: ' + request.method + ' ' + url.pathname);
  });
  return { client, calls, uploaded };
}

(async () => {
  const ok = fixture();
  assert.equal(await ok.client.publish(context, assets), 'https://github.com/release-fixture/example/releases/tag/' + context.version);
  assert.equal(ok.uploaded.length, 2);
  assert.equal(ok.calls.at(-1).method, 'PATCH');
  const cases = [
    [{ exists: true }, /already exists/],
    [{ lookupFailure: true }, /check release tag/],
    [{ race: true }, /HTTP 422/],
    [{ uploadFailure: true }, /upload failed/],
    [{ badDigest: true }, /do not match/],
    [{ changedTag: true }, /no longer points/],
    [{ badHost: true }, /upload endpoint/]
  ];
  for (const [options, message] of cases) {
    const test = fixture(options);
    await assert.rejects(test.client.publish(context, assets), message);
    assert.equal(test.calls.some(call => call.method === 'DELETE'), false);
    assert.equal(test.calls.some(call => call.method === 'PATCH'), false);
    if (options.exists || options.lookupFailure) {
      assert.equal(test.calls.some(call => call.method === 'POST'), false);
    }
  }
  console.log('GitHub release fixtures: create-only tags, races, draft uploads, digest/tag verification, failure visibility and no rollback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
