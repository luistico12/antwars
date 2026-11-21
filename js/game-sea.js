/* ===== Weltkarte: Verteidigungswälle, Häfen, Wege, Flöße und Seeangriff ===== */
const WALL_R=70,WALL_MAX=3,WALL_COST={mat:50,food:25},PORT_COST={mat:60,food:30},RAFT_COST={mat:25,food:10};
const ROAD_LAND=1,ROAD_SEA=2,ROAD_ACTIVE=6;
/* placing: aktueller Platzier-Modus {kind:'wall'|'road'|'land'} */
let seaN=0,placing=null,rd=new Map(),roadDirty=true,roadCanvas=null,roadNet=null,tradeW=0,paintingRoad=null;
const mapEl=document.getElementById('mv');
const cellOf=(x,y)=>{const cx=Math.floor(x/CS),cy=Math.floor(y/CS);return(cx<0||cy<0||cx>=GW||cy>=GH)?-1:cy*GW+cx};
const cellPos=i=>[(i%GW)*CS+CS/2,((i/GW)|0)*CS+CS/2];

/* Beim Kartenwechsel: Grenzpunkte zwischen Gebieten und Küstenzellen vorberechnen */
function seaReset(){
  seaN=0;rd=new Map();roadDirty=true;roadNet=null;tradeW=0;placing=null;paintingRoad=null;roadCanvas=null;
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
  return 1+0.5*Math.min(WALL_MAX,n);
}
function startWall(t){
  if(t.walls.length>=WALL_MAX)return toast('In diesem Gebiet stehen schon 3 Wälle','bad');
  placing={kind:'wall',tid:t.id};
  toast(`Verteidigungswall: Klicke eine Stelle in ${t.name}. Er verstärkt die Grenzen im Umkreis. Esc bricht ab`,'good');
}
function placeWall(x,y){
  const i=cellOf(x,y);if(i<0||M.tid[i]<0)return false;
  const t=T[placing.tid];
  if(M.tid[i]!==t.id){toast(`Der Wall muss in ${t.name} stehen`,'bad');return false}
  if(t.walls.length>=WALL_MAX){toast('In diesem Gebiet stehen schon 3 Wälle','bad');placing=null;return true}
  if(!payCost(WALL_COST))return false;
  t.walls.push({x,y});placing=null;fxs.push({k:'ripple',x,y,t:0,dur:1,c:[200,205,215]});
  toast(`Verteidigungswall in ${t.name} gebaut (${costLbl(WALL_COST)})`,'good');return true;
}

/* ----- Hafen und Flöße ----- */
function buildPort(t,wx,wy){
  if(t.owner!==0||t.puppet)return;
  if(t.port)return toast('Hier gibt es schon einen Hafen','bad');
  if(!t.coast||!t.coast.length)return toast(`${t.name} hat keine Küste. Häfen brauchen Wasser`,'bad');
  if(!payCost(PORT_COST))return;
  const tx=wx!=null?wx:t.lx*CS,ty=wy!=null?wy:t.ly*CS;
  let best=t.coast[0],bd=1e9;
  for(const i of t.coast){const[cx,cy]=cellPos(i),d=Math.hypot(cx-tx,cy-ty);if(d<bd){bd=d;best=i}}
  t.port={idx:best,rafts:0,max:3};rd.set(best,{p:1,w:false,port:true});
  /* Straße vom Hafen zur Stadt */
  const[px,py]=cellPos(best);let x0=best%GW,y0=(best/GW)|0;const x1=t.lx,y1=t.ly;
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let er=dx+dy;
  for(let n=0;n<200;n++){const i=y0*GW+x0;if(M.tid[i]===t.id&&!rd.has(i))rd.set(i,{p:1,w:false});if(x0===x1&&y0===y1)break;
    const e2=2*er;if(e2>=dy){er+=dy;x0+=sx}if(e2<=dx){er+=dx;y0+=sy}}
  roadsChanged();fxs.push({k:'ripple',x:px,y:py,t:0,dur:1.2,c:[110,180,255]});
  toast(`Hafen in ${t.name} gebaut. Jetzt kannst du Flöße bauen`,'good');
}
function buildRaft(t){
  if(!t.port)return;
  if(t.port.rafts>=t.port.max)return toast('Alle Flöße dieses Hafens sind gebaut','bad');
  if(!payCost(RAFT_COST))return;
  t.port.rafts++;const[px,py]=cellPos(t.port.idx);fxs.push({k:'ripple',x:px,y:py,t:0,dur:1,c:[110,180,255]});
  toast(`Floß gebaut (${t.port.rafts}/${t.port.max})`,'good');
}
const raftTotals=()=>{let a=0,m=0;for(const t of T)if(t.owner===0&&!t.puppet&&t.port){a+=t.port.rafts;m+=t.port.max}return[a,m]};
const seaSource=()=>T.filter(t=>t.owner===0&&!t.puppet&&t.port&&t.port.rafts>0&&Math.floor(t.troops)>=2).sort((a,b)=>b.troops-a.troops)[0]||null;

