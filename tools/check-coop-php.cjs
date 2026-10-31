'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const scratch = process.env.NEON_COOP_TEST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'neon-coop-php-'));
const secret = 'turn-' + crypto.randomBytes(18).toString('hex');
const accountSid = 'AC' + crypto.randomBytes(12).toString('hex');
const authToken = 'auth-' + crypto.randomBytes(18).toString('hex');
const cfKey = 'cfkey-' + crypto.randomBytes(12).toString('hex');
const cfToken = 'cftok-' + crypto.randomBytes(18).toString('hex');
const meteredKey = 'meter-' + crypto.randomBytes(18).toString('hex');
const xirsysIdent = 'xident-' + crypto.randomBytes(8).toString('hex');
const xirsysSecret = 'xsecret-' + crypto.randomBytes(18).toString('hex');
const secrets = [secret, accountSid, authToken, cfKey, cfToken, meteredKey, xirsysIdent, xirsysSecret];
const children = [];
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function writeConfig(name, value) {
  const file = path.join(scratch, name);
  fs.writeFileSync(file, '<?php\nreturn ' + phpExport(value) + ';\n');
  return file;
}

function phpExport(value) {
  if (Array.isArray(value)) {
    return 'array(' + value.map(phpExport).join(',') + ')';
  }
  if (value && typeof value === 'object') {
    return 'array(' + Object.entries(value).map(([key, item]) => phpString(key) + '=>' + phpExport(item)).join(',') + ')';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return phpString(String(value));
}

function phpString(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function startPhp(env) {
  const port = await freePort();
  const child = spawn('php', ['-d', 'opcache.enable=0', '-S', '127.0.0.1:' + port, '-t', root, 'php/router.php'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(child);
  let log = '';
  child.stderr.on('data', chunk => { log += chunk; });
  child.stdout.on('data', chunk => { log += chunk; });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/index.html');
      if (response.status) return { port, base: 'http://127.0.0.1:' + port, log: () => log };
    } catch (error) { /* still starting */ }
    if (child.exitCode !== null) break;
    await delay(100);
  }
  throw new Error('PHP introduction server did not start\n' + log);
}

function startStandIn(port) {
  const seen = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      seen.push({ method: request.method, url: request.url, headers: request.headers, body });
      const pathName = request.url.split('?')[0];
      let payload;
      if (pathName === '/twilio') payload = { ice_servers: [{ urls: 'stun:twilio.stand-in:3478' }] };
      else if (pathName === '/cloudflare') payload = { iceServers: [{ urls: 'turn:cloudflare.stand-in:3478', username: 'cf-user', credential: 'cf-cred' }] };
      else if (pathName === '/metered') payload = [{ urls: 'stun:metered.stand-in:3478' }];
      else if (pathName === '/xirsys') payload = { s: 'ok', v: { iceServers: { urls: ['turn:xirsys.stand-in:3478'], username: 'x-user', credential: 'x-cred' } } };
      else payload = { iceServers: [] };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload));
    });
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => resolve({ server, seen }));
  });
}

