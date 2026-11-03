'use strict';

const { releaseVersion } = require('./release-version.cjs');

function releaseContext(env, date = new Date()) {
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main') {
    throw Error('Releases require a manual dispatch on main.');
  }
  if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA || '')) {
    throw Error('Release source must be a full commit SHA.');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '') ||
      env.GITHUB_REPOSITORY.split('/').some(part => part === '.' || part === '..')) {
    throw Error('Release repository must be owner/name.');
  }
  return {
    repository: env.GITHUB_REPOSITORY,
    version: releaseVersion(date, env.GITHUB_RUN_NUMBER),
    commit: env.GITHUB_SHA,
    releaseDate: date.toISOString(),
    runNumber: Number(env.GITHUB_RUN_NUMBER)
  };
}

function assetName(version, mode) {
  if (!['minified', 'unminified'].includes(mode)) {
    throw Error('Unknown release package mode.');
  }
  return `neon-nexus-${version}-${mode === 'minified' ? 'min' : 'full'}.zip`;
}

module.exports = { releaseContext, assetName };
