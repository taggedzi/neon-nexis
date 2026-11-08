/* Source-only scenario commands. Production staging omits this file. */
(function() {
  'use strict';
  const N = window.NEON;
  if (N.RELEASE_VERSION !== 'development') {
    return;
  }
  const G = N.Game;
  const devRuns = new WeakSet();
  const protectedPlayers = new WeakSet();
  const saveCheckpoint = G.saveCheckpoint;
  const damagePlayer = G.damagePlayer;

  // Keep later automatic saves from overwriting the owner's real checkpoint.
  G.saveCheckpoint = function(silent, reason) {
    if (G.devScenarioLoading || (devRuns.has(G.run) && reason !== 'manual')) {
      return false;
    }
    return saveCheckpoint(silent, reason);
  };
  G.damagePlayer = function(...args) {
    if (N.RELEASE_VERSION === 'development' && !G.coopRun &&
        !N.Coop.isActive() && N.Net.role === 'solo' && protectedPlayers.has(G.player)) {
      return false;
    }
    return damagePlayer(...args);
  };

  function allowed(needsRun = true) {
    if (N.RELEASE_VERSION !== 'development' || G.coopRun ||
        N.Coop.isActive() || N.Net.role !== 'solo') {
      throw Error('Dev commands require a source single-player session.');
    }
    if (!(needsRun ? ['playing', 'paused'] : ['menu', 'playing', 'paused']).includes(G.mode) ||
        (needsRun && (!G.player || G.player.dead || !G.level))) {
      throw Error('Use the main menu or a living run in play/pause.');
    }
  }
  function integer(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw Error(name + ' must be an integer from ' + min + ' to ' + max + '.');
    }
    return value;
  }
  function pause() {
    if (G.mode === 'playing') {
      G.pauseGame();
    }
    N.Input.resetMovement();
    N.Input.resetFire();
  }

  N.Dev = Object.freeze({
    isScenario(run = G.run) { return devRuns.has(run); },
    catalog() {
      allowed(false);
      return {
        hulls: N.Ships.types.map(ship => ship.id),
        colors: N.Ships.palette.map(entry => entry.color),
        primaries: [...N.ProgressionContent.primaryOrder],
        weapons: [...N.ProgressionContent.additionalOffenseOrder],
        defenses: [...N.ProgressionContent.defensiveOrder],
        passives: [...N.ProgressionContent.passiveOrder],
        enemies: Object.keys(N.ENEMY_BY_ID)
      };
    },
    // A setup is a fresh scenario, not an edit to the stored checkpoint.
    setup(options = {}) {
      allowed(false);
      const keys = ['hull', 'color', 'weapons', 'defense', 'level', 'sector', 'seed', 'invulnerable'];
      if (!options || typeof options !== 'object' || Array.isArray(options) ||
          Object.keys(options).some(key => !keys.includes(key))) {
        throw Error('Unknown setup option. See docs/dev-mode.md.');
      }
      const hull = options.hull ?? 'dart';
      const color = options.color ?? '#00f0ff';
      if (!N.Ships.types.some(ship => ship.id === hull) ||
          !['#00f0ff', ...N.Ships.palette.map(entry => entry.color)].includes(color)) {
        throw Error('Choose a hull and color from NEON.Dev.catalog().');
      }
      const level = integer(options.level ?? 1, 1, 100, 'level');
      const sector = integer(options.sector ?? 1, 1, 100, 'sector');
      const seed = integer(options.seed ?? 1, 0, 0xffffffff, 'seed');
      const weapons = options.weapons ?? [];
      if (!Array.isArray(weapons) || weapons.length > 2 ||
          weapons.some(id => typeof id !== 'string' || !N.ProgressionContent.additional(id)) ||
          new Set(weapons).size !== weapons.length) {
        throw Error('weapons must contain 0–2 distinct additional-offense catalog IDs.');
      }
      const defense = options.defense ?? null;
      if (defense !== null && !N.ProgressionContent.defense(defense)) {
        throw Error('defense must be a defensive catalog ID or null.');
      }
      if (options.invulnerable !== undefined && typeof options.invulnerable !== 'boolean') {
        throw Error('invulnerable must be boolean.');
      }
      const previous = G.devScenarioLoading;
      G.devScenarioLoading = true;
      try {
        if (G.newRun({shipType:hull, shipColor:color}, {seed, skill:'medium', progressionMode:'shared_v1'}) === false) {
          throw Error('Scenario could not be loaded.');
        }
        devRuns.add(G.run);
        let experience = 0;
        for (let earnedLevel = 1; earnedLevel < level; earnedLevel++) {
          experience += N.ProgressionContent.xpNext(earnedLevel);
        }
        if (experience) {
          const source = {id:'dev-scenario-level'};
          N.ProgressionRewards.addXp({...N.ProgressionRuntime.context(G), resolveSource:() => source}, source.id, experience);
        }
        const player = G.player;
        weapons.forEach((id, index) => {
          player.progression.offensive[index + 1] = {id, level:1, cooldownSeconds:0};
        });
        player.progression.defensive = defense ? {id:defense, level:1, cooldownSeconds:0} : null;
        G.rebuildStats(player, true);
        G.run.level = G.run.highestSector = sector;
        G.run.sectors = sector - 1;
        G.level = G.generateLevel(sector, null);
        G.resetEntityArrays();
        player.x = G.level.layout?.spawn.x || G.level.cx;
        player.y = G.level.layout?.spawn.y || G.level.cy;
        G.camera.x = player.x;
        G.camera.y = player.y;
        G.spawnInitialEnemies();
      } finally {
        G.devScenarioLoading = previous;
      }
      devRuns.add(G.run);
      if (options.invulnerable) {
        protectedPlayers.add(G.player);
      }
      pause();
      return 'Scenario ready (paused). Resume normally; saves require the manual checkpoint action.';
    },
    spawn(styleId) {
      allowed();
      if (typeof styleId !== 'string' || !Object.hasOwn(N.ENEMY_BY_ID, styleId)) {
        throw Error('Unknown enemy style. See NEON.Dev.catalog().');
      }
      pause();
      devRuns.add(G.run);
      const position = G.safeSpawnPos(180, 320);
      const enemy = G.spawnEnemy(N.ENEMY_BY_ID[styleId], position.x, position.y);
      if (!enemy) {
        throw Error('Enemy population cap reached.');
      }
      return enemy.id;
    },
    invulnerable(enabled) {
      allowed();
      if (typeof enabled !== 'boolean') {
        throw Error('Pass true or false.');
      }
      pause();
      devRuns.add(G.run);
      if (enabled) {
        protectedPlayers.add(G.player);
      } else {
        protectedPlayers.delete(G.player);
      }
      return enabled;
    },
    killAll() {
      allowed();
      pause();
      devRuns.add(G.run);
      // Normal kills retain rewards and effects; repeat for splitter children.
      let count = 0;
      while (G.enemies.some(enemy => !enemy.dead)) {
        for (const enemy of G.enemies.slice()) {
          if (!enemy.dead) {
            G.killEnemy(enemy);
            count++;
          }
        }
      }
      return count;
    }
  });
})();
