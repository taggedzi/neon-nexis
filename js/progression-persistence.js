/* Strict external boundaries for uninterrupted progression (issue 048). */
(function () {
  'use strict';
  const N = window.NEON;
  const P = N.ProgressionPersistence = {};
  const CAPS = { reinforced_hull: 10, shield_capacitor: 10, thruster_tuning: 5,
    weapon_amplifier: 10, cooling_system: 6, reactive_plating: 5, recovery_circuit: 5 };
  const copy = value => JSON.parse(JSON.stringify(value));
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const count = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
  const timer = value => Number.isFinite(value) && value >= 0;
  // Both current map families and the retained open-world generator fit these
  // bounds. Reject extreme finite values before geometry arithmetic can overflow.
  const worldX = value => Number.isFinite(value) && value >= 0 && value <= 4400;
  const worldY = value => Number.isFinite(value) && value >= 0 && value <= 3200;
  const token = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
  const identity = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value);
  const keysOnly = (value, keys) => Object.keys(value).every(key => keys.includes(key));
  const equivalent = (left, right) => {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equivalent(left[key], right[key]));
  };
  const xpNext = level => 38 + (level - 1) * 11;
  P.versions = Object.freeze({ checkpoint: 2, loadouts: 2, backup: 5, wire: 7, loadoutRules: 2 });
  P.maxBytes = 1000000;

  P.validateProgression = function (state, hullId) {
    if (!plain(state) || !keysOnly(state, ['schemaVersion', 'catalogVersion', 'offensive', 'selectedOffensiveSlot',
      'switchDelaySeconds', 'defensive', 'passives', 'level', 'xp', 'nextPassiveIndex', 'salvage', 'revision', 'appliedEventSequence']) || !N.Equipment.isValidState(state) ||
        state.offensive[0].id !== N.ProgressionContent.primaryForHull(hullId) ||
        !state.offensive[state.selectedOffensiveSlot] || !plain(state.passives) ||
        !count(state.level, 1) || !Number.isSafeInteger(xpNext(state.level)) || !timer(state.xp) || state.xp >= xpNext(state.level) ||
        state.nextPassiveIndex !== (state.level - 1) % 7 || !timer(state.salvage) ||
        !count(state.revision) || state.revision === Number.MAX_SAFE_INTEGER || !count(state.appliedEventSequence)) return false;
    for (const [id, stacks] of Object.entries(state.passives)) {
      if (!Object.hasOwn(CAPS, id) || !count(stacks, 1) || stacks > CAPS[id]) return false;
    }
    return [...state.offensive, state.defensive].every(slot => slot === null || keysOnly(slot, ['id', 'level', 'cooldownSeconds']));
  };

  P.validateResources = function (event, state, hullId) {
    if (!plain(event) || event.type !== 'resource' || !token(event.runToken) || !identity(event.participantId) ||
        !count(event.resourceRevision) || !count(event.progressionSequence) ||
        event.maxDashCharges !== 1 || !count(event.dashCharges) || event.dashCharges > event.maxDashCharges ||
        !timer(event.dashTimer) || event.dashTimer > 2.7 || !timer(event.dashTime) || event.dashTime > .17 || !Number.isFinite(event.dashDir) ||
        ![event.hp, event.shield, event.invuln, event.shieldDelay].every(timer) ||
        typeof event.dead !== 'boolean' || !plain(event.buffs) || !keysOnly(event.buffs, ['overclock', 'speed', 'magnet']) ||
        !['overclock', 'speed', 'magnet'].every(key => timer(event.buffs[key])) ||
        !N.ProgressionDefense.restoreBarrier({}, event.barrier).ok || (event.dead && event.hp !== 0)) return false;
    if (state) {
      if (!P.validateProgression(state, hullId) || event.progressionSequence > state.appliedEventSequence) return false;
      const stats = N.ProgressionStats.derive(hullId, state);
      if (!stats || event.hp > stats.maxHp || event.shield > stats.maxShield || event.maxDashCharges !== stats.dashCharges) return false;
    }
    return true;
  };

  P.applyResources = function (player, event, runToken) {
    if (!P.validateResources(event) || event.runToken !== runToken ||
        event.participantId !== (player.clientId || player.participantId)) return { ok: false, reason: 'invalid-resource' };
    if (event.progressionSequence > player.progression.appliedEventSequence) return { ok: false, reason: 'progression-required' };
    if (!P.validateResources(event, player.progression, player.shipType)) return { ok: false, reason: 'invalid-resource' };
    if (event.resourceRevision <= (player.resourceRevision || 0)) return { ok: true, duplicate: true };
    const next = copy(event);
    if (!player.dead && next.dead && player === N.Game?.player) {
      N.Input?.resetMovement();
      N.Input?.resetFire();
    }
    Object.assign(player, { hp: next.hp, shield: next.shield, dead: next.dead, buffs: next.buffs,
      invuln: next.invuln, shieldDelay: next.shieldDelay, barrier: next.barrier, resourceRevision: next.resourceRevision });
    for (const key of ['dashCharges', 'maxDashCharges', 'dashTimer', 'dashTime', 'dashDir']) player[key] = next[key];
    return { ok: true };
  };

  P.validateSnapshot = function (snapshot) {
    return plain(snapshot) && token(snapshot.runToken) && identity(snapshot.participantId) && count(snapshot.sequence) &&
      typeof snapshot.shipColor === 'string' && /^#[0-9a-f]{6}$/i.test(snapshot.shipColor) &&
      P.validateProgression(snapshot.progression, snapshot.shipType) &&
      snapshot.sequence === snapshot.progression.appliedEventSequence &&
      P.validateResources(snapshot.resources, snapshot.progression, snapshot.shipType) &&
      snapshot.resources.runToken === snapshot.runToken && snapshot.resources.participantId === snapshot.participantId;
  };
  P.sameSnapshot = equivalent;

  P.adoptSnapshot = function (player, snapshot) {
    if (!P.validateSnapshot(snapshot) || snapshot.shipType !== player.shipType ||
        snapshot.participantId !== player.clientId) return { ok: false, reason: 'invalid-snapshot' };
    const sameRun = player.progressionRunToken === snapshot.runToken;
    if (sameRun && snapshot.sequence < player.progression.appliedEventSequence) {
      return P.applyResources(player, snapshot.resources, snapshot.runToken);
    }
    const preserved = sameRun && snapshot.resources.resourceRevision < (player.resourceRevision || 0) ? {
      hp: player.hp, shield: player.shield, dead: player.dead, buffs: player.buffs, barrier: player.barrier,
      invuln: player.invuln, shieldDelay: player.shieldDelay, resourceRevision: player.resourceRevision,
      dashCharges: player.dashCharges, maxDashCharges: player.maxDashCharges, dashTimer: player.dashTimer,
      dashTime: player.dashTime, dashDir: player.dashDir } : null;
    const result = N.ProgressionRewards.restoreSnapshot(player, snapshot);
    if (result.ok && preserved) Object.assign(player, preserved);
    return result;
  };

  P.validateRun = function (run) {
    if (!plain(run) || run.schemaVersion !== 1 || run.catalogVersion !== 1 || !token(run.runToken) ||
        !count(run.nextEventSequence, 1) || run.nextEventSequence === Number.MAX_SAFE_INTEGER ||
        !count(run.nextSourceSequence, 1) || run.nextSourceSequence === Number.MAX_SAFE_INTEGER || !Array.isArray(run.participantIds) ||
        run.participantIds.length < 1 || run.participantIds.length > 4 ||
        new Set(run.participantIds).size !== run.participantIds.length || !plain(run.participants) ||
        Object.keys(run.participants).length !== run.participantIds.length || !plain(run.pacing) ||
        typeof run.pacing.firstOrdinaryDrop !== 'boolean' || !timer(run.pacing.combatSeconds) ||
        !count(run.pacing.teamKills) || run.pacing.teamKills > (run.pacing.firstOrdinaryDrop ? 4 : 8) ||
        run.pacing.combatSeconds > (run.pacing.firstOrdinaryDrop ? 18 : 36) ||
        !Array.isArray(run.journal) || run.journal.length !== 0) return false;
    return run.participantIds.every(id => identity(id) && Object.hasOwn(run.participants, id) &&
      P.validateSnapshot(run.participants[id]) && run.participants[id].participantId === id &&
      run.participants[id].runToken === run.runToken && run.participants[id].sequence === run.nextEventSequence - 1);
  };

  P.validateShip = function (ship) {
    return plain(ship) && N.Loadouts.validName(ship.name) && count(ship.highestSector, 1) && plain(ship.player) &&
      keysOnly(ship.player, ['progressionMode', 'shipType', 'shipColor', 'progression']) &&
      ship.player.progressionMode === 'shared_v1' && /^#[0-9a-f]{6}$/i.test(ship.player.shipColor) &&
      P.validateProgression(ship.player.progression, ship.player.shipType) &&
      ship.player.progression.salvage === 0 && ship.player.progression.appliedEventSequence === 0 &&
      ship.player.progression.revision === 0 && ship.player.progression.switchDelaySeconds === 0 &&
      ship.player.progression.offensive.every(slot => !slot || slot.cooldownSeconds === 0) &&
      (!ship.player.progression.defensive || ship.player.progression.defensive.cooldownSeconds === 0);
  };

  P.captureShip = function (name, player, highestSector) {
    const state = copy(player.progression);
    state.salvage = state.revision = state.appliedEventSequence = state.switchDelaySeconds = 0;
    for (const slot of [...state.offensive, state.defensive]) if (slot) slot.cooldownSeconds = 0;
    return { name: name.trim(), highestSector, player: { progressionMode: 'shared_v1',
      shipType: player.shipType, shipColor: player.shipColor, progression: state } };
  };

  P.validate = function (value, kind = 'checkpoint') {
    let ok = false;
    if (kind === 'loadouts') {
      ok = plain(value) && value.version === 2 && Array.isArray(value.ships) && value.ships.length <= 3 &&
        value.ships.every(P.validateShip) && new Set(value.ships.map(ship => ship.name.toLowerCase())).size === value.ships.length;
    } else if (kind === 'checkpoint') {
      const p = value?.player, run = value?.run, level = value?.level;
      ok = plain(value) && value.version === 2 && value.progressionMode === 'shared_v1' && plain(run) &&
        Object.hasOwn(N.SKILLS, run.skill) && count(run.level, 1) && count(run.sectors) && count(run.highestSector, 1) &&
        count(run.seed) && run.seed <= 4294967295 && count(run.kills) &&
        [run.totalTime, run.damage, run.startedAt].every(timer) &&
        [0, 1].includes(run.mapVersion) && P.validateRun(run.progression) && run.progression.participantIds.length === 1 &&
        plain(p) && P.validateSnapshot(p.snapshot) && p.snapshot.runToken === run.progression.runToken &&
        equivalent(p.snapshot, run.progression.participants[p.snapshot.participantId]) &&
        worldX(p.x) && worldY(p.y) && [p.aim, p.heading].every(Number.isFinite) && count(p.dashCharges) && timer(p.dashTimer) &&
        p.dashCharges === p.snapshot.resources.dashCharges && p.dashTimer === p.snapshot.resources.dashTimer &&
        plain(level) && [level.elapsed, level.kills, level.damage].every(timer) &&
        Array.isArray(level.destroyedAnchors) && level.destroyedAnchors.length <= 1024 && level.destroyedAnchors.every(identity) &&
        Array.isArray(level.destroyedCaches) && level.destroyedCaches.length <= 1024 && level.destroyedCaches.every(identity) &&
        Array.isArray(level.groundItems) && new Set(level.groundItems.map(item => item?.id)).size === level.groundItems.length &&
        level.groundItems.length <= 4096 && level.groundItems.every(item => plain(item) && identity(item.id) &&
          (item.kind === 'consumable' ? Object.hasOwn(N.CONSUMABLES, item.itemId) :
            item.kind === 'equipment' && ['primary', 'offensive', 'defensive', 'passive'].includes(item.itemId)) &&
          worldX(item.x) && worldY(item.y) && [item.angle, item.phase].every(Number.isFinite) && timer(item.pickupDelay) &&
          item.progressionConsumed !== true && item.collected !== true);
      if (ok) {
        const prefix = 'loot_' + run.progression.runToken + '_';
        ok = level.groundItems.every(item => {
          if (!item.id.startsWith(prefix)) return false;
          const sequence = Number(item.id.slice(prefix.length));
          return count(sequence, 1) && String(sequence) === item.id.slice(prefix.length) && sequence < run.progression.nextSourceSequence;
        });
      }
    }
    return ok ? { ok: true, data: copy(value) } : { ok: false, reason: 'incompatible-' + kind };
  };

  P.read = function (raw, kind = 'checkpoint') {
    if (typeof raw !== 'string' || raw.length > P.maxBytes) return { ok: false, reason: 'invalid-data' };
    try { return P.validate(JSON.parse(raw), kind); } catch (error) { return { ok: false, reason: 'invalid-data' }; }
  };
  P.write = function (key, value, kind = 'checkpoint') {
    const checked = P.validate(value, kind);
    if (!checked.ok) return checked;
    return N.Storage.write(key, checked.data) ? { ok: true } : { ok: false, reason: 'storage' };
  };

  P.saveCheckpoint = function (game, silent, reason) {
    const runState = N.ProgressionRewards.runSnapshot({ run: game.run.progression });
    const player = game.player;
    const participantId = player.clientId || player.participantId;
    const run = {};
    for (const key of ['seed', 'mapVersion', 'highestSector', 'skill', 'level', 'sectors', 'kills', 'totalTime', 'damage', 'startedAt', 'tally']) {
      if (game.run[key] !== undefined) run[key] = copy(game.run[key]);
    }
    run.highestSector = Math.max(run.highestSector || 1, run.level);
    run.progression = runState;
    run.reason = reason;
    const data = { version: 2, progressionMode: 'shared_v1', savedAt: Date.now(), run,
      player: { snapshot: runState.participants[participantId], x: player.x, y: player.y,
        aim: player.aim, heading: player.heading, dashCharges: player.dashCharges, dashTimer: player.dashTimer },
      level: { elapsed: game.level.elapsed, bossSpawned: game.level.bossSpawned, wardenSpawned: game.level.wardenSpawned,
        kills: game.level.kills, damage: game.level.damage,
        destroyedAnchors: game.level.anchors.filter(item => !item.alive).map(item => item.id),
        destroyedCaches: game.level.caches.filter(item => !item.alive).map(item => item.id),
        groundItems: game.groundItems.filter(item => !item.collected).map(item => copy(item)) } };
    const checked = P.validate(data);
    if (!checked.ok) return false;
    game.lastCheckpoint = checked.data;
    const ok = N.writeSave(checked.data);
    if (!silent) game.notify(ok ? 'CHECKPOINT SYNCED' : 'CHECKPOINT HELD IN MEMORY // STORAGE OFFLINE', 'loot', 1700);
    return ok;
  };

  function prepareCheckpoint(game, save) {
    const previous = Object.getOwnPropertyDescriptors(game);
    let prepared = null;
    try {
      game.preparingCheckpoint = true;
      const snapshot = save.player.snapshot;
      const player = game.makePlayer({ shipType: snapshot.shipType, shipColor: snapshot.shipColor }, 'shared_v1');
      player.clientId = player.participantId = snapshot.participantId;
      if (!N.ProgressionRewards.restoreSnapshot(player, snapshot).ok) return null;
      for (const key of ['x', 'y', 'aim', 'heading', 'dashCharges', 'dashTimer']) player[key] = save.player[key];
      // Generation and geometry use the existing synchronous Game context.
      // Borrow it only during preflight; old objects/arrays remain untouched.
      game.run = copy(save.run);
      game.run.progressionMode = 'shared_v1';
      game.run.progression.participants = { [snapshot.participantId]: player };
      game.run.progression.journal = [];
      game.player = player;
      game.camera = { ...game.camera };
      for (const key of ['enemies', 'playerBullets', 'enemyBullets', 'mines', 'orbitals', 'strikes', 'effects', 'particles', 'texts', 'groundItems']) game[key] = [];
      game.level = game.generateLevel(game.run.level, save.level);
      if (game.level.layout) N.World.move(player, player.x, player.y, N.Ships.get(player.shipType).radius, true);
      game.groundItems = copy(save.level.groundItems);
      if (game.level.layout) {
        for (const item of game.groundItems) Object.assign(item, N.World.findFree(game.level.layout, item.x, item.y, 12));
      }
      game.level.elapsed = save.level.elapsed;
      game.level.kills = save.level.kills;
      game.level.damage = save.level.damage;
      game.level.bossSpawned = !!save.level.bossSpawned;
      game.level.wardenSpawned = !!save.level.wardenSpawned;
      Object.assign(game.camera, { x: player.x, y: player.y, shake: 0, sx: 0, sy: 0, zoom: game.zoom });
      game.time = game.glitch = 0;
      game.nextSurge = (Math.floor(game.level.elapsed / 60) + 1) * 60;
      game.nextWarden = game.level.wardenSpawned ? 9999 : 120;
      game.nextBoss = game.level.bossSpawned ? 9999 : 210;
      game.checkpointTimer = (Math.floor(game.level.elapsed / 60) + 1) * 60;
      game.pendingLevelUps = 0;
      game.overflow = null;
      game.spawnInitialEnemies(4);
      game.lastCheckpoint = save;
      prepared = Object.getOwnPropertyDescriptors(game);
      delete prepared.preparingCheckpoint;
    } catch (error) {
      return null;
    } finally {
      for (const key of Reflect.ownKeys(game)) if (!Object.hasOwn(previous, key)) delete game[key];
      Object.defineProperties(game, previous);
    }
    return prepared;
  }

  P.restoreCheckpoint = function (game, incoming) {
    const checked = P.validate(incoming);
    if (!checked.ok) return false;
    const prepared = prepareCheckpoint(game, checked.data);
    if (!prepared) return false;
    N.Input.resetMovement();
    N.Input.resetFire();
    Object.defineProperties(game, prepared);
    for (const enemy of game.enemies) N.Logbook?.spawned(enemy);
    N.Coop?.installProgressionAuthority?.();
    game.setMode('playing');
    N.UI?.hideAll();
    N.Audio.setScene('game');
    N.Audio.checkpoint();
    game.triggerGlitch(.35,'#00f0ff');
    game.notify('SIGNAL RESTORED // SECTOR ' + String(game.run.level).padStart(2, '0'), 'loot', 2200);
    return true;
  };
})();
