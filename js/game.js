/* NEON NEXUS — simulation core */
(function(){
'use strict';
const N=window.NEON;
const TAU=N.TAU;
const clamp=N.clamp;
const G=N.Game={};
const DURATION=420;
const SAVE_VERSION=1;
const MAX_PARTICLES=650;
const MAX_PLAYER_BULLETS=620;
const MAX_ENEMY_BULLETS=850;
const MAX_TEXT=80;

G.DURATION=DURATION;
G.mode='boot';
G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{});
G.time=0;
G.attractTime=0;
G.player=null;
G.run=null;
G.level=null;
G.camera={x:0,y:0,zoom:1,shake:0,sx:0,sy:0};
Object.defineProperty(G,'stats',{get(){return G.player?G.player.stats:null;}});
G.enemies=[];G.playerBullets=[];G.enemyBullets=[];G.mines=[];G.orbitals=[];
G.strikes=[];G.effects=[];G.particles=[];G.texts=[];G.groundItems=[];
G.overflow=null;G.pendingLevelUps=0;G.levelUpChoices=[];
G.lastSummary=null;G.lastCheckpoint=null;
G.checkpointTimer=60;G.nextSurge=60;G.nextWarden=120;G.nextBoss=210;
G.fps=0;G.fpsAccum=0;G.fpsFrames=0;G.elapsedReal=0;
G.dpr=1;G.w=0;G.h=0;G.zoom=1;
G.aim={angle:-Math.PI/2,fire:false,source:'mouse',point:null};
G.debugMode=/[?&]debug=1/.test(location.search);

function id(prefix){G.entityId=(G.entityId||0)+1;return prefix+G.entityId;}
function rngFor(seed){return N.RNG(seed);}
function angleTo(a,b){return Math.atan2(b.y-a.y,b.x-a.x);}
function panOf(x){ if(!G.w) return 0; return clamp(((x-G.camera.x)*G.zoom)/(G.w*.55),-1,1); }
function isInMap(x,y,margin=0){return G.level&&(G.level.layout?N.World.free(G.level.layout,x,y,margin):x>=margin&&y>=margin&&x<=G.level.width-margin&&y<=G.level.height-margin);}

G.notify=function(text,type='info',duration){
  if(N.UI&&N.UI.toast) N.UI.toast(text,type,duration);
};
G.screenFlash=function(kind='hit'){
  if(G.settings.accessibility?.reducedFlash) return;
  const el=document.getElementById('screenflash'); if(!el)return;
  el.classList.remove('hit','pickup');
  void el.offsetWidth;
  el.classList.add(kind);
};
G.triggerGlitch=function(power=.3,color=null){
  if(!G.settings.graphics.glitch) return;
  G.glitch=Math.max(G.glitch||0,power);
  G.glitchColor=color||G.glitchColor||'#00f0ff';
  G.glitchSeed=Math.random()*1000;
};
G.shake=function(amount){
  if(!G.settings.graphics.shake) return;
  G.camera.shake=Math.min(28,(G.camera.shake||0)+amount);
};

G.init=function(canvas){
  G.canvas=canvas; G.ctx=canvas.getContext('2d',{alpha:false});
  N.Storage.init();
  G.settings=N.loadSettings();
  N.Input.init(G.settings);
  N.Audio.init(G.settings);
  N.Audio.setScene('menu');
  N.Input.onPadChange((connected,name)=>{
    G.notify(connected?'GAMEPAD LINKED // '+String(name).slice(0,34):'GAMEPAD DISCONNECTED',connected?'info':'warn');
    const el=document.getElementById('gamepad-status');
    if(el){el.textContent=connected?'GAMEPAD ONLINE':'GAMEPAD OFFLINE';el.classList.toggle('show',connected);}
  });
  if(N.Input.hasGamepad()){
    const el=document.getElementById('gamepad-status');
    if(el){el.textContent='GAMEPAD ONLINE';el.classList.add('show');}
  }
  G.applySettings(false);
  G.resize();
  window.addEventListener('resize',G.resize);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && G.mode==='playing'){
      G.saveCheckpoint(true,'hidden');
      N.Audio.suspend();
    }else if(!document.hidden){
      N.Audio.resume();
    }
  });
  N.Assets.ready();
  G.attractSeed=(Math.random()*100000)|0;
  G.attractObjects=makeAttractObjects(G.attractSeed);
  G.attractTime=0;
  G.lastTime=performance.now();
  document.body.classList.remove('playing');
};

G.resize=function(){
  if(!G.canvas) return;
  const w=Math.max(320,window.innerWidth), h=Math.max(320,window.innerHeight);
  const quality=G.settings.graphics.quality||'high';
  const cap=quality==='low'?1:quality==='medium'?1.35:2;
  const dpr=Math.min(window.devicePixelRatio||1,cap);
  G.dpr=dpr; G.w=w; G.h=h;
  G.canvas.width=Math.floor(w*dpr); G.canvas.height=Math.floor(h*dpr);
  G.canvas.style.width=w+'px'; G.canvas.style.height=h+'px';
  G.zoom=clamp(Math.min(w/1180,h/760),.56,1.5);
  G.camera.zoom=G.zoom;
  G.updateCamera(0,true);
};
G.applySettings=function(persist=true){
  N.Input.setSettings(G.settings);
  N.Audio.setSettings(G.settings);
  const scan=document.getElementById('scanlines');
  const grain=document.getElementById('grain');
  if(scan) scan.classList.toggle('off',!G.settings.graphics.scanlines);
  if(grain) grain.classList.toggle('off',!G.settings.graphics.scanlines);
  G.resize();
  if(persist) N.saveSettings(G.settings);
};
G.setMode=function(m){
  if(m!=='playing'){N.Input.resetMovement();N.Input.resetFire();}
  if(N.Coop&&N.Coop.isActive()&&!N.Coop._applyingRemote&&G.mode==='playing'&&m!=='playing'&&m!=='menu'&&m!=='boot'&&m!=='gameover'&&m!=='complete'&&m!=='paused'){
    N.Coop.requestGlobalPause();
  }
  G.mode=m;
  document.body.classList.toggle('playing',m==='playing');
  if(m==='playing') N.Audio.setScene('game');
  else if(m==='menu'||m==='boot') N.Audio.setScene('menu');
  else if(m==='gameover') N.Audio.setScene('dead');
  else if(m==='complete') N.Audio.setScene('complete');
  else N.Audio.setScene('paused');
};

// ——— seed / attract ———
function makeAttractObjects(seed){
  const r=N.RNG(seed); const arr=[];
  for(let i=0;i<42;i++){
    arr.push({x:r.range(-.15,1.15),y:r.range(-.15,1.15),r:r.range(12,110),n:r.int(3,9),rot:r.angle(),spin:r.range(-.12,.12),depth:r.range(.2,1),hue:r.range(0,360),phase:r.angle()});
  }
  return arr;
}

