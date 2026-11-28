/* ===== Automatische Wege, kosmetische Händler, Kriegsschiffe und Seeüberfälle der Bots =====
   Wege entstehen von selbst: Stadt zu Stadt (benachbarte eigene Gebiete), Hafen zu Stadt und Außenposten zu Stadt.
   Auf jedem Weg läuft ein Ameisenhändler. Betritt er ein Gebäude, lässt er einen kleinen Teil Material da. */
const TRADE={mat:0.7,food:0.5,spd:38,stay:1.2};
const WAR_COST={mat:70,food:35},WAR_RANGE=90,WAR_MAX=2,WAR_PLACE=300;
let links=[],failedL=new Set(),traders=[],warships=[],syncT=0,roadCanvas=null,roadDirty=true,roadSig='',roadConn=new Map(),linkSig='';
function tradeReset(){links=[];failedL=new Set();traders=[];warships=[];syncT=0;roadCanvas=null;roadDirty=true;roadSig='';roadConn=new Map();linkSig=''}
const roadsChanged=()=>{roadDirty=true;syncT=0};
const myCosm=()=>(typeof COSM!=='undefined'?COSM:{});

/* ----- Orte ----- */
const cityPt=t=>[t.lx*CS+5,t.ly*CS+5+30];
const cityCell=t=>t.ly*GW+t.lx;
/* Außenposten stehen an der Grenze, in Richtung des nächsten Nachbarn, der nicht dir gehört */
function outpostCell(t){
  if(t.outs&&t.outs.length){const i=cellOf(t.outs[0].x,t.outs[0].y);if(i>=0&&M.tid[i]===t.id){t.outp=i;return i}}
  if(t.outp!=null&&M.tid[t.outp]===t.id)return t.outp;
  let tx=1,ty=0,bd=1e9;
  for(const j of t.adj){const u=T[j];if(u.owner===0)continue;const d=Math.hypot(u.cx-t.cx,u.cy-t.cy);if(d<bd){bd=d;tx=(u.cx-t.cx)/d;ty=(u.cy-t.cy)/d}}
  const px=t.lx+tx*Math.min(8,bd*0.35),py=t.ly+ty*Math.min(8,bd*0.35);
  let best=cityCell(t),b=1e9;
  for(const i of t.cells){if(!M.land[i])continue;const d=Math.hypot((i%GW)-px,((i/GW)|0)-py);if(d<b){b=d;best=i}}
  return t.outp=best;
}
const nodeCell=n=>n.kind==='port'?(n.port?n.port.idx:n.t.port.idx):n.kind==='out'?outpostCell(n.t):cityCell(n.t);
const nodePt=n=>n.kind==='city'?cityPt(n.t):(()=>{const[x,y]=cellPos(nodeCell(n));return[x,y+(n.kind==='out'?3:2)]})();

function wantLinks(){
  const L=[];
  for(const t of T){
    if(t.owner!==0)continue;
    if(typeof portsOf==='function')for(const p of portsOf(t))L.push({k:'p'+t.id+'-'+p.idx,a:{t,kind:'port',port:p},b:{t,kind:'city'}});
    if(t.str.out>0)L.push({k:'o'+t.id,a:{t,kind:'out'},b:{t,kind:'city'}});
    else t.outp=null;
    for(const j of t.adj){const u=T[j];if(u.id>t.id&&u.owner===0)L.push({k:`c${t.id}-${u.id}`,a:{t,kind:'city'},b:{t:u,kind:'city'}})}
  }
  return L;
}
/* Wegsuche über eigene Landzellen */
function landRoute(from,to){
  const ok=i=>M.land[i]&&M.tid[i]>=0&&T[M.tid[i]].owner===0;
  if(!ok(from)||!ok(to))return null;
  const prev=new Int32Array(GW*GH).fill(-2),q=[from];prev[from]=-1;
  for(let h=0;h<q.length;h++){
    const i=q[h];if(i===to)break;const x=i%GW,y=(i/GW)|0;
    for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(prev[j]!==-2||!ok(j))continue;prev[j]=i;q.push(j)}
  }
  if(prev[to]===-2)return null;
  const cells=[];for(let k=to;k>=0;k=prev[k])cells.push(k);cells.reverse();return cells;
}
function buildLink(w){
  const c=landRoute(nodeCell(w.a),nodeCell(w.b));if(!c)return null;
  /* Keine Glättung: der Weg läuft eckig über die Rasterzellen und trifft sich an Kreuzungen */
  const all=[nodePt(w.a),...c.map(cellPos),nodePt(w.b)];
  return{k:w.k,a:w.a,b:w.b,pts:all,L:pathLen(all),p:0,tr:false};
}
function syncRoads(){
  const want=wantLinks(),sig=want.map(w=>w.k).join(',');
  if(sig!==linkSig){linkSig=sig;failedL=new Set()}
  const keys=new Set(want.map(w=>w.k)),n0=links.length;
  links=links.filter(l=>keys.has(l.k));
  let made=0;
  for(const w of want){
    if(made>=4)break;if(failedL.has(w.k)||links.some(l=>l.k===w.k))continue;
    const l=buildLink(w);if(l){links.push(l);made++}else failedL.add(w.k);
  }
  if(made||links.length!==n0){roadDirty=true;roadConn=null}
}
function computeConn(){
  const par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x)}return x};
  for(const l of links){if(l.p<1||l.a.kind!=='city'||l.b.kind!=='city')continue;for(const id of[l.a.t.id,l.b.t.id])if(!par.has(id))par.set(id,id);par.set(f(l.a.t.id),f(l.b.t.id))}
  roadConn=new Map();for(const id of par.keys())roadConn.set(id,f(id));
}
function roadLink(a,b){
  if(!roadConn)computeConn();
  const x=roadConn.get(a.id);return x!==undefined&&x===roadConn.get(b.id);
}

