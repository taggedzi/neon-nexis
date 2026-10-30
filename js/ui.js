/* NEON NEXUS — interface layer */
(function(){
'use strict';
const N=window.NEON;
const G=N.Game;
const UI=N.UI={};
const $=id=>document.getElementById(id);
const screens=['boot','menu','ship','coop','settings','pause','inventory','rewards','levelup','overflow','gameover','complete','howto','credits','confirm','oldsave'];
let currentScreen=null;
let settingsReturn='menu';
let settingsTab='controls';
let confirmReturn=null;
let confirmYes=null;
let bootReady=false;
let shipSelection=null;
let coopSelection=null;
let oldSaveRaw=null;
const focusTimers=[];
let navDirection='',navRepeatAt=0;

function screenEl(name){return document.getElementById('screen-'+name);}
function esc(s){return N.safeName(String(s==null?'':s));}
function clearFocusTimers(){while(focusTimers.length)clearTimeout(focusTimers.pop());}
function showScreen(name,noFocus){
  N.Input.resetFire();
  for(const n of screens){const el=screenEl(n);if(el)el.classList.toggle('active',n===name);}
  currentScreen=name;
  navDirection='';navRepeatAt=0;
  clearFocusTimers();
  if(name!=='boot'&&!noFocus)focusTimers.push(setTimeout(()=>focusFirst(),30));
}
UI.showScreen=showScreen;
UI.hideAll=function(){
  for(const n of screens){const el=screenEl(n);if(el)el.classList.remove('active');}
  currentScreen=null;
  N.Input.cancelCapture();
  clearFocusTimers();
};
UI.overlayOpen=()=>!!currentScreen;
UI.currentScreen=()=>currentScreen;

function focusables(){
  const s=screenEl(currentScreen);if(!s)return [];
  return Array.from(s.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(el=>el.offsetParent!==null);
}
function focusControl(el){
  if(!el)return;
  el.focus({preventScroll:true});
  el.scrollIntoView({block:'nearest',inline:'nearest'});
}
function focusFirst(){focusControl(focusables()[0]);}
function moveFocus(dir){
  const f=focusables();if(!f.length)return;
  let i=f.indexOf(document.activeElement);
  if(i<0)i=0;else i=(i+dir+f.length)%f.length;
  focusControl(f[i]);
}
function focusedRange(){
  const el=document.activeElement;
  return el&&el.tagName==='INPUT'&&el.type==='range'?el:null;
}
function adjustFocusedRange(dir){
  const el=focusedRange();if(!el)return false;
  const step=parseFloat(el.step)||1;
  el.value=String(clamp(parseFloat(el.value)+step*dir,parseFloat(el.min),parseFloat(el.max)));
  el.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
}
function clamp(v,a,b){return v<a?a:v>b?b:v;}

UI.toast=function(text,type='info',duration){
  const box=$('toasts');if(!box)return;
  const d=document.createElement('div');
  d.className='toast '+(type==='info'?'':type);
  d.textContent=text;
  box.appendChild(d);
  while(box.children.length>4)box.removeChild(box.firstChild);
  setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},Math.max(2200,duration||2200)+650);
};

UI.init=function(){
  $('menu-version').textContent = 'BUILD ' + N.RELEASE_VERSION + ' // CLIENT-SIDE ASSET SYNTHESIS';
  for (const [id, shouldExport] of [['btn-old-save-export', true], ['btn-old-save-remove', false]]) {
    $(id).addEventListener('click', () => {
      if (N.SavePolicy.resolve(oldSaveRaw, shouldExport)) {
        oldSaveRaw = null;
      }
      UI.showMenu();
    });
  }
  // persistent control bindings
  $('btn-boot').addEventListener('click',()=>{
    if(!bootReady)return;
    N.Audio.unlock();
    N.Audio.setScene('menu');
    G.setMode('menu');
    UI.showMenu();
  });
  $('btn-continue').addEventListener('click',()=>{
    const save=N.readSave();
    if(!save){UI.toast('NO SAVED RUN // BEGIN A NEW PROTOCOL','warn');refreshSaveMeta();return;}
    // Continue restores pending rewards without interrupting gameplay.
    if(!G.loadFromSave(save,false)) UI.toast('SAVE COULD NOT BE RESTORED','danger');
  });
  $('btn-new-run').addEventListener('click',()=>{
    if(N.hasSave()){
      UI.confirm('START A NEW RUN?','A stored run exists. Continue to ship selection; launching the new run will replace its checkpoint.',()=>UI.showShipSelection(),'CHOOSE SHIP');
    }else{
      UI.showShipSelection();
    }
  });
  $('btn-ship-cancel').addEventListener('click',()=>UI.showMenu());
  $('btn-ship-launch').addEventListener('click',()=>G.newRun(shipSelection));
  $('btn-coop').addEventListener('click',()=>UI.showCoop());
  $('btn-coop-close').addEventListener('click',()=>UI.closeCoop());
  $('btn-coop-back').addEventListener('click',()=>UI.closeCoop());
  $('btn-coop-host').addEventListener('click',hostCoopRoom);
  $('btn-coop-join').addEventListener('click',joinCoopRoom);
  $('btn-coop-copy').addEventListener('click',copyCoopCode);
  $('btn-coop-start').addEventListener('click',()=>{
    if(N.Coop&&N.Coop.startHostRun()) UI.hideAll();
  });
  $('coop-code-input').addEventListener('input',()=>{
    const input=$('coop-code-input');
    input.value=input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  });
  $('coop-code-input').addEventListener('keydown',(event)=>{
    if(event.key==='Enter'){event.preventDefault();joinCoopRoom();}
  });
  $('btn-howto').addEventListener('click',()=>showScreen('howto'));
  $('btn-settings').addEventListener('click',()=>openSettings('menu'));
  $('btn-credits').addEventListener('click',()=>showScreen('credits'));
  $('btn-howto-close').addEventListener('click',()=>UI.showMenu());
  $('btn-howto-done').addEventListener('click',()=>UI.showMenu());
  $('btn-credits-close').addEventListener('click',()=>UI.showMenu());
  $('btn-credits-done').addEventListener('click',()=>UI.showMenu());

  // settings
  document.querySelectorAll('#screen-settings .tab').forEach(t=>{
    t.addEventListener('click',()=>{settingsTab=t.dataset.tab;renderSettings();});
  });
  $('btn-settings-close').addEventListener('click',closeSettings);
  $('btn-settings-done').addEventListener('click',closeSettings);
  $('btn-settings-reset').addEventListener('click',()=>{
    G.settings=N.deepClone(N.SETTINGS_DEFAULT);
    G.applySettings(true);
    renderSettings();
    UI.toast('SYSTEM DEFAULTS RESTORED','loot');
  });

  $('btn-rewards-hud').addEventListener('click',()=>G.openRewards());
  $('btn-pause-rewards').addEventListener('click',()=>G.openRewards());
  $('btn-rewards-close').addEventListener('click',()=>G.closeRewards());
  $('btn-rewards-protocol').addEventListener('click',()=>G.choosePendingProtocol());
  // pause
  $('btn-resume').addEventListener('click',()=>{
    if(N.Coop&&N.Coop.isActive()&&N.Coop.pauseState==='PAUSED'){
      N.Coop.sendReady();
      return;
    }
    G.resumeGame();
  });
  $('btn-inventory').addEventListener('click',()=>G.openInventory());
  $('btn-pause-settings').addEventListener('click',()=>openSettings('pause'));
  $('btn-save-quit').addEventListener('click',()=>G.saveAndQuit());

  // inventory
  $('btn-inventory-close').addEventListener('click',()=>G.closeInventory());
  $('btn-inventory-done').addEventListener('click',()=>G.closeInventory());

  // overflow
  $('btn-overflow-leave').addEventListener('click',()=>G.leaveOverflow());

  // complete
  $('btn-advance').addEventListener('click',()=>{
    if(N.Coop&&N.Coop.isGuest()){UI.toast('WAITING FOR PLAYER 1 TO ADVANCE','warn');return;}
    G.advanceLevel();UI.hideAll();
  });
  $('btn-complete-menu').addEventListener('click',()=>{G.completeToMenu();UI.showMenu();});

  // gameover
  $('btn-restore').addEventListener('click',()=>{
    if(N.Coop&&N.Coop.isActive()){UI.toast('CO-OP SESSIONS DO NOT RESTORE CHECKPOINTS','warn');return;}
    // Restore keeps recovered choices pending in the reward tray.
    if(!G.restoreCheckpoint()) UI.toast('CHECKPOINT RESTORE FAILED','danger');
  });
  $('btn-gameover-menu').addEventListener('click',()=>{G.completeToMenu();UI.showMenu();});

  // confirm
  $('btn-confirm-yes').addEventListener('click',()=>{
    const cb=confirmYes;const ret=confirmReturn;
    confirmYes=null;confirmReturn=null;
    if(cb)cb();
    if(currentScreen==='confirm'&&ret){showScreen(ret);}
  });
  $('btn-confirm-no').addEventListener('click',()=>{
    confirmYes=null;
    const ret=confirmReturn;confirmReturn=null;
    if(ret)showScreen(ret);else UI.showMenu();
  });

  // keyboard
  document.addEventListener('keydown',onKeyDown);
  // UI click feedback
  document.addEventListener('pointerdown',e=>{
    N.Audio.unlock();
    if(e.target.closest&&e.target.closest('button'))N.Audio.ui('click');
  },true);

  refreshSaveMeta();
  showScreen('boot');
  document.body.classList.remove('playing');
};
UI.showBoot=function(){
  bootReady=false;
  const b=$('btn-boot');
  if(b)b.disabled=true;
  showScreen('boot');
  UI.setBootProgress(8,'BOOTING RENDER CORE...');
};
UI.setBootProgress=function(pct,msg){
  const bar=$('boot-progress');if(bar)bar.style.width=clamp(pct,0,100)+'%';
  const log=$('boot-log');if(log&&msg)log.textContent=msg;
  if(pct>=100){bootReady=true;const b=$('btn-boot');if(b)b.disabled=false;}
};
UI.setBootReady=function(){bootReady=true;const b=$('btn-boot');if(b){b.disabled=false;try{b.focus({preventScroll:true});}catch(e){}}};
UI.isBootReady=()=>bootReady;

function refreshSaveMeta(){
  const info=G.getSaveInfo();
  const btn=$('btn-continue'),meta=$('save-meta');
  if(!btn)return;
  if(info){
    btn.disabled=false;
    meta.textContent='SECTOR '+String(info.level).padStart(2,'0')+' · LV '+String(info.playerLevel).padStart(2,'0')+' · '+N.formatTime(info.time);
  }else{
    btn.disabled=true;
    meta.textContent='NO LOCAL CHECKPOINT';
  }
}
UI.refreshSaveMeta=refreshSaveMeta;

UI.showMenu=function(){
  const checkpoint = N.SavePolicy.inspect();
  if (checkpoint.incompatible) {
    oldSaveRaw = checkpoint.raw;
    G.setMode('menu');
    showScreen('oldsave');
    return;
  }
  refreshSaveMeta();
  showScreen('menu');
  if(G.mode!=='menu'&&G.mode!=='boot')G.setMode('menu');
  N.Audio.setScene('menu');
};

// ——— settings ———
function openSettings(returnName){
  settingsReturn=returnName||'menu';
  renderSettings();
  showScreen('settings');
  N.Audio.ui('click');
}
UI.openSettings=openSettings;
UI.showShipSelection=function(){
  const saved=N.readSave()?.player;
  shipSelection={shipType:N.Ships.get(saved?.shipType).id,
    shipColor:N.Ships.palette.some(p=>p.color===saved?.shipColor)?saved.shipColor:N.Ships.palette[0].color};
  const refresh=()=>{
    $('ship-types').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shipType===shipSelection.shipType)));
    $('ship-colors').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shipColor===shipSelection.shipColor)));
    N.Ships.preview($('ship-preview'),shipSelection);
  };
  const types=$('ship-types'),colors=$('ship-colors');types.innerHTML='';colors.innerHTML='';
  for(const t of N.Ships.types){
    const b=document.createElement('button');b.type='button';b.textContent=t.name;b.dataset.shipType=t.id;
    b.addEventListener('click',()=>{shipSelection.shipType=t.id;refresh();});types.appendChild(b);
  }
  for(const color of N.Ships.palette){
    const b=document.createElement('button');b.type='button';b.textContent=color.name;b.dataset.shipColor=color.color;b.style.setProperty('--choice-color',color.color);
    b.addEventListener('click',()=>{shipSelection.shipColor=color.color;refresh();});colors.appendChild(b);
  }
  refresh();showScreen('ship');
};

