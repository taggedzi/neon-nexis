/* Host-centered WebRTC transport. PHP exchanges per-seat introduction cards only. */
(function () {
  'use strict';
  const N = window.NEON;
  const Net = N.Net = {};
  const PROTOCOL = 2;
  const ROOM_CONTROL = new Set(['lobby_state', 'launch', 'global_pause', 'ready_state', 'countdown_start', 'global_resume']);
  Object.assign(Net, { state: 'idle', role: 'solo', code: '', peer: null, peerId: null,
    peers: new Map(), seat: 0, transport: 'none', iceServers: [], available: false, statusKnown: false });
  const links = new Map();
  const clientId = Net.clientId = makeClientId();
  let intent = null;
  let authority = null;
  let pollTimer = null;
  let generation = 0;
  let polling = false;
  let rosterPromise = Promise.resolve();
  let rosterKey = '';

  function makeClientId() {
    const key = 'neon-coop-identity-v1';
    try {
      const saved = localStorage.getItem(key);
      if (/^nn_[a-f0-9]{32}$/.test(saved || '')) { Net.identityPersistent = true; return saved; }
    } catch (error) { /* Storage may be unavailable; this session still works. */ }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const id = 'nn_' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    Net.identityPersistent = false;
    try { localStorage.setItem(key, id); Net.identityPersistent = localStorage.getItem(key) === id; } catch (error) { /* Recovery is unavailable without storage. */ }
    return id;
  }


  function normalizeProfile(profile) {
    return {
      name: String(profile?.name || 'PLAYER').slice(0, 20),
      shipType: String(profile?.shipType || 'dart').slice(0, 16),
      shipColor: String(profile?.shipColor || '#00f0ff').slice(0, 16),
      loadout: profile?.loadout && N.Loadouts?.validateShip(profile.loadout) ? N.deepClone(profile.loadout) : null,
      loadoutInvalid: !!profile?.loadout && !N.Loadouts?.validateShip(profile.loadout)
    };
  }

  Net.introUrl = function () {
    return new URLSearchParams(window.location.search).get('intro') || new URL('php/coop.php', window.location.href).href;
  };

  function status(state, detail = '') {
    Net.state = state;
    Net.transport = Array.from(links.values()).some(link => link.online) ? 'p2p' : 'none';
    Net.onStatus?.({ state, role: Net.role, code: Net.code, peer: Net.peer, transport: Net.transport, detail });
  }

  function post(body) {
    return fetch(Net.introUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, protocol: PROTOCOL, ...body }), cache: 'no-store' })
      .then(response => response.json());
  }

  Net.refreshStatus = async function () {
    try {
      const url = Net.introUrl();
      const response = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=status&clientId=' + encodeURIComponent(clientId), { cache: 'no-store' });
      const body = await response.json();
      Net.available = response.ok && body.enabled === true && body.protocol === PROTOCOL && Array.isArray(body.iceServers) && body.iceServers.length > 0;
      Net.iceServers = Net.available ? body.iceServers : [];
    } catch (error) {
      Net.available = false;
      Net.iceServers = [];
    }
    Net.statusKnown = true;
    Net.onAvailability?.({ available: Net.available });
    return Net.available;
  };

  function refreshPeers(link, online) {
    const previous = Net.peers.get(link.id);
    if (online) Net.peers.set(link.id, { clientId: link.id, seat: link.seat, profile: link.card?.profile });
    else Net.peers.delete(link.id);
    Net.peer = Net.peers.values().next().value || null;
    Net.peerId = Net.peer?.clientId || null;
    // The second argument identifies the changed seat, including departures.
    if (previous || online || link.registered) Net.onPeer?.(online ? Net.peers.get(link.id) : null, link.id);
    link.registered = online;
    status(Net.peers.size ? 'connected' : Net.role === 'host' ? 'waiting' : 'connecting');
  }

  function closeConnection(link) {
    if (link.cardTimer) clearTimeout(link.cardTimer);
    link.cardTimer = null;
    if (link.channel) {
      link.channel.onopen = link.channel.onclose = link.channel.onmessage = null;
      try { link.channel.close(); } catch (error) { /* Already closed. */ }
    }
    if (link.connection) {
      link.connection.onicecandidate = link.connection.onconnectionstatechange = link.connection.ondatachannel = null;
      try { link.connection.close(); } catch (error) { /* Already closed. */ }
    }
    link.channel = link.connection = null;
    link.candidates = [];
    link.appliedCandidates = 0;
  }

  function removeLink(id) {
    const link = links.get(id);
    if (!link) return;
    closeConnection(link);
    links.delete(id);
    refreshPeers(link, false);
  }

  function fail(message) {
    Net.leave(true);
    Net.onError?.(message);
    // Session cleanup can emit idle; keep the final actionable error visible.
    status('error', message);
  }

  function makeLink(id, seat) {
    const link = { id, seat, connection: null, channel: null, candidates: [], appliedCandidates: 0,
      session: '', card: null, revision: 0, cardTimer: null, online: false,
      sendSequence: 0, receiveSequence: 0, retryAt: 0 };
    links.set(id, link);
    return link;
  }

  function lost(link) {
    if (!intent || links.get(link.id) !== link) return;
    link.online = false;
    Net.peers.delete(link.id);
    Net.peer = Net.peers.values().next().value || null;
    Net.peerId = Net.peer?.clientId || null;
    link.retryAt = performance.now() + 1500;
    if (authority) authority.markOffline(link.id);
    // Keep the host mirror until the authority's offline grace expires.
    if (Net.role === 'guest') status('connecting', 'DIRECT LINK LOST // REINTRODUCING');
    else status(Net.peers.size > 0 ? 'connected' : 'waiting', 'DIRECT LINK LOST // REINTRODUCING');
  }

  function publishCard(link) {
    if (link.cardTimer || !link.connection?.localDescription || !intent) return;
    const currentGeneration = generation;
    link.cardTimer = setTimeout(() => {
      link.cardTimer = null;
      if (generation !== currentGeneration || !link.connection?.localDescription) return;
      const description = link.connection.localDescription;
      post({ action: 'card', code: Net.code, targetId: link.id,
        card: { session: link.session, sdp: { type: description.type, sdp: description.sdp },
          candidates: link.candidates.slice(), profile: intent.profile } }).catch(() => {});
    }, 40);
  }

  function attachChannel(link, channel) {
    link.channel = channel;
    link.receiveSequence = 0;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      if (!intent || link.channel !== channel) return;
      if (authority && !authority.setGuest(link.id, link.card?.profile, link.seat)) {
        removeLink(link.id);
        return;
      }
      link.online = true;
      refreshPeers(link, true);
      if (Net.role === 'guest') Net.sendControl({ t: 'lobby_profile', profile: intent.profile });
      Net.onSocketOpen?.(link.id);
    };
    channel.onclose = () => { if (link.channel === channel) lost(link); };
    channel.onmessage = event => {
      if (link.channel !== channel || !intent) return;
      let message;
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) : N.Wire.decode(event.data);
      } catch (error) { return; }
      if (!message || typeof message !== 'object') return;
      if (message.versionMismatch) { fail('INCOMPATIBLE CO-OP VERSION // UPDATE ALL CLIENTS'); return; }
      if (message.t === 'ctrl') {
        if (authority) authority.handle(link.id, message.body);
        return;
      }
      if (message.t === 'peer-left') {
        if (Net.role === 'guest') fail('HOST LEFT // LOBBY CLOSED');
        return;
      }
      if (ROOM_CONTROL.has(message.t)) {
        if (Net.role === 'guest') Net.onMessage?.(message, link.id);
        return;
      }
      if (typeof message._s === 'number') {
        if (message._s <= link.receiveSequence) return;
        link.receiveSequence = message._s;
      }
      Net.onMessage?.(message, link.id);
    };
  }

  function connectionFor(link) {
    const connection = new RTCPeerConnection({ iceServers: Net.iceServers });
    link.connection = connection;
    connection.onicecandidate = event => {
      if (link.connection !== connection) return;
      if (event.candidate) link.candidates.push(event.candidate.toJSON());
      publishCard(link);
    };
    connection.onconnectionstatechange = () => {
      if (link.connection === connection && connection.connectionState === 'failed') lost(link);
    };
    connection.ondatachannel = event => {
      if (link.connection === connection) attachChannel(link, event.channel);
    };
    return connection;
  }

  function syncCandidates(link) {
    if (!link.connection?.remoteDescription || !Array.isArray(link.card?.candidates)) return;
    for (const candidate of link.card.candidates.slice(link.appliedCandidates)) {
      link.connection.addIceCandidate(candidate).catch(() => {});
    }
    link.appliedCandidates = link.card.candidates.length;
  }

  async function offer(link) {
    closeConnection(link);
    link.session = crypto.randomUUID().replace(/-/g, '');
    const connection = connectionFor(link);
    attachChannel(link, connection.createDataChannel('game', { ordered: true }));
    try {
      const description = await connection.createOffer();
      if (link.connection !== connection) return;
      await connection.setLocalDescription(description);
      if (link.connection === connection) publishCard(link);
    } catch (error) { if (link.connection === connection) lost(link); }
  }

  async function applyCard(link, card) {
    if (!card || card.protocol !== PROTOCOL) return;
    const changed = !link.card || card.session !== link.card.session;
    // A second browser using the same stored identity cannot replace a live ship.
    // A real reconnect waits until the existing channel reports its loss.
    if (Net.role === 'host' && changed && link.online) return;
    link.card = card;
    link.revision = card.rev;
    if (!changed) { syncCandidates(link); return; }
    if (Net.role === 'host' && card.sdp?.type === 'offer') {
      if (link.online) authority.markOffline(link.id);
      link.online = false;
      closeConnection(link);
      link.session = card.session;
      authority.holdOfflineGrace(link.id);
      const connection = connectionFor(link);
      try {
        await connection.setRemoteDescription(card.sdp);
        if (link.connection !== connection) return;
        syncCandidates(link);
        const answer = await connection.createAnswer();
        if (link.connection !== connection) return;
        await connection.setLocalDescription(answer);
        if (link.connection === connection) publishCard(link);
      } catch (error) { if (link.connection === connection) lost(link); }
    } else if (Net.role === 'guest' && card.sdp?.type === 'answer' && card.session === link.session) {
      const connection = link.connection;
      try {
        await connection.setRemoteDescription(card.sdp);
        if (link.connection === connection) syncCandidates(link);
      } catch (error) { /* A newer offer will retry. */ }
    }
  }

  function synchronizeRoster(message) {
    if (message.t !== 'lobby_state') return;
    const roster = message.phase === 'run' ? Object.fromEntries(Array.from(authority.room.roster).filter(([id]) => id !== clientId)) : null;
    const key = JSON.stringify(roster);
    if (key === rosterKey) return;
    rosterKey = key;
    const code = Net.code;
    rosterPromise = rosterPromise.then(() => post({ action: 'roster', code, roster })).then(body => {
      if (!body.ok) throw new Error('Roster lock failed');
    });
    rosterPromise.catch(() => { if (intent && Net.code === code) fail('LOBBY ROSTER UPDATE FAILED'); });
  }

  function deliverRoom(member, message) {
    synchronizeRoster(message);
    const currentGeneration = generation;
    const deliver = () => {
      if (!intent || generation !== currentGeneration) return;
      if (member.clientId === clientId) Net.onMessage?.(message, clientId);
      else {
        const channel = links.get(member.clientId)?.channel;
        if (channel?.readyState === 'open') {
          try { channel.send(JSON.stringify(message)); } catch (error) { /* Reconnect resynchronizes. */ }
        }
      }
    };
    if (message.t === 'launch') rosterPromise.then(deliver).catch(() => {});
    else deliver();
  }

  async function poll() {
    if (!intent || polling) return;
    polling = true;
    const currentGeneration = generation;
    try {
      const sinceRev = Object.fromEntries(Array.from(links, ([id, link]) => [id, link.revision]));
      const body = await post({ action: 'poll', code: Net.code, sinceRev });
      if (generation !== currentGeneration || !intent) return;
      if (!body.ok || body.protocol !== PROTOCOL) {
        fail(body.error === 'locked' ? 'MATCH STARTED // ROSTER LOCKED' : 'LOBBY CLOSED OR INCOMPATIBLE');
        return;
      }
      const present = new Set(body.peers.map(peer => peer.clientId));
      for (const id of links.keys()) {
        if (!present.has(id)) {
          if (authority) authority.clearGuest(id);
          removeLink(id);
        }
      }
      for (const peer of body.peers) {
        const link = links.get(peer.clientId) || makeLink(peer.clientId, peer.seat);
        if (peer.card) {
          // Negotiation belongs to this link; a slow ICE/SDP operation must not
          // prevent the host polling and introducing the other two guests.
          applyCard(link, peer.card).catch(() => lost(link));
        }
        if (Net.role === 'guest' && !link.online && (!link.connection || performance.now() >= link.retryAt && link.retryAt > 0)) {
          link.retryAt = 0;
          offer(link);
        }
      }
    } catch (error) { /* Introduction polls retry without discarding the live room. */ }
    finally { polling = false; }
  }

  function housekeeping() {
    if (!intent) return;
    poll();
    pollTimer = setTimeout(housekeeping, 500);
  }

  function begin(role, code, profile) {
    if (intent) return false;
    const currentGeneration = ++generation;
    intent = { role, profile: normalizeProfile(profile) };
    Net.role = role;
    Net.code = code;
    Net.seat = 0;
    rosterKey = '';
    rosterPromise = Promise.resolve();
    status('connecting');
    Net.refreshStatus().then(async available => {
      if (generation !== currentGeneration) return;
      if (!available) { fail('CO-OP IS UNAVAILABLE OR NEEDS AN UPDATE'); return; }
      const body = await post({ action: role === 'host' ? 'host' : 'join', code });
      if (generation !== currentGeneration) return;
      if (!body.ok) {
        const errors = { full: 'ROOM IS FULL', locked: 'MATCH STARTED // ROSTER LOCKED', version: 'INCOMPATIBLE CO-OP VERSION // UPDATE ALL CLIENTS' };
        fail(errors[body.error] || 'JOIN CODE NOT FOUND');
        return;
      }
      Net.code = body.code;
      if (role === 'host') {
        authority = N.CoopHost.createAuthority();
        authority.setDeliver(deliverRoom);
        authority.setOnGuestCleared(id => removeLink(id));
        authority.setHost(clientId, intent.profile);
        authority.handle(clientId, { t: 'lobby_skill', skill: N.Game.settings.skill });
        status('waiting', 'ROOM OPEN // SHARE THE CODE');
      } else {
        Net.seat = body.seat;
        const link = makeLink(body.hostId, 0);
        offer(link);
      }
      housekeeping();
    }).catch(() => { if (generation === currentGeneration) fail('INTRODUCTION UNAVAILABLE'); });
    return true;
  }

  Net.host = profile => begin('host', '', profile);
  Net.join = function (code, profile) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length < 4) { fail('JOIN CODE MUST BE 4-6 CHARACTERS'); return false; }
    return begin('guest', clean, profile);
  };

  Net.send = function (message, targetId) {
    if (!message || typeof message !== 'object') return false;
    let sent = false;
    for (const link of links.values()) {
      if (targetId && link.id !== targetId || link.channel?.readyState !== 'open') continue;
      const outgoing = { ...message };
      N.Coop?.stampMessage?.(outgoing, link.id);
      outgoing._s = ++link.sendSequence;
      const encoded = N.Wire?.encode(outgoing);
      try { link.channel.send(encoded || JSON.stringify(outgoing)); sent = true; }
      catch (error) { /* Session acknowledgements retry targeted events. */ }
    }
    return sent;
  };

  Net.sendControl = function (message) {
    if (!message || typeof message !== 'object') return false;
    if (message.t === 'lobby_profile' && intent) intent.profile = normalizeProfile(message.profile);
    if (N.Coop && ['pause_request', 'ready_signal', 'pause_sync'].includes(message.t)) {
      message.runId = N.Coop.runId;
      message.epoch = N.Coop.pauseEpoch || 0;
    }
    if (authority) { authority.handle(clientId, message); return true; }
    const link = links.values().next().value;
    if (link?.channel?.readyState !== 'open') return false;
    try { link.channel.send(JSON.stringify({ t: 'ctrl', body: message })); return true; }
    catch (error) { return false; }
  };

  Net.leave = function (silent) {
    if (!silent) Net.send({ t: 'bye' });
    if (Net.role === 'guest') Net.sendControl({ t: 'leave' });
    if (Net.role === 'host') {
      for (const link of links.values()) {
        try { if (link.channel?.readyState === 'open') link.channel.send(JSON.stringify({ t: 'peer-left' })); }
        catch (error) { /* Guests also observe the removed introduction row. */ }
      }
    }
    if (Net.code) post({ action: 'leave', code: Net.code }).catch(() => {});
    generation++;
    intent = null;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    authority?.close();
    authority = null;
    for (const link of links.values()) closeConnection(link);
    links.clear();
    Net.peers.clear();
    Net.peer = Net.peerId = null;
    Net.role = 'solo';
    Net.code = '';
    Net.seat = 0;
    status('idle', 'CO-OP LINK CLOSED');
  };

  Net.reconnect = function () {
    if (!intent || Net.role !== 'guest') return false;
    const link = links.values().next().value;
    if (!link) return false;
    link.online = false;
    offer(link);
    return true;
  };
  Net.label = () => Net.transport === 'p2p' ? 'P2P' : 'OFFLINE';
  Net.refreshStatus();
})();
