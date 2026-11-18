/* ===== Radialmenü (Rechtsklick auf fremdes Gebiet) ===== */
document.body.insertAdjacentHTML('beforeend','<div id="radial" hidden><div class="why"><span id="radialWhy"></span></div><div class="ring" id="radialRing"></div></div>');
function bestSource(t){
  let from=null;
  if(selT!=null&&T[selT].owner===0&&!T[selT].puppet&&T[selT].adj.includes(t.id))from=T[selT];
  if(!from){for(const i of t.adj){const c=T[i];if(c.owner===0&&!c.puppet&&(!from||c.troops>from.troops))from=c}}
  return from;
}
let radialAt=0;function closeRadial(){$('#radial').hidden=true}
function openRadial(e){
  const id=terrAtEvent(e);if(id==null||over||conqQueue.length)return false;
  const t=T[id];if(t.owner===0)return false;
  const o=t.owner,f=o>0?F[o]:null,ally=!!(f&&isFriend(0,o)),from=bestSource(t);
  const n=from?Math.floor((Math.floor(from.troops)-1)*pct/100):0;
  const opts=[];
  let atkWhy='';
  if(protLeft()>0)atkWhy=`Schutzzeit: noch ${mmss(protLeft())}. Niemand kann angreifen.`;
  else if(ally)atkWhy='Verbündete sind nicht angreifbar. Löse erst das Bündnis.';
  else if(!from)atkWhy='Kein eigenes Gebiet grenzt an. Baue dich bis zur Grenze aus.';
  else if(n<1)atkWhy='Zu wenige Soldaten in '+from.name+'.';
  opts.push({k:'atk',cls:'atk',ic:'sword',l:from&&!atkWhy?`Angriff (${n})`:'Angriff',dis:!!atkWhy,why:atkWhy||`${n} Soldaten aus ${from.name} gegen ${t.name}`});
  if(f&&f.alive){
    const cd=!f.allied&&f.dipCool>0;
    opts.push({k:'ally',ic:'flag',l:f.allied?'Bündnis lösen':'Bündnis',dis:cd,why:cd?`${f.name} verhandelt erst in ${Math.ceil(f.dipCool)}s wieder`:(f.allied?'Bündnis aufheben, danach ist das Gebiet angreifbar':'Bündnis vorschlagen')});
    const dWhy=!ally?'Spenden gibt es nur für Verbündete':G.food<30?'Zu wenig Blätter (30 nötig)':'30 Blätter spenden: +3 Soldaten für '+t.name;
    opts.push({k:'give',ic:'leaf',l:'Spenden',dis:!ally||G.food<30,why:dWhy});
  }
  if(false&&t.item){const src=bestSource(t),ok=src&&Math.floor(src.troops)>=3;opts.push({k:'item',ic:PWIC[t.item.type],l:'Powerup',dis:!ok,why:ok?`Spähtrupp (2 Soldaten aus ${src.name}) birgt ${PW[t.item.type]} +${t.item.pct}%`:'Dafür muss ein eigenes Nachbargebiet mind. 3 Soldaten haben'})}
  const ring=$('#radialRing');ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';
  const R=opts.length>2?78:66,a0=-Math.PI/2;
  ring.innerHTML=`<div class="mid">${esc(t.name)}<br><span style="font-weight:500;color:var(--sand)">${f?esc(f.name):'Wilde Ameisen'}</span></div>`+opts.map((p,i)=>{
    const a=a0+(i*2*Math.PI/Math.max(opts.length,3))+(opts.length===2?Math.PI/4:0),x=Math.cos(a)*R,y=Math.sin(a)*R+10;
    return`<button type="button" class="rb ${p.cls||''}" data-r="${p.k}" ${p.dis?'disabled':''} data-why="${esc(p.why)}" style="left:${x}px;top:${y}px"><img alt="" src="${iconURL(p.ic)}"><span>${p.l}</span></button>`}).join('');
  radialAt=Date.now();ring.dataset.t=id;ring.dataset.from=from?from.id:'';
  $('#radialWhy').textContent='';$('#radial').hidden=false;
  const r=ring.getBoundingClientRect();
  if(e.clientX<110)ring.style.left='110px';if(e.clientX>innerWidth-110)ring.style.left=(innerWidth-110)+'px';
  if(e.clientY<120)ring.style.top='120px';if(e.clientY>innerHeight-110)ring.style.top=(innerHeight-110)+'px';
  return true;
}
$('#radial').addEventListener('click',e=>{
  const b=e.target.closest('.rb');
  if(!b){if(Date.now()-radialAt>700)closeRadial();return}
  if(b.disabled){$('#radialWhy').textContent=b.dataset.why;return}
  const ring=$('#radialRing'),t=T[+ring.dataset.t],from=ring.dataset.from!==''?T[+ring.dataset.from]:null;
  closeRadial();
  if(!started||!t)return;
  const k=b.dataset.r;
  if(k==='atk'){
    if(t.owner>0&&isFriend(0,t.owner))return;
    if(!from||from.owner!==0)return;const n=Math.floor((Math.floor(from.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für einen Marsch','bad');return}
    launch(from,t,n,0);
  }else if(k==='item'){
    const src=bestSource(t);if(!t.item||!src||Math.floor(src.troops)<3)return;src.troops-=2;collectItem(t);
  }else if(k==='ally'){
    const f=F[t.owner];if(!f)return;if(f.allied)breakAlliance(t.owner);else proposeAlliance(t.owner);
  }else if(k==='give'){
    if(!(t.owner>0&&isFriend(0,t.owner))||G.food<30)return;
    G.food-=30;t.troops+=3;toast(`Du spendest ${F[t.owner].name} 30 Blätter: +3 Soldaten in ${t.name}`,'good');
  }
  updateSide();
});
$('#radial').addEventListener('mouseover',e=>{const b=e.target.closest('.rb');$('#radialWhy').textContent=b?b.dataset.why:''});
$('#radial').addEventListener('contextmenu',e=>{e.preventDefault();if(Date.now()-radialAt>600)closeRadial()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#radial').hidden){closeRadial();e.stopImmediatePropagation()}},true);

