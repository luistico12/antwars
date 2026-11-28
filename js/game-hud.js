/* ===== Weltkarten-HUD im FrontWars-Stil: Bestenliste, Bauleiste, Ressourcen, Spenden, Ereignisse ===== */
let donT=30,donM=30,hudArm=null,lbAll=false,evTab='ev',evOpen=true;const evs=[];
const fk=v=>{v=Math.floor(v);return v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e4?(v/1e3).toFixed(1)+'K':v>=1e3?(v/1e3).toFixed(2)+'K':String(v)};
const ric=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${RIC[k]||''}</svg>`;
/* Bauleiste: Taste 1 bis 6 */
/* Bauleiste: alles außer Wall/Schiffen wird an einem selbst gewählten Ort platziert.
   Man muss kein Gebiet vorher auswählen – einfach die Bauart wählen und dorthin klicken. */
const HSLOTS=[
  {k:'wall',n:'Verteidigungswall',c:()=>WALL_COST},
  {k:'out',n:'Außenposten (ohne Limit)',c:t=>outCost(t?t.str.out:0)},
  {k:'port',n:'Hafen',c:()=>PORT_COST},
  {k:'raft',n:'Transportschiff (im Hafen)',c:()=>RAFT_COST},
  {k:'war',n:'Kriegsschiff (im Hafen)',c:()=>WAR_COST}
];
function hudTarget(){const t=selT!=null?T[selT]:null;return t&&t.owner===0?t:null}
function hudDo(k,t){
  if(!t||t.owner!==0)return toast('Wähle ein eigenes Gebiet','bad');
  if(k==='wall')startWall(t);
  else if(k==='out')startOutpost(t);
  else if(k==='port')startPort(t);
  else if(k==='raft')buildRaft(t);
  else if(k==='war')buildWar(t);
  updateSide();
}
function hudSlot(i){
  const s=HSLOTS[i];if(!s||!started||over)return;
  const t=hudTarget();
  if(t){hudArm=null;hudDo(s.k,t)}
  else{hudArm=hudArm===s.k?null:s.k;if(hudArm)toast(`${s.n}: klicke auf ein eigenes Gebiet, um es dort zu bauen`,'good')}
  updateHud();
}
/* Letzter Kartenklick (Weltkoordinaten), damit an der geklickten Stelle gebaut wird */
let lastMapPt=null;
mv.addEventListener('pointerdown',e=>{if(e.button===0)lastMapPt=mapWorld(e)},true);
function hudKey(k){const i=k==='0'?9:+k-1;if(i<HSLOTS.length)hudSlot(i)}
/* Klick auf ein eigenes Gebiet führt die vorgemerkte Bauaktion an dieser Stelle aus */
(function(){const mc=mapClick;mapClick=function(id){
  if(hudArm&&started&&!over&&id!=null&&T[id].owner===0){
    const k=hudArm,t=T[id],pt=lastMapPt||[t.lx*CS+5,t.ly*CS+5];
    hudArm=null;selT=id;
    if(k==='wall'){placing={kind:'wall',tid:t.id};placeWall(pt[0],pt[1])}
    else if(k==='out')placeOutpost(t,pt[0],pt[1]);
    else if(k==='port')placePortAt(t,pt[0],pt[1]);
    else hudDo(k,t);
    updateHud();return;
  }
  mc(id);updateHud()}})();
/* Ereignisse sammeln: jede Meldung landet auch im Ereignis-Fenster */
(function(){const t0=toast;toast=function(msg,kind){t0(msg,kind);if(!started)return;const l=evs[0];if(l&&l.m===msg&&gtime-l.t<2)return;evs.unshift({t:gtime,m:msg,k:kind||''});if(evs.length>60)evs.pop()}})();
(function(){const sv=setView;setView=function(v){sv(v);updateHud()}})();

$('#viewMap .stage').insertAdjacentHTML('beforeend',`<div id="wmHud" hidden>
 <div id="wmLb" class="wmp"></div>
 <div id="wmFps">– FPS</div>
 <div id="wmBar">
  <div id="wmSlots"></div>
  <div id="wmRes">
   <div class="wmpill mat" title="Material (Erde)"><img class="ih" alt="" src="${iconURL('clay')}"><b id="wmMat">0</b></div>
   <div class="wmpill leaf" title="Blätter"><img class="ih" alt="" src="${iconURL('leaf')}"><b id="wmFood">0</b></div>
   <div class="wmsl troops"><i id="wmTrFill"></i><span class="lbl">${ric('troops')}<b id="wmTr">0</b><small id="wmTrR"></small></span><input type="range" id="wmPct" min="10" max="100" step="10" aria-label="Truppenanteil"></div>
   <div class="wmsend" title="Angriff: so viele Soldaten ziehen mit">${ric('sword')} <b id="wmPctL">50%</b> <b id="wmSendN">0</b></div>
  </div>
  <div id="wmDon">
   <div class="wmsl don1"><i id="wmDtFill"></i><span class="lbl">Truppen spenden</span><span class="val" id="wmDtV"></span><input type="range" id="wmDt" min="10" max="100" step="1" aria-label="Truppen spenden"></div>
   <div class="wmsl don2"><i id="wmDmFill"></i><span class="lbl">Material spenden</span><span class="val" id="wmDmV"></span><input type="range" id="wmDm" min="10" max="100" step="1" aria-label="Material spenden"></div>
  </div>
 </div>
 <div id="wmEv" class="wmp"><div class="wmtabs"><button type="button" data-t="ev">${ico('bell')} <span>Ereignisse</span></button><button type="button" data-t="team">${ico('users')} <span>Team</span></button><button type="button" id="wmEvTog" aria-label="Ein- oder ausklappen">${ico('down')}</button></div><div id="wmEvBody"></div></div>
