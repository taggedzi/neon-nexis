/* NEON NEXUS — player camera and screen/world coordinates */
(function(){
'use strict';
const G=window.NEON.Game;
// Short, frame-rate-independent settling; no aim lead or map-edge clamp.
const FOLLOW_RATE=16;
G.updateCamera=function(dt,snap=false){
  if(!G.player)return;
  const follow=snap?1:1-Math.exp(-Math.max(0,dt)*FOLLOW_RATE);
  G.camera.x+=(G.player.x-G.camera.x)*follow;
  G.camera.y+=(G.player.y-G.camera.y)*follow;
  const shake=snap?0:(G.camera.shake||0);
  G.camera.sx=shake?(Math.random()-.5)*shake:0;
  G.camera.sy=shake?(Math.random()-.5)*shake:0;
};
G.screenToWorld=function(x,y){
  return {x:G.camera.x+(x-G.w/2-(G.camera.sx||0))/G.zoom,
    y:G.camera.y+(y-G.h/2-(G.camera.sy||0))/G.zoom};
};
G.worldToScreen=function(x,y){
  return {x:(x-G.camera.x)*G.zoom+G.w/2+(G.camera.sx||0),
    y:(y-G.camera.y)*G.zoom+G.h/2+(G.camera.sy||0)};
};
})();
