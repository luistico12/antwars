/* ===== Clans (v21.6): Mitglieder, Chat, Statistik, Suche, Gründung, Einladungen =====
   Der Tag wird bei der Gründung vergeben und ist nicht mehr frei wählbar.
   Lesen darf jeder angemeldete Spieler (Suche/Rangliste), schreiben nur Mitglieder. */

const CL_COST=600;
const CL_ROLE={owner:'Besitzer',admin:'Admin',member:'Mitglied'};

/* ---------- Kleine Helfer ---------- */
function clAgo(ts){
  if(!ts)return '—';
  const d=(Date.now()-new Date(ts).getTime())/1000;
  if(d<60)return t('gerade eben');
  if(d<3600)return `${Math.floor(d/60)} ${t('Min')}`;
  if(d<86400)return `${Math.floor(d/3600)} ${t('Std.')}`;
  if(d<604800)return `${Math.floor(d/86400)} ${t('Tage')}`;
  return fmtDate(ts);
}
const clClock=ts=>{try{return new Date(ts).toLocaleTimeString(LANG==='de'?'de-DE':'en-GB',{hour:'2-digit',minute:'2-digit'})}catch(e){return''}};
const clCrest=(tag,color,cls,logo)=>{const im=safeAvatar(logo);return `<span class="cl-crest ${cls||''}" style="--tc:${esc(color||'#ffd166')}">${im?`<img alt="" src="${im}">`:esc(tag||'?')}</span>`};
const clRoleBadge=r=>r==='owner'?`<span class="cl-rb ow">${ico('crown')} ${t('Besitzer')}</span>`:r==='admin'?`<span class="cl-rb ad">${ico('shield')} Admin</span>`:'';
/* Markdown in der Beschreibung: **fett**, *kursiv*, `code` und klickbare Links (auch Discord) */
function mdInline(s){
  let h=esc(s||'');
  h=h.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g,'$1<i>$2</i>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
  h=h.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g,u=>{
    const href=/^https?:/.test(u)?u:'https://'+u;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`;
  });
  return h.replace(/\n/g,'<br>');
}
const clOpenBadge=o=>o?`<span class="cl-open">${ico('globe')} ${t('Offen')}</span>`:`<span class="cl-open lock">${ico('lock')} ${t('Auf Anfrage')}</span>`;
const clMemPct=(n,m)=>Math.min(100,Math.round(100*(+n||0)/Math.max(1,+m||1)));

/* ---------- Daten laden ---------- */
async function clLoad(force){
  if(force||UI.clan===undefined){try{UI.clan=await AW.clanMy()}catch(e){UI.clan=null;toastErr(e)}}
  const mine=!!UI.clan;
  if(force||UI.clanMembers===undefined)UI.clanMembers=mine?await AW.clanMembers().catch(()=>[]):[];
  if(mine&&(force||UI.clanStats===undefined))UI.clanStats=await AW.clanStats().catch(()=>null);
  if(mine&&(force||UI.clanChat===undefined))UI.clanChat=await AW.clanChat().catch(()=>[]);
  if(force||UI.clanFind===undefined)UI.clanFind=await AW.clanFind(UI.clanQ||'',UI.clanFilter||'all').catch(()=>[]);
  if(force||UI.clanInvites===undefined)UI.clanInvites=await AW.clanInvites().catch(()=>[]);
  if(mine)AW.clanTouch();
}
const clReset=()=>{UI.clan=undefined;UI.clanMembers=undefined;UI.clanStats=undefined;UI.clanChat=undefined;UI.clanFind=undefined;UI.clanInvites=undefined};

/* ---------- Mitglieder ---------- */
function clMembersTab(st){
  const c=st.clan,adm=st.role==='owner'||st.role==='admin',mem=UI.clanMembers||[],stt=UI.clanStats||{};
  const week=stt.clan?stt.clan.week_wins:c.week_wins,rank=stt.rank;
  const left=`<div class="cl-card">
    ${clCrest(c.tag,c.tag_color,'big',c.logo)}
    <div class="cl-name"><span class="cl-tag" style="--tc:${esc(c.tag_color)}">${esc(c.tag)}</span><b>${esc(c.name)}</b></div>
    <div class="cl-flags">${clOpenBadge(c.is_open)}${c.min_wins?`<span class="cl-open">${ico('trophy')} ${c.min_wins}+ ${t('Siege')}</span>`:''}</div>
    <div class="cl-desc">${c.descr?mdInline(c.descr):`<span class="mini">${t('Noch keine Beschreibung.')}</span>`}</div>
    <div class="cl-stats2">
      <div><b>${rank?'#'+rank:'—'}</b><span>${t('RANGLISTE')}</span><small>${num(week)} ${t('Siege diese Woche')}</small></div>
      <div><b>${num(c.wins)}</b><span>${t('SIEGE GESAMT')}</span><small>${num(c.games)} ${t('Spiele')}</small></div>
    </div>
    <div class="cl-mem"><div class="row"><span>${t('Mitglieder')}</span><span class="sp"></span><b>${c.members}/${c.max_members}</b></div>
      <div class="bar"><i style="width:${clMemPct(c.members,c.max_members)}%"></i></div></div>
    ${adm?`<button class="btn block" id="clEdit" type="button">${ico('edit')} ${t('Clan bearbeiten')}</button>`:''}
    <button class="btn danger block" id="clLeave" type="button">${ico('logout')} ${t('Clan verlassen')}</button>
  </div>`;
  const invite=adm?`<div class="cl-inv"><input class="inp" id="clInvN" placeholder="${t('Name#1234')}" maxlength="26" autocomplete="off"><button class="btn pri" id="clInvGo" type="button">${ico('plus')} ${t('Einladen')}</button></div>`:'';
  const rows=mem.map((m,i)=>{
    const isMe=AW.profile&&String(m.user_id)===String(AW.profile.id)||m.username===AW.profile.username&&m.tag===AW.profile.tag;
    const open=UI.clanMenu===m.user_id;
    const acts=[];
    if(adm&&!isMe&&m.role!=='owner'){
      acts.push(`<button class="btn sm" data-ca="mute:${esc(m.user_id)}" type="button">${m.muted?t('Stummschaltung aufheben'):t('Stummschalten')}</button>`);
      if(st.role==='owner')acts.push(`<button class="btn sm" data-ca="role:${esc(m.user_id)}" type="button">${m.role==='admin'?t('Zum Mitglied'):t('Zum Admin')}</button>`);
      if(st.role==='owner')acts.push(`<button class="btn sm" data-ca="owner:${esc(m.user_id)}" type="button">${t('Zum Besitzer')}</button>`);
      acts.push(`<button class="btn sm danger" data-ca="kick:${esc(m.user_id)}" type="button">${t('Entfernen')}</button>`);
    }
    return `<div class="cl-mrow${open?' open':''}${isMe?' me':''}">
      <span class="cl-rk r${i+1}">${i+1}</span>
      <span class="cl-av">${safeAvatar(m.avatar)?`<img alt="" src="${safeAvatar(m.avatar)}">`:esc(initials(m.username))}</span>
      <span class="cl-mn"><b>${esc(m.username)}${isMe?` <span class="cl-rb me">${t('DU')}</span>`:''}${m.muted?` <span class="cl-rb mu">${ico('sound')}</span>`:''}</b>
        <small>${clRoleBadge(m.role)||`<span class="cl-rb">${t('Mitglied')}</span>`}</small></span>
      <span class="cl-w">${num(m.wins)}</span>
      <span class="cl-ls">${clAgo(m.last_seen)}</span>
      <button class="ibtn cl-more" data-cm="${esc(m.user_id)}" type="button" aria-label="${t('Aktionen')}">${ico('menu')}</button>
      ${open&&acts.length?`<div class="cl-acts">${acts.join('')}</div>`:''}
    </div>`;
  }).join('')||`<div class="mini" style="padding:16px">–</div>`;
  const edit=UI.clanEdit?clEditForm(c):'';
  return `<div class="cl-wrap">
    <div>${left}</div>
    <div class="cl-right">${edit}${invite}
      <div class="cl-table">
        <div class="cl-thead"><span>#</span><span></span><span>${t('SPIELER')}</span><span>${t('SIEGE')}</span><span>${t('ZULETZT ONLINE')}</span><span></span></div>
        ${rows}
      </div></div></div>`;
}
function clEditForm(c){
  const lg=safeAvatar(UI.clanLogo===undefined?c.logo:UI.clanLogo);
  return `<div class="panel cl-edit"><div class="row"><span class="lbl">${t('Clan bearbeiten')}</span><span class="sp"></span><button class="ibtn" id="clEditX" type="button" aria-label="${t('Schließen')}">${ico('close')}</button></div>
    <div class="grid" style="gap:8px">
      <input class="inp" id="cleName" maxlength="28" value="${esc(c.name)}" placeholder="${t('Clan-Name')}">
      <div class="cl-colors" id="cleColors">${CLAN_COLORS.map(col=>`<button type="button" data-c="${col}" class="${c.tag_color===col?'on':''}" style="--c:${col}" aria-label="${col}"></button>`).join('')}</div>
      <div class="cl-logo"><span class="cl-crest big" id="cleLogoP">${lg?`<img alt="" src="${lg}">`:ico('shield')}</span>
        <div class="cl-logof"><div class="row"><label class="btn sm" for="cleLogoF">${ico('edit')} ${t('Bild wählen')}</label><button class="btn sm" id="cleLogoX" type="button">${ico('trash')} ${t('Entfernen')}</button></div>
          <div class="mini">${t('PNG, JPG oder WebP, max. 4 MB – quadratisch zugeschnitten.')}</div></div></div>
      <input type="file" id="cleLogoF" accept="image/png,image/jpeg,image/webp" hidden>
      <textarea class="inp" id="cleDesc" rows="3" maxlength="600" placeholder="${t('Beschreibung – Markdown und Discord-Links erlaubt')}">${esc(c.descr||'')}</textarea>
      <div class="row"><label class="sw"><span>${t('Offen für alle')}</span><input type="checkbox" id="cleOpen" ${c.is_open?'checked':''}></label>
        <span class="sp"></span><label class="field" style="max-width:150px"><span class="lbl">${t('Mindest-Siege')}</span><input class="inp" id="cleMin" type="number" min="0" max="100000" value="${c.min_wins||0}"></label></div>
      <button class="btn pri" id="cleSave" type="button">${t('Speichern')}</button>
    </div></div>`;
}

/* ---------- Chat ---------- */
const clLogHtml=list=>list&&list.length?list.map(m=>`<div class="cl-msg"><span class="cl-time">${clClock(m.created_at)}</span><b class="${m.role==='owner'?'ow':m.role==='admin'?'ad':''}">${esc(m.username)}${m.role==='owner'?` ${ico('crown')}`:''}:</b> <span>${esc(m.body)}</span></div>`).join(''):`<div class="mini" style="margin:auto">${t('Noch keine Nachrichten. Sag Hallo!')}</div>`;
function clChatTab(st){
  const c=st.clan,mem=UI.clanMembers||[],today=new Date().toISOString().slice(0,10);
  const joins=mem.filter(m=>String(m.joined_at||'').slice(0,10)===today);
  return `<div class="cl-chat">
    <div class="cl-chatbox">
      <div class="cl-log" id="clLog">${clLogHtml(UI.clanChat)}</div>
      <form class="cl-say" id="clSayF"><input id="clSayI" maxlength="500" placeholder="${st.muted?t('Du bist stummgeschaltet'):t('Nachricht an den Clan')}" autocomplete="off" ${st.muted?'disabled':''}><button class="ibtn" type="submit" aria-label="${t('Senden')}">${ico('send')}</button></form>
    </div>
    <div class="cl-act">
      <div class="lbl">${t('HEUTE')}</div>
      ${joins.length?joins.map(m=>`<div class="cl-ev">${ico('user')}<span class="sp"><b>${esc(m.username)}</b><small>${t('ist beigetreten')}</small></span><span class="mini">${clClock(m.joined_at)}</span></div>`).join(''):`<div class="mini">${t('Heute ist noch niemand beigetreten.')}</div>`}
      <div class="lbl" style="margin-top:14px">${t('CLAN')}</div>
      <div class="cl-ev">${clCrest(c.tag,c.tag_color,'',c.logo)}<span class="sp"><b>${esc(c.name)}</b><small>${c.members}/${c.max_members} ${t('Mitglieder')}</small></span></div>
    </div></div>`;
}

/* ---------- Statistik ---------- */
function clStatsTab(st){
  const s=UI.clanStats||{},c=s.clan||st.clan,week=UI.clanBest==='week';
  const best=(s.best||[]).slice().sort((a,b)=>(week?b.week-a.week:b.wins-a.wins)).slice(0,8);
  return `<div class="cl-shead">
      ${clCrest(c.tag,c.tag_color,'big',c.logo)}
      <div class="cl-sname"><div class="cl-name"><span class="cl-tag" style="--tc:${esc(c.tag_color)}">${esc(c.tag)}</span><b>${esc(c.name)}</b></div>
        <div class="cl-desc">${c.descr?mdInline(c.descr):`<span class="mini">${t('Noch keine Beschreibung.')}</span>`}</div>
        <div class="cl-flags">${clOpenBadge(c.is_open)}<span class="cl-open">${ico('crown')} ${esc((UI.clanMembers||[]).find(m=>m.role==='owner')?.username||'')}</span><span class="cl-open">${ico('calendar')} ${fmtDate(c.created_at)}</span></div></div>
      <button class="btn" id="clCopy" type="button">${ico('link')} ${t('Clan-Link kopieren')}</button></div>
    <div class="cl-tiles">
      <div class="cl-tile"><b>#${s.rank||'—'}</b><span>${t('RANGLISTE')}</span><small>${t('Gesamt')} #${s.rank||'—'}</small></div>
      <div class="cl-tile"><b>${num(c.wins)}</b><span>${t('SIEGE')}</span><small>${t('Gesamt')}</small></div>
      <div class="cl-tile"><b class="gr">+${num(c.week_wins||0)}</b><span>${t('DIESE WOCHE')}</span><small>${t('Siege')}</small></div>
      <div class="cl-tile"><b>${num(c.games)}</b><span>${t('SPIELE')}</span><small>${t('Gesamt')}</small></div>
      <div class="cl-tile"><b>${c.winrate!=null?c.winrate:(c.games?Math.round(100*c.wins/c.games):0)}%</b><span>${t('SIEGQUOTE')}</span><small>${t('Siege pro Spiel')}</small></div>
      <div class="cl-tile"><b>${c.members}/${c.max_members}</b><span>${t('MITGLIEDER')}</span><small>${clMemPct(c.members,c.max_members)}% ${t('voll')}</small></div>
    </div>
    <div class="row" style="margin:16px 0 8px"><span class="lbl">${t('BESTE SPIELER')}</span><span class="sp"></span>
      <div class="pills" id="clBestT"><button type="button" data-b="week" class="${week?'on':''}">${t('Diese Woche')}</button><button type="button" data-b="all" class="${week?'':'on'}">${t('Gesamt')}</button></div></div>
    <div class="cl-table">
      ${best.map((m,i)=>`<div class="cl-mrow"><span class="cl-rk r${i+1}">${i+1}</span><span class="cl-mn" style="flex:1"><b>${esc(m.username)}</b><small>#${esc(m.tag||'')}</small></span><span class="cl-w">${ico('trophy')} ${num(week?m.week:m.wins)}</span></div>`).join('')||`<div class="mini" style="padding:14px">–</div>`}
    </div>`;
}

/* ---------- Suche / Rangliste ---------- */
function clFindTab(st){
  const rows=UI.clanFind,me=st&&st.clan;
  const act=r=>{
    if(r.joined)return `<span class="cl-rb me">${t('Dein Clan')}</span>`;
    if(r.members>=r.max_members)return `<span class="cl-btn off">${ico('users')} ${t('Voll')}</span>`;
    const need=(r.min_wins||0)-(AW.profile?.wins||0);
    if(need>0)return `<span class="cl-btn off">${ico('trophy')} ${need} ${t('Siege nötig')}</span>`;
    if(r.pending)return `<span class="cl-btn off">${ico('clock')} ${t('Anfrage offen')}</span>`;
    return `<button class="cl-btn go" data-cj="${esc(r.id)}" type="button">${ico('send')} ${t('Anfragen')}</button>`;
  };
  return `<div class="cl-findbar">
      <label class="cl-search">${ico('search')}<input id="clQ" class="inp" placeholder="${t('Clan-Name oder Tag')}" value="${esc(UI.clanQ||'')}" maxlength="28" autocomplete="off"></label>
      <div class="pills" id="clFilter">${[['all','Alle'],['open','Offen'],['closed','Auf Anfrage']].map(([k,n])=>`<button type="button" data-f="${k}" class="${(UI.clanFilter||'all')===k?'on':''}">${t(n)}</button>`).join('')}</div>
    </div>
    ${rows===undefined?spinner():`<div class="cl-table">
      <div class="cl-thead f"><span>#</span><span>${t('CLAN')}</span><span>${t('MITGLIEDER')}</span><span>${t('SIEGE')}</span><span></span></div>
      ${rows.map((r,i)=>`<div class="cl-frow${me&&me.id===r.id?' me':''}">
        <span class="cl-rk r${i+1}">${i+1}</span>
        <span class="cl-fn">${clCrest(r.tag,r.tag_color,'',r.logo)}<b>${esc(r.name)}</b>${me&&me.id===r.id?`<span class="cl-rb me">${t('DU')}</span>`:''}${!r.is_open?`<span class="mini">${ico('lock')}</span>`:''}</span>
        <span class="cl-fm">${r.members}/${r.max_members}</span>
        <span class="cl-w">${num(r.wins)}</span>
        <span class="cl-fa">${act(r)}</span></div>`).join('')||`<div class="mini" style="padding:18px;text-align:center">${t('Kein Clan gefunden.')}</div>`}
    </div>`}`;
}

/* ---------- Übersicht ohne Clan ---------- */
function clHomeTab(){
  if(UI.clanCreate)return `<div class="cl-hero form">
      <h3>${t('Clan gründen')}</h3>
      <div class="grid" style="gap:10px;max-width:560px;margin:0 auto">
        <label class="field"><span class="lbl">${t('Clan-Name')}</span><input class="inp" id="clcName" maxlength="28" placeholder="${t('Zum Beispiel Waldkrieger')}"></label>
        <div class="row"><label class="field" style="flex:1"><span class="lbl">${t('Tag (2–5 Zeichen)')}</span><input class="inp" id="clcTag" maxlength="5" placeholder="TAG" style="text-transform:uppercase;font-weight:800;letter-spacing:.12em"></label>
          <label class="field" style="max-width:170px"><span class="lbl">${t('Mindest-Siege')}</span><input class="inp" id="clcMin" type="number" min="0" max="100000" value="0"></label></div>
        <div class="field"><span class="lbl">${t('Tagfarbe')}</span><div class="cl-colors" id="clcColors">${CLAN_COLORS.map((col,i)=>`<button type="button" data-c="${col}" class="${i===0?'on':''}" style="--c:${col}" aria-label="${col}"></button>`).join('')}</div></div>
        <div class="field"><span class="lbl">${t('Clan-Logo')}</span>
          <div class="cl-logo"><span class="cl-crest big" id="clcLogoP">${safeAvatar(UI.clanLogo)?`<img alt="" src="${safeAvatar(UI.clanLogo)}">`:ico('shield')}</span>
            <div class="cl-logof"><div class="row"><label class="btn sm" for="clcLogoF">${ico('edit')} ${t('Bild wählen')}</label><button class="btn sm" id="clcLogoX" type="button">${ico('trash')} ${t('Entfernen')}</button></div>
              <div class="mini">${t('PNG, JPG oder WebP, max. 4 MB – quadratisch zugeschnitten.')}</div></div></div>
          <input type="file" id="clcLogoF" accept="image/png,image/jpeg,image/webp" hidden></div>
        <label class="field"><span class="lbl">${t('Beschreibung – Markdown und Discord-Links erlaubt')}</span><textarea class="inp" id="clcDesc" rows="3" maxlength="600" placeholder="${t('Worum geht es bei euch? Discord: discord.gg/…')}"></textarea></label>
        <label class="sw"><span>${t('Offen für alle')}<br><small class="mini">${t('Aus: Beitritt nur auf Anfrage oder per Einladung')}</small></span><input type="checkbox" id="clcOpen" checked></label>
        <div class="msg">${ico('ruby')} ${t('Gründung kostet')} <b>${CL_COST} Rubys</b> ${t('von deinen')} ${num(AW.profile?.rubys||0)}.</div>
        <div class="row"><button class="btn" id="clcBack" type="button">${t('Abbrechen')}</button><button class="btn pri" id="clcGo" type="button">${ico('shield')} ${t('Clan gründen')}</button></div>
      </div></div>`;
  return `<div class="cl-hero">
      <div class="cl-heroart">${ico('shield')}</div>
      <h3>${t('Gemeinsam stärker')}</h3>
      <p>${t('Tu dich mit anderen Spielern zusammen und klettert gemeinsam in der Clan-Rangliste nach oben.')}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="clcFind" type="button">${ico('search')} ${t('Clan finden')}</button>
        <button class="btn pri" id="clcNew" type="button">${t('Clan gründen')} <b>${CL_COST}</b> ${ico('ruby')}</button></div>
      <div class="mini" style="margin-top:12px">${t('Offene Clans: sofort beitreten. Geschlossene: Anfrage schicken. Der Tag wird bei der Gründung vergeben und kann nicht geändert werden.')}</div>
    </div>
    <div class="cl-tiles" style="margin-top:14px">
      <div class="cl-tile"><b>${(UI.clanFind||[]).length}</b><span>${t('CLANS')}</span><small>${t('in der Rangliste')}</small></div>
      <div class="cl-tile"><b>${num((UI.clanFind||[]).reduce((a,r)=>a+(r.members||0),0))}</b><span>${t('SPIELER')}</span><small>${t('in Clans')}</small></div>
      <div class="cl-tile"><b>${num((UI.clanFind||[])[0]?.wins||0)}</b><span>${t('TOP-SIEGE')}</span><small>${esc((UI.clanFind||[])[0]?.name||'—')}</small></div>
    </div>`;
}

/* ---------- Einladungen ---------- */
function clInvTab(){
  const l=UI.clanInvites||[],sub=UI.clanInvSub||'in',rows=l.filter(i=>sub==='in'?!i.outgoing:i.outgoing);
  const item=i=>`<div class="cl-invrow">${clCrest(i.clan_tag,i.tag_color,'',i.logo)}<span class="sp" style="min-width:0"><b>${esc(i.clan_name)}</b>
      <small>${i.kind==='apply'?`${esc(i.username)}#${esc(i.tag)} ${t('möchte beitreten')}`:`${t('Einladung von')} ${esc(i.clan_name)}`}</small></span>
    <button class="btn sm pri" data-ci="ok:${esc(i.id)}" type="button">${ico('check')}</button>
    <button class="btn sm" data-ci="no:${esc(i.id)}" type="button">${ico('close')}</button></div>`;
  return `<div class="pills" id="clInvT" style="align-self:flex-start;margin-bottom:12px"><button type="button" data-i="in" class="${sub==='in'?'on':''}">${t('Einladungen an mich')}</button><button type="button" data-i="out" class="${sub==='out'?'on':''}">${t('Meine Anfragen')}</button></div>
    ${rows.length?`<div class="grid" style="gap:8px">${rows.map(item).join('')}</div>`:
    `<div class="cl-empty">${ico('mail')}<b>${t('Noch keine Einladungen.')}</b><span>${t('Clan-Besitzer und Admins verschicken sie – oder such dir selbst einen Clan.')}</span>
      <button class="btn pri" id="clEmptyFind" type="button">${ico('search')} ${t('Clan finden')}</button></div>`}`;
}

/* Beim Öffnen des Clan-Screens frisch laden (Rangliste, Mitglieder, Chat) */
(function(){const os=openScreen;openScreen=function(name,arg,push){
  if(name==='clan'){UI.clan=undefined;UI.clanMembers=undefined;UI.clanChat=undefined;UI.clanStats=undefined;UI.clanFind=undefined;UI.clanInvites=undefined;UI.clanMenu=null;UI.clanEdit=false;UI.clanLogo=undefined}
  return os(name,arg,push)}})();

/* ---------- Screen ---------- */
UI.clanTab=null;UI.clanQ='';UI.clanFilter='all';UI.clanInvSub='in';UI.clanBest='week';
S.clan=()=>{
  if(needLogin())return shell(t('Clans'),{},`<div class="msg">${t('Melde dich an, um Clans zu nutzen')}</div>`);
  if(UI.clan===undefined)return shell(t('Clans'),{},spinner());
  const st=UI.clan,mine=!!st;
  const tabs=mine?[['members','Mitglieder','users'],['chat','Chat','chat'],['stats','Statistik','board'],['find','Suchen','search']]
                 :[['home','Übersicht','shield'],['find','Suchen','search'],['invites','Einladungen','mail']];
  if(!tabs.some(x=>x[0]===UI.clanTab))UI.clanTab=tabs[0][0];
  const body=UI.clanTab==='members'?clMembersTab(st):UI.clanTab==='chat'?clChatTab(st):UI.clanTab==='stats'?clStatsTab(st)
    :UI.clanTab==='find'?clFindTab(st):UI.clanTab==='invites'?clInvTab():clHomeTab();
  const badge=(UI.clanInvites||[]).filter(i=>!i.outgoing).length;
  return shell(mine?t('Clan'):t('Clans'),{right:`<div class="pills cl-tabs" id="clTabs">${tabs.map(([k,n,i])=>`<button type="button" data-ct="${k}" class="${UI.clanTab===k?'on':''}">${ico(i)} ${t(n)}${k==='invites'&&badge?` <b class="cl-badge">${badge}</b>`:''}</button>`).join('')}</div>`},
    `<div class="cl-body">${body}</div>`);
};
S.clan.bind=async p=>{
  if(needLogin())return;
  p.querySelectorAll('#clTabs [data-ct]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.ct;
    if(k==='find')UI.clanFind=undefined;else if(k==='invites')UI.clanInvites=undefined;
    else if(k==='chat')UI.clanChat=undefined;else if(k==='stats')UI.clanStats=undefined;else if(k==='members')UI.clanMembers=undefined;
    UI.clanTab=k;UI.clanMenu=null;UI.clanEdit=false;render()});
  if(UI.clan===undefined){await clLoad();if(SCR.cur&&SCR.cur.name==='clan')render();return}
  const st=UI.clan,mine=!!st,adm=mine&&(st.role==='owner'||st.role==='admin');

  /* gemeinsame Aktionen */
  p.querySelectorAll('[data-cj]').forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{const r=(UI.clanFind||[]).find(x=>String(x.id)===b.dataset.cj);if(r&&r.is_open)await AW.clanJoin(r.id);else await AW.clanApply(b.dataset.cj);
      toast(t('Anfrage gesendet'),'good');clReset();await clLoad(true);render()}catch(e){b.disabled=false;toastErr(e)}});
  p.querySelectorAll('#clFilter [data-f]').forEach(b=>b.onclick=()=>{UI.clanFilter=b.dataset.f;UI.clanFind=undefined;render()});
  const q=p.querySelector('#clQ');if(q)q.oninput=()=>{clearTimeout(UI._clQ);UI._clQ=setTimeout(async()=>{UI.clanQ=q.value.trim();UI.clanFind=await AW.clanFind(UI.clanQ,UI.clanFilter||'all').catch(()=>[]);if(SCR.cur&&SCR.cur.name==='clan')render()},260)};
  p.querySelectorAll('#clInvT [data-i]').forEach(b=>b.onclick=()=>{UI.clanInvSub=b.dataset.i;render()});
  p.querySelectorAll('[data-ci]').forEach(b=>b.onclick=async()=>{const[k,id]=b.dataset.ci.split(':');
    try{await AW.clanRespond(id,k==='ok');clReset();await clLoad(true);render();toast('✓','good')}catch(e){toastErr(e)}});
  const ef=p.querySelector('#clEmptyFind');if(ef)ef.onclick=()=>{UI.clanTab='find';render()};

  /* Logo wählen (nur Bilder, max. 4 MB, quadratisch zugeschnitten) */
  const bindLogo=(inId,prevId,rmId)=>{
    const inp=p.querySelector('#'+inId);if(inp)inp.onchange=async()=>{try{const d=await cropAvatar(inp.files[0],128,4);inp.value='';if(!d)return;UI.clanLogo=d;const pv=p.querySelector('#'+prevId);if(pv)pv.innerHTML=`<img alt="" src="${safeAvatar(d)}">`;toast(t('Gespeichert'),'good')}catch(e){inp.value='';toastErr(e)}};
    const rm=p.querySelector('#'+rmId);if(rm)rm.onclick=()=>{UI.clanLogo=null;const pv=p.querySelector('#'+prevId);if(pv)pv.innerHTML=ico('shield')};
  };
  bindLogo('clcLogoF','clcLogoP','clcLogoX');bindLogo('cleLogoF','cleLogoP','cleLogoX');

  /* ohne Clan: Gründung */
  const nw=p.querySelector('#clcNew');if(nw)nw.onclick=()=>{UI.clanCreate=true;UI.clanLogo=null;render()};
  const fd=p.querySelector('#clcFind');if(fd)fd.onclick=()=>{UI.clanTab='find';render()};
  const bk=p.querySelector('#clcBack');if(bk)bk.onclick=()=>{UI.clanCreate=false;render()};
  p.querySelectorAll('#clcColors [data-c]').forEach(b=>b.onclick=()=>{p.querySelectorAll('#clcColors [data-c]').forEach(x=>x.classList.toggle('on',x===b));UI.clanColor=b.dataset.c});
  const go=p.querySelector('#clcGo');if(go)go.onclick=async()=>{
    const name=p.querySelector('#clcName').value.trim(),tag=p.querySelector('#clcTag').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(name.length<3){toast(t('Name zu kurz (3–28 Zeichen)'),'bad');return}
    if(tag.length<2){toast(t('Tag zu kurz (2–5 Zeichen)'),'bad');return}
    go.disabled=true;
    try{await AW.clanCreate({name,tag,color:UI.clanColor||CLAN_COLORS[0],descr:p.querySelector('#clcDesc').value.trim(),open:p.querySelector('#clcOpen').checked,minWins:+p.querySelector('#clcMin').value||0,logo:UI.clanLogo||null});
      UI.clanCreate=false;UI.clanLogo=null;UI.clanTab='members';clReset();await clLoad(true);render();toast(t('Clan gegründet'),'good')}
    catch(e){go.disabled=false;toastErr(e)}};

  if(!mine)return;

  /* mit Clan: Mitglieder */
  const ed=p.querySelector('#clEdit');if(ed)ed.onclick=()=>{if(!UI.clanEdit)UI.clanLogo=st.clan.logo||null;UI.clanEdit=!UI.clanEdit;render()};
  const ex=p.querySelector('#clEditX');if(ex)ex.onclick=()=>{UI.clanEdit=false;render()};
  p.querySelectorAll('#cleColors [data-c]').forEach(b=>b.onclick=()=>{p.querySelectorAll('#cleColors [data-c]').forEach(x=>x.classList.toggle('on',x===b));UI.clanColor=b.dataset.c});
  const sv=p.querySelector('#cleSave');if(sv)sv.onclick=async()=>{
    try{await AW.clanUpdate({name:p.querySelector('#cleName').value.trim(),descr:p.querySelector('#cleDesc').value.trim(),color:UI.clanColor||st.clan.tag_color,open:p.querySelector('#cleOpen').checked,minWins:+p.querySelector('#cleMin').value||0,logo:UI.clanLogo!==undefined?UI.clanLogo:(st.clan.logo||null)});
      UI.clanEdit=false;UI.clanLogo=undefined;clReset();await clLoad(true);render();toast('✓','good')}catch(e){toastErr(e)}};
  const lv=p.querySelector('#clLeave');if(lv)lv.onclick=async()=>{
    if(!confirm(st.role==='owner'?t('Clan verlassen? Als Besitzer geht der Clan an das nächste Mitglied.'):t('Clan wirklich verlassen?')))return;
    try{await AW.clanLeave();UI.clanTab=null;clReset();await clLoad(true);render();toast(t('Clan verlassen'),'good')}catch(e){toastErr(e)}};
  p.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>{UI.clanMenu=UI.clanMenu===b.dataset.cm?null:b.dataset.cm;render()});
  p.querySelectorAll('[data-ca]').forEach(b=>b.onclick=async()=>{
    const[act,uid]=b.dataset.ca.split(':');
    try{
      if(act==='mute'){const m=(UI.clanMembers||[]).find(x=>String(x.user_id)===uid);await AW.clanAct(uid,m&&m.muted?'unmute':'mute')}
      else if(act==='role'){const m=(UI.clanMembers||[]).find(x=>String(x.user_id)===uid);await AW.clanAct(uid,m&&m.role==='admin'?'member':'admin')}
      else if(act==='owner'){if(!confirm(t('Clan wirklich übergeben?')))return;await AW.clanAct(uid,'owner')}
      else if(act==='kick'){if(!confirm(t('Mitglied wirklich entfernen?')))return;await AW.clanAct(uid,'kick')}
      UI.clanMenu=null;clReset();await clLoad(true);render();toast('✓','good')
    }catch(e){toastErr(e)}});
  const ig=p.querySelector('#clInvGo');if(ig)ig.onclick=async()=>{
    const v=p.querySelector('#clInvN').value.trim(),m=/^(.+)#(\d{4})$/.exec(v);
    if(!m){toast(t('Format: Name#1234'),'bad');return}
    try{await AW.clanInvite(m[1].trim(),m[2]);p.querySelector('#clInvN').value='';toast(t('Einladung gesendet'),'good')}catch(e){toastErr(e)}};

  /* Chat */
  const sf=p.querySelector('#clSayF');if(sf)sf.onsubmit=async e=>{e.preventDefault();const i=p.querySelector('#clSayI'),b=i.value.trim();if(!b)return;
    i.value='';try{await AW.clanSay(b);UI.clanChat=await AW.clanChat();const log=p.querySelector('#clLog');if(log){log.innerHTML=clLogHtml(UI.clanChat);log.scrollTop=1e9}}catch(x){toastErr(x)}};
  const log=p.querySelector('#clLog');if(log)log.scrollTop=1e9;
  if(UI.clanTab==='chat'){
    const tick=async()=>{
      if(!document.body.contains(p)||!SCR.cur||SCR.cur.name!=='clan'||UI.clanTab!=='chat'){clearInterval(iv);return}
      try{const l=await AW.clanChat();UI.clanChat=l;const el=p.querySelector('#clLog');if(el&&l.length){el.innerHTML=clLogHtml(l);el.scrollTop=1e9}}catch(e){}
    };
    const iv=setInterval(tick,6000);
  }

  /* Statistik */
  p.querySelectorAll('#clBestT [data-b]').forEach(b=>b.onclick=()=>{UI.clanBest=b.dataset.b;render()});
  const cp=p.querySelector('#clCopy');if(cp)cp.onclick=()=>{try{navigator.clipboard.writeText(location.origin+location.pathname+'?clan='+st.clan.id).then(()=>toast(t('Kopiert'),'good'))}catch(e){}};

  /* Daten nachladen, wenn noch nicht da */
  if(UI.clanMembers===undefined||UI.clanFind===undefined||(mine&&UI.clanStats===undefined)){
    await clLoad();
    if(SCR.cur&&SCR.cur.name==='clan')render();
  }
};
