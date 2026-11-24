/* ===== Erfolge (Täglich / Wöchentlich / Karriere / Events), Profil mit Statistik und Spielverlauf, Bild-Zuschnitt ===== */

/* ---------- Fortschritt (ersetzt qProg aus ui-screens.js: Bonus-Quests zählen abgeholte Quests) ---------- */
function qProg(q){
  const pr=AW.profile||{},pk=periodKey(q[1]),cl=pr.quests||{};
  if(q[2]==='bonus'){const o=QUESTS.filter(x=>x[1]===q[1]&&x[2]!=='bonus'),v=o.filter(x=>cl[x[0]]===pk).length;return{v,raw:v,goal:o.length,done:v>=o.length,claimed:cl[q[0]]===pk}}
  const b=pr.stats&&pr.stats[q[1]],v=b&&b.k===pk?(b.v[q[2]]||0):0;
  return{v:Math.min(v,q[3]),raw:v,goal:q[3],done:v>=q[3],claimed:cl[q[0]]===pk};
}
/* Aktuelle Quests: Tages- und Wochenquests ohne Bonus, bei Karriere nur die jeweils nächste Stufe */
function activeQuests(){
  const out=QUESTS.filter(q=>q[1]!=='career'&&q[2]!=='bonus'),seen=new Set();
  for(const q of QUESTS){if(q[1]!=='career')continue;const k=q[9].key;if(seen.has(k))continue;seen.add(k);out.push(careerCur(k))}
  return out;
}
const TIER_ROM=['I','II','III','IV','V'];
const careerTiers=key=>QUESTS.filter(q=>q[1]==='career'&&q[9].key===key);
function careerCur(key){const ts=careerTiers(key);return ts.find(q=>!qProg(q).claimed)||ts[ts.length-1]}

/* ---------- Zeit bis zum Reset (UTC wie auf dem Server) ---------- */
function resetLeft(kind){
  const n=new Date(),d=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1));
  if(kind==='weekly'){const w=n.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+(7-w))}
  const m=Math.max(0,Math.floor((d-n)/60000)),dd=Math.floor(m/1440),h=Math.floor(m%1440/60),mi=m%60;
  return dd?`${dd}T ${h}h`:`${h}h ${mi}m`;
}
const streakNow=()=>{const s=AW.profile&&AW.profile.stats&&AW.profile.stats.streak;if(!s)return{n:0,today:false};
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);return{n:(s.last===dayKey()||s.last===y)?s.n:0,today:s.last===dayKey()}};

/* ---------- Bausteine ---------- */
/* Farbpaare je Quest-Art: Kachel, Balken und Leuchten nutzen --c1/--c2 */
const QCOL={
  gamepad:['#3b82f6','#1e3a8a'], calendar:['#38bdf8','#0369a1'], map:['#14b8a6','#0f766e'],
  hammer:['#22c55e','#166534'], swords:['#ef4444','#7f1d1d'], anchor:['#f97316','#9a3412'],
  trophy:['#eab308','#a16207'], chest:['#f59e0b','#b45309'], clock:['#a78bfa','#5b21b6'],
  handshake:['#2dd4bf','#0f766e'], gem:['#ec4899','#9d174d'], star:['#a855f7','#6b21a8'],
  heart:['#fb7185','#9f1239'], globe:['#22d3ee','#0e7490'], shield:['#6366f1','#312e81'],
  flame:['#fb923c','#9a3412'], leaf:['#84cc16','#3f6212']
};
const qColor=ic=>QCOL[ic]||QCOL.trophy;
const qTile=(ic,c)=>{const k=c||qColor(ic);return `<span class="qx-i" style="--c1:${k[0]};--c2:${k[1]}">${ico(ic)}</span>`};
const pctOf=g=>g.goal>0?Math.max(0,Math.min(100,Math.round(100*g.v/g.goal))):100;
/* Karriere-Prozent: abgeholte Stufen plus der Anteil der laufenden Stufe */
const careerPct=(ts,g)=>ts.length?Math.min(100,Math.round(100*(ts.filter(y=>qProg(y).claimed).length+g.v/g.goal)/ts.length)):0;
const rewardPill=(q,g)=>g.claimed
  ?`<span class="qx-done">${ico('check')} ${t('ABGEHOLT')}</span>`
  :g.done
    ?`<button class="qx-claim" data-claim="${q[0]}" type="button"><i></i><span>${t('ABHOLEN')}</span><b>+${q[4]} ${ico('ruby')}</b></button>`
    :`<span class="qx-rw">+${q[4]} ${ico('ruby')}</span>`;