// ——— co-op uplink ———
function refreshCoopSelection(){
  if(!coopSelection)coopSelection=N.Ships.selection({});
  $('coop-ship-types').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shipType===coopSelection.shipType)));
  $('coop-ship-colors').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shipColor===coopSelection.shipColor)));
  N.Ships.preview($('coop-preview'),coopSelection);
}
function buildCoopChoices(){
  const types=$('coop-ship-types'),colors=$('coop-ship-colors');
  types.replaceChildren();colors.replaceChildren();
  for(const type of N.Ships.types){
    const button=document.createElement('button');
    button.type='button';button.textContent=type.name;button.dataset.shipType=type.id;
    button.addEventListener('click',()=>{coopSelection.shipType=type.id;refreshCoopSelection();});
    types.appendChild(button);
  }
  for(const color of N.Ships.palette){
    const button=document.createElement('button');
    button.type='button';button.textContent=color.name;button.dataset.shipColor=color.color;
    button.style.setProperty('--choice-color',color.color);
    button.addEventListener('click',()=>{coopSelection.shipColor=color.color;refreshCoopSelection();});
    colors.appendChild(button);
  }
}
UI.showCoop=function(reason){
  if(N.Coop&&N.Coop.isActive())return;
  if(!coopSelection){
    const saved=N.readSave()?.player;
    coopSelection=N.Ships.selection(saved||{});
  }
  buildCoopChoices();
  refreshCoopSelection();
  UI.updateCoopStatus(N.Net?{state:N.Net.state,role:N.Net.role,code:N.Net.code,peer:N.Net.peer,transport:N.Net.transport,detail:''}:null);
  if(reason){
    const status=$('coop-status');
    status.textContent=reason;
    status.className='coop-status waiting';
  }
  showScreen('coop');
};
UI.closeCoop=function(){
  if(N.Coop&&N.Coop.isActive()){N.Coop.leaveToMenu();return;}
  if(N.Net&&N.Net.state!=='idle'&&N.Net.state!=='closed')N.Net.leave();
  UI.showMenu();
};
function hostCoopRoom(){
  if(!N.Coop)return;
  if(!coopSelection)coopSelection=N.Ships.selection({});
  if(!N.Coop.hostRoom(coopSelection))UI.toast('CO-OP LINK IS BUSY','warn');
}
function joinCoopRoom(){
  if(!N.Coop)return;
  const input=$('coop-code-input');
  const code=input?input.value:'';
  if(!N.Coop.joinRoom(code,coopSelection||N.Ships.selection({}))){
    UI.toast('ENTER A 4-6 CHARACTER CODE','warn');
    if(input)input.focus();
  }
}
function copyCoopCode(){
  const code=($('coop-code').textContent||'').trim();
  if(!code||code==='-----'){UI.toast('NO ROOM CODE YET','warn');return;}
  const fallback=()=>UI.toast('ROOM CODE // '+code,'loot',3200);
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(()=>UI.toast('ROOM CODE COPIED // '+code,'loot',2200),fallback);
  }else fallback();
}
UI.updateCoopStatus=function(status){
  const el=$('coop-status');if(!el)return;
  const state=status&&status.state||'idle';
  const labels={idle:'OFFLINE // NO UPLINK',closed:'OFFLINE // NO UPLINK',connecting:'CONTACTING SIGNAL SERVER...',waiting:'WAITING',connected:'LINK STABLE',reconnecting:'SIGNAL LOST // RECONNECTING...',error:'UPLINK ERROR'};
  let text=labels[state]||'OFFLINE // NO UPLINK';
  if(status&&status.detail)text+=' // '+status.detail;
  el.textContent=text;
  el.className='coop-status'+(state==='error'?' error':(state==='waiting'||state==='connecting'||state==='reconnecting'?' waiting':''));
  const code=(status&&status.code)||(N.Net?N.Net.code:'')||'';
  $('coop-code').textContent=code||'-----';
  $('btn-coop-copy').disabled=!code;
  $('coop-note').textContent='SYNC: '+(state==='connected'?'LINK STABLE':'PENDING')+' // TRANSPORT: '+(N.Net?N.Net.label():'OFFLINE');
  const busy=state==='connecting'||state==='connected'||state==='reconnecting';
  const hosting=state==='waiting'&&status&&status.role==='host';
  const guestWaiting=state==='waiting'&&status&&status.role==='guest';
  $('btn-coop-host').disabled=busy||hosting;
  $('btn-coop-join').disabled=busy||hosting||(guestWaiting&&!!(status&&status.peer));
  const canStart=state==='connected'&&status&&status.role==='host'&&!!status.peer;
  $('btn-coop-start').hidden=!canStart;
  $('btn-coop-start').disabled=!canStart;
};
UI.updateCoopPeer=function(peer){
  if(!$('screen-coop'))return;
  UI.updateCoopStatus({
    state:N.Net?N.Net.state:'idle',
    role:N.Net?N.Net.role:'solo',
    code:N.Net?N.Net.code:'',
    peer:peer||null,
    transport:N.Net?N.Net.transport:'none',
    detail:peer?'PLAYER LINKED':'PLAYER DISCONNECTED'
  });
};
function closeSettings(){
  N.Input.cancelCapture();
  N.Audio.ui('back');
  if(settingsReturn==='pause'){
    if(G.player&&G.mode!=='playing'){G.setMode('paused');UI.showPause(G.getPauseData());}
    else UI.showMenu();
  }else UI.showMenu();
}
function getPath(obj,path){return path.split('.').reduce((o,k)=>o&&o[k],obj);}
const SETTING_PATHS = new Set([
  'deadzone', 'rightStickFire',
  'audio.master', 'audio.music', 'audio.sfx', 'audio.muted',
  'graphics.particles', 'graphics.shake', 'graphics.scanlines',
  'graphics.glitch', 'graphics.showFps', 'accessibility.reducedFlash'
]);
function setPath(obj, path, val) {
  if (typeof path !== 'string') {
    return false;
  }
  const parts = path.split('.');
  if (parts.some(key => key === '__proto__' || key === 'constructor' || key === 'prototype') ||
      !SETTING_PATHS.has(path)) {
    return false;
  }
  let target = obj;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (target === null || typeof target !== 'object' || !Object.hasOwn(target, key)) {
      return false;
    }
    if (i === parts.length - 1) {
      target[key] = val;
      return true;
    }
    target = target[key];
  }
  return false;
}
function toggleHTML(path,label){
  const v=!!getPath(G.settings,path);
  return `<div class="setting-row"><div class="setting-label"><b>${esc(label)}</b><small>TOGGLE VISUAL FEEDBACK</small></div>
    <button class="toggle ${v?'on':''}" data-toggle="${path}" aria-pressed="${v}" type="button">${v?'ON':'OFF'}</button></div>`;
}
function rangeHTML(path,label,small,min,max,step,scale,fmt){
  const v=getPath(G.settings,path);
  const shown=Math.round(v/scale);
  const pct=((shown-min)/(max-min))*100;
  return `<div class="setting-row"><div class="setting-label"><b>${esc(label)}</b><small>${esc(small)}</small></div>
    <div class="setting-control"><div class="range-wrap">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${shown}" data-setting="${path}" data-scale="${scale}" data-fmt="${fmt}" style="--fill:${clamp(pct,0,100)}%">
      <span class="range-val">${fmt==='pct'?shown+'%':shown}</span>
    </div></div></div>`;
}
function bindRows(root){
  root.querySelectorAll('[data-setting]').forEach(el=>{
    const update=()=>{
      const scale=parseFloat(el.dataset.scale)||1;
      let val=parseFloat(el.value)*scale;
      if (!setPath(G.settings, el.dataset.setting, val)) {
        return;
      }
      const valEl=el.parentElement.querySelector('.range-val');
      if(valEl)valEl.textContent=(el.dataset.fmt==='pct'?el.value+'%':el.value);
      const pct=((parseFloat(el.value)-parseFloat(el.min))/(parseFloat(el.max)-parseFloat(el.min)))*100;
      el.style.setProperty('--fill',clamp(pct,0,100)+'%');
      G.applySettings(true);
    };
    el.addEventListener('input',update);
  });
  root.querySelectorAll('[data-toggle]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const path=btn.dataset.toggle;
      const next=!getPath(G.settings,path);
      if (!setPath(G.settings, path, next)) {
        return;
      }
      btn.classList.toggle('on',next);btn.setAttribute('aria-pressed',next?'true':'false');btn.textContent=next?'ON':'OFF';
      G.applySettings(true);
    });
  });
  root.querySelectorAll('[data-quality]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      G.settings.graphics.quality=btn.dataset.quality;
      G.applySettings(true);
      renderSettings();
    });
  });
  root.querySelectorAll('[data-movement-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      G.settings.movementMode=btn.dataset.movementMode;
      G.applySettings(true);renderSettings();
    });
  });
  root.querySelectorAll('[data-firing-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      G.settings.firingMode=btn.dataset.firingMode;
      G.applySettings(true);renderSettings();
    });
  });
  root.querySelectorAll('[data-bind-key]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      N.Input.cancelCapture();
      const action=btn.dataset.bindKey;
      const old=btn.textContent;
      btn.textContent='PRESS KEY...';btn.classList.add('capturing');
      N.Input.startKeyCapture(code=>{
        if(code){assignBinding('keyboard',action,code);N.saveSettings(G.settings);N.Input.setSettings(G.settings);}
        renderSettings();
      });
    });
  });
  root.querySelectorAll('[data-bind-pad]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      N.Input.cancelCapture();
      const action=btn.dataset.bindPad;
      btn.textContent='PRESS BUTTON...';btn.classList.add('capturing');
      N.Input.startPadCapture(index=>{
        if(index!=null){assignBinding('gamepad',action,index);N.saveSettings(G.settings);N.Input.setSettings(G.settings);}
        renderSettings();
      });
    });
  });
  const erase=root.querySelector('[data-action="erase-save"]');
  if(erase)erase.addEventListener('click',()=>{
    UI.confirm('ERASE LOCAL SAVE?','This removes the stored checkpoint for this browser. The active run, if any, will keep playing but cannot be restored after closing.',()=>{
      N.clearSave();G.lastCheckpoint=null;refreshSaveMeta();
      UI.toast('LOCAL CHECKPOINT ERASED','warn');
      setTimeout(()=>{openSettings(settingsReturn);settingsTab='data';renderSettings();},10);
    },'ERASE SAVE');
  });
  const saveNow=root.querySelector('[data-action="save-now"]');
  if(saveNow)saveNow.addEventListener('click',()=>{
    if(G.saveCheckpoint(false,'manual')){refreshSaveMeta();UI.toast('CHECKPOINT SYNCED','loot');renderSettings();}
    else UI.toast('SAVE FAILED','danger');
  });
}
function assignBinding(type,action,value){
  const map=G.settings[type];
  const old=map[action];
  const defs=type==='keyboard'?N.KEY_ACTIONS:N.PAD_ACTIONS;
  for(const [a] of defs){
    if(a!==action&&map[a]===value)map[a]=old;
  }
  map[action]=value;
}
function renderSettings(){
  const active=document.activeElement;
  const focusKey=active?.closest('#settings-body')?['setting','toggle','quality','movementMode','firingMode','bindKey','bindPad','action'].find(k=>active.dataset[k]!=null):null;
  const focusValue=focusKey?active.dataset[focusKey]:null;
  const s=G.settings;
  document.querySelectorAll('#screen-settings .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===settingsTab));
  const body=$('settings-body');if(!body)return;
  if(settingsTab==='controls'){
    const driving=s.movementMode==='driving';
    const drivingLabels={moveUp:'FORWARD THRUST',moveDown:'BRAKE / REVERSE',moveLeft:'STEER LEFT',moveRight:'STEER RIGHT'};
    body.innerHTML=`
      <div class="settings-section"><h3>CONTROLLER QUICK GUIDE</h3>
        <div class="data-block"><p>Menus: D-pad or left stick selects; left/right adjusts sliders. A / Cross (bottom face button) confirms; B / Circle (right face button) goes back. START / Options also goes back. Hold a direction to repeat. Menu buttons stay fixed when gameplay bindings change.</p>
        <p>Gameplay: left stick ${driving?'steers and thrusts / brakes / reverses':'moves'}; right stick aims. ${N.PAD_ACTIONS.map(([action,label])=>esc(label)+': '+esc(N.padLabel(s.gamepad[action]))).join(' · ')}. Weapon cycling requires more than one equipped weapon. Pickups attach automatically while weapon bays are available; with full bays, open Rewards to install or replace weapons.</p>
        <p>Labels use Xbox / standard browser button order (A = Cross, B = Circle, X = Square, Y = Triangle; LB/RB = L1/R1; LT/RT = L2/R2). Other controllers may report different layouts; use the input monitor and remap gameplay buttons below.</p>
        <p id="controller-monitor"></p></div>
      </div>
      <div class="settings-section"><h3>MOVEMENT MODE</h3>
        <div class="setting-row"><div class="setting-label"><b>SHIP CONTROLS</b><small>SAVED BETWEEN SESSIONS</small></div>
          <div class="segmented">
            <button data-movement-mode="directional" aria-pressed="${!driving}" class="${!driving?'active':''}" type="button">DIRECTIONAL</button>
            <button data-movement-mode="driving" aria-pressed="${driving}" class="${driving?'active':''}" type="button">DRIVING</button>
          </div>
        </div>
        <div class="data-block"><p>${driving?'Forward follows the ship nose. Brake slows forward motion before reversing. Steering also turns at rest. Mouse/right stick aims weapons independently. Left stick: horizontal steering, up for thrust, down for brake/reverse. Fire and dash use the mapped buttons. A neutral stick is required after pauses, focus changes or disconnects.':'Movement follows screen directions. Left stick moves and right stick aims; optional right-stick firing is controlled below. Mouse aim/fire remains available.'} The movement keys below respect remapping.</p></div>
      </div>
      <div class="settings-section"><h3>FIRING MODE</h3>
        <div class="setting-row"><div class="setting-label"><b>WEAPON TRIGGER</b><small>SAVED BETWEEN SESSIONS</small></div>
          <div class="segmented">
            <button data-firing-mode="hold" aria-pressed="${s.firingMode==='hold'}" class="${s.firingMode==='hold'?'active':''}" type="button">HOLD TO FIRE</button>
            <button data-firing-mode="toggle" aria-pressed="${s.firingMode==='toggle'}" class="${s.firingMode==='toggle'?'active':''}" type="button">TOGGLE FIRE</button>
          </div>
        </div>
        ${toggleHTML('rightStickFire','RIGHT STICK FIRES')}
        <div class="data-block"><p>Use LMB, the remapped Fire key, or the mapped controller Fire button. Hold mode fires while pressed. Toggle mode changes ON/OFF once per press. Optional right-stick firing uses each neutral-to-aim movement as a press in directional mode. Auto-fire stays ON until toggled OFF, including across menus, pause, focus loss and new runs. Weapons only fire during focused gameplay. Changing firing modes resets auto-fire OFF. Release held fire inputs before rearming after an interruption. Aiming and weapon cooldowns are unchanged.</p></div>
      </div>
      <div class="settings-section"><h3>KEYBOARD BINDINGS</h3>
        ${N.KEY_ACTIONS.map(([action,label])=>`
          <div class="setting-row"><div class="setting-label"><b>${driving?(drivingLabels[action]||label):label}</b><small>KEYBOARD / MOUSE SETUP</small></div>
          <button class="keybind" data-bind-key="${action}" type="button">${esc(N.keyLabel(s.keyboard[action]))}</button></div>`).join('')}
      </div>
      <div class="settings-section"><h3>GAMEPAD BINDINGS</h3>
        ${N.PAD_ACTIONS.map(([action,label])=>`
          <div class="setting-row"><div class="setting-label"><b>${label}</b><small>${N.Input.isPadConnected()?esc(N.Input.getPadName()).slice(0,48):'NO CONTROLLER DETECTED'}</small></div>
          <button class="keybind pad" data-bind-pad="${action}" type="button">${esc(N.padLabel(s.gamepad[action]))}</button></div>`).join('')}
        <div class="setting-row"><div class="setting-label"><b>STICK DEADZONE</b><small>GAMEPAD INPUT THRESHOLD</small></div>
          <div class="setting-control"><div class="range-wrap">
            <input type="range" min="5" max="60" step="1" value="${Math.round(s.deadzone*100)}" data-setting="deadzone" data-scale="0.01" data-fmt="pct" style="--fill:${((s.deadzone*100-5)/55)*100}%">
            <span class="range-val">${Math.round(s.deadzone*100)}%</span>
          </div></div>
        </div>
      </div>
      <div class="data-block"><p>Select a binding, then press the desired key or gamepad button. Duplicate assignments are swapped automatically. Escape cancels keyboard capture; B / Circle also cancels keyboard capture. Controller capture accepts any button, including menu buttons. Mouse aim/fire is always available in addition to gamepad controls.</p></div>`;
  }else if(settingsTab==='audio'){
    body.innerHTML=`
      <div class="settings-section"><h3>OUTPUT LEVELS</h3>
        ${rangeHTML('audio.master','MASTER VOLUME','FULL MIX LEVEL',0,100,1,.01,'pct')}
        ${rangeHTML('audio.music','MUSIC','PROCEDURAL SECTOR SOUNDTRACK',0,100,1,.01,'pct')}
        ${rangeHTML('audio.sfx','SOUND EFFECTS','WEAPONS / IMPACTS / UI',0,100,1,.01,'pct')}
        ${toggleHTML('audio.muted','MUTE ALL AUDIO')}
      </div>
      <div class="data-block"><p>All audio is synthesized in real time by the Web Audio engine. No external files are streamed. Use the master level to silence the entire mix.</p></div>`;
  }else if(settingsTab==='visual'){
    const q=s.graphics.quality;
    body.innerHTML=`
      <div class="settings-section"><h3>RENDER PROFILE</h3>
        <div class="setting-row"><div class="setting-label"><b>QUALITY</b><small>HIGHER SETTINGS INCREASE DPR AND PARTICLE DENSITY</small></div>
          <div class="segmented">
            <button data-quality="low" class="${q==='low'?'active':''}" type="button">LOW</button>
            <button data-quality="medium" class="${q==='medium'?'active':''}" type="button">MED</button>
            <button data-quality="high" class="${q==='high'?'active':''}" type="button">HIGH</button>
          </div>
        </div>
        ${rangeHTML('graphics.particles','PARTICLE DENSITY','EXPLOSIONS / TRAILS / DEBRIS',25,200,5,.01,'pct')}
        ${toggleHTML('graphics.shake','SCREEN SHAKE')}
        ${toggleHTML('graphics.scanlines','SCANLINES & GRAIN')}
        ${toggleHTML('graphics.glitch','DIGITAL GLITCH EFFECTS')}
        ${toggleHTML('graphics.showFps','PERFORMANCE READOUT')}
        ${toggleHTML('accessibility.reducedFlash','REDUCE FLASHING')}
      </div>
      <div class="data-block"><p>Glitch effects distort the rendered frame on impacts, pickups and system events. Reduce Flashing also limits screen flashes for photosensitive players.</p></div>`;
  }else{
    const info=G.getSaveInfo();
    body.innerHTML=`
      <div class="settings-section"><h3>LOCAL DATA</h3>
        <div class="setting-row"><div class="setting-label"><b>SAVE STORAGE</b><small>${N.storageStatus()}</small></div><span class="chip">${info?'CHECKPOINT PRESENT':'NO CHECKPOINT'}</span></div>
        ${info?`<div class="setting-row"><div class="setting-label"><b>STORED RUN</b><small>SECTOR ${String(info.level).padStart(2,'0')} · PLAYER LV ${info.playerLevel} · ${N.formatTime(info.time)} PLAYED</small></div><span class="chip">${info.weapons} WEAPONS</span></div>`:''}
        <div class="setting-row"><div class="setting-label"><b>AUTO-SAVE</b><small>WRITES AT LEVEL START, LEVEL END AND EVERY 60-SECOND CHECKPOINT</small></div><span class="chip">ENABLED</span></div>
      </div>
      <div class="data-block">
        <p>Saves are local to this browser only. No gameplay data leaves this machine and no high-score service is used.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${G.run&&G.player&&!G.player.dead?'<button class="neon-btn" data-action="save-now" type="button">SYNC CHECKPOINT NOW</button>':''}
          <button class="neon-btn danger" data-action="erase-save" type="button">ERASE LOCAL SAVE</button>
        </div>
      </div>`;
  }
  bindRows(body);
  if(focusKey)focusControl(Array.from(body.querySelectorAll('button,input')).find(el=>el.dataset[focusKey]===focusValue));
}
UI.switchSettingsTab=function(tab){settingsTab=tab;renderSettings();};

function finiteStat(value,fallback,min,max){
  const number=Number(value);
  if(!Number.isFinite(number)) return fallback;
  return Math.min(max,Math.max(min,number));
}
function fillStatGrid(el,cells,accentFirst){
  if(!el) return;
  el.replaceChildren();
  cells.forEach(([label,value],index)=>{
    const row=document.createElement('div');
    if(accentFirst&&index===0) row.className='accent';
    const name=document.createElement('b');
    name.textContent=String(label);
    const amount=document.createElement('span');
    amount.textContent=String(value);
    row.append(name,amount);
    el.append(row);
  });
}

// ——— pause / inventory / overflow ———
UI.showPause=function(data){
  if(!data)return;
  $('pause-sector').textContent='SECTOR '+String(data.sector).padStart(2,'0');
  const cells=[
    ['TIME ELAPSED',N.formatTime(data.time)],
    ['TIME REMAINING',N.formatTime(data.timeLeft)],
    ['SECTOR KILLS',data.kills],
    ['TOTAL KILLS',data.totalKills],
    ['PILOT LEVEL',data.level],
    ['ANCHORS',data.anchorsLeft+' / '+data.anchorsTotal]
  ];
  fillStatGrid($('pause-stats'),cells,false);
  $('btn-save-quit').textContent=N.Coop&&N.Coop.isActive()?'LEAVE CO-OP':'SAVE & QUIT';
  if(N.Coop&&N.Coop.isActive()){
    UI.showCoopPause({owner:N.Coop.pauseOwner,ready:N.Coop.readyPeers,selfReady:N.Coop._readySent});
  }else{
    UI.hideCoopElements();
  }
  showScreen('pause');
};
UI.hideCoopElements=function(){
  const coopEl=$('pause-coop');
  if(coopEl)coopEl.hidden=true;
  const countdownEl=$('pause-coop-countdown');
  if(countdownEl)countdownEl.hidden=true;
  const title=document.querySelector('#screen-pause h2');
  if(title)title.textContent='PAUSED';
  const resumeBtn=$('btn-resume');
  if(resumeBtn){resumeBtn.textContent='RESUME';resumeBtn.disabled=false;}
  const micro=$('pause-micro');
  if(micro)micro.textContent='PROGRESS IS AUTO-SYNCED AT CHECKPOINTS AND SECTOR ENDS.';
};
UI.showCoopPause=function(data){
  const coop=N.Coop;
  if(!coop||!coop.isActive())return;
  const coopEl=$('pause-coop');
  if(coopEl)coopEl.hidden=false;
  const countdownEl=$('pause-coop-countdown');
  if(countdownEl)countdownEl.hidden=true;
  const title=document.querySelector('#screen-pause h2');
  if(title)title.textContent='CO-OP PAUSE';
  const micro=$('pause-micro');
  if(micro)micro.textContent='WAITING FOR ALL PLAYERS TO READY UP';
  UI.updateCoopPause(data);
  showScreen('pause');
};
UI.updateCoopPause=function(data){
  const coop=N.Coop;
  if(!coop||!coop.isActive())return;
  const ready=Array.isArray(data&&data.ready)?data.ready:[];
  const selfId=N.Net&&N.Net.clientId;
  const peerId=coop._peerId;
  const selfReady=!!selfId&&ready.indexOf(selfId)>=0;
  const peerReady=!!peerId&&ready.indexOf(peerId)>=0;
  const statusEl=$('pause-coop-status');
  if(statusEl){
    const selfLabel=coop.host?'PLAYER 1 (YOU)':'PLAYER 2 (YOU)';
    const peerLabel=coop.host?'PLAYER 2':'PLAYER 1';
    statusEl.innerHTML=
      '<span class="'+(selfReady?'ready':'')+'">'+selfLabel+': '+(selfReady?'READY':'WAITING')+'</span>'+
      '<span class="'+(peerReady?'ready':'')+'">'+peerLabel+': '+(peerReady?'READY':'WAITING')+'</span>';
  }
  const resumeBtn=$('btn-resume');
  if(resumeBtn){resumeBtn.textContent=selfReady?'WAITING FOR PLAYERS':'READY';resumeBtn.disabled=selfReady;}
};
UI.showCoopCountdown=function(seconds){
  const coop=N.Coop;
  if(!coop||!coop.isActive())return;
  const coopEl=$('pause-coop');
  if(coopEl)coopEl.hidden=false;
  const countdownEl=$('pause-coop-countdown');
  if(countdownEl)countdownEl.hidden=false;
  const title=document.querySelector('#screen-pause h2');
  if(title)title.textContent='CO-OP RESUME';
  const resumeBtn=$('btn-resume');
  if(resumeBtn){resumeBtn.textContent='RESUMING...';resumeBtn.disabled=true;}
  const micro=$('pause-micro');
  if(micro)micro.textContent='ALL PLAYERS READY // RESUMING IN '+seconds;
  UI.updateCoopCountdown(seconds);
  showScreen('pause');
};
UI.showCoopSyncWait=function(){
  const micro=$('pause-micro');
  if(micro)micro.textContent='WAITING FOR SIGNAL CONFIRMATION';
};
UI.updateCoopCountdown=function(seconds){
  const countdownEl=$('pause-coop-countdown');
  if(countdownEl)countdownEl.textContent=String(Math.max(0,seconds));
  const micro=$('pause-micro');
  if(micro)micro.textContent=seconds>0?'ALL PLAYERS READY // RESUMING IN '+seconds:'RESUMING...';
};
UI.showInventory=function(data){
  if(!data)return;
  const p=G.player;
  const stats=p.stats;
  $('inv-summary').innerHTML=[
    `<span class="chip">WEAPON BAYS <b>${data.weapons.length}/${data.weaponSlots}</b></span>`,
    `<span class="chip">MODULE BANKS <b>${data.passives.length}/${data.passiveSlots}</b></span>`,
    `<span class="chip">PILOT LV <b>${data.level}</b></span>`,
    `<span class="chip">DMG <b>x${stats.damageMul.toFixed(2)}</b></span>`,
    `<span class="chip">RATE <b>x${stats.rateMul.toFixed(2)}</b></span>`,
    `<span class="chip">CRIT <b>${(stats.critChance*100).toFixed(0)}%</b></span>`,
    `<span class="chip">MOVE <b>${Math.round(stats.moveSpeed)}</b></span>`,
    `<span class="chip">LUCK <b>x${stats.luck.toFixed(2)}</b></span>`
  ].join('');
  $('inv-weapon-count').textContent=data.weapons.length+' / '+data.weaponSlots;
  $('inv-passive-count').textContent=data.passives.length+' / '+data.passiveSlots;
  const wl=$('inv-weapons'),pl=$('inv-passives');
  wl.innerHTML='';
  data.weapons.forEach((it,i)=>{
    const card=itemCard('weapon',it,i,i===data.activeWeapon,data.weapons.length<=1);
    wl.appendChild(card);
  });
  for(let i=data.weapons.length;i<data.weaponSlots;i++){
    const e=document.createElement('div');e.className='item-card empty';e.textContent='OPEN WEAPON BAY';wl.appendChild(e);
  }
  pl.innerHTML='';
  data.passives.forEach((it,i)=>{
    const card=itemCard('mod',it,i,false,false);
    pl.appendChild(card);
  });
  for(let i=data.passives.length;i<data.passiveSlots;i++){
    const e=document.createElement('div');e.className='item-card empty';e.textContent='OPEN MODULE BANK';pl.appendChild(e);
  }
  wl.querySelectorAll('.item-drop').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(G.dropItem('weapon',parseInt(btn.dataset.index)))UI.showInventory(G.getInventoryData());
    });
  });
  pl.querySelectorAll('.item-drop').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(G.dropItem('mod',parseInt(btn.dataset.index)))UI.showInventory(G.getInventoryData());
    });
  });
  showScreen('inventory');
};
function itemIcon(kind,it){
  if(kind==='weapon'){
    const def=it.def||N.WEAPON_BY_ID[it.id]||N.WEAPON_BY_ID[it.itemId];
    return def?N.Assets.weaponIconURL(def.id,def.color):'';
  }
  const def=it.def||N.MOD_BY_ID[it.id]||N.CONSUMABLES[it.id]||{color:it.color,glyph:'dmg'};
  return N.Assets.modIconURL(it.id||it.itemId,it.color||def.color,def.glyph);
}
function itemCard(kind,it,index,active,disableDrop){
  const def=it.def||N.WEAPON_BY_ID[it.id];
  const card=document.createElement('div');card.className='item-card';
  if(active)card.style.borderColor='rgba(0,240,255,.55)';
  const url=itemIcon(kind,it);
  const name=kind==='weapon'?def.name:def.name;
  const desc=kind==='weapon'?def.tag:(def.tag||'');
  const level=kind==='weapon'?`TIER ${['I','II','III'][it.tier-1]||'I'} · LV ${it.level}`:`STACK ${it.stacks}/${def.maxStacks}${def.type==='curse'?' · CURSED':''}`;
  card.innerHTML=`<div class="item-icon"><img src="${url}" alt="" style="width:32px;height:32px"></div>
    <div class="item-copy"><b>${esc(name)}${active?' · ACTIVE':''}</b><small>${esc(desc)}</small></div>
    <div class="item-level">${esc(level)}</div>
    <button class="item-drop" data-index="${index}" ${disableDrop?'disabled':''} type="button">DISCARD</button>`;
  if(active)card.style.background='rgba(0,240,255,.055)';
  return card;
}

