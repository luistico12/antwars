/* ===== Kolonie: Daten ===== */
let CELLW=48,CELLH=32,COLS=40,MR=12,UR=22,ROWS=MR+UR,CW=COLS*CELLW,CH=ROWS*CELLH,GY=MR*CELLH,ENT_C=20,ENT_X=ENT_C*CELLW+CELLW/2;const TREE_X=118,DAYLEN=110,VW=1120,VH=630,EGG_T=120;
/* Unlimited: doppelt so breite und tiefe Kolonie */
function setColonyDims(k){COLS=40*k;UR=22*k;ROWS=MR+UR;CW=COLS*CELLW;CH=ROWS*CELLH;GY=MR*CELLH;ENT_C=COLS/2;ENT_X=ENT_C*CELLW+CELLW/2}
const ROOMS={
  tunnel:{n:'Tunnel',mat:1,food:0,need:2,d:'Taste T: Tunnelansicht. Linksklick markiert, Ziehen malt mehrere Abschnitte. Wird 2,5× schneller gegraben'},
  leaf:{n:'Blattlager',mat:2,food:0,need:10,d:'+60 Blattplatz'},
  farm:{n:'Pilzfarm',mat:5,food:20,need:14,d:'Platz für 5 Pilzzüchter. Macht aus Blättern Pilze'},
  fstore:{n:'Pilzlager',mat:5,food:20,need:12,d:'+60 Pilzplatz'},
  house:{n:'Ameisenhaus',mat:5,food:8,need:12,d:'+8 Arbeiterplätze'},
  egg:{n:'Eierkammer',mat:5,food:10,need:12,d:'+6 Eier, schnellere Eiablage'},
  barracks:{n:'Kaserne',mat:8,food:20,need:14,d:'+6 Soldatenplätze'},
  pit:{n:'Lehmgrube',mat:5,food:15,need:14,d:'Material. Braucht Wasser aus See oder Fluss'},
  clay:{n:'Lehmlager',mat:4,food:0,need:10,d:'+40 Materialplatz'}
};
const UPG=[
  {id:'dig',n:'Kräftige Kiefer',d:'Graben +30% pro Stufe',res:'mat',cost:[10,25,45]},
  {id:'forage',n:'Pheromonspur',d:'Sammeln +25% pro Stufe',res:'food',cost:[40,90,160]},
  {id:'egg',n:'Königinnengelee',d:'Eiablage +30% pro Stufe',res:'food',cost:[50,110,190]},
  {id:'atk',n:'Giftdrüsen',d:'Angriff +20% pro Stufe',res:'mat',cost:[20,40,70]},
  {id:'def',n:'Chitinpanzer',d:'Verteidigung +20% pro Stufe',res:'mat',cost:[20,40,70]}
];
const PW={dig:'Graben',forage:'Sammeln',egg:'Eiablage',farm:'Pilzzucht',atk:'Angriff',def:'Verteidigung',speed:'Marschtempo'};
const WATER_N=['','Tümpel','Teich','See','Großer See','Fluss'];
const ROLE_N={f:'Sammlerin',d:'Gräberin',m:'Pilzzüchterin',s:'Soldat',w:'Wasserträgerin'};
const SPF={termite:1,ground:0.62,leaf:0.5};
const ANTPAL={
  ground:{body:'#2b1a10',hi:'#5a3a24',head:'#22140b',eye:'#d9c9a8',leg:'#170c06',mand:'#6b4a2a'},
  leaf:{body:'#8f3d1c',hi:'#c26a34',head:'#7a3016',eye:'#ffe9b0',leg:'#4a1d0c',mand:'#3b1608'},
  termite:{body:'#efdfae',hi:'#fbf3d4',head:'#b9743a',eye:'#3a2410',leg:'#cdb988',mand:'#6a3d18'}
};
let G=null,col=null,curT=-1;
function pwMul(k){if(!G)return 1;let m=1;for(const i of G.items)if(i.type===k)m*=1+i.pct/100;return m}
function newG(){G={food:60,fungus:40,mat:30,upg:{dig:0,forage:0,egg:0,atk:0,def:0},items:[],time:DAYLEN*0.12,foodCap:100,fungusCap:60,matCap:40,starve:0}}

/* ===== Kolonie: Aufbau ===== */
const ROOM_SEQ=['leaf','farm','house','egg','fstore','barracks','clay','leaf','house','pit'];
function makeColony(t,mode,sp,n){
  const seed=(Math.random()*1e9)|0,rnd=mulberry32(seed),grid=[];
  for(let i=0;i<COLS*ROWS;i++)grid.push({s:0,kind:null,build:null});
  const at=(c,r)=>grid[r*COLS+c];
  const shapes=[[[0,0]],[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[1,0],[1,1]],[[0,0],[0,1],[0,2]]];
  for(let k=0;k<62;k++){
    const c=Math.floor(rnd()*COLS),r=MR+2+Math.floor(rnd()*(UR-2)),sh=shapes[Math.floor(rnd()*shapes.length)];
    if(sh.every(([dx,dy])=>{const cc=c+dx,rr=r+dy;return cc<COLS&&rr<ROWS&&at(cc,rr).s===0&&!(Math.abs(cc-ENT_C)<=3&&rr<=MR+12)}))sh.forEach(([dx,dy])=>{at(c+dx,r+dy).s=1});
  }
  const size=mode==='capital'?2+Math.floor(rnd()*3):1+Math.floor(rnd()*5);
  const side=sp==='leaf'?1:(rnd()<0.5?-1:1);
  const water={size,side,x:side<0?170:CW-170,w:60+size*55,depth:12+size*4};
  const open=(c,r,k)=>{const x=at(c,r);x.s=2;x.kind=k};
  open(ENT_C,MR,'tunnel');open(ENT_C,MR+1,'tunnel');open(ENT_C,MR+2,'queen');
  let rooms=[];
  if(mode==='capital')rooms=['leaf','farm'];else if(mode==='conquest')rooms=ROOM_SEQ.slice(0,n||4);
  const maxRow=MR+1+Math.floor((Math.max(rooms.length,1)-1)/2)*2+1;
  for(let r=MR+1;r<=maxRow;r++)if(r!==MR+2&&rooms.length)open(ENT_C,r,'tunnel');
  rooms.forEach((k,j)=>{const r=MR+1+Math.floor(j/2)*2,c=ENT_C+(j%2?-1:1);open(c,r,k)});
  const farms=rooms.filter(k=>k==='farm').length;
  const w=mode==='capital'?7:mode==='conquest'?3+(n||4):2;
  const C={tid:t.id,sp,grid,water,w,diggers:mode==='capital'?2:1,farmers:mode==='capital'?2:Math.min(farms*2,w-2),eggAges:[],spct:30,layAcc:0,ants:[],parts:[],hover:null,pin:null,buildSel:null,tun:null,seed,stats:null,soil:null,bg:null,hill:null,hillKey:''};
  ensureSideExits(C);
  C.items=[];{const types=Object.keys(PW),want=mode==='capital'?6:mode==='conquest'?5:3;let tries=0;
    while(C.items.length<want&&tries++<400){const c=Math.floor(rnd()*COLS),r=MR+3+Math.floor(rnd()*(ROWS-MR-3));
      const k=at(c,r);if(k.s!==0||isWaterCell({water},c,r)||Math.abs(c-ENT_C)<=1&&r<MR+6)continue;
      if(C.items.some(i=>i.c===c&&i.r===r))continue;
      C.items.push({c,r,type:types[Math.floor(rnd()*types.length)],pct:10+Math.floor(rnd()*6)})}}
  if(mode==='capital')C.eggAges=[70,40];else if(mode==='conquest'&&(n||4)>=4)C.eggAges=[30];
  computeStats(C);return C;
}
function computeStats(C){
  const S={leaf:0,farm:0,fstore:0,house:0,egg:0,barracks:0,pit:0,clay:0};
  for(const c of C.grid)if(c.s===2&&S[c.kind]!==undefined)S[c.kind]++;
  S.foodCap=100+60*S.leaf;S.fungusCap=60+60*S.fstore;S.matCap=40+40*S.clay;S.workerCap=12+8*S.house;S.soldierCap=5+6*S.barracks;S.eggCap=10+6*S.egg;
  C.stats=S;return S;
}
const colonies=()=>T.filter(t=>t.owner===0&&t.col).map(t=>t.col);
const openAtC=(C,c,r)=>{if(c<0||r<0||c>=COLS||r>=ROWS)return false;return C.grid[r*COLS+c].s===2};
const cellAt=(c,r)=>(c<0||r<0||c>=COLS||r>=ROWS)?null:col.grid[r*COLS+c];
const isOpen=(c,r)=>openAtC(col,c,r);

