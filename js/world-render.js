/* NEON NEXUS — procedural floor, solid cover and boss-space presentation */
(function(){
'use strict';
const N=window.NEON,W=N.World,R=N.WorldRender={};
R.paths=function(l){
  if(l.floorPath)return;
  l.floorPath=new Path2D();l.borderPath=new Path2D();const s=W.CELL;
  for(const p of l.cells){
    const x=p.index%l.cols,y=Math.floor(p.index/l.cols),px=x*s,py=y*s;
    l.floorPath.rect(px,py,s,s);
    for(const [dx,dy,ax,ay,bx,by] of [[-1,0,px,py,px,py+s],[1,0,px+s,py,px+s,py+s],[0,-1,px,py,px+s,py],[0,1,px,py+s,px+s,py+s]])if(W.solid(l,x+dx,y+dy)){l.borderPath.moveTo(ax,ay);l.borderPath.lineTo(bx,by);}
  }
};
R.boundary=function(c,l,theme){
  R.paths(l);c.save();c.globalCompositeOperation='lighter';
  c.strokeStyle=N.withAlpha(theme.a,.06);c.lineWidth=32;c.stroke(l.borderPath);
  c.strokeStyle=N.withAlpha(theme.a,.55);c.lineWidth=2;c.stroke(l.borderPath);c.restore();
  const G=N.Game,halfW=G.w/(2*G.zoom),halfH=G.h/(2*G.zoom);
  for(const b of l.covers){
    if(b.x+b.width<G.camera.x-halfW-50||b.x>G.camera.x+halfW+50||b.y+b.height<G.camera.y-halfH-50||b.y>G.camera.y+halfH+50)continue;
    c.save();c.fillStyle='rgba(4,10,20,.98)';c.fillRect(b.x,b.y,b.width,b.height);
    c.strokeStyle=N.withAlpha(theme.b,.75);c.lineWidth=2;c.strokeRect(b.x,b.y,b.width,b.height);
    c.strokeStyle=N.withAlpha(theme.a,.32);c.lineWidth=1;c.strokeRect(b.x+9,b.y+9,b.width-18,b.height-18);
    c.beginPath();c.moveTo(b.x+9,b.y+9);c.lineTo(b.x+b.width-9,b.y+b.height-9);c.moveTo(b.x+b.width-9,b.y+9);c.lineTo(b.x+9,b.y+b.height-9);c.stroke();c.restore();
  }
  const b=l.boss;c.save();c.strokeStyle=N.withAlpha('#ff335c',.35);c.lineWidth=1.5;c.setLineDash([12,14]);
  c.strokeRect(b.x-b.width/2+16,b.y-b.height/2+16,b.width-32,b.height-32);c.setLineDash([]);
  c.fillStyle=N.withAlpha('#ff8da4',.65);c.font='10px '+N.FONT_MONO;c.textAlign='center';
  c.fillText('OVERSEER SPACE',b.x,b.y-b.height/2+42);c.restore();
};
R.minimap=function(c,l,x,y,w,h,theme){
  if(!l.mini){
    l.mini=document.createElement('canvas');l.mini.width=l.cols*4;l.mini.height=l.rows*4;
    const m=l.mini.getContext('2d');m.fillStyle=N.withAlpha(theme.a,.2);
    for(const p of l.cells)m.fillRect((p.index%l.cols)*4,Math.floor(p.index/l.cols)*4,4,4);
    m.fillStyle=N.withAlpha(theme.b,.65);for(const b of l.covers)m.fillRect(b.x/W.CELL*4,b.y/W.CELL*4,b.width/W.CELL*4,b.height/W.CELL*4);
  }
  c.drawImage(l.mini,x,y,w,h);c.strokeStyle=N.withAlpha('#ff335c',.5);c.lineWidth=1;
  c.strokeRect(x+(l.boss.x-l.boss.width/2)/l.width*w,y+(l.boss.y-l.boss.height/2)/l.height*h,l.boss.width/l.width*w,l.boss.height/l.height*h);
};
})();
