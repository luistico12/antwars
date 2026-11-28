/* ===== Screens im neuen Glas-Design ===== */
const toastErr=e=>toast((e&&e.message)||'Fehler','bad');
const spinner=()=>`<div class="mini" style="padding:20px;text-align:center">…</div>`;
const needLogin=()=>REMOTE&&!AW.loggedIn;

/* ---------- Profil (Bild 3, Seite 2) ---------- */
S.profile=()=>{
  if(AW.loggedIn&&!AW.profile&&!(AW.user&&AW.user.local))return shell(t('Profil'),{},`<div class="msg err">${LANG==='de'?'Dein Profil wurde in der Datenbank nicht gefunden. Führe supabase/schema.sql im Supabase-SQL-Editor aus und lege das Profil nach (siehe README, „Profil nachtragen“). Danach neu anmelden.':'Your profile was not found in the database. Run supabase/schema.sql in the Supabase SQL editor and backfill the profile (see README). Then sign in again.'}</div>`);
  const p=AW.profile||{},li=AW.loggedIn&&!(AW.user&&AW.user.local),wr=p.games?Math.round(100*p.wins/p.games):0;
  const hatName=p.hat&&SHOP_BY_ID['hat:'+p.hat],flag=p.flag;
  const qs=QUESTS.filter(q=>q[1]==='career').slice(0,4).map(q=>questRow(q,true)).join('');
  return shell(t('Profil'),{},`
  <div class="grid" style="grid-template-columns:minmax(0,300px) minmax(0,1fr);align-items:start" id="profGrid">
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      <div class="avbig">${safeAvatar(p.avatar)?`<img alt="" src="${safeAvatar(p.avatar)}">`:esc(initials(p.username))}</div>
      <div class="row" style="justify-content:center"><label class="btn sm" for="pAvF">${ico('edit')} ${t('Profilbild')}</label><input type="file" id="pAvF" accept="image/png,image/jpeg,image/webp" hidden>${safeAvatar(p.avatar)?`<button class="btn sm" id="pAvX" type="button">${ico('trash')}</button>`:''}</div>
      <div style="text-align:center"><b style="font-size:19px">${p.clan_tag?`<span class="ctag">${esc(p.clan_tag)}</span>`:''}${esc(p.username||'Gast')}<span class="mini" style="font-weight:400">#${esc(p.tag||'0000')}</span></b>
        <div class="row" style="justify-content:center;margin-top:6px">${flag?flagSVG(flag):''}${hatName?`<span class="tag">${ico('hat')} ${hatName.name}</span>`:''}<span class="ruby">${ico('ruby')} ${p.rubys||0} ${t('Rubys')}</span></div></div>
      <div class="field"><span class="lbl">${t('Konto-ID')}</span><span class="mini" style="word-break:break-all">${esc(li?(p.id||'').slice(0,18)+'…':'local')}</span></div>
      <div class="field"><span class="lbl">${t('Mitglied seit')}</span><span>${fmtDate(p.created_at)}</span></div>
      <button class="btn block" id="pCopy" type="button">${ico('link')} ${t('Link kopieren')}</button>
      ${li&&!AW.isAnon?`<button class="btn danger block" id="pOut" type="button">${ico('logout')} ${t('Abmelden')}</button>`:`<button class="btn pri block" id="pSecure" type="button">${ico('shield')} ${t('Konto sichern')}</button><button class="btn block" id="pIn" type="button">${ico('enter')} ${t('Anmelden')}</button>`}
      ${AW.isAdmin?`<button class="btn block" data-go="admin" type="button">${ico('admin')} ${t('Admin')}</button>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Alle Spiele')}</div>
        <div class="grid g3 keep"><div class="stat"><b>${num(p.games)}</b><span>${t('Spiele')}</span></div><div class="stat"><b>${num(p.wins)}</b><span>${t('Siege')}</span></div><div class="stat"><b>${wr}%</b><span>${t('Siegquote')}</span></div></div></div>
      <div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Name')} / ${t('Clan-Tag')}</div>
        <div class="row"><input class="inp" id="pName" maxlength="20" value="${esc(p.username||'')}" style="flex:2;min-width:140px"><input class="inp" id="pClan" maxlength="5" placeholder="TAG" value="${esc(p.clan_tag||'')}" style="flex:1;min-width:90px;text-transform:uppercase"><button class="btn pri" id="pSave" type="button">${t('Speichern')}</button></div><div id="pMsg" style="margin-top:8px"></div></div>
      ${li?`<div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Sicherheit')} · ${t('Telefonnummer (Backup)')}</div>
        <div class="row"><input class="inp" id="phN" type="tel" placeholder="+49 …" value="${esc((AW.user&&AW.user.phone)?'+'+AW.user.phone.replace(/^\+/,''):'')}" style="flex:1;min-width:160px" autocomplete="tel"><button class="btn" id="phSend" type="button">${t('Code senden')}</button></div>
        <div class="row" id="phRow" style="margin-top:8px" hidden><input class="inp" id="phC" inputmode="numeric" maxlength="8" placeholder="123456" style="flex:1"><button class="btn pri" id="phOk" type="button">${t('Bestätigen')}</button></div><div id="phMsg" style="margin-top:8px"></div></div>`:''}
      <div class="panel"><div class="row" style="margin-bottom:8px"><span class="lbl">${t('Erfolge')}</span><span class="sp"></span><button class="btn sm" data-go="achievements" type="button">→</button></div><div class="grid" style="gap:8px">${qs}</div></div>
    </div></div>`);
};
/* Karriere-Statistik als Zahlenraster (Profil, eigenes und fremdes) */
function profStat(v,l){return `<div class="stat"><b>${num(v||0)}</b><span>${t(l)}</span></div>`}
function careerStats(p){
  const c=(p.stats&&p.stats.career&&p.stats.career.v)||{},st=(p.stats&&p.stats.streak)||{};
  return `<div class="grid g3 keep">
    ${profStat(c.conq,'Eroberungen')}${profStat(c.built,'Gebäude')}${profStat(c.sunk,'Schiffe versenkt')}
    ${profStat(c.allied,'Bündnisse')}${profStat(c.found,'Funde')}${profStat(c.mins,'Minuten gespielt')}
    ${profStat(c.days,'Spieltage')}${profStat(st.n,'Tage in Serie')}${profStat(c.terr,'Größtes Reich')}
    ${profStat(c.score,'Bestpunkte')}</div>`;
}
/* Profil eines anderen Spielers ansehen (nur Lesen, keine Bearbeitung) */
UI.viewP=null;
const playerKey=a=>typeof a==='string'?a:(a&&(a.id||a.name+'#'+a.tag))||'';
/* Fremdes Profil: gleiche Ansicht wie das eigene, nur ohne Bearbeiten (kein Name, kein Bild, keine Sicherheit). */
S.player=()=>{
  const a=(SCR.cur&&SCR.cur.arg)||{},d=UI.viewP&&UI.viewP.k===playerKey(a)?UI.viewP:null;
  if(!d)return shell(t('Profil'),{sub:t('Spieler')},spinner());
  if(d.err)return shell(t('Profil'),{sub:t('Spieler')},`<div class="msg err">${esc(d.err)}</div>`);
  const p=d.p||{},av=safeAvatar(p.avatar),plus=!!p.plus_life||!!(p.plus_until&&new Date(p.plus_until)>new Date());
  const cos=[['crown','Krone'],['ship','Schiff'],['wship','Kriegsschiff'],['tship','Handelsschiff'],['bskin','Gebäude'],['tskin','Händler'],['rskin','Wege'],['pattern','Muster']]
    .filter(([k])=>p[k]).map(([k,n])=>`<span class="tag">${t(n)}</span>`).join('');
  return shell(t('Profil'),{sub:t('Spieler'),right:`<button class="btn sm" data-back="" type="button">${ico('back')} ${t('Zurück')}</button>`},`
  <div class="pf" id="profGrid"><div class="pf-l">
    <div class="pf-card id"><div class="avbig">${av?`<img alt="" src="${av}">`:ico('user')}</div>
      <div class="pf-nm"><b>${plus?'<span class="pluslogo" style="font-size:13px">+</span> ':''}${esc(p.username||'Gast')}<span class="mini" style="font-weight:400">#${esc(p.tag||'0000')}</span>${p.clan_tag?`<span class="ctag">${esc(p.clan_tag)}</span>`:''}</b>
      <div class="row" style="justify-content:center">${p.flag?flagSVG(p.flag):''}</div></div></div>
    <div class="pf-card plus ${plus?'on':''}"><div class="pf-cur"><span class="pluslogo">+</span><b>AntWars +</b></div>
      <div class="mini" style="margin:2px 0 8px">${plus?(p.plus_life?t('Dauerhaft aktiv'):`${t('Aktiv bis')} ${fmtDate(p.plus_until)}`):(LANG==='de'?'Kein AntWars +':'No AntWars +')}</div></div>
    <div class="pf-card clan ${p.clan_tag?'':'none'}"><span class="pf-sh">${ico('shield')}</span><div><b>${p.clan_tag?esc(p.clan_tag):t('Kein Clan')}</b></div></div>
    ${cos?`<div class="pf-card info"><div class="field"><span class="lbl">${t('Kosmetik')}</span><div class="row" style="gap:6px;flex-wrap:wrap">${cos}</div></div></div>`:''}
    <div class="pf-card info"><div class="field"><span class="lbl">${t('Konto-ID')}</span><span class="mono">${esc(p.id||'')}</span></div><div class="field"><span class="lbl">${t('Mitglied seit')}</span><span>${fmtDate(p.created_at)}</span></div></div>
  </div><div class="pf-r">${profStats(p,true)}</div></div>`);
};
S.player.bind=async el=>{
  const a=(SCR.cur&&SCR.cur.arg)||{},k=playerKey(a);
  if(el.dataset.bound===k)return;el.dataset.bound=k;
  if(UI.viewP&&UI.viewP.k===k)return;
  try{const p=await AW.player(a&&a.id,a&&a.name,a&&a.tag);UI.viewP=p?{k,p}:{k,err:t('Profil nicht gefunden')}}
  catch(e){UI.viewP={k,err:e.message}}
  if(SCR.cur&&SCR.cur.name==='player')render();
};
/* Profilbild: mittig zuschneiden, auf 96×96 verkleinern, als webp/jpeg speichern */
function avatarFromFile(f){return new Promise((ok,no)=>{
  if(!f||!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>8e6)return no(new Error(LANG==='de'?'Bitte ein PNG, JPG oder WebP unter 8 MB wählen':'Please choose a PNG, JPG or WebP under 8 MB'));
  const im=new Image(),u=URL.createObjectURL(f);
  im.onload=()=>{URL.revokeObjectURL(u);const s=Math.min(im.naturalWidth,im.naturalHeight),c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
    g.fillStyle='#fff';g.fillRect(0,0,96,96);g.drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,0,0,96,96);
    let d=c.toDataURL('image/webp',.85);if(!d.startsWith('data:image/webp'))d=c.toDataURL('image/jpeg',.85);
    safeAvatar(d)?ok(d):no(new Error('Bild zu groß'))};
  im.onerror=()=>{URL.revokeObjectURL(u);no(new Error(LANG==='de'?'Bild konnte nicht gelesen werden':'Could not read the image'))};
  im.src=u})}
S.profile.bind=p=>{
  const af=p.querySelector('#pAvF');if(af)af.onchange=async()=>{try{await AW.update({avatar:await avatarFromFile(af.files[0])});toast(t('Gespeichert'),'good')}catch(e){toastErr(e)}};
  const ax=p.querySelector('#pAvX');if(ax)ax.onclick=async()=>{try{await AW.update({avatar:null})}catch(e){toastErr(e)}};
  const msg=(id,k,x)=>{p.querySelector(id).innerHTML=`<div class="msg ${k}">${esc(x)}</div>`};
  p.querySelector('#pCopy').onclick=()=>{try{navigator.clipboard.writeText(location.origin+location.pathname+'?u='+((AW.profile&&AW.profile.id)||'')).then(()=>toast(t('Kopiert'),'good'))}catch(e){}};
  const o=p.querySelector('#pOut');if(o)o.onclick=async()=>{await AW.signOut();closeScreens()};
  const i=p.querySelector('#pIn');if(i)i.onclick=()=>loginShow();
  const sc=p.querySelector('#pSecure');if(sc)sc.onclick=()=>loginShow('up');
  p.querySelector('#pSave').onclick=async()=>{
    const n=p.querySelector('#pName').value.trim(),c=p.querySelector('#pClan').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(n.length<2){msg('#pMsg','err','Name zu kurz');return}
    try{UI.noRerender=true;await AW.update({username:n,clan_tag:c});UI.noRerender=false;msg('#pMsg','ok','✓')}catch(e){UI.noRerender=false;msg('#pMsg','err',e.message)}
  };
  const ph=p.querySelector('#phSend');if(ph){
    ph.onclick=async()=>{const n=p.querySelector('#phN').value.trim();if(!/^\+\d{7,15}$/.test(n)){msg('#phMsg','err','+49…');return}
      try{await AW.setPhone(n);p.querySelector('#phRow').hidden=false;msg('#phMsg','ok','SMS ✓')}catch(e){msg('#phMsg','err',e.message)}};
    p.querySelector('#phOk').onclick=async()=>{try{await AW.verifyPhone(p.querySelector('#phN').value.trim(),p.querySelector('#phC').value.trim());msg('#phMsg','ok','✓')}catch(e){msg('#phMsg','err',e.message)}};
  }
  bindClaims(p);
  if(innerWidth<720)p.querySelector('#profGrid').style.gridTemplateColumns='1fr';
};

/* ---------- Erfolge / Quests (Bild 3, Seite 3) ---------- */
function qProg(q){const pr=AW.profile||{},b=pr.stats&&pr.stats[q[1]];const v=b&&b.k===periodKey(q[1])?(b.v[q[2]]||0):0;return{v:Math.min(v,q[3]),raw:v,done:v>=q[3],claimed:(pr.quests||{})[q[0]]===periodKey(q[1])}}
function questRow(q,compact){
  const g=qProg(q);
  return `<div class="quest ${g.done?'done':''}"><div class="row"><b style="flex:1">${t(q[5])}</b><span class="ruby">+${q[4]} ${ico('ruby')}</span>
  ${compact?'':(g.claimed?`<span class="tag">${ico('check')} ${t('Abgeholt')}</span>`:`<button class="btn sm ${g.done?'pri':''}" data-claim="${q[0]}" ${g.done?'':'disabled'} type="button">${t('Abholen')}</button>`)}</div>
  <div class="bar"><i style="width:${Math.round(100*g.v/q[3])}%"></i></div><div class="mini">${t('Fortschritt')}: ${g.v} / ${q[3]}</div></div>`;
}
/* ---------- Rubys fliegen zur Anzeige (Abholen, Shop) ---------- */
/* Ziel: die komplette Rubys-Anzeige im offenen Screen, sonst die Kopfzeile */
function rubyDisplay(){
  const q=s=>[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length);
  return q('#scrP .sh .qx-ruby')[0]||q('#scrP .sh .ruby')[0]||q('#hdrProf .ruby')[0]||q('#hdrProf')[0];
}
/* rect = Startposition (vor dem Neuzeichnen gemessen), html = fliegendes Symbol */
function flyBits(rect,html,n,size){
  const to=rubyDisplay();
  if(!rect||!to||!rect.width||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const b=to.getBoundingClientRect(),N=Math.max(1,Math.min(8,n||3)),S=size||22;
  const x0=rect.left+rect.width/2,y0=rect.top+rect.height/2,x1=b.left+b.width/2,y1=b.top+b.height/2;
  for(let i=0;i<N;i++){
    const el=document.createElement('div');
    el.className='flygem';el.style.width=el.style.height=S+'px';el.innerHTML=html;
    el.style.left=(x0-S/2+(Math.random()-.5)*Math.min(rect.width,140)*.45)+'px';
    el.style.top=(y0-S/2+(Math.random()-.5)*Math.min(rect.height,110)*.45)+'px';
    document.body.appendChild(el);
    const lx=parseFloat(el.style.left),ly=parseFloat(el.style.top),dx=x1-lx-S/2,dy=y1-ly-S/2;
    const an=el.animate([
      {transform:'translate(0,0) scale(.4)',opacity:0,offset:0},
      {transform:'translate(0,0) scale(1)',opacity:1,offset:.16},
      {transform:`translate(${dx*.5}px,${dy*.5-64}px) scale(1.06)`,opacity:1,offset:.64},
      {transform:`translate(${dx}px,${dy}px) scale(.3)`,opacity:.1,offset:1}
    ],{duration:640+Math.random()*220,delay:i*70,easing:'cubic-bezier(.3,.02,.4,1)',fill:'both'});
    an.onfinish=()=>el.remove();
    setTimeout(()=>el.remove(),2400);
  }
  setTimeout(()=>{if(!document.body.contains(to))return;to.classList.add('hit');setTimeout(()=>to.classList.remove('hit'),820)},680+N*70);
}
/* Abholen mit Aufleuchten: der Knopf pulsiert kurz, dann wird abgeholt */
function bindClaims(p){p.querySelectorAll('[data-claim]').forEach(b=>b.onclick=async()=>{
  if(b.classList.contains('pop'))return;
  p.querySelectorAll(`[data-claim="${b.dataset.claim}"]`).forEach(x=>x.classList.add('pop'));
  const rc=b.getBoundingClientRect(),rq=QUESTS.find(x=>x[0]===b.dataset.claim)||[],rw=rq[4]||3;
  try{await new Promise(r=>setTimeout(r,430));await AW.claim(b.dataset.claim);toast('+ Rubys','good');flyBits(rc,ico('ruby'),Math.max(2,Math.min(8,Math.round(rw/15))))}
  catch(e){p.querySelectorAll('.pop').forEach(x=>x.classList.remove('pop'));toastErr(e)}})}
UI.achTab='daily';
S.achievements=()=>shell(t('Erfolge'),{right:`<div class="pills" id="achT">${[['daily','Täglich'],['weekly','Wöchentlich'],['career','Karriere']].map(([k,n])=>`<button data-k="${k}" class="${UI.achTab===k?'on':''}" type="button">${t(n)}</button>`).join('')}</div>`},
  `<div class="grid">${QUESTS.filter(q=>q[1]===UI.achTab).map(q=>questRow(q)).join('')}</div>${needLogin()?`<div class="msg">${t('Melde dich an, um zu spielen')}</div>`:''}`);
S.achievements.bind=p=>{p.querySelectorAll('#achT [data-k]').forEach(b=>b.onclick=()=>{UI.achTab=b.dataset.k;render()});bindClaims(p)};

/* ---------- Shop: Kosmetik in Stufen ---------- */
/* Vorschau und Ausrüstungsstatus für alle Kosmetik-Arten */
const COS_TABS=[['hat','Hüte','hat'],['crown','Kronen','crown'],['pattern','Muster','gem'],['ship','Schiffe','map'],['bskin','Gebäude','box'],['tskin','Händler','users'],['rskin','Wege','link'],['world','Weltflaggen','globe'],['ant','Ameisenflaggen','flag']];
const SHIP_VARS=[['ship','Boot'],['wship','Kriegsschiff'],['tship','Handelsschiff']];
UI.cosVarKind='ship';
const cosFilter=(tab,i)=>tab==='plus'?!!i.plus:(!i.plus&&(tab==='world'?i.kind==='flag'&&!i.custom:tab==='ant'?i.kind==='flag'&&i.custom:i.kind===tab));
const cosEq=(i,p)=>p[i.kind]===i.key;
const cosPv=i=>i.kind==='flag'?flagSVG(i.key):`<span data-cos="${i.kind}:${i.key}"></span>`;
function cosBind(p){p.querySelectorAll('[data-cos]').forEach(c=>{if(c.dataset.done)return;c.dataset.done='1';const[k,id]=c.dataset.cos.split(':');
  c.appendChild(cosPreview(k,id))})}
const tierLbl=tier=>t(TIERS[tier]||tier);
const tierChip=i=>`<span class="tier t-${i.tier}">${i.plus?'<b>+</b> ':''}${esc(tierLbl(i.tier))}</span>`;
const bestBand=i=>i.pop?`<span class="best">${ico('star')} ${t('Am beliebtesten')}</span>`:'';
const TIER_FILTER=[['all','Alle'],['common','Gewöhnlich'],['rare','Selten'],['epic','Episch'],['legendary','Legendär'],['mythic','Mythisch'],['ultimate','Ultimativ']];
UI.shopTab='hat';UI.shopTier='all';UI.flagQ='';
/* Suchfeld für die Flaggen-Reiter: filtert die Karten per hidden, damit das Eingabefeld beim Tippen nicht neu gezeichnet wird */
const isFlagTab=tab=>tab==='world'||tab==='ant';
const flagSearchBox=tab=>isFlagTab(tab)?`<div style="position:relative;margin:2px 0 8px"><span style="position:absolute;left:12px;top:11px;color:var(--mu)">${ico('search')}</span><input class="inp" id="flQ" placeholder="${t('Flaggen suchen …')}" style="padding-left:40px;width:100%" autocomplete="off" spellcheck="false"></div>`:'';
const flagSearchBind=p=>{const inp=p.querySelector('#flQ');if(!inp)return;
  const ap=()=>{const q=(inp.value||'').trim().toLowerCase();p.querySelectorAll('.shgrid .shcard[data-q]').forEach(c=>c.hidden=!!q&&!c.dataset.q.includes(q))};
  inp.value=UI.flagQ||'';inp.oninput=()=>{UI.flagQ=inp.value;ap()};ap()};
/* Mitgliedschaft AntWars + */
const plusTxt=()=>AW.plusActive?(AW.profile.plus_life?t('Dauerhaft aktiv'):`${t('Aktiv bis')} ${fmtDate(AW.profile.plus_until)}`):`${PLUS_COST} ${t('Rubys')} / ${t('Monat')}`;
function plusBanner(){
  return `<div class="pluscard ${AW.plusActive?'on':''}">
    <div class="plushead"><span class="pluslogo">+</span><div class="plustx"><b>AntWars +</b><small>${plusTxt()}</small></div><span class="sp"></span>
      ${AW.plusActive?'':`<button class="btn pri" id="plusBuy" type="button">${ico('plus')} ${PLUS_COST} ${ico('ruby')}</button>`}</div>
    <div class="plusperks">
      <span>${ico('hat')} 16 ${t('exklusive Stücke')}</span><span>${ico('star')} + ${t('vor dem Namen')}</span>
    </div></div>`;
}
/* Detailansicht einer Kosmetik (Bild 4+5) */
function cosModal(id){
  const i=SHOP_BY_ID[id];if(!i)return;
  const p=AW.profile||{},own=ownsItem(p,i.id),eq=cosEq(i,p),plusT=AW.plusActive,miss=Math.max(0,i.price-(p.rubys||0));
  const sib=SHOP.filter(x=>!x.plus&&x.kind===i.kind&&x.id!==i.id).slice(0,6);
  let foot;
  if(i.plus&&!plusT)foot=`<button class="shbuy big t-ultimate" data-plus="1" type="button">${ico('plus')} ${t('Mit AntWars + freischalten')}</button>`;
  else if(own)foot=`<button class="shbuy big equ ${eq?'on':''}" data-eq="${i.id}" type="button">${eq?t('Ablegen'):t('Ausrüsten')}</button>`;
  else if(i.shipOf)foot=`<div class="missing">${t('Wird mit dem passenden Schiff freigeschaltet')}</div><button class="shbuy big" data-goship="1" type="button">${ico('map')} ${t('Zu den Schiffen')}</button>`;
  else if(miss>0)foot=`<div class="missing">${t('Es fehlen')} <b>${num(miss)} ${ico('ruby')}</b></div><button class="shbuy big quest" data-go="achievements" type="button">${ico('trophy')} ${t('Zu den Quests')}</button>`;
  else foot=`<button class="shbuy big t-${i.tier}" data-buy="${i.id}" type="button">${num(i.price)} ${ico('ruby')} · ${t('Kaufen')}</button>`;
  const old=document.getElementById('cosM');if(old)old.remove();
  const isShip=i.kind==='ship',vk=isShip?(UI.cosVarKind||'ship'):i.kind;
  const pvHtml=isShip?`<span data-cos="${vk}:${i.key}"></span>`:cosPv(i);
  const el=document.createElement('div');el.id='cosM';el.className='cosm';
  el.innerHTML=`<div class="cosm-box t-${i.tier}">
    <div class="cosm-h"><button class="ibtn" data-cmx type="button" aria-label="${t('Schließen')}">${ico('close')}</button><b>${esc(i.name)}</b></div>
    <div class="cosm-body">
      <div class="cosm-pv">${pvHtml}</div>
      ${isShip?`<div class="cosm-vars" id="cosmVar">${SHIP_VARS.map(([k,n])=>`<button type="button" data-var="${k}" class="${vk===k?'on':''}">${t(n)}</button>`).join('')}</div>
        <div class="mini cosm-inc">${ico('check')} ${t('Alles inklusive')} – ${t('gilt für Boot, Kriegs- und Handelsschiff')}</div>`:''}
      <aside class="cosm-side">
        <div class="cosm-badges">${tierChip(i)}${i.pop?`<span class="best small">${ico('star')} ${t('Am beliebtesten')}</span>`:''}</div>
        <div class="lbl">${t('In dieser Art')}</div>
        <div class="cosm-mini">${sib.map(x=>`<span class="mnm" title="${esc(x.name)}">${cosPv(x)}</span>`).join('')}</div>
        <div class="cosm-price">${i.plus?`<b>AntWars +</b>`:`${num(i.price)} ${ico('ruby')}`}</div>
      </aside>
    </div>
    <div class="cosm-f">${foot}</div></div>`;
  document.body.appendChild(el);
  cosBind(el);
  el.addEventListener('click',e=>{
    if(e.target===el||e.target.closest('[data-cmx]')){el.remove();return}
    const vr=e.target.closest('[data-var]');
    if(vr){UI.cosVarKind=vr.dataset.var;el.querySelectorAll('[data-var]').forEach(b=>b.classList.toggle('on',b.dataset.var===UI.cosVarKind));
      const vl=el.querySelector('.cosm-pv');vl.innerHTML=`<span data-cos="${UI.cosVarKind}:${i.key}"></span>`;cosBind(el);return}
    const pl=e.target.closest('[data-plus]');
    if(pl){el.remove();UI.shopTab='plus';UI.shopTier='all';openScreen('shop',undefined,false);return}
    if(e.target.closest('[data-goship]')){el.remove();UI.shopTab='ship';UI.shopTier='all';openScreen('shop',undefined,false);return}
    const buy=e.target.closest('[data-buy]');
    if(buy){const card=buy.closest('.cosm-pv'),rc=card?card.getBoundingClientRect():null,pic=card?card.innerHTML:'';
      AW.buy(buy.dataset.buy).then(()=>{el.remove();if(rc)flyBits(rc,pic,1,52)}).catch(toastErr);return}
    const eqq=e.target.closest('[data-eq]');
    if(eqq){const it=SHOP_BY_ID[eqq.dataset.eq],cur=(AW.profile||{})[it.kind];
      AW.update({[it.kind]:cur===it.key?null:it.key}).then(()=>el.remove()).catch(toastErr);return}
  });
}
S.shop=()=>{
  const p=AW.profile||{owned:[]},tab=UI.shopTab,tf=UI.shopTier;
  const items=SHOP.filter(i=>cosFilter(tab,i)).filter(i=>tf==='all'||i.tier===tf);
  const card=i=>{
    const own=ownsItem(p,i.id),eq=cosEq(i,p);
    let act;
    if(i.plus&&!AW.plusActive)act=`<button class="shbuy t-ultimate" data-plus="1" type="button">${ico('plus')} AntWars +</button>`;
    else if(own)act=`<button class="shbuy equ ${eq?'on':''}" data-eq="${i.id}" type="button">${eq?t('Ablegen'):t('Ausrüsten')}</button>`;
    else if(i.shipOf)act=`<button class="shbuy" disabled type="button">${t('Im Schiff enthalten')}</button>`;
    else act=`<button class="shbuy t-${i.tier}" data-buy="${i.id}" type="button">${num(i.price)} ${ico('ruby')}</button>`;
    return `<div class="shcard t-${i.tier} ${eq?'eq':''} ${i.plus?'pc':''}" data-card="${i.id}" data-q="${esc((i.name+' '+i.key).toLowerCase())}">${bestBand(i)}
      <div class="shpv" data-open="${i.id}">${cosPv(i)}</div>${tierChip(i)}<b class="shnm">${esc(i.name)}</b>${act}</div>`;
  };
  return shell(t('Shop'),{right:`<span class="row" style="gap:6px"><span class="ruby pill3">${ico('ruby')} ${num(p.rubys||0)}</span><span class="pill3 ${AW.plusActive?'on':''}">+</span></span>`},
   `<div class="pills seg" id="shopMode"><button data-mode="cos" class="${tab==='plus'?'':'on'}" type="button">${ico('star')} ${t('Kosmetik')}</button><button data-mode="plus" class="${tab==='plus'?'on':''}" type="button"><b>+</b> AntWars +</button></div>
    ${tab==='plus'?plusBanner():`<div class="shoptabs" id="shopT">${COS_TABS.map(([k,n,ic])=>`<button data-k="${k}" class="${tab===k?'on':''}" type="button">${ico(ic)} ${t(n)}</button>`).join('')}</div>
    <div class="pills tierfilter" id="shopF">${TIER_FILTER.map(([k,n])=>`<button data-t="${k}" class="${tf===k?'on':''} t-${k}" type="button">${t(n)}</button>`).join('')}</div>`}
    ${needLogin()?`<div class="msg">${t('Melde dich an, um zu spielen')}</div>`:''}
    ${REMOTE&&AW.loggedIn?`<div class="panel redeembox"><div class="lbl">${ico('enter')} ${t('Einlöse-Code')}</div><div class="row" style="margin-top:6px"><input class="inp" id="rdCode" maxlength="32" placeholder="${t('Code eingeben')}" style="flex:1;min-width:140px" autocomplete="off" spellcheck="false"><button class="btn pri" id="rdGo" type="button">${t('Einlösen')}</button></div><div id="rdMsg"></div></div>`:''}
    ${flagSearchBox(tab)}
    <div class="shgrid">${items.map(card).join('')}</div>
    <div class="mini" style="margin-top:12px">${ico('info')} ${t('Eine Schiffs-Kosmetik gilt für Boot, Kriegsschiff und Handelsschiff zusammen.')}</div>`);
};
S.shop.bind=p=>{
  p.querySelectorAll('#shopMode [data-mode]').forEach(b=>b.onclick=()=>{UI.shopTab=b.dataset.mode==='plus'?'plus':'hat';UI.shopTier='all';render()});
  p.querySelectorAll('#shopT [data-k]').forEach(b=>b.onclick=()=>{UI.shopTab=b.dataset.k;UI.shopTier='all';UI.flagQ='';render()});
  p.querySelectorAll('#shopF [data-t]').forEach(b=>b.onclick=()=>{UI.shopTier=b.dataset.t;render()});
  cosBind(p);flagSearchBind(p);
  const pb=p.querySelector('#plusBuy');if(pb)pb.onclick=async()=>{try{await AW.buyPlus();toast(LANG==='de'?'AntWars + ist aktiv':'AntWars + is active','good')}catch(e){toastErr(e)}};
  const rd=p.querySelector('#rdGo');
  if(rd)rd.onclick=async()=>{const inp=p.querySelector('#rdCode'),m=p.querySelector('#rdMsg'),v=inp.value.trim();if(!v)return;
    rd.disabled=true;
    try{await AW.redeem(v);inp.value='';m.innerHTML=`<div class="msg ok">${t('Code eingelöst')}</div>`;toast(LANG==='de'?'Code eingelöst':'Code redeemed','good')}
    catch(e){m.innerHTML=`<div class="msg err">${esc(e.message)}</div>`}
    rd.disabled=false};
  p.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>cosModal(el.dataset.open));
  p.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{UI.shopTab='plus';UI.shopTier='all';render()});
  p.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{
    const card=b.closest('.shcard'),pv=card&&card.querySelector('.shpv'),rc=card?card.getBoundingClientRect():null,pic=pv?pv.innerHTML:'';
    try{await AW.buy(b.dataset.buy);if(rc)flyBits(rc,pic||ico('ruby'),1,52)}catch(e){toastErr(e)}});
  p.querySelectorAll('[data-eq]').forEach(b=>b.onclick=async()=>{const it=SHOP_BY_ID[b.dataset.eq],pr=AW.profile,cur=pr[it.kind];
    try{await AW.update({[it.kind]:cur===it.key?null:it.key})}catch(e){toastErr(e)}});
};

/* ---------- Inventar: Kosmetik und AntWars + als zwei Tabs ---------- */
UI.invTab='hat';UI.invPlus=false;
S.inventory=()=>{
  const p=AW.profile||{owned:[]},tab=UI.invTab,plusM=UI.invPlus;
  const mine=SHOP.filter(i=>ownsItem(p,i.id)).filter(i=>plusM?i.plus:!i.plus);
  const items=mine.filter(i=>plusM?true:cosFilter(tab,i));
  const more=SHOP.filter(i=>!i.plus&&!(p.owned||[]).includes(i.id)).length;
  const card=i=>{const eq=cosEq(i,p);
    return `<div class="shcard t-${i.tier} ${eq?'eq':''} ${i.plus?'pc':''}" data-card="${i.id}" data-q="${esc((i.name+' '+i.key).toLowerCase())}">
      <div class="shpv" data-open="${i.id}">${cosPv(i)}</div>${tierChip(i)}<b class="shnm">${esc(i.name)}</b>
      <button class="shbuy equ ${eq?'on':''}" data-eq="${i.id}" type="button">${eq?t('Ablegen'):t('Ausrüsten')}</button></div>`};
  const moreCard=plusM?'':`<div class="shcard more" data-go="shop" role="button" tabindex="0">
    <div class="morestack"><span>${ico('hat')}</span><span>${ico('crown')}</span><span>${ico('gem')}</span></div>
    <b>+${more}</b><span class="mlbl">${t('Mehr im Shop')}</span>
    <span class="shbuy equ on go">${t('Ansehen')} ${ico('enter')}</span></div>`;
  return shell(t('Inventar'),{right:`<button class="btn sm" data-go="shop" type="button">${ico('shop')} ${t('Shop')}</button>`},
   `<div class="pills seg" id="invP" style="align-self:flex-start"><button data-p="0" class="${plusM?'':'on'}" type="button">${t('Kosmetik')}</button><button data-p="1" class="${plusM?'on':''}" type="button"><b>+</b> AntWars +</button></div>
    ${plusM?'':`<div class="shoptabs" id="invT">${COS_TABS.map(([k,n,ic])=>`<button data-k="${k}" class="${tab===k?'on':''}" type="button">${ico(ic)} ${t(n)}</button>`).join('')}</div>`}
    ${plusM?plusBanner():''}
    ${plusM?'':flagSearchBox(tab)}
    <div class="shgrid">${moreCard}${items.map(card).join('')}</div>
    ${!items.length?`<div class="msg">${plusM?(LANG==='de'?'Mit AntWars + bekommst du zwei exklusive Stücke je Kosmetik-Art.':'AntWars + gives you two exclusive items for every cosmetic type.'):(LANG==='de'?'Hier liegt noch nichts. Im Shop kaufst du Kosmetik mit Rubys aus Quests.':'Nothing here yet. Buy cosmetics in the shop with Rubys from quests.')}</div>`:''}`);
};
S.inventory.bind=p=>{
  p.querySelectorAll('#invP [data-p]').forEach(b=>b.onclick=()=>{UI.invPlus=b.dataset.p==='1';render()});
  p.querySelectorAll('#invT [data-k]').forEach(b=>b.onclick=()=>{UI.invTab=b.dataset.k;UI.flagQ='';render()});
  cosBind(p);flagSearchBind(p);
  p.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>cosModal(el.dataset.open));
  const pb=p.querySelector('#plusBuy');if(pb)pb.onclick=async()=>{try{await AW.buyPlus();toast(LANG==='de'?'AntWars + ist aktiv':'AntWars + is active','good')}catch(e){toastErr(e)}};
  p.querySelectorAll('[data-eq]').forEach(b=>b.onclick=async()=>{const it=SHOP_BY_ID[b.dataset.eq],pr=AW.profile,cur=pr[it.kind];
    try{await AW.update({[it.kind]:cur===it.key?null:it.key})}catch(e){toastErr(e)}});
};


/* ---------- Leaderboard (Bild 4) ---------- */
UI.lbTab='players';
S.leaderboard=()=>{
  const tab=UI.lbTab,rows=UI['lb_'+tab];
  const me=(AW.profile||{});
  const body=rows?`<div class="panel" style="padding:0;overflow:auto"><table class="lb"><thead><tr><th style="text-align:center">#</th><th>${tab==='players'?t('Spieler'):'Clan'}</th><th>${t('Siege')}</th><th>${t('Spiele')}</th><th>${t('Quote')}</th></tr></thead><tbody>
    ${rows.map((r,i)=>{const wr=r.games?100*r.wins/r.games:0;const nm=tab==='players'?`${esc(r.username)}<span class="mini">#${esc(r.tag||'')}</span>${r.clan_tag?`<span class="ctag">${esc(r.clan_tag)}</span>`:''}`:`<span class="ctag">${esc(r.clan_tag)}</span>${r.members||''} ${t('Mitglieder')}`;
      return `<tr class="r${i+1} ${tab==='players'&&r.username===me.username&&r.tag===me.tag&&me.games?'me':''}" ${tab==='players'?`data-pid="${esc(r.id||'')}" data-pn="${esc(r.username||'')}" data-pt="${esc(r.tag||'')}" style="cursor:pointer" title="${t('Profil ansehen')}"`:''}><td style="text-align:center"><span class="rk">${i+1}</span></td><td><b>${nm}</b></td><td><b>${num(r.wins)}</b></td><td style="color:var(--mu)">${num(r.games)}</td><td><span class="wp ${wr<50?'low':''}">${wr.toFixed(1)}%</span></td></tr>`}).join('')||`<tr><td colspan="5" style="text-align:center;color:var(--mu)">–</td></tr>`}</tbody></table></div>`:spinner();
  return shell('Leaderboard',{sub:LANG==='de'?'Aktualisiert beim Öffnen':'Updated when opened',right:`<div class="pills" id="lbT"><button data-k="players" class="${tab==='players'?'on':''}" type="button">${ico('users')} ${t('Spieler')}</button><button data-k="clans" class="${tab==='clans'?'on':''}" type="button">${ico('shield')} ${t('Clans')}</button></div>`},body);
};
S.leaderboard.bind=async p=>{
  p.querySelectorAll('#lbT [data-k]').forEach(b=>b.onclick=()=>{UI.lbTab=b.dataset.k;render()});
  p.querySelectorAll('tr[data-pn]').forEach(tr=>tr.onclick=()=>openScreen('player',{id:tr.dataset.pid||null,name:tr.dataset.pn,tag:tr.dataset.pt||''}));
  const tab=UI.lbTab;if(!UI['lb_'+tab]){UI['lb_'+tab]=await(tab==='players'?AW.players():AW.clans());if(SCR.cur&&SCR.cur.name==='leaderboard')render()}
};
const lbReset=()=>{UI.lb_players=UI.lb_clans=null;UI.clans=null};

/* ---------- Freunde: Liste, Anfragen, Hinzufügen per Name#1234 ---------- */
S.friends=()=>{
  const f=UI.friends,row=(e,btns)=>`<div class="li"><span class="av" style="width:34px;height:34px">${esc(initials(e.name))}</span><span class="sp"><b>${esc(e.name)}</b><small>#${esc(e.tag)}</small></span>${btns}</div>`;
  const body=`<div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Freund hinzufügen')}</div>
      <form class="row" id="frF"><input class="inp" id="frI" placeholder="Name#1234" maxlength="26" style="flex:1;min-width:160px" autocomplete="off"><button class="btn pri" type="submit">${ico('plus')} ${t('Anfrage senden')}</button></form><div id="frMsg" style="margin-top:8px"></div>
      <div class="mini" style="margin-top:6px">${t('Dein Name:')} <b>${esc(AW.fullName)}</b></div></div>
    ${!f?spinner():`${f.incoming.length?`<div class="lbl">${t('Anfragen')} <b style="color:var(--ac)">${f.incoming.length}</b></div>${f.incoming.map(e=>row(e,`<button class="btn sm pri" data-fa="${esc(e.id)}" type="button">${ico('check')}</button><button class="ibtn" data-fd="${esc(e.id)}" type="button" aria-label="Decline">${ico('close')}</button>`)).join('')}`:''}
    <div class="lbl">${t('Freunde')} <b style="color:var(--ac)">${f.list.length}</b></div>
    ${f.list.length?f.list.map(e=>row(e,`<button class="ibtn" data-fr="${esc(e.id)}" type="button" aria-label="Remove">${ico('trash')}</button>`)).join(''):`<div class="mini">${t('Noch keine Freunde')}</div>`}
    ${f.outgoing.length?`<div class="lbl">${t('Gesendet')}</div>${f.outgoing.map(e=>row(e,`<button class="ibtn" data-fr="${esc(e.id)}" type="button" aria-label="Cancel">${ico('close')}</button>`)).join('')}`:''}`}`;
  return shell(t('Freunde'),{narrow:true},`<div class="grid" style="gap:10px">${body}</div>`);
};
S.friends.bind=async p=>{
  const reload=async()=>{try{UI.friends=await AW.friends()}catch(e){UI.friends={list:[],incoming:[],outgoing:[]};toastErr(e)}if(SCR.cur&&SCR.cur.name==='friends')render()};
  const act=(sel,fn)=>p.querySelectorAll(sel).forEach(b=>b.onclick=async()=>{try{await fn(b.dataset[sel.slice(6,8)]);}catch(e){toastErr(e)}UI.friends=null;reload()});
  act('[data-fa]',id=>AW.friendRespond(id,true));act('[data-fd]',id=>AW.friendRespond(id,false));act('[data-fr]',id=>AW.friendRemove(id));
  p.querySelector('#frF').onsubmit=async e=>{e.preventDefault();const i=p.querySelector('#frI'),m=p.querySelector('#frMsg');
    try{await AW.friendRequest(i.value);m.innerHTML=`<div class="msg ok">${esc(t('Anfrage gesendet, falls es den Spieler gibt.'))}</div>`;i.value='';UI.friends=null;reload()}catch(x){m.innerHTML=`<div class="msg err">${esc(x.message)}</div>`}};
  if(!UI.friends)reload();
};

/* ---------- Neuigkeiten (Bild 5) ---------- */
S.news=()=>{
  const l=UI.news,isOpen=i=>UI.nOpen===i||(UI.nOpen==null&&i===0);
  return shell(t('Neuigkeiten'),{right:l&&l[0]?`<span class="tag">${esc(l[0].version)}</span>`:''},
   l?l.map((n,i)=>i===0
     ?`<article class="nitem latest"><button type="button" data-n="0" class="nhero"><span class="nrow"><span class="ver">${esc(n.version||'')}</span><span class="tag ac">${t('Neueste')}</span><span class="dt">${fmtDate(n.created_at)}</span>${ico(isOpen(0)?'up':'down')}</span><h2 class="ntitle">${esc(n.title)}</h2></button>${isOpen(0)?`<div class="bd">${esc(n.body).replace(/\n/g,'<br>')}</div>`:''}</article>`
     :`<div class="nitem"><button type="button" data-n="${i}"><span class="ver">${esc(n.version||'')}</span><b>${esc(n.title)}</b><span class="dt">${fmtDate(n.created_at)}</span>${ico(isOpen(i)?'up':'down')}</button>${isOpen(i)?`<div class="bd">${esc(n.body).replace(/\n/g,'<br>')}</div>`:''}</div>`).join(''):spinner());
};
S.news.bind=async p=>{
  p.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{const i=+b.dataset.n,open=UI.nOpen==null?0:UI.nOpen;UI.nOpen=open===i?-1:i;render()});
  if(!UI.news){UI.news=await AW.news();UI.newsTop=UI.news[0]?String(UI.news[0].id):'';}
  if(UI.news&&UI.news[0]){UI.newsTop=String(UI.news[0].id);lsSet('aw_news_seen',UI.newsTop);renderHeader()}
  if(SCR.cur&&SCR.cur.name==='news'&&!p.querySelector('.nitem'))render();
};

