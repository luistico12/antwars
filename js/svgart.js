/* ===== Hochauflösende Vektor-Grafiken (SVG) für Gebäude, Händler, Schiffe und Wege-Stile =====
   Jede Grafik wird einmal als SVG gebaut, in 4facher Auflösung in ein Canvas gezeichnet und danach nur noch skaliert. */
const SV_SCALE=4;
const _svc=new Map();
function svSprite(key,w,h,build){
  let e=_svc.get(key);
  if(e)return e.ok?e.c:null;
  e={ok:false,c:document.createElement('canvas')};e.c.width=w*SV_SCALE;e.c.height=h*SV_SCALE;_svc.set(key,e);
  const im=new Image();
  im.onload=()=>{e.c.getContext('2d').drawImage(im,0,0,w*SV_SCALE,h*SV_SCALE);e.ok=true;if(typeof ownDirty!=='undefined'){ownDirty=true;strDirty=true}};
  im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w*SV_SCALE}" height="${h*SV_SCALE}">${build()}</svg>`);
  return null;
}
/* Stile: b = Grundfarbe, h = Licht, d = Schatten/Kontur, a = Dach/Akzent, g = Detail */
const BSKINS={
  default:{n:'Erdbau',price:0,p:{b:'#8a5a30',h:'#b9824e',d:'#3a2410',a:'#c0392b',g:'#e6c38a'}},
  stone:{n:'Steinburg',price:120,p:{b:'#8c919c',h:'#c1c6d0',d:'#3b3f48',a:'#5b6f9a',g:'#e9ecf2'}},
  mush:{n:'Pilzdorf',price:150,p:{b:'#e8dcc4',h:'#fff6e2',d:'#7a5a40',a:'#d9363e',g:'#ffffff'}},
  frost:{n:'Eisfestung',price:190,p:{b:'#9fd4ec',h:'#e6f8ff',d:'#3a6f96',a:'#5db6e8',g:'#ffffff'}},
  crystal:{n:'Kristallbau',price:240,p:{b:'#7b5cd6',h:'#c0a8ff',d:'#2e1f6b',a:'#41e0d0',g:'#e9f7ff'}},
  coral:{n:'Korallenburg',price:210,p:{b:'#e0708f',h:'#ffc2d2',d:'#7d2040',a:'#ffd23f',g:'#fff3f7'}},
  obsidian:{n:'Obsidianzitadelle',price:280,p:{b:'#3b3f4c',h:'#7b8496',d:'#0d0f14',a:'#ff3b5c',g:'#c9d2e0'}},
  neon:{n:'Neonbau',price:300,p:{b:'#14203a',h:'#2f6bff',d:'#070c16',a:'#41e0d0',g:'#8ff6ff'}},
  golden:{n:'Goldpalast',price:320,p:{b:'#e0b030',h:'#fff0a0',d:'#7a5410',a:'#c62f3a',g:'#fff8d0'}}
};
const TSKINS={
  default:{n:'Karrenameise',price:0,p:{b:'#3a2418',h:'#7a5230',d:'#1c1008',a:'#b9824e',g:'#f2c14e'}},
  moss:{n:'Mooswagen',price:100,p:{b:'#2f5a2c',h:'#6fb35a',d:'#14260f',a:'#8a6a3a',g:'#c8f08a'}},
  mail:{n:'Postameise',price:140,p:{b:'#26324a',h:'#4f78e0',d:'#0e1424',a:'#f2c14e',g:'#ffffff'}},
  shadow:{n:'Schattenhändler',price:170,p:{b:'#24202c',h:'#6b5a86',d:'#0b0910',a:'#8a3fd1',g:'#d9c6ff'}},
  royal:{n:'Königlicher Händler',price:190,p:{b:'#5a1f78',h:'#b86be0',d:'#220a30',a:'#f2c14e',g:'#fff3a8'}},
  jade:{n:'Jadehändler',price:220,p:{b:'#1d6b58',h:'#59d6a8',d:'#0a2a23',a:'#ffd23f',g:'#e9fff8'}},
  golden:{n:'Goldkutsche',price:240,p:{b:'#b8860b',h:'#ffe27a',d:'#5a3f05',a:'#fff3a8',g:'#ffffff'}}
};
/* Wege: edge = Rand, body = Belag, dash = Mittelmarkierung, acc = Spielerfarbe als Akzent (nur Standard) */
const RSKINS={
  default:{n:'Pfad',price:0,edge:'#6e4d28',body:'#cfa86a',dash:'#e8cf9a',w:3.8,acc:true},
  cobble:{n:'Kopfsteinpflaster',price:110,edge:'#3f434c',body:'#9aa0ab',dash:'#c9ced8',w:4.4,stones:true},
  moss:{n:'Moospfad',price:140,edge:'#23401f',body:'#5f9a4a',dash:'#9ed078',w:4},
  ice:{n:'Eisweg',price:200,edge:'#2c6b96',body:'#bfe9ff',dash:'#ffffff',w:4,glow:'#8fd6ff'},
  gold:{n:'Goldstraße',price:230,edge:'#7a5410',body:'#e0b030',dash:'#fff0a0',w:4.2,glow:'#ffe27a'},
  lava:{n:'Lavapfad',price:260,edge:'#3a0d05',body:'#8e2a12',dash:'#ff8a3d',w:4.2,glow:'#ff5a1a'},
  neon:{n:'Neonbahn',price:280,edge:'#0b1a2a',body:'#1f3a5a',dash:'#41e0d0',w:4,glow:'#41e0d0'}
};
const SKIN_KINDS={bskin:BSKINS,tskin:TSKINS,rskin:RSKINS};
const skinOf=(kind,id)=>(SKIN_KINDS[kind][id])||SKIN_KINDS[kind].default;
const hexA=(c)=>c;

