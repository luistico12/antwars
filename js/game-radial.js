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
  troops:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
};
const RCOL={info:'#8f95a1',mat:'#e0a91d',troops:'#3dbf6a',ally:'#3dbf6a',brk:'#e5534b'};
/* Ring wie bei FrontWars: Schwert in der Mitte (Angriff), darum Segmente (Info, Bündnis, Spenden) */
function radialSVG(segs,atk){
  const R2=118,R1=64,C=150,N=segs.length,gap=2.4*Math.PI/180,FS=15;
  const pt=(r,a)=>`${(C+r*Math.cos(a)).toFixed(1)} ${(C+r*Math.sin(a)).toFixed(1)}`;
  let out='';
  segs.forEach((g,i)=>{
    const ac=-Math.PI/2+i*2*Math.PI/N,col=RCOL[g.k],cls=`seg${g.dis?' dis':''}`,at=`data-r="${g.k}" data-why="${esc(g.why)}"${g.info?` data-info="${esc(g.info)}"`:''}`;
    let shape,a1,a2;
    if(N===1){const rm=(R1+R2)/2;shape=`<circle cx="${C}" cy="${C}" r="${rm}" fill="none" stroke="${col}" stroke-width="${R2-R1}"/>`;a1=ac-Math.PI/2;a2=ac+Math.PI/2}
    else{a1=ac-Math.PI/N+gap/2;a2=ac+Math.PI/N-gap/2;const lg=(a2-a1)>Math.PI?1:0;
      shape=`<path d="M${pt(R2,a1)} A${R2} ${R2} 0 ${lg} 1 ${pt(R2,a2)} L${pt(R1,a2)} A${R1} ${R1} 0 ${lg} 0 ${pt(R1,a1)} Z" fill="${col}"/>`}
    const [ix,iy]=pt((R1+R2)/2,ac).split(' ');
    const bottom=Math.sin(ac)>0.2,rl=bottom?R2+FS+5:R2+6;
    const lp=bottom?`M${pt(rl,a2)} A${rl} ${rl} 0 0 0 ${pt(rl,a1)}`:`M${pt(rl,a1)} A${rl} ${rl} 0 0 1 ${pt(rl,a2)}`;
    out+=`<g class="${cls}" ${at}>${shape}<g transform="translate(${ix} ${iy}) scale(1.3) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${RIC[g.k]}</g>
      <path id="rl${i}" d="${lp}" fill="none" stroke="none"/><text class="rlbl"><textPath href="#rl${i}" startOffset="50%" text-anchor="middle">${esc(t(g.l))}</textPath></text></g>`;
  });
  out+=`<g class="atk${atk.dis?' dis':''}" data-r="atk" data-why="${esc(atk.why)}"><circle cx="${C}" cy="${C}" r="${R1-8}" fill="#1b2130" stroke="rgba(255,255,255,.14)" stroke-width="3"/>
    <g transform="translate(${C} ${C-5}) scale(2.3) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SV.sword}</g>
    ${atk.n?`<text x="${C}" y="${C+34}" text-anchor="middle" class="rn">${atk.n}</text>`:''}</g>`;
  return`<svg viewBox="0 0 300 300" width="300" height="300" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}
function openRadial(e){
  const id=terrAtEvent(e);if(id==null||over||conqQueue.length)return false;
  const t=T[id];if(t.owner===0)return false;
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
  const ring=$('#radialRing');ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';
  ring.innerHTML=radialSVG(segs,atk);
  radialAt=Date.now();ring.dataset.t=id;ring.dataset.from=from?from.id:'';
  $('#radialWhy').textContent=`${t.name} · ${f?f.name:'Wilde Ameisen'}`;$('#radial').hidden=false;
  const M=150,aw=parseFloat(getComputedStyle($('#radial')).right)||0;
  ring.style.left=Math.max(M,Math.min(innerWidth-aw-M,e.clientX))+'px';ring.style.top=Math.max(M,Math.min(innerHeight-M,e.clientY))+'px';
  return true;
}
$('#radial').addEventListener('click',e=>{
  const b=e.target.closest('[data-r]');
  if(!b){if(Date.now()-radialAt>700)closeRadial();return}
  const k=b.dataset.r;
  if(k==='info'){$('#radialWhy').textContent=b.dataset.info;return}
  if(b.classList.contains('dis')){$('#radialWhy').textContent=b.dataset.why;return}
  const ring=$('#radialRing'),t=T[+ring.dataset.t],from=ring.dataset.from!==''?T[+ring.dataset.from]:null;
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
  }
  updateSide();
});
$('#radial').addEventListener('mouseover',e=>{const b=e.target.closest('[data-r]');if(b)$('#radialWhy').textContent=b.dataset.why});
$('#radial').addEventListener('contextmenu',e=>{e.preventDefault();if(Date.now()-radialAt>600)closeRadial()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#radial').hidden){closeRadial();e.stopImmediatePropagation()}},true);

