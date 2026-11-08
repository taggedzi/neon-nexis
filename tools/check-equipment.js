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
const defensePlayer=G.makePlayer({shipType:'kite'},'shared_v1');
defensePlayer.x=500;defensePlayer.y=500;
defensePlayer.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
const ally=G.makePlayer({shipType:'kite'},'shared_v1');
ally.x=550;ally.y=500;
const far=G.makePlayer({shipType:'kite'},'shared_v1');
far.x=641;far.y=500;
G.level.layout=null;
const context={game:G,player:defensePlayer,recipients:[defensePlayer,ally,far]};
const defend=E.tryDefend(context,{});
check(defend.ok&&defend.recipients===2&&ally.barrier.capacity===25&&!far.barrier,'Aegis protects living allies within range');
check(defend.event.type==='defense'&&defend.event.weaponId==='aegis_projector'&&defend.event.recipientIds.length===2,'activation returns the authoritative effect outcome');
check(defensePlayer.progression.selectedOffensiveSlot===0&&defensePlayer.progression.offensive[0].cooldownSeconds===0,'defense preserves offensive selection and cooldown');
check(!E.tryDefend(context,{}).ok&&defensePlayer.progression.defensive.cooldownSeconds===7,'cooldown rejects a repeat activation');
for(let slotIndex=0;slotIndex<3;slotIndex++){
  const pilot=G.makePlayer({shipType:'kite'},'shared_v1');
  pilot.x=500;pilot.y=500;
  pilot.progression.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
  pilot.progression.offensive[2]={id:'arc_projector',level:1,cooldownSeconds:0};
  pilot.progression.selectedOffensiveSlot=slotIndex;
  pilot.progression.offensive[slotIndex].cooldownSeconds=.33;
  pilot.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
  const activation=E.tryDefend({game:G,player:pilot},{});
  check(activation.ok&&pilot.progression.selectedOffensiveSlot===slotIndex&&pilot.progression.offensive[slotIndex].cooldownSeconds===.33,
    'defense preserves selected offensive slot '+slotIndex+' and its cooldown');
  pilot.progression.offensive[slotIndex].cooldownSeconds=0;
  check(E.tryFire({game:G,player:pilot},{aimAngle:0}).ok,'offense can fire in the same step as defense for slot '+slotIndex);
}
const switchingPilot=G.makePlayer({shipType:'kite'},'shared_v1');
switchingPilot.x=500;switchingPilot.y=500;
switchingPilot.progression.switchDelaySeconds=.15;
switchingPilot.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
check(E.tryDefend({game:G,player:switchingPilot},{}).ok&&
  E.tryFire({game:G,player:switchingPilot},{aimAngle:0}).reason==='switch-delay',
  'defense can activate during an offensive switching delay');
