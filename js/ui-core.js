/* ===== UI-Kern: Kopfzeile, Screen-Manager, Login, Cookie-Banner, Werbefläche ===== */
const S={};            // Screen-Renderer: S.name(arg) → liefert HTML, optional .bind
const SCR={stack:[],cur:null};
const initials=n=>(String(n||'?').trim()[0]||'?').toUpperCase();
const fmtDate=d=>{try{return new Date(d).toLocaleDateString(LANG==='de'?'de-DE':'en-GB',{day:'numeric',month:'long',year:'numeric'})}catch(e){return''}};
const num=n=>Number(n||0).toLocaleString(LANG==='de'?'de-DE':'en-GB');

/* ---------- Screen-Manager ---------- */
function shell(title,{sub='',right='',back=true,narrow=false}={},body='',foot=''){
  $('#scrP').className=narrow?'narrow':'';
  return `<div class="sh">${back?`<button class="ibtn" data-back type="button" aria-label="${t('Zurück')}">${ico('back')}</button>`:''}<div><h2>${title}</h2>${sub?`<div class="sub">${sub}</div>`:''}</div><div class="sp"></div>${right}</div><div class="sb">${body}</div>${foot?`<div class="sf">${foot}</div>`:''}`;
}
function openScreen(name,arg,push=true){
  if(!S[name])return;
  if(push&&SCR.cur)SCR.stack.push(SCR.cur);
  SCR.cur={name,arg};
  closeRadialSafe();
  const el=$('#scr');el.hidden=false;
  render();
  syncRail();
}
function render(){
  if(!SCR.cur)return;const{name,arg}=SCR.cur;
  const scr=S[name],p=$('#scrP'),st=p.querySelector('.sb')?p.querySelector('.sb').scrollTop:0;
  const html=scr(arg);
  if(html===false)return;
  p.innerHTML=html;
  if(scr.bind)scr.bind(p,arg);
  const sb=p.querySelector('.sb');if(sb)sb.scrollTop=st;
}
function screenBack(){
  if(SCR.cur&&SCR.cur.name==='lobby'&&typeof lobLeave==='function')lobLeave(true);
  const prev=SCR.stack.pop();
  if(prev){SCR.cur=prev;render()}else closeScreens();
  syncRail();
}
function closeScreens(){
  SCR.stack.length=0;SCR.cur=null;$('#scr').hidden=true;$('#scrP').innerHTML='';
  if(typeof lobLeave==='function'&&LOB.code)lobLeave(true);syncRail();
}
function closeRadialSafe(){try{if(typeof closeRadial==='function')closeRadial()}catch(e){}}
function syncRail(){
  const cur=SCR.cur&&SCR.cur.name;
  $$('#rail button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===cur));
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-back]');if(b&&$('#scr').contains(b)){screenBack();return}
  const g=e.target.closest('[data-go]');if(g&&$('#scr').contains(g)){openScreen(g.dataset.go,g.dataset.arg||undefined)}
  if(e.target.id==='scr')screenBack();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(!$('#login').hidden&&!loginRequired()){loginHide();e.stopImmediatePropagation();return}
  if(!$('#scr').hidden){screenBack();e.stopImmediatePropagation()}
},true);

