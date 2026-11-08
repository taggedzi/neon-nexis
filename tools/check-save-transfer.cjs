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
for (const file of ['util', 'content', 'game', 'save-policy', 'loadouts', 'profile', 'save-transfer']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), box);
}
// Keep historical formats under their original pre-cutover compatibility rules.
box.window.NEON.PROGRESSION_ENABLED = false;
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
assert.equal(built.file.fileVersion, 5);
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

memory.set(N.Loadouts.key, '{"version":1,"ships":[]}');
memory.set(N.Profile.key, '{"version":2,"stats":{"shotsFired":2},"book":{}}');
const fourBefore = {
  save: memory.get(saveKey),
  settings: memory.get(settingsKey),
  loadouts: memory.get(N.Loadouts.key),
  profile: memory.get(N.Profile.key)
};
const fractionalWeapon = {
  fileVersion: 1,
  checkpoint: {
    version: 1,
    run: { seed: 5, mapVersion: 1, level: 2 },
    player: {
      weapons: [
        { id: 'pulse', level: 1, tier: 1 },
        { id: 'scatter', level: 1, tier: 1 }
      ],
      activeWeapon: 0.5
    }
  },
  settings: { deadzone: 0.2 }
};
assert.equal(N.SaveTransfer.validate(fractionalWeapon).ok, false);
assert.equal(N.SaveTransfer.apply(fractionalWeapon).reason, 'checkpoint');
assert.deepEqual({
  save: memory.get(saveKey),
  settings: memory.get(settingsKey),
  loadouts: memory.get(N.Loadouts.key),
  profile: memory.get(N.Profile.key)
}, fourBefore);
memory.delete(N.Loadouts.key);
memory.delete(N.Profile.key);
assert.deepEqual(snap(), kept);

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

// A total quota applies to every write, including rollback. The incoming
// checkpoint is smaller, the incoming ship list is larger, and loadouts plus
// profile are absent beforehand.
function checkpointPad(text) {
  return {
    version: 1,
    run: { seed: 4, mapVersion: 1, level: 3, sectors: 2 },
    player: { level: 5, weapons: [], passives: [], core: [], pad: text },
    level: { elapsed: 12, groundItems: [], destroyedAnchors: [], destroyedCaches: [] }
  };
}
function shipList(padLength) {
  return {
    version: 1,
    ships: [{
      name: 'Quota',
      highestSector: 1,
      player: {
        shipType: 'dart',
        shipColor: '#00f0ff',
        level: 2,
        xp: 0,
        xpNext: 10,
        weapons: [{ id: 'pulse', level: 1, tier: 1 }],
        passives: [],
        core: ['x'.repeat(padLength)],
        weaponSlots: 1,
        passiveSlots: 1,
        activeWeapon: 0
      }
    }]
  };
}
const bigCheckpoint = checkpointPad('C'.repeat(8000));
const smallCheckpoint = checkpointPad('c');
const bigText = JSON.stringify(bigCheckpoint);
const smallText = JSON.stringify(smallCheckpoint);
const enemyBook = {};
for (const id of Object.keys(N.ENEMY_BY_ID)) enemyBook[id] = { seen: true, kills: 1 };
const profileFile = { version: 2, stats: { shotsFired: 4 }, book: enemyBook };
const writtenProfile = JSON.stringify({
  version: 2,
  stats: N.Profile.cleanStats(profileFile.stats),
  book: N.Profile.cleanBook(profileFile.book)
});
let loadoutPad = 0;
let loadoutText = JSON.stringify(shipList(0));
const loadoutLimit = bigText.length - smallText.length - 1;
while (loadoutPad < loadoutLimit) {
  const nextText = JSON.stringify(shipList(loadoutPad + 1));
  if (nextText.length > loadoutLimit) break;
  loadoutPad += 1;
  loadoutText = nextText;
}
const loadoutFile = shipList(loadoutPad);
const leftover = bigText.length - smallText.length - loadoutText.length;
assert.ok(leftover >= 1);
assert.ok(writtenProfile.length > leftover);
assert.ok(N.Game.canLoadSave(bigCheckpoint));
assert.ok(N.Game.canLoadSave(smallCheckpoint));
assert.equal(N.Loadouts.validate(loadoutFile), true);
assert.equal(N.Profile.validate(profileFile), true);

const quotaPrefs = N.normalizeSettings({ deadzone: 0.31, keyboard: { moveUp: 'KeyT' } });
let quota = Number.POSITIVE_INFINITY;
let dropQuotaOnProfile = false;
let quotaRejections = 0;
function usedStorage() {
  let total = 0;
  for (const value of memory.values()) total += value.length;
  return total;
}
box.localStorage.setItem = function(key, value) {
  const text = String(value);
  const previous = memory.has(key) ? memory.get(key).length : 0;
  if (usedStorage() - previous + text.length > quota) {
    quotaRejections += 1;
    if (dropQuotaOnProfile && key === N.Profile.key) {
      quota = 0;
      dropQuotaOnProfile = false;
    }
    throw new Error('quota');
  }
  memory.set(key, text);
};

