/* NEON NEXUS — procedural audio engine */
(function(){
'use strict';
const N = window.NEON;
const A = N.Audio = {};
let ctx=null, master=null, musicBus=null, sfxBus=null, comp=null, noiseBuf=null;
let scoreBus = null, recordedMusic = null;
let contextTransition = null, wantsSuspended = false;
let transitionSuspends = false;
let settings=N.deepMerge(N.SETTINGS_DEFAULT,{});
let unlocked=false, started=false;
let intensity=.4, scene='menu';
let schedTimer=null, nextNote=0, step=0, bar=0;
let lastSfx={};
const BPM={menu:96,game:116,paused:80,dead:72,complete:108};
// Related minor/add9 voicings change every two bars, rather than every beat.
const HARMONY = [
  { root: 110, notes: [0, 7, 10, 14] },
  { root: 87.31, notes: [0, 7, 12, 16] },
  { root: 130.81, notes: [0, 7, 11, 14] },
  { root: 98, notes: [0, 7, 12, 14] }
];
const BASS_PATTERNS = [[0, 6, 10], [0, 7, 12], [0, 6, 14], [0, 10]];
const MELODY_STEPS = [[3, 10], [6, 14], [2, 11], [7]];

function now(){return ctx?ctx.currentTime:0;}
function ensure(){
  if(ctx) return true;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return false;
    ctx=new C({latencyHint:'interactive'});
    comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-20; comp.knee.value=18; comp.ratio.value=5; comp.attack.value=.003; comp.release.value=.25;
    master=ctx.createGain(); master.gain.value=0;
    musicBus=ctx.createGain(); musicBus.gain.value=0;
    scoreBus = ctx.createGain();
    scoreBus.connect(musicBus);
    sfxBus=ctx.createGain(); sfxBus.gain.value=0;
    musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    const sr=ctx.sampleRate, len=Math.floor(sr*1.2);
    noiseBuf=ctx.createBuffer(1,len,sr);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    try {
      recordedMusic = N.RecordedMusic ? N.RecordedMusic.create(ctx, musicBus, active => {
        scoreBus.gain.setTargetAtTime(active ? 0 : 1, ctx.currentTime, .15);
      }) : null;
    } catch (error) {
      // Optional media support must never disable procedural audio or SFX.
      recordedMusic = null;
    }
    applyGains();
    return true;
  }catch(e){ ctx=null; return false; }
}
function applyGains(){
  if(!ctx) return;
  const a=settings.audio||{};
  const m=a.muted?0:N.clamp(+a.master||0,0,1);
  master.gain.setTargetAtTime(m,ctx.currentTime,.05);
  musicBus.gain.setTargetAtTime((N.clamp(+a.music||0,0,1))*.34,ctx.currentTime,.05);
  sfxBus.gain.setTargetAtTime((N.clamp(+a.sfx||0,0,1))*.42,ctx.currentTime,.05);
  if (recordedMusic) {
    recordedMusic.update({ silent: !!a.muted || m === 0 || !(+a.music > 0) });
  }
}
function osc(type,freq,t,dur,vol,dest,detune=0,pan=0){
  if(!ctx) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.setValueAtTime(Math.max(20,freq),t);
  if(detune) o.detune.setValueAtTime(detune,t);
  const p=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(p){p.pan.setValueAtTime(N.clamp(pan,-1,1),t);}
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.006);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); if(p){g.connect(p);p.connect(dest);}else{g.connect(dest);}
  o.start(t); o.stop(t+dur+.02);
}
function noise(t,dur,vol,filterFreq,type='lowpass',dest=sfxBus,pan=0,q=1){
  if(!ctx) return;
  const s=ctx.createBufferSource(); s.buffer=noiseBuf;
  const f=ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(filterFreq,t); f.Q.value=q;
  const g=ctx.createGain();
  g.gain.setValueAtTime(Math.max(.0002,vol),t);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  const p=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(p){p.pan.setValueAtTime(N.clamp(pan,-1,1),t);g.connect(p);p.connect(dest);}
  else g.connect(dest);
  s.connect(f); f.connect(g);
  s.start(t); s.stop(t+dur+.02);
}
function sweep(type,f1,f2,t,dur,vol,dest=sfxBus,pan=0){
  if(!ctx) return;
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type; o.frequency.setValueAtTime(Math.max(20,f1),t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.005);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  const p=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(p){p.pan.setValueAtTime(N.clamp(pan,-1,1),t);o.connect(g);g.connect(p);p.connect(dest);}
  else{o.connect(g);g.connect(dest);}
  o.start(t);o.stop(t+dur+.03);
}
function throttle(key,ms){
  const t=performance.now(); if(lastSfx[key] && t-lastSfx[key]<ms) return false; lastSfx[key]=t; return true;
}
function sfxTime(){return now()+0.005;}

