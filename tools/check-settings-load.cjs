// Malformed settings groups fall back without blocking boot or rewriting storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const stored = new Map();
const box = {
  window: { NEON: {} },
  localStorage: {
    getItem(key) { return stored.has(key) ? stored.get(key) : null; },
    setItem(key, value) { stored.set(key, String(value)); },
    removeItem(key) { stored.delete(key); }
  }
};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/util.js'), 'utf8'), box);
const N = box.window.NEON;
N.Storage.init();

const malformed = JSON.stringify({
  audio: null,
  graphics: 1,
  keyboard: [],
  gamepad: 'no',
  accessibility: null,
  deadzone: 0.41,
  movementMode: 'driving'
});
stored.set(N.Storage.settingsKey, malformed);
const loaded = N.loadSettings();
assert.equal(loaded.audio.master, 0.7);
assert.equal(loaded.graphics.quality, 'high');
assert.equal(loaded.keyboard.fire, 'KeyF');
assert.equal(typeof loaded.gamepad.rewards, 'number');
assert.equal(loaded.deadzone, 0.41);
assert.equal(loaded.movementMode, 'driving');
assert.equal(loaded.capturePointer, true);
assert.equal(stored.get(N.Storage.settingsKey), malformed);

stored.set(N.Storage.settingsKey, JSON.stringify({
  deadzone: 0.33,
  keyboard: {
    moveUp: 'ArrowUp', moveDown: 'ArrowDown', moveLeft: 'ArrowLeft', moveRight: 'ArrowRight',
    dash: 'ShiftLeft', pause: 'Escape', weaponNext: 'KeyE', weaponPrev: 'KeyQ', inventory: 'KeyI'
  },
  gamepad: { fire: 7, dash: 0, pause: 9, weaponNext: 5, weaponPrev: 4, inventory: 3 }
}));
const migrated = N.loadSettings();
assert.equal(migrated.keyboard.moveUp, 'ArrowUp');
assert.equal(migrated.keyboard.fire, 'KeyF');
assert.equal(migrated.keyboard.rewards, 'KeyR');
assert.equal(migrated.gamepad.rewards, 2);
assert.equal(migrated.deadzone, 0.33);
assert.equal(migrated.capturePointer, true);
assert.equal(migrated.keyboard.defense,'KeyR');
assert.equal(migrated.keyboard.offensive1,'Digit1');
assert.equal(migrated.gamepad.defense,2);
assert.equal(stored.size, 1);

const remapped=N.normalizeSettings({keyboard:{pause:'Digit1',fire:'KeyR'},gamepad:{pause:14,fire:2}});
assert.equal(remapped.keyboard.pause,'Digit1');
assert.equal(remapped.keyboard.fire,'KeyR');
assert.notEqual(remapped.keyboard.offensive1,'Digit1');
assert.notEqual(remapped.keyboard.defense,'KeyR');
assert.equal(remapped.gamepad.pause,14);
assert.equal(remapped.gamepad.fire,2);
assert.notEqual(remapped.gamepad.offensive1,14);
assert.notEqual(remapped.gamepad.defense,2);

stored.set(N.Storage.settingsKey, JSON.stringify({ capturePointer: false, deadzone: 0.2 }));
const captureOff = N.loadSettings();
assert.equal(captureOff.capturePointer, false);
assert.equal(captureOff.deadzone, 0.2);
assert.equal(captureOff.keyboard.fire, 'KeyF');
assert.equal(JSON.parse(stored.get(N.Storage.settingsKey)).capturePointer, false);

console.log('Settings load checks passed.');
