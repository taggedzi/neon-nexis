'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const connections = [], received = [];
const guests = [1, 2, 3].map(seat => ({ clientId: 'guest' + seat, seat,
  card: { protocol: 2, rev: 1, session: 'offer' + seat, clientId: 'guest' + seat,
    sdp: { type: 'offer', sdp: 'guest SDP ' + seat }, candidates: [], profile: {} } }));
class Peer {
  constructor() { connections.push(this); }
  async setRemoteDescription(description) { this.remoteDescription = description; }
  async createAnswer() { return { type: 'answer', sdp: 'host SDP' }; }
  setLocalDescription(description) {
    this.localDescription = description;
    // The first link never finishes its local SDP operation.
    return connections[0] === this ? new Promise(() => {}) : Promise.resolve();
  }
  async addIceCandidate() {}
  close() {}
}
const memory = new Map();
const box = { URL, URLSearchParams, setTimeout, clearTimeout, performance, crypto: webcrypto,
  AbortSignal, AbortController,
  localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) },
  RTCPeerConnection: Peer,
  location: { search: '', href: 'http://localhost/' },
  NEON: { Game: { settings: { skill: 'medium' } } },
  fetch: async (_url, options) => {
    const request = options?.body ? JSON.parse(options.body) : { action: 'status' };
    let body = { ok: true };
    if (request.action === 'status') {body = { enabled: true, protocol: 2, iceServers: [{ urls: 'stun:localhost' }] };}
    if (request.action === 'host') {body = { ok: true, code: 'ABCDE' };}
    if (request.action === 'poll') {body = { ok: true, protocol: 2, peers: guests };}
    return { ok: true, json: async () => body };
  }
};
box.window = box;
vm.createContext(box);
for (const name of ['coop-host', 'net']) {vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), box);}
const Net = box.NEON.Net;
Net.onMessage = (message, id) => received.push({ message, id });
(async () => {
  try {
    assert.equal(Net.host({}), true);
    for (let attempt = 0; connections.length < 3 && attempt < 100; attempt++) {await delay(10);}
    assert.equal(connections.length, 3, 'a hung first negotiation does not block other introductions');
    const channels = connections.map((connection, index) => {
      const channel = { readyState: 'open', sent: [], send(data) { this.sent.push(JSON.parse(data)); }, close() {} };
      connection.ondatachannel({ channel });
      channel.onopen();
      channel.onmessage({ data: JSON.stringify({ t: 'state', _s: 1, claimedId: 'somebody-else' }) });
      assert.equal(received.at(-1).id, 'guest' + (index + 1), 'sender identity comes from the channel');
      return channel;
    });
    assert.equal(Net.peers.size, 3);
    Net.send({ t: 'xp', amount: 7 }, 'guest2');
    assert.deepEqual(channels.map(channel => channel.sent.filter(message => message.t === 'xp').length), [0, 1, 0]);
    Net.send({ t: 'world' });
    assert.deepEqual(channels.map(channel => channel.sent.filter(message => message.t === 'world').length), [1, 1, 1]);
    channels[0].onmessage({ data: JSON.stringify({ t: 'state', _s: 1 }) });
    assert.equal(received.filter(item => item.message.t === 'state').length, 3, 'duplicate sequence is local to one channel');
    console.log('Star transport: independent negotiation, channel identity, targeted sends, broadcasts, and per-link duplicate rejection passed.');
  } finally { Net.leave(true); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Drives the shipped introduction session. Hung fetches and response bodies
// ignore abort on purpose: a late settlement must not reach the new session.
function createIntroSession() {
  const counts = { status: 0, host: 0, join: 0, poll: 0, leave: 0, roster: 0, card: 0 };
  const errors = [];
  const connections = [];
  const hung = [];
  const peers = [];
  const control = { mode: 'open', roster: null };
  class Peer {
    constructor() { connections.push(this); }
    createDataChannel() { return { readyState: 'connecting', send() {}, close() {} }; }
    async createOffer() { return { type: 'offer', sdp: 'offer' }; }
    async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
    async setLocalDescription(description) { this.localDescription = description; }
    async setRemoteDescription(description) { this.remoteDescription = description; }
    async addIceCandidate() {}
    close() {}
  }
  function requestOf(url, options) {
    if (options && options.body) {return JSON.parse(options.body);}
    return { action: new URL(url, 'http://localhost/').searchParams.get('action') || 'status' };
  }
  function payloadFor(request) {
    if (request.action === 'status') {return { enabled: true, protocol: 2, iceServers: [{ urls: 'stun:localhost' }] };}
    if (request.action === 'host') {return { ok: true, code: 'ABCDE' };}
    if (request.action === 'join') {return { ok: true, code: request.code, seat: 1, hostId: 'host-1' };}
    if (request.action === 'poll') {return { ok: true, protocol: 2, peers: peers.slice() };}
    return { ok: true };
  }
  function hold(action, kind, resolve) {
    hung.push({ action, kind, release: resolve });
  }
  const memory = new Map();
  const box = { URL, URLSearchParams, setTimeout, clearTimeout, performance, crypto: webcrypto,
    AbortSignal, AbortController,
    localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) },
    RTCPeerConnection: Peer,
    location: { search: '', href: 'http://localhost/' },
    NEON: { Game: { settings: { skill: 'medium' } } },
    fetch(url, options) {
      const request = requestOf(url, options);
      const action = request.action || 'status';
      counts[action] = (counts[action] || 0) + 1;
      const payload = payloadFor(request);
      if (action === 'roster' && control.roster) {
        return control.roster(request.roster, (kind, resolve) => hold(action, kind, resolve));
      }
      if (control.mode === 'status-body' && action === 'status') {
        return Promise.resolve({ ok: true, json: () => new Promise(resolve => hold(action, 'body', resolve)) });
      }
      if ((control.mode === 'host-fetch' && action === 'host') || (control.mode === 'join-fetch' && action === 'join') || (control.mode === 'poll-fetch' && action === 'poll')) {
        return new Promise(resolve => hold(action, 'fetch', body => resolve({ ok: true, json: async () => body })));
      }
      if (control.mode === 'poll-body' && action === 'poll') {
        return Promise.resolve({ ok: true, json: () => new Promise(resolve => hold(action, 'body', resolve)) });
      }
      return Promise.resolve({ ok: true, json: async () => payload });
    }
  };
  box.window = box;
  vm.createContext(box);
  for (const name of ['coop-host', 'net']) {vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), box);}
  const Net = box.NEON.Net;
  Net.onError = message => errors.push(message);
  return { Net, counts, errors, connections, hung, peers, control };
}

