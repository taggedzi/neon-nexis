/* NEON NEXUS — boot & main loop */
(function(){
'use strict';
const N=window.NEON;
let last=performance.now(),fpsTime=0,fpsFrames=0;
let initialized=false;

function start(){
  if(initialized)return;initialized=true;
  const canvas=document.getElementById('game');
  try{
    N.Game.init(canvas);
    N.UI.init();
    N.UI.showBoot();
    N.UI.setBootProgress(12,'ALLOCATING RENDER CORE...');
    setTimeout(()=>N.UI.setBootProgress(38,'SYNTHESIZING WIREFRAME GEOMETRY...'),260);
    setTimeout(()=>N.UI.setBootProgress(64,'GENERATING AUDIO SPECTRA...'),600);
    setTimeout(()=>N.UI.setBootProgress(86,'CALIBRATING INPUT MATRIX...'),900);
    setTimeout(()=>{N.UI.setBootProgress(100,'SYSTEM READY // AWAITING PILOT');N.UI.setBootReady();},1200);
  }catch(err){
    console.error(err);
    const log=document.getElementById('boot-log');
    if(log)log.textContent='BOOT FAILURE: '+err.message;
  }
  requestAnimationFrame(loop);
}
function loop(now){
  const raw=(now-last)/1000;
  last=now;
  const dt=Math.min(.05,Math.max(0,raw||.016));
  fpsTime+=raw;fpsFrames++;
  if(fpsTime>=.5){
    N.Game.fps=fpsFrames/fpsTime;
    fpsTime=0;fpsFrames=0;
  }
  N.Input.update();
  try{
    if (N.Coop) N.Coop.tickSession(dt);
    N.Game.update(dt);
    if (N.Coop) N.Coop.tickLives(dt);
    N.UI.updateRewards();
    if(N.UI.overlayOpen())N.UI.handleGamepad();
  }catch(err){console.error('update error',err);}
  N.Input.endFrame();
  try{N.Game.render(dt);}catch(err){console.error('render error',err);}
  requestAnimationFrame(loop);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