N.ProgressionDefense.tickBarrier(ally,2);
ally.barrier.capacity=4;
defensePlayer.progression.defensive.cooldownSeconds=0;
defensePlayer.progression.defensive.level=5;
E.tryDefend(context,{});
check(ally.barrier.capacity===45&&approx(ally.barrier.windowSeconds,1),'reapplication raises capacity without extending the window');
check(N.ProgressionDefense.absorb(ally,50)===5&&ally.barrier.capacity===0,'barrier absorbs damage before other resources');
N.ProgressionDefense.tickBarrier(ally,1.5);
check(ally.barrier.windowSeconds===0&&approx(ally.barrier.lockoutSeconds,1.5),'expiration begins the recipient lockout in simulation time');
defensePlayer.progression.defensive.cooldownSeconds=0;
E.tryDefend(context,{});
check(ally.barrier.capacity===0,'casts during lockout do not restore a barrier');
N.ProgressionDefense.tickBarrier(ally,1.5);
defensePlayer.progression.defensive.cooldownSeconds=0;
E.tryDefend(context,{});
check(ally.barrier.capacity===45&&ally.barrier.windowSeconds===3,'a new window starts after lockout');
E.tick(defensePlayer.progression,2);
check(defensePlayer.progression.defensive.cooldownSeconds===5,'defense cooldown advances on equipment simulation ticks');
const recovered=G.makePlayer({shipType:'kite'},'shared_v1');
const barrierSnapshot=N.ProgressionDefense.snapshotBarrier(ally);
check(N.ProgressionDefense.restoreBarrier(recovered,barrierSnapshot).ok&&recovered.barrier!==ally.barrier,'barrier restoration copies remaining state');
const beforeInvalid=JSON.stringify(recovered.barrier);
check(!N.ProgressionDefense.restoreBarrier(recovered,{capacity:46,windowSeconds:1,lockoutSeconds:2}).ok&&JSON.stringify(recovered.barrier)===beforeInvalid,'invalid barrier restoration does not alter the live state');
recovered.dead=true;
const frozenCooldown=defensePlayer.progression.defensive.cooldownSeconds;
N.ProgressionDefense.tickWorld([recovered,recovered],3.5);
check(recovered.barrier.capacity===0&&approx(recovered.barrier.lockoutSeconds,1.5),'downed or offline barriers use the world clock once per participant');
check(defensePlayer.progression.defensive.cooldownSeconds===frozenCooldown,'world barrier ticking does not recharge an offline defense');
const disconnected=G.makePlayer({shipType:'kite'},'shared_v1');
disconnected.progression.defensive={id:'aegis_projector',level:2,cooldownSeconds:4};
N.ProgressionDefense.restoreBarrier(disconnected,{capacity:20,windowSeconds:1,lockoutSeconds:2});
N.ProgressionDefense.tickWorld([disconnected],2);
const reconnect=G.makePlayer({shipType:'kite'},'shared_v1');
reconnect.progression=JSON.parse(JSON.stringify(disconnected.progression));
check(N.ProgressionDefense.restoreBarrier(reconnect,N.ProgressionDefense.snapshotBarrier(disconnected)).ok&&
  reconnect.progression.defensive.cooldownSeconds===4&&reconnect.barrier.capacity===0&&reconnect.barrier.lockoutSeconds===1,
  'reconnect preserves a frozen defense cooldown and the elapsed offline barrier lockout');
const pausedPlayer=G.player;
const pausedMode=G.mode;
try{
  G.player=reconnect;G.mode='paused';
  G.update(1);
  check(reconnect.barrier.lockoutSeconds===1&&reconnect.progression.defensive.cooldownSeconds===4,
    'pause freezes both the world barrier clock and equipment cooldown');
}finally{
  G.player=pausedPlayer;G.mode=pausedMode;
}
const casters=Array.from({length:4},(_,index)=>{
  const caster=G.makePlayer({shipType:'kite'},'shared_v1');
  caster.x=500;caster.y=500;caster.clientId='caster-'+index;
  caster.progression.defensive={id:'aegis_projector',level:index+1,cooldownSeconds:0};
  return caster;
});
for(const caster of casters){
  E.tryDefend({game:G,player:caster,recipients:casters,participantId:caster.clientId,activationId:'a-'+caster.clientId},{});
}
check(casters.every(caster=>caster.barrier.capacity===40&&caster.barrier.windowSeconds===3),'four casts keep the strongest barrier without stacking capacity or time');
N.ProgressionDefense.tickWorld(casters,3);
for(const caster of casters){
  caster.progression.defensive.cooldownSeconds=0;
  E.tryDefend({game:G,player:caster,recipients:casters},{});
}
check(casters.every(caster=>caster.barrier.capacity===0&&caster.barrier.lockoutSeconds===2),'four casts cannot bypass the shared recipient lockout');
for(const unavailable of [{paused:true},{connected:false}]){
  const state=E.create('kite');
  state.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
  const player={x:500,y:500,shipType:'kite',progression:state};
  check(!E.tryDefend({game:G,player,...unavailable},{}).ok&&state.defensive.cooldownSeconds===0,'unavailable activation does not consume cooldown');
}
const resourcePlayer=G.makePlayer({shipType:'kite'},'shared_v1');
resourcePlayer.x=500;resourcePlayer.y=500;
resourcePlayer.hp=70;resourcePlayer.shield=12;resourcePlayer.resourceRevision=10;
resourcePlayer.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
const identity={runToken:'0123456789abcdef0123456789abcdef',participantId:'resource-player'};
const repaired=N.ProgressionDefense.commitResources(resourcePlayer,identity);
const resourceCast=E.tryDefend({game:G,player:resourcePlayer,participantId:identity.participantId,
  resourceIdentity:()=>identity},{});
const barrierRevision=resourceCast.resourceEvents[0];
check(repaired.event.resourceRevision===11&&barrierRevision.resourceRevision===12&&barrierRevision.hp===70&&
  barrierRevision.shield===12&&barrierRevision.barrier.capacity===25&&barrierRevision.buffs.speed===0,
  'barrier resource revision includes the earlier repair and complete current resources');
