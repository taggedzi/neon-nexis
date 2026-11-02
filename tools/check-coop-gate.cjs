'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-coop-gate-'));
const children = [];
let checks = 0;
let browser;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function phpString(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function phpExport(value) {
  if (Array.isArray(value)) return 'array(' + value.map(phpExport).join(',') + ')';
  if (value && typeof value === 'object') {
    return 'array(' + Object.entries(value).map(([key, item]) => phpString(key) + '=>' + phpExport(item)).join(',') + ')';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return phpString(String(value));
}

function writeConfig(name, value) {
  const file = path.join(scratch, name);
  fs.writeFileSync(file, '<?php\nreturn ' + phpExport(value) + ';\n');
  return file;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function startPhp(env) {
  const port = await freePort();
  const child = spawn('php', ['-d', 'opcache.enable=0', '-S', '127.0.0.1:' + port, '-t', root, 'php/router.php'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(child);
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/index.html');
      if (response.ok) return port;
    } catch (error) { /* The server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('PHP server did not start');
}

function stopAll() {
  for (const child of children) {
    try { child.kill(); } catch (error) { /* already gone */ }
  }
}

function lobbyQuery(dbFile, source) {
  const script = path.join(scratch, 'lobby-query.php');
  fs.writeFileSync(script, '<?php\n' + source + '\n');
  const result = spawnSync('php', [script, dbFile], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'sqlite read failed');
  return result.stdout;
}

function lobbyRow(dbFile) {
  return JSON.parse(lobbyQuery(dbFile, [
    '$pdo = new PDO("sqlite:" . $argv[1]);',
    '$row = $pdo->query("SELECT code, host_id, guest_id FROM lobbies")->fetch(PDO::FETCH_ASSOC);',
    'if ($row) $row["guest_count"] = (int) $pdo->query("SELECT COUNT(*) FROM coop_seats")->fetchColumn();',
    'echo json_encode($row ?: new stdClass());'
  ].join('\n')));
}

function lobbyCount(dbFile) {
  return Number(lobbyQuery(dbFile, [
    '$pdo = new PDO("sqlite:" . $argv[1]);',
    'echo (string) $pdo->query("SELECT COUNT(*) FROM lobbies")->fetchColumn();'
  ].join('\n')));
}

async function openPage(context, url, options) {
  const page = await context.newPage();
  const errors = [];
  const bodies = [];
  page.on('pageerror', error => errors.push(String(error.message || error)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (options && options.ignoreOffline && /Failed to load resource|ERR_CONNECTION_REFUSED/.test(text)) return;
    errors.push(text);
  });
  page.on('response', async response => {
    if (!response.url().includes('coop.php')) return;
    try { bodies.push(await response.json()); } catch (error) { bodies.push({ parse: false }); }
  });
  await page.goto(url);
  return { page, errors, bodies };
}

async function bootToMenu(page) {
  if (await page.locator('#screen-menu.active').count() === 0) {
    await page.locator('#btn-boot').click();
    await page.waitForSelector('#screen-menu.active');
  }
  check(await page.locator('#btn-new-run').isEnabled(), 'solo new run stays available');
}

async function expectUnavailable(page) {
  await bootToMenu(page);
  await page.waitForFunction(() => {
    const button = document.getElementById('btn-coop');
    const note = document.getElementById('coop-unavailable');
    return button && button.disabled && note && !note.hidden
      && note.textContent.includes('Co-op is unavailable until the site admin enables it.');
  }, null, { timeout: 10000 });
  const box = await page.locator('#btn-coop').boundingBox();
  check(box && box.width > 0 && box.height > 0, 'CO-OP UPLINK stays visible');
  const text = await page.locator('#coop-unavailable').innerText();
  check(text.includes('Co-op is unavailable until the site admin enables it.'), 'unavailable copy is shown');
}

async function expectCanvas(page) {
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game');
    return canvas && canvas.width === 1280 && canvas.height === 720;
  }, null, { timeout: 10000 });
  const fill = await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const colors = [];
    let painted = 0;
    const cols = 8;
    const rows = 8;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = Math.min(canvas.width - 1, Math.floor((x + 0.5) * canvas.width / cols));
        const py = Math.min(canvas.height - 1, Math.floor((y + 0.5) * canvas.height / rows));
        const data = ctx.getImageData(px, py, 1, 1).data;
        colors.push(data[0] + ',' + data[1] + ',' + data[2]);
        if (data[0] + data[1] + data[2] > 0) painted += 1;
      }
    }
    return { painted, distinct: new Set(colors).size, width: canvas.width, height: canvas.height };
  });
  check(fill.width === 1280 && fill.height === 720, 'canvas matches the 1280x720 viewport');
  check(fill.painted >= 48, 'canvas is substantially filled');
  check(fill.distinct >= 3, 'canvas shows more than one flat color');
}

