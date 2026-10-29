/* NEON NEXUS — utility core */
(function(){
'use strict';
const N = window.NEON = window.NEON || {};

N.VERSION = 1;
N.RELEASE_VERSION = 'development';
N.TAU = Math.PI * 2;
N.clamp = (v,a,b)=>v<a?a:v>b?b:v;
N.lerp = (a,b,t)=>a+(b-a)*t;
N.lerpAngle = (a,b,t)=>{
  let d=(b-a+Math.PI)%N.TAU; if(d<0)d+=N.TAU; d-=Math.PI;
  return a+d*t;
};
N.angleDelta = (a,b)=>{
  let d=(b-a+Math.PI)%N.TAU; if(d<0)d+=N.TAU; return d-Math.PI;
};
N.dist2 = (ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;return dx*dx+dy*dy;};
N.dist = (ax,ay,bx,by)=>Math.sqrt(N.dist2(ax,ay,bx,by));
N.len = (x,y)=>Math.sqrt(x*x+y*y);
N.norm = (x,y)=>{const l=Math.sqrt(x*x+y*y)||1;return {x:x/l,y:y/l};};
N.easeOut = t=>1-(1-t)*(1-t);
N.easeIn = t=>t*t;
N.smoothstep = t=>t*t*(3-2*t);
N.randomRange = (a,b)=>a+Math.random()*(b-a);
N.randomInt = (a,b)=>Math.floor(a+Math.random()*(b-a+1));
N.pick = arr=>arr[Math.floor(Math.random()*arr.length)];
N.clampVec = (x,y,max)=>{const l=N.len(x,y);if(l>max)return {x:x/l*max,y:y/l*max};return {x,y};};

// deterministic RNG — mulberry32
N.hashString = function(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619); }
  h ^= h >>> 16; h = Math.imul(h,2246822507); h ^= h >>> 13;
  return h >>> 0;
};
N.mulberry32 = function(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
N.RNG = function(seed){
  const r = N.mulberry32(seed >>> 0);
  return {
    next:r,
    range:(a,b)=>a+r()*(b-a),
    int:(a,b)=>Math.floor(a+r()*(b-a+1)),
    pick:arr=>arr[Math.floor(r()*arr.length)],
    chance:p=>r()<p,
    angle:()=>r()*N.TAU,
    sign:()=>r()<.5?-1:1,
    weighted(items, weightFn){
      let total=0; for(const it of items) total += Math.max(0,weightFn?weightFn(it):(it.weight||1));
      let x=r()*total;
      for(const it of items){ x-=Math.max(0,weightFn?weightFn(it):(it.weight||1)); if(x<=0) return it; }
      return items[items.length-1];
    }
  };
};
N.shuffle = function(arr, rng){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=(rng?rng.int(0,i):Math.floor(Math.random()*(i+1)));const t=a[i];a[i]=a[j];a[j]=t;}
  return a;
};
N.uid = (()=>{let n=0; return (prefix='id')=>prefix+'_'+(++n)+'_'+Math.floor(Math.random()*1e6).toString(36);})();

N.formatTime = function(seconds, showTenths){
  seconds=Math.max(0,seconds);
  const m=Math.floor(seconds/60), s=Math.floor(seconds%60);
  const base=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  if(showTenths) return base+'.'+Math.floor((seconds%1)*10);
  return base;
};
N.formatNum = n=>n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'k':String(Math.round(n));

// color helpers
N.hsl = (h,s,l,a=1)=>`hsla(${((h%360)+360)%360},${s}%,${l}%,${a})`;
N.rotateHue = (h,deg)=>((h+deg)%360+360)%360;
N.withAlpha = function(hex,a){
  if(hex.startsWith('#')){
    let h=hex.slice(1); if(h.length===3) h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;
  }
  if(hex.startsWith('hsl(')) return hex.replace('hsl(','hsla(').replace(')',`,${a})`);
  if(hex.startsWith('hsla(')) return hex;
  return hex;
};
N.mix = function(c1,c2,t){
  const p=h=>{let s=h.slice(1);if(s.length===3)s=s.split('').map(c=>c+c).join('');const n=parseInt(s,16);return [n>>16&255,n>>8&255,n&255];};
  try{const a=p(c1),b=p(c2);return `rgb(${Math.round(N.lerp(a[0],b[0],t))},${Math.round(N.lerp(a[1],b[1],t))},${Math.round(N.lerp(a[2],b[2],t))})`;}catch(e){return c1;}
};

