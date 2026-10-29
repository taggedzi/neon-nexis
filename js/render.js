/* NEON NEXUS — renderer */
(function(){
'use strict';
const N=window.NEON;
const G=N.Game;
const TAU=N.TAU;
const clamp=N.clamp;
const DURATION=G.DURATION;
const FONT_M=N.FONT_MONO;
const FONT_D=N.FONT_DISPLAY;

function txt(c,s,x,y,size,color,align='left',font=FONT_M,weight=400,alpha=1){
  c.save();c.globalAlpha*=alpha;c.font=weight+' '+size+'px '+font;c.textAlign=align;c.textBaseline='middle';
  c.fillStyle=color;c.fillText(s,x,y);c.restore();
}
function glow(c,x,y,r,color,alpha=.45,comp='lighter'){
  c.save();c.globalCompositeOperation=comp;c.globalAlpha*=alpha;
  c.drawImage(N.Assets.glow(color,128,.7),x-r,y-r,r*2,r*2);c.restore();
}
function path(c,x,y,w,h,cut=10){
  cut=Math.min(cut,w/2,h/2);
  c.beginPath();c.moveTo(x+cut,y);c.lineTo(x+w-cut,y);c.lineTo(x+w,y+cut);c.lineTo(x+w,y+h-cut);
  c.lineTo(x+w-cut,y+h);c.lineTo(x+cut,y+h);c.lineTo(x,y+h-cut);c.lineTo(x,y+cut);c.closePath();
}
function panel(c,x,y,w,h,fill='rgba(3,10,18,.72)',stroke='rgba(0,240,255,.28)',cut=10){
  c.save();path(c,x,y,w,h,cut);
  c.fillStyle=fill;c.fill();
  c.strokeStyle=stroke;c.lineWidth=1;c.stroke();
  c.restore();
}
function cull(x,y,pad=120){
  const hw=G.w/(2*G.zoom),hh=G.h/(2*G.zoom);
  return x>G.camera.x-hw-pad&&x<G.camera.x+hw+pad&&y>G.camera.y-hh-pad&&y<G.camera.y+hh+pad;
}
function line(c,x1,y1,x2,y2,color,w=1,alpha=1,dash=null){
  c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';
  if(dash)c.setLineDash(dash);
  c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();
}
function hex(c,x,y,r,rot=0,color='#00f0ff',fill=null,w=1.4){
  c.beginPath();
  for(let i=0;i<6;i++){const a=rot+i/6*TAU;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}
  c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}
  c.strokeStyle=color;c.lineWidth=w;c.stroke();
}

// ——— attract / menu ———
G.renderAttract=function(c,dt){
  const w=G.w,h=G.h,t=G.attractTime;
  const theme=N.THEMES[Math.floor(t/11)%N.THEMES.length];
  const g=c.createRadialGradient(w*.68,h*.42,0,w*.68,h*.42,Math.max(w,h)*.78);
  g.addColorStop(0,theme.bg);g.addColorStop(.55,'#050a14');g.addColorStop(1,'#010205');
  c.fillStyle=g;c.fillRect(0,0,w,h);
  // perspective floor grid
  c.save();
  c.strokeStyle=N.withAlpha(theme.a,.055);c.lineWidth=1;
  const horizon=h*.63;
  for(let i=-14;i<=14;i++){
    const x=w*.65+i*(w/16);
    c.beginPath();c.moveTo(w*.65+i*8,horizon);c.lineTo(x+w*.08,h);c.stroke();
  }
  for(let i=0;i<10;i++){
    const yy=horizon+Math.pow(i/10,2)*(h-horizon);
    c.beginPath();c.moveTo(0,yy);c.lineTo(w,yy);c.stroke();
  }
  c.restore();
  // ambient polygons
  for(const o of G.attractObjects){
    const x=o.x*w+Math.sin(t*.12+o.phase)*24, y=o.y*h+Math.cos(t*.09+o.phase)*16;
    const r=o.r*(0.6+o.depth*.7);
    const col=o.hue<.5?theme.a:theme.b;
    c.save();c.translate(x,y);c.rotate(o.rot+t*o.spin);
    c.globalAlpha=.08+o.depth*.16;
    c.beginPath();
    for(let i=0;i<o.n;i++){const a=i/o.n*TAU;const px=Math.cos(a)*r,py=Math.sin(a)*r*.8;i?c.lineTo(px,py):c.moveTo(px,py);}
    c.closePath();c.fillStyle=N.withAlpha(col,.08);c.fill();
    c.strokeStyle=col;c.lineWidth=.8+o.depth;c.stroke();
    c.globalAlpha=.18;
    c.beginPath();c.arc(0,0,r*.32,0,TAU);c.stroke();
    c.restore();
  }
  // central nexus hologram
  const cx=w*.72,cy=h*.49,scale=clamp(Math.min(w,h)/1000,.45,1.15);
  c.save();
  c.translate(cx,cy);
  c.globalCompositeOperation='lighter';
  glow(c,0,0,210*scale,theme.a,.10);
  c.globalCompositeOperation='source-over';
  // elliptical orbits
  for(let k=0;k<4;k++){
    const rw=(240+k*28)*scale,rh=(90+k*16)*scale;
    c.save();c.rotate(-.28+k*.22+t*.015*(k%2?1:-1));
    c.strokeStyle=N.withAlpha(k%2?theme.b:theme.a,.34);
    c.lineWidth=1;
    c.setLineDash(k===3?[4,10]:[]);
    c.beginPath();c.ellipse(0,0,rw,rh,0,0,TAU);c.stroke();
    c.setLineDash([]);
    const a=t*(.16+k*.035)+k*1.7;
    const px=Math.cos(a)*rw,py=Math.sin(a)*rh;
    c.fillStyle=k%2?theme.b:theme.a;c.beginPath();c.arc(px,py,2.2,0,TAU);c.fill();
    c.restore();
  }
  // rotating poly shells
  const shells=[[160,6,.16,theme.a],[112,4,-.24,theme.b],[72,3,.4,theme.a]];
  for(const [rr,nn,sp,col] of shells){
    c.save();c.rotate(t*sp);
    c.strokeStyle=N.withAlpha(col,.55);c.lineWidth=1.2;
    c.beginPath();for(let i=0;i<nn;i++){const a=-Math.PI/2+i/nn*TAU;const px=Math.cos(a)*rr*scale,py=Math.sin(a)*rr*scale;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();
    c.restore();
  }
  // core
  c.save();c.rotate(t*.3);
  c.strokeStyle=N.withAlpha(theme.a,.8);c.lineWidth=1.6;
  c.strokeRect(-26*scale,-26*scale,52*scale,52*scale);
  c.rotate(Math.PI/4);c.strokeStyle=N.withAlpha(theme.b,.9);
  c.strokeRect(-16*scale,-16*scale,32*scale,32*scale);
  c.restore();
  glow(c,0,0,55*scale,theme.b,.4);
  // ticks around nexus
  c.save();
  for(let i=0;i<28;i++){
    const a=i/28*TAU,r1=(300+(i%4)*7)*scale,r2=(318+(i%3)*8)*scale;
    c.strokeStyle=N.withAlpha(i%3?theme.a:theme.b,.28);
    c.beginPath();c.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);c.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);c.stroke();
  }
  c.restore();
  // data motes
  c.globalCompositeOperation='lighter';
  for(let i=0;i<32;i++){
    const a=(i*2.399+t*.08)%TAU,rr=110+((i*37)%180)*scale;
    const px=Math.cos(a)*rr,py=Math.sin(a)*rr*.55;
    c.globalAlpha=.16+((i%5)*.035);
    c.fillStyle=i%2?theme.a:theme.b;c.fillRect(px,py,2,2);
  }
  c.restore();
  // corner labels / registration marks
  c.save();
  c.strokeStyle=N.withAlpha(theme.a,.25);c.lineWidth=1;
  for(const [x,y,sx,sy] of [[32,32,1,1],[w-32,32,-1,1],[32,h-32,1,-1],[w-32,h-32,-1,-1]]){
    c.beginPath();c.moveTo(x,y+22*sy);c.lineTo(x,y);c.lineTo(x+22*sx,y);c.stroke();
    c.beginPath();c.arc(x+5*sx,y+5*sy,2,0,TAU);c.stroke();
  }
  c.restore();
  txt(c,'NEXUS NETWORK // LIVE FEED',w*.72,cy+340*scale,9,N.withAlpha(theme.a,.55),'center',FONT_M,400,1);
  txt(c,'SIGNAL ORIGIN: UNKNOWN',w*.72,cy+355*scale,8,N.withAlpha(theme.b,.45),'center');
  // scanline sweep
  const sy=((t*.06)%1)*h;
  const gg=c.createLinearGradient(0,sy-40,0,sy+40);
  gg.addColorStop(0,'rgba(0,240,255,0)');gg.addColorStop(.5,'rgba(0,240,255,.035)');gg.addColorStop(1,'rgba(0,240,255,0)');
  c.fillStyle=gg;c.fillRect(0,sy-40,w,80);
};