UI.updateRewards=function(){
  const button=$('btn-rewards-hud'),count=N.Rewards.count();
  button.hidden=G.mode!=='playing'||count===0;
  if(button.hidden)return;
  const key=G.settings.keyboard.rewards,pad=G.settings.gamepad.rewards;
  const label=`REWARDS ${count} · ${N.keyLabel(key)} / ${N.padLabel(pad)}`;
  if(button.textContent!==label)button.textContent=label;
};
UI.showRewards=function(){
  const pending=N.Rewards.state().pending,list=$('rewards-list');list.replaceChildren();
  const protocol=$('btn-rewards-protocol');
  protocol.textContent=`CHOOSE PROTOCOL (${G.pendingLevelUps})`;protocol.disabled=G.pendingLevelUps<=0;
  pending.forEach((item,index)=>{
    const def=(item.kind==='weapon'?N.WEAPON_BY_ID:N.MOD_BY_ID)[item.itemId];
    const row=document.createElement('div');row.className='overflow-item';
    row.innerHTML=`<div class="item-copy"><b>${esc(def.name)}</b><small>${esc(def.desc||def.tag)}${item.kind==='weapon'?' · TIER '+item.tier:''}</small></div><button class="swap-btn" type="button">INSTALL</button><button class="item-drop" type="button">DISCARD</button>`;
    row.querySelector('.swap-btn').addEventListener('click',()=>G.takeReward(index));
    row.querySelector('.item-drop').addEventListener('click',()=>G.discardReward(index));
    list.appendChild(row);
  });
  $('rewards-capacity').textContent=`EQUIPMENT ${pending.length}/${N.Rewards.CAPACITY} · Weapons attach to empty bays. Full bays defer weapons here; modules always wait here. Full tray leaves deferred gear on the ground. Unspent protocols are retained.`;
  const close=$('btn-rewards-close');
  if(close) close.textContent=(N.Coop&&N.Coop.isActive())?'RETURN TO READY':'RETURN TO COMBAT';
  showScreen('rewards');
};