</div>`);
/* Spiel-Leiste über Kolonie und Weltkarte: Ansicht mittig, Zeit, Schutz, Einstellungen und Verlassen rechts */
document.body.insertAdjacentHTML('beforeend',`<div id="gTop" hidden>
 <div id="gSeg" role="tablist"><button type="button" id="gColony">Kolonie</button><button type="button" id="gMap">Weltkarte</button></div>
 <div id="gRight">
  <div class="wmc" id="wmTime"></div>
  <div class="wmc" id="wmPing" hidden></div>
  <div id="wmProt" title="Schutzzeit">${ico('shield')}<b id="wmProtT"></b></div>
  <button class="wmb" id="wmSet" type="button" aria-label="Einstellungen">${ico('gear')}</button>
  <button class="wmb" id="wmExit" type="button" aria-label="Pause">${ico('logout')}</button>
 </div></div>`);
$('#gColony').onclick=()=>{if(col)setView('colony')};
$('#gMap').onclick=()=>setView('map');
$('#wmSlots').innerHTML=HSLOTS.map((s,i)=>`<button type="button" class="slot" data-i="${i}"><i class="no">${i+1}</i><span class="ic" style="color:${RCOL[s.k]||'#fff'}">${ric(s.k)}</span><small class="cost"></small></button>`).join('');
$('#wmSlots').addEventListener('click',e=>{const b=e.target.closest('.slot');if(b)hudSlot(+b.dataset.i)});
$('#wmSet').onclick=()=>openSet();
$('#wmExit').onclick=()=>{if(started&&!over){setSpeedUI(0);showPause()}};
$('#wmPct').oninput=e=>{pct=+e.target.value;$('#pct').value=pct;$('#pctLbl').textContent=pct+'%';updateHud()};
$('#wmDt').oninput=e=>{donT=+e.target.value;updateHud()};
$('#wmDm').oninput=e=>{donM=+e.target.value;updateHud()};
$('#wmLb').addEventListener('click',e=>{
  if(e.target.closest('.wmh')){ST.hideLb=!ST.hideLb;saveST();updateHud();return}
  if(e.target.closest('#wmMore')){lbAll=!lbAll;updateHud()}});
$('#wmEv').addEventListener('click',e=>{
  const tb=e.target.closest('[data-t]');if(tb){evTab=tb.dataset.t;evOpen=true;updateHud();return}
  if(e.target.closest('#wmEvTog')){evOpen=!evOpen;updateHud()}
});
$('#wmEv').addEventListener('submit',e=>{e.preventDefault();const i=$('#wmChatI'),x=i&&i.value.trim();
  if(x&&typeof LOB!=='undefined'&&LOB.ch){LOB.ch.send({t:'chat',n:AW.name,x:x.slice(0,200)});i.value=''}});
['pointerdown','mousedown','wheel','contextmenu','touchstart'].forEach(ev=>$('#wmHud').addEventListener(ev,e=>{if(e.target.closest('.wmp,#wmBar,#wmTop'))e.stopPropagation()},ev==='wheel'?{passive:true}:false));

const sumTroops=f=>T.reduce((a,t)=>a+(t.owner===f?t.troops:0),0);
function hudBoard(){
  const land=T.reduce((a,t)=>a+t.cells.length,0)||1;
  const rows=F.filter(f=>f.alive||f.id===0).map(f=>{const mine=T.filter(t=>t.owner===f.id);return{id:f.id,name:f.name,rgb:f.rgb,share:100*mine.reduce((a,t)=>a+t.cells.length,0)/land,n:mine.length,tr:Math.floor(mine.reduce((a,t)=>a+t.troops,0)),me:f.id===0}})
    .sort((a,b)=>b.share-a.share);
  const tag=AW.profile&&AW.profile.clan_tag?`<span class="ctag">${esc(AW.profile.clan_tag)}</span>`:'';
  const row=(r,i)=>`<tr class="${r.me?'me':''}"><td>${i+1}</td><td>${i===0?`<img class="crn" alt="" src="${crownURL(cosmOf(r.id).crown||null)}">`:`<i class="dot" style="background:${rgb(r.rgb)}"></i>`}${r.me?tag:''}<b>${esc(r.name)}</b></td><td>${r.share.toFixed(1)}%</td><td>${r.n}</td><td>${fk(r.tr)}</td></tr>`;
  const top=lbAll?rows:rows.slice(0,4),mi=rows.findIndex(r=>r.me);
  let b=top.map((r,i)=>row(r,i)).join('');if(mi>=top.length)b+=row(rows[mi],mi);
  return `<button type="button" class="wmh" aria-expanded="${!ST.hideLb}" aria-label="Bestenliste ein-/ausblenden" title="Bestenliste ein-/ausblenden">${ico('board')}<span>Team: ${esc(F[0].name)}</span><i class="mode">${MODES[modeKey].n.toUpperCase()}</i><i class="chev">${ico('down')}</i></button><table><thead><tr><th>#</th><th>Spieler</th><th>Besitz</th><th>Gebiete</th><th>Truppen</th></tr></thead><tbody>${b}</tbody></table><button type="button" id="wmMore" class="more">${lbAll?'−':'+'}</button>`;
}
function hudEvents(){
  const tabs=$$('#wmEv [data-t]');tabs.forEach(b=>b.classList.toggle('on',b.dataset.t===evTab));
  $('#wmEv').classList.toggle('shut',!evOpen);
  if(!evOpen){$('#wmEvBody').innerHTML='';$('#wmEvBody')._h='';return}
  let h;
  if(evTab==='ev')h=evs.length?evs.slice(0,14).map(e=>`<div class="ev ${e.k}"><time>${mmss(e.t)}</time>${esc(e.m)}</div>`).join(''):'<div class="none">Keine Ereignisse</div>';
  else{
    const al=F.filter(f=>f.allied&&f.alive);
    h=(al.length?al.map(f=>`<div class="ev"><i class="dot" style="background:${rgb(f.rgb)}"></i><b>${esc(f.name)}</b> · ${T.filter(t=>t.owner===f.id).length} Gebiete · ${fk(sumTroops(f.id))} Truppen</div>`).join(''):'<div class="none">Keine Verbündeten. Rechtsklick auf ein fremdes Gebiet, Bündnis.</div>');
    if(typeof LOB!=='undefined'&&LOB.ch)h+=`<div class="chat">${(LOB.chat||[]).slice(-6).map(m=>`<div><b>${esc(m.n)}:</b> ${esc(m.x)}</div>`).join('')}</div><form id="wmChatF"><input id="wmChatI" maxlength="200" placeholder="Nachricht an die Gruppe" autocomplete="off"></form>`;
  }
  setHTML($('#wmEvBody'),h);
}
function updateHud(){
  const on=started&&view==='map',hud=$('#wmHud'),live=!!(started&&!over),gt=$('#gTop');
  if(gt){
    gt.hidden=!live;
    if(live){
      $('#gColony').classList.toggle('on',view==='colony');
      $('#gMap').classList.toggle('on',view==='map');
      $('#wmTime').textContent=clockT(rtime());
      const pl=protLeft(),pw=$('#wmProt');
      pw.classList.toggle('on',pl>0);
      $('#wmProtT').textContent=pl>0?`Schutz ${mmss(pl)}`:'';
      const pg=$('#wmPing');
      if(typeof NET!=='undefined'&&NET.role&&NET.role!=='solo'&&NET.ping!=null){pg.hidden=false;pg.textContent=Math.round(NET.ping)+' ms'}else pg.hidden=true;
    }
  }
  $('#viewMap').classList.toggle('wm',started);document.body.classList.toggle('wmv',on);
  hud.hidden=!on;if(!on||!G)return;
  $('#viewMap .stage').style.setProperty('--ar',(MW/MH).toFixed(3));
  $('#wmLb').hidden=false;setHTML($('#wmLb'),hudBoard());
  $('#wmLb').classList.toggle('shut',!!ST.hideLb);
  const tg=hudTarget();
  $$('#wmSlots .slot').forEach((el,i)=>{const s=HSLOTS[i],c=s.c?s.c(tg):null;
    const poor=c?poorFor(c):false,bad=tg&&((s.k==='port'&&(!tg.coast||!tg.coast.length))||(s.k==='raft'&&!portsOf(tg).some(p=>p.rafts<p.max))||(s.k==='war'&&(!portsOf(tg).length||warsOf(tg)>=WAR_MAX)));
    el.classList.toggle('poor',poor||!!bad);el.classList.toggle('arm',hudArm===s.k);
    el.querySelector('.cost').textContent=c?String(c.mat):'';
    el.title=`${i+1}: ${s.n}${c?` (${costLbl(c)})`:''}`});
  $('#wmMat').textContent=fk(G.mat);$('#wmFood').textContent=fk(G.food);
  const tot=sumTroops(0),src=tg&&tg.troops>=2?tg:null,send=Math.floor(((src?src.troops-1:tot))*pct/100);
  $('#wmTr').textContent=fk(tot);$('#wmTrR').textContent=src?`· ${src.name}`:'';
  $('#wmTrFill').style.width=pct+'%';$('#wmPctL').textContent=pct+'%';$('#wmSendN').textContent=fk(send);
  if(document.activeElement!==$('#wmPct'))$('#wmPct').value=pct;
  const big=T.filter(t=>t.owner===0).reduce((a,t)=>Math.max(a,t.troops-1),0);
  $('#wmDtFill').style.width=donT+'%';$('#wmDmFill').style.width=donM+'%';
  $('#wmDtV').textContent=`${donT}% · ${fk(big*donT/100)}`;$('#wmDmV').textContent=`${donM}% · ${fk(G.mat*donM/100)}`;
  if(document.activeElement!==$('#wmDt'))$('#wmDt').value=donT;if(document.activeElement!==$('#wmDm'))$('#wmDm').value=donM;
  hudEvents();
}
const _us=updateSide;updateSide=function(){_us();updateHud()};
