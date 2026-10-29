/* Load only in an isolated benchmark page after suppressing the normal RAF loop. */
(function(){
'use strict';
const N=window.NEON,G=N.Game;
const names=['enemies','playerBullets','enemyBullets','mines','orbitals','strikes','effects','particles','texts','groundItems'];
const originalRandom=Math.random;
const originals={move:N.Input.getMove,aim:N.Input.getAim,save:G.saveCheckpoint};
let simRandom,renderRandom;
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function counts(){return Object.fromEntries(names.map(n=>[n,G[n].length]));}
function stats(a){const s=a.slice().sort((x,y)=>x-y);return {samples:s.length,meanMs:a.reduce((x,y)=>x+y,0)/(a.length||1),p50Ms:s[Math.floor(s.length*.5)]||0,p95Ms:s[Math.min(s.length-1,Math.floor(s.length*.95))]||0,p99Ms:s[Math.min(s.length-1,Math.floor(s.length*.99))]||0,maxMs:s[s.length-1]||0};}
function setup(heavy){
  simRandom=rng(0x4e454f4e);renderRandom=rng(0x56495355);Math.random=simRandom;
  G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{});G.applySettings(false);
  // The browser context must be separate from the owner's profile. Never clear saves.
  G.saveCheckpoint=()=>false;
  G.newRun();G.player.invuln=1e9;
  if(heavy){for(let i=G.enemies.length;i<120;i++){const a=i/120*N.TAU;G.spawnEnemy(G.pickStyle(),G.player.x+Math.cos(a)*(200+i%5*65),G.player.y+Math.sin(a)*(200+i%5*65));}}
  N.Input.getMove=()=>({x:Math.cos(G.time*.17),y:Math.sin(G.time*.17),len:1});
  N.Input.getAim=p=>{let target=null,d=Infinity;for(const e of G.enemies){const dd=N.dist2(p.x,p.y,e.x,e.y);if(!e.dead&&dd<d){d=dd;target=e;}}const angle=target?Math.atan2(target.y-p.y,target.x-p.x):G.time;return {angle,fire:true,source:'pad',point:{x:p.x+Math.cos(angle)*280,y:p.y+Math.sin(angle)*280}};};
  Math.random=originalRandom;
}
function step(){
  Math.random=simRandom;
  try{
    if(G.mode==='levelup')G.applyProtocol(G.levelUpChoices[0].id);
    if(G.mode==='overflow')G.leaveOverflow();
    if(G.mode==='complete')G.advanceLevel();
    G.update(1/60);N.Input.endFrame();
  }finally{Math.random=originalRandom;}
}
function render(){Math.random=renderRandom;try{G.render(1/60);}finally{Math.random=originalRandom;}}
window.NeonBenchmark={
  stats,counts,setup,step,render,
  start({scenario='normal',frames=1800,renderEvery=1,warmup=120}={}){
    if(this.running)throw Error('Benchmark already running');
    if(!window.__benchmarkRAF)throw Error('Suppress the main RAF loop before page load; see README');
    setup(scenario==='large-wave');
    const timing={update:[],render:[],raf:[],glow:[]},profile={},samples=[];
    const methods=['updatePlayer','updateEnemies','updateAnchors','updateCaches','updatePlayerBullets','updateEnemyBullets','updateMines','updateOrbitals','updateStrikes','updateGroundItems','updateEffects','updateSpawning'];
    const saved={};let measuring=false,glowCalls=0,canvasCreates=0;
    for(const name of methods){saved[name]=G[name];profile[name]=0;G[name]=function(...args){const t=performance.now();try{return saved[name].apply(this,args);}finally{if(measuring)profile[name]+=performance.now()-t;}};}
    const oldGlow=N.Assets.glow;N.Assets.glow=function(...args){const t=performance.now();try{return oldGlow.apply(this,args);}finally{if(measuring){glowCalls++;timing.glow.push(performance.now()-t);}}};
    const oldCreate=document.createElement;document.createElement=function(name,...args){if(measuring&&name==='canvas')canvasCreates++;return oldCreate.call(this,name,...args);};
    let i=-warmup,last=null;const begin=performance.now();
    const state=this.running={scenario,frames,renderEvery,warmup,frame:0,startedAt:new Date().toISOString()};this.result=null;
    const finish=()=>{
      for(const name of methods)G[name]=saved[name];N.Assets.glow=oldGlow;document.createElement=oldCreate;
      this.result={...state,wallSeconds:(performance.now()-begin)/1000,simulatedSeconds:frames/60,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,settings:structuredClone(G.settings),timing:Object.fromEntries(Object.entries(timing).map(([k,v])=>[k,stats(v)])),profileTotalMs:profile,glowCalls,canvasCreates,samples,final:{mode:G.mode,sector:G.run.level,counts:counts()}};
      this.running=null;return this.result;
    };
    this.stop=finish;
    const tick=now=>{
      if(!this.running)return;
      measuring=i>=0;
      if(measuring&&last!==null)timing.raf.push(now-last);last=now;
      const t=performance.now();step();if(measuring)timing.update.push(performance.now()-t);
      if(i%renderEvery===0){const r=performance.now();render();if(measuring)timing.render.push(performance.now()-r);}
      if(measuring&&i%600===0)samples.push({frame:i,simulatedSeconds:i/60,heapBytes:performance.memory?.usedJSHeapSize??null,sector:G.run.level,counts:counts()});
      i++;state.frame=Math.max(0,i);
      if(i>=frames){finish();return;}
      // Accelerated retention mode batches simulation while retaining periodic rendered scenes.
      if(renderEvery>1&&i%renderEvery!==0){queueMicrotask(()=>tick(performance.now()));}
      else window.__benchmarkRAF(tick);
    };
    window.__benchmarkRAF(tick);return state;
  },
  restore(){G.saveCheckpoint=originals.save;N.Input.getMove=originals.move;N.Input.getAim=originals.aim;Math.random=originalRandom;}
};
})();