function qxRow(q){
  const g=qProg(q),c=qColor(q[7]),pct=pctOf(g),ready=g.done&&!g.claimed,bonus=q[2]==='bonus';
  const bar=bonus
    ?`<div class="segs">${Array.from({length:g.goal},(_,i)=>`<i class="${i<g.v?'on':''}"></i>`).join('')}</div>`
    :`<div class="qx-track"><i style="width:${pct}%"></i></div>`;
  return `<div class="qx-row ${bonus?'bonus':''} ${g.claimed?'cl':''} ${ready?'rdy':''}" style="--c1:${c[0]};--c2:${c[1]}">
    ${qTile(q[7],c)}
    <div class="qx-tx"><b>${t(q[5])}</b><span>${t(q[6])}</span><div class="qx-pg">${bar}<em>${num(g.v)} / ${num(g.goal)}</em></div></div>
    ${rewardPill(q,g)}</div>`;
}
function qxHead(kind){
  const L=QUESTS.filter(q=>q[1]===kind&&q[2]!=='bonus'),d=L.filter(q=>qProg(q).claimed).length,st=streakNow(),daily=kind==='daily';
  const pct=L.length?Math.round(100*d/L.length):0;
  return `<div class="qx-head ${kind}" style="--c1:${daily?'#4f8cff':'#a855f7'};--c2:${daily?'#1e3a8a':'#6b21a8'}">
    <div class="qx-hl"><h3>${daily?t('Tagesquests'):t('Wochenquests!')}</h3>
      <div class="qx-pills"><span class="qx-pill">${ico('clock')} ${t('Reset in')} <b data-reset="${kind}">${resetLeft(kind)}</b></span>
        <span class="qx-pill">${ico('check')} <b>${d} / ${L.length}</b> ${t('erledigt')}</span>
        ${daily?`<span class="qx-pill fire">${ico('flame')} <b>${st.n}</b> ${t('Tage Serie')}</span>`:''}</div>
      <p class="qx-note">${ico('info')} ${t('Alle Partien zählen, auch Solo. Der Fortschritt aktualisiert sich nach jedem Match.')}</p></div>
    <div class="qx-gauge" style="--p:${pct}%"><span>${pct}%</span></div></div>`;
}
function careerHead(){
  const all=QUESTS.filter(q=>q[1]==='career'),keys=[...new Set(all.map(q=>q[9].key))];
  const done=all.filter(q=>qProg(q).claimed).length,pct=all.length?Math.round(100*done/all.length):0;
  const earned=all.filter(q=>qProg(q).claimed).reduce((a,q)=>a+q[4],0);
  return `<div class="qx-head career" style="--c1:#f7c948;--c2:#3d2408">
    <div class="qx-hl"><h3>${t('Karriere')}</h3>
      <div class="qx-pills"><span class="qx-pill">${ico('trophy')} <b>${done} / ${all.length}</b> ${t('Stufen')}</span>
        <span class="qx-pill">${ico('board')} <b>${keys.length}</b> ${t('Quests')}</span>
        <span class="qx-pill">${ico('ruby')} <b>${num(earned)}</b> ${t('gesammelt')}</span></div>
      <p class="qx-note">${ico('info')} ${t('Jede Karriere-Quest hat vier bis fünf Stufen – hol Stufe für Stufe ab.')}</p></div>
    <div class="qx-gauge" style="--p:${pct}%"><span>${pct}%</span></div></div>`;
}
const CAREER_CATS=['Matches','Sieg','Kriegsführung','Bauen','Seekrieg','Diplomatie','Sammlung','Meisterleistungen'];
const CAT_ICO={Alle:'box',Matches:'gamepad',Sieg:'trophy',Kriegsführung:'swords',Bauen:'hammer',Seekrieg:'anchor',Diplomatie:'handshake',Sammlung:'gem',Meisterleistungen:'star'};
function careerCard(key){
  const ts=careerTiers(key),q=careerCur(key),g=qProg(q),c=qColor(q[7]),x=q[9],ndone=ts.filter(y=>qProg(y).claimed).length;
  const full=ndone===ts.length,pct=full?100:careerPct(ts,g),bp=pctOf(g),ready=g.done&&!g.claimed;
  const steps=ts.map((y,i)=>`<i class="${i<ndone?'on':i===ndone?'cur':''}">${i+1}</i>`).join('');
  return `<div class="qx-cc ${full?'full':''} ${ready?'rdy':''}" style="--c1:${c[0]};--c2:${c[1]}">
    <div class="cc-h">${qTile(q[7],c)}<div class="cc-t"><b>${t(q[5])}</b><span class="tiers">${t('Stufe')} ${x.tier} ${t('von')} ${ts.length}</span></div>${full?`<span class="cc-p ok">${ico('check')}</span>`:`<span class="cc-p">${pct}%</span>`}</div>
    <div class="cc-d"><span>${t(q[6])}</span><em>${t(x.sub)}</em></div>
    <div class="cc-steps">${steps}</div>
    <div class="cc-pg"><div class="qx-track"><i style="width:${bp}%"></i></div><em>${num(g.v)} / ${num(g.goal)}</em></div>
    <div class="cc-r">${full?`<span class="qx-done">${ico('check')} ${t('ALLE STUFEN')}</span>`:rewardPill(q,g)}</div></div>`;
}
UI.achTab=UI.achTab||'daily';UI.achCat=UI.achCat||'Alle';
S.achievements=()=>{
  const tab=UI.achTab,p=AW.profile||{};
  const tabs=[['daily','Täglich','calendar'],['weekly','Wöchentlich','calendar'],['career','Karriere','trophy'],['event','Events','star']];
  let body='';
  if(tab==='daily'||tab==='weekly')body=qxHead(tab)+`<div class="qx-list">${QUESTS.filter(q=>q[1]===tab&&q[2]!=='bonus').map(qxRow).join('')}</div><div class="qx-sep"><i></i></div>${QUESTS.filter(q=>q[1]===tab&&q[2]==='bonus').map(qxRow).join('')}`;
  else if(tab==='career'){
    const keys=[...new Set(QUESTS.filter(q=>q[1]==='career').map(q=>q[9].key))],cnt=c=>keys.filter(k=>c==='Alle'||careerTiers(k)[0][8]===c).length;
    const show=keys.filter(k=>UI.achCat==='Alle'||careerTiers(k)[0][8]===UI.achCat);
    body=careerHead()+`<div class="qx-cats">${['Alle',...CAREER_CATS].map(c=>`<button type="button" data-cat="${c}" class="${UI.achCat===c?'on':''}"><span class="qx-ci">${ico(CAT_ICO[c])}</span>${t(c)}<em>${cnt(c)}</em></button>`).join('')}</div><div class="qx-grid">${show.map(careerCard).join('')}</div>`;
  }else body=`<div class="qx-empty">${qTile('calendar')}<b>${t('Gerade läuft kein Event')}</b><span>${t('Zeitlich begrenzte Events mit Sonderquests und Belohnungen erscheinen hier.')}</span></div>`;
  return shell(t('Erfolge'),{right:`<span class="qx-ruby">${ico('ruby')} ${num(p.rubys||0)}</span>`},
    `<div class="qx-tabs">${tabs.map(([k,n,i])=>`<button type="button" data-k="${k}" class="${tab===k?'on':''}">${ico(i)} ${t(n)}</button>`).join('')}</div>${needLogin()?`<div class="msg">${t('Melde dich an, um zu spielen')}</div>`:''}<div class="qx-body">${body}</div>`);
};
S.achievements.bind=p=>{
  p.querySelectorAll('.qx-tabs [data-k]').forEach(b=>b.onclick=()=>{UI.achTab=b.dataset.k;render()});
  p.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{UI.achCat=b.dataset.cat;render()});
  bindClaims(p);
  const iv=setInterval(()=>{if(!document.body.contains(p)){clearInterval(iv);return}p.querySelectorAll('[data-reset]').forEach(e=>e.textContent=resetLeft(e.dataset.reset))},30000);
};