A.init=function(s){
  settings=N.deepMerge(N.SETTINGS_DEFAULT,s||{});
  ensure();
  applyGains();
  return !!ctx;
};
A.unlock=function(){
  const ok=ensure();
  if(!ok) return false;
  unlocked=true;
  A.resume(true);
  if (recordedMusic) {
    recordedMusic.update({ unlocked: true }, true);
  }
  if(!started){started=true; nextNote=ctx.currentTime+.12; step=0; bar=0; startScheduler();}
  A.startMusic();
  return true;
};
A.isUnlocked=()=>unlocked;
A.setSettings=function(s){
  settings=N.deepMerge(settings,s||{});
  if(settings.audio.muted && ctx && ctx.state==='running') { /* still schedule silently */ }
  applyGains();
};
A.setScene=function(s){
  scene=s;
  intensity = s==='game'?1:s==='menu'?.45:s==='paused'?.28:s==='dead'?.18:s==='complete'?.7:.35;
  if (recordedMusic) {
    recordedMusic.update({ scene: s });
  }
};
A.setIntensity=function(v){intensity=N.clamp(v,0,1);};
A.getMusicStatus = () => recordedMusic ? recordedMusic.status() : { mode: 'procedural', track: null, available: 0 };

// ——— music scheduler ———
function startScheduler(){
  if(schedTimer) clearInterval(schedTimer);
  schedTimer=setInterval(schedule,40);
}
function startMusic(){
  if(!ctx||!started) return;
  A.setScene(scene);
}
A.startMusic=startMusic;
function nextStepTime(){return 60/BPM[scene||'game']/4;}

function schedule(){
  if(!ctx || ctx.state!=='running' || settings.audio.muted) return;
  if(document.hidden) return;
  if (recordedMusic && recordedMusic.isActive()) {
    nextNote = ctx.currentTime + .03;
    return;
  }
  try{
    // Skip missed time after mute/tab throttling; never replay a backlog.
    if (nextNote < ctx.currentTime) {
      nextNote = ctx.currentTime + .03;
    }
    while(nextNote < ctx.currentTime + .18){
      playStep(nextNote, step, bar);
      nextNote += nextStepTime();
      step++;
      if(step>=16){step=0;bar++;}
    }
  }catch(e){ /* audio must never break gameplay */ }
}
function padFreq(root, semis){return root*Math.pow(2,semis/12);}
// Music voices use soft attacks and a moving low-pass filter. SFX keep their
// existing envelopes and timbres. Every source has a finite lifetime.
function musicVoice(freq, t, duration, volume, pan, isPad = false) {
  const voice = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const stereo = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const attack = isPad ? .65 : .018;
  voice.type = isPad ? 'triangle' : 'sine';
  voice.frequency.setValueAtTime(freq, t);
  filter.type = 'lowpass';
  filter.Q.value = .55;
  filter.frequency.setValueAtTime(isPad ? 550 : 850, t);
  filter.frequency.linearRampToValueAtTime(isPad ? 1400 : 260, t + duration * .7);
  gain.gain.setValueAtTime(.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), t + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
  voice.connect(filter);
  filter.connect(gain);
  if (stereo) {
    stereo.pan.value = pan;
    gain.connect(stereo);
    stereo.connect(scoreBus);
  } else {
    gain.connect(scoreBus);
  }
  voice.onended = () => {
    voice.disconnect();
    filter.disconnect();
    gain.disconnect();
    if (stereo) {
      stereo.disconnect();
    }
  };
  voice.start(t);
  voice.stop(t + duration + .02);
}