// ——— inventory stats ———
function applyEffects(stats,effects){
  if(!effects) return;
  for(const k in effects){
    if(k==='heal') continue;
    if(stats[k]===undefined) stats[k]=0;
    stats[k]+=effects[k];
  }
}
G.rebuildStats=function(p,initial=false){
  const oldHpMax=p.stats?p.stats.maxHp:null;
  const oldShMax=p.stats?p.stats.maxShield:null;
  const oldDashMax=p.maxDashCharges||null;
  const s=Object.assign({},N.BASE_STATS);
  for(const m of (p.passives||[])){
    const def=N.MOD_BY_ID[m.id]; if(!def) continue;
    for(let i=0;i<(m.stacks||1);i++) applyEffects(s,def.effect);
  }
  for(const pid of (p.core||[])){
    const def=N.PROTOCOL_BY_ID[pid]; if(def) applyEffects(s,def.effect);
  }
  s.maxHp=Math.max(20,Math.round(s.maxHp));
  s.maxShield=Math.max(0,Math.round(s.maxShield));
  s.armor=Math.max(0,s.armor);
  s.damageMul=Math.max(.2,s.damageMul);
  s.rateMul=Math.max(.25,s.rateMul);
  s.speedMul=Math.max(.2,s.speedMul);
  s.moveMul=Math.max(.35,s.moveMul);
  s.areaMul=Math.max(.25,s.areaMul);
  s.sizeMul=Math.max(.35,s.sizeMul);
  s.multishot=Math.round(clamp(s.multishot,0,8));
  s.pierce=Math.max(0,Math.round(s.pierce));
  s.bounce=Math.max(0,Math.round(s.bounce));
  s.chain=Math.max(0,Math.round(s.chain));
  s.critChance=clamp(s.critChance,0,.85);
  s.critMul=Math.max(1,s.critMul);
  s.pickupMul=Math.max(.2,s.pickupMul);
  s.luck=Math.max(.2,Math.min(4,s.luck));
  s.xpMul=Math.max(.2,s.xpMul);
  s.regen=Math.max(0,s.regen);
  s.thorns=Math.max(0,s.thorns);
  s.lifesteal=clamp(s.lifesteal,0,.25);
  s.dodge=clamp(s.dodge,0,.45);
  s.dashCharges=Math.max(1,Math.round(s.dashCharges));
  s.dashRecharge=Math.max(.65,s.dashRecharge);
  s.durationMul=Math.max(.2,s.durationMul);
  s.explodeChance=clamp(s.explodeChance,0,.75);
  s.explodeRadius=Math.max(.2,s.explodeRadius);
  s.damageTakenMul=Math.max(.2,s.damageTakenMul);
  s.shieldRegenMul=Math.max(.1,s.shieldRegenMul);
  s.pickupRadius=95*s.pickupMul;
  s.moveSpeed=N.BASE_STATS.speed*s.moveMul;
  s.shieldDelay=4.2;
  p.stats=s;
  p.maxDashCharges=s.dashCharges;
  if(oldHpMax==null){
    p.hp=p.hp==null?s.maxHp:Math.min(p.hp,s.maxHp);
  }else{
    const diff=s.maxHp-oldHpMax;
    p.hp=clamp((p.hp==null?s.maxHp:p.hp)+Math.max(0,diff),1,s.maxHp);
    if(diff<0) p.hp=Math.min(p.hp,s.maxHp);
  }
  if(oldShMax==null){
    p.shield=p.shield==null?s.maxShield:Math.min(p.shield,s.maxShield);
  }else{
    const diff=s.maxShield-oldShMax;
    p.shield=clamp((p.shield==null?s.maxShield:p.shield)+Math.max(0,diff),0,s.maxShield);
  }
  if(oldDashMax==null){
    p.dashCharges=Math.max(1,p.dashCharges||p.maxDashCharges);
  }else if(p.maxDashCharges>oldDashMax){
    p.dashCharges=Math.min(p.maxDashCharges,(p.dashCharges||0)+(p.maxDashCharges-oldDashMax));
  }else{
    p.dashCharges=Math.min(p.dashCharges||0,p.maxDashCharges);
  }
  if(initial){
    p.hp=s.maxHp;p.shield=s.maxShield;p.dashCharges=p.maxDashCharges;
  }
  return s;
};
G.xpForLevel=function(level){return Math.round(38+(level-1)*11);};

function makeWeapon(id,tier=1,level=1){
  const def=N.WEAPON_BY_ID[id]||N.WEAPON_BY_ID[N.STARTING_WEAPON];
  return {id:def.id,name:def.name,color:def.color,base:def.base,level:clamp(level|0,1,5),tier:clamp(tier|0,1,3),cooldown:0};
}
function makePlayer(){
  const p={
    x:0,y:0,vx:0,vy:0,radius:13,aim:-Math.PI/2,heading:-Math.PI/2,
    shipType:'dart',shipColor:'#00f0ff',
    hp:null,shield:null,level:1,xp:0,xpNext:G.xpForLevel(1),
    weapons:[makeWeapon(N.STARTING_WEAPON,1,1)],
    passives:[{id:'vector',stacks:1}],
    core:[],activeWeapon:0,weaponSlots:N.START_SLOTS.weapons,passiveSlots:N.START_SLOTS.passives,
    invuln:0,hitFlash:0,shieldDelay:0,dashCharges:1,maxDashCharges:1,dashTimer:0,dashTime:0,dashDir:0,
    buffs:{overclock:0,speed:0,magnet:0},stats:null,
    trail:[],trailTimer:0,spiralDir:1,novaOffset:0,starfallOffset:0,
    totalDamage:0,healAccum:0,dead:false,shieldRegenFx:0
  };
  G.rebuildStats(p,true);
  return p;
}