/* ---------- Kopfzeile (Logo, Menü, News, Sprache, Profil) ---------- */
function newsUnseen(){return lsGet('aw_news_seen','')!==(UI.newsTop||'')&&!!UI.newsTop}
const UI={newsTop:''};
function renderHeader(){
  const p=AW.profile;
  $('#hdrR').innerHTML=`
    <button class="ibtn" id="hdrMenu" type="button" aria-label="${t('Menü')}" ${started?'':'hidden'}>${ico('menu')}</button>
    <button class="ibtn" id="hdrNews" type="button" aria-label="${t('Neuigkeiten')}">${ico('news')}${newsUnseen()?'<i class="dot"></i>':''}</button>
    <button class="ibtn" id="hdrForum" type="button" aria-label="${t('Forum')}">${ico('chat')}</button>
    <button id="hdrProf" type="button" aria-label="${t('Profil')}"><span class="av">${p&&safeAvatar(p.avatar)?`<img alt="" src="${safeAvatar(p.avatar)}">`:ico('user')}</span><span class="nm">${AW.loggedIn?esc(p&&p.username||''):t('Anmelden')}</span>${AW.loggedIn&&p?`<span class="ruby">${ico('ruby')}${p.rubys}</span>`:''}</button>`;
  $('#hdrMenu').onclick=()=>{if(started&&!over){const k=$('#speed [data-sp="0"]');k&&k.click()}};
  $('#hdrNews').onclick=()=>openScreen('news',undefined,false);
  $('#hdrForum').onclick=()=>openScreen('forum',undefined,false);
  $('#hdrProf').onclick=()=>{if(REMOTE&&!AW.loggedIn)loginShow();else openScreen('profile',undefined,false)};
  const ch=$('#ctlHint');if(ch)ch.textContent=t(matchMedia('(pointer:coarse)').matches?'Zwei Finger: zoomen · Ein Finger ziehen: verschieben · Lange drücken: Menü':'Mausrad: Zoom · WASD oder Pfeiltasten: bewegen · Rechte Maustaste halten und ziehen: verschieben');
}
/* Spieler des Tages (meiste Siege heute) */
function potdRender(){
  const el=$('#potd');if(!el)return;const p=UI.potd;
  if(!p){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=`<span class="pcrown">${ico('crown')}</span><span class="plbl">${t('SPIELER DES TAGES')}</span><i class="psep"></i>${p.clan_tag?`<span class="pclan">${esc(p.clan_tag)}</span>`:''}<b class="pname">${esc(p.username)}</b><i class="psep"></i><span class="pwins"><b>${p.wins}</b> ${t('Siege heute')}</span>`;
}
async function potdRefresh(){try{UI.potd=await AW.potd()}catch(e){UI.potd=null}potdRender()}
document.getElementById('logo').addEventListener('click',()=>{if(!started)homeShow&&homeShow()});
AW.on(()=>{renderHeader();if(SCR.cur&&!$('#scr').hidden&&!UI.noRerender)render()});

/* ---------- Werbefläche (rechts / mobil unten) – wird nie vom UI überlagert ---------- */
function adRender(){
  const el=$('#adSlot');
  if(CONSENT.ads){
    el.innerHTML='<img src="img/ad.png" alt="Werbung" onerror="this.parentNode.innerHTML=\'<span>Werbefläche<br>160 × 600</span>\'">';
  }else el.innerHTML=`<span>${t('Werbung')}<br><small>${CONSENT.set?'deaktiviert':''}</small></span>`;
}

/* ---------- Cookie-Banner ---------- */
function cookieShow(open){
  let c=$('#cookie');if(c)c.remove();
  c=document.createElement('div');c.id='cookie';c.className='glass';c.setAttribute('role','dialog');c.setAttribute('aria-label',t('Cookies & Datenschutz'));
  const settings=!!open;
  c.innerHTML=`<h3>${ico('shield')} ${t('Cookies & Datenschutz')}</h3>
  <p>${LANG==='de'?'Wir speichern notwendige Daten für Anmeldung und Spiel. Mit deiner Zustimmung merken wir uns außerdem Einstellungen, Sprache und Fortschritt in diesem Browser und zeigen Werbung an. Du kannst das jederzeit ändern.':'We store necessary data for sign-in and gameplay. With your consent we also remember settings, language and progress in this browser and show ads. You can change this at any time.'}</p>
  ${settings?`<div class="cset">
    <label class="sw"><span><b>${t('Notwendig')}</b><br><small class="mini">${LANG==='de'?'Anmeldung (Sitzung), Sicherheit':'Sign-in session, security'}</small></span><input type="checkbox" checked disabled></label>
    <label class="sw"><span><b>${t('Präferenzen')}</b><br><small class="mini">${LANG==='de'?'Sprache, Einstellungen, Gastfortschritt':'Language, settings, guest progress'}</small></span><input type="checkbox" id="ckP" ${CONSENT.prefs?'checked':''}></label>
    <label class="sw"><span><b>${t('Werbung')}</b><br><small class="mini">${LANG==='de'?'Werbebanner rechts':'Ad banner on the right'}</small></span><input type="checkbox" id="ckA" ${CONSENT.ads?'checked':''}></label></div>
    <div class="row"><button class="btn pri sp" id="ckSave" type="button">${t('Auswahl speichern')}</button><button class="btn" id="ckNec" type="button">${t('Nur notwendige')}</button></div>`
  :`<div class="row"><button class="btn pri sp" id="ckAll" type="button">${t('Akzeptieren')}</button><button class="btn sp" id="ckSet" type="button">${t('Einstellungen')}</button></div>`}`;
  document.body.appendChild(c);
  const done=(prefs,ads)=>{CONSENT={set:true,prefs,ads};try{localStorage.setItem('aw_consent',JSON.stringify(CONSENT))}catch(e){}
    c.remove();adRender();if(prefs){try{saveST&&saveST();lsSet('aw_lang',LANG);if(!REMOTE||!AW.loggedIn)localSave&&localSave()}catch(e){}}};
  if(settings){$('#ckSave').onclick=()=>done($('#ckP').checked,$('#ckA').checked);$('#ckNec').onclick=()=>done(false,false)}
  else{$('#ckAll').onclick=()=>done(true,true);$('#ckSet').onclick=()=>cookieShow(true)}
}
function localSave(){if(!REMOTE&&AW.profile)lsSet('aw_local_profile',AW.profile)}

/* ---------- Login (E-Mail/Passwort, GitHub, Discord) ---------- */
function loginRequired(){return false}  /* kein Anmeldezwang: anonyme/lokale Konten */
function loginShow(mode='in'){
  const L=$('#login');L.hidden=false;
  const guest=!REMOTE;
  L.innerHTML=`<div class="lgbox"><img class="logo" src="img/logo.png" alt="Ant Wars">
    ${(!guest&&typeof Remote!=='undefined'&&Remote.anonFailed&&!AW.loggedIn)?`<div class="msg">${t('Spielen ohne Anmeldung ist auf dem Server noch nicht aktiviert. Bitte registriere dich oder melde dich an.')}</div>`:''}
    ${guest?`<div class="msg">${t('Gastmodus: Kein Server konfiguriert. Dein Fortschritt liegt nur in diesem Browser.')}</div>`:''}
    <div class="pills" style="align-self:center"><button type="button" data-m="in" class="${mode==='in'?'on':''}">${t('Anmelden')}</button><button type="button" data-m="up" class="${mode==='up'?'on':''}">${t('Registrieren')}</button></div>
    <form id="lgF" class="field" style="gap:10px" autocomplete="on" novalidate>
      ${mode==='up'?`<input class="inp" id="lgN" type="text" maxlength="20" minlength="2" placeholder="${t('Benutzername')}" autocomplete="nickname">`:''}
      <input class="inp" id="lgE" type="email" placeholder="${t('E-Mail')}" autocomplete="email" required>
      <input class="inp" id="lgP" type="password" placeholder="${t('Passwort')}" autocomplete="${mode==='up'?'new-password':'current-password'}" minlength="8" required>
      <div id="lgMsg"></div>
      <button class="btn pri lg block" type="submit">${mode==='up'?t('Registrieren'):t('Anmelden')}</button>
      ${mode==='in'?`<button class="btn sm" type="button" id="lgReset" style="align-self:center;background:transparent;border:0;color:var(--mu)">${t('Passwort vergessen?')}</button>`:''}
    </form>
    <div class="sep">${t('oder')}</div>
    <div class="oauth"><button class="btn lg" type="button" data-o="github">${BRAND.github} GitHub</button><button class="btn lg" type="button" data-o="discord">${BRAND.discord} Discord</button></div>
    <div class="row" style="justify-content:center">${guest||!loginRequired()?`<button class="btn sm" id="lgClose" type="button">${guest?(LANG==='de'?'Als Gast fortfahren':'Continue as guest'):t('Schließen')}</button>`:''}</div></div>`;
  const msg=(k,x)=>{$('#lgMsg').innerHTML=`<div class="msg ${k}">${esc(x)}</div>`};
  L.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>loginShow(b.dataset.m));
  const lc=$('#lgClose');if(lc)lc.onclick=loginHide;
  L.querySelectorAll('[data-o]').forEach(b=>b.onclick=async()=>{try{await AW.oauth(b.dataset.o)}catch(e){msg('err',e.message)}});
  $('#lgF').onsubmit=async ev=>{
    ev.preventDefault();const em=$('#lgE').value.trim(),pw=$('#lgP').value;
    if(!/^\S+@\S+\.\S+$/.test(em)||pw.length<8){msg('err',t('Ungültige Zugangsdaten'));return}
    try{
      if(mode==='up'){if(AW.isAnon&&!(AW.user&&AW.user.local))await AW.secure(em,pw);else await AW.signUp(em,pw,($('#lgN').value||'').trim()||'Spieler');msg('ok',t('Bitte bestätige deine E-Mail, falls nötig, und melde dich dann an.'))}
      else{await AW.signIn(em,pw);loginHide();toast(LANG==='de'?'Angemeldet':'Signed in','good')}
    }catch(e){msg('err',e.message||t('Ungültige Zugangsdaten'))}
  };
  const rs=$('#lgReset');if(rs)rs.onclick=async()=>{const em=$('#lgE').value.trim();if(/^\S+@\S+\.\S+$/.test(em)){try{await AW.reset(em)}catch(e){}}msg('ok',t('Wenn die Angaben stimmen, haben wir dir eine E-Mail geschickt.'))};
  setTimeout(()=>{const f=$('#lgE');f&&f.focus()},30);
}
function loginHide(){$('#login').hidden=true;$('#login').innerHTML=''}
/* Erster Start: Namen wählen (Tag #1234 vergibt das System) */
function nameShow(){
  const L=$('#login');L.hidden=false;
  L.innerHTML=`<div class="lgbox"><img class="logo" src="img/logo.png" alt="Ant Wars">
    <form id="nmF" class="field" style="gap:10px" novalidate><span class="lbl">${t('Wie willst du heißen?')}</span>
    <input class="inp" id="nmI" type="text" maxlength="20" minlength="2" placeholder="${t('Benutzername')}" autocomplete="nickname">
    <div id="nmMsg"></div><div class="mini">${t('Dahinter bekommst du eine Zahl wie #1234, damit Freunde dich eindeutig finden.')}</div>
    <button class="btn pri lg block" type="submit">${t('Los geht\'s')}</button>
    <button class="btn sm" type="button" id="nmSkip" style="align-self:center;background:transparent;border:0;color:var(--mu)">${t('Später')}</button></form></div>`;
  $('#nmSkip').onclick=loginHide;
  $('#nmF').onsubmit=async ev=>{ev.preventDefault();const n=cleanName($('#nmI').value);
    if(n.length<2){$('#nmMsg').innerHTML=`<div class="msg err">${esc(t('Name zu kurz'))}</div>`;return}
    try{await AW.update({username:n});loginHide();toast(AW.fullName,'good')}catch(e){$('#nmMsg').innerHTML=`<div class="msg err">${esc(e.message)}</div>`}};
  setTimeout(()=>{const f=$('#nmI');f&&f.focus()},30);
}
/* Geschützter Bereich: ohne gültige Session kein Spielbildschirm */
function requireSession(){if(REMOTE&&!AW.loggedIn){loginShow();return false}return true}
