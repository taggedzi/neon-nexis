/* NEON NEXUS — authoritative shared rewards and bounded recovery (046) */
(function() {
  'use strict';
  const N = window.NEON;
  const clone = value => JSON.parse(JSON.stringify(value));
  const JOURNAL_LIMIT = 256;

  function createRun(players, runToken) {
    if (!/^[0-9a-f]{32}$/.test(runToken) || !Array.isArray(players) || players.length < 1 || players.length > 4) {
      throw Error('Invalid shared progression roster');
    }
    const participants = {};
    for (const player of players) {
      if (!player.clientId || Object.hasOwn(participants, player.clientId) || !N.Equipment.isValidState(player.progression)) {
        throw Error('Invalid shared progression participant');
      }
      participants[player.clientId] = player;
      player.progressionRunToken = runToken;
    }
    return {schemaVersion:1, catalogVersion:1, runToken, nextEventSequence:1, nextSourceSequence:1,
      participantIds:players.map(player => player.clientId), participants,
      pacing:{firstOrdinaryDrop:true, combatSeconds:0, teamKills:0}, journal:[]};
  }

  function resourceSnapshot(player, run, participantId) {
    return {type:'resource', runToken:run.runToken, participantId,
      resourceRevision:player.resourceRevision || 0,
      progressionSequence:player.progression.appliedEventSequence,
      hp:player.hp, shield:player.shield, dead:!!player.dead,
      buffs:clone(player.buffs), invuln:player.invuln, shieldDelay:player.shieldDelay,
      dashCharges:player.dashCharges, maxDashCharges:player.maxDashCharges, dashTimer:player.dashTimer,
      dashTime:player.dashTime, dashDir:player.dashDir,
      barrier:N.ProgressionDefense.snapshotBarrier(player)};
  }

  function snapshot(context, participantId) {
    const run = context.run;
    const player = run.participants[participantId];
    if (!player) {
      return null;
    }
    return {runToken:run.runToken, participantId, shipType:player.shipType, shipColor:player.shipColor,
      sequence:player.progression.appliedEventSequence, progression:clone(player.progression),
      resources:resourceSnapshot(player, run, participantId)};
  }

  function runSnapshot(context) {
    const run = context.run;
    return {schemaVersion:1, catalogVersion:1, runToken:run.runToken,
      nextEventSequence:run.nextEventSequence, nextSourceSequence:run.nextSourceSequence, participantIds:[...run.participantIds],
      participants:Object.fromEntries(run.participantIds.map(id => [id, snapshot(context, id)])),
      pacing:clone(run.pacing), journal:[]};
  }

  function copyResources(player, resources) {
    for (const key of ['hp', 'shield', 'dead', 'invuln', 'shieldDelay', 'resourceRevision',
      'dashCharges', 'maxDashCharges', 'dashTimer', 'dashTime', 'dashDir']) {
      player[key] = resources[key];
    }
    player.buffs = clone(resources.buffs);
    player.barrier = clone(resources.barrier);
  }

  function validateSnapshot(player, saved) {
    if (N.ProgressionPersistence && !N.ProgressionPersistence.validateSnapshot(saved)) {
      return false;
    }
    if (!saved || !/^[0-9a-f]{32}$/.test(saved.runToken) || saved.participantId !== player.clientId ||
        !Number.isSafeInteger(saved.sequence) || saved.sequence < 0 ||
        saved.progression?.appliedEventSequence !== saved.sequence || !N.Equipment.isValidState(saved.progression)) {
      return false;
    }
    const state = saved.progression;
    if (!Number.isSafeInteger(state.level) || state.level < 1 ||
        !Number.isFinite(state.xp) || state.xp < 0 || state.xp >= N.ProgressionContent.xpNext(state.level) ||
        !Number.isInteger(state.nextPassiveIndex) || state.nextPassiveIndex < 0 || state.nextPassiveIndex > 6 ||
        !Number.isFinite(state.salvage) || state.salvage < 0 ||
        !Number.isSafeInteger(state.revision) || state.revision < 0) {
      return false;
    }
    const resources = saved.resources;
    if (!resources || resources.runToken !== saved.runToken || resources.participantId !== saved.participantId ||
        !Number.isSafeInteger(resources.progressionSequence) || resources.progressionSequence < 0 ||
        resources.progressionSequence > saved.sequence || !Number.isSafeInteger(resources.resourceRevision) || resources.resourceRevision < 0 ||
        resources.maxDashCharges !== 1 || !Number.isInteger(resources.dashCharges) || resources.dashCharges < 0 || resources.dashCharges > 1 ||
        !Number.isFinite(resources.dashTimer) || resources.dashTimer < 0 || resources.dashTimer > 2.7 ||
        !Number.isFinite(resources.dashTime) || resources.dashTime < 0 || resources.dashTime > .17 || !Number.isFinite(resources.dashDir) ||
        ![resources.hp, resources.shield, resources.invuln, resources.shieldDelay,
          resources.buffs?.overclock, resources.buffs?.speed, resources.buffs?.magnet].every(value => Number.isFinite(value) && value >= 0) ||
        typeof resources.dead !== 'boolean' || (resources.dead && resources.hp !== 0) ||
        !N.ProgressionDefense.restoreBarrier({}, resources.barrier).ok) {
      return false;
    }
    const stats = N.ProgressionStats.derive(player.shipType, saved.progression);
    if (stats.ok === false || resources.hp > stats.maxHp || resources.shield > stats.maxShield) {
      return false;
    }
    return true;
  }

  function restoreSnapshot(player, saved) {
    if (!validateSnapshot(player, saved)) {
      return {ok:false, reason:'invalid-snapshot'};
    }
    player.progression = clone(saved.progression);
    player.progressionRunToken = saved.runToken;
    player.stats = N.ProgressionStats.derive(player.shipType, player.progression);
    copyResources(player, saved.resources);
    return {ok:true};
  }

  function applyCommitted(player, event) {
    if (!event || (player.progressionRunToken && event.runToken !== player.progressionRunToken) ||
        !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !Array.isArray(event.outcomes)) {
      return {ok:false, reason:'invalid-event'};
    }
    const current = player.progression.appliedEventSequence;
    if (event.sequence <= current) {
      return {ok:true, duplicate:true};
    }
    if (event.sequence !== current + 1) {
      return {ok:false, reason:'sequence-gap', expectedSequence:current + 1};
    }
    const outcome = event.outcomes.find(item => item.participantId === player.clientId);
    const saved = outcome && {...outcome, runToken:event.runToken, sequence:event.sequence,
      shipType:player.shipType, shipColor:player.shipColor};
    if (!validateSnapshot(player, saved)) {
      return {ok:false, reason:'invalid-event'};
    }
    const resourceIsNewer = saved.resources.resourceRevision > (player.resourceRevision || 0);
    player.progression = clone(saved.progression);
    player.stats = N.ProgressionStats.derive(player.shipType, player.progression);
    if (resourceIsNewer) {
      copyResources(player, saved.resources);
    }
    remember(player, event, outcome.result);
    return {ok:true, result:outcome.result};
  }

  function remember(player, event, result) {
    const history = player.progressionHistory || (player.progressionHistory = []);
    history.push({sequence:event.sequence, category:event.category, result:clone(result)});
    if (history.length > 32) {
      history.shift();
    }
  }

  function fallback(player) {
    const repair = !player.dead && player.connected !== false ? Math.min(10, Math.max(0, player.stats.maxHp - player.hp)) : 0;
    player.hp += repair;
    const salvage = 10 - repair;
    player.progression.salvage += salvage;
    return {type:'fallback', repair, salvage};
  }

  function upgrade(player, category, random) {
    const outcome = N.ProgressionStats.upgradeOutcome(player.progression, category);
    if (!outcome.ok) {
      throw Error(outcome.reason);
    }
    if (outcome.type === 'fallback') {
      return fallback(player);
    }
    const state = player.progression;
    const before = player.stats;
    if (outcome.type === 'install') {
      outcome.id = outcome.candidates[Math.min(outcome.candidates.length - 1, Math.floor(random() * outcome.candidates.length))];
      const item = {id:outcome.id, level:1, cooldownSeconds:0};
      if (outcome.slotIndex === 'defense') {
        state.defensive = item;
      } else {
        state.offensive[outcome.slotIndex] = item;
      }
    } else if (outcome.type === 'upgrade') {
      const item = outcome.slotIndex === 'defense' ? state.defensive : state.offensive[outcome.slotIndex];
      item.level = outcome.newLevel;
    } else if (outcome.type === 'passive') {
      state.passives[outcome.id] = outcome.newStacks;
    }
    player.stats = N.ProgressionStats.derive(player.shipType, state);
    const delta = N.ProgressionStats.capacityDelta(before, player.stats, player);
    player.hp = delta.hp;
    player.shield = delta.shield;
    return outcome;
  }

  function resolveXp(player, amount, random) {
    const state = player.progression;
    state.xp += amount;
    const levels = [];
    while (state.xp >= N.ProgressionContent.xpNext(state.level)) {
      state.xp -= N.ProgressionContent.xpNext(state.level);
      state.level++;
      const id = N.ProgressionContent.passiveSequence[state.nextPassiveIndex];
      levels.push(upgrade(player, {type:'passive', id}, random));
      state.nextPassiveIndex = (state.nextPassiveIndex + 1) % 7;
    }
    return {type:'xp', amount, level:state.level, xp:state.xp, nextPassiveIndex:state.nextPassiveIndex, levels};
  }

  function consumable(player, id) {
    if (player.dead || player.connected === false) {
      return {type:'ineligible', id};
    }
    const hp = player.hp;
    const shield = player.shield;
    if (id === 'repair') {
      player.hp = Math.min(player.stats.maxHp, hp + 28);
    } else if (id === 'shield') {
      player.shield = Math.min(player.stats.maxShield, shield + Math.max(18, .65 * player.stats.maxShield));
    } else if (Object.hasOwn(player.buffs, id)) {
      const previous = player.buffs[id];
      player.buffs[id] = Math.max(previous, id === 'magnet' ? 9 : 12);
      return {type:player.buffs[id] > previous ? 'buff' : 'no-change', id, seconds:player.buffs[id]};
    }
    return {type:player.hp !== hp || player.shield !== shield ? 'repair' : 'no-change', id,
      repair:player.hp - hp, shield:player.shield - shield};
  }

  function commit(context, source, sourceId, category, resolve) {
    const run = context.run;
    if (N.Coop?.isGuest() || !source || source.progressionConsumed || !Number.isSafeInteger(run.nextEventSequence) ||
        run.nextEventSequence >= Number.MAX_SAFE_INTEGER) {
      return {ok:false, reason:source?.progressionConsumed ? 'source-consumed' : 'not-authoritative'};
    }
    const sequence = run.nextEventSequence;
    const event = {type:'progression', runToken:run.runToken, sequence, sourceId, category,
      participantIds:[...run.participantIds], outcomes:[]};
    const prepared = [];
    for (const participantId of run.participantIds) {
      const original = run.participants[participantId];
      const player = {...original, progression:clone(original.progression), buffs:clone(original.buffs),
        barrier:clone(N.ProgressionDefense.snapshotBarrier(original))};
      player.stats = N.ProgressionStats.derive(player.shipType, player.progression);
      const result = resolve(player);
      player.progression.appliedEventSequence = sequence;
      player.progression.revision++;
      const resources = N.ProgressionDefense.commitResources(player, {runToken:run.runToken, participantId});
      if (!resources.ok) {
        return resources;
      }
      event.outcomes.push({participantId, progression:clone(player.progression), resources:resources.event, result});
      prepared.push({original, player, result});
    }
    source.progressionConsumed = true;
    run.nextEventSequence++;
    for (const {original, player, result} of prepared) {
      original.progression = player.progression;
      original.stats = player.stats;
      copyResources(original, resourceSnapshot(player, run, original.clientId));
      remember(original, event, result);
    }
    run.journal.push(event);
    if (run.journal.length > JOURNAL_LIMIT) {
      run.journal.shift();
    }
    let deliveryPending = false;
    try {
      context.publish?.(event);
    } catch {
      // The durable cumulative state is already committed; transport retries
      // this exact event or requests its snapshot. Never roll the source again.
      deliveryPending = true;
    }
    context.notify?.(event);
    return {ok:true, event, deliveryPending};
  }

  function collect(context, pickupId) {
    const pickup = context.pickups.find(item => item.id === pickupId);
    if (!pickup || pickup.collected) {
      return {ok:false, reason:'source-consumed'};
    }
    if ((pickup.kind !== 'equipment' && pickup.kind !== 'consumable') ||
        (pickup.kind === 'equipment' && !['primary', 'offensive', 'defensive', 'passive'].includes(pickup.itemId)) ||
        (pickup.kind === 'consumable' && !['repair', 'shield', 'overclock', 'speed', 'magnet', 'data'].includes(pickup.itemId))) {
      return {ok:false, reason:'invalid-pickup'};
    }
    const random = context.random || Math.random;
    const category = pickup.kind === 'equipment' ? pickup.itemId : 'consumable';
    const passiveId = category === 'passive' ? N.ProgressionContent.passiveOrder[Math.floor(random() * 7)] : null;
    const result = commit(context, pickup, pickup.id, category, player => {
      if (pickup.kind === 'consumable') {
        return pickup.itemId === 'data' ? resolveXp(player, 22, random) : consumable(player, pickup.itemId);
      }
      return upgrade(player, passiveId ? {type:'passive', id:passiveId} : category, random);
    });
    if (result.ok) {
      pickup.collected = true;
      pickup.collectorId = context.collectorId;
    }
    return result;
  }

  function addXp(context, sourceId, amount) {
    const source = typeof context.resolveSource === 'function' ? context.resolveSource(sourceId) : null;
    if (!Number.isFinite(amount) || amount < 0 || !source || (source.progressionSourceId || source.id) !== sourceId) {
      return {ok:false, reason:'invalid-xp-source'};
    }
    return commit(context, source, sourceId, 'xp', player => resolveXp(player, amount, context.random || Math.random));
  }

  function tickPacing(run, seconds, hasEnemies) {
    if (hasEnemies && Number.isFinite(seconds) && seconds >= 0) {
      run.pacing.combatSeconds = Math.min(run.pacing.firstOrdinaryDrop ? 18 : 36, run.pacing.combatSeconds + seconds);
    }
  }

  function equipmentSource(run, isKill, bonus, random = Math.random) {
    const pacing = run.pacing;
    const kills = pacing.firstOrdinaryDrop ? 4 : 8;
    const seconds = pacing.firstOrdinaryDrop ? 18 : 36;
    if (isKill) {
      pacing.teamKills = Math.min(kills, pacing.teamKills + 1);
    }
    if (!bonus && (pacing.teamKills < kills || pacing.combatSeconds < seconds)) {
      return null;
    }
    let category = 'offensive';
    if (bonus || !pacing.firstOrdinaryDrop) {
      const roll = random();
      category = roll < .30 ? 'primary' : roll < .60 ? 'offensive' : roll < .75 ? 'defensive' : 'passive';
    }
    if (!bonus) {
      pacing.firstOrdinaryDrop = false;
      pacing.combatSeconds = 0;
      pacing.teamKills = 0;
    }
    return {kind:'equipment', id:category, color:'#b6ff2b', bonus:!!bonus};
  }

  function replaySince(context, sequence) {
    const run = context.run;
    if (sequence < run.nextEventSequence - 1 && (!run.journal.length || sequence < run.journal[0].sequence - 1)) {
      return {ok:false, reason:'snapshot-required', snapshots:run.participantIds.map(id => snapshot(context, id))};
    }
    return {ok:true, events:clone(run.journal.filter(event => event.sequence > sequence))};
  }

  N.ProgressionRewards = Object.freeze({createRun, collect, addXp, applyCommitted, snapshot, runSnapshot,
    restoreSnapshot, replaySince, tickPacing, equipmentSource, JOURNAL_LIMIT});
})();