// ——— level generation ———
function themeFor(level){return N.THEMES[(level-1)%N.THEMES.length];}
function lootFromRng(r,corrupt,level){
  const tierChance=Math.min(.55,.08+level*.035);
  if(corrupt){
    if(r.next()<.62){
      const mods=N.MODS.filter(m=>m.type==='curse');
      const m=r.pick(mods);
      return {kind:'mod',id:m.id,color:m.color};
    }
    if(r.next()<.6){
      const w=r.pick(N.WEAPONS);
      return {kind:'weapon',id:w.id,tier:r.next()<tierChance?3:2,color:w.color};
    }
    const c=r.pick(Object.keys(N.CONSUMABLES));
    return {kind:'consumable',id:c,color:N.CONSUMABLES[c].color};
  }
  const roll=r.next();
  if(roll<.37){
    const w=r.pick(N.WEAPONS);
    const tier=r.next()<tierChance?3:r.next()<.35?2:1;
    return {kind:'weapon',id:w.id,tier,color:w.color};
  }
  if(roll<.82){
    const mods=N.MODS.filter(m=>m.type!=='curse');
    const m=r.pick(mods);
    return {kind:'mod',id:m.id,color:m.color};
  }
  const c=r.pick(Object.keys(N.CONSUMABLES));
  return {kind:'consumable',id:c,color:N.CONSUMABLES[c].color};
}
function generateLevel(levelNum,saved){
  const seed=N.hashString(G.run.seed+'|sector|'+levelNum);
  const r=N.RNG(seed);
  const theme=themeFor(levelNum);
  const hueShift=((levelNum-1)*37)%360;
  const layout=G.run.mapVersion===1?N.Maps.generate(seed):null;
  const width=layout?layout.width:clamp(3000+(levelNum-1)*90,3000,4400);
  const height=layout?layout.height:clamp(2100+(levelNum-1)*70,2100,3200);
  const cx=width/2,cy=height/2;
  const styles=N.ENEMY_STYLES.filter((s,i)=>i%2===((levelNum-1)%2));
  const bossStyle=styles.find(s=>s.role==='boss')||N.ENEMY_BY_ID.archon;
  const wardenStyle=styles.find(s=>s.role==='warden')||N.ENEMY_BY_ID.trinity;
  const platforms=[];
  for(let i=0;i<r.int(24,36);i++){
    const n=r.int(3,9),rad=r.range(45,250);
    const pts=[];for(let j=0;j<n;j++){const a=r.angle();const rr=rad*(.7+r.next()*.45);pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);}
    platforms.push({
      x:r.range(-100,width+100),y:r.range(-100,height+100),pts,rot:r.angle(),spin:r.range(-.035,.035),
      depth:r.range(.2,1),color:r.next()<.65?theme.a:theme.b,alpha:r.range(.04,.14),phase:r.angle()
    });
  }
  // some big hero platforms for silhouette depth
  for(let i=0;i<4;i++){
    const n=r.int(5,9),rad=r.range(220,430);const pts=[];
    for(let j=0;j<n;j++){const a=r.angle();pts.push([Math.cos(a)*rad*(.75+r.next()*.35),Math.sin(a)*rad*(.75+r.next()*.35)]);}
    platforms.push({x:r.range(100,width-100),y:r.range(100,height-100),pts,rot:r.angle(),spin:r.range(-.018,.018),depth:r.range(.4,1),color:theme.b,alpha:r.range(.025,.07),phase:r.angle(),big:true});
  }
  const dust=[];
  for(let i=0;i<150;i++) dust.push({x:r.range(0,width),y:r.range(0,height),r:r.range(.5,2.2),a:r.range(.06,.4),hue:r.range(0,360)});
  const anchors=[];
  const anchorCount=6;
  for(let i=0;i<anchorCount;i++){
    const a=i/anchorCount*TAU+r.range(-.26,.26);
    let x=clamp(cx+Math.cos(a)*width*.335+r.range(-90,90),240,width-240);
    let y=clamp(cy+Math.sin(a)*height*.335+r.range(-90,90),240,height-240);
    if(layout){const pos=N.Maps.place(layout,r,60,anchors,190);x=pos.x;y=pos.y;}
    const hp=Math.round(290+levelNum*55+r.range(-20,35));
    anchors.push({id:'anchor_'+i,x,y,r:32+Math.min(12,levelNum*.7),hp,maxHp:hp,alive:true,angle:r.angle(),type:i%3,attackTimer:r.range(.7,2.2),guardTimer:r.range(4,8),hitFlash:0,phase:r.angle()});
  }
  const caches=[];
  for(let i=0;i<r.int(14,19);i++){
    let x,y,tries=0;
    do{x=r.range(180,width-180);y=r.range(180,height-180);tries++;}while(tries<80&&(N.dist(x,y,cx,cy)<280||anchors.some(a=>N.dist(x,y,a.x,a.y)<190)||caches.some(c=>N.dist(x,y,c.x,c.y)<110)));
    if(layout){const pos=N.Maps.place(layout,r,35,[...anchors,...caches],130);x=pos.x;y=pos.y;}
    const corrupt=r.next()<.18;
    const hp=Math.round(42+levelNum*5+r.range(-8,12));
    caches.push({id:'cache_'+i,x,y,r:17+Math.min(8,levelNum*.4),hp,maxHp:hp,alive:true,angle:r.angle(),spin:r.range(-.5,.5),hitFlash:0,phase:r.angle(),corrupt,loot:lootFromRng(r,corrupt,levelNum)});
  }
  // deterministic style colors get a per-sector hue shift
  const level={
    number:levelNum,seed,width,height,cx,cy,layout,theme,themeIndex:(levelNum-1)%N.THEMES.length,hueShift,
    styles,bossStyle,wardenStyle,platforms,dust,anchors,caches,
    elapsed:0,duration:DURATION,kills:0,damage:0,
    spawnTimer:G.routineSpawnInterval(0,levelNum),surgeTimer:60,anchorGuardTimer:6,
    wardenSpawned:false,bossSpawned:false,
    destroyedAnchors:[],destroyedCaches:[],groundItems:[],
    activeBoss:null,started:false,styleIndex:0
  };
  if(saved){
    level.elapsed=clamp(+saved.elapsed||0,0,DURATION);
    level.wardenSpawned=!!saved.wardenSpawned;
    level.bossSpawned=!!saved.bossSpawned;
    level.kills=+saved.kills||0;
    level.damage=+saved.damage||0;
    const da=new Set(saved.destroyedAnchors||[]); const dc=new Set(saved.destroyedCaches||[]);
    for(const a of anchors){if(da.has(a.id)){a.alive=false;a.hp=0;level.destroyedAnchors.push(a.id);}}
    for(const c of caches){if(dc.has(c.id)){c.alive=false;c.hp=0;level.destroyedCaches.push(c.id);}}
    level.groundItems=(saved.groundItems||[]).map(it=>hydrateGroundItem(it));
  }
  level.cx=cx;level.cy=cy;
  return level;
}
function hydrateGroundItem(it){
  return {
    id:it.id||id('loot'),kind:it.kind,itemId:it.itemId||it.id2||it.weaponId||it.modId||it.consumableId,
    x:it.x,y:it.y,tier:it.tier||1,color:it.color||'#00f0ff',angle:it.angle||Math.random()*TAU,
    phase:it.phase||Math.random()*TAU,pickupDelay:it.pickupDelay==null?0:it.pickupDelay,label:it.label||null
  };
}
function lootItemToGround(loot,x,y,label){
  return {
    id:id('loot'),kind:loot.kind,itemId:loot.id||loot.itemId,x,y,tier:loot.tier||1,
    color:loot.color||'#00f0ff',angle:Math.random()*TAU,phase:Math.random()*TAU,pickupDelay:0,label:label||null
  };
}
function getLootName(it){
  if(!it) return 'UNKNOWN';
  if(it.kind==='weapon'){const w=N.WEAPON_BY_ID[it.itemId]||N.WEAPON_BY_ID[it.weaponId];return w?w.name:'WEAPON';}
  if(it.kind==='mod'){const m=N.MOD_BY_ID[it.itemId]||N.MOD_BY_ID[it.modId];return m?m.name:'MODULE';}
  if(it.kind==='consumable'){const c=N.CONSUMABLES[it.itemId||it.consumableId];return c?c.name:'CONSUMABLE';}
  return 'SIGNAL';
}
G.getLootName=getLootName;

