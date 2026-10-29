/* NEON NEXUS — input: keyboard, mouse, gamepad, remapping */
(function(){
'use strict';
const N=window.NEON;
const I=N.Input={};
let settings=N.deepMerge(N.SETTINGS_DEFAULT,{});
let keys=Object.create(null);
let pressed=new Set();
let mouse={x:innerWidth/2,y:innerHeight/2,in:false,down:false};
let wheelDelta=0;
let pads=[];
let padPrev=[];
let padEdges=[];
let padHeld=[];
let padConsumed=new Set();
let lastPadAim={x:0,y:-1};
let aimSource='mouse';
let captureKey=null, capturePad=null;
let padConnected=false;
let padName='';
let onPadChange=null;
let initialized=false;
let movementBlocked=false;
let unfocused=false;
let padFireReady=true;
const fireActive=()=>!unfocused&&N.Game?.mode==='playing'&&!N.UI?.overlayOpen?.();

I.resetMovement=function(){
  keys=Object.create(null);pressed.clear();
  I.padMove={x:0,y:0};movementBlocked=true;
};
function clearPad(){
  N.Firing.set('pad',false,false);N.Firing.set('stick',false,false);
  padPrev=[];padHeld=[];padEdges=[];padConsumed.clear();
  I.padMove={x:0,y:0};I.padAim={x:0,y:0};I.padAimMag=0;I.padAimActive=false;I.padId='';
}

I.init=function(s){
  settings=N.deepMerge(N.SETTINGS_DEFAULT,s||{});
  if(initialized) return; initialized=true;
  window.addEventListener('keydown',onKeyDown,{passive:false});
  window.addEventListener('keyup',onKeyUp,{passive:false});
  window.addEventListener('blur',()=>{unfocused=true;I.resetMovement();clearPad();I.resetFire();});
  window.addEventListener('focus',()=>{unfocused=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){I.resetMovement();clearPad();I.resetFire();}});
  window.addEventListener('pointermove',onPointerMove,{passive:true});
  window.addEventListener('pointerdown',onPointerDown,{passive:true});
  window.addEventListener('pointerup',onPointerUp,{passive:true});
  window.addEventListener('pointercancel',onPointerUp,{passive:true});
  window.addEventListener('wheel',onWheel,{passive:true});
  window.addEventListener('gamepadconnected',e=>{
    padConnected=true; padName=e.gamepad.id||'GAMEPAD';
    if(onPadChange) onPadChange(true,padName);
  });
  window.addEventListener('gamepaddisconnected',()=>{
    I.resetFire();clearPad();movementBlocked=true;
    padConnected=false;
    if(onPadChange) onPadChange(false,'');
  });
  // Some browsers only expose pads after a button press; poll will catch it.
  pollPads();
};
I.setSettings=function(s){
  const previous=settings.movementMode,old=settings;
  settings=N.deepMerge(N.SETTINGS_DEFAULT,s||{});
  N.Firing.configure(settings.firingMode);
  if(previous!==settings.movementMode||old.rightStickFire!==settings.rightStickFire||old.keyboard.fire!==settings.keyboard.fire||old.gamepad.fire!==settings.gamepad.fire)I.resetFire();
  if(old.keyboard.fire!==settings.keyboard.fire)N.Firing.set('keyboard',false,false);
  if(previous!==settings.movementMode){
    I.resetMovement();
    const p=N.Game?.player;
    if(p){p.heading=p.aim;p.vx=0;p.vy=0;}
  }
};
I.getSettings=()=>settings;
I.onPadChange=function(cb){onPadChange=cb;};
I.isCapturing=()=>!!(captureKey||capturePad);

function isTypingTarget(t){
  return t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
}
function onKeyDown(e){
  if(captureKey){
    e.preventDefault();e.stopPropagation();
    const cb=captureKey; captureKey=null;
    // Escape cancels remapping unless Shift is held; otherwise it is a valid bind.
    if(e.code==='Escape' && !e.shiftKey){ cb(null); return; }
    cb(e.code); return;
  }
  if(isTypingTarget(e.target)) return;
  if(e.repeat)return;
  keys[e.code]=true;
  pressed.add(e.code);
  if(e.code===settings.keyboard.fire){N.Firing.set('keyboard',false,false);N.Firing.set('keyboard',true,fireActive());}
  N.Audio && N.Audio.unlock && N.Audio.unlock();
  // avoid browser scroll/space behavior while the game is active
  if(document.body.classList.contains('playing')){
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
  }
  if(e.code==='Space' && document.body.classList.contains('playing')) e.preventDefault();
}
function onKeyUp(e){keys[e.code]=false;if(e.code===settings.keyboard.fire)N.Firing.set('keyboard',false,false);}
function onPointerMove(e){
  if(e.movementX||e.movementY){aimSource='mouse';document.body.classList.remove('controller-nav');}
  mouse.x=e.clientX; mouse.y=e.clientY;
  mouse.in = e.clientX>=0 && e.clientY>=0 && e.clientX<=innerWidth && e.clientY<=innerHeight;
  // Track physical state; the firing helper keeps interrupted holds blocked
  // until release rather than treating pointer movement as another press.
  if(e.buttons && (e.buttons & 1)){mouse.down=true;N.Firing.set('mouse',true,fireActive());}
  else if(!e.buttons){mouse.down=false;N.Firing.set('mouse',false,false);}
}
function onPointerDown(e){
  aimSource='mouse';document.body.classList.remove('controller-nav');
  N.Audio && N.Audio.unlock && N.Audio.unlock();
  const t=e.target;
  if(t && t.id==='game' && (e.button===0||e.pointerType==='touch')){
    mouse.down=true; aimSource='mouse'; mouse.x=e.clientX;mouse.y=e.clientY;
    N.Firing.set('mouse',false,false);N.Firing.set('mouse',true,fireActive());
  }
}
function onPointerUp(e){
  if(e.target && e.target.id==='game' || e.pointerType==='touch') mouse.down=false;
  else if(mouse.down && e.buttons===0) mouse.down=false;
  if(e.type==='pointercancel'||e.buttons===0||e.button===0)N.Firing.set('mouse',false,false);
  if(e.type==='pointercancel')I.resetFire();
}
function onWheel(e){
  if(document.body.classList.contains('playing') && !N.UI?.overlayOpen?.()){
    wheelDelta += Math.sign(e.deltaY);
  }
}
function pollPads(){
  if(!navigator.getGamepads) return;
  try{pads=navigator.getGamepads();}catch(e){pads=[];}
}
I.update=function(){
  I.padCapturedThisFrame=false;
  if(unfocused){N.Firing.reset();clearPad();return;}
  pollPads();
  padEdges=[]; padConsumed.clear();
  let anyPad=null;
  for(let i=0;i<Math.min(pads.length||0,4);i++){
    const p=pads[i]; if(p){anyPad=p;break;}
  }
  if(!padConnected && anyPad){
    padConnected=true; padName=anyPad.id||'GAMEPAD';
    if(onPadChange)onPadChange(true,padName);
  }
  if(!anyPad){
    clearPad();
    if(padConnected){I.resetFire();padConnected=false;movementBlocked=true;if(onPadChange)onPadChange(false,'');}
    return;
  }
  const buttons=anyPad.buttons||[];
  const prev=padPrev;
  padHeld=[]; padEdges=[];
  for(let b=0;b<buttons.length;b++){
    const held=!!(buttons[b]&&(buttons[b].pressed||buttons[b].value>.5));
    padHeld[b]=held;
    padEdges[b]=held&&!prev[b];
    if(padEdges[b] && capturePad){
      I.padCapturedThisFrame=true;
      const cb=capturePad;capturePad=null;cb(b);padConsumed.add(b);
    }
  }
  padPrev=padHeld.slice();
  const ax=anyPad.axes||[];
  const dz=settings.deadzone||.22;
  let rx=ax[2]||0, ry=ax[3]||0;
  if(rx*rx+ry*ry<dz*dz){rx=0;ry=0;}
  let mx=ax[0]||0,my=ax[1]||0;
  if(mx*mx+my*my<=dz*dz){mx=0;my=0;movementBlocked=false;}
  I.padMove=movementBlocked?{x:0,y:0}:{x:mx,y:my};
  I.padAim={x:rx,y:ry};
  I.padAimMag=Math.hypot(rx,ry);
  I.padAimActive=I.padAimMag>dz;
  if(I.padAimActive){
    lastPadAim={x:rx/I.padAimMag,y:ry/I.padAimMag};
    aimSource='pad';
  }
  I.lastPadAim=lastPadAim;
  I.padId=anyPad.id;
  const padFire=I.padActionDown('fire'),stickFire=settings.rightStickFire&&settings.movementMode!=='driving'&&I.padAimActive;
  if(!padFire&&!stickFire)padFireReady=true;
  N.Firing.set('pad',padFire,fireActive()&&padFireReady);
  N.Firing.set('stick',stickFire,fireActive()&&padFireReady);
};
I.endFrame=function(){
  pressed.clear();
  wheelDelta=0;
};
I.consumePad=function(index){
  if(padEdges && padEdges[index] && !padConsumed.has(index)){padConsumed.add(index);return true;}
  return false;
};
I.padDown=function(index){return !!(padHeld&&padHeld[index]);};
I.anyPadDown=function(){return !!(padHeld&&padHeld.some(Boolean));};
I.getPadName=()=>padName;
I.isPadConnected=()=>padConnected;
I.keyDown=function(code){return !!keys[code];};
I.actionDown=function(action){const code=settings.keyboard[action];return !!keys[code];};
I.actionPressed=function(action){const code=settings.keyboard[action];return !!pressed.has(code);};
I.padActionDown=function(action){const b=settings.gamepad[action];return b!=null&&I.padDown(b);};
I.padActionPressed=function(action){const b=settings.gamepad[action];return b!=null&&I.consumePad(b);};
I.getMove=function(){
  let x=0,y=0;
  if(I.actionDown('moveUp'))y-=1;
  if(I.actionDown('moveDown'))y+=1;
  if(I.actionDown('moveLeft'))x-=1;
  if(I.actionDown('moveRight'))x+=1;
  const pm=I.padMove||{x:0,y:0};
  x+=pm.x; y+=pm.y;
  const l=Math.hypot(x,y);
  if(l>1){x/=l;y/=l;}
  return {x,y,len:Math.min(1,l)};
};
I.getMouse=()=>mouse;
I.getDrivingInput=function(){
  const pad=I.padMove||{x:0,y:0},dz=settings.deadzone||.22;
  const px=Math.abs(pad.x)>dz?pad.x:0,py=Math.abs(pad.y)>dz?pad.y:0;
  return {steer:N.clamp((I.actionDown('moveRight')?1:0)-(I.actionDown('moveLeft')?1:0)+px,-1,1),
    throttle:N.clamp((I.actionDown('moveUp')?1:0)-(I.actionDown('moveDown')?1:0)-py,-1,1)};
};
I.mouseDown=()=>mouse.down;
I.resetFire=function(){mouse.down=false;padFireReady=false;N.Firing.reset();};
I.getWheel=function(){const v=wheelDelta; wheelDelta=0; return v;};
I.getWeaponSwitch=function(){
  if(I.actionPressed('weaponNext')) return 1;
  if(I.actionPressed('weaponPrev')) return -1;
  if(I.padActionPressed('weaponNext')) return 1;
  if(I.padActionPressed('weaponPrev')) return -1;
  const w=I.getWheel();
  if(w!==0) return w>0?1:-1;
  return 0;
};
I.getAim=function(player,mouseWorld){
  let angle=player.aim||0;
  let source='mouse';
  let point=null;
  const firingPad = I.padActionDown('fire') || (settings.rightStickFire&&settings.movementMode!=='driving'&&I.padAimActive);
  if(I.padAimActive){
    angle=Math.atan2((I.padAim&&I.padAim.y)||0,(I.padAim&&I.padAim.x)||1);
    source='pad';
    point={x:player.x+Math.cos(angle)*280,y:player.y+Math.sin(angle)*280};
  }else if(firingPad && I.padActionDown('fire')){
    const la=I.lastPadAim||{x:0,y:-1};
    angle=Math.atan2(la.y,la.x);
    source='pad';
    point={x:player.x+Math.cos(angle)*280,y:player.y+Math.sin(angle)*280};
  }else if(aimSource==='pad'){
    const la=I.lastPadAim||{x:0,y:-1};
    angle=Math.atan2(la.y,la.x);source='pad';
    point={x:player.x+Math.cos(angle)*280,y:player.y+Math.sin(angle)*280};
  }else if(mouse.in){
    angle=Math.atan2(mouseWorld.y-player.y,mouseWorld.x-player.x);
    source='mouse';
    point={x:mouseWorld.x,y:mouseWorld.y};
  }
  const fire = N.Firing.active(fireActive());
  return {angle,source,point,fire,firingPad};
};
I.consumeAction=function(action){
  if(action==='dash') return I.actionPressed('dash')||I.padActionPressed('dash');
  if(action==='pause') return I.actionPressed('pause')||I.padActionPressed('pause');
  if(action==='inventory') return I.actionPressed('inventory')||I.padActionPressed('inventory');
  return false;
};
I.startKeyCapture=function(cb){captureKey=cb;capturePad=null;};
I.startPadCapture=function(cb){capturePad=cb;captureKey=null;};
I.cancelCapture=function(){captureKey=null;capturePad=null;};
I.isCapturingKey=()=>!!captureKey;
I.isCapturingPad=()=>!!capturePad;
I.padNumber=()=>I.padId||'';
I.hasGamepad=()=>padConnected;
I.noteAimSource=()=>aimSource;
I.getDebug=()=>({mouse,keys,pads:padHeld});
})();
