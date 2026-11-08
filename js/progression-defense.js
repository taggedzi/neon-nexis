/* NEON NEXUS — authoritative defensive effects (issue 044) */
(function(){
'use strict';
const N=window.NEON;
const flashesByLevel=new WeakMap();
const guestViews=new WeakMap();
const MAX_FLASHES=64;
const TIMER_EPSILON=1e-9;

function visible(game,source,target){
  return !N.World.segment(game.level.layout,source.x,source.y,target.x,target.y,0);
}

function inRange(source,target,radius){
  return N.dist2(source.x,source.y,target.x,target.y)<=radius*radius;
}

// The recipient owns this state. It survives depletion, downing and disconnect;
// the integration layer must retain and tick offline roster records as well.
function tickBarrier(player,seconds){
  const barrier=player.barrier;
  if(!barrier||!Number.isFinite(seconds)||seconds<0)return;
  const elapsed=Math.min(seconds,barrier.windowSeconds);
  const remaining=barrier.windowSeconds-elapsed;
  barrier.windowSeconds=remaining>TIMER_EPSILON?remaining:0;
  if(barrier.windowSeconds===0){
    barrier.capacity=0;
    const lockout=barrier.lockoutSeconds-(seconds-elapsed);
    barrier.lockoutSeconds=lockout>TIMER_EPSILON?lockout:0;
  }
}

// A retained offline record is advanced by the host's world clock too. Callers
// must provide each participant once, whether connected or retained offline.
function tickWorld(participants,seconds){
  if(!Array.isArray(participants)||!Number.isFinite(seconds)||seconds<0)return {ok:false,reason:'invalid-tick'};
  for(const player of new Set(participants)){
    if(player)tickBarrier(player,seconds);
  }
  return {ok:true};
}

function snapshotBarrier(player){
  const barrier=player.barrier;
  return barrier?{capacity:barrier.capacity,windowSeconds:barrier.windowSeconds,lockoutSeconds:barrier.lockoutSeconds}:
    {capacity:0,windowSeconds:0,lockoutSeconds:0};
}

// 048 validates the complete recovery envelope. This smaller boundary ensures
// a damaged barrier record cannot partly replace an existing live window.
function restoreBarrier(player,snapshot){
  if(!player||!snapshot||typeof snapshot!=='object')return {ok:false,reason:'invalid-barrier'};
  const {capacity,windowSeconds,lockoutSeconds}=snapshot;
  if(!Number.isFinite(capacity)||capacity<0||capacity>45||
    !Number.isFinite(windowSeconds)||windowSeconds<0||windowSeconds>3||
    !Number.isFinite(lockoutSeconds)||lockoutSeconds<0||lockoutSeconds>2||
    (windowSeconds===0&&capacity!==0)||(windowSeconds>0&&lockoutSeconds!==2)){
    return {ok:false,reason:'invalid-barrier'};
  }
  player.barrier={capacity,windowSeconds,lockoutSeconds};
  return {ok:true};
}

function applyBarrier(player,capacity,definition){
  let barrier=player.barrier;
  if(!barrier){
    barrier=player.barrier={capacity:0,windowSeconds:0,lockoutSeconds:0};
  }
  if(barrier.windowSeconds>0){
    barrier.capacity=Math.max(barrier.capacity,capacity);
    return true;
  }
  if(barrier.lockoutSeconds>0)return false;
  barrier.capacity=capacity;
  barrier.windowSeconds=definition.windowSeconds;
  barrier.lockoutSeconds=definition.lockoutSeconds;
  return true;
}

function absorb(player,damage){
  if(!Number.isFinite(damage)||damage<0)return damage;
  const barrier=player.barrier;
  if(!barrier||barrier.windowSeconds<=0||barrier.capacity<=0)return damage;
  const amount=Math.min(barrier.capacity,damage);
  barrier.capacity-=amount;
  return damage-amount;
}

// The host calls this after any resource transaction, including transactions
// owned by 046. The wire adapter must validate and order the complete result.
function prepareResource(player,identity){
  const revision=player?.resourceRevision??0;
  const sequence=player?.progression?.appliedEventSequence;
  const buffs=player?.buffs;
  if(!player||!identity||typeof identity.runToken!=='string'||!/^[0-9a-f]{32}$/.test(identity.runToken)||
    typeof identity.participantId!=='string'||identity.participantId.length===0||
    (player.clientId&&player.clientId!==identity.participantId)||
    !Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER||
    !Number.isSafeInteger(sequence)||sequence<0||!buffs||
    ![player.hp,player.shield,player.invuln,player.shieldDelay,buffs.overclock,buffs.speed,buffs.magnet]
      .every(value=>Number.isFinite(value)&&value>=0))return {ok:false,reason:'invalid-resource-state'};
  const barrier=snapshotBarrier(player);
  // Validate without mutating the participant or silently clamping a timer.
  if(!restoreBarrier({},barrier).ok)return {ok:false,reason:'invalid-resource-state'};
  return {ok:true,event:{
    type:'resource',runToken:identity.runToken,participantId:identity.participantId,
    resourceRevision:revision+1,progressionSequence:sequence,
    hp:player.hp,shield:player.shield,dead:!!player.dead,
    buffs:{overclock:buffs.overclock,speed:buffs.speed,magnet:buffs.magnet},
    invuln:player.invuln,shieldDelay:player.shieldDelay,barrier
  }};
}

function commitResources(player,identity){
  const result=prepareResource(player,identity);
  if(result.ok)player.resourceRevision=result.event.resourceRevision;
  return result;
}

function snapshotVisuals(game,players){
  return {
    flashes:(flashesByLevel.get(game.level)||[]).map(effect=>({...effect})),
    barriers:players.filter(player=>player&&!player.dead&&player.barrier?.windowSeconds>0&&player.barrier.capacity>0)
      .map(player=>({x:player.x,y:player.y,radius:player.radius+22}))
  };
}

function tickEffects(level,seconds){
  const effects=flashesByLevel.get(level);
  if(!effects)return;
  for(let index=effects.length-1;index>=0;index--){
    const effect=effects[index];
    effect.life-=seconds;
    effect.radius+=(effect.maxRadius-effect.radius)*Math.min(1,seconds*8);
    if(effect.life<=0)effects.splice(index,1);
  }
}

// The future codec validates this draw-only projection before delivering it.
function setGuestVisuals(level,snapshot){guestViews.set(level,snapshot);}
function guestVisuals(level){return guestViews.get(level);}

// Damage-taken multiplier is supplied by the derived stats owner (045).
// Defense is consumed before shield and health, once per accepted hit.
function applyDamage(player,amount){
  if(!player||player.dead||player.invuln>0)return {ok:false,reason:'player-unavailable'};
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(player.invuln)||player.invuln<0||
    !Number.isFinite(player.stats?.damageTakenMul)||player.stats.damageTakenMul<0||
    !Number.isFinite(player.stats.shieldDelay)||player.stats.shieldDelay<0||
    !Number.isFinite(player.hp)||player.hp<0||!Number.isFinite(player.shield)||player.shield<0||
    !Number.isFinite(amount*player.stats.damageTakenMul))return {ok:false,reason:'invalid-damage'};
  if(!restoreBarrier({},snapshotBarrier(player)).ok)return {ok:false,reason:'invalid-barrier'};
  let remaining=Math.max(1,amount*player.stats.damageTakenMul);
  player.invuln=.68;
  player.hitFlash=1;
  player.shieldDelay=player.stats.shieldDelay;
  const beforeBarrier=remaining;
  remaining=absorb(player,remaining);
  const barrierDamage=beforeBarrier-remaining;
  const shieldDamage=Math.min(player.shield,remaining);
  player.shield-=shieldDamage;
  remaining-=shieldDamage;
  const healthDamage=Math.min(player.hp,remaining);
  player.hp-=healthDamage;
  return {ok:true,barrierDamage,shieldDamage,healthDamage,lethal:player.hp<=0};
}

// For a host-owned remote participant. 048 transports the returned cumulative
// revision; never send the legacy hit packet for this transaction as well.
function damageTransaction(player,amount,identity){
  if(N.Coop?.isGuest())return {ok:false,reason:'not-authoritative'};
  const ready=prepareResource(player,identity);
  if(!ready.ok)return ready;
  const damage=applyDamage(player,amount);
  if(!damage.ok)return damage;
  if(damage.lethal)player.dead=true;
  return {...damage,event:commitResources(player,identity).event};
}

function repulse(game,player,definition,context){
  const clearedIds=[];
  const targets=[];
  for(const bullet of game.enemyBullets){
    if(bullet.dead||bullet.owner!=='enemy'||bullet.repulsorClearable!==true||!inRange(player,bullet,definition.radius)||!visible(game,player,bullet))continue;
    bullet.dead=true;
    clearedIds.push(bullet.id??null);
  }
  for(const enemy of game.enemies){
    if(enemy.dead||!inRange(player,enemy,definition.radius)||!visible(game,player,enemy))continue;
    game.damageEnemy(enemy,definition.damage,{
      x:player.x,y:player.y,player,source:definition.id,progressionOffense:true,
      ownerParticipantId:context.participantId||null,activationId:context.activationId||null,allowPayload:false
    });
    if(!enemy.dead&&!enemy.boss&&enemy.role!=='boss'){
      const angle=Math.atan2(enemy.y-player.y,enemy.x-player.x);
      const targetX=N.clamp(enemy.x+Math.cos(angle)*definition.pushDistance,enemy.r,game.level.width-enemy.r);
      const targetY=N.clamp(enemy.y+Math.sin(angle)*definition.pushDistance,enemy.r,game.level.height-enemy.r);
      const dx=targetX-enemy.x;
      const dy=targetY-enemy.y;
      const wall=N.World.segment(game.level.layout,enemy.x,enemy.y,enemy.x+dx,enemy.y+dy,enemy.r);
      const fraction=wall?Math.max(0,wall.t-1e-6):1;
      enemy.x+=dx*fraction;
      enemy.y+=dy*fraction;
      enemy.worldX=enemy.x;
      enemy.worldY=enemy.y;
    }
    targets.push({id:enemy.id??null,x:enemy.x,y:enemy.y,hp:enemy.hp??0,shield:enemy.shield??0,dead:!!enemy.dead});
  }
  return {cleared:clearedIds.length,hit:targets.length,clearedIds,targets};
}

function activate(game,player,slot,definition,context){
  let result;
  if(slot.id==='repulsor_pulse'){
    result=repulse(game,player,definition,context);
  }else{
    const capacity=definition.capacity+(slot.level-1)*definition.capacityPerLevel;
    const players=[player,...(context.recipients||[])];
    const eligible=[...new Set(players)].filter(recipient=>recipient&&!recipient.dead&&recipient.connected!==false&&
      inRange(player,recipient,definition.radius)&&visible(game,player,recipient)&&
      (!recipient.barrier||recipient.barrier.windowSeconds>0||recipient.barrier.lockoutSeconds===0));
    // When an authority adapter is supplied, preflight every recipient before
    // changing any barrier. A malformed identity cannot yield a partial cast.
    const identities=new Map();
    const participantIds=new Set();
    let runToken=null;
    if(context.resourceIdentity!==undefined){
      if(typeof context.resourceIdentity!=='function')return {ok:false,reason:'invalid-resource-state'};
      for(const recipient of eligible){
        const identity=context.resourceIdentity(recipient);
        if(!prepareResource(recipient,identity).ok||participantIds.has(identity.participantId)||
          (runToken!==null&&runToken!==identity.runToken)||
          (recipient.clientId&&recipient.clientId!==identity.participantId)||
          (recipient===player&&context.participantId&&context.participantId!==identity.participantId)){
          return {ok:false,reason:'invalid-resource-state'};
        }
        runToken=identity.runToken;
        participantIds.add(identity.participantId);
        identities.set(recipient,identity);
      }
    }
    const recipients=[];
    const resourceEvents=[];
    for(const recipient of eligible){
      if(applyBarrier(recipient,capacity,definition)){
        recipients.push(recipient===player?(context.participantId??recipient.clientId??null):(recipient.clientId??null));
        if(identities.has(recipient))resourceEvents.push(commitResources(recipient,identities.get(recipient)).event);
      }
    }
    result={recipients:recipients.length,recipientIds:recipients,resourceEvents};
  }
  game.addRing(player.x,player.y,definition.radius,definition.color,.35,2);
  let flashes=flashesByLevel.get(game.level);
  if(!flashes){
    flashes=[];
    flashesByLevel.set(game.level,flashes);
  }
  if(flashes.length===MAX_FLASHES)flashes.shift();
  flashes.push({x:player.x,y:player.y,radius:2,maxRadius:definition.radius,color:definition.color,life:.35});
  // Effect events describe the resolved visual/world result, not a resource
  // transaction. Resource updates require the complete revisions in 041.
  const event={
    type:'defense',weaponId:slot.id,ownerParticipantId:context.participantId??null,
    activationId:context.activationId??null,x:player.x,y:player.y,radius:definition.radius,
    ...result
  };
  return {...result,event};
}

N.ProgressionDefense=Object.freeze({
  activate,tickBarrier,tickWorld,snapshotBarrier,restoreBarrier,absorb,applyDamage,damageTransaction,commitResources,
  canCommitResources:(player,identity)=>prepareResource(player,identity).ok,
  snapshotVisuals,tickEffects,setGuestVisuals,guestVisuals
});
})();
