/* NEON NEXUS — co-op client transport.
 *
 * Single-player never calls host()/join(), so no socket or peer connection is
 * created. Gameplay messages prefer a WebRTC data channel and fall back to the
 * signaling server relay when a direct channel is unavailable.
 */
(function () {
  'use strict';

  const N = window.NEON;
  const Net = N.Net = {};

  const SIGNAL_PORT = 8787;
  const MAX_RECONNECTS = 8;
  const RECONNECT_DELAY_MS = 1800;

  Net.state = 'idle';
  Net.role = 'solo';
  Net.code = '';
  Net.peer = null;
  Net.peerId = null;
  Net.transport = 'none';
  Net.iceServers = [];

  Net.onStatus = null;
  Net.onMessage = null;
  Net.onPeer = null;
  Net.onError = null;
  Net.onSocketOpen = null;

  const clientId = makeClientId();
  let socket = null;
  let peerConnection = null;
  let channel = null;
  let iceQueue = [];
  let localSession = '';
  let remoteSession = '';
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let manualClose = false;
  let sendSequence = 0;
  let receiveSequence = 0;
  let intent = null;

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

  Net.signalUrl = function () {
    const override = new URLSearchParams(window.location.search).get('signal');
    if (override) return override;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return protocol + '//' + host + ':' + SIGNAL_PORT;
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

  function fail(message) {
    if (typeof Net.onError === 'function') Net.onError(message);
    Net.state = 'error';
    emitStatus(message);
    closeSocket();
  }

  function closeSocket() {
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch (error) {
        /* ignore */
      }
      socket = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function sendSignal(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !Net.peerId) return;
    socket.send(JSON.stringify({ t: 'signal', to: Net.peerId, data }));
  }

  function setPeer(peer) {
    const changed = !Net.peer || !peer || Net.peer.clientId !== peer.clientId;
    Net.peer = peer || null;
    Net.peerId = peer ? peer.clientId : null;
    if (changed) { receiveSequence = 0; closePeerConnection(); }
    if (typeof Net.onPeer === 'function') Net.onPeer(Net.peer);
  }

  function openSocket(retry) {
    closeSocket();
    manualClose = false;
    if (!retry) reconnectAttempts = 0;
    setState(retry ? 'reconnecting' : (Net.role === 'host' ? 'connecting' : 'connecting'), retry ? 'SIGNAL LOST // RETRYING' : 'CONTACTING SIGNAL SERVER');
    let next;
    try {
      next = new WebSocket(Net.signalUrl());
    } catch (error) {
      fail('SIGNAL SERVER UNAVAILABLE');
      return;
    }
    socket = next;
    next.onopen = function () {
      if (intent.role === 'host') {
        socket.send(JSON.stringify({
          t: 'host',
          clientId,
          code: intent.code || undefined,
          profile: intent.profile
        }));
      } else {
        socket.send(JSON.stringify({
          t: 'join',
          code: intent.code,
          clientId,
          profile: intent.profile
        }));
      }
      if (typeof Net.onSocketOpen === 'function') Net.onSocketOpen();
    };
    next.onmessage = function (event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      handleSocketMessage(message);
    };
    next.onclose = function () {
      if (manualClose) return;
      if (reconnectAttempts < MAX_RECONNECTS && intent) {
        reconnectAttempts++;
        setState('reconnecting', 'SIGNAL LOST // RETRY ' + reconnectAttempts + '/' + MAX_RECONNECTS);
        reconnectTimer = setTimeout(function () {
          reconnectTimer = null;
          openSocket(true);
        }, RECONNECT_DELAY_MS);
      } else {
        fail('CONNECTION LOST');
      }
    };
    next.onerror = function () {
      /* onclose carries the retry decision */
    };
  }

  function handleSocketMessage(message) {
    if (!message || typeof message !== 'object') return;
    switch (message.t) {
      case 'hosted':
        Net.code = message.code;
        if (intent) intent.code = message.code;
        if (message.peer) {
          setPeer(message.peer);
        } else if (Net.peer) {
          setPeer(null);
        }
        if (intent) {
          setState(Net.peer ? 'connected' : 'waiting', 'ROOM OPEN // SHARE THE CODE');
        }
        break;
      case 'joined':
        Net.code = message.code;
        reconnectAttempts = 0;
        receiveSequence = 0;
        setPeer(message.host);
        setState('connected', 'LINKED TO HOST');
        startOffer();
        break;
      case 'peer':
        reconnectAttempts = 0;
        receiveSequence = 0;
        setPeer(message.peer);
        setState('connected', 'PEER LINKED');
        if (Net.role === 'guest') {
          startOffer();
        } else if (!peerConnection) {
          ensurePeerConnection();
        }
        break;
      case 'peer-left':
        setPeer(null);
        if (intent) {
          Net.transport = 'none';
          closePeerConnection();
          setState('waiting', 'PEER DISCONNECTED');
        }
        break;
      /* Server-owned pause protocol messages are forwarded to the co-op layer. */
      case 'lobby_state':
      case 'launch':
      case 'global_pause':
      case 'ready_state':
      case 'countdown_start':
      case 'global_resume':
        if (typeof Net.onMessage === 'function') Net.onMessage(message);
        break;
      case 'signal':
        handleSignal(message.data);
        break;
      case 'relay':
        receive(message.data);
        break;
      case 'notfound':
        fail('JOIN CODE NOT FOUND');
        break;
      case 'full':
        fail('ROOM IS FULL');
        break;
      case 'error':
        fail(String(message.message || 'SIGNAL ERROR'));
        break;
      default:
        break;
    }
  }

  function ensurePeerConnection() {
    if (peerConnection) return peerConnection;
    const connection = new RTCPeerConnection({ iceServers: Net.iceServers });
    peerConnection = connection;
    connection.onicecandidate = function (event) {
      if (event.candidate) sendSignal({ kind: 'ice', candidate: event.candidate });
    };
    connection.onconnectionstatechange = function () {
      const state = connection.connectionState;
      if (state === 'connected' || state === 'completed') {
        Net.transport = channel && channel.readyState === 'open' ? 'p2p' : 'relay';
        setState('connected', Net.transport === 'p2p' ? 'P2P LINK READY' : 'RELAY LINK READY');
      } else if (state === 'failed' || state === 'closed') {
        if (channel) {
          try {
            channel.close();
          } catch (error) {
            /* ignore */
          }
        }
        channel = null;
        Net.transport = 'relay';
        setState(Net.peer ? 'connected' : 'waiting', 'P2P LOST // RELAY MODE');
      }
    };
    connection.ondatachannel = function (event) {
      attachChannel(event.channel);
    };
    return connection;
  }

  function attachChannel(nextChannel) {
    channel = nextChannel;
    nextChannel.onopen = function () {
      Net.transport = 'p2p';
      setState('connected', 'P2P LINK READY');
    };
    nextChannel.onclose = function () {
      if (channel === nextChannel) {
        channel = null;
        Net.transport = 'relay';
        setState(Net.peer ? 'connected' : 'waiting', 'P2P LOST // RELAY MODE');
      }
    };
    nextChannel.onmessage = function (event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      receive(message);
    };
  }

  function startOffer() {
    if (Net.role !== 'guest' || !Net.peerId) return;
    if (!intent) return;
    closePeerConnection();
    const connection = ensurePeerConnection();
    localSession = makeSessionId();
    remoteSession = '';
    iceQueue = [];
    const dataChannel = connection.createDataChannel('game', { ordered: true });
    attachChannel(dataChannel);
    connection.createOffer().then(function (offer) {
      return connection.setLocalDescription(offer);
    }).then(function () {
      sendSignal({ kind: 'offer', session: localSession, sdp: connection.localDescription });
    }).catch(function () {
      Net.transport = 'relay';
      setState('connected', 'P2P UNAVAILABLE // RELAY MODE');
    });
  }

  function handleSignal(data) {
    if (!data || typeof data !== 'object') return;
    if (data.kind === 'offer') {
      if (data.session && data.session !== remoteSession) {
        closePeerConnection();
        remoteSession = data.session;
        iceQueue = [];
      }
      const connection = ensurePeerConnection();
      connection.setRemoteDescription(data.sdp).then(function () {
        flushIce();
        return connection.createAnswer();
      }).then(function (answer) {
        return connection.setLocalDescription(answer);
      }).then(function () {
        sendSignal({ kind: 'answer', sdp: connection.localDescription });
      }).catch(function () {
        Net.transport = 'relay';
      });
      return;
    }
    if (data.kind === 'answer') {
      if (!peerConnection) return;
      peerConnection.setRemoteDescription(data.sdp).then(flushIce).catch(function () {});
      return;
    }
    if (data.kind === 'ice' && data.candidate) {
      if (peerConnection && peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(data.candidate).catch(function () {});
      } else {
        iceQueue.push(data.candidate);
      }
    }
  }

  function flushIce() {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    const pending = iceQueue;
    iceQueue = [];
    for (const candidate of pending) {
      peerConnection.addIceCandidate(candidate).catch(function () {});
    }
  }

  function closePeerConnection() {
    if (channel) {
      try {
        channel.close();
      } catch (error) {
        /* ignore */
      }
      channel = null;
    }
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.ondatachannel = null;
      try {
        peerConnection.close();
      } catch (error) {
        /* ignore */
      }
      peerConnection = null;
    }
    iceQueue = [];
    if (Net.transport === 'p2p') Net.transport = 'relay';
  }

  function receive(message) {
    if (!message || typeof message !== 'object') return;
    if (typeof message._s === 'number') {
      if (message._s <= receiveSequence) return;
      receiveSequence = message._s;
    }
    if (typeof Net.onMessage === 'function') Net.onMessage(message);
  }

  Net.host = function (profile) {
    if (Net.state === 'connecting' || Net.state === 'connected') return false;
    intent = { role: 'host', code: '', profile: normalizeProfile(profile) };
    Net.role = 'host';
    Net.code = '';
    Net.peer = null;
    Net.peerId = null;
    Net.transport = 'none';
    openSocket(false);
    return true;
  };

  Net.join = function (code, profile) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length < 4) {
      fail('JOIN CODE MUST BE 4-6 CHARACTERS');
      return false;
    }
    if (Net.state === 'connecting' || Net.state === 'connected') return false;
    intent = { role: 'guest', code: clean, profile: normalizeProfile(profile) };
    Net.role = 'guest';
    Net.code = clean;
    Net.peer = null;
    Net.peerId = null;
    Net.transport = 'none';
    openSocket(false);
    return true;
  };

  Net.send = function (message) {
    if (!Net.peerId || !message || typeof message !== 'object') return false;
    if (N.Coop && N.Coop.stampMessage) N.Coop.stampMessage(message);
    message._s = ++sendSequence;
    const text = JSON.stringify(message);
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(text);
        return true;
      } catch (error) {
        /* fall through to relay */
      }
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ t: 'relay', to: Net.peerId, data: message }));
      return true;
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
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  };

  Net.leave = function (silent) {
    manualClose = true;
    if (!silent) Net.send({ t: 'bye' });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ t: 'leave' }));
    }
    closePeerConnection();
    closeSocket();
    intent = null;
    Net.role = 'solo';
    Net.code = '';
    Net.transport = 'none';
    setPeer(null);
    setState('idle', 'CO-OP LINK CLOSED');
  };

  Net.reconnect = function () {
    if (!intent) return false;
    reconnectAttempts = 0;
    openSocket(true);
    return true;
  };

  Net.label = function () {
    if (Net.transport === 'p2p') return 'P2P';
    if (Net.transport === 'relay') return 'RELAY';
    return 'OFFLINE';
  };
})();
