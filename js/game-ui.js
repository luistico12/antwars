/* ===== Oberfläche ===== */
const cv=$('#cv'),cg=cv.getContext('2d'),mv=$('#mv'),mg=mv.getContext('2d');
cg.imageSmoothingEnabled=false;
let prevProt=0,view='map',dockTab='ants',sideTab='info',statKey=null,statPin=false;
const ccam={x:0,y:0,z:1};
const keys=new Set();
const fmt=v=>(Math.round(v*10)/10).toFixed(1).replace('.',',');
const sgn=v=>(v>=0?'+':'')+fmt(v);
const cls=v=>v>0.005?'pos':v<-0.005?'neg':'';
const rateRow=(l,v)=>`<dt>${l}</dt><dd class="${cls(v)}">${sgn(v*60)}</dd>`;
function setHTML(el,h){if(el._h!==h){el._h=h;el.innerHTML=h}}
function toast(msg,kind){
  const d=document.createElement('div');d.className='toast '+(kind||'');d.textContent=msg;
  const box=$('#toasts');box.appendChild(d);while(box.children.length>4)box.firstChild.remove();setTimeout(()=>d.remove(),4200);
}
function setView(v){
  view=v;$('#viewColony').hidden=v!=='colony';$('#viewMap').hidden=v!=='map';
  $('#tabColony').classList.toggle('on',v==='colony');$('#tabMap').classList.toggle('on',v==='map');hideTip();
}

/* ----- Pixel-Icons ----- */
const IC={
  egg:{p:{w:'#f6f1e2',h:'#ffffff',s:'#c9bc96'},m:['','....wwww','...wwwwww','..wwhwwwww','..whwwwwww','..wwwwwwws','..wwwwwwss','..wwwwwsss','...wwwsss','....ssss']},
  leaf:{p:{g:'#6fc24c',G:'#3d8a2c',b:'#a8764a'},m:['','........ggg','......gggGg','.....gggGgg','....ggGggg','...gggGggg','..ggGgggg','.ggGggg','.gGggg','bGgg','b']},
  mush:{p:{r:'#e0914f',w:'#fff3d6',d:'#a8602c',s:'#efe6cf'},m:['','....rrrr','..rrrwrrrr','.rrwwrrrwrr','.rrrrrrrrrr','..dddddddd','.....ss','.....ss','.....ss','....ssss']},
  clay:{p:{o:'#c8703a',O:'#e0925a',d:'#8a4a22'},m:['','','....oooo','...oOoooo','...oooooo','....dddd','.oooo.oooo','oOoooooOooo','oooooooooood','.dddd.dddd']},
  flag:{p:{b:'#4aa3ff',p:'#caa06a',h:'#a8d4ff'},m:['','.bbbbbb','.bhbbbbbb','.bbbbbbbbb','.bbbbbbb','.bbbbb','.p','.p','.p','.p','.p','pppp']},
  star:{p:{y:'#f0b94a',h:'#ffe08a'},m:['.....yy','.....yy','....yyyy','yyyyyyyyyyyy','.yyyhyyyyy','..yyyyyyyy','...yyyyyy','..yyyyyyyy','..yyy..yyy','.yy......yy']},
  sword:{p:{w:'#dfe6ee',b:'#a8764a',g:'#f0b94a'},m:['.........ww','........www','.......www','......www','.w...www','..w.www','...www','..ggg','.bb.g','bb']},
  shield:{p:{w:'#cfd8e0',B:'#4a7ab8',L:'#7aa6e0'},m:['..wwwwwwww','.wBBBBBBBBw','.wBBBLBBBBw','.wBBBLBBBBw','.wBBLLLBBBw','.wBBBLBBBBw','..wBBBBBBw','..wBBBBBBw','...wBBBBw','....wBBw','.....ww']},
  arrow:{p:{y:'#f0b94a'},m:['','..y..y','...y..y','....y..y','.....y..y','....y..y','...y..y','..y..y']},
  pick:{p:{g:'#cfd8e0',b:'#a8764a'},m:['..gggggg','.g.....gg','g...b....g','.....b','....b','...b','..b','.b']},
  drop:{p:{b:'#4aa8e8',h:'#cdeaff'},m:['.....b','....bb','...bbb','..bbbbb','.bbhbbbb','.bhbbbbb','.bbbbbbb','..bbbbb','...bbb']}
};
const ICO_ANT={body:'#e0a15a',hi:'#f6c98a',head:'#d08a40',eye:'#fff',leg:'#b8864a',mand:'#fff'};
const ICO_SOL={body:'#d0452e',hi:'#ff7a5c',head:'#a8301c',eye:'#ffe9b0',leg:'#8a3020',mand:'#ffd08a'};
const iconCache={};
function drawIcon(c,name){
  const g=c.getContext('2d');
  if(name==='ant'||name==='soldier'){c.width=c.height=24;g.clearRect(0,0,24,24);drawAnt(g,11,13,1,0,0.4,name==='soldier'?'s':'w','ground',null,name==='soldier'?1.15:1.0,name==='soldier'?ICO_SOL:ICO_ANT);return}
  const d=IC[name];if(!d)return;c.width=c.height=12;g.clearRect(0,0,12,12);
  d.m.forEach((row,y)=>{for(let x=0;x<row.length&&x<12;x++){const ch=row[x];if(ch!=='.'&&d.p[ch]){g.fillStyle=d.p[ch];g.fillRect(x,y,1,1)}}});
}
function iconURL(name){if(!iconCache[name]){const c=document.createElement('canvas');drawIcon(c,name);iconCache[name]=c.toDataURL()}return iconCache[name]}
$$('canvas.ic').forEach(c=>drawIcon(c,c.dataset.ic));
const ih=n=>`<img class="ih" alt="" src="${iconURL(n)}">`;
const CI={mat:'clay',food:'leaf',fungus:'mush'};
const PWIC={dig:'pick',forage:'leaf',egg:'egg',farm:'mush',atk:'sword',def:'shield',speed:'arrow'};
function renderPw(){
  const el=$('#pwr');if(!G){setHTML(el,'');return}
  const L=[...G.items].sort((a,b)=>b.pct-a.pct),top=L.slice(0,5);
  let h=top.map(i=>`<div class="pw" title="${PW[i.type]} +${i.pct}% (aus ${i.from})"><img class="ic" alt="" src="${iconURL(PWIC[i.type])}">${PW[i.type]} +${i.pct}%</div>`).join('');
  if(L.length>5)h+=`<div class="pw more">+${L.length-5} weitere</div>`;
  setHTML(el,h);
}

