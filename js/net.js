/* NEON NEXUS — co-op client transport.
 *
 * Single-player never calls host()/join(). PHP introduces the two browsers.
 * Gameplay and room control travel on the WebRTC data channel only. There is
 * no gameplay relay: a direct link that never opens stays on the connecting
 * screen, and a dropped link is introduced again through PHP.
 */
(function () {
  'use strict';

  const N = window.NEON;
  const Net = N.Net = {};

  const POLL_MS = 500;
  const CHECKIN_MS = 30000;
  const REINTRODUCE_MS = 1500;
  const ROOM_CONTROL = {
    lobby_state: true,
    launch: true,
    global_pause: true,
    ready_state: true,
    countdown_start: true,
    global_resume: true
  };

  Net.state = 'idle';
  Net.role = 'solo';
  Net.code = '';
  Net.peer = null;
  Net.peerId = null;
  Net.transport = 'none';
  Net.iceServers = [];
  Net.available = false;
  Net.statusKnown = false;

  Net.onStatus = null;
  Net.onMessage = null;
  Net.onPeer = null;
  Net.onError = null;
  Net.onSocketOpen = null;
  Net.onAvailability = null;

  const clientId = makeClientId();
  let peerConnection = null;
  let channel = null;
  let localCandidates = [];
  let appliedCandidates = 0;
  let localSession = '';
  let remoteCard = null;
  let seenPeerRev = 0;
  let pollTimer = null;
  let checkinTimer = null;
  let cardTimer = null;
  let recoverTimer = null;
  let manualClose = false;
  let linkUp = false;
  let sendSequence = 0;
  let receiveSequence = 0;
  let intent = null;
  let authority = null;
  let statusPromise = null;

  Net.clientId = clientId;

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

  function makeSessionId() {
    return Math.random().toString(36).slice(2, 12);
  }

  function normalizeProfile(profile) {
    return {
      name: String(profile && profile.name || 'PLAYER').slice(0, 20),
      shipType: String(profile && profile.shipType || 'dart').slice(0, 16),
      shipColor: String(profile && profile.shipColor || '#00f0ff').slice(0, 16)
    };
  }

  Net.introUrl = function () {
    const override = new URLSearchParams(window.location.search).get('intro');
    if (override) return override;
    return new URL('php/coop.php', window.location.href).href;
  };

  function emitStatus(detail) {
    if (typeof Net.onStatus === 'function') {
      Net.onStatus({
        state: Net.state,
        role: Net.role,
        code: Net.code,
        peer: Net.peer,
        transport: Net.transport,
        detail: detail || ''
      });
    }
  }

  function setState(state, detail) {
    Net.state = state;
    emitStatus(detail);
  }

  function emitAvailability() {
    if (typeof Net.onAvailability === 'function') {
      Net.onAvailability({ available: Net.available });
    }
  }

  Net.refreshStatus = function () {
    const base = Net.introUrl();
    const join = base.indexOf('?') === -1 ? '?' : '&';
    statusPromise = fetch(base + join + 'action=status&clientId=' + encodeURIComponent(clientId), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('status');
        return response.json();
      })
      .then(function (body) {
        const servers = body && body.enabled === true && Array.isArray(body.iceServers) ? body.iceServers : [];
        Net.available = servers.length > 0;
        Net.iceServers = Net.available ? servers : [];
        Net.statusKnown = true;
        emitAvailability();
        return Net.available;
      })
      .catch(function () {
        Net.available = false;
        Net.iceServers = [];
        Net.statusKnown = true;
        emitAvailability();
        return false;
      });
    return statusPromise;
  };

  function postJson(body) {
    return fetch(Net.introUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ clientId: clientId }, body)),
      cache: 'no-store'
    }).then(function (response) { return response.json(); });
  }

  function fail(message) {
    const code = Net.code;
    const role = Net.role;
    manualClose = true;
    if (typeof Net.onError === 'function') Net.onError(message);
    Net.state = 'error';
    emitStatus(message);
    stopTimers();
    closePeerConnection();
    if (authority) {
      authority.close();
      authority = null;
    }
    if (code && role === 'host') postJson({ action: 'leave', code: code }).catch(function () {});
    intent = null;
  }

  function stopTimers() {
    if (pollTimer) clearTimeout(pollTimer);
    if (checkinTimer) clearTimeout(checkinTimer);
    if (cardTimer) clearTimeout(cardTimer);
    if (recoverTimer) clearTimeout(recoverTimer);
    pollTimer = null;
    checkinTimer = null;
    cardTimer = null;
    recoverTimer = null;
  }

  function setPeer(peer) {
    const changed = !Net.peer || !peer || Net.peer.clientId !== peer.clientId;
    Net.peer = peer || null;
    Net.peerId = peer ? peer.clientId : null;
    if (changed) receiveSequence = 0;
    if (typeof Net.onPeer === 'function') Net.onPeer(Net.peer);
  }

  function deliverRoom(member, message) {
    if (!member) return;
    if (member.clientId === clientId) {
      if (typeof Net.onMessage === 'function') Net.onMessage(message);
      return;
    }
    if (channel && channel.readyState === 'open') {
      try { channel.send(JSON.stringify(message)); } catch (error) { /* The next introduction retries the room state. */ }
    }
  }

  function scheduleCard() {
    if (cardTimer || manualClose || !Net.code || !peerConnection || !peerConnection.localDescription) return;
    cardTimer = setTimeout(function () {
      cardTimer = null;
      if (manualClose || !peerConnection || !peerConnection.localDescription) return;
      postJson({
        action: 'card',
        code: Net.code,
        card: {
          session: localSession,
          sdp: { type: peerConnection.localDescription.type, sdp: peerConnection.localDescription.sdp },
          candidates: localCandidates.slice(),
          profile: intent ? intent.profile : null
        }
      }).catch(function () {});
    }, 40);
  }

  function ensurePeerConnection() {
    if (peerConnection) return peerConnection;
    const connection = new RTCPeerConnection({ iceServers: Net.iceServers });
    peerConnection = connection;
    connection.onicecandidate = function (event) {
      if (!event.candidate) {
        scheduleCard();
        return;
      }
      const init = typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      };
      localCandidates.push(init);
      scheduleCard();
    };
    connection.onconnectionstatechange = function () {
      if (connection !== peerConnection) return;
      if (connection.connectionState === 'failed') onLinkLost();
    };
    connection.ondatachannel = function (event) {
      attachChannel(event.channel);
    };
    return connection;
  }

  function attachChannel(nextChannel) {
    channel = nextChannel;
    nextChannel.onopen = function () {
      if (channel !== nextChannel) return;
      onLinkOpen();
    };
    nextChannel.onclose = function () {
      if (channel !== nextChannel) return;
      channel = null;
      onLinkLost();
    };
    nextChannel.onmessage = function (event) {
      let message;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (!message || typeof message !== 'object') return;
      if (message.t === 'ctrl') {
        if (Net.role === 'host' && authority && message.body && Net.peerId) authority.handle(Net.peerId, message.body);
        return;
      }
      if (message.t === 'peer-left') {
        if (Net.role === 'guest') setPeer(null);
        return;
      }
      if (ROOM_CONTROL[message.t]) {
        if (Net.role === 'guest' && typeof Net.onMessage === 'function') Net.onMessage(message);
        return;
      }
      receive(message);
    };
  }

  function closePeerConnection() {
    const current = channel;
    channel = null;
    if (current) {
      current.onopen = null;
      current.onclose = null;
      current.onmessage = null;
      try { current.close(); } catch (error) { /* ignore */ }
    }
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.ondatachannel = null;
      try { peerConnection.close(); } catch (error) { /* ignore */ }
      peerConnection = null;
    }
    localCandidates = [];
    appliedCandidates = 0;
    if (Net.transport === 'p2p') Net.transport = 'none';
  }

  function syncCandidates(card) {
    if (!peerConnection || !peerConnection.remoteDescription || !card || !Array.isArray(card.candidates)) return;
    const pending = card.candidates.slice(appliedCandidates);
    appliedCandidates = card.candidates.length;
    for (let index = 0; index < pending.length; index++) {
      peerConnection.addIceCandidate(pending[index]).catch(function () {});
    }
  }

  function handleOffer(card) {
    if (Net.role !== 'host' || !card || !card.sdp) return;
    localSession = card.session || makeSessionId();
    closePeerConnection();
    appliedCandidates = 0;
    const connection = ensurePeerConnection();
    connection.setRemoteDescription(card.sdp).then(function () {
      syncCandidates(card);
      return connection.createAnswer();
    }).then(function (answer) {
      return connection.setLocalDescription(answer);
    }).then(function () {
      scheduleCard();
    }).catch(function () {
      onLinkLost();
    });
  }

  function handleAnswer(card) {
    if (Net.role !== 'guest' || !peerConnection || !card || !card.sdp) return;
    peerConnection.setRemoteDescription(card.sdp).then(function () {
      syncCandidates(card);
    }).catch(function () {});
  }

  function applyCard(card) {
    if (!card || typeof card !== 'object') return;
    const sessionChanged = !remoteCard || remoteCard.session !== card.session || !remoteCard.sdp || !card.sdp || remoteCard.sdp.type !== card.sdp.type;
    remoteCard = card;
    seenPeerRev = card.rev || seenPeerRev;
    if (card.sdp && sessionChanged) {
      if (card.sdp.type === 'offer') handleOffer(card);
      else if (card.sdp.type === 'answer') handleAnswer(card);
    } else {
      syncCandidates(card);
    }
  }

  function poll() {
    if (manualClose || !intent || !Net.code) return;
    postJson({ action: 'poll', code: Net.code, sinceRev: seenPeerRev }).then(function (body) {
      if (manualClose || !intent) return;
      if (!body || body.ok === false) {
        if (body && body.error === 'notfound') fail(Net.role === 'guest' ? 'JOIN CODE NOT FOUND' : 'LOBBY CLOSED');
        return;
      }
      if (Net.role === 'host' && authority && !body.guestId && authority.room.guest) {
        authority.clearGuest();
        if (Net.peer) setPeer(null);
        remoteCard = null;
        seenPeerRev = 0;
      }
      if (body.peerCard) applyCard(body.peerCard);
    }).catch(function () {});
  }

  function checkIn() {
    if (manualClose || Net.role !== 'host' || !Net.code) return;
    postJson({ action: 'checkin', code: Net.code }).catch(function () {});
    checkinTimer = setTimeout(checkIn, CHECKIN_MS);
  }

  function startHousekeeping() {
    stopTimers();
    const tick = function () {
      if (manualClose || !intent) return;
      poll();
      pollTimer = setTimeout(tick, POLL_MS);
    };
    tick();
    if (Net.role === 'host') checkinTimer = setTimeout(checkIn, CHECKIN_MS);
  }

  function onLinkOpen() {
    linkUp = true;
    Net.transport = 'p2p';
    if (recoverTimer) {
      clearTimeout(recoverTimer);
      recoverTimer = null;
    }
    setState('connected', 'P2P LINK READY');
    if (remoteCard && remoteCard.clientId) {
      if (Net.role === 'host' && authority) {
        authority.setGuest(remoteCard.clientId, remoteCard.profile);
      }
      setPeer({ clientId: remoteCard.clientId, profile: remoteCard.profile });
    }
    if (typeof Net.onSocketOpen === 'function') Net.onSocketOpen();
  }

  function onLinkLost() {
    if (manualClose) return;
    linkUp = false;
    Net.transport = 'none';
    if (Net.role === 'host' && authority && remoteCard && remoteCard.clientId) {
      authority.markOffline(remoteCard.clientId);
    }
    setState(Net.role === 'host' && Net.code ? 'waiting' : 'connecting', Net.role === 'host' ? 'DIRECT LINK LOST // REINTRODUCING' : '');
    if (recoverTimer) return;
    recoverTimer = setTimeout(function () {
      recoverTimer = null;
      if (!manualClose && !linkUp) beginNegotiation();
    }, REINTRODUCE_MS);
  }

  function beginNegotiation() {
    if (manualClose || !intent) return;
    if (Net.role === 'guest') startOffer();
  }

  function startOffer() {
    if (Net.role !== 'guest' || manualClose || !intent) return;
    closePeerConnection();
    localSession = makeSessionId();
    localCandidates = [];
    const connection = ensurePeerConnection();
    attachChannel(connection.createDataChannel('game', { ordered: true }));
    connection.createOffer().then(function (offer) {
      return connection.setLocalDescription(offer);
    }).then(function () {
      scheduleCard();
    }).catch(function () {
      onLinkLost();
    });
  }

  function receive(message) {
    if (!message || typeof message !== 'object') return;
    if (typeof message._s === 'number') {
      if (message._s <= receiveSequence) return;
      receiveSequence = message._s;
    }
    if (typeof Net.onMessage === 'function') Net.onMessage(message);
  }

  function busy() {
    return Net.state === 'connecting' || Net.state === 'connected' || Net.state === 'waiting' || Net.state === 'reconnecting';
  }

  Net.host = function (profile) {
    if (busy()) return false;
    manualClose = false;
    linkUp = false;
    remoteCard = null;
    seenPeerRev = 0;
    intent = { role: 'host', code: '', profile: normalizeProfile(profile) };
    Net.role = 'host';
    Net.code = '';
    Net.peer = null;
    Net.peerId = null;
    Net.transport = 'none';
    setState('connecting', '');
    Net.refreshStatus().then(function (ok) {
      if (!intent || intent.role !== 'host') return null;
      if (!ok) {
        fail('CO-OP IS UNAVAILABLE');
        return null;
      }
      return postJson({ action: 'host' });
    }).then(function (body) {
      if (!intent || intent.role !== 'host' || manualClose) return;
      if (!body || !body.ok || !body.code) {
        fail('CO-OP IS UNAVAILABLE');
        return;
      }
      Net.code = body.code;
      intent.code = body.code;
      authority = N.CoopHost.createAuthority();
      authority.setDeliver(deliverRoom);
      authority.setOnGuestCleared(function () {
        if (Net.peer) setPeer(null);
      });
      authority.setHost(clientId, intent.profile);
      setState('waiting', 'ROOM OPEN // SHARE THE CODE');
      startHousekeeping();
    }).catch(function () {
      if (intent) fail('INTRODUCTION UNAVAILABLE');
    });
    return true;
  };

  Net.join = function (code, profile) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length < 4) {
      fail('JOIN CODE MUST BE 4-6 CHARACTERS');
      return false;
    }
    if (busy()) return false;
    manualClose = false;
    linkUp = false;
    remoteCard = null;
    seenPeerRev = 0;
    intent = { role: 'guest', code: clean, profile: normalizeProfile(profile) };
    Net.role = 'guest';
    Net.code = clean;
    Net.peer = null;
    Net.peerId = null;
    Net.transport = 'none';
    setState('connecting', '');
    Net.refreshStatus().then(function (ok) {
      if (!intent || intent.role !== 'guest') return null;
      if (!ok) {
        fail('CO-OP IS UNAVAILABLE');
        return null;
      }
      return postJson({ action: 'join', code: clean });
    }).then(function (body) {
      if (!intent || intent.role !== 'guest' || manualClose) return;
      if (!body || !body.ok) {
        fail(body && body.error === 'full' ? 'ROOM IS FULL' : 'JOIN CODE NOT FOUND');
        return;
      }
      setState('connecting', 'OPENING DIRECT LINK');
      startHousekeeping();
      startOffer();
    }).catch(function () {
      if (intent) fail('INTRODUCTION UNAVAILABLE');
    });
    return true;
  };

  Net.send = function (message) {
    if (!Net.peerId || !message || typeof message !== 'object') return false;
    if (N.Coop && N.Coop.stampMessage) N.Coop.stampMessage(message);
    message._s = ++sendSequence;
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify(message));
        return true;
      } catch (error) { /* A dropped link has no relay. */ }
    }
    return false;
  };

  Net.sendControl = function (message) {
    if (message && message.t === 'lobby_profile' && intent) intent.profile = normalizeProfile(message.profile);
    if (message && N.Coop && ['pause_request', 'ready_signal', 'pause_sync'].includes(message.t)) {
      message.runId = N.Coop.runId;
      message.epoch = N.Coop.pauseEpoch || 0;
    }
    if (!message || typeof message !== 'object') return false;
    if (Net.role === 'host' && authority) {
      authority.handle(clientId, message);
      return true;
    }
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify({ t: 'ctrl', body: message }));
        return true;
      } catch (error) { return false; }
    }
    return false;
  };

  Net.leave = function (silent) {
    manualClose = true;
    if (!silent) Net.send({ t: 'bye' });
    if (Net.role === 'guest') Net.sendControl({ t: 'leave' });
    if (Net.role === 'host' && channel && channel.readyState === 'open') {
      try { channel.send(JSON.stringify({ t: 'peer-left' })); } catch (error) { /* The guest also sees the lobby row disappear. */ }
    }
    const code = Net.code;
    if (code) postJson({ action: 'leave', code: code }).catch(function () {});
    if (authority) {
      authority.close();
      authority = null;
    }
    closePeerConnection();
    stopTimers();
    intent = null;
    Net.role = 'solo';
    Net.code = '';
    Net.transport = 'none';
    linkUp = false;
    remoteCard = null;
    setPeer(null);
    setState('idle', 'CO-OP LINK CLOSED');
  };

  Net.reconnect = function () {
    if (!intent || manualClose) return false;
    linkUp = false;
    beginNegotiation();
    return true;
  };

  Net.label = function () {
    if (Net.transport === 'p2p') return 'P2P';
    return 'OFFLINE';
  };

  Net.refreshStatus();
})();
