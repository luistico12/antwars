/* ===== Radialmenü (Rechtsklick auf fremdes Gebiet) ===== */
document.body.insertAdjacentHTML('beforeend','<div id="radial" hidden><div class="why"><span id="radialWhy"></span></div><div class="ring" id="radialRing"></div></div>');
function bestSource(t){
  let from=null;
  if(selT!=null&&T[selT].owner===0&&!T[selT].puppet&&T[selT].adj.includes(t.id))from=T[selT];
  if(!from){for(const i of t.adj){const c=T[i];if(c.owner===0&&!c.puppet&&(!from||c.troops>from.troops))from=c}}
  return from;
}
let radialAt=0;function closeRadial(){$('#radial').hidden=true}
/* Weiße Linien-Icons (24×24) für die Segmente */
const RIC={
  info:'<circle cx="12" cy="12" r="10" fill="#fff" stroke="none"/><path d="M12 11v6" stroke="#1b2130" stroke-width="2.4"/><circle cx="12" cy="7.5" r="1.5" fill="#1b2130" stroke="none"/>',
  ally:'<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  brk:'<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  mat:'<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
  build:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  out:'<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  line:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  port:'<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
  raft:'<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
  road:'<path d="M4 19 8 3"/><path d="m16 3 4 16"/><path d="M12 5v2"/><path d="M12 11v2"/><path d="M12 17v2"/>',
  wall:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  troops:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
};
const RCOL={info:'#8f95a1',mat:'#e0a91d',troops:'#3dbf6a',ally:'#3dbf6a',brk:'#e5534b',build:'#d9b520',x:'#6e8576',back:'#8f95a1',out:'#3dbf6a',line:'#4a7ab8',port:'#2f7fd0',raft:'#4f78e0',road:'#b08a4a',ship:'#4f78e0'};
RIC.ship=RIC.raft;
/* Ring wie bei FrontWars: Schwert in der Mitte (Angriff), darum Segmente (Info, Bündnis, Spenden) */
function radialSVG(segs,atk){
  const R2=118,R1=64,C=150,N=segs.length,gap=2.4*Math.PI/180,FS=15;
  const pt=(r,a)=>`${(C+r*Math.cos(a)).toFixed(1)} ${(C+r*Math.sin(a)).toFixed(1)}`;
  let out='';
  segs.forEach((g,i)=>{
    const ac=-Math.PI/2+i*2*Math.PI/N,col=g.col||RCOL[g.k],cls=`seg${g.dis?' dis':''}`,at=`data-r="${g.k}" data-why="${esc(g.why)}"${g.info?` data-info="${esc(g.info)}"`:''}`;
    let shape,a1,a2;
    if(N===1){const rm=(R1+R2)/2;shape=`<circle cx="${C}" cy="${C}" r="${rm}" fill="none" stroke="${col}" stroke-width="${R2-R1}"/>`;a1=ac-Math.PI/2;a2=ac+Math.PI/2}
    else{a1=ac-Math.PI/N+gap/2;a2=ac+Math.PI/N-gap/2;const lg=(a2-a1)>Math.PI?1:0;
      shape=`<path d="M${pt(R2,a1)} A${R2} ${R2} 0 ${lg} 1 ${pt(R2,a2)} L${pt(R1,a2)} A${R1} ${R1} 0 ${lg} 0 ${pt(R1,a1)} Z" fill="${col}"/>`}
    const [ix,iy]=pt((R1+R2)/2,ac).split(' ');
    const bottom=Math.sin(ac)>0.2,rl=bottom?R2+FS+5:R2+6;
    const lp=bottom?`M${pt(rl,a2)} A${rl} ${rl} 0 0 0 ${pt(rl,a1)}`:`M${pt(rl,a1)} A${rl} ${rl} 0 0 1 ${pt(rl,a2)}`;
    out+=`<g class="${cls}" ${at}>${shape}<g transform="translate(${ix} ${iy}) scale(1.3) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${RIC[g.ic||g.k]}</g>${g.n?`<text x="${ix}" y="${(+iy+27).toFixed(1)}" text-anchor="middle" class="rn">${esc(g.n)}</text>`:''}
      <path id="rl${i}" d="${lp}" fill="none" stroke="none"/><text class="rlbl"><textPath href="#rl${i}" startOffset="50%" text-anchor="middle">${esc(t(g.l))}</textPath></text></g>`;
  });
  out+=`<g class="atk${atk.dis?' dis':''}" data-r="atk" data-why="${esc(atk.why)}"><circle cx="${C}" cy="${C}" r="${R1-8}" fill="#1b2130" stroke="rgba(255,255,255,.14)" stroke-width="3"/>
    <g transform="translate(${C} ${C-5}) scale(2.3) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${atk.ic?RIC[atk.ic]:SV.sword}</g>
    ${atk.n?`<text x="${C}" y="${C+34}" text-anchor="middle" class="rn">${atk.n}</text>`:''}</g>`;
  return`<svg viewBox="0 0 300 300" width="300" height="300" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}
/* Ring anzeigen (cx/cy = Mausposition; meta landet im dataset und steuert die Klicks) */
function showRing(segs,atk,cx,cy,title,meta){
  const ring=$('#radialRing');ring.innerHTML=radialSVG(segs,atk);
  radialAt=Date.now();ring.dataset.cx=cx;ring.dataset.cy=cy;
  for(const k of['t','from','own','wx','wy','mode'])ring.dataset[k]=meta[k]==null?'':meta[k];
  $('#radialWhy').textContent=title;$('#radial').hidden=false;
  const Mg=150,aw=parseFloat(getComputedStyle($('#radial')).right)||0;
  ring.style.left=Math.max(Mg,Math.min(innerWidth-aw-Mg,cx))+'px';ring.style.top=Math.max(Mg,Math.min(innerHeight-Mg,cy))+'px';
}
/* Rechtsklick aufs eigene Gebiet: Info, Bauen, Schließen; Mitte = Verteidigungswall */
function ownRing(t,mode,cx,cy,wx,wy){
  const owned=T.filter(x=>x.owner===0&&!x.puppet),cap=t.isCap?' · Hauptstadt':'';
  const info=`${t.name}${cap}${t.puppet?' · Marionettenstaat':''}: ${Math.floor(t.troops)} Soldaten`+(t.regArea&&!t.puppet?`, Reich mit ${owned.length} Gebieten`:'')
    +(t.str.out?`, Außenposten ${t.str.out}`:'')+(t.walls&&t.walls.length?`, ${t.walls.length} Wälle`:'')+(t.port?', Hafen':'');
  const foes=t.adj.filter(i=>T[i].owner!==0);
  let segs,atk,title=`${t.name} · Dein Gebiet`;
  if(mode==='main'){
    segs=[{k:'info',l:'Info',why:info,info}];
    if(!t.puppet)segs.push({k:'build',l:'Bauen',why:'Strukturen bauen: Außenposten, Hafen, Weg, Verteidigungslinie'});
    segs.push({k:'x',l:'Schließen',why:'Menü schließen'});
    const wd=t.puppet?'Marionettenstaaten bekommen keine Bauten':t.walls.length>=WALL_MAX?'Hier stehen schon 3 Wälle':poorFor(WALL_COST)?`Zu wenig Material (${costLbl(WALL_COST)} nötig)`:'';
    atk={ic:'wall',dis:!!wd,why:wd||`Verteidigungswall frei platzieren (${costLbl(WALL_COST)}). Verstärkt die Grenzen im Umkreis um +50%`,n:t.walls.length?`${t.walls.length}/${WALL_MAX}`:0};
  }else if(mode==='build'){
    const lv=t.str.out,cOut=STR_COST.out[Math.min(lv,1)],cLn=STR_COST.line[0];
    const wPort=t.port?'Hier gibt es schon einen Hafen':!t.coast||!t.coast.length?'Keine Küste: Häfen brauchen Wasser':poorFor(PORT_COST)?`Zu wenig Material (${costLbl(PORT_COST)} nötig)`:'';
    segs=[{k:'back',l:'Zurück',why:'Zurück zum Hauptmenü'},
      {k:'out',l:'Außenposten',dis:lv>=2||poorFor(cOut),why:lv>=2?'Außenposten ist maximal ausgebaut':`Außenposten Stufe ${lv+1}: +40% Verteidigung (${costLbl(cOut)})`},
      {k:'line',l:'Linie',dis:!foes.length,why:foes.length?`Verteidigungslinie gegen eine Grenze: +60% je Stufe (ab ${costLbl(cLn)})`:'Alle Nachbarn gehören dir, hier ist keine Linie nötig'},
      {k:'port',l:'Hafen',dis:!!wPort,why:wPort||`Hafen bauen (${costLbl(PORT_COST)}). Floße und Seewege`}];
    if(t.port)segs.push({k:'raft',l:'Floß',n:`${t.port.rafts}/${t.port.max}`,dis:t.port.rafts>=t.port.max||poorFor(RAFT_COST),why:t.port.rafts>=t.port.max?'Alle Flöße dieses Hafens sind gebaut':`Floß bauen (${costLbl(RAFT_COST)}). Damit greifst du über Wasser an`});
    segs.push({k:'road',l:'Weg',why:'Wege malen: Handelsstrecken und schneller Transport für Soldaten. Auch Floßwege im Wasser'});
    atk={ic:'build',dis:true,why:`Bauen in ${t.name}`};
  }else{
    segs=[{k:'back',l:'Zurück',why:'Zurück zum Bauen-Menü'}];
    foes.forEach((fi,idx)=>{const n=T[fi],l=t.str.lines[fi]||0;
      segs.push({k:'ln'+fi,ic:'line',col:'#4a7ab8',l:n.name,dis:l>=2||poorFor(STR_COST.line[Math.min(l,1)]),why:l>=2?`Linie gegen ${n.name} ist maximal ausgebaut`:`Linie gegen ${n.name}, Stufe ${l+1} (${costLbl(STR_COST.line[l])})`})});
    atk={ic:'line',dis:true,why:'Verteidigungslinie: wähle die Grenze'};
  }
  showRing(segs,atk,cx,cy,title,{t:t.id,own:1,wx,wy,mode});
}
function openRadial(e){
  if(placing){placing=null;toast('Abgebrochen','');updateSide();return true}
  const id=terrAtEvent(e);if(id==null||over||conqQueue.length)return false;
  const t=T[id];
  if(t.owner===0){const[wx,wy]=mapWorld(e);ownRing(t,'main',e.clientX,e.clientY,Math.round(wx),Math.round(wy));return true}
  const o=t.owner,f=o>0?F[o]:null,ally=!!(f&&isFriend(0,o)),from=bestSource(t);
  const n=from?Math.floor((Math.floor(from.troops)-1)*pct/100):0;
  /* Angriff (Mitte) */
  let atkWhy='';
  if(protLeft()>0)atkWhy=`Schutzzeit: noch ${mmss(protLeft())}. Niemand kann angreifen.`;
  else if(ally)atkWhy='Verbündete sind nicht angreifbar. Löse erst das Bündnis.';
  else if(!from)atkWhy='Kein eigenes Gebiet grenzt an. Baue dich bis zur Grenze aus.';
  else if(n<1)atkWhy='Zu wenige Soldaten in '+from.name+'.';
  const atk={dis:!!atkWhy,n:from&&!atkWhy?n:0,why:atkWhy||`Angriff: ${n} Soldaten aus ${from.name} gegen ${t.name}`};
  /* Segmente im Uhrzeigersinn, Info immer oben */
  const owned=f?T.filter(x=>x.owner===o):[],tot=Math.floor(owned.reduce((a,x)=>a+x.troops,0));
  const sp=f&&SP[f.species]?SP[f.species].name:'';
  const info=f?`${f.name}${sp?` (${sp})`:''}: ${owned.length} Gebiete, ${tot} Soldaten${ally?', verbündet':''}`:`${t.name}: wilde Ameisen, ${Math.floor(t.troops)} Soldaten`;
  const segs=[{k:'info',l:'Info',why:info,info}];
  if(f&&f.alive){
    const dTr=!ally?'Truppen spenden geht nur an Verbündete':!from?'Kein eigenes Gebiet grenzt an':n<1?'Zu wenige Soldaten in '+from.name:`${n} Soldaten aus ${from.name} nach ${t.name} schicken`;
    const dMa=!ally?'Materialien spenden geht nur an Verbündete':G.mat<30?'Zu wenig Material (30 nötig)':`30 Material spenden: +3 Soldaten für ${t.name}`;
    const cd=!f.allied&&f.dipCool>0;
    if(ally){
      segs.push({k:'troops',l:'Truppen spenden',dis:!from||n<1,why:dTr});
      segs.push({k:'brk',l:'Bündnis lösen',why:'Bündnis aufheben, danach ist das Gebiet angreifbar'});
      segs.push({k:'mat',l:'Material spenden',dis:G.mat<30,why:dMa});
    }else segs.push({k:'ally',l:'Bündnis',dis:cd,why:cd?`${f.name} verhandelt erst in ${Math.ceil(f.dipCool)}s wieder`:'Bündnis vorschlagen'});
  }
  /* Über Wasser: Floß aus einem Hafen, danach den Landepunkt an der Küste wählen */
  {const[ra,rm]=raftTotals(),src=seaSource(),prot=!ally&&protLeft()>0;
    const sw=!t.coast||!t.coast.length?`${t.name} hat keine Küste`:rm===0?'Du hast noch keinen Hafen. Baue einen im Bauen-Menü deines Gebiets':prot?`Schutzzeit: noch ${mmss(protLeft())}`:ra===0?'Alle Flöße sind unterwegs oder noch nicht gebaut':!src?'Zu wenige Soldaten in deinen Häfen':'';
    segs.push({k:'ship',l:ally?'Floß schicken':'Floß-Angriff',n:`${ra}/${rm}`,dis:!!sw,why:sw||(ally?`Soldaten aus ${src.name} per Floß zu ${t.name} schicken`:`Per Floß aus ${src.name} über Wasser angreifen, danach den Landepunkt wählen`)})}
  showRing(segs,atk,e.clientX,e.clientY,`${t.name} · ${f?f.name:'Wilde Ameisen'}`,{t:id,from:from?from.id:'',own:0});
  return true;
}
/* Klicks im eigenen Ring: Untermenüs bleiben offen, Aktionen schließen */
function ownRingClick(k,t,ring){
  const cx=+ring.dataset.cx,cy=+ring.dataset.cy,wx=+ring.dataset.wx,wy=+ring.dataset.wy,mode=ring.dataset.mode,re=m=>ownRing(t,m,cx,cy,wx,wy);
  const foes=t.adj.filter(i=>T[i].owner!==0);
  if(k==='build')return re('build');
  if(k==='back')return re(mode==='lines'?'build':'main');
  if(k==='line'&&foes.length>1)return re('lines');
  closeRadial();
  if(k==='x')return;
  if(k==='atk')startWall(t);
  else if(k==='out')buildStr(t,'out');
  else if(k==='line')buildStr(t,'line',foes[0]);
  else if(k.startsWith('ln'))buildStr(t,'line',+k.slice(2));
  else if(k==='port')buildPort(t,wx,wy);
  else if(k==='raft')buildRaft(t);
  else if(k==='road')startRoad();
  updateSide();
}
$('#radial').addEventListener('click',e=>{
  const b=e.target.closest('[data-r]');
  if(!b){if(Date.now()-radialAt>700)closeRadial();return}
  const k=b.dataset.r;
  if(k==='info'){$('#radialWhy').textContent=b.dataset.info;return}
  if(b.classList.contains('dis')){$('#radialWhy').textContent=b.dataset.why;return}
  const ring=$('#radialRing'),t=T[+ring.dataset.t],from=ring.dataset.from!==''?T[+ring.dataset.from]:null;
  if(started&&t&&ring.dataset.own==='1'){ownRingClick(k,t,ring);return}
  closeRadial();
  if(!started||!t)return;
  const ally=t.owner>0&&isFriend(0,t.owner);
  if(k==='atk'){
    if(ally)return;
    if(!from||from.owner!==0)return;const n=Math.floor((Math.floor(from.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für einen Marsch','bad');return}
    launch(from,t,n,0);
  }else if(k==='ally'){
    const f=F[t.owner];if(f&&!f.allied)proposeAlliance(t.owner);
  }else if(k==='brk'){
    const f=F[t.owner];if(f&&f.allied)breakAlliance(t.owner);
  }else if(k==='troops'){
    if(!ally||!from||from.owner!==0)return;const n=Math.floor((Math.floor(from.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für einen Marsch','bad');return}
    launch(from,t,n,0);toast(`${n} Soldaten ziehen zu ${F[t.owner].name}`,'good');
  }else if(k==='mat'){
    if(!ally||G.mat<30)return;
    G.mat-=30;t.troops+=3;toast(`Du spendest ${F[t.owner].name} 30 Material: +3 Soldaten in ${t.name}`,'good');
  }else if(k==='ship'){
    const src=seaSource();if(src&&t.coast&&t.coast.length)startLanding(t,src);
  }
  updateSide();
});
$('#radial').addEventListener('mouseover',e=>{const b=e.target.closest('[data-r]');if(b)$('#radialWhy').textContent=b.dataset.why});
$('#radial').addEventListener('contextmenu',e=>{e.preventDefault();if(Date.now()-radialAt>600)closeRadial()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#radial').hidden){closeRadial();e.stopImmediatePropagation()}},true);