// ——— world ———
function drawBackground(c,theme){
  const w=G.w,h=G.h;
  const g=c.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,Math.max(w,h)*.75);
  g.addColorStop(0,theme.bg);g.addColorStop(.6,'#050a12');g.addColorStop(1,'#010205');
  c.fillStyle=g;c.fillRect(0,0,w,h);
}
function drawWorld(c,theme,dt){
  const L=G.level;
  // map floor
  c.save();
  c.fillStyle='rgba(2,7,12,.92)';
  c.fillRect(0,0,L.width,L.height);
  // outer boundary shadow glow
  c.globalCompositeOperation='lighter';
  c.strokeStyle=N.withAlpha(theme.a,.06);c.lineWidth=32;
  c.strokeRect(0,0,L.width,L.height);
  c.globalCompositeOperation='source-over';
  // grid
  const hw=G.w/(2*G.zoom),hh=G.h/(2*G.zoom);
  const left=Math.max(0,Math.floor((G.camera.x-hw-60)/100)*100);
  const right=Math.min(L.width,Math.ceil((G.camera.x+hw+60)/100)*100);
  const top=Math.max(0,Math.floor((G.camera.y-hh-60)/100)*100);
  const bottom=Math.min(L.height,Math.ceil((G.camera.y+hh+60)/100)*100);
  c.lineWidth=1;
  for(let x=left;x<=right;x+=100){
    const major=x%500===0;
    c.strokeStyle=N.withAlpha(theme.a,major?.11:.055);
    c.beginPath();c.moveTo(x,top);c.lineTo(x,bottom);c.stroke();
  }
  for(let y=top;y<=bottom;y+=100){
    const major=y%500===0;
    c.strokeStyle=N.withAlpha(theme.a,major?.11:.055);
    c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();
  }
  // diagonal data traces
  c.strokeStyle=N.withAlpha(theme.b,.028);c.lineWidth=1;
  for(let i=0;i<10;i++){
    const x=left+((i*431+G.time*4)%Math.max(1,right-left));
    c.beginPath();c.moveTo(x,top);c.lineTo(x-180,bottom);c.stroke();
  }
  // platforms
  for(const p of L.platforms){
    if(!cull(p.x,p.y,400))continue;
    const ang=p.rot+p.spin*G.time;
    c.save();c.translate(p.x,p.y);c.rotate(ang);
    const fill=N.withAlpha(p.color,p.alpha*.55);
    c.beginPath();p.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
    c.fillStyle=fill;c.fill();
    c.save();c.translate(14*(p.depth||.5),16*(p.depth||.5));
    c.strokeStyle=N.withAlpha(p.color,.16);c.lineWidth=1;
    c.beginPath();p.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.stroke();
    c.restore();
    c.strokeStyle=N.withAlpha(p.color,p.big?.55:.32);c.lineWidth=p.big?1.3:1;
    c.beginPath();p.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.stroke();
    // interior wire lines
    c.globalAlpha=.5;
    c.strokeStyle=N.withAlpha(p.color,.16);c.lineWidth=1;
    const n=p.pts.length;
    for(let i=0;i<n;i++){
      const a=p.pts[i],b=p.pts[(i+1)%n];
      c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(a[0]*.35,a[1]*.35);c.stroke();
      if(i%2===0){c.beginPath();c.moveTo(b[0],b[1]);c.lineTo(b[0]*.35,b[1]*.35);c.stroke();}
    }
    c.globalAlpha=1;
    c.restore();
  }
  // dust
  c.globalCompositeOperation='lighter';
  for(const d of L.dust){
    if(!cull(d.x,d.y,20))continue;
    c.globalAlpha=d.a;c.fillStyle=`hsl(${d.hue},90%,70%)`;c.fillRect(d.x,d.y,d.r,d.r);
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
  // map border
  c.strokeStyle=N.withAlpha(theme.a,.55);c.lineWidth=2;
  c.strokeRect(0,0,L.width,L.height);
  c.strokeStyle=N.withAlpha(theme.b,.25);c.lineWidth=1;c.setLineDash([10,14]);
  c.strokeRect(18,18,L.width-36,L.height-36);c.setLineDash([]);
  // corner brackets
  c.strokeStyle=theme.b;c.lineWidth=4;
  const corner=70;
  for(const [x,y,sx,sy] of [[0,0,1,1],[L.width,0,-1,1],[0,L.height,1,-1],[L.width,L.height,-1,-1]]){
    c.beginPath();c.moveTo(x+sx*corner,y);c.lineTo(x,y);c.lineTo(x,y+sy*corner);c.stroke();
  }
  txt(c,'SECTOR '+String(G.run.level).padStart(2,'0')+' // CONTAINMENT FIELD',L.width/2,26,11,N.withAlpha(theme.a,.42),'center',FONT_M);
  c.restore();
}
function drawAnchor(c,a,theme){
  if(!a.alive)return;
  const pulse=Math.sin(G.time*2.2+a.phase)*.5+.5;
  c.save();c.translate(a.x,a.y);
  glow(c,0,0,a.r*4.5,theme.b,.14);
  c.globalCompositeOperation='lighter';
  c.strokeStyle=N.withAlpha(theme.a,.28+pulse*.12);c.lineWidth=1.4;
  c.beginPath();c.arc(0,0,a.r*2.2+pulse*8,0,TAU);c.stroke();
  c.setLineDash([4,9]);c.beginPath();c.arc(0,0,a.r*3.1,0,TAU);c.stroke();c.setLineDash([]);
  c.globalCompositeOperation='source-over';
  // four prongs
  for(let i=0;i<4;i++){
    const ang=a.angle+i/4*TAU;
    c.strokeStyle=N.withAlpha(theme.b,.55);c.lineWidth=2;
    c.beginPath();c.moveTo(Math.cos(ang)*a.r*.65,Math.sin(ang)*a.r*.65);c.lineTo(Math.cos(ang)*a.r*1.7,Math.sin(ang)*a.r*1.7);c.stroke();
    c.fillStyle=theme.a;c.beginPath();c.arc(Math.cos(ang)*a.r*1.7,Math.sin(ang)*a.r*1.7,2.5,0,TAU);c.fill();
  }
  // rotating outer hex
  c.rotate(a.angle+Math.PI/2);
  c.strokeStyle=a.hitFlash>0?'#fff':theme.b;c.lineWidth=2;
  c.beginPath();for(let i=0;i<6;i++){const ang=-Math.PI/2+i/6*TAU;const px=Math.cos(ang)*a.r,py=Math.sin(ang)*a.r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();
  c.rotate(Math.PI/6+Math.sin(G.time+a.phase)*.15);
  c.strokeStyle=N.withAlpha(theme.a,.75);c.lineWidth=1.4;
  c.beginPath();for(let i=0;i<3;i++){const ang=-Math.PI/2+i/3*TAU;const px=Math.cos(ang)*a.r*.7,py=Math.sin(ang)*a.r*.7;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();
  c.fillStyle=theme.a;c.beginPath();c.arc(0,0,a.r*.22+pulse*2,0,TAU);c.fill();
  c.restore();
  // aim line
  c.save();c.globalAlpha=.18;c.strokeStyle=theme.b;c.lineWidth=1;c.setLineDash([2,7]);
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x+Math.cos(a.angle)*a.r*2.3,a.y+Math.sin(a.angle)*a.r*2.3);c.stroke();c.setLineDash([]);c.restore();
  // health
  const w=a.r*2.4,h=4;
  const x=a.x-w/2,y=a.y-a.r*2.3;
  c.save();c.fillStyle='rgba(0,0,0,.6)';c.fillRect(x,y,w,h);
  const frac=Math.max(0,a.hp/a.maxHp);
  c.fillStyle=theme.a;c.shadowBlur=8;c.shadowColor=theme.a;c.fillRect(x,y,w*frac,h);c.shadowBlur=0;
  c.strokeStyle=N.withAlpha(theme.a,.4);c.strokeRect(x,y,w,h);c.restore();
  txt(c,'ANCHOR',a.x,y-9,7,N.withAlpha(theme.a,.55),'center',FONT_M);
}
function drawCache(c,ch,theme){
  if(!ch.alive)return;
  const bob=Math.sin(G.time*2.1+ch.phase)*3;
  const col=ch.corrupt?'#ff335c':theme.a;
  c.save();c.translate(ch.x,ch.y+bob);
  glow(c,0,0,ch.r*3.6,col,ch.corrupt?.2:.12);
  c.rotate(ch.angle+Math.sin(G.time*.8+ch.phase)*.12);
  c.strokeStyle=ch.hitFlash>0?'#fff':col;c.lineWidth=1.6;
  const r=ch.r;
  c.beginPath();c.moveTo(0,-r);c.lineTo(r,0);c.lineTo(0,r);c.lineTo(-r,0);c.closePath();c.fillStyle=N.withAlpha(col,.05);c.fill();c.stroke();
  c.strokeStyle=N.withAlpha(col,.6);c.lineWidth=1;
  c.beginPath();c.moveTo(-r*.55,-r*.55);c.lineTo(r*.55,-r*.55);c.lineTo(r*.55,r*.55);c.lineTo(-r*.55,r*.55);c.closePath();c.stroke();
  c.beginPath();c.moveTo(0,-r*.55);c.lineTo(r*.55,0);c.lineTo(0,r*.55);c.lineTo(-r*.55,0);c.closePath();c.stroke();
  c.strokeStyle=N.withAlpha(col,.25);
  c.beginPath();c.moveTo(0,-r);c.lineTo(0,-r*.55);c.moveTo(r,0);c.lineTo(r*.55,0);c.moveTo(0,r);c.lineTo(0,r*.55);c.moveTo(-r,0);c.lineTo(-r*.55,0);c.stroke();
  c.restore();
  if(ch.hp<ch.maxHp){
    const w=ch.r*2,h=3,x=ch.x-w/2,y=ch.y-ch.r-9+bob;
    c.fillStyle='rgba(0,0,0,.55)';c.fillRect(x,y,w,h);
    c.fillStyle=col;c.fillRect(x,y,w*Math.max(0,ch.hp/ch.maxHp),h);
  }
}
function drawMine(c,m){
  if(!m)return;
  const col=m.color||(m.owner==='enemy'?'#ff335c':'#00f0ff');
  const blink=m.armed?(Math.sin(G.time*12+m.x)*.5+.5):.3;
  c.save();c.translate(m.x,m.y);c.rotate(m.spin);
  glow(c,0,0,m.radius*.8,col,.14+blink*.15);
  c.strokeStyle=m.owner==='enemy'?`rgba(255,51,92,${.35+blink*.55})`:N.withAlpha(col,.65+blink*.25);c.lineWidth=1.5;
  c.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU;const x=Math.cos(a)*m.radius*.32,y=Math.sin(a)*m.radius*.32;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.stroke();
  for(let i=0;i<4;i++){const a=i/4*TAU+.2;c.beginPath();c.moveTo(Math.cos(a)*m.radius*.35,Math.sin(a)*m.radius*.35);c.lineTo(Math.cos(a)*m.radius*.48,Math.sin(a)*m.radius*.48);c.stroke();}
  c.fillStyle=col;c.beginPath();c.arc(0,0,2.5+blink*2,0,TAU);c.fill();
  c.restore();
}
function drawStrike(c,s){
  if(!s)return;
  const prog=1-Math.max(0,s.delay/s.maxDelay);
  c.save();c.translate(s.x,s.y);
  c.globalAlpha=.35+prog*.45;
  c.strokeStyle=s.color;c.lineWidth=1.5;c.setLineDash([5,7]);
  c.beginPath();c.arc(0,0,s.radius,0,TAU);c.stroke();c.setLineDash([]);
  c.beginPath();c.arc(0,0,s.radius*(1-prog*.65),0,TAU);c.stroke();
  c.strokeStyle=N.withAlpha(s.color,.35);
  c.beginPath();c.moveTo(-s.radius,0);c.lineTo(s.radius,0);c.moveTo(0,-s.radius);c.lineTo(0,s.radius);c.stroke();
  c.fillStyle=s.color;c.beginPath();c.arc(0,0,2+prog*4,0,TAU);c.fill();
  c.globalAlpha=.12;c.fillStyle=s.color;c.fillRect(-s.radius*.55,-s.radius,4,s.radius*2);
  c.restore();
}
function drawLoot(c,it,theme){
  if(!it||it.collected)return;
  if(!cull(it.x,it.y,80))return;
  const bob=Math.sin(G.time*2.4+(it.phase||0))*4;
  c.save();c.translate(it.x,it.y+bob);
  glow(c,0,0,34,it.color,.25);
  c.globalAlpha=.65;c.strokeStyle=it.color;c.lineWidth=1;
  c.beginPath();c.arc(0,0,20+Math.sin(G.time*3+(it.phase||0))*2,0,TAU);c.stroke();
  c.setLineDash([3,6]);c.beginPath();c.arc(0,0,26,0,TAU);c.stroke();c.setLineDash([]);
  c.globalAlpha=1;
  let icon=null;
  if(it.kind==='weapon')icon=N.Assets.weaponIcon(it.itemId,it.color);
  else{
    const def=it.kind==='mod'?N.MOD_BY_ID[it.itemId]:N.CONSUMABLES[it.itemId];
    icon=N.Assets.modIcon(it.itemId,it.color,def?def.glyph:'dmg');
  }
  if(icon)c.drawImage(icon,-17,-17,34,34);
  c.restore();
  const p=G.player;
  if(p&&N.dist(p.x,p.y,it.x,it.y)<220){
    const name=G.getLootName(it);
    txt(c,name,it.x,it.y+bob-31,8,it.color,'center',FONT_D,700,1);
  }
}
function drawEnemy(c,e,theme){
  if(e.dead||!cull(e.x,e.y,e.r+60))return;
  const body=N.Assets.getBody(e.style,1);
  const spawnScale=e.spawnT>0?N.easeOut(1-e.spawnT/.42):1;
  const r=e.r*spawnScale;
  if(r<2)return;
  const hit=e.hitFlash>0;
  const col=hit?'#ffffff':e.color;
  const spin=(e.role==='gyro'?G.time*.9:0)+(e.role==='null'?Math.sin(G.time*3+e.phase)*.12:0);
  c.save();c.translate(e.x,e.y);
  glow(c,0,0,r*(e.elite?2.8:2.1),e.color,e.elite?.28:.16);
  if(e.elite){
    c.globalCompositeOperation='lighter';
    c.strokeStyle=N.withAlpha(e.color,.25+Math.sin(G.time*2+e.phase)*.08);c.lineWidth=1;
    c.setLineDash([4,8]);c.beginPath();c.arc(0,0,r*1.55,0,TAU);c.stroke();c.setLineDash([]);
    c.globalCompositeOperation='source-over';
  }
  c.rotate(e.angle+Math.PI/2+spin);
  // dark inner mass
  c.fillStyle=N.withAlpha(e.color,.055);
  c.beginPath();c.arc(0,0,r*.82,0,TAU);c.fill();
  // hull segments
  c.strokeStyle=col;c.lineWidth=e.elite?2:1.25;
  c.lineCap='round';c.lineJoin='round';
  const scale=r;
  c.beginPath();
  for(const s of body.segs){c.moveTo(s[0]*scale,s[1]*scale);c.lineTo(s[2]*scale,s[3]*scale);}
  c.stroke();
  // inner core
  const pulse=1+Math.sin(G.time*3.4+e.phase)*.12;
  c.rotate(-spin*.7);
  c.strokeStyle=N.withAlpha(e.color,.7);c.lineWidth=1;
  c.beginPath();c.arc(0,0,Math.max(2,r*.22*pulse),0,TAU);c.stroke();
  c.fillStyle=e.color;c.beginPath();c.arc(0,0,Math.max(1.5,r*.09),0,TAU);c.fill();
  if(e.role==='weaver'||e.role==='aegis'){
    c.strokeStyle=N.withAlpha(e.color,.3);c.setLineDash([2,4]);c.beginPath();c.arc(0,0,r*.55,0,TAU);c.stroke();c.setLineDash([]);
  }
  c.restore();
  // shield bubble
  if(e.shield>0){
    const frac=e.shield/e.maxShield;
    c.save();c.globalCompositeOperation='lighter';
    c.strokeStyle=N.withAlpha('#6ad7ff',.32+frac*.25);c.lineWidth=1.2;
    c.beginPath();c.arc(e.x,e.y,r*1.35,0,TAU);c.stroke();
    c.setLineDash([4,7]);c.beginPath();c.arc(e.x,e.y,r*1.52,e.angle-.6,e.angle+.7);c.stroke();c.setLineDash([]);
    c.restore();
  }
  // attack telegraphs
  if(e.chargeTimer>0){
    c.save();c.globalAlpha=.22+Math.sin(G.time*12)*.08;c.strokeStyle=e.color;c.lineWidth=1;c.setLineDash([3,8]);
    c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.chargeAngle)*1000,e.y+Math.sin(e.chargeAngle)*1000);c.stroke();c.restore();
    c.save();c.globalAlpha=.18;c.strokeStyle=e.color;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r+8,0,TAU);c.stroke();c.restore();
  }
  if(e.ramState==='telegraph'){
    c.save();c.globalAlpha=.25+Math.sin(G.time*16)*.1;c.strokeStyle='#ffb31f';c.lineWidth=2;c.setLineDash([8,6]);
    c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(e.ramAngle)*520,e.y+Math.sin(e.ramAngle)*520);c.stroke();c.restore();
  }
  if(e.fuseTimer>0){
    c.save();c.globalAlpha=.3+Math.sin(G.time*18)*.2;c.strokeStyle='#ff335c';c.lineWidth=2;
    c.beginPath();c.arc(e.x,e.y,r*(1.5+e.fuseTimer),0,TAU);c.stroke();c.restore();
  }
  if(e.role==='weaver'&&e.healTargetId){
    const t=G.enemies.find(o=>o.id===e.healTargetId);
    if(t&&!t.dead){c.save();c.globalAlpha=.22;c.strokeStyle=e.color;c.lineWidth=1;c.setLineDash([2,5]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(t.x,t.y);c.stroke();c.setLineDash([]);c.restore();}
  }
  // health
  const showBar=e.elite||e.boss||e.hp<e.maxHp;
  if(showBar&&r>7){
    const w=Math.max(20,r*2.1),h=e.boss?5:3,x=e.x-w/2,y=e.y-r-10;
    c.fillStyle='rgba(0,0,0,.65)';c.fillRect(x,y,w,h);
    const frac=Math.max(0,e.hp/e.maxHp);
    c.fillStyle=e.color;c.shadowBlur=6;c.shadowColor=e.color;c.fillRect(x,y,w*frac,h);c.shadowBlur=0;
    c.strokeStyle=N.withAlpha(e.color,.35);c.lineWidth=.7;c.strokeRect(x,y,w,h);
    if(e.shield>0){c.fillStyle='#6ad7ff';c.fillRect(x,y+h+1,w*(e.shield/e.maxShield),1.5);}
  }
}
function drawPlayer(c,p,theme){
  if(!p)return;
  const alpha=p.invuln>0?.55+Math.sin(G.time*32)*.35:1;
  c.save();c.translate(p.x,p.y);c.rotate(N.Driving.angle(p)+Math.PI/2);
  glow(c,0,0,32,p.shipColor,.22);
  // thruster
  const sp=Math.hypot(p.vx,p.vy);
  if(sp>40){
    const th=Math.min(18,4+sp*.035);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.55;
    c.strokeStyle=p.shipColor;c.lineWidth=2;
    c.beginPath();c.moveTo(-4,12);c.lineTo(-2,12+th);c.moveTo(4,12);c.lineTo(2,12+th);c.stroke();c.restore();
  }
  N.Ships.drawHull(c,p);
  c.restore();
  // shields / invuln ring
  if(p.stats.maxShield>0){
    const frac=p.shield/p.stats.maxShield;
    c.save();c.globalCompositeOperation='lighter';
    c.strokeStyle=N.withAlpha('#00f0ff',.16+frac*.25);c.lineWidth=1.2;
    c.beginPath();c.arc(p.x,p.y,p.radius+10,0,TAU);c.stroke();
    c.strokeStyle=N.withAlpha('#00f0ff',.35+frac*.3);c.lineWidth=2;
    c.beginPath();c.arc(p.x,p.y,p.radius+12,-Math.PI/2,-Math.PI/2+TAU*frac);c.stroke();
    c.restore();
  }
  if(p.invuln>0){
    c.save();c.globalAlpha=alpha*.6;c.strokeStyle='#00f0ff';c.lineWidth=1;c.setLineDash([3,6]);
    c.beginPath();c.arc(p.x,p.y,p.radius+17,G.time*2,G.time*2+TAU);c.stroke();c.setLineDash([]);c.restore();
  }
}
function drawBullets(c){
  c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
  for(const b of G.playerBullets){
    if(b.dead||!cull(b.x,b.y,80))continue;
    const ang=b.angle;
    const a=Math.min(1,.35+b.life/Math.max(.1,b.maxLife)*.8);
    const size=b.size;
    // trail
    c.globalAlpha=a*.55;c.strokeStyle=b.color;c.lineWidth=Math.max(1,size*.75);
    c.beginPath();c.moveTo(b.prevX,b.prevY);c.lineTo(b.x,b.y);c.stroke();
    c.globalAlpha=a;
    c.fillStyle=b.color;c.strokeStyle='#fff';
    if(b.kind==='rail'){
      c.lineWidth=Math.max(2,size*.9);c.strokeStyle=b.color;c.beginPath();c.moveTo(b.x-Math.cos(ang)*34,b.y-Math.sin(ang)*34);c.lineTo(b.x,b.y);c.stroke();
      c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,size*.55,0,TAU);c.fill();
    }else if(b.kind==='void'||b.kind==='gravity'){
      glow(c,b.x,b.y,size*4.2,b.color,.4);
      c.strokeStyle=b.color;c.lineWidth=1.4;c.beginPath();c.arc(b.x,b.y,size,0,TAU);c.stroke();
      c.beginPath();c.arc(b.x,b.y,size*.55+Math.sin(G.time*8)*2,0,TAU);c.stroke();
      c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,Math.max(1.5,size*.25),0,TAU);c.fill();
    }else if(b.kind==='seeker'){
      c.save();c.translate(b.x,b.y);c.rotate(ang+Math.PI/2);c.strokeStyle=b.color;c.lineWidth=1.2;
      c.beginPath();c.moveTo(0,-size*1.6);c.lineTo(size,size);c.lineTo(0,size*.35);c.lineTo(-size,size);c.closePath();c.stroke();
      c.fillStyle=b.color;c.fillRect(-1.2,-size*.7,2.4,size*.9);c.restore();
      glow(c,b.x,b.y,size*3,b.color,.25);
    }else if(b.kind==='mortar'){
      glow(c,b.x,b.y,size*3,b.color,.28);
      c.fillStyle=b.color;c.beginPath();c.arc(b.x,b.y,size*.7,0,TAU);c.fill();
      c.strokeStyle=b.color;c.lineWidth=1;c.beginPath();c.arc(b.x,b.y,size,0,TAU);c.stroke();
    }else if(b.kind==='shard'){
      c.save();c.translate(b.x,b.y);c.rotate(ang+G.time*6);c.strokeStyle=b.color;c.lineWidth=1.3;
      c.beginPath();c.moveTo(0,-size*1.8);c.lineTo(size,0);c.lineTo(0,size*1.8);c.lineTo(-size,0);c.closePath();c.stroke();c.restore();
    }else if(b.kind==='nova'){
      c.strokeStyle=b.color;c.lineWidth=1.3;
      c.save();c.translate(b.x,b.y);c.rotate(ang);c.beginPath();c.moveTo(size*1.7,0);c.lineTo(-size*.7,size*.6);c.lineTo(-size*.7,-size*.6);c.closePath();c.stroke();c.restore();
    }else{
      if(size>=3)glow(c,b.x,b.y,size*2.4,b.color,.22);
      c.fillStyle=b.color;c.beginPath();c.arc(b.x,b.y,size,0,TAU);c.fill();
      c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,size*.32,0,TAU);c.fill();
    }
  }
  c.restore();
}
function drawEnemyBullets(c){
  c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
  for(const b of G.enemyBullets){
    if(b.dead||!cull(b.x,b.y,70))continue;
    const a=Math.min(1,.35+b.life/b.maxLife*.7);
    c.globalAlpha=a;
    c.strokeStyle=b.color;c.lineWidth=Math.max(1,b.size*.65);
    c.beginPath();c.moveTo(b.prevX,b.prevY);c.lineTo(b.x,b.y);c.stroke();
    if(b.kind==='snipe'){
      c.lineWidth=Math.max(2,b.size*.7);c.beginPath();c.moveTo(b.x-Math.cos(b.angle)*22,b.y-Math.sin(b.angle)*22);c.lineTo(b.x,b.y);c.stroke();
      c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,b.size*.5,0,TAU);c.fill();
    }else{
      c.save();c.translate(b.x,b.y);c.rotate(b.spin||b.angle);
      c.fillStyle=b.color;c.strokeStyle=N.withAlpha(b.color,.8);c.lineWidth=1;
      c.beginPath();c.moveTo(0,-b.size);c.lineTo(b.size*.75,0);c.lineTo(0,b.size);c.lineTo(-b.size*.75,0);c.closePath();c.fill();
      c.strokeStyle='rgba(255,255,255,.55)';c.beginPath();c.moveTo(0,-b.size*.55);c.lineTo(b.size*.35,0);c.lineTo(0,b.size*.55);c.lineTo(-b.size*.35,0);c.closePath();c.stroke();
      c.restore();
      if(b.size>3.4)glow(c,b.x,b.y,b.size*2.2,b.color,.14);
    }
  }
  c.restore();
}
function drawOrbitals(c){
  const p=G.player;if(!p)return;
  c.save();c.globalCompositeOperation='lighter';
  for(const o of G.orbitals){
    const alpha=Math.min(1,o.life/Math.max(.1,o.maxLife)*2);
    c.save();c.translate(o.x,o.y);c.rotate(G.time*3+o.angle);
    c.globalAlpha=alpha*.5;c.strokeStyle=o.color;c.lineWidth=.7;
    c.beginPath();c.moveTo(-o.radius,0);c.lineTo(o.radius,0);c.stroke();
    c.globalAlpha=alpha;c.strokeStyle=o.color;c.lineWidth=1.6;
    c.beginPath();for(let i=0;i<4;i++){const a=i/4*TAU;const x=Math.cos(a)*9,y=Math.sin(a)*4.5;c.lineTo(x,y);}c.closePath();c.stroke();
    c.fillStyle='#fff';c.beginPath();c.arc(0,0,1.4,0,TAU);c.fill();
    c.restore();
  }
  c.restore();
}
function drawEffects(c,theme){
  for(const e of G.effects){
    const a=Math.max(0,e.life/Math.max(.001,e.maxLife));
    if(e.type==='ring'){
      c.save();c.globalCompositeOperation='lighter';c.globalAlpha=a*.75;
      c.strokeStyle=e.color;c.lineWidth=e.width||1.5;
      c.beginPath();c.arc(e.x,e.y,Math.max(.5,e.r),0,TAU);c.stroke();
      if(e.fill){c.globalAlpha=a*.08;c.fillStyle=e.color;c.fill();}
      c.restore();
    }else if(e.type==='beam'){
      c.save();c.globalCompositeOperation='lighter';c.globalAlpha=a;
      c.strokeStyle=e.color;c.lineCap='round';c.lineWidth=e.width||4;
      c.beginPath();c.moveTo(e.x1,e.y1);c.lineTo(e.x2,e.y2);c.stroke();
      c.globalAlpha=a*.65;c.strokeStyle='#fff';c.lineWidth=Math.max(1,(e.width||4)*.28);
      c.beginPath();c.moveTo(e.x1,e.y1);c.lineTo(e.x2,e.y2);c.stroke();
      c.restore();
    }else if(e.type==='bolt'){
      c.save();c.globalCompositeOperation='lighter';c.globalAlpha=a;
      c.strokeStyle=e.color;c.lineWidth=e.width||2;c.lineJoin='round';c.lineCap='round';
      c.beginPath();e.points.forEach((p,i)=>{if(i===0)c.moveTo(p[0],p[1]);else{
        const prev=e.points[i-1];const mx=(prev[0]+p[0])/2+(Math.random()-.5)*10,my=(prev[1]+p[1])/2+(Math.random()-.5)*10;
        c.lineTo(mx,my);c.lineTo(p[0],p[1]);
      }});c.stroke();
      c.strokeStyle='#fff';c.lineWidth=Math.max(1,(e.width||2)*.35);c.beginPath();e.points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();
      c.restore();
    }else if(e.type==='flash'){
      c.save();c.globalCompositeOperation='lighter';c.globalAlpha=a;
      c.translate(e.x,e.y);c.rotate(e.angle);
      c.fillStyle=e.color;c.beginPath();c.moveTo(0,0);c.lineTo(e.size*2.4,4);c.lineTo(e.size*2.4,-4);c.closePath();c.fill();
      c.restore();
    }else if(e.type==='afterimage'){
      c.save();c.globalAlpha=a*.45;c.translate(e.x,e.y);c.rotate(e.angle+Math.PI/2);
      c.strokeStyle=e.color;c.lineWidth=1;
      N.Ships.path(c,e.shipType);c.stroke();
      c.restore();
    }
  }
  // particles
  c.save();c.globalCompositeOperation='lighter';
  for(const p of G.particles){
    if(!cull(p.x,p.y,30))continue;
    const a=Math.max(0,p.life/Math.max(.001,p.maxLife));
    c.globalAlpha=a;
    if(p.glow&&p.size>1.5){glow(c,p.x,p.y,p.size*3.2,p.color,a*.16);}
    c.fillStyle=p.color;
    if(p.kind==='line'){
      c.strokeStyle=p.color;c.lineWidth=Math.max(1,p.size*.5);
      c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);c.stroke();
    }else{
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);
      c.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      c.restore();
    }
  }
  c.restore();
  // damage text
  for(const t of G.texts){
    if(!cull(t.x,t.y,40))continue;
    const a=Math.min(1,t.life/Math.max(.001,t.maxLife)*1.7);
    c.save();c.globalAlpha=a;c.font='700 '+t.size+'px '+FONT_D;c.textAlign='center';c.textBaseline='middle';
    c.lineWidth=2.5;c.strokeStyle='rgba(0,0,0,.7)';c.strokeText(t.text,t.x,t.y);
    c.fillStyle=t.color;c.fillText(t.text,t.x,t.y);
    c.restore();
  }
}
function drawStrikes(c){
  for(const s of G.strikes)drawStrike(c,s);
}
function drawGround(c){
  for(const it of G.groundItems)drawLoot(c,it,G.level.theme);
}
function drawMines(c){for(const m of G.mines)drawMine(c,m);}