function stageQuotaOrigin() {
  memory.clear();
  memory.set(saveKey, bigText);
  memory.set(settingsKey, JSON.stringify(quotaPrefs));
  memory.set('neon-coop-identity-v1', identity);
  memory.set('unrelated-data', 'keep');
  G.mode = 'menu';
  G.settings = N.loadSettings();
}
function quotaFile() {
  return {
    fileVersion: 4,
    checkpoint: smallCheckpoint,
    settings: JSON.parse(memory.get(settingsKey)),
    loadouts: loadoutFile,
    profile: profileFile
  };
}
stageQuotaOrigin();
const learned = N.SaveTransfer.apply(quotaFile());
assert.equal(learned.ok, true);
const canonicalSettings = memory.get(settingsKey);
stageQuotaOrigin();
memory.set(settingsKey, canonicalSettings);
const originSnap = Object.fromEntries(memory);
assert.equal(Object.hasOwn(originSnap, N.Loadouts.key), false);
assert.equal(Object.hasOwn(originSnap, N.Profile.key), false);
quota = usedStorage();
quotaRejections = 0;
dropQuotaOnProfile = false;
const quotaResult = N.SaveTransfer.apply(quotaFile());
assert.equal(quotaResult.ok, false);
assert.equal(quotaResult.reason, 'storage');
assert.equal(quotaRejections >= 1, true);
assert.deepEqual(Object.fromEntries(memory), originSnap);
assert.equal(memory.get(saveKey), bigText);
assert.equal(memory.get(settingsKey), canonicalSettings);
assert.equal(memory.has(N.Loadouts.key), false);
assert.equal(memory.has(N.Profile.key), false);
assert.equal(memory.get('unrelated-data'), 'keep');
assert.equal(memory.get('neon-coop-identity-v1'), identity);

stageQuotaOrigin();
memory.set(settingsKey, canonicalSettings);
quota = usedStorage();
quotaRejections = 0;
dropQuotaOnProfile = true;
const partial = N.SaveTransfer.apply(quotaFile());
assert.equal(partial.ok, false);
assert.equal(partial.reason, 'storagePartial');
assert.equal(/UNCHANGED|NOT CHANGED/i.test(N.SaveTransfer.failureText(partial.reason)), false);
assert.equal(quotaRejections >= 2, true);
assert.notDeepEqual(Object.fromEntries(memory), originSnap);
assert.equal(memory.get('unrelated-data'), 'keep');
assert.equal(memory.get('neon-coop-identity-v1'), identity);
assert.equal(partial.recovery && partial.recovery.checkpoint.player.pad, bigCheckpoint.player.pad);
box.localStorage.setItem = realSet;
quota = Number.POSITIVE_INFINITY;

// Backup formats 1–4 keep unrelated origin data, and older files leave later keys alone.
memory.clear();
memory.set(saveKey, bigText);
memory.set(settingsKey, canonicalSettings);
memory.set(N.Loadouts.key, loadoutText);
memory.set(N.Profile.key, writtenProfile);
memory.set('unrelated-data', 'keep');
G.mode = 'menu';
const olderShips = memory.get(N.Loadouts.key);
const olderProfile = memory.get(N.Profile.key);
assert.equal(N.SaveTransfer.apply({
  fileVersion: 1,
  checkpoint: smallCheckpoint,
  settings: JSON.parse(canonicalSettings)
}).ok, true);
assert.equal(memory.get(N.Loadouts.key), olderShips);
assert.equal(memory.get(N.Profile.key), olderProfile);
assert.equal(memory.get('unrelated-data'), 'keep');
const versionTwoShips = shipList(3);
assert.equal(N.SaveTransfer.apply({
  fileVersion: 2,
  checkpoint: smallCheckpoint,
  settings: JSON.parse(canonicalSettings),
  loadouts: versionTwoShips
}).ok, true);
assert.equal(memory.get(N.Loadouts.key), JSON.stringify(versionTwoShips));
assert.equal(memory.get(N.Profile.key), olderProfile);
assert.equal(memory.get('unrelated-data'), 'keep');
assert.equal(N.SaveTransfer.apply({
  fileVersion: 3,
  checkpoint: smallCheckpoint,
  settings: JSON.parse(canonicalSettings),
  loadouts: versionTwoShips,
  profile: { version: 2, stats: { shotsFired: 9 } }
}).ok, true);
assert.equal(JSON.parse(memory.get(N.Profile.key)).stats.shotsFired, 9);
assert.equal(memory.get('unrelated-data'), 'keep');
assert.equal(N.SaveTransfer.apply({
  fileVersion: 4,
  checkpoint: smallCheckpoint,
  settings: JSON.parse(canonicalSettings),
  loadouts: versionTwoShips,
  profile: profileFile
}).ok, true);
assert.equal(JSON.parse(memory.get(N.Profile.key)).book.dart.kills, 1);
assert.equal(memory.get('unrelated-data'), 'keep');
console.log('Save transfer checks passed, including quota rollback and profile validation.');