/* ----- Tooltip ----- */
const tip=$('#tip');
function showTip(html,e){
  if(!html){hideTip();return}
  tip.innerHTML=html;tip.hidden=false;
  const w=tip.offsetWidth,h=tip.offsetHeight;
  let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-12;if(y+h>innerHeight-8)y=e.clientY-h-12;
  tip.style.left=Math.max(4,x)+'px';tip.style.top=Math.max(4,y)+'px';
}
function hideTip(){tip.hidden=true}
function terrTip(t){
  const q=TERR[t.terrain],own=t.owner===0,o=t.owner<0?'Wilde Ameisen':F[t.owner].name;
  let h=`<b>${t.name}</b> <span class="dim">(${q.name})</span><br>${o}${t.owner>=0?' · '+SP[F[t.owner].species].name:''}${t.isCap?' · Hauptstadt':''}${t.puppet?' · Marionettenstaat':''}`;
  if(started){
    h+=`<br>Soldaten: ${Math.floor(t.troops)}`;
    if(t.owner>0&&F[t.owner].allied)h+=' · Verbündet';
    if(own&&t.col)h+=`<br>Arbeiterinnen: ${t.col.w} · Eier: ${t.col.eggAges.length}<br>Hügelhöhe: ${moundH(t.col)}/${MR} · Wasser: ${WATER_N[t.col.water.size]}`;
    if(own&&!t.isCap&&!t.col&&!t.puppet)h+='<br>Wartet auf deine Entscheidung';
    if(t.str.out)h+=`<br>Außenposten Stufe ${t.str.out}`;
    if(t.walls&&t.walls.length)h+=`<br>Verteidigungswälle: ${t.walls.length}`;
    if(t.port)h+=`<br>Hafen · Flöße ${t.port.rafts}/${t.port.max}`;
    for(const k of Object.keys(t.str.lines))if(t.str.lines[k])h+=`<br>Verteidigungslinie gegen ${T[k].name}: Stufe ${t.str.lines[k]}`;
    if(own&&!t.isCap&&!t.puppet)h+=`<br>Ertrag: ${q.food?'+'+fmt(q.food*60)+' Blätter/Min ':''}${q.mat?'+'+fmt(q.mat*60)+' Erde/Min':''}`;
    if(t.item)h+=`<br><b style="color:#7fe6f2">Powerup:</b> ${PW[t.item.type]} +${t.item.pct}% <span class="dim">(Rechtsklick: Spähtrupp bergen oder Gebiet erobern)</span>`;
  }
  return h;
}

/* ----- Kolonie wechseln ----- */
function renderColSwitch(){
  const box=$('#colSwitch');if(!box||!started)return;
  const list=T.filter(t=>t.owner===0&&t.col);
  const h='<span class="lbl">Kolonien</span>'+list.map(t=>`<button class="colbtn${t.id===curT?' on':''}" type="button" data-t="${t.id}"><span>${t.isCap?'★ ':''}${t.name}</span><small>${Math.floor(t.troops)} Soldaten · ${t.col.w} Arbeiterinnen</small></button>`).join('');
  setHTML(box,h);
}
$('#colSwitch').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b)openColony(+b.dataset.t)});
function resetCam(){
  ccam.z=1;ccam.x=ENT_X-VW/2;ccam.y=GY-300;clampCam();
}
function clampCam(){
  const zmin=Math.max(VW/CW,VH/CH);ccam.z=clamp(ccam.z,zmin,3.5);
  const vw=VW/ccam.z,vh=VH/ccam.z;
  ccam.x=clamp(ccam.x,0,Math.max(0,CW-vw));ccam.y=clamp(ccam.y,0,Math.max(0,CH-vh));
}
function openColony(id,silent){
  const t=T[id];if(!t||!t.col)return;
  curT=id;col=t.col;col.buildSel=null;col.hover=null;col.tun=null;col.pin=null;syncAnts(true);dockDirty=true;resetCam();renderColSwitch();
  if(!silent)setView('colony');
}

