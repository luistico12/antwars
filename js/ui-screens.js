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
      <div class="avbig">${esc(initials(p.username))}</div>
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
S.profile.bind=p=>{
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
function bindClaims(p){p.querySelectorAll('[data-claim]').forEach(b=>b.onclick=async()=>{try{await AW.claim(b.dataset.claim);toast('+ Rubys','good')}catch(e){toastErr(e)}})}
UI.achTab='daily';
S.achievements=()=>shell(t('Erfolge'),{right:`<div class="pills" id="achT">${[['daily','Täglich'],['weekly','Wöchentlich'],['career','Karriere']].map(([k,n])=>`<button data-k="${k}" class="${UI.achTab===k?'on':''}" type="button">${t(n)}</button>`).join('')}</div>`},
  `<div class="grid">${QUESTS.filter(q=>q[1]===UI.achTab).map(q=>questRow(q)).join('')}</div>${needLogin()?`<div class="msg">${t('Melde dich an, um zu spielen')}</div>`:''}`);
S.achievements.bind=p=>{p.querySelectorAll('#achT [data-k]').forEach(b=>b.onclick=()=>{UI.achTab=b.dataset.k;render()});bindClaims(p)};

/* ---------- Shop: Hüte, Weltflaggen, Ameisenflaggen ---------- */
UI.shopTab='hat';
S.shop=()=>{
  const p=AW.profile||{owned:[]},tab=UI.shopTab;
  const items=SHOP.filter(i=>tab==='hat'?i.kind==='hat':tab==='world'?i.kind==='flag'&&!i.custom:i.kind==='flag'&&i.custom);
  const card=i=>{
    const own=(p.owned||[]).includes(i.id),eq=i.kind==='hat'?p.hat===i.key:p.flag===i.key;
    const pv=i.kind==='hat'?`<span data-hat="${i.key}"></span>`:flagSVG(i.key);
    return `<div class="shopit ${eq?'eq':''}"><div class="pv">${pv}</div><b>${esc(i.name)}</b>
      ${own?`<button class="btn sm ${eq?'':'pri'} block" data-eq="${i.id}" type="button">${eq?t('Ablegen'):t('Ausrüsten')}</button>`:`<button class="btn sm pri block" data-buy="${i.id}" type="button" ${(p.rubys||0)<i.price?'disabled':''}>${i.price} ${ico('ruby')} ${t('Kaufen')}</button>`}</div>`;
  };
  return shell(t('Shop'),{right:`<span class="ruby" style="font-size:17px">${ico('ruby')} ${p.rubys||0}</span>`},
   `<div class="pills" id="shopT" style="align-self:flex-start">${[['hat','Hüte'],['world','Weltflaggen'],['ant','Ameisenflaggen']].map(([k,n])=>`<button data-k="${k}" class="${tab===k?'on':''}" type="button">${t(n)}</button>`).join('')}</div>
    ${needLogin()?`<div class="msg">${t('Melde dich an, um zu spielen')}</div>`:''}
    <div class="msg">${LANG==='de'?'Rubys verdienst du mit Quests (Erfolge). Hüte tragen deine Ameisen, die Flagge steht auf deinem Hügel.':'Earn Rubys with quests (Achievements). Hats are worn by your ants, the flag flies on your mound.'}</div>
    <div class="shopgrid">${items.map(card).join('')}</div>`);
};
S.shop.bind=p=>{
  p.querySelectorAll('#shopT [data-k]').forEach(b=>b.onclick=()=>{UI.shopTab=b.dataset.k;render()});
  p.querySelectorAll('[data-hat]').forEach(c=>c.appendChild(hatPreview(c.dataset.hat)));
  p.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{try{await AW.buy(b.dataset.buy)}catch(e){toastErr(e)}});
  p.querySelectorAll('[data-eq]').forEach(b=>b.onclick=async()=>{const it=SHOP_BY_ID[b.dataset.eq],pr=AW.profile,cur=it.kind==='hat'?pr.hat:pr.flag;
    try{await AW.update({[it.kind]:cur===it.key?null:it.key})}catch(e){toastErr(e)}});
};

