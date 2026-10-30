/* NEON NEXUS — hostiles, anchors, destructibles, wave director */
(function(){
'use strict';
const N=window.NEON;
const G=N.Game;
const TAU=N.TAU;
const clamp=N.clamp;
const DURATION=G.DURATION;
let uidCounter=0;
const uid=p=>p+(++uidCounter);
const panOf=G.panOf;

function dmgScale(){return 1+(G.run.level-1)*.18+G.level.elapsed/DURATION*.28;}
function qualityCap(){const q=G.settings.graphics.quality||'high';return q==='low'?55:q==='medium'?82:120;}
function spawnProgress(sector){return clamp((sector-1)/(N.SPAWN_TUNING.fullIntensitySector-1),0,1);}
G.enemyPopulationCap=function(sector=G.run.level){
  const start=N.SPAWN_TUNING.gentlePopulationCap;
  return Math.min(qualityCap(),Math.floor(start+(120-start)*spawnProgress(sector)));
};
function activeRegularStyles(){return G.level.styles.filter(s=>s.role!=='boss'&&s.role!=='warden');}
function styleForRole(role){
  const set=G.level.styles.filter(s=>s.role===role);
  if(set.length)return set[Math.floor(Math.random()*set.length)];
  const all=N.ENEMY_STYLES.filter(s=>s.role===role);
  return all[Math.floor(Math.random()*all.length)]||N.ENEMY_BY_ID.dart;
}
G.styleForRole=styleForRole;
G.pickStyle=function(){
  const set=activeRegularStyles();
  if(!set.length)return N.ENEMY_BY_ID.dart;
  let total=0;for(const s of set)total+=N.ROLES[s.role].weight||1;
  let x=Math.random()*total;
  for(const s of set){x-=N.ROLES[s.role].weight||1;if(x<=0)return s;}
  return set[set.length-1];
};
G.safeSpawnPos=function(minD=480,maxD=860){
  const p=G.player,l=G.level;
  if(l.layout){
    const valid=l.layout.cells.filter(c=>N.World.free(l.layout,c.x,c.y,70)&&N.dist(c.x,c.y,p.x,p.y)>=minD&&N.dist(c.x,c.y,p.x,p.y)<=maxD);
    if(valid.length){const at=valid[Math.floor(Math.random()*valid.length)];return {x:at.x,y:at.y};}
    const far=l.layout.cells.filter(c=>N.World.free(l.layout,c.x,c.y,70)&&N.dist(c.x,c.y,p.x,p.y)>=minD*.72);
    if(far.length){const at=far[Math.floor(Math.random()*far.length)];return {x:at.x,y:at.y};}
    return N.World.findFree(l.layout,p.x+minD,p.y,70);
  }
  for(let i=0;i<28;i++){
    const a=Math.random()*TAU,d=minD+Math.random()*(maxD-minD);
    let x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;
    x=clamp(x,90,l.width-90);y=clamp(y,90,l.height-90);
    if(N.dist(x,y,p.x,p.y)>=minD*.72&&x>70&&y>70&&x<l.width-70&&y<l.height-70)return {x,y};
  }
  return {x:clamp(p.x+ (Math.random()<.5?-1:1)*(l.width*.4),90,l.width-90),y:clamp(p.y+(Math.random()-.5)*l.height*.7,90,l.height-90)};
};

G.spawnEnemy=function(style,x,y,opts={}){
  if(!style||!G.level)return null;
  // Central gate also covers multi-enemy summons, splitters and anchor guards.
  if(!opts.requiredEncounter&&G.enemies.length>=G.enemyPopulationCap())return null;
  const role=N.ROLES[style.role]||N.ROLES.rusher;
  const p=(N.Coop&&N.Coop.nearestPlayer)?N.Coop.nearestPlayer(x,y):G.player;
  const hpScale=dmgScale();
  const elite=!!(opts.elite||role.elite);
  const boss=!!(opts.boss||role.boss);
  const child=!!opts.minion;
  const size=role.size*style.sizeMul*(elite?1.16:1)*(child?.55:1)*(.9+Math.random()*.22);
  const hue=Math.round(((role.hue+G.level.hueShift+(style.hue||0)+(Math.random()-.5)*24+360)%360)/10)*10%360;
  const sat=elite?96:90;
  const light=elite?66:59;
  const e={
    id:uid('enemy_'),style:style.id,styleDef:style,role:style.role,name:style.name,
    x:clamp(x,50,G.level.width-50),y:clamp(y,50,G.level.height-50),vx:0,vy:0,
    r:Math.max(8,size),hp:role.hp*hpScale*(child?.38:1)*(opts.elite&&!role.elite?1.75:1)*(boss?1:1),
    speed:Math.min(360,role.speed*(1+(G.run.level-1)*.018+G.level.elapsed/DURATION*.12)*(.9+Math.random()*.2)),
    contact:role.contact*(1+(G.run.level-1)*.12+G.level.elapsed/DURATION*.2)*(child?.55:1),
    xp:role.xp*(1+(G.run.level-1)*.12)*(child?.3:1)*(elite?2.2:1),
    drop:role.drop,dropChance:role.dropChance,attack:role.attack,elite,boss,child,
    color:`hsl(${hue},${sat}%,${light}%)`,hue,
    shield:role.shield?role.shield*hpScale*(elite?1.2:1)*(child?.4:1):0,
    maxShield:role.shield?role.shield*hpScale*(elite?1.2:1)*(child?.4:1):0,
    shieldRegen:style.role==='aegis'?7:0,shieldDelay:0,
    angle:Math.atan2(p.y-y,p.x-x),spawnT:.42,hitFlash:0,stun:0,dead:false,
    atkTimer:.5+Math.random()*1.8,chargeTimer:0,chargeAngle:0,fuseTimer:0,ramState:'chase',ramTimer:0,
    spiralAngle:Math.random()*TAU,teleportTimer:1.2+Math.random()*1.5,healTimer:.7+Math.random()*1.3,
    spawnChildTimer:2.2+Math.random()*2.2,orbitAngle:Math.atan2(y-p.y,x-p.x),orbitDir:Math.random()<.5?-1:1,
    wanderAngle:Math.random()*TAU,splitGen:opts.splitGen||0,healTargetId:null,addTimer:2.5+Math.random()*2,
    bossPattern:0,phase:Math.random()*TAU,alive:true,lastHit:-99,hitPulse:0
  };
  e.maxHp=e.hp;
  if(G.level.layout)Object.assign(e,N.World.findFree(G.level.layout,e.x,e.y,e.r));
  e.worldX=e.x;e.worldY=e.y;
  G.enemies.push(e);
  G.addRing(e.x,e.y,e.r*1.9,e.color,.45,1.4);
  G.addParticles(e.x,e.y,e.color,elite?20:8,{speed:elite?180:90,life:.55,size:elite?2.4:1.4,glow:true});
  if(elite){G.triggerGlitch(.4,e.color);G.shake(4);N.Audio.glitch();}
  if(boss){G.level.activeBoss=e;G.triggerGlitch(.9,e.color);G.screenFlash('hit');G.shake(12);N.Audio.boss();G.notify('NEXUS OVERSEER DETECTED // '+style.name,'danger',2600);}
  return e;
};
G.spawnInitialEnemies=function(count){
  if(!G.level||!G.player)return;
  const base=G.settings.graphics.quality==='low'?6:9;
  // Whole enemies: 9 halves to 5; 6 halves to 3. Grow at each sector entry.
  const n=count||Math.min(G.enemyPopulationCap(),Math.ceil(base*N.SPAWN_TUNING.initialPopulationMultiplier)
    +Math.max(0,G.run.level-1)*N.SPAWN_TUNING.initialPopulationPerSector);
  for(let i=0;i<n;i++){
    const pos=G.safeSpawnPos(500,800);
    G.spawnEnemy(G.pickStyle(),pos.x,pos.y);
  }
};
G.spawnWaveGroup=function(size,eliteChance){
  if(!G.level)return;
  size=size||G.routineSpawnGroup(G.level.elapsed,G.run.level);
  for(let i=0;i<size;i++){
    if(G.enemies.length>=G.enemyPopulationCap())break;
    const pos=G.safeSpawnPos(520,900);
    let style=G.pickStyle();
    const elite=Math.random()<(eliteChance==null?(.022+G.run.level*.003):eliteChance);
    if(elite){
      const wardens=G.level.styles.filter(s=>s.role==='warden');
      if(wardens.length&&Math.random()<.25)style=wardens[0];
    }
    G.spawnEnemy(style,pos.x,pos.y,{elite});
  }
};
G.spawnSurge=function(){
  const size=Math.min(18,9+Math.floor(G.run.level*.8));
  for(let i=0;i<size;i++){
    if(G.enemies.length>=G.enemyPopulationCap())break;
    const p=G.player;
    const a=i/size*TAU+Math.random()*.2,d=420+Math.random()*220;
    const pos={x:clamp(p.x+Math.cos(a)*d,70,G.level.width-70),y:clamp(p.y+Math.sin(a)*d,70,G.level.height-70)};
    G.spawnEnemy(G.pickStyle(),pos.x,pos.y);
  }
  G.triggerGlitch(.55,'#ff2bd6');G.shake(6);N.Audio.glitch();
  G.notify('HOSTILE SURGE // SECTOR SWARM INBOUND','danger',2100);
};
G.spawnEliteWarden=function(){
  const p=G.player,pos=G.safeSpawnPos(600,780);
  const style=G.level.styles.find(s=>s.role==='warden')||N.ENEMY_BY_ID.trinity;
  G.spawnEnemy(style,pos.x,pos.y,{elite:true,requiredEncounter:true});
  G.notify('ELITE SIGNATURE // '+style.name,'danger',2400);
  N.Audio.boss();
};
G.spawnBoss=function(){
  const p=G.player,pos=G.level.layout?.boss||G.safeSpawnPos(650,820);
  const style=G.level.styles.find(s=>s.role==='boss')||N.ENEMY_BY_ID.boss;
  G.spawnEnemy(style,pos.x,pos.y,{elite:true,boss:true,requiredEncounter:true});
  G.triggerGlitch(.9,'#ff335c');
  N.Audio.boss();
};
G.routineSpawnInterval=function(elapsed,sector){
  const late=clamp(1.25-elapsed/DURATION*.55-sector*.012,.48,1.25)*N.SPAWN_TUNING.routineIntervalMultiplier;
  return N.SPAWN_TUNING.gentleInterval+(late-N.SPAWN_TUNING.gentleInterval)*spawnProgress(sector);
};
G.routineSpawnGroup=function(elapsed,sector){
  const late=Math.min(9,2+Math.floor(sector*.35)+Math.floor(elapsed/DURATION*3));
  const start=N.SPAWN_TUNING.gentleGroupSize;
  return Math.floor(start+(late-start)*spawnProgress(sector));
};
G.updateSpawning=function(dt){
  if(!G.level||G.mode!=='playing')return;
  if(G.level.elapsed>=DURATION-5)return;
  const cap=G.enemyPopulationCap();
  if(G.enemies.length<cap){
    G.level.spawnTimer-=dt;
    if(G.level.spawnTimer<=0){
      const group=G.routineSpawnGroup(G.level.elapsed,G.run.level);
      G.spawnWaveGroup(group);
      G.level.spawnTimer=G.routineSpawnInterval(G.level.elapsed,G.run.level);
    }
  }else G.level.spawnTimer=Math.max(G.level.spawnTimer,.4);
};

// ——— hostile AI ———
function moveToward(e,tx,ty,speed,dt,accel=4){
  e.pathChecked=true;
  const waypoint=N.World.waypoint(e,{x:tx,y:ty});
  if(waypoint){tx=waypoint.x;ty=waypoint.y;}
  const a=Math.atan2(ty-e.y,tx-e.x);
  e.vx+=(Math.cos(a)*speed-e.vx)*Math.min(1,dt*accel);
  e.vy+=(Math.sin(a)*speed-e.vy)*Math.min(1,dt*accel);
}
function keepIn(e){
  if(G.level.layout){N.World.move(e,e.worldX,e.worldY,e.r);e.worldX=e.x;e.worldY=e.y;return;}
  e.x=clamp(e.x,40,G.level.width-40);e.y=clamp(e.y,40,G.level.height-40);
}
function fireAt(e,angle,speed,damage,opts={}){
  const r=e.r*.82;
  const b=G.spawnEnemyBullet({
    x:e.x+Math.cos(angle)*r,y:e.y+Math.sin(angle)*r,angle,speed,damage,
    size:opts.size||3.2,life:opts.life||4.2,color:e.color,kind:opts.kind||'hostile',
    curve:opts.curve||0,spin:Math.random()*TAU
  });
  return b;
}
function radial(e,n,speed,damage,offset=0,opts={}){
  for(let i=0;i<n;i++)fireAt(e,offset+i/n*TAU,speed,damage,opts);
}
function aimed(e,spread,n,speed,damage,opts={}){
  const base=e.angle;
  for(let i=0;i<n;i++){
    const t=n===1?0:(i/(n-1)-.5);
    fireAt(e,base+t*spread,speed,damage,opts);
  }
}
G.enemyFireAt=fireAt;

G.updateEnemies=function(dt){
  const localPlayer=G.player;
  const playerX=localPlayer.x,playerY=localPlayer.y;
  const dScale=dmgScale();
  for(const e of G.enemies){
    if(e.dead)continue;
    const p=(N.Coop&&N.Coop.isHost())?N.Coop.nearestPlayer(e.x,e.y):localPlayer;
    e.worldX=e.x;e.worldY=e.y;
    e.pathChecked=false;
    e.spawnT=Math.max(0,e.spawnT-dt);
    e.hitFlash=Math.max(0,e.hitFlash-dt*5);
    e.hitPulse+=dt*6;
    e.shieldDelay=Math.max(0,e.shieldDelay-dt);
    if(e.maxShield>0&&e.shieldDelay<=0&&e.shield<e.maxShield&&e.shieldRegen>0)e.shield=Math.min(e.maxShield,e.shield+e.shieldRegen*dt);
    const dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy)||1;
    const ang=Math.atan2(dy,dx);
    e.angle=N.lerpAngle(e.angle,ang,1-Math.exp(-dt*5));
    const role=e.role;
    if(e.spawnT>.12){e.vx*=.86;e.vy*=.86;e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);continue;}
    // charge attacks first
    if(e.chargeTimer>0){
      e.chargeTimer-=dt;e.vx*=.88;e.vy*=.88;
      if(e.chargeTimer<=0){
        const d=e.chargeDamage||14*dScale;
        fireAt(e,e.chargeAngle,760+G.run.level*12,d,{size:3.8,life:3.5,kind:'snipe'});
        G.addBolt([[e.x,e.y],[e.x+Math.cos(e.chargeAngle)*900,e.y+Math.sin(e.chargeAngle)*900]],e.color,.12,1.5);
        N.Audio.noiseBurst(.05,.05,1600);
        e.atkTimer=2.2/(1+G.run.level*.025);
      }
      e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);
      continue;
    }
    // ram states
    if(e.ramState==='telegraph'){
      e.ramTimer-=dt;e.vx*=.9;e.vy*=.9;e.angle=e.ramAngle;
      if(e.ramTimer<=0){e.ramState='charge';e.ramTimer=.42;N.Audio.glitch();G.triggerGlitch(.16,e.color);}
      e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);
      continue;
    }
    if(e.ramState==='charge'){
      e.ramTimer-=dt;e.angle=e.ramAngle;
      e.vx=Math.cos(e.ramAngle)*Math.min(820,e.speed*4.4);
      e.vy=Math.sin(e.ramAngle)*Math.min(820,e.speed*4.4);
      e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);
      if(e.ramTimer<=0){e.ramState='chase';e.atkTimer=2.3;e.vx*=.2;e.vy*=.2;}
      continue;
    }
    // detonator fuse
    if(e.fuseTimer>0){
      e.fuseTimer-=dt;e.vx*=.82;e.vy*=.82;
      if(e.fuseTimer<=0){
        G.explode(e.x,e.y,e.r*2.4,18*dScale,e.color,'enemy',{particles:22,shake:5,big:false,glitch:.25});
        G.killEnemy(e,{exploded:true});
        continue;
      }
      e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);
      continue;
    }
    // role movement
    if(role==='shooter'){
      if(dist<270){moveToward(e,e.x-dx,e.y-dy,e.speed,dt,3.2);}
      else if(dist>430){moveToward(e,p.x,p.y,e.speed,dt,2.4);}
      else{moveToward(e,e.x-dy*.7,e.y+dx*.7,e.speed*.75,dt,2.2);}
    }else if(role==='sniper'){
      if(dist<430)moveToward(e,e.x-dx,e.y-dy,e.speed,dt,2.2);
      else if(dist>700)moveToward(e,p.x,p.y,e.speed,dt,2);
      else moveToward(e,e.x-dy*.5,e.y+dx*.5,e.speed*.45,dt,1.4);
    }else if(role==='burster'){
      if(dist>235)moveToward(e,p.x,p.y,e.speed,dt,2.4);
      else{e.vx*=.9;e.vy*=.9;}
    }else if(role==='gyro'){
      e.orbitAngle+=e.orbitDir*dt*.65;
      const tx=p.x+Math.cos(e.orbitAngle)*285,ty=p.y+Math.sin(e.orbitAngle)*285;
      moveToward(e,tx,ty,e.speed,dt,2.2);
    }else if(role==='weaver'){
      let wounded=null,bd=260*260;
      for(const o of G.enemies){
        if(o.dead||o===e||o.hp>=o.maxHp)continue;
        const d=N.dist2(e.x,e.y,o.x,o.y);if(d<bd){bd=d;wounded=o;}
      }
      e.healTargetId=wounded?wounded.id:null;
      if(wounded){
        if(dist<200)moveToward(e,e.x-dx,e.y-dy,e.speed*.8,dt,2);
        else moveToward(e,wounded.x,wounded.y,e.speed*.75,dt,2);
      }else{
        e.wanderAngle+=dt*.4;
        const tx=p.x+Math.cos(e.wanderAngle)*340,ty=p.y+Math.sin(e.wanderAngle)*340;
        moveToward(e,tx,ty,e.speed*.65,dt,1.5);
      }
      e.healTimer-=dt;
      if(e.healTimer<=0){
        e.healTimer=2.7;
        if(wounded){
          const heal=wounded.maxHp*.18;
          wounded.hp=Math.min(wounded.maxHp,wounded.hp+heal);
          G.addText(wounded.x,wounded.y-wounded.r-8,'+'+Math.round(heal),'#b6ff2b',10);
          G.addRing(wounded.x,wounded.y,wounded.r+12,e.color,.35,1.4);
          G.addBolt([[e.x,e.y],[wounded.x,wounded.y]],e.color,.2,1.2);
          N.Audio.pickup(false);
        }
      }
    }else if(role==='hive'){
      if(dist>420)moveToward(e,p.x,p.y,e.speed*.8,dt,1.4);
      else if(dist<240)moveToward(e,e.x-dx,e.y-dy,e.speed*.7,dt,1.4);
      else moveToward(e,e.x-dy*.4,e.y+dx*.4,e.speed*.3,dt,1);
      e.spawnChildTimer-=dt;
      if(e.spawnChildTimer<=0){
        e.spawnChildTimer=4.8;
        if(G.enemies.length<G.enemyPopulationCap()){
          const st=styleForRole('rusher');
          const a=Math.random()*TAU;
          G.spawnEnemy(st,e.x+Math.cos(a)*e.r*1.2,e.y+Math.sin(a)*e.r*1.2,{minion:true});
          G.addRing(e.x,e.y,e.r*1.4,e.color,.4,1.2);
        }
      }
    }else if(role==='ram'){
      moveToward(e,p.x,p.y,e.speed,dt,2.4);
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<650){
        e.ramState='telegraph';e.ramTimer=.58;e.ramAngle=ang;
        N.Audio.glitch();G.triggerGlitch(.12,e.color);
      }
    }else if(role==='detonator'){
      moveToward(e,p.x,p.y,e.speed,dt,3.2);
      e.atkTimer-=dt;
      if(dist<145&&e.atkTimer<=0){e.fuseTimer=.78;e.atkTimer=2.8;N.Audio.ui('error');}
    }else if(role==='seeder'){
      if(dist<210)moveToward(e,e.x-dx,e.y-dy,e.speed*.8,dt,2);
      else if(dist>430)moveToward(e,p.x,p.y,e.speed*.55,dt,1.4);
      else{moveToward(e,e.x-dy*.5,e.y+dx*.5,e.speed*.45,dt,1.2);}
      e.atkTimer-=dt;
      if(e.atkTimer<=0){
        e.atkTimer=3.1;
        const a=Math.random()*TAU,rr=40+Math.random()*70;
        G.spawnMine({x:e.x+Math.cos(a)*rr,y:e.y+Math.sin(a)*rr,owner:'enemy',damage:16*dScale,radius:55,color:'#ff335c',life:13,armTime:.8});
      }
    }else if(role==='null'){
      moveToward(e,p.x,p.y,e.speed,dt,2.2);
      e.teleportTimer-=dt;
      if(e.teleportTimer<=0){
        e.teleportTimer=2.4+Math.random()*1.2;
        G.addRing(e.x,e.y,e.r*2,e.color,.35,2);
        const a=Math.random()*TAU,d=260+Math.random()*190;
        e.x=clamp(p.x+Math.cos(a)*d,70,G.level.width-70);
        e.y=clamp(p.y+Math.sin(a)*d,70,G.level.height-70);
        if(G.level.layout){Object.assign(e,N.World.findFree(G.level.layout,e.x,e.y,e.r));e.worldX=e.x;e.worldY=e.y;}
        G.addRing(e.x,e.y,e.r*2,e.color,.4,2);G.triggerGlitch(.28,e.color);
        N.Audio.glitch();
      }
    }else if(role==='aegis'){
      if(dist>340)moveToward(e,p.x,p.y,e.speed*.8,dt,2);
      else if(dist<190)moveToward(e,e.x-dx,e.y-dy,e.speed*.8,dt,2);
      else moveToward(e,e.x-dy*.25,e.y+dx*.25,e.speed*.25,dt,1);
    }else if(role==='boss'||role==='warden'){
      if(dist>260)moveToward(e,p.x,p.y,e.speed,dt,1.5);
      else if(dist<190)moveToward(e,e.x-dx,e.y-dy,e.speed*.55,dt,1.2);
      else{moveToward(e,e.x-dy*.3,e.y+dx*.3,e.speed*.3,dt,1);}
    }else{
      // rusher, tank, splitter, weaver fallback
      const wob=role==='rusher'?Math.sin(G.time*4+e.phase)*.16:0;
      moveToward(e,p.x+(-dy)*wob,p.y+(dx)*wob,e.speed,dt,role==='tank'?1.6:3.4);
    }
    if(!e.pathChecked){const detour=N.World.waypoint(e,p);if(detour)moveToward(e,detour.x,detour.y,e.speed,dt);}
    e.x+=e.vx*dt;e.y+=e.vy*dt;keepIn(e);
    // attack cycles
    if(role==='shooter'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<620){aimed(e,.28,3,230+G.run.level*5,8*dScale,{size:3,life:4});e.atkTimer=1.55/(1+G.run.level*.025);}
    }else if(role==='tank'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<760){radial(e,8,135+G.run.level*3,10*dScale,Math.random()*TAU,{size:3.4,life:4.4});e.atkTimer=3.2/(1+G.run.level*.02);}
    }else if(role==='burster'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<430){radial(e,12,185,8*dScale,Math.random()*TAU,{size:3,life:4.2});G.addRing(e.x,e.y,e.r*2.2,e.color,.35,1.4);e.atkTimer=2.3/(1+G.run.level*.02);}
    }else if(role==='sniper'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<800){e.chargeTimer=.72;e.chargeAngle=ang;e.chargeDamage=16*dScale;e.atkTimer=999;N.Audio.glitch();}
    }else if(role==='aegis'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<620){aimed(e,.34,3,225,9*dScale,{size:3.2,life:4});e.atkTimer=2.1/(1+G.run.level*.02);}
    }else if(role==='gyro'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0){
        e.spiralAngle+=.45;
        fireAt(e,e.spiralAngle,205,7*dScale,{size:2.8,life:4.2});
        fireAt(e,e.spiralAngle+Math.PI,205,7*dScale,{size:2.8,life:4.2});
        e.atkTimer=.52;
      }
    }else if(role==='null'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0&&dist<640){
        for(let i=0;i<5;i++)fireAt(e,ang+(i-2)*.2,215,7*dScale,{size:2.8,life:4.4,curve:(i%2?1:-1)*1.15});
        e.atkTimer=1.9;
      }
    }else if(role==='boss'){
      e.atkTimer-=dt;e.addTimer-=dt;
      if(e.atkTimer<=0){
        e.bossPattern=(e.bossPattern+1)%3;
        if(e.bossPattern===0){
          radial(e,16,175+G.run.level*3,10*dScale,Math.random()*TAU,{size:3.4,life:5});
          G.addRing(e.x,e.y,e.r*2.4,e.color,.4,2.2);G.shake(3);
          e.atkTimer=1.2;
        }else if(e.bossPattern===1){
          aimed(e,1.15,7,250,11*dScale,{size:3.2,life:4.6});
          e.atkTimer=.9;
        }else{
          for(let i=0;i<4;i++)fireAt(e,e.spiralAngle+i/4*TAU,205,9*dScale,{size:3,life:4.6});
          e.spiralAngle+=.36;e.atkTimer=.3;
        }
        G.triggerGlitch(.12,e.color);
      }
      if(e.addTimer<=0){
        e.addTimer=6.5;
        if(G.enemies.length<G.enemyPopulationCap()){
          const st=styleForRole(Math.random()<.5?'rusher':'shooter');
          for(let i=0;i<2;i++){const a=Math.random()*TAU;G.spawnEnemy(st,e.x+Math.cos(a)*e.r*1.5,e.y+Math.sin(a)*e.r*1.5,{minion:true});}
        }
      }
    }else if(role==='warden'){
      e.atkTimer-=dt;
      if(e.atkTimer<=0){
        e.bossPattern=(e.bossPattern+1)%2;
        if(e.bossPattern===0){radial(e,12,185,10*dScale,Math.random()*TAU,{size:3.2,life:4.6});G.addRing(e.x,e.y,e.r*2.2,e.color,.35,2);}
        else{aimed(e,.95,5,245,12*dScale,{size:3.2,life:4.4});}
        e.atkTimer=1.45/(1+G.run.level*.02);
        G.triggerGlitch(.16,e.color);
      }
    }
    // contact damage
    if(!p.dead&&N.Ships.intersectsCircle(p,e.x,e.y,e.r*.8)&&N.World.clear(p.x,p.y,e.x,e.y)){
      if(p.invuln<=0){
        if(p.stats.thorns>0){
          G.damageEnemy(e,p.stats.thorns,{x:p.x,y:p.y,source:'thorns',allowPayload:false,player:p});
          G.addParticles(e.x,e.y,'#ffb31f',5,{speed:80,life:.25,size:1.3});
        }
        if(p===G.player)G.damagePlayer(e.contact,e.x,e.y,true);
        else N.Coop.sendHit(p,e.contact,e.x,e.y,true);
      }
      // gentle physical separation so hostiles do not erase the pilot instantly
      if(N.Ships.intersectsCircle(p,e.x,e.y,e.r*.55)){
        const a=Math.atan2(p.y-e.y,p.x-e.x),push=Math.min(6,dt*80);
        p.x+=Math.cos(a)*push;p.y+=Math.sin(a)*push;
      }
    }
  }
  // separation
  if(G.enemies.length<150){
    for(let i=0;i<G.enemies.length;i++){
      const a=G.enemies[i];if(a.dead)continue;
      for(let j=i+1;j<G.enemies.length;j++){
        const b=G.enemies[j];if(b.dead)continue;
        const dx=b.x-a.x,dy=b.y-a.y,rr=(a.r+b.r)*.78;
        const d2=dx*dx+dy*dy;
        if(d2<rr*rr&&d2>.001&&N.World.clear(a.x,a.y,b.x,b.y)){
          const d=Math.sqrt(d2),push=(rr-d)*.32;
          const nx=dx/d,ny=dy/d;
          a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
        }
      }
    }
  }
  // cull
  if(G.level.layout){
    for(const e of G.enemies)if(!e.dead)keepIn(e);
    N.World.move(localPlayer,playerX,playerY,N.Ships.get(localPlayer.shipType).radius,true);
  }
  for(let i=G.enemies.length-1;i>=0;i--){if(G.enemies[i].dead)G.enemies.splice(i,1);}
};

