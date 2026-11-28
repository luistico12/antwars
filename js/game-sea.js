/* ===== Weltkarte: Verteidigungswälle, Häfen, Wege, Schiffe und Seeangriff ===== */
const WALL_R=70,OUT_R=34,WALL_COST={mat:50,food:25},PORT_COST={mat:60,food:30},RAFT_COST={mat:25,food:10},PORT_RAFTS=3;
/* Wälle, Außenposten und Häfen haben kein Limit je Gebiet mehr. */
/* placing: aktueller Platzier-Modus {kind:'wall'|'war'|'land'} */
let placing=null;
const mapEl=document.getElementById('mv');
const cellOf=(x,y)=>{const cx=Math.floor(x/CS),cy=Math.floor(y/CS);return(cx<0||cy<0||cx>=GW||cy>=GH)?-1:cy*GW+cx};
const cellPos=i=>[(i%GW)*CS+CS/2,((i/GW)|0)*CS+CS/2];

/* Beim Kartenwechsel: Grenzpunkte zwischen Gebieten und Küstenzellen vorberechnen */
function seaReset(){
  placing=null;if(typeof tradeReset==='function')tradeReset();
  if(!M)return;
  M.bp=new Map();
  const add=(a,b,x,y)=>{const k=a+'-'+b;let l=M.bp.get(k);if(!l){l=[];M.bp.set(k,l)}l.push([x*CS+CS/2,y*CS+CS/2])};
  for(const t of T)t.coast=[];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const i=y*GW+x,a=M.tid[i];if(a<0)continue;
    for(const[dx,dy]of[[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=GW||ny>=GH)continue;const b=M.tid[ny*GW+nx];
      if(b>=0&&b!==a){add(a,b,x,y);add(b,a,nx,ny)}}
    for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH||!M.land[ny*GW+nx]){T[a].coast.push(i);break}}
  }
}
function payCost(c){
  if(G.mat<c.mat){toast('Zu wenig Material','bad');return false}
  if(G.food<c.food){toast('Zu wenig Blätter','bad');return false}
  G.mat-=c.mat;G.food-=c.food;return true;
}
const costLbl=c=>`${c.mat} Erde, ${c.food} Blätter`;
const poorFor=c=>G.mat<c.mat||G.food<c.food;

/* ----- Verteidigungswall ----- */
function wallMul(t,fromId,pt){
  if(!t.walls||!t.walls.length)return 1;
  let n=0;
  for(const w of t.walls){
    let hit=false;
    if(pt)hit=Math.hypot(w.x-pt.x,w.y-pt.y)<=WALL_R;
    else if(fromId!=null&&M.bp){const pts=M.bp.get(t.id+'-'+fromId);hit=!!pts&&pts.some(q=>Math.hypot(w.x-q[0],w.y-q[1])<=WALL_R)}
    if(hit)n++;
  }
  return 1+0.5*Math.min(12,n);
}
function startWall(t){
  placing={kind:'wall',tid:t.id};
  toast(`Verteidigungswall: Klicke eine Stelle in ${t.name}. Er verstärkt die Grenzen im Umkreis. Esc bricht ab`,'good');
}
function placeWall(x,y){
  const i=cellOf(x,y);if(i<0||M.tid[i]<0)return false;
  const t=T[placing.tid];
  if(M.tid[i]!==t.id){toast(`Der Wall muss in ${t.name} stehen`,'bad');return false}
  if(!payCost(WALL_COST))return false;
  t.walls.push({x,y});qStat('built');placing=null;fxs.push({k:'ripple',x,y,t:0,dur:1,c:[200,205,215]});
  toast(`Verteidigungswall in ${t.name} gebaut (${costLbl(WALL_COST)})`,'good');return true;
}

/* ----- Außenposten: beliebig viele je Gebiet, frei platziert ----- */
function startOutpost(t){
  placing={kind:'out',tid:t.id};
  toast(`Außenposten ${t.str.out+1}: Klicke eine Stelle in ${t.name}. Esc bricht ab`,'good');
}
function placeOutpost(t,x,y){
  const i=cellOf(x,y);if(i<0||M.tid[i]<0)return false;
  if(M.tid[i]!==t.id){toast(`Der Außenposten muss in ${t.name} stehen`,'bad');return false}
  const c=outCost(t.str.out);
  if(!payCost(c))return false;
  t.outs=t.outs||[];t.outs.push({x,y});t.str.out=t.outs.length;t.outp=null;
  qStat('built');strDirty=true;roadsChanged();
  fxs.push({k:'ripple',x,y,t:0,dur:1,c:[240,200,110]});
  toast(`Außenposten in ${t.name} gebaut (${t.str.out}, ${costLbl(c)})`,'good');return true;
}
/* ----- Hafen: an der selbst gewählten Küste, beliebig viele je Gebiet ----- */
function startPort(t){
  if(!t.coast||!t.coast.length)return toast(`${t.name} hat keine Küste. Häfen brauchen Wasser`,'bad');
  placing={kind:'port',tid:t.id};
  toast(`Hafen: Klicke an die Küste von ${t.name}. Esc bricht ab`,'good');
}
function placePortAt(t,x,y){buildPort(t,x,y);placing=null;return true}