// ——— HUD ———
function drawHUD(c,theme){
  if(!G.player||!G.level)return;
  const p=G.player;
  const u=clamp(G.w/1400,.72,1.12);
  const compact=G.w<760;
  // top-left vitals
  const px=14*u,py=14*u,pw=compact?G.w*.54:300*u,ph=compact?80*u:90*u;
  panel(c,px,py,pw,ph,'rgba(2,8,14,.72)',N.withAlpha(theme.a,.3),8*u);
  txt(c,'BIOMETRIC LINK',px+12*u,py+14*u,8*u,N.withAlpha(theme.a,.65),'left',FONT_M);
  txt(c,'LV '+p.level,px+pw-12*u,py+14*u,10*u,'#fff','right',FONT_D,800);
  // HP
  const hpFrac=clamp(p.hp/p.stats.maxHp,0,1);
  const hx=px+12*u,hy=py+27*u,hw=pw-24*u,hh=8*u;
  c.fillStyle='rgba(255,255,255,.06)';c.fillRect(hx,hy,hw,hh);
  const hpCol=hpFrac<.25?'#ff335c':hpFrac<.5?'#ffb31f':'#b6ff2b';
  c.fillStyle=hpCol;c.fillRect(hx,hy,hw*hpFrac,hh);
  for(let i=1;i<10;i++){c.fillStyle='rgba(0,0,0,.45)';c.fillRect(hx+hw*i/10,hy,1,hh);}
  c.strokeStyle=N.withAlpha(hpCol,.45);c.lineWidth=1;c.strokeRect(hx,hy,hw,hh);
  txt(c,Math.ceil(p.hp)+' / '+Math.round(p.stats.maxHp),hx+4*u,hy+hh/2,7*u,'rgba(0,0,0,.75)','left',FONT_M,700);
  // shield
  const shFrac=p.stats.maxShield>0?clamp(p.shield/p.stats.maxShield,0,1):0;
  const shy=hy+hh+4*u;
  c.fillStyle='rgba(255,255,255,.045)';c.fillRect(hx,shy,hw,4*u);
  c.fillStyle='#00f0ff';c.fillRect(hx,shy,hw*shFrac,4*u);
  txt(c,'SHIELD',hx,shy+2*u,5.5*u,N.withAlpha('#00f0ff',.55),'left',FONT_M);
  txt(c,Math.ceil(p.shield)+'/'+Math.round(p.stats.maxShield),hx+hw,shy+2*u,5.5*u,N.withAlpha('#00f0ff',.7),'right',FONT_M);
  // XP
  const xpy=shy+10*u;
  c.fillStyle='rgba(255,255,255,.04)';c.fillRect(hx,xpy,hw,3*u);
  c.fillStyle=N.withAlpha(theme.b,.8);c.fillRect(hx,xpy,hw*clamp(p.xp/p.xpNext,0,1),3*u);
  // top-center timer
  const tw=compact?G.w*.36:190*u;
  const tx=compact?G.w-px-tw: G.w/2-tw/2;
  const ty=py,th=compact?80*u:90*u;
  panel(c,tx,ty,tw,th,'rgba(2,8,14,.72)',N.withAlpha(theme.a,.3),8*u);
  const timeLeft=Math.max(0,DURATION-G.level.elapsed);
  txt(c,'SECTOR '+String(G.run.level).padStart(2,'0'),tx+tw/2,ty+13*u,8*u,N.withAlpha(theme.a,.65),'center',FONT_M);
  txt(c,N.formatTime(timeLeft,false),tx+tw/2,ty+35*u,compact?22*u:26*u,timeLeft<30?'#ff335c':timeLeft<60?'#ffb31f':'#fff','center',FONT_D,900);
  txt(c,'ANCHORS '+G.level.anchors.filter(a=>a.alive).length+' / '+G.level.anchors.length,tx+tw/2,ty+57*u,7*u,N.withAlpha(theme.b,.75),'center',FONT_M);
  // pips
  const pips=G.level.anchors.length;
  const gap=8*u;const start=tx+tw/2-(pips-1)*gap/2;
  for(let i=0;i<pips;i++){
    const a=G.level.anchors[i];
    c.save();c.translate(start+i*gap,ty+70*u);c.rotate(Math.PI/4);
    c.fillStyle=a.alive?theme.a:N.withAlpha(theme.a,.12);c.fillRect(-2*u,-2*u,4*u,4*u);
    c.restore();
  }
  // minimap
  if(!compact){
    const mw=Math.min(175,140*u),mh=mw*.68,mx=G.w-14*u-mw,my=py;
    panel(c,mx,my,mw,mh+18*u,'rgba(2,8,14,.72)',N.withAlpha(theme.a,.3),8*u);
    txt(c,'SECTOR SCAN',mx+8*u,my+10*u,7*u,N.withAlpha(theme.a,.55),'left',FONT_M);
    const ix=mx+7*u,iy=my+19*u,iw=mw-14*u,ih=mh-10*u;
    c.fillStyle='rgba(0,240,255,.025)';c.fillRect(ix,iy,iw,ih);
    c.strokeStyle=N.withAlpha(theme.a,.2);c.strokeRect(ix,iy,iw,ih);
    const sx=iw/G.level.width,sy=ih/G.level.height;
    for(const a of G.level.anchors){if(!a.alive)continue;c.fillStyle=theme.a;c.fillRect(ix+a.x*sx-1.5,iy+a.y*sy-1.5,3,3);}
    for(const e of G.enemies){if(e.dead)continue;c.fillStyle=e.elite?'#ffb31f':'rgba(255,51,92,.42)';c.fillRect(ix+e.x*sx-.8,iy+e.y*sy-.8,e.elite?2.5:1.4,e.elite?2.5:1.4);}
    const pxp=ix+p.x*sx,pyp=iy+p.y*sy;
    c.save();c.translate(pxp,pyp);c.rotate(p.aim+Math.PI/2);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-4);c.lineTo(3,4);c.lineTo(-3,4);c.closePath();c.fill();c.restore();
    if(G.level.activeBoss&&!G.level.activeBoss.dead){const e=G.level.activeBoss;c.strokeStyle='#ff335c';c.lineWidth=1;c.beginPath();c.arc(ix+e.x*sx,iy+e.y*sy,4,0,TAU);c.stroke();}
  }
  // boss bar
  const boss=G.level.activeBoss&&!G.level.activeBoss.dead?G.level.activeBoss:null;
  if(boss){
    const bw=Math.min(520,G.w-40),bx=G.w/2-bw/2,by=compact?110*u:118*u,bh=11*u;
    panel(c,bx-8*u,by-18*u,bw+16*u,bh+26*u,'rgba(16,2,7,.76)',N.withAlpha('#ff335c',.55),7*u);
    txt(c,boss.name+' // '+(boss.boss?'OVERSEER':boss.elite?'ELITE':'HOSTILE'),bx,by-7*u,8*u,'#ff8da4','left',FONT_M);
    c.fillStyle='rgba(255,255,255,.06)';c.fillRect(bx,by,bw,bh);
    const frac=clamp(boss.hp/boss.maxHp,0,1);
    const grad=c.createLinearGradient(bx,0,bx+bw,0);grad.addColorStop(0,'#ff335c');grad.addColorStop(1,'#ffb31f');
    c.fillStyle=grad;c.fillRect(bx,by,bw*frac,bh);
    c.strokeStyle='rgba(255,51,92,.45)';c.strokeRect(bx,by,bw,bh);
    txt(c,Math.ceil(frac*100)+'%',bx+bw,by+bh/2,7*u,'#fff','right',FONT_M,700);
  }
  // bottom-left weapon card
  const active=p.weapons[p.activeWeapon];
  if(active){
    const def=N.WEAPON_BY_ID[active.id];
    const cw=compact?Math.min(G.w*.8,280*u):300*u,chh=compact?62*u:70*u;
    const bx=14*u,by=G.h-14*u-chh;
    panel(c,bx,by,cw,chh,'rgba(2,8,14,.76)',N.withAlpha(def.color,.4),8*u);
    const icon=N.Assets.weaponIcon(active.id,def.color);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.65;glow(c,bx+31*u,by+chh*.44,30*u,def.color,.25);c.restore();
    c.drawImage(icon,bx+12*u,by+9*u,42*u,42*u);
    txt(c,def.name,bx+62*u,by+17*u,11*u,'#fff','left',FONT_D,800);
    txt(c,def.tag,bx+62*u,by+30*u,7*u,N.withAlpha(def.color,.75),'left',FONT_M);
    txt(c,'TIER '+['I','II','III'][active.tier-1]+'  //  LV '+active.level,bx+62*u,by+42*u,6.5*u,N.withAlpha('#7394a8',.95),'left',FONT_M);
    const cdFrac=active.cooldown>0?clamp(1-active.cooldown/((def.base.cooldown||.5)/Math.max(.2,p.stats.rateMul*(1+(active.level-1)*.06))),0,1):1;
    c.fillStyle='rgba(255,255,255,.05)';c.fillRect(bx+12*u,by+chh-8*u,cw-24*u,3*u);
    c.fillStyle=def.color;c.fillRect(bx+12*u,by+chh-8*u,(cw-24*u)*cdFrac,3*u);
    // weapon bays
    const n=p.weapons.length;
    for(let i=0;i<n;i++){
      const wx=bx+cw-20*u-(n-1-i)*18*u,wy=by+chh-19*u;
      const wd=N.WEAPON_BY_ID[p.weapons[i].id];
      c.save();c.globalAlpha=i===p.activeWeapon?1:.32;
      c.drawImage(N.Assets.weaponIcon(p.weapons[i].id,wd.color),wx-8*u,wy-8*u,16*u,16*u);
      c.restore();
    }
    // dash pips
    const dx=bx+12*u,dy=by+chh+10*u;
    txt(c,'DASH',dx,dy,6.5*u,N.withAlpha('#7394a8',.9),'left',FONT_M);
    for(let i=0;i<p.maxDashCharges;i++){
      c.save();c.translate(dx+34*u+i*10*u,dy);c.rotate(Math.PI/4);
      c.fillStyle=i<p.dashCharges?theme.a:N.withAlpha(theme.a,.15);
      c.fillRect(-2.5*u,-2.5*u,5*u,5*u);c.restore();
    }
    if(p.dashCharges<p.maxDashCharges){
      c.fillStyle=N.withAlpha(theme.a,.2);c.fillRect(dx+34*u,dy+6*u,(p.maxDashCharges*10-2)*u,1.5*u);
      c.fillStyle=theme.a;c.fillRect(dx+34*u,dy+6*u,(p.maxDashCharges*10-2)*u*(1-p.dashTimer/p.stats.dashRecharge),1.5*u);
    }
  }
  // bottom-right buffs + hint
  let by=G.h-14*u;
  const buffs=[];
  if(p.buffs.overclock>0)buffs.push(['OVERCLOCK '+Math.ceil(p.buffs.overclock)+'s','#ff2bd6']);
  if(p.buffs.speed>0)buffs.push(['SERVO '+Math.ceil(p.buffs.speed)+'s','#b6ff2b']);
  if(p.buffs.magnet>0)buffs.push(['MAGNET '+Math.ceil(p.buffs.magnet)+'s','#9d5cff']);
  for(let i=buffs.length-1;i>=0;i--){
    const [label,col]=buffs[i];
    const bw=112*u,bh=18*u,bx=G.w-14*u-bw,byy=by-bh;
    panel(c,bx,byy,bw,bh,'rgba(2,8,14,.7)',N.withAlpha(col,.4),4*u);
    txt(c,label,bx+8*u,byy+bh/2,7*u,col,'left',FONT_M);
    by-=bh+4*u;
  }
  if(!compact){
    txt(c,'Q / E  WEAPON     SPACE  DASH     ESC  PAUSE',G.w-14*u,by-8*u,7*u,N.withAlpha('#7394a8',.72),'right',FONT_M);
    txt(c,'LMB / '+N.keyLabel(G.settings.keyboard.fire)+'  '+(G.settings.firingMode==='toggle'?'TOGGLE FIRE':'HOLD TO FIRE'),G.w-14*u,by-20*u,7*u,N.withAlpha('#7394a8',.55),'right',FONT_M);
  }
  if(G.settings.firingMode==='toggle')txt(c,'AUTO FIRE: '+(N.Firing.toggled()?'ON':'OFF'),G.w/2,G.h-84*u,10*u,N.Firing.toggled()?'#b6ff2b':'#7394a8','center',FONT_D,700);
  // early help
  if(G.level.elapsed<12){
    const a=clamp(1-G.level.elapsed/12,0,1);
    txt(c,(G.settings.firingMode==='toggle'?'PRESS LMB TO TOGGLE FIRE':'HOLD LMB TO FIRE')+'  ·  DESTROY ANCHORS OR SURVIVE',G.w/2,G.h-112*u,8*u,N.withAlpha(theme.a,.8*a),'center',FONT_M);
  }
  if(G.settings.graphics.showFps){
    txt(c,Math.round(G.fps)+' FPS  //  '+G.enemies.length+' HOSTILES  //  '+G.playerBullets.length+' SHOTS',G.w-14*u,22*u,7*u,N.withAlpha('#7394a8',.75),'right',FONT_M);
  }
}
function drawAim(c){
  const p=G.player;if(!p)return;
  const active=p.weapons[p.activeWeapon];
  const color=active?(N.WEAPON_BY_ID[active.id]?.color||'#00f0ff'):'#00f0ff';
  const point=G.aimPoint||{x:p.x+Math.cos(G.aim.angle)*280,y:p.y+Math.sin(G.aim.angle)*280};
  const {x:sx,y:sy}=G.worldToScreen(point.x,point.y);
  if(sx<0||sy<0||sx>G.w||sy>G.h)return;
  const pulse=G.aim.fire?1+Math.sin(G.time*18)*.12:1;
  c.save();c.translate(sx,sy);c.rotate(G.time*.8);c.globalCompositeOperation='lighter';
  c.strokeStyle=color;c.lineWidth=1.4;
  const r=12*pulse;
  for(let i=0;i<4;i++){
    c.beginPath();c.arc(0,0,r+.5,i*Math.PI/2+.18,i*Math.PI/2+.18+Math.PI/2-.36);c.stroke();
  }
  c.globalAlpha=.7;c.beginPath();c.arc(0,0,r*.48,0,TAU);c.stroke();
  c.globalAlpha=1;c.fillStyle=G.aim.fire?'#fff':color;c.beginPath();c.arc(0,0,1.8,0,TAU);c.fill();
  c.strokeStyle=N.withAlpha(color,.65);c.lineWidth=1;
  c.beginPath();c.moveTo(-r-6,0);c.lineTo(-r-2,0);c.moveTo(r+2,0);c.lineTo(r+6,0);c.moveTo(0,-r-6);c.lineTo(0,-r-2);c.moveTo(0,r+2);c.lineTo(0,r+6);c.stroke();
  c.restore();
  // aim line
  const {x:pxs,y:pys}=G.worldToScreen(p.x,p.y);
  c.save();c.globalAlpha=.12;c.strokeStyle=color;c.lineWidth=1;c.setLineDash([2,8]);
  c.beginPath();c.moveTo(pxs,pys);c.lineTo(sx,sy);c.stroke();c.setLineDash([]);c.restore();
}
function drawGlitch(c){
  if(!G.settings.graphics.glitch||G.settings.accessibility?.reducedFlash||!G.glitch)return;
  const amount=Math.min(1,G.glitch);
  c.save();c.setTransform(1,0,0,1,0,0);
  const W=G.canvas.width,H=G.canvas.height,dpr=G.dpr;
  const slices=Math.round(2+amount*6);
  for(let i=0;i<slices;i++){
    const sy=Math.random()*H;
    const sh=Math.max(4,Math.random()*H*.055);
    const dx=(Math.random()-.5)*amount*34*dpr;
    try{c.drawImage(G.canvas,0,sy,W,Math.min(sh,H-sy),dx,sy,W,Math.min(sh,H-sy));}catch(e){}
  }
  c.globalCompositeOperation='screen';
  c.fillStyle=`rgba(0,240,255,${.035*amount})`;c.fillRect(0,Math.random()*H,W,2*dpr);
  c.fillStyle=`rgba(255,43,214,${.035*amount})`;c.fillRect(0,Math.random()*H,W,2*dpr);
  for(let i=0;i<3;i++){
    c.fillStyle=i%2?`rgba(255,43,214,${.018*amount})`:`rgba(0,240,255,${.018*amount})`;
    c.fillRect(0,Math.random()*H,W,Math.max(2,Math.random()*20*dpr));
  }
  c.restore();
}

