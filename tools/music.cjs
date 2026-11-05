// Optional local soundtrack preparation. Never read assets from release builds.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PROFILE = 'mp3-192k-stereo-44100-v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function prepareMusic(root, encode = encodeMp3) {
  const input = path.join(root, 'assets', 'wav');
  const output = path.join(root, 'assets', 'music');
  const manifestPath = path.join(output, 'playlist.json');
  const names = fs.existsSync(input) ? fs.readdirSync(input, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.wav$/i.test(entry.name))
    .map(entry => entry.name).sort() : [];
  let previous = { tracks: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      previous = parsed;
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      throw error;
    }
  }
  fs.mkdirSync(output, { recursive: true });
  const tracks = [];
  // Commit the playlist only after every conversion succeeds. Removed tracks
  // disappear from the next playlist; originals are never modified or deleted.
  for (const name of names) {
    const source = path.join(input, name);
    const sourceHash = hash(fs.readFileSync(source));
    const file = hash(PROFILE + sourceHash) + '.mp3';
    if (tracks.some(track => track.file === file)) {
      continue;
    }
    const destination = path.join(output, file);
    const cached = previous.profile === PROFILE && Array.isArray(previous.tracks)
      && previous.tracks.find(track => track && track.file === file && track.sourceHash === sourceHash);
    if (!cached || !fs.existsSync(destination) || hash(fs.readFileSync(destination)) !== cached.sha256) {
      const temporary = destination + '.tmp';
      try {
        console.log('Converting ' + name);
        encode(source, temporary);
        if (!fs.statSync(temporary).size) {
          throw Error('Encoder produced an empty file: ' + name);
        }
        fs.renameSync(temporary, destination);
      } finally {
        fs.rmSync(temporary, { force: true });
      }
    }
    tracks.push({ name: path.parse(name).name, file, sourceHash,
      sha256: hash(fs.readFileSync(destination)) });
  }
  const manifest = { version: 1, profile: PROFILE, tracks };
  const temporaryManifest = manifestPath + '.tmp';
  fs.writeFileSync(temporaryManifest, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(temporaryManifest, manifestPath);
  // Only files owned by this converter may be pruned, after successful output.
  const keep = new Set(tracks.map(track => track.file));
  for (const name of fs.readdirSync(output)) {
    if (/^[a-f0-9]{64}\.mp3$/.test(name) && !keep.has(name)) {
      fs.unlinkSync(path.join(output, name));
    }
  }
  return manifest;
}

function encodeMp3(source, destination) {
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source,
      '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame',
      '-b:a', '192k', '-ar', '44100', '-ac', '2', '-f', 'mp3', destination
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (error) {
    throw Error('Music conversion failed. Install FFmpeg with libmp3lame or set FFMPEG_PATH.', { cause: error });
  }
}

function stageMusic(root, output) {
  const manifest = prepareMusic(root);
  const tracks = manifest.tracks.map(track => 'assets/music/' + track.file);
  if (tracks.length) {
    const destination = path.join(output, 'assets', 'music');
    fs.mkdirSync(destination, { recursive: true });
    for (const track of manifest.tracks) {
      fs.copyFileSync(path.join(root, 'assets', 'music', track.file), path.join(destination, track.file));
    }
    fs.writeFileSync(path.join(destination, 'NOTICE.txt'),
      'Optional soundtrack assets are not covered by the source code MIT license.\n' +
      'That license grants no permission to redistribute these recordings.\n');
  }
  fs.writeFileSync(path.join(output, 'js', 'music-library.js'),
    '// Generated for this local website build only.\nwindow.NEON.MUSIC_TRACKS = ' + JSON.stringify(tracks) + ';\n');
  console.log('Website soundtrack: ' + tracks.length + ' tracks.');
}

module.exports = { prepareMusic, stageMusic };
if (require.main === module) {
  try {
    const manifest = prepareMusic(process.cwd());
    console.log('Prepared ' + manifest.tracks.length + ' tracks in assets/music/.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