UI.showOverflow=function(data){
  if(!data)return;
  const {kind,def,item}=data;
  const iconURL=kind==='weapon'?N.Assets.weaponIconURL(def.id,def.color):N.Assets.modIconURL(def.id,def.color,def.glyph);
  const desc=kind==='weapon'?def.tag+' — '+def.desc:(def.tag+' — '+def.desc);
  $('overflow-incoming').innerHTML=`
    <div class="item-icon"><img src="${iconURL}" alt="" style="width:32px;height:32px"></div>
    <div class="incoming-copy"><b>${esc(def.name)}</b><small>${esc(desc)}</small></div>
    <div class="incoming-tag">${kind==='weapon'?'NEW WEAPON':'NEW MODULE'}</div>`;
  const list=$('overflow-list');list.innerHTML='';
  if(kind==='weapon'){
    data.weapons.forEach((w,i)=>{
      const d=w.def;
      const row=document.createElement('div');row.className='overflow-item';
      row.innerHTML=`<div class="item-icon"><img src="${N.Assets.weaponIconURL(d.id,d.color)}" alt="" style="width:32px;height:32px"></div>
        <div class="item-copy"><b>${esc(d.name)}${i===data.activeWeapon?' · ACTIVE':''}</b><small>${esc(d.tag)} · TIER ${['I','II','III'][w.tier-1]||'I'} · LV ${w.level}</small></div>
        <button class="swap-btn" data-index="${i}" type="button">KEEP NEW / DISCARD OLD</button>`;
      row.querySelector('.swap-btn').addEventListener('click',()=>G.swapOverflow('weapon',i));
      list.appendChild(row);
    });
  }else{
    data.passives.forEach((m,i)=>{
      const d=m.def;
      const row=document.createElement('div');row.className='overflow-item';
      row.innerHTML=`<div class="item-icon"><img src="${N.Assets.modIconURL(d.id,d.color,d.glyph)}" alt="" style="width:32px;height:32px"></div>
        <div class="item-copy"><b>${esc(d.name)}${d.type==='curse'?' · CURSED':''}</b><small>${esc(d.tag)} · STACK ${m.stacks}/${d.maxStacks}</small></div>
        <button class="swap-btn" data-index="${i}" type="button">KEEP NEW / DISCARD OLD</button>`;
      row.querySelector('.swap-btn').addEventListener('click',()=>G.swapOverflow('mod',i));
      list.appendChild(row);
    });
  }
  showScreen('overflow');
};

