/* Hüte (Pixelart) und Ausrüstung. COSM wird aus dem Profil gesetzt und vom Spiel beim Zeichnen gelesen. */
const HAT_ART={
cap:{p:{r:'#e04b4b',d:'#9f2b2b',w:'#fff'},m:['..rrrr..','.rrrwrr.','rrrrrrrdd']},
flower:{p:{p:'#ff8ac8',y:'#ffd23f',g:'#4caf50'},m:['.p.p.','pypyp','.pyp.','..g..']},
party:{p:{a:'#6fd3ff',b:'#ff6fb5',y:'#ffd23f'},m:['..y..','..a..','.aba.','.bab.','abab']},
helmet:{p:{s:'#aeb8c8',d:'#6d7788',h:'#e8eef8'},m:['..ssss..','.shhsss.','sssssssd','dddddddd']},
top:{p:{k:'#22252e',r:'#ff5757',h:'#4a4f5c'},m:['.kkkkk.','.khkkk.','.krrrk.','kkkkkkk']},
pirate:{p:{k:'#1e2128',w:'#f2f2f2',g:'#caa24a'},m:['..kkkk..','.kkwwkk.','kkkwwkkk','kgkkkkgk']},
wizard:{p:{b:'#5b3fd1',y:'#ffd23f',d:'#3a2796'},m:['...b...','..bb...','..byb..','.bbbbb.','bbbbbbb','ddddddd']},
crown:{p:{y:'#ffcf3a',o:'#d99a12',r:'#ff4d6d'},m:['y.y.y.y','yyyyyyy','yryoyry','ooooooo']},
halo:{p:{y:'#fff3a8',o:'#ffd23f'},m:['.yyyyy.','y.....y','.ooooo.']}
};
const COSM={hat:null,flag:null,crown:null,pattern:null,ship:null};
function drawHat(g,id,cx,by,px){
  const a=HAT_ART[id];if(!a)return;const w=a.m.reduce((m,r)=>Math.max(m,r.length),0),h=a.m.length;
  const x0=Math.round(cx-w*px/2),y0=Math.round(by-h*px);
  a.m.forEach((row,j)=>{for(let i=0;i<row.length;i++){const c=row[i];if(c==='.')continue;g.fillStyle=a.p[c]||'#fff';g.fillRect(x0+i*px,y0+j*px,px,px)}});
}
function hatPreview(id,size){const c=document.createElement('canvas');c.width=64;c.height=54;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  /* kleiner Ameisenkopf als Träger */
  g.fillStyle='#2a1a10';g.beginPath();g.arc(32,40,11,0,7);g.fill();g.fillStyle='#fff';g.fillRect(27,38,3,3);g.fillRect(35,38,3,3);g.fillStyle='#000';g.fillRect(28,39,2,2);g.fillRect(36,39,2,2);
  drawHat(g,id,32,32,5);return c}
function syncCosmetics(){const p=AW.profile;COSM.hat=p&&p.hat?p.hat:null;COSM.flag=p&&p.flag?p.flag:null;COSM.crown=p&&p.crown?p.crown:null;COSM.pattern=p&&p.pattern?p.pattern:null;COSM.ship=p&&p.ship?p.ship:null;
  if(typeof ownDirty!=='undefined')ownDirty=true}

