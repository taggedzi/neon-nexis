/* NEON NEXUS — fixed offensive slots and primary firing (issue 042) */
(function(){
'use strict';
const N=window.NEON;
const C=N.ProgressionContent;

// Only the selected weapon can carry fractional time into a shot, and only
// in the step where it became ready. Waiting or switching forfeits that time.
const cooldownCredit=new WeakMap();
const COOLDOWN_EPSILON=1e-9;

function isFiniteNonNegative(value){
  return Number.isFinite(value)&&value>=0;
}

function validSlot(slot){
  if(slot===null)return true;
  if(!slot||typeof slot!=='object')return false;
  if(typeof slot.id!=='string')return false;
  if(!Number.isInteger(slot.level)||slot.level<1||slot.level>C.maxWeaponLevel)return false;
  return isFiniteNonNegative(slot.cooldownSeconds);
}

function validState(state){
  if(!state||typeof state!=='object')return false;
  if(state.schemaVersion!==C.schemaVersion||state.catalogVersion!==C.catalogVersion)return false;
  if(!Array.isArray(state.offensive)||state.offensive.length!==C.offensiveSlotCount)return false;
  const [primary, first, second]=state.offensive;
  if(!primary||!validSlot(primary)||!C.primary(primary.id))return false;
  for(const slot of [first, second]){
    if(!validSlot(slot)||(slot&&!C.additional(slot.id)))return false;
  }
  if(!validSlot(state.defensive)||(state.defensive&&!C.defense(state.defensive.id)))return false;
  if(first&&second&&first.id===second.id)return false;
  if(!Number.isInteger(state.selectedOffensiveSlot)||state.selectedOffensiveSlot<0||state.selectedOffensiveSlot>=C.offensiveSlotCount)return false;
  if(!isFiniteNonNegative(state.switchDelaySeconds))return false;
  return true;
}

function offensiveSlot(state,slotIndex){
  if(!validState(state))return null;
  if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=C.offensiveSlotCount)return null;
  return state.offensive[slotIndex];
}

function ensureValidSelection(state){
  if(!validState(state))return false;
  if(state.offensive[state.selectedOffensiveSlot])return true;
  select(state,0);
  return true;
}

function create(hullId){
  const primaryId=C.primaryForHull(hullId);
  if(!primaryId)return null;
  return {
    schemaVersion:C.schemaVersion,
    catalogVersion:C.catalogVersion,
    offensive:[
      {id:primaryId,level:1,cooldownSeconds:0},
      null,
      null
    ],
    selectedOffensiveSlot:0,
    switchDelaySeconds:0,
    defensive:null,
    passives:{},
    level:1,
    xp:0,
    nextPassiveIndex:0,
    salvage:0,
    revision:0,
    appliedEventSequence:0
  };
}

function select(state,slotIndex){
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=C.offensiveSlotCount)return {ok:false,reason:'invalid-slot'};
  if(!state.offensive[slotIndex])return {ok:false,reason:'empty-slot'};
  if(state.selectedOffensiveSlot===slotIndex)return {ok:true,changed:false,slotIndex};
  state.selectedOffensiveSlot=slotIndex;
  state.switchDelaySeconds=C.switchDelaySeconds;
  cooldownCredit.delete(state);
  return {ok:true,changed:true,slotIndex};
}

function cycle(state,direction){
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(direction!==-1&&direction!==1)return {ok:false,reason:'invalid-direction'};
  if(!state.offensive[state.selectedOffensiveSlot])return select(state,0);
  for(let offset=1;offset<=C.offensiveSlotCount;offset++){
    const next=(state.selectedOffensiveSlot+offset*direction+C.offensiveSlotCount)%C.offensiveSlotCount;
    if(state.offensive[next])return select(state,next);
  }
}

