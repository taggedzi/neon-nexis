'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// A fixed allowlist excludes local databases, backups and development routers.
const PUBLIC_PHP_FILES = [
  '.htaccess',
  'coop.php',
  'coop-cleanup.php',
  'coop-config.sample.php',
  'lib/config.php',
  'lib/credentials.php',
  'lib/http.php',
  'lib/store.php'
];

function websiteCoopFiles(root) {
  const localConfig = path.join(root, 'php', 'coop-config.php');
  const config = process.env.NEON_COOP_CONFIG
    ? path.resolve(root, process.env.NEON_COOP_CONFIG)
    : fs.existsSync(localConfig) ? localConfig : path.join(root, 'php', 'coop-config.sample.php');
  // Evaluate PHP with PHP, rather than guessing the flag from comments or text.
  // Suppress diagnostics because a parse error can contain credential literals.
  const check = spawnSync(process.env.PHP_PATH || 'php', [
    '-d', 'display_errors=0', '-d', 'log_errors=0', '-r',
    '$config = include $argv[1]; if (!is_array($config)) { exit(11); } exit(($config["enabled"] ?? false) === true ? 0 : 10);',
    config
  ], { cwd: root, encoding: 'utf8', timeout: 10000 });
  if (check.error || ![0, 10].includes(check.status)) {
    throw Error('Cannot read co-op configuration. Check PHP on PATH (or PHP_PATH) and the PHP config syntax. Build stopped before replacing dist/.');
  }
  if (check.status === 10) {
    return [];
  }
  const files = PUBLIC_PHP_FILES.map(name => [path.join(root, 'php', name), 'php/' + name]);
  files.push([config, 'php/coop-config.php']);
  for (const [source] of files) {
    if (!fs.statSync(source).isFile()) {
      throw Error('Required co-op deployment file is unavailable.');
    }
  }
  return files;
}

module.exports = { websiteCoopFiles };