const damaged=N.ProgressionDefense.applyDamage(resourcePlayer,40);
check(damaged.ok&&damaged.barrierDamage===25&&damaged.shieldDamage===12&&damaged.healthDamage===3&&
  resourcePlayer.hp===67&&resourcePlayer.invuln===.68&&resourcePlayer.shieldDelay===4.2,
  'accepted damage consumes barrier, shield and then health with hit timers');
check(!N.ProgressionDefense.applyDamage(resourcePlayer,5).ok&&resourcePlayer.hp===67,'invulnerability rejects a second damage event');
const invalidResource=G.makePlayer({shipType:'kite'},'shared_v1');
invalidResource.x=500;invalidResource.y=500;
invalidResource.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
const invalidCast=E.tryDefend({game:G,player:invalidResource,resourceIdentity:()=>({runToken:'bad',participantId:'p'})},{});
check(!invalidCast.ok&&!invalidResource.barrier&&invalidResource.progression.defensive.cooldownSeconds===0,
  'invalid resource identity rejects the whole cast before mutation');
const invalidAlly=G.makePlayer({shipType:'kite'},'shared_v1');
invalidAlly.x=510;invalidAlly.y=500;
const invalidTeamCast=E.tryDefend({game:G,player:invalidResource,recipients:[invalidAlly],
  resourceIdentity:recipient=>recipient===invalidAlly?{runToken:'bad',participantId:'ally'}:identity},{});
check(!invalidTeamCast.ok&&!invalidResource.barrier&&!invalidAlly.barrier&&invalidResource.progression.defensive.cooldownSeconds===0,
  'invalid recipient rejects the whole team cast before any recipient changes');
const missingHandlerState=E.create('kite');
missingHandlerState.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
const vulnerableBullet={x:0,y:0,owner:'enemy',repulsorClearable:true};
const invalidWorld={level:{layout:null,width:100,height:100},enemies:[],enemyBullets:[vulnerableBullet],addRing(){}};
const missingHandler=E.tryDefend({game:invalidWorld,player:{x:0,y:0,shipType:'kite',progression:missingHandlerState}},{});
check(!missingHandler.ok&&!vulnerableBullet.dead&&missingHandlerState.defensive.cooldownSeconds===0,
  'missing damage handler rejects a repulsor before clearing bullets or consuming cooldown');
for(const steps of [1,60,180]){
  const timed={barrier:{capacity:25,windowSeconds:3,lockoutSeconds:2}};
  for(let index=0;index<steps;index++)N.ProgressionDefense.tickWorld([timed],3/steps);
  check(timed.barrier.capacity===0&&timed.barrier.windowSeconds===0&&approx(timed.barrier.lockoutSeconds,2),
    'barrier window expires consistently across '+steps+' simulation steps');
}
const remoteResource=G.makePlayer({shipType:'kite'},'shared_v1');
remoteResource.hp=50;remoteResource.shield=10;
N.ProgressionDefense.restoreBarrier(remoteResource,{capacity:25,windowSeconds:2,lockoutSeconds:2});
const remoteHit=N.ProgressionDefense.damageTransaction(remoteResource,40,identity);
check(remoteHit.ok&&remoteHit.event.hp===45&&remoteHit.event.shield===0&&remoteHit.event.barrier.capacity===0&&
  remoteHit.event.resourceRevision===1,'host damage returns a complete resource revision for a remote participant');
const savedHostFlag=N.Coop.host;
const savedRemotePlayers=N.Coop.remotePlayers;
const savedAuthority=G.progressionAuthority;
const published=[];
remoteResource.clientId='resource-player';remoteResource.invuln=0;
const misdirected=N.ProgressionDefense.damageTransaction(remoteResource,10,{...identity,participantId:'other-player'});
check(!misdirected.ok&&remoteResource.hp===45&&remoteResource.resourceRevision===1,
  'mismatched remote participant identity is rejected before resource mutation');