async function instrument(context) {
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    function Wrapped(config) {
      const urls = [];
      const servers = config && config.iceServers ? config.iceServers : [];
      for (let index = 0; index < servers.length; index++) {
        const value = servers[index] && servers[index].urls;
        if (Array.isArray(value)) urls.push.apply(urls, value);
        else if (value) urls.push(value);
      }
      window.__iceUrls = window.__iceUrls || [];
      window.__iceUrls.push(urls);
      return new Native(config);
    }
    Wrapped.prototype = Native.prototype;
    window.RTCPeerConnection = Wrapped;
  });
}

function assertIntroductionOnly(bodies) {
  const allowed = new Set(['ok', 'enabled', 'iceServers', 'reason', 'code', 'role', 'hostId', 'guestId', 'error', 'deleted', 'rev', 'selfRev', 'peerCard', 'protocol', 'seat', 'peers']);
  const cardKeys = new Set(['rev', 'session', 'sdp', 'candidates', 'clientId', 'profile', 'seat', 'protocol']);
  check(bodies.length > 0, 'the page talked to PHP');
  for (const body of bodies) {
    check(body && body.parse !== false, 'PHP introduction responses are JSON');
    for (const key of Object.keys(body)) check(allowed.has(key), 'PHP response stays an introduction: ' + key);
    for (const peer of body.peers || []) {
      for (const key of Object.keys(peer)) check(['clientId', 'seat', 'card'].includes(key), 'introduction peer field: ' + key);
      if (peer.card) {
        for (const key of Object.keys(peer.card)) check(cardKeys.has(key), 'connection card has no gameplay field: ' + key);
      }
    }
    const raw = JSON.stringify(body);
    check(!raw.includes('global_pause') && !raw.includes('playerBullets') && !raw.includes('shots'), 'PHP does not relay pause or shots');
  }
}