const _flagImgs={};
function flagImg(id){if(!_flagImgs[id]){const im=new Image();const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="90" height="60">${FL[id]||''}</svg>`;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);_flagImgs[id]=im}return _flagImgs[id]}
function drawHillFlag(g,C,tm){
  const im=flagImg(COSM.flag);if(!im.complete||!im.naturalWidth)return;
  const top=GY-hillH(C)+6,w=44,h=29,wave=Math.sin(tm*3)*1.5;
  g.fillStyle='#d9d0b8';g.fillRect(ENT_X-1,top-h-12,3,h+14);
  const sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=true;g.drawImage(im,ENT_X+2,top-h-12+wave*0.3,w,h);g.imageSmoothingEnabled=sm;
}

/* ===== Kronen, Muster, Schiffe (Pixelart, eigene Entwürfe) ===== */
const CROWN_ART={"gold": {"m": ["y.....y.....y", "yy...yyy...yy", "yyy.yyyyy.yyy", "yyyyyyyyyyyyy", "yyyyyyryyyyyy", "ooooooooooooo"], "p": {"y": "#ffd23f", "o": "#d9981a", "r": "#ff4d6d"}}, "monarch": {"m": ["r.....r.....r", "y.....y.....y", "yy...yyy...yy", "yyy.yyyyy.yyy", "ypyypyryypypy", "ooooooooooooo"], "p": {"y": "#ffd23f", "o": "#d9981a", "r": "#ff4d6d", "p": "#8a3fd1"}}, "ruby": {"m": ["b..b..b..b..b", "m..m..m..m..m", "mm.mm.mm.mm.m", "mmmmmmmmmmmmm", "mlmmlmmlmmlmm", "ddddddddddddd"], "p": {"b": "#ff3b5c", "m": "#c01f45", "l": "#ff9aa9", "d": "#6e0f2a"}}, "amethyst": {"m": ["......l......", "......p......", "..l...p..l...", "..p..lpp.p.l.", ".lp.lppp.pp..", ".pp.ppppppp..", "sssssssssssss", "wwwwwwwwwwwww"], "p": {"p": "#9a5cf0", "l": "#d9bfff", "s": "#e8eef8", "w": "#aab4c6"}}, "laurel": {"m": ["g.y..y.y..y.g", "gg.y.yyy.y.gg", "gyyyyyyyyyyyg", ".gyyyryyyyg..", ".gyyyyyyyyg..", "..oooooooo..."], "p": {"y": "#ffd23f", "o": "#d9981a", "r": "#ff4d6d", "g": "#4caf50"}}, "halo": {"m": ["..hhhhhhhhh..", ".h.........h.", "..hhhhhhhhh..", ".............", "y..y..y..y..y", "y..y..y..y..y", "yyyyyyyyyyyyy", "ybyyybyyybyyb", "ooooooooooooo"], "p": {"h": "#fff3a8", "y": "#ffcf3a", "o": "#d99a12", "b": "#4aa3ff"}}, "inferno": {"m": ["..f..f..f..f.", ".fof.fof.fof.", ".fkf.fkf.fkf.", "kkkkkkkkkkkkk", "kokkkokkkokkk", "kkkkkkkkkkkkk", "ooooooooooooo"], "p": {"k": "#23252d", "o": "#ff7a1a", "f": "#ffcf3a"}}, "prism": {"m": ["c..b..p..y..c", "cc.bb.pp.yy.c", "cccbbbppyyycc", "ccccbbpppyyyy", "wwwwwwwwwwwww", "wbwwpwwywwcww"], "p": {"c": "#7fe3ff", "b": "#7aa8ff", "p": "#c58bff", "y": "#ffe27a", "w": "#f4f6ff"}}};
const SHIP_ART={"viking": {"m": ["......k.......", "......kffffff.", "......kwwwwww.", "......kffffff.", "......kwwwwww.", "......k.......", "......k.......", "b............b", "bbbbbbbbbbbbbb", ".dddddddddddd.", "..dddddddddd.."], "p": {"b": "#b0793f", "d": "#6b4421", "k": "#22140a", "w": "#f2e8d0"}}, "leaf": {"m": [".......k......", "......gg......", ".....gggg.....", "....ggllgg....", "....gglggg....", ".......k......", ".......k......", "..............", ".bbbbbbbbbbbb.", "..dddddddddd..", "....dddddd...."], "p": {"b": "#5aa83c", "d": "#3b7a2a", "g": "#7ccf55", "l": "#a6e87f", "k": "#22140a"}}, "pirate": {"m": ["......kff.....", "......kfff....", ".....kkkkkkk..", ".....kwwkwwk..", ".....kkwwkkk..", ".....kwkkwkk..", "......k.......", "b............b", "bbbbbbbbbbbbbb", ".dddddddddddd.", "..dddddddddd.."], "p": {"b": "#2e2e3a", "d": "#16161c", "k": "#111114", "w": "#f2f2f2"}}, "steam": {"m": ["........ss....", ".......ssk....", ".......kkk....", ".......kkk....", "....wwwwwww...", "....wcwcwcw...", "....wwwwwww...", "..............", "bbbbbbbbbbbbbb", ".dddddddddddd.", "..dddddddddd.."], "p": {"b": "#b8c0cc", "d": "#6d7788", "k": "#2a2d36", "w": "#eef2f8", "c": "#6fb7ff", "s": "#cfd5de"}}, "duck": {"m": ["..............", ".....yyy......", "....yyyyy.....", "....ykyyoo....", "....yyyyy.....", ".....yyy......", "..yyyyyyyyy...", ".yyyyyyyyyyyy.", ".yyyyyyyyyyyyy", "..yyyyyyyyyy..", "...oooooooo..."], "p": {"y": "#ffd23f", "o": "#ff8a1f", "k": "#111114"}}, "golden": {"m": ["......k.......", "......kffffff.", "......kfffff..", "......kffff...", "......kff.....", "......k.......", "......k.......", "b............b", "bbbbbbbbbbbbbb", ".dddddddddddd.", "..dddddddddd.."], "p": {"b": "#ffd23f", "d": "#d9981a", "k": "#6b4421", "f": "#ff4d4d"}}};

/* Muster: Funktion (x,y) -> 0 nichts, 1 hell, 2 dunkel; jede Karten-Zelle ist ein Musterpunkt */
const _H=['........','.#.#....','#####...','#####...','.###....','..#.....','........','........'];
const _S=['...#....','...#....','#######.','...#....','...#....','........','........','........'];
const PATTERN_FN={
  stripes:(x,y)=>((x+y)%4<2)?1:0,
  checker:(x,y)=>(((x>>1)+(y>>1))%2)?1:0,
  dots:(x,y)=>(x%3===1&&y%3===1)?1:0,
  bricks:(x,y)=>(y%4===0)?2:(((y>>2)%2?x%6===0:x%6===3)?2:0),
  hearts:(x,y)=>_H[y&7][x&7]==='#'?1:0,
  stars:(x,y)=>_S[y&7][x&7]==='#'?1:0,
  waves:(x,y)=>{const w=((x+((y>>2)*2))%8)<4;return (y%4===1&&w)||(y%4===2&&!w)?1:0},
  grid:(x,y)=>(x%6===2||y%6===3)?((x%6===2&&y%6===3)?1:2):0
};
function drawPatternCell(g,id,x,y,cs){const f=PATTERN_FN[id];if(!f)return;const v=f(x,y);if(!v)return;
  g.fillStyle=v===1?'rgba(255,255,255,.38)':'rgba(0,0,0,.26)';g.fillRect(x*cs,y*cs,cs,cs)}
function patternPreview(id){const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');
  g.fillStyle='#3f8f4a';g.fillRect(0,0,64,64);for(let y=0;y<16;y++)for(let x=0;x<16;x++)drawPatternCell(g,id,x,y,4);return c}

function drawPix(g,a,cx,by,px,fc){
  const w=a.m.reduce((m,r)=>Math.max(m,r.length),0),h=a.m.length,x0=Math.round(cx-w*px/2),y0=Math.round(by-h*px);
  a.m.forEach((row,j)=>{for(let i=0;i<row.length;i++){const c=row[i];if(c==='.')continue;g.fillStyle=(c==='f'&&fc)?fc:(a.p[c]||'#fff');g.fillRect(x0+i*px,y0+j*px,px,px)}});
}
/* Krone über dem Namen: id null = Standardkrone */
function drawCrown(g,id,cx,by,px){drawPix(g,CROWN_ART[id]||CROWN_ART.gold,cx,by,px||2)}
const _crownURL={};
function crownURL(id){id=CROWN_ART[id]?id:'gold';if(!_crownURL[id]){const c=document.createElement('canvas');c.width=30;c.height=18;const g=c.getContext('2d');drawCrown(g,id,15,17,2);_crownURL[id]=c.toDataURL()}return _crownURL[id]}
function crownPreview(id){const c=document.createElement('canvas');c.width=78;c.height=48;const g=c.getContext('2d');g.imageSmoothingEnabled=false;drawCrown(g,id,39,40,5);return c}
/* Schiff: Mittelpunkt hx, Wasserlinie hy */
function drawShip(g,id,hx,hy,fc){const a=SHIP_ART[id];if(!a)return false;drawPix(g,a,hx,hy+7,2,fc);return true}
function shipPreview(id){const c=document.createElement('canvas');c.width=84;c.height=60;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle='#2b6fa8';g.fillRect(0,40,84,20);g.fillStyle='#3a86c4';for(let x=0;x<84;x+=12)g.fillRect(x,44,6,2);
  const a=SHIP_ART[id];if(a)drawPix(g,a,42,46,4,'#ff5757');return c}
/* Spielführer: Spieler mit den meisten Zellen (alle 0,5 s neu berechnet) */
let _lead={t:0,f:-1};
function leaderFid(now){if(now-_lead.t<500)return _lead.f;_lead.t=now;const a={};let best=-1,bn=0;
  for(const t of T)if(t.owner>=0){a[t.owner]=(a[t.owner]||0)+t.cells.length}
  for(const k in a)if(a[k]>bn){bn=a[k];best=+k}
  return _lead.f=best}

/* Mehrspieler: Kosmetik der Spieler wird beim Start gemeldet und vom Host verteilt (nur Whitelist-Schlüssel) */
const cosmPack=()=>({crown:COSM.crown,pattern:COSM.pattern,ship:COSM.ship,flag:COSM.flag});
function cosmClean(c){const o={};if(c&&typeof c==='object'){for(const[k,A]of[['crown',CROWN_ART],['pattern',PATTERN_FN],['ship',SHIP_ART],['flag',FL]])if(typeof c[k]==='string'&&Object.prototype.hasOwnProperty.call(A,c[k]))o[k]=c[k]}return o}
function cosmOf(fid){if(fid===0)return COSM;if(typeof ST!=='undefined'&&ST.hideCosm)return{};return(F[fid]&&F[fid].cosm)||{}}
