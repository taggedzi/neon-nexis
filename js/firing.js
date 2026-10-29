/* NEON NEXUS — shared held/toggle firing state, independent of aiming */
(function(){
'use strict';
const held=new Set(),blocked=new Set();
let mode='hold',enabled=false;
window.NEON.Firing={
  configure(value){const next=value==='toggle'?'toggle':'hold';if(next!==mode){this.reset();enabled=false;mode=next;}},
  set(source,down,active){
    if(!down){held.delete(source);blocked.delete(source);return;}
    if(held.has(source))return;
    held.add(source);
    if(!active){blocked.add(source);return;}
    if(mode==='toggle'&&!blocked.has(source))enabled=!enabled;
  },
  // Interrupt physical holds without changing the player's continuous-fire choice.
  reset(){for(const source of held)blocked.add(source);},
  active(gameplay){if(!gameplay)return false;if(mode==='toggle')return enabled;for(const source of held)if(!blocked.has(source))return true;return false;},
  toggled(){return mode==='toggle'&&enabled;}
};
})();
