const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const N={TAU:Math.PI*2,clamp:(value,min,max)=>Math.max(min,Math.min(max,value))};
const context=vm.createContext({window:{NEON:N}});
for(const file of ['content','progression-content','progression-stats','progression-offense','progression-defense','progression-equipment']){
  vm.runInContext(readFileSync('js/'+file+'.js','utf8'),context,{filename:file+'.js'});
}
const C=N.ProgressionContent,S=N.ProgressionStats,E=N.Equipment;
const clone=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

for(const [hull,hp,shield,speed,damage] of [
  ['kite',100,20,245,10],['dart',80,20,281.75,6],
  ['delta',140,30,208.25,5],['talon',75,20,245,35]
]){
  const state=E.create(hull);
  const before=JSON.stringify(state);
  const stats=S.derive(hull,state);
  assert.equal(stats.maxHp,hp);
  assert.equal(stats.maxShield,shield);
  near(stats.moveSpeed,speed);
  near(stats.offensive[0].damage,damage);
  assert.equal(stats.regen,0);
  assert.equal(stats.multishot,0);
  assert.equal(stats.luck,1);
  assert.equal(JSON.stringify(state),before);
  assert.deepEqual(clone(S.derive(hull,clone(state))),clone(stats));
}

for(const id of C.passiveOrder){
  const cap=C.passive(id).maxStacks;
  for(const count of [1,cap]){
    const state=E.create('kite');
    state.passives[id]=count;
    assert.equal(S.isValidState(state),true);
    const outcome=S.upgradeOutcome(state,{type:'passive',id});
    assert.equal(outcome.type,count===cap?'fallback':'passive');
    assert.equal(state.passives[id],count);
  }
  const state=E.create('kite');
  assert.equal(S.upgradeOutcome(state,{type:'passive',id}).newStacks,1);
  for(const invalid of [0,-1,cap+1,.5,NaN,Infinity,'1']){
    state.passives[id]=invalid;
    assert.equal(S.derive('kite',state).ok,false);
    assert.equal(S.upgradeOutcome(state,'primary').ok,false);
  }
}
const unknown=E.create('kite');
unknown.passives.vector=1;
assert.equal(S.derive('kite',unknown).ok,false);
assert.equal(S.derive('unknown',E.create('kite')).ok,false);
assert.equal(S.derive('talon',E.create('kite')).ok,false);
assert.equal(S.upgradeOutcome(E.create('kite'),{type:'passive',id:'vector'}).ok,false);

const maximum=E.create('talon');
for(const id of C.passiveOrder)maximum.passives[id]=C.passive(id).maxStacks;
maximum.offensive[1]={id:'arc_projector',level:5,cooldownSeconds:.7};
maximum.offensive[2]={id:'plasma_mortar',level:5,cooldownSeconds:2};
maximum.offensive[0].level=5;
maximum.defensive={id:'aegis_projector',level:5,cooldownSeconds:6};
const maxStats=S.derive('talon',maximum);
assert.equal(maxStats.maxHp,175);
assert.equal(maxStats.maxShield,70);
near(maxStats.moveSpeed,281.75);
near(maxStats.offensive[0].damage,78.4);
near(maxStats.offensive[1].damage,50.4);
near(maxStats.offensive[2].damage,33.6);
near(maxStats.offensive[0].cooldownSeconds,.7/1.3);
near(maxStats.shieldRegenPerSecond,18);
near(maxStats.damageTakenMul,.85);
assert.equal(maxStats.defensive.cooldownSeconds,7);
assert.equal(maxStats.defensive.capacity,45);
const serialized=JSON.stringify(maximum);
for(let iteration=0;iteration<100;iteration++)assert.deepEqual(clone(S.derive('talon',maximum)),clone(maxStats));
assert.deepEqual(clone(S.derive('talon',clone(maximum))),clone(maxStats));
assert.equal(JSON.stringify(maximum),serialized);

