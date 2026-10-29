/* Run only in an isolated browser context at /?test=driving. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='driving')throw Error('Use an isolated driving test page');
const N=window.NEON,G=N.Game,I=N.Input,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
const near=(a,b)=>Math.abs(a-b)<1e-6;
const down=(code,repeat=false)=>window.dispatchEvent(new KeyboardEvent('keydown',{code,repeat,bubbles:true}));
const up=code=>window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
const originalAim=I.getAim;
G.newRun();G.camera.shake=0;
I.getAim=p=>({angle:1.1,fire:false,source:'mouse',point:{x:p.x+100,y:p.y+200}});
try{
  G.settings.movementMode='directional';G.applySettings(false);I.resetMovement();down('KeyW');down('KeyD');
  const move=I.getMove();check(near(move.x,Math.SQRT1_2)&&near(move.y,-Math.SQRT1_2),'directional diagonal normalization retained');
  G.player.vx=0;G.player.vy=0;G.updatePlayer(1/60);
  check(near(G.player.vx,move.x*G.player.stats.moveSpeed*.2),'directional acceleration formula retained');
  up('KeyW');up('KeyD');
  G.settings.movementMode='driving';G.applySettings(true);
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const p=G.player;p.heading=angle;p.x=G.level.cx;p.y=G.level.cy;p.vx=0;p.vy=0;I.resetMovement();down('KeyW');G.updatePlayer(1/60);up('KeyW');
    check(p.vx*Math.cos(angle)+p.vy*Math.sin(angle)>0,'forward thrust follows hull heading');
    check(Math.abs(p.vx*Math.sin(angle)-p.vy*Math.cos(angle))<1e-6,'forward thrust has no perpendicular component');
    check(Math.abs(N.angleDelta(p.heading,angle))<1e-6,'weapon aim does not rotate driving hull');
  }
  const p=G.player;p.heading=0;p.vx=300;p.vy=0;I.resetMovement();down('KeyS');G.updatePlayer(1/60);
  check(p.vx>0&&p.vx<300,'S first brakes forward motion');
  for(let i=0;i<60;i++)G.updatePlayer(1/60);
  check(p.vx<0,'held S reverses after braking');up('KeyS');
  p.vx=0;p.vy=0;p.heading=0;down('KeyD');G.updatePlayer(1/60);up('KeyD');
  check(p.heading>0&&near(p.vx,0)&&near(p.vy,0),'steering rotates while stationary');
  G.settings.keyboard.moveUp='ArrowUp';G.applySettings(false);I.resetMovement();down('ArrowUp');
  check(I.getDrivingInput().throttle===1,'driving uses remapped forward action');up('ArrowUp');
  G.saveCheckpoint(true,'driving-test');const heading=p.heading;G.restoreCheckpoint();
  check(near(G.player.heading,heading),'heading survives checkpoint restore');
  check(N.loadSettings().movementMode==='driving','movement preference persists');
  down('ArrowUp');G.pauseGame();check(!I.actionDown('moveUp'),'pause clears movement keys');G.resumeGame();down('ArrowUp',true);
  check(!I.actionDown('moveUp'),'held key repeat does not rearm movement after pause');up('ArrowUp');
  down('ArrowUp');window.dispatchEvent(new Event('blur'));check(!I.actionDown('moveUp'),'blur clears movement keys');window.dispatchEvent(new Event('focus'));up('ArrowUp');
  const descriptor=Object.getOwnPropertyDescriptor(navigator,'getGamepads');let pads=[];
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pads});
  try{
    const pad={id:'Synthetic regression pad',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};pads=[pad];I.update();
    for(const mode of ['directional','driving']){
      G.settings.movementMode=mode;G.applySettings(false);pad.axes=[0,0,0,0];I.update();pad.axes=[.1,-.1,0,0];I.update();
      check(I.getMove().len===0&&I.getDrivingInput().throttle===0&&I.getDrivingInput().steer===0,`${mode}: neutral drift suppressed`);
    }
    pad.axes=[0,-1,0,0];I.update();check(I.getDrivingInput().throttle===1,'left-stick up provides thrust');
    pad.axes=[0,-1,1,0];I.update();
    const aim=originalAim(G.player,{x:0,y:0});
    check(aim.source==='pad'&&near(aim.angle,0)&&!aim.fire&&I.getDrivingInput().throttle===1,'right stick aims independently while driving');
    pad.buttons[G.settings.gamepad.fire]={pressed:true,value:1};I.update();
    check(originalAim(G.player,{x:0,y:0}).fire,'mapped controller fire still works');
    pad.buttons[G.settings.gamepad.fire]={pressed:false,value:0};pad.axes=[0,-1,0,0];I.update();
    G.pauseGame();I.update();G.resumeGame();I.update();check(I.getDrivingInput().throttle===0,'held stick blocked across pause');
    pad.axes=[0,0,0,0];I.update();pad.axes=[0,-1,0,0];I.update();check(I.getDrivingInput().throttle===1,'neutral stick rearms movement');
    pads=[];I.update();check(I.getMove().len===0&&!I.padAimActive&&!I.isPadConnected(),'disconnect clears all pad movement and aim');
  }finally{if(descriptor)Object.defineProperty(navigator,'getGamepads',descriptor);else delete navigator.getGamepads;I.update();}
}finally{I.getAim=originalAim;I.resetMovement();G.pauseGame();}
window.drivingResult={passed:passed.length,checks:passed};
})();