async function waitUntil(predicate, timeout, label) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) {throw new Error(label || 'timed out');}
    await delay(20);
  }
}

function openGuestChannel(session) {
  const channel = { readyState: 'open', send() {}, close() {} };
  session.connections[0].ondatachannel({ channel });
  channel.onopen();
}

async function stalledPoll(kind) {
  const session = createIntroSession();
  const withPeer = kind === 'body';
  if (withPeer) {
    session.peers.push({ clientId: 'guest1', seat: 1, card: { protocol: 2, rev: 1, session: 'offer1', clientId: 'guest1',
      sdp: { type: 'offer', sdp: 'guest SDP' }, candidates: [], profile: {} } });
  } else {session.control.mode = 'poll-fetch';}
  const pollsBeforeHost = session.counts.poll;
  assert.equal(session.Net.host({}), true, kind + ' host starts');
  await waitUntil(() => session.Net.code === 'ABCDE', 3000, kind + ' host code');
  if (withPeer) {
    await waitUntil(() => session.connections.length >= 1, 3000, kind + ' connection');
    openGuestChannel(session);
    assert.equal(session.Net.peers.size, 1, kind + ' peer online before the stall');
    session.control.mode = 'poll-body';
  }
  const seen = withPeer ? session.counts.poll : pollsBeforeHost;
  await waitUntil(() => session.counts.poll > seen, 3000, kind + ' stalled poll');
  const started = Date.now();
  const inflight = session.counts.poll;
  await waitUntil(() => session.counts.poll > inflight, 12000, kind + ' poll was not retried');
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 7000 && elapsed <= 12000, kind + ' poll retry at ' + elapsed + 'ms');
  assert.equal(session.counts.poll, inflight + 1, kind + ' retry is a single poll');
  assert.equal(session.Net.role, 'host');
  assert.equal(session.Net.code, 'ABCDE');
  assert.equal(session.Net.state, withPeer ? 'connected' : 'waiting');
  assert.deepEqual(session.errors, []);
  if (withPeer) {assert.equal(session.Net.peers.size, 1, 'a timed-out poll keeps the live peer');}
  await delay(700);
  assert.equal(session.counts.poll, inflight + 1, kind + ' housekeeping overlapped the in-flight retry');
  const stale = session.hung.splice(0, session.hung.length);
  assert.ok(stale.length >= 1, kind + ' stalled request is still unsettled');
  session.Net.leave(true);
  assert.equal(session.Net.role, 'solo');
  const polls = session.counts.poll;
  const rehost = Date.now();
  assert.equal(session.Net.host({}), true, kind + ' rehost');
  await waitUntil(() => session.counts.poll > polls, 3000, kind + ' leave did not allow a new poll');
  assert.ok(Date.now() - rehost < 3000, kind + ' new poll waited for the old timeout');
  const next = session.counts.poll;
  for (const entry of stale) {entry.release({ ok: false, protocol: 1, peers: [{ clientId: 'intruder', seat: 9 }] });}
  await delay(700);
  assert.equal(session.counts.poll, next, kind + ' obsolete poll started another request');
  assert.equal(session.Net.role, 'host');
  assert.equal(session.Net.code, 'ABCDE');
  assert.equal(session.Net.state, 'waiting');
  assert.deepEqual(session.errors, []);
  session.Net.leave(true);
}

