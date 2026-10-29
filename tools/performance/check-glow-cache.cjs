// Cache behavior without a browser dependency. Pixel comparisons run in-browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let allocations=0;
const sandbox={window:{NEON:{TAU:Math.PI*2,withAlpha:(color,alpha)=>`${color}/${alpha}`}},document:{createElement(name){
  assert.equal(name,'canvas');allocations++;
  const stops=[];
  return {width:0,height:0,stops,getContext(){return {createRadialGradient(){return {addColorStop(...stop){stops.push(stop);}};},fillRect(){}};}};
}}};
vm.runInNewContext(fs.readFileSync(new URL('../../js/assets.js',`file://${__filename}`),'utf8'),sandbox);
const A=sandbox.window.NEON.Assets;
const first=A.glow('#00f0ff',128,.7),before=allocations;
assert.equal(A.glow('#00f0ff',128,.7),first,'same glow reuses its canvas');
assert.equal(A.makeGlow('#00f0ff',128,.7),first,'both helpers share the cache');
assert.equal(allocations,before,'cache hits allocate no canvas');
assert.deepEqual(first.stops,[[0,'#00f0ff/0.95'],[.18,'#00f0ff/0.7'],[.55,`#00f0ff/${.7*.22}`],[1,'#00f0ff/0']]);
assert.notEqual(A.glow('#00f0ff',96,.7),first,'size is part of the key');
assert.notEqual(A.glow('#00f0ff',128,.55),first,'power is part of the key');
assert.notEqual(A.glow('#ff2bd6',128,.7),first,'color is part of the key');
assert.equal(A.glow('#ffffff'),A.makeGlow('#ffffff',96,.55),'defaults match');
const cold=A.glow('cold'),hot=A.glow('hot');
for(let i=0;i<300;i++){A.glow(`color-${i}`);A.glow('hot');}
assert.equal(A.glow('hot'),hot,'frequently used textures survive cache churn');
assert.notEqual(A.glow('cold'),cold,'old textures are evicted instead of growing forever');
console.log('Glow cache: reuse, key isolation, defaults, gradient stops, and eviction passed.');
