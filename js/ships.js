/* NEON NEXUS — cosmetic hulls, previews and shape-matched hitboxes */
(function(){
'use strict';
const N=window.NEON;
const types=[
  {id:'dart',name:'DART',points:[[0,-20],[-11,10],[-4,7],[0,14],[4,7],[11,10]]},
  {id:'delta',name:'DELTA',points:[[0,-20],[-17,14],[0,7],[17,14]]},
  {id:'kite',name:'KITE',points:[[0,-22],[-12,0],[0,18],[12,0]]},
  {id:'talon',name:'TALON',points:[[0,-18],[-7,-6],[-18,14],[-6,8],[0,13],[6,8],[18,14],[7,-6]]}
];
for(const t of types)t.radius=Math.max(...t.points.map(([x,y])=>Math.hypot(x,y)));
const palette=[{name:'CYAN',color:'#66ffff'},{name:'MAGENTA',color:'#ff77e6'},
  {name:'LIME',color:'#d0ff77'},{name:'AMBER',color:'#ffd166'},
  {name:'VIOLET',color:'#bf99ff'},{name:'ICE',color:'#a6e8ff'}];
const get=id=>types.find(t=>t.id===id)||types[0];
N.Ships={types,palette,get,
  selection(value){
    return {shipType:get(value?.shipType).id,shipColor:palette.some(p=>p.color===value?.shipColor)||value?.shipColor==='#00f0ff'?value.shipColor:'#00f0ff'};
  },
  path(c,id){
    c.beginPath();get(id).points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  },
  drawHull(c,p){
    const color=p.shipColor||'#00f0ff';
    this.path(c,p.shipType);c.fillStyle=N.withAlpha(color,.08);c.fill();
    c.strokeStyle=p.hitFlash>0?'#fff':color;c.lineWidth=1.7;c.lineJoin='round';c.stroke();
    c.strokeStyle=N.withAlpha('#ff2bd6',.75);c.lineWidth=1;
    c.beginPath();c.moveTo(-7,2);c.lineTo(7,2);c.moveTo(0,-12);c.lineTo(0,9);c.stroke();
    c.fillStyle='#fff';c.beginPath();c.arc(0,-4,2.4,0,N.TAU);c.fill();
    c.fillStyle=color;c.beginPath();c.moveTo(0,-24);c.lineTo(-2.5,-18);c.lineTo(2.5,-18);c.closePath();c.fill();
  },
  preview(canvas,selection){
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    c.save();c.translate(canvas.width/2,canvas.height/2);c.scale(3,3);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.22;
    c.drawImage(N.Assets.glow(selection.shipColor,128,.7),-32,-32,64,64);c.restore();
    this.drawHull(c,selection);c.restore();
  },
  intersectsCircle(p,x,y,r){
    const type=get(p.shipType),dx=x-p.x,dy=y-p.y;
    if(dx*dx+dy*dy>(type.radius+r)*(type.radius+r))return false;
    const a=N.Driving.angle(p)+Math.PI/2,co=Math.cos(a),si=Math.sin(a);
    const px=dx*co+dy*si,py=-dx*si+dy*co;
    let inside=false;
    const pts=type.points;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const [ax,ay]=pts[j],[bx,by]=pts[i];
      if(N.distToSegment(px,py,ax,ay,bx,by)<=r)return true;
      if((ay>py)!==(by>py)&&px<(bx-ax)*(py-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  }
};
})();