/* ---------- Sprache (Bild 7) ---------- */
S.lang=()=>shell(t('Sprache wählen'),{right:`<div style="position:relative;width:min(300px,50vw)"><span style="position:absolute;left:12px;top:11px;color:var(--mu)">${ico('search')}</span><input class="inp" id="lgQ" placeholder="${t('Sprachen suchen …')}" style="padding-left:40px;border-color:var(--ac-line)"></div>`},
  `<div class="grid g3" id="lgGrid">${LANGS.map(l=>`<button class="li langitem ${l[0]===LANG?'sel':''}" data-l="${l[0]}" data-q="${esc((l[1]+' '+l[2]).toLowerCase())}" type="button">${flagSVG(l[3])}<span style="flex:1"><b>${esc(l[1])}</b><small>${esc(l[2])}</small></span>${l[0]===LANG?`<span style="color:var(--ac)">${ico('check')}</span>`:''}</button>`).join('')}</div>
  <div class="mini">${LANG==='de'?'Die Oberfläche ist auf Deutsch und Englisch übersetzt, andere Sprachen zeigen Englisch.':'The interface is translated into German and English; other languages show English.'}</div>`);
S.lang.bind=p=>{
  p.querySelector('#lgQ').oninput=e=>{const q=e.target.value.toLowerCase();p.querySelectorAll('[data-q]').forEach(b=>b.hidden=!b.dataset.q.includes(q))};
  p.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{const l=b.dataset.l;setLang(l);homeFill();renderHeader();render()});
};