async function main() {
  const playwright = require('playwright');
  const sampleDb = path.join(scratch, 'sample.sqlite');
  const offDb = path.join(scratch, 'off.sqlite');
  const emptyDb = path.join(scratch, 'empty.sqlite');
  const liveDb = path.join(scratch, 'live.sqlite');
  const blockedDb = path.join(scratch, 'blocked.sqlite');
  const offConfig = writeConfig('off.php', {
    enabled: false,
    credentialTtlSeconds: 7200,
    iceServers: [{ urls: 'stun:127.0.0.1:3478' }]
  });
  const emptyConfig = writeConfig('empty.php', {
    enabled: true,
    credentialTtlSeconds: 7200,
    iceServers: []
  });
  const [samplePort, offPort, emptyPort, livePort, blockedPort, deadPort] = await Promise.all([
    startPhp({
      NEON_COOP_CONFIG: path.join(root, 'php', 'coop-config.sample.php'),
      NEON_COOP_DB: sampleDb
    }),
    startPhp({ NEON_COOP_CONFIG: offConfig, NEON_COOP_DB: offDb }),
    startPhp({ NEON_COOP_CONFIG: emptyConfig, NEON_COOP_DB: emptyDb }),
    startPhp({
      NEON_COOP_CONFIG: path.join(root, 'tools', 'fixtures', 'coop-config.enabled.php'),
      NEON_COOP_DB: liveDb
    }),
    startPhp({
      NEON_COOP_CONFIG: path.join(root, 'tools', 'fixtures', 'coop-config.enabled.php'),
      NEON_COOP_DB: blockedDb
    }),
    freePort()
  ]);

  browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const sample = await openPage(context, 'http://127.0.0.1:' + samplePort + '/');
  await expectUnavailable(sample.page);
  await expectCanvas(sample.page);
  await sample.page.locator('#btn-new-run').click();
  await sample.page.waitForSelector('#screen-ship.active');
  check(sample.errors.length === 0, 'sample page has no errors: ' + sample.errors.join(' | '));
  await sample.page.close();

  for (const [label, port] of [['disabled', offPort], ['empty', emptyPort]]) {
    const opened = await openPage(context, 'http://127.0.0.1:' + port + '/');
    await expectUnavailable(opened.page);
    check(opened.errors.length === 0, label + ' page has no errors: ' + opened.errors.join(' | '));
    await opened.page.close();
  }

  const failed = await openPage(context, 'http://127.0.0.1:' + samplePort + '/?intro=http://127.0.0.1:' + deadPort + '/php/coop.php', { ignoreOffline: true });
  await expectUnavailable(failed.page);
  check(failed.errors.length === 0, 'failed status page has no errors: ' + failed.errors.join(' | '));
  await failed.page.close();
  await context.close();

  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await instrument(hostContext);
  await instrument(guestContext);
  const live = 'http://127.0.0.1:' + livePort + '/';
  const host = await openPage(hostContext, live);
  await host.page.locator('#btn-boot').click();
  await host.page.locator('#btn-coop').click();
  await host.page.waitForFunction(() => {
    const button = document.getElementById('btn-coop');
    return window.NEON && window.NEON.Net && window.NEON.Net.available === true && button && !button.disabled;
  });
  await host.page.locator('#btn-coop-host').click();
  await host.page.waitForFunction(() => window.NEON.Net.code && window.NEON.Net.code.length === 5);
  const code = await host.page.evaluate(() => window.NEON.Net.code);
  const guest = await openPage(guestContext, live);
  await guest.page.locator('#btn-boot').click();
  await guest.page.locator('#btn-coop').click();
  await guest.page.locator('#coop-code-input').fill(code);
  await guest.page.locator('#btn-coop-join').click();
  await host.page.waitForFunction(() => window.NEON.Net.transport === 'p2p' && window.NEON.Net.label() === 'P2P', null, { timeout: 20000 });
  await guest.page.waitForFunction(() => window.NEON.Net.transport === 'p2p' && window.NEON.Net.label() === 'P2P', null, { timeout: 20000 });
  const ice = await guest.page.evaluate(() => window.__iceUrls || []);
  check(ice.length > 0 && ice[0].length === 1 && ice[0][0] === 'stun:127.0.0.1:3478', 'RTCPeerConnection receives the STUN list in order');
  check(await host.page.evaluate(() => window.NEON.Net.label()) === 'P2P', 'host label is P2P');

  await host.page.locator('#btn-coop-start').click();
  await guest.page.locator('#btn-coop-start').click();
  await host.page.waitForFunction(() => window.NEON.Game.mode === 'playing', null, { timeout: 20000 });
  await guest.page.waitForFunction(() => window.NEON.Game.mode === 'playing', null, { timeout: 20000 });
  await host.page.evaluate(() => window.NEON.Game.pauseGame());
  await host.page.waitForFunction(() => window.NEON.Game.mode === 'paused' && window.NEON.Coop.pauseState === 'PAUSED');
  await guest.page.waitForFunction(() => window.NEON.Game.mode === 'paused' && window.NEON.Coop.pauseState === 'PAUSED');
  await host.page.locator('#btn-resume').click();
  await guest.page.locator('#btn-resume').click();
  await host.page.waitForFunction(() => window.NEON.Coop.pauseState === 'PLAY' && window.NEON.Game.mode === 'playing', null, { timeout: 10000 });
  await guest.page.waitForFunction(() => window.NEON.Coop.pauseState === 'PLAY' && window.NEON.Game.mode === 'playing', null, { timeout: 10000 });
  check(true, 'host authority completes shared pause');

  await host.page.evaluate(() => window.NEON.Game.pauseGame());
  await guest.page.waitForSelector('#screen-pause.active');
  await guest.page.locator('#btn-save-quit').evaluate(button => button.click());
  await guest.page.waitForFunction(() => window.NEON.Net.role === 'solo');
  await new Promise(resolve => setTimeout(resolve, 800));
  const row = lobbyRow(liveDb);
  check(row.code === code, 'guest leave keeps the host lobby');
  check(row.guest_count === 0, 'guest leave clears only its guest seat');
  check(await host.page.evaluate(() => window.NEON.Net.code) === code, 'host keeps the room code');

  await host.page.locator('#btn-save-quit').evaluate(button => button.click());
  await host.page.waitForFunction(() => window.NEON.Net.code === '');
  await new Promise(resolve => setTimeout(resolve, 400));
  check(lobbyCount(liveDb) === 0, 'host leave deletes the lobby');
  assertIntroductionOnly(host.bodies.concat(guest.bodies));
  check(host.errors.length === 0, 'host page has no errors: ' + host.errors.join(' | '));
  check(guest.errors.length === 0, 'guest page has no errors: ' + guest.errors.join(' | '));

  const blockedContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await blockedContext.addInitScript(() => {
    function FakePeer() {
      this.localDescription = null;
      this.connectionState = 'new';
    }
    FakePeer.prototype.createDataChannel = function () {
      return { readyState: 'connecting', send() {}, close() {} };
    };
    FakePeer.prototype.createOffer = function () {
      return Promise.resolve({ type: 'offer', sdp: 'v=0\r\n' });
    };
    FakePeer.prototype.createAnswer = function () {
      return Promise.resolve({ type: 'answer', sdp: 'v=0\r\n' });
    };
    FakePeer.prototype.setLocalDescription = function (description) {
      this.localDescription = description;
      if (typeof this.onicecandidate === 'function') this.onicecandidate({ candidate: null });
      return Promise.resolve();
    };
    FakePeer.prototype.setRemoteDescription = function (description) {
      this.remoteDescription = description;
      return Promise.resolve();
    };
    FakePeer.prototype.addIceCandidate = function () { return Promise.resolve(); };
    FakePeer.prototype.close = function () {};
    window.RTCPeerConnection = FakePeer;
  });
  const blockedHostContext = blockedContext;
  const blockedGuestContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await blockedGuestContext.addInitScript(() => {
    function FakePeer() { this.localDescription = null; this.connectionState = 'new'; }
    FakePeer.prototype.createDataChannel = function () {
      return { readyState: 'connecting', send() {}, close() {} };
    };
    FakePeer.prototype.createOffer = function () {
      return Promise.resolve({ type: 'offer', sdp: 'v=0\r\n' });
    };
    FakePeer.prototype.createAnswer = function () {
      return Promise.resolve({ type: 'answer', sdp: 'v=0\r\n' });
    };
    FakePeer.prototype.setLocalDescription = function (description) {
      this.localDescription = description;
      if (typeof this.onicecandidate === 'function') this.onicecandidate({ candidate: null });
      return Promise.resolve();
    };
    FakePeer.prototype.setRemoteDescription = function (description) {
      this.remoteDescription = description;
      return Promise.resolve();
    };
    FakePeer.prototype.addIceCandidate = function () { return Promise.resolve(); };
    FakePeer.prototype.close = function () {};
    window.RTCPeerConnection = FakePeer;
  });
  const blockedUrl = 'http://127.0.0.1:' + blockedPort + '/';
  const blockedHost = await openPage(blockedHostContext, blockedUrl);
  await blockedHost.page.locator('#btn-boot').click();
  await blockedHost.page.locator('#btn-coop').click();
  await blockedHost.page.locator('#btn-coop-host').click();
  await blockedHost.page.waitForFunction(() => window.NEON.Net.code);
  const blockedCode = await blockedHost.page.evaluate(() => window.NEON.Net.code);
  const blockedGuest = await openPage(blockedGuestContext, blockedUrl);
  await blockedGuest.page.locator('#btn-boot').click();
  await blockedGuest.page.locator('#btn-coop').click();
  await blockedGuest.page.locator('#coop-code-input').fill(blockedCode);
  await blockedGuest.page.locator('#btn-coop-join').click();
  await new Promise(resolve => setTimeout(resolve, 2500));
  check(await blockedHost.page.locator('#screen-coop').evaluate(node => node.classList.contains('active')), 'host stays on the connecting screen');
  check(await blockedGuest.page.locator('#screen-coop').evaluate(node => node.classList.contains('active')), 'guest stays on the connecting screen');
  check(await blockedHost.page.evaluate(() => window.NEON.Game.mode) !== 'playing', 'a failed link does not start the host run');
  check(await blockedGuest.page.evaluate(() => window.NEON.Net.state) === 'connecting', 'guest stays connecting');
  assertIntroductionOnly(blockedHost.bodies.concat(blockedGuest.bodies));
  await blockedHost.page.close();
  await blockedGuest.page.close();

  const version = browser.version();
  console.log('Co-op page gate passed (' + checks + ' assertions) on Chromium ' + version + '.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  stopAll();
  if (browser) await browser.close();
  fs.rmSync(scratch, { recursive: true, force: true });
});
