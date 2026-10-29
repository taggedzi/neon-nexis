/* Run only in an isolated browser context at /?test=spawning. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='spawning')throw Error('Use an isolated spawn test page');
const N=window.NEON,G=N.Game,passed=[],rows=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
// Captured from actual pre-change updateSpawning at commit 1d08f7a, 1/600 step.
const baseline=[[1,0,49,2],[1,210,63,3],[1,380,81,4],[5,0,51,3],[5,210,66,4],[5,380,87,5],[10,0,54,5],[10,210,71,6],[10,380,95,7]];
G.newRun();const old=G.spawnWaveGroup;
try{
  for(const [sector,elapsed,before,size] of baseline){
    G.run.level=sector;G.level.elapsed=elapsed;G.enemies.length=0;G.level.spawnTimer=0;let after=0,group=0;
    G.spawnWaveGroup=n=>{after++;group=n;};
    for(let i=0;i<36000;i++)G.updateSpawning(1/600);
    check(after<before&&Math.abs(after/before-.8)<.025,'routine events decrease about 20% at fixed progression');
    check(group===size,'routine group size unchanged');rows.push({sector,elapsed,before,after,group});
  }
}finally{G.spawnWaveGroup=old;}
G.newRun();check(Math.abs(G.level.spawnTimer-1.75)<1e-8,'initial routine delay scaled to 1.75 seconds');
G.level.elapsed=59.99;const before=G.enemies.length;G.update(.02);
check(G.enemies.length>before&&G.nextSurge===120,'scheduled surge still triggers at 60 seconds');
G.newRun();G.level.elapsed=119.99;G.nextSurge=180;G.update(.02);
check(G.level.wardenSpawned&&G.enemies.some(e=>e.elite),'scheduled warden still triggers at 120 seconds');
G.newRun();G.level.elapsed=209.99;G.nextSurge=240;G.nextWarden=9999;G.update(.02);
check(G.level.bossSpawned&&G.level.activeBoss?.boss,'scheduled boss still triggers at 210 seconds');
G.newRun();G.level.elapsed=419.99;G.nextSurge=9999;G.nextWarden=9999;G.nextBoss=9999;G.update(.02);
check(G.mode==='complete'&&G.run.level===2,'timer sector progression remains functional');
G.pauseGame();window.spawningResult={passed:passed.length,checks:passed,rows};
})();