/* ---------- Tutorial ---------- */
S.tutorial=()=>shell(t('Tutorial'),{narrow:true},`<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px;color:#cdd4e2">
 <li><b>1.</b> ${LANG==='de'?'Wähle Termiten, Blattschneider oder Bodenameisen und klicke ein passendes Startgebiet.':'Pick termites, leafcutters or ground ants and click a matching start territory.'}</li>
 <li><b>2.</b> ${LANG==='de'?'Baue Räume und Tunnel. Die Königin legt Eier, wenn Platz und Pilze da sind. Vergrabene Funde grabst du aus.':'Build rooms and tunnels. The queen lays eggs when there is space and fungus. Dig up buried finds.'}</li>
 <li><b>3.</b> ${LANG==='de'?'Zoome heraus zur Weltkarte. Rechtsklick (am Handy: lange drücken) auf ein fremdes Gebiet: Angriff, Bündnis, Spenden.':'Zoom out to the world map. Right-click (on mobile: long-press) a foreign territory: attack, alliance, donate.'}</li>
 <li><b>4.</b> ${LANG==='de'?'Zu Beginn schützt dich die Schutzzeit. Eroberte Gebiete gehören sofort zu deinem Reich.':'A protection period shields you at the start. Conquered land joins your realm right away.'}</li></ul>`);

