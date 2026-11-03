'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inflateRawSync, crc32 } = require('node:zlib');
const { createZip } = require('./ci/zip.cjs');
const { buildRelease, verifyPages } = require('./ci/release-packages.cjs');
const { loadRelease, readTree } = require('./ci/release-files.cjs');
const { publishRelease } = require('./ci/publish-release.cjs');

// Read the ZIP central directory independently of the writer, then validate
// each referenced local record, decompressed content, size, and CRC.
function unzip(bytes) {
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  assert.equal(cursor + bytes.readUInt32LE(end + 12), end);
  const result = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 10), 8);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const local = bytes.readUInt32LE(cursor + 42);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    const localNameLength = bytes.readUInt16LE(local + 26);
    assert.equal(bytes.toString('utf8', local + 30, local + 30 + localNameLength), name);
    assert.equal(bytes.readUInt32LE(local + 14), bytes.readUInt32LE(cursor + 16));
    const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    const data = inflateRawSync(bytes.subarray(start, start + bytes.readUInt32LE(cursor + 20)));
    assert.equal(data.length, bytes.readUInt32LE(cursor + 24));
    assert.equal(crc32(data), bytes.readUInt32LE(cursor + 16));
    assert.equal(result.has(name), false);
    result.set(name, data);
    cursor += 46 + nameLength + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
  }
  assert.equal(cursor, end);
  return result;
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-release-'));
  const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'release-fixture/example', GITHUB_RUN_NUMBER: '42' };
  const date = new Date('2026-11-02T04:59:59.000Z'); // Just before New York midnight.
  let tagChecks = 0;
  try {
    for (const name of ['index.html', 'LICENSE', 'js', 'css']) {
      fs.cpSync(path.join(root, name), path.join(scratch, name), { recursive: true });
    }
    const options = { root: scratch, env, date, ensureUnusedTag: async version => {
      assert.equal(version, '2026.11.01.0042'); tagChecks++;
    } };
    await assert.rejects(buildRelease({ ...options, env: { ...env, GITHUB_REF: 'refs/heads/feature' } }), /main/);
    await assert.rejects(buildRelease({ ...options, env: { ...env, GITHUB_EVENT_NAME: 'push' } }), /manual/);
    assert.equal(tagChecks, 0);
    for (const pagesMode of ['minified', 'unminified']) {
      const manifest = await buildRelease({ ...options, pagesMode });
      assert.equal(manifest.version, '2026.11.01.0042');
      const directory = path.join(scratch, 'release-assets');
      const loaded = loadRelease(directory, env);
      for (const [index, mode] of ['minified', 'unminified'].entries()) {
        const archive = loaded.assets[index];
        const files = unzip(archive.data);
        const site = new Map(readTree(path.join(directory, 'sites', mode)).map(entry => [entry.name, entry.data]));
        assert.deepEqual(files, site);
        assert.ok(files.has('index.html') && files.has('LICENSE') && files.has('.nojekyll'));
        assert.equal(files.has('js/dev.js'), false);
        assert.equal([...files.keys()].some(name => /^(docs|tools|node_modules)\//.test(name) || name.endsWith('.map')), false);
        assert.deepEqual(JSON.parse(files.get('release.json')), { version: manifest.version, commit: env.GITHUB_SHA });
        assert.ok(files.get('js/util.js').toString().includes(manifest.version));
        assert.deepEqual(files.get('LICENSE'), fs.readFileSync(path.join(root, 'LICENSE')));
      }
      verifyPages(scratch, env);
      const html = path.join(scratch, 'dist/index.html');
      const original = fs.readFileSync(html);
      fs.writeFileSync(html, 'changed after testing');
      assert.throws(() => verifyPages(scratch, env), /exact selected/);
      fs.writeFileSync(html, original);
      const archivePath = path.join(directory, loaded.assets[0].name);
      fs.appendFileSync(archivePath, 'corrupt');
      assert.throws(() => loadRelease(directory, env), /verification/);
      fs.writeFileSync(archivePath, loaded.assets[0].data);
      await assert.rejects(buildRelease({ ...options, ensureUnusedTag: async () => { throw Error('existing tag'); } }), /existing tag/);
      assert.deepEqual(fs.readFileSync(archivePath), loaded.assets[0].data);
      let published = false;
      await assert.rejects(publishRelease({ root: scratch, env: { ...env, GITHUB_SHA: 'b'.repeat(40) },
        client: { publish: async () => { published = true; } } }), /commit/);
      assert.equal(published, false);
    }
    assert.equal(tagChecks, 2);
    const entries = [{ name: 'nested/é.txt', data: Buffer.from('real bytes') }, { name: '.empty', data: Buffer.alloc(0) }];
    assert.deepEqual(unzip(createZip(entries)), new Map(entries.map(entry => [entry.name, entry.data])));
    assert.deepEqual(createZip(entries), createZip(entries));
    for (const name of ['/absolute', '../secret', 'a/../b', 'C:/drive', 'a\\b', 'a\0b']) {
      assert.throws(() => createZip([{ name, data: Buffer.alloc(0) }]), /relative/);
    }
    assert.throws(() => createZip([entries[0], entries[0]]), /unique/);
    console.log('Release packages: both ZIP contents, CRCs, frozen versions, Pages parity, main-only guards, corruption and duplicate refusal passed.');
  } finally {
    assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(scratch).startsWith('neon-release-'));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
