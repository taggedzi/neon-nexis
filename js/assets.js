/* NEON NEXUS — procedural asset synthesis (geometry, icons, glows, textures) */
(function(){
'use strict';
const N=window.NEON;
const AS=N.Assets={};
const TAU=N.TAU;
const glowCache=new Map();
const iconCache=new Map();
const bodyCache=new Map();

AS.makeGlow=function(color,size=96,power=.55){
  const key=color+'|'+size+'|'+power;
  if(glowCache.has(key)) return glowCache.get(key);
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  g.addColorStop(0,N.withAlpha(color,.95));
  g.addColorStop(.18,N.withAlpha(color,power));
  g.addColorStop(.55,N.withAlpha(color,power*.22));
  g.addColorStop(1,N.withAlpha(color,0));
  x.fillStyle=g; x.fillRect(0,0,size,size);
  glowCache.set(key,c); return c;
};
AS.drawGlow=function(ctx,color,x,y,r,alpha=1,comp='lighter'){
  const img=AS.makeGlow(color,128,.6);
  ctx.save(); ctx.globalCompositeOperation=comp; ctx.globalAlpha=alpha;
  ctx.drawImage(img,x-r,y-r,r*2,r*2); ctx.restore();
};
AS.glow=function(color,size=96,power=.55){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  g.addColorStop(0,N.withAlpha(color,.95));g.addColorStop(.18,N.withAlpha(color,power));g.addColorStop(.55,N.withAlpha(color,power*.22));g.addColorStop(1,N.withAlpha(color,0));
  x.fillStyle=g;x.fillRect(0,0,size,size); return c;
};
AS.makeNoise=function(){
  const size=220, c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d'), d=x.createImageData(size,size);
  for(let i=0;i<d.data.length;i+=4){
    const v=Math.random()*255|0;
    d.data[i]=v;d.data[i+1]=v;d.data[i+2]=v;d.data[i+3]=Math.random()<.55?Math.random()*70:0;
  }
  x.putImageData(d,0,0);
  try{document.documentElement.style.setProperty('--grain',`url(${c.toDataURL('image/png')})`);}catch(e){}
  return c;
};

// ——— 32 distinct wireframe body silhouettes ———
function ring(n,rx=1,ry=rx,rot=0){
  const p=[]; for(let i=0;i<n;i++){const a=rot+i/n*TAU;p.push([Math.cos(a)*rx,Math.sin(a)*ry]);} return p;
}
function segsFrom(p,close=true){
  const out=[]; const n=p.length;
  for(let i=0;i<(close?n:n-1);i++){const a=p[i],b=p[(i+1)%n];out.push([a[0],a[1],b[0],b[1]]);}
  return out;
}
function lines(...arr){return arr;}
function line(x1,y1,x2,y2){return [x1,y1,x2,y2];}
function starPts(points,r1,r2,rot=0){const p=[];for(let i=0;i<points*2;i++){const a=rot+i/(points*2)*TAU;const r=i%2?r2:r1;p.push([Math.cos(a)*r,Math.sin(a)*r]);}return p;}
function ellPts(n,rx,ry,rot=0){const p=[];for(let i=0;i<n;i++){const a=i/n*TAU;p.push([Math.cos(a)*rx*Math.cos(rot)-Math.sin(a)*ry*Math.sin(rot),Math.cos(a)*rx*Math.sin(rot)+Math.sin(a)*ry*Math.cos(rot)]);}return p;}

const shapeBuilders={
  dart(){
    const p=[[0,-1],[-.55,.48],[-.22,.28],[0,.58],[.22,.28],[.55,.48]];
    return {segs:segsFrom(p),core:.22};
  },
  needle(){
    const p=[[0,-1.08],[-.25,.1],[0,.82],[.25,.1]];
    return {segs:segsFrom(p).concat([line(-.25,.1,-.58,.48),line(.25,.1,.58,.48),line(-.18,.32,-.48,.62),line(.18,.32,.48,.62),line(-.08,-.2,.08,-.2)]),core:.12};
  },
  crawler(){
    const p=[[0,-.55],[-.6,-.15],[-.4,.45],[.4,.45],[.6,-.15]];
    const legs=[];
    for(let i=0;i<4;i++){const y=-.2+i*.23;legs.push(line(-.55,y,-1.02,y+.35),line(.55,y,1.02,y+.35));}
    return {segs:segsFrom(p).concat(legs,[line(-.28,-.15,.28,.32),line(.28,-.15,-.28,.32)]),core:.2};
  },
  hexplate(){
    const a=ring(6,.78,.78,.26), b=ring(6,.42,.42,.26);
    const bolts=[];
    for(const pt of a){bolts.push(line(pt[0]*.82,pt[1]*.82,pt[0]*.94,pt[1]*.94));}
    return {segs:segsFrom(a).concat(segsFrom(b),[line(-.78,0,.78,0),line(0,-.78,0,.78)],bolts),core:.3};
  },
  eye(){
    const p=ellPts(12,.96,.5,0);
    const inner=ring(4,.28,.28,.78);
    return {segs:segsFrom(p).concat(segsFrom(inner),[line(-.86,0,-1.08,0),line(.86,0,1.08,0),line(-.52,-.32,-.62,-.55),line(.52,-.32,.62,-.55)]),core:.3};
  },
  trident(){
    const shaft=line(0,.82,0,-.75);
    const prongs=[line(-.55,-.25,-.65,-.95),line(.55,-.25,.65,-.95),line(-.65,-.95,-.65,-.55),line(.65,-.95,.65,-.55),line(-.55,-.25,0,.05),line(.55,-.25,0,.05),line(-.22,.55,.22,.55)];
    return {segs:[shaft].concat(prongs,[line(-.9,.45,.9,.45),line(-.55,-.25,-.55,.2),line(.55,-.25,.55,.2)]),core:.16};
  },
  flower(){
    const petals=[];
    for(let i=0;i<6;i++){
      const a=i/6*TAU, c=Math.cos(a),s=Math.sin(a);
      const p=[[c*.32,s*.32],[c*.88+s*.2,s*.88-c*.2],[c*1.02,s*1.02],[c*.88-s*.2,s*.88+c*.2]];
      petals.push(segsFrom(p));
    }
    return {segs:[].concat(...petals).concat(segsFrom(ring(6,.28,.28,.3)),segsFrom(ring(12,.94,.94,0),false)),core:.25};
  },
  spore(){
    const spikes=[];
    for(let i=0;i<12;i++){const a=i/12*TAU;spikes.push(line(Math.cos(a)*.65,Math.sin(a)*.65,Math.cos(a)*1.03,Math.sin(a)*1.03));}
    return {segs:segsFrom(ring(12,.68,.68,0)).concat(spikes,segsFrom(ring(6,.36,.36,.3))),core:.25};
  },
  cube(){
    const a=ring(4,.8,.8,.78), b=ring(4,.42,.42,.78);
    const diag=[line(-.8,-.8,.8,.8),line(.8,-.8,-.8,.8)];
    return {segs:segsFrom(a).concat(segsFrom(b),diag),core:.22};
  },
  fractal(){
    const out=[];
    function tri(x1,y1,x2,y2,x3,y3,d){
      out.push(line(x1,y1,x2,y2),line(x2,y2,x3,y3),line(x3,y3,x1,y1));
      if(d<=0)return;
      const mx1=(x1+x2)/2,my1=(y1+y2)/2,mx2=(x2+x3)/2,my2=(y2+y3)/2,mx3=(x3+x1)/2,my3=(y3+y1)/2;
      tri(x1,y1,mx1,my1,mx3,my3,d-1); tri(mx1,my1,x2,y2,mx2,my2,d-1); tri(mx3,my3,mx2,my2,x3,y3,d-1);
    }
    tri(0,-.98,-.94,.68,.94,.68,2);
    return {segs:out,core:.16};
  },
  lance(){
    const p=[[0,-1.1],[-.28,-.45],[-.28,.25],[0,.42],[.28,.25],[.28,-.45]];
    return {segs:segsFrom(p).concat([line(-.28,-.1,-.75,.28),line(.28,-.1,.75,.28),line(-.75,.28,-.75,.08),line(.75,.28,.75,.08),line(0,.42,0,.78)]),core:.16};
  },
  prism(){
    const a=ring(3,.9,.9,-Math.PI/2), b=ring(3,.62,.62,Math.PI/2);
    return {segs:segsFrom(a).concat(segsFrom(b),segsFrom(ring(6,.92,.92,0),false)),core:.22};
  },
  ring(){
    const outer=segsFrom(ring(20,1,1,0)), inner=segsFrom(ring(4,.42,.42,.78));
    const ticks=[];
    for(let i=0;i<8;i++){const a=i/8*TAU;ticks.push(line(Math.cos(a)*.8,Math.sin(a)*.8,Math.cos(a)*1.03,Math.sin(a)*1.03));}
    return {segs:outer.concat(inner,ticks),core:.28};
  },
  shield(){
    const p=[[0,-.92],[-.72,-.55],[-.68,.22],[0,.9],[.68,.22],[.72,-.55]];
    return {segs:segsFrom(p).concat([line(-.4,-.2,.4,-.2),line(-.34,.16,.34,.16),line(0,-.55,0,.56)]),core:.3};
  },
  orb(){
    const p=segsFrom(ring(8,.75,.75,0));
    const fuse=[line(.55,.45,.88,.8),line(.88,.8,1.04,.55),line(.88,.8,.7,1.02)];
    const inner=segsFrom(ring(8,.32,.32,.39));
    return {segs:p.concat(inner,fuse,segsFrom(ring(16,.94,.94,0),false)),core:.32};
  },
  spider(){
    const p=[[0,-.56],[-.55,0],[0,.56],[.55,0]];
    const legs=[];
    for(let i=0;i<4;i++){const a=(-.7+i*.45);legs.push(line(-.4,a*.65,-.95,a),line(.4,a*.65,.95,a));}
    return {segs:segsFrom(p).concat(legs,[line(-.25,0,.25,0),line(0,-.25,0,.25)]),core:.2};
  },
  web(){
    const outer=segsFrom(ring(6,.95,.95,0));
    const spokes=[];
    for(let i=0;i<6;i++){const a=i/6*TAU;spokes.push(line(0,0,Math.cos(a)*.95,Math.sin(a)*.95));}
    const mid=segsFrom(ring(6,.56,.56,.52),false);
    return {segs:outer.concat(spokes,mid,segsFrom(ring(3,.24,.24,.78))),core:.2};
  },
  knot(){
    const a=ring(3,.82,.82,-Math.PI/2), b=ring(3,.82,.82,Math.PI/2);
    return {segs:segsFrom(a).concat(segsFrom(b),segsFrom(ring(6,.88,.88,0),false),segsFrom(ring(6,.28,.28,0))),core:.22};
  },
  hive(){
    const out=[];
    const centers=[[0,0],[-.48,-.3],[.48,-.3],[-.48,.3],[.48,.3],[0,.6],[0,-.6]];
    for(const [cx,cy] of centers){const p=ring(6,.28,.28,.52).map(([x,y])=>[x+cx,y+cy]);out.push(...segsFrom(p));}
    return {segs:out,core:.3};
  },
  brood(){
    const p=ellPts(14,.82,1,0);
    const eggs=[];
    for(const [x,y] of [[-.3,.1],[.28,.22],[0,-.35],[-.25,-.5],[.3,-.55]]){
      eggs.push(...segsFrom(ellPts(7,.14,.2,x*.7)));
    }
    return {segs:segsFrom(p).concat(eggs,[line(-.82,0,-1.04,0),line(.82,0,1.04,0)]),core:.35};
  },
  horn(){
    const p=[[0,.88],[-.55,.45],[-.7,-.45],[-.3,-.65],[0,-.3],[.3,-.65],[.7,-.45],[.55,.45]];
    const h1=[line(-.7,-.45,-1.08,-.78),line(-1.08,-.78,-.8,-.94),line(-.8,-.94,-.56,-.64)];
    const h2=[line(.7,-.45,1.08,-.78),line(1.08,-.78,.8,-.94),line(.8,-.94,.56,-.64)];
    return {segs:segsFrom(p).concat(h1,h2,[line(-.35,-.15,.35,-.15),line(0,.2,0,.72)]),core:.3};
  },
  breaker(){
    const p=ring(4,.78,.78,.78);
    const spikes=[];
    for(const [x,y] of p){spikes.push(line(x,y,x*1.25,y*1.25));}
    return {segs:segsFrom(p).concat(spikes,segsFrom(ring(4,.32,.32,.78)),[line(-.78,-.78,.78,.78),line(.78,-.78,-.78,.78)]),core:.35};
  },
  gyro(){
    const out=segsFrom(ring(20,.82,.82,0));
    for(let i=0;i<3;i++){const a=i/3*TAU;const c=Math.cos(a),s=Math.sin(a);out.push(line(c*.18,s*.18,c*1.04,s*1.04),line(c*1.04,s*1.04,c*.55-s*.32,s*.55+c*.32));}
    return {segs:out.concat(segsFrom(ring(3,.28,.28,0))),core:.3};
  },
  orbit(){
    const a=ellPts(20,1,.42,.4), b=ellPts(20,.55,.98,-.3);
    return {segs:segsFrom(a).concat(segsFrom(b),[line(-.15,-.15,.15,.15),line(.9,.4,1.04,.55),line(-.9,-.4,-1.04,-.55)]),core:.28};
  },
  crown(){
    const p=[[-.78,.55],[-.7,-.3],[-.38,-.02],[-.22,-.78],[0,-.25],[.22,-.78],[.38,-.02],[.7,-.3],[.78,.55]];
    return {segs:segsFrom(p).concat([line(-.78,.55,.78,.55),line(-.56,.55,-.56,.3),line(0,.55,0,.3),line(.56,.55,.56,.3),segsFrom(ring(4,.16,.16,.78))]),core:.28};
  },
  ghost(){
    const p=[[0,-.92],[-.62,-.48],[-.78,.32],[-.44,.72],[-.22,.42],[0,.76],[.22,.42],[.44,.72],[.78,.32],[.62,-.48]];
    return {segs:segsFrom(p).concat([line(-.3,-.35,-.12,-.2),line(.3,-.35,.12,-.2),line(-.42,.12,.42,.12)]),core:.25};
  },
  voidEye(){
    const out=segsFrom(ring(16,.98,.98,0)).concat(segsFrom(ellPts(12,.58,.32,0)),segsFrom(ring(4,.18,.18,.78)));
    for(let i=0;i<8;i++){const a=i/8*TAU;out.push(line(Math.cos(a)*.72,Math.sin(a)*.72,Math.cos(a)*.95,Math.sin(a)*.95));}
    return {segs:out,core:.32};
  },
  seeder(){
    const p=[[0,-.85],[-.55,-.4],[-.68,.32],[0,.82],[.68,.32],[.55,-.4]];
    const legs=[line(-.4,.5,-.75,1),line(.4,.5,.75,1),line(0,.6,0,1.06),line(-.2,.62,-.3,.95),line(.2,.62,.3,.95)];
    const seeds=[];
    for(const [x,y] of [[-.28,-.15],[.28,-.2],[0,.22]]) seeds.push(...segsFrom(ring(6,.1,.1,x+y)));
    return {segs:segsFrom(p).concat(legs,seeds),core:.28};
  },
  spire(){
    const p=[[0,-1.05],[-.32,-.42],[-.42,.58],[.42,.58],[.32,-.42]];
    const cross=[line(-.65,.12,.65,.12),line(-.55,.42,.55,.42),line(0,.58,0,.98),line(-.3,.58,-.6,.92),line(.3,.58,.6,.92)];
    return {segs:segsFrom(p).concat(cross,segsFrom(ring(4,.26,.26,.78))),core:.2};
  },
  boss(){
    const outer=segsFrom(starPts(12,1.04,.7,0));
    const inner=segsFrom(starPts(6,.58,.34,.26));
    const ring1=segsFrom(ring(24,.92,.92,0),false);
    const spikes=[];
    for(let i=0;i<12;i++){const a=i/12*TAU;spikes.push(line(Math.cos(a)*.58,Math.sin(a)*.58,Math.cos(a)*.78,Math.sin(a)*.78));}
    return {segs:outer.concat(inner,ring1,spikes,segsFrom(ring(4,.2,.2,.78))),core:.4};
  },
  trinity(){
    const out=[];
    for(let k=0;k<3;k++){
      const a=k/3*TAU-Math.PI/2;
      const p=[[Math.cos(a)*.92,Math.sin(a)*.92],[Math.cos(a+2.1)*.92,Math.sin(a+2.1)*.92],[Math.cos(a+4.2)*.92,Math.sin(a+4.2)*.92]];
      out.push(...segsFrom(p));
    }
    return {segs:out.concat(segsFrom(ring(3,.28,.28,.3))),core:.3};
  },
  archon(){
    const gear=[];
    const n=12;
    for(let i=0;i<n;i++){
      const a=i/n*TAU, a2=(i+.5)/n*TAU;
      gear.push(line(Math.cos(a)*.74,Math.sin(a)*.74,Math.cos(a2)*1.02,Math.sin(a2)*1.02));
      gear.push(line(Math.cos(a2)*1.02,Math.sin(a2)*1.02,Math.cos((i+1)/n*TAU)*.74,Math.sin((i+1)/n*TAU)*.74));
    }
    return {segs:gear.concat(segsFrom(ring(20,.72,.72,0),false),segsFrom(starPts(6,.46,.26,.3)),segsFrom(ring(4,.16,.16,.78))),core:.4};
  }
};

AS.getBody=function(type,seed=1){
  const key=type+'|'+seed;
  if(bodyCache.has(key)) return bodyCache.get(key);
  const fn=shapeBuilders[type]||shapeBuilders.dart;
  const shape=fn();
  // light deterministic variation in scale / rotation
  const rng=N.RNG(N.hashString(type)+seed*97);
  const scale=.92+rng.next()*.16;
  const segs=shape.segs.map(s=>[s[0]*scale,s[1]*scale,s[2]*scale,s[3]*scale]);
  const obj={segs,core:shape.core,scale};
  bodyCache.set(key,obj); return obj;
};
AS.bodyTypes=Object.keys(shapeBuilders);

// ——— weapon icons ———
const iconBuilders={
  pulse(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=9;x.shadowColor=c;
    x.beginPath();x.moveTo(9,22);x.lineTo(28,22);x.moveTo(12,32);x.lineTo(30,32);x.moveTo(15,42);x.lineTo(32,42);x.stroke();
    x.beginPath();x.moveTo(28,18);x.lineTo(34,22);x.lineTo(28,26);x.moveTo(30,28);x.lineTo(36,32);x.lineTo(30,36);x.stroke();
    x.fillStyle=c;x.fillRect(12,20,4,4);x.fillRect(14,30,4,4);
  },
  scatter(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=1.8;x.shadowBlur=8;x.shadowColor=c;
    for(let i=0;i<5;i++){const a=-1.15+i*.575;x.beginPath();x.moveTo(16,32);x.lineTo(16+Math.cos(a)*22,32+Math.sin(a)*22);x.stroke();}
    x.beginPath();x.arc(16,32,4,0,TAU);x.stroke();
  },
  rail(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;
    x.beginPath();x.moveTo(7,32);x.lineTo(54,32);x.moveTo(16,26);x.lineTo(16,38);x.moveTo(42,26);x.lineTo(42,38);x.stroke();
    x.globalAlpha=.5;x.lineWidth=5;x.beginPath();x.moveTo(10,32);x.lineTo(40,32);x.stroke();
  },
  spiral(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;x.beginPath();
    for(let i=0;i<40;i++){const a=i*.28,r=2+i*.45;const px=32+Math.cos(a)*r,py=32+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();
    x.fillStyle=c;x.fillRect(30,2,4,4);
  },
  seeker(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=9;x.shadowColor=c;
    for(const [ox,oy] of [[-9,8],[9,10]]){
      x.beginPath();x.moveTo(32+ox,32+oy);x.lineTo(32+ox-6,32+oy+14);x.lineTo(32+ox,32+oy+10);x.lineTo(32+ox+6,32+oy+14);x.closePath();x.stroke();
      x.beginPath();x.arc(32+ox,32+oy+16,2.2,0,TAU);x.fillStyle=c;x.fill();
    }
    x.setLineDash([2,3]);x.beginPath();x.moveTo(23,28);x.quadraticCurveTo(32,14,42,28);x.stroke();x.setLineDash([]);
  },
  nova(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;x.beginPath();x.arc(32,32,14,0,TAU);x.stroke();
    for(let i=0;i<12;i++){const a=i/12*TAU;x.beginPath();x.moveTo(32+Math.cos(a)*18,32+Math.sin(a)*18);x.lineTo(32+Math.cos(a)*27,32+Math.sin(a)*27);x.stroke();}
  },
  mortar(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=9;x.shadowColor=c;x.beginPath();x.arc(32,32,20,.5,2.4);x.stroke();
    x.setLineDash([2,3]);x.beginPath();x.arc(32,32,25,.2,2.7);x.stroke();x.setLineDash([]);
    x.fillStyle=c;x.beginPath();x.arc(32,32,3,0,TAU);x.fill();
    for(const [x1,y1] of [[20,18],[44,20],[50,40]]){x.beginPath();x.arc(x1,y1,2,0,TAU);x.fill();}
  },
  mine(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;
    const p=[];for(let i=0;i<8;i++){const a=i/8*TAU;p.push([32+Math.cos(a)*13,32+Math.sin(a)*13]);}x.beginPath();p.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.stroke();
    for(let i=0;i<8;i++){const a=i/8*TAU+.2;x.beginPath();x.moveTo(32+Math.cos(a)*13,32+Math.sin(a)*13);x.lineTo(32+Math.cos(a)*22,32+Math.sin(a)*22);x.stroke();}
  },
  tesla(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;x.beginPath();
    const pts=[[35,6],[22,24],[34,25],[18,44],[38,30],[27,29],[42,12]];pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.stroke();
    x.beginPath();x.arc(16,32,2,0,TAU);x.fillStyle=c;x.fill();
  },
  beam(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;
    x.beginPath();x.moveTo(5,32);x.lineTo(59,32);x.stroke();x.lineWidth=5;x.globalAlpha=.35;x.stroke();
    x.globalAlpha=1;x.lineWidth=1;x.setLineDash([2,2]);x.beginPath();x.moveTo(12,22);x.lineTo(12,42);x.moveTo(30,18);x.lineTo(30,46);x.moveTo(48,24);x.lineTo(48,40);x.stroke();x.setLineDash([]);
  },
  orb(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;
    x.beginPath();x.arc(32,32,19,0,TAU);x.stroke();x.globalAlpha=.6;x.beginPath();x.arc(32,32,11,0,TAU);x.stroke();
    x.globalAlpha=1;x.fillStyle=c;x.beginPath();x.arc(32,32,4,0,TAU);x.fill();
    x.beginPath();x.arc(32,32,25,.2,2.2);x.stroke();
  },
  chain(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;
    for(const [x1,y1] of [[16,32],[32,32],[48,32]]){
      x.beginPath();x.moveTo(x1,y1-9);x.lineTo(x1+9,y1);x.lineTo(x1,y1+9);x.lineTo(x1-9,y1);x.closePath();x.stroke();
    }
    x.setLineDash([2,2]);x.beginPath();x.moveTo(22,32);x.lineTo(26,32);x.moveTo(38,32);x.lineTo(42,32);x.stroke();x.setLineDash([]);
  },
  shard(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;
    for(const [x1,y1,r] of [[18,22,0],[30,34,.9],[44,20,1.8]]){x.save();x.translate(x1,y1);x.rotate(r);x.beginPath();x.moveTo(0,-12);x.lineTo(7,0);x.lineTo(0,12);x.lineTo(-7,0);x.closePath();x.stroke();x.restore();}
  },
  gravity(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;
    x.beginPath();x.arc(32,32,22,0,TAU);x.stroke();
    for(let i=0;i<4;i++){const a=i/4*TAU;x.beginPath();x.moveTo(32+Math.cos(a)*16,32+Math.sin(a)*16);x.lineTo(32+Math.cos(a)*9,32+Math.sin(a)*9);x.stroke();x.beginPath();x.moveTo(32+Math.cos(a)*9,32+Math.sin(a)*9);x.lineTo(32+Math.cos(a+.2)*12,32+Math.sin(a+.2)*12);x.moveTo(32+Math.cos(a)*9,32+Math.sin(a)*9);x.lineTo(32+Math.cos(a-.2)*12,32+Math.sin(a-.2)*12);x.stroke();}
    x.fillStyle=c;x.beginPath();x.arc(32,32,2.5,0,TAU);x.fill();
  },
  starfall(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=12;x.shadowColor=c;
    for(const [x1,y1,x2,y2] of [[16,6,22,28],[34,2,32,22],[50,8,46,30]]){x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();}
    x.globalAlpha=.65;x.beginPath();x.arc(32,42,14,0,TAU);x.stroke();x.beginPath();x.arc(32,42,7,0,TAU);x.stroke();
    x.globalAlpha=1;x.fillStyle=c;x.fillRect(30,40,4,4);
  },
  shuriken(x,ctx,c){
    x.strokeStyle=c;x.lineWidth=2;x.shadowBlur=10;x.shadowColor=c;
    const pts=starPts(4,25,10,-Math.PI/2);x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(32+px,32+py):x.moveTo(32+px,32+py));x.closePath();x.stroke();
    x.beginPath();x.arc(32,32,4,0,TAU);x.stroke();
  }
};
AS.weaponIcon=function(id,color){
  const key=id+'|'+color;
  if(iconCache.has(key)) return iconCache.get(key);
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d');
  x.translate(0,0);
  try{iconBuilders[id](x,x,color);}catch(e){ // fallback geometric glyph
    x.strokeStyle=color;x.lineWidth=2;x.strokeRect(20,20,24,24);x.beginPath();x.arc(32,32,7,0,TAU);x.stroke();
  }
  iconCache.set(key,c); return c;
};
AS.weaponIconURL=function(id,color){
  const key='url|'+id+'|'+color;
  if(iconCache.has(key)) return iconCache.get(key);
  const url=AS.weaponIcon(id,color).toDataURL('image/png');
  iconCache.set(key,url);return url;
};
AS.iconBuilders=iconBuilders;

// ——— passive / pickup glyphs ———
const modCache=new Map();
AS.modIcon=function(id,color,glyph){
  const key=id+'|'+color+'|'+(glyph||'');
  if(modCache.has(key)) return modCache.get(key);
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d');
  x.strokeStyle=color;x.fillStyle=color;x.lineWidth=1.8;x.shadowBlur=8;x.shadowColor=color;
  x.lineJoin='round';
  x.beginPath();
  const ring=[];for(let i=0;i<6;i++){const a=-Math.PI/2+i/6*TAU;ring.push([32+Math.cos(a)*24,32+Math.sin(a)*24]);}
  ring.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.stroke();
  x.globalAlpha=.55;x.beginPath();x.arc(32,32,18,0,TAU);x.stroke();x.globalAlpha=1;
  const g=glyph||'dmg';
  const L=(a,b,cx,cy)=>{x.beginPath();x.moveTo(a,b);x.lineTo(cx,cy);x.stroke();};
  const tri=(pts)=>{x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.stroke();};
  switch(g){
    case 'dmg': tri([[32,16],[42,31],[32,28],[22,31]]); L(32,31,32,48); break;
    case 'rate': tri([[38,14],[23,35],[33,35],[26,50],[44,28],[34,28]]); break;
    case 'speed': L(18,32,44,32); tri([[36,24],[46,32],[36,40]]); L(16,26,22,32);L(16,38,22,32); break;
    case 'multi': for(const [px,py] of [[32,16],[22,34],[42,34]]){tri([[px,py-5],[px+5,py+4],[px-5,py+4]]);} break;
    case 'pierce': L(14,32,50,32); x.beginPath();x.arc(32,32,8,0,TAU);x.stroke(); tri([[42,26],[50,32],[42,38]]); break;
    case 'bounce': tri([[18,38],[28,22],[34,30],[42,18],[46,36],[38,30],[30,42]]); break;
    case 'chain': for(const [px,py] of [[23,32],[41,32]]){x.save();x.translate(px,py);x.rotate(Math.PI/4);x.strokeRect(-6,-6,12,12);x.restore();} L(29,32,35,32); break;
    case 'crit': x.beginPath();x.arc(32,32,15,0,TAU);x.stroke(); L(32,12,32,22);L(32,42,32,52);L(12,32,22,32);L(42,32,52,32); x.fillRect(30,30,4,4); break;
    case 'hp': tri([[32,16],[46,32],[32,48],[18,32]]); L(32,23,32,41);L(23,32,41,32); break;
    case 'regen': x.beginPath();x.arc(32,32,16,.3,5.9);x.stroke(); tri([[40,17],[49,19],[45,27]]); L(32,24,32,40);L(24,32,40,32); break;
    case 'armor': tri([[32,14],[47,22],[44,40],[32,50],[20,40],[17,22]]); L(32,22,32,42); break;
    case 'shield': tri([[32,14],[47,22],[44,40],[32,50],[20,40],[17,22]]); break;
    case 'dash': tri([[20,18],[36,32],[20,46]]); tri([[34,18],[50,32],[34,46]]); break;
    case 'move': L(16,32,45,32); tri([[35,20],[49,32],[35,44]]); break;
    case 'magnet': x.beginPath();x.arc(32,30,15,0,Math.PI);x.stroke(); L(17,30,17,44);L(47,30,47,44); x.fillRect(13,42,8,7);x.fillRect(43,42,8,7); break;
    case 'luck': tri([[32,14],[40,27],[54,27],[42,36],[47,50],[32,40],[17,50],[22,36],[10,27],[24,27]]); break;
    case 'xp': tri([[32,13],[45,32],[32,51],[19,32]]); L(32,20,32,44);L(25,32,39,32); break;
    case 'thorns': for(let i=0;i<8;i++){const a=i/8*TAU;L(32+Math.cos(a)*12,32+Math.sin(a)*12,32+Math.cos(a)*26,32+Math.sin(a)*26);} x.beginPath();x.arc(32,32,8,0,TAU);x.stroke(); break;
    case 'blast': for(let i=0;i<8;i++){const a=i/8*TAU;L(32+Math.cos(a)*10,32+Math.sin(a)*10,32+Math.cos(a)*26,32+Math.sin(a)*26);} x.beginPath();x.arc(32,32,7,0,TAU);x.stroke(); break;
    case 'leech': x.beginPath();for(let i=0;i<28;i++){const a=i*.35,r=2+i*.7;const px=32+Math.cos(a)*r,py=32+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke(); break;
    case 'time': tri([[22,16],[42,16],[32,32],[42,48],[22,48],[32,32]]); break;
    case 'dodge': x.setLineDash([4,4]); x.beginPath();x.arc(32,32,16,0,TAU);x.stroke(); x.setLineDash([]); tri([[32,22],[41,32],[32,42],[23,32]]); break;
    case 'curse': L(20,20,44,44);L(44,20,20,44); x.beginPath();x.arc(32,32,17,0,TAU);x.stroke(); break;
    case 'heal': L(32,17,32,47);L(17,32,47,32); x.beginPath();x.arc(32,32,17,0,TAU);x.stroke(); break;
    default: tri([[32,16],[46,32],[32,48],[18,32]]); L(32,22,32,42);
  }
  modCache.set(key,c); return c;
};
AS.modIconURL=function(id,color,glyph){
  const key='url|'+id+'|'+color+'|'+(glyph||'');
  if(modCache.has(key)) return modCache.get(key);
  const url=AS.modIcon(id,color,glyph).toDataURL('image/png');
  modCache.set(key,url);return url;
};

AS.ready=function(){AS.makeNoise();};
})();
