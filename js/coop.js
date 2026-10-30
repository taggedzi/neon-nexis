/* NEON NEXUS — co-op session logic.
 *
 * Host-authoritative world, client-owned avatars. Single-player never enters
 * this path. Game code calls the small hooks at the bottom of this file.
 */
(function () {
  'use strict';

  const N = window.NEON;
  const G = N.Game;
  const Coop = N.Coop = {};

  const STATE_INTERVAL_MS = 50;
  const WORLD_INTERVAL_MS = 200;
  const FLUSH_INTERVAL_MS = 50;
  const FIRE_BUDGET_PER_SECOND = 30;
  const MAX_QUEUED_BULLETS = 120;

  Coop.active = false;
  Coop.role = 'solo';
  Coop.host = false;
  Coop.guest = false;
  Coop.started = false;
  Coop.remotePlayers = [];
  Coop.localProfile = { name: 'PLAYER 1', shipType: 'dart', shipColor: '#00f0ff' };
  Coop.peerProfile = null;
  Coop.status = null;

  Coop._initialized = false;
  Coop._ending = false;
  Coop._applyingRemote = false;
  Coop._peerId = null;
  Coop._stateAt = 0;
  Coop._worldAt = 0;
  Coop._flushAt = 0;
  Coop._loadoutSignature = '';
  Coop._bulletQueue = [];
  Coop._enemyBulletQueue = [];
  Coop._mineQueue = [];
  Coop._strikeQueue = [];
  Coop._fireWindow = 0;
  Coop._fireCount = 0;

  Coop.pauseState = 'PLAY';
  Coop.pauseOwner = null;
  Coop.readyPeers = [];
  Coop.countdownRemaining = 0;
  Coop._countdownTimer = null;
  Coop._countdownFallback = null;
  Coop._readySent = false;

  function clock() {
    return performance.now();
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, digits) {
    const scale = Math.pow(10, digits || 0);
    return Math.round(finite(value, 0) * scale) / scale;
  }

  function profileOf(profile) {
    return {
      name: String(profile && profile.name || 'PLAYER').slice(0, 20),
      shipType: N.Ships.get(profile && profile.shipType).id,
      shipColor: N.Ships.selection(profile).shipColor
    };
  }

  function spawnOffset(level, index) {
    const spawn = level.layout ? level.layout.spawn : { x: level.cx, y: level.cy };
    const angle = index * 2.1;
    let x = spawn.x + Math.cos(angle) * 72;
    let y = spawn.y + Math.sin(angle) * 72;
    if (level.layout) {
      const free = N.World.findFree(level.layout, x, y, 18);
      x = free.x;
      y = free.y;
    }
    return { x, y };
  }

  function makeRemotePlayer(profile, level, index) {
    const p = G.makePlayer();
    const selection = profileOf(profile || {});
    Object.assign(p, N.Ships.selection(selection));
    p.name = selection.name;
    p.remote = true;
    p.coopPlayer = true;
    const spawn = spawnOffset(level, index);
    p.x = spawn.x;
    p.y = spawn.y;
    p.tx = p.x;
    p.ty = p.y;
    p.vx = 0;
    p.vy = 0;
    p.aim = -Math.PI / 2;
    p.heading = -Math.PI / 2;
    p.ta = p.aim;
    p.dead = false;
    p.invuln = 0;
    p.magnet = false;
    p.pickupRadius = p.stats.pickupRadius || 95;
    return p;
  }

  function placeRemote(player, level, index) {
    const spawn = spawnOffset(level, index);
    player.x = spawn.x;
    player.y = spawn.y;
    player.tx = spawn.x;
    player.ty = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
  }

  Coop.isActive = function () {
    return Coop.active;
  };
  Coop.isHost = function () {
    return Coop.active && Coop.host;
  };
  Coop.isGuest = function () {
    return Coop.active && Coop.guest;
  };

  Coop.players = function () {
    const list = [];
    if (G.player) list.push(G.player);
    for (const player of Coop.remotePlayers) {
      if (player) list.push(player);
    }
    return list;
  };

  Coop.nearestPlayer = function (x, y) {
    let best = G.player;
    let bestDistance = Infinity;
    for (const player of Coop.players()) {
      if (!player || player.dead) continue;
      const distance = N.dist2(x, y, player.x, player.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = player;
      }
    }
    return best;
  };

  Coop.guestMirror = function () {
    return Coop.host ? (Coop.remotePlayers[0] || null) : null;
  };

  Coop.blocksLocalDamage = function () {
    return Coop.isGuest() && !Coop._applyingRemote;
  };

  Coop.init = function () {
    if (Coop._initialized || !N.Net) return;
    Coop._initialized = true;
    N.Net.onStatus = Coop.onStatus;
    N.Net.onMessage = Coop.onMessage;
    N.Net.onPeer = Coop.onPeer;
    N.Net.onError = Coop.onError;
  };

  Coop.onStatus = function (status) {
    Coop.status = status;
    if (N.UI && N.UI.updateCoopStatus) N.UI.updateCoopStatus(status);
    if (status && status.state === 'error' && N.UI) {
      N.UI.toast(status.detail || 'CO-OP ERROR', 'danger', 2600);
    }
  };

  Coop.onPeer = function (peer) {
    const previousId = Coop._peerId;
    const nextId = peer && peer.clientId ? peer.clientId : null;
    Coop.peerProfile = peer ? peer.profile : null;
    Coop._peerId = nextId;
    if (N.UI && N.UI.updateCoopPeer) N.UI.updateCoopPeer(peer);
    if (!Coop.active) return;
    if (!peer) {
      Coop.endSession('PEER DISCONNECTED');
    } else if (previousId && nextId && previousId !== nextId) {
      Coop.endSession('PEER CHANGED');
    }
  };

  Coop.onError = function (message) {
    const text = String(message || 'CO-OP ERROR');
    if (N.UI) N.UI.toast(text, 'danger', 2600);
    if (Coop.active) Coop.endSession(text);
  };

  Coop.hostRoom = function (profile) {
    Coop.localProfile = profileOf(Object.assign({}, profile, { name: 'PLAYER 1' }));
    return N.Net.host(Coop.localProfile);
  };

  Coop.joinRoom = function (code, profile) {
    Coop.localProfile = profileOf(Object.assign({}, profile, { name: 'PLAYER 2' }));
    return N.Net.join(code, Coop.localProfile);
  };

  Coop.startHostRun = function () {
    if (!N.Net.peer) {
      if (N.UI) N.UI.toast('WAITING FOR PLAYER 2', 'warn');
      return false;
    }
    if (Coop.active) return false;
    Coop.active = true;
    Coop.role = 'host';
    Coop.host = true;
    Coop.guest = false;
    Coop._ending = false;
    Coop.peerProfile = N.Net.peer.profile;
    Coop._peerId = N.Net.peer.clientId || null;
    Coop._bulletQueue = [];
    Coop._enemyBulletQueue = [];
    Coop._mineQueue = [];
    Coop._strikeQueue = [];

    const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    G.newRun(Coop.localProfile, { seed: seed, coop: true, name: 'PLAYER 1' });
    const mirror = makeRemotePlayer(Coop.peerProfile || { name: 'PLAYER 2' }, G.level, 1);
    Coop.remotePlayers = [mirror];
    Coop.started = true;
    Coop._stateAt = 0;
    Coop._worldAt = 0;
    Coop._flushAt = 0;

    N.Net.send({
      t: 'start',
      seed: seed,
      level: 1,
      host: profileOf(Coop.localProfile)
    });
    if (N.UI) {
      N.UI.hideAll();
      N.UI.toast('CO-OP LINK // PLAYER 2 CONNECTED', 'loot', 2200);
    }
    return true;
  };

  Coop.startGuestRun = function (message) {
    if (Coop.active) return false;
    const seed = finite(message.seed, 0) >>> 0;
    const levelNumber = Math.max(1, Math.min(99, Math.floor(finite(message.level, 1))));
    Coop.active = true;
    Coop.role = 'guest';
    Coop.host = false;
    Coop.guest = true;
    Coop._ending = false;
    Coop.peerProfile = message.host || null;
    Coop._peerId = message.host && message.host.clientId ? message.host.clientId : null;
    Coop.localProfile = profileOf(Object.assign({}, Coop.localProfile, { name: 'PLAYER 2' }));

    G.run = {
      seed: seed,
      mapVersion: 1,
      level: levelNumber,
      sectors: 0,
      kills: 0,
      totalTime: 0,
      damage: 0,
      startedAt: Date.now(),
      lastCheckpointAt: 0,
      checkpointLevel: 0
    };
    G.coopRun = true;
    G.player = G.makePlayer();
    Object.assign(G.player, N.Ships.selection(Coop.localProfile));
    G.player.name = 'PLAYER 2';
    G.player.coopGuest = true;
    G.level = G.generateLevel(levelNumber, null);
    const spawn = spawnOffset(G.level, 1);
    G.player.x = spawn.x;
    G.player.y = spawn.y;
    G.player.vx = 0;
    G.player.vy = 0;
    G.camera.x = spawn.x;
    G.camera.y = spawn.y;
    G.camera.shake = 0;
    G.camera.sx = 0;
    G.camera.sy = 0;
    G.camera.zoom = G.zoom;
    G.resetEntityArrays();
    Coop.remotePlayers = [makeRemotePlayer(message.host || { name: 'PLAYER 1' }, G.level, 0)];
    G.time = 0;
    G.glitch = 0;
    G.checkpointTimer = 99999;
    G.nextSurge = 99999;
    G.nextWarden = 99999;
    G.nextBoss = 99999;
    G.pendingLevelUps = 0;
    G.overflow = null;
    G.lastSummary = null;
    N.Rewards.reset();
    Coop.started = true;
    Coop._stateAt = 0;
    Coop._worldAt = 0;
    Coop._flushAt = 0;
    Coop._loadoutSignature = '';
    G.setMode('playing');
    if (N.UI) {
      N.UI.hideAll();
      N.UI.toast('CO-OP LINK // PLAYER 1 STARTED THE RUN', 'loot', 2200);
    }
    Coop.sendState(true);
    Coop.sendLoadout(true);
    return true;
  };

  Coop.startNextGuestLevel = function (message) {
    if (!Coop.isGuest()) return;
    const levelNumber = Math.max(1, Math.min(99, Math.floor(finite(message.level, 1))));
    const seed = finite(message.seed, G.run ? G.run.seed : 0) >>> 0;
    G.run.level = levelNumber;
    G.run.seed = seed;
    G.level = G.generateLevel(levelNumber, null);
    const spawn = spawnOffset(G.level, 0);
    G.player.x = spawn.x;
    G.player.y = spawn.y;
    G.player.vx = 0;
    G.player.vy = 0;
    G.player.hp = Math.min(G.player.stats.maxHp, G.player.hp + G.player.stats.maxHp * 0.35);
    G.player.shield = G.player.stats.maxShield;
    G.player.dead = false;
    G.camera.x = spawn.x;
    G.camera.y = spawn.y;
    G.camera.shake = 0;
    G.camera.sx = 0;
    G.camera.sy = 0;
    G.resetEntityArrays();
    const host = Coop.remotePlayers[0];
    if (host) placeRemote(host, G.level, 1);
    G.time = 0;
    G.glitch = 0;
    G.level.elapsed = 0;
    G.checkpointTimer = 99999;
    G.nextSurge = 99999;
    G.nextWarden = 99999;
    G.nextBoss = 99999;
    G.overflow = null;
    Coop._stateAt = 0;
    Coop._worldAt = 0;
    Coop._flushAt = 0;
    G.setMode('playing');
    if (N.UI) N.UI.hideAll();
    N.Audio.setScene('game');
    G.notify('SECTOR ' + String(levelNumber).padStart(2, '0') + ' // DESCENT CONFIRMED', 'loot', 2200);
  };

  Coop.endSession = function (reason) {
    if (Coop._ending) return;
    Coop._ending = true;
    Coop.resetPauseState();
    Coop.active = false;
    Coop.role = 'solo';
    Coop.host = false;
    Coop.guest = false;
    Coop.started = false;
    Coop.remotePlayers.length = 0;
    Coop.peerProfile = null;
    Coop._peerId = null;
    Coop._bulletQueue = [];
    Coop._enemyBulletQueue = [];
    Coop._mineQueue = [];
    Coop._strikeQueue = [];
    G.coopRun = false;
    if (N.Net) N.Net.leave(true);
    if (G.mode !== 'menu' && G.mode !== 'boot') G.setMode('menu');
    if (N.UI) {
      N.UI.hideAll();
      if (N.UI.showCoop) N.UI.showCoop(reason || 'LINK CLOSED');
      else N.UI.showMenu();
    }
    Coop._ending = false;
  };

  Coop.leaveToMenu = function () {
    Coop.resetPauseState();
    Coop.active = false;
    Coop.role = 'solo';
    Coop.host = false;
    Coop.guest = false;
    Coop.started = false;
    Coop.remotePlayers.length = 0;
    Coop.peerProfile = null;
    Coop._peerId = null;
    G.coopRun = false;
    if (N.Net) N.Net.leave();
    if (N.UI) {
      N.UI.hideAll();
      N.UI.showMenu();
    }
  };

  Coop.sendState = function () {
    const p = G.player;
    if (!p) return;
    N.Net.send({
      t: 'state',
      name: p.name || '',
      x: round(p.x, 1),
      y: round(p.y, 1),
      vx: round(p.vx, 1),
      vy: round(p.vy, 1),
      aim: round(p.aim, 3),
      heading: round(p.heading, 3),
      hp: round(p.hp, 1),
      maxHp: round(p.stats.maxHp, 1),
      shield: round(p.shield, 1),
      maxShield: round(p.stats.maxShield, 1),
      level: p.level,
      dead: !!p.dead,
      invuln: round(p.invuln, 2),
      shipType: p.shipType,
      shipColor: p.shipColor,
      magnet: !!(p.buffs && p.buffs.magnet > 0),
      pickupRadius: round(p.stats.pickupRadius || 95, 1)
    });
  };

  Coop.sendLoadout = function (force) {
    const p = G.player;
    if (!p || !Coop.isGuest()) return;
    const stats = {};
    for (const key of Object.keys(p.stats)) {
      const value = p.stats[key];
      if (typeof value === 'number' || typeof value === 'boolean') stats[key] = value;
    }
    const signature = JSON.stringify([
      p.weapons.map(function (weapon) { return [weapon.id, weapon.level, weapon.tier]; }),
      p.passives.map(function (mod) { return [mod.id, mod.stacks]; }),
      p.core || [],
      p.activeWeapon,
      stats
    ]);
    if (!force && signature === Coop._loadoutSignature) return;
    Coop._loadoutSignature = signature;
    N.Net.send({
      t: 'loadout',
      weapons: p.weapons.map(function (weapon) {
        return { id: weapon.id, level: weapon.level, tier: weapon.tier };
      }),
      passives: p.passives.map(function (mod) {
        return { id: mod.id, stacks: mod.stacks };
      }),
      core: (p.core || []).slice(),
      activeWeapon: p.activeWeapon,
      stats: stats
    });
  };

  function enemyRow(enemy) {
    return [
      enemy.id,
      enemy.style,
      enemy.role,
      enemy.name,
      round(enemy.x, 1),
      round(enemy.y, 1),
      round(enemy.r, 1),
      round(enemy.hp, 1),
      round(enemy.maxHp, 1),
      round(enemy.shield || 0, 1),
      round(enemy.maxShield || 0, 1),
      round(enemy.angle, 3),
      round(enemy.spawnT || 0, 2),
      round(enemy.hitFlash || 0, 2),
      enemy.elite ? 1 : 0,
      enemy.boss ? 1 : 0,
      enemy.color,
      round(enemy.phase || 0, 2)
    ];
  }

  Coop.sendWorld = function () {
    if (!Coop.isHost() || !G.level) return;
    const enemies = [];
    for (const enemy of G.enemies) {
      if (!enemy.dead) enemies.push(enemyRow(enemy));
    }
    const anchors = G.level.anchors.map(function (anchor) {
      return [anchor.id, round(anchor.hp, 1), anchor.alive ? 1 : 0, round(anchor.hitFlash || 0, 2)];
    });
    const caches = G.level.caches.map(function (cache) {
      return [cache.id, round(cache.hp, 1), cache.alive ? 1 : 0, round(cache.hitFlash || 0, 2)];
    });
    const items = G.groundItems.filter(function (item) {
      return !item.collected;
    }).map(function (item) {
      return [
        item.id,
        item.kind,
        item.itemId,
        round(item.x, 1),
        round(item.y, 1),
        item.tier || 1,
        item.color,
        item.label || '',
        round(item.pickupDelay || 0, 2)
      ];
    });
    N.Net.send({
      t: 'world',
      time: round(G.level.elapsed, 2),
      kills: G.level.kills || 0,
      totalKills: G.run ? G.run.kills || 0 : 0,
      damage: round(G.level.damage || 0, 0),
      e: enemies,
      a: anchors,
      c: caches,
      g: items
    });
  };

  function bulletPayload(bullet) {
    return {
      x: round(bullet.x, 1),
      y: round(bullet.y, 1),
      angle: round(bullet.angle, 3),
      speed: round(bullet.speed, 1),
      size: bullet.size,
      life: round(bullet.life, 2),
      color: bullet.color,
      kind: bullet.kind,
      pierce: bullet.pierce || 0,
      bounce: bullet.bounce || 0,
      chain: bullet.chain || 0,
      aoe: bullet.aoe || 0,
      curve: bullet.curve || 0,
      homing: !!bullet.homing,
      turnRate: bullet.turnRate || 0,
      accel: bullet.accel || 0,
      trail: !!bullet.trail,
      dot: !!bullet.dot,
      tick: bullet.tick || 0,
      pull: bullet.pull || 0,
      explode: !!bullet.explode,
      weaponId: bullet.weaponId || null,
      critChance: bullet.critChance || 0,
      critMul: bullet.critMul || 1.75
    };
  }

  function minePayload(mine) {
    return {
      x: round(mine.x, 1),
      y: round(mine.y, 1),
      owner: mine.owner,
      damage: round(mine.damage, 1),
      radius: round(mine.radius, 1),
      color: mine.color,
      life: round(mine.life, 2),
      armTime: round(mine.armTime, 2)
    };
  }

  function strikePayload(strike) {
    return {
      x: round(strike.x, 1),
      y: round(strike.y, 1),
      delay: round(strike.delay, 2),
      radius: round(strike.radius, 1),
      damage: round(strike.damage, 1),
      color: strike.color
    };
  }

  Coop.preUpdate = function (dt) {
    if (!Coop.active) return;
    const now = clock();
    if (Coop.host) {
      const mirror = Coop.remotePlayers[0];
      if (mirror) {
        const follow = Math.min(1, dt * 18);
        mirror.x += (mirror.tx - mirror.x) * follow;
        mirror.y += (mirror.ty - mirror.y) * follow;
        mirror.aim = N.lerpAngle(mirror.aim, mirror.ta, follow);
      }
    }
    if (now - Coop._stateAt >= STATE_INTERVAL_MS) {
      Coop._stateAt = now;
      Coop.sendState();
      if (Coop.guest) Coop.sendLoadout(false);
    }
    if (Coop.host && now - Coop._worldAt >= WORLD_INTERVAL_MS) {
      Coop._worldAt = now;
      Coop.sendWorld();
    }
    if (Coop.host && now - Coop._flushAt >= FLUSH_INTERVAL_MS) {
      Coop._flushAt = now;
      flushQueues();
    }
  };

  function flushQueues() {
    if (!Coop.host) return;
    if (Coop._bulletQueue.length) {
      N.Net.send({ t: 'bullet', b: Coop._bulletQueue.splice(0, MAX_QUEUED_BULLETS) });
    }
    if (Coop._enemyBulletQueue.length) {
      N.Net.send({ t: 'ebullet', b: Coop._enemyBulletQueue.splice(0, MAX_QUEUED_BULLETS) });
    }
    if (Coop._mineQueue.length) {
      N.Net.send({ t: 'mine', b: Coop._mineQueue.splice(0, MAX_QUEUED_BULLETS) });
    }
    if (Coop._strikeQueue.length) {
      N.Net.send({ t: 'strike', b: Coop._strikeQueue.splice(0, MAX_QUEUED_BULLETS) });
    }
  }

  Coop.updateGuest = function (dt) {
    const p = G.player;
    if (!p) return;
    if (!p.dead) G.updatePlayer(dt);
    G.updatePlayerBullets(dt);
    G.updateEnemyBullets(dt);
    G.updateMines(dt);
    G.updateOrbitals(dt);
    G.updateStrikes(dt);
    G.updateEffects(dt);
    Coop.updateGuestWorld(dt);
  };

  Coop.updateGuestWorld = function (dt) {
    if (!Coop.isGuest() || !G.level) return;
    G.level.elapsed = Math.min(G.DURATION, G.level.elapsed + dt);
    const follow = Math.min(1, dt * 12);
    for (const enemy of G.enemies) {
      if (enemy.tx != null) enemy.x += (enemy.tx - enemy.x) * follow;
      if (enemy.ty != null) enemy.y += (enemy.ty - enemy.y) * follow;
      if (enemy.ta != null) enemy.angle = N.lerpAngle(enemy.angle, enemy.ta, follow);
      enemy.spawnT = Math.max(0, (enemy.spawnT || 0) - dt);
      enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt * 5);
      enemy.hitPulse = (enemy.hitPulse || 0) + dt * 6;
      enemy.phase = (enemy.phase || 0) + dt * 0.7;
    }
    for (const anchor of G.level.anchors) {
      if (!anchor.alive) continue;
      anchor.phase = (anchor.phase || 0) + dt * 0.7;
      anchor.hitFlash = Math.max(0, (anchor.hitFlash || 0) - dt * 4);
    }
    for (const cache of G.level.caches) {
      if (!cache.alive) continue;
      cache.phase = (cache.phase || 0) + dt * 1.2;
      cache.angle = (cache.angle || 0) + (cache.spin || 0) * dt;
      cache.hitFlash = Math.max(0, (cache.hitFlash || 0) - dt * 4);
    }
    const host = Coop.remotePlayers[0];
    if (host) {
      host.x += (host.tx - host.x) * follow;
      host.y += (host.ty - host.y) * follow;
      host.aim = N.lerpAngle(host.aim, host.ta, follow);
      host.hitFlash = Math.max(0, (host.hitFlash || 0) - dt * 3.8);
      host.invuln = Math.max(0, (host.invuln || 0) - dt);
    }
  };

  Coop.applyRemoteState = function (message) {
    const mirror = Coop.remotePlayers[0];
    if (!mirror) return;
    mirror.name = String(message.name || mirror.name).slice(0, 20);
    mirror.tx = finite(message.x, mirror.x);
    mirror.ty = finite(message.y, mirror.y);
    mirror.vx = finite(message.vx, 0);
    mirror.vy = finite(message.vy, 0);
    mirror.ta = finite(message.aim, mirror.aim);
    mirror.heading = finite(message.heading, mirror.heading);
    mirror.hp = finite(message.hp, mirror.hp);
    mirror.shield = finite(message.shield, mirror.shield);
    mirror.stats.maxHp = finite(message.maxHp, mirror.stats.maxHp);
    mirror.stats.maxShield = finite(message.maxShield, mirror.stats.maxShield);
    mirror.level = Math.max(1, Math.floor(finite(message.level, mirror.level || 1)));
    mirror.dead = !!message.dead;
    mirror.invuln = finite(message.invuln, 0);
    mirror.shipType = N.Ships.get(message.shipType).id;
    mirror.shipColor = N.Ships.selection({ shipType: mirror.shipType, shipColor: message.shipColor }).shipColor;
    mirror.magnet = !!message.magnet;
    mirror.pickupRadius = finite(message.pickupRadius, mirror.pickupRadius || 95);
  };

  Coop.applyLoadout = function (message) {
    const mirror = Coop.guestMirror();
    if (!mirror) return;
    mirror.weapons = (message.weapons || []).filter(function (weapon) {
      return weapon && N.WEAPON_BY_ID[weapon.id];
    }).map(function (weapon) {
      return G.makeWeapon(weapon.id, weapon.tier || 1, weapon.level || 1);
    });
    if (!mirror.weapons.length) mirror.weapons = [G.makeWeapon(N.STARTING_WEAPON, 1, 1)];
    mirror.passives = (message.passives || []).filter(function (mod) {
      return mod && N.MOD_BY_ID[mod.id];
    }).map(function (mod) {
      return { id: mod.id, stacks: Math.max(1, Math.floor(finite(mod.stacks, 1))) };
    });
    mirror.core = (message.core || []).filter(function (id) {
      return N.PROTOCOL_BY_ID[id];
    });
    mirror.activeWeapon = Math.max(0, Math.min(mirror.weapons.length - 1, Math.floor(finite(message.activeWeapon, 0))));
    if (message.stats && typeof message.stats === 'object') {
      for (const key of Object.keys(message.stats)) {
        const value = message.stats[key];
        if (typeof value === 'number' || typeof value === 'boolean') mirror.stats[key] = value;
      }
    }
  };

  Coop.applyWorld = function (message) {
    if (!Coop.isGuest() || !G.level) return;
    G.level.elapsed = Math.min(G.DURATION, finite(message.time, G.level.elapsed));
    G.level.kills = Math.max(0, Math.floor(finite(message.kills, G.level.kills)));
    if (G.run) G.run.kills = Math.max(0, Math.floor(finite(message.totalKills, G.run.kills)));
    G.level.damage = Math.max(0, finite(message.damage, G.level.damage));

    const seen = new Set();
    const rows = Array.isArray(message.e) ? message.e : [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 18) continue;
      const id = row[0];
      seen.add(id);
      let enemy = G.enemies.find(function (item) { return item.id === id; });
      if (!enemy) {
        enemy = {
          id: id,
          style: row[1],
          styleDef: N.ENEMY_BY_ID[row[1]] || N.ENEMY_BY_ID.dart,
          role: row[2],
          name: row[3],
          x: finite(row[4], 0),
          y: finite(row[5], 0),
          tx: finite(row[4], 0),
          ty: finite(row[5], 0),
          r: finite(row[6], 12),
          hp: finite(row[7], 1),
          maxHp: finite(row[8], 1),
          shield: finite(row[9], 0),
          maxShield: finite(row[10], 0),
          angle: finite(row[11], 0),
          ta: finite(row[11], 0),
          spawnT: finite(row[12], 0),
          hitFlash: finite(row[13], 0),
          elite: !!row[14],
          boss: !!row[15],
          color: row[16] || '#ff335c',
          phase: finite(row[17], 0),
          hitPulse: 0,
          dead: false,
          alive: true,
          vx: 0,
          vy: 0,
          worldX: finite(row[4], 0),
          worldY: finite(row[5], 0),
          lastHit: -99,
          activeBoss: false
        };
        G.enemies.push(enemy);
      } else {
        enemy.tx = finite(row[4], enemy.x);
        enemy.ty = finite(row[5], enemy.y);
        enemy.ta = finite(row[11], enemy.angle);
        enemy.r = finite(row[6], enemy.r);
        enemy.hp = finite(row[7], enemy.hp);
        enemy.maxHp = finite(row[8], enemy.maxHp);
        enemy.shield = finite(row[9], 0);
        enemy.maxShield = finite(row[10], 0);
        enemy.spawnT = Math.min(enemy.spawnT || 0, finite(row[12], 0));
        enemy.hitFlash = Math.max(enemy.hitFlash || 0, finite(row[13], 0));
        enemy.elite = !!row[14];
        enemy.boss = !!row[15];
        enemy.color = row[16] || enemy.color;
        enemy.phase = finite(row[17], enemy.phase);
        enemy.dead = false;
        enemy.alive = true;
      }
      enemy.worldX = enemy.x;
      enemy.worldY = enemy.y;
    }
    for (let index = G.enemies.length - 1; index >= 0; index--) {
      if (!seen.has(G.enemies[index].id)) G.enemies.splice(index, 1);
    }
    G.level.activeBoss = G.enemies.find(function (enemy) { return enemy.boss; }) || null;

    const anchors = Array.isArray(message.a) ? message.a : [];
    for (const row of anchors) {
      const anchor = G.level.anchors.find(function (item) { return item.id === row[0]; });
      if (!anchor) continue;
      anchor.hp = finite(row[1], anchor.hp);
      anchor.alive = !!row[2];
      anchor.hitFlash = Math.max(anchor.hitFlash || 0, finite(row[3], 0));
    }
    const caches = Array.isArray(message.c) ? message.c : [];
    for (const row of caches) {
      const cache = G.level.caches.find(function (item) { return item.id === row[0]; });
      if (!cache) continue;
      cache.hp = finite(row[1], cache.hp);
      cache.alive = !!row[2];
      cache.hitFlash = Math.max(cache.hitFlash || 0, finite(row[3], 0));
    }

    const items = Array.isArray(message.g) ? message.g : [];
    const ground = items.map(function (row) {
      return {
        id: row[0],
        kind: row[1],
        itemId: row[2],
        x: finite(row[3], 0),
        y: finite(row[4], 0),
        tier: finite(row[5], 1),
        color: row[6] || '#00f0ff',
        label: row[7] || null,
        pickupDelay: finite(row[8], 0),
        angle: 0,
        phase: 0,
        collected: false
      };
    });
    G.groundItems = ground;
    G.level.groundItems = ground;
  };

  Coop.onMessage = function (message) {
    if (!message || typeof message !== 'object') return;
    switch (message.t) {
      case 'start':
        Coop.startGuestRun(message);
        break;
      case 'state':
        Coop.applyRemoteState(message);
        break;
      case 'loadout':
        Coop.applyLoadout(message);
        break;
      case 'world':
        Coop.applyWorld(message);
        break;
      case 'bullet':
        applyBulletBatch(message.b);
        break;
      case 'ebullet':
        applyEnemyBulletBatch(message.b);
        break;
      case 'mine':
        applyMineBatch(message.b);
        break;
      case 'strike':
        applyStrikeBatch(message.b);
        break;
      case 'fire':
        Coop.onGuestFire(message);
        break;
      case 'hit':
        Coop.applyRemoteHit(message);
        break;
      case 'grant':
        Coop.applyGrant(message.item);
        break;
      case 'xp':
        G.addXp(Math.max(0, finite(message.amount, 0)));
        break;
      case 'heal':
        if (Coop.isGuest() && G.player && !G.player.dead) {
          const healed = Math.max(0, finite(message.amount, 0));
          G.player.hp = Math.min(G.player.stats.maxHp, G.player.hp + healed);
          if (healed >= 1) G.addText(G.player.x, G.player.y - 28, '+' + Math.round(healed), '#b6ff2b', 11);
        }
        break;
      case 'kill':
        N.Rewards.onKill();
        if (finite(message.xp, 0) > 0) G.addXp(finite(message.xp, 0));
        break;
      case 'complete':
        Coop.applyComplete(message.summary);
        break;
      case 'advance':
        Coop.startNextGuestLevel(message);
        break;
      case 'gameover':
        Coop.applyRemoteGameOver();
        break;
      case 'pause':
        Coop.applyRemotePause(!!message.paused);
        break;
      case 'global_pause':
        Coop.applyGlobalPause(message.by);
        break;
      case 'ready_state':
        Coop.applyReadyState(message.ready);
        break;
      case 'countdown_start':
        Coop.applyCountdownStart(finite(message.seconds, 3));
        break;
      case 'global_resume':
        Coop.applyGlobalResume();
        break;
      case 'fx':
        Coop.applyFx(message);
        break;
      case 'bye':
        Coop.endSession('PLAYER LEFT THE SESSION');
        break;
      default:
        break;
    }
  };

  function applyBulletBatch(batch) {
    if (!Coop.isGuest() || !Array.isArray(batch)) return;
    for (const data of batch) {
      if (!data) continue;
      G.spawnBullet(Object.assign({}, data, { coopCosmetic: true, hitSet: new Set() }));
    }
  }

  function applyEnemyBulletBatch(batch) {
    if (!Coop.isGuest() || !Array.isArray(batch)) return;
    for (const data of batch) {
      if (!data) continue;
      G.spawnEnemyBullet(Object.assign({}, data, { coopCosmetic: true }));
    }
  }

  function applyMineBatch(batch) {
    if (!Coop.isGuest() || !Array.isArray(batch)) return;
    for (const data of batch) {
      if (!data) continue;
      G.spawnMine(Object.assign({}, data, { coopCosmetic: true }));
    }
  }

  function applyStrikeBatch(batch) {
    if (!Coop.isGuest() || !Array.isArray(batch)) return;
    for (const data of batch) {
      if (!data) continue;
      G.spawnStrike(Object.assign({}, data, { coopCosmetic: true }));
    }
  }

  Coop.onGuestFire = function (message) {
    if (!Coop.isHost()) return;
    const mirror = Coop.guestMirror();
    if (!mirror || mirror.dead) return;
    const now = clock();
    if (now - Coop._fireWindow > 1000) {
      Coop._fireWindow = now;
      Coop._fireCount = 0;
    }
    if (Coop._fireCount >= FIRE_BUDGET_PER_SECOND) return;
    Coop._fireCount++;
    const angle = finite(message.a, mirror.aim);
    mirror.x = finite(message.x, mirror.x);
    mirror.y = finite(message.y, mirror.y);
    mirror.tx = mirror.x;
    mirror.ty = mirror.y;
    const weapon = mirror.weapons.find(function (item) { return item.id === message.w; }) || mirror.weapons[mirror.activeWeapon];
    if (!weapon) return;
    Coop.fireForPlayer(mirror, weapon, angle);
  };

  Coop.fireForPlayer = function (player, weapon, angle) {
    const previousPlayer = G.player;
    const previousAim = G.aim;
    const previousFiring = G.coopFiringPlayer;
    G.player = player;
    G.aim = {
      angle: angle,
      fire: true,
      source: 'coop',
      point: { x: player.x + Math.cos(angle) * 280, y: player.y + Math.sin(angle) * 280 }
    };
    G.coopFiringPlayer = player;
    try {
      G.fireWeapon(weapon);
    } finally {
      G.player = previousPlayer;
      G.aim = previousAim;
      G.coopFiringPlayer = previousFiring;
    }
  };

  Coop.applyRemoteHit = function (message) {
    if (!Coop.isGuest() || !G.player || G.player.dead) return;
    if (G.mode !== 'playing') return;
    const amount = Math.max(0, finite(message.amount, 0));
    if (!amount) return;
    Coop._applyingRemote = true;
    try {
      G.damagePlayer(amount, finite(message.x, G.player.x), finite(message.y, G.player.y), !!message.contact);
    } finally {
      Coop._applyingRemote = false;
    }
  };

  Coop.sendHeal = function (amount) {
    if (!Coop.isHost() || !(amount > 0)) return;
    N.Net.send({ t: 'heal', amount: round(amount, 1) });
  };

  Coop.sendHit = function (player, amount, x, y, contact) {
    if (!Coop.isHost() || !player || player === G.player) return false;
    player.invuln = Math.max(player.invuln || 0, 0.68);
    N.Net.send({ t: 'hit', amount: round(amount, 1), x: round(x, 1), y: round(y, 1), contact: !!contact });
    return true;
  };

  Coop.applyGrant = function (item) {
    if (!Coop.isGuest() || !item || !G.player) return;
    G.collectGroundItem({
      id: item.id,
      kind: item.kind,
      itemId: item.itemId,
      x: finite(item.x, G.player.x),
      y: finite(item.y, G.player.y),
      tier: finite(item.tier, 1),
      color: item.color || '#00f0ff',
      label: item.label || null,
      pickupDelay: 0,
      angle: 0,
      phase: 0
    }, false);
    Coop.sendLoadout(true);
  };

  Coop.grantToGuest = function (item) {
    if (!Coop.isHost() || !item) return;
    N.Net.send({
      t: 'grant',
      item: {
        id: item.id,
        kind: item.kind,
        itemId: item.itemId,
        x: round(item.x, 1),
        y: round(item.y, 1),
        tier: item.tier || 1,
        color: item.color,
        label: item.label || null
      }
    });
  };

  Coop.applyComplete = function (summary) {
    if (!Coop.isGuest() || !summary) return;
    G.lastSummary = summary;
    if (G.run) {
      G.run.sectors = Math.max(G.run.sectors || 0, finite(summary.sectors, 0));
      G.run.totalTime = Math.max(G.run.totalTime || 0, finite(summary.time, 0));
      G.run.level = Math.max(G.run.level, finite(summary.nextLevel, G.run.level));
    }
    G.setMode('complete');
    N.Input.resetFire();
    if (N.UI) N.UI.showComplete(summary);
  };

  Coop.applyRemoteGameOver = function () {
    if (Coop._applyingRemote) return;
    Coop._applyingRemote = true;
    try {
      G.gameOver();
    } finally {
      Coop._applyingRemote = false;
    }
  };

  Coop.showPauseState = function () {
    if (!N.UI) return;
    if (Coop.pauseState === 'COUNTDOWN' && N.UI.showCoopCountdown) {
      N.UI.showCoopCountdown(Coop.countdownRemaining || 3);
    } else if (N.UI.showPause) {
      N.UI.showPause(G.getPauseData());
    }
  };

  Coop.applyRemotePause = function (paused) {
    if (Coop._applyingRemote) return;
    Coop._applyingRemote = true;
    try {
      if (paused && G.mode === 'playing') G.pauseGame();
      else if (!paused && G.mode === 'paused') G.resumeGame();
    } finally {
      Coop._applyingRemote = false;
    }
  };

  Coop.resetPauseState = function () {
    Coop.pauseState = 'PLAY';
    Coop.pauseOwner = null;
    Coop.readyPeers = [];
    Coop.countdownRemaining = 0;
    Coop._readySent = false;
    clearInterval(Coop._countdownTimer);
    clearTimeout(Coop._countdownFallback);
    Coop._countdownTimer = null;
    Coop._countdownFallback = null;
  };

  Coop.requestGlobalPause = function () {
    if (!Coop.active || Coop._applyingRemote) return false;
    if (Coop.pauseState !== 'PLAY') return false;
    Coop.pauseState = 'PAUSED';
    Coop.pauseOwner = N.Net.clientId || null;
    Coop.readyPeers = [];
    Coop._readySent = false;
    N.Net.sendControl({ t: 'pause_request' });
    return true;
  };

  Coop.sendReady = function () {
    if (!Coop.active) return false;
    if (Coop.pauseState !== 'PAUSED') return false;
    if (Coop._readySent) return false;
    Coop._readySent = true;
    N.Net.sendControl({ t: 'ready_signal' });
    if (N.UI && N.UI.updateCoopPause) N.UI.updateCoopPause({ owner: Coop.pauseOwner, ready: Coop.readyPeers, selfReady: true });
    return true;
  };

  Coop.applyGlobalPause = function (by) {
    if (!Coop.active) return;
    Coop.pauseState = 'PAUSED';
    Coop.pauseOwner = by || null;
    Coop.readyPeers = [];
    Coop._readySent = false;
    Coop._applyingRemote = true;
    try {
      if (G.mode === 'playing') {
        G.pauseGame();
      } else if (G.mode === 'paused' && N.UI && N.UI.showCoopPause) {
        N.UI.showCoopPause({ owner: Coop.pauseOwner, ready: Coop.readyPeers });
      }
    } finally {
      Coop._applyingRemote = false;
    }
  };

  Coop.applyReadyState = function (ready) {
    if (!Coop.active) return;
    Coop.readyPeers = Array.isArray(ready) ? ready.slice() : [];
    if (N.UI && N.UI.updateCoopPause) {
      N.UI.updateCoopPause({ owner: Coop.pauseOwner, ready: Coop.readyPeers, selfReady: Coop._readySent });
    }
  };

  Coop.applyCountdownStart = function (seconds) {
    if (!Coop.active) return;
    const total = Math.max(1, finite(seconds, 3));
    Coop.pauseState = 'COUNTDOWN';
    Coop.countdownRemaining = total;
    Coop._readySent = false;
    Coop._applyingRemote = true;
    try {
      if (G.mode === 'playing') G.pauseGame();
    } finally {
      Coop._applyingRemote = false;
    }
    if (N.UI && N.UI.showCoopCountdown) N.UI.showCoopCountdown(total);
    clearInterval(Coop._countdownTimer);
    clearTimeout(Coop._countdownFallback);
    Coop._countdownTimer = setInterval(function () {
      Coop.countdownRemaining = Math.max(0, Coop.countdownRemaining - 1);
      if (N.UI && N.UI.updateCoopCountdown) N.UI.updateCoopCountdown(Coop.countdownRemaining);
      if (Coop.countdownRemaining <= 0) {
        clearInterval(Coop._countdownTimer);
        Coop._countdownTimer = null;
      }
    }, 1000);
    Coop._countdownFallback = setTimeout(function () {
      Coop._countdownFallback = null;
      if (Coop.pauseState === 'COUNTDOWN') Coop.applyGlobalResume();
    }, (total + 1.5) * 1000);
  };

  Coop.applyGlobalResume = function () {
    if (!Coop.active) return;
    Coop.resetPauseState();
    Coop._applyingRemote = true;
    try {
      if (G.mode !== 'playing') G.resumeGame();
    } finally {
      Coop._applyingRemote = false;
    }
    if (N.UI && N.UI.hideAll) N.UI.hideAll();
  };

  Coop.applyFx = function (message) {
    if (!Coop.isGuest()) return;
    if (message.kind === 'beam') {
      G.addBeam(finite(message.x1, 0), finite(message.y1, 0), finite(message.x2, 0), finite(message.y2, 0), message.color || '#00f0ff', finite(message.width, 4), finite(message.life, 0.16));
    } else if (message.kind === 'explode') {
      G.addRing(finite(message.x, 0), finite(message.y, 0), finite(message.r, 50), message.color || '#ffb31f', 0.42, 2.2);
      G.addParticles(finite(message.x, 0), finite(message.y, 0), message.color || '#ffb31f', 14, { speed: 200, life: 0.6, size: 2 });
      G.shake(2);
    }
  };

  Coop.onLocalFire = function () {
    if (!Coop.isGuest() || !G.player) return;
    N.Net.send({ t: 'fire', w: G.player.weapons[G.player.activeWeapon] ? G.player.weapons[G.player.activeWeapon].id : null, a: round(G.aim.angle, 3), x: round(G.player.x, 1), y: round(G.player.y, 1) });
  };

  Coop.onPlayerBullet = function (bullet) {
    if (!Coop.isHost()) return;
    if (bullet.coopPlayer && bullet.coopPlayer !== G.player) return;
    if (Coop._bulletQueue.length < MAX_QUEUED_BULLETS) Coop._bulletQueue.push(bulletPayload(bullet));
  };

  Coop.onEnemyBullet = function (bullet) {
    if (!Coop.isHost()) return;
    if (Coop._enemyBulletQueue.length < MAX_QUEUED_BULLETS) {
      Coop._enemyBulletQueue.push(bulletPayload(bullet));
    }
  };

  Coop.onMine = function (mine) {
    if (!Coop.isHost()) return;
    if (mine.coopPlayer && mine.coopPlayer !== G.player) return;
    if (Coop._mineQueue.length < MAX_QUEUED_BULLETS) Coop._mineQueue.push(minePayload(mine));
  };

  Coop.onStrike = function (strike) {
    if (!Coop.isHost()) return;
    if (strike.coopPlayer && strike.coopPlayer !== G.player) return;
    if (Coop._strikeQueue.length < MAX_QUEUED_BULLETS) Coop._strikeQueue.push(strikePayload(strike));
  };

  Coop.onBeam = function (x1, y1, x2, y2, color, width, life) {
    if (!Coop.isHost()) return;
    if (G.coopFiringPlayer && G.coopFiringPlayer !== G.player) return;
    N.Net.send({ t: 'fx', kind: 'beam', x1: round(x1, 1), y1: round(y1, 1), x2: round(x2, 1), y2: round(y2, 1), color: color, width: width, life: life });
  };

  Coop.onExplosion = function (x, y, radius, color) {
    if (!Coop.isHost()) return;
    if (G.coopFiringPlayer && G.coopFiringPlayer !== G.player) return;
    N.Net.send({ t: 'fx', kind: 'explode', x: round(x, 1), y: round(y, 1), r: round(radius, 1), color: color });
  };

  Coop.onHostKill = function (xp, byHost) {
    if (!Coop.isHost()) return;
    N.Net.send({ t: 'kill', xp: byHost ? 0 : round(xp, 0) });
  };

  Coop.onHostComplete = function (summary) {
    if (!Coop.isHost()) return;
    N.Net.send({ t: 'complete', summary: summary });
  };

  Coop.onHostAdvance = function () {
    if (!Coop.isHost() || !G.run) return;
    N.Net.send({ t: 'advance', seed: G.run.seed, level: G.run.level });
  };

  Coop.onLocalGameOver = function () {
    if (!Coop.active || Coop._applyingRemote) return;
    N.Net.send({ t: 'gameover' });
  };

  Coop.onPause = function (paused) {
    if (!Coop.active || Coop._applyingRemote) return;
    if (paused) {
      Coop.requestGlobalPause();
    }
  };

  Coop.init();
})();