/* Hügel: wächst mit jeder ausgehöhlten Zelle, bei allen Arten bebaubar */
function dugCount(C){let n=0;for(const k of C.grid)if(k.s===2||k.s===3)n+=(k.kind&&k.kind!=='tunnel')?2:1;return n}
function moundH(C){return clamp(2+Math.floor(dugCount(C)/8),2,MR)}
const hillH=C=>moundH(C)*CELLH+10;
const hillHW0=C=>(1.6+moundH(C)*0.95)*CELLW*SPF[C.sp];
function hwAt(C,yh){const H=hillH(C);if(yh>=H)return 0;return hillHW0(C)*Math.pow(1-yh/H,C.sp==='termite'?0.62:0.85)}
function inMound(C,c,r){if(r>=MR||r<0)return false;const yh=(MR-r-0.5)*CELLH;return Math.abs(c*CELLW+CELLW/2-ENT_X)+CELLW*0.45<=hwAt(C,yh+CELLH*0.4)}
function diggable(C,c,r){if(r<0||c<0||c>=COLS||r>=ROWS)return false;if(r>=MR)return true;return inMound(C,c,r)}

/* ===== Kolonie: Berechnung ===== */
function territoryIncome(){
  let food=0,mat=0,fungus=0;
  for(const t of T){if(t.owner!==0)continue;const q=TERR[t.terrain];
    if(!t.isCap){food+=q.food;mat+=q.mat}}
  return{food,mat,fungus};
}
function waterEff(C,S){const p=S.pit,z=C.water.size;return Math.min(p,z)+Math.max(0,p-z)*0.25}
function econC(C){
  const S=C.stats||computeStats(C),sp=SP[C.sp],sold=Math.floor(T[C.tid].troops);
  const foragers=Math.max(0,C.w-C.diggers-C.farmers);
  const forage=foragers*0.25*sp.forage*(1+0.25*G.upg.forage)*pwMul('forage');
  const farmP=C.farmers*0.3*sp.farm*pwMul('farm'),farmUse=C.farmers*0.25;
  const upkeep=(C.w+sold)*0.012,pitEff=waterEff(C,S),mat=C.diggers*0.12*pwMul('dig')+pitEff*0.35;
  const lay=0.14*(1+0.25*S.egg)*(1+0.3*G.upg.egg)*sp.egg*pwMul('egg');
  const eggs=C.eggAges.length;
  return{foragers,forage,farmP,farmUse,upkeep,mat,pitEff,lay,sold,S,eggs,eggFood:eggs<S.eggCap?lay*2:0,hatch:eggs/(EGG_T*SIMV)};
}
function updateColonies(dt){
  G.time+=dt;
  const cols=colonies();let foodCap=0,fungusCap=0,matCap=0;
  for(const C of cols){computeStats(C);foodCap+=C.stats.foodCap;fungusCap+=C.stats.fungusCap;matCap+=C.stats.matCap}
  G.foodCap=foodCap;G.fungusCap=fungusCap;G.matCap=matCap;
  const ti=territoryIncome();let dF=ti.food,dM=ti.mat,dP=ti.fungus;
  const farmOn=G.food>0.3&&G.fungus<G.fungusCap?1:0;
  for(const C of cols){
    const S=C.stats,t=T[C.tid];
    C.farmers=clamp(C.farmers,0,Math.min(S.farm*5,C.w));C.diggers=clamp(C.diggers,0,C.w-C.farmers);
    if(C.items&&C.items.length)for(let i=C.items.length-1;i>=0;i--){const it=C.items[i],k=C.grid[it.r*COLS+it.c];
      if(k.s===2){C.items.splice(i,1);G.items.push({type:it.type,pct:it.pct,from:t.name});toast(`Fund ausgegraben: ${PW[it.type]} +${it.pct}%`,'good');burst(C,it.c*CELLW+CELLW/2,it.r*CELLH+CELLH/2)}}
    const e=econC(C);dF+=e.forage-e.farmUse*farmOn;dP+=e.farmP*farmOn-e.upkeep;dM+=e.mat;
    const eggs=C.eggAges.length;
    if(eggs<S.eggCap&&G.fungus>=2){C.layAcc+=e.lay*dt;if(C.layAcc>=1){C.layAcc-=1;C.eggAges.push(0);G.fungus-=2}}else C.layAcc=Math.min(C.layAcc,0.99);
    let sold=Math.floor(t.troops);const keep=[];
    for(let i=0;i<C.eggAges.length;i++){
      let a=C.eggAges[i]+dt;
      if(a>=EGG_T){
        const wantS=Math.random()<C.spct/100;let kind=null;
        if(wantS&&sold<S.soldierCap)kind='s';else if(C.w<S.workerCap)kind='w';else if(sold<S.soldierCap)kind='s';
        if(kind){if(kind==='s'){addTroops(t,1);sold++}else C.w++;continue}
        a=EGG_T;
      }
      keep.push(a);
    }
    C.eggAges=keep;
    const builds=[];
    for(let i=0;i<C.grid.length;i++){const c=C.grid[i];if(!c.build)continue;const cc=i%COLS,rr=(i/COLS)|0;
      if(openAtC(C,cc+1,rr)||openAtC(C,cc-1,rr)||openAtC(C,cc,rr+1)||openAtC(C,cc,rr-1))builds.push(i)}
    if(builds.length){
      const power=(0.6+C.diggers*0.4)*(1+0.3*G.upg.dig)*pwMul('dig')*SP[C.sp].dig,per=power/builds.length;
      for(const i of builds){const c=C.grid[i];c.build.prog+=per*dt;
        if(c.build.prog>=c.build.need){c.kind=c.build.kind;c.s=2;c.build=null;
          if(C===col){if(c.kind!=='tunnel')toast(ROOMS[c.kind].n+' fertig','good');dockDirty=true;burst(C,(i%COLS)*CELLW+CELLW/2,((i/COLS)|0)*CELLH+CELLH/2)}}}
    }
  }
  G.food=clamp(G.food+dF*dt,0,G.foodCap);G.mat=clamp(G.mat+dM*dt,0,G.matCap);G.fungus=clamp(G.fungus+dP*dt,0,G.fungusCap);
  if(G.fungus<=0&&dP<0){G.starve+=dt;if(G.starve>=6){G.starve=0;
    const c=cols.filter(x=>x.w>1).sort((a,b)=>b.w-a.w)[0];
    if(c){c.w--;toast('Hunger: eine Arbeiterin ist verhungert. Baue Pilzfarmen','bad')}}}else G.starve=0;
  if(col){syncAnts();for(const a of col.ants)stepAnt(a,dt);stepParts(col,dt)}
}
function isWaterCell(C,c,r){if(r!==MR)return false;const w=C.water,x0=w.x-w.w/2,x1=w.x+w.w/2;return c*CELLW<x1-6&&(c+1)*CELLW>x0+6}
function canPlace(kind,c,r){
  const k=cellAt(c,r),R=ROOMS[kind];if(!k)return'Außerhalb';
  if(isWaterCell(col,c,r))return'Im Wasser kann man nicht bauen';
  if(r<MR&&!diggable(col,c,r))return'Noch außerhalb des Hügels. Grabe mehr, dann wächst er';
  if(k.s===1)return'Fels, hier lässt sich nicht graben';
  if(k.build)return'Wird schon gebaut';
  if(k.s===0){if(!(isOpen(c+1,r)||isOpen(c-1,r)||isOpen(c,r+1)||isOpen(c,r-1)))return'Muss an einen Gang angrenzen'}
  else{if(k.kind!=='tunnel')return'Hier ist schon ein Raum';if(c===ENT_C&&r===MR)return'Der Eingang bleibt frei'}
  if(G.mat<R.mat)return'Zu wenig Material';if(G.food<R.food)return'Zu wenig Blätter';
  return null;
}
function placeBuild(kind,c,r){
  const why=canPlace(kind,c,r);if(why){toast(why,'bad');return false}
  const k=cellAt(c,r),R=ROOMS[kind];G.mat-=R.mat;G.food-=R.food;
  k.build={kind,prog:0,need:k.s===2?Math.max(4,R.need-4):R.need};if(k.s===0)k.s=3;
  return true;
}
/* Tunnel: Start und Ziel markieren, kürzester Weg wird gegraben */
function tunnelPath(c0,r0,c1,r1){
  if(!diggable(col,c1,r1)||isWaterCell(col,c1,r1))return null;const e=col.grid[r1*COLS+c1];if(e.s===1)return null;
  const dist=new Float32Array(COLS*ROWS).fill(1e9),prev=new Int16Array(COLS*ROWS).fill(-1),h=new Heap(),s=r0*COLS+c0;
  dist[s]=0;h.push(0,s);
  while(h.size){const[d,i]=h.pop();if(d>dist[i])continue;if(i===r1*COLS+c1)break;const c=i%COLS,r=(i/COLS)|0;
    for(const[dx,dy]of N4){const nc=c+dx,nr=r+dy;if(!diggable(col,nc,nr)||isWaterCell(col,nc,nr))continue;const k=col.grid[nr*COLS+nc];if(k.s===1)continue;
      const j=nr*COLS+nc,nd=d+(k.s===2?0.2:k.s===3?0.6:1);if(nd<dist[j]){dist[j]=nd;prev[j]=i;h.push(nd,j)}}}
  const t=r1*COLS+c1;if(prev[t]<0&&t!==s)return null;
  const out=[];let k=t;while(k!==s&&k>=0){out.push([k%COLS,(k/COLS)|0]);k=prev[k]}out.push([c0,r0]);return out.reverse();
}
/* Tunnelansicht: Linksklick markiert eine Zelle, Ziehen malt mehrere. Liegt die Zelle nicht an einem Gang, wird der kürzeste Weg vom nächsten Gang gegraben.
   Rückgabe: Zahl neuer Abschnitte, 0 = nichts zu tun, -1 = geht nicht, -2 = zu wenig Material */