/* ---------- Lobby (Bild 6): erstellen, beitreten ---------- */
const LOB={code:null,host:false,ch:null,players:[],chat:[],cfg:{diff:'normal',max:8,pub:true,seed:0,tab:'map'}};
function lobLeave(close){
  if(LOB.ch){try{LOB.ch.leave()}catch(e){}}
  if(close&&LOB.host&&LOB.code)AW.lobbyClose(LOB.code).catch(()=>{});
  LOB.code=null;LOB.ch=null;LOB.players=[];LOB.chat=[];LOB.host=false;
}
function lobOpenChannel(code){
  LOB.ch=AW.channel(code,{
    presence:l=>{LOB.players=l;if(NET.active())NET.onPresence(l);lobRefresh()},
    msg:m=>{
      if(m.t==='chat'){LOB.chat.push(m);if(LOB.chat.length>60)LOB.chat.shift();lobRefresh()}
      else if(m.t==='cfg'&&!LOB.host){Object.assign(LOB.cfg,m.cfg);lobRefresh(true)}
      else if(m.t==='start'){lobStart(m.seed,m.diff,m.n)}
      else NET.onmsg(m);
    }
  });
}
function lobStart(seed,diff,n){
  if(started){toast(LANG==='de'?'Du spielst gerade.':'You are already playing.','bad');return}
  const ch=LOB.ch,code=LOB.code,host=LOB.host,players=LOB.players.slice();
  MATCH.seed=seed;
  if(DIFFS[diff]){diffKey=diff;$$('#diffSeg [data-d]').forEach(x=>x.classList.toggle('on',x.dataset.d===diff))}
  newMap(seed);renderSetup();
  /* Mehrere Spieler: Kanal an das Mehrspieler-Modul übergeben, damit er das Schließen der Lobby überlebt */
  if(ch&&Math.max(players.length,n||0)>1){NET.begin({ch,host,players});LOB.ch=null}
  if(host&&code)AW.lobbyUpdate(code,{status:'started'}).catch(()=>{});
  closeScreens();homeHide();setView('map');
  if(NET.active())NET.refreshStart();
}
function lobRefresh(full){
  if(!SCR.cur||SCR.cur.name!=='lobby'){return}
  if(full)return render();
  const pl=$('#plist'),cl=$('#chatlog'),cnt=$('#pcnt');
  if(pl)pl.innerHTML=LOB.players.map((p,i)=>`<div class="li" style="padding:7px 10px">${p.clan?`<span class="ctag">${esc(p.clan)}</span>`:''}<b>${esc(p.name)}</b>${p.id&&LOB.hostId&&String(p.id).startsWith(LOB.hostId)?`<span style="color:var(--ok)">(Host)</span>`:''}</div>`).join('');
  if(cnt)cnt.textContent=`${LOB.players.length} / ${LOB.cfg.max}`;
  if(cl){cl.innerHTML=LOB.chat.length?LOB.chat.map(m=>`<div><b>${esc(m.n)}:</b> ${esc(m.x)}</div>`).join(''):`<div class="mini" style="margin:auto">${t('Noch keine Nachrichten')}</div>`;cl.scrollTop=1e9}
  const sb=$('#lobStart');if(sb&&LOB.host)sb.disabled=false;
}
S.lobby=()=>{
  const c=LOB.cfg,host=LOB.host;
  if(!LOB.code)return shell(t('Eigene Lobby'),{},spinner());
  const mapTab=`<div class="panel" style="display:flex;flex-direction:column;gap:10px"><div class="lbl">${t('Karte')}</div><div class="lobcard" style="cursor:default"><div class="im" style="height:170px"><canvas id="lobMap" width="480" height="300"></canvas><b style="font-size:20px">${esc(mapTitle())}</b></div></div>${host?`<button class="btn" id="lobNew" type="button">${ico('refresh')} ${t('Neue Karte')}</button>`:''}</div>`;
  const optTab=`<div class="panel" style="display:flex;flex-direction:column;gap:14px"><div class="field"><span class="lbl">${t('Schwierigkeit')}</span><div class="seg" id="lobDiff">${['easy','normal','hard'].map(d=>`<button class="btn ${c.diff===d?'on':''}" data-d="${d}" type="button" ${host?'':'disabled'}>${t({easy:'Leicht',normal:'Normal',hard:'Schwer'}[d])}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">${t('Max. Spieler')}: ${c.max}</span><input type="range" id="lobMax" min="2" max="50" value="${c.max}" ${host?'':'disabled'}></div>
    <div class="field"><span class="lbl">${t('Öffentlich')}</span><label class="sw"><span>${c.pub?t('Öffentlich'):t('Privat')}</span><input type="checkbox" id="lobPub" ${c.pub?'checked':''} ${host?'':'disabled'}></label></div></div>`;
  return shell(host?t('Eigene Lobby'):'Lobby',{right:`<div class="li" style="padding:6px 12px">${ico('eye')}<span>Code:</span><b style="color:var(--ac);font-family:var(--mono)">${esc(LOB.code)}</b><button class="ibtn" id="lobCopy" type="button" style="width:30px;height:30px" aria-label="Copy">${ico('copy')}</button></div>`},
  `<div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start" id="lobGrid">
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <div class="pills" id="lobT" style="align-self:stretch;display:flex"><button class="${c.tab==='map'?'on':''}" data-k="map" style="flex:1" type="button">${t('Karte')}</button><button class="${c.tab==='opt'?'on':''}" data-k="opt" style="flex:1" type="button">${t('Regeln & Optionen')}</button></div>
      ${c.tab==='map'?mapTab:optTab}
      <div class="chatbox"><div class="row" style="padding:8px 12px;border-bottom:1px solid var(--ln)"><span class="lbl">${ico('chat')} ${t('Chat')}</span></div><div class="chatlog" id="chatlog"></div><form class="chatin" id="chatF"><input id="chatI" maxlength="200" placeholder="${t('Nachricht an die Lobby')}" autocomplete="off"><button class="ibtn" style="border:0;background:transparent" type="submit">${ico('send')}</button></form></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
      <div class="li">${ico(c.pub?'globe':'lock')}<span><b>${c.pub?t('Öffentlich'):t('Privat')}</b><small>${c.pub?'':LANG==='de'?'Beitritt nur per Code':'Join by code only'}</small></span></div>
      <div class="grid g2 keep"><div class="li" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="lbl">${t('Schwierigkeit')}</span><b>${t({easy:'Leicht',normal:'Normal',hard:'Schwer'}[c.diff])}</b></div><div class="li" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="lbl">${t('Max. Spieler')}</span><b>${c.max}</b></div></div>
      <div class="panel"><div class="row"><span class="lbl">${t('Spieler')}</span><span class="sp"></span><b style="color:var(--ac)" id="pcnt"></b></div><div id="plist" style="display:flex;flex-direction:column;gap:6px;margin-top:8px"></div></div>
      ${host?`<button class="btn pri lg block" id="lobStart" type="button" disabled>${t('Spiel starten')}</button>`:`<button class="btn lg block" disabled>${t('Warten auf Spieler …')}</button>`}
      <button class="btn danger block" id="lobLeave" type="button">${t('Lobby verlassen')}</button>
    </div></div>`);
};
S.lobby.bind=p=>{
  if(!LOB.code)return;
  const c=LOB.cfg,host=LOB.host;
  if(innerWidth<760)p.querySelector('#lobGrid').style.gridTemplateColumns='1fr';
  const bc=()=>{if(host){LOB.ch&&LOB.ch.send({t:'cfg',cfg:{diff:c.diff,max:c.max,pub:c.pub,seed:c.seed}});AW.lobbyUpdate(LOB.code,{diff:c.diff,max:c.max,is_public:c.pub,seed:c.seed}).catch(()=>{})}};
  p.querySelectorAll('#lobT [data-k]').forEach(b=>b.onclick=()=>{c.tab=b.dataset.k;render()});
  const m=p.querySelector('#lobMap');if(m){const g=m.getContext('2d');g.imageSmoothingEnabled=false;if(baseCanvas){g.drawImage(baseCanvas,0,0,m.width,m.height);if(ownCanvas)g.drawImage(ownCanvas,0,0,m.width,m.height)}}
  const nb=p.querySelector('#lobNew');if(nb)nb.onclick=()=>{c.seed=(Math.random()*1e6)|0;newMap(c.seed);renderSetup();bc();render()};
  p.querySelectorAll('#lobDiff [data-d]').forEach(b=>b.onclick=()=>{c.diff=b.dataset.d;bc();render()});
  const mx=p.querySelector('#lobMax');if(mx)mx.oninput=()=>{c.max=+mx.value;bc();lobRefresh()};if(mx)mx.onchange=render;
  const pb=p.querySelector('#lobPub');if(pb)pb.onchange=()=>{c.pub=pb.checked;bc();render()};
  p.querySelector('#lobCopy').onclick=()=>{try{navigator.clipboard.writeText(LOB.code);toast(t('Kopiert'),'good')}catch(e){}};
  p.querySelector('#chatF').onsubmit=e=>{e.preventDefault();const i=p.querySelector('#chatI'),x=i.value.trim();if(x&&LOB.ch){LOB.ch.send({t:'chat',n:AW.name,x:x.slice(0,200)});i.value=''}};
  p.querySelector('#lobLeave').onclick=()=>{lobLeave(true);screenBack()};
  const sb=p.querySelector('#lobStart');if(sb)sb.onclick=()=>{const seed=CUR.seed||((Math.random()*1e6)|0);LOB.ch.send({t:'start',seed,diff:c.diff,n:LOB.players.length})};
  lobRefresh();
};
async function lobCreate(){
  if(!requireSession())return;
  LOB.host=true;LOB.cfg={diff:diffKey,max:8,pub:true,seed:CUR.seed,tab:'map'};LOB.chat=[];
  openScreen('lobby');
  try{const row=await AW.lobbyCreate({name:AW.name+"'s Lobby",is_public:true,diff:LOB.cfg.diff,max:8,seed:CUR.seed});LOB.code=row.code;LOB.hostId=AW.user.id;lobOpenChannel(row.code);if(SCR.cur&&SCR.cur.name==='lobby')render()}
  catch(e){toastErr(e);screenBack()}
}
async function lobJoin(code){
  code=String(code||'').trim();if(!code)return;if(!requireSession())return;
  try{
    const row=await AW.lobbyFind(code);if(!row){toast(LANG==='de'?'Lobby nicht gefunden':'Lobby not found','bad');return}
    LOB.host=false;LOB.code=row.code;LOB.hostId=row.host;LOB.chat=[];LOB.cfg={diff:row.diff,max:row.max,pub:row.is_public,seed:row.seed,tab:'map'};
    lobOpenChannel(row.code);openScreen('lobby');
  }catch(e){toastErr(e)}
}
UI.lobbies=null;
S.lobbyJoin=()=>shell(t('Lobby beitreten'),{},`
  <div class="row"><input class="inp sp" id="jCode" placeholder="${t('Lobby-ID eingeben')}" style="flex:1;min-width:160px"><button class="ibtn" id="jPaste" type="button" aria-label="Paste" style="width:46px;height:46px">${ico('copy')}</button></div>
  <div class="row"><span class="lbl">${ico('globe')} ${t('Offene Lobbys')} <b style="color:var(--ac)">${UI.lobbies?UI.lobbies.length:''}</b></span><span class="sp"></span><button class="ibtn" id="jRef" type="button" aria-label="Refresh">${ico('refresh')}</button></div>
  ${UI.lobbies?`<div class="grid g3">${UI.lobbies.map(l=>`<button class="lobcard" data-c="${esc(l.code)}" type="button"><div class="im"><span class="tags"><span class="tag ac">FFA</span><span class="tag">${t({easy:'Leicht',normal:'Normal',hard:'Schwer'}[l.diff]||l.diff)}</span></span><b>${esc(l.name)}</b></div><div class="bd"><span style="color:#ffd24a">${ico('crown')}</span> ${esc(l.host_name||'')} · max ${l.max}</div></button>`).join('')||`<div class="mini">–</div>`}</div>`:spinner()}`,
  `<button class="btn pri lg block" id="jGo" type="button">${t('Lobby beitreten')}</button>`);
S.lobbyJoin.bind=async p=>{
  p.querySelector('#jGo').onclick=()=>lobJoin(p.querySelector('#jCode').value);
  p.querySelector('#jPaste').onclick=async()=>{try{p.querySelector('#jCode').value=await navigator.clipboard.readText()}catch(e){}};
  p.querySelector('#jRef').onclick=()=>{UI.lobbies=null;render()};
  p.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>lobJoin(b.dataset.c));
  if(!UI.lobbies){try{UI.lobbies=await AW.lobbies()}catch(e){UI.lobbies=[]}if(SCR.cur&&SCR.cur.name==='lobbyJoin')render()}
};

/* ---------- Admin: News und Spielerprofile (Rechte werden serverseitig per RLS erzwungen) ---------- */
UI.admTab='news';
S.admin=()=>{
  if(!AW.isAdmin)return shell(t('Admin'),{},`<div class="msg err">403</div>`);
  const tab=UI.admTab;
  let body='';
  if(tab==='news'){
    const l=UI.admNews,e=UI.admEdit;
    body=`<div class="panel"><div class="lbl" style="margin-bottom:8px">${e&&e.id?t('Bearbeiten'):t('Neu')}</div><div class="grid" style="gap:8px"><div class="row"><input class="inp" id="nV" placeholder="${t('Version')}" maxlength="12" value="${esc(e?e.version:'')}" style="flex:0 0 110px"><input class="inp" id="nT" placeholder="${t('Titel')}" value="${esc(e?e.title:'')}" style="flex:1;min-width:160px"></div><textarea class="inp" id="nB" rows="4" placeholder="${t('Text')}">${esc(e?e.body:'')}</textarea><div class="row"><button class="btn pri" id="nSave" type="button">${t('Speichern')}</button>${e?`<button class="btn" id="nCancel" type="button">${t('Zurück')}</button>`:''}</div></div></div>
    ${l?l.map(n=>`<div class="li"><span class="ver tag ac">${esc(n.version||'')}</span><span class="sp"><b>${esc(n.title)}</b><small>${fmtDate(n.created_at)}</small></span><button class="ibtn" data-ne="${esc(n.id)}" type="button" aria-label="Edit">${ico('edit')}</button><button class="ibtn" data-nd="${esc(n.id)}" type="button" aria-label="Delete">${ico('trash')}</button></div>`).join(''):spinner()}`;
  }else if(tab==='codes'){
    const l=UI.admCodes;
    body=`<div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Code erstellen')}</div><div class="grid g2 keep" style="gap:8px">
      <label class="field"><span class="lbl">${t('Code')}</span><input class="inp" id="cCode" maxlength="32" placeholder="ANTWARS25" spellcheck="false" autocomplete="off"></label>
      <label class="field"><span class="lbl">${t('Belohnung')}</span><select class="inp" id="cKind"><option value="rubys">${t('Rubys')}</option><option value="plus">AntWars +</option><option value="item">${t('Kosmetik')}</option></select></label>
      <label class="field"><span class="lbl">${t('Betrag (Rubys)')}</span><input class="inp" id="cAmount" type="number" min="0" value="100"></label>
      <label class="field"><span class="lbl">${t('Kosmetik-Schlüssel')}</span><input class="inp" id="cItem" placeholder="ship:golden" spellcheck="false"></label>
      <label class="field"><span class="lbl">${t('Tage (leer = dauerhaft)')}</span><input class="inp" id="cDays" type="number" min="1"></label>
      <label class="field"><span class="lbl">${t('Max. Einlösungen')}</span><input class="inp" id="cMax" type="number" min="1" value="1"></label></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="cMake" type="button">${ico('plus')} ${t('Code anlegen')}</button></div><div class="mini" style="margin-top:8px">${t('Belohnung „Kosmetik“ braucht einen Schlüssel aus dem Shop, z. B. ship:golden oder crown:omega.')}</div></div>
      ${l?`<div class="grid">${l.map(c=>`<div class="li"><span class="ver tag ac">${esc(c.code)}</span><span class="sp"><b>${c.kind==='rubys'?num(c.amount)+' Rubys':c.kind==='plus'?('AntWars + '+(c.days?c.days+' '+t('Tage'):t('dauerhaft'))):esc(c.item||'')}</b><small>${c.uses} / ${c.max_uses} ${t('eingelöst')}${c.active?'':' · '+t('inaktiv')}</small></span><button class="ibtn" data-coff="${esc(c.code)}" type="button" ${c.active?'':'disabled'} aria-label="${t('Abschalten')}">${ico('close')}</button></div>`).join('')||'<div class="mini">–</div>'}</div>`:spinner()}`;
  }else{
    const l=UI.admPl,e=UI.admEditP;
    body=e?`<div class="panel"><div class="lbl" style="margin-bottom:8px">${esc(e.username)}</div><div class="grid g2 keep" style="gap:8px">
      ${[['username','Benutzername','text'],['clan_tag','Clan-Tag','text'],['rubys','Rubys','number'],['wins','Siege','number'],['games','Spiele','number'],['hat','Hut (Schlüssel)','text'],['flag','Flagge (Schlüssel)','text']].map(([k,n,ty])=>`<label class="field"><span class="lbl">${n}</span><input class="inp" data-f="${k}" type="${ty}" value="${esc(e[k]==null?'':e[k])}"></label>`).join('')}
      <label class="sw" style="align-self:end"><span>Admin</span><input type="checkbox" data-f="is_admin" ${e.is_admin?'checked':''}></label></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="pSv" type="button">${t('Speichern')}</button><button class="btn" id="pCn" type="button">${t('Zurück')}</button></div></div>`
    :`<div class="row"><input class="inp" id="aQ" placeholder="${t('Suchen')}" style="flex:1" value="${esc(UI.admQ||'')}"><button class="btn" id="aGo" type="button">${ico('search')}</button></div>
      ${l?`<div class="grid">${l.map(p=>`<div class="li">${p.clan_tag?`<span class="ctag">${esc(p.clan_tag)}</span>`:''}<span class="sp"><b>${esc(p.username)}</b><small>${num(p.wins)} ${t('Siege')} · ${num(p.games)} ${t('Spiele')} · ${p.rubys} Rubys ${p.plus_life?'· AntWars + ∞':(p.plus_until&&new Date(p.plus_until)>new Date()?'· AntWars +':'')} ${p.is_admin?'· Admin':''}</small></span><button class="btn sm" data-pl30="${esc(p.id)}" type="button" title="${t('30 Tage AntWars +')}">+30T</button><button class="btn sm" data-plife="${esc(p.id)}" type="button" title="${t('AntWars + dauerhaft')}">+∞</button><button class="ibtn" data-pe="${esc(p.id)}" type="button">${ico('edit')}</button></div>`).join('')||'<div class="mini">–</div>'}</div>`:spinner()}`;
  }
  return shell(t('Admin'),{right:`<div class="pills" id="admT"><button data-k="news" class="${tab==='news'?'on':''}" type="button">${t('News')}</button><button data-k="pl" class="${tab==='pl'?'on':''}" type="button">${t('Spielerprofile')}</button><button data-k="codes" class="${tab==='codes'?'on':''}" type="button">${t('Codes')}</button></div>`},body);
};
S.admin.bind=async p=>{
  if(!AW.isAdmin)return;
  p.querySelectorAll('#admT [data-k]').forEach(b=>b.onclick=()=>{UI.admTab=b.dataset.k;UI.admEdit=UI.admEditP=null;render()});
  if(UI.admTab==='news'){
    if(!UI.admNews){UI.admNews=await AW.news();if(SCR.cur&&SCR.cur.name==='admin')render();return}
    p.querySelector('#nSave').onclick=async()=>{const n={id:UI.admEdit&&UI.admEdit.id,version:p.querySelector('#nV').value.trim(),title:p.querySelector('#nT').value.trim(),body:p.querySelector('#nB').value.trim()};if(!n.title)return;
      try{await AW.newsSave(n);UI.admEdit=null;UI.admNews=UI.news=null;render();toast('✓','good')}catch(e){toastErr(e)}};
    const cn=p.querySelector('#nCancel');if(cn)cn.onclick=()=>{UI.admEdit=null;render()};
    p.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>{UI.admEdit=UI.admNews.find(n=>String(n.id)===b.dataset.ne);render()});
    p.querySelectorAll('[data-nd]').forEach(b=>b.onclick=async()=>{if(!confirm(LANG==='de'?'Wirklich löschen?':'Really delete?'))return;try{await AW.newsDel(b.dataset.nd);UI.admNews=UI.news=null;render()}catch(e){toastErr(e)}});
  }else if(UI.admTab==='codes'){
    if(!UI.admCodes){UI.admCodes=await AW.adminCodes();if(SCR.cur&&SCR.cur.name==='admin')render();return}
    const mk=p.querySelector('#cMake');
    if(mk)mk.onclick=async()=>{const o={code:p.querySelector('#cCode').value.trim(),kind:p.querySelector('#cKind').value,amount:p.querySelector('#cAmount').value,item:p.querySelector('#cItem').value.trim()||null,days:p.querySelector('#cDays').value,maxUses:p.querySelector('#cMax').value};
      if(o.code.length<4){toast(LANG==='de'?'Code zu kurz':'Code too short','bad');return}
      if(o.kind==='item'&&!o.item){toast(LANG==='de'?'Kosmetik-Schlüssel fehlt':'Missing item key','bad');return}
      try{await AW.adminCodeMake(o);UI.admCodes=null;render();toast('✓','good')}catch(e){toastErr(e)}};
    p.querySelectorAll('[data-coff]').forEach(b=>b.onclick=async()=>{try{await AW.adminCodeOff(b.dataset.coff);UI.admCodes=null;render()}catch(e){toastErr(e)}});
  }else{
    if(!UI.admPl){UI.admPl=await AW.adminProfiles(UI.admQ||'');if(SCR.cur&&SCR.cur.name==='admin')render();return}
    const go=p.querySelector('#aGo');if(go)go.onclick=()=>{UI.admQ=p.querySelector('#aQ').value.trim();UI.admPl=null;render()};
    p.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>{UI.admEditP=UI.admPl.find(x=>String(x.id)===b.dataset.pe);render()});
    p.querySelectorAll('[data-pl30]').forEach(b=>b.onclick=async()=>{try{await AW.adminGrantPlus(b.dataset.pl30,30);UI.admPl=null;render();toast(LANG==='de'?'AntWars + für 30 Tage vergeben':'AntWars + granted for 30 days','good')}catch(e){toastErr(e)}});
    p.querySelectorAll('[data-plife]').forEach(b=>b.onclick=async()=>{try{await AW.adminGrantPlus(b.dataset.plife,null);UI.admPl=null;render();toast(LANG==='de'?'AntWars + dauerhaft vergeben':'AntWars + granted permanently','good')}catch(e){toastErr(e)}});
    const sv=p.querySelector('#pSv');if(sv){sv.onclick=async()=>{const e=UI.admEditP,up={};
      p.querySelectorAll('[data-f]').forEach(i=>{const k=i.dataset.f;up[k]=i.type==='checkbox'?i.checked:i.type==='number'?Math.max(0,+i.value||0):(i.value.trim()||null)});
      up.username=up.username||e.username;up.clan_tag=(up.clan_tag||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      try{await AW.adminUpdate(e.id,up);UI.admEditP=null;UI.admPl=null;render();toast('✓','good')}catch(x){toastErr(x)}};
      p.querySelector('#pCn').onclick=()=>{UI.admEditP=null;render()}}
  }
};

/* ---------- Forum: Bugs, Vorschläge und Spieler-Reports (nur das Team liest alles) ---------- */
const FORUM_KINDS={bug:'Bug',idea:'Vorschlag',report:'Spieler-Report'};
UI.forumKind='bug';UI.forumFilter='';
const forumTag=k=>`<span class="tag ${k==='bug'?'ac':''}">${t(FORUM_KINDS[k]||'Meldung')}</span>`;
S.forum=()=>{
  if(needLogin())return shell(t('Forum'),{},`<div class="msg">${t('Melde dich an, um das Forum zu nutzen')}</div>`);
  const adm=AW.isAdmin,l=UI.forum,sel=UI.forumSel,det=UI.forumOpen;
  const items=(l||[]).filter(x=>!adm||!UI.forumFilter||x.kind===UI.forumFilter);
  const compose=`<div class="panel"><div class="lbl" style="margin-bottom:8px">${t('Neue Meldung')}</div>
    <div class="grid" style="gap:8px">
      <div class="pills" id="fmK">${Object.keys(FORUM_KINDS).map(k=>`<button type="button" data-k="${k}" class="${UI.forumKind===k?'on':''}">${t(FORUM_KINDS[k])}</button>`).join('')}</div>
      <input class="inp" id="fmT" maxlength="120" placeholder="${t('Kurzer Titel')}">
      <textarea class="inp" id="fmB" rows="4" maxlength="4000" placeholder="${t('Was ist passiert? Bei einem Spieler-Report bitte Name#Tag, Zeit und was vorgefallen ist.')}"></textarea>
      <button class="btn pri" id="fmSend" type="button">${ico('send')} ${t('Absenden')}</button>
    </div></div>`;
  const detail=!sel?`<div class="panel"><div class="mini">${adm?t('Wähle links eine Meldung aus.'):t('Wähle eine deiner Meldungen aus oder schreibe eine neue.')}</div></div>`
    :(det?`<div class="panel" style="display:flex;flex-direction:column;gap:10px">
        <div class="row">${forumTag(det.thread.kind)}<span class="sp"></span>${det.thread.status==='closed'?`<span class="tag">${t('Geschlossen')}</span>`:''}${adm?`<button class="btn sm" id="fmClose" type="button">${det.thread.status==='closed'?t('Wieder öffnen'):t('Schließen')}</button><button class="btn sm danger" id="fmDel" type="button" aria-label="Delete">${ico('trash')}</button>`:''}</div>
        <div><b style="font-size:16px">${esc(det.thread.title)}</b><div class="mini">${esc(det.thread.author_name)}#${esc(det.thread.author_tag)} · ${fmtDate(det.thread.created_at)}</div></div>
        <div class="msg" style="white-space:pre-wrap">${esc(det.thread.body)}</div>
        <div class="lbl">${t('Verlauf')}</div>
        ${det.posts.length?det.posts.map(m=>`<div class="li" style="flex-direction:column;align-items:flex-start;gap:2px">
           <div class="row" style="gap:6px">${m.is_admin?`<span class="tag ac">Admin</span>`:''}<b>${esc(m.author_name)}#${esc(m.author_tag)}</b><span class="mini">${fmtDate(m.created_at)}</span></div>
           <div style="white-space:pre-wrap;font-size:13.5px">${esc(m.body)}</div></div>`).join(''):`<div class="mini">${t('Noch keine Antworten.')}</div>`}
        <textarea class="inp" id="fmR" rows="3" maxlength="2000" placeholder="${t('Antwort schreiben …')}"></textarea>
        <button class="btn pri" id="fmRSend" type="button">${ico('send')} ${t('Senden')}</button>
      </div>`:spinner());
  return shell(t('Forum'),{right:adm?`<div class="pills" id="fmF"><button data-k="" class="${UI.forumFilter===''?'on':''}" type="button">${t('Alle')}</button>${Object.keys(FORUM_KINDS).map(k=>`<button data-k="${k}" class="${UI.forumFilter===k?'on':''}" type="button">${t(FORUM_KINDS[k])}</button>`).join('')}</div>`:''},
    `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);align-items:start" id="fmGrid">
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        ${compose}
        <div class="panel" style="display:flex;flex-direction:column;gap:8px">
          <div class="row"><span class="lbl">${adm?t('Alle Meldungen'):t('Meine Meldungen')}</span><span class="sp"></span><span class="mini">${items.length}</span></div>
          ${l?items.map(x=>`<button class="li ${sel===x.id?'sel':''}" data-th="${esc(x.id)}" type="button" style="width:100%;text-align:left;font:inherit">
            ${forumTag(x.kind)}<span class="sp" style="min-width:0;overflow:hidden"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.title)}</b>
            <small>${adm?esc(x.author_name)+'#'+esc(x.author_tag)+' · ':''}${x.replies||0} ${t('Antworten')} · ${fmtDate(x.last_at)}</small></span>
            ${x.status==='closed'?`<span class="tag">${t('Geschlossen')}</span>`:''}</button>`).join('')||`<div class="mini">${t('Noch keine Meldungen.')}</div>`:spinner()}
        </div>
      </div>
      <div style="min-width:0">${detail}</div></div>`);
};
S.forum.bind=async p=>{
  if(needLogin())return;
  if(innerWidth<820)p.querySelector('#fmGrid').style.gridTemplateColumns='1fr';
  const openSel=async()=>{
    if(!UI.forumSel){UI.forumOpen=null;return}
    try{const posts=await AW.forumOpen(UI.forumSel);UI.forumOpen={thread:(UI.forum||[]).find(x=>x.id===UI.forumSel),posts};
      if(SCR.cur&&SCR.cur.name==='forum')render()}catch(e){toastErr(e)}
  };
  p.querySelectorAll('#fmF [data-k]').forEach(b=>b.onclick=()=>{UI.forumFilter=b.dataset.k;render()});
  p.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{UI.forumSel=b.dataset.th;UI.forumOpen=null;openSel()});
  const ks=p.querySelectorAll('#fmK [data-k]');
  ks.forEach(b=>b.onclick=()=>{UI.forumKind=b.dataset.k;ks.forEach(x=>x.classList.toggle('on',x.dataset.k===b.dataset.k))});
  const send=p.querySelector('#fmSend');
  if(send)send.onclick=async()=>{
    const tt=p.querySelector('#fmT').value.trim(),bb=p.querySelector('#fmB').value.trim();
    if(tt.length<3||bb.length<3){toast(LANG==='de'?'Bitte Titel und Text ausfüllen':'Please fill in title and text','bad');return}
    try{UI.noRerender=true;UI.forumSel=await AW.forumSend(UI.forumKind,tt,bb);UI.noRerender=false;
      p.querySelector('#fmT').value='';p.querySelector('#fmB').value='';
      toast(LANG==='de'?'Meldung gesendet – nur das Team kann sie lesen':'Report sent – only the team can read it','good');
      UI.forum=await AW.forumThreads();await openSel()}catch(e){UI.noRerender=false;toastErr(e)}};
  const rs=p.querySelector('#fmRSend');
  if(rs)rs.onclick=async()=>{
    const b=p.querySelector('#fmR').value.trim();if(!b)return;
    try{UI.noRerender=true;await AW.forumReply(UI.forumSel,b);UI.noRerender=false;
      UI.forum=await AW.forumThreads();await openSel()}catch(e){UI.noRerender=false;toastErr(e)}};
  const cl=p.querySelector('#fmClose');
  if(cl)cl.onclick=async()=>{try{await AW.forumClose(UI.forumSel,UI.forumOpen.thread.status!=='closed');UI.forum=await AW.forumThreads();await openSel()}catch(e){toastErr(e)}};
  const dl=p.querySelector('#fmDel');
  if(dl)dl.onclick=async()=>{if(!confirm(LANG==='de'?'Meldung wirklich löschen?':'Delete this report?'))return;
    try{await AW.forumDel(UI.forumSel);UI.forumSel=null;UI.forumOpen=null;UI.forum=await AW.forumThreads();render();toast('✓','good')}catch(e){toastErr(e)}};
  if(!UI.forum){try{UI.forum=await AW.forumThreads()}catch(e){toastErr(e);UI.forum=[]}
    if(SCR.cur&&SCR.cur.name==='forum'&&!UI.forumOpen)render();return}
  if(UI.forumSel&&!UI.forumOpen)await openSel();
};
