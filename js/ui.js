/* NEON NEXUS — interface layer */
(function(){
'use strict';
const N=window.NEON;
const G=N.Game;
const UI=N.UI={};
const $=id=>document.getElementById(id);
const screens=['boot','menu','settings','pause','inventory','levelup','overflow','gameover','complete','howto','credits','confirm'];
let currentScreen=null;
let settingsReturn='menu';
let settingsTab='controls';
let confirmReturn=null;
let confirmYes=null;
let bootReady=false;
const focusTimers=[];

function screenEl(name){return document.getElementById('screen-'+name);}
function esc(s){return N.safeName(String(s==null?'':s));}
function clearFocusTimers(){while(focusTimers.length)clearTimeout(focusTimers.pop());}
function showScreen(name,noFocus){
  for(const n of screens){const el=screenEl(n);if(el)el.classList.toggle('active',n===name);}
  currentScreen=name;
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
function focusFirst(){const f=focusables();if(f.length){try{f[0].focus({preventScroll:true});}catch(e){}}}
function moveFocus(dir){
  const f=focusables();if(!f.length)return;
  let i=f.indexOf(document.activeElement);
  if(i<0)i=0;else i=(i+dir+f.length)%f.length;
  try{f[i].focus({preventScroll:true});}catch(e){}
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
    // loadFromSave manages the interface itself: it hides overlays and re-opens
    // the level-up screen when unspent protocol choices were recovered.
    if(!G.loadFromSave(save,false)) UI.toast('SAVE COULD NOT BE RESTORED','danger');
  });
  $('btn-new-run').addEventListener('click',()=>{
    if(N.hasSave()){
      UI.confirm('OVERWRITE SAVE?','A stored run exists on this browser. Starting a new protocol will overwrite its latest checkpoint.',()=>{
        G.newRun();
        UI.hideAll();
      },'PURGE & START');
    }else{
      G.newRun();
      UI.hideAll();
    }
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

  // pause
  $('btn-resume').addEventListener('click',()=>G.resumeGame());
  $('btn-inventory').addEventListener('click',()=>G.openInventory());
  $('btn-pause-settings').addEventListener('click',()=>openSettings('pause'));
  $('btn-save-quit').addEventListener('click',()=>G.saveAndQuit());

  // inventory
  $('btn-inventory-close').addEventListener('click',()=>G.closeInventory());
  $('btn-inventory-done').addEventListener('click',()=>G.closeInventory());

  // overflow
  $('btn-overflow-leave').addEventListener('click',()=>G.leaveOverflow());

  // complete
  $('btn-advance').addEventListener('click',()=>{G.advanceLevel();UI.hideAll();});
  $('btn-complete-menu').addEventListener('click',()=>{G.completeToMenu();UI.showMenu();});

  // gameover
  $('btn-restore').addEventListener('click',()=>{
    // restoreCheckpoint -> loadFromSave manages overlays and may re-open level-up.
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
function closeSettings(){
  N.Input.cancelCapture();
  N.Audio.ui('back');
  if(settingsReturn==='pause'){
    if(G.player&&G.mode!=='playing'){G.setMode('paused');UI.showPause(G.getPauseData());}
    else UI.showMenu();
  }else UI.showMenu();
}
function getPath(obj,path){return path.split('.').reduce((o,k)=>o&&o[k],obj);}
function setPath(obj,path,val){const parts=path.split('.');let o=obj;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=val;}
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
      setPath(G.settings,el.dataset.setting,val);
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
      setPath(G.settings,path,next);
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
  const s=G.settings;
  document.querySelectorAll('#screen-settings .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===settingsTab));
  const body=$('settings-body');if(!body)return;
  if(settingsTab==='controls'){
    body.innerHTML=`
      <div class="settings-section"><h3>KEYBOARD BINDINGS</h3>
        ${N.KEY_ACTIONS.map(([action,label])=>`
          <div class="setting-row"><div class="setting-label"><b>${label}</b><small>KEYBOARD / MOUSE SETUP</small></div>
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
      <div class="data-block"><p>Click a binding, then press the desired key or gamepad button. Duplicate assignments are swapped automatically. Mouse aim/fire is always available in addition to gamepad controls.</p></div>`;
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
}
UI.switchSettingsTab=function(tab){settingsTab=tab;renderSettings();};

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
  $('pause-stats').innerHTML=cells.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');
  showScreen('pause');
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
  if(!summary)return;
  $('complete-title').textContent=summary.reason==='timer'?'SURVIVAL PROTOCOL COMPLETE':'SECTOR CLEARED';
  $('complete-badge').textContent=summary.reason==='timer'?'SURVIVE':'CLEAR';
  const cells=[
    ['SECTOR',String(summary.sector).padStart(2,'0')],
    ['TIME',N.formatTime(summary.time)],
    ['KILLS',summary.kills],
    ['DAMAGE',N.formatNum(summary.damage)],
    ['PILOT LV',summary.level],
    ['ANCHORS LEFT',summary.anchors+' / '+summary.anchorsTotal]
  ];
  $('complete-stats').innerHTML=cells.map(([a,b],i)=>`<div class="${i===0?'accent':''}"><b>${a}</b><span>${b}</span></div>`).join('');
  $('btn-advance').textContent='DESCEND TO SECTOR '+String(summary.nextLevel).padStart(2,'0');
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
  $('gameover-stats').innerHTML=cells.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');
  $('btn-restore').disabled=!data.hasCheckpoint;
  $('gameover-save-note').textContent=data.hasCheckpoint?'LAST LOCAL CHECKPOINT AVAILABLE':'NO CHECKPOINT FOUND — RETURN TO THE NEXUS';
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
    case 'howto': case 'credits': UI.showMenu();break;
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
    if(currentScreen==='settings'||currentScreen==='pause'||currentScreen==='inventory'||currentScreen==='howto'||currentScreen==='credits'||currentScreen==='confirm'){
      // Stop the event so the gameplay input layer does not also register this
      // press and immediately re-open the pause screen after resuming.
      e.preventDefault();e.stopPropagation();backAction();
    }
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
  if(!currentScreen||N.Input.isCapturing())return;
  // START / PAUSE acts as a back/confirm action while a menu overlay is open.
  const pauseBtn=G.settings.gamepad&&G.settings.gamepad.pause;
  if(pauseBtn!=null&&N.Input.consumePad(pauseBtn)){backAction();return;}
  if(N.Input.consumePad(12))moveFocus(-1);
  if(N.Input.consumePad(13))moveFocus(1);
  if(focusedRange()){
    if(N.Input.consumePad(14))adjustFocusedRange(-1);
    if(N.Input.consumePad(15))adjustFocusedRange(1);
  }
  if(N.Input.consumePad(0))activateFocused();
  if(N.Input.consumePad(1))backAction();
};
UI.backAction=backAction;
})();