/* ----- Gebäude ----- */
function svgCity(p,pc,sp){
  const flag=`<rect x="31" y="1" width="2" height="12" fill="${p.d}"/><path d="M33 1 H45 L41 5.2 L45 9.4 H33Z" fill="${pc}" stroke="${p.d}" stroke-width=".8" stroke-linejoin="round"/>`;
  if(sp==='termite')return `<ellipse cx="32" cy="42" rx="27" ry="4" fill="rgba(0,0,0,.28)"/>
<path d="M9 41 L20 22 L25 9 Q32 2 39 9 L44 22 L55 41Z" fill="${p.b}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>
<path d="M13 34 H51 M18 27 H46 M23 19 H41 M27 12 H37" stroke="${p.d}" stroke-width="1.2" opacity=".55"/>
<path d="M12 38 L21 23 L26 10 L22 24Z" fill="${p.h}" opacity=".55"/><path d="M26 41 Q26 31 32 31 Q38 31 38 41Z" fill="#150c05"/>
<rect x="31.2" y="-1" width="1.6" height="9" fill="${p.d}"/><path d="M32.8 -1 H42 L39.2 2 L42 5 H32.8Z" fill="${pc}" stroke="${p.d}" stroke-width=".7" stroke-linejoin="round"/>`;
  if(sp==='leaf')return `<ellipse cx="32" cy="42" rx="22" ry="3.4" fill="rgba(0,0,0,.28)"/>
<path d="M28 42 L29 20 H35 L36 42Z" fill="${p.b}" stroke="${p.d}" stroke-width="1.6" stroke-linejoin="round"/><path d="M29 20 L29.6 42 H28Z" fill="${p.h}" opacity=".6"/>
<g stroke="#17421e" stroke-width="1.6"><circle cx="32" cy="14" r="12" fill="#2f7a3a"/><circle cx="20" cy="22" r="8" fill="#2a6d34"/><circle cx="44" cy="22" r="8" fill="#2a6d34"/></g>
<circle cx="28" cy="10" r="5" fill="#52b05a" opacity=".7"/><path d="M29 42 Q29 35 32 35 Q35 35 35 42Z" fill="#150c05"/>
<path d="M32 2 H44 L41 5 L44 8 H32Z" fill="${pc}" stroke="${p.d}" stroke-width=".8" stroke-linejoin="round"/><rect x="31" y="-2" width="1.8" height="12" fill="${p.d}"/>`;
  return `<ellipse cx="32" cy="42" rx="29" ry="4" fill="rgba(0,0,0,.28)"/>
<path d="M3 41 Q8 14 32 8 Q56 14 61 41Z" fill="${p.b}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>
<path d="M9 36 Q14 18 30 12 Q20 22 18 38Z" fill="${p.h}" opacity=".55"/>
<path d="M16 41 Q16 28 32 28 Q48 28 48 41Z" fill="${p.d}"/><path d="M21 41 Q21 32 32 32 Q43 32 43 41Z" fill="#150c05"/>
<g fill="${p.g}" opacity=".85"><circle cx="14" cy="30" r="1.3"/><circle cx="50" cy="29" r="1.3"/><circle cx="24" cy="20" r="1.1"/><circle cx="42" cy="19" r="1.1"/></g>${flag}`}
function svgTower(p,pc,lv){const pips=lv>1?'<circle cx="11" cy="30" r="1.6" fill="'+p.g+'"/><circle cx="17" cy="30" r="1.6" fill="'+p.g+'"/>':'<circle cx="14" cy="30" r="1.6" fill="'+p.g+'"/>';
 return `<ellipse cx="14" cy="45" rx="12" ry="2.8" fill="rgba(0,0,0,.28)"/>
<path d="M5 44 L7 16 H21 L23 44Z" fill="${p.b}" stroke="${p.d}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M7 16 L9 44 H6Z" fill="${p.h}" opacity=".5"/>
<path d="M4 16 V9 H8 V12 H11 V9 H17 V12 H20 V9 H24 V16Z" fill="${p.h}" stroke="${p.d}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M11 44 V36 Q14 31 17 36 V44Z" fill="${p.d}"/>${pips}
<rect x="13.2" y="-1" width="1.6" height="9" fill="${p.d}"/><path d="M14.8 -1 H23 L20.4 2 L23 5 H14.8Z" fill="${pc}" stroke="${p.d}" stroke-width=".7" stroke-linejoin="round"/>`}
function svgDock(p,pc){return `<ellipse cx="22" cy="27" rx="19" ry="3" fill="rgba(0,0,0,.25)"/>
<rect x="3" y="17" width="36" height="7" rx="1" fill="${p.b}" stroke="${p.d}" stroke-width="1.4"/>
<path d="M3 20 H39 M12 17 V24 M22 17 V24 M31 17 V24" stroke="${p.d}" stroke-width=".9" opacity=".7"/>
<rect x="5" y="23" width="3" height="6" fill="${p.d}"/><rect x="34" y="23" width="3" height="6" fill="${p.d}"/>
<rect x="9" y="10" width="9" height="7" rx="1" fill="${p.h}" stroke="${p.d}" stroke-width="1.2"/><path d="M9 13.5 H18" stroke="${p.d}" stroke-width=".8"/>
<rect x="27.2" y="2" width="1.6" height="15" fill="${p.d}"/><path d="M28.8 2 H37 L34.4 5 L37 8 H28.8Z" fill="${pc}" stroke="${p.d}" stroke-width=".7" stroke-linejoin="round"/>`}
function svgWall(p){return `<ellipse cx="16" cy="23" rx="14" ry="2.6" fill="rgba(0,0,0,.28)"/>
<path d="M2 22 V9 H7 V12 H11 V9 H15 V12 H19 V9 H23 V12 H27 V9 H30 V22Z" fill="${p.b}" stroke="${p.d}" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M2 15 H30 M9 15 V22 M17 15 V22 M25 15 V22 M5 9 V15 M13 9 V15 M21 9 V15" stroke="${p.d}" stroke-width=".8" opacity=".7"/>
<rect x="2" y="9" width="28" height="2" fill="${p.h}" opacity=".7"/>`}
/* ----- Händler (blickt nach rechts) ----- */
function svgTrader(p,pc){return `<g stroke="${p.d}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round">
<path d="M1 7 H7" stroke-width="1"/>
<rect x="2" y="2.6" width="10" height="6" rx="1" fill="${p.a}"/><rect x="3" y="1.2" width="8" height="2.2" rx=".8" fill="${p.g}"/>
<rect x="2" y="2.6" width="10" height="1.4" fill="${pc}" opacity=".9" stroke="none"/>
<circle cx="4.6" cy="10.4" r="1.9" fill="${p.h}"/><circle cx="10" cy="10.4" r="1.9" fill="${p.h}"/><circle cx="4.6" cy="10.4" r=".6" fill="${p.d}"/><circle cx="10" cy="10.4" r=".6" fill="${p.d}"/>
<path d="M12 7 H15"/>
<path d="M17 7.8 L15.4 10.6 M19 8 L19.4 11 M21 7.8 L23 10.4 M17 6.2 L15.2 4 M19.4 5.8 L19.6 3.2 M21.4 6.2 L23.2 4.2" fill="none" stroke-width=".8"/>
<ellipse cx="17.2" cy="7" rx="2.6" ry="2" fill="${p.b}"/><ellipse cx="20.4" cy="6.8" rx="1.6" ry="1.4" fill="${p.b}"/><ellipse cx="24.2" cy="6.2" rx="2.3" ry="2.1" fill="${p.b}"/>
<path d="M25.4 4.6 Q27.4 2.2 28.6 2.8 M25.8 4.4 Q28 4 28.8 5" fill="none"/>
<circle cx="25.4" cy="5.8" r=".45" fill="#fff" stroke="none"/></g>`}
/* ----- Schiffe ----- */
function svgShip(p,pc,war){
  const hull=war?'#4a3220':p.b;
  return `<ellipse cx="26" cy="32" rx="22" ry="3" fill="rgba(0,0,0,.22)"/>
<path d="M3 22 H49 L43 31 H9Z" fill="${hull}" stroke="${p.d}" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 25 H47" stroke="${p.d}" stroke-width=".9" opacity=".7"/>
${war?`<path d="M49 24 L55 27 L49 29Z" fill="${p.d}"/><g fill="${p.d}"><circle cx="15" cy="26.4" r="1.6"/><circle cx="24" cy="26.4" r="1.6"/><circle cx="33" cy="26.4" r="1.6"/></g><rect x="25" y="3" width="2" height="19" fill="${p.d}"/><path d="M27 4 H41 L38 8 L41 12 H27Z" fill="${pc}" stroke="${p.d}" stroke-width=".8" stroke-linejoin="round"/><path d="M16 21 L26 8 L26 21Z" fill="#eadfc4" stroke="${p.d}" stroke-width=".9" stroke-linejoin="round"/>`
 :`<rect x="25" y="3" width="2" height="19" fill="${p.d}"/><path d="M27 5 Q42 10 40 21 H27Z" fill="${pc}" stroke="${p.d}" stroke-width=".9" stroke-linejoin="round"/><path d="M25 7 Q13 12 15 21 H25Z" fill="#f1e6c8" stroke="${p.d}" stroke-width=".9" stroke-linejoin="round"/>`}`;
}
const SV_BUILD={city:[64,44,svgCity],tower:[28,48,svgTower],dock:[44,30,svgDock],wall:[32,26,svgWall],trader:[30,13,svgTrader],ship:[56,34,(p,pc)=>svgShip(p,pc,false)],war:[58,34,(p,pc)=>svgShip(p,pc,true)]};
/* Zeichnet ein Sprite mit Fußpunkt (x,y). scale = Größe relativ zur Weltkarte, rot = Drehung. false, solange das Sprite noch lädt */
function svDraw(g,type,skin,pc,x,y,scale,extra,rot,flip){
  const d=SV_BUILD[type];if(!d)return false;
  const[w,h,fn]=d,sk=(type==='trader'?TSKINS:BSKINS)[skin]||(type==='trader'?TSKINS.default:BSKINS.default),pcol=Array.isArray(pc)?`rgb(${pc[0]},${pc[1]},${pc[2]})`:(pc||'#ff5757');
  const c=svSprite(`${type}|${skin}|${pcol}|${extra||0}`,w,h,()=>fn(sk.p,pcol,extra||1));
  if(!c)return false;
  const sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(rot||flip){g.save();g.translate(x,y);if(flip)g.scale(-1,1);if(rot)g.rotate(rot);g.drawImage(c,-w*scale/2,-h*scale/2,w*scale,h*scale);g.restore()}
  else g.drawImage(c,x-w*scale/2,y-h*scale,w*scale,h*scale);
  g.imageSmoothingEnabled=sm;return true;
}
/* Vorschau für Shop und Inventar (SVG direkt als Element) */
function svPreview(kind,id,w,h){
  const c=document.createElement('canvas');c.width=84;c.height=60;const g=c.getContext('2d');g.fillStyle='#3f8f4a';g.fillRect(0,0,84,60);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,46,84,14);
  if(kind==='bskin'){let n=0;const iv=setInterval(()=>{g.fillStyle='#3f8f4a';g.fillRect(0,0,84,60);svDraw(g,'city',id,'#ff5757',24,50,.62);svDraw(g,'tower',id,'#ff5757',60,52,.62,1);if(n++>8||(svDraw(g,'city',id,'#ff5757',24,50,.62)&&svDraw(g,'tower',id,'#ff5757',60,52,.62,1)))clearInterval(iv)},120)}
  else if(kind==='tskin'){const iv=setInterval(()=>{g.fillStyle='#3f8f4a';g.fillRect(0,0,84,60);if(svDraw(g,'trader',id,'#ff5757',42,38,1.9,1))clearInterval(iv)},120)}
  else{const s=RSKINS[id]||RSKINS.default;g.fillStyle='#3f8f4a';g.fillRect(0,0,84,60);roadStroke(g,[[-4,44],[26,30],[56,34],[88,14]],s,'#ff5757',1,1.5)}
  return c;
}
/* Weg zeichnen: pts = Punkte, sk = Stil, k = Anteil (0..1) der Länge, scale = Breitenfaktor */
function roadStroke(g,pts,sk,pc,k,scale){
  if(pts.length<2)return;
  scale=scale||1;
  let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l}
  let rem=L*(k==null?1:k);const path=[pts[0]];
  for(let i=1;i<pts.length&&rem>0;i++){const l=seg[i-1];if(rem>=l){path.push(pts[i]);rem-=l}else{const f=rem/l;path.push([pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f]);rem=0}}
  if(path.length<2)return;
  const trace=()=>{g.beginPath();g.moveTo(path[0][0],path[0][1]);
    for(let i=1;i<path.length-1;i++){const mx=(path[i][0]+path[i+1][0])/2,my=(path[i][1]+path[i+1][1])/2;g.quadraticCurveTo(path[i][0],path[i][1],mx,my)}
    const e=path[path.length-1];g.lineTo(e[0],e[1])};
  g.lineCap='round';g.lineJoin='round';
  if(sk.glow){g.strokeStyle=sk.glow;g.globalAlpha=.28;g.lineWidth=(sk.w+3.5)*scale;trace();g.stroke();g.globalAlpha=1}
  g.strokeStyle=sk.edge;g.lineWidth=(sk.w+1.2)*scale;trace();g.stroke();
  g.strokeStyle=sk.body;g.lineWidth=sk.w*scale;trace();g.stroke();
  if(sk.stones){g.strokeStyle=sk.dash;g.lineWidth=sk.w*scale*.8;g.setLineDash([1.6*scale,2.4*scale]);trace();g.stroke();g.setLineDash([])}
  if(sk.acc&&pc){g.strokeStyle=pc;g.globalAlpha=.55;g.lineWidth=1*scale;trace();g.stroke();g.globalAlpha=1}
  else{g.strokeStyle=sk.dash;g.globalAlpha=.8;g.lineWidth=.7*scale;g.setLineDash([2.4*scale,3.4*scale]);trace();g.stroke();g.setLineDash([]);g.globalAlpha=1}
}
