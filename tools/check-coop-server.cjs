/* Checks room creation, joining, signaling/relay forwarding and failure cases. */
'use strict';

const assert = require('node:assert');
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

(async () => {
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

  const hostResume = await host.next(5000);
  const guestResume = await guest.next(5000);
  assert.equal(hostResume.t, 'global_resume');
  assert.equal(guestResume.t, 'global_resume');
  checks += 2;

  guest.send({ t: 'leave' });
  const left = await host.next();
  assert.equal(left.t, 'peer-left');
  checks += 1;

  host.close();
  guest.close();
  server.close();
  console.log('Co-op signaling checks passed (' + checks + ' assertions).');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
