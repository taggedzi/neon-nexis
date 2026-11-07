/* Run only in an isolated browser context at /?test=equipment. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='equipment')throw Error('Use an isolated equipment test page');
const N=window.NEON,G=N.Game,C=N.ProgressionContent,E=N.Equipment,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
function approx(actual,expected,epsilon=1e-9){return Math.abs(actual-expected)<=epsilon;}
check(C&&E,'progression catalog and equipment module are loaded');
check(C.schemaVersion===1&&C.catalogVersion===1,'schema and catalog versions are explicit');
check(C.offensiveSlotCount===3&&C.additionalSlotCount===2,'three offensive slots include two additional slots');
check(C.defensiveSlotCount===1,'defense is a separate slot');
check(C.maxWeaponLevel===5&&approx(C.switchDelaySeconds,.15),'weapon level cap and switch delay match the approved contract');
check(C.primaryOrder.length===4&&C.primaryOrder.every(id=>!!C.primary(id)),'four ordered hull primaries are exposed');
G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{trackStats:false});
G.applySettings(false);
G.newRun({shipType:'kite'});
check(G.run.progressionMode===undefined,'public new run uses the existing run state');
check(G.player.progression===undefined,'legacy player construction has no shared progression state');
check(G.player.weapons.length===1&&G.player.weapons[0].id===N.STARTING_WEAPON,'legacy starting weapon is unchanged');
check(G.player.weaponSlots===N.START_SLOTS.weapons&&G.player.activeWeapon===0,'legacy weapon capacity and selection are unchanged');
const level=G.level;
const hulls=['kite','dart','delta','talon'];
const expected={
  kite:{primary:'pulse_repeater',maxHp:100,maxShield:20,speed:245,damageMul:1},
  dart:{primary:'needle_blaster',maxHp:80,maxShield:20,speed:281.75,damageMul:1},
  delta:{primary:'scatter_cannon',maxHp:140,maxShield:30,speed:208.25,damageMul:1},
  talon:{primary:'rail_lance',maxHp:75,maxShield:20,speed:245,damageMul:1.25}
};
const states={};
for(const hull of hulls){
  const want=expected[hull];
  const state=E.create(hull);
  states[hull]=state;
  check(E.isValidState(state),'fresh '+hull+' state passes equipment validation');
  check(state.offensive.length===C.offensiveSlotCount,'fresh '+hull+' state has three offensive slots');
  check(state.offensive[0].id===want.primary&&state.offensive[0].level===1&&state.offensive[0].cooldownSeconds===0,'fresh '+hull+' primary is correct and ready');
  check(state.offensive[1]===null&&state.offensive[2]===null,'fresh '+hull+' additional slots are empty');
  check(state.selectedOffensiveSlot===0&&state.switchDelaySeconds===0,'fresh '+hull+' selects the primary without delay');
  check(state.defensive===null&&Object.keys(state.passives).length===0,'fresh '+hull+' defense and passives are empty');
  check(state.level===1&&state.xp===0&&state.nextPassiveIndex===0&&state.salvage===0&&state.revision===0&&state.appliedEventSequence===0,'fresh '+hull+' progression counters start clean');
  check(C.primaryForHull(hull)===want.primary&&C.primary(want.primary).id===want.primary,'content maps '+hull+' to its approved primary');
  const solo=G.makePlayer({shipType:hull},'shared_v1');
  check(solo.progressionMode==='shared_v1'&&solo.progression&&solo.progression.offensive[0].id===want.primary,'solo construction receives the hull primary');
  check(solo.level===1&&solo.xp===0&&solo.xpNext===G.xpForLevel(1),'solo construction starts at level one');
  check(solo.stats.maxHp===want.maxHp&&solo.stats.maxShield===want.maxShield&&approx(solo.stats.speed,want.speed)&&solo.stats.damageMul===want.damageMul,'solo construction keeps approved hull stats');
  const remote=N.Coop.makeRemotePlayer({name:'PLAYER 2',shipType:hull,shipColor:'#66ffff'},level,1,'shared_v1');
  check(remote.progressionMode==='shared_v1'&&remote.progression&&remote.progression.offensive[0].id===want.primary,'host/guest construction receives the hull primary');
  check(remote.stats.maxHp===want.maxHp&&remote.stats.maxShield===want.maxShield&&approx(remote.stats.speed,want.speed)&&remote.stats.damageMul===want.damageMul,'host/guest construction keeps approved hull stats');
  check(remote.progression!==solo.progression&&remote.progression!==state,'host/guest progression state is independent');
  const legacy=G.makePlayer({shipType:hull});
  check(legacy.progression===undefined&&legacy.progressionMode===undefined,'default construction remains legacy');
  let rejected=false;
  try{G.makePlayer({shipType:hull},'unknown');}catch(error){rejected=true;}
  check(rejected,'unknown progression mode is rejected');
}
function fire(state,hull,aimAngle=0,spawn){
  const player={x:500,y:500,dead:false,shipType:hull,progression:state};
  const spawned=[];
  const result=E.tryFire({
    player,
    participantId:'solo-test',
    activationId:'activation-1',
    spawnBullet(projectile){
      spawned.push(projectile);
      if(spawn)spawn(projectile);
    }
  },{aimAngle});
  return {result,spawned,player};
}
function fireIntoGame(state,hull,aimAngle=0){
  const player=G.makePlayer({shipType:hull},'shared_v1');
  player.progression=state;
  player.x=500;
  player.y=500;
  player.aim=aimAngle;
  player.heading=aimAngle;
  G.playerBullets.length=0;
  G.enemies.length=0;
  G.level.layout=null;
  return E.tryFire({
    player,
    participantId:'solo-test',
    activationId:'activation-1',
    spawnBullet:projectile=>G.spawnBullet(projectile)
  },{aimAngle});
}
let shot=fire(states.kite,'kite');
check(shot.result.ok&&shot.result.weaponId==='pulse_repeater'&&shot.result.slotIndex===0,'pulse repeater fires one event');
check(shot.result.projectiles===1&&shot.spawned.length===1&&approx(shot.spawned[0].damage,10),'pulse repeater deals 10 damage');
check(approx(shot.spawned[0].speed,900)&&approx(shot.spawned[0].life,.8),'pulse repeater uses approved speed and lifetime');
check(shot.spawned[0].pierce===0&&shot.spawned[0].ownerParticipantId==='solo-test'&&shot.spawned[0].activationId==='activation-1','pulse repeater carries distinct-target and attribution metadata');
check(approx(states.kite.offensive[0].cooldownSeconds,.2),'pulse repeater starts its .20 s cooldown');
shot=fire(states.dart,'dart');
check(shot.result.ok&&shot.result.projectiles===1&&shot.spawned.length===1&&approx(shot.spawned[0].damage,6),'needle blaster deals 6 damage');
check(approx(shot.spawned[0].speed,1200)&&approx(shot.spawned[0].life,.6)&&approx(states.dart.offensive[0].cooldownSeconds,.12),'needle blaster uses approved bounds and cooldown');
shot=fire(states.delta,'delta');
check(shot.result.ok&&shot.result.projectiles===5&&shot.spawned.length===5,'scatter cannon emits five pellets');
check(shot.spawned.every(projectile=>approx(projectile.damage,5)),'scatter cannon deals 5 damage per pellet');
check(approx(shot.spawned[0].angle,-.31)&&approx(shot.spawned[2].angle,0)&&approx(shot.spawned[4].angle,.31),'scatter cannon spans the approved .62 radian cone');
check(approx(states.delta.offensive[0].cooldownSeconds,.55),'scatter cannon starts its .55 s cooldown');
shot=fire(states.talon,'talon');
check(shot.result.ok&&shot.result.projectiles===1&&shot.spawned.length===1&&approx(shot.spawned[0].damage,35),'talon rail lance applies its hull damage exactly once');
check(shot.spawned[0].pierce===2&&C.primary('rail_lance').maxDistinctTargets===3,'rail lance carries a three-distinct-target limit');
check(shot.spawned[0].critChance===C.critChance&&shot.spawned[0].critMul===C.critMul,'primary hits carry the approved critical parameters');
check(approx(states.talon.offensive[0].cooldownSeconds,.7),'rail lance starts its .70 s cooldown');
const immediate=fire(states.talon,'talon').result;
check(!immediate.ok&&immediate.reason==='cooldown'&&approx(states.talon.offensive[0].cooldownSeconds,.7),'cooldown rejects a second firing event without mutation');
states.talon.offensive[0].cooldownSeconds=0;
G.playerBullets.length=0;
const oldRandom=Math.random;
Math.random=()=>.5;
try{
  const rail=fireIntoGame(states.talon,'talon');
  check(rail.ok&&G.playerBullets.length===1,'rail lance creates one live projectile');
  G.level.anchors.length=0;
  G.level.caches.length=0;
  G.mines.length=0;
  G.orbitals.length=0;
  G.strikes.length=0;
  const enemy=(id,x,y=500)=>({
    id,x,y,r:4,hp:1000,maxHp:1000,
    dead:false,color:'#ff335c',role:'rusher',shield:0,hitFlash:0
  });
  G.enemies=[521,539,560,575].map((x,index)=>enemy('rail-target-'+index,x));
  G.enemies.reverse();
  const railOwner=G.playerBullets[0].coopPlayer;
  railOwner.progression.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
  E.select(railOwner.progression,1);
  G.updatePlayerBullets(.05);
  G.enemies.reverse();
  check(approx(1000-G.enemies[0].hp,35)&&approx(1000-G.enemies[1].hp,35)&&approx(1000-G.enemies[2].hp,35),'rail lance damages three distinct enemies once each');
  check(G.enemies[3].hp===1000,'rail lance stops before a fourth distinct enemy');
  check(railOwner.totalDamage===105,'in-flight rail retains damage and owner after switching');

  fireIntoGame(E.create('talon'),'talon');
  const near=enemy('near',585,550);
  const behind=enemy('behind',620,550);
  G.enemies=[behind,near];
  const floor=new Array(100).fill(true);
  floor[56]=false;
  G.level.layout={cols:10,rows:10,floor};
  const railBullet=G.playerBullets[0];
  railBullet.y=550;
  G.updatePlayerBullets(.08);
  check(near.hp===965&&behind.hp===1000&&railBullet.dead,'rail hits before a wall and stops at it');

  fireIntoGame(E.create('dart'),'dart');
  const needle=G.playerBullets[0];
  needle.life=.01;
  const outOfRange=enemy('out-of-range',540);
  G.enemies=[outOfRange];
  G.updatePlayerBullets(.05);
  check(outOfRange.hp===1000&&needle.x===512&&needle.dead,'fast projectile stops at its lifetime within a step');

  fireIntoGame(E.create('kite'),'kite');
  const anchor={id:'objective',x:520,y:500,r:4,hp:1000,alive:true};
  G.level.anchors=[anchor];
  G.updatePlayerBullets(.05);
  check(anchor.hp===990&&G.playerBullets[0].dead,'primary shots still damage destructible objectives');
  G.level.anchors=[];
  fireIntoGame(E.create('kite'),'kite');
  const mine={id:'hostile-mine',x:520,y:500,radius:10,owner:'enemy',dead:false};
  G.mines=[mine];
  G.updatePlayerBullets(.05);
  check(mine.dead&&G.playerBullets[0].dead,'primary shots destroy hostile mines');
  G.mines=[];
}finally{
  Math.random=oldRandom;
}
const switchState=E.create('kite');
switchState.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
switchState.offensive[0].cooldownSeconds=.5;
let switched=E.select(switchState,1);
check(switched.ok&&switched.changed&&approx(switchState.switchDelaySeconds,.15),'selection starts the approved .15 s switch delay');
let blocked=fire(switchState,'kite').result;
check(!blocked.ok&&blocked.reason==='switch-delay','switch delay blocks offensive firing');
check(approx(switchState.offensive[0].cooldownSeconds,.5),'switch delay does not reset a holstered cooldown');
E.tick(switchState,.15);
check(approx(switchState.switchDelaySeconds,0),'switch delay advances on simulation time');
const additional=fire(switchState,'kite').result;
check(additional.ok&&additional.projectiles===2,'seeker launches two missiles after the switch delay');
check(approx(switchState.offensive[0].cooldownSeconds,.35),'holstered cooldown advances while switched');
const back=E.select(switchState,0);
check(back.ok&&back.changed&&approx(switchState.offensive[0].cooldownSeconds,.35),'switching back preserves the cooldown');
check(approx(switchState.switchDelaySeconds,.15),'switching back starts a new delay');
const same=E.create('kite');
same.switchDelaySeconds=.1;
const sameSlot=E.select(same,0);
check(sameSlot.ok&&!sameSlot.changed&&approx(same.switchDelaySeconds,.1),'same-slot selection is a no-op');
check(!E.select(same,3).ok,'invalid slot index is rejected');
check(!E.select(same,1).ok,'empty slot selection is rejected');
const cycleState=E.create('kite');
cycleState.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
let cycled=E.cycle(cycleState,1);
check(cycled.ok&&cycled.slotIndex===1,'cycle forward selects the additional slot');
cycled=E.cycle(cycleState,1);
check(cycled.ok&&cycled.slotIndex===0,'cycle forward wraps and skips empty slot 2');
cycled=E.cycle(cycleState,-1);
check(cycled.ok&&cycled.slotIndex===1,'cycle backward selects the previous weapon');
check(!E.cycle(cycleState,2).ok,'invalid cycle direction is rejected');
const sole=E.create('kite');
sole.switchDelaySeconds=.1;
const soleCycle=E.cycle(sole,1);
check(soleCycle.ok&&!soleCycle.changed&&sole.selectedOffensiveSlot===0&&approx(sole.switchDelaySeconds,.1),'sole primary cycle keeps selection and delay');
const inventory=E.create('kite');
inventory.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
E.select(inventory,1);
E.tick(inventory,.15);
inventory.offensive[1]=null;
check(E.ensureValidSelection(inventory)&&inventory.selectedOffensiveSlot===0,'inventory change falls back to a valid primary');
check(E.offensiveSlot(inventory,0)===inventory.offensive[0]&&E.offensiveSlot(inventory,3)===null,'offensive slot accessor rejects invalid indexes');
function cooldownAfter(steps,elapsedSeconds){
  const state=E.create('kite');
  state.offensive[0].cooldownSeconds=.2;
  for(let index=0;index<steps;index++)E.tick(state,elapsedSeconds);
  return state.offensive[0].cooldownSeconds;
}
check(approx(cooldownAfter(12,1/60),0),'60 Hz ticks clear the same cooldown');
check(approx(cooldownAfter(6,1/30),0),'30 Hz ticks clear the same cooldown');
check(approx(cooldownAfter(1,.2),0),'one large tick clears the same cooldown');
const credit=E.create('kite');
credit.offensive[0].cooldownSeconds=.1;
E.tick(credit,.2);
check(approx(credit.offensive[0].cooldownSeconds,0),'tick clamps a completed cooldown to zero');
const credited=fire(credit,'kite').result;
check(credited.ok&&approx(credit.offensive[0].cooldownSeconds,.1),'overshoot credit shortens the next cooldown');
const waited=E.create('kite');
waited.offensive[0].cooldownSeconds=.01;
E.tick(waited,.05);
E.tick(waited,.05);
check(approx(fire(waited,'kite').result.cooldownSeconds,.2),'ready weapons cannot bank timing credit');
const holstered=E.create('kite');
holstered.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
holstered.offensive[0].cooldownSeconds=.02;
E.select(holstered,1);
E.tick(holstered,.05);
E.select(holstered,0);
E.tick(holstered,.15);
check(approx(fire(holstered,'kite').result.cooldownSeconds,.2),'holstered weapons cannot bank timing credit');
function shotCount(steps){
  const state=E.create('dart');
  let count=Number(fire(state,'dart').result.ok);
  for(let index=0;index<steps;index++){
    E.tick(state,12/steps);
    count+=Number(fire(state,'dart').result.ok);
  }
  return count;
}
check(shotCount(720)===101&&shotCount(360)===101&&shotCount(537)===101,'held needle fire maintains cadence across step sizes');
check(!fire(E.create('talon'),'kite').result.ok,'another hull cannot fire the permanent primary');
const timing=E.create('kite');
timing.offensive[0].cooldownSeconds=.2;
const badTick=E.tick(timing,-.1);
check(!badTick.ok&&approx(timing.offensive[0].cooldownSeconds,.2),'negative elapsed time is rejected without mutation');
const dead=E.tryFire({player:{dead:true,x:0,y:0,shipType:'kite',progression:E.create('kite')},spawnBullet(){}},{aimAngle:0});
check(!dead.ok&&dead.reason==='player-unavailable','dead players cannot fire');
const noSpawn=E.tryFire({player:{dead:false,x:0,y:0,shipType:'kite',progression:E.create('kite')},game:{}},{aimAngle:0});
check(!noSpawn.ok&&noSpawn.reason==='no-spawner','a firing event requires an explicit projectile sink');
const unknown=E.create('kite');
unknown.offensive[0].id='unknown_primary';
check(!E.isValidState(unknown),'unknown primary IDs are rejected');
check(!fire(unknown,'kite').result.ok,'unknown primary content is rejected');
check(!E.isValidState(null),'null state is invalid');
const malformed=E.create('kite');
malformed.offensive=malformed.offensive.slice(0,2);
check(!E.isValidState(malformed),'wrong offensive slot count is invalid');
const badLevel=E.create('kite');
badLevel.offensive[0].level=0;
check(!E.isValidState(badLevel),'invalid weapon level is rejected');
const badSelection=E.create('kite');
badSelection.selectedOffensiveSlot=3;
check(!E.isValidState(badSelection),'invalid selected slot is rejected');
const badDelay=E.create('kite');
badDelay.switchDelaySeconds=-1;
check(!E.isValidState(badDelay),'negative switch delay is rejected');
// Use the real damage and projectile paths in a controlled empty arena.
G.level.layout=null;
G.level.anchors=[];
G.level.caches=[];
G.mines=[];
const owner=G.makePlayer({shipType:'kite'},'shared_v1');
owner.x=500;
owner.y=500;
function offensiveFire(id,player=owner,level=1,participantId='owner'){
  player.progression.offensive[1]={id,level,cooldownSeconds:0};
  player.progression.selectedOffensiveSlot=1;
  return E.tryFire({game:G,player,participantId,activationId:id},{aimAngle:0});
}
function enemy(id,x,y,role='shooter'){
  return {id,x,y,role,r:10,hp:1000,shield:0,color:'#fff'};
}
const random=Math.random;
Math.random=()=>.5;
try{
  G.playerBullets.length=0;
  const first=enemy('a',600,500);
  const second=enemy('b',740,500);
  const third=enemy('c',870,500);
  const outside=enemy('d',500,370);
  G.enemies=[third,second,outside,first];
  check(offensiveFire('arc_projector').ok,'arc fires through equipment dispatch');
  check(first.hp===982&&second.hp===988&&third.hp===992&&outside.hp===1000,'arc chains nearest distinct enemies from each previous hit');
  check(offensiveFire('seeker_missiles').projectiles===2&&G.playerBullets.every(b=>b.target===first),'seekers acquire the nearest in-cone enemy');
  G.updatePlayerBullets(.22);
  check(first.hp===950&&second.hp===988,'seekers make swept direct hits without splash');
  G.playerBullets.length=0;
  const original=enemy('original',600,500);
  const replacement=enemy('replacement',620,590);
  const offAim=enemy('off-aim',530,540);
  G.enemies=[original,replacement,offAim];
  offensiveFire('seeker_missiles');
  original.dead=true;
  G.updatePlayerBullets(.05);
  check(G.playerBullets.every(b=>b.target===replacement&&approx(b.angle,.2)),'seekers reacquire inside the original aim cone and obey the turn limit');
  G.playerBullets.length=0;
  const boundary=enemy('boundary',980,500);
  const boss=enemy('boss',860,540,'boss');
  G.enemies=[boundary,boss];
  check(offensiveFire('gravity_bomb').ok,'gravity bomb launches');
  G.updatePlayerBullets(.6);
  check(boundary.hp===955&&boss.hp===955,'bomb includes hitbox contact at its radius and damages bosses');
  check(approx(N.ProgressionOffense.movementSeconds(boundary,.5),.375),'ordinary enemies are slowed 25 percent');
  check(approx(N.ProgressionOffense.movementSeconds(boss,.5),.5),'bosses ignore bomb slow');
  check(approx(N.ProgressionOffense.movementSeconds(boundary,1.5),1.25),'slow expires at its partial-step boundary');
  G.playerBullets.length=0;
  const floor=Array(144).fill(true);
  for(let y=0;y<12;y++)floor[y*12+7]=false;
  G.level.layout={cols:12,rows:12,floor};
  const reachable=enemy('near-wall',650,500);
  const occluded=enemy('behind-wall',810,500);
  G.enemies=[reachable,occluded];
  offensiveFire('gravity_bomb');
  G.updatePlayerBullets(.6);
  check(reachable.hp===955&&occluded.hp===1000,'a wall triggers a bomb on its reachable side and blocks blast damage');
  G.playerBullets.length=0;
  const leaving=enemy('leaving',670,500);
  const entering=enemy('entering',480,500);
  G.enemies=[leaving,entering];
  offensiveFire('gravity_bomb');
  const bombPositions=N.ProgressionOffense.capturePositions(G);
  leaving.x=510;
  entering.x=650;
  G.updatePlayerBullets(.6,bombPositions);
  const detonationX=670+(510-670)*(.325/.6);
  check(leaving.hp===955&&entering.hp===1000,'bomb samples range at wall impact before targets finish their step');
  check(approx(leaving.x,510+(detonationX-510)*.25),'bomb applies slow to the remaining movement in its detonation step');
  G.level.layout=null;
  G.playerBullets.length=0;
  const victim=enemy('field',860,500);
  G.enemies=[victim];
  const remote=N.Coop.makeRemotePlayer({name:'P2',shipType:'kite',shipColor:'#66ffff'},G.level,1,'shared_v1');
  remote.x=500;
  remote.y=500;
  const ownerDamage=owner.totalDamage;
  const remoteDamage=remote.totalDamage;
  offensiveFire('plasma_mortar');
  offensiveFire('plasma_mortar',owner,5);
  offensiveFire('plasma_mortar',remote,1,'remote');
  const offense=N.ProgressionOffense;
  const flight=offense.snapshotVisuals(G);
  check(flight.projectiles.length===3&&flight.projectiles.every(b=>!Object.hasOwn(b,'damage')&&!Object.hasOwn(b,'coopPlayer')),'guest flight projection contains only visual data');
  G.updatePlayerBullets(.7);
  const view=JSON.parse(JSON.stringify(offense.snapshotVisuals(G)));
  const guestLevel={};
  offense.setGuestVisuals(guestLevel,view);
  check(offense.guestVisuals(guestLevel).fields.length===3&&offense.activeFields(guestLevel).length===0,'guest field projection is separate from combat state');
  check(view.flashes.length===3&&view.fields.every(field=>field.radius===90),'guest view includes bounded impact and field geometry');
  const priorMode=G.mode;
  G.mode='paused';
  const pausedHp=victim.hp;
  G.update(.05);
  check(victim.hp===pausedHp&&offense.snapshotVisuals(G).fields[0].life===view.fields[0].life,'world pause freezes field damage and lifetime');
  G.mode=priorMode;
  for(let i=0;i<17;i++)G.updatePlayerBullets(.17);
  G.updatePlayerBullets(.2);
  check(approx(victim.hp,1000-36*2.6),'plasma integrates partial steps and stacks only the strongest field per owner');
  check(approx(owner.totalDamage-ownerDamage,57.6)&&approx(remote.totalDamage-remoteDamage,36),'plasma credits each original owner separately');
  check(N.ProgressionOffense.activeFields(G.level).length===0,'expired fields are released');
  for(const steps of [1,10]){
    G.playerBullets.length=0;
    G.enemies=[];
    offensiveFire('plasma_mortar');
    G.updatePlayerBullets(.6);
    const crossing=enemy('crossing',660,500);
    G.enemies=[crossing];
    for(let step=0;step<steps;step++){
      const previous=offense.capturePositions(G);
      crossing.x+=400/steps;
      G.updatePlayerBullets(1/steps,previous);
    }
    check(approx(crossing.hp,994),'plasma deals half a second of damage across '+steps+' simulation steps');
    G.updatePlayerBullets(2);
  }
  const finalTarget=enemy('last-hit',600,500);
  finalTarget.hp=10;
  G.enemies=[finalTarget];
  const credit=N.PlayerStats.credit;
  const credited=[];
  N.PlayerStats.credit=(key,player)=>credited.push({key,player});
  try{
    offensiveFire('arc_projector',remote,1,'remote');
  }finally{
    N.PlayerStats.credit=credit;
  }
  const kills=credited.filter(entry=>entry.key==='shipsDestroyed');
  check(finalTarget.dead&&kills.length===1&&kills[0].player===remote,'a remote ship receives its arc kill through the existing stat hook');
  for(const reverse of [false,true]){
    G.playerBullets.length=0;
    const victim=enemy('chronological-kill',860,500);
    victim.hp=3;
    G.enemies=[victim];
    owner.x=740;
    remote.x=560;
    const launches=[[owner,.2,'early'],[remote,.5,'late']];
    if(reverse)launches.reverse();
    for(const [caster,life,id] of launches){
      offensiveFire('plasma_mortar',caster,1,id);
      G.playerBullets.at(-1).life=life;
    }
    credited.length=0;
    N.PlayerStats.credit=(key,player)=>credited.push({key,player});
    try{
      G.updatePlayerBullets(.6);
    }finally{
      N.PlayerStats.credit=credit;
    }
    check(victim.dead&&credited.filter(entry=>entry.key==='shipsDestroyed').every(entry=>entry.player===owner)
      &&credited.some(entry=>entry.key==='shipsDestroyed'),'an earlier plasma field earns the kill regardless of insertion order');
    G.updatePlayerBullets(3);
  }
  const isGuest=N.Coop.isGuest;
  N.Coop.isGuest=()=>true;
  try{
    const denied=offensiveFire('arc_projector',remote,1,'remote');
    check(!denied.ok&&denied.reason==='not-authoritative'&&remote.progression.offensive[1].cooldownSeconds===0,'guest fire cannot apply damage or spend authoritative cooldown');
  }finally{
    N.Coop.isGuest=isGuest;
  }
}finally{
  Math.random=random;
}
G.pauseGame();
window.equipmentResult={passed:passed.length,checks:passed};
})();