function tunnelMark(c,r){
  const k=cellAt(c,r);if(!k||k.s!==0)return 0;
  if(!diggable(col,c,r)||isWaterCell(col,c,r))return -1;
  let cells=[[c,r]];
  const adj=N4.some(([dx,dy])=>{const n=cellAt(c+dx,r+dy);return n&&(n.s===2||n.s===3)});
  if(!adj){
    const op=openCells();if(!op.length)return -1;
    const dist=o=>Math.abs(o[0]-c)+Math.abs(o[1]-r);op.sort((a,b)=>dist(a)-dist(b));
    const p=tunnelPath(op[0][0],op[0][1],c,r);if(!p)return -1;cells=p.filter(([x,y])=>col.grid[y*COLS+x].s===0);
    if(!cells.length)return 0;
  }
  const cost=cells.length*ROOMS.tunnel.mat;if(G.mat<cost)return -2;
  G.mat-=cost;for(const[x,y]of cells){const q=col.grid[y*COLS+x];q.s=3;q.build={kind:'tunnel',prog:0,need:ROOMS.tunnel.need}}
  return cells.length;
}
function paintAt(c,r){
  const p=col&&col.paint;if(!p)return;const key=c+','+r;if(p.last===key)return;p.last=key;
  const res=tunnelMark(c,r);if(res>0)p.n+=res;else if(res===-1)p.bad++;else if(res===-2)p.low++;
}
function endPaint(){
  const p=col&&col.paint;if(!p)return;col.paint=null;
  if(p.n>0)toast(`Tunnel: ${p.n} Abschnitte werden gegraben`,'good');
  else if(p.low)toast('Zu wenig Material für den Tunnel','bad');
  else if(p.bad)toast('Dort lässt sich kein Tunnel graben (Fels, Wasser oder außerhalb des Hügels)','bad');
}
function burst(C,x,y){for(let i=0;i<16;i++)C.parts.push({x,y,vx:(Math.random()-0.5)*70,vy:-Math.random()*60-10,life:0.7+Math.random()*0.5,c:Math.random()<0.5?'#8a5a2e':'#c08a52'})}
function stepParts(C,dt){for(let i=C.parts.length-1;i>=0;i--){const p=C.parts[i];p.life-=dt;p.vy+=160*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)C.parts.splice(i,1)}}

/* ===== Ameisen-Simulation (nur die geöffnete Kolonie) ===== */
const cellCenter=(c,r)=>[c*CELLW+CELLW/2,r*CELLH+CELLH/2];
function bfsPath(c0,r0,c1,r1){
  if(c0===c1&&r0===r1)return[[c0,r0]];
  const prev=new Int16Array(COLS*ROWS).fill(-1),q=[r0*COLS+c0];prev[q[0]]=q[0];
  for(let h=0;h<q.length;h++){const k=q[h],c=k%COLS,r=(k/COLS)|0;if(c===c1&&r===r1)break;
    for(const[dx,dy]of N4){const nc=c+dx,nr=r+dy;if(!isOpen(nc,nr))continue;const j=nr*COLS+nc;if(prev[j]<0){prev[j]=k;q.push(j)}}}
  const t=r1*COLS+c1;if(prev[t]<0)return null;
  const out=[];let k=t;while(k!==prev[k]){out.push([k%COLS,(k/COLS)|0]);k=prev[k]}out.push([c0,r0]);return out.reverse();
}
function openCells(kind){const o=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=col.grid[r*COLS+c];if(k.s===2&&(!kind||k.kind===kind))o.push([c,r])}return o}
const pick=a=>a[Math.floor(Math.random()*a.length)];
function syncAnts(force){
  const e=econC(col),want={f:Math.min(22,e.foragers),d:Math.min(10,col.diggers),m:Math.min(8,col.farmers),s:Math.min(12,e.sold),w:col.stats.pit>0?Math.min(6,col.stats.pit*2):0},have={f:0,d:0,m:0,s:0,w:0};
  if(force)col.ants=[];
  for(const a of col.ants)have[a.role]++;
  for(const role of['f','d','m','s','w']){
    for(let i=have[role];i<want[role];i++){const[x,y]=cellCenter(ENT_C,MR+1);col.ants.push({role,x,y,c:ENT_C,r:MR+1,path:[],wait:Math.random()*2,state:'idle',carry:null,surf:false,hx:1,hy:0,ph:Math.random()*6,off:(Math.random()-0.5)*8,ex:null})}
    for(let i=have[role];i>want[role];i--){const k=col.ants.findIndex(a=>a.role===role);if(k>=0)col.ants.splice(k,1)}
  }
}
function toPoints(cells,off){return cells.map(([c,r])=>{const[x,y]=cellCenter(c,r);return[x+off,y+off*0.6]})}
function underPath(a,c1,r1){const p=bfsPath(a.c,a.r,c1,r1);return p?toPoints(p,a.off):null}

/* Hügel mit mehreren Ausgängen an den Seiten (nicht in der Mitte, wo der Hügelkern ist):
   Der Schacht in der Mitte bleibt unter der Oberfläche; auf Bodenhöhe und – sobald der Hügel hoch genug ist – weiter oben
   führen Quergänge zum Hügelrand. Wächst der Hügel, werden die Gänge mitverlängert. */
