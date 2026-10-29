const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

for (const name of readdirSync('tools').filter(name => /^check-.*\.cjs$/.test(name)).sort()) {
  console.log('Running ' + name);
  const result = spawnSync(process.execPath, ['tools/' + name], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
