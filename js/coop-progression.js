/* Run-scoped progression/resource delivery over the existing co-op transport. */
(function () {
  'use strict';
  const N = window.NEON;
  const C = N.Coop;
  const G = N.Game;
  const P = N.ProgressionPersistence;
  const copy = value => JSON.parse(JSON.stringify(value));
  const clearedBullets = new Map();
  let lastSnapshotAt = -Infinity;
  let lastVisualAt = -Infinity;
  let intentSequence = 0;
  const acknowledged = new Map();
  const active = () => G.player?.progressionMode === 'shared_v1' && G.run?.progression;
  const run = () => G.run.progression;
  const playerFor = id => run().participants[id];
  const send = (body, target) => N.Net.send({ progressionVersion: 1, wireVersion: 7, ...body }, target);

  C.installProgressionAuthority = function () {
    if (!active()) { G.progressionAuthority = null; return; }
    G.progressionAuthority = {
      identityFor: player => ({ runToken: run().runToken, participantId: player.clientId }),
      publishResource: C.publishProgressionResource
    };
    acknowledged.clear();
    clearedBullets.clear();
    lastSnapshotAt = -Infinity;
  };

  C.publishProgressionEvent = function (event) {
    if (!C.isHost() || !active()) return;
    send({ t: 'progression_event', event });
  };
  C.publishProgressionResource = function (event) {
    if (!C.isHost() || !active() || !P.validateResources(event)) return;
    send({ t: 'progression_resource', event });
  };

  C.sendProgressionIntent = function (intent) {
    if (!C.isGuest() || !active() || G.mode !== 'playing' || C.pauseState !== 'PLAY') return false;
    return send({ t: 'progression_intent', runToken: run().runToken, intentSequence: ++intentSequence,
      intent: { ...intent }, aim: G.aim?.angle ?? G.player.aim });
  };

  C.restoreProgressionIntentSequence = function (sequence) {
    if (Number.isSafeInteger(sequence) && sequence >= 0) intentSequence = Math.max(intentSequence, sequence);
  };

  C.onProgressionDash = function (player, direction) {
    if (!active() || player !== G.player) return;
    if (C.isGuest()) {
      C.sendProgressionIntent({ dash: true, dashDirection: direction });
    } else if (G.progressionAuthority) {
      const result = N.ProgressionDefense.commitResources(player, G.progressionAuthority.identityFor(player));
      if (result.ok) G.progressionAuthority.publishResource(result.event);
    }
  };

  C.useProgressionDash = function (player, direction) {
    if (!active() || !C.isHost() || !player || player.dead || player.connected === false ||
        G.mode !== 'playing' || C.pauseState !== 'PLAY' || !Number.isFinite(direction) ||
        player.dashCharges <= 0 || player.dashTime > 0 || !Number.isFinite(player.stats.dashRecharge) ||
        player.stats.dashRecharge <= 0 || player.stats.dashRecharge > 2.7) return { ok: false, reason: 'dash-unavailable' };
    const identity = G.progressionAuthority.identityFor(player);
    if (!N.ProgressionDefense.canCommitResources(player, identity)) return { ok: false, reason: 'invalid-resource-state' };
    player.dashCharges--;
    if (player.dashCharges === player.maxDashCharges - 1) player.dashTimer = player.stats.dashRecharge;
    player.dashTime = .17;
    player.dashDir = Math.atan2(Math.sin(direction), Math.cos(direction));
    player.invuln = Math.max(player.invuln, .34);
    const result = N.ProgressionDefense.commitResources(player, identity);
    if (result.ok) C.publishProgressionResource(result.event);
    return result;
  };

  C.useProgressionDefense = function (player) {
    if (!active() || C.isGuest()) return { ok: false, reason: 'not-authoritative' };
    const result = N.Equipment.tryDefend({ game: G, player, participantId: player.clientId,
      activationId: player.clientId + ':' + (G.activationSequence = (G.activationSequence || 0) + 1),
      resourceIdentity: G.progressionAuthority.identityFor,
      recipients: run().participantIds.map(playerFor), paused: G.mode !== 'playing' || (C.active && C.pauseState !== 'PLAY') }, { pressed: true });
    if (result.ok && C.isHost()) {
      for (const event of result.resourceEvents || []) C.publishProgressionResource(event);
      send({ t: 'progression_defense', runToken: run().runToken, event: result.event });
    }
    return result;
  };

  function validEvent(event) {
    if (!event || event.runToken !== run().runToken || !Number.isSafeInteger(event.sequence) || event.sequence < 1 ||
        typeof event.sourceId !== 'string' || event.sourceId.length > 80 ||
        !Array.isArray(event.participantIds) || event.participantIds.join('|') !== run().participantIds.join('|') ||
        !Array.isArray(event.outcomes) || event.outcomes.length !== run().participantIds.length) return false;
    return event.outcomes.every((outcome, index) => {
      const id = run().participantIds[index], player = playerFor(id);
      return outcome && typeof outcome === 'object' && outcome.participantId === id && P.validateProgression(outcome.progression, player.shipType) &&
        outcome.progression.appliedEventSequence === event.sequence && P.validateResources(outcome.resources, outcome.progression, player.shipType) &&
        outcome.resources.runToken === event.runToken && outcome.resources.participantId === id &&
        outcome.result && typeof outcome.result.type === 'string';
    });
  }

  function requestRecovery() {
    send({ t: 'progression_resync', runToken: run().runToken, sequence: G.player.progression.appliedEventSequence });
  }

  function acknowledge() {
    send({ t: 'progression_ack', runToken: run().runToken, sequence: G.player.progression.appliedEventSequence,
      resourceRevision: G.player.resourceRevision || 0 });
  }

  function sendSnapshot(target) {
    const snapshots = run().participantIds.map(id => N.ProgressionRewards.snapshot({ run: run() }, id));
    send({ t: 'progression_snapshot', runToken: run().runToken, snapshots }, target);
  }

  function applySnapshot(message) {
    if (!Array.isArray(message.snapshots) || message.snapshots.length !== run().participantIds.length ||
        !message.snapshots.every((snapshot, index) => P.validateSnapshot(snapshot) && snapshot.runToken === run().runToken &&
          snapshot.participantId === run().participantIds[index])) return requestRecovery();
    for (const snapshot of message.snapshots) {
      const player = playerFor(snapshot.participantId);
      if (snapshot.sequence < player.progression.appliedEventSequence) continue;
      P.adoptSnapshot(player, snapshot);
    }
    run().nextEventSequence = Math.max(run().nextEventSequence, G.player.progression.appliedEventSequence + 1);
    acknowledge();
  }

  function receiveIntent(message, clientId) {
    const player = playerFor(clientId), intent = message.intent;
    if (!player || player.dead || player.connected === false || G.mode !== 'playing' || C.pauseState !== 'PLAY' ||
        message._sector !== G.level.number || message._life !== (player.coopLife || 0) ||
        !Number.isSafeInteger(message.intentSequence) || message.intentSequence <= (player.lastIntentSequence || 0) ||
        !intent || typeof intent !== 'object' || !Number.isFinite(message.aim) ||
        (intent.slot !== undefined && (!Number.isInteger(intent.slot) || intent.slot < 0 || intent.slot > 2)) ||
        (intent.cycle !== undefined && intent.cycle !== -1 && intent.cycle !== 1) ||
        (intent.fire !== undefined && typeof intent.fire !== 'boolean') ||
        (intent.dash !== undefined && typeof intent.dash !== 'boolean') ||
        (intent.dash && !Number.isFinite(intent.dashDirection)) ||
        (intent.defense !== undefined && typeof intent.defense !== 'boolean')) return;
    player.lastIntentSequence = message.intentSequence;
    player.aim = message.aim;
    let changed = false;
    if (intent.dash) {
      const result = C.useProgressionDash(player, intent.dashDirection);
      changed = result.ok;
      if (!result.ok) {
        // Reconcile a locally predicted dash that the authority could not accept.
        const resources = N.ProgressionDefense.commitResources(player, G.progressionAuthority.identityFor(player));
        if (resources.ok) C.publishProgressionResource(resources.event);
      }
    }
    if (intent.slot !== undefined) changed = N.Equipment.select(player.progression, intent.slot).changed || changed;
    if (intent.cycle !== undefined) changed = N.Equipment.cycle(player.progression, intent.cycle).changed || changed;
    if (intent.defense) changed = C.useProgressionDefense(player).ok || changed;
    if (intent.fire) {
      const result = N.Equipment.tryFire({ game: G, player, participantId: clientId,
        activationId: clientId + ':' + (G.activationSequence = (G.activationSequence || 0) + 1) }, { aimAngle: message.aim });
      changed = result.ok || changed;
    }
    // Readiness rejects do not need a multi-participant recovery payload each
    // display frame. Successful actions and periodic recovery still synchronize.
    if (changed) sendSnapshot(clientId);
  }

  const originalMessage = C.onMessage;
  C.onMessage = function (message, clientId) {
    if (!message || typeof message.t !== 'string') return;
    // Shared runs accept coordinated pause control and authoritative action
    // intents. Legacy packets must not bypass either boundary.
    if (active() && ['pause', 'fire'].includes(message.t)) return;
    if (!message.t.startsWith('progression_')) return originalMessage(message, clientId);
    if (!active() || message._run !== C.runId || message.progressionVersion !== 1 || message.wireVersion !== 7 ||
        (message.runToken || message.event?.runToken) !== run().runToken) return;
    if (C.isHost()) {
      if (!run().participantIds.includes(clientId)) return;
      if (message.t === 'progression_intent') receiveIntent(message, clientId);
      else if (message.t === 'progression_resync') {
        const replay = N.ProgressionRewards.replaySince({ run: run() }, message.sequence);
        if (replay.ok && replay.events.length) for (const event of replay.events) send({ t: 'progression_event', event }, clientId);
        else sendSnapshot(clientId);
      } else if (message.t === 'progression_ack' && Number.isSafeInteger(message.sequence) &&
          message.sequence <= playerFor(clientId).progression.appliedEventSequence) acknowledged.set(clientId, message.sequence);
      return;
    }
    if (!C.isGuest() || clientId !== N.Net.peerId) return;
    if (message.t === 'progression_event') {
      if (!validEvent(message.event)) return requestRecovery();
      if (message.event.sequence > G.player.progression.appliedEventSequence + 1) return requestRecovery();
      let localResult;
      for (const id of run().participantIds) {
        const result = N.ProgressionRewards.applyCommitted(playerFor(id), message.event);
        if (id === G.player.clientId) localResult = result;
      }
      if (localResult?.ok && !localResult.duplicate) N.ProgressionControls?.notify(G.player,
        message.event.category.toUpperCase() + ' // ' + localResult.result.type.toUpperCase(), message.event.sequence);
      run().nextEventSequence = Math.max(run().nextEventSequence, message.event.sequence + 1);
      acknowledge();
    } else if (message.t === 'progression_resource') {
      const player = playerFor(message.event?.participantId);
      if (!player || !P.applyResources(player, message.event, run().runToken).ok) requestRecovery();
      else acknowledge();
    } else if (message.t === 'progression_snapshot') applySnapshot(message);
    else if (message.t === 'progression_defense') {
      const event = message.event;
      if (!event || !N.ProgressionContent.defense(event.weaponId) || !Array.isArray(event.clearedIds || []) ||
          (event.clearedIds || []).length > 850 || !(event.clearedIds || []).every(id => typeof id === 'string' && id.length <= 80)) return;
      // Cleared projectiles must stay suppressed across an arbitrarily long
      // pause, just as their remaining simulated lifetime stays frozen.
      for (const id of event.clearedIds || []) clearedBullets.set(id, G.time + 15);
      for (const bullet of G.enemyBullets) if (clearedBullets.has(bullet.id)) bullet.dead = true;
    } else if (message.t === 'progression_visuals' && validVisuals(message.offense, message.defense)) {
      N.ProgressionOffense.setGuestVisuals(G.level, message.offense);
      N.ProgressionDefense.setGuestVisuals(G.level, message.defense);
    }
  };
  N.Net.onMessage = C.onMessage;

  function validVisuals(offense, defense) {
    const arrays = [offense?.projectiles, offense?.fields, offense?.flashes, defense?.flashes, defense?.barriers];
    return arrays.every(list => Array.isArray(list) && list.length <= 1024 && list.every(item => item &&
      Object.entries(item).every(([key, value]) => typeof value === 'number' ? Number.isFinite(value) :
        key === 'points' ? Array.isArray(value) && value.length <= 8 && value.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) :
          typeof value === 'string' && value.length <= 80)));
  }

  const originalEnemySpawn = G.spawnEnemyBullet;
  G.spawnEnemyBullet = function (data) {
    if (C.isGuest() && clearedBullets.has(data.id)) return { dead: true, id: data.id };
    return originalEnemySpawn(data);
  };
  const originalPlayerSpawn = G.spawnBullet;
  G.spawnBullet = function (data) {
    const bullet = originalPlayerSpawn(data);
    if (C.isHost() && bullet.progressionPrimary) C.onPlayerBullet(bullet);
    return bullet;
  };

  const originalPreUpdate = C.preUpdate;
  C.preUpdate = function (seconds) {
    originalPreUpdate(seconds);
    if (!C.isHost() || !active() || G.mode !== 'playing' || C.pauseState !== 'PLAY') return;
    for (const player of C.remotePlayers) {
      if (player.dead || player.connected === false) continue;
      N.Equipment.tick(player.progression, seconds);
      player.dashTime = Math.max(0, player.dashTime - seconds);
      if (player.dashCharges < player.maxDashCharges) {
        if (player.dashTimer <= 0) player.dashTimer = player.stats.dashRecharge;
        player.dashTimer -= seconds;
        if (player.dashTimer <= 0) {
          player.dashCharges = Math.min(player.maxDashCharges, player.dashCharges + 1);
          player.dashTimer = player.dashCharges >= player.maxDashCharges ? 0 : player.stats.dashRecharge;
        }
      }
      player.shieldDelay = Math.max(0, player.shieldDelay - seconds);
      for (const key of ['overclock', 'speed', 'magnet']) player.buffs[key] = Math.max(0, player.buffs[key] - seconds);
      if (player.shieldDelay === 0) player.shield = Math.min(player.stats.maxShield, player.shield + player.stats.shieldRegenPerSecond * seconds);
    }
  };

  const originalTick = C.tickSession;
  C.tickSession = function (...args) {
    originalTick(...args);
    const now = performance.now();
    for (const [id, expiry] of clearedBullets) if (expiry <= G.time) clearedBullets.delete(id);
    if (!active() || !C.isHost()) return;
    if (now - lastSnapshotAt >= 1000) {
      lastSnapshotAt = now;
      for (const id of run().participantIds) {
        const player = playerFor(id);
        const committed = N.ProgressionDefense.commitResources(player, G.progressionAuthority.identityFor(player));
        if (committed.ok) C.publishProgressionResource(committed.event);
      }
      sendSnapshot();
    }
    if (now - lastVisualAt >= 200) {
      lastVisualAt = now;
      send({ t: 'progression_visuals', runToken: run().runToken,
        offense: N.ProgressionOffense.snapshotVisuals(G), defense: N.ProgressionDefense.snapshotVisuals(G, C.players()) });
    }
  };

  for (const name of ['endSession', 'leaveToMenu']) {
    const original = C[name];
    C[name] = function (...args) {
      G.progressionAuthority = null;
      acknowledged.clear();
      clearedBullets.clear();
      intentSequence = 0;
      return original(...args);
    };
  }
})();
