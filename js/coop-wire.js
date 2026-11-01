/* Binary layout for co-op fight messages. Version 1.
 * encode returns null when the message stays JSON or a value does not fit.
 * A value that does not fit is not wrapped. */
(function () {
  'use strict';
  const N = window.NEON;
  const Wire = N.Wire = { VERSION: 1 };
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const TYPES = {
    state: 1, world: 2, bullet: 3, ebullet: 4, mine: 5, strike: 6, fire: 7, fx: 8,
    loadout: 9, hit: 10, heal: 11, kill: 12, xp: 13, grant: 14, grant_ack: 15,
    event_ack: 16, participant: 17, lives: 18
  };
  const TYPE_NAME = [];
  for (const name in TYPES) TYPE_NAME[TYPES[name]] = name;

  const KINDS = ['pulse', 'scatter', 'rail', 'spiral', 'seeker', 'nova', 'mortar', 'tesla', 'void', 'chain', 'shard', 'gravity', 'hostile'];
  const ITEM_KINDS = ['weapon', 'mod', 'consumable'];
  const STAT_EXTRAS = ['pickupRadius', 'moveSpeed', 'shieldDelay'];

  let catalogs = null;
  let writer = null;
  let reader = null;

  function fail() {
    const error = new Error('wire range');
    error.wire = true;
    throw error;
  }

  function catalogsOf() {
    if (catalogs) return catalogs;
    const weapons = (N.WEAPONS || []).map(function (item) { return item.id; });
    const mods = (N.MODS || []).map(function (item) { return item.id; });
    const protocols = (N.PROTOCOLS || []).map(function (item) { return item.id; });
    const consumables = Object.keys(N.CONSUMABLES || {});
    const ships = ((N.Ships && N.Ships.types) || []).map(function (item) { return item.id; });
    const styles = N.ENEMY_STYLES || [];
    const styleById = {};
    for (let index = 0; index < styles.length; index++) {
      styleById[styles[index].id] = { index: index, role: styles[index].role, name: styles[index].name };
    }
    const statKeys = Object.keys(N.BASE_STATS || {});
    for (const key of STAT_EXTRAS) if (!statKeys.includes(key)) statKeys.push(key);
    catalogs = { weapons: weapons, mods: mods, protocols: protocols, consumables: consumables, ships: ships, styleById: styleById, styles: styles, statKeys: statKeys };
    return catalogs;
  }

  function Writer() {
    this.storage = new Uint8Array(256);
    this.length = 0;
    this.view = new DataView(this.storage.buffer);
  }
  Writer.prototype.need = function (count) {
    if (this.length + count <= this.storage.length) return;
    let size = this.storage.length;
    while (size < this.length + count) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.storage.subarray(0, this.length));
    this.storage = next;
    this.view = new DataView(next.buffer);
  };
  Writer.prototype.u8 = function (value) {
    if ((value | 0) !== value || value < 0 || value > 255) fail();
    this.need(1);
    this.storage[this.length++] = value;
  };
  Writer.prototype.u16 = function (value) {
    if ((value | 0) !== value || value < 0 || value > 65535) fail();
    this.need(2);
    this.view.setUint16(this.length, value, true);
    this.length += 2;
  };
  Writer.prototype.i16 = function (value) {
    if ((value | 0) !== value || value < -32768 || value > 32767) fail();
    this.need(2);
    this.view.setInt16(this.length, value, true);
    this.length += 2;
  };
  Writer.prototype.u24 = function (value) {
    if ((value | 0) !== value || value < 0 || value > 16777215) fail();
    this.u8(value & 255);
    this.u8((value >> 8) & 255);
    this.u8((value >> 16) & 255);
  };
  Writer.prototype.u32 = function (value) {
    if (!Number.isInteger(value) || value < 0 || value > 4294967295) fail();
    this.need(4);
    this.view.setUint32(this.length, value, true);
    this.length += 4;
  };
  Writer.prototype.f32 = function (value) {
    if (!Number.isFinite(value)) fail();
    this.need(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
  };
  Writer.prototype.bytes = function (raw) {
    this.need(raw.length);
    this.storage.set(raw, this.length);
    this.length += raw.length;
  };
  Writer.prototype.done = function () {
    return this.storage.buffer.slice(0, this.length);
  };

  function Reader(buffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.length = buffer.byteLength;
    this.offset = 0;
  }
  Reader.prototype.need = function (count) {
    if (this.offset + count > this.length) fail();
  };
  Reader.prototype.u8 = function () {
    this.need(1);
    return this.bytes[this.offset++];
  };
  Reader.prototype.u16 = function () {
    this.need(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  };
  Reader.prototype.i16 = function () {
    this.need(2);
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  };
  Reader.prototype.u24 = function () {
    return this.u8() | (this.u8() << 8) | (this.u8() << 16);
  };
  Reader.prototype.u32 = function () {
    this.need(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  };
  Reader.prototype.f32 = function () {
    this.need(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  };
  Reader.prototype.raw = function (count) {
    this.need(count);
    const slice = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  };

  function scaled(value, digits, signed, bits) {
    if (!Number.isFinite(value)) fail();
    const n = Math.round(value * (10 ** digits));
    const limit = bits === 24 ? 16777216 : 2 ** bits;
    const max = signed ? (limit / 2) - 1 : limit - 1;
    const min = signed ? -(limit / 2) : 0;
    if (n < min || n > max) fail();
    return n;
  }
  function fromScaled(n, digits) {
    return Number((n / (10 ** digits)).toFixed(digits));
  }
  function pos(value) { return scaled(value + 1024, 1, false, 16); }
  function fromPos(n) { return fromScaled(n, 1) - 1024; }

  function colorBytes(value) {
    if (typeof value !== 'string') return null;
    const hex = /^#([0-9a-f]{6})$/.exec(value);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return [0, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const hsl = /^hsl\(([0-9]{1,3}),([0-9]{1,3})%,([0-9]{1,3})%\)$/.exec(value);
    if (!hsl) return null;
    const hue = Number(hsl[1]);
    const sat = Number(hsl[2]);
    const light = Number(hsl[3]);
    if (hue > 360 || sat > 100 || light > 100) return null;
    return [1, hue & 255, (hue >> 8) & 255, sat, light];
  }
  function writeColor(value) {
    const bytes = colorBytes(value);
    if (!bytes) fail();
    for (const byte of bytes) writer.u8(byte);
  }
  function readColor() {
    const mode = reader.u8();
    if (mode === 0) {
      const n = (reader.u8() << 16) | (reader.u8() << 8) | reader.u8();
      return '#' + n.toString(16).padStart(6, '0');
    }
    if (mode === 1) {
      const hue = reader.u8() | (reader.u8() << 8);
      return 'hsl(' + hue + ',' + reader.u8() + '%,' + reader.u8() + '%)';
    }
    fail();
  }

  function writeText(value, maxChars) {
    if (typeof value !== 'string' || value.length > maxChars) fail();
    const raw = textEncoder.encode(value);
    if (raw.length > 255) fail();
    writer.u8(raw.length);
    writer.bytes(raw);
  }
  function readText() {
    const count = reader.u8();
    return textDecoder.decode(reader.raw(count));
  }

  function lookup(list, id) {
    const index = list.indexOf(id);
    if (index < 0 || index > 255) fail();
    return index;
  }

  function writeHeader(message) {
    const sector = message._sector || 0;
    const life = message._life || 0;
    const run = message._run || 0;
    const seq = message._s || 0;
    if (sector > 255 || life > 255) fail();
    writer.u8(Wire.VERSION);
    writer.u8(TYPES[message.t]);
    writer.u8(sector);
    writer.u8(life);
    if (message._targetLife == null) writer.u8(255);
    else {
      /* 255 means the field is absent. A real target life of 255 stays JSON. */
      if (message._targetLife === 255) fail();
      writer.u8(message._targetLife);
    }
    writer.u16(scaled(run, 0, false, 16));
    writer.u32(seq);
  }
  function readHeader() {
    const version = reader.u8();
    if (version !== Wire.VERSION) fail();
    const type = reader.u8();
    const message = {
      t: TYPE_NAME[type],
      _sector: reader.u8(),
      _life: reader.u8()
    };
    if (!message.t) fail();
    const target = reader.u8();
    if (target !== 255) message._targetLife = target;
    message._run = reader.u16();
    message._s = reader.u32();
    return message;
  }

  function writeIndexList(ids, list) {
    if (!Array.isArray(ids) || ids.length > 255) fail();
    writer.u8(ids.length);
    for (const id of ids) writer.u8(lookup(list, id));
  }
  function readIndexList(list) {
    const count = reader.u8();
    const ids = [];
    for (let index = 0; index < count; index++) ids.push(list[reader.u8()]);
    return ids;
  }

  function writeGear(list, fields) {
    if (!Array.isArray(list) || list.length > 255) fail();
    writer.u8(list.length);
    for (const item of list) {
      writer.u8(lookup(fields.ids, item.id));
      for (const key of fields.keys) writer.u8(scaled(item[key] || 0, 0, false, 8));
    }
  }
  function readGear(list, keys) {
    const count = reader.u8();
    const items = [];
    for (let index = 0; index < count; index++) {
      const item = { id: list[reader.u8()] };
      if (!item.id) fail();
      for (const key of keys) item[key] = reader.u8();
      items.push(item);
    }
    return items;
  }

  function writeStats(stats) {
    const keys = catalogsOf().statKeys;
    if (!stats || typeof stats !== 'object') fail();
    const present = [];
    for (const key of Object.keys(stats)) {
      if (!keys.includes(key) || typeof stats[key] !== 'number' || !Number.isFinite(stats[key])) fail();
      present.push(key);
    }
    if (present.length > 255) fail();
    writer.u8(present.length);
    for (const key of keys) {
      if (!present.includes(key)) continue;
      writer.u8(keys.indexOf(key));
      writer.f32(stats[key]);
    }
  }
  function readStats() {
    const keys = catalogsOf().statKeys;
    const count = reader.u8();
    const stats = {};
    for (let index = 0; index < count; index++) {
      const key = keys[reader.u8()];
      if (!key) fail();
      stats[key] = reader.f32();
    }
    return stats;
  }

  function writeRewards(rewards) {
    const pending = rewards && Array.isArray(rewards.pending) ? rewards.pending : null;
    if (!rewards || !pending || pending.length > 4) fail();
    writer.f32(Number.isFinite(rewards.combat) ? rewards.combat : 0);
    writer.u16(scaled(rewards.kills || 0, 0, false, 16));
    writer.u8(rewards.first ? 1 : 0);
    writer.u8(pending.length);
    for (const item of pending) {
      writer.u8(lookup(ITEM_KINDS, item.kind));
      writeItemId(item.kind, item.itemId);
      writer.u8(scaled(item.tier || 1, 0, false, 8));
      writeColor(item.color);
    }
  }
  function readRewards() {
    const cats = catalogsOf();
    const rewards = { combat: reader.f32(), kills: reader.u16(), first: !!reader.u8(), pending: [] };
    const count = reader.u8();
    for (let index = 0; index < count; index++) {
      const kind = ITEM_KINDS[reader.u8()];
      rewards.pending.push({ kind: kind, itemId: readItemId(kind, cats), tier: reader.u8(), color: readColor() });
    }
    return rewards;
  }

  function itemList(kind, cats) {
    if (kind === 'weapon') return cats.weapons;
    if (kind === 'mod') return cats.mods;
    if (kind === 'consumable') return cats.consumables;
    fail();
  }
  function writeItemId(kind, id) {
    writer.u8(lookup(itemList(kind, catalogsOf()), id));
  }
  function readItemId(kind, cats) {
    const id = itemList(kind, cats)[reader.u8()];
    if (!id) fail();
    return id;
  }

  function writeGrants(ids) {
    if (!Array.isArray(ids) || ids.length > 255) fail();
    writer.u8(ids.length);
    for (const id of ids) {
      const match = /^g([0-9]+)$/.exec(id);
      if (!match) fail();
      writer.u16(scaled(Number(match[1]), 0, false, 16));
    }
  }
  function readGrants() {
    const count = reader.u8();
    const ids = [];
    for (let index = 0; index < count; index++) ids.push('g' + reader.u16());
    return ids;
  }

  function writeEvents(ids) {
    if (!Array.isArray(ids) || ids.length > 4096) fail();
    writer.u16(ids.length);
    for (const id of ids) writer.u16(scaled(id, 0, false, 16));
  }
  function readEvents() {
    const count = reader.u16();
    const ids = [];
    for (let index = 0; index < count; index++) ids.push(reader.u16());
    return ids;
  }

  function writePlayer(player) {
    if (!player) fail();
    const cats = catalogsOf();
    const floats = ['x', 'y', 'vx', 'vy', 'aim', 'heading', 'hp', 'shield', 'xp', 'xpNext', 'invuln', 'shieldDelay', 'dashTimer', 'totalDamage', 'healAccum'];
    for (const key of floats) writer.f32(Number.isFinite(player[key]) ? player[key] : 0);
    writer.u16(scaled(player.level || 1, 0, false, 16));
    writeGear(player.weapons, { ids: cats.weapons, keys: ['tier', 'level'] });
    writeGear(player.passives, { ids: cats.mods, keys: ['stacks'] });
    writeIndexList(player.core, cats.protocols);
    writer.u8(scaled(player.activeWeapon || 0, 0, false, 8));
    writer.u8(scaled(player.weaponSlots || 0, 0, false, 8));
    writer.u8(scaled(player.passiveSlots || 0, 0, false, 8));
    writer.u8(scaled(player.dashCharges || 0, 0, false, 8));
    writer.u8(scaled(player.maxDashCharges || 0, 0, false, 8));
    const buffs = player.buffs || {};
    writer.f32(buffs.overclock || 0);
    writer.f32(buffs.speed || 0);
    writer.f32(buffs.magnet || 0);
    writeStats(player.stats);
    writer.u8(player.dead ? 1 : 0);
    writer.u8(lookup(cats.ships, player.shipType));
    writeColor(player.shipColor);
    writeRewards(player.rewards);
    writer.u16(scaled(player.pendingLevelUps || 0, 0, false, 16));
    if (!Number.isInteger(player.life) || player.life < 0) fail();
    writer.u32(player.life);
    writeEvents(player.acceptedEvents || []);
    if (player.respawnSeconds == null) writer.u8(0);
    else { writer.u8(1); writer.f32(player.respawnSeconds); }
    writeGrants(player.acceptedGrants || []);
  }
  function readPlayer() {
    const cats = catalogsOf();
    const player = {};
    const floats = ['x', 'y', 'vx', 'vy', 'aim', 'heading', 'hp', 'shield', 'xp', 'xpNext', 'invuln', 'shieldDelay', 'dashTimer', 'totalDamage', 'healAccum'];
    for (const key of floats) player[key] = reader.f32();
    player.level = reader.u16();
    player.weapons = readGear(cats.weapons, ['tier', 'level']);
    player.passives = readGear(cats.mods, ['stacks']);
    player.core = readIndexList(cats.protocols);
    player.activeWeapon = reader.u8();
    player.weaponSlots = reader.u8();
    player.passiveSlots = reader.u8();
    player.dashCharges = reader.u8();
    player.maxDashCharges = reader.u8();
    player.buffs = { overclock: reader.f32(), speed: reader.f32(), magnet: reader.f32() };
    player.stats = readStats();
    player.dead = !!reader.u8();
    player.shipType = cats.ships[reader.u8()];
    if (!player.shipType) fail();
    player.shipColor = readColor();
    player.rewards = readRewards();
    player.pendingLevelUps = reader.u16();
    player.life = reader.u32();
    player.acceptedEvents = readEvents();
    player.respawnSeconds = reader.u8() ? reader.f32() : null;
    player.acceptedGrants = readGrants();
    return player;
  }

  /* Player hull is uint16 tenths. Enemy hull is uint24 tenths so an 80-enemy
   * world stays within its size ceiling. A value that does not fit stays JSON. */
  function writeState(message) {
    writeText(message.name || '', 20);
    writer.u16(pos(message.x));
    writer.u16(pos(message.y));
    writer.i16(scaled(message.vx || 0, 1, true, 16));
    writer.i16(scaled(message.vy || 0, 1, true, 16));
    writer.i16(scaled(message.aim || 0, 3, true, 16));
    writer.i16(scaled(message.heading || 0, 3, true, 16));
    writer.u16(scaled(message.hp || 0, 1, false, 16));
    writer.u16(scaled(message.maxHp || 0, 1, false, 16));
    writer.u16(scaled(message.shield || 0, 1, false, 16));
    writer.u16(scaled(message.maxShield || 0, 1, false, 16));
    writer.u16(scaled(message.level || 1, 0, false, 16));
    writer.u8((message.dead ? 1 : 0) | (message.magnet ? 2 : 0) | (message.participant ? 4 : 0));
    writer.u16(scaled(message.invuln || 0, 2, false, 16));
    writer.u8(lookup(catalogsOf().ships, message.shipType));
    writeColor(message.shipColor);
    writer.u16(scaled(message.pickupRadius || 0, 1, false, 16));
    if (message.participant) writePlayer(message.participant);
  }
  function readState(message) {
    message.name = readText();
    message.x = fromPos(reader.u16());
    message.y = fromPos(reader.u16());
    message.vx = fromScaled(reader.i16(), 1);
    message.vy = fromScaled(reader.i16(), 1);
    message.aim = fromScaled(reader.i16(), 3);
    message.heading = fromScaled(reader.i16(), 3);
    message.hp = fromScaled(reader.u16(), 1);
    message.maxHp = fromScaled(reader.u16(), 1);
    message.shield = fromScaled(reader.u16(), 1);
    message.maxShield = fromScaled(reader.u16(), 1);
    message.level = reader.u16();
    const flags = reader.u8();
    message.dead = !!(flags & 1);
    message.magnet = !!(flags & 2);
    message.invuln = fromScaled(reader.u16(), 2);
    message.shipType = catalogsOf().ships[reader.u8()];
    if (!message.shipType) fail();
    message.shipColor = readColor();
    message.pickupRadius = fromScaled(reader.u16(), 1);
    if (flags & 4) message.participant = readPlayer();
  }

  function enemyNumber(id) {
    const match = /^enemy_([0-9]+)$/.exec(id);
    if (!match) fail();
    return scaled(Number(match[1]), 0, false, 16);
  }
  function writeEnemy(row) {
    if (!Array.isArray(row) || row.length < 18) fail();
    const style = catalogsOf().styleById[row[1]];
    if (!style) fail();
    writer.u16(enemyNumber(row[0]));
    writer.u8(style.index);
    writer.u8((row[14] ? 1 : 0) | (row[15] ? 2 : 0));
    writer.u16(pos(row[4]));
    writer.u16(pos(row[5]));
    writer.u16(scaled(row[6], 1, false, 16));
    writer.u24(scaled(row[7], 1, false, 24));
    writer.u24(scaled(row[8], 1, false, 24));
    writer.u24(scaled(row[9] || 0, 1, false, 24));
    writer.u24(scaled(row[10] || 0, 1, false, 24));
    writer.i16(scaled(row[11] || 0, 3, true, 16));
    writer.u8(scaled(row[12] || 0, 2, false, 8));
    writer.u8(scaled(row[13] || 0, 2, false, 8));
    writeColor(row[16]);
    writer.i16(scaled(row[17] || 0, 2, true, 16));
  }
  function readEnemy() {
    const id = reader.u16();
    const style = catalogsOf().styles[reader.u8()];
    if (!style) fail();
    const flags = reader.u8();
    return [
      'enemy_' + id,
      style.id,
      style.role,
      style.name,
      fromPos(reader.u16()),
      fromPos(reader.u16()),
      fromScaled(reader.u16(), 1),
      fromScaled(reader.u24(), 1),
      fromScaled(reader.u24(), 1),
      fromScaled(reader.u24(), 1),
      fromScaled(reader.u24(), 1),
      fromScaled(reader.i16(), 3),
      fromScaled(reader.u8(), 2),
      fromScaled(reader.u8(), 2),
      flags & 1 ? 1 : 0,
      flags & 2 ? 1 : 0,
      readColor(),
      fromScaled(reader.i16(), 2)
    ];
  }

  function writeTaggedId(id, pattern) {
    const match = pattern.exec(id);
    if (match) { writer.u8(0); writer.u16(scaled(Number(match[1]), 0, false, 16)); return; }
    writer.u8(1);
    writeText(String(id || ''), 40);
  }
  function readTaggedId(prefix) {
    if (reader.u8() === 0) return prefix + reader.u16();
    return readText();
  }

  function writeWorld(message) {
    writer.u16(scaled(message.time || 0, 2, false, 16));
    writer.u32(scaled(message.kills || 0, 0, false, 32));
    writer.u32(scaled(message.totalKills || 0, 0, false, 32));
    writer.u32(scaled(message.damage || 0, 0, false, 32));
    const enemies = Array.isArray(message.e) ? message.e : null;
    const anchors = Array.isArray(message.a) ? message.a : null;
    const caches = Array.isArray(message.c) ? message.c : null;
    const items = Array.isArray(message.g) ? message.g : null;
    if (!enemies || !anchors || !caches || !items) fail();
    if (enemies.length > 255 || anchors.length > 255 || caches.length > 255 || items.length > 255) fail();
    writer.u8(enemies.length);
    for (const row of enemies) writeEnemy(row);
    writer.u8(anchors.length);
    for (const row of anchors) {
      writeTaggedId(row[0], /^anchor_([0-9]+)$/);
      writer.u24(scaled(row[1], 1, false, 24));
      writer.u8(row[2] ? 1 : 0);
      writer.u8(scaled(row[3] || 0, 2, false, 8));
    }
    writer.u8(caches.length);
    for (const row of caches) {
      writeTaggedId(row[0], /^cache_([0-9]+)$/);
      writer.u24(scaled(row[1], 1, false, 24));
      writer.u8(row[2] ? 1 : 0);
      writer.u8(scaled(row[3] || 0, 2, false, 8));
    }
    writer.u8(items.length);
    for (const row of items) {
      writeTaggedId(row[0], /^loot([0-9]+)$/);
      writer.u8(lookup(ITEM_KINDS, row[1]));
      writeItemId(row[1], row[2]);
      writer.u16(pos(row[3]));
      writer.u16(pos(row[4]));
      writer.u8(scaled(row[5] || 1, 0, false, 8));
      writeColor(row[6]);
      writeText(row[7] || '', 40);
      writer.u16(scaled(row[8] || 0, 2, false, 16));
    }
  }
  function readWorld(message) {
    message.time = fromScaled(reader.u16(), 2);
    message.kills = reader.u32();
    message.totalKills = reader.u32();
    message.damage = reader.u32();
    const enemies = reader.u8();
    message.e = [];
    for (let index = 0; index < enemies; index++) message.e.push(readEnemy());
    message.a = [];
    for (let index = 0, count = reader.u8(); index < count; index++) {
      message.a.push([readTaggedId('anchor_'), fromScaled(reader.u24(), 1), reader.u8(), fromScaled(reader.u8(), 2)]);
    }
    message.c = [];
    for (let index = 0, count = reader.u8(); index < count; index++) {
      message.c.push([readTaggedId('cache_'), fromScaled(reader.u24(), 1), reader.u8(), fromScaled(reader.u8(), 2)]);
    }
    message.g = [];
    for (let index = 0, count = reader.u8(); index < count; index++) {
      const id = readTaggedId('loot');
      const kind = ITEM_KINDS[reader.u8()];
      message.g.push([
        id,
        kind,
        readItemId(kind, catalogsOf()),
        fromPos(reader.u16()),
        fromPos(reader.u16()),
        reader.u8(),
        readColor(),
        readText(),
        fromScaled(reader.u16(), 2)
      ]);
    }
  }

  /* A third entry is the bit width when the digit count would pick the wrong one.
   * pull reaches 820, which does not fit in a uint8. */
  const BULLET_NUMBERS = {
    x: [1, false], y: [1, false], angle: [3, true], speed: [1, false], size: [2, false], life: [2, false],
    pierce: [0, false], bounce: [0, false], chain: [0, false], aoe: [1, false], curve: [3, true],
    turnRate: [2, false], accel: [1, false], tick: [2, false], pull: [0, false, 16], critChance: [3, false], critMul: [2, false]
  };
  const BULLET_BITS = ['x', 'y', 'angle', 'speed', 'size', 'life', 'color', 'kind', 'pierce', 'bounce', 'chain', 'aoe', 'curve', 'homing', 'turnRate', 'accel', 'trail', 'dot', 'tick', 'pull', 'explode', 'weaponId', 'critChance', 'critMul'];

  function bulletBit(bullet, key) {
    if (key === 'homing' || key === 'trail' || key === 'dot' || key === 'explode') return !!bullet[key];
    if (key === 'weaponId') return !!bullet.weaponId;
    if (key === 'color' || key === 'kind') return !!bullet[key];
    return !!bullet[key];
  }
  function writeBullet(bullet) {
    if (!bullet) fail();
    let mask = 0;
    for (let bit = 0; bit < BULLET_BITS.length; bit++) if (bulletBit(bullet, BULLET_BITS[bit])) mask |= 1 << bit;
    writer.u32(mask);
    for (const key of BULLET_BITS) {
      if (!(mask & (1 << BULLET_BITS.indexOf(key)))) continue;
      if (key === 'color') writeColor(bullet.color);
      else if (key === 'kind') writer.u8(lookup(KINDS, bullet.kind));
      else if (key === 'weaponId') writer.u8(lookup(catalogsOf().weapons, bullet.weaponId));
      else if (key === 'homing' || key === 'trail' || key === 'dot' || key === 'explode') continue;
      else if (key === 'x' || key === 'y') writer.u16(pos(bullet[key]));
      else {
        const spec = BULLET_NUMBERS[key];
        const bits = spec.length > 2 ? spec[2] : (spec[0] === 0 ? 8 : 16);
        const n = scaled(bullet[key], spec[0], spec[1], bits);
        if (spec[1]) writer.i16(n);
        else if (bits === 8) writer.u8(n);
        else writer.u16(n);
      }
    }
  }
  function readBullet() {
    const mask = reader.u32();
    const bullet = {
      x: 0, y: 0, angle: 0, speed: 0, size: 0, life: 0, color: '#00f0ff', kind: 'pulse',
      pierce: 0, bounce: 0, chain: 0, aoe: 0, curve: 0, homing: false, turnRate: 0, accel: 0,
      trail: false, dot: false, tick: 0, pull: 0, explode: false, weaponId: null, critChance: 0, critMul: 0
    };
    for (let bit = 0; bit < BULLET_BITS.length; bit++) {
      if (!(mask & (1 << bit))) continue;
      const key = BULLET_BITS[bit];
      if (key === 'color') bullet.color = readColor();
      else if (key === 'kind') bullet.kind = KINDS[reader.u8()];
      else if (key === 'weaponId') bullet.weaponId = catalogsOf().weapons[reader.u8()];
      else if (key === 'homing' || key === 'trail' || key === 'dot' || key === 'explode') bullet[key] = true;
      else if (key === 'x' || key === 'y') bullet[key] = fromPos(reader.u16());
      else {
        const spec = BULLET_NUMBERS[key];
        const bits = spec.length > 2 ? spec[2] : (spec[0] === 0 ? 8 : 16);
        const n = spec[1] ? reader.i16() : (bits === 8 ? reader.u8() : reader.u16());
        bullet[key] = fromScaled(n, spec[0]);
      }
    }
    return bullet;
  }
  function writeBatch(list) {
    if (!Array.isArray(list) || list.length > 120) fail();
    writer.u8(list.length);
    for (const item of list) writeBullet(item);
  }
  function readBatch() {
    const count = reader.u8();
    const list = [];
    for (let index = 0; index < count; index++) list.push(readBullet());
    return list;
  }

  /* Presence bits, in order: x, y, damage, radius, color, life, armTime, owner.
   * A clear owner bit means player. A set bit means enemy and has no payload. */
  function writeMine(mine) {
    if (!mine) fail();
    const owner = mine.owner || 'player';
    if (owner !== 'player' && owner !== 'enemy') fail();
    let mask = 0;
    if (mine.x) mask |= 1;
    if (mine.y) mask |= 2;
    if (mine.damage) mask |= 4;
    if (mine.radius) mask |= 8;
    if (mine.color) mask |= 16;
    if (mine.life) mask |= 32;
    if (mine.armTime) mask |= 64;
    if (owner === 'enemy') mask |= 128;
    writer.u8(mask);
    if (mask & 1) writer.u16(pos(mine.x));
    if (mask & 2) writer.u16(pos(mine.y));
    if (mask & 4) writer.u16(scaled(mine.damage, 1, false, 16));
    if (mask & 8) writer.u16(scaled(mine.radius, 1, false, 16));
    if (mask & 16) writeColor(mine.color);
    if (mask & 32) writer.u16(scaled(mine.life, 2, false, 16));
    if (mask & 64) writer.u16(scaled(mine.armTime, 2, false, 16));
  }
  function readMine() {
    const mask = reader.u8();
    return {
      x: mask & 1 ? fromPos(reader.u16()) : 0,
      y: mask & 2 ? fromPos(reader.u16()) : 0,
      damage: mask & 4 ? fromScaled(reader.u16(), 1) : 0,
      radius: mask & 8 ? fromScaled(reader.u16(), 1) : 0,
      color: mask & 16 ? readColor() : '#ff335c',
      life: mask & 32 ? fromScaled(reader.u16(), 2) : 0,
      armTime: mask & 64 ? fromScaled(reader.u16(), 2) : 0,
      owner: mask & 128 ? 'enemy' : 'player'
    };
  }
  function writeStrike(strike) {
    if (!strike) fail();
    let mask = 0;
    if (strike.x) mask |= 1;
    if (strike.y) mask |= 2;
    if (strike.delay) mask |= 4;
    if (strike.radius) mask |= 8;
    if (strike.damage) mask |= 16;
    if (strike.color) mask |= 32;
    writer.u8(mask);
    if (mask & 1) writer.u16(pos(strike.x));
    if (mask & 2) writer.u16(pos(strike.y));
    if (mask & 4) writer.u16(scaled(strike.delay, 2, false, 16));
    if (mask & 8) writer.u16(scaled(strike.radius, 1, false, 16));
    if (mask & 16) writer.u16(scaled(strike.damage, 1, false, 16));
    if (mask & 32) writeColor(strike.color);
  }
  function readStrike() {
    const mask = reader.u8();
    return {
      x: mask & 1 ? fromPos(reader.u16()) : 0,
      y: mask & 2 ? fromPos(reader.u16()) : 0,
      delay: mask & 4 ? fromScaled(reader.u16(), 2) : 0,
      radius: mask & 8 ? fromScaled(reader.u16(), 1) : 0,
      damage: mask & 16 ? fromScaled(reader.u16(), 1) : 0,
      color: mask & 32 ? readColor() : '#ffb31f'
    };
  }
  function writeList(list, writeOne) {
    if (!Array.isArray(list) || list.length > 120) fail();
    writer.u8(list.length);
    for (const item of list) writeOne(item);
  }
  function readList(readOne) {
    const count = reader.u8();
    const list = [];
    for (let index = 0; index < count; index++) list.push(readOne());
    return list;
  }

  function writeLoadout(message) {
    const cats = catalogsOf();
    writeGear(message.weapons, { ids: cats.weapons, keys: ['level', 'tier'] });
    writeGear(message.passives, { ids: cats.mods, keys: ['stacks'] });
    writeIndexList(message.core, cats.protocols);
    writer.u8(scaled(message.activeWeapon || 0, 0, false, 8));
    writeStats(message.stats);
  }
  function readLoadout(message) {
    const cats = catalogsOf();
    message.weapons = readGear(cats.weapons, ['level', 'tier']);
    message.passives = readGear(cats.mods, ['stacks']);
    message.core = readIndexList(cats.protocols);
    message.activeWeapon = reader.u8();
    message.stats = readStats();
  }

  function writeFire(message) {
    writer.u8(message.w ? lookup(catalogsOf().weapons, message.w) : 255);
    writer.i16(scaled(message.a || 0, 3, true, 16));
    writer.u16(pos(message.x));
    writer.u16(pos(message.y));
  }
  function readFire(message) {
    const weapon = reader.u8();
    message.w = weapon === 255 ? null : catalogsOf().weapons[weapon];
    message.a = fromScaled(reader.i16(), 3);
    message.x = fromPos(reader.u16());
    message.y = fromPos(reader.u16());
  }

  function writeFx(message) {
    if (message.kind === 'beam') {
      writer.u8(0);
      writer.u16(pos(message.x1));
      writer.u16(pos(message.y1));
      writer.u16(pos(message.x2));
      writer.u16(pos(message.y2));
      writeColor(message.color);
      writer.f32(message.width || 0);
      writer.f32(message.life || 0);
      return;
    }
    if (message.kind === 'explode') {
      writer.u8(1);
      writer.u16(pos(message.x));
      writer.u16(pos(message.y));
      writer.u16(scaled(message.r || 0, 1, false, 16));
      writeColor(message.color);
      return;
    }
    fail();
  }
  function readFx(message) {
    const kind = reader.u8();
    if (kind === 0) {
      message.kind = 'beam';
      message.x1 = fromPos(reader.u16());
      message.y1 = fromPos(reader.u16());
      message.x2 = fromPos(reader.u16());
      message.y2 = fromPos(reader.u16());
      message.color = readColor();
      message.width = reader.f32();
      message.life = reader.f32();
      return;
    }
    if (kind === 1) {
      message.kind = 'explode';
      message.x = fromPos(reader.u16());
      message.y = fromPos(reader.u16());
      message.r = fromScaled(reader.u16(), 1);
      message.color = readColor();
      return;
    }
    fail();
  }

  function writeEvent(message) {
    writer.u32(Number.isInteger(message.eventId) ? message.eventId : 0);
  }
  function readEvent(message) {
    const id = reader.u32();
    if (id) message.eventId = id;
  }
  function writeHit(message) {
    writeEvent(message);
    writer.u16(scaled(message.amount || 0, 1, false, 16));
    writer.u16(pos(message.x));
    writer.u16(pos(message.y));
    writer.u8(message.contact ? 1 : 0);
  }
  function readHit(message) {
    readEvent(message);
    message.amount = fromScaled(reader.u16(), 1);
    message.x = fromPos(reader.u16());
    message.y = fromPos(reader.u16());
    message.contact = !!reader.u8();
  }

  function writeGrant(message) {
    const item = message.item;
    if (!item) fail();
    const match = /^g([0-9]+)$/.exec(message.grantId || '');
    if (!match) fail();
    writer.u16(scaled(Number(match[1]), 0, false, 16));
    writeText(item.id || '', 40);
    writer.u8(lookup(ITEM_KINDS, item.kind));
    writeItemId(item.kind, item.itemId);
    writer.u16(pos(item.x));
    writer.u16(pos(item.y));
    writer.u8(scaled(item.tier || 1, 0, false, 8));
    writeColor(item.color);
    if (item.label == null) writer.u8(255);
    else writeText(item.label, 40);
  }
  function readGrant(message) {
    message.grantId = 'g' + reader.u16();
    const id = readText();
    const kind = ITEM_KINDS[reader.u8()];
    const itemId = readItemId(kind, catalogsOf());
    const x = fromPos(reader.u16());
    const y = fromPos(reader.u16());
    const tier = reader.u8();
    const color = readColor();
    const mark = reader.u8();
    let label = null;
    if (mark !== 255) label = textDecoder.decode(reader.raw(mark));
    message.item = { id: id, kind: kind, itemId: itemId, x: x, y: y, tier: tier, color: color, label: label };
  }

  function writeAck(message) {
    const match = /^g([0-9]+)$/.exec(message.grantId || '');
    if (!match) fail();
    writer.u16(scaled(Number(match[1]), 0, false, 16));
    writer.u8(message.ok === true ? 1 : 0);
    writer.u8(message.participant ? 1 : 0);
    if (message.participant) writePlayer(message.participant);
  }
  function readAck(message) {
    message.grantId = 'g' + reader.u16();
    message.ok = reader.u8() === 1;
    if (reader.u8()) message.participant = readPlayer();
  }

  function writeNullable(value) {
    if (value == null) { writer.u8(0); return; }
    writer.u8(1);
    writer.f32(value);
  }
  function readNullable() {
    return reader.u8() ? reader.f32() : null;
  }

  const BODY = {
    state: [writeState, readState],
    world: [writeWorld, readWorld],
    bullet: [function (message) { writeBatch(message.b); }, function (message) { message.b = readBatch(); }],
    ebullet: [function (message) { writeBatch(message.b); }, function (message) { message.b = readBatch(); }],
    mine: [function (message) { writeList(message.b, writeMine); }, function (message) { message.b = readList(readMine); }],
    strike: [function (message) { writeList(message.b, writeStrike); }, function (message) { message.b = readList(readStrike); }],
    fire: [writeFire, readFire],
    fx: [writeFx, readFx],
    loadout: [writeLoadout, readLoadout],
    hit: [writeHit, readHit],
    heal: [function (message) { writeEvent(message); writer.u16(scaled(message.amount || 0, 1, false, 16)); }, function (message) { readEvent(message); message.amount = fromScaled(reader.u16(), 1); }],
    kill: [function (message) { writeEvent(message); writer.u32(scaled(message.xp || 0, 0, false, 32)); }, function (message) { readEvent(message); message.xp = reader.u32(); }],
    xp: [function (message) { writeEvent(message); writer.u32(scaled(message.amount || 0, 0, false, 32)); }, function (message) { readEvent(message); message.amount = reader.u32(); }],
    grant: [writeGrant, readGrant],
    grant_ack: [writeAck, readAck],
    event_ack: [function (message) { writer.u32(message.eventId || 0); writePlayer(message.player); }, function (message) { message.eventId = reader.u32(); message.player = readPlayer(); }],
    participant: [function (message) { writePlayer(message.player); }, function (message) { message.player = readPlayer(); }],
    lives: [function (message) { writer.u8(scaled(message.pool || 0, 0, false, 8)); writeNullable(message.seconds); writeNullable(message.hostSeconds); }, function (message) { message.pool = reader.u8(); message.seconds = readNullable(); message.hostSeconds = readNullable(); }]
  };

  Wire.encode = function (message) {
    if (!message || typeof message !== 'object' || !TYPES[message.t]) return null;
    writer = new Writer();
    try {
      writeHeader(message);
      BODY[message.t][0](message);
      return writer.done();
    } catch (error) {
      if (error && error.wire) return null;
      throw error;
    } finally {
      writer = null;
    }
  };

  Wire.decode = function (buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1) return null;
    if (new Uint8Array(buffer)[0] !== Wire.VERSION) return { versionMismatch: true };
    if (buffer.byteLength < 11) return null;
    reader = new Reader(buffer);
    try {
      const message = readHeader();
      const body = BODY[message.t];
      if (!body) fail();
      body[1](message);
      if (reader.offset !== reader.length) fail();
      return message;
    } catch (error) {
      if (error && error.wire) return null;
      throw error;
    } finally {
      reader = null;
    }
  };
})();
