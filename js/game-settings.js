/* ===== Einstellungen: Steuerung und Grafik ===== */
const KB_DEF={up:'w',down:'s',left:'a',right:'d',zoomIn:'+',zoomOut:'-',pause:'p',view:'Tab',tabAnts:'1',tabRooms:'2',tabUpg:'3',dockLeft:'q',dockRight:'r',tunnel:'t'};
const KB_NAME={up:'Nach oben',down:'Nach unten',left:'Nach links',right:'Nach rechts',zoomIn:'Hineinzoomen',zoomOut:'Herauszoomen',pause:'Pause',view:'Kolonie / Weltkarte wechseln',tabAnts:'Reiter Ameisen',tabRooms:'Reiter Räume',tabUpg:'Reiter Upgrades',dockLeft:'Leiste nach links scrollen',dockRight:'Leiste nach rechts scrollen',tunnel:'Tunnelansicht (Kolonie)',speed1:'Geschwindigkeit x1',speed2:'Geschwindigkeit x2',speed4:'Geschwindigkeit x4',speed8:'Geschwindigkeit x8'};
const QUAL={low:{n:'Niedrig',d:0.9},mid:{n:'Mittel',d:1.5},high:{n:'Hoch',d:2},ultra:{n:'Ultra',d:2.5}};
const FPS_OPT=[0,30,60,120,144,240];
const ST=Object.assign({fps:false,q:'',vsync:true,fpsMax:0,hideCosm:false,ui:100,pct:50,kb:{...KB_DEF}},lsGet('ak_settings',{}));ST.kb=Object.assign({...KB_DEF},ST.kb||{});
if(!QUAL[ST.q]){const d=ST.density||1.5;ST.q=d<1.2?'low':d<1.75?'mid':d<2.25?'high':'ultra'}
ST.density=QUAL[ST.q].d;
const cosmVisible=own=>own||!ST.hideCosm;
/* Bildwechsel: mit VSync per requestAnimationFrame, sonst per Nachrichtenkanal (ohne Monitor-Takt) */
const nextFrame=(()=>{
  const ch=new MessageChannel(),q=[],MINF=1000/1024;let lastT=0,pend=false;
  const run=()=>{const n=performance.now();if(n-lastT<MINF){ch.port2.postMessage(0);return}lastT=n;pend=false;const l=q.splice(0);for(const f of l){try{f(n)}catch(e){console.error('Spielfehler im Frame',e)}}};
  ch.port1.onmessage=run;
  return f=>{if(ST.vsync)requestAnimationFrame(f);else{q.push(f);if(!pend){pend=true;ch.port2.postMessage(0)}}};
})();
/* Regler und Häkchen geben den Fokus nach dem Loslassen zurück, damit WASD und alle Tasten weiter die Karte steuern */
document.addEventListener('pointerup',e=>{const el=e.target;if(el&&el.tagName==='INPUT'&&(el.type==='range'||el.type==='checkbox'))setTimeout(()=>el.blur(),0)},true);
const typing=e=>{const el=e.target||{};return el.tagName==='TEXTAREA'||el.isContentEditable||(el.tagName==='INPUT'&&!/^(range|checkbox|radio|button)$/.test(el.type))};
function applyUI(){const z=ST.ui/100;for(const s of['#dock','#side','#qLive','#chips'])document.querySelectorAll(s).forEach(e=>e.style.zoom=z===1?'':z)}
document.body.insertAdjacentHTML('beforeend','<div id="hitFrame"></div>');
function flashHit(){const h=$('#hitFrame');h.classList.remove('on');void h.offsetWidth;h.classList.add('on')}
function applyPct(){pct=ST.pct;const r=$('#pct');if(r){r.value=pct;$('#pctLbl').textContent=pct+'%'}}
const saveST=()=>lsSet('ak_settings',ST);
function keyLabel(k){return k===''?'—':k===' '?'Leertaste':k.length===1?k.toUpperCase():k}
function rebuildKeymap(){
  for(const k of Object.keys(KEYMAP))delete KEYMAP[k];
  Object.assign(KEYMAP,{ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d'});
  for(const[a,d]of[['left','l'],['right','r'],['up','u'],['down','d']]){const k=ST.kb[a];KEYMAP[k]=d;if(k.length===1){KEYMAP[k.toLowerCase()]=d;KEYMAP[k.toUpperCase()]=d}}
}
function applyDensity(){
  RD=ST.density;cv.width=Math.round(VW*RD);cv.height=Math.round(VH*RD);mv.width=Math.round(MW*RD);mv.height=Math.round(MH*RD);cg.imageSmoothingEnabled=false;
}
rebuildKeymap();applyDensity();applyUI();applyPct();
document.body.insertAdjacentHTML('beforeend','<div id="fpsBox" hidden></div><div id="set" hidden role="dialog" aria-label="Einstellungen"><div class="box" id="setBox"></div></div>');
$('#top .brand').appendChild($('#fpsBox'));
let setTab='kb',kbWait=null;
function renderSet(){
  const box=$('#setBox');
  let h=`<div style="display:flex;align-items:center;gap:8px"><h2 style="flex:1">Einstellungen</h2><button class="btn sm" id="setClose" type="button">Schließen</button></div>
  <div class="opt"><button class="btn sm${setTab==='kb'?' on':''}" data-st="kb" type="button">Steuerung</button><button class="btn sm${setTab==='gfx'?' on':''}" data-st="gfx" type="button">Grafik</button><button class="btn sm${setTab==='game'?' on':''}" data-st="game" type="button">Spiel</button><button class="btn sm${setTab==='lang'?' on':''}" data-st="lang" type="button">${t('Sprache')}</button></div>`;
  if(setTab==='kb'){
    h+='<p class="note">Klicke auf eine Taste und drücke die neue. Die Pfeiltasten bewegen immer zusätzlich. Esc pausiert und bricht ab. Entf/Rücktaste löscht die Belegung.</p>';
    h+=Object.keys(KB_DEF).map(a=>`<div class="kbrow"><span>${KB_NAME[a]}</span><button class="btn sm${kbWait===a?' wait':''}" data-kb="${a}" type="button">${kbWait===a?'Taste drücken …':esc(keyLabel(ST.kb[a]))}</button></div>`).join('');
    h+='<div><button class="btn sm" id="kbReset" type="button">Standard wiederherstellen</button></div>';
  }else if(setTab==='game'){
    h+=`<div><b>Standard-Truppenanteil</b><p class="note">Anteil der Truppen, der bei einem Angriff gesendet wird. Gilt zu Spielbeginn: <span id="pctV">${ST.pct}%</span></p><input type="range" id="pctSet" min="10" max="100" step="10" value="${ST.pct}" style="width:100%"></div>
    <label class="ck"><input type="checkbox" id="hideCk" ${ST.hideCosm?'checked':''}> Kosmetik anderer Spieler ausblenden</label>
    <div><b>Interface-Größe</b><p class="note">Skaliert Leiste, Seitenmenü und Anzeigen. Aktuell: ${ST.ui}%</p><div class="opt">${[80,90,100,115,130].map(d=>`<button class="btn sm${ST.ui===d?' on':''}" data-ui="${d}" type="button">${d}%</button>`).join('')}</div></div>
    <div><b>Cookies & Datenschutz</b><p class="note">Einwilligung jederzeit anpassen: Einstellungen und Werbefläche.</p><button class="btn sm" id="setCookie" type="button">Cookie-Einstellungen</button></div>`;
  }else if(setTab==='lang'){
    h+=`<p class="note">${t('Sprache der Oberfläche')}</p><div class="opt" id="setLang">${LANGS.map(l=>`<button class="btn sm${l[0]===LANG?' on':''}" data-l="${l[0]}" type="button">${flagSVG(l[3])} ${l[1]}</button>`).join('')}</div>`;
  }else{
    h+=`<label class="ck"><input type="checkbox" id="fpsCk" ${ST.fps?'checked':''}> FPS anzeigen</label>
    <label class="ck"><input type="checkbox" id="lbCk" ${ST.hideLb?'':'checked'}> Bestenliste anzeigen</label>
    <label class="ck"><input type="checkbox" id="vsCk" ${ST.vsync?'checked':''}> VSync (an den Monitor-Takt koppeln, ohne VSync max. 1024 FPS)</label>
    <div><b>FPS-Limit</b><div class="opt">${FPS_OPT.map(d=>`<button class="btn sm${ST.fpsMax===d?' on':''}" data-fm="${d}" type="button">${d?d:'Unbegrenzt'}</button>`).join('')}</div></div>
    <div><b>Grafikqualität</b><p class="note">Niedrig ist gröber und schneller, Ultra ist am schärfsten und braucht am meisten Leistung.</p>
    <div class="opt">${Object.keys(QUAL).map(k=>`<button class="btn sm${ST.q===k?' on':''}" data-q="${k}" type="button">${QUAL[k].n}</button>`).join('')}</div></div>`;
  }
  box.innerHTML=h;
}
const openSet=()=>{$('#set').hidden=false;kbWait=null;renderSet()};
{const sb=$('#setBtn');if(sb)sb.onclick=openSet}
$('#set').addEventListener('click',e=>{
  if(e.target.id==='set'||e.target.id==='setClose'){$('#set').hidden=true;kbWait=null;return}
  const b=e.target.closest('button');if(b){
    if(b.dataset.st){setTab=b.dataset.st;kbWait=null;renderSet()}
    else if(b.dataset.kb){kbWait=b.dataset.kb;renderSet()}
    else if(b.id==='kbReset'){ST.kb={...KB_DEF};rebuildKeymap();saveST();renderSet()}
    else if(b.dataset.q){ST.q=b.dataset.q;ST.density=QUAL[ST.q].d;applyDensity();saveST();renderSet()}
    else if(b.dataset.fm!==undefined){ST.fpsMax=+b.dataset.fm;saveST();renderSet()}
    else if(b.dataset.ui){ST.ui=+b.dataset.ui;applyUI();saveST();renderSet()}
    else if(b.dataset.l){setLang(b.dataset.l);document.documentElement.lang=LANG;if(typeof homeFill==='function')homeFill();renderHeader();renderSet()}
  }
  if(e.target.id==='lbCk'){ST.hideLb=!e.target.checked;saveST();if(typeof updateHud==='function')updateHud()}
  if(e.target.id==='vsCk'){ST.vsync=e.target.checked;saveST()}
  if(e.target.id==='hideCk'){ST.hideCosm=e.target.checked;saveST();if(typeof ownDirty!=='undefined')ownDirty=true}
  if(e.target.id==='fpsCk'){ST.fps=e.target.checked;saveST();$('#fpsBox').hidden=!ST.fps}
  if(e.target.id==='setCookie')cookieShow(true);
});
$('#set').addEventListener('input',e=>{if(e.target.id==='pctSet'){ST.pct=+e.target.value;$('#pctV').textContent=ST.pct+'%';saveST();applyPct()}});
document.addEventListener('keydown',e=>{
  if(kbWait&&!$('#set').hidden){
    e.preventDefault();e.stopImmediatePropagation();
    if(e.key==='Escape'){kbWait=null;renderSet();return}
    if(/^(Shift|Control|Alt|Meta|Enter)$/.test(e.key))return;
    if(e.key==='Backspace'||e.key==='Delete'){ST.kb[kbWait]='';kbWait=null;rebuildKeymap();saveST();renderSet();return}
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    for(const a of Object.keys(ST.kb))if(ST.kb[a]===k&&a!==kbWait)ST.kb[a]=ST.kb[kbWait];
    ST.kb[kbWait]=k;kbWait=null;rebuildKeymap();saveST();renderSet();return;
  }
  if(e.key==='Escape'&&!$('#set').hidden){$('#set').hidden=true;e.stopImmediatePropagation()}
},true);
/* eigene Tasten: Zoom, Pause, Ansicht */
document.addEventListener('keydown',e=>{
  if(!started||typing(e)||!$('#set').hidden||MP.open)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key,kb=ST.kb;
  if(k===kb.zoomIn||k===kb.zoomOut||(kb.zoomIn==='+'&&k==='=')){
    const f=(k===kb.zoomOut)?1/1.15:1.15;
    if(view==='colony'&&col){ccam.x+=VW/ccam.z/2;ccam.y+=VH/ccam.z/2;ccam.z*=f;clampCam();ccam.x-=VW/ccam.z/2;ccam.y-=VH/ccam.z/2;clampCam()}
    else if(view==='map'){mcam.x+=MW/mcam.z/2;mcam.y+=MH/mcam.z/2;mcam.z=clamp(mcam.z*f,1,4);mcam.x-=MW/mcam.z/2;mcam.y-=MH/mcam.z/2;clampMapCam()}
  }else if(k===kb.pause&&!over&&$('#pause').hidden){setSpeedUI(0);showPause()}
  else if(k===kb.pause&&!$('#pause').hidden){resumeGame()}
  else if(k===kb.view&&!warping){e.preventDefault();if(view==='colony')setView('map');else if(col)setView('colony')}
  else if(view==='map'&&/^[0-9]$/.test(k)&&typeof hudKey==='function'){e.preventDefault();hudKey(k)}
  else if(k===kb.tabAnts||k===kb.tabRooms||k===kb.tabUpg){if(!col)return;dockTab=k===kb.tabAnts?'ants':k===kb.tabRooms?'rooms':'upg';if(view!=='colony')setView('colony');renderDock()}
  else if(k===kb.dockLeft||k===kb.dockRight){const b=$('#dockBody');b.scrollBy({left:(k===kb.dockLeft?-1:1)*Math.max(240,b.clientWidth*0.7),behavior:'smooth'})}
  else if(k===kb.tunnel&&view==='colony'&&col&&!e.ctrlKey&&!e.metaKey){col.buildSel=col.buildSel==='tunnel'?null:'tunnel';col.pin=null;refreshLive()}
});
$('#pause .box').insertAdjacentHTML('beforeend','');
$('#pEnd').insertAdjacentHTML('beforebegin','<button class="btn" id="pSet" type="button">Einstellungen</button>');
$('#pSet').onclick=openSet;
/* FPS */
(function(){let n=0,t0=performance.now();function f(now){n++;if(now-t0>=500){const fps=Math.round(n*1000/(now-t0));n=0;t0=now;const b=$('#fpsBox');b.hidden=!ST.fps;if(ST.fps)b.textContent=fps+' FPS · '+QUAL[ST.q].n}nextFrame(f)}nextFrame(f)})();
