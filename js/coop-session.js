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
  const setups = new Map();
  const revives = new Map();
  let lastNetworkAt = 0;
  let localLife = 0;
  let deathPending = null;
  let returnPending = false;
  let launchSetup = false;
  let syncSerial = 0;
  let receivedSync = -1;
  let awaitingWorld = null;
  let eventSerial = 0;
  const pendingEvents = new Map();
  let acceptedEvents = new Set();

  function snapshot(player, local) {
    const result = {};
    for (const key of PLAYER_FIELDS) result[key] = copy(player[key] === undefined ? null : player[key]);
    result.unlockedSector = Math.max(G.level.number,player.loadoutHighestSector||1);
    result.weapons = player.weapons.map(w => ({ id: w.id, tier: w.tier, level: w.level }));
    result.rewards = copy(local ? N.Rewards.snapshot() : (player.rewards || { pending: [] }));
    result.pendingLevelUps = local ? G.pendingLevelUps : (player.pendingLevelUps || 0);
    result.life = local ? localLife : (player.coopLife || 0);
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
    if(Number.isSafeInteger(data.unlockedSector)&&data.unlockedSector>=1) player.loadoutHighestSector=data.unlockedSector;
    player.tx = player.x;
    player.ty = player.y;
    player.ta = player.aim;
    if (!local) player.coopLife = data.life;
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
    for (const player of C.remotePlayers) {
      if (player.clientId) C.records.set(player.clientId, {
        runId: C.runId, sector: G.level.number, player: snapshot(player, false)
      });
    }
  }

  function attachGuest(peer) {
    if (!C.isHost() || !peer) return;
    const retained = C.records.get(peer.clientId);
    const profile = C.lobby.members.find(member => member.clientId === peer.clientId)?.profile || peer.profile;
    const player = C.makeRemotePlayer(profile, G.level, peer.seat);
    player.clientId = player.statsPeerId = peer.clientId;
    player.seat = peer.seat;
    player.name = 'PLAYER ' + (peer.seat + 1);
    player.coopLife = 0;
    N.PlayerStats?.selectPeer(peer.clientId);
    N.Logbook?.selectPeer(peer.clientId, true);
    if (profile.loadout && C.lobby.allowLoadouts && G.run.skill !== 'hardcore') {
      N.Loadouts.apply(player, profile.loadout);
      player.pendingLevelUps = Math.max(0, player.level - 1 - player.core.length);
    }
    if (retained && retained.runId === C.runId) {
      restore(player, retained.player, false);
      if (retained.sector !== G.level.number) {
        const spawn = G.level.layout ? G.level.layout.spawn : { x: G.level.cx, y: G.level.cy };
        player.x = player.tx = spawn.x;
        player.y = player.ty = spawn.y;
        player.respawnSeconds = null;
      }
    }
    C.remotePlayers = C.remotePlayers.filter(item => item.clientId !== peer.clientId);
    C.remotePlayers.push(player);
    C.remotePlayers.sort((a, b) => a.seat - b.seat);
    setups.set(peer.clientId, { serial: ++syncSerial, lastAt: -Infinity });
    C.requestGlobalPause();
    C.applyGlobalPause(N.Net.clientId);
    sendSync();
  }

  function sendSync() {
    const now = performance.now();
    for (const [id, setup] of setups) {
      const player = C.guestMirror(id);
      if (!player || now - setup.lastAt < 1000) continue;
      setup.lastAt = now;
      N.Net.send({ t: 'session_sync', syncId: setup.serial, seed: G.run.seed, level: G.level.number,
        host: C.localProfile, player: snapshot(player, false), hostPlayer: snapshot(G.player, true),
        autoReady: launchSetup, statsPeer: N.PlayerStats?.peerRow(id) || null,
        run: copy(G.run), pool: C.remainingRespawns, epoch: C.pauseEpoch || 0,
        complete: G.mode === 'complete', summary: G.lastSummary }, id);
      C.sendWorld(id);
      const hazards = C.captureHazards();
      const total = Math.max(1, Math.ceil(hazards.length / 24));
      for (let index = 0; index < total; index++) {
        N.Net.send({ t: 'sync_entities', syncId: setup.serial, index, total, entries: hazards.slice(index * 24, (index + 1) * 24) }, id);
      }
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

  C.stampMessage = function (message, targetId) {
    message._run = C.runId;
    message._sector = G.level ? G.level.number : 0;
    message._life = localLife;
    message._seat = N.Net.seat || 0;
    if (C.host) {
      const target = C.guestMirror(targetId);
      message._targetLife = target?.coopLife || 0;
      message._targetSeat = target?.seat;
    }
    if (C.isHost() && ['hit', 'heal', 'kill', 'xp'].includes(message.t) && !message.eventId) {
      message.eventId = ++eventSerial;
      pendingEvents.set(message.eventId, { owner: targetId, message: copy(message) });
    }
    if (C.isGuest() && G.player && message.t === 'grant_ack') message.participant = deathPending || snapshot(G.player, true);
    if (C.isGuest() && G.player && message.t === 'state' && deathPending) message.participant = deathPending;
  };

  C.setLobbyProfile = function (profile) {
    C.localProfile = Object.assign({}, C.localProfile, N.Ships.selection(profile), {loadout:profile?.loadout||null});
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
    revives.clear();
    setups.clear();
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
    localLife = 0;
    setups.clear();
    revives.clear();
    C.remainingRespawns = C.lobby.respawns;
    C.resetPauseState();
    launchSetup = N.Net.peers.size > 0;
    const started = originalStartHost();
    if (started) {
      for (const peer of N.Net.peers.values()) attachGuest(peer);
    }
    return started;
  };

  C.onPeer = function (peer, clientId) {
    if (C.isHost()) {
      rememberGuest();
      if (!peer) {
        C.remotePlayers = C.remotePlayers.filter(player => player.clientId !== clientId);
        setups.delete(clientId);
        revives.delete(clientId);
        if (G.mode === 'complete') C.resetPauseState();
      } else {
        attachGuest(peer);
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
    if (G.run.skill === 'hardcore' || G.mode !== 'playing' || C.pauseState !== 'PLAY') return;
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
        player.coopLife = (player.coopLife || 0) + 1;
        const replacement = snapshot(player, false);
        revives.set(player.clientId, replacement);
        N.Net.send({ t: 'revive', player: replacement, pool: C.remainingRespawns }, player.clientId);
      }
      rememberGuest();
      C.requestGlobalPause();
      C.applyGlobalPause(N.Net.clientId);
      break;
    }
  };

  function sendLives() {
    for (const player of C.remotePlayers) {
      N.Net.send({ t: 'lives', pool: C.remainingRespawns,
        seconds: player.respawnSeconds, hostSeconds: G.player.respawnSeconds }, player.clientId);
    }
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
      for (const [id, event] of pendingEvents) {
        if (event.message._run !== C.runId || event.message._sector !== G.level.number) pendingEvents.delete(id);
        else if (!setups.has(event.owner)) {
          const player = C.guestMirror(event.owner);
          if (player && event.message._targetLife !== player.coopLife) pendingEvents.delete(id);
          else if (player) N.Net.send(copy(event.message), event.owner);
        }
      }
      for (const [id, player] of revives) {
        N.Net.send({ t: 'revive', player, pool: C.remainingRespawns }, id);
      }
      rememberGuest();
    } else if (deathPending) {
      N.Net.send({ t: 'death', player: deathPending });
    } else {
      N.Net.send({ t: 'participant', player: snapshot(G.player, true) });
    }
    C.sendState();
  };

  function avatarState(player, seat) {
    const state = { _seat: seat, maxHp: player.stats.maxHp, maxShield: player.stats.maxShield,
      pickupRadius: player.stats.pickupRadius || 95, magnet: !!player.buffs?.magnet,
      seconds: player.respawnSeconds ?? null };
    for (const key of ['name', 'x', 'y', 'vx', 'vy', 'aim', 'heading', 'hp', 'shield', 'level', 'dead', 'invuln', 'shipType', 'shipColor']) {
      state[key] = player[key];
    }
    return state;
  }

  const originalState = C.sendState;
  C.sendState = function () {
    if (!C.isHost()) return originalState();
    if (!G.player) return;
    const players = [avatarState(G.player, 0), ...C.remotePlayers.map(player => avatarState(player, player.seat))];
    for (const player of C.remotePlayers) {
      N.Net.send({ t: 'avatars', players: players.filter(state => state._seat !== player.seat) }, player.clientId);
    }
  };

  function applyAvatars(message) {
    if (!C.isGuest() || !Array.isArray(message.players) || message.players.length > 3) return;
    const seen = new Set();
    for (const state of message.players) {
      if (!Number.isInteger(state._seat) || state._seat < 0 || state._seat > 3 || state._seat === N.Net.seat || seen.has(state._seat)) return;
      seen.add(state._seat);
    }
    C.remotePlayers = message.players.map(state => {
      const player = C.remotePlayers.find(item => item.seat === state._seat) || C.makeRemotePlayer(state, G.level, state._seat);
      player.seat = state._seat;
      return player;
    });
    for (const state of message.players) {
      C.applyRemoteState(state);
      C.remotePlayers.find(player => player.seat === state._seat).respawnSeconds = state.seconds;
    }
  }

  const originalReady = C.sendReady;
  C.sendReady = function () {
    if ((C.isHost() && setups.size > 0) || (C.isGuest() && awaitingWorld)) return false;
    return originalReady();
  };

  const originalAdvance = C.onHostAdvance;
  C.onHostAdvance = function () {
    if (!C.isHost()) return;
    C.remainingRespawns = C.lobby.respawns;
    C._acceptedGrants.clear();
    acceptedEvents.clear();
    pendingEvents.clear();
    revives.clear();
    for (const player of C.players()) {
      const dead = player.dead;
      if (dead && G.run.skill !== 'hardcore') replaceShip(player);
      else if (!dead && player !== G.player) {
        player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.maxHp * 0.35);
        player.shield = player.stats.maxShield;
      }
      player.respawnSeconds = null;
      player.deathHandled = player.dead;
      if (player !== G.player) {
        const spawn = G.level.layout ? G.level.layout.spawn : { x: G.level.cx, y: G.level.cy };
        player.x = player.tx = spawn.x;
        player.y = player.ty = spawn.y;
        player.coopLife = (player.coopLife || 0) + 1;
        player.acceptedGrants = [];
        player.acceptedEvents = [];
      }
    }
    localLife++;
    originalAdvance();
    if (N.Net.peers.size) {
      launchSetup = true;
      for (const player of C.remotePlayers) {
        setups.set(player.clientId, { serial: ++syncSerial, lastAt: -Infinity });
      }
      C.requestGlobalPause();
      C.applyGlobalPause(N.Net.clientId);
      sendSync();
    }
  };

  const originalMessage = C.onMessage;
  C.onMessage = function (message, clientId) {
    if (!message || typeof message !== 'object') return;
    if (message.t === 'lobby_state') {
      if(message.protocol!==2 || message.capacity!==4 || message.loadoutRules!==1){C.endSession('INCOMPATIBLE SAVED SHIP RULES // UPDATE BOTH CLIENTS');return;}
      if (!Object.hasOwn(N.SKILLS,message.skill)) { C.endSession('INCOMPATIBLE SKILL RULES // UPDATE BOTH CLIENTS'); return; }
      if (C.lobby && message.runId < C.lobby.runId) return;
      C.lobby = message;
      C.runId = message.runId;
      if (message.phase === 'lobby') {
        returnPending = false;
        if (C.active){N.PlayerStats?.endLocal();returnToLobby(C.lastGame);}
      }
      const own = message.members.find(member => member.clientId === N.Net.clientId);
      const peer = message.members.find(member => member.clientId !== N.Net.clientId);
      if (own) {
        C.localProfile = own.profile;
        N.Net.seat = own.seat;
        C.localProfile.name = 'PLAYER ' + (own.seat + 1);
      }
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
        attachGuest(N.Net.peers.get(clientId));
      }
      return;
    }
    if (['global_pause', 'ready_state', 'countdown_start', 'global_resume'].includes(message.t)) {
      if (message.runId !== undefined && message.runId !== C.runId) return;
      if (message.epoch !== undefined) C.pauseEpoch = message.epoch;
      if (message.t === 'global_resume' && G.mode === 'complete') { C.resetPauseState(); return; }
      originalMessage(message, clientId);
      if (message.t === 'ready_state' && Array.isArray(message.ready) && message.ready.includes(N.Net.clientId)) launchSetup = false;
      if (message.t === 'countdown_start' || message.t === 'global_resume') launchSetup = false;
      // A peer setup acknowledgment can arrive before the host's pause echo.
      // Keep automatic readiness pending until the host confirms it.
      if (message.t === 'global_pause' && launchSetup && setups.size === 0 && !awaitingWorld) C.sendReady();
      return;
    }
    if (message.t === 'bye') return; // Membership comes from the host browser.
    if (message._run !== C.runId) return;
    if (C.isGuest() && message._targetSeat !== undefined && message._targetSeat !== N.Net.seat) return;
    if (message.t === 'mission_end' && N.Net.role === 'guest') {
      N.PlayerStats?.endLocal();
      returnToLobby(message.summary);
      return;
    }
    if (message.t === 'session_sync') {
      if (!message.run || !Object.hasOwn(N.SKILLS, message.run.skill)) { C.endSession('INCOMPATIBLE SKILL RULES // UPDATE BOTH CLIENTS'); return; }
      if (N.Net.role !== 'guest' || !C.lobby || C.lobby.phase !== 'run') return;
      if (message.syncId <= receivedSync) {
        if (!awaitingWorld) N.Net.send({ t: 'session_ack', syncId: message.syncId });
        return;
      }
      receivedSync = message.syncId;
      launchSetup = !!message.autoReady;
      // The host can stamp this sync before it applies its own pause echo.
      // A newer pause message already on this guest must keep its epoch.
      if (message.epoch !== undefined && message.epoch > (C.pauseEpoch || 0)) C.pauseEpoch = message.epoch;
      if (!C.active) C.startGuestRun(message);
      else if (G.level.number !== message.level) C.startNextGuestLevel(message);
      if (!restore(G.player, message.player, true)) { C.endSession('INVALID RECOVERY STATE'); return; }
      C.remotePlayers[0].seat = 0;
      restore(C.remotePlayers[0], message.hostPlayer, false);
      G.run = copy(message.run);
      G.run.highestSector=Math.max(message.level,G.player.loadoutHighestSector||1);
      N.PlayerStats?.recoverGuest(message.statsPeer);
      C.remainingRespawns = message.pool;
      C.applyGlobalPause(N.Net.clientId);
      if (message.complete && message.summary) C.applyComplete(message.summary);
      awaitingWorld = { syncId: message.syncId, autoReady: message.autoReady, world: false, total: null, chunks: new Map() };
      return;
    }
    if (C.isGuest() && message.t === 'complete' && message._sector === G.level.number + 1) {
      originalMessage(message, clientId); return;
    }
    if (!C.active || message._sector !== G.level.number) return;
    const mirror = C.guestMirror(clientId);
    const guestLife = mirror?.coopLife || 0;
    switch (message.t) {
      case 'avatars': applyAvatars(message); return;
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
        originalMessage(message, clientId);
        if (C.isGuest() && awaitingWorld) {
          awaitingWorld.world = true;
          finishSetup();
        }
        return;
      case 'session_ack':
        if (message.syncId !== setups.get(clientId)?.serial) return;
        setups.delete(clientId);
        C._bulletQueue = [];
        C._enemyBulletQueue = [];
        C._mineQueue = [];
        C._strikeQueue = [];
        if (launchSetup && setups.size === 0) C.sendReady();
        return;
      case 'event_ack': {
        const event = pendingEvents.get(message.eventId);
        if (!event || event.owner !== clientId || message._life !== guestLife) return;
        if (mirror && !mirror.dead && message.player) restore(mirror, message.player, false);
        pendingEvents.delete(message.eventId);
        rememberGuest();
        return;
      }
      case 'participant':
        if (mirror && !setups.has(clientId) && !mirror.dead && message._life === guestLife) {
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
        N.Net.send({ t: 'death_ack' }, clientId);
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
        if (message.life === revives.get(clientId)?.life) revives.delete(clientId);
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
    if (C.host && (!mirror || setups.has(clientId) || message._life !== guestLife)) return;
    if (C.host && mirror && !mirror.dead && message.participant) restore(mirror, message.participant, false);
    if (C.host && mirror && mirror.dead && ['state', 'loadout', 'fire'].includes(message.t)) return;
    if (C.isGuest() && message.t === 'grant' && G.player.dead && !C._acceptedGrants.has(message.grantId)) {
      N.Net.send({ t: 'grant_ack', grantId: message.grantId, ok: false });
      return;
    }
    if (C.isGuest() && message.t === 'hit' && !G.player.dead && G.mode !== 'playing') return;
    if (C.isGuest() && Number.isSafeInteger(message.eventId)) {
      if (!acceptedEvents.has(message.eventId)) {
        originalMessage(message, clientId);
        acceptedEvents.add(message.eventId);
      }
      N.Net.send({ t: 'event_ack', eventId: message.eventId, player: snapshot(G.player, true) });
    } else {
      originalMessage(message, clientId);
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
      setups.clear();
      returnPending = false;
      deathPending = null;
      revives.clear();
      return original(...args);
    };
  }
  const originalGrant = C.grantToGuest;
  C.grantToGuest = function (item, player) {
    const recipient = player || C.guestMirror(item.grantOwner);
    if (!recipient || !recipient.clientId || (item.grantOwner && item.grantOwner !== recipient.clientId)) return false;
    item.grantOwner = recipient.clientId;
    return originalGrant(item, recipient);
  };
  const originalGrantAck = C.applyGrantAck;
  C.applyGrantAck = function (message, clientId) {
    const item = G.groundItems.find(item => item.grantId === message.grantId);
    if (item && item.grantOwner && item.grantOwner !== clientId) return;
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