// Call once per advancing combat step for a live, connected participant.
function tick(state,elapsedSeconds){
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(!isFiniteNonNegative(elapsedSeconds))return {ok:false,reason:'invalid-elapsed'};
  ensureValidSelection(state);
  cooldownCredit.delete(state);
  const selected=state.offensive[state.selectedOffensiveSlot];
  const readyAfter=Math.max(selected.cooldownSeconds,state.switchDelaySeconds);
  if(readyAfter>0&&readyAfter<=elapsedSeconds){
    cooldownCredit.set(state,{slot:selected,seconds:elapsedSeconds-readyAfter});
  }
  for(const slot of state.offensive){
    if(!slot||slot.cooldownSeconds<=0)continue;
    const remaining=slot.cooldownSeconds-elapsedSeconds;
    slot.cooldownSeconds=remaining>COOLDOWN_EPSILON?remaining:0;
  }
  if(state.defensive&&state.defensive.cooldownSeconds>0){
    const defenseRemaining=state.defensive.cooldownSeconds-elapsedSeconds;
    state.defensive.cooldownSeconds=defenseRemaining>COOLDOWN_EPSILON?defenseRemaining:0;
  }
  const remaining=state.switchDelaySeconds-elapsedSeconds;
  state.switchDelaySeconds=remaining>COOLDOWN_EPSILON?remaining:0;
  return {ok:true};
}

function projectileAngles(definition,aimAngle){
  const count=definition.projectiles;
  if(count<=1)return [aimAngle];
  const angles=[];
  for(let i=0;i<count;i++){
    const offset=(i/(count-1)-.5)*definition.spreadRadians;
    angles.push(aimAngle+offset);
  }
  return angles;
}

function tryFire(context,intent){
  context=context||{};
  intent=intent||{};
  const game=context.game||N.Game;
  const player=context.player||game?.player;
  const state=player?.progression;
  if(!player||player.dead||context.paused||context.connected===false||player.connected===false)return {ok:false,reason:'player-unavailable'};
  if(N.Coop?.isGuest())return {ok:false,reason:'not-authoritative'};
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(state.offensive[0].id!==C.primaryForHull(player.shipType))return {ok:false,reason:'wrong-hull-primary'};
  const slotIndex=state.selectedOffensiveSlot;
  const slot=state.offensive[slotIndex];
  if(!slot)return {ok:false,reason:'empty-slot'};
  if(state.switchDelaySeconds>0)return {ok:false,reason:'switch-delay'};
  if(slot.cooldownSeconds>0)return {ok:false,reason:'cooldown'};
  const definition=slotIndex===0?C.primary(slot.id):C.additional(slot.id);
  const aimAngle=Number.isFinite(intent.aimAngle)?intent.aimAngle:
    Number.isFinite(context.aimAngle)?context.aimAngle:game?.aim?.angle;
  if(!Number.isFinite(aimAngle))return {ok:false,reason:'invalid-aim'};
  if(!Number.isFinite(player.x)||!Number.isFinite(player.y))return {ok:false,reason:'invalid-position'};
  const spawn=typeof context.spawnBullet==='function'?context.spawnBullet:game?.spawnBullet;
  if(typeof spawn!=='function')return {ok:false,reason:'no-spawner'};

  const stats=N.ProgressionStats.derive(player.shipType,state);
  if(stats.ok===false)return stats;
  const damage=stats.offensive[slotIndex].damage;
  const buffRate=player.buffs?.overclock>0?1.35:1;
  const intervalSeconds=stats.offensive[slotIndex].cooldownSeconds/buffRate;
  const credit=cooldownCredit.get(state);
  cooldownCredit.delete(state);
  // A step longer than the interval cannot bank a second shot.
  const overshoot=credit?.slot===slot&&credit.seconds<intervalSeconds?credit.seconds:0;
  slot.cooldownSeconds=intervalSeconds-overshoot;
  if(slotIndex!==0){
    const projectiles=N.ProgressionOffense.fire(game,spawn,definition,{
      x:player.x,y:player.y,angle:aimAngle,damage,coopPlayer:player,
      ownerParticipantId:context.participantId||null,
      activationId:context.activationId||null
    });
    return {ok:true,slotIndex,weaponId:definition.id,damage,projectiles,cooldownSeconds:slot.cooldownSeconds};
  }
  const angles=projectileAngles(definition,aimAngle);
  for(const angle of angles){
    spawn.call(game,{
      x:player.x,
      y:player.y,
      angle,
      speed:definition.speed,
      damage,
      size:definition.size,
      life:definition.lifeSeconds,
      color:definition.color,
      kind:definition.kind,
      weaponId:definition.id,
      progressionPrimary:true,
      pierce:definition.maxDistinctTargets-1,
      critChance:C.critChance,
      critMul:C.critMul,
      coopPlayer:player,
      ownerParticipantId:context.participantId||null,
      activationId:context.activationId||null
    });
  }
  if(game?.muzzle){
    game.muzzle(player.x+Math.cos(aimAngle)*definition.offset,player.y+Math.sin(aimAngle)*definition.offset,definition.color,aimAngle,definition.kind==='rail'?8:4);
  }
  if(game?.shake){
    if(definition.kind==='scatter')game.shake(2.2);
    else if(definition.kind==='rail')game.shake(4.5);
  }
  if(N.Audio?.weapon){
    N.Audio.weapon(definition.sound,game?.panOf?game.panOf(player.x):0);
  }
  return {
    ok:true,
    slotIndex,
    weaponId:definition.id,
    damage,
    projectiles:definition.projectiles,
    cooldownSeconds:slot.cooldownSeconds
  };
}

