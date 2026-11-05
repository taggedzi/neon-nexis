'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { prepareMusic } = require('./music.cjs');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-music-'));
const input = path.join(scratch, 'assets', 'wav');
const output = path.join(scratch, 'assets', 'music');
const manifestPath = path.join(output, 'playlist.json');
let encodes = 0;
function encode(source, destination) {
  encodes++;
  fs.writeFileSync(destination, Buffer.concat([Buffer.from('encoded fixture:'), fs.readFileSync(source)]));
}
try {
  assert.deepEqual(prepareMusic(scratch, encode).tracks, []);
  assert.equal(encodes, 0, 'no FFmpeg dependency without WAV files');
  fs.mkdirSync(input, { recursive: true });
  fs.writeFileSync(path.join(input, 'First (1).wav'), 'first');
  fs.writeFileSync(path.join(input, 'Second.WAV'), 'second');
  fs.writeFileSync(path.join(input, 'not-a-track.txt'), 'private');
  fs.writeFileSync(manifestPath, 'null');
  const first = prepareMusic(scratch, encode);
  assert.equal(first.tracks.length, 2);
  assert.equal(encodes, 2);
  assert.deepEqual(prepareMusic(scratch, encode), first);
  assert.equal(encodes, 2, 'unchanged sources use verified cached conversions');
  fs.writeFileSync(path.join(input, 'duplicate.wav'), 'first');
  assert.equal(prepareMusic(scratch, encode).tracks.length, 2, 'identical audio is not repeated in the playlist');
  fs.unlinkSync(path.join(input, 'duplicate.wav'));
  fs.writeFileSync(path.join(output, first.tracks[0].file), 'corrupted cache');
  prepareMusic(scratch, encode);
  assert.equal(encodes, 3, 'corrupt outputs are regenerated');
  const before = fs.readFileSync(manifestPath);
  fs.writeFileSync(path.join(input, 'Second.WAV'), 'changed');
  assert.throws(() => prepareMusic(scratch, () => { throw Error('encoder failed'); }), /encoder failed/);
  assert.deepEqual(fs.readFileSync(manifestPath), before, 'failed conversion preserves published playlist');
  assert.equal(fs.readdirSync(output).some(name => name.endsWith('.tmp')), false);
  const changed = prepareMusic(scratch, encode);
  assert.notEqual(changed.tracks[1].file, first.tracks[1].file);
  assert.equal(fs.existsSync(path.join(output, first.tracks[1].file)), false);
  fs.unlinkSync(path.join(input, 'First (1).wav'));
  fs.writeFileSync(path.join(output, 'keep-my-file.txt'), 'keep');
  const removed = prepareMusic(scratch, encode);
  assert.equal(removed.tracks.length, 1);
  assert.equal(fs.existsSync(path.join(output, first.tracks[0].file)), false);
  assert.equal(fs.readFileSync(path.join(output, 'keep-my-file.txt'), 'utf8'), 'keep');

  for (const name of ['index.html', 'LICENSE', 'js', 'css']) {
    fs.cpSync(path.join(root, name), path.join(scratch, name), { recursive: true });
  }
  const command = path.join(root, 'tools', 'ci', 'package.cjs');
  const env = { ...process.env, GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '', GITHUB_SHA: 'music-fixture' };
  const stage = flags => execFileSync(process.execPath, [command, ...flags], { cwd: scratch, env });
  stage(['--with-music', '--minify']);
  const stagedMusic = path.join(scratch, 'dist', 'assets', 'music');
  assert.deepEqual(fs.readdirSync(stagedMusic).sort(), [removed.tracks[0].file, 'NOTICE.txt'].sort());
  const registry = fs.readFileSync(path.join(scratch, 'dist/js/music-library.js'), 'utf8');
  assert.ok(registry.includes(removed.tracks[0].file));
  assert.equal(registry.includes('Second'), false, 'private source names are not embedded');
  assert.equal(fs.existsSync(path.join(scratch, 'dist/assets/wav')), false);
  assert.equal(fs.existsSync(path.join(stagedMusic, 'playlist.json')), false);
  stage(['--no-minify']);
  assert.equal(fs.existsSync(path.join(scratch, 'dist/assets')), false, 'default packages exclude private assets');
  assert.match(fs.readFileSync(path.join(scratch, 'dist/js/music-library.js'), 'utf8'), /MUSIC_TRACKS = \[\]/);
  const prohibited = spawnSync(process.execPath, [command, '--with-music'], {
    cwd: scratch, env: { ...env, GITHUB_ACTIONS: 'true' }, encoding: 'utf8'
  });
  assert.notEqual(prohibited.status, 0);
  assert.match(prohibited.stderr, /local only/);
  fs.unlinkSync(path.join(input, 'Second.WAV'));
  stage(['--with-music']);
  assert.equal(fs.existsSync(path.join(scratch, 'dist/assets')), false, 'removing all tracks restores procedural-only website');
  console.log('Music pipeline: caching, changes/removals, failure recovery, allowlists and music-free release staging passed.');
} finally {
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(scratch).startsWith('neon-music-'));
  fs.rmSync(scratch, { recursive: true, force: true });
}