G.killEnemy=function(e,opts={}){
  if(!e||e.dead)return;
  e.dead=true;e.alive=false;
  const killer=opts.player||G.player;
  const guestKill=!!(N.Coop&&N.Coop.isHost()&&killer!==G.player);
  G.run.kills=(G.run.kills||0)+1;G.level.kills=(G.level.kills||0)+1;
  N.Rewards.onKill();
  if(!guestKill)G.addXp(e.xp||1);
  if(N.Coop&&N.Coop.isHost())N.Coop.onHostKill(e.xp||0,!guestKill);
  G.addParticles(e.x,e.y,e.color,e.elite?32:12,{speed:e.elite?260:160,life:.7,size:e.elite?2.4:1.7,glow:true});
  G.addRing(e.x,e.y,e.r*2.2,e.color,e.elite?.55:.32,e.elite?3:1.5);
  G.addText(e.x,e.y-e.r-10,'+'+Math.round(e.xp||0)+' DATA','#6ad7ff',9);
  N.Audio.kill(!!e.elite);
  if(e.elite){G.triggerGlitch(.55,e.color);G.shake(6);G.screenFlash('hit');}
  if(e.role==='detonator'&&!opts.exploded){
    G.explode(e.x,e.y,e.r*2.2,18*dmgScale(),e.color,'enemy',{particles:16,shake:4,big:false,glitch:.2});
  }
  if(e.role==='splitter'&&(e.splitGen||0)<1&&G.enemies.length<G.enemyPopulationCap()){
    const st=e.styleDef;
    for(let i=0;i<2;i++){
      const a=Math.random()*TAU;
      G.spawnEnemy(st,e.x+Math.cos(a)*e.r*.7,e.y+Math.sin(a)*e.r*.7,{minion:true,splitGen:(e.splitGen||0)+1});
    }
  }
  const role=N.ROLES[e.role]||N.ROLES.rusher;
  const chance=Math.min(.98,(role.dropChance||0)*(killer?killer.stats.luck:1));
  if(e.elite||e.boss||Math.random()<chance){
    G.dropForEnemy(e);
  }
  if(e.boss){
    G.level.activeBoss=null;
    G.triggerGlitch(1,'#ff335c');G.shake(16);G.screenFlash('hit');
    G.notify('OVERSEER SIGNAL TERMINATED // LOOT CASCADE','loot',2800);
    N.Audio.complete();
  }
};

