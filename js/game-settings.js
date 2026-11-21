/* ===== Einstellungen: Steuerung und Grafik ===== */
const KB_DEF={up:'w',down:'s',left:'a',right:'d',zoomIn:'+',zoomOut:'-',pause:'p',view:'Tab',tabAnts:'1',tabRooms:'2',tabUpg:'3',dockLeft:'q',dockRight:'r',tunnel:'t',speed1:'',speed2:'',speed4:'',speed8:''};
const KB_NAME={up:'Nach oben',down:'Nach unten',left:'Nach links',right:'Nach rechts',zoomIn:'Hineinzoomen',zoomOut:'Herauszoomen',pause:'Pause',view:'Kolonie / Weltkarte wechseln',tabAnts:'Reiter Ameisen',tabRooms:'Reiter Räume',tabUpg:'Reiter Upgrades',dockLeft:'Leiste nach links scrollen',dockRight:'Leiste nach rechts scrollen',tunnel:'Tunnelansicht (Kolonie)',speed1:'Geschwindigkeit x1',speed2:'Geschwindigkeit x2',speed4:'Geschwindigkeit x4',speed8:'Geschwindigkeit x8'};
const ST=Object.assign({fps:false,density:1,kb:{...KB_DEF}},lsGet('ak_settings',{}));ST.kb=Object.assign({...KB_DEF},ST.kb||{});
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
rebuildKeymap();applyDensity();
document.body.insertAdjacentHTML('beforeend','<div id="fpsBox" hidden></div><div id="set" hidden role="dialog" aria-label="Einstellungen"><div class="box" id="setBox"></div></div>');
$('#top .brand').appendChild($('#fpsBox'));
let setTab='kb',kbWait=null;
function renderSet(){
  const box=$('#setBox');
  let h=`<div style="display:flex;align-items:center;gap:8px"><h2 style="flex:1">Einstellungen</h2><button class="btn sm" id="setClose" type="button">Schließen</button></div>
  <div class="opt"><button class="btn sm${setTab==='kb'?' on':''}" data-st="kb" type="button">Steuerung</button><button class="btn sm${setTab==='gfx'?' on':''}" data-st="gfx" type="button">Grafik</button></div>`;
  if(setTab==='kb'){
    h+='<p class="note">Klicke auf eine Taste und drücke die neue. Die Pfeiltasten bewegen immer zusätzlich. Esc pausiert und bricht ab. Entf/Rücktaste löscht die Belegung.</p>';
    h+=Object.keys(KB_DEF).map(a=>`<div class="kbrow"><span>${KB_NAME[a]}</span><button class="btn sm${kbWait===a?' wait':''}" data-kb="${a}" type="button">${kbWait===a?'Taste drücken …':esc(keyLabel(ST.kb[a]))}</button></div>`).join('');
    h+='<div><button class="btn sm" id="kbReset" type="button">Standard wiederherstellen</button></div>';
  }else{
    h+=`<label class="ck"><input type="checkbox" id="fpsCk" ${ST.fps?'checked':''}> FPS anzeigen</label>
    <div><b>Pixeldichte</b><p class="note">Niedriger wirkt gröber und ist schneller. Höher ist schärfer und braucht mehr Leistung. Aktuell: ${Math.round(ST.density*100)}%</p>
    <div class="opt">${[0.5,0.75,1,1.5,2].map(d=>`<button class="btn sm${ST.density===d?' on':''}" data-den="${d}" type="button">${Math.round(d*100)}%</button>`).join('')}</div></div>`;
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
    else if(b.dataset.den){ST.density=+b.dataset.den;applyDensity();saveST();renderSet()}
  }
  if(e.target.id==='fpsCk'){ST.fps=e.target.checked;saveST();$('#fpsBox').hidden=!ST.fps}
});
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
  if(!started||/INPUT|TEXTAREA/.test((e.target||{}).tagName||'')||!$('#set').hidden||MP.open)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key,kb=ST.kb;
  if(k===kb.zoomIn||k===kb.zoomOut||(kb.zoomIn==='+'&&k==='=')){
    const f=(k===kb.zoomOut)?1/1.15:1.15;
    if(view==='colony'&&col){ccam.x+=VW/ccam.z/2;ccam.y+=VH/ccam.z/2;ccam.z*=f;clampCam();ccam.x-=VW/ccam.z/2;ccam.y-=VH/ccam.z/2;clampCam()}
    else if(view==='map'){mcam.x+=MW/mcam.z/2;mcam.y+=MH/mcam.z/2;mcam.z=clamp(mcam.z*f,1,4);mcam.x-=MW/mcam.z/2;mcam.y-=MH/mcam.z/2;clampMapCam()}
  }else if(k===kb.pause&&!over&&$('#pause').hidden){if(speed>0)prevSpeed=speed;setSpeedUI(0);showPause()}
  else if(k===kb.pause&&!$('#pause').hidden){resumeGame()}
  else if(k===kb.view&&!warping){e.preventDefault();if(view==='colony')setView('map');else if(col)setView('colony')}
  else if(k===kb.tabAnts||k===kb.tabRooms||k===kb.tabUpg){if(!col)return;dockTab=k===kb.tabAnts?'ants':k===kb.tabRooms?'rooms':'upg';if(view!=='colony')setView('colony');renderDock()}
  else if(k===kb.dockLeft||k===kb.dockRight){const b=$('#dockBody');b.scrollBy({left:(k===kb.dockLeft?-1:1)*Math.max(240,b.clientWidth*0.7),behavior:'smooth'})}
  else if(k===kb.tunnel&&view==='colony'&&col&&!e.ctrlKey&&!e.metaKey){col.buildSel=col.buildSel==='tunnel'?null:'tunnel';col.pin=null;refreshLive()}
  else{const sp=[kb.speed1,kb.speed2,kb.speed4,kb.speed8].indexOf(k);if(sp>=0){const v=[1,2,4,8][sp];prevSpeed=v;setSpeedUI(v)}}
});
$('#pause .box').insertAdjacentHTML('beforeend','');
$('#pEnd').insertAdjacentHTML('beforebegin','<button class="btn" id="pSet" type="button">Einstellungen</button>');
$('#pSet').onclick=openSet;
/* FPS */
(function(){let n=0,t0=performance.now();function f(now){n++;if(now-t0>=500){const fps=Math.round(n*1000/(now-t0));n=0;t0=now;const b=$('#fpsBox');b.hidden=!ST.fps;if(ST.fps)b.textContent=fps+' FPS · '+Math.round(ST.density*100)+'%'}requestAnimationFrame(f)}requestAnimationFrame(f)})();