// ——— level up / completion / game over ———
UI.showLevelUp=function(player,choices,milestone){
  if(!player||!choices)return;
  $('levelup-level').textContent=player.level;
  $('levelup-milestone').innerHTML=milestone?`MILESTONE: <span style="color:var(--lime)">${esc(milestone.label)}</span>`:'PERMANENT PROTOCOL SELECTION';
  const grid=$('protocol-grid');grid.innerHTML='';
  choices.forEach((p,i)=>{
    const b=document.createElement('button');
    b.className='protocol-card';b.type='button';b.dataset.pid=p.id;b.style.setProperty('--card-color',p.color);
    b.innerHTML=`<span class="protocol-index">0${i+1}</span>
      <div class="protocol-icon"></div>
      <div class="tag">${esc(p.tag)}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="key-hint">PRESS ${i+1} OR SELECT</div>`;
    b.addEventListener('click',()=>G.applyProtocol(p.id));
    grid.appendChild(b);
  });
  showScreen('levelup');
};
UI.showComplete=function(summary){
  if(!summary||typeof summary!=='object')return;
  const timed=summary.reason==='timer';
  const sector=Math.floor(finiteStat(summary.sector,1,0,9999));
  const nextLevel=Math.floor(finiteStat(summary.nextLevel,1,1,9999));
  const anchors=Math.floor(finiteStat(summary.anchors,0,0,999));
  const anchorsTotal=Math.floor(finiteStat(summary.anchorsTotal,0,0,999));
  $('complete-title').textContent=timed?'SURVIVAL PROTOCOL COMPLETE':'SECTOR CLEARED';
  $('complete-badge').textContent=timed?'SURVIVE':'CLEAR';
  const cells=[
    ['SECTOR',String(sector).padStart(2,'0')],
    ['TIME',N.formatTime(finiteStat(summary.time,0,0,1e7))],
    ['KILLS',Math.floor(finiteStat(summary.kills,0,0,1e7))],
    ['DAMAGE',N.formatNum(finiteStat(summary.damage,0,0,1e12))],
    ['PILOT LV',Math.floor(finiteStat(summary.level,1,1,9999))],
    ['ANCHORS LEFT',anchors+' / '+anchorsTotal]
  ];
  fillStatGrid($('complete-stats'),cells,true);
  const guest=N.Coop&&N.Coop.isGuest();
  const advance=$('btn-advance');
  advance.hidden=guest;
  advance.disabled=guest;
  advance.textContent=guest?'WAITING FOR PLAYER 1':'DESCEND TO SECTOR '+String(nextLevel).padStart(2,'0');
  $('btn-complete-menu').textContent=N.Coop&&N.Coop.isActive()?'LEAVE CO-OP':'SAVE & RETURN TO MENU';
  showScreen('complete');
};
UI.showGameOver=function(data){
  if(!data)return;
  const cells=[
    ['SECTOR',String(data.sector).padStart(2,'0')],
    ['TOTAL KILLS',data.kills],
    ['SURVIVAL TIME',N.formatTime(data.time)],
    ['PILOT LV',data.level],
    ['SECTORS CLEARED',data.sectors],
    ['ANCHORS LEFT',data.anchors+' / '+data.anchorsTotal],
    ['SECTOR TIME',N.formatTime(data.sectorTime)],
    ['DAMAGE DEALT',N.formatNum(data.damage)]
  ];
  fillStatGrid($('gameover-stats'),cells,false);
  const coop=N.Coop&&N.Coop.isActive();
  $('btn-restore').disabled=coop?true:!data.hasCheckpoint;
  $('btn-gameover-menu').textContent=coop?'LEAVE CO-OP':'RETURN TO MAIN MENU';
  $('gameover-save-note').textContent=coop?'CO-OP SESSION ENDED — RETURN TO THE HUB':(data.hasCheckpoint?'LAST LOCAL CHECKPOINT AVAILABLE':'NO CHECKPOINT FOUND — RETURN TO THE NEXUS');
  showScreen('gameover');
};
UI.confirm=function(title,copy,onYes,yesLabel){
  confirmReturn=currentScreen;
  confirmYes=onYes;
  $('confirm-title').textContent=title;
  $('confirm-copy').textContent=copy;
  $('btn-confirm-yes').textContent=yesLabel||'CONFIRM';
  showScreen('confirm');
};

