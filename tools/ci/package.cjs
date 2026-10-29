// Minimal public-file staging for Pages; minification remains a separate decision.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { releaseVersion } = require('./release-version.cjs');
const root = process.cwd();
const output = path.resolve(root, 'dist');
if (output !== path.join(root, 'dist')) {
  throw Error('Unexpected staging directory');
}
let version = 'development';
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
  version = releaseVersion(new Date(), process.env.GITHUB_RUN_NUMBER);
}
// Only this fixed, verified child directory is recreated. Never stage the repository root.
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
const html = fs.readFileSync('index.html', 'utf8');
const files = ['index.html', 'LICENSE', ...[...html.matchAll(/(?:src|href)="((?:js|css)\/[a-zA-Z0-9/_.-]+)"/g)].map(match => match[1])];
for (const file of new Set(files)) {
  const source = path.resolve(root, file);
  if (!source.startsWith(root + path.sep)) {
    throw Error('Public file must be inside the repository: ' + file);
  }
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
const util = path.join(output, 'js/util.js');
fs.writeFileSync(util, fs.readFileSync(util, 'utf8').replace("N.RELEASE_VERSION = 'development';", `N.RELEASE_VERSION = '${version}';`));
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify({ version, commit }, null, 2) + '\n');
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Staged ' + version + ' (' + commit + ') in dist/.');