for(const level of [1,2,3,4,5]){
  const state=E.create('talon');
  state.offensive[0].level=level;
  state.defensive={id:'repulsor_pulse',level,cooldownSeconds:1};
  const stats=S.derive('talon',state);
  near(stats.offensive[0].damage,35*[1,1.15,1.3,1.45,1.6][level-1]);
  near(stats.offensive[0].cooldownSeconds,.7);
  near(stats.defensive.cooldownSeconds,5-.4*(level-1));
  assert.equal(stats.defensive.damage,12);
  assert.equal(S.upgradeOutcome(state,'primary').type,level===5?'fallback':'upgrade');
}
for(const invalid of [0,6,.5,Infinity,NaN,'1']){
  const state=E.create('kite');
  state.offensive[0].level=invalid;
  assert.equal(S.derive('kite',state).ok,false);
}
const two=E.create('kite');
assert.equal(S.upgradeOutcome(two,'offensive').slotIndex,1);
two.offensive[1]={id:'arc_projector',level:2,cooldownSeconds:.4};
const install=S.upgradeOutcome(two,'offensive');
assert.equal(install.slotIndex,2);
assert.equal(install.candidates.includes('arc_projector'),false);
two.offensive[2]={id:'seeker_missiles',level:2,cooldownSeconds:.8};
const old=JSON.stringify(two);
assert.equal(S.upgradeOutcome(two,'offensive').slotIndex,1);
assert.equal(JSON.stringify(two),old);
two.offensive[1].level=5;
assert.equal(S.upgradeOutcome(two,'offensive').slotIndex,2);
two.offensive[2].level=5;
assert.equal(S.upgradeOutcome(two,'offensive').type,'fallback');
assert.equal(S.upgradeOutcome(two,'defensive').candidates.length,2);
two.defensive={id:'aegis_projector',level:4,cooldownSeconds:2};
assert.equal(S.upgradeOutcome(two,'defensive').newLevel,5);
assert.equal(S.upgradeOutcome(two,'defensive').slotIndex,'defense');
assert.equal(two.defensive.cooldownSeconds,2);

const base=S.derive('kite',E.create('kite'));
const capacityState=E.create('kite');
capacityState.passives={reinforced_hull:1,shield_capacitor:1};
const larger=S.derive('kite',capacityState);
assert.deepEqual(clone(S.capacityDelta(base,larger,{hp:37,shield:2})),
  {ok:true,hp:47,shield:7,hpIncrease:10,shieldIncrease:5});
assert.equal(S.capacityDelta(larger,larger,{hp:37,shield:2}).hp,37);
assert.equal(S.capacityDelta(base,larger,{hp:0,shield:0,dead:true}).hp,0);
assert.equal(S.capacityDelta(base,larger,{hp:37,shield:2,connected:false}).shield,7);
assert.equal(S.capacityDelta(base,larger,{hp:NaN,shield:2}).ok,false);

const fired=[];
const player={shipType:'talon',x:0,y:0,progression:clone(maximum),buffs:{overclock:12}};
player.progression.offensive[0].cooldownSeconds=0;
let shot=E.tryFire({player,game:{},spawnBullet:bullet=>fired.push(bullet)},{aimAngle:0});
assert.equal(shot.ok,true);
near(fired[0].damage,78.4);
near(shot.cooldownSeconds,.7/(1.3*1.35));
// Upgrading earned state cannot clear an already-running timer or rewrite a shot.
player.progression.passives.weapon_amplifier=9;
assert.equal(E.tryFire({player,spawnBullet(){}},{aimAngle:0}).reason,'cooldown');
near(fired[0].damage,78.4);
near(player.progression.offensive[0].cooldownSeconds,.7/(1.3*1.35));

const victim={hp:50,shield:10,invuln:0,stats:maxStats,
  barrier:{capacity:25,windowSeconds:3,lockoutSeconds:2}};
const hit=N.ProgressionDefense.applyDamage(victim,40);
near(hit.barrierDamage,25);
near(hit.shieldDamage,9);
near(victim.hp,50);
near(victim.shield,1);
assert.equal(C.xpNext(1),38);
assert.equal(C.xpNext(2),49);
assert.equal(C.xpNext(Infinity),null);
assert.equal(C.passiveSequence[0],'reinforced_hull');
console.log('Progression stats: boundaries, reconstruction, upgrades, capacity and combat passed');
