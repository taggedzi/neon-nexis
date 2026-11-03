'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadRelease } = require('./release-files.cjs');
const { githubReleaseClient } = require('./github-release.cjs');

async function publishRelease({ root = process.cwd(), env = process.env, client } = {}) {
  const { manifest, assets } = loadRelease(path.join(root, 'release-assets'), env);
  const api = client || githubReleaseClient(manifest.repository, env.GH_TOKEN);
  const url = await api.publish(manifest, assets);
  if (env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
      `GitHub Release: [${manifest.version}](${url})\n\nSource commit: ${manifest.commit}\n`);
  }
  return url;
}

if (require.main === module) {
  publishRelease().then(url => console.log('Published ' + url)).catch(error => {
    console.error(error.message);
    console.error('Release publication failed. Any successful Pages deploy remains live. See the partial-release recovery guide.');
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        '\nRelease publication failed. Preserve the run artifacts and inspect the tag/draft Release. ' +
        'Do not force or delete the tag, overwrite assets, or roll back Pages automatically. ' +
        'See docs/development-and-releases.md#partial-release-recovery.\n');
    }
    process.exitCode = 1;
  });
}

module.exports = { publishRelease };
