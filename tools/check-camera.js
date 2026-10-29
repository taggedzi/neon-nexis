/* Run only in an isolated browser context at /?test=camera. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='camera')throw Error('Use an isolated camera test page');
const N=window.NEON,G=N.Game,I=N.Input,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
const near=(a,b)=>Math.abs(a-b)<1e-6;
G.newRun();G.glitch=0;G.camera.shake=0;
const p=G.player,L=G.level;
check(near(G.camera.x,p.x)&&near(G.camera.y,p.y),'new run targets player');
for(const [x,y] of [[20,L.cy],[L.width-20,L.cy],[L.cx,20],[L.cx,L.height-20],[20,20],[20,L.height-20],[L.width-20,20],[L.width-20,L.height-20]]){
  p.x=x;p.y=y;G.camera.x=L.cx;G.camera.y=L.cy;
  for(let i=0;i<120;i++)G.updateCamera(1/60);
  const screen=G.worldToScreen(x,y);
  check(near(screen.x,G.w/2)&&near(screen.y,G.h/2),`edge/corner ${x},${y}: settles at center without clamp`);
}
const endpoints=[];
for(const fps of [30,60,144]){
  p.x=L.cx;p.y=L.cy;G.camera.x=p.x-100;G.camera.y=p.y-80;
  for(let i=0;i<fps;i++)G.updateCamera(1/fps);
  endpoints.push([G.camera.x,G.camera.y]);
}
check(endpoints.every(([x,y])=>near(x,endpoints[0][0])&&near(y,endpoints[0][1])),'smoothing agrees at 30/60/144 steps per second');
for(const shake of [[0,0],[7,-9]]){
  [G.camera.sx,G.camera.sy]=shake;
  for(const [x,y] of [[0,0],[p.x,p.y],[L.width,L.height],[-200,-300]]){
    const s=G.worldToScreen(x,y),w=G.screenToWorld(s.x,s.y);
    check(near(w.x,x)&&near(w.y,y),'world/screen round trip including shake');
  }
}
const originalMove=I.getMove,originalAim=I.getAim;
try{
  I.getAim=()=>({angle:0,fire:false,source:'pad',point:{x:p.x+280,y:p.y}});
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
    p.x=L.cx;p.y=L.cy;p.vx=0;p.vy=0;G.camera.shake=0;G.updateCamera(0,true);
    I.getMove=()=>({x,y,len:1});
    let maxLag=0;
    for(let i=0;i<120;i++){G.updatePlayer(1/60);maxLag=Math.max(maxLag,Math.hypot(p.x-G.camera.x,p.y-G.camera.y));}
    check(maxLag<30,'movement tracking has bounded brief lag');
    I.getMove=()=>({x:-x,y:-y,len:1});
    for(let i=0;i<30;i++)G.updatePlayer(1/60);
    check(Number.isFinite(G.camera.x)&&Number.isFinite(G.camera.y),'direction reversal stays finite');
  }
}finally{I.getMove=originalMove;I.getAim=originalAim;}
const mouse=I.getMouse();mouse.x=G.w*.7;mouse.y=G.h*.3;mouse.in=true;mouse.down=false;
G.camera.shake=10;G.updatePlayer(1/60);
const aim=G.worldToScreen(G.aimPoint.x,G.aimPoint.y);
check(near(aim.x,mouse.x)&&near(aim.y,mouse.y),'mouse aim aligns after movement and shake sampling');
G.camera.shake=0;G.updateCamera(1/60);
check(G.camera.sx===0&&G.camera.sy===0,'shake offsets clear when shake ends');
G.saveCheckpoint(true,'camera-test');check(G.restoreCheckpoint(),'checkpoint restores');
check(near(G.camera.x,G.player.x)&&near(G.camera.y,G.player.y),'restore camera targets restored player');
G.camera.x-=100;G.resize();check(near(G.camera.x,G.player.x),'resize snaps camera to player');
G.pauseGame();window.cameraResult={passed:passed.length,checks:passed};
})();