function ensureSideExits(C){
  const open=(c,r)=>{const k=C.grid[r*COLS+c];if(k.s===0){k.s=2;k.kind='tunnel';return true}return k.s===2};
  const H=moundH(C);const rows=[MR-1];if(H>=4)rows.push(MR-3);if(H>=7)rows.push(MR-5);
  for(const r of rows){
    if(r<0)continue;
    /* senkrechter Schacht in der Mitte bis zu dieser Zeile */
    for(let y=MR;y>=r;y--)if(!open(ENT_C,y))break;
    for(const side of[-1,1]){let c=ENT_C+side;while(c>=0&&c<COLS&&inMound(C,c,r)){if(!open(c,r))break;c+=side}}
  }
}
function exitList(){
  const L=[];
  for(let r=0;r<MR;r++)for(let c=0;c<COLS;c++){const k=col.grid[r*COLS+c];if(k.s!==2||c===ENT_C)continue;
    if((c<ENT_C&&!inMound(col,c-1,r))||(c>ENT_C&&!inMound(col,c+1,r)))L.push([c,r,c<ENT_C?-1:1])}
  return L;
}
function exitPts(ex,off){
  const[c,r,side]=ex;if(!side)return[[ENT_X+off,GY-3]];
  const yh0=(MR-r-0.5)*CELLH,pts=[];
  for(let yh=yh0;yh>4;yh-=20)pts.push([ENT_X+side*Math.max(8,hwAt(col,yh)-3),GY-yh]);
  pts.push([ENT_X+side*(hwAt(col,0.5)+6),GY-3]);return pts;
}
function pickExit(a){
  const L=exitList();
  for(let i=0;i<4;i++){const ex=pick(L),up=underPath(a,ex[0],ex[1]);if(up)return{ex,up}}
  return null;
}
function stepAnt(a,dt){
  if(a.wait>0){a.wait-=dt;return}
  if(!a.path.length){chooseJob(a);return}
  const[tx,ty]=a.path[0],dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy),sp=(a.role==='s'?34:44)*dt;
  a.ph+=dt*14;
  if(d<=sp){a.x=tx;a.y=ty;a.path.shift();
    if(!a.surf){a.c=clamp(Math.floor(a.x/CELLW),0,COLS-1);a.r=clamp(Math.floor(a.y/CELLH),0,ROWS-1)}
    if(!a.path.length)arrive(a)}
  else{a.x+=dx/d*sp;a.y+=dy/d*sp;a.hx=dx/d;a.hy=dy/d}
}
function forageSpot(){
  if(col.sp==='leaf'){const tx=TREE_X+(Math.random()-0.5)*10;return[[tx,GY-2],[tx,GY-30-Math.random()*150]]}
  const side=Math.random()<0.5?-1:1;return[[clamp(ENT_X+side*(160+Math.random()*700),24,CW-24),GY-3]];
}
function waterSpot(){const w=col.water;return[[w.x-w.side*(w.w/2-6),GY-3]]}
function chooseJob(a){
  if(a.role==='f'||a.role==='w'){
    if(a.state==='idle'||a.state==='in'){
      const px=pickExit(a);if(!px){a.wait=1;return}
      a.ex=px.ex;a.path=[...px.up,...exitPts(px.ex,a.off),...(a.role==='w'?waterSpot():forageSpot())];a.state='out';
    }
  }else{
    let targets;
    if(a.role==='d'){const b=[];col.grid.forEach((k,i)=>{if(k.build){const c=i%COLS,r=(i/COLS)|0;if(isOpen(c+1,r)||isOpen(c-1,r)||isOpen(c,r+1)||isOpen(c,r-1))b.push([c,r])}});targets=b.length?b:openCells('tunnel')}
    else if(a.role==='m'){const f=openCells('farm');targets=f.length?f:openCells()}
    else{const b=openCells('barracks');targets=Math.random()<0.5&&b.length?b:openCells()}
    if(!targets.length){a.wait=1;return}
    let[c,r]=pick(targets);
    if(!isOpen(c,r)){const n=N4.map(([dx,dy])=>[c+dx,r+dy]).filter(([x,y])=>isOpen(x,y));if(!n.length){a.wait=1;return}[c,r]=pick(n)}
    const p=underPath(a,c,r);if(p)a.path=p;a.state='go';
  }
  if(!a.path.length)a.wait=0.5;
}
function arrive(a){
  if(a.role==='f'||a.role==='w'){
    if(a.state==='out'){a.surf=true;a.carry=a.role==='w'?'water':'leaf';a.wait=0.8+Math.random()*1.4;
      const back=[...exitPts(a.ex,a.off)].reverse();
      a.path=[...(a.y<GY-6&&col.sp==='leaf'&&a.role==='f'?[[a.x,GY-3]]:[]),...back];a.state='home'}
    else if(a.state==='home'){a.surf=false;const[x,y]=cellCenter(a.ex[0],a.ex[1]);a.x=x;a.y=y;a.c=a.ex[0];a.r=a.ex[1];a.state='store';
      const sk=a.role==='w'?'pit':'leaf',cells=openCells(sk);const t=cells.length?pick(cells):[ENT_C,MR+1];const p=underPath(a,t[0],t[1]);a.path=p||[]}
    else if(a.state==='store'){a.carry=null;a.state='in';a.wait=0.3}
  }else{
    if(a.role==='d'){const k=cellAt(a.c,a.r);if(k&&k.build&&Math.random()<0.7){col.parts.push({x:a.x,y:a.y,vx:(Math.random()-0.5)*40,vy:-30,life:0.5,c:'#a0663a'});a.carry='dirt'}else a.carry=null}
    a.wait=0.8+Math.random()*2.2}
}

/* ===== Ameisen-Sprite (Seitenansicht) ===== */
function drawAnt(g,x,y,dx,dy,ph,role,sp,carry,sc,pal){
  const P=pal||ANTPAL[sp],u=2*(sc||1);
  g.save();g.translate(Math.round(x),Math.round(y));
  let ang;if(dx<0){g.scale(-1,1);ang=Math.atan2(dy,-dx)}else ang=Math.atan2(dy,dx);
  g.rotate(ang);
  const R=(a,b,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(a*u),Math.round(b*u),Math.max(1,Math.round(w*u)),Math.max(1,Math.round(h*u)))};
  const term=sp==='termite'&&!pal,sol=role==='s',q=role==='q';
  const legs=(far)=>{for(let i=0;i<3;i++){const bx=-1.7+i*1.5,sw=Math.sin(ph+i*2.1+(far?Math.PI:0))*1.1;
    R(bx+sw*0.15,far?0.2:0.5,0.6,1.7,P.leg);R(bx+sw*0.7,far?1.6:1.9,0.6,1.5,P.leg);R(bx+sw*0.7-0.3,far?2.8:3.2,0.9,0.4,P.leg)}};
  legs(true);
  if(q){R(-11,-3,8.6,5.8,P.body);R(-10.4,-3.6,7.4,0.8,P.body);R(-10.4,2.4,7.4,0.8,P.body);
    for(let i=0;i<3;i++)R(-9.5+i*2.4,-3,0.5,5.8,P.hi);R(-10.6,-2.4,1,0.8,P.hi)}
  else if(term){R(-7.8,-2.4,6.2,4.4,P.body);R(-7.2,-2.9,5,0.8,P.body);R(-7.2,1.9,5,0.8,P.body);R(-7,-2.4,4.4,0.7,P.hi);
    for(let i=0;i<3;i++)R(-6.4+i*1.7,-2.4,0.35,4.4,'#d8c58d')}
  else{R(-7.4,-1.8,5,3.6,P.body);R(-6.8,-2.4,3.8,0.8,P.body);R(-6.8,1.6,3.8,0.8,P.body);R(-6.6,-1.9,2.8,0.8,P.hi);R(-2.5,-0.7,1.2,1.2,P.body)}
  R(-1.7,-1.7,3.2,2.6,P.body);R(-1.3,-2.1,2.2,0.6,P.hi);
  if(sol||q){R(1.2,-2.6,4,4,P.head);R(1.8,-3,2.8,0.6,P.head)}else R(1.3,-1.9,3.3,3,P.head);
  R(3.3,-1.4,1,1,P.eye);R(3.6,-1.2,0.5,0.5,'#111');
  const m=sol?'#e0523d':P.mand;
  R(sol?5.1:4.5,0.2,1.5,0.6,m);R(sol?5.1:4.5,1.1,1.5,0.6,m);
  R(3.6,-2.8,0.5,1,P.leg);R(4,-3.6,1.2,0.5,P.leg);R(2.2,-2.9,0.5,1.1,P.leg);R(2.5,-3.7,1.3,0.5,P.leg);
  if(q){R(1.6,-3.5,3,0.8,'#f0b94a');R(1.6,-4.4,0.7,1,'#f0b94a');R(3,-4.6,0.7,1.2,'#f0b94a');R(4.2,-4.4,0.7,1,'#f0b94a')}
  legs(false);
  if(carry==='leaf'){R(-0.4,-5.6,5,3,'#5fb540');R(0.2,-5.2,3.6,0.7,'#9be86a');R(2.2,-4.2,2.6,0.5,'#3d8a2c')}
  else if(carry==='dirt'){R(4.6,-0.4,2,2,'#9a6234');R(4.9,-0.3,1,0.7,'#c08a52')}
  else if(carry==='fungus'){R(4.6,-0.4,2,2,'#efe6cf')}
  else if(carry==='water'){R(4.6,-0.8,2.2,2.6,'#4aa8e8');R(5,-0.6,0.8,0.8,'#cdeaff')}
  g.restore();
}

