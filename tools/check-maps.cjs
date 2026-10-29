// Deterministic generation and geometry validation; no browser/build dependency.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{NEON:{}},location:{search:''}};vm.createContext(box);
for(const file of ['util','content','game','driving','ships','world','maps','enemies'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js',file+'.js'),'utf8'),box);
const N=box.window.NEON,G=N.Game,W=N.World;
function reachable(l){
  const start=Math.floor(l.spawn.y/100)*l.cols+Math.floor(l.spawn.x/100),seen=new Set([start]),queue=[start];
  for(let head=0;head<queue.length;head++){
    const i=queue[head],x=i%l.cols,y=Math.floor(i/l.cols);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      const j=ny*l.cols+nx;if(nx<0||ny<0||nx>=l.cols||ny>=l.rows||!l.floor[j]||seen.has(j))continue;
      seen.add(j);queue.push(j);
    }
  }
  return seen;
}
const families={},sizes=new Set();let layouts=0,minCovers=Infinity,maxCovers=0;
for(let seed=0;seed<128;seed++)for(const sector of [1,2,6]){
  G.run={seed,mapVersion:1,level:sector};const level=G.generateLevel(sector,null),l=level.layout;
  assert(l.width>=2400&&l.width<=4400&&l.height>=1800&&l.height<=3200);
  assert(l.covers.length>=2,'every layout has usable cover; seed '+seed+' sector '+sector);
  const seen=reachable(l);assert.equal(seen.size,l.cells.length,'all floor cells connected');
  for(const p of [...level.anchors,...level.caches,l.spawn,l.boss]){
    assert(W.free(l,p.x,p.y,p.r||25),'valid required spawn');
    assert(seen.has(Math.floor(p.y/100)*l.cols+Math.floor(p.x/100)),'reachable required spawn');
  }
  for(const dx of [-300,0,300])for(const dy of [-300,0,300])assert(W.free(l,l.boss.x+dx,l.boss.y+dy,110),'clear usable boss space');
  for(const radius of [30,70,110]){
    const f=W.field(l,l.spawn.x,l.spawn.y,radius);
    for(const p of l.cells)if(f.valid[p.index])assert(f.distance[p.index]>=0,'enemy clearance graph connected');
  }
  const again=N.Maps.generate(level.seed);assert.deepEqual(Array.from(again.floor),Array.from(l.floor),'seed reproduces floor');
  assert.equal(JSON.stringify(again.covers),JSON.stringify(l.covers),'seed reproduces cover');
  families[l.family]=(families[l.family]||0)+1;sizes.add(l.width+'x'+l.height);layouts++;
  minCovers=Math.min(minCovers,l.covers.length);maxCovers=Math.max(maxCovers,l.covers.length);
}
assert.equal(Object.keys(families).length,3);assert(sizes.size>20);
G.run={seed:42,mapVersion:0,level:1};const legacy=G.generateLevel(1,null);assert.equal(legacy.layout,null);assert.equal(legacy.width,3000);assert.equal(legacy.height,2100);
assert.equal(G.loadFromSave({version:1,run:{mapVersion:999},player:{}}),false,'unsupported map version rejected without overwriting');
const fixture={cols:12,rows:10,width:1200,height:1000,floor:new Uint8Array(120),cells:[],nav:new Map()};
for(let y=1;y<9;y++)for(let x=1;x<11;x++)if(!(x===5&&y>=2&&y<=6)){fixture.floor[y*12+x]=1;fixture.cells.push({index:y*12+x,x:x*100+50,y:y*100+50});}
G.level={layout:fixture};
assert(W.segment(fixture,450,450,650,450,3),'swept ray hits cover');
assert.equal(W.segment(fixture,450,150,650,150,3),null,'clear corridor stays clear');
const mover={x:1050,y:450,vx:1000,vy:0,r:20};W.move(mover,450,450,20);assert(mover.x<=480,'fast movement cannot tunnel through cover');
const enemy={x:650,y:450,vx:0,vy:0,r:20},target={x:450,y:450};
for(let i=0;i<1200;i++){
  const point=W.waypoint(enemy,target)||target,dx=point.x-enemy.x,dy=point.y-enemy.y,d=Math.hypot(dx,dy)||1,oldX=enemy.x,oldY=enemy.y;
  enemy.x+=dx/d*Math.min(d,100/60);enemy.y+=dy/d*Math.min(d,100/60);W.move(enemy,oldX,oldY,20);
}
assert(Math.hypot(enemy.x-target.x,enemy.y-target.y)<60,'navigation routes around cover');
console.log(JSON.stringify({layouts,seeds:'0..127',sectors:[1,2,6],families,distinctSizes:sizes.size,minCovers,maxCovers,geometry:'swept collision and routing passed'}));