async function stalledIntroduction(action) {
  const session = createIntroSession();
  session.control.mode = action === 'status' ? 'status-body' : action + '-fetch';
  const started = Date.now();
  const began = action === 'join' ? session.Net.join('ABCD', {}) : session.Net.host({});
  assert.equal(began, true, action + ' attempt starts');
  const expected = action === 'status' ? 'CO-OP IS UNAVAILABLE OR NEEDS AN UPDATE' : 'INTRODUCTION UNAVAILABLE';
  await waitUntil(() => session.errors.length === 1, 12000, action + ' stall did not finish');
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 7000 && elapsed <= 12000, action + ' finished at ' + elapsed + 'ms');
  assert.deepEqual(session.errors, [expected]);
  assert.equal(session.Net.role, 'solo');
  assert.equal(session.Net.state, 'error');
  assert.equal(session.Net.code, '');
  session.control.mode = 'open';
  const retry = Date.now();
  const again = action === 'join' ? session.Net.join('ABCD', {}) : session.Net.host({});
  assert.equal(again, true, action + ' retry starts');
  const role = action === 'join' ? 'guest' : 'host';
  await waitUntil(() => session.Net.role === role && session.counts.poll >= 1, 3000, action + ' retry did not poll');
  assert.ok(Date.now() - retry < 3000, action + ' retry was still bounded by the old stall');
  assert.equal(session.Net.code, action === 'join' ? 'ABCD' : 'ABCDE');
  if (action === 'join') {assert.equal(session.Net.seat, 1);}
  assert.deepEqual(session.errors, [expected]);
  session.Net.leave(true);
}

async function rosterRecovery() {
  const session = createIntroSession();
  const { Net, control, counts, hung, errors } = session;
  const launches = [];
  let lobby;
  Net.onMessage = message => {
    if (message.t === 'lobby_state') {lobby = message;}
    if (message.t === 'launch') {launches.push(message.runId);}
  };
  const ready = () => Net.sendControl({ t: 'lobby_ready', revision: lobby.revision });
  const ok = () => Promise.resolve({ json: async () => ({ ok: true }) });
  try {
    control.roster = (roster, hold) => Promise.resolve({ json: () => new Promise(resolve => hold('body', resolve)) });
    Net.host({});
    await waitUntil(() => hung.length === 1, 3000, 'initial unlock did not start');
    control.roster = ok;
    await waitUntil(() => counts.roster === 2, 12000, 'initial unlock was not retried');

    control.roster = (roster, hold) => new Promise(resolve => hold('fetch', resolve));
    ready();
    await waitUntil(() => hung.length === 2, 5000, 'launch lock did not start');
    assert.deepEqual(launches, []);
    control.roster = ok;
    await waitUntil(() => launches.length === 1, 12000, 'launch lock did not recover');
    for (const entry of hung.splice(0)) {
      entry.release(entry.kind === 'body' ? { ok: false } : { json: async () => ({ ok: false }) });
    }
    Net.sendControl({ t: 'return_lobby', runId: lobby.runId });
    control.roster = roster => roster === null ? ok() : Promise.resolve({ json: async () => ({ ok: false }) });
    ready();
    await waitUntil(() => errors.length === 1, 5000, 'rejected lock did not report failure');
    assert.equal(lobby.phase, 'lobby');
    assert.equal(lobby.ready.length, 0);
    assert.deepEqual(launches, [1]);
    assert.match(errors[0], /READY AGAIN/);

    control.roster = ok;
    ready();
    await waitUntil(() => launches.length === 2, 5000, 'same room did not launch after a rejected lock');
    assert.deepEqual(launches, [1, 3]);
    const beforeUnlock = counts.roster;
    Net.sendControl({ t: 'return_lobby', runId: lobby.runId });
    assert.equal(lobby.phase, 'lobby');
    await waitUntil(() => counts.roster > beforeUnlock, 3000, 'did not send subsequent unlock');
    control.roster = (roster, hold) => new Promise(resolve => hold('fetch', resolve));
    ready();
    await waitUntil(() => hung.length === 1, 5000, 'next lock did not start');
    Net.leave(true);
    control.roster = ok;
    const before = counts.roster;
    Net.host({});
    await waitUntil(() => counts.roster > before, 3000, 'new session did not synchronize');
    hung.pop().release({ json: async () => ({ ok: true }) });
    ready();
    await waitUntil(() => launches.length === 3, 5000, 'new session did not launch');
    assert.deepEqual(launches, [1, 3, 1]);
    assert.equal(errors.length, 1);
  } finally {
    Net.leave(true);
  }
}

(async () => {
  try {
    await Promise.all([
      stalledPoll('body'),
      stalledPoll('fetch'),
      stalledIntroduction('status'),
      stalledIntroduction('host'),
      stalledIntroduction('join'),
      rosterRecovery()
    ]);
    console.log('Introduction stalls: poll retry, live peer, leave/rehost, late completion, and bounded status/host/join passed.');
    console.log('Roster recovery: initial unlock and launch timeouts, rejected lock rollback, and stale session completion passed.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