/* ----- Händler und Bauzeit ----- */
function enterNode(tr,n){
  tr.dir*=-1;tr.in=TRADE.stay;
  if(!G||n.t.owner!==0)return;
  G.mat=Math.min(G.matCap,G.mat+TRADE.mat);G.food=Math.min(G.foodCap,G.food+TRADE.food);
  
}
function updateTrade(dt){
  syncT-=dt;if(syncT<=0){syncT=1;syncRoads()}
  let act=0,done=false;
  for(const l of links){if(l.p>=1)continue;if(act>=6)break;act++;l.p=Math.min(1,l.p+dt/(1.5+l.L/CS*0.12));if(l.p>=1)done=true}
  if(done){roadDirty=true;roadConn=null}
  for(const l of links)if(l.p>=1&&!l.tr){l.tr=true;traders.push({l,d:Math.random()*l.L,dir:Math.random()<0.5?1:-1,in:0})}
  traders=traders.filter(tr=>links.includes(tr.l));
  for(const tr of traders){
    if(tr.in>0){tr.in-=dt;continue}
    tr.d+=tr.dir*TRADE.spd*dt;
    if(tr.d>=tr.l.L){tr.d=tr.l.L;enterNode(tr,tr.l.b)}else if(tr.d<=0){tr.d=0;enterNode(tr,tr.l.a)}
  }
  updateWarships(dt);updateBotRaids(dt);
}
/* ----- Kriegsschiffe ----- */
const warsOf=t=>warships.filter(w=>w.home===t.id).length;
function buildWar(t){
  if(!t.port)return toast('Kriegsschiffe brauchen einen Hafen in diesem Gebiet','bad');
  if(warsOf(t)>=WAR_MAX)return toast(`Dieser Hafen hat schon ${WAR_MAX} Kriegsschiffe`,'bad');
  if(poorFor(WAR_COST))return toast(`Zu wenig Material (${costLbl(WAR_COST)} nötig)`,'bad');
  placing={kind:'war',tid:t.id};
  toast(`Kriegsschiff: Klicke aufs Wasser in der Nähe von ${t.name}. Es greift gegnerische Schiffe in Reichweite an. Esc bricht ab`,'good');
}
function placeWar(x,y){
  const t=T[placing.tid],i=cellOf(x,y);
  if(i<0||M.land[i])return toast('Ein Kriegsschiff braucht Wasser','bad'),false;
  const[px,py]=cellPos(t.port.idx);
  if(Math.hypot(x-px,y-py)>WAR_PLACE)return toast('Zu weit vom Hafen entfernt','bad'),false;
  if(!payCost(WAR_COST))return false;
  warships.push({x,y,home:t.id,owner:0,cd:1,seed:Math.random()*6});qStat('built');placing=null;
  fxs.push({k:'ripple',x,y,t:0,dur:1,c:[110,180,255]});toast(`Kriegsschiff bei ${t.name} stationiert (${costLbl(WAR_COST)})`,'good');return true;
}
function marchPos(m){const pp=m.path||[m.a,m.b],p=clamp(m.t/m.dur,0,1);return pathAt(pp,pathLen(pp)*p)}
function updateWarships(dt){
  warships=warships.filter(w=>T[w.home].owner===w.owner&&T[w.home].port);
  for(const w of warships){
    w.cd-=dt;if(w.cd>0)continue;
    for(const m of marches){
      if(!m.sea||m.phase!=='walk'||m.f===w.owner||isFriend(w.owner,m.f))continue;
      const[x,y]=marchPos(m);if(Math.hypot(x-w.x,y-w.y)>WAR_RANGE)continue;
      const dmg=Math.max(1,Math.ceil(m.n*0.35));m.n-=dmg;w.cd=2.2;
      fxs.push({k:'ripple',x,y,t:0,dur:.8,c:[255,190,110]});addFloat(x,y-26,'-'+dmg,'#ff8a70');
      if(m.n<=0){marches.splice(marches.indexOf(m),1);if(w.owner===0)qStat('sunk');toast('Dein Kriegsschiff hat ein gegnerisches Schiff versenkt','good')}
      break;
    }
  }
}
/* ----- Seeüberfälle der Bots (nur auf deine Küste, nach der Schutzzeit) ----- */
function updateBotRaids(dt){
  if(!G||protLeft()>0)return;
  for(const f of F){
    if(f.isPlayer||f.human||!f.alive||f.allied)continue;
    f.seaT=(f.seaT==null?70+Math.random()*80:f.seaT)-dt;if(f.seaT>0)continue;
    f.seaT=110+Math.random()*90;
    const srcs=T.filter(t=>t.owner===f.id&&t.coast.length&&t.troops>=22),tgts=T.filter(t=>t.owner===0&&t.coast.length&&!t.adj.some(j=>T[j].owner===f.id));
    if(!srcs.length||!tgts.length)continue;
    const src=srcs[Math.floor(Math.random()*srcs.length)],to=tgts[Math.floor(Math.random()*tgts.length)];
    const from=src.coast[Math.floor(Math.random()*src.coast.length)],cell=to.coast[Math.floor(Math.random()*to.coast.length)],path=waterPath(from,cell);
    if(!path)continue;
    const n=Math.floor(src.troops*0.45);src.troops-=n;
    const a=path[0],b=path[path.length-1],d=pathLen(path)/CS;
    marches.push({from:src,to,n,f:f.id,t:0,dur:3+d*0.22,phase:'walk',ft:0,fdur:2.4,seed:(Math.random()*1e6)|0,sea:true,a,b,path,land:{x:b[0],y:b[1]},home:null});
    toast(`${f.name} schickt ${n} Soldaten per Schiff nach ${to.name}`,'bad');if(typeof flashHit==='function')flashHit();
  }
}
/* Quellhafen für eine Überfahrt (nicht das Ziel selbst) */
const seaSourceFor=t=>T.filter(x=>x.owner===0&&x.id!==t.id&&portWithRaft(x)&&Math.floor(x.troops)>=2).sort((a,b)=>b.troops-a.troops)[0]||null;

