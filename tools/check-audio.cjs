const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let tick;
let sources = [];
let context;
const parameter = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {},
  exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
function node(kind) {
  return { kind, connect() {}, disconnect() {}, gain: parameter(), frequency: parameter(),
    detune: parameter(), pan: parameter(), Q: parameter(), threshold: parameter(),
    knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(),
    start(t) { assert.ok(t >= context.currentTime, 'no notes scheduled in the past'); this.startTime = t; sources.push(this); },
    stop(t) { assert.ok(Number.isFinite(t), 'sources have finite lifetimes'); this.stopTime = t; } };
}
class AudioContext {
  constructor() { context = this; this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
  createOscillator() { return node('oscillator'); }
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createStereoPanner() { return node(); }
  createDynamicsCompressor() { return node(); }
  createBufferSource() { return node(); }
  createBuffer() { return { getChannelData: () => new Float32Array(9600) }; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
async function check() {
  const defaults = { audio: { master: .7, music: .6, sfx: .7, muted: false } };
  const N = { SETTINGS_DEFAULT: defaults, deepMerge: (a, b) => ({ ...a, ...b,
    audio: { ...a.audio, ...b.audio } }), clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) };
  const document = { hidden: false };
  vm.runInNewContext(fs.readFileSync('js/audio.js', 'utf8'), {
    window: { NEON: N, AudioContext }, document, performance,
    setInterval(fn) { tick = fn; return 1; }, clearInterval() {}
  });
  const A = N.Audio;
  A.init();
  A.unlock();
  for (const scene of ['menu', 'game', 'paused', 'dead', 'complete']) {
    A.setScene(scene);
    const start = sources.length;
    for (let i = 0; i < 2000; i++) { tick(); context.currentTime += .04; }
    assert.ok(sources.length > start, scene + ' produces music');
    const voices = sources.slice(start).filter(source => source.kind === 'oscillator');
    const events = voices.flatMap(source => [[source.startTime, 1], [source.stopTime, -1]])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let active = 0;
    let peak = 0;
    for (const [, change] of events) { active += change; peak = Math.max(peak, active); }
    console.log(scene + ': peak ' + peak + ' simultaneous scheduled oscillators over 80 seconds');
  }
  A.setSettings({ audio: { muted: true } });
  const muted = sources.length;
  context.currentTime += 3600;
  tick();
  assert.equal(sources.length, muted);
  A.setSettings({ audio: { muted: false } });
  tick();
  assert.ok(sources.length - muted < 20, 'unmute does not replay missed hours');
  document.hidden = true;
  const hidden = sources.length;
  context.currentTime += 3600;
  tick();
  assert.equal(sources.length, hidden);
  document.hidden = false;
  tick();
  assert.ok(sources.length - hidden < 20, 'tab return does not replay missed hours');
  A.suspend();
  const suspended = sources.length;
  tick();
  assert.equal(sources.length, suspended);
  A.resume();
  await new Promise(resolve => setImmediate(resolve));
  context.currentTime += .3;
  tick();
  assert.ok(sources.length > suspended);
  console.log('Audio scene, finite-source and long mute/hide/suspend recovery checks passed.');
}

check().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
