/* NEON NEXUS — game content: weapons, modules, protocols, enemies */
(function(){
'use strict';
const N=window.NEON;
const TAU=N.TAU;
const clamp=N.clamp;
// Balance: gently ramp from sector 1 to the previous routine intensity at 10.
// Scripted encounters retain their schedules; required wardens/bosses bypass cap.
N.SPAWN_TUNING={routineIntervalMultiplier:1.25,
  initialPopulationMultiplier:.5,initialPopulationPerSector:1,
  gentleInterval:5,gentleGroupSize:2,gentlePopulationCap:15,fullIntensitySector:10};

function wDamage(g,w,base,extra=1){
  return base*g.stats.damageMul*(1+(w.level-1)*.17)*(1+(w.tier-1)*.12)*extra;
}
function wSpeed(g,base){return base*g.stats.speedMul;}
function wSize(g,base){return base*g.stats.sizeMul;}
function wLife(g,base){return base*g.stats.durationMul;}
function wCount(g,w,base,allowMulti=true){
  const n=Math.round(base+(allowMulti?(g.stats.multishot||0):0));
  return clamp(n,1,w.base.maxCount||26);
}
function spawn(g,w,angle,opts={}){
  const p=g.player;
  const dist=opts.offset==null?20:opts.offset;
  const x=(opts.x==null?p.x+Math.cos(angle)*dist:opts.x);
  const y=(opts.y==null?p.y+Math.sin(angle)*dist:opts.y);
  g.spawnBullet(Object.assign({
    x,y,angle,
    speed:wSpeed(g,opts.speed==null?700:opts.speed),
    damage:wDamage(g,w,opts.damage==null?10:opts.damage),
    size:wSize(g,opts.size==null?2.4:opts.size),
    life:wLife(g,opts.life==null?1:opts.life),
    color:w.color,
    kind:opts.kind||'pulse',
    weaponId:w.id,
    pierce:(opts.pierce||0)+g.stats.pierce,
    bounce:(opts.bounce||0)+g.stats.bounce,
    chain:(opts.chain||0)+g.stats.chain,
    aoe:opts.aoe?opts.aoe*g.stats.areaMul:0,
    critChance:g.stats.critChance,
    critMul:g.stats.critMul,
    hitSet:new Set()
  },opts));
}

N.WEAPONS=[
  {id:'pulse',name:'PULSE LANCE',tag:'TWIN-BEAM / RAPID',color:'#00f0ff',sound:'pulse',rarity:'STANDARD',
   desc:'A disciplined twin-lance. Fast, precise, and hungry for open lanes.',
   base:{damage:7,cooldown:.135,speed:1040,size:2.2,life:1.15,count:2,maxCount:10},
   fire(g,w,aim){
     const n=wCount(g,w,2), gap=5.2;
     for(let i=0;i<n;i++){
       const off=(i-(n-1)/2)*gap;
       const a=aim+(i-(n-1)/2)*.018;
       spawn(g,w,a,{kind:'pulse',offset:22,x:g.player.x+Math.cos(a)*22+Math.cos(a+Math.PI/2)*off,y:g.player.y+Math.sin(a)*22+Math.sin(a+Math.PI/2)*off,speed:1040,damage:7,size:2.2,life:1.15});
     }
     g.muzzle(g.player.x+Math.cos(aim)*22,g.player.y+Math.sin(aim)*22,w.color,aim);
   }},
  {id:'scatter',name:'SCATTERGUN',tag:'CLOSE RANGE / FAN',color:'#ff7a1f',sound:'scatter',rarity:'STANDARD',
   desc:'A broad cone of burning shrapnel. Devastating at contact range.',
   base:{damage:5,cooldown:.55,speed:780,size:2.8,life:.42,count:5,maxCount:14,spread:.62},
   fire(g,w,aim){
     const n=wCount(g,w,5), spread=w.base.spread;
     for(let i=0;i<n;i++){
       const t=n===1?0:(i/(n-1)-.5);
       const a=aim+t*spread+(Math.random()-.5)*.025;
       spawn(g,w,a,{kind:'scatter',offset:18,speed:780+(Math.random()-.5)*100,damage:5,size:2.8,life:.42,trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*18,g.player.y+Math.sin(aim)*18,w.color,aim);
     g.shake(2.2);
   }},
  {id:'rail',name:'RAILSPIKE',tag:'HYPERVELOCITY / PIERCE',color:'#ff2bd6',sound:'rail',rarity:'RARE',
   desc:'A single tungsten spine accelerated through six magnetic rings. It does not stop.',
   base:{damage:34,cooldown:.82,speed:1950,size:3.4,life:.8,count:1,maxCount:4,pierce:3},
   fire(g,w,aim){
     spawn(g,w,aim,{kind:'rail',offset:26,speed:1950,damage:34,size:3.4,life:.8,pierce:3,trail:true,shake:4});
     g.muzzle(g.player.x+Math.cos(aim)*26,g.player.y+Math.sin(aim)*26,w.color,aim,8);
     g.shake(4.5);
   }},
  {id:'spiral',name:'SPIRAL CORE',tag:'CURVED / SATURATION',color:'#9d5cff',sound:'spiral',rarity:'RARE',
   desc:'Twin payloads that carve opposing arcs through the dark. Aim creates the axis.',
   base:{damage:7,cooldown:.14,speed:520,size:3,life:1.7,count:2,maxCount:10},
   fire(g,w,aim){
     const n=wCount(g,w,2), dir=(g.player.spiralDir=(g.player.spiralDir||1)*-1);
     for(let i=0;i<n;i++){
       const t=n===1?0:(i/(n-1)-.5);
       const a=aim+t*.32;
       spawn(g,w,a,{kind:'spiral',offset:18,speed:520,damage:7,size:3,life:1.7,curve:dir*(2.5+Math.random()*.7),trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*18,g.player.y+Math.sin(aim)*18,w.color,aim);
   }},
  {id:'seeker',name:'SEEKER SWARM',tag:'HOMING / LAUNCH',color:'#b6ff2b',sound:'seeker',rarity:'RARE',
   desc:'Micro-thrusters with a single instruction: find the nearest signal and end it.',
   base:{damage:13,cooldown:.88,speed:320,size:4,life:2.5,count:2,maxCount:8},
   fire(g,w,aim){
     const n=wCount(g,w,2);
     for(let i=0;i<n;i++){
       const a=aim+(i-(n-1)/2)*.28;
       spawn(g,w,a,{kind:'seeker',offset:20,speed:320,damage:13,size:4,life:2.5,accel:430,homing:true,turnRate:4.2,trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*20,g.player.y+Math.sin(aim)*20,w.color,aim);
   }},
  {id:'nova',name:'NOVA RING',tag:'RADIAL / CROWD CONTROL',color:'#00f0ff',sound:'nova',rarity:'RARE',
   desc:'An expanding crown of hard light. The ring rotates each shot to deny every angle.',
   base:{damage:9,cooldown:1.08,speed:540,size:2.6,life:.95,count:12,maxCount:26},
   fire(g,w,aim){
     const n=wCount(g,w,12);
     g.player.novaOffset=(g.player.novaOffset||0)+.31;
     for(let i=0;i<n;i++){
       const a=g.player.novaOffset+i/n*TAU;
       spawn(g,w,a,{kind:'nova',offset:14,x:g.player.x+Math.cos(a)*14,y:g.player.y+Math.sin(a)*14,speed:540,damage:9,size:2.6,life:.95,trail:true});
     }
     g.muzzle(g.player.x,g.player.y,w.color,aim,10);
     g.shake(2.5);
   }},
  {id:'mortar',name:'MORTAR POD',tag:'ARC / AREA DENIAL',color:'#ffb31f',sound:'mortar',rarity:'RARE',
   desc:'Lobs a volatile charge toward your aim point. Detonates in a bloom of plasma.',
   base:{damage:30,cooldown:1.05,speed:600,size:6,life:.68,count:1,maxCount:5,aoe:92},
   fire(g,w,aim){
     const n=wCount(g,w,1);
     for(let i=0;i<n;i++){
       const a=aim+(i-(n-1)/2)*.16;
       const dist=430;
       const x=g.player.x+Math.cos(a)*26;
       const y=g.player.y+Math.sin(a)*26;
       spawn(g,w,a,{kind:'mortar',x,y,offset:0,speed:dist/.68,damage:30,size:6,life:.68,aoe:92,trail:true,explode:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*20,g.player.y+Math.sin(aim)*20,w.color,aim);
     g.shake(2.4);
   }},
  {id:'mine',name:'MINE LAYER',tag:'TRAP / PROXIMITY',color:'#ff335c',sound:'mine',rarity:'STANDARD',
   desc:'Leaves a smart proximity charge in your wake. Hostiles learn to fear the floor.',
   base:{damage:34,cooldown:.62,count:1,maxCount:4,aoe:88},
   fire(g,w,aim){
     const n=wCount(g,w,1);
     for(let i=0;i<n;i++){
       const a=aim+Math.PI+(i-(n-1)/2)*.7;
       const x=g.player.x+Math.cos(a)*42+(Math.random()-.5)*12;
       const y=g.player.y+Math.sin(a)*42+(Math.random()-.5)*12;
       g.spawnMine({x,y,damage:wDamage(g,w,34),radius:88*g.stats.areaMul,color:w.color,life:9,armTime:.45,weaponId:w.id});
     }
     g.muzzle(g.player.x+Math.cos(aim)*16,g.player.y+Math.sin(aim)*16,w.color,aim);
   }},
  {id:'tesla',name:'ARC TESLA',tag:'CHAIN LIGHTNING / INSTANT',color:'#6ad7ff',sound:'tesla',rarity:'PROTOTYPE',
   desc:'A directed ion storm. Arcs jump between nearby targets without asking permission.',
   base:{damage:12,cooldown:.3,count:1,maxCount:4,chain:3},
   fire(g,w,aim){
     const hit=g.arcBolt(aim,wDamage(g,w,12),w.color,3+g.stats.chain,520);
     if(!hit){
       spawn(g,w,aim,{kind:'tesla',offset:20,speed:1200,damage:12,size:2,life:.28,trail:true,chain:2});
     }
     g.muzzle(g.player.x+Math.cos(aim)*20,g.player.y+Math.sin(aim)*20,w.color,aim,6);
   }},
  {id:'beam',name:'PRISM BEAM',tag:'HITSCAN / LINE',color:'#b6ff2b',sound:'beam',rarity:'PROTOTYPE',
   desc:'Refracts a hard-light lance through a floating prism. Everything on the line is hit.',
   base:{damage:19,cooldown:.22,count:1,maxCount:4},
   fire(g,w,aim){
     g.beam(aim,wDamage(g,w,19),w.color,690,7);
     g.muzzle(g.player.x+Math.cos(aim)*20,g.player.y+Math.sin(aim)*20,w.color,aim,7);
   }},
  {id:'orb',name:'VOID ORB',tag:'SLOW / GRAVITY / DoT',color:'#9d5cff',sound:'orb',rarity:'PROTOTYPE',
   desc:'A contained absence that drags matter inward and eats it in slow pulses.',
   base:{damage:7,cooldown:.62,speed:120,size:12,life:2.7,count:1,maxCount:4,aoe:34},
   fire(g,w,aim){
     const n=wCount(g,w,1);
     for(let i=0;i<n;i++){
       const a=aim+(i-(n-1)/2)*.3;
       spawn(g,w,a,{kind:'void',offset:30,speed:120,damage:7,size:12,life:2.7,aoe:34*g.stats.areaMul,pull:280,tick:.26,dot:true,trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*22,g.player.y+Math.sin(aim)*22,w.color,aim);
   }},
  {id:'chain',name:'CHAIN DRIVER',tag:'CHAIN / PRECISION',color:'#ff2bd6',sound:'chain',rarity:'RARE',
   desc:'A rail bolt carrying a recursive fracture. Every impact seeds the next.',
   base:{damage:16,cooldown:.48,speed:880,size:2.8,life:1.15,count:1,maxCount:5,chain:2},
   fire(g,w,aim){
     const n=wCount(g,w,1);
     for(let i=0;i<n;i++){
       const a=aim+(i-(n-1)/2)*.06;
       spawn(g,w,a,{kind:'chain',offset:22,speed:880,damage:16,size:2.8,life:1.15,chain:2,trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*22,g.player.y+Math.sin(aim)*22,w.color,aim);
   }},
  {id:'shard',name:'SHARD FAN',tag:'RICHOCHET / FAN',color:'#ffb31f',sound:'shard',rarity:'STANDARD',
   desc:'Three razor shards with a tendency to find another wall. And another.',
   base:{damage:8,cooldown:.34,speed:760,size:3.4,life:1.05,count:3,maxCount:12,spread:.78,bounce:2},
   fire(g,w,aim){
     const n=wCount(g,w,3), spread=w.base.spread;
     for(let i=0;i<n;i++){
       const t=n===1?0:(i/(n-1)-.5);
       const a=aim+t*spread+(Math.random()-.5)*.03;
       spawn(g,w,a,{kind:'shard',offset:18,speed:760,damage:8,size:3.4,life:1.05,bounce:2,trail:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*18,g.player.y+Math.sin(aim)*18,w.color,aim);
   }},
  {id:'gravity',name:'GRAVITY WELL',tag:'PULL / IMPLOSION',color:'#6ad7ff',sound:'gravity',rarity:'PROTOTYPE',
   desc:'Compresses local geometry into a point. Then releases the point.',
   base:{damage:26,cooldown:1.4,speed:300,size:8,life:.75,count:1,maxCount:4,aoe:120},
   fire(g,w,aim){
     const n=wCount(g,w,1);
     for(let i=0;i<n;i++){
       const a=aim+(i-(n-1)/2)*.18;
       spawn(g,w,a,{kind:'gravity',offset:28,speed:300,damage:26,size:8,life:.75,aoe:120*g.stats.areaMul,pull:820,trail:true,explode:true});
     }
     g.muzzle(g.player.x+Math.cos(aim)*20,g.player.y+Math.sin(aim)*20,w.color,aim);
   }},
  {id:'starfall',name:'STARFALL',tag:'ORBITAL STRIKE / AREA',color:'#ffb31f',sound:'starfall',rarity:'PROTOTYPE',
   desc:'Calls down four guided meteor fragments. The sky is part of the arsenal.',
   base:{damage:26,cooldown:1.35,count:4,maxCount:10,aoe:74},
   fire(g,w,aim){
     const n=wCount(g,w,4);
     const cx=g.player.x+Math.cos(aim)*400;
     const cy=g.player.y+Math.sin(aim)*400;
     for(let i=0;i<n;i++){
       const a=i/n*TAU+(g.player.starfallOffset||0);
       const r=i===0?0:55+ (i%2)*30;
       g.spawnStrike({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,delay:.55+i*.04,radius:74*g.stats.areaMul,damage:wDamage(g,w,26),color:w.color});
     }
     g.player.starfallOffset=(g.player.starfallOffset||0)+.55;
     g.muzzle(cx,cy,w.color,aim);
   }},
  {id:'shuriken',name:'SHURIKEN ORBIT',tag:'ORBITAL / CONTACT',color:'#b6ff2b',sound:'shuriken',rarity:'PROTOTYPE',
   desc:'Deploys autonomous spinning blades that orbit your chassis. They stay. They hunger.',
   base:{damage:11,cooldown:.78,count:2,maxCount:10,life:6},
   fire(g,w,aim){
     const n=wCount(g,w,2);
     g.spawnOrbital({count:n,damage:wDamage(g,w,11),color:w.color,life:6*g.stats.durationMul,radius:58,spin:2.8,weaponId:w.id});
     g.muzzle(g.player.x,g.player.y,w.color,aim);
   }}
];
N.WEAPON_BY_ID=Object.fromEntries(N.WEAPONS.map(w=>[w.id,w]));
N.STARTING_WEAPON='pulse';

// ——— passive modules ———
N.MODS=[
  {id:'kinetic',name:'KINETIC AMP',tag:'DAMAGE +15%',color:'#ffb31f',glyph:'dmg',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'Hardens every projectile with an extra layer of motive violence.',effect:{damageMul:.15}},
  {id:'overclock',name:'OVERCLOCK CHIP',tag:'FIRE RATE +12%',color:'#ff2bd6',glyph:'rate',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'Runs the firing bus past its rated ceiling. Heat is someone else’s problem.',effect:{rateMul:.12}},
  {id:'vector',name:'VECTOR BOOST',tag:'PROJECTILE SPEED +16%',color:'#00f0ff',glyph:'speed',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'A tighter acceleration curve. Shots reach the target before doubt does.',effect:{speedMul:.16}},
  {id:'multi',name:'MULTISHOT LATTICE',tag:'+1 PROJECTILE',color:'#b6ff2b',glyph:'multi',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'Splits each firing event through a folded lattice. More is always an option.',effect:{multishot:1}},
  {id:'pierce',name:'PIERCING ROUNDS',tag:'PIERCE +1',color:'#ff335c',glyph:'pierce',rarity:'RARE',maxStacks:3,type:'buff',
   desc:'Monomolecular tips. The first body is only a suggestion.',effect:{pierce:1}},
  {id:'ricochet',name:'RICHOCHET MODULE',tag:'BOUNCE +1',color:'#ffb31f',glyph:'bounce',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'A reactive casing that refuses to let walls end the conversation.',effect:{bounce:1}},
  {id:'chainarc',name:'CHAIN ARC',tag:'CHAIN +1',color:'#6ad7ff',glyph:'chain',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'Every impact seeds an electrostatic bridge to the next hostile.',effect:{chain:1}},
  {id:'crit',name:'CRIT MATRIX',tag:'CRIT +7% / +25% DMG',color:'#ff2bd6',glyph:'crit',rarity:'RARE',maxStacks:3,type:'buff',
   desc:'A probability engine that occasionally insists on a much larger number.',effect:{critChance:.07,critMul:.25}},
  {id:'vitality',name:'VITALITY WEAVE',tag:'MAX HP +22',color:'#b6ff2b',glyph:'hp',rarity:'COMMON',maxStacks:4,type:'buff',
   desc:'Woven bio-fiber replaces what the sector keeps trying to remove.',effect:{maxHp:22}},
  {id:'nano',name:'NANO REPAIR',tag:'REGEN +0.45/s',color:'#b6ff2b',glyph:'regen',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'A slow, stubborn swarm that stitches the pilot back together.',effect:{regen:.45}},
  {id:'armor',name:'ARMOR PLATE',tag:'DAMAGE TAKEN −3',color:'#ffb31f',glyph:'armor',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'Layered ceramic over the vital geometry. The impact still hurts. Less.',effect:{armor:3}},
  {id:'shieldcell',name:'SHIELD CELL',tag:'MAX SHIELD +20',color:'#00f0ff',glyph:'shield',rarity:'RARE',maxStacks:3,type:'buff',
   desc:'A second skin of cold plasma that reknits after a brief silence.',effect:{maxShield:20,shieldRegenMul:.18}},
  {id:'phase',name:'PHASE CAPACITOR',tag:'DASH +1 / FASTER',color:'#9d5cff',glyph:'dash',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'Stores an extra slip through local space. Recharge coils run colder.',effect:{dashCharges:1,dashRecharge:-.35}},
  {id:'servo',name:'SERVO BOOST',tag:'MOVE SPEED +9%',color:'#00f0ff',glyph:'move',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'Leg actuators receive a firmware update. The floor becomes optional.',effect:{moveMul:.09}},
  {id:'magnet',name:'MAGNET COIL',tag:'PICKUP RANGE +42%',color:'#9d5cff',glyph:'magnet',rarity:'COMMON',maxStacks:2,type:'buff',
   desc:'Bends loose loot toward your chassis. Convenience as a force field.',effect:{pickupMul:.42}},
  {id:'prospector',name:'PROSPECTOR LENS',tag:'LUCK +18%',color:'#ffb31f',glyph:'luck',rarity:'COMMON',maxStacks:2,type:'buff',
   desc:'Marks valuable matter through static. More caches. Better signals.',effect:{luck:.18}},
  {id:'xpdecoder',name:'XP DECODER',tag:'DATA GAIN +20%',color:'#6ad7ff',glyph:'xp',rarity:'COMMON',maxStacks:3,type:'buff',
   desc:'Compresses hostile telemetry into usable neural data.',effect:{xpMul:.2}},
  {id:'thorns',name:'THORNS ARRAY',tag:'CONTACT REFLECT 12',color:'#ff335c',glyph:'thorns',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'A reactive hull that answers every collision with interest.',effect:{thorns:12}},
  {id:'explosive',name:'EXPLOSIVE PAYLOAD',tag:'IMPACT BLAST 16%',color:'#ff7a1f',glyph:'blast',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'A volatile filler that occasionally turns any impact into a local event.',effect:{explodeChance:.16,explodeRadius:.12}},
  {id:'siphon',name:'VOID SIPHON',tag:'LIFESTEAL 3%',color:'#ff2bd6',glyph:'leech',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'Converts a fraction of outgoing damage into reclaimed vitality.',effect:{lifesteal:.03}},
  {id:'temporal',name:'TEMPORAL FUSE',tag:'DURATION +20% / AREA +10%',color:'#9d5cff',glyph:'time',rarity:'COMMON',maxStacks:2,type:'buff',
   desc:'Stretches local time around your deployed effects. They linger, patient.',effect:{durationMul:.2,areaMul:.1}},
  {id:'glitchmembrane',name:'GLITCH MEMBRANE',tag:'DODGE +6%',color:'#00f0ff',glyph:'dodge',rarity:'RARE',maxStacks:2,type:'buff',
   desc:'A refractive skin that occasionally renders an incoming hit obsolete.',effect:{dodge:.06}},
  {id:'cursed_berserk',name:'BERSERKER CIRCUIT',tag:'DMG +35% / HP −20',color:'#ff335c',glyph:'curse',rarity:'CURSE',maxStacks:2,type:'curse',
   desc:'A redlined combat governor. Your body is part of the fuel calculation.',effect:{damageMul:.35,maxHp:-20}},
  {id:'cursed_blood',name:'BLOOD ENGINE',tag:'RATE +25% / HP −15',color:'#ff335c',glyph:'curse',rarity:'CURSE',maxStacks:2,type:'curse',
   desc:'A forbidden coolant loop. Faster fire. Warmer blood.',effect:{rateMul:.25,maxHp:-15}},
  {id:'cursed_void',name:'VOID PACT',tag:'DMG +40% / DMG TAKEN +18%',color:'#ff2bd6',glyph:'curse',rarity:'CURSE',maxStacks:2,type:'curse',
   desc:'Borrows mass from an unlisted dimension. It expects repayment.',effect:{damageMul:.4,damageTakenMul:.18}},
  {id:'cursed_glitch',name:'GLITCH PACT',tag:'CRIT +15% / DODGE −4%',color:'#9d5cff',glyph:'curse',rarity:'CURSE',maxStacks:2,type:'curse',
   desc:'Your hitbox and the universe disagree about where you are. Mostly in your favor.',effect:{critChance:.15,dodge:-.04}}
];
N.MOD_BY_ID=Object.fromEntries(N.MODS.map(m=>[m.id,m]));

// ——— consumables ———
N.CONSUMABLES={
  repair:{name:'REPAIR CELL',tag:'RESTORE 28 HP',color:'#b6ff2b',glyph:'hp',desc:'A sealed pack of bio-repair foam. Tastes like static.'},
  shield:{name:'SHIELD SURGE',tag:'RESTORE SHIELD',color:'#00f0ff',glyph:'shield',desc:'Flashes the plasma skin back to full density.'},
  overclock:{name:'OVERCLOCK AMP',tag:'FIRE RATE +35% / 12s',color:'#ff2bd6',glyph:'rate',desc:'A disposable redline charge. Burns bright and fast.'},
  speed:{name:'SERVO STIM',tag:'MOVE +42% / 12s',color:'#b6ff2b',glyph:'move',desc:'A combat stim that turns every corridor into a straight line.'},
  magnet:{name:'MAGNET PULSE',tag:'VACUUM LOOT / 9s',color:'#9d5cff',glyph:'magnet',desc:'Overloads the coil. Loose signals cannot resist.'},
  data:{name:'DATA SHARD',tag:'+22 XP',color:'#6ad7ff',glyph:'xp',desc:'A splinter of compressed hostile memory. Absorb it.'}
};

// ——— level-up protocols ———
N.PROTOCOLS=[
  {id:'p_dmg',name:'WEAPON SYNC',tag:'DAMAGE +20%',color:'#ffb31f',desc:'Route additional current through every weapon bus.',effect:{damageMul:.2},weight:10},
  {id:'p_rate',name:'CYCLE BREAK',tag:'FIRE RATE +15%',color:'#ff2bd6',desc:'Remove the safety interlock from the firing cycle.',effect:{rateMul:.15},weight:10},
  {id:'p_move',name:'KINETIC LEGS',tag:'MOVE SPEED +12%',color:'#00f0ff',desc:'Recalibrate the servo array for lateral velocity.',effect:{moveMul:.12},weight:9},
  {id:'p_hp',name:'HULL WEAVE',tag:'MAX HP +28 / HEAL 28',color:'#b6ff2b',desc:'Grow the hull lattice and immediately fill the new volume.',effect:{maxHp:28,heal:28},weight:9},
  {id:'p_shield',name:'PLASMA SHELL',tag:'MAX SHIELD +25',color:'#6ad7ff',desc:'Expand the cold plasma envelope around your core.',effect:{maxShield:25,shieldRegenMul:.12},weight:8},
  {id:'p_crit',name:'PROBABILITY SPIKE',tag:'CRIT +9% / CRIT DMG +30%',color:'#ff2bd6',desc:'Bias the local probability field toward violent outcomes.',effect:{critChance:.09,critMul:.3},weight:8},
  {id:'p_multi',name:'FORK PROTOCOL',tag:'+1 PROJECTILE',color:'#b6ff2b',desc:'Every firing event forks once more. Geometry complains.',effect:{multishot:1},weight:4},
  {id:'p_pierce',name:'PHASE TIPS',tag:'PIERCE +1',color:'#ff335c',desc:'Projectiles spend a fraction of their flight outside normal space.',effect:{pierce:1},weight:7},
  {id:'p_area',name:'BLOOM CAPACITOR',tag:'AREA +18% / SIZE +8%',color:'#ffb31f',desc:'Expand every detonation and projectile envelope.',effect:{areaMul:.18,sizeMul:.08},weight:7},
  {id:'p_pickup',name:'GRAVITIC RETRIEVAL',tag:'PICKUP RANGE +50%',color:'#9d5cff',desc:'Bend loose matter toward your chassis from farther away.',effect:{pickupMul:.5},weight:7},
  {id:'p_xp',name:'NEURAL DECOMPRESS',tag:'DATA GAIN +25%',color:'#6ad7ff',desc:'Unpack hostile telemetry with less loss.',effect:{xpMul:.25},weight:7},
  {id:'p_dash',name:'SLIP CAPACITOR',tag:'DASH CHARGE +1',color:'#9d5cff',desc:'Store an additional phase slip. Recharge coils run faster.',effect:{dashCharges:1,dashRecharge:-.25},weight:4},
  {id:'p_regen',name:'AUTO-REPAIR',tag:'REGEN +0.55/s',color:'#b6ff2b',desc:'A persistent repair loop that never quite finishes.',effect:{regen:.55},weight:7},
  {id:'p_armor',name:'CERAMIC LAYER',tag:'DAMAGE TAKEN −2',color:'#ffb31f',desc:'Bolt another ceramic plate over the vital geometry.',effect:{armor:2},weight:8},
  {id:'p_leech',name:'VOID RETURN',tag:'LIFESTEAL +2.5%',color:'#ff2bd6',desc:'Reclaim vitality from every confirmed impact.',effect:{lifesteal:.025},weight:4},
  {id:'p_proj',name:'MAGNETIC SPINE',tag:'PROJECTILE SPEED +18%',color:'#00f0ff',desc:'Reduce drag and increase coil acceleration.',effect:{speedMul:.18},weight:8},
  {id:'p_luck',name:'SIGNAL LUCK',tag:'LUCK +20%',color:'#ffb31f',desc:'Tune the recovery antenna toward valuable matter.',effect:{luck:.2},weight:6},
  {id:'p_thorns',name:'RETALIATION',tag:'CONTACT REFLECT +12',color:'#ff335c',desc:'The hull now answers collisions directly.',effect:{thorns:12},weight:6},
  {id:'p_duration',name:'STASIS FIELD',tag:'DURATION +22%',color:'#9d5cff',desc:'Hold deployed effects in local time a little longer.',effect:{durationMul:.22},weight:6},
  {id:'p_dodge',name:'GHOST FRAME',tag:'DODGE +5%',color:'#6ad7ff',desc:'A fractional phase offset makes you harder to confirm.',effect:{dodge:.05},weight:4},
  {id:'p_reload',name:'COOLANT LOOP',tag:'FIRE RATE +10% / DMG +8%',color:'#b6ff2b',desc:'Balance heat and output with a closed-loop coolant spine.',effect:{rateMul:.1,damageMul:.08},weight:6},
  {id:'p_speed_dmg',name:'MOMENTUM EDGE',tag:'MOVE +8% / DMG +8%',color:'#00f0ff',desc:'Convert velocity into additional projectile energy.',effect:{moveMul:.08,damageMul:.08},weight:6}
];
N.PROTOCOL_BY_ID=Object.fromEntries(N.PROTOCOLS.map(p=>[p.id,p]));

// ——— slot milestones ———
N.SLOT_MILESTONES={
  2:{passive:1,label:'MODULE BANK +1'},
  3:{weapon:1,label:'WEAPON BAY +1'},
  5:{passive:1,label:'MODULE BANK +1'},
  7:{weapon:1,label:'WEAPON BAY +1'},
  9:{passive:1,label:'MODULE BANK +1'},
  12:{passive:1,label:'MODULE BANK +1'},
  15:{passive:1,label:'MODULE BANK +1'},
  18:{passive:1,label:'MODULE BANK +1'}
};
N.START_SLOTS={weapons:2,passives:2};

// ——— base player stats ———
N.BASE_STATS={
  maxHp:100,maxShield:20,speed:245,armor:0,damageMul:1,rateMul:1,speedMul:1,moveMul:1,
  areaMul:1,sizeMul:1,multishot:0,pierce:0,bounce:0,chain:0,critChance:.05,critMul:1.75,
  pickupMul:1,luck:1,xpMul:1,regen:0,thorns:0,lifesteal:0,dodge:0,dashCharges:1,
  dashRecharge:2.7,durationMul:1,explodeChance:0,explodeRadius:1,damageTakenMul:1,
  shieldRegenMul:1
};

// ——— enemy roles ———
// hue values are shifted by level so the whole ecology recolors as sectors rotate.
N.ROLES={
  rusher:{name:'RUSHER',hue:352,hp:17,speed:136,size:15,contact:11,xp:2,drop:'speed',dropChance:.2,attack:'none',weight:16},
  tank:{name:'TANK',hue:28,hp:78,speed:52,size:28,contact:22,xp:5,drop:'armor',dropChance:.42,attack:'radialSlow',weight:7},
  shooter:{name:'SHOOTER',hue:190,hp:27,speed:78,size:19,contact:9,xp:3,drop:'rate',dropChance:.22,attack:'aimedBurst',weight:12},
  splitter:{name:'SPLITTER',hue:96,hp:34,speed:98,size:21,contact:13,xp:3,drop:'vitality',dropChance:.28,attack:'none',split:2,weight:9},
  burster:{name:'BURSTER',hue:315,hp:40,speed:68,size:23,contact:12,xp:4,drop:'multi',dropChance:.25,attack:'radialBurst',weight:9},
  sniper:{name:'SNIPER',hue:274,hp:25,speed:56,size:18,contact:8,xp:4,drop:'pierce',dropChance:.34,attack:'snipe',weight:7},
  aegis:{name:'AEGIS',hue:205,hp:62,speed:56,size:26,contact:15,xp:6,drop:'shield',dropChance:.45,attack:'aimed3',shield:32,weight:6},
  detonator:{name:'DETONATOR',hue:12,hp:22,speed:156,size:17,contact:0,xp:3,drop:'explosive',dropChance:.35,attack:'explode',weight:8},
  weaver:{name:'WEAVER',hue:136,hp:34,speed:74,size:20,contact:8,xp:5,drop:'repair',dropChance:.58,attack:'none',healer:true,weight:5},
  hive:{name:'HIVE',hue:76,hp:66,speed:44,size:28,contact:14,xp:6,drop:'data',dropChance:.5,attack:'spawn',weight:5},
  ram:{name:'RAM',hue:42,hp:54,speed:84,size:25,contact:26,xp:5,drop:'speed',dropChance:.3,attack:'ram',weight:7},
  gyro:{name:'GYRO',hue:291,hp:39,speed:92,size:21,contact:11,xp:4,drop:'ricochet',dropChance:.28,attack:'spiral',weight:7},
  warden:{name:'WARDEN',hue:48,hp:260,speed:55,size:37,contact:30,xp:18,drop:'weapon',dropChance:1,attack:'warden',elite:true,shield:55,weight:2},
  null:{name:'NULL',hue:332,hp:35,speed:120,size:20,contact:10,xp:6,drop:'cursed',dropChance:.55,attack:'curved',teleport:true,weight:5},
  seeder:{name:'SEEDER',hue:156,hp:46,speed:62,size:24,contact:12,xp:4,drop:'prospector',dropChance:.32,attack:'mines',weight:6},
  boss:{name:'BOSS',hue:0,hp:1100,speed:32,size:64,contact:44,xp:85,drop:'boss',dropChance:1,attack:'boss',elite:true,boss:true,shield:190,weight:1}
};

// 32 distinct silhouettes; two styles per role. Every shape is used exactly once.
N.ENEMY_STYLES=[
  {id:'dart',name:'DART WISP',role:'rusher',shape:'dart',hue:-4,sizeMul:.92},
  {id:'needle',name:'NEEDLE DRONE',role:'rusher',shape:'needle',hue:7,sizeMul:.82},
  {id:'hexplate',name:'HEX SENTINEL',role:'tank',shape:'hexplate',hue:-4,sizeMul:1.04},
  {id:'cube',name:'CUBE BULWARK',role:'tank',shape:'cube',hue:9,sizeMul:1.12},
  {id:'crawler',name:'SKITTER CRAWLER',role:'splitter',shape:'crawler',hue:-12,sizeMul:1.02},
  {id:'fractal',name:'FRACTAL HULK',role:'splitter',shape:'fractal',hue:-7,sizeMul:1.16},
  {id:'eye',name:'OPTIC STALKER',role:'shooter',shape:'eye',hue:0,sizeMul:.96},
  {id:'trident',name:'TRIDENT GUNNER',role:'shooter',shape:'trident',hue:10,sizeMul:.98},
  {id:'prism',name:'PRISM LANCER',role:'sniper',shape:'prism',hue:-5,sizeMul:.9},
  {id:'lance',name:'LANCE WRAITH',role:'sniper',shape:'lance',hue:8,sizeMul:1.02},
  {id:'flower',name:'FLOWER BURSTER',role:'burster',shape:'flower',hue:-8,sizeMul:1},
  {id:'spore',name:'SPORE POD',role:'burster',shape:'spore',hue:11,sizeMul:.92},
  {id:'ring',name:'RING AEGIS',role:'aegis',shape:'ring',hue:-6,sizeMul:1.03},
  {id:'shield',name:'SHARD GUARDIAN',role:'aegis',shape:'shield',hue:9,sizeMul:1.08},
  {id:'orb',name:'FUSE ORB',role:'detonator',shape:'orb',hue:0,sizeMul:.98},
  {id:'spider',name:'CINDER SPIDER',role:'detonator',shape:'spider',hue:-8,sizeMul:.9},
  {id:'web',name:'SYNAPSE WEAVER',role:'weaver',shape:'web',hue:-3,sizeMul:1.04},
  {id:'knot',name:'MENDER KNOT',role:'weaver',shape:'knot',hue:7,sizeMul:.94},
  {id:'hive',name:'HIVE CARRIER',role:'hive',shape:'hive',hue:-5,sizeMul:1.1},
  {id:'brood',name:'BROOD ENGINE',role:'hive',shape:'brood',hue:9,sizeMul:1.04},
  {id:'horn',name:'RAM HORN',role:'ram',shape:'horn',hue:-4,sizeMul:.98},
  {id:'breaker',name:'BREAKER GOLEM',role:'ram',shape:'breaker',hue:8,sizeMul:1.14},
  {id:'gyro',name:'GYRO SENTRY',role:'gyro',shape:'gyro',hue:-7,sizeMul:1},
  {id:'orbit',name:'ORBIT SEEKER',role:'gyro',shape:'orbit',hue:6,sizeMul:.96},
  {id:'crown',name:'WARDEN CROWN',role:'warden',shape:'crown',hue:0,sizeMul:1.12},
  {id:'trinity',name:'TRINITY WARDEN',role:'warden',shape:'trinity',hue:14,sizeMul:1.18},
  {id:'ghost',name:'NULL GHOST',role:'null',shape:'ghost',hue:-8,sizeMul:.94},
  {id:'voideye',name:'VOID EYE',role:'null',shape:'voidEye',hue:6,sizeMul:1.06},
  {id:'seeder',name:'SEED CASTER',role:'seeder',shape:'seeder',hue:-3,sizeMul:.98},
  {id:'spire',name:'MINE SPIRE',role:'seeder',shape:'spire',hue:9,sizeMul:1.08},
  {id:'boss',name:'OVERSEER CORE',role:'boss',shape:'boss',hue:0,sizeMul:1.22},
  {id:'archon',name:'ARCHON ENGINE',role:'boss',shape:'archon',hue:16,sizeMul:1.35}
];
N.ENEMY_BY_ID=Object.fromEntries(N.ENEMY_STYLES.map(s=>[s.id,s]));
N.ROLE_LIST=Object.keys(N.ROLES);

N.weaponIconURL=function(id,color){
  const w=N.WEAPON_BY_ID[id];
  return N.Assets.weaponIconURL(id,color||(w?w.color:'#00f0ff'));
};
N.weaponIconCanvas=function(id,color){
  const w=N.WEAPON_BY_ID[id];
  return N.Assets.weaponIcon(id,color||(w?w.color:'#00f0ff'));
};
})();
