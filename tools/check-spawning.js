/* Run only in an isolated browser context at /?test=spawning. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='spawning')throw Error('Use an isolated spawn test page');
const N=window.NEON,G=N.Game,passed=[],rows=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
const originalQuality=G.settings.graphics.quality;
try{
  for(const [quality,start,cap] of [['high',5,120],['medium',5,82],['low',3,55]]){
    G.settings.graphics.quality=quality;G.newRun();
    check(G.enemies.length===start,quality+': first sector starts with half the former population, rounded up');
    G.pauseGame();G.resumeGame();
    check(G.enemies.length===start,quality+': pause/resume does not duplicate initial enemies');
    G.completeLevel('timer');G.advanceLevel();
    check(G.run.level===2&&G.enemies.length===start+1,quality+': entering sector 2 adds one starting enemy');
    G.run.level=5;G.enemies.length=0;G.spawnInitialEnemies();
    check(G.enemies.length===start+4,quality+': sector 5 continues initial population growth');
    G.run.level=1000;G.enemies.length=0;G.spawnInitialEnemies();
    check(G.enemies.length===cap,quality+': late-sector initial population respects quality cap');
    G.enemies.length=0;G.spawnInitialEnemies(4);
    check(G.enemies.length===4,quality+': explicit checkpoint population stays at four');
  }
  G.newRun();G.saveCheckpoint(true,'test');
  check(G.loadFromSave(G.lastCheckpoint)&&G.enemies.length===4,'save/continue retains its existing four-enemy population');
}finally{G.settings.graphics.quality=originalQuality;}
// Captured before gentle progression, 1/600 step, no cap pressure.
const baseline=[[1,0,39,2],[1,210,50,3],[1,380,65,4],[5,0,41,3],[5,210,53,4],[5,380,70,5],[10,0,43,5],[10,210,57,6],[10,380,76,7]];
G.newRun();const old=G.spawnWaveGroup;
try{
  for(const [sector,elapsed,before,size] of baseline){
    G.run.level=sector;G.level.elapsed=elapsed;G.enemies.length=0;G.level.spawnTimer=0;let after=0,group=0;
    G.spawnWaveGroup=n=>{after++;group=n;};
    for(let i=0;i<36000;i++)G.updateSpawning(1/600);
    check(sector===10?after===before:after<before,'routine cadence is slower early and reaches previous intensity at sector 10');
    check(sector===10?group===size:group<=size,'early groups grow more gently; sector 10 retains previous groups');
    if(sector===1)check(after===12&&group===2,'sector 1 keeps two-enemy groups every five seconds throughout');
    rows.push({sector,elapsed,before,after,group});
  }
}finally{G.spawnWaveGroup=old;}
for(const quality of ['high','medium','low']){
  G.settings.graphics.quality=quality;G.newRun();
  check(G.enemyPopulationCap()===15,quality+': sector 1 population cap is 15');
  let lastCap=0,lastInterval=Infinity,lastGroup=0;
  for(let sector=1;sector<=10;sector++){
    G.run.level=sector;
    const cap=G.enemyPopulationCap(),interval=G.routineSpawnInterval(210,sector),group=G.routineSpawnGroup(210,sector);
    check(cap>=lastCap&&interval<=lastInterval&&group>=lastGroup,quality+': pressure increases monotonically through sector '+sector);
    lastCap=cap;lastInterval=interval;lastGroup=group;
  }
  G.run.level=1;G.enemies.length=0;
  G.spawnWaveGroup(100,0);check(G.enemies.length===15,quality+': routine batch stops at sector cap');
  G.spawnSurge();check(G.enemies.length===15,quality+': surge respects full sector cap');
  const st=G.pickStyle(),pos=G.safeSpawnPos();
  check(G.spawnEnemy(st,pos.x,pos.y,{minion:true})===null,quality+': summons cannot bypass full cap');
  G.enemies.pop();
  G.spawnEnemy(st,pos.x,pos.y,{minion:true});G.spawnEnemy(st,pos.x,pos.y,{minion:true});
  check(G.enemies.length===15,quality+': multi-spawn source cannot overshoot cap');
  G.spawnEliteWarden();G.spawnBoss();
  check(G.enemies.length===17&&G.enemies.some(e=>e.role==='warden')&&G.level.activeBoss?.boss,quality+': required encounters spawn even at cap');
  G.level.spawnTimer=0;G.updateSpawning(10);
  check(G.enemies.length===17&&G.level.spawnTimer>=.4,quality+': routine spawns wait above cap without accumulating a backlog');
}
G.settings.graphics.quality=originalQuality;
G.newRun();check(G.level.spawnTimer===5,'first routine group waits five seconds');
G.updateSpawning(4.99);check(G.enemies.length===5,'no routine group before initial delay');
G.updateSpawning(.02);check(G.enemies.length===7,'first routine group adds two enemies after five seconds');
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
