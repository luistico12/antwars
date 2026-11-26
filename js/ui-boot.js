/* ===== Hauptmenü, Spiel-Hooks (Quests/Statistik), Start ===== */
const CUR={seed:0},MATCH={seed:null};
(function(){const nm=newMap;newMap=function(s){CUR.seed=s;return nm(s)}})();
const mapTitle=()=>t('Karte')+' '+String(CUR.seed||0).padStart(6,'0');
const DFN={easy:'Leicht',normal:'Normal',hard:'Schwer'};
const DIFF_ORDER=['easy','normal','hard'];

/* ---------- Hauptmenü (Seitenleiste, Karte, vier große Aktionen) ---------- */
function homeBuild(){
  const el=document.createElement('div');el.id='home';el.hidden=true;
  el.innerHTML=`<canvas id="homeBg" width="480" height="300"></canvas>
  <nav id="rail" aria-label="Menü">
    <button type="button" data-s="profile">${ico('user')}<span>${t('Profil')}</span></button>
    <button type="button" data-s="achievements">${ico('trophy')}<span>${t('Erfolge')}</span></button>
    <button type="button" data-s="shop">${ico('shop')}<span>${t('Shop')}</span></button>
    <button type="button" data-s="inventory">${ico('box')}<span>${t('Inventar')}</span></button>
    <button type="button" data-s="friends">${ico('heart')}<span>${t('Freunde')}</span></button>
    <button type="button" data-s="clan">${ico('users')}<span>${t('Clan')}</span></button>
    <button type="button" data-s="leaderboard">${ico('board')}<span>Ranking</span></button>
    <div class="sp"></div>
    <button type="button" data-s="admin" id="railAdmin" hidden>${ico('admin')}<span>${t('Admin')}</span></button>
    <button type="button" data-s="settings">${ico('gear')}<span>${t('Einstellungen')}</span></button>
  </nav>
  <div class="hmain">
    <div class="hhero glass"><div class="lbl">${t('Nächste Karte')}</div><h2 id="hMapName"></h2><div class="hmeta" id="hTags"></div>
      <div class="hopts"><div class="field"><span class="lbl">${t('Art')}</span><div class="spsel" id="hSp"></div></div>
      <div class="field"><span class="lbl">${t('Schwierigkeit')}</span>
        <div class="hsl"><input type="range" id="hDiff" min="1" max="3" step="1" value="2" aria-label="${t('Schwierigkeit')}"><b id="hDiffV">${t('Normal')}</b></div>
        <div class="hmarks"><span>${t('Leicht')}</span><span>${t('Normal')}</span><span>${t('Schwer')}</span></div></div>
      <div class="field wide"><div class="modes" id="hMode"></div></div></div>
      <div class="row"><button class="btn" id="hReroll" type="button">${ico('refresh')} ${t('Neue Karte')}</button></div></div>
    <div class="hacts">
      <button class="hact pri" id="hSolo" type="button">${ico('play')}<span>${t('Spielen')}</span></button>
      <button class="hact" id="hCreate" type="button">${ico('plus')}<span>${t('Lobby erstellen')}</span></button>
      <button class="hact" id="hJoin" type="button">${ico('enter')}<span>${t('Lobby beitreten')}</span></button>
      <button class="hact" id="hTut" type="button">${ico('map')}<span>${t('Tutorial')}</span></button>
    </div></div>`;
  document.body.appendChild(el);
  const sc=document.createElement('div');sc.id='scr';sc.hidden=true;sc.innerHTML='<div id="scrP"></div>';document.body.appendChild(sc);
  const lg=document.createElement('div');lg.id='login';lg.hidden=true;document.body.appendChild(lg);
  renderHomeOpts();
  $('#rail').addEventListener('click',e=>{
    const b=e.target.closest('[data-s]');if(!b)return;document.body.classList.remove('navopen');const s=b.dataset.s;
    if(s==='settings'){openSet();return}
    if(REMOTE&&!AW.loggedIn){loginShow();return}
    openScreen(s,undefined,false);
  });
  $('#hReroll').onclick=()=>{newMap((Math.random()*1e6)|0);renderSetup();homeDraw();homeFill()};
  $('#hSolo').onclick=()=>{if(requireSession()){homeHide();setView('map');pickStart()}};
  $('#hCreate').onclick=()=>lobCreate();
  $('#hJoin').onclick=()=>{if(requireSession())openScreen('lobbyJoin',undefined,false)};
  $('#hTut').onclick=()=>openScreen('tutorial',undefined,false);
}
function renderHomeOpts(){
  $('#hSp').innerHTML=['ground','leaf','termite'].map(id=>`<button class="btn" data-sp="${id}" type="button">${SP[id].name}</button>`).join('');
  $('#hSp').onclick=e=>{const b=e.target.closest('[data-sp]');if(!b)return;setupSp=b.dataset.sp;
    if(setupStart!=null&&T[setupStart].terrain!==SP[setupSp].terr){T[setupStart].owner=-1;setupStart=null;ownDirty=true}
    F[0].species=setupSp;renderSetup();homeFill()};
  $('#hMode').innerHTML=Object.keys(MODES).map(m=>{const x=MODES[m];return `<button data-m="${m}" type="button" class="mode-card"><span class="mc-t"><b>${x.n}</b><em>${x.spd}x</em></span></button>`}).join('');
  const ds=$('#hDiff');if(ds)ds.oninput=()=>{diffKey=DIFF_ORDER[Math.max(0,Math.min(2,(+ds.value||2)-1))];homeFill()};
  $('#hMode').onclick=e=>{const b=e.target.closest('[data-m]');if(!b||modeKey===b.dataset.m)return;modeKey=b.dataset.m;newMap((Math.random()*1e6)|0);renderSetup();homeDraw();homeFill()};
}
function homeShow(){closeScreens();document.body.classList.remove('navopen');$('#home').hidden=false;homeDraw();homeFill();renderHeader()}
function homeHide(){$('#home').hidden=true;renderHeader()}
function homeDraw(){const c=$('#homeBg'),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,c.width,c.height);if(baseCanvas){g.drawImage(baseCanvas,0,0,c.width,c.height);if(ownCanvas)g.drawImage(ownCanvas,0,0,c.width,c.height)}}
function homeFill(){
  $('#hMapName').textContent=mapTitle();
  const bots=MODES[modeKey].bots,ds=$('#hDiff');
  if(ds)ds.value=DIFF_ORDER.indexOf(diffKey)+1;
  const dv=$('#hDiffV');if(dv)dv.textContent=t(DFN[diffKey]);
  $('#hTags').innerHTML=`<span class="tag">${t(DFN[diffKey])}</span><span class="tag">${T.length} ${LANG==='de'?'Gebiete':'areas'}</span><span class="tag ac">${bots} ${t('Gegner')}</span><span class="tag">${MODES[modeKey].n} · ${MODES[modeKey].spd}x</span><span class="tag">${LANG==='de'?'Schutz':'Protection'} ${mmss(PROT[diffKey])}</span>`;
  $$('#hSp [data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===setupSp));
  $$('#hMode [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===modeKey));
  $('#railAdmin').hidden=!AW.isAdmin;
}

/* ---------- Spiel-Hooks: Schutz/Session, Quests-Statistik, Ergebnis ---------- */
let rep={terr:0,score:0,found:0,allied:false};
(function(){
  const sg=startGame;
  startGame=function(){
    if(!requireSession())return;
    document.body.classList.remove('navopen');
    loadShow(LANG==='de'?'Die Kolonie wird aufgebaut …':'Building your colony …');
    setTimeout(loadHide,700);
    if(MATCH.seed!=null&&MATCH.seed===CUR.seed){const o=Math.random;Math.random=seededRandom(CUR.seed+7);try{sg()}finally{Math.random=o}}else sg();
    rep={terr:0,score:0,found:0,allied:false};AW.report({games:1});Hist.begin();syncCosmetics();renderHeader();
    setTimeout(()=>toast(LANG==='de'?`Schutzzeit: ${mmss(PROT[diffKey])} lang kann niemand angreifen`:`Protection: nobody can attack for ${mmss(PROT[diffKey])}`,'good'),400);
  };
  const eg=endGame;
  endGame=function(win){eg(win);Hist.end(win);AW.report({wins:win?1:0,score:myScore()});lbReset();renderHeader();setTimeout(potdRefresh,1500)};
})();
function seededRandom(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let qSec=0;
setInterval(()=>{
  if(!started||!G||over)return;const p={};
  const own=T.filter(x=>x.owner===0).length,sc=myScore(),f=G.items.length,al=F.some(x=>!x.isPlayer&&x.allied);
  if(own>rep.terr){rep.terr=own;p.terr=own}
  if(sc>rep.score+20){rep.score=sc;p.score=sc}
  if(f>rep.found){p.found=f-rep.found;rep.found=f}
  if(al&&!rep.allied){rep.allied=true;p.allied=1}
  Object.assign(p,qTake());
  if(speed>0){qSec+=3;if(qSec>=60){qSec-=60;p.mins=1}}
  if(Object.keys(p).length){AW.report(p);Hist.add(p)}else Hist.tick();
},3000);
$('#endBtn').addEventListener('click',()=>setTimeout(()=>{MATCH.seed=null;pickStop();homeShow()},0));

/* ---------- Startgebiet wählen: 15 Sekunden, danach wird zufällig gewählt ---------- */
const PICK_SECS=15;let pick15=null;
document.body.insertAdjacentHTML('beforeend','<div id="pickBar" hidden><b id="pickTxt"></b><i><u id="pickFill"></u></i></div>');
function pickStart(){
  pickStop();setupStart!=null&&(T[setupStart].owner=-1);setupStart=null;ownDirty=true;
  $('#setupPanel').hidden=true;
  pick15={t:PICK_SECS,iv:setInterval(()=>{
    if(!pick15)return;pick15.t-=0.1;
    const sp=SP[setupSp];$('#pickTxt').textContent=`${t('Wähle dein Startgebiet')} (${TERR[sp.terr].name}) · ${Math.max(0,Math.ceil(pick15.t))}s`;
    $('#pickFill').style.width=Math.max(0,pick15.t/PICK_SECS*100)+'%';
    if(pick15.t<=0){const opts=T.filter(x=>x.terrain===sp.terr);const x=opts[Math.floor(Math.random()*opts.length)]||T[0];mapClick(x.id)}
  },100)};
  $('#pickBar').hidden=false;
  if(MODES[modeKey].rnd){const sp=SP[setupSp],opts=T.filter(x=>x.terrain===sp.terr);mapClick((opts[Math.floor(Math.random()*opts.length)]||T[0]).id)}
}
function pickStop(){if(pick15){clearInterval(pick15.iv);pick15=null}$('#pickBar').hidden=true}
(function(){const mc=mapClick;mapClick=function(id){const before=setupStart;mc(id);if(!started&&pick15&&setupStart!=null&&setupStart!==before){pickStop();$('#btnStart').onclick()}}})();

/* ---------- Erfolge und Quests live im Spiel ---------- */
document.body.insertAdjacentHTML('beforeend','<div id="qLive" hidden></div>');
let qOpen=false,qSeen=new Set(),qInit=false;
function qCheck(){
  if(!started||!AW.profile)return;
  for(const q of activeQuests()){const g=qProg(q);
    if(g.done&&!g.claimed&&!qSeen.has(q[0])){qSeen.add(q[0]);if(qInit)toast(`${LANG==='de'?'Erfolg':'Achievement'}: ${t(q[5])} (+${q[4]} Rubys)`,'good')}}
  qInit=true;
}
function qLiveRender(){
  const el=$('#qLive');
  if(!started||!AW.profile||over){el.hidden=true;return}
  const L=activeQuests().filter(q=>!qProg(q).claimed).sort((a,b)=>qProg(b).done-qProg(a).done||qProg(b).v/b[3]-qProg(a).v/a[3]).slice(0,7),ready=L.filter(q=>qProg(q).done).length;
  el.hidden=false;
  setHTML(el,`<button type="button" class="qpill${ready?' rdy':''}" id="qTog">${ico('trophy')} ${ready?`${ready} ${t('abholbar')}`:t('Quests')}</button>`+(qOpen?`<div class="qbox">${L.map(q=>{const g=qProg(q);return `<div class="qrow${g.done?' done':''}"><span>${t(q[5])}</span><div class="bar"><i style="width:${Math.round(100*g.v/q[3])}%"></i></div>${g.done?`<button class="btn sm pri" data-qc="${q[0]}" type="button">+${q[4]}</button>`:`<small>${g.v}/${q[3]}</small>`}</div>`}).join('')||`<div class="mini">${t('Alles abgeholt')}</div>`}</div>`:''));
}
$('#qLive').addEventListener('click',e=>{
  if(e.target.closest('#qTog')){qOpen=!qOpen;$('#qLive')._h=null;qLiveRender();return}
  const c=e.target.closest('[data-qc]');if(c)AW.claim(c.dataset.qc).then(()=>toast('+ Rubys','good')).catch(toastErr);
});
AW.on(()=>{qCheck();qLiveRender()});
setInterval(()=>{qCheck();qLiveRender()},3000);
(function(){const sg=startGame;startGame=function(){sg();applyPct();qSeen=new Set();qInit=false;qCheck();qLiveRender()}})();

/* ---------- Start ---------- */
AW.on(()=>{syncCosmetics();if(!$('#home').hidden)homeFill()});
(async()=>{
  document.documentElement.lang=LANG;
  newMap((Math.random()*1e6)|0);renderSetup();
  homeBuild();
  $('#setupPanel').insertAdjacentHTML('afterbegin',`<button class="btn sm" id="backHome" type="button" style="align-self:flex-start">${ico('back')} ${t('Hauptmenü')}</button>`);
  $('#backHome').onclick=homeShow;
  renderHeader();adRender();if(!CONSENT.set)cookieShow(false);
  await AW.init();
  syncCosmetics();renderHeader();homeShow();loadHide();potdRefresh();setInterval(potdRefresh,300000);
  AW.news().then(l=>{UI.news=l;UI.newsTop=l[0]?String(l[0].id):'';renderHeader()}).catch(()=>{});
  if(AW.loggedIn&&isDefaultName(AW.profile&&AW.profile.username))nameShow();
  else if(REMOTE&&!AW.loggedIn&&AW.remote)loginShow();
})();