N.Coop.host=true;N.Coop.remotePlayers=[remoteResource];
G.progressionAuthority={identityFor:()=>identity,publishResource:event=>published.push(event)};
const hostFunction=N.Coop.isHost;
try{
  N.Coop.isHost=()=>true;
  N.Coop.applyRemoteState({x:600,y:600,hp:99,shield:99,maxHp:999,maxShield:999,level:50,dead:true,invuln:9,shipType:'talon'},remoteResource.clientId);
  check(remoteResource.hp===45&&remoteResource.shield===0&&remoteResource.level===1&&!remoteResource.dead&&remoteResource.shipType==='kite'&&remoteResource.tx===600,
    'guest movement updates cannot overwrite host progression or resources');
  N.Coop.applyLoadout({weapons:[],passives:[],stats:{maxHp:999}},remoteResource.clientId);
  check(remoteResource.stats.maxHp===100&&remoteResource.progression.offensive[0].id==='pulse_repeater',
    'legacy guest loadout cannot overwrite shared-mode state');
  check(N.Coop.sendHit(remoteResource,10,500,500,false)&&published.length===1&&published[0].hp===35&&published[0].resourceRevision===2,
    'host remote hit publishes a cumulative resource result through the authority adapter');
  const previousTimerState={active:N.Coop.active,pauseState:N.Coop.pauseState,mode:G.mode,
    stateAt:N.Coop._stateAt,worldAt:N.Coop._worldAt,flushAt:N.Coop._flushAt};
  try{
    N.Coop.active=true;G.mode='playing';N.Coop.pauseState='PLAY';
    N.Coop._stateAt=Infinity;N.Coop._worldAt=Infinity;N.Coop._flushAt=Infinity;
    check(!N.Coop.sendHit(remoteResource,10,500,500,false),'a second remote hit inside immunity is rejected');
    N.Coop.pauseState='PAUSED';N.Coop.preUpdate(1);
    check(approx(remoteResource.invuln,.68),'pause freezes host-owned remote hit immunity');
    N.Coop.pauseState='PLAY';remoteResource.connected=false;N.Coop.preUpdate(1);
    check(approx(remoteResource.invuln,.68),'disconnect freezes host-owned remote hit immunity');
    remoteResource.connected=true;remoteResource.dead=true;N.Coop.preUpdate(1);
    check(approx(remoteResource.invuln,.68),'downed state freezes host-owned remote hit immunity');
    remoteResource.dead=false;
    for(let frame=0;frame<60;frame++)N.Coop.preUpdate(1/120);
    check(approx(remoteResource.invuln,.18)&&!N.Coop.sendHit(remoteResource,10,500,500,false),
      'remote immunity advances by elapsed time and still rejects an early hit');
    for(let frame=0;frame<30;frame++)N.Coop.preUpdate(1/120);
    check(N.Coop.sendHit(remoteResource,10,500,500,false)&&remoteResource.hp===25&&published.at(-1).resourceRevision===3,
      'a later remote hit succeeds after host-owned immunity expires');
    remoteResource.progressionMode='legacy';N.Coop.preUpdate(1);
    check(approx(remoteResource.invuln,.68),'legacy remote immunity remains owned by guest updates');
    remoteResource.progressionMode='shared_v1';
  }finally{
    N.Coop.active=previousTimerState.active;N.Coop.pauseState=previousTimerState.pauseState;G.mode=previousTimerState.mode;
    N.Coop._stateAt=previousTimerState.stateAt;N.Coop._worldAt=previousTimerState.worldAt;N.Coop._flushAt=previousTimerState.flushAt;
  }
  const previousPlayer=G.player;
  const hostPlayer=G.makePlayer({shipType:'kite'},'shared_v1');
  hostPlayer.x=500;hostPlayer.y=500;hostPlayer.hp=80;hostPlayer.shield=10;
  N.ProgressionDefense.restoreBarrier(hostPlayer,{capacity:25,windowSeconds:3,lockoutSeconds:2});
  G.player=hostPlayer;
  try{
    check(G.damagePlayer(40,500,500)&&hostPlayer.hp===75&&hostPlayer.shield===0&&published.at(-1).hp===75&&
      published.at(-1).barrier.capacity===0,'host local hit publishes the same barrier, shield and health order');
    hostPlayer.invuln=0;
    N.ProgressionDefense.restoreBarrier(hostPlayer,{capacity:20,windowSeconds:2,lockoutSeconds:2});
    const previousRecord=N.PlayerStats.record;
    const recorded=[];
    N.PlayerStats.record=key=>recorded.push(key);
    try{
      check(G.damagePlayer(5,500,500)&&hostPlayer.hp===75&&hostPlayer.barrier.capacity===15&&recorded.filter(key=>key==='hitsTaken').length===1,
        'a fully absorbed barrier hit preserves hit statistics');
    }finally{
      N.PlayerStats.record=previousRecord;
    }
    const previousGuest=N.Coop.isGuest;
    N.Coop.isGuest=()=>true;
    hostPlayer.invuln=0;
    N.Coop._applyingRemote=true;
    try{
      check(!G.damagePlayer(10,500,500)&&hostPlayer.hp===75,'shared guest rejects an old remote hit even during legacy dispatch');
    }finally{
      N.Coop._applyingRemote=false;
      N.Coop.isGuest=previousGuest;
    }
  }finally{
    G.player=previousPlayer;
  }
}finally{
  N.Coop.isHost=hostFunction;N.Coop.host=savedHostFlag;N.Coop.remotePlayers=savedRemotePlayers;G.progressionAuthority=savedAuthority;
}
const originalHost=N.Coop.isHost;
const originalGuest=N.Coop.isGuest;
try{
  N.Coop.isHost=()=>true;
  invalidResource.progression.defensive.cooldownSeconds=0;
  check(E.tryDefend({game:G,player:invalidResource},{}).reason==='missing-authority-context'&&!invalidResource.barrier,
    'host activation requires an authority identity and resource adapter');
  N.Coop.isHost=()=>false;
  N.Coop.isGuest=()=>true;
  const before=remoteResource.hp;
  check(!N.ProgressionDefense.damageTransaction(remoteResource,10,identity).ok&&remoteResource.hp===before,
    'a guest cannot commit host resource damage');
}finally{
  N.Coop.isHost=originalHost;
  N.Coop.isGuest=originalGuest;
}
const defenseProjection=N.ProgressionDefense.snapshotVisuals(G,casters);
check(defenseProjection.flashes.length>0&&defenseProjection.flashes.every(effect=>!Object.hasOwn(effect,'damage')),
  'guest visual projection contains draw data without simulation authority');