// ——— run lifecycle ———
G.newRun=function(selection,options){
  options=options||{};
  N.Input.resetMovement();
  N.Input.resetFire();
  const seed=Number.isFinite(options.seed)?options.seed>>>0:(Math.random()*0xFFFFFFFF)>>>0;
  G.coopRun=!!options.coop;
  G.run={seed,mapVersion:1,level:1,sectors:0,kills:0,totalTime:0,damage:0,startedAt:Date.now(),lastCheckpointAt:0,checkpointLevel:0};
  G.player=makePlayer();
  Object.assign(G.player,N.Ships.selection(selection));
  G.player.name=options.name||'PLAYER 1';
  G.level=generateLevel(1,null);
  G.player.x=G.level.layout?.spawn.x||G.level.cx;G.player.y=G.level.layout?.spawn.y||G.level.cy;
  G.camera.x=G.player.x;G.camera.y=G.player.y;
  G.camera.shake=0;G.camera.sx=0;G.camera.sy=0;
  G.resetEntityArrays();
  G.mode='playing';
  G.time=0;G.glitch=0;G.checkpointTimer=60;G.nextSurge=60;G.nextWarden=120;G.nextBoss=210;
  G.pendingLevelUps=0;G.overflow=null;G.lastSummary=null;
  N.Rewards.reset();
  G.spawnInitialEnemies();
  G.setMode('playing');
  if(N.UI) N.UI.hideAll();
  if(!options.coop) G.saveCheckpoint(true,'start');
  G.notify(options.coop?'CO-OP SECTOR 01 // LINK ENGAGED':'SECTOR 01 // SURVIVAL PROTOCOL ENGAGED','loot',3000);
  G.triggerGlitch(.45,'#00f0ff');
  N.Audio.glitch();
};
G.resetEntityArrays=function(){
  G.enemies.length=0;G.playerBullets.length=0;G.enemyBullets.length=0;
  G.mines.length=0;G.orbitals.length=0;G.strikes.length=0;
  G.effects.length=0;G.particles.length=0;G.texts.length=0;G.groundItems.length=0;
};
G.pauseGame=function(){
  if(G.mode!=='playing') return false;
  G.setMode('paused');
  N.Input.resetFire();
  N.Audio.ui('back');
  if(N.Coop) N.Coop.onPause(true);
  if(N.UI) N.UI.showPause(G.getPauseData());
  return true;
};
G.returnToCoopPause=function(){
  if(!(N.Coop&&N.Coop.isActive()&&N.Coop.pauseState!=='PLAY')) return false;
  G.setMode('paused');
  N.Audio.setScene('paused');
  N.Coop.showPauseState();
  return true;
};
G.resumeGame=function(){
  if(N.Coop&&N.Coop.isActive()&&!N.Coop._applyingRemote&&N.Coop.pauseState!=='PLAY'){
    if(N.Coop.pauseState==='PAUSED') N.Coop.sendReady();
    G.setMode('paused');
    N.Audio.setScene('paused');
    N.Coop.showPauseState();
    return;
  }
  if(G.mode==='playing') return;
  if(!G.player||G.player.dead){G.setMode('menu');if(N.UI)N.UI.showMenu();return;}
  if(G.overflow){G.openOverflow();return;}
  G.setMode('playing');
  if(N.UI) N.UI.hideAll();
  N.Input.resetFire();
  N.Audio.setScene('game');
  if(N.Coop) N.Coop.onPause(false);
  G.triggerGlitch(.2,'#00f0ff');
};
G.openInventory=function(){
  if(G.mode!=='playing'&&G.mode!=='paused') return false;
  G.inventoryFromGame=G.mode==='playing';
  G.setMode('inventory');
  N.Input.resetFire();
  N.Audio.setScene('paused');
  if(N.UI) N.UI.showInventory(G.getInventoryData());
  return true;
};
G.closeInventory=function(){
  if(G.mode!=='inventory') return;
  if(G.returnToCoopPause()) return;
  if(G.inventoryFromGame){
    G.setMode('playing');
    N.Audio.setScene('game');
    N.Input.resetFire();
    if(N.UI) N.UI.hideAll();
  }else{
    G.setMode('paused');
    N.Audio.setScene('paused');
    if(N.UI) N.UI.showPause(G.getPauseData());
  }
};
G.saveAndQuit=function(){
  if(N.Coop&&N.Coop.isActive()){N.Coop.leaveToMenu();return true;}
  if(!G.run||!G.player||G.player.dead) return false;
  const ok=G.saveCheckpoint(true,'quit');
  G.setMode('menu');
  N.Input.resetFire();
  N.Audio.setScene('menu');
  if(N.UI){N.UI.hideAll();N.UI.showMenu();}
  G.notify(ok?'PROGRESS SYNCED // RETURNING TO NEXUS':'SAVE FAILED // LOCAL STORAGE OFFLINE',ok?'loot':'danger');
  return true;
};
G.completeToMenu=function(){
  if(N.Coop&&N.Coop.isActive()){N.Coop.leaveToMenu();return;}
  G.setMode('menu');
  N.Input.resetFire();
  N.Audio.setScene('menu');
  if(N.UI){N.UI.hideAll();N.UI.showMenu();}
};