/* ---------- Clan (freie Tags sammeln Siege) ---------- */
S.clan=()=>{
  const p=AW.profile||{},cl=UI.clans;
  const mine=cl&&p.clan_tag&&cl.find(c=>c.clan_tag===p.clan_tag);
  return shell(t('Clan'),{sub:LANG==='de'?'Gib einen Tag frei ein. Alle Siege mit demselben Tag zählen für das Team.':'Type any tag. All wins under the same tag count for the team.'},`
   <div class="panel"><div class="row"><input class="inp" id="clTag" maxlength="5" placeholder="TAG (A–Z, 0–9)" value="${esc(p.clan_tag||'')}" style="flex:1;min-width:140px;text-transform:uppercase;font-weight:800;letter-spacing:.1em">
     <button class="btn pri" id="clJoin" type="button">${p.clan_tag?t('Speichern'):t('Beitreten')}</button>${p.clan_tag?`<button class="btn danger" id="clLeave" type="button">${t('Verlassen')}</button>`:''}</div><div id="clMsg" style="margin-top:8px"></div></div>
   ${mine?`<div class="grid g3 keep"><div class="stat"><b>${num(mine.wins)}</b><span>${t('Siege')}</span></div><div class="stat"><b>${num(mine.games)}</b><span>${t('Spiele')}</span></div><div class="stat"><b>${num(mine.members)}</b><span>${t('Mitglieder')}</span></div></div>`:''}
   <div class="lbl">Top ${t('Clans')}</div>${cl?`<div class="grid">${cl.slice(0,10).map((c,i)=>`<div class="li"><span class="rk">${i+1}</span><span class="ctag">${esc(c.clan_tag)}</span><b class="sp">${num(c.wins)} ${t('Siege')}</b><span class="mini">${num(c.members)} ${t('Mitglieder')}</span></div>`).join('')||'<div class="mini">–</div>'}</div>`:spinner()}`);
};
S.clan.bind=async p=>{
  const go=async tag=>{try{UI.noRerender=true;await AW.update({clan_tag:tag});UI.noRerender=false;UI.clans=null;render()}catch(e){UI.noRerender=false;toastErr(e)}};
  p.querySelector('#clJoin').onclick=()=>go(p.querySelector('#clTag').value.toUpperCase().replace(/[^A-Z0-9]/g,''));
  const l=p.querySelector('#clLeave');if(l)l.onclick=()=>go('');
  if(!UI.clans){UI.clans=await AW.clans();if(SCR.cur&&SCR.cur.name==='clan')render()}
};

