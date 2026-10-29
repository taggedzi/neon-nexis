/* Run in an isolated browser context at /?test=controller. Uses synthetic pads. */
(async function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='controller')throw Error('Use an isolated controller test page');
const N=window.NEON,G=N.Game,I=N.Input,U=N.UI,checks=[];
const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
const descriptor=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
const pad={id:'Synthetic standard controller',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
let pads=[pad];
Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pads});
const frame=()=>{I.update();if(U.overlayOpen())U.handleGamepad();I.endFrame();};
const release=()=>{pad.buttons.forEach(b=>{b.pressed=false;b.value=0;});pad.axes=[0,0,0,0];frame();};
const press=b=>{release();pad.buttons[b].pressed=true;pad.buttons[b].value=1;frame();};
const wait=()=>new Promise(resolve=>setTimeout(resolve,45));
function hudText(){
  const c=G.ctx,original=c.fillText,drawn=[];
  c.fillText=function(text,x,y,...args){drawn.push({text:String(text),x,y});return original.call(this,text,x,y,...args);};
  try{G.render(0);}finally{c.fillText=original;}
  return drawn;
}
try{
  U.showMenu();await wait();release();
  const first=document.activeElement;press(13);
  check(document.activeElement!==first,'D-pad moves menu selection');
  check(document.body.classList.contains('controller-nav'),'controller focus styling activated');
  const focusStyle = getComputedStyle(document.activeElement);
  const outlineWidth = parseFloat(focusStyle.outlineWidth);
  // Firefox quantizes outlines to device pixels under Windows display scaling.
  const pixelTolerance = 1 / window.devicePixelRatio;
  check(focusStyle.outlineStyle==='solid'&&outlineWidth>=2&&Math.abs(outlineWidth-3)<=pixelTolerance,
    'selected control has strong outline within one device pixel (actual: '+outlineWidth+', DPR: '+window.devicePixelRatio+')');
  const before=document.activeElement;release();pad.axes=[0,1,0,0];frame();
  check(document.activeElement!==before,'left stick navigates menus');
  const held=document.activeElement;frame();check(document.activeElement===held,'held stick does not repeat every frame');
  await new Promise(resolve=>setTimeout(resolve,360));frame();check(document.activeElement!==held,'held stick repeats after delay');
  release();U.openSettings('menu');await wait();frame();
  check(document.getElementById('controller-monitor').textContent.includes(pad.id),'settings identifies connected controller');
  const driving=document.querySelector('[data-movement-mode="driving"]');driving.focus();press(0);
  check(G.settings.movementMode==='driving','controller confirm selects movement mode');
  check(document.activeElement.dataset.movementMode==='driving','settings rerender retains selected control');
  const slider=document.querySelector('[data-setting="deadzone"]');slider.focus();const old=Number(slider.value);press(15);
  check(Number(slider.value)===old+1,'D-pad right adjusts slider');
  const bind=document.querySelector('[data-bind-pad="weaponNext"]');bind.focus();press(0);check(I.isCapturingPad(),'controller starts remapping');
  press(6);check(G.settings.gamepad.weaponNext===6&&!I.isCapturing(),'controller captures alternate weapon binding');
  check(document.activeElement.dataset.bindPad==='weaponNext','remapping preserves focus');
  frame();check(document.getElementById('controller-monitor').textContent.includes('LT [6]'),'monitor names pressed button and index');
  const r=document.activeElement.getBoundingClientRect();check(r.top>=0&&r.bottom<=innerHeight,'offscreen selected binding scrolls into view');
  document.querySelector('[data-bind-pad="weaponNext"]').focus();press(0);press(13);
  check(G.settings.gamepad.weaponNext===13&&document.activeElement.dataset.bindPad==='weaponNext','D-pad capture does not also navigate');
  document.querySelector('[data-bind-pad="weaponNext"]').focus();press(0);press(6);
  document.querySelector('[data-bind-key="fire"]').focus();press(0);check(I.isCapturingKey(),'controller can select keyboard binding');
  press(1);check(!I.isCapturing()&&U.currentScreen()==='settings','controller back cancels keyboard capture');
  G.settings.gamepad.pause=0;G.applySettings(false);
  document.querySelector('[data-movement-mode="directional"]').focus();press(0);
  check(G.settings.movementMode==='directional'&&U.currentScreen()==='settings','gameplay pause remap cannot steal menu confirm');
  press(9);check(U.currentScreen()==='menu','fixed Start backs out even after pause remap');
  U.openSettings('menu');await wait();release();
  G.settings.gamepad.pause=9;G.applySettings(false);
  press(1);check(U.currentScreen()==='menu','controller back closes settings');
  release();G.newRun();
  const cycle=(button)=>{release();pad.buttons[button].pressed=true;pad.buttons[button].value=1;I.update();G.update(1/60);I.endFrame();};
  cycle(6);check(G.player.activeWeapon===0&&G.player.weapons.length===1,'one equipped weapon stays selected when switch is pressed');
  check(hudText().some(t=>t.text==='ONLY WEAPON EQUIPPED'),'HUD explains single-weapon state');
  G.collectGroundItem({kind:'weapon',itemId:'scatter',tier:1});
  check(G.player.weapons.length===2&&N.Rewards.state().pending.length===0,'empty bay automatically attaches weapon without banking');
  check(G.player.weapons[1].id==='scatter'&&G.mode==='playing','distinct weapon attaches without interrupting gameplay');
  cycle(6);check(G.player.activeWeapon===1,'remapped button switches weapon during gameplay');
  const hud=hudText(),selected=hud.find(t=>t.text==='2. SCATTERGUN');
  check(hud.some(t=>t.text==='EQUIPPED WEAPONS 2 / '+G.player.weaponSlots)&&hud.some(t=>t.text==='1. PULSE LANCE')&&selected,'HUD lists both equipped weapon names and count');
  check(selected.y<innerHeight/2&&hud.some(t=>t.text==='ACTIVE'&&t.y===selected.y),'HUD marks selected weapon beside top-left vitals');
  check(hud.some(t=>t.text==='LB / LT  PREV / NEXT'),'HUD switch hint respects remapped controller buttons');
  I.update();G.updatePlayer(1/60);check(G.player.activeWeapon===1,'held weapon button switches once');
  cycle(G.settings.gamepad.weaponPrev);check(G.player.activeWeapon===0,'previous weapon wraps correctly');
  G.settings=N.deepClone(N.SETTINGS_DEFAULT);G.applySettings(false);cycle(5);check(G.player.activeWeapon===1,'default RB switches weapon');cycle(4);check(G.player.activeWeapon===0,'default LB switches weapon');
  cycle(4);check(G.player.activeWeapon===1,'LB wraps from first to last weapon');
  release();pad.buttons[G.settings.gamepad.fire]={pressed:true,value:1};I.update();
  G.player.weapons[1].cooldown=0;G.playerBullets=[];G.update(1/60);
  check(G.playerBullets.length>0&&G.playerBullets.every(b=>b.weaponId==='scatter'),'controller fire shoots the newly selected distinct weapon');
  cycle(5);check(G.player.activeWeapon===0,'RB wraps from last to first weapon');
  release();pad.buttons[G.settings.gamepad.fire]={pressed:true,value:1};I.update();
  G.player.weapons[0].cooldown=0;G.playerBullets=[];G.update(1/60);
  check(G.playerBullets.length>0&&G.playerBullets.every(b=>b.weaponId==='pulse'),'controller fire shoots original weapon after switching back');
  release();pad.axes=[0,0,1,0];I.update();const aim=I.getAim(G.player,{x:G.player.x,y:G.player.y+100});
  release();const retained=I.getAim(G.player,{x:G.player.x,y:G.player.y+100});
  check(aim.source==='pad'&&retained.source==='pad'&&Math.abs(retained.angle)<1e-6,'neutral right stick retains controller aim');
  window.dispatchEvent(new MouseEvent('pointermove',{clientX:100,clientY:100,movementX:1}));
  check(I.getAim(G.player,{x:G.player.x,y:G.player.y+100}).source==='mouse','mouse movement restores mouse aim');
  press(G.settings.gamepad.pause);G.update(1/60); // frame consumed pause only if an overlay already existed
  if(G.mode==='playing'){release();pad.buttons[9].pressed=true;I.update();G.update(1/60);}
  check(G.mode!=='playing','controller pauses gameplay');
  release();press(1);check(G.mode==='playing','controller back resumes gameplay');
  pad.axes=[0,1,0,0];I.update();G.pauseGame();G.resumeGame();I.update();check(I.getMove().len===0,'held movement blocked across pause');
  release();pad.axes=[0,1,0,0];I.update();check(I.getMove().len===1,'neutral rearms controller movement');
  pads=[];I.update();check(I.getMove().len===0&&!I.isPadConnected(),'disconnect clears movement');
  window.controllerResult={passed:checks.length,checks};
}finally{
  I.cancelCapture();if(descriptor)Object.defineProperty(navigator,'getGamepads',descriptor);else delete navigator.getGamepads;
  I.update();I.resetMovement();G.pauseGame();
}
})();