G.destroyAnchor=function(a){
  if(!a||!a.alive)return;
  a.alive=false;a.hp=0;
  const theme=G.level.theme;
  G.addParticles(a.x,a.y,theme.b,42,{speed:280,life:1,size:2.8,glow:true});
  G.addParticles(a.x,a.y,theme.a,26,{speed:170,life:1.2,size:2,glow:true});
  G.addRing(a.x,a.y,a.r*4.5,theme.b,.8,4);
  G.addRing(a.x,a.y,a.r*2.4,theme.a,.55,2);
  G.triggerGlitch(.9,theme.b);G.screenFlash('hit');G.shake(13);N.Audio.explosion(true);N.Audio.anchor();
  const rngShim={next:Math.random,pick:arr=>arr[Math.floor(Math.random()*arr.length)]};
  const count=Math.random()<.4?2:1;
  for(let i=0;i<count;i++){
    const loot=G.lootFromRng(rngShim,false,G.run.level);
    const a2=Math.random()*TAU,rr=30+i*26;
    G.spawnGroundLoot(loot,a.x+Math.cos(a2)*rr,a.y+Math.sin(a2)*rr,G.getLootName(loot));
  }
  const left=G.level.anchors.filter(x=>x.alive).length;
  G.notify('NULL ANCHOR DESTROYED // '+left+' REMAINING','loot',2200);
};
G.destroyCache=function(c){
  if(!c||!c.alive)return;
  c.alive=false;c.hp=0;
  const color=c.corrupt?'#ff335c':G.level.theme.a;
  G.addParticles(c.x,c.y,color,22,{speed:200,life:.65,size:2.2,glow:true});
  G.addRing(c.x,c.y,c.r*2.7,color,.5,2.2);
  G.triggerGlitch(c.corrupt?.4:.2,color);G.shake(3);N.Audio.kill(c.corrupt);
  if(c.loot){
    const it=G.spawnGroundLoot(c.loot,c.x,c.y,G.getLootName(c.loot));
    if(c.corrupt&&it)it.color='#ff335c';
    G.notify((c.corrupt?'CORRUPT CACHE OPENED':'CACHE BREACHED')+(it?' // '+G.getLootName(it):''),c.corrupt?'warn':'loot',1700);
  }
};