G.getSaveInfo=function(){
  const save=N.readSave();
  if(!G.canLoadSave(save)) return null;
  const r=save.run;
  const elapsed=+(save.level&&save.level.elapsed)||0;
  return {
    level:r.level||1,sectors:r.sectors||0,time:r.totalTime?r.totalTime+elapsed:elapsed,
    playerLevel:save.player.level||1,kills:r.kills||0,savedAt:save.savedAt||0,elapsed,
    weapons:(save.player.weapons||[]).length
  };
};
G.saveCheckpoint=function(silent=false,reason='checkpoint'){
  if(N.Coop&&N.Coop.isActive()) return false;
  if(N.SavePolicy && N.SavePolicy.inspect().incompatible) return false;
  if(!G.run||!G.player||!G.level||G.player.dead) return false;
  const p=G.player;
  const data={
    version:SAVE_VERSION,savedAt:Date.now(),
    rewards:N.Rewards.snapshot(),
    run:{seed:G.run.seed,mapVersion:G.run.mapVersion||0,level:G.run.level,sectors:G.run.sectors||0,kills:G.run.kills||0,totalTime:G.run.totalTime||0,damage:G.run.damage||0,startedAt:G.run.startedAt,lastCheckpointAt:Date.now(),checkpointLevel:G.run.level,reason},
    player:{
      x:p.x,y:p.y,hp:p.hp,shield:p.shield,level:p.level,xp:p.xp,xpNext:p.xpNext,heading:p.heading,aim:p.aim,shipType:p.shipType,shipColor:p.shipColor,
      weapons:p.weapons.map(w=>({id:w.id,level:w.level,tier:w.tier})),passives:p.passives.map(m=>({id:m.id,stacks:m.stacks})),
      core:(p.core||[]).slice(),activeWeapon:p.activeWeapon,weaponSlots:p.weaponSlots,passiveSlots:p.passiveSlots,
      dashCharges:p.dashCharges,dashTimer:p.dashTimer,buffs:Object.assign({},p.buffs),invuln:0
    },
    level:{
      elapsed:G.level.elapsed,bossSpawned:G.level.bossSpawned,wardenSpawned:G.level.wardenSpawned,
      kills:G.level.kills,damage:G.level.damage,
      destroyedAnchors:G.level.anchors.filter(a=>!a.alive).map(a=>a.id),
      destroyedCaches:G.level.caches.filter(c=>!c.alive).map(c=>c.id),
      groundItems:G.groundItems.filter(it=>!it.collected).map(it=>({id:it.id,kind:it.kind,itemId:it.itemId,x:it.x,y:it.y,tier:it.tier,color:it.color,angle:it.angle,phase:it.phase,pickupDelay:it.pickupDelay,label:it.label}))
    }
  };
  G.lastCheckpoint=data;
  const ok=N.writeSave(data);
  if(!silent){
    N.Audio.checkpoint();
    G.notify(ok?'CHECKPOINT SYNCED':'CHECKPOINT HELD IN MEMORY // STORAGE OFFLINE','loot',1700);
    G.triggerGlitch(.18,'#b6ff2b');
  }
  return ok;
};
G.restoreCheckpoint=function(){
  if(N.Coop&&N.Coop.isGuest()){G.notify('CO-OP SESSIONS DO NOT USE LOCAL CHECKPOINTS','warn');return false;}
  let save=N.readSave();
  if(!save||save.version!==SAVE_VERSION) save=G.lastCheckpoint;
  if(!save){G.notify('NO CHECKPOINT SIGNAL FOUND','danger');return false;}
  return G.loadFromSave(save,true);
};
function finiteField(value){
  return value==null || Number.isFinite(Number(value));
}
function listField(value){
  return value==null || Array.isArray(value);
}
G.canLoadSave=function(save){
  if(!save || save.version!==SAVE_VERSION || !save.run || typeof save.run!=='object' || Array.isArray(save.run)) return false;
  if(!save.player || typeof save.player!=='object' || Array.isArray(save.player)) return false;
  const run=save.run, player=save.player;
  if(!(run.mapVersion==null || run.mapVersion===0 || run.mapVersion===1)) return false;
  if(!finiteField(run.seed)||!finiteField(run.level)||!finiteField(run.sectors)||!finiteField(run.kills)||!finiteField(run.totalTime)||!finiteField(run.damage)) return false;
  if(!listField(player.weapons)||!listField(player.passives)||!listField(player.core)) return false;
  for(const key of ['x','y','hp','shield','level','xp','xpNext','heading','aim','activeWeapon','weaponSlots','passiveSlots','dashCharges','dashTimer']){
    if(!finiteField(player[key])) return false;
  }
  const level=save.level;
  if(level!=null){
    if(typeof level!=='object' || Array.isArray(level)) return false;
    if(!finiteField(level.elapsed)||!finiteField(level.kills)||!finiteField(level.damage)) return false;
    if(!listField(level.destroyedAnchors)||!listField(level.destroyedCaches)) return false;
    if(!listField(level.groundItems)) return false;
    if(Array.isArray(level.groundItems) && level.groundItems.some(item=>!item || typeof item!=='object' || Array.isArray(item))) return false;
  }
  return true;
};
G.loadFromSave=function(save,fromDeath=false){
  if(!G.canLoadSave(save)) return false;
  try{
    N.Input.resetMovement();
    N.Input.resetFire();
    G.run=Object.assign({
      seed:1,level:1,sectors:0,kills:0,totalTime:0,damage:0,startedAt:Date.now()
    },save.run);
    G.level=generateLevel(G.run.level,save.level||null);
    const p=hydratePlayer(save.player,G.level);
    if(G.level.layout)N.World.move(p,p.x,p.y,N.Ships.get(p.shipType).radius,true);
    G.player=p;
    G.camera.x=p.x;G.camera.y=p.y;
    G.camera.shake=0;G.camera.sx=0;G.camera.sy=0;
    G.camera.zoom=G.zoom;
    G.resetEntityArrays();
    G.groundItems=(save.level&&save.level.groundItems||[]).map(hydrateGroundItem);
    if(G.level.layout)for(const item of G.groundItems)Object.assign(item,N.World.findFree(G.level.layout,item.x,item.y,12));
    G.level.elapsed=clamp(+save.level?.elapsed||0,0,DURATION);
    G.level.wardenSpawned=!!save.level?.wardenSpawned;
    G.level.bossSpawned=!!save.level?.bossSpawned;
    G.level.kills=+save.level?.kills||0;
    G.level.damage=+save.level?.damage||0;
    G.time=0;G.glitch=0;
    G.nextSurge=(Math.floor(G.level.elapsed/60)+1)*60;
    G.nextWarden=G.level.wardenSpawned?9999:120;
    G.nextBoss=G.level.bossSpawned?9999:210;
    G.checkpointTimer=(Math.floor(G.level.elapsed/60)+1)*60;
    // Each pilot level grants exactly one protocol choice. Recover any choices
    // the player had not spent yet when the checkpoint was written (for example
    // a save taken partway through a multi-level-up sequence).
    G.pendingLevelUps=Math.max(0,Math.max(0,p.level-1)-(p.core||[]).length);
    G.overflow=null;
    N.Rewards.reset(save.rewards);
    G.spawnInitialEnemies(4);
    G.lastCheckpoint=save;
    G.setMode('playing');
    if(N.UI) N.UI.hideAll();
    N.Audio.setScene('game');
    N.Audio.checkpoint();
    G.notify('SIGNAL RESTORED // SECTOR '+String(G.run.level).padStart(2,'0'),'loot',2200);
    G.triggerGlitch(.35,'#00f0ff');
    return true;
  }catch(e){
    console.error('load failed',e);
    G.notify('SAVE CORRUPTED // SIGNAL LOST','danger');
    return false;
  }
};
function hydratePlayer(sp,lvl){
  const p={
    x:clamp(+sp.x||lvl.cx,30,lvl.width-30),y:clamp(+sp.y||lvl.cy,30,lvl.height-30),
    vx:0,vy:0,radius:13,aim:Number.isFinite(sp.aim)?N.angleDelta(0,sp.aim):-Math.PI/2,heading:Number.isFinite(sp.heading)?N.angleDelta(0,sp.heading):-Math.PI/2,hp:+sp.hp||1,shield:+sp.shield||0,
    level:Math.max(1,+sp.level||1),xp:Math.max(0,+sp.xp||0),xpNext:Math.max(1,+sp.xpNext||G.xpForLevel(1)),
    weapons:(sp.weapons||[]).filter(w=>w&&N.WEAPON_BY_ID[w.id]).map(w=>makeWeapon(w.id,w.tier||1,w.level||1)),
    passives:(sp.passives||[]).filter(m=>m&&N.MOD_BY_ID[m.id]).map(m=>({id:m.id,stacks:clamp(m.stacks|0,1,N.MOD_BY_ID[m.id].maxStacks||3)})),
    core:(sp.core||[]).filter(id=>N.PROTOCOL_BY_ID[id]),
    activeWeapon:clamp(+sp.activeWeapon||0,0,Math.max(0,(sp.weapons||[]).length-1)),
    weaponSlots:clamp(+sp.weaponSlots||N.START_SLOTS.weapons,1,8),
    passiveSlots:clamp(+sp.passiveSlots||N.START_SLOTS.passives,1,12),
    invuln:0,hitFlash:0,shieldDelay:0,dashCharges:+sp.dashCharges||1,maxDashCharges:1,
    dashTimer:+sp.dashTimer||0,dashTime:0,dashDir:0,buffs:Object.assign({overclock:0,speed:0,magnet:0},sp.buffs||{}),
    stats:null,trail:[],trailTimer:0,spiralDir:1,novaOffset:0,starfallOffset:0,
    totalDamage:0,healAccum:0,dead:false,shieldRegenFx:0
  };
  if(!p.weapons.length) p.weapons=[makeWeapon(N.STARTING_WEAPON,1,1)];
  Object.assign(p,N.Ships.selection(sp));
  p.activeWeapon=clamp(p.activeWeapon,0,p.weapons.length-1);
  G.rebuildStats(p,false);
  p.hp=clamp(+sp.hp||p.stats.maxHp,1,p.stats.maxHp);
  p.shield=clamp(+sp.shield||0,0,p.stats.maxShield);
  p.dashCharges=clamp(+sp.dashCharges||1,0,p.maxDashCharges);
  return p;
}

// ——— inventory interactions ———
G.getInventoryData=function(){
  if(!G.player) return null;
  const p=G.player;
  return {
    weapons:p.weapons.map(w=>({...w,def:N.WEAPON_BY_ID[w.id]})),
    passives:p.passives.map(m=>({...m,def:N.MOD_BY_ID[m.id]})),
    activeWeapon:p.activeWeapon,weaponSlots:p.weaponSlots,passiveSlots:p.passiveSlots,
    stats:p.stats,level:p.level,xp:p.xp,xpNext:p.xpNext,hp:p.hp,shield:p.shield,
    weaponsFull:p.weapons.length>=p.weaponSlots,passivesFull:p.passives.length>=p.passiveSlots
  };
};
G.getPauseData=function(){
  if(!G.player) return null;
  const p=G.player;
  return {
    sector:G.run?.level||1,time:G.level?.elapsed||0,timeLeft:Math.max(0,DURATION-(G.level?.elapsed||0)),
    kills:G.level?.kills||0,totalKills:G.run?.kills||0,level:p.level,hp:p.hp,maxHp:p.stats.maxHp,
    shield:p.shield,maxShield:p.stats.maxShield,weapons:p.weapons.map(w=>N.WEAPON_BY_ID[w.id]?.name||w.id),
    anchorsLeft:G.level?G.level.anchors.filter(a=>a.alive).length:0,anchorsTotal:G.level?G.level.anchors.length:0,
    xp:p.xp,xpNext:p.xpNext,passives:p.passives.map(m=>N.MOD_BY_ID[m.id]?.name||m.id)
  };
};
G.getGameOverData=function(){
  if(!G.player) return null;
  const p=G.player;
  return {
    sector:G.run?.level||1,level:p.level,kills:G.run?.kills||0,sectorKills:G.level?.kills||0,
    time:(G.run?.totalTime||0)+(G.level?.elapsed||0),sectorTime:G.level?.elapsed||0,
    anchors:G.level?G.level.anchors.filter(a=>a.alive).length:0,anchorsTotal:G.level?G.level.anchors.length:0,
    weapons:p.weapons.map(w=>N.WEAPON_BY_ID[w.id]?.name||w.id),damage:Math.round(G.run?.damage||0),
    sectors:G.run?.sectors||0,hasCheckpoint:!!(N.readSave()||G.lastCheckpoint)
  };
};
G.getCompleteData=function(){
  return G.lastSummary;
};
G.getStats=function(){return G.player?G.player.stats:null;};