/* Landepunkt: nächste Küstenzelle des Zielgebiets, nahe genug am Mauszeiger */
function landingCell(t,x,y){
  let best=-1,bd=1e9;
  for(const i of t.coast){const[cx,cy]=cellPos(i),d=Math.hypot(cx-x,cy-y);if(d<bd){bd=d;best=i}}
  return bd<=CS*9?best:-1;
}
function startLanding(t,src){
  placing={kind:'land',tid:t.id,src:src.id,mw:null};
  toast(`Klicke auf die Küste von ${t.name}, wo das Floß landen soll. Esc bricht ab`,'good');
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
  if(!src.port||src.port.rafts<1)return false;
  if(t.owner!==0&&!isFriend(0,t.owner)&&protLeft()>0){toast(`Schutzzeit: noch ${mmss(protLeft())}. Bis dahin kann niemand angreifen`,'bad');return false}
  const path=waterPath(src.port.idx,cell);if(!path){toast('Kein Seeweg: dorthin kommt das Floß nicht, das Wasser ist nicht verbunden','bad');return false}
  src.port.rafts--;src.troops-=n;
  const a=path[0],b=path[path.length-1],d=pathLen(path)/CS;
  marches.push({from:src,to:t,n,f:0,t:0,dur:(3+d*0.22)/pwMul('speed'),phase:'walk',ft:0,fdur:2.4,seed:(Math.random()*1e6)|0,sea:true,a,b,path,land:{x:b[0],y:b[1]},home:src});
  if(t.owner>0&&!isFriend(0,t.owner)){F[t.owner].hurt=gtime;addHeat(t.owner)}
  toast(`${n} Soldaten stechen per Floß nach ${t.name} in See`,'good');return true;
}
/* Klick auf die Karte im Platziermodus. true = Klick verbraucht */
function seaClick(e){
  if(!placing)return false;
  const[x,y]=mapWorld(e);
  if(placing.kind==='wall'){placeWall(x,y);return true}
  if(placing.kind==='land'){
    const t=T[placing.tid],src=T[placing.src];
    const cell=landingCell(t,x,y);if(cell<0){toast(`Wähle einen Punkt an der Küste von ${t.name}`,'bad');return true}
    const n=Math.floor((Math.floor(src.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für die Überfahrt','bad');placing=null;return true}
    launchSea(src,t,n,cell);placing=null;return true;
  }
  return true;
}

/* ----- Wege: wie Tunnel gebaut, auch im Wasser (als Floßweg) ----- */
function ownLand(i){const tt=M.tid[i];if(tt<0)return false;const t=T[tt];return t.owner===0&&!t.puppet}
function nearOwn(i){
  const x=i%GW,y=(i/GW)|0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(ownLand(j)||rd.has(j))return true}
  return false;
}
/* 0 = nicht möglich, 1 = Landweg, 2 = Wasserweg */
function roadKind(i){if(i<0||rd.has(i))return 0;if(M.land[i])return ownLand(i)?1:0;return nearOwn(i)?2:0}
function startRoad(){
  placing={kind:'road'};
  toast('Weg: Linksklick halten und über dein Gebiet (oder ins Wasser) ziehen. Verbinde Städte und Häfen. Esc oder Rechtsklick beendet','good');
}
const seaSource2=()=>T.find(t=>t.owner===0&&!t.puppet&&t.port&&t.port.rafts>0)||null;
function paintRoadAt(x,y){
  const st=paintingRoad,i=cellOf(x,y);if(!st||i<0||st.last===i)return;st.last=i;
  const k=roadKind(i);if(!k){if(!rd.has(i))st.bad++;return}
  const c=k===2?ROAD_SEA:ROAD_LAND;if(G.mat<c){st.low++;return}
  if(k===2&&seaN%8===0){const h=seaSource2();if(!h){st.noRaft=true;return}h.port.rafts--}
  if(k===2)seaN++;
  G.mat-=c;rd.set(i,{p:0,w:k===2});st.n++;roadDirty=true;
}
function paintRoadLine(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.ceil(d/4));
  for(let s=1;s<=n;s++)paintRoadAt(x0+(x1-x0)*s/n,y0+(y1-y0)*s/n);
}
function endRoad(){
  const st=paintingRoad;paintingRoad=null;if(!st)return;
  if(st.n>0)toast(`Weg: ${st.n} Abschnitte werden gebaut`+(st.noRaft?'. Für mehr Wasserweg fehlen Flöße':''),'good');
  else if(st.noRaft)toast('Wasserwege brauchen Flöße (1 Floß je 8 Abschnitte). Baue Flöße in einem Hafen','bad');
  else if(st.low)toast('Zu wenig Material für den Weg','bad');
  else if(st.bad)toast('Dort geht kein Weg: nur auf eigenem Gebiet oder im Wasser neben deinem Gebiet','bad');
}
mapEl.addEventListener('pointerdown',e=>{
  if(e.button!==0||!placing)return;
  const[x,y]=mapWorld(e);
  if(placing.kind==='road'&&started){paintingRoad={n:0,bad:0,low:0,last:null,x,y};try{mapEl.setPointerCapture(e.pointerId)}catch(_){}paintRoadAt(x,y)}
});
mapEl.addEventListener('pointermove',e=>{
  if(!placing)return;
  const[x,y]=mapWorld(e);placing.mw=[x,y];
  if(paintingRoad){paintRoadLine(paintingRoad.x,paintingRoad.y,x,y);paintingRoad.x=x;paintingRoad.y=y}
});
mapEl.addEventListener('pointerup',e=>{if(e.button===0)endRoad()});
mapEl.addEventListener('pointercancel',endRoad);

function roadsChanged(){roadDirty=true;roadNet=null}
/* Zusammenhängende Wegnetze und Städte, die daran hängen */
function computeNet(){
  const comp=new Map(),sea=[];let id=0;
  for(const[i,c]of rd){
    if(c.p<1||comp.has(i))continue;id++;let hs=false;const st=[i];comp.set(i,id);
    while(st.length){const k=st.pop();if(rd.get(k).w)hs=true;const x=k%GW,y=(k/GW)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx,cj=rd.get(j);
        if(cj&&cj.p>=1&&!comp.has(j)){comp.set(j,id);st.push(j)}}}
    sea[id]=hs;
  }
  const cityComps=new Map();
  for(const t of T){
    if(t.owner!==0||t.puppet)continue;const s=new Set();
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=t.lx+dx,y=t.ly+dy;if(x<0||y<0||x>=GW||y>=GH)continue;const c=comp.get(y*GW+x);if(c)s.add(c)}
    if(s.size)cityComps.set(t.id,s);
  }
  let w=0;const ids=[...cityComps.keys()];
  for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
    for(const c of cityComps.get(ids[a]))if(cityComps.get(ids[b]).has(c)){w+=sea[c]?2:1;break}}
  roadNet={comp,cityComps,sea};tradeW=Math.min(w,12);
}
function roadLink(a,b){
  if(!roadNet)computeNet();
  const sa=roadNet.cityComps.get(a.id),sb=roadNet.cityComps.get(b.id);if(!sa||!sb)return false;
  for(const c of sa)if(sb.has(c))return true;return false;
}
function updateSea(dt){
  let act=0,done=false;
  for(const[,c]of rd){if(c.p>=1)continue;if(act>=ROAD_ACTIVE)break;act++;c.p+=dt/(c.w?3:2);if(c.p>=1){c.p=1;done=true}}
  if(done)roadsChanged();
  if(!roadNet)computeNet();
  if(tradeW>0&&G){G.food=Math.min(G.foodCap,G.food+0.04*tradeW*dt);G.mat=Math.min(G.matCap,G.mat+0.05*tradeW*dt)}
}