/* ----- Zeichnen ----- */
function renderRoads(){
  const rs=Math.min(3,Math.max(1.5,RD)),c=makeCanvas(Math.round(MW*rs),Math.round(MH*rs)),g=c.getContext('2d');
  g.scale(rs,rs);const sk=skinOf('rskin',myCosm().rskin||'default'),pc=rgb(F[0].rgb);
  for(const l of links)if(l.p>=1)roadStroke(g,l.pts,sk,pc,1,1);
  return c;
}
function drawRoadLayer(g,now){
  if(!started||!F[0])return;
  const sk=skinOf('rskin',myCosm().rskin||'default'),pc=rgb(F[0].rgb),sig=(myCosm().rskin||'')+'|'+RD+'|'+links.filter(l=>l.p>=1).length;
  if(roadDirty||sig!==roadSig){roadCanvas=renderRoads();roadDirty=false;roadSig=sig}
  if(roadCanvas){const sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=true;g.drawImage(roadCanvas,0,0,MW,MH);g.imageSmoothingEnabled=sm}
  for(const l of links)if(l.p<1)roadStroke(g,l.pts,sk,pc,l.p,1);
  const ts=myCosm().tskin||'default';
  for(const tr of traders){
    if(tr.in>0)continue;
    const[x,y,dx,dy]=pathAt(tr.l.pts,tr.d),left=(tr.dir>0?dx:-dx)<0,ddx=tr.dir>0?dx:-dx,ddy=tr.dir>0?dy:-dy;
    const ok=svDraw(g,'trader',ts,pc,x,y-2,0.8,1,Math.atan2(ddy,left?-ddx:ddx),left);
    if(!ok){g.fillStyle='#3a2418';g.fillRect(x-3,y-3,6,4)}
  }
}
function drawWarships(g,now){
  const showR=new Set();if(selT!=null)showR.add(selT);if(hovT!=null)showR.add(hovT);
  for(const w of warships){
    const by=w.y+Math.sin(now/500+w.seed)*1.5;
    if(showR.has(w.home)){g.strokeStyle='rgba(255,190,110,.55)';g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.arc(w.x,w.y,WAR_RANGE,0,6.283);g.stroke();g.setLineDash([])}
    svDraw(g,'war',cosmOf(0).bskin||'default',rgb(F[0].rgb),w.x,by+10,0.62,0);
  }
}