function playStep(t, st, br) {
  const chord = HARMONY[Math.floor(br / 2) % HARMONY.length];
  const phrase = Math.floor(br / 8);
  const section = phrase % 4;
  const isCombat = scene === 'game';
  const isQuiet = scene === 'paused' || scene === 'dead';
  const energy = intensity * (isQuiet ? .45 : scene === 'menu' ? .7 : 1);
  const stepSeconds = nextStepTime();
  // One phrase in four breathes: retain the pulse but thin the upper layers.
  const isBreak = section === 2;
  const variation = (br + phrase) % BASS_PATTERNS.length;

  if (st % 4 === 0 && !isQuiet) {
    sweep('sine', 100, 43, t, .24, (isCombat ? .38 : .16) * energy, scoreBus);
  }
  if (!isQuiet && st % 4 === 2 && (!isBreak || st === 10)) {
    noise(t, .045, .035 * energy, 4300, 'highpass', scoreBus, .15, .5);
  }
  if (isCombat && !isBreak && (st === 4 || st === 12)) {
    noise(t, .095, .065 * energy, 1400, 'bandpass', scoreBus, -.12, .65);
  }
  if (!isQuiet && BASS_PATTERNS[variation].includes(st)) {
    const fifth = st !== 0 && br % 4 === 3 ? 7 : 0;
    musicVoice(padFreq(chord.root / 2, fifth), t, stepSeconds * 2.4,
      .17 * energy, 0);
  }
  if (st === 0 && br % 2 === 0) {
    const duration = stepSeconds * 30;
    chord.notes.forEach((note, index) => {
      musicVoice(padFreq(chord.root, note), t, duration, .035 * energy,
        (index - 1.5) * .4, true);
    });
  }
  // Sparse chord-tone phrases with rests, octave changes and quiet echoes.
  if (!isQuiet && !isBreak && br % 4 !== 3 &&
      MELODY_STEPS[variation].includes(st)) {
    const note = chord.notes[(Math.floor(br / 2) + st + phrase) % chord.notes.length];
    const frequency = padFreq(chord.root, note + (section === 3 ? 12 : 0));
    const pan = br % 2 ? -.4 : .4;
    musicVoice(frequency, t, .65, .045 * energy, pan, true);
    musicVoice(frequency, t + stepSeconds * 3, .85, .016 * energy, -pan, true);
  }
}

