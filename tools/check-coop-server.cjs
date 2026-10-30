/* Checks room creation, joining, signaling/relay forwarding and failure cases. */
'use strict';

const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const WebSocket = require('ws');
const { createCoopServer } = require('../server/coop-server.cjs');

function client(url) {
  const socket = new WebSocket(url);
  const queue = [];
  const waiters = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else queue.push(message);
  });
  return {
    socket,
    open: () => new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    }),
    send: (message) => socket.send(JSON.stringify(message)),
    next: (timeout = 2000) => new Promise((resolve, reject) => {
      if (queue.length) {
        resolve(queue.shift());
        return;
      }
      const timer = setTimeout(() => {
        const index = waiters.indexOf(onMessage);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for a signaling message'));
      }, timeout);
      function onMessage(message) {
        clearTimeout(timer);
        resolve(message);
      }
      waiters.push(onMessage);
    }),
    close: () => socket.close()
  };
}

async function runRoomlessProbe() {
  const server = createCoopServer();
  const address = await server.listen(0, '127.0.0.1');
  const url = 'ws://127.0.0.1:' + address.port;
  const stray = client(url);
  await stray.open();
  stray.send({ t: 'ready_signal', note: 'TOKEN_SHOULD_NOT_LOG' });
  stray.send({ t: 'pause_request', note: 'TOKEN_SHOULD_NOT_LOG' });
  stray.send({ t: 'pause_sync', note: 'TOKEN_SHOULD_NOT_LOG' });
  await new Promise((resolve) => setTimeout(resolve, 200));

  const host = client(url);
  await host.open();
  host.send({ t: 'host', clientId: 'probe-host', profile: { name: 'PLAYER 1' } });
  const hosted = await host.next();
  assert.equal(hosted.t, 'hosted');
  const guest = client(url);
  await guest.open();
  guest.send({ t: 'join', code: hosted.code, clientId: 'probe-guest', profile: {} });
  const joined = await guest.next();
  assert.equal(joined.t, 'joined');
  const peer = await host.next();
  assert.equal(peer.t, 'peer');
  host.send({ t: 'pause_request' });
  const hostPause = await host.next();
  const guestPause = await guest.next();
  assert.equal(hostPause.t, 'global_pause');
  assert.equal(guestPause.t, 'global_pause');

  guest.send({ t: 'leave' });
  const left = await host.next();
  assert.equal(left.t, 'peer-left');
  guest.send({ t: 'ready_signal', note: 'TOKEN_SHOULD_NOT_LOG' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  host.send({ t: 'pause_request' });
  const pausedAgain = await host.next();
  assert.equal(pausedAgain.t, 'global_pause');

  stray.close();
  host.close();
  guest.close();
  server.close();
  console.log('PROBE_OK');
}

if (process.argv[2] === '--roomless-probe') {
  runRoomlessProbe().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else (async () => {
  const probe = spawnSync(process.execPath, [__filename, '--roomless-probe'], { encoding: 'utf8' });
  assert.equal(probe.status, 0, (probe.stderr || '') + (probe.stdout || ''));
  assert.match(probe.stdout, /PROBE_OK/);
  assert.equal(String(probe.stderr || '').includes('TOKEN_SHOULD_NOT_LOG'), false);
  assert.equal(String(probe.stdout || '').includes('TOKEN_SHOULD_NOT_LOG'), false);
  assert.equal(String(probe.stderr || '').includes('TypeError'), false);

  const server = createCoopServer();
  const address = await server.listen(0, '127.0.0.1');
  const url = 'ws://127.0.0.1:' + address.port;
  let checks = 0;

  const host = client(url);
  await host.open();
  host.send({ t: 'host', clientId: 'host-id', profile: { name: 'PLAYER 1', shipType: 'dart', shipColor: '#00f0ff' } });
  const hosted = await host.next();
  assert.equal(hosted.t, 'hosted');
  assert.match(hosted.code, /^[A-HJ-NP-Z2-9]{5}$/);
  checks += 2;

  const guest = client(url);
  await guest.open();
  guest.send({ t: 'join', code: hosted.code, clientId: 'guest-id', profile: { name: 'PLAYER 2', shipType: 'kite', shipColor: '#ff77e6' } });
  const joined = await guest.next();
  assert.equal(joined.t, 'joined');
  assert.equal(joined.host.clientId, 'host-id');
  checks += 2;

  const peer = await host.next();
  assert.equal(peer.t, 'peer');
  assert.equal(peer.peer.clientId, 'guest-id');
  checks += 2;

  host.send({ t: 'signal', to: 'guest-id', data: { kind: 'offer', sdp: 'offer-test' } });
  const signal = await guest.next();
  assert.equal(signal.t, 'signal');
  assert.equal(signal.from, 'host-id');
  assert.equal(signal.data.sdp, 'offer-test');
  checks += 3;

  guest.send({ t: 'relay', to: 'host-id', data: { t: 'state', _s: 1, x: 12 } });
  const relay = await host.next();
  assert.equal(relay.t, 'relay');
  assert.equal(relay.data.x, 12);
  checks += 2;

  const extra = client(url);
  await extra.open();
  extra.send({ t: 'join', code: hosted.code, clientId: 'third-id', profile: {} });
  const full = await extra.next();
  assert.equal(full.t, 'full');
  checks += 1;
  extra.close();

  const missing = client(url);
  await missing.open();
  missing.send({ t: 'join', code: 'ZZZZZ', clientId: 'missing-id', profile: {} });
  const notFound = await missing.next();
  assert.equal(notFound.t, 'notfound');
  checks += 1;
  missing.close();

  host.send({ t: 'pause_request' });
  const hostPause = await host.next();
  const guestPause = await guest.next();
  assert.equal(hostPause.t, 'global_pause');
  assert.equal(guestPause.t, 'global_pause');
  assert.equal(hostPause.by, 'host-id');
  assert.equal(guestPause.by, 'host-id');
  checks += 4;

  host.send({ t: 'pause_request' });
  host.send({ t: 'ready_signal' });
  const hostReady = await host.next();
  const guestReady = await guest.next();
  assert.equal(hostReady.t, 'ready_state');
  assert.deepEqual(hostReady.ready, ['host-id']);
  assert.equal(guestReady.t, 'ready_state');
  assert.deepEqual(guestReady.ready, ['host-id']);
  checks += 4;

  guest.send({ t: 'ready_signal' });
  const hostReadyAll = await host.next();
  const guestReadyAll = await guest.next();
  assert.equal(hostReadyAll.t, 'ready_state');
  assert.deepEqual(hostReadyAll.ready, ['host-id', 'guest-id']);
  assert.deepEqual(guestReadyAll.ready, ['host-id', 'guest-id']);
  const hostCountdown = await host.next();
  const guestCountdown = await guest.next();
  assert.equal(hostCountdown.t, 'countdown_start');
  assert.equal(hostCountdown.seconds, 3);
  assert.equal(guestCountdown.t, 'countdown_start');
  assert.equal(guestCountdown.seconds, 3);
  checks += 6;

  guest.send({ t: 'pause_sync' });
  const guestSyncCountdown = await guest.next();
  assert.equal(guestSyncCountdown.t, 'countdown_start');
  assert.ok(guestSyncCountdown.seconds >= 1 && guestSyncCountdown.seconds <= 3);
  checks += 2;

  const hostResume = await host.next(5000);
  const guestResume = await guest.next(5000);
  assert.equal(hostResume.t, 'global_resume');
  assert.equal(guestResume.t, 'global_resume');
  checks += 2;

  host.send({ t: 'pause_sync' });
  const hostSyncPlay = await host.next();
  assert.equal(hostSyncPlay.t, 'global_resume');
  checks += 1;

  guest.send({ t: 'pause_request' });
  const hostPauseAgain = await host.next();
  const guestPauseAgain = await guest.next();
  assert.equal(hostPauseAgain.t, 'global_pause');
  assert.equal(guestPauseAgain.t, 'global_pause');
  assert.equal(guestPauseAgain.by, 'guest-id');
  checks += 3;

  host.send({ t: 'pause_sync' });
  const hostSyncPaused = await host.next();
  assert.equal(hostSyncPaused.t, 'global_pause');
  assert.equal(hostSyncPaused.by, 'guest-id');
  checks += 2;

  guest.send({ t: 'leave' });
  const left = await host.next();
  assert.equal(left.t, 'peer-left');
  checks += 1;

  host.close();
  guest.close();

  const liveHost = client(url);
  await liveHost.open();
  liveHost.send({ t: 'host', clientId: 'live-host', profile: {} });
  const liveHosted = await liveHost.next();
  const liveGuest = client(url);
  await liveGuest.open();
  liveGuest.send({ t: 'join', code: liveHosted.code, clientId: 'live-guest', profile: {} });
  await liveGuest.next();
  await liveHost.next();
  const liveRoom = server.rooms.get(liveHosted.code);
  liveRoom.updatedAt = Date.now() - (5 * 60 * 1000 + 1);
  liveRoom.pauseState = 'PAUSED';
  server.sweep(Date.now());
  assert.equal(server.rooms.has(liveHosted.code), true);
  assert.equal(liveRoom.pauseState, 'PAUSED');
  assert.equal(liveRoom.host.room, liveRoom);
  assert.equal(liveRoom.guest.room, liveRoom);
  assert.equal(liveHost.socket.readyState, WebSocket.OPEN);
  assert.equal(liveGuest.socket.readyState, WebSocket.OPEN);
  liveRoom.host.socket.emit('pong');
  liveRoom.guest.socket.emit('pong');
  server.sweep(Date.now());
  assert.equal(server.rooms.has(liveHosted.code), true);
  assert.equal(liveHost.socket.readyState, WebSocket.OPEN);
  assert.equal(liveGuest.socket.readyState, WebSocket.OPEN);
  checks += 8;

  liveGuest.close();
  await new Promise((resolve) => setTimeout(resolve, 40));
  liveRoom.updatedAt = Date.now() - (60 * 1000 + 5);
  liveRoom.host.socket.isAlive = true;
  server.sweep(Date.now());
  assert.equal(server.rooms.has(liveHosted.code), true);
  assert.equal(liveRoom.guest, null);
  assert.equal(liveRoom.host.room, liveRoom);
  const guestLeft = await liveHost.next();
  assert.equal(guestLeft.t, 'peer-left');
  liveRoom.updatedAt = Date.now() - (5 * 60 * 1000 + 5);
  liveRoom.host.socket.isAlive = true;
  server.sweep(Date.now());
  assert.equal(server.rooms.has(liveHosted.code), false);
  assert.equal(liveRoom.host.room, null);
  const hostLeft = await liveHost.next();
  assert.equal(hostLeft.t, 'peer-left');
  liveHost.send({ t: 'ready_signal' });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(server.rooms.has(liveHosted.code), false);
  checks += 8;
  liveHost.close();

  const doomedHost = client(url);
  await doomedHost.open();
  doomedHost.send({ t: 'host', clientId: 'doomed-host', profile: {} });
  const doomedHosted = await doomedHost.next();
  const doomedGuest = client(url);
  await doomedGuest.open();
  doomedGuest.send({ t: 'join', code: doomedHosted.code, clientId: 'doomed-guest', profile: {} });
  await doomedGuest.next();
  await doomedHost.next();
  const doomedRoom = server.rooms.get(doomedHosted.code);
  doomedHost.close();
  await new Promise((resolve) => setTimeout(resolve, 40));
  doomedRoom.updatedAt = Date.now() - (60 * 1000 + 5);
  doomedRoom.guest.socket.isAlive = true;
  server.sweep(Date.now());
  assert.equal(server.rooms.has(doomedHosted.code), false);
  assert.equal(doomedRoom.guest.room, null);
  assert.equal(doomedRoom.host.room, null);
  const hostGone = await doomedGuest.next();
  assert.equal(hostGone.t, 'peer-left');
  checks += 4;
  doomedGuest.close();

  const idle = client(url);
  await idle.open();
  idle.send({ t: 'host', clientId: 'idle-host', profile: {} });
  const idleHosted = await idle.next();
  assert.equal(idleHosted.t, 'hosted');
  const idleRoom = server.rooms.get(idleHosted.code);
  const pauseBeforeExpiry = idleRoom.pauseState;
  idleRoom.updatedAt = Date.now() - (5 * 60 * 1000 + 5);
  server.sweep(Date.now());
  assert.equal(server.rooms.has(idleHosted.code), false);
  const expiredNotice = await idle.next();
  assert.equal(expiredNotice.t, 'peer-left');
  idle.send({ t: 'ready_signal', note: 'TOKEN_SHOULD_NOT_LOG' });
  idle.send({ t: 'pause_request' });
  idle.send({ t: 'pause_sync', note: 'TOKEN_SHOULD_NOT_LOG' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(server.rooms.has(idleHosted.code), false);
  assert.equal(idleRoom.pauseState, pauseBeforeExpiry);
  assert.equal(idleRoom.readyPeers.size, 0);
  idle.send({ t: 'host', clientId: 'idle-host', profile: {} });
  const rehosted = await idle.next();
  assert.equal(rehosted.t, 'hosted');
  assert.equal(server.rooms.has(rehosted.code), true);
  checks += 8;

  const marked = client(url);
  await marked.open();
  marked.send({ t: 'host', clientId: 'marked-host', profile: {} });
  const markedHosted = await marked.next();
  assert.equal(markedHosted.t, 'hosted');
  server.sweep(Date.now());
  marked.socket.isAlive = false;
  marked.send({ t: 'ping' });
  const markedPong = await marked.next();
  assert.equal(markedPong.t, 'pong');
  server.sweep(Date.now());
  assert.equal(marked.socket.readyState, WebSocket.OPEN);
  checks += 3;
  marked.close();

  idle.close();
  server.close();
  console.log('Co-op signaling checks passed (' + checks + ' assertions).');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
