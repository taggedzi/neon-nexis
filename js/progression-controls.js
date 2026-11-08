/* NEON NEXUS — remappable progression actions and read-only HUD projections */
(function(){
'use strict';
const N=window.NEON;
const histories=new WeakMap();
const MAX_HISTORY=12;
const SUMMARY_SECONDS=4;

function definition(id){
  const catalog=N.ProgressionContent;
  return catalog.primary(id)||catalog.additional(id)||catalog.defense(id)||catalog.passive?.(id)||null;
}

function view(player){
  const state=player?.progression;
  if(!state)return null;
  const history=histories.get(player)||[];
  const now=N.Game.time;
  const recent=history.filter(item=>now>=item.time&&now<item.time+SUMMARY_SECONDS);
  return {
    offensive:state.offensive.map((slot,index)=>({
      slotIndex:index,selected:index===state.selectedOffensiveSlot,
      id:slot?.id||null,name:slot?definition(slot.id)?.name||slot.id:'EMPTY',
      level:slot?.level||0,cooldownSeconds:slot?.cooldownSeconds||0,
      color:slot?definition(slot.id)?.color||'#00f0ff':'#7394a8'
    })),
    defensive:state.defensive?{
      ...state.defensive,name:definition(state.defensive.id)?.name||state.defensive.id,
      ready:state.defensive.cooldownSeconds<=0
    }:null,
    passives:Object.entries(state.passives).map(([id,stacks])=>({id,stacks,name:definition(id)?.name||id})),
    salvage:state.salvage,
    barrier:player.barrier?{...player.barrier}:{capacity:0,windowSeconds:0,lockoutSeconds:0},
    recentSummary:recent.length?{message:recent[recent.length-1].message,count:recent.length}:null,
    history:history.map(item=>({...item}))
  };
}

// Rewards call this only after a newly committed result, never after a replay.
function notify(player,message,eventSequence){
  if(!player||typeof message!=='string'||!message)return;
  let history=histories.get(player);
  if(!history){history=[];histories.set(player,history);}
  if(eventSequence!==undefined&&history.some(item=>item.eventSequence===eventSequence))return;
  history.push({message,eventSequence,time:N.Game.time});
  if(history.length>MAX_HISTORY)history.shift();
}

function update(game){
  const player=game.player;
  if(player?.progressionMode!=='shared_v1'||player.dead||game.mode!=='playing'||N.UI?.overlayOpen?.())return;
  const input=N.Input;
  const intent={};
  // A conflicting binding resolves to one selection, then a separate defense.
  // Direct selection takes precedence over cycling on that simulation step.
  for(let slot=0;slot<3;slot++){
    if(input.progressionActionPressed('offensive'+(slot+1))){intent.slot=slot;break;}
  }
  const cycle=input.getWeaponSwitch(true);
  if(intent.slot===undefined&&cycle)intent.cycle=cycle;
  if(input.progressionActionPressed('defense'))intent.defense=true;
  if(N.Coop?.isGuest()){
    if(Object.keys(intent).length)N.Coop.sendProgressionIntent(intent);
    return;
  }
  let result;
  if(intent.slot!==undefined)result=N.Equipment.select(player.progression,intent.slot);
  else if(intent.cycle)result=N.Equipment.cycle(player.progression,intent.cycle);
  if(result?.changed)N.Audio.ui('click');
  if(intent.defense){
    if(N.Coop?.isHost())N.Coop.useProgressionDefense(player);
    else N.Equipment.tryDefend({
      game,player,recipients:[player],participantId:player.clientId,
      activationId:player.clientId+':'+(game.activationSequence=(game.activationSequence||0)+1),
      resourceIdentity:game.progressionAuthority.identityFor
    },{});
  }
}

N.ProgressionControls=Object.freeze({update,view,notify});
})();
