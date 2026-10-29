/* NEON NEXUS — simulation: projectiles, player, combat, waves, progression */
(function(){
'use strict';
const N=window.NEON;
const G=N.Game;
const TAU=N.TAU;
const clamp=N.clamp;
const DURATION=G.DURATION;
const MAX_PLAYER_BULLETS=620;
const MAX_ENEMY_BULLETS=850;
const MAX_PARTICLES=650;
let uidCounter=0;
const uid=p=>p+(++uidCounter);
const panOf=G.panOf;
const angleTo=G.angleTo;

G.setEntityArrays = function(){ /* retained for UI/debug */ };

G.spawnBullet=function(o){
  const b=Object.assign({
    id:uid('pb_'),x:0,y:0,vx:0,vy:0,angle:0,speed:0,damage:0,size:2,life:1,maxLife:1,
    color:'#00f0ff',kind:'pulse',pierce:0,bounce:0,chain:0,aoe:0,curve:0,homing:false,
    turnRate:0,accel:0,trail:false,dot:false,tick:0,tickTimer:0,pull:0,explode:false,
    weaponId:null,hitSet:null,critChance:0,critMul:1.75,owner:'player',prevX:0,prevY:0,dead:false
  },o);
  b.hitSet=b.hitSet||new Set();
  b.maxLife=b.life;
  b.vx=Math.cos(b.angle)*b.speed;
  b.vy=Math.sin(b.angle)*b.speed;
  b.prevX=b.x;b.prevY=b.y;
  b.tickTimer=b.tick||0;
  if(G.playerBullets.length>=MAX_PLAYER_BULLETS) G.playerBullets.shift();
  G.playerBullets.push(b);
  return b;
};
G.spawnEnemyBullet=function(o){
  const b=Object.assign({
    id:uid('eb_'),x:0,y:0,vx:0,vy:0,angle:0,speed:0,damage:0,size:3,life:4.4,maxLife:4.4,
    color:'#ff335c',kind:'hostile',curve:0,homing:false,turnRate:0,accel:0,owner:'enemy',
    prevX:0,prevY:0,dead:false,spin:0
  },o);
  b.maxLife=b.life;
  b.vx=Math.cos(b.angle)*b.speed;
  b.vy=Math.sin(b.angle)*b.speed;
  b.prevX=b.x;b.prevY=b.y;
  if(G.enemyBullets.length>=MAX_ENEMY_BULLETS) G.enemyBullets.splice(0,30);
  G.enemyBullets.push(b);
  return b;
};
G.spawnMine=function(o){
  const m=Object.assign({
    id:uid('mine_'),x:0,y:0,owner:'player',damage:20,radius:70,color:'#ff335c',
    life:9,maxLife:9,armTime:.45,armed:false,dead:false,spin:0
  },o);
  G.mines.push(m);
  G.addRing(m.x,m.y,m.radius*.7,m.color,.35,1);
  return m;
};
G.spawnOrbital=function(o){
  const count=o.count||2;
  const base=G.time*1.7;
  for(let i=0;i<count;i++){
    if(G.orbitals.length>=16) G.orbitals.shift();
    G.orbitals.push({
      id:uid('orb_'),angle:base+i/count*TAU,radius:o.radius||58,spin:o.spin||2.8,
      damage:o.damage||10,color:o.color||'#b6ff2b',life:o.life||6,maxLife:o.life||6,
      hits:Object.create(null),dead:false,weaponId:o.weaponId
    });
  }
};
G.spawnStrike=function(o){
  G.strikes.push({
    id:uid('strike_'),x:o.x,y:o.y,delay:o.delay||.6,maxDelay:o.delay||.6,
    radius:o.radius||70,damage:o.damage||25,color:o.color||'#ffb31f',dead:false
  });
  G.addRing(o.x,o.y,o.radius||70,o.color||'#ffb31f',.5,.8);
};
G.addText=G.addText;
G.addParticles=G.addParticles;

// ——— player ———
G.fireWeapon=function(w){
  if(!w) return;
  const p=G.player, def=N.WEAPON_BY_ID[w.id];
  if(!def) return;
  const rate=(p.stats.rateMul||1)*(1+(w.level-1)*.06)*(p.buffs.overclock>0?1.35:1);
  w.cooldown=Math.max(.035,(def.base.cooldown||.5)/Math.max(.2,rate));
  try{def.fire(G,w,G.aim.angle);}catch(e){console.error('weapon fire error',w.id,e);}
  N.Audio.weapon(def.sound||'pulse',panOf(p.x));
  G.addParticles(p.x+Math.cos(G.aim.angle)*20,p.y+Math.sin(G.aim.angle)*20,def.color,2,{angle:G.aim.angle,spread:.7,speed:80,life:.2,size:1.4});
};
G.updatePlayer=function(dt){
  const p=G.player;if(!p||p.dead)return;
  const inp=N.Input;
  const mouse=inp.getMouse();
  let aim=inp.getAim(p,G.screenToWorld(mouse.x,mouse.y));
  G.aim=aim;
  G.aimAngle=aim.angle;
  if(!aim.point) aim.point={x:p.x+Math.cos(aim.angle)*280,y:p.y+Math.sin(aim.angle)*280};
  G.aimPoint=aim.point;
  p.aim=N.lerpAngle(p.aim,aim.angle,1-Math.exp(-dt*18));
  // timers
  p.invuln=Math.max(0,p.invuln-dt);
  p.hitFlash=Math.max(0,p.hitFlash-dt*3.8);
  p.shieldRegenFx=Math.max(0,(p.shieldRegenFx||0)-dt*2);
  p.dashTime=Math.max(0,p.dashTime-dt);
  for(const k in p.buffs){if(p.buffs[k]>0)p.buffs[k]=Math.max(0,p.buffs[k]-dt);}
  for(const w of p.weapons){if(w.cooldown>0)w.cooldown=Math.max(0,w.cooldown-dt);}
  if(p.shieldDelay>0)p.shieldDelay=Math.max(0,p.shieldDelay-dt);
  if(p.hp<p.stats.maxHp)p.hp=Math.min(p.stats.maxHp,p.hp+p.stats.regen*dt);
  if(p.stats.maxShield>0 && p.shieldDelay<=0 && p.shield<p.stats.maxShield){
    p.shield=Math.min(p.stats.maxShield,p.shield+(12*p.stats.shieldRegenMul)*dt);
    p.shieldRegenFx=Math.max(p.shieldRegenFx,.3);
  }
  if(p.dashCharges<p.maxDashCharges){
    if(p.dashTimer<=0)p.dashTimer=p.stats.dashRecharge;
    p.dashTimer-=dt;
    if(p.dashTimer<=0){
      p.dashCharges=Math.min(p.maxDashCharges,p.dashCharges+1);
      p.dashTimer=p.dashCharges>=p.maxDashCharges?0:p.stats.dashRecharge;
    }
  }
  const move=inp.getMove();
  const dashPressed=inp.actionPressed('dash')||inp.padActionPressed('dash');
  if(dashPressed && p.dashCharges>0 && p.dashTime<=0){
    const dir=move.len>.12?Math.atan2(move.y,move.x):aim.angle;
    p.dashCharges--;
    if(p.dashCharges===p.maxDashCharges-1)p.dashTimer=p.stats.dashRecharge;
    p.dashTime=.17;p.dashDir=dir;
    p.invuln=Math.max(p.invuln,.34);
    p.vx=Math.cos(dir)*980;p.vy=Math.sin(dir)*980;
    G.addParticles(p.x,p.y,p.stats.maxShield>0?'#00f0ff':'#b6ff2b',16,{angle:dir,spread:2.4,speed:240,life:.55,size:2.2,glow:true});
    G.addRing(p.x,p.y,42,'#00f0ff',.35,1.6);
    G.triggerGlitch(.28,'#00f0ff');G.screenFlash('pickup');G.shake(2.5);
    N.Audio.dash();
  }
  if(p.dashTime>0){
    p.vx=Math.cos(p.dashDir)*980;p.vy=Math.sin(p.dashDir)*980;
    p.trailTimer-=dt;
    if(p.trailTimer<=0){
      p.trailTimer=.035;
      G.effects.push({type:'afterimage',x:p.x,y:p.y,angle:p.aim,color:'#00f0ff',life:.28,maxLife:.28,size:p.radius});
    }
  }else{
    const targetSpeed=p.stats.moveSpeed*(p.buffs.speed>0?1.42:1);
    const tx=move.x*targetSpeed,ty=move.y*targetSpeed;
    const accel=Math.min(1,dt*12);
    p.vx+=(tx-p.vx)*accel;p.vy+=(ty-p.vy)*accel;
    if(move.len>.05){
      p.trailTimer-=dt;
      if(p.trailTimer<=0){p.trailTimer=.06;G.effects.push({type:'afterimage',x:p.x,y:p.y,angle:p.aim,color:'#087f91',life:.22,maxLife:.22,size:p.radius*.9});}
    }
  }
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  p.x=clamp(p.x,20,G.level.width-20);p.y=clamp(p.y,20,G.level.height-20);
  G.updateCamera(dt);
  // Aim through the camera used to draw this frame, including its shake offset.
  aim=inp.getAim(p,G.screenToWorld(mouse.x,mouse.y));
  G.aim=aim;G.aimAngle=aim.angle;G.aimPoint=aim.point;
  const sw=inp.getWeaponSwitch();
  if(sw&&p.weapons.length>1){
    p.activeWeapon=(p.activeWeapon+(sw>0?1:-1)+p.weapons.length)%p.weapons.length;
    N.Audio.ui('click');
    G.notify('WEAPON BAY '+(p.activeWeapon+1)+' // '+(N.WEAPON_BY_ID[p.weapons[p.activeWeapon].id]?.name||'—'),'info',1100);
  }
  const active=p.weapons[p.activeWeapon];
  if(active&&aim.fire&&active.cooldown<=0)G.fireWeapon(active);
};

// ——— bullet collisions / abilities ———
function nearestTarget(x,y,maxDist,excludeSet){
  let best=null,bd=maxDist*maxDist;
  for(const e of G.enemies){
    if(e.dead)continue;
    if(excludeSet&&excludeSet.has(e.id))continue;
    const d=N.dist2(x,y,e.x,e.y);
    if(d<bd){bd=d;best=e;}
  }
  if(!best){
    for(const a of G.level.anchors){
      if(!a.alive)continue;
      if(excludeSet&&excludeSet.has(a.id))continue;
      const d=N.dist2(x,y,a.x,a.y);
      if(d<bd){bd=d;best=a;}
    }
  }
  if(!best){
    for(const c of G.level.caches){
      if(!c.alive)continue;
      if(excludeSet&&excludeSet.has(c.id))continue;
      const d=N.dist2(x,y,c.x,c.y);
      if(d<bd){bd=d;best=c;}
    }
  }
  return best;
}
G.nearestTarget=nearestTarget;
function reflectBullet(b,nx,ny){
  const dot=b.vx*nx+b.vy*ny;
  b.vx-=2*dot*nx;b.vy-=2*dot*ny;
  b.angle=Math.atan2(b.vy,b.vx);
}
function targetRadius(t){return t.r||20;}
function targetIsEnemy(t){return t && (t.role!==undefined);}
function damageTarget(t,dmg,opts){
  if(!t)return;
  if(t.role!==undefined)G.damageEnemy(t,dmg,opts);
  else if(t.maxHp!==undefined&&t.type!==undefined&&t.loot)G.damageCache(t,dmg,opts);
  else if(t.alive!==undefined&&t.type!==undefined)G.damageAnchor(t,dmg,opts);
}
function chainLightning(x,y,b,maxJumps){
  let jumps=Math.min(maxJumps||b.chain||0,7);
  let cx=x,cy=y;
  const hit=new Set(b.hitSet?Array.from(b.hitSet):[]);
  const points=[[cx,cy]];
  for(let i=0;i<jumps;i++){
    const t=nearestTarget(cx,cy,270,hit);
    if(!t)break;
    points.push([t.x,t.y]);
    hit.add(t.id);
    damageTarget(t,b.damage*.62,{x:t.x,y:t.y,critChance:b.critChance||0,critMul:b.critMul||1.75,source:'chain',allowPayload:false});
    G.addParticles(t.x,t.y,b.color,3,{speed:70,life:.35,size:1.3});
    cx=t.x;cy=t.y;
  }
  if(points.length>1){
    G.addBolt(points,b.color,.13,2);
    N.Audio.glitch();
  }
}
G.chainLightning=chainLightning;
G.beam=function(angle,damage,color,length,width){
  const p=G.player;
  const x1=p.x+Math.cos(angle)*18,y1=p.y+Math.sin(angle)*18;
  const x2=x1+Math.cos(angle)*length,y2=y1+Math.sin(angle)*length;
  const crit={critChance:p.stats.critChance,critMul:p.stats.critMul};
  for(const e of G.enemies){
    if(e.dead)continue;
    if(N.distToSegment(e.x,e.y,x1,y1,x2,y2)<e.r+width/2)G.damageEnemy(e,damage,{x:e.x,y:e.y,...crit,source:'beam',allowPayload:false});
  }
  for(const a of G.level.anchors){
    if(a.alive&&N.distToSegment(a.x,a.y,x1,y1,x2,y2)<a.r+width/2)G.damageAnchor(a,damage,{x:a.x,y:a.y,...crit});
  }
  for(const c of G.level.caches){
    if(c.alive&&N.distToSegment(c.x,c.y,x1,y1,x2,y2)<c.r+width/2)G.damageCache(c,damage,{x:c.x,y:c.y,...crit});
  }
  G.addBeam(x1,y1,x2,y2,color,width,.2);
  G.addParticles(x2,y2,color,5,{angle:angle+Math.PI,spread:.3,speed:120,life:.25,size:1.4});
  G.triggerGlitch(.12,color);
  G.shake(2.2);
};
G.arcBolt=function(angle,damage,color,chainCount,range){
  const p=G.player;
  const ox=p.x+Math.cos(angle)*20,oy=p.y+Math.sin(angle)*20;
  let best=null,bestScore=-1;
  const dirx=Math.cos(angle),diry=Math.sin(angle);
  for(const e of G.enemies){
    if(e.dead)continue;
    const dx=e.x-ox,dy=e.y-oy,d=Math.hypot(dx,dy);
    if(d>range||d<1)continue;
    const dot=(dx/d)*dirx+(dy/d)*diry;
    const score=dot*2.4-(d/range);
    if(dot>-.25&&score>bestScore){bestScore=score;best=e;}
  }
  if(!best)return false;
  const points=[[ox,oy],[best.x,best.y]];
  const hit=new Set([best.id]);
  const crit={critChance:p.stats.critChance,critMul:p.stats.critMul};
  G.damageEnemy(best,damage,{x:best.x,y:best.y,...crit,source:'arc'});
  G.addParticles(best.x,best.y,color,5,{speed:100,life:.35,size:1.5});
  let cx=best.x,cy=best.y;
  const jumps=Math.min(chainCount||3,7);
  for(let i=0;i<jumps;i++){
    const t=nearestTarget(cx,cy,260,hit);
    if(!t)break;
    points.push([t.x,t.y]);hit.add(t.id);
    damageTarget(t,damage*.72,{x:t.x,y:t.y,...crit,source:'arc-chain',allowPayload:false});
    cx=t.x;cy=t.y;
  }
  G.addBolt(points,color,.16,2.2);
  G.addRing(best.x,best.y,42,color,.25,1.4);
  G.triggerGlitch(.2,color);
  N.Audio.glitch();
  return true;
};
G.damageEnemy=function(e,dmg,opts={}){
  if(!e||e.dead)return 0;
  let amount=Math.max(0,dmg);
  let crit=false;
  if(opts.critChance&&Math.random()<opts.critChance){amount*=opts.critMul||1.75;crit=true;}
  if(e.shield>0){
    const absorb=Math.min(e.shield,amount);
    e.shield-=absorb;amount-=absorb;e.shieldDelay=4.2;
    G.addParticles(e.x,e.y,'#6ad7ff',4,{speed:60,life:.3,size:1.2});
    if(amount<=0){G.addText(e.x,e.y-e.r-6,'SHIELD','#6ad7ff',10);return 0;}
  }
  e.hp-=amount;e.hitFlash=.2;
  const p=G.player;
  p.totalDamage+=amount;G.run.damage=(G.run.damage||0)+amount;G.level.damage=(G.level.damage||0)+amount;
  if(p.stats.lifesteal>0){p.hp=Math.min(p.stats.maxHp,p.hp+amount*p.stats.lifesteal);}
  G.addText(e.x+(Math.random()-.5)*e.r*.6,e.y-e.r*.7,(crit?'✦':'')+Math.round(amount),crit?'#fff':'#d8f4ff',crit?13:10);
  G.addParticles(e.x,e.y,e.color,3,{speed:100,life:.32,size:1.3,angle:opts.x!=null?Math.atan2(e.y-opts.y,e.x-opts.x):undefined});
  N.Audio.hit(panOf(e.x));
  if(opts.explosion!==true&&p.stats.explodeChance>0&&Math.random()<p.stats.explodeChance){
    G.explode(e.x,e.y,55*p.stats.explodeRadius,amount*.45,p.stats.maxShield>0?'#ffb31f':'#ffb31f','player',{particles:8,shake:1.2,glitch:.08,big:false});
  }
  if(e.hp<=0)G.killEnemy(e,opts);
  return amount;
};
G.damageAnchor=function(a,dmg,opts={}){
  if(!a||!a.alive)return 0;
  let amount=Math.max(0,dmg);let crit=false;
  if(opts.critChance&&Math.random()<opts.critChance){amount*=opts.critMul||1.75;crit=true;}
  a.hp-=amount;a.hitFlash=.25;
  G.run.damage=(G.run.damage||0)+amount;G.level.damage=(G.level.damage||0)+amount;
  G.addText(a.x+(Math.random()-.5)*20,a.y-a.r-8,(crit?'✦':'')+Math.round(amount),crit?'#fff':'#ffb31f',crit?14:11);
  G.addParticles(a.x,a.y,G.level.theme.b,3,{speed:100,life:.35,size:1.4});
  N.Audio.hit(panOf(a.x));
  if(a.hp<=0)G.destroyAnchor(a);
  return amount;
};
G.damageCache=function(c,dmg,opts={}){
  if(!c||!c.alive)return 0;
  let amount=Math.max(0,dmg);let crit=false;
  if(opts.critChance&&Math.random()<opts.critChance){amount*=opts.critMul||1.75;crit=true;}
  c.hp-=amount;c.hitFlash=.25;
  G.addText(c.x+(Math.random()-.5)*12,c.y-c.r-6,(crit?'✦':'')+Math.round(amount),crit?'#fff':'#d8f4ff',9);
  G.addParticles(c.x,c.y,c.corrupt?'#ff335c':G.level.theme.a,3,{speed:80,life:.3,size:1.2});
  N.Audio.hit(panOf(c.x));
  if(c.hp<=0)G.destroyCache(c);
  return amount;
};
G.damagePlayer=function(amount,x,y,contact=false){
  const p=G.player;
  if(!p||p.dead||p.invuln>0)return false;
  if(p.stats.dodge>0&&Math.random()<p.stats.dodge){
    p.invuln=Math.max(p.invuln,.18);
    G.addText(p.x,p.y-26,'PHASE','#6ad7ff',12);
    G.addParticles(p.x,p.y,'#6ad7ff',8,{speed:90,life:.35,size:1.4});
    N.Audio.glitch();return false;
  }
  let dmg=Math.max(1,amount*p.stats.damageTakenMul-p.stats.armor);
  p.invuln=.68;p.hitFlash=1;p.shieldDelay=p.stats.shieldDelay;
  if(p.shield>0){
    const absorb=Math.min(p.shield,dmg);
    p.shield-=absorb;dmg-=absorb;
    p.shieldRegenFx=1;
    G.addParticles(p.x,p.y,'#00f0ff',12,{speed:120,life:.45,size:1.8,glow:true});
    G.addRing(p.x,p.y,32,'#00f0ff',.32,2);
    N.Audio.shield();
    G.triggerGlitch(.3,'#00f0ff');
    if(dmg<=0){G.screenFlash('pickup');G.shake(2.2);return true;}
  }
  p.hp-=dmg;
  G.addText(p.x,p.y-30,'−'+Math.round(dmg),'#ff335c',15);
  G.addParticles(p.x,p.y,'#ff335c',20,{speed:190,life:.55,size:2.2,glow:true});
  G.addRing(p.x,p.y,40,'#ff335c',.35,2.2);
  G.screenFlash('hit');G.triggerGlitch(.55,'#ff335c');G.shake(9);
  N.Audio.hurt();
  if(p.hp<=0){p.hp=0;G.gameOver();}
  return true;
};

// ——— bullets ———
G.updatePlayerBullets=function(dt){
  for(let i=G.playerBullets.length-1;i>=0;i--){
    const b=G.playerBullets[i];
    if(b.dead){G.playerBullets.splice(i,1);continue;}
    b.prevX=b.x;b.prevY=b.y;
    if(b.curve){const c=b.curve*dt;const cs=Math.cos(c),sn=Math.sin(c);const vx=b.vx*cs-b.vy*sn;b.vy=b.vx*sn+b.vy*cs;b.vx=vx;b.angle=Math.atan2(b.vy,b.vx);}
    if(b.homing){
      const t=nearestTarget(b.x,b.y,700,null);
      if(t){
        const desired=Math.atan2(t.y-b.y,t.x-b.x);
        const da=N.angleDelta(b.angle,desired);
        const turn=Math.min(Math.abs(da),b.turnRate*dt)*Math.sign(da);
        b.angle+=turn;
        const sp=Math.hypot(b.vx,b.vy);
        b.vx=Math.cos(b.angle)*sp;b.vy=Math.sin(b.angle)*sp;
      }
    }
    if(b.accel){
      const sp=Math.min(1300,Math.hypot(b.vx,b.vy)+b.accel*dt);
      b.vx=Math.cos(b.angle)*sp;b.vy=Math.sin(b.angle)*sp;
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.pull){
      for(const e of G.enemies){
        if(e.dead)continue;
        const d=N.dist(b.x,b.y,e.x,e.y);
        if(d<240+e.r){
          const f=Math.min(.28,b.pull*dt/(d+60));
          e.x+=(b.x-e.x)*f;e.y+=(b.y-e.y)*f;
          e.vx*=.94;e.vy*=.94;
        }
      }
    }
    if(b.dot){
      b.tickTimer-=dt;
      if(b.tickTimer<=0){
        b.tickTimer=b.tick;
        const rr=(b.aoe||40)+b.size;
        for(const e of G.enemies){if(!e.dead&&N.dist2(b.x,b.y,e.x,e.y)<(rr+e.r)*(rr+e.r))G.damageEnemy(e,b.damage,{x:b.x,y:b.y,critChance:b.critChance,critMul:b.critMul,source:'dot',allowPayload:false});}
        for(const a of G.level.anchors){if(a.alive&&N.dist2(b.x,b.y,a.x,a.y)<(rr+a.r)*(rr+a.r))G.damageAnchor(a,b.damage*.7,{x:b.x,y:b.y});}
        for(const c of G.level.caches){if(c.alive&&N.dist2(b.x,b.y,c.x,c.y)<(rr+c.r)*(rr+c.r))G.damageCache(c,b.damage*.7,{x:b.x,y:b.y});}
        G.addParticles(b.x,b.y,b.color,4,{speed:40,life:.3,size:1.2,glow:true});
        G.addRing(b.x,b.y,rr,b.color,.25,1,false);
      }
    }else{
      let removed=false;
      for(const e of G.enemies){
        if(e.dead||b.hitSet.has(e.id))continue;
        if(N.dist2(b.x,b.y,e.x,e.y)<(b.size+e.r*.9)*(b.size+e.r*.9)){
          b.hitSet.add(e.id);
          const hitX=b.x,hitY=b.y;
          G.damageEnemy(e,b.damage,{x:b.x,y:b.y,critChance:b.critChance,critMul:b.critMul,source:'bullet',allowPayload:true});
          if(b.chain>0)chainLightning(hitX,hitY,b,b.chain);
          if(b.explode||b.kind==='mortar'||b.kind==='gravity'){
            G.explode(b.x,b.y,b.aoe||70,b.damage*.85,b.color,'player',{big:b.kind==='gravity',particles:12,shake:2.2});
            b.dead=true;removed=true;break;
          }
          if(b.pierce>0){b.pierce--;}
          else if(b.bounce>0){
            b.bounce--;
            const nx=(b.x-e.x)/(N.dist(b.x,e.x,b.y,e.y)||1),ny=(b.y-e.y)/(N.dist(b.x,e.x,b.y,e.y)||1);
            reflectBullet(b,nx,ny);G.addParticles(b.x,b.y,b.color,4,{speed:80,life:.25,size:1.2});
            break;
          }else{b.dead=true;removed=true;break;}
        }
      }
      if(removed)continue;
      for(const a of G.level.anchors){
        if(!a.alive||b.hitSet.has(a.id))continue;
        if(N.dist2(b.x,b.y,a.x,a.y)<(b.size+a.r)*(b.size+a.r)){
          b.hitSet.add(a.id);G.damageAnchor(a,b.damage,{x:b.x,y:b.y,critChance:b.critChance,critMul:b.critMul});
          if(b.explode){G.explode(b.x,b.y,b.aoe||70,b.damage*.8,b.color,'player',{particles:10,shake:2});b.dead=true;removed=true;break;}
          if(b.pierce>0)b.pierce--;else{b.dead=true;removed=true;break;}
        }
      }
      if(removed)continue;
      for(const c of G.level.caches){
        if(!c.alive||b.hitSet.has(c.id))continue;
        if(N.dist2(b.x,b.y,c.x,c.y)<(b.size+c.r)*(b.size+c.r)){
          b.hitSet.add(c.id);G.damageCache(c,b.damage,{x:b.x,y:b.y,critChance:b.critChance,critMul:b.critMul});
          if(b.explode){G.explode(b.x,b.y,b.aoe||70,b.damage*.8,b.color,'player',{particles:10,shake:2});b.dead=true;removed=true;break;}
          if(b.pierce>0)b.pierce--;else{b.dead=true;removed=true;break;}
        }
      }
      if(removed)continue;
      // shootable hostile mines
      for(const m of G.mines){
        if(m.dead||m.owner!=='enemy')continue;
        if(N.dist2(b.x,b.y,m.x,m.y)<(b.size+m.radius*.35)*(b.size+m.radius*.35)){
          m.dead=true;G.addRing(m.x,m.y,m.radius,'#ffb31f',.25,1.4);
          G.addParticles(m.x,m.y,'#ffb31f',8,{speed:120,life:.35,size:1.5});
          N.Audio.kill(false);
          if(b.pierce>0)b.pierce--;else{b.dead=true;break;}
        }
      }
      if(b.dead)continue;
    }
    // walls
    if(b.x<0||b.y<0||b.x>G.level.width||b.y>G.level.height){
      if(b.bounce>0){
        b.bounce--;
        if(b.x<0){b.x=0;b.vx=Math.abs(b.vx);}
        else if(b.x>G.level.width){b.x=G.level.width;b.vx=-Math.abs(b.vx);}
        if(b.y<0){b.y=0;b.vy=Math.abs(b.vy);}
        else if(b.y>G.level.height){b.y=G.level.height;b.vy=-Math.abs(b.vy);}
        b.angle=Math.atan2(b.vy,b.vx);
        G.addParticles(b.x,b.y,b.color,4,{speed:70,life:.25,size:1.2});
      }else{
        if(b.explode)G.explode(b.x,b.y,b.aoe||70,b.damage*.8,b.color,'player',{particles:8,shake:1.5});
        b.dead=true;continue;
      }
    }
    if(b.life<=0){
      if(b.explode||b.kind==='mortar'||b.kind==='gravity'){
        G.explode(b.x,b.y,b.aoe||70,b.damage*.9,b.color,'player',{big:b.kind==='gravity',particles:12,shake:2.5});
      }
      b.dead=true;
    }
  }
};
G.updateEnemyBullets=function(dt){
  const p=G.player;
  for(let i=G.enemyBullets.length-1;i>=0;i--){
    const b=G.enemyBullets[i];if(b.dead){G.enemyBullets.splice(i,1);continue;}
    b.prevX=b.x;b.prevY=b.y;b.life-=dt;
    if(b.curve){const c=b.curve*dt,cs=Math.cos(c),sn=Math.sin(c);const vx=b.vx*cs-b.vy*sn;b.vy=b.vx*sn+b.vy*cs;b.vx=vx;b.angle=Math.atan2(b.vy,b.vx);}
    if(b.accel){const sp=Math.min(1000,Math.hypot(b.vx,b.vy)+b.accel*dt);b.vx=Math.cos(b.angle)*sp;b.vy=Math.sin(b.angle)*sp;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    b.spin+=dt*4;
    if(b.life<=0||b.x<-30||b.y<-30||b.x>G.level.width+30||b.y>G.level.height+30){b.dead=true;continue;}
    if(p&&!p.dead&&p.invuln<=0&&N.dist2(b.x,b.y,p.x,p.y)<(b.size+p.radius)*(b.size+p.radius)){
      G.damagePlayer(b.damage,b.x,b.y,false);
      b.dead=true;
      G.addParticles(b.x,b.y,b.color,6,{speed:90,life:.3,size:1.5});
    }
  }
};
G.updateMines=function(dt){
  for(let i=G.mines.length-1;i>=0;i--){
    const m=G.mines[i];
    if(m.dead){G.mines.splice(i,1);continue;}
    m.life-=dt;m.armTime-=dt;m.spin+=dt*2;
    if(m.armTime<=0)m.armed=true;
    let trigger=false;
    if(m.armed){
      if(m.owner==='player'){
        for(const e of G.enemies){if(!e.dead&&N.dist2(m.x,m.y,e.x,e.y)<(m.radius*.75+e.r)*(m.radius*.75+e.r)){trigger=true;break;}}
        if(!trigger)for(const a of G.level.anchors){if(a.alive&&N.dist2(m.x,m.y,a.x,a.y)<(m.radius*.75+a.r)*(m.radius*.75+a.r)){trigger=true;break;}}
        if(!trigger)for(const c of G.level.caches){if(c.alive&&N.dist2(m.x,m.y,c.x,c.y)<(m.radius*.75+c.r)*(m.radius*.75+c.r)){trigger=true;break;}}
      }else if(G.player&&!G.player.dead&&N.dist2(m.x,m.y,G.player.x,G.player.y)<(m.radius*.7+G.player.radius)*(m.radius*.7+G.player.radius)){trigger=true;}
    }
    if(trigger||m.life<=0){
      G.explode(m.x,m.y,m.radius,m.damage,m.color,m.owner,{particles:12,shake:2.4,big:false,glitch:.14});
      m.dead=true;G.mines.splice(i,1);
    }
  }
};
G.updateOrbitals=function(dt){
  const p=G.player;
  for(let i=G.orbitals.length-1;i>=0;i--){
    const o=G.orbitals[i];
    if(o.dead||o.life<=0){G.orbitals.splice(i,1);continue;}
    o.life-=dt;o.angle+=o.spin*dt;
    const x=p.x+Math.cos(o.angle)*o.radius,y=p.y+Math.sin(o.angle)*o.radius;
    o.x=x;o.y=y;
    for(const e of G.enemies){
      if(e.dead)continue;
      if(o.hits[e.id]&&G.time-o.hits[e.id]<.35)continue;
      if(N.dist2(x,y,e.x,e.y)<(6+e.r)*(6+e.r)){
        o.hits[e.id]=G.time;
        G.damageEnemy(e,o.damage,{x,y,critChance:p.stats.critChance,critMul:p.stats.critMul,source:'orbital'});
      }
    }
    for(const a of G.level.anchors){
      if(!a.alive)continue;
      if(o.hits[a.id]&&G.time-o.hits[a.id]<.35)continue;
      if(N.dist2(x,y,a.x,a.y)<(6+a.r)*(6+a.r)){o.hits[a.id]=G.time;G.damageAnchor(a,o.damage,{x,y});}
    }
    for(const c of G.level.caches){
      if(!c.alive)continue;
      if(o.hits[c.id]&&G.time-o.hits[c.id]<.35)continue;
      if(N.dist2(x,y,c.x,c.y)<(6+c.r)*(6+c.r)){o.hits[c.id]=G.time;G.damageCache(c,o.damage,{x,y});}
    }
  }
};
G.updateStrikes=function(dt){
  for(let i=G.strikes.length-1;i>=0;i--){
    const s=G.strikes[i];
    s.delay-=dt;
    if(s.delay<=0){
      G.explode(s.x,s.y,s.radius,s.damage,s.color,'player',{big:true,particles:22,shake:4,glitch:.28});
      G.addBeam(s.x,s.y-420,s.x,s.y,s.color,8,.25);
      G.addRing(s.x,s.y,s.radius,s.color,.55,3);
      s.dead=true;G.strikes.splice(i,1);
    }
  }
};
G.updateEffects=function(dt){
  for(let i=G.effects.length-1;i>=0;i--){
    const e=G.effects[i];e.life-=dt;
    if(e.type==='ring')e.r+=(e.maxR-e.r)*Math.min(1,dt*8);
    if(e.life<=0)G.effects.splice(i,1);
  }
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i];p.life-=dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=(1-p.drag*dt);p.vy*=(1-p.drag*dt);p.rot+=p.spin*dt;
    if(p.life<=0)G.particles.splice(i,1);
  }
  for(let i=G.texts.length-1;i>=0;i--){
    const t=G.texts[i];t.life-=dt;t.y+=t.vy*dt;t.vy*=0.94;
    if(t.life<=0)G.texts.splice(i,1);
  }
  G.camera.shake=Math.max(0,(G.camera.shake||0)-dt*28);
  if(G.glitch>0)G.glitch=Math.max(0,G.glitch-dt*2.4);
};
G.updateGroundItems=function(dt){
  const p=G.player;
  const magnet=p.buffs.magnet>0;
  const radius=p.stats.pickupRadius*(magnet?5.5:1);
  for(let i=G.groundItems.length-1;i>=0;i--){
    const it=G.groundItems[i];
    if(it.collected){G.groundItems.splice(i,1);continue;}
    it.phase=(it.phase||0)+dt*2;it.angle=(it.angle||0)+dt*.7;
    if(it.pickupDelay>0){it.pickupDelay-=dt;continue;}
    const d=N.dist(it.x,it.y,p.x,p.y);
    if(magnet&&d<radius*1.5){
      const f=Math.min(1,dt*3.2);
      it.x+=(p.x-it.x)*f;it.y+=(p.y-it.y)*f;
    }
    if(d<radius){
      G.collectGroundItem(it,false);
      // Remove the pickup immediately even when collection opened an overlay
      // (overflow / level-up); otherwise a checkpoint saved during that overlay
      // would serialize a consumed item and duplicate it on reload.
      G.groundItems.splice(i,1);
      if(G.mode!=='playing') return;
    }
  }
};

// ——— player death ———
G.gameOver=function(){
  if(G.mode==='gameover'||G.mode==='complete')return;
  const p=G.player;if(!p)return;
  p.dead=true;p.hp=0;
  G.setMode('gameover');
  N.Input.resetFire();
  G.triggerGlitch(1,'#ff335c');
  G.screenFlash('hit');
  G.addParticles(p.x,p.y,'#ff335c',55,{speed:280,life:1.2,size:2.8,glow:true});
  G.addParticles(p.x,p.y,'#00f0ff',24,{speed:180,life:1.4,size:2.2,glow:true});
  G.addRing(p.x,p.y,110,'#ff335c',.9,4);
  G.shake(20);
  N.Audio.death();
  if(N.UI) N.UI.showGameOver(G.getGameOverData());
};

// ——— level completion ———
G.completeLevel=function(reason){
  if(G.mode!=='playing')return;
  const p=G.player;
  const summary={
    sector:G.run.level,reason:reason||'anchors',time:G.level.elapsed,kills:G.level.kills,
    totalKills:G.run.kills,sectors:G.run.sectors,level:p.level,hp:p.hp,maxHp:p.stats.maxHp,
    anchors:G.level.anchors.filter(a=>a.alive).length,anchorsTotal:G.level.anchors.length,
    weapons:p.weapons.map(w=>N.WEAPON_BY_ID[w.id]?.name||w.id),
    passives:p.passives.map(m=>N.MOD_BY_ID[m.id]?.name||m.id),
    damage:Math.round(G.level.damage),nextLevel:G.run.level+1
  };
  G.lastSummary=summary;
  G.run.totalTime=(G.run.totalTime||0)+G.level.elapsed;
  G.run.sectors=(G.run.sectors||0)+1;
  G.run.level++;
  p.hp=Math.min(p.stats.maxHp,p.hp+p.stats.maxHp*.35);
  p.shield=p.stats.maxShield;
  p.shieldDelay=0;
  p.dashCharges=p.maxDashCharges;
  p.buffs.overclock=0;p.buffs.speed=0;p.buffs.magnet=0;
  G.pendingLevelUps=0;G.overflow=null;
  G.level=G.generateLevel(G.run.level,null);
  p.x=G.level.cx;p.y=G.level.cy;p.vx=0;p.vy=0;
  G.camera.x=p.x;G.camera.y=p.y;G.camera.shake=0;
  G.camera.sx=0;G.camera.sy=0;
  G.resetEntityArrays();
  G.groundItems.length=0;
  G.checkpointTimer=60;G.nextSurge=60;G.nextWarden=120;G.nextBoss=210;
  G.triggerGlitch(.8,reason==='timer'?'#b6ff2b':'#ff2bd6');
  N.Audio.complete();
  G.saveCheckpoint(true,'levelcomplete');
  G.setMode('complete');
  N.Input.resetFire();
  if(N.UI) N.UI.showComplete(summary);
};
G.advanceLevel=function(){
  if(G.mode!=='complete')return;
  G.setMode('playing');
  N.Input.resetFire();
  N.Audio.setScene('game');
  G.spawnInitialEnemies();
  G.notify('SECTOR '+String(G.run.level).padStart(2,'0')+' // DESCENT CONFIRMED','loot',2400);
  G.triggerGlitch(.4,'#00f0ff');
  if(N.UI) N.UI.hideAll();
  G.saveCheckpoint(true,'sectorstart');
};

G.update=function(dt){
  G.attractTime+=dt;
  if(G.mode!=='playing'){
    // allow ambient glitch to fade even on menus without touching gameplay
    if(G.glitch>0)G.glitch=Math.max(0,G.glitch-dt*2.4);
    return;
  }
  if(!G.player||G.player.dead)return;
  if(N.Input.actionPressed('pause')||N.Input.padActionPressed('pause')){G.pauseGame();return;}
  if(N.Input.actionPressed('inventory')||N.Input.padActionPressed('inventory')){G.openInventory();return;}
  const prevElapsed=G.level.elapsed;
  G.time+=dt;G.level.elapsed=Math.min(DURATION,G.level.elapsed+dt);
  G.updatePlayer(dt);
  if(G.mode!=='playing')return;
  G.updateEnemies(dt);
  if(G.mode!=='playing')return;
  G.updateAnchors(dt);
  if(G.mode!=='playing')return;
  G.updateCaches(dt);
  G.updatePlayerBullets(dt);
  if(G.mode!=='playing')return;
  G.updateEnemyBullets(dt);
  if(G.mode!=='playing')return;
  G.updateMines(dt);
  G.updateOrbitals(dt);
  G.updateStrikes(dt);
  G.updateGroundItems(dt);
  if(G.mode!=='playing')return;
  G.updateEffects(dt);
  G.updateSpawning(dt);
  // auto checkpoints and surges keyed to elapsed time
  if(G.level.elapsed>=G.checkpointTimer){
    G.saveCheckpoint(false,'checkpoint');
    G.checkpointTimer+=60;
  }
  if(G.level.elapsed>=G.nextSurge&&G.level.elapsed<DURATION-8){
    G.spawnSurge();
    G.nextSurge+=60;
  }
  if(G.level.elapsed>=G.nextWarden&&!G.level.wardenSpawned){
    G.level.wardenSpawned=true;
    G.spawnEliteWarden();
  }
  if(G.level.elapsed>=G.nextBoss&&!G.level.bossSpawned){
    G.level.bossSpawned=true;
    G.spawnBoss();
  }
  if(G.level.elapsed>=DURATION)G.completeLevel('timer');
  if(G.mode!=='playing')return;
  if(G.level.anchors.length&&G.level.anchors.every(a=>!a.alive))G.completeLevel('anchors');
};
})();
