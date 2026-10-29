/* Run only in an isolated browser context at /?test=firing. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='firing')throw Error('Use an isolated firing test page');
const N=window.NEON,G=N.Game,I=N.Input,F=N.Firing,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
const key=(type,code='KeyF',repeat=false)=>window.dispatchEvent(new KeyboardEvent(type,{code,repeat,bubbles:true}));
const pointer=(type,buttons=0)=>G.canvas.dispatchEvent(new PointerEvent(type,{button:0,buttons,clientX:100,clientY:100,bubbles:true}));
const fire=()=>I.getAim(G.player,{x:G.player.x+100,y:G.player.y}).fire;
G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{});G.applySettings(false);G.newRun();
check(G.settings.firingMode==='hold','default is held fire');
key('keydown');check(fire(),'keyboard hold begins firing');
G.updatePlayer(1/60);const count=G.playerBullets.length;check(count>0,'held input fires weapon');
G.updatePlayer(0);check(G.playerBullets.length===count,'fire respects cooldown');
key('keyup');check(!fire(),'keyboard release stops held firing');
G.settings.firingMode='toggle';G.applySettings(true);key('keydown');check(fire()&&F.toggled(),'first press toggles on');
for(let i=0;i<10;i++)key('keydown','KeyF',true);
check(fire(),'keyboard repeat never retoggles');key('keyup');check(fire(),'toggle stays on after release');
I.getAim(G.player,{x:0,y:0});I.getAim(G.player,{x:0,y:0});check(fire(),'repeated aim reads do not toggle');
key('keydown');key('keyup');check(!fire(),'second press toggles off');
pointer('pointerdown',1);check(fire(),'mouse first press toggles on');
for(let i=0;i<10;i++)pointer('pointermove',1);check(fire(),'mouse movement while held does not retoggle');
pointer('pointerup');check(fire(),'mouse release keeps toggle on');
G.pauseGame();check(!fire()&&!F.toggled(),'pause resets continuous fire off');G.resumeGame();check(!fire(),'resume stays off');
pointer('pointerdown',1);check(fire(),'fresh mouse press rearms');
window.dispatchEvent(new Event('blur'));check(!fire()&&!F.toggled(),'focus loss resets fire');window.dispatchEvent(new Event('focus'));
pointer('pointermove',1);check(!fire(),'held mouse movement cannot rearm after focus loss');pointer('pointerup');
pointer('pointerdown',1);check(fire(),'release then press rearms after focus loss');pointer('pointerup');
G.settings.firingMode='hold';G.applySettings(false);check(!fire()&&!F.toggled(),'mode switch resets toggle');
G.settings.keyboard.fire='KeyZ';G.applySettings(false);key('keydown','KeyZ');check(fire(),'remapped keyboard fire works');key('keyup','KeyZ');
key('keydown','KeyF');check(!fire(),'old keyboard fire binding is inactive');key('keyup','KeyF');
G.settings.firingMode='toggle';G.applySettings(true);key('keydown','KeyZ');key('keyup','KeyZ');check(fire(),'remapped toggle fires');
G.newRun();check(!fire()&&!F.toggled(),'new run resets toggle off');
check(N.loadSettings().firingMode==='toggle','firing preference persists');
const savedSettings=N.deepClone(N.loadSettings());N.saveSettings({keyboard:{dash:'KeyF'}});
const migrated=N.loadSettings();check(migrated.keyboard.dash==='KeyF'&&migrated.keyboard.fire!=='KeyF','legacy remapping is preserved without a new Fire conflict');N.saveSettings(savedSettings);
const descriptor=Object.getOwnPropertyDescriptor(navigator,'getGamepads');let pads=[];
Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pads});
try{
  const pad={id:'Synthetic fire regression pad',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};pads=[pad];I.update();
  const button=G.settings.gamepad.fire;
  pad.buttons[button]={pressed:true,value:1};I.update();check(fire(),'controller first press toggles on');
  for(let i=0;i<10;i++)I.update();check(fire(),'held controller button does not retoggle');
  pad.buttons[button]={pressed:false,value:0};I.update();pad.buttons[button]={pressed:true,value:1};I.update();check(!fire(),'controller second press toggles off');
  pad.buttons[button]={pressed:false,value:0};I.update();G.settings.firingMode='hold';G.applySettings(false);I.update();
  pad.buttons[button]={pressed:true,value:1};I.update();check(fire(),'controller hold fires');
  G.pauseGame();I.update();G.resumeGame();I.update();check(!fire(),'held trigger cannot fire across pause');
  pad.buttons[button]={pressed:false,value:0};I.update();pad.buttons[button]={pressed:true,value:1};I.update();check(fire(),'trigger release rearms after pause');
  pads=[];I.update();check(!fire(),'disconnect stops held firing');
  pads=[pad];I.update();check(!fire(),'held trigger on reconnect stays blocked');
  pad.buttons[button]={pressed:false,value:0};I.update();
  G.settings.rightStickFire=true;G.applySettings(false);pad.axes=[0,0,1,0];I.update();check(fire(),'optional directional right-stick firing preserved');
  pad.axes=[0,0,0,0];I.update();G.settings.rightStickFire=false;G.applySettings(false);I.update();pad.axes=[0,0,1,0];I.update();check(!fire(),'right-stick firing can be disabled without losing aim');
}finally{if(descriptor)Object.defineProperty(navigator,'getGamepads',descriptor);else delete navigator.getGamepads;I.update();}
G.pauseGame();key('keydown','KeyZ');check(!fire(),'menu input cannot fire');key('keyup','KeyZ');G.resumeGame();check(!fire(),'menu press does not arm firing on resume');G.pauseGame();
window.firingResult={passed:passed.length,checks:passed};
})();
