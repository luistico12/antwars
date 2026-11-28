/* Hüte, Kronen, Muster und Schiffe.
   Alle Skins liegen als eigene, detaillierte SVG-Dateien in img/skins/ (Hüte, Kronen, Schiffe),
   werden einmal geladen und über Canvas gezeichnet. COSM wird aus dem Profil gesetzt. */
const COSM={hat:null,flag:null,crown:null,pattern:null,ship:null,wship:null,tship:null,bskin:null,tskin:null,rskin:null};

/* Gültige Schlüssel (Whitelist für Profil und Mehrspieler) */
const HAT_IDS=HATS.map(h=>h[0]);
const CROWN_IDS=['gold'].concat(CROWNS.map(c=>c[0]));
const SHIP_IDS=SHIPS.map(s=>s[0]);
const WSHIP_IDS=SHIP_IDS.slice(),TSHIP_IDS=SHIP_IDS.slice();

const SKIN_URL={
  hat:id=>`img/skins/hats/${id}.svg`,
  crown:id=>`img/skins/crowns/${id}.svg`,
  ship:id=>`img/skins/ships/${id}.svg`,
  wship:id=>`img/skins/wships/${id}.svg`,
  tship:id=>`img/skins/tships/${id}.svg`
};
const _skinImg=Object.create(null);
/* Bild zu einem Skin (einmal je Datei). Kronen fallen auf die Standardkrone zurück. */
function skinImg(kind,id){
  if(!id&&kind!=='crown')return null;
  if(!id)id='gold';
  const url=SKIN_URL[kind]&&SKIN_URL[kind](id);if(!url)return null;
  let im=_skinImg[url];
  if(!im){im=new Image();im.decoding='async';
    /* Nach dem Laden neu zeichnen, damit Krone, Hut und Schiff sofort auf der Karte stehen */
    im.onload=()=>{if(typeof ownDirty!=='undefined')ownDirty=true};
    im.src=url;_skinImg[url]=im}
  return im;
}
/* Zeichnet einen Skin mit Unterkante by und Breite w. false, solange er noch lädt. */
function drawSkin(g,kind,id,cx,by,w,h){
  const im=skinImg(kind,id);if(!im||!im.complete||!im.naturalWidth)return false;
  const sm=g.imageSmoothingEnabled,sq=g.imageSmoothingQuality;
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(im,cx-w/2,by-h,w,h);
  g.imageSmoothingEnabled=sm;g.imageSmoothingQuality=sq;
  return true;
}
function drawHat(g,id,cx,by,px){return drawSkin(g,'hat',id,cx,by,9*(px||1.5),6.75*(px||1.5))}
function drawCrown(g,id,cx,by,px){return drawSkin(g,'crown',id,cx,by,13*(px||2),7.3*(px||2))}
/* Größen im Spiel: Kriegsschiff deutlich größer, Boot normal, Handelsschiff klein */
function drawShip(g,id,hx,hy){return drawSkin(g,'ship',id,hx,hy+7,28,21)}
function drawWarShip(g,id,hx,hy){return drawSkin(g,'wship',id,hx,hy+7,36,27)}
function drawTradeShip(g,id,hx,hy){return drawSkin(g,'tship',id,hx,hy+5,21,15.75)}
function crownURL(id){return CROWN_IDS.includes(id)?SKIN_URL.crown(id):SKIN_URL.crown('gold')}

function preloadCosm(){
  for(const k of['hat','crown','ship','wship','tship'])if(COSM[k])skinImg(k,COSM[k]);
  skinImg('crown','gold');
}
function syncCosmetics(){const p=AW.profile;COSM.hat=p&&p.hat?p.hat:null;COSM.flag=p&&p.flag?p.flag:null;COSM.crown=p&&p.crown?p.crown:null;COSM.pattern=p&&p.pattern?p.pattern:null;COSM.ship=p&&p.ship?p.ship:null;COSM.wship=p&&p.wship?p.wship:null;COSM.tship=p&&p.tship?p.tship:null;COSM.bskin=p&&p.bskin?p.bskin:null;COSM.tskin=p&&p.tskin?p.tskin:null;COSM.rskin=p&&p.rskin?p.rskin:null;
  preloadCosm();
  if(typeof ownDirty!=='undefined')ownDirty=true}