G.updateAnchors=function(dt){
  const localPlayer=G.player;
  const dScale=dmgScale();
  for(const a of G.level.anchors){
    if(!a.alive)continue;
    a.hitFlash=Math.max(0,a.hitFlash-dt*4);
    a.phase+=dt*.7;
    const p=(N.Coop&&N.Coop.isHost())?N.Coop.nearestPlayer(a.x,a.y):localPlayer;
    const dist=N.dist(a.x,a.y,p.x,p.y);
    const ang=Math.atan2(p.y-a.y,p.x-a.x);
    a.angle=N.lerpAngle(a.angle,ang,1-Math.exp(-dt*1.5));
    a.attackTimer-=dt;
    if(a.attackTimer<=0&&dist<1100){
      a.attackTimer=a.type===0?2.5:a.type===1?2.15:2.9;
      if(a.type===0){
        const base=a.angle+a.phase*.7;
        for(let i=0;i<4;i++)G.spawnEnemyBullet({x:a.x+Math.cos(base+i*.4)*a.r,y:a.y+Math.sin(base+i*.4)*a.r,angle:base+i*.4,speed:190,damage:9*dScale,size:3.4,life:4.8,color:G.level.theme.b,kind:'anchor'});
      }else if(a.type===1){
        for(let i=0;i<5;i++)G.spawnEnemyBullet({x:a.x+Math.cos(ang+(i-2)*.15)*a.r,y:a.y+Math.sin(ang+(i-2)*.15)*a.r,angle:ang+(i-2)*.15,speed:245,damage:8*dScale,size:3,life:4.6,color:G.level.theme.a,kind:'anchor'});
      }else{
        for(let i=0;i<12;i++)G.spawnEnemyBullet({x:a.x+Math.cos(i/12*TAU)*a.r,y:a.y+Math.sin(i/12*TAU)*a.r,angle:i/12*TAU,speed:145,damage:8*dScale,size:3,life:5.2,color:G.level.theme.b,kind:'anchor'});
      }
      G.addRing(a.x,a.y,a.r*2.4,G.level.theme.a,.28,1.2);
      N.Audio.noiseBurst(.06,.04,650);
    }
    a.guardTimer-=dt;
    if(a.guardTimer<=0&&dist<900&&G.enemies.length<G.enemyPopulationCap()-4){
      a.guardTimer=8+Math.random()*3;
      for(let i=0;i<2;i++){
        const role=Math.random()<.65?'rusher':'shooter';
        const st=G.styleForRole(role);
        const ang2=Math.random()*TAU;
        G.spawnEnemy(st,clamp(a.x+Math.cos(ang2)*a.r*2.4,60,G.level.width-60),clamp(a.y+Math.sin(ang2)*a.r*2.4,60,G.level.height-60));
      }
      G.addRing(a.x,a.y,a.r*2.8,G.level.theme.b,.4,1.2);
    }
  }
};
G.updateCaches=function(dt){
  for(const c of G.level.caches){
    if(!c.alive)continue;
    c.phase+=dt*1.2;c.angle+=c.spin*dt;c.hitFlash=Math.max(0,c.hitFlash-dt*4);
  }
};

// hostile bullet patterns for anchors/bosses already handled above
G.getBoss=function(){return G.level?G.level.anchors?G.level.activeBoss:null:null;};
})();
