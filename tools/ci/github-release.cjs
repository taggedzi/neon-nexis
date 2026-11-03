'use strict';

function githubReleaseClient(repository, token, fetchRequest = fetch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token ||
      repository.split('/').some(part => part === '.' || part === '..')) {
    throw Error('GitHub repository and token are required.');
  }
  const base = 'https://api.github.com/repos/' + repository;
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'neon-nexus-release',
    'X-GitHub-Api-Version': '2026-03-10'
  };
  async function request(method, route, body) {
    const response = await fetchRequest(base + route, {
      method, headers: { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
      signal: AbortSignal.timeout(60000)
    });
    return response;
  }
  async function json(method, route, body) {
    const response = await request(method, route, body);
    if (!response.ok) {
      throw Error(`GitHub ${method} ${route} failed (HTTP ${response.status}).`);
    }
    return response.json();
  }
  async function ensureUnusedTag(version) {
    if (!/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/.test(version)) {
      throw Error('Invalid release tag.');
    }
    const response = await request('GET', '/git/ref/tags/' + version);
    if (response.status === 404) {
      return;
    }
    if (response.ok) {
      throw Error('Release tag already exists: ' + version);
    }
    throw Error('Cannot check release tag (HTTP ' + response.status + ').');
  }

  async function publish(context, assets) {
    const { version, commit } = context;
    await ensureUnusedTag(version);
    // Create, never update: an intervening tag creation fails atomically.
    await json('POST', '/git/refs', { ref: 'refs/tags/' + version, sha: commit });
    const release = await json('POST', '/releases', {
      tag_name: version, target_commitish: commit, name: version,
      body: `Version: ${version}\nCommit: ${commit}\n`,
      draft: true, prerelease: false, generate_release_notes: false
    });
    if (!Number.isSafeInteger(release.id) || release.id < 1 || release.tag_name !== version ||
        typeof release.upload_url !== 'string') {
      throw Error('Unexpected GitHub draft release.');
    }
    const upload = new URL(release.upload_url.replace(/\{.*$/, ''));
    const expectedPath = `/repos/${repository}/releases/${release.id}/assets`;
    if (upload.origin !== 'https://uploads.github.com' ||
        upload.pathname.toLowerCase() !== expectedPath.toLowerCase()) {
      throw Error('Unexpected GitHub upload endpoint.');
    }
    for (const asset of assets) {
      const url = new URL(upload);
      url.searchParams.set('name', asset.name);
      const response = await fetchRequest(url.toString(), {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' },
        body: asset.data, redirect: 'error', signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) {
        throw Error('Release asset upload failed (HTTP ' + response.status + ').');
      }
    }
    const uploaded = await json('GET', `/releases/${release.id}/assets`);
    if (!Array.isArray(uploaded) || uploaded.length !== assets.length || assets.some(asset =>
      !uploaded.some(item => item.name === asset.name && item.size === asset.size &&
        item.state === 'uploaded' && item.digest === 'sha256:' + asset.sha256))) {
      throw Error('GitHub assets do not match the tested archives.');
    }
    const tag = await json('GET', '/git/ref/tags/' + version);
    if (tag.object?.type !== 'commit' || tag.object.sha !== commit) {
      throw Error('Release tag no longer points to the tested commit.');
    }
    const published = await json('PATCH', '/releases/' + release.id, { draft: false, make_latest: 'true' });
    if (published.draft !== false || published.tag_name !== version) {
      throw Error('GitHub did not publish the expected release.');
    }
    return `https://github.com/${repository}/releases/tag/${version}`;
  }
  return { ensureUnusedTag, publish };
}

module.exports = { githubReleaseClient };
