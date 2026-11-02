/* NEON NEXUS — host-browser lobby and pause authority.
 *
 * PHP only introduces the browsers. Once the data channel is open, this module
 * is the room: membership, ready-up, launch, shared pause, and resume. It does
 * not simulate the world and it does not relay shots.
 */
(function () {
  'use strict';

  const N = window.NEON;
  const LAUNCH_MS = 3000;
  const COUNTDOWN_MS = 3000;
  const DEFAULT_GRACE_MS = 10000;

  function cleanProfile(value) {
    const profile = value && typeof value === 'object' ? value : {};
    return {
      name: String(profile.name || '').slice(0, 20),
      shipType: String(profile.shipType || 'dart').slice(0, 16),
      shipColor: String(profile.shipColor || '#00f0ff').slice(0, 16)
    };
  }

  function createAuthority(options) {
    const graceMs = options && Number.isFinite(options.peerOfflineGraceMs) && options.peerOfflineGraceMs >= 0
      ? options.peerOfflineGraceMs
      : DEFAULT_GRACE_MS;
    const room = {
      phase: 'lobby',
      runId: 0,
      lobbyRevision: 0,
      respawns: 4,
      skill: 'medium',
      lobbyReady: new Set(),
      launchTimer: null,
      launchAt: 0,
      pauseState: 'PLAY',
      pauseEpoch: 0,
      pauseOwner: null,
      readyPeers: new Set(),
      countdownTimer: null,
      countdownEndsAt: 0,
      host: null,
      guest: null
    };
    let deliver = function () {};
    let onGuestCleared = function () {};

    function onlineMembers() {
      return [room.host, room.guest].filter(function (member) {
        return member && member.online;
      });
    }

    function stamp(message) {
      if (message.t === 'global_pause' || message.t === 'ready_state' || message.t === 'countdown_start' || message.t === 'global_resume') {
        return {
          t: message.t,
          by: message.by,
          ready: message.ready,
          seconds: message.seconds,
          runId: room.runId,
          epoch: room.pauseEpoch || 0
        };
      }
      return message;
    }

    function send(member, message) {
      if (!member || !member.online) return;
      deliver(member, stamp(message));
    }

    function broadcast(message) {
      const members = onlineMembers();
      for (let index = 0; index < members.length; index++) send(members[index], message);
    }

    function lobbyState() {
      return {
        t: 'lobby_state',
        phase: room.phase,
        runId: room.runId,
        revision: room.lobbyRevision || 0,
        respawns: room.skill === 'hardcore' ? 0 : room.respawns,
        skill: room.skill,
        members: onlineMembers().map(function (member) {
          return { clientId: member.clientId, profile: member.profile };
        }),
        ready: Array.from(room.lobbyReady),
        launchAt: room.launchAt || 0
      };
    }

    function broadcastLobby() {
      broadcast(lobbyState());
    }

    function clearLaunch() {
      if (room.launchTimer) clearTimeout(room.launchTimer);
      room.launchTimer = null;
      room.launchAt = 0;
    }

    function clearCountdown() {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      room.countdownTimer = null;
      room.countdownEndsAt = 0;
    }

    function invalidateLobby() {
      clearLaunch();
      room.lobbyReady.clear();
      room.lobbyRevision = (room.lobbyRevision || 0) + 1;
    }

    function startGlobalPause(initiator) {
      clearCountdown();
      room.pauseState = 'PAUSED';
      room.pauseEpoch = (room.pauseEpoch || 0) + 1;
      room.pauseOwner = initiator && initiator.clientId ? initiator.clientId : null;
      room.readyPeers.clear();
      broadcast({ t: 'global_pause', by: room.pauseOwner });
    }

    function finishCountdown() {
      room.countdownTimer = null;
      if (room.pauseState !== 'COUNTDOWN') return;
      const members = onlineMembers();
      if (!members.length) return;
      room.pauseState = 'PLAY';
      room.readyPeers.clear();
      broadcast({ t: 'global_resume' });
    }

    function handleReady(member) {
      if (room.pauseState !== 'PAUSED' || !member.clientId) return;
      room.readyPeers.add(member.clientId);
      broadcast({ t: 'ready_state', ready: Array.from(room.readyPeers) });
      const members = onlineMembers();
      if (!members.length || room.readyPeers.size < members.length) return;
      if (!members.every(function (item) { return room.readyPeers.has(item.clientId); })) return;
      room.pauseState = 'COUNTDOWN';
      broadcast({ t: 'countdown_start', seconds: 3 });
      clearCountdown();
      room.countdownEndsAt = Date.now() + COUNTDOWN_MS;
      room.countdownTimer = setTimeout(finishCountdown, COUNTDOWN_MS);
    }

    function handlePauseSync(member) {
      if (room.pauseState === 'PLAY') {
        send(member, { t: 'global_resume' });
        return;
      }
      if (room.pauseState === 'COUNTDOWN') {
        const remainingMs = Math.max(0, (room.countdownEndsAt || 0) - Date.now());
        send(member, { t: 'countdown_start', seconds: Math.max(1, Math.ceil(remainingMs / 1000)) });
        return;
      }
      send(member, { t: 'global_pause', by: room.pauseOwner || null });
    }

    function clearGuest() {
      const guest = room.guest;
      if (!guest) return;
      if (guest.offlineTimer) clearTimeout(guest.offlineTimer);
      clearCountdown();
      invalidateLobby();
      room.pauseState = 'PLAY';
      room.readyPeers.clear();
      room.guest = null;
      broadcastLobby();
      if (room.phase === 'run') broadcast({ t: 'global_resume' });
      onGuestCleared();
    }

    function armOfflineTimer(guest) {
      if (guest.offlineTimer) clearTimeout(guest.offlineTimer);
      guest.offlineTimer = setTimeout(function () {
        guest.offlineTimer = null;
        if (room.guest === guest && !guest.online) clearGuest();
      }, graceMs);
    }

    function markOffline(clientId) {
      if (!room.guest || room.guest.clientId !== clientId) return;
      const guest = room.guest;
      guest.online = false;
      if (room.pauseState === 'COUNTDOWN') startGlobalPause(null);
      armOfflineTimer(guest);
    }

    function holdOfflineGrace(clientId) {
      const guest = room.guest;
      if (!guest || guest.clientId !== clientId || guest.online) return;
      // setLocalDescription can succeed while the channel never opens and the
      // connection never reaches "failed". Restart the grace from this offer.
      armOfflineTimer(guest);
    }

    function setHost(clientId, profile) {
      room.host = { clientId: clientId, profile: cleanProfile(profile), role: 'host', online: true };
      invalidateLobby();
      broadcastLobby();
    }

    function setGuest(clientId, profile) {
      if (room.guest && room.guest.online) return false;
      const same = room.guest && room.guest.clientId === clientId;
      if (room.guest && room.guest.offlineTimer) clearTimeout(room.guest.offlineTimer);
      if (!same) {
        room.guest = { clientId: clientId, profile: cleanProfile(profile), role: 'guest', online: true, offlineTimer: null };
        invalidateLobby();
        if (room.phase === 'run') startGlobalPause(room.guest);
        else if (room.pauseState !== 'PLAY') startGlobalPause(room.guest);
      } else {
        room.guest.profile = cleanProfile(profile);
        room.guest.online = true;
        room.guest.offlineTimer = null;
      }
      broadcastLobby();
      if (same && room.pauseState !== 'PLAY') handlePauseSync(room.guest);
      return true;
    }

    function handleLobby(member, message) {
      if (message.t === 'lobby_sync') {
        send(member, lobbyState());
        return;
      }
      if (message.t === 'return_lobby') {
        if (member.role !== 'host' || message.runId !== room.runId) return;
        if (room.phase === 'lobby') {
          send(member, lobbyState());
          return;
        }
        room.phase = 'lobby';
        clearCountdown();
        room.pauseState = 'PLAY';
        room.readyPeers.clear();
        invalidateLobby();
        broadcastLobby();
        return;
      }
      if (room.phase !== 'lobby') return;
      if (message.t === 'lobby_profile') {
        member.profile = cleanProfile(message.profile);
        invalidateLobby();
      } else if (message.t === 'lobby_skill') {
        if (member.role !== 'host' || !['easy', 'medium', 'hard', 'hardcore'].includes(message.skill)) return;
        room.skill = message.skill;
        invalidateLobby();
      } else if (message.t === 'lobby_respawns') {
        if (room.skill === 'hardcore' || member.role !== 'host' || !Number.isInteger(message.count) || message.count < 0 || message.count > 8) return;
        room.respawns = message.count;
        invalidateLobby();
      } else if (message.t === 'lobby_ready') {
        if (message.revision !== room.lobbyRevision) return;
        if (message.ready === false) invalidateLobby();
        else room.lobbyReady.add(member.clientId);
        const members = onlineMembers();
        if (!room.launchTimer && members.length && members.every(function (item) { return room.lobbyReady.has(item.clientId); })) {
          const revision = room.lobbyRevision;
          room.launchAt = Date.now() + LAUNCH_MS;
          room.launchTimer = setTimeout(function () {
            room.launchTimer = null;
            if (room.phase !== 'lobby' || room.lobbyRevision !== revision) return;
            const current = onlineMembers();
            if (!current.length || !current.every(function (item) { return room.lobbyReady.has(item.clientId); })) return;
            room.phase = 'run';
            room.runId += 1;
            invalidateLobby();
            broadcastLobby();
            broadcast({ t: 'launch', runId: room.runId });
          }, LAUNCH_MS);
        }
      }
      broadcastLobby();
    }

    function handle(clientId, message) {
      if (!message || typeof message !== 'object') return;
      const member = (room.host && room.host.clientId === clientId && room.host.online) ? room.host
        : (room.guest && room.guest.clientId === clientId && room.guest.online) ? room.guest
          : null;
      if (!member) return;
      if (message.t === 'leave') {
        if (member.role === 'guest') clearGuest();
        return;
      }
      if (message.t === 'pause_request' || message.t === 'ready_signal' || message.t === 'pause_sync') {
        if (message.runId !== undefined && message.runId !== room.runId) return;
        if (message.t === 'ready_signal' && message.epoch !== undefined && message.epoch !== (room.pauseEpoch || 0)) return;
        if (message.t === 'pause_request' && room.pauseState === 'PLAY') startGlobalPause(member);
        else if (message.t === 'pause_sync') handlePauseSync(member);
        else if (message.t === 'ready_signal') handleReady(member);
        return;
      }
      if (message.t === 'lobby_sync' || message.t === 'lobby_profile' || message.t === 'lobby_respawns' || message.t === 'lobby_skill' || message.t === 'lobby_ready' || message.t === 'return_lobby') {
        handleLobby(member, message);
      }
    }

    function close() {
      clearLaunch();
      clearCountdown();
      if (room.guest && room.guest.offlineTimer) clearTimeout(room.guest.offlineTimer);
      deliver = function () {};
    }

    return {
      room: room,
      setDeliver: function (fn) { deliver = typeof fn === 'function' ? fn : deliver; },
      setOnGuestCleared: function (fn) { onGuestCleared = typeof fn === 'function' ? fn : onGuestCleared; },
      setHost: setHost,
      setGuest: setGuest,
      markOffline: markOffline,
      holdOfflineGrace: holdOfflineGrace,
      clearGuest: clearGuest,
      handle: handle,
      close: close
    };
  }

  N.CoopHost = { createAuthority: createAuthority };
})();
