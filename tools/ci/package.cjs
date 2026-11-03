// Stage the public allowlist; minification is opt-in outside the publisher.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { releaseVersion } = require('./release-version.cjs');

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--minify', '--no-minify'].includes(arg))) {
  throw Error('Usage: node tools/ci/package.cjs [--minify|--no-minify]');
}
const shouldMinify = args.includes('--minify');
const root = process.cwd();
const output = path.resolve(root, 'dist');
if (output !== path.join(root, 'dist')) {
  throw Error('Unexpected staging directory');
}

async function stage() {
  let version = 'development';
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    version = releaseVersion(new Date(), process.env.GITHUB_RUN_NUMBER);
  }
  // Only this fixed, verified child directory is recreated.
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output);
  // Never publish the source-only console surface, including unminified builds.
  const html = fs.readFileSync('index.html', 'utf8').replace(/^.*<script src="js\/dev\.js"><\/script>\r?\n/gm, '');
  const files = new Set(['index.html', 'LICENSE', ...[...html.matchAll(/(?:src|href)="((?:js|css)\/[a-zA-Z0-9/_.-]+)"/g)].map(match => match[1])]);
  for (const file of files) {
    const source = path.resolve(root, file);
    if (!source.startsWith(root + path.sep)) {
      throw Error('Public file must be inside the repository: ' + file);
    }
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  fs.writeFileSync(path.join(output, 'index.html'), html);
  const util = path.join(output, 'js/util.js');
  fs.writeFileSync(util, fs.readFileSync(util, 'utf8').replace("N.RELEASE_VERSION = 'development';", `N.RELEASE_VERSION = '${version}';`));

  if (shouldMinify) {
    // Keep classic script boundaries, identifiers, and shared NEON properties.
    // Strip whitespace/comments without compression rewrites or bundling.
    const terser = require('terser');
    const CleanCSS = require('clean-css');
    const { minify: minifyHtml } = require('html-minifier-terser');
    const sizes = {};
    for (const file of files) {
      const type = path.extname(file).slice(1);
      if (!['js', 'css', 'html'].includes(type)) {
        continue;
      }
      const destination = path.join(output, file);
      const source = fs.readFileSync(destination, 'utf8');
      let result;
      if (type === 'js') {
        result = (await terser.minify(source, {
          compress: false,
          mangle: false,
          format: { comments: false }
        })).code;
      } else if (type === 'css') {
        const css = new CleanCSS({ level: 0, format: false }).minify(source);
        if (css.errors.length) {
          throw Error(file + ': ' + css.errors.join('; '));
        }
        result = css.styles;
      } else {
        result = await minifyHtml(source, {
          collapseWhitespace: true,
          conservativeCollapse: true,
          removeComments: true
        });
      }
      fs.writeFileSync(destination, result + '\n');
      sizes[type] ||= { before: 0, after: 0 };
      sizes[type].before += Buffer.byteLength(source);
      sizes[type].after += fs.statSync(destination).size;
    }
    console.log('Minified bytes: ' + JSON.stringify(sizes));
  }

  const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify({ version, commit }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  console.log('Staged ' + version + ' (' + commit + ', ' + (shouldMinify ? 'minified' : 'unminified') + ') in dist/.');
}

stage().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
