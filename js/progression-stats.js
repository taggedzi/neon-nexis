/* NEON NEXUS — pure shared-progression stats and eligibility (issue 045) */
(function(){
  'use strict';
  const N=window.NEON;
  const C=N.ProgressionContent;

  function validSlot(slot,lookup){
    return !!slot&&typeof slot==='object'&&!!lookup(slot.id)&&
      Number.isInteger(slot.level)&&slot.level>=1&&slot.level<=C.maxWeaponLevel&&
      Number.isFinite(slot.cooldownSeconds)&&slot.cooldownSeconds>=0;
  }

  function isValidState(state){
    if(!state||state.schemaVersion!==C.schemaVersion||state.catalogVersion!==C.catalogVersion||
      !Array.isArray(state.offensive)||state.offensive.length!==3||
      !validSlot(state.offensive[0],C.primary))return false;
    const additional=state.offensive.slice(1);
    if(![0,1,2].every(index=>Object.hasOwn(state.offensive,index)))return false;
    if(additional.some(slot=>slot!==null&&!validSlot(slot,C.additional)))return false;
    if(additional[0]&&additional[1]&&additional[0].id===additional[1].id)return false;
    if(state.defensive!==null&&!validSlot(state.defensive,C.defense))return false;
    if(!Number.isInteger(state.selectedOffensiveSlot)||state.selectedOffensiveSlot<0||
      state.selectedOffensiveSlot>2||!state.offensive[state.selectedOffensiveSlot]||
      !Number.isFinite(state.switchDelaySeconds)||state.switchDelaySeconds<0)return false;
    if(!state.passives||typeof state.passives!=='object'||Array.isArray(state.passives))return false;
    for(const [id,stacks] of Object.entries(state.passives)){
      const passive=C.passive(id);
      if(!passive||!Number.isInteger(stacks)||stacks<1||stacks>passive.maxStacks)return false;
    }
    return true;
  }

  // Derived values contain no player resources or temporary buffs. Rebuilding
  // from the same earned state always produces the same values.
  function derive(hullId,state){
    if(!Object.hasOwn(N.HULL_STATS,hullId))return {ok:false,reason:'invalid-hull'};
    if(!isValidState(state))return {ok:false,reason:'invalid-state'};
    if(state.offensive[0].id!==C.primaryForHull(hullId))return {ok:false,reason:'wrong-hull-primary'};
    const hull=N.HULL_STATS[hullId];
    const stacks=id=>state.passives[id]||0;
    const stats={...N.BASE_STATS};
    stats.maxHp=hull.maxHp+10*stacks('reinforced_hull');
    stats.maxShield=hull.maxShield+5*stacks('shield_capacitor');
    stats.speed=245*hull.speed;
    stats.moveMul=1+.03*stacks('thruster_tuning');
    stats.moveSpeed=stats.speed*stats.moveMul;
    stats.damageMul=hull.damageMul*(1+.04*stacks('weapon_amplifier'));
    stats.rateMul=1+.05*stacks('cooling_system');
    stats.damageTakenMul=1-.03*stacks('reactive_plating');
    stats.shieldRegenMul=1+.10*stacks('recovery_circuit');
    stats.shieldRegenPerSecond=12*stats.shieldRegenMul;
    stats.shieldDelay=4.2;
    stats.pickupRadius=95;
    stats.critChance=C.critChance;
    stats.critMul=C.critMul;
    stats.offensive=state.offensive.map((slot,index)=>{
      if(!slot)return null;
      const definition=index===0?C.primary(slot.id):C.additional(slot.id);
      const damageMultiplier=C.levelDamageMultipliers[slot.level-1]*stats.damageMul;
      return {
        id:slot.id,level:slot.level,damageMultiplier,
        damage:definition.baseDamage*damageMultiplier,
        cooldownSeconds:definition.cooldownSeconds/stats.rateMul
      };
    });
    const defense=state.defensive;
    if(defense){
      const definition=C.defense(defense.id);
      stats.defensive={
        id:defense.id,level:defense.level,
        cooldownSeconds:definition.cooldownSeconds-(defense.level-1)*(definition.cooldownPerLevel||0),
        damage:definition.damage||0,
        capacity:(definition.capacity||0)+(defense.level-1)*(definition.capacityPerLevel||0)
      };
    }else{
      stats.defensive=null;
    }
    return stats;
  }

  function upgrade(slot,slotIndex){
    if(slot.level===C.maxWeaponLevel)return {ok:true,type:'fallback',reason:'capped'};
    return {ok:true,type:'upgrade',slotIndex,id:slot.id,oldLevel:slot.level,newLevel:slot.level+1};
  }

  // Installs return a candidate list. Only the reward authority chooses an ID;
  // eligibility never consumes randomness or mutates cooldown/selection state.
  function upgradeOutcome(state,category){
    if(!isValidState(state))return {ok:false,reason:'invalid-state'};
    const type=typeof category==='string'?category:category?.type;
    if(type==='primary')return upgrade(state.offensive[0],0);
    if(type==='offensive'){
      const slotIndex=state.offensive.findIndex((slot,index)=>index>0&&slot===null);
      if(slotIndex!==-1){
        const owned=state.offensive.slice(1).filter(Boolean).map(slot=>slot.id);
        return {ok:true,type:'install',slotIndex,candidates:C.additionalOffenseOrder.filter(id=>!owned.includes(id)),newLevel:1};
      }
      let lowest=-1;
      for(let index=1;index<3;index++){
        const slot=state.offensive[index];
        if(slot.level<C.maxWeaponLevel&&(lowest===-1||slot.level<state.offensive[lowest].level))lowest=index;
      }
      return lowest===-1?{ok:true,type:'fallback',reason:'capped'}:upgrade(state.offensive[lowest],lowest);
    }
    if(type==='defensive'){
      return state.defensive?upgrade(state.defensive,'defense'):
        {ok:true,type:'install',slotIndex:'defense',candidates:[...C.defensiveOrder],newLevel:1};
    }
    if(type==='passive'){
      const id=category?.id;
      const passive=C.passive(id);
      if(!passive)return {ok:false,reason:'invalid-passive'};
      const oldStacks=state.passives[id]||0;
      return oldStacks===passive.maxStacks?{ok:true,type:'fallback',reason:'capped',id}:
        {ok:true,type:'passive',id,oldStacks,newStacks:oldStacks+1};
    }
    return {ok:false,reason:'invalid-category'};
  }

  // This returns absolute resource values for one authoritative grant commit.
  // Restore/rebuild uses derive alone; applying this again is not a restore API.
  function capacityDelta(before,after,resources){
    if(!before||!after||!resources||
      ![before.maxHp,before.maxShield,after.maxHp,after.maxShield,resources.hp,resources.shield]
        .every(value=>Number.isFinite(value)&&value>=0))return {ok:false,reason:'invalid-resources'};
    const eligible=!resources.dead;
    const hpIncrease=eligible?Math.max(0,after.maxHp-before.maxHp):0;
    const shieldIncrease=eligible?Math.max(0,after.maxShield-before.maxShield):0;
    return {
      ok:true,hp:Math.min(after.maxHp,resources.hp+hpIncrease),
      shield:Math.min(after.maxShield,resources.shield+shieldIncrease),hpIncrease,shieldIncrease
    };
  }

  N.ProgressionStats=Object.freeze({derive,upgradeOutcome,capacityDelta,isValidState});
})();
