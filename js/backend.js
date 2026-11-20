/* ===== Backend-Schicht =====
   Remote: Supabase (Auth, Postgres mit RLS, Realtime) – ausschließlich über das offizielle SDK.
   Lokal (Fallback, wenn keine config.js mit URL/Key vorhanden ist): Gastmodus mit localStorage, damit das Spiel offline spielbar bleibt.
   Passwörter werden nirgends von uns verarbeitet oder gespeichert – das macht ausschließlich Supabase Auth. */
const CFG=window.AW_CONFIG||{};
const REMOTE=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY);

/* ---- Katalog (Anzeige; maßgeblich sind die Preise in der DB-Tabelle shop_items bzw. im lokalen Fallback) ---- */
const HATS=[['cap','Kappe',1],['flower','Blume',1],['party','Partyhut',1],['helmet','Helm',2],['top','Zylinder',2],['pirate','Piratenhut',2],['wizard','Zaubererhut',3],['crown','Krone',3],['halo','Heiligenschein',4]];
const WORLD_FLAGS=['de','gb','us','fr','es','it','nl','pl','pt','br','ar','mx','ca','au','jp','kr','cn','in','tr','ru','ua','se','no','dk','fi','at','ch','ie','be','gr','cz','hu','ro','bg','rs','sk','si','il','sa','eg','za','bd','mk'];
const FLAG_NAMES={de:'Deutschland',gb:'Vereinigtes Königreich',us:'USA',fr:'Frankreich',es:'Spanien',it:'Italien',nl:'Niederlande',pl:'Polen',pt:'Portugal',br:'Brasilien',ar:'Argentinien',mx:'Mexiko',ca:'Kanada',au:'Australien',jp:'Japan',kr:'Südkorea',cn:'China',in:'Indien',tr:'Türkei',ru:'Russland',ua:'Ukraine',se:'Schweden',no:'Norwegen',dk:'Dänemark',fi:'Finnland',at:'Österreich',ch:'Schweiz',ie:'Irland',be:'Belgien',gr:'Griechenland',cz:'Tschechien',hu:'Ungarn',ro:'Rumänien',bg:'Bulgarien',rs:'Serbien',sk:'Slowakei',si:'Slowenien',il:'Israel',sa:'Saudi-Arabien',eg:'Ägypten',za:'Südafrika',bd:'Bangladesch',mk:'Nordmazedonien'};
const ANT_FLAGS=[['a_red','Rote Kolonie',2],['a_green','Blattschneider',2],['a_gold','Goldstern',2],['a_stripe','Streifen',2],['a_mound','Hügelwacht',3],['a_fungus','Pilzgarten',3],['a_swords','Kriegsbanner',3],['a_queen','Königin',3]];
const SHOP=[
  ...HATS.map(([id,n,p])=>({id:'hat:'+id,kind:'hat',key:id,name:n,price:p})),
  ...WORLD_FLAGS.map(id=>({id:'flag:'+id,kind:'flag',key:id,name:FLAG_NAMES[id],price:['de','gb','us','fr','es','it','nl','pl'].includes(id)?1:2})),
  ...ANT_FLAGS.map(([id,n,p])=>({id:'flag:'+id,kind:'flag',key:id,name:n,price:p,custom:true}))
];
const SHOP_BY_ID=Object.fromEntries(SHOP.map(i=>[i.id,i]));
/* Quests: [id, Art, Statistik, Ziel, Belohnung (Rubys), Titel] */
const QUESTS=[
  ['d_games','daily','games',1,1,'Starte ein Spiel'],
  ['d_terr','daily','terr',3,1,'Besitze 3 Gebiete gleichzeitig'],
  ['d_found','daily','found',1,1,'Grabe einen Fund aus'],
  ['w_games','weekly','games',5,2,'Spiele 5 Partien'],
  ['w_wins','weekly','wins',1,3,'Gewinne eine Partie'],
  ['w_terr','weekly','terr',8,2,'Besitze 8 Gebiete gleichzeitig'],
  ['c_games','career','games',10,2,'Spiele 10 Partien'],
  ['c_wins','career','wins',5,5,'Gewinne 5 Partien'],
  ['c_terr','career','terr',12,3,'Besitze 12 Gebiete gleichzeitig'],
  ['c_found','career','found',25,3,'Grabe 25 Funde aus'],
  ['c_allied','career','allied',1,1,'Schließe ein Bündnis'],
  ['c_score','career','score',300,3,'Erreiche 300 Punkte']
];
const MAX_STATS=['terr','score'];
const dayKey=()=>new Date().toISOString().slice(0,10);
const weekKey=()=>{const d=new Date(Date.UTC(...(()=>{const n=new Date();return[n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()]})()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=d.getUTCFullYear();return y+'-W'+Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7)};
const periodKey=k=>k==='daily'?dayKey():k==='weekly'?weekKey():'c';

const AW={remote:REMOTE,sb:null,user:null,profile:null,ready:false,subs:[],
  on(f){this.subs.push(f)},emit(){this.subs.forEach(f=>{try{f()}catch(e){console.error(e)}})},
  get loggedIn(){return !!this.user},
  get isAdmin(){return !!(this.profile&&this.profile.is_admin)},
  get name(){return(this.profile&&this.profile.username)||lsGet('ak_name','Gast')},
  get tag(){return(this.profile&&this.profile.tag)||'0000'},
  get fullName(){return this.name+'#'+this.tag},
  get isAnon(){return !!(this.user&&(this.user.is_anonymous||this.user.local))}
};
/* Kennung dieser Browser-Sitzung (Mehrspieler: identifiziert Absender auch bei lokalen Konten) */
const PID=Math.random().toString(36).slice(2,8);
const noServer=()=>new Error(REMOTE?'Server nicht erreichbar – du spielst im Gastmodus':'Kein Server konfiguriert – du spielst im Gastmodus');
const GENERIC_AUTH_ERR='Ungültige Zugangsdaten';
/* Namen: kein '#', keine Mehrfach-Leerzeichen, 2–20 Zeichen. Tag: vier Ziffern, Discord-Stil (Name#1234). */
const cleanName=n=>String(n==null?'':n).replace(/[#\s]+/g,' ').trim().slice(0,20);
const randTag=()=>String(1+Math.floor(Math.random()*9999)).padStart(4,'0');
/* 'Name#1234' → {name,tag} oder null */
const parseNameTag=s=>{const m=/^(.+)#(\d{4})$/.exec(String(s||'').trim());if(!m)return null;const name=cleanName(m[1]);return name.length>=2?{name,tag:m[2]}:null};
/* Zeilen von my_friends() → {list,incoming,outgoing}; jeweils {id,name,tag} */
const groupFriends=rows=>{const r={list:[],incoming:[],outgoing:[]};for(const x of rows){const e={id:x.id,other:x.other_id,name:x.username,tag:x.tag};(x.status==='accepted'?r.list:x.incoming?r.incoming:r.outgoing).push(e)}return r};
const isDefaultName=n=>!n||/^(gast|spieler)$/i.test(String(n).trim());

/* ===== REMOTE (Supabase) ===== */
function loadSupabaseSDK(){
  return new Promise((res,rej)=>{
    if(window.supabase)return res();
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
    s.onload=res;s.onerror=()=>rej(new Error('sdk'));document.head.appendChild(s);
  });
}
const Remote={
  async init(){
    await loadSupabaseSDK();
    AW.sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const{data}=await AW.sb.auth.getSession();AW.user=data.session?data.session.user:null;
    /* Kein Anmeldezwang: ohne Session legt Supabase ein anonymes Konto an, das auf diesem Gerät bleibt. */
    /* Schlägt das fehl (z. B. „Allow anonymous sign-ins“ ist im Dashboard aus), bleibt der Server aktiv: Registrieren/Anmelden geht trotzdem. */
    if(!AW.user){try{await Remote.anon()}catch(e){Remote.anonFailed=true;console.warn('Anonyme Anmeldung nicht möglich (Supabase → Authentication → Sign In / Providers → Allow anonymous sign-ins):',e.message)}}
    if(AW.user)await Remote.loadProfile();
    AW.sb.auth.onAuthStateChange(async(_e,s)=>{AW.user=s?s.user:null;AW.profile=null;if(AW.user)await Remote.loadProfile();AW.emit()});
  },
  async anon(){const{data,error}=await AW.sb.auth.signInAnonymously();if(error)throw new Error('anon');AW.user=data.user},
  async secure(email,pw){const{error}=await AW.sb.auth.updateUser({email,password:pw},{emailRedirectTo:location.origin+location.pathname});if(error)throw new Error(/password/i.test(error.message)?'Passwort zu schwach (mind. 8 Zeichen)':'Konto konnte nicht gesichert werden')},
  async loadProfile(){
    const{data,error}=await AW.sb.from('profiles').select('*').eq('id',AW.user.id).maybeSingle();
    if(!error)AW.profile=data;return AW.profile;
  },
  async signIn(email,pw){const{error}=await AW.sb.auth.signInWithPassword({email,password:pw});if(error)throw new Error(GENERIC_AUTH_ERR)},
  async signUp(email,pw,name){
    const{error}=await AW.sb.auth.signUp({email,password:pw,options:{data:{username:name},emailRedirectTo:location.origin+location.pathname}});
    if(error&&/password/i.test(error.message))throw new Error('Passwort zu schwach (mind. 8 Zeichen)');
    /* Kein Hinweis, ob die E-Mail schon existiert → immer dieselbe Rückmeldung */
  },
  async oauth(provider){const o={provider,options:{redirectTo:location.origin+location.pathname}};const{error}=(AW.user&&AW.user.is_anonymous&&AW.sb.auth.linkIdentity)?await AW.sb.auth.linkIdentity(o):await AW.sb.auth.signInWithOAuth(o);if(error)throw new Error('Anmeldung fehlgeschlagen')},
  async signOut(){await AW.sb.auth.signOut();try{await Remote.anon()}catch(e){AW.user=null}},
  async reset(email){await AW.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname})},
  async setPhone(phone){const{error}=await AW.sb.auth.updateUser({phone});if(error)throw new Error('Nummer konnte nicht gespeichert werden')},
  async verifyPhone(phone,token){const{error}=await AW.sb.auth.verifyOtp({phone,token,type:'phone_change'});if(error)throw new Error('Code ungültig');await Remote.loadProfile()},
  async update(p){
    p={...p};
    if('username' in p){const nm=cleanName(p.username);if(nm.length<2)throw new Error('Name zu kurz');delete p.username;const{error}=await AW.sb.rpc('set_username',{n:nm});if(error)throw new Error('Name konnte nicht gespeichert werden')}
    if(Object.keys(p).length){const{error}=await AW.sb.from('profiles').update(p).eq('id',AW.user.id);if(error)throw new Error('Speichern nicht möglich')}
    await Remote.loadProfile()},
  async buy(id){const{error}=await AW.sb.rpc('buy_item',{item:id});if(error)throw new Error(error.message);await Remote.loadProfile()},
  async claim(id){const{error}=await AW.sb.rpc('claim_quest',{qid:id});if(error)throw new Error(error.message);await Remote.loadProfile()},
  async report(p){const{error}=await AW.sb.rpc('report_stats',{p});if(error)console.warn('report_stats fehlgeschlagen (schema.sql ausgeführt?):',error.message);else await Remote.loadProfile()},
  async players(){const{data}=await AW.sb.from('leaderboard_players').select('*').order('wins',{ascending:false}).limit(100);return data||[]},
  async clans(){const{data}=await AW.sb.from('leaderboard_clans').select('*').order('wins',{ascending:false}).limit(100);return data||[]},
  async news(){const{data}=await AW.sb.from('news').select('*').order('created_at',{ascending:false}).limit(30);return data||[]},
  async newsSave(n){const r=n.id?await AW.sb.from('news').update({version:n.version,title:n.title,body:n.body}).eq('id',n.id):await AW.sb.from('news').insert({version:n.version,title:n.title,body:n.body});if(r.error)throw new Error('Keine Berechtigung')},
  async newsDel(id){const{error}=await AW.sb.from('news').delete().eq('id',id);if(error)throw new Error('Keine Berechtigung')},
  async adminProfiles(q){let r=AW.sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(50);if(q)r=r.ilike('username','%'+q.replace(/[%_]/g,'')+'%');const{data}=await r;return data||[]},
  async adminUpdate(id,p){const{error}=await AW.sb.from('profiles').update(p).eq('id',id);if(error)throw new Error('Keine Berechtigung')},
  async friends(){const{data,error}=await AW.sb.rpc('my_friends');if(error){console.warn('my_friends:',error.message);throw new Error(/function|schema cache/i.test(error.message)?'Server noch nicht aktualisiert: supabase/schema.sql im SQL-Editor ausführen':'Freunde konnten nicht geladen werden')}return groupFriends(data||[])},
  async friendRequest(nt){const m=parseNameTag(nt);if(!m)throw new Error('Format: Name#1234');const{error}=await AW.sb.rpc('friend_request',{n:m.name,tg:m.tag});if(error){console.warn('friend_request:',error.message);throw new Error(/function|schema cache/i.test(error.message)?'Server noch nicht aktualisiert: supabase/schema.sql im SQL-Editor ausführen':'Anfrage nicht möglich')}},
  async friendRespond(id,acc){const{error}=await AW.sb.rpc('friend_respond',{fid:id,acc:!!acc});if(error)throw new Error('Nicht möglich')},
  async friendRemove(id){const{error}=await AW.sb.rpc('friend_remove',{fid:id});if(error)throw new Error('Nicht möglich')},
  async lobbies(){const{data}=await AW.sb.from('lobbies').select('*').eq('is_public',true).eq('status','open').order('created_at',{ascending:false}).limit(30);return data||[]},
  async lobbyCreate(l){const{data,error}=await AW.sb.from('lobbies').insert({...l,host:AW.user.id,host_name:AW.name}).select().single();if(error){console.warn('lobby insert:',error.message);throw new Error(/relation|schema cache|column/i.test(error.message)?'Server noch nicht aktualisiert: supabase/schema.sql im SQL-Editor ausführen':'Lobby konnte nicht erstellt werden')}return data},
  async lobbyFind(code){const{data,error}=await AW.sb.rpc('find_lobby',{c:String(code).trim().toLowerCase()});if(error){console.warn('find_lobby:',error.message);throw new Error(/function|schema cache|relation/i.test(error.message)?'Server noch nicht aktualisiert: supabase/schema.sql im SQL-Editor ausführen':'Lobby konnte nicht gesucht werden')}return data&&data[0]||null},
  async lobbyUpdate(code,p){await AW.sb.from('lobbies').update(p).eq('code',code)},
  async lobbyClose(code){await AW.sb.from('lobbies').delete().eq('code',code)},
  channel(code,h){
    const ch=AW.sb.channel('lobby:'+code,{config:{presence:{key:AW.user.id},broadcast:{self:true}}});
    ch.on('presence',{event:'sync'},()=>h.presence(Object.values(ch.presenceState()).map(a=>a[0])))
      .on('broadcast',{event:'m'},e=>h.msg(e.payload));
    ch.subscribe(st=>{if(st==='SUBSCRIBED')ch.track({id:AW.user.id,pid:PID,name:AW.name,clan:(AW.profile&&AW.profile.clan_tag)||''})});
    return{send:m=>ch.send({type:'broadcast',event:'m',payload:m}),leave:()=>AW.sb.removeChannel(ch)};
  }
};

/* ===== LOKAL (Gastmodus, spiegelt die Server-Logik) ===== */
const LP='aw_local_';
const Local={
  async init(){
    let p=lsGet(LP+'profile',null);
    if(!p){p={id:'local',username:lsGet('ak_name','Gast'),tag:randTag(),clan_tag:'',rubys:0,wins:0,games:0,hat:null,flag:null,owned:[],quests:{},stats:{},is_admin:false,created_at:new Date().toISOString()};lsSet(LP+'profile',p)}
    if(!p.tag){p.tag=randTag();lsSet(LP+'profile',p)}
    AW.user={id:'local',email:null,phone:null,local:true};AW.profile=p;
  },
  save(){lsSet(LP+'profile',AW.profile);AW.emit()},
  async signIn(){throw noServer()},
  async signUp(){throw noServer()},
  async secure(){throw noServer()},
  async oauth(){throw noServer()},
  async signOut(){},async reset(){},async setPhone(){throw new Error('Nur mit Server-Konto möglich')},async verifyPhone(){},
  async update(p){const a=AW.profile;if('username' in p){const nm=cleanName(p.username);if(nm.length<2)throw new Error('Name zu kurz');if(nm.toLowerCase()!==String(a.username).toLowerCase())a.tag=randTag();a.username=nm}if('clan_tag' in p)a.clan_tag=String(p.clan_tag||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
    if('hat' in p){if(p.hat&&!a.owned.includes('hat:'+p.hat))throw new Error('Nicht freigeschaltet');a.hat=p.hat}
    if('flag' in p){if(p.flag&&!a.owned.includes('flag:'+p.flag))throw new Error('Nicht freigeschaltet');a.flag=p.flag}
    lsSet('ak_name',a.username);Local.save()},
  async buy(id){const it=SHOP_BY_ID[id],a=AW.profile;if(!it)throw new Error('Unbekannt');if(a.owned.includes(id))throw new Error('Schon gekauft');if(a.rubys<it.price)throw new Error('Nicht genug Rubys');a.rubys-=it.price;a.owned.push(id);Local.save()},
  bucket(kind){const a=AW.profile;a.stats=a.stats||{};const k=periodKey(kind);const b=a.stats[kind]=(a.stats[kind]&&a.stats[kind].k===k)?a.stats[kind]:{k,v:{}};return b},
  async claim(id){const q=QUESTS.find(x=>x[0]===id),a=AW.profile;if(!q)throw new Error('Unbekannt');const b=Local.bucket(q[1]);
    if((a.quests[id])===b.k)throw new Error('Schon abgeholt');if((b.v[q[2]]||0)<q[3])throw new Error('Noch nicht geschafft');a.quests[id]=b.k;a.rubys+=q[4];Local.save()},
  async report(p){const a=AW.profile;for(const kind of['daily','weekly','career']){const b=Local.bucket(kind);for(const k in p){const v=Math.max(0,Math.min(500,+p[k]||0));b.v[k]=MAX_STATS.includes(k)?Math.max(b.v[k]||0,v):(b.v[k]||0)+Math.min(v,50)}}
    a.games+=Math.min(1,+p.games||0);a.wins+=Math.min(1,+p.wins||0);Local.save()},
  async players(){const a=AW.profile;return[{username:a.username,tag:a.tag,clan_tag:a.clan_tag,wins:a.wins,games:a.games}].concat(lsGet(LP+'fake',[]))},
  async clans(){const a=AW.profile;return a.clan_tag?[{clan_tag:a.clan_tag,wins:a.wins,games:a.games,members:1}]:[]},
  async news(){return lsGet(LP+'news',null)||DEFAULT_NEWS},
  async newsSave(n){const l=await Local.news();const c=l.map(x=>({...x}));if(n.id){const i=c.findIndex(x=>x.id===n.id);if(i>=0)c[i]={...c[i],...n}}else c.unshift({...n,id:'n'+Date.now(),created_at:new Date().toISOString()});lsSet(LP+'news',c)},
  async newsDel(id){lsSet(LP+'news',(await Local.news()).filter(x=>x.id!==id))},
  async adminProfiles(){return[AW.profile]},async adminUpdate(id,p){Object.assign(AW.profile,p);Local.save()},
  async friends(){return{list:[],incoming:[],outgoing:[]}},
  async friendRequest(){throw new Error('Freunde brauchen einen Server – im Gastmodus nicht möglich')},
  async friendRespond(){throw new Error('Freunde brauchen einen Server – im Gastmodus nicht möglich')},
  async friendRemove(){throw new Error('Freunde brauchen einen Server – im Gastmodus nicht möglich')},
  async lobbies(){const t=Date.now();const l=lsGet(LP+'lobbies',[]).filter(x=>t-x.ts<20000&&x.is_public&&x.status==='open');return l},
  async lobbyCreate(l){const code=Math.random().toString(36).slice(2,9);const row={...l,code,host:'local',host_name:AW.name,status:'open',ts:Date.now(),created_at:new Date().toISOString()};const all=lsGet(LP+'lobbies',[]);all.push(row);lsSet(LP+'lobbies',all);row._hb=setInterval(()=>{const a=lsGet(LP+'lobbies',[]);const r=a.find(x=>x.code===code);if(r){r.ts=Date.now();lsSet(LP+'lobbies',a)}else clearInterval(row._hb)},5000);Local._hb=row._hb;return row},
  async lobbyFind(code){return lsGet(LP+'lobbies',[]).find(x=>x.code===code)||null},
  async lobbyUpdate(code,p){const a=lsGet(LP+'lobbies',[]);const r=a.find(x=>x.code===code);if(r){Object.assign(r,p);lsSet(LP+'lobbies',a)}},
  async lobbyClose(code){clearInterval(Local._hb);lsSet(LP+'lobbies',lsGet(LP+'lobbies',[]).filter(x=>x.code!==code))},
  channel(code,h){
    const bc=new BroadcastChannel('aw-lobby-'+code),me={id:AW.user.id+'-'+Math.random().toString(36).slice(2,6),pid:PID,name:AW.name,clan:AW.profile.clan_tag||''};
    const peers=new Map([[me.id,{...me,t:Date.now()}]]);
    const flush=()=>{const t=Date.now();for(const[k,v]of peers)if(t-v.t>6000)peers.delete(k);h.presence([...peers.values()])};
    const ann=()=>bc.postMessage({k:'p',p:me});
    bc.onmessage=e=>{const d=e.data;if(d.k==='p'){const isNew=!peers.has(d.p.id);peers.set(d.p.id,{...d.p,t:Date.now()});if(isNew)ann();flush()}else if(d.k==='m')h.msg(d.m)};
    ann();const iv=setInterval(()=>{peers.get(me.id).t=Date.now();ann();flush()},2000);setTimeout(flush,50);
    return{send:m=>{bc.postMessage({k:'m',m});setTimeout(()=>h.msg(m),0)},leave:()=>{clearInterval(iv);bc.close()}};
  }
};
const DEFAULT_NEWS=[
  {id:'d1',version:'v11',title:'Neues Design, Konten und Shop',body:'Komplett neues Glas-Interface, Anmeldung mit E-Mail, Google oder Discord, Rubys durch Quests, Hüte und Flaggen im Shop, Clans über freie Tags und Ranglisten.',created_at:'2026-11-17T09:00:00Z'},
  {id:'d2',version:'v10',title:'Schutzzeit am Start',body:'Zu Beginn kann niemand angreifen: Leicht 2:30, Normal 1:30, Schwer 1:00 Minuten.',created_at:'2026-11-10T09:00:00Z'},
  {id:'d3',version:'v9',title:'Powerups in der Kolonie',body:'Zufällig vergrabene Funde liegen im Boden. Grabe Tunnel dorthin, dann werden sie geborgen.',created_at:'2026-11-03T09:00:00Z'}
];

let API=REMOTE?Remote:Local;
Object.assign(AW,{
  signIn:(...a)=>API.signIn(...a),signUp:(...a)=>API.signUp(...a),secure:(...a)=>API.secure(...a),oauth:(...a)=>API.oauth(...a),signOut:async()=>{await API.signOut();AW.emit()},
  reset:(...a)=>API.reset(...a),setPhone:(...a)=>API.setPhone(...a),verifyPhone:(...a)=>API.verifyPhone(...a),
  update:async p=>{await API.update(p);AW.emit()},buy:async id=>{await API.buy(id);AW.emit()},claim:async id=>{await API.claim(id);AW.emit()},report:p=>API.report(p).then(()=>AW.emit()),
  players:()=>API.players(),clans:()=>API.clans(),news:()=>API.news(),newsSave:n=>API.newsSave(n),newsDel:id=>API.newsDel(id),
  adminProfiles:q=>API.adminProfiles(q),adminUpdate:(i,p)=>API.adminUpdate(i,p),
  friends:()=>API.friends(),friendRequest:n=>API.friendRequest(n),friendRespond:(i,a)=>API.friendRespond(i,a),friendRemove:i=>API.friendRemove(i),
  lobbies:()=>API.lobbies(),lobbyCreate:l=>API.lobbyCreate(l),lobbyFind:c=>API.lobbyFind(c),lobbyUpdate:(c,p)=>API.lobbyUpdate(c,p),lobbyClose:c=>API.lobbyClose(c),channel:(c,h)=>API.channel(c,h)
});
AW.init=async()=>{try{await API.init()}catch(e){console.warn('Backend nicht erreichbar, Gastmodus',e);AW.remote=false;API=Local;await Local.init();}AW.ready=true;AW.emit()};