// The caller supplies a fresh press, never a held action. Input belongs to 047.
function tryDefend(context,intent){
  context=context||{};
  intent=intent||{};
  const game=context.game||N.Game;
  const player=context.player||game?.player;
  if(!player||player.dead||context.paused||context.connected===false||player.connected===false)return {ok:false,reason:'player-unavailable'};
  if(N.Coop?.isGuest())return {ok:false,reason:'not-authoritative'};
  const state=player.progression;
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(state.offensive[0].id!==C.primaryForHull(player.shipType))return {ok:false,reason:'wrong-hull-primary'};
  const slot=state.defensive;
  if(!slot)return {ok:false,reason:'empty-slot'};
  if(slot.cooldownSeconds>0)return {ok:false,reason:'cooldown'};
  if(N.Coop?.isHost()&&(typeof context.participantId!=='string'||!context.participantId||
    typeof context.activationId!=='string'||!context.activationId||
    (slot.id==='aegis_projector'&&typeof context.resourceIdentity!=='function'))){
    return {ok:false,reason:'missing-authority-context'};
  }
  if(!Number.isFinite(player.x)||!Number.isFinite(player.y))return {ok:false,reason:'invalid-position'};
  if(!game?.level||!Number.isFinite(game.level.width)||game.level.width<=0||
    !Number.isFinite(game.level.height)||game.level.height<=0||!Array.isArray(game.enemies)||!Array.isArray(game.enemyBullets)||
    typeof game.addRing!=='function'||(slot.id==='repulsor_pulse'&&typeof game.damageEnemy!=='function')||
    (context.recipients!==undefined&&!Array.isArray(context.recipients)))return {ok:false,reason:'invalid-world'};
  const definition=C.defense(slot.id);
  const result=N.ProgressionDefense.activate(game,player,slot,definition,context,intent);
  if(result.ok===false)return result;
  slot.cooldownSeconds=definition.cooldownSeconds-(slot.level-1)*(definition.cooldownPerLevel||0);
  result.event.cooldownSeconds=slot.cooldownSeconds;
  return {ok:true,weaponId:slot.id,cooldownSeconds:slot.cooldownSeconds,...result};
}

N.Equipment=Object.freeze({
  create,
  select,
  cycle,
  tick,
  tryFire,
  tryDefend,
  ensureValidSelection,
  offensiveSlot,
  isValidState:validState
});
})();