// ——— SFX ———
const weaponSfx={
  pulse:(t,p)=>{sweep('square',1300,320,t,.09,.12,sfxBus,p); sweep('sine',600,180,t,.1,.07,sfxBus,p);},
  scatter:(t,p)=>{noise(t,.12,.16,1200,'bandpass',sfxBus,p,.7); sweep('sawtooth',240,90,t,.12,.11,sfxBus,p);},
  rail:(t,p)=>{sweep('sine',2200,240,t,.16,.15,sfxBus,p); osc('square',900,t,.06,.05,sfxBus,0,p);},
  spiral:(t,p)=>{sweep('triangle',280,860,t,.12,.09,sfxBus,p); osc('sine',660,t,.18,.04,sfxBus,12,p);},
  seeker:(t,p)=>{sweep('sawtooth',180,520,t,.1,.07,sfxBus,p); noise(t,.16,.08,3000,'highpass',sfxBus,p);},
  nova:(t,p)=>{sweep('sine',150,800,t,.2,.16,sfxBus,p); osc('triangle',320,t,.25,.06,sfxBus,0,p);},
  mortar:(t,p)=>{sweep('sine',130,60,t,.2,.2,sfxBus,p); noise(t,.12,.1,600,'lowpass',sfxBus,p);},
  mine:(t,p)=>{osc('square',220,t,.05,.09,sfxBus,0,p); osc('square',330,t,.05,.06,sfxBus,0,p);},
  tesla:(t,p)=>{noise(t,.09,.12,6500,'highpass',sfxBus,p,.8); sweep('sawtooth',900,120,t,.12,.08,sfxBus,p);},
  beam:(t,p)=>{sweep('sawtooth',1400,260,t,.2,.12,sfxBus,p); osc('square',180,t,.18,.05,sfxBus,0,p);},
  orb:(t,p)=>{sweep('sine',80,220,t,.25,.12,sfxBus,p); osc('triangle',440,t,.3,.04,sfxBus,8,p);},
  chain:(t,p)=>{sweep('square',1600,600,t,.08,.1,sfxBus,p); noise(t,.06,.07,8000,'highpass',sfxBus,p);},
  shard:(t,p)=>{osc('triangle',1200,t,.06,.08,sfxBus,0,p); osc('triangle',1800,t,.06,.05,sfxBus,0,p);},
  gravity:(t,p)=>{sweep('sine',400,45,t,.3,.14,sfxBus,p); noise(t,.25,.06,400,'lowpass',sfxBus,p);},
  starfall:(t,p)=>{sweep('sine',1200,180,t,.18,.08,sfxBus,p); noise(t,.22,.1,2200,'bandpass',sfxBus,p);},
  shuriken:(t,p)=>{osc('triangle',760,t,.09,.08,sfxBus,7,p); osc('triangle',1520,t+.06,.12,.05,sfxBus,-7,p); noise(t,.1,.04,4200,'highpass',sfxBus,p);}
};
A.weapon=function(kind,pan=0){
  if(!unlocked||!ctx||settings.audio.muted) return;
  if(!throttle('w_'+kind, kind==='spiral'?55:70)) return;
  const f=weaponSfx[kind]||weaponSfx.pulse;
  try{f(sfxTime(),pan);}catch(e){}
};
A.shoot=function(kind,pan){A.weapon(kind,pan);};
A.hit=function(pan=0){
  if(!unlocked||settings.audio.muted) return;
  if(!throttle('hit',28)) return;
  const t=sfxTime();
  try{noise(t,.035,.07,2600,'bandpass',sfxBus,pan,.9); osc('square',900+Math.random()*300,t,.03,.035,sfxBus,0,pan);}catch(e){}
};
A.kill=function(big=false){
  if(!unlocked||settings.audio.muted) return;
  if(!throttle('kill',45)) return;
  const t=sfxTime();
  try{
    noise(t,big?.28:.12,big?.22:.12,big?420:900,'lowpass',sfxBus,0,.8);
    sweep('sawtooth',big?180:420,big?40:90,t,big?.3:.12,big?.12:.06,sfxBus);
  }catch(e){}
};
A.explosion=function(big=false){
  if(!unlocked||settings.audio.muted) return;
  if(!throttle('expl',50)) return;
  const t=sfxTime();
  try{noise(t,big?.55:.3,big?.3:.2,big?300:650,'lowpass',sfxBus,0,.7); sweep('sine',big?110:180,25,t,big?.5:.3,big?.22:.13,sfxBus);}catch(e){}
};
A.hurt=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{sweep('sawtooth',220,45,t,.25,.2); sweep('square',110,35,t,.3,.12,sfxBus,0,-.6); noise(t,.16,.12,700,'lowpass',sfxBus);}catch(e){}
};
A.shield=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{osc('sine',520,t,.16,.12); osc('sine',780,t,.18,.08,sfxBus,6); noise(t,.12,.05,2200,'bandpass',sfxBus);}catch(e){}
};
A.pickup=function(rare=false){
  if(!unlocked||settings.audio.muted) return;
  if(!throttle('pickup',40)) return;
  const t=sfxTime();
  try{
    const base=rare?880:620;
    osc('triangle',base,t,.07,.12); osc('triangle',base*1.5,t+.06,.1,.08,sfxBus,5);
    if(rare){osc('sine',base*2,t+.12,.2,.07,sfxBus,0);}
  }catch(e){}
};
A.dash=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{noise(t,.18,.16,2600,'bandpass',sfxBus,0,.8); sweep('sine',380,1000,t,.18,.08);}catch(e){}
};
A.levelup=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{
    [0,4,7,12].forEach((n,i)=>osc('triangle',220*Math.pow(2,n/12),t+i*.075,.4,.12,sfxBus,0,i%2?.2:-.2));
    sweep('sine',160,1200,t+.12,.5,.06);
  }catch(e){}
};
A.glitch=function(){
  if(!unlocked||settings.audio.muted) return;
  if(!throttle('glitch',35)) return;
  const t=sfxTime();
  try{noise(t,.08,.08,4200,'highpass',sfxBus,0,2); osc('square',90+Math.random()*800,t,.04,.05);}catch(e){}
};
A.anchor=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{osc('sawtooth',55,t,.4,.16); osc('sine',110,t,.5,.12,sfxBus,4); noise(t,.2,.06,300,'lowpass',sfxBus);}catch(e){}
};
A.boss=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{osc('sawtooth',40,t,1.2,.2); sweep('sawtooth',140,32,t,1.3,.16); noise(t,1,.1,180,'lowpass',sfxBus);}catch(e){}
};
A.death=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{
    sweep('sawtooth',400,28,t,1.1,.22); sweep('square',180,22,t+.1,1.3,.12);
    noise(t,1.2,.18,350,'lowpass',sfxBus); A.setScene('dead');
  }catch(e){}
};
A.complete=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{
    [0,5,7,12,15].forEach((n,i)=>osc('triangle',261.6*Math.pow(2,n/12),t+i*.1,.5,.11,sfxBus,0,i%2?.25:-.25));
    sweep('sine',220,1800,t+.25,.7,.06);
    A.setScene('complete');
  }catch(e){}
};
A.ui=function(kind='click'){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{
    if(kind==='back'){osc('square',300,t,.04,.05); osc('square',220,t+.035,.06,.04);}
    else if(kind==='error'){sweep('square',200,80,t,.12,.1);}
    else{osc('square',880,t,.025,.04); osc('sine',1320,t+.01,.04,.025);}
  }catch(e){}
};
A.checkpoint=function(){
  if(!unlocked||settings.audio.muted) return;
  const t=sfxTime();
  try{osc('sine',660,t,.08,.06); osc('sine',990,t+.07,.12,.04);}catch(e){}
};
A.noiseBurst=function(dur=.1,vol=.1,freq=1000){if(unlocked&&!settings.audio.muted)try{noise(sfxTime(),dur,vol,freq,'bandpass',sfxBus);}catch(e){}};
// Navigation can reject pending state changes asynchronously; audio stays optional.
function syncContextState(retryResume = false) {
  // A policy-blocked resume can remain pending until a fresh user gesture.
  // Retry in that gesture, while still serializing opposing transitions.
  if (!ctx || (contextTransition && !(retryResume && !transitionSuspends && !wantsSuspended))) {
    return;
  }
  const requestedSuspension = wantsSuspended;
  const method = requestedSuspension ? 'suspend' : 'resume';
  const requiredState = requestedSuspension ? 'running' : 'suspended';
  if (ctx.state !== requiredState) {
    return;
  }
  try {
    const pending = Promise.resolve(ctx[method]());
    contextTransition = pending;
    transitionSuspends = requestedSuspension;
    const settled = () => {
      if (contextTransition !== pending) return;
      contextTransition = null;
      // Reconcile only a newer intent; rejected requests must not retry forever.
      if (wantsSuspended !== requestedSuspension) {
        syncContextState();
      }
    };
    pending.then(settled, settled);
  } catch (error) {
    // Audio is optional when navigation or browser policy rejects a transition.
  }
}
A.suspend=function(){
  wantsSuspended = true;
  if (recordedMusic) {
    recordedMusic.update({ suspended: true });
  }
  syncContextState();
};
A.resume=function(retryResume = false){
  wantsSuspended = false;
  if (recordedMusic) {
    recordedMusic.update({ suspended: false }, true);
  }
  syncContextState(retryResume);
};
A.now=now;
N.audio=A;
})();
