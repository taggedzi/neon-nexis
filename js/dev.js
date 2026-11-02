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
    if (devRuns.has(G.run) && reason !== 'manual') {
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
    catalog() {
      allowed(false);
      return {
        hulls: N.Ships.types.map(ship => ship.id),
        colors: N.Ships.palette.map(entry => entry.color),
        weapons: Object.keys(N.WEAPON_BY_ID),
        enemies: Object.keys(N.ENEMY_BY_ID)
      };
    },
    // A setup is a fresh scenario, not an edit to the stored checkpoint.
    setup(options = {}) {
      allowed(false);
      const keys = ['hull', 'color', 'weapons', 'level', 'sector', 'seed', 'invulnerable'];
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
      const weapons = options.weapons ?? [N.STARTING_WEAPON];
      if (!Array.isArray(weapons) || weapons.length < 1 || weapons.length > 8 ||
          weapons.some(id => typeof id !== 'string' || !Object.hasOwn(N.WEAPON_BY_ID, id)) ||
          new Set(weapons).size !== weapons.length) {
        throw Error('weapons must contain 1–8 distinct catalog IDs.');
      }
      if (options.invulnerable !== undefined && typeof options.invulnerable !== 'boolean') {
        throw Error('invulnerable must be boolean.');
      }
      const checkpoint = {
        version: 1,
        run: { seed, mapVersion: 1, level: sector, sectors: sector - 1 },
        player: {
          shipType: hull, shipColor: color, level, xpNext: G.xpForLevel(level),
          hp: N.BASE_STATS.maxHp, shield: N.BASE_STATS.maxShield,
          weapons: weapons.map(id => ({ id, tier: 1, level: 1 })),
          weaponSlots: Math.max(N.START_SLOTS.weapons, weapons.length)
        }
      };
      if (!G.loadFromSave(checkpoint)) {
        throw Error('Scenario could not be loaded.');
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