// ——— main render ———
G.render=function(dt){
  const c=G.ctx;if(!c)return;
  const theme=G.level?G.level.theme:N.THEMES[0];
  c.setTransform(G.dpr,0,0,G.dpr,0,0);
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
  c.clearRect(0,0,G.w,G.h);
  if(G.mode==='menu'||G.mode==='boot'||!G.level||!G.player){
    G.renderAttract(c,dt);
    return;
  }
  drawBackground(c,theme);
  const sx=G.camera.sx||0,sy=G.camera.sy||0;
  c.save();
  c.translate(G.w/2+sx,G.h/2+sy);
  c.scale(G.zoom,G.zoom);
  c.translate(-G.camera.x,-G.camera.y);
  drawWorld(c,theme,dt);
  drawGround(c);
  drawMines(c);
  drawStrikes(c);
  for(const a of G.level.anchors)if(a.alive&&cull(a.x,a.y,140))drawAnchor(c,a,theme);
  for(const ch of G.level.caches)if(ch.alive&&cull(ch.x,ch.y,80))drawCache(c,ch,theme);
  for(const e of G.enemies)drawEnemy(c,e,theme);
  drawPlayer(c,G.player,theme);
  drawOrbitals(c);
  drawBullets(c);
  drawEnemyBullets(c);
  drawEffects(c,theme);
  c.restore();
  if(G.mode==='playing'||G.mode==='paused'||G.mode==='inventory'||G.mode==='levelup'||G.mode==='overflow'){
    drawHUD(c,theme);
    drawAim(c);
  }
  drawGlitch(c);
  if(G.mode==='playing'&&G.level.elapsed<3){
    const a=1-G.level.elapsed/3;
    c.save();c.globalAlpha=a*.35;c.fillStyle=theme.a;c.fillRect(0,0,G.w,2);c.restore();
  }
};
G.renderGame=G.render;
})();
