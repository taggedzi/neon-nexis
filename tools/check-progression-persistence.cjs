const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const memory = new Map();
const N = { PROGRESSION_ENABLED: true, TAU: Math.PI * 2, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  deepClone: value => JSON.parse(JSON.stringify(value)),
  Storage: { key: 'checkpoint', settingsKey: 'settings', available: true,
    write(key, value) { memory.set(key, JSON.stringify(value)); return true; } },
  Game: { mode: 'menu' }, UI: { toast() {} } };
const localStorage = { getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
const context = vm.createContext({ window: { NEON: N }, localStorage, console });
for (const name of ['content', 'progression-content', 'progression-stats', 'progression-defense',
  'progression-equipment', 'progression-rewards', 'loadouts', 'progression-persistence', 'save-policy']) {
  vm.runInContext(readFileSync('js/' + name + '.js', 'utf8'), context);
}
const P = N.ProgressionPersistence, R = N.ProgressionRewards;
const clone = value => JSON.parse(JSON.stringify(value));
const state = N.Equipment.create('kite');
const player = { clientId: 'p0', shipType: 'kite', shipColor: '#00f0ff', progressionMode: 'shared_v1',
  progression: state, hp: 60, shield: 2, buffs: { overclock: 4, speed: 0, magnet: 0 },
  dead: false, invuln: .3, shieldDelay: 2, resourceRevision: 10,
  dashCharges: 1, maxDashCharges: 1, dashTimer: 0, dashTime: 0, dashDir: 0,
  barrier: { capacity: 0, windowSeconds: 0, lockoutSeconds: 1 } };
player.stats = N.ProgressionStats.derive('kite', state);
const run = R.createRun([player], 'a'.repeat(32));
const snapshot = R.snapshot({ run }, 'p0');
assert.equal(P.validateSnapshot(snapshot), true);
for (const change of [
  s => { s.schemaVersion = 2; }, s => { s.offensive.push(null); },
  s => { s.offensive[0].id = 'needle_blaster'; }, s => { s.offensive[0].level = 6; },
  s => { s.selectedOffensiveSlot = 1; }, s => { s.passives.reinforced_hull = 11; },
  s => { s.passives.old_core = 1; }, s => { s.xp = 38; }, s => { s.nextPassiveIndex = 2; },
  s => { s.offensive[0].cooldownSeconds = -1; }, s => { s.revision = Number.MAX_SAFE_INTEGER + 1; },
  s => { s.core = []; }
]) {
  const broken = clone(state); change(broken);
  assert.equal(P.validateProgression(broken, 'kite'), false);
}
const checkpoint = { version: 2, progressionMode: 'shared_v1', savedAt: 1,
  run: { seed: 42, mapVersion: 1, skill: 'medium', level: 2, highestSector: 2,
    sectors: 1, kills: 4, totalTime: 3, damage: 2, startedAt: 1, progression: R.runSnapshot({ run }) },
  player: { snapshot, x: 10, y: 10, aim: 0, heading: 0, dashCharges: 1, dashTimer: 0 },
  level: { elapsed: 3, kills: 1, damage: 2, destroyedAnchors: ['a1'], destroyedCaches: ['c1'], groundItems: [] } };
assert.equal(P.validate(checkpoint).ok, true);
const reordered = clone(checkpoint);
reordered.player.snapshot.resources = Object.fromEntries(Object.entries(reordered.player.snapshot.resources).reverse());
assert.equal(P.validate(reordered).ok, true, 'JSON property order has no semantics');
for (const change of [s => { s.version = 3; }, s => { s.run.seed = 1.5; },
  s => { s.run.progression.nextSourceSequence = 0; }, s => { s.run.progression.journal = [{ fake: true }]; },
  s => { s.level.destroyedCaches = [null]; }, s => { s.player.snapshot.resources.hp = 200; }]) {
  const broken = clone(checkpoint); change(broken);
  assert.equal(P.validate(broken).ok, false);
}
const ship = P.captureShip('Earned', player, 3);
assert.equal(P.validateShip(ship), true);
assert.equal(ship.player.progression.salvage, 0);
const legacy = { version: 1, run: {}, player: { weapons: Array(8).fill({ id: 'pulse' }), core: ['old'],
  pendingLevelUps: 3 }, rewards: { pending: [{ kind: 'weapon', itemId: 'rail', tier: 3 }] } };
N.Game.canLoadSave = value => P.validate(value).ok;
memory.set(N.Storage.key, JSON.stringify(legacy));
memory.set('settings', '{"customRemap":true}');
const raw = memory.get(N.Storage.key);
const found = N.SavePolicy.inspect();
assert.equal(found.incompatible, true);
assert.equal(memory.get(N.Storage.key), raw);
let exported;
N.SavePolicy.export = bytes => { exported = bytes; };
assert.equal(N.SavePolicy.resolve(raw, true), true);
assert.equal(exported, raw);
assert.equal(memory.get('settings'), '{"customRemap":true}');
memory.set(N.Loadouts.key, JSON.stringify({ version: 1, ships: [{ valuable: true }] }));
const oldShips = memory.get(N.Loadouts.key);
assert.equal(N.SavePolicy.inspect().kind, 'loadouts');
assert.equal(N.SavePolicy.resolve(oldShips, false, N.Loadouts.key), true);
assert.equal(memory.get('settings'), '{"customRemap":true}');

// Cumulative resource revisions supersede older results without healing twice.
const revision11 = { ...clone(snapshot.resources), resourceRevision: 11, hp: 70 };
const revision12 = { ...clone(revision11), resourceRevision: 12,
  barrier: { capacity: 25, windowSeconds: 3, lockoutSeconds: 2 } };
const partial = clone(revision12); delete partial.buffs;
assert.equal(P.applyResources(player, partial, run.runToken).ok, false);
assert.equal(player.resourceRevision, 10);
assert.equal(P.applyResources(player, revision12, run.runToken).ok, true);
assert.equal(P.applyResources(player, revision11, run.runToken).duplicate, true);
assert.equal(player.hp, 70);
assert.equal(player.barrier.capacity, 25);
const future = { ...revision12, resourceRevision: 13, progressionSequence: 1 };
assert.equal(P.applyResources(player, future, run.runToken).reason, 'progression-required');
assert.equal(player.resourceRevision, 12);
// A delayed lifecycle snapshot cannot rewind a newer reward or repair.
const newer = clone(snapshot);
newer.sequence = newer.progression.appliedEventSequence = 1;
newer.progression.revision = 1;
newer.progression.offensive[0].level = 2;
newer.resources = { ...revision12, progressionSequence: 1, resourceRevision: 13 };
assert.equal(P.adoptSnapshot(player, newer).ok, true);
assert.equal(P.adoptSnapshot(player, snapshot).ok, true);
assert.equal(player.progression.offensive[0].level, 2);
assert.equal(player.resourceRevision, 13);
const colliding = clone(checkpoint);
colliding.level.groundItems = [{ id: 'loot_' + run.runToken + '_1', kind: 'equipment', itemId: 'offensive',
  x: 10, y: 10, angle: 0, phase: 0, pickupDelay: 0 }];
assert.equal(P.validate(colliding).ok, false);
colliding.run.progression.nextSourceSequence = 2;
assert.equal(P.validate(colliding).ok, true);

for (const coordinate of [-1, 1e308, Infinity]) {
  const brokenPlayer = clone(checkpoint);
  brokenPlayer.player.x = coordinate;
  assert.equal(P.validate(brokenPlayer).ok, false);
  const brokenPickup = clone(colliding);
  brokenPickup.level.groundItems[0].y = coordinate;
  assert.equal(P.validate(brokenPickup).ok, false);
}

// Geometry and generation failures must leave the active world and camera intact.
const G = N.Game;
const oldRun = { marker: 'old-run' }, oldPlayer = { marker: 'old-player' };
const oldLevel = { marker: 'old-level' }, oldCamera = { x: 1, y: 2, shake: 3 };
const oldEnemies = [{ id: 'old-enemy' }], oldPickups = [{ id: 'old-pickup' }];
Object.assign(G, { run: oldRun, player: oldPlayer, level: oldLevel, camera: oldCamera,
  enemies: oldEnemies, groundItems: oldPickups, mode: 'paused', time: 7, zoom: 1,
  makePlayer(selection) {
    const progression = N.Equipment.create(selection.shipType);
    return { ...selection, progressionMode: 'shared_v1', progression,
      stats: N.ProgressionStats.derive(selection.shipType, progression) };
  },
  generateLevel() { throw Error('synthetic generation failure'); },
  spawnInitialEnemies(count) {
    assert.equal(G.preparingCheckpoint, true);
    G.enemies.push(...Array.from({ length: count }, () => ({ id: 'restored-enemy' })));
  },
  setMode(mode) { G.mode = mode; }, triggerGlitch() {}, notify() {} });
let resets = 0;
N.Input = { resetMovement() { resets++; }, resetFire() { resets++; } };
N.Audio = { setScene() {}, checkpoint() {} };
N.UI.hideAll = () => {};
N.Ships = { get: () => ({ radius: 22 }) };
N.World = { move(p) { p.x = 25; p.y = 30; }, findFree() { throw Error('synthetic geometry failure'); } };
const observed = [];
N.Logbook = { spawned(enemy) {
  assert.equal(Object.hasOwn(G, 'preparingCheckpoint'), false);
  assert.notEqual(G.run, oldRun);
  observed.push(enemy.id);
} };
function preservedWorld() {
  assert.equal(G.run, oldRun);
  assert.equal(G.player, oldPlayer);
  assert.equal(G.level, oldLevel);
  assert.equal(G.camera, oldCamera);
  assert.equal(G.enemies, oldEnemies);
  assert.equal(G.groundItems, oldPickups);
  assert.equal(G.mode, 'paused');
  assert.equal(G.time, 7);
  assert.deepEqual(oldCamera, { x: 1, y: 2, shake: 3 });
  assert.equal(oldEnemies.length, 1);
  assert.equal(oldPickups.length, 1);
  assert.equal(resets, 0);
  assert.equal(Object.hasOwn(G, 'preparingCheckpoint'), false);
  assert.equal(observed.length, 0);
}
assert.equal(P.restoreCheckpoint(G, checkpoint), false);
preservedWorld();
G.generateLevel = () => ({ layout: {}, elapsed: 0 });
assert.equal(P.restoreCheckpoint(G, colliding), false);
preservedWorld();
N.World.findFree = (layout, x, y) => ({ x: x + 2, y: y + 3 });
const spawn = G.spawnInitialEnemies;
G.spawnInitialEnemies = () => {
  assert.equal(G.preparingCheckpoint, true);
  G.enemies.push({ id: 'partial' }); G.camera.x = 400; G.temporarySpawnMarker = true;
  throw Error('synthetic initial enemy failure');
};
assert.equal(P.restoreCheckpoint(G, colliding), false);
assert.equal(Object.hasOwn(G, 'temporarySpawnMarker'), false);
preservedWorld();
G.spawnInitialEnemies = spawn;
assert.equal(P.restoreCheckpoint(G, colliding), true);
assert.equal(G.run.progressionMode, 'shared_v1');
assert.equal(G.enemies.length, 4);
assert.equal(G.player.hp, snapshot.resources.hp);
assert.deepEqual([G.player.x, G.player.y, G.camera.x, G.camera.y], [25, 30, 25, 30]);
assert.deepEqual([G.groundItems[0].x, G.groundItems[0].y], [12, 13]);
assert.equal(G.lastCheckpoint.player.snapshot.resources.hp, snapshot.resources.hp);
assert.equal(P.validate(G.lastCheckpoint).ok, true);
assert.equal(G.run === G.lastCheckpoint.run, false);
assert.equal(resets, 2);
assert.equal(oldEnemies.length, 1);
assert.equal(oldPickups.length, 1);
assert.equal(Object.hasOwn(G, 'preparingCheckpoint'), false);
assert.equal(observed.length, 4);

// Shared dash immunity is committed by the host and cannot be replayed or
// recharged while its original participant is disconnected.
const sent = [];
N.Net = { send(message) { sent.push(clone(message)); return true; } };
N.Coop = { isHost: () => true, isGuest: () => false, active: true, pauseState: 'PLAY', runId: 1,
  onMessage() {}, preUpdate(seconds) {
    for (const p of N.Coop.remotePlayers) if (!p.dead && p.connected !== false) p.invuln = Math.max(0, p.invuln - seconds);
  }, tickSession() {}, endSession() {}, leaveToMenu() {} };
G.spawnEnemyBullet = value => value;
G.spawnBullet = value => value;
vm.runInContext(readFileSync('js/coop-progression.js', 'utf8'), context);
const C = N.Coop, pilot = G.player;
pilot.x = 25; pilot.y = 30; pilot.connected = true; pilot.invuln = 0;
pilot.stats.dashRecharge = 2.7;
G.level.number = 2;
C.remotePlayers = [pilot];
C.installProgressionAuthority();
const rejected = C.useProgressionDash(pilot, NaN);
assert.equal(rejected.ok, false);
assert.equal(pilot.dashCharges, 1);
const dashed = C.useProgressionDash(pilot, .5);
assert.equal(dashed.ok, true);
assert.equal(pilot.dashCharges, 0);
assert.equal(pilot.dashTimer, 2.7);
assert.equal(pilot.dashTime, .17);
assert.equal(pilot.invuln, .34);
assert.deepEqual([pilot.x, pilot.y], [25, 30]);
const beforeHit = [pilot.hp, pilot.shield];
assert.equal(N.ProgressionDefense.damageTransaction(pilot, 10, G.progressionAuthority.identityFor(pilot)).ok, false);
assert.deepEqual([pilot.hp, pilot.shield], beforeHit);
const dashRevision = pilot.resourceRevision;
assert.equal(C.useProgressionDash(pilot, 1).ok, false);
assert.equal(pilot.resourceRevision, dashRevision);
C.preUpdate(1);
assert.equal(pilot.dashCharges, 0);
assert.equal(pilot.dashTime, 0);
const remaining = pilot.dashTimer;
pilot.connected = false;
C.preUpdate(10);
assert.equal(pilot.dashTimer, remaining);
const reconnectSnapshot = R.snapshot({ run: G.run.progression }, pilot.clientId);
assert.equal(P.validateSnapshot(reconnectSnapshot), true);
const reconnect = { ...pilot, dashCharges: 1, dashTimer: 0, dashTime: 0 };
assert.equal(R.restoreSnapshot(reconnect, reconnectSnapshot).ok, true);
assert.equal(reconnect.dashCharges, 0);
assert.equal(reconnect.dashTimer, remaining);
pilot.connected = true;
C.preUpdate(1.71);
assert.equal(pilot.dashCharges, 1);
assert.equal(pilot.dashTimer, 0);
const intent = { t: 'progression_intent', progressionVersion: 1, wireVersion: 7,
  runToken: G.run.progression.runToken, _run: 1, _sector: 2, _life: 0,
  intentSequence: 1, aim: 0, intent: { dash: true, dashDirection: 0 } };
C.onMessage({ ...intent, _life: 1 }, pilot.clientId);
assert.equal(pilot.dashCharges, 1);
assert.equal(pilot.lastIntentSequence, undefined);
C.onMessage(intent, pilot.clientId);
assert.equal(pilot.dashCharges, 0);
assert.equal(pilot.lastIntentSequence, 1);
pilot.invuln = 0; pilot.dashTime = 0; pilot.dashTimer = 1;
const appliedRevision = pilot.resourceRevision;
C.onMessage(intent, pilot.clientId);
assert.equal(pilot.resourceRevision, appliedRevision);
C.onMessage({ ...intent, intentSequence: 2 }, pilot.clientId);
assert.equal(pilot.invuln, 0);
assert.equal(pilot.dashTimer, 1);
assert.equal(pilot.dashCharges, 0);
console.log('Progression persistence: versions, strict fixtures, recovery bytes and reordered resources passed.');
