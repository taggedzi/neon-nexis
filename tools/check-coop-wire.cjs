'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder,
  Uint8Array: Uint8Array,
  ArrayBuffer: ArrayBuffer,
  DataView: DataView
};
sandbox.window = sandbox;
sandbox.NEON = {};
vm.createContext(sandbox);

const root = path.join(__dirname, '..', 'js');
for (const file of ['util.js', 'content.js', 'ships.js', 'coop-wire.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: 'js/' + file });
}

const N = sandbox.NEON;
const Wire = N.Wire;
assert.equal(Wire.VERSION, 6);
assert.equal(typeof Wire.encode, 'function');
assert.equal(typeof Wire.decode, 'function');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

function stamp(message, host) {
  message._seat = host ? 0 : 3;
  if (host) message._targetSeat = 3;
  message._sector = 4;
  message._life = 1;
  message._run = 7;
  message._s = 15;
  if (host) message._targetLife = 2;
  return message;
}

function roundTrip(message) {
  const encoded = Wire.encode(message);
  assert.ok(encoded instanceof ArrayBuffer, message.t + ' did not encode');
  const decoded = Wire.decode(encoded);
  assert.equal(JSON.stringify(stable(decoded)), JSON.stringify(stable(message)));
  return encoded.byteLength;
}

function f32(value) {
  return Math.fround(value);
}

function player(eventCount) {
  const stats = {};
  for (const key of Object.keys(N.BASE_STATS)) stats[key] = f32(N.BASE_STATS[key]);
  stats.pickupRadius = f32(95);
  stats.moveSpeed = f32(245);
  stats.shieldDelay = f32(1.25);
  const events = [];
  for (let index = 0; index < eventCount; index++) events.push(index + 1);
  return {
    x: f32(120.5),
    y: f32(-40.25),
    vx: f32(10),
    vy: f32(-3.5),
    aim: f32(1.25),
    heading: f32(0.5),
    hp: f32(80.5),
    shield: f32(20),
    xp: f32(40),
    xpNext: f32(100),
    invuln: f32(0.25),
    shieldDelay: f32(1.25),
    dashTimer: f32(0.125),
    totalDamage: f32(1000),
    healAccum: f32(2.5),
    level: 3,
    weapons: [{ id: 'pulse', tier: 2, level: 4 }, { id: 'rail', tier: 1, level: 1 }],
    passives: [{ id: 'vector', stacks: 3 }],
    core: ['p_proj', 'p_area'],
    activeWeapon: 1,
    weaponSlots: 4,
    passiveSlots: 4,
    dashCharges: 2,
    maxDashCharges: 3,
    buffs: { overclock: f32(1.5), speed: f32(0), magnet: f32(0.25) },
    stats: stats,
    dead: false,
    shipType: 'kite',
    shipColor: '#66ffff',
    rewards: {
      combat: f32(12.5),
      kills: 4,
      first: true,
      pending: [{ kind: 'weapon', itemId: 'rail', tier: 1, color: '#ff2bd6' }]
    },
    pendingLevelUps: 1,
    life: 2,
    acceptedEvents: events,
    respawnSeconds: null,
    acceptedGrants: ['g1', 'g2']
  };
}

function pulse(x) {
  return {
    x: x,
    y: -20,
    angle: 1.047,
    speed: 1040,
    size: 2.2,
    life: 1.15,
    color: '#00f0ff',
    kind: 'pulse',
    pierce: 0,
    bounce: 0,
    chain: 0,
    aoe: 0,
    curve: 0,
    homing: false,
    turnRate: 0,
    accel: 0,
    trail: false,
    dot: false,
    tick: 0,
    pull: 0,
    explode: false,
    weaponId: 'pulse',
    critChance: 0,
    critMul: 1.75
  };
}

const speedMul = 1 + 0.16 * 3 + 0.18;
const areaMul = 1 + 0.1 * 2 + 0.18;
const sizeMul = 1 + 0.08;
const durationMul = 1 + 0.2 * 2 + 0.22;
const maxSpeed = 1950 * speedMul;
const maxAoe = 120 * areaMul;
const maxSize = 12 * sizeMul;
const maxLife = Number((Math.round(2.7 * durationMul * 100) / 100).toFixed(2));
assert.equal(maxSpeed, 3237);
assert.equal(maxAoe, 165.6);
assert.equal(maxSize, 12.96);
assert.equal(maxLife, 4.37);

function maxBullet() {
  return {
    x: 4300.5,
    y: -30,
    angle: -3.142,
    speed: maxSpeed,
    size: maxSize,
    life: maxLife,
    color: '#6ad7ff',
    kind: 'gravity',
    pierce: 7,
    bounce: 4,
    chain: 4,
    aoe: maxAoe,
    curve: 3.2,
    homing: true,
    turnRate: 4.2,
    accel: 430,
    trail: true,
    dot: true,
    tick: 0.26,
    pull: 820,
    explode: true,
    weaponId: 'gravity',
    critChance: 0.26,
    critMul: 1.75
  };
}

const name = 'PLAYER-1234567890ABC';
assert.equal(name.length, 20);

const state = stamp({
  t: 'state',
  name: name,
  x: 4300.5,
  y: -20,
  vx: -12.5,
  vy: 0,
  aim: 3.142,
  heading: -3.142,
  hp: 100,
  maxHp: 188,
  shield: 20.5,
  maxShield: 40,
  level: 8,
  dead: false,
  magnet: true,
  invuln: 0.68,
  shipType: 'dart',
  shipColor: '#00f0ff',
  pickupRadius: 134.9
}, true);
const stateBytes = roundTrip(state);
assert.ok(stateBytes <= 66, 'state ' + stateBytes);

const avatar = { ...state, seconds: null };
for (const key of ['t', '_s', '_run', '_sector', '_life', '_targetLife', '_targetSeat']) delete avatar[key];
const avatarsBytes = roundTrip(stamp({ t: 'avatars', players: [avatar, { ...avatar, _seat: 1 }, { ...avatar, _seat: 2 }] }, true));
assert.ok(avatarsBytes <= 190, 'three remote avatars ' + avatarsBytes);
assert.equal(Wire.encode(stamp({ t: 'avatars', players: [avatar, avatar] }, true)), null, 'duplicate avatar seats stay out of binary');

const deathState = stamp({
  t: 'state',
  name: 'PLAYER 2',
  x: 10,
  y: 10,
  vx: 0,
  vy: 0,
  aim: 0,
  heading: 0,
  hp: 0,
  maxHp: 100,
  shield: 0,
  maxShield: 20,
  level: 1,
  dead: true,
  magnet: false,
  invuln: 0,
  shipType: 'delta',
  shipColor: '#ff77e6',
  pickupRadius: 95,
  participant: player(2)
}, false);
roundTrip(deathState);

const dart = N.ENEMY_STYLES[0];
const boss = N.ENEMY_STYLES.find(function (style) { return style.id === 'boss'; });
assert.equal(dart.id, 'dart');
assert.equal(dart.name, 'DART WISP');
assert.ok(boss);

const enemies = [];
for (let index = 0; index < 80; index++) {
  const style = index === 79 ? boss : dart;
  enemies.push([
    'enemy_' + (index + 1),
    style.id,
    style.role,
    style.name,
    index % 2 ? 4300.5 : -20,
    200 + index,
    15.5,
    index === 79 ? 9130.5 : 80.5,
    index === 79 ? 9130.5 : 110,
    index === 79 ? 40 : 0,
    index === 79 ? 40 : 0,
    index % 2 ? 1.047 : -1.047,
    0.42,
    index % 3 ? 0 : 1,
    index % 5 ? 0 : 1,
    index === 79 ? 1 : 0,
    index % 2 ? 'hsl(350,96%,66%)' : 'hsl(190,90%,59%)',
    index === 0 ? 300.28 : 1.25
  ]);
}

const world = stamp({
  t: 'world',
  time: 120.5,
  kills: 40,
  totalKills: 80,
  damage: 25000,
  e: enemies,
  a: [
    ['anchor_1', 5000.5, 1, 0.25],
    ['anchor_2', 40, 0, 0],
    ['anchor_3', 10.5, 1, 0]
  ],
  c: [
    ['cache_1', 80, 1, 0.25],
    ['cache_2', 0, 0, 0]
  ],
  g: [
    ['loot1', 'weapon', 'pulse', 10, 20.5, 2, '#00f0ff', 'PULSE LANCE', 0.5],
    ['loot2', 'mod', 'vector', 30, 40, 1, '#ffb31f', 'VECTOR BOOST', 0],
    ['loot3', 'consumable', 'repair', 50.5, 60, 1, '#b6ff2b', 'REPAIR', 1.25]
  ]
}, true);
const worldBytes = roundTrip(world);
assert.ok(worldBytes <= 3200, 'world ' + worldBytes);

const oneBullet = stamp({ t: 'bullet', b: [pulse(100.5)] }, true);
const bulletBytes = roundTrip(oneBullet);
assert.ok(bulletBytes <= 48, 'bullet ' + bulletBytes);

const batch = [];
for (let index = 0; index < 8; index++) batch.push(pulse(100.5 + index));
const batchBytes = roundTrip(stamp({ t: 'bullet', b: batch }, true));
assert.ok(batchBytes <= 320, 'batch ' + batchBytes);

roundTrip(stamp({ t: 'ebullet', b: [Object.assign(pulse(12), { kind: 'hostile', weaponId: null, color: '#ff335c' })] }, true));
roundTrip(stamp({ t: 'bullet', b: [maxBullet()] }, true));

const tooFast = stamp({ t: 'bullet', b: [Object.assign(pulse(1), { speed: 8000 })] }, true);
assert.equal(Wire.encode(tooFast), null);

roundTrip(stamp({
  t: 'mine',
  b: [
    { x: 80.5, y: 90, owner: 'player', damage: 34.5, radius: 88, color: '#ff335c', life: 9, armTime: 0.45 },
    { x: 0, y: 15, owner: 'enemy', damage: 0, radius: 40, color: '#ff335c', life: 4.5, armTime: 0 }
  ]
}, true));

roundTrip(stamp({
  t: 'strike',
  b: [
    { x: 200, y: 210.5, delay: 0.55, radius: 74, damage: 26, color: '#ffb31f' },
    { x: 0, y: 12, delay: 0, radius: 70, damage: 25, color: '#ffb31f' }
  ]
}, true));

roundTrip(stamp({ t: 'fire', statsFire: 123, w: 'rail', a: 1.047, x: 20, y: 30.5 }, false));
roundTrip(stamp({ t: 'fire', statsFire: 0, w: null, a: 0, x: 0, y: 0 }, false));
roundTrip(stamp({
  t: 'fx',
  kind: 'beam',
  x1: 1,
  y1: 2,
  x2: 30.5,
  y2: -10,
  color: '#b6ff2b',
  width: f32(3.5),
  life: f32(0.2)
}, true));
roundTrip(stamp({ t: 'fx', kind: 'explode', x: 40, y: 50.5, r: 74, color: '#ffb31f' }, true));

roundTrip(stamp({
  t: 'loadout',
  weapons: [{ id: 'pulse', level: 4, tier: 2 }],
  passives: [{ id: 'vector', stacks: 2 }],
  core: ['p_proj'],
  activeWeapon: 0,
  stats: player(0).stats
}, false));

roundTrip(stamp({ t: 'hit', eventId: 9, amount: 34.5, x: 10, y: 12.5, contact: true }, true));
roundTrip(stamp({ t: 'heal', eventId: 10, amount: 8 }, true));
roundTrip(stamp({ t: 'kill', eventId: 11, xp: 15 }, true));
roundTrip(stamp({ t: 'xp', eventId: 12, amount: 20 }, true));
roundTrip(stamp({
  t: 'grant',
  grantId: 'g4',
  item: { id: 'loot9', kind: 'weapon', itemId: 'pulse', x: 15, y: 16.5, tier: 2, color: '#00f0ff', label: 'PULSE LANCE' }
}, true));
roundTrip(stamp({
  t: 'grant',
  grantId: 'g5',
  item: { id: 'loot10', kind: 'consumable', itemId: 'repair', x: 1, y: 2, tier: 1, color: '#b6ff2b', label: null }
}, true));

roundTrip(stamp({ t: 'grant_ack', grantId: 'g4', ok: true, participant: player(3) }, false));
roundTrip(stamp({ t: 'grant_ack', grantId: 'g5', ok: false }, false));
roundTrip(stamp({ t: 'event_ack', eventId: 11, player: player(4) }, false));

const participant = stamp({ t: 'participant', player: player(500) }, false);
const participantBytes = roundTrip(participant);
assert.ok(participantBytes <= 1400, 'participant ' + participantBytes);

const overflow = stamp({ t: 'participant', player: player(1) }, false);
overflow.player.acceptedEvents = [65536];
assert.equal(Wire.encode(overflow), null);

roundTrip(stamp({ t: 'lives', pool: 4, seconds: null, hostSeconds: f32(1.5) }, true));
roundTrip(stamp({ t: 'lives', pool: 0, seconds: f32(0.25), hostSeconds: null }, true));

assert.equal(Wire.encode({ t: 'ctrl', body: { t: 'lobby_ready' } }), null);
assert.equal(Wire.encode(stamp({ t: 'session_sync', syncId: 1 }, true)), null);
assert.equal(Wire.encode({ t: 'bye' }), null);
assert.equal(Wire.encode(stamp({ t: 'death', player: player(0) }, false)), null);
assert.equal(Wire.encode(stamp({ t: 'fire', w: 'not-a-weapon', a: 0, x: 0, y: 0 }, false)), null);
const blockedLife = stamp(Object.assign({}, state), true);
blockedLife._targetLife = 255;
assert.equal(Wire.encode(blockedLife), null);

const booleanStats = player(0).stats;
booleanStats.dodge = true;
assert.equal(Wire.encode(stamp({
  t: 'loadout',
  weapons: [{ id: 'pulse', level: 1, tier: 1 }],
  passives: [],
  core: [],
  activeWeapon: 0,
  stats: booleanStats
}, false)), null);

const encoded = Wire.encode(state);
const mismatch = new Uint8Array(encoded.byteLength);
mismatch.set(new Uint8Array(encoded));
mismatch[0] = 5;
const mismatchResult = Wire.decode(mismatch.buffer);
assert.equal(mismatchResult.versionMismatch, true);
assert.deepEqual(Object.keys(mismatchResult), ['versionMismatch']);
assert.equal(Wire.decode(encoded.slice(0, 10)), null);
assert.equal(Wire.decode(encoded.slice(0, encoded.byteLength - 1)), null);
const padded = new Uint8Array(encoded.byteLength + 1);
padded.set(new Uint8Array(encoded));
assert.equal(Wire.decode(padded.buffer), null);

console.log('Wire checks passed: state ' + stateBytes + ' B, bullet ' + bulletBytes + ' B, eight bullets ' + batchBytes + ' B, world ' + worldBytes + ' B, participant ' + participantBytes + ' B.');