// geometry — returns points from normalized path segments
N.poly = function(cx,cy,r,sides,rot=0){
  const pts=[]; for(let i=0;i<sides;i++){const a=rot+i/sides*N.TAU;pts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});} return pts;
};
N.star = function(cx,cy,r1,r2,points,rot=0){
  const pts=[]; for(let i=0;i<points*2;i++){const a=rot+i/(points*2)*N.TAU;const r=i%2?r2:r1;pts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});} return pts;
};
N.ellipsePoints = function(cx,cy,rx,ry,n=16,rot=0){
  const pts=[];for(let i=0;i<n;i++){const a=i/n*N.TAU;pts.push({x:cx+Math.cos(a)*rx*Math.cos(rot)-Math.sin(a)*ry*Math.sin(rot),y:cy+Math.cos(a)*rx*Math.sin(rot)+Math.sin(a)*ry*Math.cos(rot)});}return pts;
};
N.drawPoly = function(ctx, pts, stroke, fill, width=1.4, close=true){
  if(!pts||!pts.length) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  if(close) ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
};
N.drawSegments = function(ctx, segs, stroke, width=1.2){
  if(!segs||!segs.length) return;
  ctx.beginPath();
  for(const s of segs){ctx.moveTo(s[0],s[1]);ctx.lineTo(s[2],s[3]);}
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
};
N.pointInCircle = (px,py,cx,cy,r)=>N.dist2(px,py,cx,cy)<=r*r;
N.circleOverlap = (ax,ay,ar,bx,by,br)=>N.dist2(ax,ay,bx,by)<=(ar+br)*(ar+br);
N.pointInPoly = function(px,py,pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y;
    const inter=((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi);
    if(inter) inside=!inside;
  }
  return inside;
};
N.distToSegment = function(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay;const l2=dx*dx+dy*dy;
  if(l2===0)return N.dist(px,py,ax,ay);
  let t=((px-ax)*dx+(py-ay)*dy)/l2;t=N.clamp(t,0,1);
  return N.dist(px,py,ax+dx*t,ay+dy*t);
};

// text helpers
N.text = function(ctx, str, x, y, size, color, align='left', weight=400, font='mono'){
  ctx.save();
  ctx.font = weight+' '+size+'px '+(font==='display'?N.FONT_DISPLAY:N.FONT_MONO);
  ctx.textAlign=align; ctx.textBaseline='middle';
  ctx.fillStyle=color; ctx.fillText(str,x,y);
  ctx.restore();
};
N.wrapText = function(ctx, text, x, y, maxW, lineH, color, size=12, font='mono'){
  ctx.save();
  ctx.font = size+'px '+(font==='display'?N.FONT_DISPLAY:N.FONT_MONO);
  ctx.fillStyle=color; ctx.textBaseline='top';
  const words=text.split(' '); let line=''; let yy=y;
  for(const w of words){
    const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW && line){ctx.fillText(line,x,yy);line=w;yy+=lineH;} else line=test;
  }
  if(line)ctx.fillText(line,x,yy);
  ctx.restore();
};

// storage — safe and versioned
N.Storage = {
  key:'neon_nexus_save_v1',
  settingsKey:'neon_nexus_settings_v1',
  available:false,
  init(){
    try{
      const k='__nn_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k);
      this.available=true;
    }catch(e){ this.available=false; }
    return this.available;
  },
  read(key, fallback){
    try{const raw=localStorage.getItem(key); if(!raw) return fallback; const v=JSON.parse(raw); return v==null?fallback:v;}catch(e){return fallback;}
  },
  write(key, value){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}
  },
  remove(key){try{localStorage.removeItem(key);return true;}catch(e){return false;}}
};

