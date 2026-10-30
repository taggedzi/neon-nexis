const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function check() {
  const calls = [];
  const failures = [];
  let audioContext;
  let failureMode = 'reject';
  const parameter = { value: 0, setTargetAtTime() {} };
  class AudioContext {
    constructor() {
      audioContext = this;
      this.state = 'suspended';
      this.currentTime = 0;
      this.sampleRate = 10;
    }
    createDynamicsCompressor() {
      return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} };
    }
    createGain() { return { gain: parameter, connect() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(12) }; }
    resume() { return this.transition('resume'); }
    suspend() { return this.transition('suspend'); }
    transition(method) {
      calls.push(method);
      const error = new DOMException('Navigated away from page', 'InvalidStateError');
      if (failureMode === 'throw') {
        throw error;
      }
      return failureMode === 'reject' ? Promise.reject(error) : Promise.resolve();
    }
  }
  const neon = { deepMerge: () => ({ audio: {} }), clamp: value => value };
  const context = vm.createContext({
    window: { NEON: neon, AudioContext },
    setInterval: () => 1, clearInterval() {}
  });
  const onRejection = error => failures.push(error);
  process.on('unhandledRejection', onRejection);
  try {
    vm.runInContext(fs.readFileSync('js/audio.js', 'utf8'), context);
    assert.equal(neon.Audio.init({}), true);
    for (const mode of ['reject', 'throw', 'resolve']) {
      failureMode = mode;
      audioContext.state = 'suspended';
      assert.equal(neon.Audio.unlock(), true);
      neon.Audio.resume();
      audioContext.state = 'running';
      neon.Audio.suspend();
      // Already-running resume and already-suspended suspend must do nothing.
      neon.Audio.resume();
      audioContext.state = 'suspended';
      neon.Audio.suspend();
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(failures, []);
    }
    assert.deepEqual(calls, Array(3).fill(['resume', 'resume', 'suspend']).flat());
    assert.deepEqual(failures, []);
  } finally {
    process.removeListener('unhandledRejection', onRejection);
  }
  console.log('Audio lifecycle: rejected promises, synchronous errors, successful requests and state guards passed.');
}

check().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
