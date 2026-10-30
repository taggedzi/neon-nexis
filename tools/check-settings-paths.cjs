const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the private production helper without exposing it to the game API.
const source = fs.readFileSync('js/ui.js', 'utf8');
const helper = source.slice(source.indexOf('const SETTING_PATHS ='), source.indexOf('function toggleHTML('));
const context = vm.createContext({ assert });
vm.runInContext(helper + `
  const settings = {
    deadzone: 0.2, rightStickFire: false,
    audio: { master: 1, music: 1, sfx: 1, muted: false },
    graphics: { particles: 1, shake: true, scanlines: true, glitch: true, showFps: false },
    accessibility: { reducedFlash: false }
  };
  for (const path of SETTING_PATHS) {
    const parts = path.split('.');
    const owner = parts.length === 1 ? settings : settings[parts[0]];
    const key = parts.at(-1);
    const value = typeof owner[key] === 'boolean' ? !owner[key] : 0.5;
    assert.equal(setPath(settings, path, value), true);
    assert.equal(owner[key], value);
  }
  const before = JSON.stringify(settings);
  for (const path of [
    '__proto__.polluted', 'constructor.prototype.polluted',
    'audio.__proto__.polluted', 'audio.constructor.prototype.polluted',
    '__proto__', 'constructor', 'prototype', 'audio.unknown', '', null, 3
  ]) {
    assert.equal(setPath(settings, path, true), false);
  }
  assert.equal(JSON.stringify(settings), before);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
  assert.equal(setPath(Object.create(settings), 'audio.master', 0), false);
  assert.equal(setPath({ audio: Object.create({ master: 1 }) }, 'audio.master', 0), false);
  for (const obj of [{}, { audio: null }, { audio: 3 }, null]) {
    assert.equal(setPath(obj, 'audio.master', 0), false);
  }
`, context);
console.log('Settings paths: valid updates, prototype paths, unknown paths and inherited/missing properties passed.');
