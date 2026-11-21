
var RD=1;
'use strict';
/* ===== Hilfen ===== */
const $=(s,e=document)=>e.querySelector(s);
const $$=(s,e=document)=>[...e.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const mixc=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const rgb=(c,a)=>a==null?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash2(x,y,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1274126177);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,s){return vnoise(x,y,s)*0.55+vnoise(x*2,y*2,s+1)*0.3+vnoise(x*4,y*4,s+2)*0.15}
class Heap{constructor(){this.a=[]}get size(){return this.a.length}
  push(k,v){const a=this.a;a.push([k,v]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p}}
  pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<a.length&&a[l][0]<a[m][0])m=l;if(r<a.length&&a[r][0]<a[m][0])m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m}}return top}}

/* ===== Daten ===== */
let GW=96,GH=60;const CS=10;
/* Spielmodi: Gegnerzahl und Kartengröße (scale = Faktor der Fläche) */
const MODES={ffa:{n:'FFA',bots:7,scale:1,d:'Jeder gegen jeden: 7 Gegner auf der Standardkarte'},unlimited:{n:'Unlimited',bots:5,scale:3.5,d:'Riesige Karte (3,5× so groß), 5 Gegner, kein Sieg und kein Ende'}};
function setMapDims(scale){const k=Math.sqrt(scale);GW=Math.round(96*k);GH=Math.round(60*k)}
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const TERR=[
  {id:0,name:'Savanne',base:[204,168,96],alt:[188,150,80],food:0.05,mat:0.30},
  {id:1,name:'Wiese',base:[134,180,88],alt:[118,166,76],food:0.22,mat:0.10},
  {id:2,name:'Wald',base:[60,124,68],alt:[48,106,58],food:0.38,mat:0.0}
];
const SP={
  ground:{id:'ground',name:'Bodenameisen',terr:1,dig:1.15,egg:1.15,forage:1,farm:1,atk:1.1,def:1,
    blurb:'Ausgewogen. Starten auf Wiesen. +15% Graben, +15% Eiablage, +10% Angriff.',body:'#2a1a10',acc:'#c0452e'},
  leaf:{id:'leaf',name:'Blattschneider',terr:2,dig:1,egg:1,forage:1.35,farm:1.3,atk:1,def:1,
    blurb:'Leben in den Bäumen. Starten im Wald. +35% Sammeln, +30% Pilzernte.',body:'#1d2a12',acc:'#6cc04a'},
  termite:{id:'termite',name:'Termiten',terr:0,dig:1.25,egg:0.9,forage:1,farm:1,atk:0.95,def:1.25,
    blurb:'Bauen riesige Hügel. Starten in der Savanne. +25% Graben, +25% Verteidigung, langsamere Eier.',body:'#6b4a24',acc:'#f0d9a0'}
};
const SP_BY_TERR=['termite','ground','leaf'];
const NAMES=['Hügelmark','Dornental','Rindenwacht','Sonnenwiese','Krumenfeld','Moosgrund','Staubebene','Harzwald','Lehmkuppe','Nebelsaum',
  'Brombeerhain','Kiesbett','Farnklamm','Dünenrand','Wurzelstein','Sandmulde','Eichenhorst','Tauwiese','Aschenfeld','Grashalm','Pilzgrund','Salzpfanne','Birkenhain','Trockental','Klettenfeld','Quellgrund'];

