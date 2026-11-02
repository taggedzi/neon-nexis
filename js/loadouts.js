/* Named earned pilots, separate from the live checkpoint. */
(function () {
  'use strict';
  const N = window.NEON;
  const L = N.Loadouts = {};
  L.key = 'neon_nexus_loadouts_v1';
  L.limit = 3;
  const fields = ['shipType', 'shipColor', 'level', 'xp', 'xpNext', 'weapons',
    'passives', 'core', 'weaponSlots', 'passiveSlots', 'activeWeapon'];
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
  L.validName = name => typeof name === 'string' && name === name.trim() && name.length > 0 && name.length <= 32 && !/[\u0000-\u001f\u007f]/.test(name);

  L.validateShip = function (ship, requireKnown = true) {
    if (!plain(ship) || !L.validName(ship.name) || !integer(ship.highestSector, 1) || !plain(ship.player)) return false;
    const p = ship.player;
    if (typeof p.shipType !== 'string' || typeof p.shipColor !== 'string' ||
        !integer(p.level, 1) || !Number.isFinite(p.xp) || p.xp < 0 ||
        !Number.isFinite(p.xpNext) || p.xpNext <= 0 || p.xp >= p.xpNext ||
        !integer(p.weaponSlots, 1, 8) || !integer(p.passiveSlots, 1, 12) ||
        !Array.isArray(p.weapons) || !p.weapons.length || p.weapons.length > p.weaponSlots ||
        !Array.isArray(p.passives) || p.passives.length > p.passiveSlots ||
        !Array.isArray(p.core) || p.core.length > p.level - 1 ||
        !integer(p.activeWeapon, 0, p.weapons.length - 1)) return false;
    const weaponIds = new Set(), passiveIds = new Set();
    for (const w of p.weapons) {
      if (!plain(w) || typeof w.id !== 'string' || weaponIds.has(w.id) || !integer(w.level, 1, 5) || !integer(w.tier, 1, 3)) return false;
      weaponIds.add(w.id);
      if (requireKnown && !N.WEAPON_BY_ID[w.id]) return false;
    }
    for (const m of p.passives) {
      if (!plain(m) || typeof m.id !== 'string' || passiveIds.has(m.id) || !integer(m.stacks, 1)) return false;
      passiveIds.add(m.id);
      if (requireKnown && (!N.MOD_BY_ID[m.id] || m.stacks > N.MOD_BY_ID[m.id].maxStacks)) return false;
    }
    if (p.core.some(id => typeof id !== 'string' || (requireKnown && !N.PROTOCOL_BY_ID[id]))) return false;
    return !requireKnown || (N.Ships.types.some(type => type.id === p.shipType) && (p.shipColor === '#00f0ff' || N.Ships.palette.some(color => color.color === p.shipColor)));
  };

  L.validate = function (data) {
    if (!plain(data) || data.version !== 1 || !Array.isArray(data.ships) || data.ships.length > L.limit) return false;
    const names = new Set();
    for (const ship of data.ships) {
      if (!L.validateShip(ship, false) || names.has(ship.name.toLowerCase())) return false;
      names.add(ship.name.toLowerCase());
    }
    return true;
  };
  L.read = function () {
    try {
      const raw = localStorage.getItem(L.key);
      if (raw === null) return { ok: true, data: { version: 1, ships: [] } };
      const data = JSON.parse(raw);
      return L.validate(data) ? { ok: true, data } : { ok: false, error: 'SAVED SHIP LIST IS INVALID. STORED DATA WAS PRESERVED.' };
    } catch (error) {
      return { ok: false, error: 'SAVED SHIPS COULD NOT BE READ. STORED DATA WAS PRESERVED.' };
    }
  };
  function write(data) {
    return N.Storage.write(L.key, data) ? { ok: true } : { ok: false, error: 'SAVED SHIPS COULD NOT BE WRITTEN.' };
  }
  L.capture = function (name) {
    const G = N.Game;
    if (!G.run || !G.player || G.player.dead || !['paused', 'complete', 'inventory'].includes(G.mode)) return null;
    const player = {};
    for (const key of fields) player[key] = N.deepClone(G.player[key]);
    player.weapons = G.player.weapons.map(w => ({ id: w.id, level: w.level, tier: w.tier }));
    return { name: name.trim(), highestSector: Math.max(G.run.level, G.run.highestSector || 1, G.player.loadoutHighestSector || 1), player };
  };
  L.save = function (name, replace = false) {
    const found = L.read(), ship = L.capture(name);
    if (!found.ok) return found;
    if (!L.validateShip(ship)) return { ok: false, error: 'THIS PILOT CANNOT BE SAVED AS A SHIP.' };
    const index = found.data.ships.findIndex(item => item.name.toLowerCase() === ship.name.toLowerCase());
    if (index >= 0 && !replace) return { ok: false, error: 'THAT NAME ALREADY EXISTS. CHOOSE UPDATE TO REPLACE IT.' };
    if (index < 0 && found.data.ships.length >= L.limit) return { ok: false, error: 'THREE SHIPS ARE SAVED. DELETE ONE BEFORE ADDING ANOTHER.' };
    if (index < 0) found.data.ships.push(ship);
    else found.data.ships[index] = ship;
    return write(found.data);
  };
  L.rename = function (name, next) {
    const found = L.read();
    if (!found.ok) return found;
    next = next.trim();
    if (!L.validName(next) || found.data.ships.some(ship => ship.name !== name && ship.name.toLowerCase() === next.toLowerCase())) return { ok: false, error: 'USE A UNIQUE NAME OF 1 TO 32 CHARACTERS.' };
    const ship = found.data.ships.find(item => item.name === name);
    if (!ship) return { ok: false, error: 'SAVED SHIP NOT FOUND.' };
    ship.name = next;
    return write(found.data);
  };
  L.remove = function (name) {
    const found = L.read();
    if (!found.ok) return found;
    found.data.ships = found.data.ships.filter(ship => ship.name !== name);
    return write(found.data);
  };
  L.find = function (name) {
    const found = L.read();
    return found.ok ? found.data.ships.find(ship => ship.name === name) || null : null;
  };
  L.apply = function (player, ship) {
    if (!L.validateShip(ship)) return false;
    for (const key of fields) player[key] = N.deepClone(ship.player[key]);
    player.weapons = ship.player.weapons.map(w => N.Game.makeWeapon(w.id, w.tier, w.level));
    player.loadoutHighestSector = ship.highestSector;
    // Named ships launch new runs, so use current hull bases with earned upgrades.
    player.hullStatsVersion = 1;
    player.stats = null;
    player.hp = null;
    player.shield = null;
    N.Game.rebuildStats(player, true);
    return true;
  };
})();