/* ----- Hafen und Schiffe ----- */
/* Häfen liegen in t.ports; t.port zeigt auf den ersten (ältere Stellen bleiben so gültig) */
const portsOf=t=>{if(!t.ports)t.ports=t.port?[t.port]:[];return t.ports};
const portWithRaft=t=>portsOf(t).find(p=>p.rafts>0)||null;
function buildPort(t,wx,wy){
  if(t.owner!==0)return;
  if(!t.coast||!t.coast.length)return toast(`${t.name} hat keine Küste. Häfen brauchen Wasser`,'bad');
  if(!payCost(PORT_COST))return;
  const tx=wx!=null?wx:t.lx*CS,ty=wy!=null?wy:t.ly*CS;
  let best=t.coast[0],bd=1e9;
  for(const i of t.coast){const[cx,cy]=cellPos(i),d=Math.hypot(cx-tx,cy-ty);if(d<bd){bd=d;best=i}}
  portsOf(t).push({idx:best,rafts:0,max:PORT_RAFTS});t.port=t.ports[0];qStat('built');const[px,py]=cellPos(best);
  roadsChanged();fxs.push({k:'ripple',x:px,y:py,t:0,dur:1.2,c:[110,180,255]});
  toast(`Hafen in ${t.name} gebaut (${t.ports.length}). Jetzt kannst du Schiffe bauen`,'good');
}
function buildRaft(t){
  const p=portsOf(t).find(x=>x.rafts<x.max);
  if(!p)return toast(portsOf(t).length?'Alle Schiffe deiner Häfen sind gebaut':'Hier gibt es keinen Hafen','bad');
  if(!payCost(RAFT_COST))return;
  p.rafts++;qStat('built');const[px,py]=cellPos(p.idx);fxs.push({k:'ripple',x:px,y:py,t:0,dur:1,c:[110,180,255]});
  toast(`Schiff gebaut (${portsOf(t).reduce((a,x)=>a+x.rafts,0)}/${portsOf(t).length*PORT_RAFTS})`,'good');
}
const raftTotals=()=>{let a=0,m=0;for(const t of T)if(t.owner===0)for(const p of portsOf(t)){a+=p.rafts;m+=p.max}return[a,m]};
const seaSource=()=>T.filter(t=>t.owner===0&&portWithRaft(t)&&Math.floor(t.troops)>=2).sort((a,b)=>b.troops-a.troops)[0]||null;