/* ===== Kartengenerator: ein zusammenhängender Kontinent, keine Inseln ===== */
function largestComponent(land){
  const comp=new Int16Array(GW*GH).fill(-1),sizes=[];
  for(let i=0;i<land.length;i++){
    if(!land[i]||comp[i]>=0)continue;
    const id=sizes.length;let n=0;const st=[i];comp[i]=id;
    while(st.length){const k=st.pop();n++;const x=k%GW,y=(k/GW)|0;
      for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(land[j]&&comp[j]<0){comp[j]=id;st.push(j)}}}
    sizes.push(n);
  }
  let b=0;sizes.forEach((s,i)=>{if(s>sizes[b])b=i});
  const out=new Uint8Array(land.length);for(let i=0;i<land.length;i++)out[i]=comp[i]===b?1:0;return out;
}
function fillLakes(land){
  const sea=new Uint8Array(GW*GH),st=[];
  const seed=(x,y)=>{const i=y*GW+x;if(!land[i]&&!sea[i]){sea[i]=1;st.push(i)}};
  for(let x=0;x<GW;x++){seed(x,0);seed(x,GH-1)}
  for(let y=0;y<GH;y++){seed(0,y);seed(GW-1,y)}
  while(st.length){const k=st.pop();const x=k%GW,y=(k/GW)|0;
    for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(!land[j]&&!sea[j]){sea[j]=1;st.push(j)}}}
  for(let i=0;i<land.length;i++)if(!land[i]&&!sea[i])land[i]=1;
}
/* Flüsse: von der Küste ins Land gegraben (4-verbunden, enden im Land, trennen nichts ab) */
function carveRivers(land,rnd,count){
  /* Fluss: von der Küste landeinwärts, weiche Windungen (Kurs ändert sich nur langsam), am Mund breiter */
  const coast=[];
  for(let y=1;y<GH-1;y++)for(let x=1;x<GW-1;x++){const i=y*GW+x;if(!land[i])continue;if(N4.some(([dx,dy])=>!land[(y+dy)*GW+x+dx]))coast.push(i)}
  let cx=0,cy=0,n=0;for(let i=0;i<land.length;i++)if(land[i]){cx+=i%GW;cy+=(i/GW)|0;n++}cx/=n;cy/=n;
  const SQ=Math.sqrt(GW/96),starts=[];
  for(let r=0;r<count&&coast.length;r++){
    /* Mündung: Küstenpunkt, von dem aus ein langer Weg ins Landesinnere frei ist, weit weg von anderen Mündungen */
    let s=0,bs=-1,brun=0;
    for(let k=0;k<30;k++){const c=coast[Math.floor(rnd()*coast.length)],x0=c%GW,y0=(c/GW)|0,a0=Math.atan2(cy-y0,cx-x0);
      let run=0;while(run<200){const qx=Math.round(x0+Math.cos(a0)*(run+2)),qy=Math.round(y0+Math.sin(a0)*(run+2));if(qx<0||qy<0||qx>=GW||qy>=GH||!land[qy*GW+qx])break;run++}
      let d=1e9;for(const[qx,qy]of starts)d=Math.min(d,Math.hypot(qx-x0,qy-y0));
      const sc=run+Math.min(d,30)*0.5;if(sc>bs){bs=sc;s=c;brun=run}}
    let x=s%GW,y=(s/GW)|0;starts.push([x,y]);
    const toC=Math.atan2(cy-y,cx-x),len=Math.max(8,Math.round(brun*(0.7+rnd()*0.25)/0.8));
    let h=toC+(rnd()-0.5)*0.8,turn=0;const mine=new Set([s]);land[s]=0;
    let st=0;
    for(let it=0;it<len*4&&st<len;it++){
      turn=turn*0.85+(rnd()-0.5)*0.35;h+=turn;
      let dh=toC-h;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;h+=dh*0.04;
      x+=Math.cos(h)*0.8;y+=Math.sin(h)*0.8;
      const ix=Math.round(x),iy=Math.round(y);
      if(ix<3||iy<3||ix>=GW-3||iy>=GH-3){x-=Math.cos(h)*0.8;y-=Math.sin(h)*0.8;h=toC;continue}
      const wide=SQ>=1,cells=[[ix,iy]];if(wide){const px=Math.abs(Math.cos(h))<0.7?1:0;cells.push(px?[ix+1,iy]:[ix,iy+1])}
      let stop=false;
      for(const[qx,qy]of cells){const j=qy*GW+qx;if(!land[j])continue;
        if(st>5&&N4.some(([dx,dy])=>{const q=(qy+dy)*GW+qx+dx;return !land[q]&&!mine.has(q)}))stop=true}
      if(stop)break;
      for(const[qx,qy]of cells){const j=qy*GW+qx;if(land[j]){land[j]=0;mine.add(j)}}
      st++;
    }
  }
}
function buildMap(seed){
  const SC=GW*GH/(96*60),SQ=Math.sqrt(SC);
  for(let att=0;att<300;att++){
    const s=((seed+att*7919)>>>0)&0xffffff;
    const rnd=mulberry32(s);
    let land=new Uint8Array(GW*GH);
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
      const nx=(x/GW-0.5)*2,ny=(y/GH-0.5)*2,d=Math.sqrt(nx*nx*0.85+ny*ny*1.2);
      const v=fbm(x/(20*SQ),y/(20*SQ),s&0xffff)*0.7+(1-d)*0.6;
      land[y*GW+x]=(v>0.5&&x>3&&y>3&&x<GW-4&&y<GH-4)?1:0;
    }
    land=largestComponent(land);fillLakes(land);
    let n=0;for(let i=0;i<land.length;i++)n+=land[i];
    if(n<1900*SC||n>3400*SC)continue;
    carveRivers(land,rnd,Math.max(3,Math.round(3*SC)));land=largestComponent(land);
    const idx=[];for(let i=0;i<land.length;i++)if(land[i])idx.push(i);
    const seeds=[];
    const wantS=Math.round(20*SC);
    for(let k=0;k<8000*SC&&seeds.length<wantS;k++){
      const i=idx[Math.floor(rnd()*idx.length)],x=i%GW,y=(i/GW)|0;
      if(seeds.every(q=>Math.hypot(q.x-x,q.y-y)>=10.5))seeds.push({x,y,i});
    }
    if(seeds.length<wantS*0.75)continue;
    const tid=new Int16Array(GW*GH).fill(-1),dist=new Float64Array(GW*GH).fill(1e9),h=new Heap();
    seeds.forEach((q,k)=>{dist[q.i]=0;tid[q.i]=k;h.push(0,q.i)});
    while(h.size){
      const[d,i]=h.pop();if(d>dist[i])continue;const x=i%GW,y=(i/GW)|0;
      for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(!land[j])continue;
        const nd=d+0.6+rnd();if(nd<dist[j]){dist[j]=nd;tid[j]=tid[i];h.push(nd,j)}}
    }
    const terrs=seeds.map((q,k)=>({id:k,cells:[],adj:[],owner:-1,troops:0,isCap:false,terrain:1,name:'',moist:0,cx:0,cy:0,lx:q.x,ly:q.y}));
    for(let i=0;i<land.length;i++){if(tid[i]<0)continue;const x=i%GW,y=(i/GW)|0,t=terrs[tid[i]];
      t.cells.push(i);t.cx+=x;t.cy+=y;t.moist+=fbm(x/14+30,y/14+30,(s&0xffff)+9)}
    const adj=terrs.map(()=>new Set());
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const i=y*GW+x;if(tid[i]<0)continue;
      for(const[dx,dy]of[[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=GW||ny>=GH)continue;const j=ny*GW+nx;
        if(tid[j]>=0&&tid[j]!==tid[i]){adj[tid[i]].add(tid[j]);adj[tid[j]].add(tid[i])}}}
    const order=terrs.slice();
    terrs.forEach(t=>{const c=t.cells.length;t.cx/=c;t.cy/=c;t.moist/=c;t.adj=[...adj[t.id]];
      let bd=1e9;for(const i of t.cells){const x=i%GW,y=(i/GW)|0;
        let interior=true;for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH||tid[ny*GW+nx]!==t.id){interior=false;break}}
        const d=Math.hypot(x-t.cx,y-t.cy)+(interior?0:6);if(d<bd){bd=d;t.lx=x;t.ly=y}}});
    order.sort((a,b)=>a.moist-b.moist);
    const nT=terrs.length,nDry=Math.round(nT*0.3),nGrass=Math.round(nT*0.35);
    order.forEach((t,k)=>{t.terrain=k<nDry?0:k<nDry+nGrass?1:2});
    const names=NAMES.slice();
    const PRE=['Nord','Süd','Ost','West','Alt','Neu','Hoch','Tief'];for(const p of PRE)for(const nm of NAMES)names.push(p+nm.toLowerCase());
    for(let i=names.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[names[i],names[j]]=[names[j],names[i]]}
    terrs.forEach((t,k)=>t.name=names[k]);
    return{seed:s,land,tid,terrs};
  }
  throw new Error('Karte konnte nicht erzeugt werden');
}

