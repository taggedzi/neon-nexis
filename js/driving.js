/* NEON NEXUS — ship-relative steering, braking and thrust */
(function(){
'use strict';
const N=window.NEON;
N.Driving={
  move(player,input,dt){
    player.heading=N.angleDelta(0,(Number.isFinite(player.heading)?player.heading:player.aim)+input.steer*2.8*dt);
    const forward={x:Math.cos(player.heading),y:Math.sin(player.heading)};
    const speed=player.vx*forward.x+player.vy*forward.y;
    // Finish forward braking before requesting reverse thrust.
    const braking=input.throttle<0&&speed>5;
    return {x:forward.x*(braking?0:input.throttle),y:forward.y*(braking?0:input.throttle),
      len:Math.abs(input.throttle),braking};
  },
  angle(player){return N.Game.settings.movementMode==='driving'?player.heading:player.aim;}
};
})();
