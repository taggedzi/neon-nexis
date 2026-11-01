'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');

const sandbox = { setTimeout, clearTimeout };
sandbox.window = sandbox;
sandbox.NEON = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'coop-host.js'), 'utf8'), sandbox, { filename: 'js/coop-host.js' });

const CoopHost = sandbox.NEON.CoopHost;
assert.equal(typeof CoopHost.createAuthority, 'function');

function harness(graceMs) {
  const messages = [];
  const authority = CoopHost.createAuthority({ peerOfflineGraceMs: graceMs });
  authority.setDeliver((member, message) => messages.push({ clientId: member.clientId, message }));
  return { authority, messages, room: authority.room };
}

async function until(predicate) {
  for (let i = 0; i < 250; i++) {
    if (predicate()) return;
    await delay(20);
  }
  assert.fail('Lobby transition timed out');
}

(async () => {
  const { authority, messages, room } = harness(20);
  try {
    authority.setHost('host', { shipType: 'dart' });
    assert.equal(room.respawns, 4);
    assert.equal(room.host.clientId, 'host');
    authority.handle('host', { t: 'lobby_respawns', count: 8 });
    await until(() => room.respawns === 8);
    for (const count of [-1, 9, 1.5, '4']) authority.handle('host', { t: 'lobby_respawns', count });
    await delay(50);
    assert.equal(room.respawns, 8);

    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => !!room.launchTimer);
    const revision = room.lobbyRevision;
    authority.handle('host', { t: 'lobby_profile', profile: { shipType: 'kite' } });
    await until(() => !room.launchTimer);
    authority.handle('host', { t: 'lobby_ready', revision });
    await delay(50);
    assert.equal(room.lobbyReady.size, 0);
    assert.equal(room.phase, 'lobby');

    assert.equal(authority.setGuest('guest', {}), true);
    await until(() => room.guest && room.guest.clientId === 'guest');
    authority.handle('guest', { t: 'lobby_respawns', count: 0 });
    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.lobbyReady.size === 1);
    assert.equal(room.launchTimer, null);
    assert.equal(room.respawns, 8);
    authority.handle('guest', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.phase === 'run');
    assert.equal(room.runId, 1);
    assert.equal(messages.filter(entry => entry.clientId === 'host' && entry.message.t === 'launch').length, 1);
    assert.equal(authority.setGuest('guest', {}), false);
    assert.equal(room.guest.clientId, 'guest');

    authority.handle('host', { t: 'pause_request', runId: room.runId });
    assert.equal(room.pauseState, 'PAUSED');
    const epoch = room.pauseEpoch;
    authority.handle('guest', { t: 'ready_signal', runId: 0, epoch });
    await delay(50);
    assert.equal(room.readyPeers.size, 0);
    authority.handle('guest', { t: 'ready_signal', runId: room.runId, epoch });
    await until(() => room.readyPeers.size === 1);
    assert.equal(room.pauseState, 'PAUSED');
    authority.handle('host', { t: 'ready_signal', runId: room.runId, epoch });
    assert.equal(room.pauseState, 'COUNTDOWN');
    assert.equal(messages.filter(entry => entry.clientId === 'host' && entry.message.t === 'countdown_start').length, 1);
    await until(() => room.pauseState === 'PLAY');
    assert.ok(messages.some(entry => entry.clientId === 'host' && entry.message.t === 'global_resume'));

    authority.markOffline('guest');
    assert.equal(room.guest.online, false);
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(authority.setGuest('guest', { shipType: 'kite' }), true);
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(room.guest.online, true);

    authority.handle('guest', { t: 'leave' });
    await until(() => !room.guest);
    assert.equal(room.host.clientId, 'host');
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(authority.setGuest('replacement', {}), true);
    await until(() => room.guest && room.guest.clientId === 'replacement');
    assert.equal(room.pauseState, 'PAUSED');
    authority.handle('replacement', { t: 'ready_signal', runId: 0, epoch: room.pauseEpoch });
    await delay(50);
    assert.equal(room.readyPeers.size, 0);
    authority.handle('replacement', { t: 'ready_signal', runId: 1, epoch: room.pauseEpoch });
    await until(() => room.readyPeers.size === 1);
    assert.equal(room.pauseState, 'PAUSED');
    authority.markOffline('replacement');
    await until(() => !room.guest);
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(room.host.clientId, 'host');

    authority.handle('host', { t: 'return_lobby', runId: 1 });
    await until(() => room.phase === 'lobby');
    assert.equal(room.lobbyReady.size, 0);
    authority.handle('host', { t: 'lobby_respawns', count: 0 });
    await until(() => room.respawns === 0);
    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.runId === 2);
    assert.equal(room.phase, 'run');
    authority.handle('host', { t: 'return_lobby', runId: 1 });
    await delay(50);
    assert.equal(room.phase, 'run');

    const hung = harness(80);
    hung.authority.setHost('host', {});
    assert.equal(hung.authority.setGuest('guest', {}), true);
    hung.authority.holdOfflineGrace('guest');
    await delay(120);
    assert.equal(hung.room.guest && hung.room.guest.online, true);
    hung.authority.markOffline('guest');
    await delay(50);
    hung.authority.holdOfflineGrace('guest');
    await delay(40);
    assert.ok(hung.room.guest && hung.room.guest.online === false);
    await until(() => !hung.room.guest);

    const linked = harness(40);
    linked.authority.setHost('host', {});
    assert.equal(linked.authority.setGuest('guest', {}), true);
    linked.authority.markOffline('guest');
    linked.authority.holdOfflineGrace('guest');
    assert.equal(linked.authority.setGuest('guest', {}), true);
    await delay(80);
    assert.equal(linked.room.guest && linked.room.guest.clientId, 'guest');
    assert.equal(linked.room.guest.online, true);

    console.log('Lobby checks passed: readiness revisions, count bounds, repeated runs, stale controls, replacement, duplicate identity, hosted lifetime, and a hung re-offer.');
  } finally {
    authority.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