/* ---------- Leaderboard (Bild 4) ---------- */
UI.lbTab='players';
S.leaderboard=()=>{
  const tab=UI.lbTab,rows=UI['lb_'+tab];
  const me=(AW.profile||{});
  const body=rows?`<div class="panel" style="padding:0;overflow:auto"><table class="lb"><thead><tr><th style="text-align:center">#</th><th>${tab==='players'?t('Spieler'):'Clan'}</th><th>${t('Siege')}</th><th>${t('Spiele')}</th><th>${t('Quote')}</th></tr></thead><tbody>
    ${rows.map((r,i)=>{const wr=r.games?100*r.wins/r.games:0;const nm=tab==='players'?`${r.clan_tag?`<span class="ctag">${esc(r.clan_tag)}</span>`:''}${esc(r.username)}<span class="mini">#${esc(r.tag||'')}</span>`:`<span class="ctag">${esc(r.clan_tag)}</span>${r.members||''} ${t('Mitglieder')}`;
      return `<tr class="r${i+1} ${tab==='players'&&r.username===me.username&&r.tag===me.tag&&me.games?'me':''}"><td style="text-align:center"><span class="rk">${i+1}</span></td><td><b>${nm}</b></td><td><b>${num(r.wins)}</b></td><td style="color:var(--mu)">${num(r.games)}</td><td><span class="wp ${wr<50?'low':''}">${wr.toFixed(1)}%</span></td></tr>`}).join('')||`<tr><td colspan="5" style="text-align:center;color:var(--mu)">–</td></tr>`}</tbody></table></div>`:spinner();
  return shell('Leaderboard',{sub:LANG==='de'?'Aktualisiert beim Öffnen':'Updated when opened',right:`<div class="pills" id="lbT"><button data-k="players" class="${tab==='players'?'on':''}" type="button">${ico('users')} ${t('Spieler')}</button><button data-k="clans" class="${tab==='clans'?'on':''}" type="button">${ico('shield')} ${t('Clans')}</button></div>`},body);
};
S.leaderboard.bind=async p=>{
  p.querySelectorAll('#lbT [data-k]').forEach(b=>b.onclick=()=>{UI.lbTab=b.dataset.k;render()});
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
  const l=UI.news;
  return shell(t('Neuigkeiten'),{right:l&&l[0]?`<span class="tag">${esc(l[0].version)}</span>`:''},
   l?l.map((n,i)=>`<div class="nitem ${i===0?'latest':''}"><button type="button" data-n="${i}"><span class="ver">${esc(n.version||'')}</span>${i===0?`<span class="tag ac">${t('Neueste')}</span>`:''}<b>${esc(n.title)}</b><span class="dt">${fmtDate(n.created_at)}</span>${ico(UI.nOpen===i||(UI.nOpen==null&&i===0)?'up':'down')}</button>${UI.nOpen===i||(UI.nOpen==null&&i===0)?`<div class="bd">${esc(n.body).replace(/\n/g,'<br>')}</div>`:''}</div>`).join(''):spinner());
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
 <li><b>4.</b> ${LANG==='de'?'Zu Beginn schützt dich die Schutzzeit. Erobertes kannst du behalten oder als Marionettenstaat führen.':'A protection period shields you at the start. Conquered land can be kept or run as a puppet state.'}</li></ul>`);

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
  <div class="row"><span class="lbl">${ico('globe')} ${t('Öffentliche Spiele')} <b style="color:var(--ac)">${UI.lobbies?UI.lobbies.length:''}</b></span><span class="sp"></span><button class="ibtn" id="jRef" type="button" aria-label="Refresh">${ico('refresh')}</button></div>
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
  }else{
    const l=UI.admPl,e=UI.admEditP;
    body=e?`<div class="panel"><div class="lbl" style="margin-bottom:8px">${esc(e.username)}</div><div class="grid g2 keep" style="gap:8px">
      ${[['username','Benutzername','text'],['clan_tag','Clan-Tag','text'],['rubys','Rubys','number'],['wins','Siege','number'],['games','Spiele','number'],['hat','Hut (Schlüssel)','text'],['flag','Flagge (Schlüssel)','text']].map(([k,n,ty])=>`<label class="field"><span class="lbl">${n}</span><input class="inp" data-f="${k}" type="${ty}" value="${esc(e[k]==null?'':e[k])}"></label>`).join('')}
      <label class="sw" style="align-self:end"><span>Admin</span><input type="checkbox" data-f="is_admin" ${e.is_admin?'checked':''}></label></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="pSv" type="button">${t('Speichern')}</button><button class="btn" id="pCn" type="button">${t('Zurück')}</button></div></div>`
    :`<div class="row"><input class="inp" id="aQ" placeholder="${t('Suchen')}" style="flex:1" value="${esc(UI.admQ||'')}"><button class="btn" id="aGo" type="button">${ico('search')}</button></div>
      ${l?`<div class="grid">${l.map(p=>`<div class="li">${p.clan_tag?`<span class="ctag">${esc(p.clan_tag)}</span>`:''}<span class="sp"><b>${esc(p.username)}</b><small>${num(p.wins)} ${t('Siege')} · ${num(p.games)} ${t('Spiele')} · ${p.rubys} Rubys ${p.is_admin?'· Admin':''}</small></span><button class="ibtn" data-pe="${esc(p.id)}" type="button">${ico('edit')}</button></div>`).join('')||'<div class="mini">–</div>'}</div>`:spinner()}`;
  }
  return shell(t('Admin'),{right:`<div class="pills" id="admT"><button data-k="news" class="${tab==='news'?'on':''}" type="button">${t('News')}</button><button data-k="pl" class="${tab==='pl'?'on':''}" type="button">${t('Spielerprofile')}</button></div>`},body);
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
  }else{
    if(!UI.admPl){UI.admPl=await AW.adminProfiles(UI.admQ||'');if(SCR.cur&&SCR.cur.name==='admin')render();return}
    const go=p.querySelector('#aGo');if(go)go.onclick=()=>{UI.admQ=p.querySelector('#aQ').value.trim();UI.admPl=null;render()};
    p.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>{UI.admEditP=UI.admPl.find(x=>String(x.id)===b.dataset.pe);render()});
    const sv=p.querySelector('#pSv');if(sv){sv.onclick=async()=>{const e=UI.admEditP,up={};
      p.querySelectorAll('[data-f]').forEach(i=>{const k=i.dataset.f;up[k]=i.type==='checkbox'?i.checked:i.type==='number'?Math.max(0,+i.value||0):(i.value.trim()||null)});
      up.username=up.username||e.username;up.clan_tag=(up.clan_tag||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      try{await AW.adminUpdate(e.id,up);UI.admEditP=null;UI.admPl=null;render();toast('✓','good')}catch(x){toastErr(x)}};
      p.querySelector('#pCn').onclick=()=>{UI.admEditP=null;render()}}
  }
};