/* ----- Dock der Kolonie ----- */
function renderDock(){
  dockDirty=false;const body=$('#dockBody');body.innerHTML='';
  $$('#dock .tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===dockTab));
  if(!col)return;
  if(dockTab==='ants')renderAnts(body);else if(dockTab==='rooms')renderRooms(body);else renderUpg(body);
  refreshLive();
}
function roleIcon(role){
  const c=document.createElement('canvas');c.width=48;c.height=32;const g=c.getContext('2d'),sp=col.sp;
  g.fillStyle='#8a5a30';g.fillRect(0,0,48,32);g.fillStyle='#6a4220';g.fillRect(0,22,48,10);
  if(role==='m'){ell(g,24,26,20,6,'#5a4a32');ell(g,10,22,4,3,'#f4ead0');ell(g,38,22,4,3,'#f4ead0');g.fillStyle='#e8dfc4';g.fillRect(9,22,3,4);g.fillRect(37,22,3,4)}
  if(role==='w'){ell(g,34,27,12,4,'#2f7fb8');ell(g,34,26,8,2,'#58b0e8')}
  drawAnt(g,20,18,1,0,1.2,role,sp,role==='f'?'leaf':role==='d'?'dirt':role==='m'?'fungus':role==='w'?'water':null,role==='s'?1.6:1.4);
  return c;
}
function antCard(role,title,txt,ctl){
  const d=document.createElement('div');d.className='card';
  d.innerHTML=`<div class="pic"></div><div class="body"><h3>${ih(role==='s'?'soldier':role==='f'?'leaf':role==='d'?'pick':role==='m'?'mush':'drop')}${title}</h3><p>${txt}</p>${ctl}</div>`;
  d.querySelector('.pic').appendChild(roleIcon(role));return d;
}
function renderAnts(body){
  const step=(r,l)=>`<div class="stepper"><button class="btn sm" data-r="${r}" data-v="-1" type="button" aria-label="Weniger ${l}">-</button><b id="a${r}">0</b><button class="btn sm" data-r="${r}" data-v="1" type="button" aria-label="Mehr ${l}">+</button></div>`;
  body.appendChild(antCard('f','Sammlerinnen','Holen Blätter. Alle Arbeiterinnen ohne anderen Job sammeln.','<div class="stepper"><b id="af">0</b><span class="mini">sammeln</span></div>'));
  body.appendChild(antCard('d','Gräberinnen','Graben Räume und Tunnel und liefern Erde.',step('d','Gräberinnen')));
  body.appendChild(antCard('m','Pilzzüchterinnen','Machen aus Blättern Pilze. 5 Plätze je Pilzfarm.',step('m','Züchterinnen')+'<p class="mini" id="aMc"></p>'));
  body.appendChild(antCard('s','Soldaten','Die Truppe dieses Gebiets. Kaserne erhöht die Plätze.','<div class="stepper"><b id="as">0</b><span class="mini" id="asc"></span></div><button class="btn sm" id="train" type="button">Ausbilden (6 Pilze)</button>'));
  body.appendChild(antCard('w','Wasserträgerinnen','Holen Wasser für die Lehmgruben. Kommen automatisch.','<div class="stepper"><b id="aw">0</b><span class="mini" id="awc"></span></div>'));
  const w=document.createElement('div');w.className='card wide';
  w.innerHTML=`<div class="body"><h3>Soldatenanteil</h3><p>So viele der schlüpfenden Ameisen werden Soldaten.</p><input type="range" id="spct" min="0" max="100" step="10" value="${col.spct}" aria-label="Soldatenanteil"><div class="mini" id="spctL"></div></div>`;
  body.appendChild(w);
  const b=document.createElement('div');b.className='card wide';b.innerHTML='<div class="body"><h3>Bilanz dieser Kolonie pro Minute</h3><dl class="kv" id="aBal"></dl></div>';body.appendChild(b);
  $$('[data-r]',body).forEach(bt=>bt.onclick=()=>{
    const v=+bt.dataset.v;
    if(bt.dataset.r==='d')col.diggers=clamp(col.diggers+v,0,col.w-col.farmers);
    else col.farmers=clamp(col.farmers+v,0,Math.min(col.stats.farm*5,col.w-col.diggers));
    refreshLive();
  });
  $('#spct').oninput=e=>{col.spct=+e.target.value;refreshLive()};
  $('#train').onclick=()=>{
    const t=T[col.tid];
    if(col.w<=3)return toast('Zu wenige Arbeiterinnen','bad');
    if(G.fungus<6)return toast('Zu wenig Pilze','bad');
    if(Math.floor(t.troops)>=col.stats.soldierCap)return toast('Keine Soldatenplätze frei: Kaserne bauen','bad');
    G.fungus-=6;col.w--;addTroops(t,1);refreshLive();
  };
}
function renderRooms(body){
  for(const k of Object.keys(ROOMS)){
    const R=ROOMS[k],b=document.createElement('button');b.type='button';b.className='card';b.dataset.k=k;
    b.innerHTML=`<div class="pic"><canvas width="48" height="32"></canvas></div><div class="body"><h3>${ih(k==='tunnel'?'pick':k==='farm'||k==='fstore'?'mush':k==='eggs'||k==='nursery'?'egg':k==='pit'?'clay':k==='barracks'?'shield':'ant')}${R.n}</h3><p>${R.d}</p><div class="cost"><span data-c="m">${ih('clay')}${R.mat}${k==='tunnel'?' je Stück':''}</span>${R.food?`<span data-c="f">${ih('leaf')}${R.food}</span>`:''}</div></div>`;
    const g=b.querySelector('canvas').getContext('2d');g.fillStyle='#9a6232';g.fillRect(0,0,48,32);
    if(k==='tunnel'){g.fillStyle='#6a4524';g.fillRect(0,9,48,14);g.fillRect(17,0,14,32);g.fillStyle='#241408';g.fillRect(0,11,48,10);g.fillRect(19,0,10,32)}
    else{ell(g,24,16,24,16,'#6a4524');ell(g,24,16,22,14,'#241408');ell(g,24,18,21,11,'#3a2413');drawRoom(g,k,0,0,0.7,0,col.sp)}
    b.onclick=()=>{col.buildSel=col.buildSel===k?null:k;col.tun=null;refreshLive()};
    body.appendChild(b);
  }
}
function renderUpg(body){
  for(const u of UPG){
    const lv=G.upg[u.id],max=lv>=3,d=document.createElement('div');d.className='card wide';
    d.innerHTML=`<div class="body"><h3>${ih(PWIC[u.id])}${u.n}</h3><p>${u.d}</p><div class="pips">${[0,1,2].map(i=>`<i class="${i<lv?'f':''}"></i>`).join('')}</div>
      <button class="btn sm" type="button" data-u="${u.id}">${max?'Maximal':`Stufe ${lv+1}: ${u.cost[lv]} ${u.res==='mat'?'Erde':'Blätter'}`}</button></div>`;
    d.querySelector('button').onclick=()=>{
      if(G.upg[u.id]>=3)return;const c=u.cost[G.upg[u.id]];
      if(G[u.res]<c)return toast(u.res==='mat'?'Zu wenig Erde':'Zu wenig Blätter','bad');
      G[u.res]-=c;G.upg[u.id]++;toast(u.n+' verbessert (gilt für alle Kolonien)','good');dockDirty=true;
    };
    body.appendChild(d);
  }
}

/* ----- Anzeigen oben mit Details pro Minute (Hover) ----- */
function totals(){
  const cols=colonies();let w=0,eggs=0,eggCap=0,wCap=0,sold=0,sCap=0;
  for(const C of cols){w+=C.w;eggs+=C.eggAges.length;eggCap+=C.stats.eggCap;wCap+=C.stats.workerCap;sCap+=C.stats.soldierCap;sold+=Math.floor(T[C.tid].troops)}
  return{cols,w,eggs,eggCap,wCap,sold,sCap};
}
function renderStat(){
  const p=$('#statp');
  $$('#chips .chip').forEach(c=>c.classList.toggle('sel',c.dataset.k===statKey));
  if(!statKey||!G){p.hidden=true;return}
  p.hidden=false;
  const tt=totals(),cols=tt.cols,ti=territoryIncome(),Es=cols.map(C=>({C,e:econC(C),t:T[C.tid]}));
  const sum=f=>Es.reduce((s,x)=>s+f(x),0),nm=x=>`${x.t.isCap?'★ ':''}${x.t.name}`;
  const farmOn=G.food>0.3&&G.fungus<G.fungusCap?1:0;
  let h='';
  if(statKey==='food'){
    const fo=sum(x=>x.e.forage),use=sum(x=>x.e.farmUse)*farmOn,net=fo+ti.food-use;
    h=`<div><h3>Blätter: ${Math.floor(G.food)} / ${G.foodCap}</h3><dl class="kv">${rateRow('Sammlerinnen',fo)}${rateRow('Gebiete und Tribut',ti.food)}${rateRow('Pilzfarmen verbrauchen',-use)}</dl><dl class="kv tot">${rateRow('Bilanz pro Minute',net)}</dl></div>
    <div><h3>Sammlerinnen pro Kolonie</h3><dl class="kv">${Es.map(x=>`<dt>${nm(x)}</dt><dd>${x.e.foragers} (${sgn(x.e.forage*60)})</dd>`).join('')}</dl><p class="mini">Alle Kolonien teilen sich ein Lager.</p></div>`;
  }else if(statKey==='fungus'){
    const fa=sum(x=>x.e.farmP)*farmOn,up=sum(x=>x.e.upkeep),eg=sum(x=>x.e.eggFood),net=fa+ti.fungus-up-eg;
    h=`<div><h3>Pilze: ${Math.floor(G.fungus)} / ${G.fungusCap}</h3><dl class="kv">${rateRow('Pilzzucht',fa)}${rateRow('Tribut',ti.fungus)}${rateRow('Ameisen fressen',-up)}${rateRow('Eier legen',-eg)}</dl><dl class="kv tot">${rateRow('Bilanz pro Minute',net)}</dl></div>
    <div><h3>Pilzzüchterinnen pro Kolonie</h3><dl class="kv">${Es.map(x=>`<dt>${nm(x)}</dt><dd>${x.C.farmers} / ${x.e.S.farm*5}</dd>`).join('')}</dl><p class="mini">Pilze brauchst du für Eier und zum Ausbilden. Ohne Pilzlager ist die Menge begrenzt.</p></div>`;
  }else if(statKey==='mat'){
    const dg=sum(x=>x.C.diggers*0.12*pwMul('dig')),pi=sum(x=>x.e.pitEff*0.35);
    h=`<div><h3>Material: ${Math.floor(G.mat)} / ${G.matCap}</h3><dl class="kv">${rateRow('Gräberinnen',dg)}${rateRow('Lehmgruben',pi)}${rateRow('Gebiete und Tribut',ti.mat)}</dl><dl class="kv tot">${rateRow('Bilanz pro Minute',dg+pi+ti.mat)}</dl></div>
    <div><h3>Pro Kolonie</h3><dl class="kv">${Es.map(x=>`<dt>${nm(x)}</dt><dd>${sgn(x.e.mat*60)} · ${WATER_N[x.C.water.size]}</dd>`).join('')}</dl><p class="mini">Lehmgruben brauchen Wasser. Große Gewässer versorgen mehr Gruben.</p></div>`;
  }else if(statKey==='workers'){
    const f=sum(x=>x.e.foragers),d=sum(x=>x.C.diggers),m=sum(x=>x.C.farmers);
    h=`<div><h3>Arbeiterinnen: ${tt.w} / ${tt.wCap}</h3><dl class="kv"><dt>Sammlerinnen</dt><dd>${f}</dd><dt>Gräberinnen</dt><dd>${d}</dd><dt>Pilzzüchterinnen</dt><dd>${m}</dd><dt>Wasserträgerinnen</dt><dd>${Es.reduce((s,x)=>s+(x.e.S.pit?Math.min(6,x.e.S.pit*2):0),0)} (zusätzlich, sichtbar)</dd></dl></div>
    <div><h3>Pro Kolonie</h3><dl class="kv">${Es.map(x=>`<dt>${nm(x)}</dt><dd>${x.C.w} (${x.e.foragers}/${x.C.diggers}/${x.C.farmers})</dd>`).join('')}</dl><p class="mini">Klammer: sammeln / graben / Pilze</p></div>`;
  }else if(statKey==='soldiers'){
    h=`<div><h3>Soldaten: ${tt.sold} / ${tt.sCap}</h3><dl class="kv"><dt>Unterhalt pro Minute</dt><dd class="neg">${sgn(-tt.sold*0.012*60)} Pilze</dd><dt>Anteil an Nachwuchs</dt><dd>${Es.length?Math.round(Es.reduce((s,x)=>s+x.C.spct,0)/Es.length):0}%</dd></dl></div>
    <div><h3>Pro Gebiet</h3><dl class="kv">${T.filter(t=>t.owner===0).map(t=>`<dt>${t.isCap?'★ ':''}${t.name}${t.puppet?' (Vasall)':''}</dt><dd>${Math.floor(t.troops)}${t.col?' / '+t.col.stats.soldierCap:''}</dd>`).join('')}</dl></div>`;
  }else if(statKey==='eggs'){
    const lay=sum(x=>x.C.eggAges.length<x.e.S.eggCap?x.e.lay:0),ready=Es.reduce((s,x)=>s+x.C.eggAges.filter(a=>a>=EGG_T).length,0);
    h=`<div><h3>Eier: ${tt.eggs} / ${tt.eggCap}</h3><dl class="kv"><dt>Gelegt pro Minute</dt><dd class="pos">${sgn(lay*60)}</dd><dt>Schlupfbereit (warten auf Platz)</dt><dd class="${ready?'neg':''}">${ready}</dd></dl><p class="mini">Ein Ei braucht 2 Minuten und kostet 2 Pilze. Sind Häuser und Kasernen voll, bleibt es liegen.</p></div>
    <div><h3>Pro Kolonie</h3><dl class="kv">${Es.map(x=>`<dt>${nm(x)}</dt><dd>${x.C.eggAges.length} / ${x.e.S.eggCap}</dd>`).join('')}</dl></div>`;
  }else if(statKey==='terr'){
    const own=T.filter(t=>t.owner===0);
    h=`<div><h3>Gebiete: ${own.length} / ${T.length}</h3><dl class="kv">${rateRow('Blätter',ti.food)}${rateRow('Material',ti.mat)}${rateRow('Pilze',ti.fungus)}</dl><p class="mini">Die Hauptstadt (★) und eigene Kolonien bringen keinen Gebietsertrag.</p></div>
    <div><h3>Deine Gebiete</h3><dl class="kv">${own.map(t=>{const q=TERR[t.terrain];return`<dt>${t.isCap?'★ ':''}${t.name}</dt><dd>${t.isCap?'Hauptstadt':t.puppet?'Vasall':t.col?'Kolonie':'offen'}</dd>`}).join('')}</dl></div>`;
  }else if(statKey==='heat'){
    const hs=heatStage();
    h=`<div><h3>Fahndungsstufe ${hs} / 5</h3><div style="height:10px;background:var(--soil-3);margin:6px 0"><div style="height:10px;width:${H.v}%;background:${hs>=4?'#e0523d':hs>=2?'#f0b94a':'#9be86a'}"></div></div><p class="mini">Je mehr verschiedene Gegner du angreifst, desto schneller steigt sie. Hohe Stufen locken Angriffe auf dich, machen Bündnisse unwahrscheinlicher und sinken langsam wieder.</p></div>
    <div><h3>Bündnisse</h3><dl class="kv">${F.filter(f=>!f.isPlayer).map(f=>`<dt>${f.name}</dt><dd>${!f.alive?'besiegt':f.allied?'verbündet':'neutral'}</dd>`).join('')}</dl></div>`;
  }
  setHTML(p,h);
}
$$('#chips .chip').forEach(c=>{
  c.addEventListener('mouseenter',()=>{if(!statPin){statKey=c.dataset.k;renderStat()}});
  c.addEventListener('click',()=>{if(statPin&&statKey===c.dataset.k){statPin=false;statKey=null}else{statPin=true;statKey=c.dataset.k}renderStat()});
});
$('#chipwrap').addEventListener('mouseleave',()=>{if(!statPin){statKey=null;renderStat()}});
function refreshLive(){
  if(!G)return;
  const tt=totals(),owned=T.filter(t=>t.owner===0).length;
  $('#cW').textContent=tt.w;$('#cWm').textContent='/'+tt.wCap;
  $('#cS').textContent=tt.sold;$('#cSm').textContent='/'+tt.sCap;
  $('#cE').textContent=tt.eggs;$('#cEm').textContent='/'+tt.eggCap;
  $('#cF').textContent=Math.floor(G.food);$('#cFm').textContent='/'+G.foodCap;
  $('#cP').textContent=Math.floor(G.fungus);$('#cPm').textContent='/'+G.fungusCap;
  $('#cM').textContent=Math.floor(G.mat);$('#cMm').textContent='/'+G.matCap;
  $('#cT').textContent=owned;$('#cTm').textContent='/'+T.length;
  $('#cH').textContent=heatStage();
  $('#chipFood').classList.toggle('warn',G.food<10);
  {const pl=protLeft();if(pl>0)prevProt=1;else if(prevProt){prevProt=0;toast('Die Schutzzeit ist vorbei. Ab jetzt sind Angriffe möglich','bad')}$('#dayLabel').textContent=`Tag ${dayNo()}`+(pl>0?` · Schutz ${mmss(pl)}`:'')}
  renderStat();renderColSwitch();renderPw();
  if(!col)return;
  const e=econC(col),t=T[col.tid];
  if(dockTab==='ants'&&$('#af')){
    $('#af').textContent=e.foragers;$('#ad').textContent=col.diggers;$('#am').textContent=col.farmers;
    $('#aMc').textContent=`Platz: ${col.stats.farm*5}`;$('#as').textContent=Math.floor(t.troops);$('#asc').textContent='/'+col.stats.soldierCap;
    $('#aw').textContent=col.stats.pit?Math.min(6,col.stats.pit*2):0;$('#awc').textContent=`${WATER_N[col.water.size]} (${col.water.size}/5)`;
    $('#spctL').textContent=`${col.spct}% Soldaten`;
    $('#aBal').innerHTML=`${rateRow('Blätter',e.forage-e.farmUse)}${rateRow('Pilze',e.farmP-e.upkeep-e.eggFood)}${rateRow('Material',e.mat)}<dt>Eier pro Min.</dt><dd>${fmt(e.lay*60)}</dd><dt>Hügelhöhe</dt><dd>${moundH(col)}/${MR}</dd>`;
  }
  if(dockTab==='rooms')$$('#dockBody .card[data-k]').forEach(b=>{
    const R=ROOMS[b.dataset.k],okM=G.mat>=R.mat,okF=G.food>=R.food;
    b.classList.toggle('poor',!(okM&&okF));b.classList.toggle('sel',col.buildSel===b.dataset.k);
    const m=$('[data-c=m]',b),f=$('[data-c=f]',b);m.classList.toggle('no',!okM);if(f)f.classList.toggle('no',!okF);
  });
  if(dockTab==='upg')$$('#dockBody [data-u]').forEach(b=>{
    const u=UPG.find(x=>x.id===b.dataset.u),lv=G.upg[u.id];b.disabled=lv>=3||G[u.res]<u.cost[lv];
  });
  let hint;
  if(col.buildSel==='tunnel')hint='<b>Tunnelansicht</b> (Taste T): <span style="color:#7fe69a">grün</span> = gegraben, <span style="color:#ff8a70">rot</span> = unbebaubar. <b>Linksklick</b> markiert eine Zelle, <b>Klick halten und ziehen</b> malt mehrere. Rechtsklick oder T beendet.';
  else if(col.buildSel)hint=`Bauen: <b>${ROOMS[col.buildSel].n}</b>. Klicke eine Zelle neben einem Gang oder im Hügel. Gleiche Räume nebeneinander verschmelzen. Rechtsklick bricht ab.`;
  else if(col.pin)hint=roomInfo(col,col.pin.c,col.pin.r)||'';
  else hint=`<b>${t.name}</b>${t.isCap?' (Hauptstadt)':''} · Wasser: ${WATER_N[col.water.size]}. Im Reiter <b>Räume</b> wählst du, was gebaut wird. Fahre mit der Maus über etwas für Details.`;
  setHTML($('#hint'),hint);
}

/* ----- Seitenpanel der Karte ----- */
const costTxt=c=>`<span class="${G.mat<c.mat?'no':''}">${ih('clay')}${c.mat} Erde</span> · <span class="${G.food<c.food?'no':''}">${ih('leaf')}${c.food} Blätter</span>`;
function buildHTML(){
  if(selT==null)return'<p class="mini">Wähle auf der Karte ein eigenes Gebiet, um dort zu bauen.</p>';
  const t=T[selT];
  if(t.owner!==0)return`<p class="mini"><b>${t.name}</b> gehört nicht dir. Gebaut wird nur in eigenen Gebieten.</p>`;
  const lv=t.str.out;
  let h=`<h2>${t.name}</h2>`;
  h+=`<div class="brow"><b>${ih('flag')}Außenposten (Stufe ${lv}/2)</b><small>+40% Verteidigung je Stufe und die Garnison erholt sich langsam.</small><span class="cost">${lv<2?costTxt(STR_COST.out[lv]):'Maximal ausgebaut'}</span><button class="btn sm" type="button" data-b="out"${lv>=2?' disabled':''}>${lv?'Ausbauen':'Bauen'}</button></div>`;
  const foes=t.adj.filter(i=>T[i].owner!==0);
  h+='<h2 style="margin-top:4px;font-size:14px">Verteidigungslinien</h2><p class="mini">Gegen Angriffe, die von dieser Grenze kommen: +60% Verteidigung je Stufe.</p>';
  if(!foes.length)h+='<p class="mini">Alle Nachbarn gehören dir. Hier ist keine Linie nötig.</p>';
  for(const ai of foes){
    const n=T[ai],l=t.str.lines[ai]||0,o=n.owner>=0?F[n.owner].name:'Wilde Ameisen';
    h+=`<div class="brow"><b>${ih('shield')}Gegen ${n.name} (Stufe ${l}/2)</b><small>${o}</small><span class="cost">${l<2?costTxt(STR_COST.line[l]):'Maximal ausgebaut'}</span><button class="btn sm" type="button" data-b="line" data-n="${ai}"${l>=2?' disabled':''}>${l?'Ausbauen':'Bauen'}</button></div>`;
  }
  return h;
}
$('#buildBox').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b||selT==null)return;buildStr(T[selT],b.dataset.b,+b.dataset.n);updateSide()});
function setSideTab(v){sideTab=v;$('#stInfo').classList.toggle('on',v==='info');$('#stBuild').classList.toggle('on',v==='build');$('#infoBox').hidden=v!=='info';$('#buildBox').hidden=v!=='build';updateSide()}
$('#stInfo').onclick=()=>setSideTab('info');$('#stBuild').onclick=()=>setSideTab('build');
$('#terrInfo').insertAdjacentHTML('afterend','<div id="openBox" style="margin-top:8px"></div>');
$('#openBox').addEventListener('click',e=>{
  const b=e.target.closest('[data-open]');if(b)openColony(+b.dataset.open);
  const a=e.target.closest('[data-annex]');if(a){annex(+a.dataset.annex);updateSide()}
});
$('#facList').addEventListener('click',e=>{
  const a=e.target.closest('[data-ally]');if(!a)return;const id=+a.dataset.ally;
  if(F[id].allied)breakAlliance(id);else proposeAlliance(id);updateSide();
});
function facHTML(){
  return F.map(f=>{const n=T.filter(t=>t.owner===f.id).length;
    let h=`<div class="fac ${f.alive?'':'dead'}"><i style="--c:${rgb(f.rgb)}"></i><span>${f.name} · ${SP[f.species].name}</span><b>${f.alive?n:0}</b></div>`;
    if(!f.isPlayer&&f.alive)h+=`<div class="dipl mini"><span>${f.allied?'Verbündet':f.dipCool>0?'Verhandlung in '+Math.ceil(f.dipCool)+'s':'Neutral'}</span><button class="btn" type="button" data-ally="${f.id}"${!f.allied&&f.dipCool>0?' disabled':''}>${f.allied?'Bündnis lösen':'Bündnis vorschlagen'}</button></div>`;
    return h}).join('');
}
function updateSide(){
  if(!started)return;
  setHTML($('#facList'),facHTML());
  if(sideTab==='build'){setHTML($('#buildBox'),buildHTML());return}
  const info=$('#terrInfo'),hint=$('#terrHint'),send=$('#sendBox');
  if(selT==null){info.innerHTML='';send.hidden=true;setHTML($('#openBox'),'');hint.textContent='Linksklick: eigenes Gebiet wählen (Verstärkung). Rechtsklick auf ein Gebiet: Angriff, Bündnis, Spenden oder Bauen.'}
  else{
    const t=T[selT],q=TERR[t.terrain],own=t.owner===0,cmd=own&&!t.puppet&&!conqQueue.includes(t.id);
    const stt=(t.str.out?`Außenposten ${t.str.out}`:'')+Object.keys(t.str.lines).filter(k=>t.str.lines[k]).map(k=>` · Linie ${T[k].name} ${t.str.lines[k]}`).join('');
    info.innerHTML=`<dt>Name</dt><dd>${t.name}</dd><dt>Gelände</dt><dd>${q.name}</dd><dt>Besitzer</dt><dd>${t.owner<0?'Wilde Ameisen':F[t.owner].name}</dd><dt>Soldaten</dt><dd>${Math.floor(t.troops)}</dd>`
      +(t.isCap?'<dt>Status</dt><dd>Hauptstadt</dd>':t.puppet?'<dt>Status</dt><dd>Marionettenstaat</dd>':'')+(own&&!t.isCap&&!t.puppet?`<dt>Ertrag</dt><dd>${q.food?'+'+fmt(q.food*60)+' Blätter/Min ':''}${q.mat?'+'+fmt(q.mat*60)+' Erde/Min':''}</dd>`:'')+(stt?`<dt>Bauten</dt><dd>${stt}</dd>`:'')+(t.item?`<dt>Powerup</dt><dd>${PW[t.item.type]} +${t.item.pct}%</dd>`:'');
    setHTML($('#openBox'),own&&t.col?`<button class="btn primary" type="button" data-open="${t.id}">Kolonie öffnen</button>`:own&&t.puppet?`<button class="btn primary" type="button" data-annex="${t.id}">Annektieren (30 Erde, 30 Blätter)</button>`:'');
    const can=cmd&&Math.floor(t.troops)>=2;send.hidden=!can;
    if(can)$('#pctN').textContent=Math.floor((Math.floor(t.troops)-1)*pct/100);
    hint.textContent=cmd?'Linksklick auf ein eigenes Gebiet: Verstärkung. Rechtsklick auf ein fremdes Gebiet: Angriff, Bündnis, Spenden.':own?'Marionettenstaaten bekommen keine Befehle.':'Nur eigene Gebiete können Soldaten schicken.';
  }
  const ms=marches.filter(m=>(m.f===0||m.to.owner===0)&&m.phase!=='join');
  $('#marches').innerHTML=ms.length?ms.map(m=>`<div><i style="width:8px;height:8px;background:${rgb(F[m.f].rgb)};display:inline-block;margin-top:5px"></i><span>${m.from.name} → ${m.to.name}: ${m.n} (${m.phase==='fight'?'Kampf':Math.ceil(m.dur-m.t)+'s'})</span></div>`).join(''):'keine';
}

