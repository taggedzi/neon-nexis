/* Run only in an isolated browser context at /?test=ships. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('test')!=='ships')throw Error('Use an isolated ship test page');
const N=window.NEON,G=N.Game,S=N.Ships,passed=[];
function check(ok,message){if(!ok)throw Error(message);passed.push(message);}
G.settings=N.deepMerge(N.SETTINGS_DEFAULT,{});G.applySettings(false);
check(S.types.length===4&&S.palette.length===6,'four hulls and six colors available');
let stats=null;
for(const type of S.types){
  for(const color of S.palette){
    G.newRun({shipType:type.id,shipColor:color.color});
    check(G.player.shipType===type.id&&G.player.shipColor===color.color,'confirmed selection starts exactly');
    const current=JSON.stringify(G.player.stats);if(!stats)stats=current;
    check(current===stats,'all ship stats are identical');
    G.saveCheckpoint(true,'ship-test');G.restoreCheckpoint();
    check(G.player.shipType===type.id&&G.player.shipColor===color.color,'ship selection survives save/restore');
  }
  const p=G.player;p.shipType=type.id;p.aim=-Math.PI/2;p.x=1000;p.y=1000;
  check(S.intersectsCircle(p,p.x,p.y,0),'hull center is inside hitbox');
  check(!S.intersectsCircle(p,p.x+1000,p.y,1),'far circle is outside hitbox');
  for(const [x,y] of type.points)check(S.intersectsCircle(p,p.x+x,p.y+y,.01),'visible hull vertex is collidable');
  G.settings.movementMode='driving';p.heading=.73;
  const [x,y]=type.points[0],a=p.heading+Math.PI/2;
  check(S.intersectsCircle(p,p.x+x*Math.cos(a)-y*Math.sin(a),p.y+x*Math.sin(a)+y*Math.cos(a),.01),'driving hitbox rotates with hull heading');
  G.settings.movementMode='directional';p.aim=-Math.PI/2;
  const outside={dart:[10,-10],delta:[0,12],kite:[11,15],talon:[12,-3]}[type.id];
  check(!S.intersectsCircle(p,p.x+outside[0],p.y+outside[1],0),'empty hull region is not a circular hitbox');
  p.hp=100;p.shield=0;p.invuln=0;G.enemyBullets.length=0;
  const b=G.spawnEnemyBullet({x:p.x+type.points[0][0],y:p.y+type.points[0][1],angle:0,speed:1,damage:5,size:1,life:1});b.vx=0;b.vy=0;
  G.updateEnemyBullets(0);check(p.hp<100&&b.dead,'enemy projectile hits actual hull tip');
}
const oldSave=N.deepClone(N.readSave());delete oldSave.player.shipType;delete oldSave.player.shipColor;
G.loadFromSave(oldSave);check(G.player.shipType==='dart'&&G.player.shipColor==='#00f0ff','legacy save preserves original Dart/cyan appearance');
oldSave.player.shipType='invalid';oldSave.player.shipColor='url(invalid)';G.loadFromSave(oldSave);
check(G.player.shipType==='dart'&&G.player.shipColor==='#00f0ff','invalid saved appearance uses explicit safe defaults');
G.pauseGame();N.UI.showShipSelection();
const savedBefore=localStorage.getItem(N.Storage.key);document.getElementById('btn-ship-cancel').click();
check(localStorage.getItem(N.Storage.key)===savedBefore,'canceling selection preserves existing save');
N.UI.showShipSelection();check(N.UI.currentScreen()==='ship','another new run allows another selection');
window.shipsResult={passed:passed.length,checks:passed};
})();
