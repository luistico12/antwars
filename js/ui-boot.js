/* ===== Hauptmenü, Spiel-Hooks (Quests/Statistik), Start ===== */
const CUR={seed:0},MATCH={seed:null};
(function(){const nm=newMap;newMap=function(s){CUR.seed=s;return nm(s)}})();
const mapTitle=()=>t('Karte')+' '+String(CUR.seed||0).padStart(6,'0');
const DFN={easy:'Leicht',normal:'Normal',hard:'Schwer'};

/* ---------- Hauptmenü (Seitenleiste, Karte, vier große Aktionen) ---------- */
function homeBuild(){
  const el=document.createElement('div');el.id='home';el.hidden=true;
  el.innerHTML=`<canvas id="homeBg" width="480" height="300"></canvas>
  <nav id="rail" aria-label="Menü">
    <button type="button" data-s="profile">${ico('user')}<span>${t('Profil')}</span></button>
    <button type="button" data-s="achievements">${ico('trophy')}<span>${t('Erfolge')}</span></button>
    <button type="button" data-s="shop">${ico('shop')}<span>${t('Shop')}</span></button>
    <button type="button" data-s="clan">${ico('users')}<span>${t('Clan')}</span></button>
    <button type="button" data-s="leaderboard">${ico('board')}<span>Ranking</span></button>
    <div class="sp"></div>
    <button type="button" data-s="admin" id="railAdmin" hidden>${ico('admin')}<span>${t('Admin')}</span></button>
    <button type="button" data-s="settings">${ico('gear')}<span>${t('Einstellungen')}</span></button>
  </nav>
  <div class="hmain">
    <div class="hhero glass"><div class="lbl">${t('Nächste Karte')}</div><h2 id="hMapName"></h2><div class="hmeta" id="hTags"></div>
      <div class="hopts"><div class="field"><span class="lbl">${t('Art')}</span><div class="spsel" id="hSp"></div></div>
      <div class="field"><span class="lbl">${t('Gegner')}</span><div class="pills" id="hDf"></div></div></div>
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
    const b=e.target.closest('[data-s]');if(!b)return;const s=b.dataset.s;
    if(s==='settings'){openSet();return}
    if(REMOTE&&!AW.loggedIn){loginShow();return}
    openScreen(s,undefined,false);
  });
  $('#hReroll').onclick=()=>{newMap((Math.random()*1e6)|0);renderSetup();homeDraw();homeFill()};
  $('#hSolo').onclick=()=>{if(requireSession()){homeHide();setView('map')}};
  $('#hCreate').onclick=()=>lobCreate();
  $('#hJoin').onclick=()=>{if(requireSession())openScreen('lobbyJoin',undefined,false)};
  $('#hTut').onclick=()=>openScreen('tutorial',undefined,false);
}
function renderHomeOpts(){
  $('#hSp').innerHTML=['ground','leaf','termite'].map(id=>`<button class="btn" data-sp="${id}" type="button">${SP[id].name}</button>`).join('');
  $('#hDf').innerHTML=['easy','normal','hard'].map(d=>`<button data-d="${d}" type="button">${t(DFN[d])}</button>`).join('');
  $('#hSp').onclick=e=>{const b=e.target.closest('[data-sp]');if(!b)return;setupSp=b.dataset.sp;
    if(setupStart!=null&&T[setupStart].terrain!==SP[setupSp].terr){T[setupStart].owner=-1;setupStart=null;ownDirty=true}
    F[0].species=setupSp;renderSetup();homeFill()};
  $('#hDf').onclick=e=>{const b=e.target.closest('[data-d]');if(!b)return;diffKey=b.dataset.d;$$('#diffSeg [data-d]').forEach(x=>x.classList.toggle('on',x.dataset.d===diffKey));homeFill()};
}
function homeShow(){closeScreens();$('#home').hidden=false;homeDraw();homeFill();renderHeader()}
function homeHide(){$('#home').hidden=true;renderHeader()}
function homeDraw(){const c=$('#homeBg'),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,c.width,c.height);if(baseCanvas){g.drawImage(baseCanvas,0,0,c.width,c.height);if(ownCanvas)g.drawImage(ownCanvas,0,0,c.width,c.height)}}
function homeFill(){
  $('#hMapName').textContent=mapTitle();
  $('#hTags').innerHTML=`<span class="tag">${t(DFN[diffKey])}</span><span class="tag">${T.length} ${LANG==='de'?'Gebiete':'areas'}</span><span class="tag ac">3 ${t('Gegner')}</span><span class="tag">${LANG==='de'?'Schutz':'Protection'} ${mmss(PROT[diffKey])}</span>`;
  $$('#hSp [data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===setupSp));
  $$('#hDf [data-d]').forEach(b=>b.classList.toggle('on',b.dataset.d===diffKey));
  $('#railAdmin').hidden=!AW.isAdmin;
}

/* ---------- Spiel-Hooks: Schutz/Session, Quests-Statistik, Ergebnis ---------- */
let rep={terr:0,score:0,found:0,allied:false};
(function(){
  const sg=startGame;
  startGame=function(){
    if(!requireSession())return;
    if(MATCH.seed!=null&&MATCH.seed===CUR.seed){const o=Math.random;Math.random=seededRandom(CUR.seed+7);try{sg()}finally{Math.random=o}}else sg();
    rep={terr:0,score:0,found:0,allied:false};AW.report({games:1});syncCosmetics();renderHeader();
    setTimeout(()=>toast(LANG==='de'?`Schutzzeit: ${mmss(PROT[diffKey])} lang kann niemand angreifen`:`Protection: nobody can attack for ${mmss(PROT[diffKey])}`,'good'),400);
  };
  const eg=endGame;
  endGame=function(win){eg(win);AW.report({wins:win?1:0,score:myScore()});lbReset();renderHeader()};
})();
function seededRandom(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
setInterval(()=>{
  if(!started||!G||over)return;const p={};
  const own=T.filter(x=>x.owner===0).length,sc=myScore(),f=G.items.length,al=F.some(x=>!x.isPlayer&&x.allied);
  if(own>rep.terr){rep.terr=own;p.terr=own}
  if(sc>rep.score+20){rep.score=sc;p.score=sc}
  if(f>rep.found){p.found=f-rep.found;rep.found=f}
  if(al&&!rep.allied){rep.allied=true;p.allied=1}
  if(Object.keys(p).length)AW.report(p);
},3000);
$('#endBtn').addEventListener('click',()=>setTimeout(()=>{MATCH.seed=null;homeShow()},0));

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
  syncCosmetics();renderHeader();homeShow();
  AW.news().then(l=>{UI.news=l;UI.newsTop=l[0]?String(l[0].id):'';renderHeader()}).catch(()=>{});
  if(AW.loggedIn&&isDefaultName(AW.profile&&AW.profile.username))nameShow();
})();
