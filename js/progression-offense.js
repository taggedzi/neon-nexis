/* NEON NEXUS — additional offensive weapons */
(function(){
'use strict';
const N=window.NEON;
const C=N.ProgressionContent;
const CONE=Math.PI/4;
const EPSILON=1e-9;
const fieldsByLevel=new WeakMap();
const slowByEnemy=new WeakMap();
const flashesByLevel=new WeakMap();
const guestViews=new WeakMap();
const MAX_FLASHES=64;

function flash(level,effect){
  let flashes=flashesByLevel.get(level);
  if(!flashes){
    flashes=[];
    flashesByLevel.set(level,flashes);
  }
  if(flashes.length===MAX_FLASHES)flashes.shift();
  flashes.push(effect);
}

function visible(game,x,y,target){
  return !N.World.segment(game.level.layout,x,y,target.x,target.y,0);
}

function nearest(game,x,y,range,angle,excluded){
  let best=null;
  let distance=range*range;
  for(const enemy of game.enemies){
    if(enemy.dead||excluded?.has(enemy.id))continue;
    const d=N.dist2(x,y,enemy.x,enemy.y);
    if(d>distance||(d===distance&&best&&enemy.id>=best.id))continue;
    if(angle!==null&&Math.abs(N.angleDelta(angle,Math.atan2(enemy.y-y,enemy.x-x)))>CONE)continue;
    if(!visible(game,x,y,enemy))continue;
    best=enemy;
    distance=d;
  }
  return best;
}

function hit(game,target,effect,damage,crit=false){
  const opts={
    x:effect.x,y:effect.y,player:effect.coopPlayer,shot:effect.tallyShot,
    source:effect.weaponId,ownerParticipantId:effect.ownerParticipantId,
    activationId:effect.activationId,progressionOffense:true,allowPayload:false,
    continuous:effect.weaponId==='plasma_mortar',
    critChance:crit?C.critChance:0,critMul:C.critMul
  };
  if(target.role!==undefined)game.damageEnemy(target,damage,opts);
  else if(game.level.anchors.includes(target))game.damageAnchor(target,damage,opts);
  else game.damageCache(target,damage,opts);
}

function fire(game,spawn,definition,shot){
  const id=definition.id;
  shot.weaponId=id;
  if(id==='arc_projector'){
    N.PlayerStats?.emit(shot);
    const points=[[shot.x,shot.y]];
    const excluded=new Set();
    let {x,y}=shot;
    for(const [index,base] of definition.chainDamage.entries()){
      const enemy=nearest(game,x,y,index?definition.chainRange:definition.targetRange,index?null:shot.angle,excluded);
      if(!enemy)break;
      excluded.add(enemy.id);
      hit(game,enemy,{...shot,x,y},shot.damage*base/definition.baseDamage,true);
      ({x,y}=enemy);
      points.push([x,y]);
    }
    if(points.length>1){
      game.addBolt(points,definition.color,.16,2);
      flash(game.level,{points,color:definition.color,life:.16});
    }
    N.Audio.glitch();
    return 0;
  }
  const seeker=id==='seeker_missiles';
  const count=seeker?2:1;
  const target=seeker?nearest(game,shot.x,shot.y,definition.targetRange,shot.angle):null;
  for(let i=0;i<count;i++){
    let {x,y}=shot;
    if(seeker){
      const offset=i===0?-5:5;
      const launchX=x-Math.sin(shot.angle)*offset;
      const launchY=y+Math.cos(shot.angle)*offset;
      if(!N.World.segment(game.level.layout,x,y,launchX,launchY,3)){
        x=launchX;
        y=launchY;
      }
    }
    spawn.call(game,{
      ...shot,x,y,target,activationAim:shot.angle,
      progressionPrimary:seeker,progressionOffense:true,
      kind:seeker?'seeker':'mortar',color:definition.color,size:seeker?3:5,
      speed:definition.speed,life:definition.lifeSeconds??definition.range/definition.speed,
      critChance:seeker?C.critChance:0,critMul:C.critMul
    });
  }
  N.Audio.weapon(seeker?'seeker':'mortar',game.panOf(shot.x));
  return count;
}

function steer(game,bullet,dt){
  const definition=C.additional(bullet.weaponId);
  const range=definition.targetRange;
  const target=bullet.target;
  if(!target||target.dead||N.dist2(bullet.x,bullet.y,target.x,target.y)>range*range||!visible(game,bullet.x,bullet.y,target)){
    bullet.target=nearest(game,bullet.x,bullet.y,range,bullet.activationAim);
  }
  if(!bullet.target)return;
  const desired=Math.atan2(bullet.target.y-bullet.y,bullet.target.x-bullet.x);
  const turn=definition.turnRate*Math.min(dt,bullet.life);
  bullet.angle+=N.clamp(N.angleDelta(bullet.angle,desired),-turn,turn);
  bullet.vx=Math.cos(bullet.angle)*bullet.speed;
  bullet.vy=Math.sin(bullet.angle)*bullet.speed;
}

function targets(game){
  return [...game.enemies.filter(enemy=>!enemy.dead),
    ...game.level.anchors.filter(anchor=>anchor.alive),
    ...game.level.caches.filter(cache=>cache.alive)];
}

function within(game,effect,target){
  return N.dist2(effect.x,effect.y,target.x,target.y)<=(effect.radius+target.r)**2
    &&visible(game,effect.x,effect.y,target);
}

function capturePositions(game){
  if(!activeFields(game.level).length&&!game.playerBullets.some(b=>!b.dead&&b.progressionOffense&&!b.progressionPrimary)){
    return null;
  }
  return new Map(game.enemies.map(enemy=>[enemy,{
    x:enemy.x,y:enemy.y,slowUntil:slowByEnemy.get(enemy)||0
  }]));
}

function fieldInterval(game,field,target,dt,previous){
  let start=field.startDelay;
  let end=Math.min(dt,start+field.life);
  const dx=target.x-(previous?.x??target.x);
  const dy=target.y-(previous?.y??target.y);
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared===0)return end>start&&within(game,field,target)?{field,start,end}:null;

  const x=previous.x-field.x;
  const y=previous.y-field.y;
  const approach=x*dx+y*dy;
  const distance=x*x+y*y-(field.radius+target.r)**2;
  const discriminant=approach*approach-lengthSquared*distance;
  if(discriminant<=0)return null;
  const halfChord=Math.sqrt(discriminant);
  start=Math.max(start,dt*(-approach-halfChord)/lengthSquared);
  end=Math.min(end,dt*(-approach+halfChord)/lengthSquared);
  if(end<=start)return null;
  // Movement is linear within this step. Check occlusion at the midpoint of
  // the covered segment, after clipping to the field's actual active time.
  const midpoint=(start+end)/(2*dt);
  if(!visible(game,field.x,field.y,{x:previous.x+dx*midpoint,y:previous.y+dy*midpoint}))return null;
  return {field,start,end};
}

function advanceCharge(game,bullet,dt,bombs){
  const elapsed=Math.min(dt,bullet.life);
  const dx=bullet.vx*elapsed;
  const dy=bullet.vy*elapsed;
  const wall=N.World.segment(game.level.layout,bullet.x,bullet.y,bullet.x+dx,bullet.y+dy,bullet.size);
  const travel=wall?.t??1;
  const reachable=wall?Math.max(0,travel-1e-6):travel;
  bullet.x+=dx*reachable;
  bullet.y+=dy*reachable;
  bullet.life-=elapsed;
  if(!wall&&bullet.life>EPSILON)return;
  bullet.dead=true;
  const definition=C.additional(bullet.weaponId);
  const effect={...bullet,radius:definition.radius};
  game.addRing(effect.x,effect.y,effect.radius,effect.color,.35,1.7);
  flash(game.level,{
    x:effect.x,y:effect.y,radius:effect.radius,color:effect.color,
    life:.35,startDelay:elapsed*travel
  });
  N.Audio.noiseBurst(.12,.08,650);
  if(definition.fieldSeconds){
    let fields=fieldsByLevel.get(game.level);
    if(!fields){
      fields=[];
      fieldsByLevel.set(game.level,fields);
    }
    fields.push({...effect,life:definition.fieldSeconds,startDelay:elapsed*travel});
    return;
  }
  bombs.push({effect,at:elapsed*travel,definition});
}

function resolveBombs(game,bombs,dt,previousPositions){
  if(!bombs.length)return;
  const paths=new Map(previousPositions);
  bombs.sort((a,b)=>a.at-b.at);
  for(const {effect,at,definition} of bombs){
    for(const target of targets(game)){
      const previous=paths.get(target);
      const start=previous?.at??0;
      const slowUntil=previous?.slowUntil??0;
      const moveTime=end=>end-start-Math.max(0,Math.min(end,slowUntil)-start)*definition.slow;
      const fraction=dt>start?N.clamp(moveTime(at)/moveTime(dt),0,1):1;
      const x=previous?N.lerp(previous.x,target.x,fraction):target.x;
      const y=previous?N.lerp(previous.y,target.y,fraction):target.y;
      if(!within(game,effect,{x,y,r:target.r}))continue;
      hit(game,target,effect,effect.damage);
      if(target.role!==undefined&&!target.dead&&!target.boss&&target.role!=='boss'){
        const remaining=dt-at;
        const oldSlow=slowByEnemy.get(target)||0;
        const covered=oldSlow>0?remaining:Math.min(remaining,Math.max(0,slowUntil-at));
        const newlySlowed=Math.max(0,Math.min(remaining,definition.slowSeconds)-covered);
        if(previous&&remaining>0&&newlySlowed>0){
          const effectiveTail=remaining-covered*definition.slow;
          const scale=1-newlySlowed*definition.slow/effectiveTail;
          target.x=x+(target.x-x)*scale;
          target.y=y+(target.y-y)*scale;
          target.worldX=target.x;
          target.worldY=target.y;
          paths.set(target,{x,y,at,slowUntil:Math.max(slowUntil,at+definition.slowSeconds)});
        }
        slowByEnemy.set(target,Math.max(oldSlow,definition.slowSeconds-remaining));
      }
    }
  }
}

function updateFields(game,dt,previousPositions){
  const flashes=flashesByLevel.get(game.level);
  if(flashes){
    for(let i=flashes.length-1;i>=0;i--){
      flashes[i].life-=dt-(flashes[i].startDelay??0);
      flashes[i].startDelay=0;
      if(flashes[i].life<=0)flashes.splice(i,1);
    }
  }
  const fields=fieldsByLevel.get(game.level);
  if(!fields?.length)return;
  for(const target of targets(game)){
    const owners=new Map();
    for(const field of fields){
      const interval=fieldInterval(game,field,target,dt,previousPositions?.get(target));
      if(!interval)continue;
      const owner=field.ownerParticipantId??field.coopPlayer;
      if(!owners.has(owner))owners.set(owner,[]);
      owners.get(owner).push(interval);
    }
    const edges=[...new Set([...owners.values()].flatMap(intervals=>intervals.flatMap(({start,end})=>[start,end])))].sort((a,b)=>a-b);
    for(let i=1;i<edges.length;i++){
      const start=edges[i-1];
      const end=edges[i];
      const active=[];
      for(const intervals of owners.values()){
        let strongest=null;
        for(const interval of intervals){
          if(interval.start<=start&&interval.end>=end&&(!strongest||interval.field.damage>strongest.damage)){
            strongest=interval.field;
          }
        }
        if(strongest)active.push(strongest);
      }
      if(!active.length)continue;
      // Concurrent contributors share time up to the kill. The strongest
      // contributor takes the final hit, with participant ID breaking ties.
      active.sort((a,b)=>a.damage-b.damage||
        String(b.ownerParticipantId??'').localeCompare(String(a.ownerParticipantId??'')));
      const total=active.reduce((sum,field)=>sum+field.damage,0);
      const health=target.hp+(target.shield||0);
      const lethal=total*(end-start)>=health;
      const seconds=lethal?health/total:end-start;
      for(let j=0;j<active.length;j++){
        const field=active[j];
        const amount=lethal&&j===active.length-1?target.hp+(target.shield||0):field.damage*seconds;
        hit(game,target,field,amount);
      }
      if(target.dead||target.alive===false)break;
    }
  }
  for(let i=fields.length-1;i>=0;i--){
    const field=fields[i];
    field.life-=Math.max(0,dt-field.startDelay);
    field.startDelay=0;
    if(field.life<=EPSILON)fields.splice(i,1);
  }
}

function movementSeconds(enemy,dt){
  const remaining=slowByEnemy.get(enemy);
  if(!remaining)return dt;
  if(remaining<=dt)slowByEnemy.delete(enemy);
  else slowByEnemy.set(enemy,remaining-dt);
  return dt-Math.min(dt,remaining)*C.additional('gravity_bomb').slow;
}

function activeFields(level){
  return fieldsByLevel.get(level)||[];
}

// Local boundary for the later hazard-sync codec. The snapshot contains only
// draw data, without damage, targets, player objects or simulation authority.
function snapshotVisuals(game){
  return {
    projectiles:game.playerBullets.filter(b=>b.progressionOffense&&!b.dead)
      .map(({x,y,prevX,prevY,angle,size,kind,color,life,maxLife})=>({x,y,prevX,prevY,angle,size,kind,color,life,maxLife})),
    fields:activeFields(game.level).map(({x,y,radius,color,life})=>({x,y,radius,color,life})),
    flashes:(flashesByLevel.get(game.level)||[]).map(({points,x,y,radius,color,life})=>({
      x,y,radius,color,life,
      ...(points&&{points:points.map(point=>[...point])})
    }))
  };
}

// Called with a decoded, validated snapshot by the future transport adapter.
function setGuestVisuals(level,snapshot){
  guestViews.set(level,snapshot);
}

function guestVisuals(level){
  return guestViews.get(level);
}

N.ProgressionOffense=Object.freeze({
  fire,steer,advanceCharge,resolveBombs,updateFields,movementSeconds,activeFields,capturePositions,
  snapshotVisuals,setGuestVisuals,guestVisuals
});
})();