N.ProgressionDefense.setGuestVisuals(G.level,defenseProjection);
check(N.ProgressionDefense.guestVisuals(G.level)===defenseProjection,'decoded guest visual projection is exposed for rendering');
N.ProgressionDefense.tickEffects(G.level,1);
check(N.ProgressionDefense.snapshotVisuals(G,casters).flashes.length===0,'expired defensive visual effects are released');
defensePlayer.progression.defensive={id:'repulsor_pulse',level:5,cooldownSeconds:0};
const ordinary={x:550,y:500,r:10,role:'rusher',dead:false};
const boss={x:550,y:520,r:10,role:'boss',boss:true,dead:false};
const bullet={x:510,y:500,owner:'enemy',repulsorClearable:true};
const bossBullet={x:510,y:500,owner:'enemy',repulsorClearable:false};
const unknownBullet={x:510,y:500,owner:'enemy'};
const alliedBullet={x:510,y:500,owner:'player',repulsorClearable:true};
G.enemies=[ordinary,boss];
G.enemyBullets=[bullet,bossBullet,unknownBullet,alliedBullet];
const originalDamageEnemy=G.damageEnemy;
const hits=[];
G.damageEnemy=(target,damage)=>hits.push([target,damage]);
try{
  const pulse=E.tryDefend({...context,participantId:'pilot',activationId:'pulse-1'},{});
  check(pulse.ok&&pulse.cleared===1&&bullet.dead&&!bossBullet.dead&&!unknownBullet.dead&&!alliedBullet.dead,'repulsor clears only explicitly eligible hostile bullets');
  check(hits.length===2&&hits.every(([,damage])=>damage===12),'repulsor uses fixed damage on ordinary and boss enemies');
  check(approx(ordinary.x,610)&&boss.x===550&&boss.y===520,'repulsor moves ordinary enemies but not bosses');
  check(approx(defensePlayer.progression.defensive.cooldownSeconds,3.4),'level-five repulsor cooldown is 3.4 seconds');
  check(pulse.event.ownerParticipantId==='pilot'&&pulse.event.activationId==='pulse-1'&&pulse.event.targets.length===2,'repulsor effect reports authoritative attribution and target results');
}finally{
  G.damageEnemy=originalDamageEnemy;
}
const floorDefense=Array(144).fill(true);
for(let row=0;row<12;row++)floorDefense[row*12+7]=false;
G.level.layout={cols:12,rows:12,floor:floorDefense};
defensePlayer.x=640;defensePlayer.y=500;
defensePlayer.progression.defensive.cooldownSeconds=0;
const nearWall=enemy('near-defense-wall',680,500);
const behindWall=enemy('behind-defense-wall',710,500);
const hiddenBullet={id:'hidden',x:710,y:500,owner:'enemy',repulsorClearable:true};
G.enemies=[nearWall,behindWall];G.enemyBullets=[hiddenBullet];
E.tryDefend({game:G,player:defensePlayer},{});
check(nearWall.hp===988&&nearWall.x<=690&&nearWall.x>680,'repulsor push stops at solid geometry');
check(behindWall.hp===1000&&!hiddenBullet.dead,'walls occlude repulsor damage and projectile clearing');
const blockedAlly=G.makePlayer({shipType:'kite'},'shared_v1');
blockedAlly.x=710;blockedAlly.y=500;
const downedAlly=G.makePlayer({shipType:'kite'},'shared_v1');
downedAlly.x=645;downedAlly.y=500;downedAlly.dead=true;
defensePlayer.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
E.tryDefend({game:G,player:defensePlayer,recipients:[blockedAlly,downedAlly]},{});
check(!blockedAlly.barrier&&!downedAlly.barrier,'Aegis excludes occluded and downed allies');
G.level.layout=null;
const edgeEnemy=enemy('edge-enemy',G.level.width-15,500);
defensePlayer.x=G.level.width-50;defensePlayer.y=500;
defensePlayer.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
G.enemies=[edgeEnemy];G.enemyBullets=[];
E.tryDefend({game:G,player:defensePlayer},{});
check(edgeEnemy.x<=G.level.width-edgeEnemy.r&&edgeEnemy.x>G.level.width-15,'repulsor cannot push an enemy beyond the world boundary');
G.enemyBullets=[];
const ordinaryShot=G.enemyFireAt({x:500,y:500,r:10,color:'#fff',role:'warden',boss:false},0,100,1);
const bossShot=G.enemyFireAt({x:500,y:500,r:10,color:'#fff',role:'boss',boss:true},0,100,1);
check(ordinaryShot.repulsorClearable===true&&bossShot.repulsorClearable===false,'enemy firing records boss-origin clearability at spawn');
defensePlayer.x=500;defensePlayer.y=500;
defensePlayer.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
const edgeBullet={id:'edge',x:625,y:500,owner:'enemy',repulsorClearable:true};
const outsideBullet={id:'outside',x:625.1,y:500,owner:'enemy',repulsorClearable:true};
const unclassifiedBullet=G.spawnEnemyBullet({x:510,y:500,angle:0,speed:0,kind:'anchor'});
const anchorBullet=G.spawnEnemyBullet({x:510,y:500,angle:0,speed:0,kind:'anchor',repulsorClearable:true});
const mine={x:510,y:500,owner:'enemy',dead:false};
const alliedProjectile={x:510,y:500,dead:false};
G.enemies=[];G.enemyBullets=[edgeBullet,outsideBullet,unclassifiedBullet,anchorBullet];
G.mines=[mine];G.playerBullets=[alliedProjectile];
E.tryDefend({game:G,player:defensePlayer},{});
check(edgeBullet.dead&&anchorBullet.dead&&!outsideBullet.dead&&!unclassifiedBullet.dead&&!mine.dead&&!alliedProjectile.dead,
  'repulsor clears eligible bullets at the boundary and leaves unclassified or non-bullet hazards intact');
const oldPlayerForAnchors=G.player;
const oldAnchors=G.level.anchors;
try{
  G.player=defensePlayer;
  G.level.anchors=[0,1,2].map(type=>({type,x:550,y:500,r:10,alive:true,hitFlash:0,phase:0,angle:0,attackTimer:0,guardTimer:100}));
  G.enemyBullets=[];
  G.updateAnchors(.01);
  check(G.enemyBullets.length===21&&G.enemyBullets.every(projectile=>projectile.repulsorClearable===true),
    'all three anchor patterns explicitly mark ordinary bullets as clearable');
}finally{
  G.player=oldPlayerForAnchors;G.level.anchors=oldAnchors;
}
G.pauseGame();
window.equipmentResult={passed:passed.length,checks:passed};
})();
