'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let wallMilliseconds=1000;
let spawned=0;
const game={
  time:0,mode:'paused',player:{progressionMode:'shared_v1'},
  run:{progression:{runToken:'a'.repeat(32),participantIds:[],participants:{}}},
  enemyBullets:[],spawnEnemyBullet:data=>{spawned++;return data;},spawnBullet:data=>data
};
const coop={
  runId:7,isGuest:()=>true,isHost:()=>false,onMessage(){},preUpdate(){},tickSession(){},endSession(){},leaveToMenu(){}
};
const N={Game:game,Coop:coop,Net:{peerId:'host',send(){}},ProgressionPersistence:{},
  ProgressionContent:{defense:id=>id==='repulsor_pulse'?{}:null}};
const context=vm.createContext({window:{NEON:N},performance:{now:()=>wallMilliseconds}});
vm.runInContext(fs.readFileSync('js/coop-progression.js','utf8'),context);
const clear={t:'progression_defense',_run:7,progressionVersion:1,wireVersion:7,
  runToken:'a'.repeat(32),event:{weaponId:'repulsor_pulse',clearedIds:['delayed-bullet']}};
N.Net.onMessage(clear,'host');
wallMilliseconds+=60000;
coop.tickSession(0);
assert.equal(game.spawnEnemyBullet({id:'delayed-bullet'}).dead,true);
assert.equal(spawned,0,'a delayed spawn cannot resurrect a cleared projectile after a long pause');
game.time=16;
coop.tickSession(0);
game.spawnEnemyBullet({id:'delayed-bullet'});
assert.equal(spawned,1,'suppression expires after simulated projectile lifetime rather than growing forever');
N.Net.onMessage({...clear,runToken:'b'.repeat(32)},'host');
game.spawnEnemyBullet({id:'delayed-bullet'});
assert.equal(spawned,2,'a different run cannot clear this run’s projectiles');
console.log('Progression transport: delayed projectile clears survive pause and expire on simulation time.');
