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
