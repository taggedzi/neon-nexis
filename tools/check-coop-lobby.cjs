'use strict';
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const WebSocket = require('ws');
const { createCoopServer } = require('../server/coop-server.cjs');

async function connect(url) {
  const socket = new WebSocket(url);
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(String(raw))));
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return { socket, messages, send: data => socket.send(JSON.stringify(data)) };
}
async function until(predicate) {
  for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(20); }
  assert.fail('Lobby transition timed out');
}

(async () => {
  const server = createCoopServer({ peerOfflineGraceMs: 20 });
  const address = await server.listen(0, '127.0.0.1');
  const url = 'ws://127.0.0.1:' + address.port;
  try {
    const host = await connect(url);
    host.send({ t: 'host', clientId: 'host', profile: { shipType: 'dart' } });
    await until(() => host.messages.some(m => m.t === 'hosted'));
    const code = host.messages.find(m => m.t === 'hosted').code;
    const room = server.rooms.get(code);
    assert.equal(room.respawns, 4);
    host.send({ t: 'lobby_respawns', count: 8 });
    await until(() => room.respawns === 8);
    for (const count of [-1, 9, 1.5, '4']) host.send({ t: 'lobby_respawns', count });
    await delay(50);
    assert.equal(room.respawns, 8);
    host.send({ t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => !!room.launchTimer);
    const revision = room.lobbyRevision;
    host.send({ t: 'lobby_profile', profile: { shipType: 'kite' } });
    await until(() => !room.launchTimer);
    host.send({ t: 'lobby_ready', revision });
    await delay(50);
    assert.equal(room.lobbyReady.size, 0);
    assert.equal(room.phase, 'lobby');

    const guest = await connect(url);
    guest.send({ t: 'join', code, clientId: 'guest', profile: {} });
    await until(() => room.guest);
    guest.send({ t: 'lobby_respawns', count: 0 });
    host.send({ t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.lobbyReady.size === 1);
    assert.equal(room.launchTimer, null);
    assert.equal(room.respawns, 8);
    guest.send({ t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.phase === 'run');
    assert.equal(room.runId, 1);
    await until(() => host.messages.some(m => m.t === 'launch'));
    assert.equal(host.messages.filter(m => m.t === 'launch').length, 1);

    const duplicate = await connect(url);
    duplicate.send({ t: 'join', code, clientId: 'guest', profile: {} });
    await until(() => duplicate.messages.some(m => m.t === 'full'));
    assert.equal(room.guest.clientId, 'guest');
    duplicate.socket.close();

    guest.send({ t: 'leave' });
    await until(() => !room.guest);
    room.updatedAt = Date.now() - 3600000;
    room.host.socket.isAlive = true;
    server.sweep(Date.now());
    assert.equal(server.rooms.get(code), room);
    assert.equal(room.pauseState, 'PLAY');
    const replacement = await connect(url);
    replacement.send({ t: 'join', code, clientId: 'replacement', profile: {} });
    await until(() => room.guest && room.guest.clientId === 'replacement');
    assert.equal(room.pauseState, 'PAUSED');
    replacement.send({ t: 'ready_signal', runId: 0, epoch: room.pauseEpoch });
    await delay(50);
    assert.equal(room.readyPeers.size, 0);
    replacement.send({ t: 'ready_signal', runId: 1, epoch: room.pauseEpoch });
    await until(() => room.readyPeers.size === 1);
    assert.equal(room.pauseState, 'PAUSED');
    replacement.socket.close();
    await until(() => !room.guest);
    assert.equal(room.pauseState, 'PLAY');
    host.send({ t: 'return_lobby', runId: 1 });
    await until(() => room.phase === 'lobby');
    assert.equal(room.code, code);
    assert.equal(room.lobbyReady.size, 0);
    host.send({ t: 'lobby_respawns', count: 0 });
    await until(() => room.respawns === 0);
    host.send({ t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.runId === 2);
    assert.equal(room.phase, 'run');
    host.send({ t: 'return_lobby', runId: 1 });
    await delay(50);
    assert.equal(room.phase, 'run');
    console.log('Lobby checks passed: readiness revisions, count bounds, repeated runs, stale controls, replacement, duplicate identity, and hosted lifetime.');
  } finally {
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
