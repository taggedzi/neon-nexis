/* Run only in a fresh isolated browser context at /?test=discarded-items. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='discarded-items')throw Error('Use an isolated discarded-items test page');
const N=window.NEON,G=N.Game,passed=[];
function check(value,message){if(!value)throw Error(message);passed.push(message);}
function setup(){
  G.newRun();G.player.weaponSlots=1;G.player.passiveSlots=1;
  const fresh=G.spawnGroundLoot({kind:'consumable',id:'repair'},G.player.x+500,G.player.y);
  return {fresh,weapon:Object.values(N.WEAPON_BY_ID).find(w=>w.id!==G.player.weapons[0].id),mod:Object.values(N.MOD_BY_ID).find(m=>m.id!==G.player.passives[0].id)};
}
for(const kind of ['weapon','mod']){
  let {fresh,weapon,mod}=setup();
  const def=kind==='weapon'?weapon:mod;
  if(kind==='weapon'){
    check(!G.dropItem(kind,0),'last weapon cannot be discarded');
    G.player.weapons.push(G.makeWeapon(def.id,1,1));G.player.activeWeapon=1;
  }else G.player.passives.push({id:def.id,stacks:1});
  const index=1;
  check(G.dropItem(kind,index),`${kind}: inventory discard succeeds`);
  check(G.groundItems.length===1&&G.groundItems[0]===fresh,`${kind}: discard creates no pickup and preserves fresh loot`);
  check(G.player.activeWeapon<G.player.weapons.length,`${kind}: active weapon remains valid`);
  check(G.restoreCheckpoint(),`${kind}: checkpoint restores`);
  const equipped=kind==='weapon'?G.player.weapons:G.player.passives;
  check(!equipped.some(it=>it.id===def.id)&&G.groundItems.length===1,`${kind}: discarded gear stays absent after restore`);
  for(const action of ['swap','decline']){
    ({fresh,weapon,mod}=setup());
    const incomingDef=kind==='weapon'?weapon:mod;
    const incoming=G.spawnGroundLoot({kind,id:incomingDef.id},G.player.x,G.player.y);
    G.updateGroundItems(1/60);
    check(G.mode==='overflow'&&G.overflow?.item===incoming,`${kind} ${action}: fresh gear opens overflow`);
    if(action==='swap')G.swapOverflow(kind,0);else G.leaveOverflow();
    check(G.mode==='playing'&&!G.overflow,`${kind} ${action}: resumes gameplay`);
    check(G.groundItems.length===1&&G.groundItems[0]===fresh,`${kind} ${action}: no discarded or replaced pickup remains`);
    for(let i=0;i<600;i++)G.updateGroundItems(1/60);
    check(G.mode==='playing',`${kind} ${action}: returning to the location does not reopen overflow`);
    const saved=N.readSave();
    check(saved.level.groundItems.length===1&&saved.level.groundItems[0].id===fresh.id,`${kind} ${action}: save contains fresh loot only`);
    if(action==='swap')check((kind==='weapon'?G.player.weapons:G.player.passives)[0].id===incomingDef.id,`${kind}: replacement equipped`);
  }
}
const {fresh}=setup();
for(let i=0;i<36000;i++)G.updateGroundItems(1/60);
check(G.groundItems.includes(fresh),'fresh loot remains after ten simulated minutes');
G.player.hp-=20;fresh.x=G.player.x;fresh.y=G.player.y;const hp=G.player.hp;G.updateGroundItems(1/60);
check(G.player.hp>hp&&!G.groundItems.includes(fresh),'fresh repair loot still heals and is collected');
G.pauseGame();
window.discardedItemsResult={passed:passed.length,checks:passed};
})();