/* Landepunkt: nächste Küstenzelle des Zielgebiets, nahe genug am Mauszeiger */
function landingCell(t,x,y){
  let best=-1,bd=1e9;
  for(const i of t.coast){const[cx,cy]=cellPos(i),d=Math.hypot(cx-x,cy-y);if(d<bd){bd=d;best=i}}
  return bd<=CS*9?best:-1;
}
function startLanding(t,src){
  placing={kind:'land',tid:t.id,src:src.id,mw:null};
  toast(`Klicke auf die Küste von ${t.name}, wo das Schiff landen soll. Esc bricht ab`,'good');
}
/* Wasserweg (BFS über Wasserzellen, 8er-Nachbarschaft ohne Ecken über Land). Liefert Punkte von Hafen bis Landepunkt oder null */
function waterPath(fromIdx,toIdx){
  const water=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&!M.land[y*GW+x];
  const prev=new Int32Array(GW*GH).fill(-2),q=[],goal=new Set();
  const nbrs=i=>{const x=i%GW,y=(i/GW)|0,o=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(water(nx,ny))o.push(ny*GW+nx)}return o};
  for(const j of nbrs(toIdx))goal.add(j);
  for(const j of nbrs(fromIdx)){prev[j]=-1;q.push(j)}
  let end=-1;
  for(let h=0;h<q.length;h++){const i=q[h];if(goal.has(i)){end=i;break}
    const x=i%GW,y=(i/GW)|0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx,ny=y+dy;if(!water(nx,ny))continue;if(dx&&dy&&(!water(x+dx,y)||!water(x,y+dy)))continue;
      const j=ny*GW+nx;if(prev[j]===-2){prev[j]=i;q.push(j)}}}
  if(end<0)return null;
  const pts=[];for(let k=end;k>=0;k=prev[k])pts.push(cellPos(k));pts.reverse();
  return[cellPos(fromIdx),...pts,cellPos(toIdx)];
}
const pathLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return L};
function pathAt(p,d){
  for(let i=1;i<p.length;i++){const l=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(d<=l||i===p.length-1){const f=l?Math.min(1,d/l):1;return[p[i-1][0]+(p[i][0]-p[i-1][0])*f,p[i-1][1]+(p[i][1]-p[i-1][1])*f,(p[i][0]-p[i-1][0])/(l||1),(p[i][1]-p[i-1][1])/(l||1)]}d-=l}
  const e=p[p.length-1];return[e[0],e[1],1,0];
}
function launchSea(src,t,n,cell){
  const port=portWithRaft(src);if(!port)return false;
  if(t.owner!==0&&!isFriend(0,t.owner)&&protLeft()>0){toast(`Schutzzeit: noch ${mmss(protLeft())}. Bis dahin kann niemand angreifen`,'bad');return false}
  const path=waterPath(port.idx,cell);if(!path){toast('Kein Seeweg: dorthin kommt das Schiff nicht, das Wasser ist nicht verbunden','bad');return false}
  port.rafts--;src.troops-=n;
  const a=path[0],b=path[path.length-1],d=pathLen(path)/CS;
  marches.push({from:src,to:t,n,f:0,t:0,dur:(3+d*0.22)/pwMul('speed'),phase:'walk',ft:0,fdur:2.4,seed:(Math.random()*1e6)|0,sea:true,a,b,path,land:{x:b[0],y:b[1]},home:src});
  if(t.owner>0&&!isFriend(0,t.owner)){F[t.owner].hurt=gtime;addHeat(t.owner)}
  toast(`${n} Soldaten stechen per Schiff nach ${t.name} in See`,'good');return true;
}
/* Klick auf die Karte im Platziermodus. true = Klick verbraucht */
function seaClick(e){
  if(!placing)return false;
  const[x,y]=mapWorld(e);
  if(placing.kind==='wall'){placeWall(x,y);return true}
  if(placing.kind==='out'){const t=T[placing.tid];if(placeOutpost(t,x,y))placing=null;return true}
  if(placing.kind==='port'){const t=T[placing.tid];placePortAt(t,x,y);return true}
  if(placing.kind==='war'){placeWar(x,y);return true}
  if(placing.kind==='land'){
    const t=T[placing.tid],src=T[placing.src];
    const cell=landingCell(t,x,y);if(cell<0){toast(`Wähle einen Punkt an der Küste von ${t.name}`,'bad');return true}
    const n=Math.floor((Math.floor(src.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für die Überfahrt','bad');placing=null;return true}
    launchSea(src,t,n,cell);placing=null;return true;
  }
  return true;
}

/* ----- Wege entstehen automatisch (game-trade.js) ----- */
function ownLand(i){const tt=M.tid[i];if(tt<0)return false;const t=T[tt];return t.owner===0}
function updateSea(dt){
  if(!G)return;
  updateTrade(dt);
}

/* ----- Zeichnen ----- */
function drawWall(g,x,y,sk,pc){
  if(svDraw(g,'wall',sk||'default',pc||'#fff',x,y+8,0.8))return;
  g.fillStyle='#22242b';g.fillRect(x-10,y-5,20,11);g.fillStyle='#8c919c';g.fillRect(x-9,y-4,18,9);g.fillStyle='#b4b9c4';g.fillRect(x-9,y-4,18,2);
  g.fillStyle='#22242b';g.fillRect(x-10,y-9,20,4);g.fillStyle='#b4b9c4';for(let k=0;k<4;k++)g.fillRect(x-9+k*5,y-8,3,3);
}
function drawDock(g,t,now,port){
  port=port||t.port;const[x,y]=cellPos(port.idx),sk=cosmOf(t.owner).bskin||'default',pc=rgb(F[t.owner].rgb);
  if(!svDraw(g,'dock',sk,pc,x,y+9,0.85)){
    g.fillStyle='#22140a';g.fillRect(x-9,y-4,18,9);g.fillStyle='#8a5a30';g.fillRect(x-8,y-3,16,7);g.fillStyle='#a8764a';g.fillRect(x-8,y-3,16,2);
    g.fillStyle='#22140a';g.fillRect(x-1,y-14,2,11);g.fillStyle='#e6edf5';g.fillRect(x+1,y-14,8,6)}
  const txt=`${port.rafts}/${port.max}`;g.font='700 11px '+PX;g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(txt).width+8;g.fillStyle='rgba(12,22,40,.9)';g.fillRect(x-w/2,y+11,w,13);g.strokeStyle='#4f78e0';g.lineWidth=1;g.strokeRect(x-w/2+.5,y+11.5,w-1,12);g.fillStyle='#fff';g.fillText(txt,x,y+18);
}
/* Wälle, Außenposten, Häfen und Kriegsschiffe (liegen über den Wegen) */
function drawSeaLayer(g,now){
  if(!started)return;
  const showR=new Set();if(selT!=null)showR.add(selT);if(hovT!=null)showR.add(hovT);if(placing&&placing.kind==='wall')showR.add(placing.tid);
  for(const t of T){
    if(t.owner<0)continue;
    const sk=cosmOf(t.owner).bskin||'default',pc=rgb(F[t.owner].rgb);
    if(t.walls)for(const w of t.walls){
      if(showR.has(t.id)){g.fillStyle=`rgba(210,215,225,.10)`;g.beginPath();g.arc(w.x,w.y,WALL_R,0,6.283);g.fill();g.strokeStyle='rgba(220,225,235,.6)';g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.arc(w.x,w.y,WALL_R,0,6.283);g.stroke();g.setLineDash([])}
      drawWall(g,w.x,w.y,sk,pc);
    }
    if(t.str.out>0&&started){
      const list=(t.outs&&t.outs.length)?t.outs:[(()=>{const[ox,oy]=cellPos(outpostCell(t));return{x:ox,y:oy}})()];
      list.forEach((o,idx)=>{
        const ox=o.x,oy=o.y;
        if(!svDraw(g,'tower',sk,pc,ox,oy+8,0.72,t.str.out))drawTower(g,ox,oy,t.str.out,F[t.owner].rgb);
        if(showR.has(t.id)){g.font='700 10px '+PX;g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='rgba(20,12,4,.9)';const lb=`Außenposten ${idx+1}`;g.strokeText(lb,ox,oy+14);g.fillStyle='#fff';g.fillText(lb,ox,oy+14)}
      });
    }
    for(const p of portsOf(t))drawDock(g,t,now,p);
  }
  drawWarships(g,now);
}
function drawSeaMarch(g,m,now,ax,ay,bx,by,ux,uy,len,pal){
  const p=clamp(m.t/m.dur,0,1),pp=m.path||[[ax,ay],[bx,by]],[px0,py0,dx0,dy0]=pathAt(pp,pathLen(pp)*p),hx=px0,hy=py0+Math.sin(now/220)*1.5,c=F[m.f].rgb;ux=dx0;uy=dy0;
  g.setLineDash([5,5]);g.lineDashOffset=-now/50;g.strokeStyle='rgba(190,230,255,.85)';g.lineWidth=2;g.beginPath();pp.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke();g.setLineDash([]);
  if(!(cosmOf(m.f).ship&&drawShip(g,cosmOf(m.f).ship,hx,hy,rgb(c)))){
    if(!svDraw(g,'ship',cosmOf(m.f).bskin||'default',rgb(c),hx,hy+12,0.75,0)){g.fillStyle='#8a5a30';g.fillRect(hx-11,hy-2,22,7)}}
  const k=Math.min(3,Math.ceil(m.n/6));for(let i=0;i<k;i++)drawAnt(g,hx-7+i*7,hy-5,ux,uy,now/60+i,'w',F[m.f].species,null,0.42,pal);
  g.font='700 12px '+PX;g.textAlign='center';g.lineWidth=3;g.strokeStyle='rgba(20,12,4,.9)';g.strokeText(m.n,hx,hy-24);g.fillStyle='#fff';g.fillText(m.n,hx,hy-24);
}
function drawLandMarker(g,x,y,now){
  const p=0.5+0.5*Math.sin(now/260);
  g.lineWidth=3;g.strokeStyle=`rgba(235,60,50,${0.5+0.4*p})`;
  for(const r of[22,14,6]){g.beginPath();g.arc(x,y,r,0,6.283);g.stroke()}
  g.fillStyle='#e8332a';g.beginPath();g.arc(x,y,3.5,0,6.283);g.fill();
  g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.85)';g.beginPath();g.moveTo(x-28,y);g.lineTo(x-18,y);g.moveTo(x+18,y);g.lineTo(x+28,y);g.moveTo(x,y-28);g.lineTo(x,y-18);g.moveTo(x,y+18);g.lineTo(x,y+28);g.stroke();
}
function drawSeaTop(g,now){
  if(!placing||!started)return;
  const mw=placing.mw;
  if(placing.kind==='wall'&&mw){
    const t=T[placing.tid],ok=cellOf(mw[0],mw[1])>=0&&M.tid[cellOf(mw[0],mw[1])]===t.id;
    g.fillStyle=ok?'rgba(120,230,140,.14)':'rgba(235,70,60,.14)';g.beginPath();g.arc(mw[0],mw[1],WALL_R,0,6.283);g.fill();
    g.strokeStyle=ok?'rgba(150,240,170,.9)':'rgba(255,110,100,.9)';g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.arc(mw[0],mw[1],WALL_R,0,6.283);g.stroke();g.setLineDash([]);
    g.globalAlpha=0.8;drawWall(g,mw[0],mw[1]);g.globalAlpha=1;
  }else if(placing.kind==='out'&&mw){
    const t=T[placing.tid],ci=cellOf(mw[0],mw[1]),ok=ci>=0&&M.tid[ci]===t.id,full=false;
    g.strokeStyle=(ok&&!full)?'rgba(150,240,170,.9)':'rgba(255,110,100,.9)';g.setLineDash([4,4]);g.lineWidth=2;
    g.beginPath();g.arc(mw[0],mw[1],OUT_R,0,6.283);g.stroke();g.setLineDash([]);
    g.globalAlpha=.85;drawTower(g,mw[0],mw[1],t.str.out+1,F[0].rgb);g.globalAlpha=1;
  }else if(placing.kind==='port'&&mw){
    const t=T[placing.tid],cell=landingCell(t,mw[0],mw[1]),ok=cell>=0;
    g.fillStyle=ok?'rgba(120,210,255,.8)':'rgba(255,110,100,.8)';
    for(const i of(t.coast||[])){const[cx,cy]=cellPos(i);if(i===cell||!ok)g.fillRect(cx-1,cy-1,3,3)}
    if(ok){const[cx,cy]=cellPos(cell);g.strokeStyle='rgba(150,220,255,.95)';g.lineWidth=2;g.beginPath();g.arc(cx,cy,OUT_R,0,6.283);g.stroke();g.globalAlpha=.9;g.fillStyle='#8a5a30';g.fillRect(cx-9,cy-2,18,6);g.fillStyle='#d9d0b8';g.fillRect(cx-1,cy-14,2,12);g.globalAlpha=1}
  }else if(placing.kind==='war'&&mw){
    const t=T[placing.tid],[px,py]=cellPos(t.port.idx),ci=cellOf(mw[0],mw[1]),ok=ci>=0&&!M.land[ci]&&Math.hypot(mw[0]-px,mw[1]-py)<=WAR_PLACE;
    g.strokeStyle='rgba(150,200,255,.55)';g.setLineDash([6,5]);g.lineWidth=1.5;g.beginPath();g.arc(px,py,WAR_PLACE,0,6.283);g.stroke();g.setLineDash([]);
    g.strokeStyle=ok?'rgba(255,190,110,.8)':'rgba(255,110,100,.8)';g.beginPath();g.arc(mw[0],mw[1],WAR_RANGE,0,6.283);g.stroke();
    g.globalAlpha=.8;svDraw(g,'war','default',rgb(F[0].rgb),mw[0],mw[1]+10,0.62,0);g.globalAlpha=1;
  }else if(placing.kind==='land'){
    const t=T[placing.tid],src=T[placing.src];
    g.fillStyle='rgba(110,180,255,.75)';for(const i of t.coast){const[cx,cy]=cellPos(i);g.fillRect(cx-1,cy-1,3,3)}
    if(mw){const cell=landingCell(t,mw[0],mw[1]);
      if(cell>=0&&src.port){const[lx,ly]=cellPos(cell);
        if(placing.pc!==cell){placing.pc=cell;placing.pp=waterPath(src.port.idx,cell)}
        const pp=placing.pp;
        if(pp){g.setLineDash([5,5]);g.lineDashOffset=-now/50;g.strokeStyle='rgba(190,230,255,.7)';g.lineWidth=2;g.beginPath();pp.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke();g.setLineDash([]);drawLandMarker(g,lx,ly,now)}
        else{g.strokeStyle='#ff6a5a';g.lineWidth=3;g.beginPath();g.moveTo(lx-8,ly-8);g.lineTo(lx+8,ly+8);g.moveTo(lx+8,ly-8);g.lineTo(lx-8,ly+8);g.stroke()}}}
  }
}
seaReset();