/* ===== Kolonie: Texturen ===== */
function ell(g,cx,cy,rx,ry,c){g.fillStyle=c;for(let dy=-ry;dy<ry;dy+=2){const w=Math.sqrt(Math.max(0,1-((dy+1)/ry)**2))*rx;g.fillRect(Math.round(cx-w),Math.round(cy+dy),Math.round(w*2),2)}}
function buildSoil(C){
  const OFF=8,H=CH-GY,cv=makeCanvas(CW,H+OFF),g=cv.getContext('2d'),rnd=mulberry32(C.seed^0x5bd1e995),sd=C.seed&0xffff;
  const L=[[104,64,30],[152,95,48],[170,98,64],[146,84,62]];
  const img=g.createImageData(CW,H+OFF),d=img.data,wt=C.water;
  for(let y=0;y<H;y+=2)for(let x=0;x<CW;x+=2){
    const wob=Math.sin(x*0.013+sd%7)*9+Math.sin(x*0.041+sd%5)*4,yy=y+wob;
    const c=yy<92?L[0]:yy<210?L[1]:yy<400?L[2]:L[3],v=(hash2(x>>1,y>>1,sd)-0.5)*26;
    const R=c[0]+v,Gc=c[1]+v,B=c[2]+v*0.8;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((y+OFF+dy)*CW+x+dx)*4;d[i]=R;d[i+1]=Gc;d[i+2]=B;d[i+3]=255}
  }
  g.putImageData(img,0,0);
  for(let i=0;i<3200;i++){const x=rnd()*CW|0,y=rnd()*H|0,l=rnd()<0.5;g.fillStyle=l?'rgba(255,225,175,.13)':'rgba(30,14,4,.18)';g.fillRect(x,y+OFF,2+(rnd()*3|0),2)}
  for(let i=0;i<260;i++){const x=rnd()*CW|0,y=(rnd()*(H-6)|0)+OFF,s=rnd();const rx=s<0.7?3+(rnd()*3|0):s<0.95?6+(rnd()*4|0):10+(rnd()*6|0);ell(g,x,y,rx,Math.max(2,rx*0.6|0),'#5f6a74');ell(g,x-1,y-1,Math.max(2,rx*0.6|0),Math.max(2,rx*0.36|0),'#8e9aa6')}
  for(let i=0;i<34;i++){let x=rnd()*CW,y=OFF+4;const len=26+rnd()*80;g.fillStyle='#6b4524';
    for(let s=0;s<len;s+=2){x+=(rnd()-0.5)*3;y+=1.6;g.fillRect(x|0,y|0,2,2);if(rnd()<0.06){let bx=x,by=y;for(let k=0;k<10;k++){bx+=(rnd()<0.5?-1:1)*2;by+=1;g.fillRect(bx|0,by|0,1,2)}}}}
  for(let i=0;i<60;i++){const x=rnd()*CW|0,y=(OFF+130+rnd()*(H-150))|0;g.fillStyle='#4a2a14';g.fillRect(x,y,4,6);g.fillStyle='#c4783c';g.fillRect(x+1,y+1,2,4)}
  for(let k=0;k<2;k++){const lx=200+rnd()*1400|0,ly=OFF+H-110-k*190;g.fillStyle='#6a4223';g.fillRect(lx,ly,200,22);g.fillStyle='#82552e';g.fillRect(lx,ly,200,5);g.fillStyle='#3e250f';g.fillRect(lx,ly+17,200,5);
    ell(g,lx+2,ly+11,8,11,'#d9b57a');ell(g,lx+2,ly+11,4,6,'#b98a50');for(let q=10;q<200;q+=22){g.fillStyle='#5a381b';g.fillRect(lx+q,ly+6,10,2)}}
  // Wasser: Becken im Boden
  const x0=wt.x-wt.w/2;
  for(let x=0;x<wt.w;x+=2){const t=(x-wt.w/2)/(wt.w/2),dep=Math.round(wt.depth*Math.sqrt(Math.max(0,1-t*t)));
    for(let y=0;y<dep;y+=2){const f=y/wt.depth;g.fillStyle=`rgb(${74-f*40|0},${160-f*60|0},${208-f*50|0})`;g.fillRect(x0+x,OFF+y,2,2)}
    g.fillStyle='#cdb27c';g.fillRect(x0+x,OFF+dep,2,3)}
  g.fillStyle='#cdb27c';g.fillRect(x0-6,OFF,6,4);g.fillRect(x0+wt.w,OFF,6,4);
  for(let x=0;x<CW;x+=2){if(x>x0-6&&x<x0+wt.w+6)continue;const h=2+((hash2(x,3,sd)*6)|0);g.fillStyle=hash2(x,9,sd)<0.5?'#5a9a3c':'#3f7a2c';g.fillRect(x,OFF-h,2,h+1)}
  g.fillStyle='#2f5f22';for(let x=0;x<CW;x+=2){if(x>x0-6&&x<x0+wt.w+6)continue;g.fillRect(x,OFF,2,2)}
  g.fillStyle='#5b7a30';for(const sx of[x0-10,x0+wt.w+8]){g.fillRect(sx,OFF-14,2,14);g.fillRect(sx+3,OFF-18,2,18);g.fillStyle='#7a4a22';g.fillRect(sx+3,OFF-22,3,6);g.fillStyle='#5b7a30'}
  C.soil=cv;
}
function buildBg(C){
  const cv=makeCanvas(CW,GY),g=cv.getContext('2d'),sd=C.seed&0xffff,rnd=mulberry32(C.seed+77);
  const layer=(base,amp,c1,c2,sc)=>{for(let x=0;x<CW;x+=4){const h=base+fbm(x/sc,3,sd)*amp+hash2(x,1,sd)*4;g.fillStyle=hash2(x>>3,5,sd)<0.5?c1:c2;g.fillRect(x,GY-h,4,h)}};
  if(C.sp==='termite'){
    layer(80,50,'#c9b070','#bfa662',200);layer(44,34,'#b89a55','#a98c49',130);
    for(let i=0;i<14*(COLS/40);i++){const x=40+i*140+rnd()*60,h=50+rnd()*40;g.fillStyle='#5a4220';g.fillRect(x,GY-h,4,h);ell(g,x+2,GY-h,28,6,'#6e8a3c');ell(g,x+2,GY-h-3,22,4,'#86a64a')}
  }else{
    layer(120,60,'#7ea06c','#74966a',160);layer(80,50,'#5f8a56','#55804d',120);layer(40,30,'#417a3e','#386e36',90);
    for(let i=0;i<12;i++){const x=rnd()*CW|0,h=70+rnd()*80;g.fillStyle='#4c3a22';g.fillRect(x,GY-h,6,h);ell(g,x+3,GY-h,26,18,'#2f6a34');ell(g,x+3,GY-h-8,19,13,'#3b7d40')}
  }
  C.bg=cv;
}
function buildHill(C){
  const cv=makeCanvas(CW,GY),g=cv.getContext('2d'),sd=C.seed&0xffff,term=C.sp==='termite';
  const img=g.createImageData(CW,GY),d=img.data;
  const base=term?[190,142,86]:C.sp==='leaf'?[118,78,42]:[132,86,48],HH=hillH(C);
  for(let y=0;y<GY;y+=2){
    const yh=GY-y,hw=hwAt(C,yh)*(0.96+hash2(y>>1,2,sd)*0.06);if(hw<=0)continue;
    for(let x=Math.max(0,Math.floor((ENT_X-hw)/2)*2);x<Math.min(CW,ENT_X+hw);x+=2){
      const rel=(x-ENT_X)/hw;
      let v=(hash2(x>>1,y>>1,sd)-0.5)*24-rel*22;
      if(term){v+=Math.sin((x-ENT_X)*0.33)*10;if(((y/2)|0)%9===0)v-=14;if(((y/2)|0)%9===1)v+=6}
      else if(((y/2)|0)%12===0)v-=8;
      if(Math.abs(x-ENT_X)>hw-5)v-=40;
      const R=base[0]+v,Gc=base[1]+v*0.85,B=base[2]+v*0.7;
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((y+dy)*CW+x+dx)*4;d[i]=R;d[i+1]=Gc;d[i+2]=B;d[i+3]=255}
    }
  }
  g.putImageData(img,0,0);
  if(term){g.fillStyle='rgba(60,30,10,.5)';for(let i=0;i<30;i++){const yh=20+hash2(i,4,sd)*(HH-30),hw=hwAt(C,yh),x=ENT_X+(hash2(i,5,sd)-0.5)*hw*1.6;g.fillRect(x|0,GY-yh|0,4,2)}}
  C.hill=cv;C.hillKey=C.sp+moundH(C);
}

