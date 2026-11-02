// Backup files round-trip, and a rejected file leaves stored data in place.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = new Map();
const box = {
  window: { NEON: {} },
  location: { search: '' },
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
for (const file of ['util', 'game', 'save-policy', 'loadouts', 'profile', 'save-transfer']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), box);
}
const N = box.window.NEON;
const G = N.Game;
N.Storage.init();
G.applySettings = function() {};
N.Input = { setSettings() {}, resetMovement() {}, resetFire() {} };
N.Audio = { setSettings() {}, checkpoint() {}, setScene() {}, glitch() {} };

const checkpoint = {
  version: 1,
  run: { seed: 4, mapVersion: 1, level: 3, sectors: 2 },
  player: { level: 5, weapons: [], passives: [], core: [] },
  level: { elapsed: 12, groundItems: [], destroyedAnchors: [], destroyedCaches: [] }
};
const settings = {
  version: 1,
  deadzone: 0.31,
  movementMode: 'driving',
  keyboard: { moveUp: 'KeyT', fire: 'KeyG' },
  audio: { master: 0.4 }
};
const identity = 'nn_' + 'ab'.repeat(16);
const saveKey = N.Storage.key;
const settingsKey = N.Storage.settingsKey;

function store(save, prefs) {
  memory.set(saveKey, JSON.stringify(save));
  memory.set(settingsKey, JSON.stringify(prefs));
  memory.set('neon-coop-identity-v1', identity);
  memory.set('unrelated-data', 'keep');
}
function same(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}
function snap() {
  return {
    save: memory.get(saveKey) || null,
    settings: memory.get(settingsKey) || null,
    identity: memory.get('neon-coop-identity-v1') || null,
    unrelated: memory.get('unrelated-data') || null
  };
}
store(checkpoint, settings);
G.mode = 'menu';

const built = N.SaveTransfer.build();
assert.equal(built.ok, true);
assert.equal(built.file.fileVersion, 3);
assert.equal(built.file.release, 'development');
same(built.file.checkpoint, checkpoint);
assert.equal(built.file.settings.deadzone, 0.31);
assert.equal(built.file.settings.movementMode, 'driving');
assert.equal(built.file.settings.keyboard.moveUp, 'KeyT');
assert.equal(built.file.settings.keyboard.fire, 'KeyG');
assert.equal(built.file.settings.audio.master, 0.4);
assert.equal(built.file.settings.capturePointer, true);
assert.equal(JSON.stringify(built.file).includes('neon-coop-identity'), false);
assert.deepEqual(snap(), {
  save: JSON.stringify(checkpoint),
  settings: JSON.stringify(settings),
  identity,
  unrelated: 'keep'
});

const other = {
  version: 1,
  run: { seed: 9, mapVersion: 1, level: 1 },
  player: { level: 1 }
};
store(other, { deadzone: 0.5, keyboard: { moveUp: 'KeyW' } });
G.settings = N.loadSettings();
assert.equal(G.settings.deadzone, 0.5);
const applied = N.SaveTransfer.apply(built.file);
assert.equal(applied.ok, true);
assert.deepEqual(JSON.parse(memory.get(saveKey)), checkpoint);
assert.equal(G.settings.deadzone, 0.31);
assert.equal(G.settings.keyboard.moveUp, 'KeyT');
assert.equal(G.settings.keyboard.fire, 'KeyG');
assert.equal(G.settings.audio.master, 0.4);
assert.equal(memory.get('neon-coop-identity-v1'), identity);
assert.equal(memory.get('unrelated-data'), 'keep');
assert.equal(JSON.parse(memory.get(settingsKey)).deadzone, 0.31);
same(G.lastCheckpoint, checkpoint);

const kept = snap();
for (const text of ['', '{', '[]', 'null', '{"fileVersion":1}', '{"fileVersion":2,"checkpoint":null,"settings":{}}']) {
  const parsed = N.SaveTransfer.parse(text);
  assert.equal(parsed.ok, false);
  if (parsed.ok === false && parsed.file) assert.fail('rejected parse must not return a file');
  const again = parsed.reason === 'invalid' || parsed.reason === 'version' || parsed.reason === 'settings'
    ? parsed
    : N.SaveTransfer.apply(parsed.file);
  assert.equal(again.ok, false);
  assert.deepEqual(snap(), kept);
}
const badSector = {
  fileVersion: 1,
  checkpoint: {
    version: 1,
    run: { seed: 1, mapVersion: 1, level: -1 },
    player: {}
  },
  settings: { deadzone: 0.2, keyboard: { moveUp: 'KeyZ' } }
};
assert.equal(N.SaveTransfer.validate(badSector).ok, false);
assert.equal(N.SaveTransfer.apply(badSector).reason, 'checkpoint');
assert.deepEqual(snap(), kept);
assert.equal(G.settings.deadzone, 0.31);
assert.equal(G.settings.keyboard.moveUp, 'KeyT');