/* ===== Karte zeichnen (statische Basis + Besitzer-Schicht) ===== */
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function renderBase(m){
  const c=makeCanvas(GW*CS,GH*CS),g=c.getContext('2d'),s=m.seed&0xffff;
  const isLand=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&m.land[y*GW+x]===1;
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const i=y*GW+x;
    if(!m.land[i]){
      let near=false;for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++)if(isLand(x+dx,y+dy)){near=true;break}
      g.fillStyle=near?'#3d86ad':(hash2(x,y,s)<0.5?'#2c6a93':'#2a6390');g.fillRect(x*CS,y*CS,CS,CS);
      if(hash2(x,y,s+5)<0.05){g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x*CS+2,y*CS+4,5,1)}
    }else{
      const t=TERR[m.terrs[m.tid[i]].terrain],v=hash2(x,y,s+3);
      g.fillStyle=rgb(mixc(t.base,t.alt,v));g.fillRect(x*CS,y*CS,CS,CS);
      const hh=hash2(x,y,s+11);
      if(t.id===2&&hh<0.2){g.fillStyle='#4a2f1a';g.fillRect(x*CS+4,y*CS+6,2,4);g.fillStyle='#235a30';g.fillRect(x*CS+1,y*CS+2,8,5);g.fillStyle='#2f7a40';g.fillRect(x*CS+3,y*CS,4,3)}
      else if(t.id===1&&hh<0.14){g.fillStyle='#5f9a48';g.fillRect(x*CS+2,y*CS+5,1,3);g.fillRect(x*CS+5,y*CS+4,1,4);g.fillRect(x*CS+7,y*CS+6,1,2)}
      else if(t.id===0&&hh<0.08){g.fillStyle='#8b6b34';g.fillRect(x*CS+3,y*CS+5,5,3);g.fillStyle='#a8854a';g.fillRect(x*CS+3,y*CS+5,5,1)}
    }
  }
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const i=y*GW+x;if(!m.land[i])continue;
    for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;
      const water=!isLand(nx,ny);
      if(!water)continue;
      g.fillStyle='rgba(245,235,190,.9)';
      const w=2;
      if(dx===1)g.fillRect(x*CS+CS-w,y*CS,w,CS);else if(dx===-1)g.fillRect(x*CS,y*CS,w,CS);
      else if(dy===1)g.fillRect(x*CS,y*CS+CS-w,CS,w);else g.fillRect(x*CS,y*CS,CS,w);
    }
  }
  return c;
}
/* Zwei Gebiete verschmelzen, wenn sie demselben Volk gehören (Marionettenstaaten und wilde Gebiete nicht) */
function mergedTerr(a,b){return a.owner>=0&&a.owner===b.owner&&!a.puppet&&!b.puppet}
function renderOwners(m,F){
  const c=makeCanvas(GW*CS,GH*CS),g=c.getContext('2d');
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const i=y*GW+x,tt=m.tid[i];if(tt<0)continue;const A=m.terrs[tt],o=A.owner;
    if(o>=0){g.fillStyle=rgb(F[o].rgb,0.36);g.fillRect(x*CS,y*CS,CS,CS);{const pc=typeof cosmOf==='function'?cosmOf(o).pattern:null;if(pc)drawPatternCell(g,pc,x,y,CS)}}
    for(const[dx,dy]of N4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;
      if(m.tid[j]<0||m.tid[j]===tt)continue;const B=m.terrs[m.tid[j]];
      if(mergedTerr(A,B))continue;
      g.fillStyle='rgba(30,18,8,.72)';
      if(dx===1)g.fillRect(x*CS+CS-2,y*CS,2,CS);else if(dx===-1)g.fillRect(x*CS,y*CS,2,CS);
      else if(dy===1)g.fillRect(x*CS,y*CS+CS-2,CS,2);else g.fillRect(x*CS,y*CS,CS,2);
      if(o>=0&&B.owner!==o){g.fillStyle=rgb(F[o].rgb,0.95);
        if(dx===1)g.fillRect(x*CS+CS-4,y*CS,4,CS);else if(dx===-1)g.fillRect(x*CS,y*CS,4,CS);
        else if(dy===1)g.fillRect(x*CS,y*CS+CS-4,CS,4);else g.fillRect(x*CS,y*CS,CS,4)}}
  }
  return c;
}
