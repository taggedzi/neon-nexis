'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { releaseContext, assetName } = require('./release-context.cjs');

const sha256 = data => createHash('sha256').update(data).digest('hex');

function readTree(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const name = prefix + entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return readTree(file, name + '/');
    }
    if (!entry.isFile()) {
      throw Error('Release trees may contain only files and directories.');
    }
    return [{ name, data: fs.readFileSync(file) }];
  });
}

function fingerprint(entries) {
  return entries.map(({ name, data }) => ({ name, size: data.length, sha256: sha256(data) }));
}

function loadRelease(directory, env) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const expected = releaseContext(env, new Date(manifest.releaseDate));
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) {
      throw Error('Release manifest does not match this workflow: ' + key);
    }
  }
  if (!['minified', 'unminified'].includes(manifest.pagesMode) || manifest.assets?.length !== 2) {
    throw Error('Release manifest must contain both package modes.');
  }
  const assets = ['minified', 'unminified'].map(mode => {
    const name = assetName(expected.version, mode);
    const record = manifest.assets.find(item => item.name === name && item.mode === mode);
    const data = fs.readFileSync(path.join(directory, name));
    if (!record || record.size !== data.length || record.sha256 !== sha256(data)) {
      throw Error('Release archive failed verification: ' + name);
    }
    return { name, data, size: data.length, sha256: record.sha256 };
  });
  return { manifest, assets };
}

module.exports = { sha256, readTree, fingerprint, loadRelease };
