/* NEON NEXUS — solid map geometry, swept collision and shared navigation */
(function(){
'use strict';
const N=window.NEON,W=N.World={CELL:100};
W.solid=(l,x,y)=>x<0||y<0||x>=l.cols||y>=l.rows||!l.floor[y*l.cols+x];
W.rectEntry=function(ax,ay,bx,by,x,y,w,h,r=0){
  let enter=0,exit=1,nx=0,ny=0;
  for(const [start,delta,lo,hi,sx,sy] of [[ax,bx-ax,x-r,x+w+r,1,0],[ay,by-ay,y-r,y+h+r,0,1]]){
    if(Math.abs(delta)<1e-9){if(start<lo||start>hi)return null;continue;}
    let a=(lo-start)/delta,b=(hi-start)/delta;
    if(a>b)[a,b]=[b,a];
    if(a>enter){enter=a;nx=-Math.sign(delta)*sx;ny=-Math.sign(delta)*sy;}
    exit=Math.min(exit,b);if(enter>exit)return null;
  }
  return exit>=0&&enter<=1?{t:Math.max(0,enter),nx,ny}:null;
};
W.free=function(l,x,y,r=0){
  if(!l)return true;
  const s=W.CELL;
  if(W.solid(l,Math.floor(x/s),Math.floor(y/s)))return false;
  for(let cy=Math.floor((y-r)/s);cy<=Math.floor((y+r)/s);cy++)for(let cx=Math.floor((x-r)/s);cx<=Math.floor((x+r)/s);cx++){
    if(!W.solid(l,cx,cy))continue;
    const dx=x-N.clamp(x,cx*s,(cx+1)*s),dy=y-N.clamp(y,cy*s,(cy+1)*s);
    if(dx*dx+dy*dy<r*r)return false;
  }
  return true;
};
W.segment=function(l,ax,ay,bx,by,r=0){
  if(!l)return null;
  if(!W.free(l,ax,ay,r))return {t:0,nx:0,ny:0};
  const s=W.CELL;let best=null;
  const left=Math.max(0,Math.floor((Math.min(ax,bx)-r)/s)),right=Math.min(l.cols-1,Math.floor((Math.max(ax,bx)+r)/s));
  const top=Math.max(0,Math.floor((Math.min(ay,by)-r)/s)),bottom=Math.min(l.rows-1,Math.floor((Math.max(ay,by)+r)/s));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(W.solid(l,x,y)){
    const hit=W.rectEntry(ax,ay,bx,by,x*s,y*s,s,s,r);
    if(hit&&(!best||hit.t<best.t))best=hit;
  }
  return best;
};
W.clear=(ax,ay,bx,by)=>!W.segment(N.Game.level?.layout,ax,ay,bx,by);
W.findFree=function(l,x,y,r=25){
  if(!l||W.free(l,x,y,r))return {x,y};
  let best=null,distance=Infinity;
  for(const p of l.cells){const d=N.dist2(x,y,p.x,p.y);if(d<distance&&W.free(l,p.x,p.y,r)){distance=d;best=p;}}
  if(!best)throw Error('Map has no valid spawn for radius '+r);
  return {x:best.x,y:best.y};
};
W.move=function(e,oldX,oldY,r,hull=false,previousAngle=null){
  const l=N.Game.level?.layout;if(!l)return;
  const targetX=e.x,targetY=e.y;
  const free=(x,y)=>{
    if(!hull)return W.free(l,x,y,r);
    const px=e.x,py=e.y;e.x=x;e.y=y;let valid=true;
    const s=W.CELL;
    for(let cy=Math.floor((y-r)/s);cy<=Math.floor((y+r)/s)&&valid;cy++)for(let cx=Math.floor((x-r)/s);cx<=Math.floor((x+r)/s);cx++){
      if(W.solid(l,cx,cy)&&N.Ships.intersectsRect(e,cx*s,cy*s,s,s)){valid=false;break;}
    }
    e.x=px;e.y=py;return valid;
  };
  e.x=oldX;e.y=oldY;
  if(hull&&Number.isFinite(previousAngle)&&!free(e.x,e.y)){
    if(N.Game.settings.movementMode==='driving')e.heading=previousAngle;else e.aim=previousAngle;
  }
  if(!free(e.x,e.y)){Object.assign(e,W.findFree(l,e.x,e.y,r));return;}
  const dx=targetX-oldX,dy=targetY-oldY,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/20));
  for(let i=0;i<steps;i++){
    if(free(e.x+dx/steps,e.y))e.x+=dx/steps;else e.vx=0;
    if(free(e.x,e.y+dy/steps))e.y+=dy/steps;else e.vy=0;
  }
};
W.field=function(l,tx,ty,radius=30){
  const size=radius<=45?45:radius<=75?75:120;
  l.nav=l.nav||new Map();let cache=l.nav.get(size);
  if(!cache){
    const valid=new Uint8Array(l.floor.length);
    for(const p of l.cells)if(W.free(l,p.x,p.y,size))valid[p.index]=1;
    cache={valid,goal:-1,distance:null};l.nav.set(size,cache);
  }
  const targetCell=Math.floor(tx/W.CELL)+Math.floor(ty/W.CELL)*l.cols;
  if(cache.targetCell===targetCell&&cache.distance)return cache;
  cache.targetCell=targetCell;
  let goal=-1,best=Infinity;
  for(const p of l.cells)if(cache.valid[p.index]){const d=N.dist2(tx,ty,p.x,p.y);if(d<best){best=d;goal=p.index;}}
  if(goal===cache.goal&&cache.distance)return cache;
  const distance=new Int32Array(l.floor.length);distance.fill(-1);
  const queue=new Int32Array(l.floor.length);let head=0,tail=0;
  if(goal>=0){distance[goal]=0;queue[tail++]=goal;}
  while(head<tail){const at=queue[head++],x=at%l.cols,y=Math.floor(at/l.cols);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const i=ny*l.cols+nx;if(nx<0||ny<0||nx>=l.cols||ny>=l.rows||!cache.valid[i]||distance[i]>=0)continue;
    distance[i]=distance[at]+1;queue[tail++]=i;
  }}
  cache.goal=goal;cache.distance=distance;return cache;
};
W.waypoint=function(e,target){
  const l=N.Game.level?.layout;if(!l||!W.segment(l,e.x,e.y,target.x,target.y,e.r))return null;
  const field=W.field(l,target.x,target.y,e.r),s=W.CELL;
  const x=Math.floor(e.x/s),y=Math.floor(e.y/s),at=y*l.cols+x;
  let index=at,best=field.distance[at];
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const i=ny*l.cols+nx,d=field.distance[i];
    if(nx>=0&&ny>=0&&nx<l.cols&&ny<l.rows&&d>=0&&(best<0||d<best)){best=d;index=i;}
  }
  if(best<0){
    let distance=Infinity;
    for(const p of l.cells)if(field.distance[p.index]>=0){const d=N.dist2(e.x,e.y,p.x,p.y);if(d<distance){distance=d;index=p.index;}}
  }
  let point={x:(index%l.cols+.5)*s,y:(Math.floor(index/l.cols)+.5)*s};
  if(W.segment(l,e.x,e.y,point.x,point.y,e.r)&&field.distance[at]>=0)point={x:(x+.5)*s,y:(y+.5)*s};
  return point;
};
})();