/* ===== Kolonie: Zeichnen ===== */
function sky(g){
  const ph=(G.time/DAYLEN)%1,ang=ph*Math.PI*2,sn=Math.sin(ang),day=clamp(0.5+sn*0.9,0,1);
  const top=mixc([12,20,44],[104,164,214],day),bot=mixc([36,48,84],[196,224,236],day);
  for(let i=0;i<16;i++){g.fillStyle=rgb(mixc(top,bot,i/15));g.fillRect(0,i*(GY/16),CW,GY/16+1)}
  if(day<0.9){g.fillStyle='#fff';g.globalAlpha=(1-day)*0.9;for(let i=0;i<130;i++)g.fillRect((hash2(i,1,3)*CW)|0,(hash2(i,2,3)*(GY-90))|0,2,2);g.globalAlpha=1}
  const sx=CW/2-Math.cos(ang)*(CW*0.46),sy=GY-40-sn*260;
  g.globalAlpha=0.25;ell(g,sx,sy,40,40,sn>=-0.05?'#ffe9a0':'#cfd8ee');g.globalAlpha=1;
  ell(g,sx,sy,22,22,sn>=-0.05?'#ffe9a0':'#e8ecf5');ell(g,sx,sy,16,16,sn>=-0.05?'#fff6cf':'#f6f8ff');
  const cl=(G.time*5)%(CW+300);
  for(let i=0;i<8;i++){const x=((cl+i*300)%(CW+300))-150,y=30+(i%4)*36;g.globalAlpha=0.4+day*0.5;ell(g,x,y,50,11,'#fff');ell(g,x-16,y-9,26,11,'#fff');ell(g,x+18,y-7,30,10,'#f4f7fb');g.globalAlpha=1}
  return day;
}
function drawTree(g,C){
  const x=TREE_X,top=GY-290;
  for(let y=GY;y>top;y-=2){const t=(GY-y)/290,w=17-t*7,flare=y>GY-14?(y-(GY-14))*0.8:0;
    for(let xx=-w-flare;xx<w+flare;xx+=2){const v=(hash2(xx>>1,y>>1,9)-0.5)*20-(xx/w)*26;g.fillStyle=`rgb(${96+v|0},${66+v*0.8|0},${38+v*0.6|0})`;g.fillRect(x+xx,y,2,2)}}
  g.fillStyle='#3b2412';for(let y=GY-8;y>top;y-=14){g.fillRect(x-9+((y*7)%9),y,2,8)}
  for(const[by,len,dir]of[[GY-160,86,1],[GY-200,66,-1],[GY-120,60,-1]]){g.fillStyle='#5f4026';for(let i=0;i<len;i+=2)g.fillRect(x+dir*(8+i),by-i*0.35,2,7-i*0.06)}
  const blobs=[[0,top+6,84],[-62,top+40,62],[66,top+38,64],[-26,top-30,56],[32,top-24,54],[-84,top+80,42],[88,top+78,42]];
  for(const[ox,oy,r]of blobs)ell(g,x+ox,oy,r*1.15,r*0.78,'#235a2c');
  for(const[ox,oy,r]of blobs)ell(g,x+ox-4,oy-6,r*0.95,r*0.62,'#2f7a3a');
  for(const[ox,oy,r]of blobs)ell(g,x+ox-10,oy-14,r*0.6,r*0.34,'#47a050');
  g.fillStyle='#7ed06a';for(let i=0;i<60;i++){g.fillRect(x-110+hash2(i,1,6)*220|0,top-40+hash2(i,2,6)*150|0,4,2)}
}
function drawRoom(g,kind,x0,y0,fill,tm,sp){
  const cx=x0+24,cy=y0+16;
  switch(kind){
    case'leaf':{const n=2+Math.round((fill==null?0.6:fill)*16);
      for(let i=0;i<n;i++){const row=(i/6)|0,cc=i%6,px=cx-16+cc*5+(row%2)*2+((hash2(i,3,1)-0.5)*3|0),py=cy+10-row*3;
        g.fillStyle=['#4f9d3a','#6fc24c','#3f8a30'][i%3];g.fillRect(px,py,6,3);g.fillStyle='#a6ee80';g.fillRect(px+1,py,3,1)}break}
    case'farm':{ell(g,cx,cy+8,18,5,'#5a4a32');g.fillStyle='#7a6648';for(let i=0;i<14;i++)g.fillRect(cx-16+((hash2(i,4,2)*32)|0),cy+5+((hash2(i,5,2)*6)|0),2,2);
      [[-12,7],[-4,9],[5,7],[12,9]].forEach(([mx,h],i)=>{const sw=Math.round(Math.sin(tm*1.5+i)*0.8);
        g.fillStyle='#e8dfc4';g.fillRect(cx+mx,cy+9-h,3,h);ell(g,cx+mx+1+sw,cy+9-h,5,3,'#f4ead0');g.fillStyle='#cdbf98';g.fillRect(cx+mx-3+sw,cy+9-h+1,8,1)});
      g.fillStyle='#fff';g.globalAlpha=0.5;for(let i=0;i<5;i++){g.fillRect(cx-14+((tm*6+i*9)%28)|0,cy-8-((tm*4+i*5)%8)|0,1,1)}g.globalAlpha=1;break}
    case'fstore':{const n=2+Math.round((fill==null?0.6:fill)*10);
      for(let i=0;i<n;i++){const row=(i/4)|0,cc=i%4,px=cx-14+cc*7+(row%2)*3,py=cy+8-row*5;
        g.fillStyle='#e8dfc4';g.fillRect(px+1,py,2,3);ell(g,px+2,py,4,2,'#f4ead0');g.fillStyle='#cdbf98';g.fillRect(px-2,py+1,8,1)}
      g.fillStyle='#6a5a3c';g.fillRect(cx-18,cy+10,36,2);break}
    case'house':{g.fillStyle='#5a3a1e';g.fillRect(cx-18,cy-2,36,2);g.fillRect(cx-18,cy+6,36,2);g.fillRect(cx-18,cy-2,2,10);g.fillRect(cx+16,cy-2,2,10);
      drawAnt(g,cx-6,cy-4,1,0,0,'w',sp,null,0.5);drawAnt(g,cx+8,cy+4,-1,0,0,'w',sp,null,0.5);drawAnt(g,cx-8,cy+5,1,0,0,'w',sp,null,0.5);break}
    case'egg':{const n=Math.round((fill==null?0.6:fill)*18);ell(g,cx,cy+2,19,11,'rgba(255,235,190,.12)');
      for(let i=0;i<18;i++){const px=cx-15+(i%6)*6,py=cy-2+((i/6)|0)*6;if(i<n){ell(g,px+2,py+3,3,4,'#f6f1e2');g.fillStyle='#fff';g.fillRect(px+1,py+1,1,2)}else{ell(g,px+2,py+3,3,4,'#4a2f18')}}break}
    case'barracks':{const pal={body:'#8a2a18',hi:'#c0452e',head:'#6a1d10',eye:'#ffd08a',leg:'#3d0f08',mand:'#e0523d'};
      g.fillStyle='#7a5a32';g.fillRect(cx-18,cy-9,2,16);g.fillRect(cx+16,cy-9,2,16);g.fillStyle='#caa06a';g.fillRect(cx-20,cy-12,5,2);g.fillRect(cx+15,cy-12,5,2);
      drawAnt(g,cx-8,cy+4,1,0,0,'s',sp,null,0.55,pal);drawAnt(g,cx+6,cy+4,-1,0,0,'s',sp,null,0.55,pal);drawAnt(g,cx,cy-3,1,0,0,'s',sp,null,0.55,pal);break}
    case'pit':{ell(g,cx-6,cy+8,14,5,'#a85c2c');ell(g,cx-8,cy+5,9,4,'#c8703a');ell(g,cx+10,cy+6,8,3,'#2f7fb8');ell(g,cx+10,cy+5,5,2,'#58b0e8');g.fillStyle='#fff';g.fillRect(cx+8,cy+4,3,1);
      g.fillStyle='#58b0e8';g.fillRect(cx+10,cy-6+((tm*14)%10)|0,2,3);break}
    case'clay':{const n=Math.round((fill==null?0.6:fill)*10),pos=[[-12,9],[-4,9],[4,9],[12,9],[-8,3],[0,3],[8,3],[-4,-3],[4,-3],[0,-9]];
      for(let i=0;i<10;i++){const[px,py]=pos[i];ell(g,cx+px,cy+py,5,4,i<n?'#b8602c':'#4a2f18');if(i<n){g.fillStyle='#e0925a';g.fillRect(cx+px-2,cy+py-3,3,1)}}break}
    case'queen':{ell(g,cx,cy+2,20,11,'rgba(240,185,74,.14)');
      for(let i=0;i<5;i++){ell(g,cx-14+i*4,cy+11,2,3,'#f6f1e2')}
      drawAnt(g,cx-3,cy+3,1,0,Math.sin(tm*2)*0.3,'q',sp,null,1.0);break}
  }
}
function drawCaves(g,C,tm){
  const RIM='#6a4524',DARK='#241408',OP=(c,r)=>openAtC(C,c,r);
  const same=(k,c,r)=>{const o=(c<0||r<0||c>=COLS||r>=ROWS)?null:C.grid[r*COLS+c];return o&&o.s===2&&o.kind===k.kind&&k.kind!=='tunnel'};
  const each=f=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=C.grid[r*COLS+c];if(k.s===2)f(k,c,r,c*CELLW,r*CELLH,c*CELLW+CELLW/2,r*CELLH+CELLH/2)}};
  // Felsen
  for(let r=MR;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=C.grid[r*COLS+c];if(k.s!==1)continue;const cx=c*CELLW+24,cy=r*CELLH+16,rs=C.grid[r*COLS+c+1],ds=r+1<ROWS?C.grid[(r+1)*COLS+c]:null;
    ell(g,cx,cy,23,15,'#3e454e');if(c+1<COLS&&rs.s===1)g.fillRect(cx,cy-14,CELLW,28);if(ds&&ds.s===1)g.fillRect(cx-22,cy,44,CELLH)}
  for(let r=MR;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=C.grid[r*COLS+c];if(k.s!==1)continue;const cx=c*CELLW+24,cy=r*CELLH+16,rs=C.grid[r*COLS+c+1],ds=r+1<ROWS?C.grid[(r+1)*COLS+c]:null;
    ell(g,cx,cy,21,13,'#6d7680');if(c+1<COLS&&rs.s===1){g.fillStyle='#6d7680';g.fillRect(cx,cy-12,CELLW,24)}if(ds&&ds.s===1){g.fillStyle='#6d7680';g.fillRect(cx-20,cy,40,CELLH)}
    ell(g,cx-4,cy-4,12,6,'#8f99a4');g.fillStyle='#b4bdc7';g.fillRect(cx-10,cy-6,5,2);g.fillStyle='#59616b';g.fillRect(cx+6,cy+6,8,2)}
  // Rand
  each((k,c,r,x0,y0,cx,cy)=>{
    g.fillStyle=r<MR?'#5a3a1c':RIM;
    if(k.kind==='tunnel')ell(g,cx,cy,9,9,r<MR?'#5a3a1c':RIM);else ell(g,cx,cy,24,16,r<MR?'#5a3a1c':RIM);
    g.fillStyle=r<MR?'#5a3a1c':RIM;
    if(OP(c+1,r)){if(same(k,c+1,r))g.fillRect(cx,cy-15,CELLW,30);else g.fillRect(cx,cy-7,CELLW,14)}
    if(OP(c,r+1)){if(same(k,c,r+1))g.fillRect(cx-23,cy,46,CELLH);else g.fillRect(cx-7,cy,14,CELLH)}
  });
  // Innen
  each((k,c,r,x0,y0,cx,cy)=>{
    if(k.kind==='tunnel')ell(g,cx,cy,6,6,DARK);else{ell(g,cx,cy,22,14,DARK);ell(g,cx,cy+2,21,11,'#3a2413');ell(g,cx,cy+4,19,8,'#46301b')}
    g.fillStyle=DARK;
    if(OP(c+1,r)){if(same(k,c+1,r)){g.fillRect(cx,cy-13,CELLW,26);g.fillStyle='#3a2413';g.fillRect(cx,cy-9,CELLW,18);g.fillStyle='#46301b';g.fillRect(cx,cy-4,CELLW,12)}else g.fillRect(cx,cy-5,CELLW,10)}
    g.fillStyle=DARK;
    if(OP(c,r+1)){if(same(k,c,r+1)){g.fillRect(cx-21,cy,42,CELLH);g.fillStyle='#3a2413';g.fillRect(cx-19,cy,38,CELLH);g.fillStyle='#46301b';g.fillRect(cx-17,cy+2,34,CELLH)}else g.fillRect(cx-5,cy,10,CELLH)}
  });
  const st=C.stats,foodFill=G.food/Math.max(1,G.foodCap),fungFill=G.fungus/Math.max(1,G.fungusCap),eggFill=C.eggAges.length/st.eggCap,matFill=G.mat/Math.max(1,G.matCap);
  each((k,c,r,x0,y0)=>{if(k.kind==='tunnel')return;
    drawRoom(g,k.kind,x0,y0,k.kind==='leaf'?foodFill:k.kind==='fstore'?fungFill:k.kind==='egg'?eggFill:k.kind==='clay'?matFill:0.6,tm,C.sp)});
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=C.grid[r*COLS+c],x0=c*CELLW,y0=r*CELLH;
    if(k.build){const p=k.build.prog/k.build.need;
      if(k.s===3){g.fillStyle='rgba(240,200,110,.22)';g.fillRect(x0+4,y0+4,40,24);g.strokeStyle='rgba(255,220,140,.8)';g.lineWidth=1;g.setLineDash([4,3]);g.strokeRect(x0+4.5,y0+4.5,39,23);g.setLineDash([])}
      g.fillStyle='#000a';g.fillRect(x0+8,y0+22,32,6);g.fillStyle='#f0b94a';g.fillRect(x0+9,y0+23,Math.round(30*p),4)}}
}
function marker(g,x,y,txt,c){ell(g,x,y,12,12,'#1a0e06');ell(g,x,y,10,10,c);g.fillStyle='#fff';g.font='700 13px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,x,y+1)}
function drawPond(g,C,tm){
  const w=C.water,x0=w.x-w.w/2;
  g.save();g.beginPath();g.rect(x0,GY,w.w,w.depth+2);g.clip();
  g.fillStyle='rgba(255,255,255,.35)';
  for(let i=0;i<w.w/14;i++){const x=x0+((i*14+tm*(8+w.size*3))%w.w),y=GY+3+((i*7)%Math.max(4,w.depth-4));g.fillRect(x,y,8,2)}
  g.restore();
  g.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<w.w/30;i++)g.fillRect(x0+((i*30+tm*14)%w.w),GY+1,10,1);
}
function drawColony(g,now,cam){
  const C=col,tm=now/1000;
  if(!C.soil){buildSoil(C);buildBg(C)}
  if(C.hillKey!==C.sp+moundH(C)){ensureSideExits(C);buildHill(C)}
  g.setTransform(RD,0,0,RD,0,0);g.fillStyle='#1b0f07';g.fillRect(0,0,VW,VH);
  g.setTransform(cam.z*RD,0,0,cam.z*RD,-cam.x*cam.z*RD,-cam.y*cam.z*RD);
  const day=sky(g);
  g.drawImage(C.bg,0,0);
  if(C.sp==='leaf')drawTree(g,C);
  g.drawImage(C.hill,0,0);
  if(COSM.flag&&T[C.tid]&&T[C.tid].owner===0)drawHillFlag(g,C,tm);
  g.fillStyle='rgba(8,14,40,'+((1-day)*0.45)+')';g.fillRect(0,0,CW,GY);
  g.drawImage(C.soil,0,GY-8);
  drawPond(g,C,tm);
  drawCaves(g,C,tm);
  if(C.items)for(const it of C.items){const k=C.grid[it.r*COLS+it.c];if(k.s===2)continue;
    const x=it.c*CELLW+CELLW/2,y=it.r*CELLH+CELLH/2,p=0.5+0.5*Math.sin(tm*2.4+it.c*1.7+it.r),sm=g.imageSmoothingEnabled;
    g.fillStyle=`rgba(255,226,120,${0.16+0.2*p})`;g.beginPath();g.arc(x,y,17+p*3,0,6.283);g.fill();
    g.imageSmoothingEnabled=false;g.drawImage(gemIcon(it.type),x-11,y-11,22,22);g.imageSmoothingEnabled=sm;
    g.fillStyle=`rgba(255,255,230,${0.5+0.5*p})`;g.fillRect(x+9,y-12,2,2);g.fillRect(x-12,y+8,2,2)}
  const hv=C.hover;
  if(C.buildSel&&C.buildSel!=='tunnel'){g.strokeStyle='rgba(250,230,160,.5)';g.setLineDash([3,4]);g.lineWidth=1;
    for(let r=0;r<MR;r++)for(let c=0;c<COLS;c++)if(inMound(C,c,r)&&!canPlace(C.buildSel,c,r))g.strokeRect(c*CELLW+3.5,r*CELLH+3.5,CELLW-7,CELLH-7);
    g.setLineDash([])}
  const mine=COSM.hat&&T[C.tid]&&T[C.tid].owner===0;
  for(const a of C.ants){drawAnt(g,a.x,a.y,a.hx,a.hy,a.ph,a.role,C.sp,a.carry,a.role==='s'?0.9:0.78);if(mine)drawHat(g,COSM.hat,a.x+(a.hx<0?-1:1)*5,a.y-4,1.5)}
  for(const p of C.parts){g.fillStyle=p.c;g.fillRect(p.x|0,p.y|0,3,3)}
  if(C.buildSel==='tunnel'){
    /* Tunnelansicht: grün = schon gegraben oder in Arbeit, rot = unbebaubar (Fels, Wasser) */
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const k=C.grid[r*COLS+c];let col2=null;
      if(k.s===2||k.s===3)col2='rgba(70,220,110,.34)';
      else if(r>=MR&&(k.s===1||isWaterCell(C,c,r)))col2='rgba(235,60,50,.42)';
      else if(r<MR&&!diggable(C,c,r))continue;
      if(col2){g.fillStyle=col2;g.fillRect(c*CELLW+1,r*CELLH+1,CELLW-2,CELLH-2)}
    }
    if(hv){const k=C.grid[hv.r*COLS+hv.c],bad=!k||k.s===1||isWaterCell(C,hv.c,hv.r)||!diggable(C,hv.c,hv.r);
      g.strokeStyle=bad?'#ff6a5a':'#c8ffd0';g.lineWidth=2;g.strokeRect(hv.c*CELLW+1,hv.r*CELLH+1,CELLW-2,CELLH-2);g.lineWidth=1}
  }else if(hv){const why=C.buildSel?canPlace(C.buildSel,hv.c,hv.r):'',x0=hv.c*CELLW,y0=hv.r*CELLH;
    if(C.buildSel){g.strokeStyle=why?'#e0523d':'#9be86a';g.lineWidth=2;g.strokeRect(x0+1,y0+1,CELLW-2,CELLH-2);g.lineWidth=1;
      if(!why){g.globalAlpha=0.65;ell(g,x0+24,y0+16,22,14,'#241408');drawRoom(g,C.buildSel,x0,y0,0.6,tm,C.sp);g.globalAlpha=1}}
    else{g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=1;g.strokeRect(x0+0.5,y0+0.5,CELLW-1,CELLH-1)}}
  if(C.pin){g.strokeStyle='#f0b94a';g.lineWidth=2;g.strokeRect(C.pin.c*CELLW+1,C.pin.r*CELLH+1,CELLW-2,CELLH-2);g.lineWidth=1}
  g.setTransform(1,0,0,1,0,0);
}

