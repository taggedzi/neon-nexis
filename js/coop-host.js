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
      shipColor: String(profile.shipColor || '#00f0ff').slice(0, 16),
      loadout: profile?.loadout && N.Loadouts?.validateShip(profile.loadout) ? N.deepClone(profile.loadout) : null,
      loadoutInvalid: !!profile?.loadout && !N.Loadouts?.validateShip(profile.loadout)
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
      allowLoadouts: false,
      startSector: 1,
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
      guests: new Map(),
      roster: new Map()
    };
    // Legacy readers can inspect the first guest; membership always uses the map.
    Object.defineProperty(room, 'guest', { get: () => room.guests.values().next().value || null });
    let deliver = function () {};
    let onGuestCleared = function () {};

    function onlineMembers() {
      return [room.host, ...room.guests.values()].filter(function (member) {
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
        capacity: 4,
        protocol: 2,
        runId: room.runId,
        revision: room.lobbyRevision || 0,
        respawns: room.skill === 'hardcore' ? 0 : room.respawns,
        skill: room.skill,
        loadoutRules: 1,
        allowLoadouts: room.allowLoadouts,
        startSector: Math.min(room.startSector,sectorCap()),
        sectorCap: sectorCap(),
        members: onlineMembers().map(function (member) {
          return { clientId: member.clientId, seat: member.seat, profile: member.profile };
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

    function sectorCap() {
      if(!room.allowLoadouts || room.skill==='hardcore') return 1;
      return Math.min(...onlineMembers().map(member=>member.profile.loadout?.highestSector||1));
    }

    function invalidateLobby() {
      room.startSector=Math.min(room.startSector,sectorCap());
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

    function clearGuest(clientId) {
      const guest = room.guests.get(clientId);
      if (!guest) return;
      if (guest.offlineTimer) clearTimeout(guest.offlineTimer);
      clearCountdown();
      invalidateLobby();
      room.readyPeers.delete(clientId);
      room.guests.delete(clientId);
      broadcastLobby();
      if (room.phase === 'run') {
        if (onlineMembers().length === 1) {
          room.pauseState = 'PLAY';
          room.readyPeers.clear();
          broadcast({ t: 'global_resume' });
        } else startGlobalPause(null);
      }
      onGuestCleared(clientId);
    }

    function armOfflineTimer(guest) {
      if (guest.offlineTimer) clearTimeout(guest.offlineTimer);
      guest.offlineTimer = setTimeout(function () {
        guest.offlineTimer = null;
        if (room.guests.get(guest.clientId) === guest && !guest.online) clearGuest(guest.clientId);
      }, graceMs);
    }

    function markOffline(clientId) {
      const guest = room.guests.get(clientId);
      if (!guest) return;
      guest.online = false;
      invalidateLobby();
      if (room.pauseState === 'COUNTDOWN') startGlobalPause(null);
      armOfflineTimer(guest);
      broadcastLobby();
    }

    function holdOfflineGrace(clientId) {
      const guest = room.guests.get(clientId);
      if (guest && !guest.online) armOfflineTimer(guest);
    }

    function setHost(clientId, profile) {
      room.host = { clientId, seat: 0, profile: cleanProfile(profile), role: 'host', online: true };
      invalidateLobby();
      broadcastLobby();
    }

    function setGuest(clientId, profile, requestedSeat) {
      if (room.phase === 'run' && !room.roster.has(clientId)) return false;
      let guest = room.guests.get(clientId);
      if (guest?.online) return false;
      if (guest?.offlineTimer) clearTimeout(guest.offlineTimer);
      if (!guest) {
        const occupied = new Set(Array.from(room.guests.values(), member => member.seat));
        const retainedSeat = room.roster.get(clientId);
        const seat = retainedSeat ?? requestedSeat ?? [1, 2, 3].find(value => !occupied.has(value));
        if (retainedSeat !== undefined && requestedSeat !== undefined && requestedSeat !== retainedSeat) return false;
        if (![1, 2, 3].includes(seat) || occupied.has(seat)) return false;
        guest = { clientId, seat, profile: cleanProfile(profile), role: 'guest', online: true, offlineTimer: null };
        room.guests.set(clientId, guest);
      } else {
        guest.online = true;
        guest.offlineTimer = null;
      }
      guest.profile.name = 'PLAYER ' + (guest.seat + 1);
      invalidateLobby();
      if (room.phase === 'run' || room.pauseState !== 'PLAY') startGlobalPause(guest);
      broadcastLobby();
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
        room.roster.clear();
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
        member.profile.name = 'PLAYER ' + (member.seat + 1);
        invalidateLobby();
      } else if (message.t === 'lobby_skill') {
        if (member.role !== 'host' || !['easy', 'medium', 'hard', 'hardcore'].includes(message.skill)) return;
        room.skill = message.skill;
        if(room.skill==='hardcore'){
          room.allowLoadouts=false;
          for(const item of onlineMembers()){item.profile.loadout=null;item.profile.loadoutInvalid=false;}
        }
        invalidateLobby();
      } else if (message.t === 'lobby_loadouts') {
        if(member.role!=='host'||room.skill==='hardcore'||typeof message.allow!=='boolean') return;
        room.allowLoadouts=message.allow;
        if(!message.allow){
          for(const item of onlineMembers()){item.profile.loadout=null;item.profile.loadoutInvalid=false;}
        }
        invalidateLobby();
      } else if (message.t === 'lobby_sector') {
        if(member.role!=='host'||!Number.isSafeInteger(message.sector)||message.sector<1||message.sector>sectorCap()) return;
        room.startSector=message.sector;
        invalidateLobby();
      } else if (message.t === 'lobby_respawns') {
        if (room.skill === 'hardcore' || member.role !== 'host' || !Number.isInteger(message.count) || message.count < 0 || message.count > 8) return;
        room.respawns = message.count;
        invalidateLobby();
      } else if (message.t === 'lobby_ready') {
        if (message.revision !== room.lobbyRevision) return;
        if(member.profile.loadoutInvalid || (member.profile.loadout && (!room.allowLoadouts||room.skill==='hardcore'))) return;
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
            room.roster = new Map(current.map(item => [item.clientId, item.seat]));
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
        : room.guests.get(clientId)?.online ? room.guests.get(clientId)
          : null;
      if (!member) return;
      if (message.t === 'leave') {
        if (member.role === 'guest') clearGuest(clientId);
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
      if (message.t === 'lobby_sync' || message.t === 'lobby_profile' || message.t === 'lobby_respawns' || message.t === 'lobby_skill' || message.t === 'lobby_loadouts' || message.t === 'lobby_sector' || message.t === 'lobby_ready' || message.t === 'return_lobby') {
        handleLobby(member, message);
      }
    }

    function close() {
      clearLaunch();
      clearCountdown();
      for (const guest of room.guests.values()) {
        if (guest.offlineTimer) clearTimeout(guest.offlineTimer);
      }
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