/* ----- Eroberungs-Dialog ----- */
function showConquest(){
  const el=$('#conq');
  if(!conqQueue.length){el.hidden=true;return}
  const t=T[conqQueue[0]];
  $('#conqT').textContent=`${t.name} erobert`;
  $('#conqP').textContent='Was soll mit dem Gebiet passieren?'+(conqQueue.length>1?` (noch ${conqQueue.length-1} weitere)`:'');
  $('#conqKeepS').textContent=`Das Gebiet verschmilzt mit deinem Reich. Du bekommst sofort ${(t.conqN||4)*6} Erde und ${(t.conqN||4)*4} Blätter und es liefert Ertrag.`;
  el.hidden=false;
}
$('#conqKeep').onclick=()=>{if(conqQueue.length)chooseConquest(conqQueue[0],'keep')};
$('#conqPup').onclick=()=>{if(conqQueue.length)chooseConquest(conqQueue[0],'puppet')};

/* ----- Kamera und Eingaben ----- */
function colWorld(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*VW/ccam.z+ccam.x,(e.clientY-r.top)/r.height*VH/ccam.z+ccam.y]}
let zoomPush=0,warping=false;
function warp(dir,id){
  if(warping||!started)return;warping=true;hideTip();
  const from=$(dir==='out'?'#viewColony .stage':'#viewMap .stage'),fx=dir==='out'?'warp-out':'warp-in';
  const t=T[dir==='out'?curT:id];
  from.classList.add(fx);
  setTimeout(()=>{
    from.classList.remove(fx);
    if(dir==='out'){
      mcam.z=3;mcam.x=t.cx*CS-MW/mcam.z/2;mcam.y=t.cy*CS-MH/mcam.z/2;clampMapCam();selT=t.id;setView('map');
    }else{
      openColony(id);ccam.z=Math.max(VW/CW,VH/CH);clampCam();
    }
    const to=$(dir==='out'?'#viewMap .stage':'#viewColony .stage');
    to.classList.add(dir==='out'?'warp-arrive-out':'warp-arrive-in');
    setTimeout(()=>{to.classList.remove('warp-arrive-out','warp-arrive-in');warping=false},550);
  },450);
}
let drag=null;
function startDrag(e,cam,el,W,Hh){drag={sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y,moved:false,cam,el,W,Hh};try{el.setPointerCapture(e.pointerId)}catch(_){}}
function moveDrag(e){
  if(!drag)return false;
  const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(Math.abs(dx)+Math.abs(dy)>10)drag.moved=true;
  if(drag.moved){const r=drag.el.getBoundingClientRect(),k=drag.W/r.width/drag.cam.z;drag.cam.x=drag.cx-dx*k;drag.cam.y=drag.cy-dy*k;if(drag.cam===ccam)clampCam();else clampMapCam()}
  return drag.moved;
}
cv.addEventListener('pointerdown',e=>{
  if(e.button===2){startDrag(e,ccam,cv,VW,VH);e.preventDefault();return}
  if(e.button===0&&col&&col.buildSel==='tunnel'){
    const[x,y]=colWorld(e);col.paint={n:0,bad:0,low:0,last:null};try{cv.setPointerCapture(e.pointerId)}catch(_){}
    paintAt(clamp(Math.floor(x/CELLW),0,COLS-1),clamp(Math.floor(y/CELLH),0,ROWS-1));refreshLive();
  }
});
cv.addEventListener('pointermove',e=>{
  if(!col)return;
  if(drag&&drag.el===cv){moveDrag(e);hideTip();return}
  const[x,y]=colWorld(e);col.hover=(x>=0&&y>=0&&x<CW&&y<CH)?{c:Math.floor(x/CELLW),r:Math.floor(y/CELLH)}:null;
  if(col.paint&&col.hover)paintAt(col.hover.c,col.hover.r);
  if(!col.buildSel)showTip(colonyInfoAt(col,x,y),e);else if(col.buildSel==='tunnel')hideTip();else{const k=col.hover&&canPlace(col.buildSel,col.hover.c,col.hover.r);showTip(k?`<span style="color:#ff8a70">${k}</span>`:null,e)}
});
cv.addEventListener('pointerup',e=>{
  if(e.button===0&&col&&col.paint){endPaint();refreshLive();return}
  if(e.button!==2||!drag||drag.el!==cv)return;const moved=drag.moved;drag=null;
  if(!moved&&col){col.buildSel=null;col.pin=null;refreshLive()}
});
cv.addEventListener('pointercancel',()=>{if(col&&col.paint)endPaint()});
cv.addEventListener('pointerleave',()=>{if(col)col.hover=null;hideTip()});
cv.addEventListener('click',e=>{
  if(!col||e.button!==0)return;const[x,y]=colWorld(e);
  const c=clamp(Math.floor(x/CELLW),0,COLS-1),r=clamp(Math.floor(y/CELLH),0,ROWS-1);
  col.hover={c,r};
  if(col.buildSel==='tunnel')return;
  if(col.buildSel){placeBuild(col.buildSel,c,r);refreshLive();return}
  col.pin=(col.pin&&col.pin.c===c&&col.pin.r===r)?null:{c,r};refreshLive();
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{
  e.preventDefault();if(!col)return;
  const[wx,wy]=colWorld(e),r=cv.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*VW,sy=(e.clientY-r.top)/r.height*VH;
  const zmin=Math.max(VW/CW,VH/CH);
  if(e.deltaY>0&&ccam.z<=zmin*1.001){zoomPush+=1;if(zoomPush>=3){zoomPush=0;warp('out')}return}
  zoomPush=0;
  ccam.z*=e.deltaY<0?1.15:1/1.15;clampCam();ccam.x=wx-sx/ccam.z;ccam.y=wy-sy/ccam.z;clampCam();
},{passive:false});
mv.addEventListener('pointerdown',e=>{if(e.button===2){startDrag(e,mcam,mv,MW,MH);e.preventDefault()}});
mv.addEventListener('pointermove',e=>{
  if(drag&&drag.el===mv){moveDrag(e);hideTip();return}
  hovT=terrAtEvent(e);mv.style.cursor=hovT!=null?'pointer':'default';
  showTip(hovT!=null?terrTip(T[hovT]):null,e);
});
function rcUp(e){if(!drag||drag.el!==mv)return;const moved=drag.moved;drag=null;if(!moved){if(!(started&&openRadial(e))){selT=null;updateSide()}}}
mv.addEventListener('pointerup',e=>{if(e.button===2)rcUp(e)});
mv.addEventListener('pointercancel',rcUp);
window.addEventListener('mouseup',e=>{if(e.button===2)rcUp(e)});
mv.addEventListener('pointerleave',()=>{hovT=null;hideTip()});
mv.addEventListener('click',e=>{if(e.button!==0)return;if(typeof seaClick==='function'&&seaClick(e)){updateSide();return}hovT=terrAtEvent(e);mapClick(hovT);updateSide()});
mv.addEventListener('dblclick',e=>{const id=terrAtEvent(e);if(started&&id!=null&&T[id].owner===0&&T[id].col)openColony(id)});
mv.addEventListener('contextmenu',e=>e.preventDefault());
mv.addEventListener('wheel',e=>{
  e.preventDefault();const[wx,wy]=mapWorld(e),r=mv.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*MW,sy=(e.clientY-r.top)/r.height*MH;
  if(e.deltaY<0&&mcam.z>=3.99&&started){const id=terrAtEvent(e);if(id!=null&&T[id].owner===0&&T[id].col){zoomPush+=1;if(zoomPush>=3){zoomPush=0;warp('in',id)}return}}else zoomPush=0;
  mcam.z=clamp(mcam.z*(e.deltaY<0?1.15:1/1.15),1,4);clampMapCam();mcam.x=wx-sx/mcam.z;mcam.y=wy-sy/mcam.z;clampMapCam();
},{passive:false});
const KEYMAP={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'u',w:'u',W:'u',ArrowDown:'d',s:'d',S:'d'};
document.addEventListener('keydown',e=>{
  if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;
  if((e.key==='t'||e.key==='T')&&started&&view==='colony'&&col&&!e.ctrlKey&&!e.metaKey){col.buildSel=col.buildSel==='tunnel'?null:'tunnel';col.pin=null;refreshLive();return}
  if(e.key==='Escape'){if(typeof placing!=='undefined'&&placing){placing=null;updateSide()}if(col){col.buildSel=null;col.tun=null;col.pin=null}selT=null;statKey=null;statPin=false;if(started){refreshLive();renderStat()}return}
  const k=KEYMAP[e.key];if(k&&started&&(view==='colony'||view==='map')){keys.add(k);if(e.key.startsWith('Arrow'))e.preventDefault()}
});
document.addEventListener('keyup',e=>{const k=KEYMAP[e.key];if(k)keys.delete(k)});
window.addEventListener('blur',()=>keys.clear());
function panKeys(dt){
  if(!keys.size||!started)return;
  const dx=(keys.has('r')?1:0)-(keys.has('l')?1:0),dy=(keys.has('d')?1:0)-(keys.has('u')?1:0);
  if(view==='colony'&&col){ccam.x+=dx*700*dt/ccam.z;ccam.y+=dy*700*dt/ccam.z;clampCam()}
  else if(view==='map'){mcam.x+=dx*500*dt/mcam.z;mcam.y+=dy*500*dt/mcam.z;clampMapCam()}
}
$('#pct').oninput=e=>{pct=+e.target.value;$('#pctLbl').textContent=pct+'%';updateSide()};
{const m={ants:'ant',rooms:'clay',upg:'star'};$$('#dock .tab').forEach(b=>b.insertAdjacentHTML('afterbegin',ih(m[b.dataset.tab])));$('#stInfo').insertAdjacentHTML('afterbegin',ih('flag'));$('#stBuild').insertAdjacentHTML('afterbegin',ih('pick'))}
$$('#dock .tab').forEach(b=>b.onclick=()=>{dockTab=b.dataset.tab;renderDock()});
$('#tabColony').onclick=()=>{if(col)setView('colony')};$('#tabMap').onclick=()=>setView('map');
$$('#speed [data-sp]').forEach(b=>b.onclick=()=>{speed=+b.dataset.sp;$$('#speed [data-sp]').forEach(x=>x.classList.toggle('on',x===b))});
$$('#diffSeg [data-d]').forEach(b=>b.onclick=()=>{diffKey=b.dataset.d;$$('#diffSeg [data-d]').forEach(x=>x.classList.toggle('on',x===b))});
$('#btnReroll').onclick=()=>{newMap((Math.random()*1e6)|0);renderSetup()};
function drawAntIcon(c,id){
  const g=c.getContext('2d');c.width=48;c.height=32;
  g.fillStyle=id==='leaf'?'#5d8a52':id==='termite'?'#b69560':'#8a6a44';g.fillRect(0,0,48,32);
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,24,48,8);
  drawAnt(g,22,18,1,0,1.2,'w',id,id==='leaf'?'leaf':null,1.5);
}
function renderSetup(){
  const box=$('#spcList');box.innerHTML='';
  for(const id of['ground','leaf','termite']){
    const s=SP[id],b=document.createElement('button');b.type='button';b.className='spc'+(setupSp===id?' on':'');
    b.innerHTML=`<canvas width="48" height="32"></canvas><span><b>${s.name}</b><small>${s.blurb}</small></span>`;
    drawAntIcon(b.querySelector('canvas'),id);
    b.onclick=()=>{setupSp=id;if(setupStart!=null&&T[setupStart].terrain!==s.terr){T[setupStart].owner=-1;setupStart=null;ownDirty=true}F[0].species=id;renderSetup()};
    box.appendChild(b);
  }
  updateSetupPanel();
}
function updateSetupPanel(){
  const s=SP[setupSp];
  $('#setupStart').textContent=setupStart==null?`${TERR[s.terr].name}-Gebiet wählen`:`${T[setupStart].name} (${TERR[T[setupStart].terrain].name})`;
  $('#btnStart').disabled=setupStart==null;
}
$('#btnStart').onclick=()=>{
  if(setupStart==null)return;
  startGame();
  $('#setupPanel').hidden=true;$('#playPanel').hidden=false;$('#viewtabs').hidden=false;$('#speed').hidden=false;$('#chips').hidden=false;
  $$('#speed [data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==='1'));
  dockTab='ants';statKey=null;statPin=false;resetCam();setSideTab('info');setView('colony');renderDock();renderColSwitch();updateSide();
  if(G.items.length)renderPw();
  toast(`Deine ${SP[setupSp].name} starten in ${T[F[0].capital].name}. Baue Räume und wachse.`,'good');
};
$('#endBtn').onclick=()=>{
  started=false;over=false;col=null;G=null;curT=-1;marches=[];fxs=[];conqQueue=[];statKey=null;$('#statp').hidden=true;$('#end').hidden=true;$('#conq').hidden=true;
  $('#setupPanel').hidden=false;$('#playPanel').hidden=true;$('#viewtabs').hidden=true;$('#speed').hidden=true;$('#chips').hidden=true;
  $('#dayLabel').textContent='';newMap((Math.random()*1e6)|0);renderSetup();setView('map');
};

/* ----- Hauptschleife ----- */
let last=performance.now(),acc5=0;
function frame(now){
  const rdt=Math.min(0.1,(now-last)/1000);last=now;
  if(started&&!over&&speed>0&&!conqQueue.length){
    const dt=rdt*speed,n=Math.ceil(dt/0.1),h=dt/n;
    for(let i=0;i<n;i++){updateColonies(h);updateWorld(h);if(over)break}
  }
  panKeys(rdt);
  acc5+=rdt;if(acc5>=0.2){acc5=0;if(started){refreshLive();updateSide()}}
  if(started&&dockDirty)renderDock();
  if(started&&view==='colony'&&col)drawColony(cg,now,ccam);
  if(view==='map')drawMap(mg,now);
  requestAnimationFrame(frame);
}
newMap((Math.random()*1e6)|0);renderSetup();setView('map');
requestAnimationFrame(frame);