/* ===== Info-Texte für Hover und Klick ===== */
function compSize(C,c,r){
  const k0=C.grid[r*COLS+c];if(!k0||k0.s!==2||k0.kind==='tunnel'||!k0.kind)return 1;
  const seen=new Set([r*COLS+c]),q=[[c,r]];
  while(q.length){const[x,y]=q.pop();for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const j=ny*COLS+nx;
    if(!seen.has(j)&&C.grid[j].s===2&&C.grid[j].kind===k0.kind){seen.add(j);q.push([nx,ny])}}}
  return seen.size;
}
function roomInfo(C,c,r){
  const k=C.grid[r*COLS+c];if(!k)return null;
  if(k.s===1)return'<b>Fels</b><br>Hier lässt sich nicht graben.';
  if(k.build)return`<b>${ROOMS[k.build.kind].n} (im Bau)</b><br>Fortschritt: ${Math.round(k.build.prog/k.build.need*100)}%`;
  if(k.s===0){if(r<MR)return inMound(C,c,r)?'<b>Hügelmaterial</b><br>Hier kann gebaut werden.':null;return'<b>Erde</b><br>Zum Bauen brauchst du einen Gang daneben.'}
  const e=econC(C),S=C.stats,n=compSize(C,c,r),R=ROOMS[k.kind];
  let h=`<b>${R.n}</b>`+(n>1?` <span class="dim">(Verbund aus ${n} Kammern)</span>`:'')+`<br>${R.d}`;
  const f=v=>fmt(v);
  switch(k.kind){
    case'tunnel':h=`<b>Gang</b><br>Verbindet Räume. Ameisen laufen hier.`;break;
    case'leaf':h+=`<br>Blätter gesamt: ${Math.floor(G.food)} / ${G.foodCap}<br>Sammeln: ${f(e.forage*60)} pro Min.`;break;
    case'farm':h+=`<br>Züchterinnen: ${C.farmers} / ${S.farm*5}<br>Pilze: +${f(e.farmP*60)} pro Min., Blätter: -${f(e.farmUse*60)} pro Min.`;break;
    case'fstore':h+=`<br>Pilze gesamt: ${Math.floor(G.fungus)} / ${G.fungusCap}`;break;
    case'house':h+=`<br>Arbeiterinnen: ${C.w} / ${S.workerCap}`;break;
    case'egg':h+=`<br>Eier: ${C.eggAges.length} / ${S.eggCap}<br>Schlüpfen nach 2 Min., wartet bei vollen Häusern`;break;
    case'barracks':h+=`<br>Soldaten: ${e.sold} / ${S.soldierCap}`;break;
    case'pit':h+=`<br>Wasser: ${WATER_N[C.water.size]}, Auslastung ${Math.round(S.pit?e.pitEff/S.pit*100:0)}%<br>Material: +${f(e.mat*60)} pro Min. (alle Gruben)`;break;
    case'clay':h+=`<br>Material gesamt: ${Math.floor(G.mat)} / ${G.matCap}`;break;
    case'queen':h+=`<br>Eiablage: ${f(e.lay*60)} pro Min. (2 Pilze je Ei)<br>Eier: ${C.eggAges.length} / ${S.eggCap}`;break;
  }
  return h;
}
function antInfo(a){
  const lines={f:'Holt Blätter',d:'Gräbt Gänge und Räume',m:'Macht aus Blättern Pilze',s:'Verteidigt das Gebiet',w:'Holt Wasser für die Lehmgruben'};
  return`<b>${ROLE_N[a.role]}</b><br>${lines[a.role]}${a.carry?'<br>Trägt: '+({leaf:'Blatt',dirt:'Erde',fungus:'Pilz',water:'Wasser'})[a.carry]:''}`;
}
function colonyInfoAt(C,wx,wy){
  for(const a of C.ants)if(Math.abs(a.x-wx)<14&&Math.abs(a.y-wy)<10)return antInfo(a);
  const w=C.water;
  if(wy>=GY-4&&wy<=GY+w.depth&&Math.abs(wx-w.x)<=w.w/2)return`<b>${WATER_N[w.size]}</b><br>Wasserzugang (Stufe ${w.size}/5)<br>Versorgt ${w.size} Lehmgruben voll, weitere nur zu 25%`;
  if(wy<GY&&Math.abs(wx-ENT_X)<hwAt(C,GY-wy)&&!openAtC(C,Math.floor(wx/CELLW),Math.floor(wy/CELLH)))return`<b>Hügel</b><br>Höhe ${moundH(C)} / ${MR}. Wächst mit jeder ausgehöhlten Zelle.<br>Ausgehöhlt: ${dugCount(C)}`;
  const c=Math.floor(wx/CELLW),r=Math.floor(wy/CELLH);
  if(c<0||r<0||c>=COLS||r>=ROWS)return null;
  const fi=C.items&&C.items.find(i=>i.c===c&&i.r===r);
  if(fi)return`<b>Vergrabener Fund</b><br>${PW[fi.type]} +${fi.pct}%<br>Grabe einen Tunnel hierher, um ihn zu bergen.`;
  return roomInfo(C,c,r);
}
