/* NEON NEXUS — shared progression lifecycle and world adapters (046) */
(function() {
  'use strict';
  const N = window.NEON;
  const G = N.Game;

  function token() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  }

  function initialize(game, players = [game.player], runToken = token()) {
    if (!players[0].clientId) {
      players[0].clientId = 'solo-' + runToken;
    }
    game.run.progressionMode = 'shared_v1';
    game.run.progression = N.ProgressionRewards.createRun(players, runToken);
    game.progressionAuthority = {
      identityFor:player => ({runToken:game.run.progression.runToken, participantId:player.clientId}),
      publishResource:event => N.Coop?.publishProgressionResource?.(event)
    };
    N.Coop?.installProgressionAuthority?.();
    return game.run.progression;
  }

  function context(game, extra = {}) {
    return {run:game.run.progression, pickups:game.groundItems,
      publish:event => N.Coop?.publishProgressionEvent?.(event),
      notify:event => {
        const outcome = event.outcomes.find(item => item.participantId === game.player.clientId);
        if (outcome) {
          const result = outcome.result;
          let label = result.type === 'xp' ? (result.levels.length ? 'LEVEL ' + result.level + ' // AUTO UPGRADE' : '') :
            result.type === 'fallback' ? '+' + result.repair + ' HP // +' + result.salvage + ' SALVAGE' :
            result.id ? result.id.replaceAll('_', ' ').toUpperCase() + ' // ' + result.type.toUpperCase() :
              event.category.toUpperCase() + ' // ' + result.type.toUpperCase();
          if (label) {
            N.ProgressionControls?.notify(game.player, label, event.sequence);
          }
        }
      }, ...extra};
  }

  function collect(game, item, collector = game.player) {
    if (N.Coop?.isGuest()) {
      return {ok:false, reason:'not-authoritative'};
    }
    return N.ProgressionRewards.collect(context(game, {collectorId:collector.clientId}), item.id);
  }

  function addXp(game, amount, source) {
    if (!source || !game.run?.progression || !game.enemies.includes(source)) {
      return {ok:false, reason:'invalid-xp-source'};
    }
    if (!source.progressionSourceId) {
      const run = game.run.progression;
      source.progressionSourceId = 'xp_' + run.runToken + '_' + run.nextSourceSequence++;
    }
    return N.ProgressionRewards.addXp(context(game, {
      resolveSource:sourceId => game.enemies.find(enemy => enemy.progressionSourceId === sourceId)
    }), source.progressionSourceId, amount);
  }

  function spawnEquipment(game, x, y, isKill = false, bonus = false) {
    const loot = N.ProgressionRewards.equipmentSource(game.run.progression, isKill, bonus);
    if (!loot) {
      return null;
    }
    return game.spawnGroundLoot(loot, x, y, (bonus ? 'BONUS ' : '') + loot.id.toUpperCase() + ' MODULE', true);
  }

  function enemyReward(game, enemy) {
    addXp(game, enemy.xp || 1, enemy);
    spawnEquipment(game, enemy.x, enemy.y, true);
    if (enemy.boss || N.ROLES[enemy.role]?.boss) {
      spawnEquipment(game, enemy.x + 25, enemy.y, false, true);
    }
  }

  function tick(game, seconds) {
    if (N.Coop?.isGuest() || !game.run?.progression) {
      return;
    }
    const run = game.run.progression;
    N.ProgressionRewards.tickPacing(run, seconds, game.enemies.some(enemy => !enemy.dead));
    const players = run.participantIds.map(id => run.participants[id]);
    N.ProgressionDefense.tickWorld(players, seconds);
    for (const player of players) {
      // Connected living players advance buffs in their normal simulation path.
      if (player.dead || player.connected === false) {
        for (const id of ['overclock', 'speed', 'magnet']) {
          player.buffs[id] = Math.max(0, player.buffs[id] - seconds);
        }
      }
    }
  }

  function restoreRun(game, saved, localId) {
    const previous = game.run?.progression?.runToken === saved.runToken ? game.run.progression : null;
    const participants = {};
    for (const id of saved.participantIds) {
      const snapshot = saved.participants[id];
      const retained = previous?.participants[id];
      const isRetainedPlayer = retained?.progressionMode === 'shared_v1' &&
        Number.isFinite(retained.x) && Number.isFinite(retained.y) && Number.isFinite(retained.radius);
      const player = id === localId ? game.player : isRetainedPlayer ? retained : game.makePlayer(snapshot, 'shared_v1');
      player.clientId = id;
      player.connected = id === localId;
      const result = N.ProgressionPersistence?.adoptSnapshot ?
        N.ProgressionPersistence.adoptSnapshot(player, snapshot) : N.ProgressionRewards.restoreSnapshot(player, snapshot);
      if (!result.ok) {
        return result;
      }
      participants[id] = player;
    }
    game.run.progression = {...saved, participants, journal:saved.journal || []};
    if (previous) {
      game.run.progression.nextEventSequence = Math.max(previous.nextEventSequence, saved.nextEventSequence);
      game.run.progression.nextSourceSequence = Math.max(previous.nextSourceSequence, saved.nextSourceSequence);
    }
    game.run.progressionMode = 'shared_v1';
    game.progressionAuthority = {
      identityFor:player => ({runToken:saved.runToken, participantId:player.clientId}),
      publishResource:event => N.Coop?.publishProgressionResource?.(event)
    };
    return {ok:true};
  }

  G.initializeProgressionRun = (players, runToken) => initialize(G, players, runToken);
  N.ProgressionRuntime = Object.freeze({initialize, context, collect, addXp, spawnEquipment, enemyReward, tick, restoreRun});
})();