const parsedRound = N.SaveTransfer.parse(JSON.stringify(built.file));
assert.equal(parsedRound.ok, true);
same(parsedRound.file.checkpoint, checkpoint);
assert.equal(N.SaveTransfer.parse('x'.repeat(N.SaveTransfer.maxBytes + 1)).reason, 'size');

G.mode = 'playing';
assert.equal(N.SaveTransfer.apply(built.file).reason, 'live');
assert.deepEqual(snap(), kept);
G.mode = 'menu';

const emptyCheckpoint = {
  fileVersion: 1,
  checkpoint: null,
  settings: { deadzone: 0.44 }
};
assert.match(N.SaveTransfer.summary(emptyCheckpoint), /removes the checkpoint/);
assert.equal(N.SaveTransfer.apply(emptyCheckpoint).ok, true);
assert.equal(memory.has(saveKey), false);
assert.equal(G.lastCheckpoint, null);
assert.equal(G.settings.deadzone, 0.44);
assert.equal(memory.get('neon-coop-identity-v1'), identity);
assert.equal(memory.get('unrelated-data'), 'keep');

store(checkpoint, settings);
G.mode = 'menu';
const realSet = box.localStorage.setItem;
box.localStorage.setItem = function(key, value) {
  if (key === settingsKey) throw Error('full');
  realSet.call(box.localStorage, key, value);
};
const beforeRollback = snap();
const rolled = N.SaveTransfer.apply(emptyCheckpoint);
assert.equal(rolled.reason, 'storage');
assert.deepEqual(snap(), beforeRollback);
box.localStorage.setItem = realSet;

memory.set(saveKey, '{');
assert.equal(N.SaveTransfer.build().reason, 'incompatible');
assert.equal(memory.get(saveKey), '{');
memory.set(settingsKey, '[');
memory.set(saveKey, JSON.stringify(checkpoint));
assert.equal(N.SaveTransfer.build().reason, 'settingsStored');
assert.equal(memory.get(settingsKey), '[');

store(checkpoint, settings);
let writes = 0;
const originalWrite = N.writeSave;
N.writeSave = () => { writes += 1; return true; };
N.Coop = { isActive() { return true; } };
G.run = { seed: 1 };
G.player = { dead: false };
G.level = { anchors: [], caches: [] };
G.groundItems = [];
assert.equal(G.saveCheckpoint(true, 'checkpoint'), false);
assert.equal(writes, 0);
assert.equal(memory.get(saveKey), JSON.stringify(checkpoint));
N.writeSave = originalWrite;
delete N.Coop;
G.run = null;
G.player = null;
G.level = null;
// A late failure writing the new profile must roll back every imported key.
G.mode='menu';
memory.set(N.Loadouts.key,JSON.stringify({version:1,ships:[]}));
memory.set(N.Profile.key,JSON.stringify({version:1,stats:{shotsFired:7}}));
N.Profile.reload();
const allBefore=Object.fromEntries(memory);
const incoming=JSON.parse(JSON.stringify(built.file));
incoming.checkpoint=null;incoming.settings.deadzone=.2;incoming.profile.stats.shotsFired=99;
let failProfile=true;
box.localStorage.setItem=function(key,value){
  if(key===N.Profile.key&&failProfile){failProfile=false;throw Error('profile write failed');}
  realSet.call(box.localStorage,key,value);
};
assert.equal(N.SaveTransfer.apply(incoming).reason,'storage');
assert.deepEqual(Object.fromEntries(memory),allBefore);
box.localStorage.setItem=realSet;
const invalidProfile=JSON.parse(JSON.stringify(incoming));invalidProfile.profile.stats.shotsFired=-1;
assert.equal(N.SaveTransfer.apply(invalidProfile).reason,'profile');
assert.deepEqual(Object.fromEntries(memory),allBefore);
memory.set(N.Profile.key,'{broken profile');
assert.equal(N.Profile.reload(),null);
N.Profile.addStat('shotsFired',1);
assert.equal(N.Profile.flush(),false);
assert.equal(memory.get(N.Profile.key),'{broken profile');
assert.equal(memory.get(saveKey),allBefore[saveKey]);
console.log('Save transfer checks passed, including profile validation and four-key rollback.');
