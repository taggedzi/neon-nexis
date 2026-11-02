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
  localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) },
  RTCPeerConnection: Peer,
  location: { search: '', href: 'http://localhost/' },
  NEON: { Game: { settings: { skill: 'medium' } } },
  fetch: async (_url, options) => {
    const request = options?.body ? JSON.parse(options.body) : { action: 'status' };
    let body = { ok: true };
    if (request.action === 'status') body = { enabled: true, protocol: 2, iceServers: [{ urls: 'stun:localhost' }] };
    if (request.action === 'host') body = { ok: true, code: 'ABCDE' };
    if (request.action === 'poll') body = { ok: true, protocol: 2, peers: guests };
    return { ok: true, json: async () => body };
  }
};
box.window = box;
vm.createContext(box);
for (const name of ['coop-host', 'net']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), box);
const Net = box.NEON.Net;
Net.onMessage = (message, id) => received.push({ message, id });
(async () => {
  try {
    assert.equal(Net.host({}), true);
    for (let attempt = 0; connections.length < 3 && attempt < 100; attempt++) await delay(10);
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