const _flagImgs={};
function flagImg(id){if(!_flagImgs[id]){const im=new Image();const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="90" height="60">${FL[id]||''}</svg>`;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);_flagImgs[id]=im}return _flagImgs[id]}
function drawHillFlag(g,C,tm){
  const im=flagImg(COSM.flag);if(!im.complete||!im.naturalWidth)return;
  const top=GY-hillH(C)+6,w=44,h=29,wave=Math.sin(tm*3)*1.5;
  g.fillStyle='#d9d0b8';g.fillRect(ENT_X-1,top-h-12,3,h+14);
  const sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=true;g.drawImage(im,ENT_X+2,top-h-12+wave*0.3,w,h);g.imageSmoothingEnabled=sm;
}

/* ===== Muster: Funktion (x,y) -> 0 nichts, 1 hell, 2 dunkel ===== */
const _H=['........','.#.#....','#####...','#####...','.###....','..#.....','........','........'];
const _S=['...#....','..###...','.#####..','#######.','.#####..','..###...','...#....','........'];
const _A=['........','..#.....','.#.#....','#...#...','.#.#....','..#.....','........','........'];
const PATTERN_FN={
  stripes:(x,y)=>((x+y)%4<2)?1:0,
  diagonal:(x,y)=>((x+2*y)%6<2)?1:0,
  checker:(x,y)=>(((x>>1)+(y>>1))%2)?1:0,
  dots:(x,y)=>(x%3===1&&y%3===1)?1:0,
  bricks:(x,y)=>(y%4===0)?2:(((y>>2)%2?x%6===0:x%6===3)?2:0),
  hearts:(x,y)=>_H[y&7][x&7]==='#'?1:0,
  stars:(x,y)=>_S[y&7][x&7]==='#'?1:0,
  arrows:(x,y)=>_A[y&7][x&7]==='#'?1:0,
  waves:(x,y)=>{const w=((x+((y>>2)*2))%8)<4;return (y%4===1&&w)||(y%4===2&&!w)?1:0},
  grid:(x,y)=>(x%6===2||y%6===3)?((x%6===2&&y%6===3)?1:2):0,
  hexes:(x,y)=>{const px=(x+(((y>>1)&1)*3))%6,py=y%4;return ((py===0&&px!==0&&px!==5)||(py===2&&(px===0||px===5)))?1:0},
  scales:(x,y)=>{const px=x%4,py=y%4;return ((py===0&&(px===1||px===2))||(py===1&&(px===0||px===3)))?1:0},
  rakes:(x,y)=>((x*2+y*3)%9<2)?1:0,
  /* AntWars + */
  plus:(x,y)=>((y%7===3&&x%7>=1&&x%7<=5)||(x%7===3&&y%7>=1&&y%7<=5))?1:0,
  aurora:(x,y)=>{const w=Math.sin(x*0.55+y*0.35)+Math.sin(y*0.6-x*0.2)*0.6;return w>0.85?1:w<-0.85?2:0}
};
function drawPatternCell(g,id,x,y,cs){const f=PATTERN_FN[id];if(!f)return;const v=f(x,y);if(!v)return;
  g.fillStyle=v===1?'rgba(255,255,255,.38)':'rgba(0,0,0,.26)';g.fillRect(x*cs,y*cs,cs,cs)}
/* Szene für die Vorschau: 2× Auflösung, damit nichts verwaschen aussieht */
function pvCanvas(w,h,draw){
  const c=document.createElement('canvas');c.width=w*2;c.height=h*2;c.className='cos';c.setAttribute('aria-hidden','true');
  const g=c.getContext('2d');g.scale(2,2);draw(g,w,h);return c;
}
/* Wasser unter Booten */
function pvWater(g,w,h){
  const sky=g.createLinearGradient(0,0,0,h*0.55);sky.addColorStop(0,'#9fd4ec');sky.addColorStop(1,'#d8eef8');
  g.fillStyle=sky;g.fillRect(0,0,w,h*0.56);
  const sea=g.createLinearGradient(0,h*0.5,0,h);sea.addColorStop(0,'#3f8dbd');sea.addColorStop(1,'#1d4a72');
  g.fillStyle=sea;g.fillRect(0,h*0.52,w,h*0.48);
  g.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<7;i++)g.fillRect(((i*23)%(w-10))+2,h*0.6+((i*13)%(h*0.32)),7,1);
  g.fillStyle='rgba(255,255,255,.28)';for(let i=0;i<5;i++)g.fillRect(((i*31)%(w-14))+4,h*0.56+((i*7)%(h*0.1)),11,1);
  g.fillStyle='rgba(8,30,50,.22)';g.beginPath();g.ellipse(w*0.52,h-9,w*0.32,3.4,0,0,6.283);g.fill();
}
/* Land unter Mustern und Gebäuden */
function pvLand(g,w,h){
  g.fillStyle='#3f8f4a';g.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){const x=(i*37)%w,y=(i*53)%h;g.fillStyle=i%3?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';g.fillRect(x,y,3,2)}
  g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,h*0.74,w,h*0.26);
}
/* Abendhimmel hinter Hüten und Kronen */
function pvSky(g,w,h){
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#243356');gr.addColorStop(.55,'#5c5a86');gr.addColorStop(1,'#c88a72');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.fillStyle='rgba(6,10,20,.55)';g.beginPath();g.moveTo(0,h);g.lineTo(0,h*0.78);g.quadraticCurveTo(w*0.3,h*0.6,w*0.55,h*0.8);g.quadraticCurveTo(w*0.8,h*0.98,w,h*0.76);g.lineTo(w,h);g.closePath();g.fill();
  g.fillStyle='rgba(255,240,200,.5)';for(let i=0;i<9;i++)g.fillRect(((i*29)%(w-4))+2,4+((i*17)%(h*0.4)),1,1);
}
function cosPreview(kind,key){
  if(kind==='pattern')return pvCanvas(96,72,(g,w,h)=>{pvLand(g,w,h);for(let y=0;y<12;y++)for(let x=0;x<16;x++)drawPatternCell(g,key,x,y,w/16)});
  if(kind==='ship'||kind==='wship'||kind==='tship'){
    const k=kind==='wship'?1.02:kind==='tship'?0.66:0.86;
    return pvCanvas(96,72,(g,w,h)=>{pvWater(g,w,h);drawSkin(g,kind,key,w/2,h-10,w*0.8*k,w*0.6*k)})}
  if(kind==='hat')return pvCanvas(96,72,(g,w,h)=>{pvSky(g,w,h);g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(w/2,h-16,20,7,0,0,6.283);g.fill();drawSkin(g,'hat',key,w/2,h-10,w*0.62,h*0.46)});
  if(kind==='crown')return pvCanvas(96,72,(g,w,h)=>{pvSky(g,w,h);g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(w/2,h-14,26,6,0,0,6.283);g.fill();drawSkin(g,'crown',key,w/2,h-8,w*0.76,h*0.42)});
  return svPreview(kind,key);
}
/* Spielführer: Spieler mit den meisten Zellen (alle 0,5 s neu berechnet) */
let _lead={t:0,f:-1};
function leaderFid(now){if(now-_lead.t<500)return _lead.f;_lead.t=now;const a={};let best=-1,bn=0;
  for(const t of T)if(t.owner>=0){a[t.owner]=(a[t.owner]||0)+t.cells.length}
  for(const k in a)if(a[k]>bn){bn=a[k];best=+k}
  return _lead.f=best}

/* Mehrspieler: Kosmetik der Spieler wird beim Start gemeldet und vom Host verteilt (nur Whitelist-Schlüssel) */
const cosmPack=()=>({crown:COSM.crown,pattern:COSM.pattern,ship:COSM.ship,wship:COSM.wship,tship:COSM.tship,flag:COSM.flag,bskin:COSM.bskin});
function cosmClean(c){const o={};const A={crown:CROWN_IDS,pattern:Object.keys(PATTERN_FN),ship:SHIP_IDS,wship:WSHIP_IDS,tship:TSHIP_IDS,flag:Object.keys(FL),bskin:Object.keys(BSKINS)};
  if(c&&typeof c==='object'){for(const k in A)if(typeof c[k]==='string'&&A[k].includes(c[k]))o[k]=c[k]}return o}
function cosmOf(fid){if(fid===0)return COSM;if(typeof ST!=='undefined'&&ST.hideCosm)return{};return(F[fid]&&F[fid].cosm)||{}}
