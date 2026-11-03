'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { releaseContext, assetName } = require('./release-context.cjs');
const { readTree, fingerprint, sha256, loadRelease } = require('./release-files.cjs');
const { createZip } = require('./zip.cjs');
const { githubReleaseClient } = require('./github-release.cjs');

function verifyPages(root, env) {
  const { manifest } = loadRelease(path.join(root, 'release-assets'), env);
  assert.deepEqual(fingerprint(readTree(path.join(root, 'dist'))), manifest.files[manifest.pagesMode],
    'Pages must receive the exact selected archive contents.');
  return manifest;
}

async function buildRelease({ root = process.cwd(), env = process.env, date = new Date(),
  pagesMode = 'minified', ensureUnusedTag } = {}) {
  const context = releaseContext(env, date);
  if (!['minified', 'unminified'].includes(pagesMode)) {
    throw Error('Unknown Pages package mode.');
  }
  const checkTag = ensureUnusedTag || githubReleaseClient(context.repository, env.GH_TOKEN).ensureUnusedTag;
  await checkTag(context.version);
  const output = path.resolve(root, 'release-assets');
  const dist = path.resolve(root, 'dist');
  // Recreate only these two fixed build children, never a parent or caller path.
  assert.equal(output, path.join(path.resolve(root), 'release-assets'));
  assert.equal(dist, path.join(path.resolve(root), 'dist'));
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output);
  const manifest = { ...context, pagesMode, assets: [], files: {} };
  for (const mode of ['minified', 'unminified']) {
    execFileSync(process.execPath, [path.join(__dirname, 'package.cjs'),
      mode === 'minified' ? '--minify' : '--no-minify'], {
      cwd: root, env: { ...env, NEON_RELEASE_DATE: context.releaseDate }, stdio: 'pipe'
    });
    const entries = readTree(dist);
    const data = new Map(entries.map(entry => [entry.name, entry.data]));
    assert.deepEqual(JSON.parse(data.get('release.json')), { version: context.version, commit: context.commit });
    assert.ok(data.has('index.html') && data.has('LICENSE'));
    assert.ok(data.get('js/util.js').toString().includes(context.version));
    assert.deepEqual(data.get('LICENSE'), fs.readFileSync(path.join(root, 'LICENSE')));
    if (mode === 'unminified') {
      assert.deepEqual(entries.map(entry => entry.name), manifest.files.minified.map(entry => entry.name));
    }
    const site = path.join(output, 'sites', mode);
    fs.cpSync(dist, site, { recursive: true });
    manifest.files[mode] = fingerprint(entries);
    const name = assetName(context.version, mode);
    const archive = createZip(entries);
    fs.writeFileSync(path.join(output, name), archive);
    manifest.assets.push({ mode, name, size: archive.length, sha256: sha256(archive) });
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(path.join(output, 'sites', pagesMode), dist, { recursive: true });
  verifyPages(root, env);
  return manifest;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--minify', '--no-minify', '--verify-pages'].includes(args[0])) {
    throw Error('Usage: release-packages.cjs --minify|--no-minify|--verify-pages');
  }
  const run = args[0] === '--verify-pages'
    ? Promise.resolve().then(() => verifyPages(process.cwd(), process.env))
    : buildRelease({ pagesMode: args[0] === '--minify' ? 'minified' : 'unminified' });
  run.then(manifest => console.log('Release packages verified: ' + manifest.version))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { buildRelease, verifyPages };
