/* Persistent lobby, participant recovery, and host-owned life transitions. */
(function () {
  'use strict';
  const N = window.NEON;
  const G = N.Game;
  const C = N.Coop;
  const copy = value => JSON.parse(JSON.stringify(value));
  const PLAYER_FIELDS = ['x', 'y', 'vx', 'vy', 'aim', 'heading', 'hp', 'shield', 'level', 'xp', 'xpNext',
    'weapons', 'passives', 'core', 'activeWeapon', 'weaponSlots', 'passiveSlots', 'invuln',
    'shieldDelay', 'dashCharges', 'maxDashCharges', 'dashTimer', 'buffs', 'stats', 'dead',
    'shipType', 'shipColor', 'totalDamage', 'healAccum'];
  C._acceptedGrants = new Set();
  C.lobby = null;
  C.runId = 0;
  C.remainingRespawns = 4;
  C.records = new Map();
  C.lastGame = null;
  let syncPending = false;
  let lastNetworkAt = 0;
  let localLife = 0;
  let guestLife = 0;
  let deathPending = null;
  let respawnPending = null;
  let returnPending = false;
  let launchSetup = false;
  let syncSerial = 0;
  let lastSyncAt = -Infinity;
  let receivedSync = -1;
  let awaitingWorld = null;
  let eventSerial = 0;
  const pendingEvents = new Map();
  let acceptedEvents = new Set();

  function snapshot(player, local) {
    const result = {};
    for (const key of PLAYER_FIELDS) result[key] = copy(player[key] === undefined ? null : player[key]);
    result.weapons = player.weapons.map(w => ({ id: w.id, tier: w.tier, level: w.level }));
    result.rewards = copy(local ? N.Rewards.snapshot() : (player.rewards || { pending: [] }));
    result.pendingLevelUps = local ? G.pendingLevelUps : (player.pendingLevelUps || 0);
    result.life = local ? localLife : guestLife;
    result.acceptedEvents = local ? Array.from(acceptedEvents) : (player.acceptedEvents || []);
    result.respawnSeconds = player.respawnSeconds ?? null;
    result.acceptedGrants = local ? Array.from(C._acceptedGrants) : (player.acceptedGrants || []);
    return result;
  }

  function restore(player, data, local) {
    if (!data || !Array.isArray(data.weapons) || !Array.isArray(data.passives)) return false;
    for (const key of PLAYER_FIELDS) {
      if (typeof player[key] === 'number' && !Number.isFinite(data[key])) return false;
    }
    if (!Number.isInteger(data.life) || data.life < 0 || data.life > 1e9) return false;
    if (!Array.isArray(data.core) || !data.stats || !data.buffs) return false;
    for (const key of Object.keys(player.stats)) {
      if (typeof player.stats[key] === 'number' && !Number.isFinite(data.stats[key])) return false;
    }
    for (const key of PLAYER_FIELDS) {
      if (data[key] !== undefined && data[key] !== null) player[key] = copy(data[key]);
    }
    player.weapons = data.weapons.filter(w => w && N.WEAPON_BY_ID[w.id])
      .map(w => G.makeWeapon(w.id, w.tier, w.level));
    if (!player.weapons.length) player.weapons = [G.makeWeapon(N.STARTING_WEAPON, 1, 1)];
    player.passives = data.passives.filter(m => m && N.MOD_BY_ID[m.id]).map(m => ({ id: m.id, stacks: Math.max(1, Math.min(N.MOD_BY_ID[m.id].maxStacks || 3, Math.floor(Number(m.stacks) || 1))) }));
    player.core = (data.core || []).filter(id => N.PROTOCOL_BY_ID[id]);
    player.rewards = copy(data.rewards || { pending: [] });
    player.acceptedEvents = (Array.isArray(data.acceptedEvents) ? data.acceptedEvents : []).filter(Number.isSafeInteger).slice(-4096);
    player.pendingLevelUps = Math.max(0, Math.min(999, Math.floor(Number(data.pendingLevelUps) || 0)));
    player.acceptedGrants = (Array.isArray(data.acceptedGrants) ? data.acceptedGrants : []).filter(id => /^[A-Za-z0-9_-]{1,40}$/.test(id)).slice(-4096);
    player.respawnSeconds = Number.isFinite(data.respawnSeconds) ? Math.max(0, Math.min(3, data.respawnSeconds)) : null;
    player.tx = player.x;
    player.ty = player.y;
    player.ta = player.aim;
    if (local) {
      localLife = data.life || 0;
      acceptedEvents = new Set(player.acceptedEvents);
      N.Rewards.reset(player.rewards);
      G.pendingLevelUps = player.pendingLevelUps;
      G.overflow = null;
      C._acceptedGrants = new Set(player.acceptedGrants);
    }
    return true;
  }

  function rememberGuest() {
    const player = C.guestMirror();
    if (player && C._peerId) {
      C.records.set(C._peerId, { runId: C.runId, sector: G.level.number, player: snapshot(player, false) });
    }
  }

  function attachGuest() {
    if (!C.isHost() || !N.Net.peer) return;
    const retained = C.records.get(N.Net.peer.clientId);
    const player = C.makeRemotePlayer(N.Net.peer.profile, G.level, 1);
    guestLife = 0;
    if (retained && retained.runId === C.runId) {
      restore(player, retained.player, false);
      guestLife = retained.player.life;
      if (retained.sector !== G.level.number) {
        const spawn = G.level.layout ? G.level.layout.spawn : { x: G.level.cx, y: G.level.cy };
        player.x = player.tx = spawn.x;
        player.y = player.ty = spawn.y;
        player.respawnSeconds = null;
      }
    }
    C.remotePlayers = [player];
    C._peerId = N.Net.peer.clientId;
    C.peerProfile = N.Net.peer.profile;
    syncPending = true;
    syncSerial++;
    lastSyncAt = -Infinity;
    C.requestGlobalPause();
    C.applyGlobalPause(N.Net.clientId);
    sendSync();
  }

  function sendSync() {
    const player = C.guestMirror();
    if (!player || !syncPending) return;
    const now = performance.now();
    if (now - lastSyncAt < 1000) return;
    lastSyncAt = now;
    N.Net.send({ t: 'session_sync', syncId: syncSerial, seed: G.run.seed, level: G.level.number,
      host: C.localProfile, player: snapshot(player, false), hostPlayer: snapshot(G.player, true),
      autoReady: launchSetup, run: copy(G.run), pool: C.remainingRespawns, complete: G.mode === 'complete', summary: G.lastSummary });
    C.sendWorld();
    const hazards = C.captureHazards();
    const total = Math.max(1, Math.ceil(hazards.length / 24));
    for (let index = 0; index < total; index++) {
      N.Net.send({ t: 'sync_entities', syncId: syncSerial, index, total, entries: hazards.slice(index * 24, (index + 1) * 24) });
    }
  }

  function finishSetup() {
    const setup = awaitingWorld;
    if (!setup || !setup.world || setup.total === null || setup.chunks.size !== setup.total) return;
    const entries = [];
    for (let index = 0; index < setup.total; index++) entries.push(...setup.chunks.get(index));
    C.applyHazards(entries);
    awaitingWorld = null;
    N.Net.send({ t: 'session_ack', syncId: setup.syncId });
    if (setup.autoReady) C.sendReady();
  }

  C.stampMessage = function (message) {
    message._run = C.runId;
    message._sector = G.level ? G.level.number : 0;
    message._life = localLife;
    if (C.host) message._targetLife = guestLife;
    if (C.isHost() && ['hit', 'heal', 'kill', 'xp'].includes(message.t) && !message.eventId) {
      message.eventId = ++eventSerial;
      pendingEvents.set(message.eventId, { owner: C._peerId, message: copy(message) });
    }
    if (C.isGuest() && G.player && ['state', 'grant_ack'].includes(message.t)) message.participant = deathPending || snapshot(G.player, true);
  };

  C.setLobbyProfile = function (profile) {
    C.localProfile = Object.assign({}, C.localProfile, N.Ships.selection(profile));
    N.Net.sendControl({ t: 'lobby_profile', profile: C.localProfile });
  };
  C.readyLobby = function () {
    if (!C.lobby || C.lobby.phase !== 'lobby') return false;
    return N.Net.sendControl({ t: 'lobby_ready', revision: C.lobby.revision,
      ready: !C.lobby.ready.includes(N.Net.clientId) });
  };

  function returnToLobby(summary) {
    C.lastGame = summary || G.getGameOverData();
    C.started = false;
    C.active = false;
    C.resetPauseState();
    C.remotePlayers = [];
    deathPending = null;
    respawnPending = null;
    syncPending = false;
    G.setMode('menu');
    N.Input.resetFire();
    if (N.UI) N.UI.showCoop();
  }

  C.finishRun = function () {
    if (!C.isHost()) return;
    const summary = G.getGameOverData();
    N.Net.send({ t: 'mission_end', summary });
    returnPending = true;
    N.Net.sendControl({ t: 'return_lobby', runId: C.runId });
    returnToLobby(summary);
  };

  const originalStartHost = C.startHostRun;
  C.startHostRun = function () {
    // Launch is server-authorized; the menu button only marks readiness.
    if (!C.lobby || C.lobby.phase !== 'run' || C.runId !== C.lobby.runId) return false;
    C.records.clear();
    pendingEvents.clear();
    acceptedEvents.clear();
    C._acceptedGrants = new Set();
    C._grantSerial = 0;
    localLife = guestLife = 0;
    C.remainingRespawns = C.lobby.respawns;
    C.resetPauseState();
    launchSetup = !!N.Net.peer;
    const started = originalStartHost();
    if (started && N.Net.peer) attachGuest();
    return started;
  };

  C.onPeer = function (peer) {
    if (C.isHost()) {
      rememberGuest();
      if (!peer) {
        C.remotePlayers = [];
        C._peerId = null;
        C.peerProfile = null;
        syncPending = false;
        respawnPending = null;
        if (G.mode === 'complete') C.resetPauseState();
        else C.applyGlobalResume();
      } else if (peer.clientId !== C._peerId || !C.remotePlayers.length) {
        attachGuest();
      }
    } else if (C.isGuest() && !peer) {
      C.endSession('HOST LEFT // LOBBY CLOSED');
    } else {
      C._peerId = peer ? peer.clientId : null;
      C.peerProfile = peer ? peer.profile : null;
    }
    if (N.Net.role === 'guest' && peer) N.Net.send({ t: 'session_hello' });
    if (N.UI) N.UI.updateCoopPeer(peer);
  };
  N.Net.onPeer = C.onPeer;

  function dropStorage(player, local) {
    const rewards = local ? N.Rewards.snapshot() : copy(player.rewards || { pending: [] });
    const stored = (rewards.pending || []).map(N.Rewards.validItem).filter(Boolean);
    rewards.pending = [];
    player.rewards = rewards;
    if (local) { N.Rewards.reset(rewards); G.overflow = null; }
    for (const item of stored) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 45 + Math.random() * 85;
      G.spawnGroundLoot({ kind: item.kind, id: item.itemId, tier: item.tier, color: item.color },
        player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, null, true);
    }
  }

  function markDeath(player, local) {
    if (player.deathHandled) return;
    player.dead = true;
    player.hp = 0;
    player.vx = player.vy = 0;
    player.deathHandled = true;
    dropStorage(player, local);
    rememberGuest();
  }

  C.onLocalDeath = function () {
    if (!C.active || !G.player || G.player.dead) return;
    G.player.dead = true;
    G.player.hp = 0;
    G.player.vx = G.player.vy = 0;
    N.Input.resetFire();
    G.addParticles(G.player.x, G.player.y, '#ff335c', 55, { speed: 280, life: 1.2, size: 2.8, glow: true });
    G.addRing(G.player.x, G.player.y, 110, '#ff335c', 0.9, 4);
    N.Audio.death();
    if (C.host) markDeath(G.player, true);
    else {
      deathPending = snapshot(G.player, true);
      N.Net.send({ t: 'death', player: deathPending });
      const rewards = N.Rewards.snapshot();
      rewards.pending = [];
      N.Rewards.reset(rewards);
      G.overflow = null;
    }
  };

  function replaceShip(player) {
    player.dead = false;
    player.deathHandled = false;
    player.hp = player.stats.maxHp;
    player.shield = player.stats.maxShield;
    player.shieldDelay = 0;
    player.invuln = 3;
    player.vx = player.vy = 0;
    player.respawnSeconds = null;
  }

  // Select only the highest-level tied candidates, once on the host.
  C.chooseRespawn = function (players, random = Math.random) {
    if (!players.length) return null;
    const highest = Math.max(...players.map(player => player.level));
    const tied = players.filter(player => player.level === highest);
    return tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
  };

  C.tickLives = function (dt) {
    if (!C.isHost() || !C.started) return;
    const players = C.players();
    for (const player of players) {
      if (player.dead && !player.deathHandled) markDeath(player, player === G.player);
    }
    // Check defeat before allocating or completing any pending replacement.
    if (players.length && players.every(player => player.dead)) { C.finishRun(); return; }
    if (G.mode !== 'playing' || C.pauseState !== 'PLAY') return;
    let waiting = players.filter(player => player.dead && player.respawnSeconds == null);
    while (waiting.length && C.remainingRespawns > 0) {
      const chosen = C.chooseRespawn(waiting);
      chosen.respawnSeconds = 3;
      C.remainingRespawns--;
      waiting = waiting.filter(player => player !== chosen);
    }
    for (const player of players) {
      if (!player.dead || player.respawnSeconds == null) continue;
      player.respawnSeconds = Math.max(0, player.respawnSeconds - dt);
      if (player.respawnSeconds > 0) continue;
      replaceShip(player);
      if (player === G.player) localLife++;
      else {
        guestLife++;
        respawnPending = snapshot(player, false);
        N.Net.send({ t: 'revive', player: respawnPending, pool: C.remainingRespawns });
      }
      rememberGuest();
      C.requestGlobalPause();
      C.applyGlobalPause(N.Net.clientId);
      break;
    }
  };

  function sendLives() {
    const guest = C.guestMirror();
    N.Net.send({ t: 'lives', pool: C.remainingRespawns,
      seconds: guest ? guest.respawnSeconds : null, hostSeconds: G.player.respawnSeconds });
  }

  C.cameraTarget = function () {
    const p = G.player;
    if (!C.active || !p || !p.dead || p.respawnSeconds != null || deathPending || C.remainingRespawns > 0) return p;
    return C.remotePlayers.find(player => !player.dead) || p;
  };

  C.tickSession = function () {
    const now = performance.now();
    if (now - lastNetworkAt < 250) return;
    lastNetworkAt = now;
    if (N.UI && N.UI.updateLobby) N.UI.updateLobby();
    if (returnPending) N.Net.sendControl({ t: 'return_lobby', runId: C.runId });
    if (!C.active) return;
    if (G.player.dead) G.updateCamera(0.25);
    if (C.host) {
      sendSync();
      sendLives();
      if (!syncPending) {
        for (const [id, event] of pendingEvents) {
          if (event.message._run !== C.runId || event.message._sector !== G.level.number) pendingEvents.delete(id);
          else if (event.owner === C._peerId) {
            if (event.message._targetLife !== guestLife) pendingEvents.delete(id);
            else N.Net.send(copy(event.message));
          }
        }
      }
      if (respawnPending) N.Net.send({ t: 'revive', player: respawnPending, pool: C.remainingRespawns });
      rememberGuest();
    } else if (deathPending) {
      N.Net.send({ t: 'death', player: deathPending });
    } else {
      N.Net.send({ t: 'participant', player: snapshot(G.player, true) });
    }
    C.sendState();
  };

  const originalReady = C.sendReady;
  C.sendReady = function () {
    if ((C.isHost() && syncPending) || (C.isGuest() && awaitingWorld)) return false;
    return originalReady();
  };

  const originalAdvance = C.onHostAdvance;
  C.onHostAdvance = function () {
    if (!C.isHost()) return;
    C.remainingRespawns = C.lobby.respawns;
    C._acceptedGrants.clear();
    acceptedEvents.clear();
    pendingEvents.clear();
    respawnPending = null;
    for (const player of C.players()) {
      const dead = player.dead;
      if (dead) replaceShip(player);
      else if (player !== G.player) {
        player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.maxHp * 0.35);
        player.shield = player.stats.maxShield;
      }
      player.respawnSeconds = null;
      player.deathHandled = false;
      if (player !== G.player) {
        const spawn = G.level.layout ? G.level.layout.spawn : { x: G.level.cx, y: G.level.cy };
        player.x = player.tx = spawn.x;
        player.y = player.ty = spawn.y;
        guestLife++;
        player.acceptedGrants = [];
        player.acceptedEvents = [];
      }
    }
    localLife++;
    originalAdvance();
    if (N.Net.peer) {
      launchSetup = true;
      syncPending = true;
      syncSerial++;
      lastSyncAt = -Infinity;
      C.requestGlobalPause();
      C.applyGlobalPause(N.Net.clientId);
      sendSync();
    }
  };

  const originalMessage = C.onMessage;
  C.onMessage = function (message) {
    if (!message || typeof message !== 'object') return;
    if (message.t === 'lobby_state') {
      if (C.lobby && message.runId < C.lobby.runId) return;
      C.lobby = message;
      C.runId = message.runId;
      if (message.phase === 'lobby') {
        returnPending = false;
        if (C.active) returnToLobby(C.lastGame);
      }
      const own = message.members.find(member => member.clientId === N.Net.clientId);
      const peer = message.members.find(member => member.clientId !== N.Net.clientId);
      if (own) C.localProfile = own.profile;
      C.peerProfile = peer ? peer.profile : null;
      if (N.UI && N.UI.updateLobby) N.UI.updateLobby();
      return;
    }
    if (message.t === 'launch') {
      if (N.Net.role === 'host' && message.runId === C.runId && !C.active) C.startHostRun();
      return;
    }
    if (message.t === 'session_hello') {
      if (C.isHost()) {
        rememberGuest();
        attachGuest();
      }
      return;
    }
    if (['global_pause', 'ready_state', 'countdown_start', 'global_resume'].includes(message.t)) {
      if (message.runId !== undefined && message.runId !== C.runId) return;
      if (message.epoch !== undefined) C.pauseEpoch = message.epoch;
      if (message.t === 'global_resume' && G.mode === 'complete') { C.resetPauseState(); return; }
      originalMessage(message);
      if (message.t === 'ready_state' && Array.isArray(message.ready) && message.ready.includes(N.Net.clientId)) launchSetup = false;
      if (message.t === 'countdown_start' || message.t === 'global_resume') launchSetup = false;
      // A peer setup acknowledgment can arrive before our WebSocket pause echo.
      // Keep automatic readiness pending until the server confirms it.
      if (message.t === 'global_pause' && launchSetup && !syncPending && !awaitingWorld) C.sendReady();
      return;
    }
    if (message.t === 'bye') return; // Membership comes from the signaling server.
    if (message._run !== C.runId) return;
    if (message.t === 'mission_end' && N.Net.role === 'guest') {
      returnToLobby(message.summary);
      return;
    }
    if (message.t === 'session_sync') {
      if (N.Net.role !== 'guest' || !C.lobby || C.lobby.phase !== 'run') return;
      if (message.syncId <= receivedSync) {
        if (!awaitingWorld) N.Net.send({ t: 'session_ack', syncId: message.syncId });
        return;
      }
      receivedSync = message.syncId;
      launchSetup = !!message.autoReady;
      if (!C.active) C.startGuestRun(message);
      else if (G.level.number !== message.level) C.startNextGuestLevel(message);
      if (!restore(G.player, message.player, true)) { C.endSession('INVALID RECOVERY STATE'); return; }
      restore(C.remotePlayers[0], message.hostPlayer, false);
      G.run = copy(message.run);
      C.remainingRespawns = message.pool;
      C.applyGlobalPause(N.Net.clientId);
      if (message.complete && message.summary) C.applyComplete(message.summary);
      awaitingWorld = { syncId: message.syncId, autoReady: message.autoReady, world: false, total: null, chunks: new Map() };
      return;
    }
    if (C.isGuest() && message.t === 'complete' && message._sector === G.level.number + 1) {
      originalMessage(message); return;
    }
    if (!C.active || message._sector !== G.level.number) return;
    const mirror = C.guestMirror();
    switch (message.t) {
      case 'start':
      case 'advance':
      case 'gameover': return;
      case 'sync_entities':
        if (!C.isGuest() || !awaitingWorld || message.syncId !== awaitingWorld.syncId) return;
        if (!Number.isInteger(message.total) || message.total < 1 || message.total > 1024 ||
            !Number.isInteger(message.index) || message.index < 0 || message.index >= message.total ||
            !Array.isArray(message.entries) || message.entries.length > 24) return;
        awaitingWorld.total = message.total;
        awaitingWorld.chunks.set(message.index, message.entries);
        finishSetup();
        return;
      case 'world':
        originalMessage(message);
        if (C.isGuest() && awaitingWorld) {
          awaitingWorld.world = true;
          finishSetup();
        }
        return;
      case 'session_ack':
        if (message.syncId !== syncSerial) return;
        syncPending = false;
        C._bulletQueue = [];
        C._enemyBulletQueue = [];
        C._mineQueue = [];
        C._strikeQueue = [];
        if (launchSetup) C.sendReady();
        return;
      case 'event_ack': {
        const event = pendingEvents.get(message.eventId);
        if (!event || event.owner !== C._peerId || message._life !== guestLife) return;
        if (mirror && !mirror.dead && message.player) restore(mirror, message.player, false);
        pendingEvents.delete(message.eventId);
        rememberGuest();
        return;
      }
      case 'participant':
        if (mirror && !syncPending && !mirror.dead && message._life === guestLife) {
          restore(mirror, message.player, false);
          rememberGuest();
        }
        return;
      case 'death':
        if (!mirror || message._life !== guestLife) return;
        if (!mirror.deathHandled) {
          if (!restore(mirror, message.player, false)) return;
          markDeath(mirror, false);
        }
        N.Net.send({ t: 'death_ack' });
        return;
      case 'death_ack': deathPending = null; return;
      case 'revive':
        if (!C.isGuest()) return;
        if (message.player.life > localLife) {
          if (!restore(G.player, message.player, true)) return;
          G.player.deathHandled = false;
          deathPending = null;
          C.remainingRespawns = message.pool;
          C.applyGlobalPause(N.Net.clientId);
        }
        N.Net.send({ t: 'revive_ack', life: localLife });
        return;
      case 'revive_ack':
        if (respawnPending && message.life === respawnPending.life) respawnPending = null;
        return;
      case 'lives':
        if (C.isGuest()) {
          C.remainingRespawns = message.pool;
          G.player.respawnSeconds = message.seconds;
          if (C.remotePlayers[0]) C.remotePlayers[0].respawnSeconds = message.hostSeconds;
        }
        return;
      default: break;
    }
    if (C.isGuest() && ['hit', 'heal', 'grant', 'xp', 'kill'].includes(message.t) && message._targetLife !== localLife) return;
    if (C.host && (syncPending || message._life !== guestLife)) return;
    if (C.host && mirror && !mirror.dead && message.participant) restore(mirror, message.participant, false);
    if (C.host && mirror && mirror.dead && ['state', 'loadout', 'fire'].includes(message.t)) return;
    if (C.isGuest() && message.t === 'grant' && G.player.dead && !C._acceptedGrants.has(message.grantId)) {
      N.Net.send({ t: 'grant_ack', grantId: message.grantId, ok: false });
      return;
    }
    if (C.isGuest() && message.t === 'hit' && !G.player.dead && G.mode !== 'playing') return;
    if (C.isGuest() && Number.isSafeInteger(message.eventId)) {
      if (!acceptedEvents.has(message.eventId)) {
        originalMessage(message);
        acceptedEvents.add(message.eventId);
      }
      N.Net.send({ t: 'event_ack', eventId: message.eventId, player: snapshot(G.player, true) });
    } else {
      originalMessage(message);
    }
  };
  N.Net.onMessage = C.onMessage;
  for (const name of ['hostRoom', 'joinRoom', 'leaveToMenu', 'endSession']) {
    const original = C[name];
    C[name] = function (...args) {
      if (['hostRoom', 'joinRoom'].includes(name) && !N.Net.identityPersistent && N.UI) {
        N.UI.toast('BROWSER STORAGE UNAVAILABLE // RELOAD RECOVERY DISABLED', 'warn', 4000);
      }
      C.lobby = null;
      receivedSync = -1;
      awaitingWorld = null;
      C.lastGame = null;
      C.records.clear();
      pendingEvents.clear();
      acceptedEvents.clear();
      syncPending = false;
      returnPending = false;
      deathPending = null;
      respawnPending = null;
      return original(...args);
    };
  }
  const originalGrant = C.grantToGuest;
  C.grantToGuest = function (item) {
    if (!C._peerId || (item.grantOwner && item.grantOwner !== C._peerId)) return false;
    item.grantOwner = C._peerId;
    return originalGrant(item);
  };
  const originalGrantAck = C.applyGrantAck;
  C.applyGrantAck = function (message) {
    const item = G.groundItems.find(item => item.grantId === message.grantId);
    if (item && item.grantOwner && item.grantOwner !== C._peerId) return;
    originalGrantAck(message);
    if (item && message.ok !== true) { item.grantOwner = null; item.grantId = null; }
    rememberGuest();
  };
  const originalDamage = G.damagePlayer;
  G.damagePlayer = function (...args) {
    const result = originalDamage(...args);
    if (C.isGuest() && G.player && !G.player.dead) N.Net.send({ t: 'participant', player: snapshot(G.player, true) });
    return result;
  };
  const originalSave = G.saveCheckpoint;
  G.saveCheckpoint = function (...args) {
    if (C.isGuest() && G.player && !deathPending) N.Net.send({ t: 'participant', player: snapshot(G.player, true) });
    return originalSave(...args);
  };
})();