/* ----- Zeichnen ----- */
function renderRoads(){
  const c=makeCanvas(MW,MH),g=c.getContext('2d');
  for(const[i,e]of rd){
    if(e.p<1||e.port)continue;
    const x=(i%GW)*CS,y=((i/GW)|0)*CS,line=e.w?'#7a5230':'#8c6a38',fill=e.w?'#a67c4a':'#c9a064',conn=(dx,dy)=>{const n=rd.get(i+dy*GW+dx);return n&&n.p>=1};
    g.fillStyle=fill;g.fillRect(x+2,y+2,CS-4,CS-4);
    if(conn(1,0))g.fillRect(x+CS-2,y+2,4,CS-4);if(conn(0,1))g.fillRect(x+2,y+CS-2,CS-4,4);
    g.fillStyle=line;if(e.w){g.fillRect(x+2,y+4,CS-4,1);g.fillRect(x+2,y+7,CS-4,1)}else{g.fillRect(x+3,y+3,2,1);g.fillRect(x+6,y+6,2,1)}
  }
  return c;
}
function drawWall(g,x,y){
  g.fillStyle='#22242b';g.fillRect(x-10,y-5,20,11);g.fillStyle='#8c919c';g.fillRect(x-9,y-4,18,9);g.fillStyle='#b4b9c4';g.fillRect(x-9,y-4,18,2);
  g.fillStyle='#22242b';g.fillRect(x-10,y-9,20,4);g.fillStyle='#b4b9c4';for(let k=0;k<4;k++)g.fillRect(x-9+k*5,y-8,3,3);
}
function drawDock(g,t,now){
  const[x,y]=cellPos(t.port.idx);
  g.fillStyle='#22140a';g.fillRect(x-9,y-4,18,9);g.fillStyle='#8a5a30';g.fillRect(x-8,y-3,16,7);g.fillStyle='#a8764a';g.fillRect(x-8,y-3,16,2);
  g.fillStyle='#22140a';g.fillRect(x-1,y-14,2,11);g.fillStyle='#e6edf5';g.fillRect(x+1,y-14,8,6);
  const txt=`${t.port.rafts}/${t.port.max}`;g.font='700 11px '+PX;g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(txt).width+8;g.fillStyle='rgba(12,22,40,.9)';g.fillRect(x-w/2,y+8,w,13);g.strokeStyle='#4f78e0';g.lineWidth=1;g.strokeRect(x-w/2+.5,y+8.5,w-1,12);g.fillStyle='#fff';g.fillText(txt,x,y+15);
}
function drawSeaLayer(g,now){
  if(!started)return;
  if(roadDirty){roadCanvas=renderRoads();roadDirty=false}
  if(roadCanvas)g.drawImage(roadCanvas,0,0);
  for(const[i,e]of rd){
    if(e.p>=1)continue;const x=(i%GW)*CS,y=((i/GW)|0)*CS;
    g.globalAlpha=0.35+0.5*e.p;g.fillStyle=e.w?'#a67c4a':'#c9a064';g.fillRect(x+2,y+2,CS-4,CS-4);g.globalAlpha=1;
    g.strokeStyle='rgba(255,255,255,.55)';g.setLineDash([2,2]);g.strokeRect(x+2.5,y+2.5,CS-5,CS-5);g.setLineDash([]);
  }
  const showR=new Set();if(selT!=null)showR.add(selT);if(hovT!=null)showR.add(hovT);if(placing&&placing.kind==='wall')showR.add(placing.tid);
  for(const t of T){
    if(t.walls)for(const w of t.walls){
      if(showR.has(t.id)){g.fillStyle=`rgba(210,215,225,.10)`;g.beginPath();g.arc(w.x,w.y,WALL_R,0,6.283);g.fill();g.strokeStyle='rgba(220,225,235,.6)';g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.arc(w.x,w.y,WALL_R,0,6.283);g.stroke();g.setLineDash([])}
      drawWall(g,w.x,w.y);
    }
    if(t.port&&t.owner>=0)drawDock(g,t,now);
  }
}
function drawSeaMarch(g,m,now,ax,ay,bx,by,ux,uy,len,pal){
  const p=clamp(m.t/m.dur,0,1),pp=m.path||[[ax,ay],[bx,by]],[px0,py0,dx0,dy0]=pathAt(pp,pathLen(pp)*p),hx=px0,hy=py0+Math.sin(now/220)*1.5,c=F[m.f].rgb;ux=dx0;uy=dy0;
  g.setLineDash([5,5]);g.lineDashOffset=-now/50;g.strokeStyle='rgba(190,230,255,.85)';g.lineWidth=2;g.beginPath();pp.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke();g.setLineDash([]);
  if(!(cosmOf(m.f).ship&&drawShip(g,cosmOf(m.f).ship,hx,hy,rgb(c)))){
  g.fillStyle='#22140a';g.fillRect(hx-12,hy-3,24,9);g.fillStyle='#8a5a30';g.fillRect(hx-11,hy-2,22,7);g.fillStyle='#a8764a';g.fillRect(hx-11,hy-2,22,2);
  g.fillStyle='#22140a';g.fillRect(hx-1,hy-17,2,15);g.fillStyle=rgb(c);g.fillRect(hx+1,hy-17,9,7)}
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
  }else if(placing.kind==='road'&&mw){
    const i=cellOf(mw[0],mw[1]);if(i>=0){const k=roadKind(i),x=(i%GW)*CS,y=((i/GW)|0)*CS;
      g.strokeStyle=k?'#c8ffd0':'#ff6a5a';g.lineWidth=2;g.strokeRect(x+1,y+1,CS-2,CS-2);g.lineWidth=1}
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
