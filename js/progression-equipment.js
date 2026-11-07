/* NEON NEXUS — fixed offensive slots and primary firing (issue 042) */
(function(){
'use strict';
const N=window.NEON;
const C=N.ProgressionContent;

// Cooldown overshoot is transient timing credit. It is deliberately kept out of
// the canonical state so saves/network payloads keep the contract's nonnegative
// cooldown fields. Losing it on a state clone costs at most one frame interval.
const cooldownCredit=new WeakMap();
const COOLDOWN_EPSILON=1e-9;

function creditFor(state){
  let credits=cooldownCredit.get(state);
  if(!credits){
    credits=new Map();
    cooldownCredit.set(state,credits);
  }
  return credits;
}

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
  if(!state.offensive.every(validSlot))return false;
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
  const fallback=state.offensive.findIndex(slot=>slot!==null);
  if(fallback<0)return false;
  state.selectedOffensiveSlot=fallback;
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
  return {ok:true,changed:true,slotIndex};
}

function cycle(state,direction){
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(direction!==-1&&direction!==1)return {ok:false,reason:'invalid-direction'};
  if(!ensureValidSelection(state))return {ok:false,reason:'no-offensive-weapon'};
  const filled=[];
  for(let i=0;i<C.offensiveSlotCount;i++){
    if(state.offensive[i])filled.push(i);
  }
  if(filled.length<=1)return {ok:true,changed:false,slotIndex:state.selectedOffensiveSlot};
  const current=filled.indexOf(state.selectedOffensiveSlot);
  const next=filled[(current+direction+filled.length)%filled.length];
  if(next===state.selectedOffensiveSlot)return {ok:true,changed:false,slotIndex:next};
  state.selectedOffensiveSlot=next;
  state.switchDelaySeconds=C.switchDelaySeconds;
  return {ok:true,changed:true,slotIndex:next};
}

function tick(state,elapsedSeconds){
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(!isFiniteNonNegative(elapsedSeconds))return {ok:false,reason:'invalid-elapsed'};
  ensureValidSelection(state);
  const credits=creditFor(state);
  for(let i=0;i<state.offensive.length;i++){
    const slot=state.offensive[i];
    if(!slot||slot.cooldownSeconds<=0)continue;
    const remaining=slot.cooldownSeconds-elapsedSeconds;
    if(remaining>COOLDOWN_EPSILON){
      slot.cooldownSeconds=remaining;
      continue;
    }
    const overshoot=Math.max(0,Math.min(1,-remaining));
    credits.set(i,Math.min(1,(credits.get(i)||0)+overshoot));
    slot.cooldownSeconds=0;
  }
  state.switchDelaySeconds=Math.max(0,state.switchDelaySeconds-elapsedSeconds);
  return {ok:true};
}

function damageFor(player,slot,definition){
  const levelMultiplier=C.levelDamageMultipliers[slot.level-1]||1;
  const hullMultiplier=N.HULL_STATS[player.shipType]?.damageMul||1;
  // 045 extends this once the derived-stat boundary exists. Hull and level
  // multipliers are applied exactly once; critical damage is rolled on impact.
  return definition.baseDamage*levelMultiplier*hullMultiplier;
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
  const state=context.state||player?.progression;
  if(!player||player.dead)return {ok:false,reason:'player-unavailable'};
  if(!validState(state))return {ok:false,reason:'invalid-state'};
  if(!ensureValidSelection(state))return {ok:false,reason:'no-offensive-weapon'};
  const slotIndex=state.selectedOffensiveSlot;
  const slot=state.offensive[slotIndex];
  if(!slot)return {ok:false,reason:'empty-slot'};
  if(state.switchDelaySeconds>0)return {ok:false,reason:'switch-delay'};
  if(slot.cooldownSeconds>COOLDOWN_EPSILON)return {ok:false,reason:'cooldown'};
  if(slotIndex!==0)return {ok:false,reason:'weapon-not-implemented'};
  const definition=C.primary(slot.id);
  if(!definition)return {ok:false,reason:'unknown-weapon'};
  const aimAngle=Number.isFinite(intent.aimAngle)?intent.aimAngle:
    Number.isFinite(context.aimAngle)?context.aimAngle:game?.aim?.angle;
  if(!Number.isFinite(aimAngle))return {ok:false,reason:'invalid-aim'};
  const spawn=typeof context.spawnBullet==='function'?context.spawnBullet:game?.spawnBullet;
  if(typeof spawn!=='function')return {ok:false,reason:'no-spawner'};

  const damage=damageFor(player,slot,definition);
  const angles=projectileAngles(definition,aimAngle);
  const pierce=Math.max(0,definition.maxDistinctTargets-1);
  try{
    for(const angle of angles){
      spawn.call(game,{
        x:player.x+Math.cos(angle)*definition.offset,
        y:player.y+Math.sin(angle)*definition.offset,
        angle,
        speed:definition.speed,
        damage,
        size:definition.size,
        life:definition.lifeSeconds,
        color:definition.color,
        kind:definition.kind,
        weaponId:definition.id,
        pierce,
        bounce:0,
        chain:0,
        aoe:0,
        critChance:C.critChance,
        critMul:C.critMul,
        hitSet:new Set(),
        coopPlayer:player,
        player,
        ownerParticipantId:context.participantId||null,
        activationId:context.activationId||null
      });
    }
  }catch(error){
    console.error('progression primary fire error',definition.id,error);
    return {ok:false,reason:'spawn-failed'};
  }

  const credits=creditFor(state);
  const credit=credits.get(slotIndex)||0;
  credits.delete(slotIndex);
  slot.cooldownSeconds=Math.max(0,definition.cooldownSeconds-credit);
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

N.Equipment=Object.freeze({
  create,
  select,
  cycle,
  tick,
  tryFire,
  ensureValidSelection,
  offensiveSlot,
  isValidState:validState
});
})();