G.addXp=function(amount){
  const p=G.player;if(!p||p.dead)return;
  const gained=Math.max(0,amount*p.stats.xpMul);
  p.xp+=gained;
  let leveled=0;
  while(p.xp>=p.xpNext && leveled<6){
    p.xp-=p.xpNext;
    p.level++;
    p.xpNext=G.xpForLevel(p.level);
    const ms=N.SLOT_MILESTONES[p.level];
    if(ms){
      if(ms.weapon) p.weaponSlots+=ms.weapon;
      if(ms.passive) p.passiveSlots+=ms.passive;
      G.level.milestoneText=ms.label;
    }else G.level.milestoneText='';
    leveled++;G.pendingLevelUps++;
    G.rebuildStats(p);
    G.triggerGlitch(.5,'#b6ff2b');
  }
  if(leveled){
    G.notify('NEURAL SYNC // LEVEL '+p.level,'loot',2200);
    N.Audio.levelup();
    G.screenFlash('pickup');
    G.checkPendingLevelUp();
  }
};
G.checkPendingLevelUp=function(){
  // Choices wait in the reward tray until the pilot requests them.
};
G.rollProtocols=function(){
  const pool=N.PROTOCOLS.slice();
  const out=[];
  for(let i=0;i<3 && pool.length;i++){
    const total=pool.reduce((s,p)=>s+(p.weight||5),0);
    let x=Math.random()*total,chosen=pool[pool.length-1];
    for(const p of pool){x-=p.weight||5;if(x<=0){chosen=p;break;}}
    out.push(chosen);
    pool.splice(pool.indexOf(chosen),1);
  }
  return out;
};
G.openLevelUp=function(){
  if(G.mode!=='playing') return;
  G.setMode('levelup');
  N.Input.resetFire();
  N.Audio.setScene('paused');
  G.levelUpChoices=G.rollProtocols();
  G.triggerGlitch(.55,'#b6ff2b');
  N.Audio.levelup();
  if(N.UI) N.UI.showLevelUp(G.player,G.levelUpChoices,N.SLOT_MILESTONES[G.player.level]||null);
};
G.applyProtocol=function(pid){
  const p=G.player;const def=N.PROTOCOL_BY_ID[pid];
  if(!p||!def){G.resumeGame();return;}
  p.core.push(pid);
  const heal=def.effect.heal||0;
  G.rebuildStats(p);
  if(heal>0){p.hp=Math.min(p.stats.maxHp,p.hp+heal);}
  G.pendingLevelUps=Math.max(0,G.pendingLevelUps-1);
  N.Audio.pickup(true);
  G.triggerGlitch(.28,def.color);
  G.saveCheckpoint(true,'levelup');
  if(G.returnToCoopPause()) return;
  G.setMode('playing');
  if(N.UI) N.UI.hideAll();
  N.Input.resetFire();
  N.Audio.setScene('game');
  G.notify('PROTOCOL INSTALLED // '+def.name,'loot',1600);
};
G.beginOverflow=function(item,kind,def){
  G.overflow={item,kind,def};
  G.setMode('overflow');
  N.Input.resetFire();
  N.Audio.setScene('paused');
  N.Audio.ui('error');
  G.triggerGlitch(.3,'#ffb31f');
  if(N.UI) N.UI.showOverflow(G.getOverflowData());
};
G.getOverflowData=function(){
  if(!G.overflow) return null;
  return {
    item:G.overflow.item,kind:G.overflow.kind,def:G.overflow.def,
    weapons:G.player.weapons.map(w=>({...w,def:N.WEAPON_BY_ID[w.id]})),
    passives:G.player.passives.map(m=>({...m,def:N.MOD_BY_ID[m.id]})),
    activeWeapon:G.player.activeWeapon,weaponSlots:G.player.weaponSlots,passiveSlots:G.player.passiveSlots
  };
};
G.openOverflow=function(){
  if(G.overflow) G.beginOverflow(G.overflow.item,G.overflow.kind,G.overflow.def);
};
G.leaveOverflow=function(){
  if(!G.overflow) return;
  const o=G.overflow;
  G.notify('ITEM DISCARDED // '+getLootName(o.item),'warn');
  G.overflow=null;
  if(G.returnToCoopPause()) return;
  G.setMode('playing');
  if(N.UI)N.UI.hideAll();
  N.Input.resetFire();N.Audio.setScene('game');
  G.saveCheckpoint(true,'discard');
};
G.swapOverflow=function(type,index){
  const o=G.overflow;if(!o||!G.player)return;
  const p=G.player;
  if(type==='weapon'){
    index=clamp(index|0,0,p.weapons.length-1);
    p.weapons[index]=makeWeapon(o.item.itemId,o.item.tier||1,1);
    p.activeWeapon=index;
  }else{
    index=clamp(index|0,0,p.passives.length-1);
    p.passives[index]={id:o.item.itemId,stacks:1};
  }
  G.rebuildStats(p);
  N.Audio.pickup(true);
  G.triggerGlitch(.32,'#b6ff2b');
  G.notify('SWAPPED // '+getLootName({kind:o.kind,itemId:o.item.itemId,weaponId:o.item.itemId,modId:o.item.itemId}),'loot');
  G.overflow=null;
  if(G.returnToCoopPause()) return;
  G.setMode('playing');
  if(N.UI)N.UI.hideAll();
  N.Input.resetFire();N.Audio.setScene('game');
  G.saveCheckpoint(true,'overflow');
};
G.dropItem=function(type,index){
  const p=G.player;if(!p)return false;
  if(type==='weapon'){
    if(p.weapons.length<=1){G.notify('CANNOT DISCARD LAST WEAPON','danger');N.Audio.ui('error');return false;}
    const w=p.weapons[index];if(!w)return false;
    p.weapons.splice(index,1);
    if(p.activeWeapon>=p.weapons.length)p.activeWeapon=Math.max(0,p.weapons.length-1);
    else if(p.activeWeapon>index)p.activeWeapon--;
    N.Audio.ui('back');
    G.notify('WEAPON DISCARDED // '+getLootName({kind:'weapon',itemId:w.id}),'warn');
    G.saveCheckpoint(true,'discard');
    return true;
  }else{
    const m=p.passives[index];if(!m)return false;
    p.passives.splice(index,1);
    G.rebuildStats(p);
    N.Audio.ui('back');
    G.notify('MODULE DISCARDED // '+getLootName({kind:'mod',itemId:m.id}),'warn');
    G.saveCheckpoint(true,'discard');
    return true;
  }
};

