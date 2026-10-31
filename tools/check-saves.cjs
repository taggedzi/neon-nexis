// Current-version checkpoints with invalid nested data use the recovery gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = new Map();
const box = {
  window: { NEON: {} },
  location: { search: '' },
  console,
  localStorage: {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  },
  document: {
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    getElementById() { return null; }
  }
};
vm.createContext(box);
for (const file of ['util', 'content', 'game', 'driving', 'ships', 'world', 'maps', 'enemies', 'save-policy']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), box);
}
const N = box.window.NEON;
const G = N.Game;
N.Input = { resetMovement() {}, resetFire() {} };
N.Audio = { checkpoint() {}, setScene() {}, glitch() {} };
N.UI = { hideAll() {}, toast() {} };

const broken = {
  version: 1,
  run: { seed: 1, mapVersion: 1, level: 1 },
  player: { weapons: {} },
  level: {}
};
const before = G.run;
assert.equal(G.canLoadSave(broken), false);
assert.equal(G.loadFromSave(broken), false);
assert.equal(G.run, before, 'rejected save does not replace the live run');

assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 1, mapVersion: 1, level: 1 },
  player: {},
  level: { groundItems: {} }
}), false);
assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 1, mapVersion: 1, level: 1 },
  player: {},
  level: { destroyedAnchors: {}, destroyedCaches: [] }
}), false);
assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 1, mapVersion: 1, level: 1 },
  player: { passives: {}, core: [] }
}), false);
assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 1, mapVersion: 1, level: 1 },
  player: { hp: 'bad' },
  level: { elapsed: Number.POSITIVE_INFINITY }
}), false);

assert.equal(G.canLoadSave({ version: 1, run: { mapVersion: 0 }, player: {} }), true);
assert.equal(G.loadFromSave({ version: 1, run: { seed: 7, mapVersion: 0, level: 2 }, player: { level: 4 } }), true);
assert.equal(G.run.mapVersion, 0);
assert.equal(G.run.level, 2);
assert.equal(G.player.level, 4);
assert.ok(Array.isArray(G.player.weapons) && G.player.weapons.length >= 1);

const omitted = { version: 1, run: { seed: 4, level: 1 }, player: {} };
assert.equal(G.canLoadSave(omitted), true);
assert.equal(G.loadFromSave(omitted), true);
assert.equal(G.run.level, 1);
assert.ok(G.player.weapons.length >= 1);

for (const level of [null, 0, -1, 1.5]) {
  assert.equal(G.canLoadSave({
    version: 1,
    run: { seed: 3, mapVersion: 1, level: level, sectors: 0 },
    player: {}
  }), false, 'invalid sector ' + String(level));
}
assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 3, mapVersion: 1, level: 2, sectors: -1 },
  player: {}
}), false);
assert.equal(G.canLoadSave({
  version: 1,
  run: { seed: 3, mapVersion: 1, level: 2, sectors: 1.5 },
  player: {}
}), false);

const preserved = {
  version: 1,
  run: { seed: 11, mapVersion: 1, level: 0, sectors: 0 },
  player: { level: 3 }
};
N.writeSave(preserved);
const liveRun = G.run;
assert.equal(G.loadFromSave(preserved), false);
assert.equal(G.run, liveRun, 'invalid sector load does not replace the live run');
G.newRun({});
assert.equal(JSON.stringify(N.readSave()), JSON.stringify(preserved), 'a new run does not overwrite an invalid checkpoint');

console.log('Save boundary checks passed.');
