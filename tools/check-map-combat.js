/* Run only in an isolated browser context at /?test=maps. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='maps')throw Error('Use an isolated map test page');
const N=window.NEON,G=N.Game,W=N.World,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{});G.applySettings(false);G.newRun();
const layout={cols:12,rows:10,width:1200,height:1000,floor:new Uint8Array(120),cells:[],nav:new Map(),covers:[{x:500,y:200,width:100,height:500}],spawn:{x:450,y:450},boss:{x:950,y:450,width:300,height:300}};
for(let y=1;y<9;y++)for(let x=1;x<11;x++)if(!(x===5&&y>=2&&y<=6)){layout.floor[y*12+x]=1;layout.cells.push({index:y*12+x,x:x*100+50,y:y*100+50});}
Object.assign(G.level,{layout,width:1200,height:1000,anchors:[],caches:[]});G.resetEntityArrays();
const p=G.player;p.x=450;p.y=450;p.vx=0;p.vy=0;p.aim=0;p.hp=100;p.shield=0;p.invuln=0;
const style=N.ENEMY_STYLES.find(s=>s.role==='rusher');const enemy=G.spawnEnemy(style,650,450);enemy.hp=enemy.maxHp=10000;enemy.spawnT=0;const hp=enemy.hp;
const bullet=G.spawnBullet({x:450,y:450,angle:0,speed:4000,damage:100,size:3,life:1});G.updatePlayerBullets(.1);
check(bullet.dead&&bullet.x<500&&enemy.hp===hp,'fast player bullet cannot tunnel through cover');
const hostile=G.spawnEnemyBullet({x:650,y:450,angle:Math.PI,speed:4000,damage:10,size:3,life:1});G.updateEnemyBullets(.1);
check(hostile.dead&&p.hp===100,'hostile projectile cannot damage through cover');
const loot=G.spawnGroundLoot({kind:'consumable',id:'repair'},650,450);p.buffs.magnet=9;
for(let i=0;i<60;i++)G.updateGroundItems(.05);
check(G.groundItems.includes(loot)&&loot.x>600&&W.free(layout,loot.x,loot.y,12),'magnet and pickup proximity cannot collect through cover');p.buffs.magnet=0;
G.beam(0,100,'#00f0ff',500,6);check(enemy.hp===hp&&G.effects.filter(e=>e.type==='beam').at(-1).x2<500,'beam stops at cover');
check(!G.arcBolt(0,100,'#00f0ff',3,700)&&enemy.hp===hp,'arc initial target cannot cross cover');
check(G.nearestTarget(450,450,1000)===null,'homing and chain target selection respects cover');
G.chainLightning(450,450,{damage:100,color:'#00f0ff',chain:3,hitSet:new Set()},3);check(enemy.hp===hp,'chain damage cannot cross cover');
G.explode(450,450,400,100,'#00f0ff','player');check(enemy.hp===hp,'player blast damage is blocked by cover');
G.explode(650,450,400,10,'#ff335c','enemy');check(p.hp===100,'cover blocks enemy blast damage');
G.playerBullets.length=0;G.spawnBullet({x:450,y:450,speed:0,damage:100,size:3,life:1,dot:true,tick:.1,tickTimer:0,aoe:400});G.updatePlayerBullets(.01);check(enemy.hp===hp,'damage-over-time area does not penetrate cover');
G.orbitals.push({angle:0,spin:0,radius:200,damage:100,life:1,hits:{},color:'#00f0ff'});G.updateOrbitals(0);check(enemy.hp===hp&&G.orbitals[0].occluded,'orbital behind cover cannot hit through it');
const body={x:1050,y:450,vx:1000,vy:0,r:20};W.move(body,450,450,20);check(body.x<=480,'fast body movement cannot cross cover');
const rotator={x:480,y:450,vx:0,vy:0,shipType:'dart',aim:0};W.move(rotator,480,450,20,true,-Math.PI/2);
check(rotator.x===480&&rotator.aim===-Math.PI/2,'hull rotation against a wall does not teleport the ship');
enemy.speed=160;p.invuln=1e9;G.enemyBullets.length=0;G.playerBullets.length=0;G.orbitals.length=0;
for(let i=0;i<1200;i++){G.time+=1/60;G.updateEnemies(1/60);}
check(N.dist(enemy.x,enemy.y,p.x,p.y)<120&&W.free(layout,enemy.x,enemy.y,enemy.r),'native enemy behavior navigates around cover');
G.enemies.length=0;p.x=450;p.y=450;
const ranged=G.spawnEnemy(N.ENEMY_STYLES.find(s=>s.role==='burster'),650,450);ranged.spawnT=0;ranged.speed=160;
for(let i=0;i<1200;i++){G.time+=1/60;G.updateEnemies(1/60);}
check(W.clear(ranged.x,ranged.y,p.x,p.y),'nearby ranged enemy does not stay idle behind cover');
G.newRun();const floor=Array.from(G.level.layout.floor).join('');const seed=G.level.seed;G.saveCheckpoint(true,'map-test');check(G.restoreCheckpoint(),'new map checkpoint restores');
check(G.run.mapVersion===1&&G.level.seed===seed&&Array.from(G.level.layout.floor).join('')===floor,'save reproduces exact map layout');
const edge=G.level.layout.covers[0];G.player.aim=-Math.PI/2;G.player.x=edge.x-12;G.player.y=edge.y+edge.height/2;
const savedX=G.player.x,savedY=G.player.y;G.saveCheckpoint(true,'hull-clearance');G.restoreCheckpoint();
check(G.player.x===savedX&&G.player.y===savedY&&G.player.aim===-Math.PI/2,'valid hull position beside cover survives restore exactly');
Object.assign(G.player,G.level.layout.spawn); // Entry/exit fixture uses the clear central route.
const b=G.level.layout.boss;G.spawnBoss();const boss=G.level.activeBoss;
check(boss&&N.dist(boss.x,boss.y,b.x,b.y)<1&&W.free(G.level.layout,boss.x,boss.y,boss.r),'boss spawns in valid designated space');
const start={x:G.player.x,y:G.player.y};G.player.x=b.x;G.player.y=b.y;W.move(G.player,start.x,start.y,N.Ships.get(G.player.shipType).radius,true);
check(N.dist(G.player.x,G.player.y,b.x,b.y)<1,'boss space can be entered without gates');
G.player.x=start.x;G.player.y=start.y;W.move(G.player,b.x,b.y,N.Ships.get(G.player.shipType).radius,true);
check(N.dist(G.player.x,G.player.y,start.x,start.y)<1,'boss space can be left during encounter');
const kills=G.run.kills;G.killEnemy(boss);check(!G.level.activeBoss&&G.run.kills===kills+1&&G.groundItems.length>0,'boss completion keeps rewards and clears active boss');
const old=N.deepClone(N.readSave());delete old.run.mapVersion;check(G.loadFromSave(old)&&!G.level.layout&&G.level.width===3000,'legacy saves retain original rectangular map');
G.newRun();G.resetEntityArrays();G.player.invuln=1e9;
const cover=G.level.layout.covers[0];Object.assign(G.player,W.findFree(G.level.layout,cover.x-50,cover.y+cover.height/2,25));
G.aim={angle:0,fire:true,source:'mouse',point:{x:cover.x+cover.width+100,y:cover.y+cover.height/2}};
for(const def of Object.values(N.WEAPON_BY_ID)){
  G.fireWeapon(G.makeWeapon(def.id,1,1));G.updatePlayerBullets(.05);G.updateMines(.05);G.updateOrbitals(.05);G.updateStrikes(.6);
  check(G.playerBullets.every(b=>b.dead||W.free(G.level.layout,b.x,b.y,0))&&G.mines.every(m=>W.free(G.level.layout,m.x,m.y,0)),'weapon smoke near cover: '+def.id);
}
G.pauseGame();window.mapCombatResult={passed:passed.length,checks:passed};
})();