// ——— collect items ———
G.collectGroundItem=function(it,quiet=false,reviewed=false){
  if(!it||it.collected)return;
  const p=G.player;
  const autoAttach=it.kind==='weapon'&&p.weapons.length<p.weaponSlots;
  if(N.Rewards.isEquipment(it)&&!reviewed&&!autoAttach){N.Rewards.bank(it);return;}
  if(it.kind==='consumable'){
    it.collected=true;
    const c=N.CONSUMABLES[it.itemId];
    if(c){
      if(it.itemId==='repair'){p.hp=Math.min(p.stats.maxHp,p.hp+28);G.addText(p.x,p.y-28,'+28 HP','#b6ff2b',13);}
      else if(it.itemId==='shield'){p.shield=Math.min(p.stats.maxShield,p.shield+Math.max(18,p.stats.maxShield*.65));p.shieldRegenFx=1;G.addText(p.x,p.y-28,'SHIELD +','#00f0ff',13);}
      else if(it.itemId==='overclock'){p.buffs.overclock=Math.max(p.buffs.overclock,12);G.addText(p.x,p.y-28,'RATE +35%','#ff2bd6',13);}
      else if(it.itemId==='speed'){p.buffs.speed=Math.max(p.buffs.speed,12);G.addText(p.x,p.y-28,'SPEED +42%','#b6ff2b',13);}
      else if(it.itemId==='magnet'){p.buffs.magnet=Math.max(p.buffs.magnet,9);G.addText(p.x,p.y-28,'MAGNET PULSE','#9d5cff',13);}
      else if(it.itemId==='data'){G.addXp(22);G.addText(p.x,p.y-28,'+22 DATA','#6ad7ff',13);}
      N.Audio.pickup(it.itemId!=='data');
      G.screenFlash('pickup');G.triggerGlitch(.22,c.color);G.shake(2);
      if(!quiet)G.notify(c.name+' ACQUIRED','loot');
    }
    return;
  }
  if(it.kind==='weapon'){
    const def=N.WEAPON_BY_ID[it.itemId];if(!def){it.collected=true;return;}
    const existing=p.weapons.find(w=>w.id===def.id);
    if(existing){
      it.collected=true;
      if(existing.level<5){existing.level++;G.notify(def.name+' // INTEGRATION '+existing.level,'loot');}
      else{G.addXp(14);G.notify(def.name+' // MAX LEVEL — DATA SALVAGED','warn');}
      N.Audio.pickup(true);G.screenFlash('pickup');G.triggerGlitch(.25,def.color);
      return;
    }
    if(p.weapons.length>=p.weaponSlots){
      it.collected=true;
      G.beginOverflow(it,'weapon',def);
      return;
    }
    it.collected=true;
    p.weapons.push(makeWeapon(def.id,it.tier||1,1));
    N.Audio.pickup(true);G.screenFlash('pickup');G.triggerGlitch(.25,def.color);
    if(!quiet)G.notify('WEAPON ACQUIRED // '+def.name,'loot');
    return;
  }
  if(it.kind==='mod'){
    const def=N.MOD_BY_ID[it.itemId];if(!def){it.collected=true;return;}
    const existing=p.passives.find(m=>m.id===def.id);
    if(existing){
      it.collected=true;
      if(existing.stacks<def.maxStacks){existing.stacks++;G.rebuildStats(p);G.notify(def.name+' // STACK '+existing.stacks,'loot');}
      else{G.addXp(12);G.notify(def.name+' // AT MAX — DATA SALVAGED','warn');}
      N.Audio.pickup(true);G.screenFlash('pickup');G.triggerGlitch(.22,def.color);
      return;
    }
    if(p.passives.length>=p.passiveSlots){
      it.collected=true;
      G.beginOverflow(it,'mod',def);
      return;
    }
    it.collected=true;
    p.passives.push({id:def.id,stacks:1});
    G.rebuildStats(p);
    N.Audio.pickup(true);G.screenFlash('pickup');G.triggerGlitch(.25,def.color);
    if(!quiet)G.notify('MODULE ACQUIRED // '+def.name,'loot');
  }
};

// ——— effects & drops ———
G.addText=function(x,y,text,color,size=12){
  if(G.texts.length>MAX_TEXT) G.texts.shift();
  G.texts.push({x,y,text,color,size,life:1,maxLife:1,vy:-30});
};
G.addParticles=function(x,y,color,count=6,opts={}){
  const mult=G.settings.graphics.particles||1;
  const q=G.settings.graphics.quality==='low'?.55:1;
  const n=Math.max(1,Math.round(count*mult*q));
  for(let i=0;i<n;i++){
    if(G.particles.length>=MAX_PARTICLES) G.particles.shift();
    const a=opts.angle!=null?opts.angle+ (Math.random()-.5)*(opts.spread||TAU):Math.random()*TAU;
    const sp=(opts.speed||90)*(.35+Math.random()*.9);
    const life=(opts.life||.55)*(.65+Math.random()*.7);
    G.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life,maxLife:life,size:(opts.size||2)*(.5+Math.random()),color,glow:opts.glow!==false,drag:opts.drag||2.2,kind:opts.kind||'dot',rot:Math.random()*TAU,spin:(Math.random()-.5)*8});
  }
};
G.muzzle=function(x,y,color,angle,scale=4){
  G.addParticles(x,y,color,5,{angle,spread:.55,speed:120,life:.25,size:1.7,glow:true});
  G.effects.push({type:'flash',x,y,angle,color,life:.08,maxLife:.08,size:scale});
};
G.addRing=function(x,y,radius,color,life=.4,width=2,fill=false){
  G.effects.push({type:'ring',x,y,r:2,maxR:radius,color,life,maxLife:life,width,fill});
};
G.addBeam=function(x1,y1,x2,y2,color,width=5,life=.16){
  G.effects.push({type:'beam',x1,y1,x2,y2,color,width,life,maxLife:life});
};
G.addBolt=function(points,color,life=.14,width=2){
  G.effects.push({type:'bolt',points,color,life,maxLife:life,width});
};
G.explode=function(x,y,radius,damage,color,owner='player',opts={}){
  if(N.Coop) N.Coop.onExplosion(x,y,radius,color);
  G.addRing(x,y,radius,color,opts.life||.42,opts.width||2.2);
  G.addParticles(x,y,color,opts.particles||16,{speed:220,life:.7,size:2.2,glow:true});
  G.shake(opts.shake==null?3:opts.shake);
  G.triggerGlitch(opts.glitch==null?.16:opts.glitch,color);
  N.Audio.explosion(opts.big||false);
  if(owner==='player'){
    const srcPlayer=opts.player||G.player;
    for(const e of G.enemies){if(!e.dead&&N.dist2(x,y,e.x,e.y)<(radius+e.r)*(radius+e.r)&&N.World.clear(x,y,e.x,e.y))G.damageEnemy(e,damage,{x,y,explosion:true,source:'explosion',player:srcPlayer});}
    for(const a of G.level.anchors){if(a.alive&&N.dist2(x,y,a.x,a.y)<(radius+a.r)*(radius+a.r)&&N.World.clear(x,y,a.x,a.y))G.damageAnchor(a,damage,{x,y,explosion:true});}
    for(const c of G.level.caches){if(c.alive&&N.dist2(x,y,c.x,c.y)<(radius+c.r)*(radius+c.r)&&N.World.clear(x,y,c.x,c.y))G.damageCache(c,damage,{x,y,explosion:true});}
  }else{
    if(!G.player.dead&&N.Ships.intersectsCircle(G.player,x,y,radius)&&N.World.clear(x,y,G.player.x,G.player.y))G.damagePlayer(damage,x,y,false);
    if(N.Coop&&N.Coop.isHost()){
      for(const rp of N.Coop.remotePlayers){
        if(!rp||rp.dead||rp.invuln>0)continue;
        if(N.Ships.intersectsCircle(rp,x,y,radius)&&N.World.clear(x,y,rp.x,rp.y))N.Coop.sendHit(rp,damage,x,y,false);
      }
    }
    for(const c of G.level.caches){if(c.alive&&N.dist2(x,y,c.x,c.y)<(radius+c.r)*(radius+c.r)&&N.World.clear(x,y,c.x,c.y))G.damageCache(c,damage,{x,y,explosion:true});}
  }
};
G.spawnGroundLoot=function(loot,x,y,label,bossReward=false){
  const paced=N.Rewards.paceLoot(loot,bossReward);
  if(!paced)return null;
  loot=paced;
  if(G.level?.layout){const point=N.World.findFree(G.level.layout,x,y,12);x=point.x;y=point.y;}
  const it=lootItemToGround(loot,x,y,label);
  G.groundItems.push(it);
  G.addRing(x,y,32,it.color,.5,1.4);
  return it;
};
G.dropForEnemy=function(e){
  const role=N.ROLES[e.role]||N.ROLES.rusher;
  const type=role.drop;
  const color=e.color;
  if(role.boss||type==='boss'){
    const w=N.WEAPON_BY_ID[e.role==='boss'?N.WEAPONS[Math.floor(Math.random()*N.WEAPONS.length)].id:N.WEAPONS[Math.floor(Math.random()*N.WEAPONS.length)].id];
    const loots=[];
    loots.push({kind:'weapon',id:w.id,tier:3,color:w.color});
    const mods=N.MODS.filter(m=>m.type!=='curse');
    const m=mods[Math.floor(Math.random()*mods.length)];
    loots.push({kind:'mod',id:m.id,color:m.color});
    const cons=Math.random()<.5?'repair':'shield';
    loots.push({kind:'consumable',id:cons,color:N.CONSUMABLES[cons].color});
    loots.forEach((l,i)=>{
      const a=Math.random()*TAU,rr=30+i*22;
      G.spawnGroundLoot(l,e.x+Math.cos(a)*rr,e.y+Math.sin(a)*rr,l.kind==='weapon'?N.WEAPON_BY_ID[l.id].name:(l.kind==='mod'?N.MOD_BY_ID[l.id].name:N.CONSUMABLES[l.id].name),true);
    });
    return;
  }
  if(type==='weapon'){
    const w=N.WEAPONS[Math.floor(Math.random()*N.WEAPONS.length)];
    G.spawnGroundLoot({kind:'weapon',id:w.id,tier:1+Math.floor(Math.random()*2),color:w.color},e.x,e.y,w.name);
    return;
  }
  const modMap={armor:'armor',rate:'overclock',vitality:'vitality',multi:'multi',pierce:'pierce',explosive:'explosive',prospector:'prospector',ricochet:'ricochet'};
  const consMap={speed:'speed',shield:'shield',repair:'repair',data:'data'};
  if(type==='cursed'){
    const mods=N.MODS.filter(m=>m.type==='curse');
    const m=mods[Math.floor(Math.random()*mods.length)];
    G.spawnGroundLoot({kind:'mod',id:m.id,color:color},e.x,e.y,m.name);
    return;
  }
  if(modMap[type]){
    const m=N.MOD_BY_ID[modMap[type]];
    G.spawnGroundLoot({kind:'mod',id:m.id,color:color},e.x,e.y,m.name);
  }else if(consMap[type]){
    const c=N.CONSUMABLES[consMap[type]];
    G.spawnGroundLoot({kind:'consumable',id:consMap[type],color:color},e.x,e.y,c.name);
  }else{
    G.addXp(8);
  }
};

