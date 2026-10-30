/* NEON NEXUS — minimal two-player signaling server.
 *
 * The server owns room codes, relay/filtering of WebRTC signaling, and an
 * optional gameplay-message relay. It never simulates or stores game state.
 */
'use strict';

const http = require('node:http');
const { WebSocketServer, WebSocket } = require('ws');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_MESSAGES_PER_SECOND = 120;
const MAX_PAYLOAD_BYTES = 32768;
const ROOM_TTL_MS = 5 * 60 * 1000;
const PEER_GRACE_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 1000;

function allocateCode(rooms) {
  for (let attempt = 0; attempt < 24; attempt++) {
    let code = '';
    for (let index = 0; index < CODE_LENGTH; index++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to allocate a room code');
}

function cleanClientId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
}

function cleanProfile(value) {
  const profile = value && typeof value === 'object' ? value : {};
  return {
    name: String(profile.name || '').slice(0, 20),
    shipType: String(profile.shipType || 'dart').slice(0, 16),
    shipColor: String(profile.shipColor || '#00f0ff').slice(0, 16)
  };
}

function publicPeer(client) {
  if (!client) return null;
  return { clientId: client.clientId, profile: client.profile };
}

function createCoopServer(options = {}) {
  const rooms = new Map();
  const ownsHttpServer = !options.server;
  const httpServer = options.server || http.createServer((request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end('NEON NEXUS co-op signal server\n');
  });
  const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_PAYLOAD_BYTES });

  function send(client, message) {
    if (client && client.socket && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  function peerOf(client) {
    if (!client || !client.room) return null;
    return client.role === 'host' ? client.room.guest : client.room.host;
  }

  function touch(room) {
    room.updatedAt = Date.now();
  }

  function open(client) {
    return !!(client && client.socket && client.socket.readyState === WebSocket.OPEN);
  }

  function notifyPeerLeft(client, room) {
    const peer = peerOf(client) || (client.role === 'host' ? room.guest : room.host);
    if (open(peer)) send(peer, { t: 'peer-left' });
  }

  function attach(client, room, role) {
    client.room = room;
    client.role = role;
    if (role === 'host') room.host = client;
    else room.guest = client;
    touch(room);
  }

  function hostRoom(client, message) {
    const clientId = cleanClientId(message.clientId);
    if (!clientId) return;
    client.clientId = clientId;
    client.profile = cleanProfile(message.profile);

    let room = null;
    const requested = String(message.code || '').toUpperCase();
    if (requested) {
      const existing = rooms.get(requested);
      if (existing && existing.host && existing.host.clientId === clientId) room = existing;
    }
    if (!room) {
      room = {
        code: allocateCode(rooms),
        host: null,
        guest: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      rooms.set(room.code, room);
    }

    attach(client, room, 'host');
    send(client, { t: 'hosted', code: room.code });

    if (open(room.guest)) {
      send(client, { t: 'peer', peer: publicPeer(room.guest) });
      send(room.guest, { t: 'peer', peer: publicPeer(client) });
    }
  }

  function joinRoom(client, message) {
    const code = String(message.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      send(client, { t: 'notfound' });
      return;
    }
    const clientId = cleanClientId(message.clientId);
    if (!clientId) return;
    client.clientId = clientId;
    client.profile = cleanProfile(message.profile);

    if (room.guest) {
      const sameGuest = room.guest.clientId === clientId;
      if (!sameGuest || open(room.guest)) {
        send(client, { t: 'full' });
        return;
      }
    }
    if (!room.host) {
      send(client, { t: 'notfound' });
      return;
    }

    attach(client, room, 'guest');
    send(client, {
      t: 'joined',
      code: room.code,
      host: publicPeer(room.host),
      peer: publicPeer(client),
      self: clientId
    });
    if (open(room.host)) send(room.host, { t: 'peer', peer: publicPeer(client) });
  }

  function forward(client, message) {
    const peer = peerOf(client);
    if (!open(peer) || message.data == null) return;
    touch(client.room);
    send(peer, { t: message.t, from: client.clientId, data: message.data });
  }

  function leave(client, explicit) {
    const room = client.room;
    if (!room) return;
    const wasHost = client.role === 'host';
    if (explicit) notifyPeerLeft(client, room);
    if (wasHost) {
      rooms.delete(room.code);
      if (room.guest) {
        room.guest.room = null;
        room.guest.role = null;
      }
    } else {
      room.guest = null;
      touch(room);
    }
    client.room = null;
    client.role = null;
  }

  function handle(client, message) {
    switch (message.t) {
      case 'host': hostRoom(client, message); break;
      case 'join': joinRoom(client, message); break;
      case 'signal':
      case 'relay': forward(client, message); break;
      case 'leave': leave(client, true); break;
      case 'ping': send(client, { t: 'pong' }); break;
      default: break;
    }
  }

  function onClose(client) {
    const room = client.room;
    if (!room) return;
    client.socket = null;
    notifyPeerLeft(client, room);
    touch(room);
  }

  wss.on('connection', (socket) => {
    const client = {
      socket,
      clientId: null,
      profile: null,
      room: null,
      role: null,
      windowStart: Date.now(),
      messages: 0
    };
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (raw) => {
      const now = Date.now();
      if (now - client.windowStart >= 1000) {
        client.windowStart = now;
        client.messages = 0;
      }
      client.messages++;
      if (client.messages > MAX_MESSAGES_PER_SECOND) {
        send(client, { t: 'error', message: 'RATE LIMIT' });
        socket.close(1008, 'rate limit');
        return;
      }
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (message && typeof message === 'object') handle(client, message);
    });
    socket.on('close', () => onClose(client));
    socket.on('error', () => {});
  });

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      const hostDown = !open(room.host);
      const guestDown = !room.guest || !open(room.guest);
      if (hostDown && now - room.updatedAt > PEER_GRACE_MS) {
        rooms.delete(code);
        if (open(room.guest)) send(room.guest, { t: 'peer-left' });
        if (room.guest) {
          room.guest.room = null;
          room.guest.role = null;
        }
        continue;
      }
      if (room.guest && guestDown && now - room.updatedAt > PEER_GRACE_MS) {
        if (open(room.host)) send(room.host, { t: 'peer-left' });
        room.guest = null;
        touch(room);
      }
      if (now - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
        for (const member of [room.host, room.guest]) {
          if (open(member)) send(member, { t: 'peer-left' });
          if (member) {
            member.room = null;
            member.role = null;
          }
        }
      }
    }
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();

  function listen(port = 8787, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, host, () => {
        httpServer.off('error', reject);
        resolve(httpServer.address());
      });
    });
  }

  function close() {
    clearInterval(sweeper);
    for (const socket of wss.clients) socket.terminate();
    wss.close();
    if (ownsHttpServer && httpServer.listening) httpServer.close();
  }

  return { httpServer, wss, rooms, listen, close };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || '0.0.0.0';
  const server = createCoopServer();
  server.listen(port, host).then((address) => {
    console.log('NEON NEXUS co-op signal server listening on ws://' + address.address + ':' + address.port);
    console.log('Share the game URL with ?signal=ws://<this-host>:' + address.port + ' if needed.');
  }).catch((error) => {
    console.error('Failed to start co-op signal server:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createCoopServer };
