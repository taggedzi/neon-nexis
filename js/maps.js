/* NEON NEXUS — version 1 seeded playable regions and cover */
(function(){
'use strict';
const N=window.NEON,W=N.World,S=W.CELL;
function rect(l,x,y,w,h,value=1){for(let cy=y;cy<y+h;cy++)for(let cx=x;cx<x+w;cx++)if(cx>0&&cy>0&&cx<l.cols-1&&cy<l.rows-1)l.floor[cy*l.cols+cx]=value;}
function cells(l){l.cells=[];for(let i=0;i<l.floor.length;i++)if(l.floor[i])l.cells.push({index:i,x:(i%l.cols+.5)*S,y:(Math.floor(i/l.cols)+.5)*S});}
function connected(l){
  cells(l);const field=W.field(l,l.spawn.x,l.spawn.y,110);
  if(!field.valid[field.goal])return false;
  if(l.cells.some(p=>field.valid[p.index]&&field.distance[p.index]<0))return false;
  // Required player-sized areas must also be connected.
  l.nav.delete(45);const small=W.field(l,l.spawn.x,l.spawn.y,25);
  return l.cells.every(p=>small.distance[p.index]>=0);
}
N.Maps={
  generate(seed){
    const r=N.RNG(N.hashString(seed+'|playable-v1')),family=r.pick(['compact','wide','chambers']);
    const cols=family==='compact'?r.int(24,30):family==='wide'?r.int(36,44):r.int(32,44);
    const rows=family==='compact'?r.int(18,23):r.int(24,32);
    const l={version:1,seed,family,cols,rows,width:cols*S,height:rows*S,floor:new Uint8Array(cols*rows),covers:[],nav:new Map()};
    const cy=Math.floor(rows/2),cx=Math.floor(cols/2);
    if(family==='chambers'){
      rect(l,2,cy-5,10,11);rect(l,cols-13,cy-5,11,11);
      rect(l,cx-4,2,9,7);rect(l,cx-4,rows-9,9,7);
      rect(l,6,cy-2,cols-12,4);rect(l,cx-2,5,4,rows-10);
    }else{
      for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){
        const dx=Math.abs((x+.5-cols/2)/(cols/2-1)),dy=Math.abs((y+.5-rows/2)/(rows/2-1));
        if(family==='compact'?dx+dy<1.65:Math.pow(dx,4)+Math.pow(dy,4)<1)l.floor[y*cols+x]=1;
      }
    }
    l.spawn={x:6.5*S,y:(cy+.5)*S};
    l.boss={x:(cols-7+.5)*S,y:(cy+.5)*S,width:9*S,height:9*S};
    rect(l,cols-11,cy-4,9,9);rect(l,6,cy-2,cols-12,4);
    cells(l);
    const addCover=(x,y,w,h)=>{
      if(Math.abs(y-cy)<3||family==='chambers'&&Math.abs(x-cx)<3)return;
      let valid=true;
      for(let yy=y-2;yy<y+h+2;yy++)for(let xx=x-2;xx<x+w+2;xx++)if(W.solid(l,xx,yy))valid=false;
      const px=(x+w/2)*S,py=(y+h/2)*S;
      if(!valid||N.dist(px,py,l.spawn.x,l.spawn.y)<350||Math.abs(px-l.boss.x)<l.boss.width/2+150&&Math.abs(py-l.boss.y)<l.boss.height/2+150)return;
      rect(l,x,y,w,h,0);l.nav.clear();
      if(!connected(l)){rect(l,x,y,w,h,1);l.nav.clear();return;}
      l.covers.push({x:x*S,y:y*S,width:w*S,height:h*S});
    };
    for(let tries=0;tries<180&&l.covers.length<Math.floor(cols*rows/110);tries++){
      addCover(r.int(3,cols-5),r.int(3,rows-5),r.int(1,2),r.int(1,2));
    }
    // Sparse chamber layouts still get real cover when random attempts miss.
    for(let y=3;y<rows-3&&l.covers.length<2;y++)for(let x=3;x<cols-3&&l.covers.length<2;x++)addCover(x,y,1,1);
    cells(l);l.nav.clear();
    return l;
  },
  place(l,r,radius,avoid=[],separation=160){
    const valid=l.cells.filter(p=>W.free(l,p.x,p.y,radius)&&N.dist(p.x,p.y,l.spawn.x,l.spawn.y)>300&&
      !(Math.abs(p.x-l.boss.x)<l.boss.width/2+50&&Math.abs(p.y-l.boss.y)<l.boss.height/2+50)&&
      avoid.every(a=>N.dist(p.x,p.y,a.x,a.y)>separation));
    if(!valid.length)throw Error('Map placement exhausted for seed '+l.seed);
    const p=valid[r.int(0,valid.length-1)];return {x:p.x,y:p.y};
  }
};
})();