async function post(base, body) {
  const response = await fetch(base + '/php/coop.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, text, body: JSON.parse(text) };
}

function sql(db, op, code) {
  const script = [
    '$pdo = new PDO("sqlite:" . getenv("DB"));',
    '$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);',
    '$code = getenv("CODE");',
    '$op = getenv("OP");',
    'if ($op === "columns") { foreach ($pdo->query("PRAGMA table_info(lobbies)") as $column) echo $column["name"], " "; }',
    'elseif ($op === "age-checkin") { $pdo->prepare("UPDATE lobbies SET checked_in_at = :t WHERE code = :c")->execute(["t" => time() - 100, "c" => $code]); }',
    'elseif ($op === "stale") { $pdo->prepare("UPDATE lobbies SET checked_in_at = :t WHERE code = :c")->execute(["t" => time() - 700, "c" => $code]); }',
    'elseif ($op === "ancient") { $pdo->prepare("UPDATE lobbies SET created_at = :t, checked_in_at = :now WHERE code = :c")->execute(["t" => time() - 86400 - 30, "now" => time(), "c" => $code]); }',
    'elseif ($op === "checked") { echo (int) $pdo->query("SELECT checked_in_at FROM lobbies")->fetchColumn(); }',
    'elseif ($op === "count") { echo (int) $pdo->query("SELECT COUNT(*) FROM lobbies")->fetchColumn(); }',
    'elseif ($op === "guest") { $guest = $pdo->query("SELECT guest_id FROM lobbies")->fetchColumn(); echo (int) $pdo->query("SELECT COUNT(*) FROM lobbies")->fetchColumn(), " ", $guest === false || $guest === null ? "none" : $guest; }',
    'elseif ($op === "one") { $stmt = $pdo->prepare("SELECT COUNT(*) FROM lobbies WHERE code = :c"); $stmt->execute(["c" => $code]); echo (int) $stmt->fetchColumn(); }',
    'elseif ($op === "codes") { echo (string) $pdo->query("SELECT GROUP_CONCAT(code) FROM lobbies")->fetchColumn(); }'
  ].join(' ');
  const result = spawnSync('php', ['-r', script], {
    env: { ...process.env, DB: db, CODE: code || '', OP: op },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'sqlite helper failed');
  return (result.stdout || '').trim();
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

async function main() {
  for (const file of ['php/coop.php', 'php/coop-cleanup.php', 'php/router.php', 'php/lib/config.php', 'php/lib/credentials.php', 'php/lib/store.php', 'php/lib/http.php']) {
    const syntax = spawnSync('php', ['-l', file], { cwd: root, encoding: 'utf8' });
    check(syntax.status === 0, syntax.stderr || syntax.stdout || file);
  }

  const db = path.join(scratch, 'lobby.sqlite');
  const standPort = await freePort();
  const stand = await startStandIn(standPort);
  const standBase = 'http://127.0.0.1:' + standPort;
  const enabled = writeConfig('enabled.php', {
    enabled: true,
    credentialTtlSeconds: 7200,
    iceServers: [
      { urls: 'stun:stun.example.com:3478' },
      { urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'], secret },
      { provider: 'twilio', accountSid, authToken, tokenUrl: standBase + '/twilio' },
      { provider: 'cloudflare', keyId: cfKey, apiToken: cfToken, tokenUrl: standBase + '/cloudflare' },
      { provider: 'metered', apiKey: meteredKey, appName: 'neon', tokenUrl: standBase + '/metered' },
      { provider: 'xirsys', ident: xirsysIdent, secret: xirsysSecret, channel: 'neon', tokenUrl: standBase + '/xirsys' }
    ]
  });
  const live = await startPhp({ NEON_COOP_CONFIG: enabled, NEON_COOP_DB: db });
  const clientId = 'nn_' + 'ab'.repeat(16);

  const status = await post(live.base, { action: 'status', clientId });
  check(status.status === 200 && status.body.enabled === true, 'enabled status');
  check(status.body.iceServers.length === 6, 'fallback list length');
  check(status.body.iceServers[0].urls === 'stun:stun.example.com:3478', 'stun stays first');
  check(!status.body.iceServers[0].username && !status.body.iceServers[0].credential, 'stun has no credential');
  const turn = status.body.iceServers[1];
  const [expiry, idPart] = String(turn.username).split(':');
  check(idPart === clientId, 'TURN username client id');
  check(Math.abs(Number(expiry) - (Math.floor(Date.now() / 1000) + 7200)) < 5, 'TURN lifetime is credentialTtlSeconds');
  const expected = crypto.createHmac('sha1', secret).update(turn.username).digest('base64');
  check(turn.credential === expected, 'TURN credential matches an independent HMAC-SHA1');
  check(turn.urls[0] === 'turn:turn.example.com:3478' && turn.urls[1] === 'turns:turn.example.com:5349', 'TURN url order');
  check(status.body.iceServers[2].urls === 'stun:twilio.stand-in:3478', 'twilio token order');
  check(status.body.iceServers[3].credential === 'cf-cred' && status.body.iceServers[3].username === 'cf-user', 'cloudflare token order');
  check(status.body.iceServers[4].urls === 'stun:metered.stand-in:3478', 'metered token order');
  check(status.body.iceServers[5].username === 'x-user', 'xirsys token order');
  for (const value of secrets) check(!status.text.includes(value), 'status body hides ' + value.slice(0, 6));
  check(stand.seen.length === 4, 'four provider token calls');
  const outbound = JSON.stringify(stand.seen);
  check(outbound.includes(Buffer.from(accountSid + ':' + authToken).toString('base64')), 'twilio call carries the API credential');
  check(outbound.includes(cfToken) && outbound.includes(meteredKey), 'cloudflare and metered calls carry API keys');
  check(outbound.includes(Buffer.from(xirsysIdent + ':' + xirsysSecret).toString('base64')), 'xirsys call carries the API credential');
  check(stand.seen[0].method === 'POST' && stand.seen[1].method === 'POST' && stand.seen[2].method === 'GET' && stand.seen[3].method === 'PUT', 'provider methods');

  const sample = await startPhp({
    NEON_COOP_CONFIG: path.join(root, 'php', 'coop-config.sample.php'),
    NEON_COOP_DB: path.join(scratch, 'sample.sqlite')
  });
  const sampleStatus = await fetch(sample.base + '/php/coop.php?action=status').then(response => response.json());
  check(sampleStatus.enabled === false && sampleStatus.iceServers.length === 0 && sampleStatus.reason === 'disabled', 'sample config disables co-op');
  const off = await startPhp({
    NEON_COOP_CONFIG: writeConfig('off.php', {
      enabled: false,
      credentialTtlSeconds: 7200,
      iceServers: [{ urls: 'stun:stun.example.com:3478' }]
    }),
    NEON_COOP_DB: path.join(scratch, 'off.sqlite')
  });
  const offStatus = await post(off.base, { action: 'status', clientId });
  check(offStatus.body.enabled === false && offStatus.body.iceServers.length === 0, 'enabled false stays off');
  const empty = await startPhp({
    NEON_COOP_CONFIG: writeConfig('empty.php', { enabled: true, credentialTtlSeconds: 7200, iceServers: [] }),
    NEON_COOP_DB: path.join(scratch, 'empty.sqlite')
  });
  const emptyStatus = await post(empty.base, { action: 'status', clientId });
  check(emptyStatus.body.enabled === false && emptyStatus.body.reason === 'empty', 'empty address list stays off');
  const broken = await startPhp({
    NEON_COOP_CONFIG: writeConfig('broken.php', { enabled: true }),
    NEON_COOP_DB: path.join(scratch, 'broken.sqlite')
  });
  fs.writeFileSync(path.join(scratch, 'broken.php'), '<?php\nthrow new RuntimeException("hidden-' + secret + '");\n');
  const brokenResponse = await fetch(broken.base + '/php/coop.php?action=status');
  const brokenText = await brokenResponse.text();
  check(brokenResponse.status === 503 && !brokenText.includes(secret) && brokenText.includes('unavailable'), 'broken config fails closed');

  const host = await post(live.base, { action: 'host', clientId });
  check(host.body.ok === true && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(host.body.code), 'host room code');
  const code = host.body.code;
  const columns = sql(db, 'columns');
  check(columns === 'code host_id guest_id host_card guest_card created_at checked_in_at', 'lobby columns are introduction only');
  const guestId = 'nn_' + 'cd'.repeat(16);
  const joined = await post(live.base, { action: 'join', code, clientId: guestId });
  check(joined.body.ok === true && joined.body.hostId === clientId, 'guest join');
  const other = await post(live.base, { action: 'join', code, clientId: 'nn_other' });
  check(other.body.ok === false && other.body.error === 'full', 'second guest is refused');
  sql(db, 'age-checkin', code);
  const guestCheck = await post(live.base, { action: 'checkin', code, clientId: guestId });
  check(guestCheck.body.ok === false, 'guest check-in is not a host check-in');
  const aged = Number(sql(db, 'checked'));
  const refreshed = await post(live.base, { action: 'checkin', code, clientId });
  const after = Number(sql(db, 'checked'));
  check(refreshed.body.ok === true && after >= aged + 100, 'host check-in refreshes the row');

  const firstCard = await post(live.base, {
    action: 'card', code, clientId: guestId,
    card: { session: 'one', sdp: { type: 'offer', sdp: 'v=0 offer' }, candidates: [{ candidate: 'cand-1', sdpMid: '0', sdpMLineIndex: 0 }], profile: { name: 'PLAYER 2', shipType: 'dart', shipColor: '#00f0ff' }, pause: true, shots: [1] }
  });
  check(firstCard.body.ok === true && firstCard.body.rev === 1, 'first connection card');
  const seen = await post(live.base, { action: 'poll', code, clientId, sinceRev: 0 });
  check(seen.body.peerCard.sdp.sdp === 'v=0 offer' && seen.body.peerCard.rev === 1, 'host reads the guest card');
  check(!JSON.stringify(seen.body).includes('shots') && !JSON.stringify(seen.body).includes('pause'), 'poll does not relay gameplay or pause');
  const second = await post(live.base, {
    action: 'card', code, clientId: guestId,
    card: { session: 'two', sdp: { type: 'offer', sdp: 'v=0 again' }, candidates: [{ candidate: 'cand-2' }] }
  });
  const replacement = await post(live.base, { action: 'poll', code, clientId, sinceRev: 1 });
  check(second.body.rev === 2 && replacement.body.peerCard.session === 'two', 'replacement card while the row exists');

  const guestLeave = await post(live.base, { action: 'leave', code, clientId: guestId });
  const still = sql(db, 'guest');
  check(guestLeave.body.deleted === false && still.startsWith('1 none'), 'guest leave keeps the lobby');
  const hostLeave = await post(live.base, { action: 'leave', code, clientId });
  check(hostLeave.body.deleted === true && sql(db, 'count') === '0', 'host leave deletes the lobby');

  const doomed = await post(live.base, { action: 'host', clientId });
  const doomedCode = doomed.body.code;
  sql(db, 'stale', doomedCode);
  await post(live.base, { action: 'poll', code: doomedCode, clientId });
  check(sql(db, 'one', doomedCode) === '0', 'a later request deletes a lobby quiet for 10 minutes');

  const old = await post(live.base, { action: 'host', clientId });
  sql(db, 'ancient', old.body.code);
  const fresh = await post(live.base, { action: 'host', clientId: 'nn_fresh' });
  const cleanup = spawnSync('php', [path.join(root, 'php', 'coop-cleanup.php')], {
    cwd: root,
    env: { ...process.env, NEON_COOP_CONFIG: enabled, NEON_COOP_DB: db },
    encoding: 'utf8'
  });
  check(cleanup.status === 0, cleanup.stderr || 'cleanup script');
  const left = sql(db, 'codes');
  check(left === fresh.body.code, 'daily cleanup removes rows older than 24 hours and keeps a fresh lobby');

  const outside = spawnSync('php', ['-r', 'require "php/lib/config.php"; echo neon_coop_database_path(["enabled"=>false]);'], {
    cwd: root,
    env: { ...process.env, NEON_COOP_DB: '', NEON_COOP_CONFIG: '' },
    encoding: 'utf8'
  });
  const defaultDb = path.resolve(outside.stdout.trim());
  check(!defaultDb.startsWith(path.resolve(root) + path.sep), 'default database is outside the document root');
  fs.mkdirSync(path.join(root, 'php', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'php', 'data', 'probe.sqlite'), 'not a database');
  fs.writeFileSync(path.join(root, 'php', 'coop-config.php'), '<?php return ["secret"=>"' + secret + '"];\n');
  const probe = await fetch(live.base + '/php/data/probe.sqlite');
  const configFetch = await fetch(live.base + '/php/coop-config.php');
  const library = await fetch(live.base + '/php/lib/store.php');
  const cleanupHttp = await fetch(live.base + '/php/coop-cleanup.php');
  check(probe.status === 403 && configFetch.status === 403 && library.status === 403 && cleanupHttp.status === 403, 'database, config, and cleanup are not downloadable');
  const configText = await configFetch.text();
  check(!configText.includes(secret), 'denied config body hides the secret');
  const ignore = spawnSync('git', ['check-ignore', 'php/coop-config.php', 'php/data/probe.sqlite'], { cwd: root, encoding: 'utf8' });
  check(ignore.status === 0 && ignore.stdout.trim().split(/\r?\n/).length === 2, 'git ignores the real config and sqlite file');

  const sampleText = fs.readFileSync(path.join(root, 'php', 'coop-config.sample.php'), 'utf8');
  const clientSource = spawnSync('git', ['grep', '-l', secret, '--', 'js', 'php/coop-config.sample.php'], { cwd: root, encoding: 'utf8' });
  check(sampleText.includes("'enabled' => false") && sampleText.includes('7200') && !sampleText.includes(secret), 'sample stays disabled and secret-free');
  check(clientSource.status !== 0, 'secret is not in client source or the sample');

  stand.server.close();
  stopAll();
  fs.rmSync(path.join(root, 'php', 'data', 'probe.sqlite'), { force: true });
  fs.rmSync(path.join(root, 'php', 'coop-config.php'), { force: true });
  console.log('PHP co-op introduction checks passed (' + checks + ' assertions).');
}

main().catch(error => {
  stopAll();
  try { fs.rmSync(path.join(root, 'php', 'data', 'probe.sqlite'), { force: true }); } catch (ignore) { /* ignore */ }
  try { fs.rmSync(path.join(root, 'php', 'coop-config.php'), { force: true }); } catch (ignore) { /* ignore */ }
  console.error(error);
  process.exit(1);
});