// expose some internals for the renderer/UI and tests
G.DURATION=DURATION;
G.panOf=panOf;
G.isInMap=isInMap;
G.lootFromRng=lootFromRng;
G.getLootName=getLootName;
G.hydrateGroundItem=hydrateGroundItem;
G.lootItemToGround=lootItemToGround;
G.generateLevel=generateLevel;
G.makeWeapon=makeWeapon;
G.makePlayer=makePlayer;
G.hydratePlayer=hydratePlayer;
G.getTheme=themeFor;
G.rngFor=rngFor;
G.angleTo=angleTo;
})();

/* Paced equipment and player-opened rewards. Kept in a separate closure. */
(function(){
'use strict';
const N=window.NEON,G=N.Game;
const R=N.Rewards={CAPACITY:4,FIRST_SECONDS:18,SECONDS:36,KILLS:8};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
R.isEquipment=item=>item&&(item.kind==='weapon'||item.kind==='mod');
R.validItem=function(item){
  if(!R.isEquipment(item))return null;
  const def=(item.kind==='weapon'?N.WEAPON_BY_ID:N.MOD_BY_ID)[item.itemId];
  if(!def)return null;
  return {kind:item.kind,itemId:def.id,tier:Math.max(1,Math.min(3,Math.floor(finite(item.tier,1)))),color:def.color};
};
R.reset=function(saved){
  G.rewardState={
    combat:Math.max(0,Math.min(saved?.first===false?R.SECONDS:R.FIRST_SECONDS,finite(saved?.combat))),
    kills:Math.max(0,Math.min(R.KILLS,Math.floor(finite(saved?.kills)))),
    first:saved?.first!==false,
    pending:(Array.isArray(saved?.pending)?saved.pending:[]).map(R.validItem).filter(Boolean).slice(0,R.CAPACITY)
  };
};
R.state=()=>G.rewardState||(R.reset(),G.rewardState);
R.snapshot=function(){
  const s=R.state(),pending=s.pending.slice();
  // Preserve a replacement choice that has already been removed from the tray.
  if(G.overflow){const item=R.validItem(G.overflow.item);if(item)pending.unshift(item);}
  return {combat:s.combat,kills:s.kills,first:s.first,pending:pending.slice(0,R.CAPACITY)};
};
R.tick=function(dt){
  if(G.mode!=='playing'||document.hidden||!document.hasFocus())return;
  if(!G.enemies.some(e=>!e.dead))return;
  const s=R.state();s.combat=Math.min(s.first?R.FIRST_SECONDS:R.SECONDS,s.combat+Math.max(0,finite(dt)));
};
R.onKill=function(){const s=R.state();s.kills=Math.min(R.KILLS,s.kills+1);};
R.requiredKills=()=>Math.max(4,Math.ceil(R.KILLS/Math.max(1,finite(G.player?.stats.luck,1))));
R.ready=function(){const s=R.state();return s.combat>=(s.first?R.FIRST_SECONDS:R.SECONDS)&&s.kills>=R.requiredKills();};
R.paceLoot=function(loot,bossReward=false){
  if(!R.isEquipment(loot)||bossReward)return loot;
  if(R.ready()){
    const s=R.state();s.combat=0;s.kills=0;s.first=false;
    return loot;
  }
  // Withhold gear without changing healing, buffs, or XP drop rates.
  return null;
};
R.bank=function(item){
  const s=R.state();if(s.pending.length>=R.CAPACITY)return false;
  const saved=R.validItem(item);if(!saved){item.collected=true;return true;}
  s.pending.push(saved);item.collected=true;
  G.notify('EQUIPMENT BANKED // OPEN REWARDS WHEN READY','loot',1600);
  return true;
};
R.count=()=>R.state().pending.length+G.pendingLevelUps;
G.openRewards=function(){
  if((G.mode!=='playing'&&G.mode!=='paused')||!G.player||G.player.dead)return false;
  G.setMode('rewards');N.Input.resetFire();N.Audio.setScene('paused');
  N.UI.showRewards();return true;
};
G.closeRewards=function(){
  if(G.mode!=='rewards') return;
  if(G.returnToCoopPause()) return;
  G.resumeGame();
};
G.takeReward=function(index){
  if(G.mode!=='rewards')return;
  const pending=R.state().pending;
  if(!Number.isInteger(index)||index<0||index>=pending.length)return;
  const item=pending.splice(index,1)[0];
  G.collectGroundItem(item,false,true);
  G.saveCheckpoint(true,'reward');
  if(G.mode==='rewards')N.UI.showRewards();
};
G.discardReward=function(index){
  if(G.mode!=='rewards'||!Number.isInteger(index)||index<0||index>=R.state().pending.length)return;
  R.state().pending.splice(index,1);G.saveCheckpoint(true,'discard');N.UI.showRewards();
};
G.choosePendingProtocol=function(){
  if(G.mode!=='rewards'||G.pendingLevelUps<=0)return;
  G.setMode('playing');G.openLevelUp();
};
})();