// ——— navigation ———
function backAction(){
  switch(currentScreen){
    case 'settings': closeSettings();break;
    case 'pause': G.resumeGame();break;
    case 'inventory': G.closeInventory();break;
    case 'rewards': G.closeRewards();break;
    case 'coop': UI.closeCoop();break;
    case 'howto': case 'credits': case 'ship': UI.showMenu();break;
    case 'confirm': {
      confirmYes=null;
      const ret=confirmReturn;confirmReturn=null;
      if(ret)showScreen(ret);else UI.showMenu();
      break;
    }
    default: break;
  }
}
function activateFocused(){
  const f=focusables();if(!f.length)return;
  const el=document.activeElement;
  if(!el||!f.includes(el)){try{f[0].focus({preventScroll:true});}catch(e){}return;}
  if(el.tagName==='INPUT'&&el.type==='range')return;
  if(typeof el.click==='function')el.click();
}
function onKeyDown(e){
  if(!currentScreen||N.Input.isCapturing())return;
  if(e.code==='Escape'){
    if(currentScreen==='settings'||currentScreen==='pause'||currentScreen==='inventory'||currentScreen==='rewards'||currentScreen==='howto'||currentScreen==='credits'||currentScreen==='confirm'||currentScreen==='coop'){
      // Stop the event so the gameplay input layer does not also register this
      // press and immediately re-open the pause screen after resuming.
      e.preventDefault();e.stopPropagation();backAction();
    }
    return;
  }
  if(e.code===G.settings.keyboard.rewards&&(currentScreen==='rewards'||currentScreen==='pause')){
    e.preventDefault();e.stopPropagation();
    if(currentScreen==='rewards')G.closeRewards();else G.openRewards();
    return;
  }
  const invKey=(G.settings.keyboard&&G.settings.keyboard.inventory)||'KeyI';
  if(e.code===invKey){
    if(currentScreen==='pause'){e.preventDefault();e.stopPropagation();G.openInventory();return;}
    if(currentScreen==='inventory'){e.preventDefault();e.stopPropagation();G.closeInventory();return;}
  }
  if(currentScreen==='levelup'){
    const map={Digit1:0,Digit2:1,Digit3:2,Numpad1:0,Numpad2:1,Numpad3:2};
    if(map[e.code]!==undefined){
      const card=document.querySelectorAll('#protocol-grid .protocol-card')[map[e.code]];
      if(card){e.preventDefault();card.click();}
    }
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){
    if(focusedRange()){
      if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();adjustFocusedRange(e.code==='ArrowLeft'?-1:1);return;}
    }
    if(e.code==='ArrowUp'){e.preventDefault();moveFocus(-1);}
    else if(e.code==='ArrowDown'){e.preventDefault();moveFocus(1);}
  }
}
UI.handleGamepad=function(){
  if(!currentScreen)return;
  const monitor=$('controller-monitor');
  if(currentScreen==='settings'&&monitor){
    const buttons=N.Input.getDebug().pads.map((down,i)=>down?N.padLabel(i)+' ['+i+']':null).filter(Boolean);
    const move=N.Input.padMove||{x:0,y:0},aim=N.Input.padAim||{x:0,y:0};
    const text=N.Input.isPadConnected()?N.Input.getPadName()+' · Buttons: '+(buttons.join(', ')||'none')+' · Left: '+move.x.toFixed(2)+', '+move.y.toFixed(2)+' · Right: '+aim.x.toFixed(2)+', '+aim.y.toFixed(2):'No controller detected. Connect it and press a button.';
    if(monitor.textContent!==text)monitor.textContent=text;
  }
  if(N.Input.isCapturingKey()&&N.Input.consumePad(1)){N.Input.cancelCapture();renderSettings();return;}
  if(N.Input.isCapturing()||N.Input.padCapturedThisFrame)return;
  const input=N.Input,stick=input.padMove||{x:0,y:0};
  const direction=input.padDown(12)?'up':input.padDown(13)?'down':input.padDown(14)?'left':input.padDown(15)?'right':Math.max(Math.abs(stick.x),Math.abs(stick.y))>.55?(Math.abs(stick.y)>=Math.abs(stick.x)?(stick.y<0?'up':'down'):(stick.x<0?'left':'right')):'';
  const now=performance.now();
  if(direction||input.anyPadDown()){
    document.body.classList.add('controller-nav');
    if(!focusables().includes(document.activeElement))focusFirst();
  }
  // START / PAUSE acts as a back/confirm action while a menu overlay is open.
  const pauseBtn=G.settings.gamepad&&G.settings.gamepad.pause;
  if(N.Input.consumePad(9)||(pauseBtn!=null&&![0,1,12,13,14,15].includes(pauseBtn)&&N.Input.consumePad(pauseBtn))){backAction();return;}
  if(direction&&(direction!==navDirection||now>=navRepeatAt)){
    const dir=direction==='up'||direction==='left'?-1:1;
    if((direction==='left'||direction==='right')&&focusedRange())adjustFocusedRange(dir);
    else moveFocus(dir);
    navRepeatAt=now+(direction!==navDirection?350:120);
  }
  navDirection=direction;
  if(N.Input.consumePad(0))activateFocused();
  if(N.Input.consumePad(1))backAction();
};
UI.backAction=backAction;
})();
