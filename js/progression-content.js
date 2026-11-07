/* NEON NEXUS — versioned uninterrupted-progression catalog (issue 042) */
(function(){
'use strict';
const N=window.NEON;

// Stable machine IDs. Labels, colors and display order may change; these keys
// must not be reused for different behavior (docs/progression-contracts.md).
const PRIMARY_ORDER=Object.freeze([
  'pulse_repeater',
  'needle_blaster',
  'scatter_cannon',
  'rail_lance'
]);

const primaries=Object.freeze({
  pulse_repeater:Object.freeze({
    id:'pulse_repeater',
    name:'PULSE REPEATER',
    tag:'RELIABLE / MEDIUM RANGE',
    color:'#00f0ff',
    sound:'pulse',
    kind:'pulse',
    baseDamage:10,
    cooldownSeconds:.20,
    speed:900,
    lifeSeconds:.8,
    size:2.4,
    offset:22,
    projectiles:1,
    maxDistinctTargets:1,
    spreadRadians:0
  }),
  needle_blaster:Object.freeze({
    id:'needle_blaster',
    name:'NEEDLE BLASTER',
    tag:'FAST / NARROW',
    color:'#b6ff2b',
    sound:'pulse',
    kind:'needle',
    baseDamage:6,
    cooldownSeconds:.12,
    speed:1200,
    lifeSeconds:.6,
    size:1.9,
    offset:22,
    projectiles:1,
    maxDistinctTargets:1,
    spreadRadians:0
  }),
  scatter_cannon:Object.freeze({
    id:'scatter_cannon',
    name:'SCATTER CANNON',
    tag:'CLOSE RANGE / CONE',
    color:'#ff7a1f',
    sound:'scatter',
    kind:'scatter',
    baseDamage:5,
    cooldownSeconds:.55,
    speed:700,
    lifeSeconds:.35,
    size:2.6,
    offset:18,
    projectiles:5,
    maxDistinctTargets:1,
    spreadRadians:.62
  }),
  rail_lance:Object.freeze({
    id:'rail_lance',
    name:'RAIL LANCE',
    tag:'PRECISION / PIERCE',
    color:'#ff2bd6',
    sound:'rail',
    kind:'rail',
    baseDamage:28,
    cooldownSeconds:.70,
    speed:1800,
    lifeSeconds:.6,
    size:3.2,
    offset:26,
    projectiles:1,
    maxDistinctTargets:3,
    spreadRadians:0
  })
});

const hullPrimaries=Object.freeze({
  kite:'pulse_repeater',
  dart:'needle_blaster',
  delta:'scatter_cannon',
  talon:'rail_lance'
});

// Stable IDs and order are shared with the progression integration contract.
const additionalOffenseOrder=Object.freeze([
  'seeker_missiles',
  'arc_projector',
  'gravity_bomb',
  'plasma_mortar'
]);

const additionalOffense=Object.freeze({
  seeker_missiles:Object.freeze({id:'seeker_missiles',name:'SEEKER MISSILES',color:'#b6ff2b',baseDamage:16,cooldownSeconds:.9,speed:500,lifeSeconds:2,turnRate:4,targetRange:600}),
  arc_projector:Object.freeze({id:'arc_projector',name:'ARC PROJECTOR',color:'#6ad7ff',baseDamage:18,chainDamage:Object.freeze([18,12,8]),cooldownSeconds:.8,targetRange:500,chainRange:180}),
  gravity_bomb:Object.freeze({id:'gravity_bomb',name:'GRAVITY BOMB',color:'#9d5cff',baseDamage:45,cooldownSeconds:3,speed:600,range:360,radius:110,slow:.25,slowSeconds:1.5}),
  plasma_mortar:Object.freeze({id:'plasma_mortar',name:'PLASMA MORTAR',color:'#ffb31f',baseDamage:12,cooldownSeconds:3.5,speed:600,range:360,radius:90,fieldSeconds:3})
});

N.ProgressionContent=Object.freeze({
  schemaVersion:1,
  catalogVersion:1,
  offensiveSlotCount:3,
  additionalSlotCount:2,
  defensiveSlotCount:1,
  maxWeaponLevel:5,
  switchDelaySeconds:.15,
  levelDamageMultipliers:Object.freeze([1,1.15,1.30,1.45,1.60]),
  critChance:.05,
  critMul:1.75,
  primaryOrder:PRIMARY_ORDER,
  primaries,
  hullPrimaries,
  additionalOffenseOrder,
  additionalOffense,
  primaryForHull(hullId){
    return Object.hasOwn(hullPrimaries,hullId)?hullPrimaries[hullId]:null;
  },
  primary(id){
    return Object.hasOwn(primaries,id)?primaries[id]:null;
  },
  additional(id){
    return Object.hasOwn(additionalOffense,id)?additionalOffense[id]:null;
  }
});
})();