/* ---------- Spielverlauf (nur auf diesem Gerät) ---------- */
const Hist={
  key:'aw_hist',cur:null,
  list(){const l=lsGet(this.key,[]);return Array.isArray(l)?l:[]},
  save(l){lsSet(this.key,l.slice(0,50))},
  begin(){
    const mp=typeof NET!=='undefined'&&!!(NET.on||NET.active||NET.host||NET.guest);
    this.cur={id:Math.random().toString(36).slice(2,10),t0:Date.now(),mode:modeKey,spd:SIMV,diff:diffKey,sp:(typeof SP!=='undefined'&&SP[setupSp]||{}).id||'',mp,dur:0,res:'',conq:0,built:0,sunk:0,terr:0};
    this.flush();
  },
  add(p){const c=this.cur;if(!c)return;c.conq+=p.conq||0;c.built+=p.built||0;c.sunk+=p.sunk||0;if(p.terr)c.terr=Math.max(c.terr,p.terr);this.tick()},
  tick(){const c=this.cur;if(!c)return;c.dur=Math.round(rtime());this.flush()},
  end(win){const c=this.cur;if(!c)return;c.res=win?'win':'loss';c.dur=Math.round(rtime());this.flush();this.cur=null},
  flush(){const c=this.cur;if(!c)return;const l=this.list().filter(x=>x.id!==c.id);l.unshift({...c});this.save(l)}
};
const fmtDur=s=>{s=Math.max(0,Math.round(s));const m=Math.floor(s/60);return m?`${m}m ${String(s%60).padStart(2,'0')}s`:`${s}s`};
const fmtDT=ts=>{try{return new Date(ts).toLocaleString(LANG==='de'?'de-DE':'en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return''}};
const modeName=k=>(MODES[k]||MODES.classic).n;

/* ---------- Profil im FrontWars-Stil ---------- */
UI.profTab=UI.profTab||'stats';UI.profMode='all';
const pStat=(v,l,ic,cls)=>`<div class="pf-big ${cls||''}"><b>${v}</b><span>${ic?ico(ic)+' ':''}${l}</span></div>`;
const pTile=(v,l,cls)=>`<div class="pf-tile"><span>${l}</span><b class="${cls||''}">${v}</b></div>`;
function profStats(p){
  const h=Hist.list().filter(x=>x.res||x.dur>30),wr=p.games?Math.round(100*p.wins/p.games):0;
  const mp=h.filter(x=>x.mp).length,so=h.length-mp,tot=Math.max(1,mp+so),durs=h.map(x=>x.dur).filter(x=>x>0);
  const avg=durs.length?durs.reduce((a,b)=>a+b,0)/durs.length:0,mx=durs.length?Math.max(...durs):0,mn=durs.length?Math.min(...durs):0;
  const fm=UI.profMode,hm=h.filter(x=>fm==='all'||x.mode===fm),mw=hm.filter(x=>x.res==='win').length,mt=hm.reduce((a,b)=>a+b.dur,0);
  const cv=(p.stats&&p.stats.career&&p.stats.career.v)||{};
  return `<div class="pf-box"><h4>${t('ALLE SPIELE')}</h4>
    <div class="pf-row3">${pStat(num(p.games),t('Spiele'),'board')}${pStat(`<span style="color:#f7c948">${num(p.wins)}</span>`,t('Siege'),'trophy')}${pStat(wr+'%',t('Siegrate'),'up')}</div>
    <div class="pf-split"><label><span>${t('Mehrspieler')} <b>${mp}</b></span><span><b>${so}</b> ${t('Einzelspieler')}</span></label><div class="bar2"><i style="width:${Math.round(100*mp/tot)}%"></i></div></div>
    <div class="pf-row3 t">${pTile(avg?fmtDur(avg):'–',t('Ø Spiel'))}${pTile(mx?fmtDur(mx):'–',t('Längste'),'pu')}${pTile(mn?fmtDur(mn):'–',t('Kürzeste'),'gr')}</div></div>
    <div class="pf-box"><div class="pf-hd"><h4>${t('MODI')}</h4><div class="pf-pills" id="pfM">${[['all','Alle'],['classic','Klassisch'],['fast','Schnell'],['chaos','Chaos'],['unlimited','Unlimited']].map(([k,n])=>`<button type="button" data-m="${k}" class="${fm===k?'on':''}">${t(n)}</button>`).join('')}</div></div>
      <div class="pf-grid2">${pTile(hm.length,t('SPIELE'))}${pTile(`<span style="color:#f7c948">${mw}</span>`,t('SIEGE'))}${pTile(mt?fmtDur(mt):'–',t('SPIELZEIT'))}${pTile((hm.length?Math.round(100*mw/hm.length):0)+'%',t('SIEGRATE'))}</div>
      <div class="mini" style="margin-top:8px">${t('Modus-Werte stammen aus dem Spielverlauf dieses Geräts.')}</div></div>
    <div class="pf-box"><h4>${ico('swords')} ${t('KRIEGSFÜHRUNG')}</h4><div class="pf-grid2">${pTile(num(cv.conq||0),t('Eroberte Gebiete'),'rd')}${pTile(num(cv.built||0),t('Gebaute Gebäude'))}${pTile(num(cv.sunk||0),t('Versenkte Schiffe'))}${pTile(num(cv.terr||0),t('Meiste Gebiete'))}${pTile(num(cv.allied||0),t('Bündnisse'))}${pTile(num(cv.found||0),t('Funde'))}</div></div>`;
}
function profHist(p){
  const h=Hist.list();
  if(!h.length)return `<div class="qx-empty"><b>${t('Noch keine Spiele')}</b><span>${t('Deine letzten Partien erscheinen hier, sobald du gespielt hast.')}</span></div>`;
  const sp=id=>(typeof SP!=='undefined'&&SP.find&&SP.find(s=>s.id===id))||{};
  return h.map(x=>{const res=x.res==='win'?`<span class="pf-tag w">${t('SIEG')}</span>`:x.res==='loss'?`<span class="pf-tag l">${t('BESIEGT')}</span>`:`<span class="pf-tag n">${t('NICHT BEENDET')}</span>`,open=UI.histOpen===x.id,
    nm=`${modeName(x.mode)}${sp(x.sp).n?' · '+esc(sp(x.sp).n):''}`;
    return `<div class="pf-g ${open?'open':''}"><button type="button" data-g="${x.id}" class="pf-gh"><span class="pf-gi">${esc(modeName(x.mode).slice(0,2).toUpperCase())}</span><span class="pf-gt"><b>${nm} <span class="pf-tag m">${x.spd}x</span> ${res}${x.mp?'':` <span class="pf-tag s">${t('SOLO')}</span>`}</b><em>${t('Gespielt')}: ${fmtDT(x.t0)}</em></span><span class="pf-gd">${fmtDur(x.dur)} ${ico('down')}</span></button>
      ${open?`<div class="pf-gb"><div><span>${t('Modus')}</span><b>${modeName(x.mode)}</b></div><div><span>${t('Tempo')}</span><b>${x.spd}x</b></div><div><span>${t('Schwierigkeit')}</span><b>${esc(x.diff||'')}</b></div><div><span>${t('Dauer')}</span><b class="rd">${fmtDur(x.dur)}</b></div><div><span>${t('Eroberungen')}</span><b>${x.conq||0}</b></div><div><span>${t('Gebaut')}</span><b>${x.built||0}</b></div><div><span>${t('Versenkt')}</span><b>${x.sunk||0}</b></div><div><span>${t('Meiste Gebiete')}</span><b>${x.terr||0}</b></div></div>`:''}</div>`}).join('');
}
function profAccount(p,li){
  return `<div class="pf-box"><h4>${t('Name')} / ${t('Clan-Tag')}</h4>
    <div class="row"><input class="inp" id="pName" maxlength="20" value="${esc(p.username||'')}" style="flex:2;min-width:140px"><input class="inp" id="pClan" maxlength="5" placeholder="TAG" value="${esc(p.clan_tag||'')}" style="flex:1;min-width:90px;text-transform:uppercase"><button class="btn pri" id="pSave" type="button">${t('Speichern')}</button></div><div id="pMsg" style="margin-top:8px"></div></div>
    ${li?`<div class="pf-box"><h4>${t('Sicherheit')} · ${t('Telefonnummer (Backup)')}</h4>
      <div class="row"><input class="inp" id="phN" type="tel" placeholder="+49 …" value="${esc((AW.user&&AW.user.phone)?'+'+AW.user.phone.replace(/^\+/,''):'')}" style="flex:1;min-width:160px" autocomplete="tel"><button class="btn" id="phSend" type="button">${t('Code senden')}</button></div>
      <div class="row" id="phRow" style="margin-top:8px" hidden><input class="inp" id="phC" inputmode="numeric" maxlength="8" placeholder="123456" style="flex:1"><button class="btn pri" id="phOk" type="button">${t('Bestätigen')}</button></div><div id="phMsg" style="margin-top:8px"></div></div>`:''}`;
}
S.profile=()=>{
  if(AW.loggedIn&&!AW.profile&&!(AW.user&&AW.user.local))return shell(t('Profil'),{},`<div class="msg err">${LANG==='de'?'Dein Profil wurde in der Datenbank nicht gefunden. Führe supabase/schema.sql im Supabase-SQL-Editor aus und lege das Profil nach (siehe README, „Profil nachtragen“). Danach neu anmelden.':'Your profile was not found in the database. Run supabase/schema.sql in the Supabase SQL editor and re-create the profile (see README). Then sign in again.'}</div>`);
  const p=AW.profile||{},li=AW.loggedIn&&!(AW.user&&AW.user.local),tab=UI.profTab,av=safeAvatar(p.avatar);
  const done=QUESTS.filter(q=>q[1]==='career'&&qProg(q).claimed).length;
  const tabs=`<div class="pf-tabs">${[['stats','Meine Statistiken','board'],['hist','Letzte Spiele','clock'],['acc','Konto','user']].map(([k,n,i])=>`<button type="button" data-t="${k}" class="${tab===k?'on':''}">${ico(i)} ${t(n)}</button>`).join('')}</div>`;
  return shell(t('Profil'),{right:tabs},`
  <div class="pf" id="profGrid"><div class="pf-l">
    <div class="pf-card id"><div class="avbig">${av?`<img alt="" src="${av}">`:ico('user')}</div>
      <div class="pf-nm"><b>${p.clan_tag?`<span class="ctag">${esc(p.clan_tag)}</span>`:''}${esc(p.username||'Gast')}<span class="mini" style="font-weight:400">#${esc(p.tag||'0000')}</span></b>
      <div class="row" style="justify-content:center">${p.flag?flagSVG(p.flag):''}</div></div>
      <div class="row" style="justify-content:center"><label class="btn sm" for="pAvF">${ico('edit')} ${t('Profilbild')}</label><input type="file" id="pAvF" accept="image/png,image/jpeg,image/webp" hidden>${av?`<button class="btn sm" id="pAvX" type="button" aria-label="${t('Entfernen')}">${ico('trash')}</button>`:''}</div></div>
    <div class="pf-card rub"><div class="pf-cur">${ico('ruby')}<b>${num(p.rubys||0)}</b></div><button class="btn pri block" data-go="shop" type="button">${ico('shop')} ${t('Zum Shop')} ›</button></div>
    <div class="pf-card ach"><div class="pf-cur"><span class="pf-gem">${ico('trophy')}</span><em>${t('ERFOLGE')}</em><b>${done}</b></div></div>
    <div class="pf-card clan ${p.clan_tag?'':'none'}"><span class="pf-sh">${ico('shield')}</span><div><b>${p.clan_tag?esc(p.clan_tag):t('Kein Clan')}</b><button class="lnk" data-go="clan" type="button">${ico('search')} ${t('Clan finden')}</button></div></div>
    <div class="pf-card info"><div class="field"><span class="lbl">${t('Konto-ID')}</span><span class="mono">${esc(li?(p.id||''):'local')}</span></div><div class="field"><span class="lbl">${t('Mitglied seit')}</span><span>${fmtDate(p.created_at)}</span></div>
      <button class="btn block" id="pCopy" type="button">${ico('link')} ${t('Profillink kopieren')}</button></div>
    ${li&&!AW.isAnon?`<button class="btn danger block" id="pOut" type="button">${ico('logout')} ${t('Abmelden')}</button>`:`<button class="btn pri block" id="pSecure" type="button">${ico('shield')} ${t('Konto sichern')}</button><button class="btn block" id="pIn" type="button">${ico('enter')} ${t('Anmelden')}</button>`}
    ${AW.isAdmin?`<button class="btn block" data-go="admin" type="button">${ico('admin')} ${t('Admin')}</button>`:''}
  </div><div class="pf-r">${tab==='stats'?profStats(p):tab==='hist'?profHist(p):profAccount(p,li)}</div></div>`);
};
const _profBindOld=null;
S.profile.bind=p=>{
  const af=p.querySelector('#pAvF');if(af)af.onchange=async()=>{try{const d=await cropAvatar(af.files[0]);af.value='';if(d){await AW.update({avatar:d});toast(t('Gespeichert'),'good')}}catch(e){af.value='';toastErr(e)}};
  const ax=p.querySelector('#pAvX');if(ax)ax.onclick=async()=>{try{await AW.update({avatar:null})}catch(e){toastErr(e)}};
  p.querySelectorAll('.pf-tabs [data-t]').forEach(b=>b.onclick=()=>{UI.profTab=b.dataset.t;render()});
  p.querySelectorAll('#pfM [data-m]').forEach(b=>b.onclick=()=>{UI.profMode=b.dataset.m;render()});
  p.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{UI.histOpen=UI.histOpen===b.dataset.g?null:b.dataset.g;render()});
  const msg=(id,k,x)=>{p.querySelector(id).innerHTML=`<div class="msg ${k}">${esc(x)}</div>`};
  p.querySelector('#pCopy').onclick=()=>{try{navigator.clipboard.writeText(location.origin+location.pathname+'?u='+((AW.profile&&AW.profile.id)||'')).then(()=>toast(t('Kopiert'),'good'))}catch(e){}};
  const o=p.querySelector('#pOut');if(o)o.onclick=async()=>{await AW.signOut();closeScreens()};
  const i=p.querySelector('#pIn');if(i)i.onclick=()=>loginShow();
  const sc=p.querySelector('#pSecure');if(sc)sc.onclick=()=>loginShow('up');
  const sv=p.querySelector('#pSave');if(sv)sv.onclick=async()=>{
    const n=p.querySelector('#pName').value.trim(),c=p.querySelector('#pClan').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(n.length<2){msg('#pMsg','err','Name zu kurz');return}
    try{UI.noRerender=true;await AW.update({username:n,clan_tag:c});UI.noRerender=false;msg('#pMsg','ok','✓')}catch(e){UI.noRerender=false;msg('#pMsg','err',e.message)}
  };
  const ph=p.querySelector('#phSend');if(ph){
    ph.onclick=async()=>{const n=p.querySelector('#phN').value.trim();if(!/^\+\d{7,15}$/.test(n)){msg('#phMsg','err','+49…');return}
      try{await AW.setPhone(n);p.querySelector('#phRow').hidden=false;msg('#phMsg','ok','SMS ✓')}catch(e){msg('#phMsg','err',e.message)}};
    p.querySelector('#phOk').onclick=async()=>{try{await AW.verifyPhone(p.querySelector('#phN').value.trim(),p.querySelector('#phC').value.trim());msg('#phMsg','ok','✓')}catch(e){msg('#phMsg','err',e.message)}};
  }
};

/* ---------- Profilbild zuschneiden: Bild verschieben, zoomen, als Kreis speichern ---------- */
function cropAvatar(f){return new Promise((ok,no)=>{
  if(!f)return ok(null);
  if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>8e6)return no(new Error(LANG==='de'?'Bitte ein PNG, JPG oder WebP unter 8 MB wählen':'Please choose a PNG, JPG or WebP under 8 MB'));
  const im=new Image(),url=URL.createObjectURL(f);
  im.onerror=()=>{URL.revokeObjectURL(url);no(new Error(LANG==='de'?'Bild konnte nicht gelesen werden':'Could not read the image'))};
  im.onload=()=>{
    const V=280,m=document.createElement('div');m.id='cropM';
    m.innerHTML=`<div class="cm-box" role="dialog" aria-modal="true"><h3>${t('Profilbild zuschneiden')}</h3><canvas id="cropC" width="${V}" height="${V}"></canvas>
      <label class="cm-z">${ico('search')}<input id="cropZ" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label><div class="mini">${t('Ziehen zum Verschieben, Regler oder Mausrad zum Zoomen')}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" id="cropNo" type="button">${t('Abbrechen')}</button><button class="btn pri" id="cropOk" type="button">${t('Speichern')}</button></div></div>`;
    document.body.appendChild(m);
    const c=m.querySelector('#cropC'),g=c.getContext('2d'),base=V/Math.min(im.naturalWidth,im.naturalHeight);
    let z=1,ox=0,oy=0,drag=null;
    const clampO=()=>{const w=im.naturalWidth*base*z,h=im.naturalHeight*base*z;ox=Math.max(-(w-V)/2,Math.min((w-V)/2,ox));oy=Math.max(-(h-V)/2,Math.min((h-V)/2,oy))};
    const paint=(g2,S)=>{const k=S/V,w=im.naturalWidth*base*z*k,h=im.naturalHeight*base*z*k;g2.drawImage(im,S/2-w/2+ox*k,S/2-h/2+oy*k,w,h)};
    const draw=()=>{clampO();g.clearRect(0,0,V,V);g.fillStyle='#fff';g.fillRect(0,0,V,V);paint(g,V);
      g.save();g.fillStyle='rgba(8,12,20,.62)';g.beginPath();g.rect(0,0,V,V);g.arc(V/2,V/2,V/2-6,0,6.283,true);g.fill('evenodd');g.restore();
      g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=2;g.beginPath();g.arc(V/2,V/2,V/2-6,0,6.283);g.stroke()};
    const close=r=>{URL.revokeObjectURL(url);m.remove();r()};
    c.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ox,oy};c.setPointerCapture(e.pointerId)};
    c.onpointermove=e=>{if(!drag)return;ox=drag.ox+(e.clientX-drag.x)*(V/c.getBoundingClientRect().width);oy=drag.oy+(e.clientY-drag.y)*(V/c.getBoundingClientRect().height);draw()};
    c.onpointerup=c.onpointercancel=()=>{drag=null};
    c.onwheel=e=>{e.preventDefault();z=Math.max(1,Math.min(4,z+(e.deltaY<0?0.1:-0.1)));m.querySelector('#cropZ').value=z;draw()};
    m.querySelector('#cropZ').oninput=e=>{z=+e.target.value;draw()};
    m.querySelector('#cropNo').onclick=()=>close(()=>ok(null));
    m.querySelector('#cropOk').onclick=()=>{
      const o=document.createElement('canvas');o.width=o.height=96;const og=o.getContext('2d');og.fillStyle='#fff';og.fillRect(0,0,96,96);
      clampO();paint(og,96);
      let d=o.toDataURL('image/webp',.85);if(!d.startsWith('data:image/webp'))d=o.toDataURL('image/jpeg',.85);
      close(()=>safeAvatar(d)?ok(d):no(new Error('Bild zu groß')))};
    draw();m.querySelector('#cropOk').focus();
  };
  im.src=url})}