N.SETTINGS_DEFAULT = {
  movementMode:'directional',
  firingMode:'hold',rightStickFire:true,
  version:1,
  keyboard:{
    moveUp:'KeyW', moveDown:'KeyS', moveLeft:'KeyA', moveRight:'KeyD',
    dash:'Space', pause:'Escape', weaponNext:'KeyE', weaponPrev:'KeyQ', inventory:'KeyI',rewards:'KeyR',fire:'KeyF'
  },
  gamepad:{fire:7,dash:0,pause:9,weaponNext:5,weaponPrev:4,inventory:3,rewards:2},
  audio:{master:.7,music:.38,sfx:.75,muted:false},
  graphics:{quality:'high',shake:true,scanlines:true,glitch:true,particles:1,showFps:false},
  accessibility:{reducedFlash:false,aimAssist:0},
  deadzone:.22,
  sensitivity:1
};
N.KEY_ACTIONS = [
  ['fire','FIRE'],
  ['moveUp','MOVE UP'],['moveDown','MOVE DOWN'],['moveLeft','MOVE LEFT'],['moveRight','MOVE RIGHT'],
  ['dash','DASH'],['weaponNext','NEXT WEAPON'],['weaponPrev','PREV WEAPON'],['pause','PAUSE'],['inventory','INVENTORY'],['rewards','PENDING REWARDS']
];
N.PAD_ACTIONS = [
  ['fire','FIRE / AIM'],['dash','DASH'],['weaponNext','NEXT WEAPON'],['weaponPrev','PREV WEAPON'],
  ['pause','PAUSE'],['inventory','INVENTORY'],['rewards','PENDING REWARDS']
];
N.KEY_LABELS = {
  Space:'SPACE', Escape:'ESC', Tab:'TAB', ShiftLeft:'L-SHIFT', ShiftRight:'R-SHIFT',
  ControlLeft:'L-CTRL', ControlRight:'R-CTRL', AltLeft:'L-ALT', AltRight:'R-ALT',
  ArrowUp:'UP', ArrowDown:'DOWN', ArrowLeft:'LEFT', ArrowRight:'RIGHT',
  Backspace:'BACKSPACE', Enter:'ENTER', NumpadEnter:'NUM ENTER', CapsLock:'CAPS',
  Semicolon:';', Quote:"'", Comma:',', Period:'.', Slash:'/', Backslash:'\\',
  BracketLeft:'[', BracketRight:']', Minus:'-', Equal:'=', Backquote:'`'
};
N.PAD_LABELS = ['A','B','X','Y','LB','RB','LT','RT','BACK','START','L3','R3','UP','DOWN','LEFT','RIGHT'];
N.keyLabel = function(code){
  if(!code) return '—';
  if(N.KEY_LABELS[code]) return N.KEY_LABELS[code];
  if(code.startsWith('Key')) return code.slice(3);
  if(code.startsWith('Digit')) return code.slice(5);
  if(code.startsWith('Numpad')) return 'NUM '+code.slice(6);
  return code.replace(/Left|Right/,'').toUpperCase();
};
N.padLabel = function(index){
  if(index==null) return '—';
  return N.PAD_LABELS[index] || 'BTN '+index;
};
N.deepClone = obj=>JSON.parse(JSON.stringify(obj));
N.deepMerge = function(base, over){
  const out=N.deepClone(base);
  if(!over||typeof over!=='object') return out;
  for(const k of Object.keys(over)){
    if(over[k] && typeof over[k]==='object' && !Array.isArray(over[k]) && base[k] && typeof base[k]==='object'){
      out[k]=N.deepMerge(base[k],over[k]);
    }else if(over[k]!==undefined){ out[k]=over[k]; }
  }
  return out;
};
N.loadSettings = function(){
  const raw=N.Storage.read(N.Storage.settingsKey,null);
  let s=N.deepMerge(N.SETTINGS_DEFAULT,raw||{});
  s.audio.master=N.clamp(+s.audio.master||0,0,1);
  s.audio.music=N.clamp(+s.audio.music||0,0,1);
  s.audio.sfx=N.clamp(+s.audio.sfx||0,0,1);
  s.graphics.particles=N.clamp(+s.graphics.particles||1,.25,2);
  s.deadzone=N.clamp(+s.deadzone||.22,.05,.6);
  s.movementMode=s.movementMode==='driving'?'driving':'directional';
  s.firingMode=s.firingMode==='toggle'?'toggle':'hold';
  s.rightStickFire=s.rightStickFire!==false;
  if(raw?.keyboard&&raw.keyboard.fire===undefined){
    const used=new Set(Object.entries(s.keyboard).filter(([action])=>action!=='fire').map(([,code])=>code));
    s.keyboard.fire=['KeyF','KeyG','KeyV'].find(code=>!used.has(code))||null;
  }
  // New reward controls must not steal an existing player's custom binding.
  if(raw?.keyboard&&raw.keyboard.rewards===undefined){
    const used=new Set(Object.entries(s.keyboard).filter(([action])=>action!=='rewards').map(([,code])=>code));
    s.keyboard.rewards=['KeyR','KeyT','KeyB'].find(code=>!used.has(code))||null;
  }
  if(raw?.gamepad&&raw.gamepad.rewards===undefined){
    const used=new Set(Object.entries(s.gamepad).filter(([action])=>action!=='rewards').map(([,button])=>button));
    s.gamepad.rewards=[2,8,10,11].find(button=>!used.has(button))??null;
  }
  return s;
};
N.saveSettings = s=>N.Storage.write(N.Storage.settingsKey,s);
N.hasSave = ()=>!!N.Storage.read(N.Storage.key,null);
N.readSave = ()=>N.Storage.read(N.Storage.key,null);
N.writeSave = save=>N.Storage.write(N.Storage.key,save);
N.clearSave = ()=>N.Storage.remove(N.Storage.key);

// palettes / level themes
N.THEMES = [
  {name:'CYAN VEIL', a:'#00f0ff', b:'#ff2bd6', c:'#8b5cff', bg:'#02070c'},
  {name:'ACID CIRCUIT', a:'#b6ff2b', b:'#ff7a1f', c:'#00f0ff', bg:'#040803'},
  {name:'VIOLET STATIC', a:'#9d5cff', b:'#00f0ff', c:'#ff2bd6', bg:'#06040d'},
  {name:'RED SHIFT', a:'#ff335c', b:'#00f0ff', c:'#ffb31f', bg:'#0a0306'},
  {name:'AMBER GRID', a:'#ffb31f', b:'#b6ff2b', c:'#ff2bd6', bg:'#080601'},
  {name:'ICE PROTOCOL', a:'#6ad7ff', b:'#ff2bd6', c:'#b6ff2b', bg:'#02080d'}
];

N.FONT_MONO = '"Cascadia Mono","Lucida Console","Courier New",monospace';
N.FONT_DISPLAY = '"Bahnschrift Condensed","Arial Narrow","Trebuchet MS",Impact,sans-serif';

N.now = ()=>performance.now();
N.safeName = s=>String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));

N.storageStatus = function(){
  if(!N.Storage.available) return 'LOCAL STORAGE OFFLINE';
  return 'LOCAL SAVE ONLINE';
};
})();
