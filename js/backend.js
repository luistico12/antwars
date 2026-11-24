/* ===== Backend-Schicht =====
   Remote: Supabase (Auth, Postgres mit RLS, Realtime) – ausschließlich über das offizielle SDK.
   Lokal (Fallback, wenn keine config.js mit URL/Key vorhanden ist): Gastmodus mit localStorage, damit das Spiel offline spielbar bleibt.
   Passwörter werden nirgends von uns verarbeitet oder gespeichert – das macht ausschließlich Supabase Auth. */
const CFG=window.AW_CONFIG||{};
const REMOTE=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY);

/* ---- Katalog (Anzeige; maßgeblich sind die Preise in der DB-Tabelle shop_items bzw. im lokalen Fallback) ---- */
const HATS=[['cap','Kappe',2],['beanie','Wollmütze',2],['flower','Blume',2],['party','Partyhut',2],['helmet','Helm',3],['top','Zylinder',3],['pirate','Piratenhut',3],['mushroom','Pilzhut',3],['wizard','Zaubererhut',4],['cowboy','Cowboyhut',4],['chef','Kochmütze',4],['miner','Grubenhelm',4],['viking','Wikingerhelm',5],['headphones','Kopfhörer',5],['crown','Krone',5],['halo','Heiligenschein',6],['santa','Weihnachtsmütze',6],['astro','Astronautenhelm',8]];
const WORLD_FLAGS=['de','gb','us','fr','es','it','nl','pl','pt','br','ar','mx','ca','au','jp','kr','cn','in','tr','ru','ua','se','no','dk','fi','at','ch','ie','be','gr','cz','hu','ro','bg','rs','sk','si','il','sa','eg','za','bd','mk'];
const FLAG_NAMES={de:'Deutschland',gb:'Vereinigtes Königreich',us:'USA',fr:'Frankreich',es:'Spanien',it:'Italien',nl:'Niederlande',pl:'Polen',pt:'Portugal',br:'Brasilien',ar:'Argentinien',mx:'Mexiko',ca:'Kanada',au:'Australien',jp:'Japan',kr:'Südkorea',cn:'China',in:'Indien',tr:'Türkei',ru:'Russland',ua:'Ukraine',se:'Schweden',no:'Norwegen',dk:'Dänemark',fi:'Finnland',at:'Österreich',ch:'Schweiz',ie:'Irland',be:'Belgien',gr:'Griechenland',cz:'Tschechien',hu:'Ungarn',ro:'Rumänien',bg:'Bulgarien',rs:'Serbien',sk:'Slowakei',si:'Slowenien',il:'Israel',sa:'Saudi-Arabien',eg:'Ägypten',za:'Südafrika',bd:'Bangladesch',mk:'Nordmazedonien'};
const ANT_FLAGS=[['a_red','Rote Kolonie',2],['a_green','Blattschneider',2],['a_gold','Goldstern',2],['a_stripe','Streifen',2],['a_mound','Hügelwacht',3],['a_fungus','Pilzgarten',3],['a_swords','Kriegsbanner',3],['a_queen','Königin',3]];
/* Profilbild: kleines Bild als Data-URL (nur png/jpeg/webp, höchstens 30 kB), wird nur per <img> angezeigt */
const safeAvatar=s=>typeof s==='string'&&s.length<=30000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)?s:null;
const CROWNS=[['monarch','Königskrone',4],['ruby','Rubinkrone',6],['coral','Korallenkrone',7],['amethyst','Amethystturm',8],['toxic','Giftkrone',8],['laurel','Lorbeerkranz',10],['halo','Himmelsreif',10],['frost','Eiskrone',11],['inferno','Infernokrone',13],['prism','Prisma-Herrscher',16],['sun','Sonnenkrone',18],['obsidian','Obsidiankrone',22]];
const PATTERNS=[['stripes','Diagonalen',3],['diagonal','Streifen',3],['checker','Schachbrett',3],['dots','Punkte',3],['bricks','Mauerwerk',4],['hearts','Herzchen',4],['stars','Sterne',4],['waves','Wellen',5],['grid','Gitter',5],['arrows','Pfeile',5],['hexes','Waben',6],['scales','Schuppen',6]];
const SHIPS=[['leaf','Blattkahn',4],['paper','Papierboot',5],['duck','Entenboot',6],['turtle','Schildkrötenfloß',6],['viking','Wikingerboot',6],['ice','Eisbrecher',7],['steam','Dampfer',8],['pirate','Piratenschiff',10],['ghost','Geisterschiff',11],['golden','Goldgaleone',14]];
const SHOP=[
  ...CROWNS.map(([id,n,p])=>({id:'crown:'+id,kind:'crown',key:id,name:n,price:p})),
  ...PATTERNS.map(([id,n,p])=>({id:'pattern:'+id,kind:'pattern',key:id,name:n,price:p})),
  ...SHIPS.map(([id,n,p])=>({id:'ship:'+id,kind:'ship',key:id,name:n,price:p})),
  ...Object.entries(BSKINS).filter(([id])=>id!=='default').map(([id,x])=>({id:'bskin:'+id,kind:'bskin',key:id,name:x.n,price:x.price})),
  ...Object.entries(TSKINS).filter(([id])=>id!=='default').map(([id,x])=>({id:'tskin:'+id,kind:'tskin',key:id,name:x.n,price:x.price})),
  ...Object.entries(RSKINS).filter(([id])=>id!=='default').map(([id,x])=>({id:'rskin:'+id,kind:'rskin',key:id,name:x.n,price:x.price})),
  ...HATS.map(([id,n,p])=>({id:'hat:'+id,kind:'hat',key:id,name:n,price:p})),
  ...WORLD_FLAGS.map(id=>({id:'flag:'+id,kind:'flag',key:id,name:FLAG_NAMES[id],price:['de','gb','us','fr','es','it','nl','pl'].includes(id)?1:2})),
  ...ANT_FLAGS.map(([id,n,p])=>({id:'flag:'+id,kind:'flag',key:id,name:n,price:p,custom:true}))
];
const SHOP_BY_ID=Object.fromEntries(SHOP.map(i=>[i.id,i]));
/* Quests: [id, Art, Statistik, Ziel, Belohnung (Rubys), Titel] */
/*Q-BEGIN*/
/* Quest: [id, Art, Stat, Ziel, Belohnung, Titel, Beschreibung, Symbol, Kategorie, Extra]. Stat 'bonus' = alle anderen Quests der Art abgeholt */
const Q=(id,kind,stat,goal,reward,title,desc,ic,cat,extra)=>[id,kind,stat,goal,reward,title,desc||'',ic||'trophy',cat||'',extra||{}];
const CAREER=[
  ['games','Matches','Veteran','Spiele Partien','Jede gestartete Partie zählt, auch Solo.','gamepad','games',[5,15,40,100,250],[10,20,40,80,160]],
  ['games2','Matches','Vielspieler','Spiele viele Partien','Jede gestartete Partie zählt, auch Solo.','gamepad','games',[20,60,150,400],[15,35,80,180]],
  ['games3','Matches','Spielmarathon','Spiele ein Dauerprogramm','Jede gestartete Partie zählt, auch Solo.','gamepad','games',[50,200,500,1200],[40,90,200,420]],
  ['days','Matches','Stammgast','Spiele an verschiedenen Tagen','Jeder Tag mit mindestens einer Partie zählt.','calendar','days',[3,7,20,50],[10,25,60,130]],
  ['days2','Matches','Gewohnheit','Spiele regelmäßig','Jeder Tag mit mindestens einer Partie zählt.','calendar','days',[10,25,60,120],[20,50,110,230]],
  ['mins','Matches','Dienstzeit','Minuten in Partien','Zeit, die du in Partien verbringst.','clock','mins',[30,120,480,1500],[8,20,55,130]],
  ['mins2','Matches','Ausdauer','Verbringe viel Zeit im Spiel','Zeit, die du in Partien verbringst.','clock','mins',[60,240,900,3000],[15,40,95,210]],
  ['wins','Sieg','Sieger','Gewinne Partien','Jeder Sieg zählt.','trophy','wins',[1,5,15,40,100],[12,25,50,100,200]],
  ['wins2','Sieg','Feldherr','Gewinne viele Partien','Jeder Sieg zählt.','trophy','wins',[3,10,25,60],[20,45,100,220]],
  ['wins3','Sieg','Champion','Gewinne ein Dutzend Partien','Jeder Sieg zählt.','trophy','wins',[8,20,50,120],[35,80,180,380]],
  ['wins4','Sieg','Unbesiegbar','Gewinne am laufenden Band','Jeder Sieg zählt.','trophy','wins',[50,150,350,800],[120,260,520,900]],
  ['conq','Kriegsführung','Eroberer','Erobere Gebiete','Jede Eroberung zählt.','swords','conq',[10,50,150,400],[12,30,70,140]],
  ['conq2','Kriegsführung','Belagerer','Erobere viele Gebiete','Jede Eroberung zählt.','swords','conq',[25,100,250,600],[20,50,120,260]],
  ['conq3','Kriegsführung','Feldzug','Führe lange Feldzüge','Jede Eroberung zählt.','swords','conq',[60,200,500,1200],[40,95,210,430]],
  ['conq4','Kriegsführung','Imperium','Erobere ein Imperium','Jede Eroberung zählt.','swords','conq',[150,500,1200,3000],[90,200,420,800]],
  ['built','Bauen','Baumeister','Baue Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','built',[10,50,150,400],[10,25,60,120]],
  ['built2','Bauen','Architekt','Baue viele Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','built',[25,100,250,600],[18,45,110,240]],
  ['built3','Bauen','Stadtplaner','Plane große Kolonien','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','built',[60,200,500,1200],[38,90,200,410]],
  ['built4','Bauen','Metropole','Baue eine Metropole','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','built',[150,500,1200,3000],[85,190,400,780]],
  ['sunk','Seekrieg','Seewolf','Versenke gegnerische Schiffe','Deine Kriegsschiffe zählen.','anchor','sunk',[1,5,15,40],[15,35,80,160]],
  ['sunk2','Seekrieg','Korsar','Versenke viele Schiffe','Deine Kriegsschiffe zählen.','anchor','sunk',[3,8,20,50],[22,50,120,260]],
  ['sunk3','Seekrieg','Admiral','Beherrsche die See','Deine Kriegsschiffe zählen.','anchor','sunk',[6,15,35,80],[45,110,240,500]],
  ['sunk4','Seekrieg','Flottenherr','Versenke eine ganze Flotte','Deine Kriegsschiffe zählen.','anchor','sunk',[12,30,70,160],[90,200,420,820]],
  ['allied','Diplomatie','Diplomat','Schließe Bündnisse','Jedes neue Bündnis zählt.','handshake','allied',[1,5,15,30],[8,25,60,130]],
  ['allied2','Diplomatie','Unterhändler','Schließe viele Bündnisse','Jedes neue Bündnis zählt.','handshake','allied',[2,8,20,40],[16,45,110,230]],
  ['allied3','Diplomatie','Botschafter','Knüpfe ein Netzwerk','Jedes neue Bündnis zählt.','handshake','allied',[4,12,25,50],[30,75,170,350]],
  ['allied4','Diplomatie','Friedensstifter','Verbünde ganze Stämme','Jedes neue Bündnis zählt.','handshake','allied',[6,15,35,70],[55,130,280,560]],
  ['found','Sammlung','Schatzsucher','Grabe Funde aus','Vergrabene Funde in der Kolonie.','gem','found',[5,25,75,200],[8,20,50,110]],
  ['found2','Sammlung','Ausgräber','Grabe viele Funde aus','Vergrabene Funde in der Kolonie.','gem','found',[10,50,150,400],[14,40,95,210]],
  ['found3','Sammlung','Sammler','Trage eine Sammlung zusammen','Vergrabene Funde in der Kolonie.','gem','found',[20,80,250,600],[30,80,190,400]],
  ['found4','Sammlung','Archäologe','Durchsuche den ganzen Boden','Vergrabene Funde in der Kolonie.','gem','found',[40,150,450,1000],[60,150,340,700]],
  ['terr','Meisterleistungen','Reichsgründer','Besitze Gebiete gleichzeitig','Die höchste Zahl in einer Partie.','map','terr',[5,10,20,35],[8,20,50,110]],
  ['terr2','Meisterleistungen','Herrscher','Halte viele Gebiete','Die höchste Zahl in einer Partie.','map','terr',[12,25,45,70],[18,45,100,220]],
  ['terr3','Meisterleistungen','Kontinent','Beherrsche den Kontinent','Die höchste Zahl in einer Partie.','map','terr',[18,35,55,80],[35,90,190,380]],
  ['score','Meisterleistungen','Punktejäger','Erreiche Punkte','Dein höchster Punktestand in einer Partie.','star','score',[300,1000,3000,8000],[10,30,80,180]],
  ['score2','Meisterleistungen','Legende','Sammle viele Punkte','Dein höchster Punktestand in einer Partie.','star','score',[1500,5000,12000,25000],[25,65,150,340]],
  ['score3','Meisterleistungen','Mythos','Erreiche Rekordpunkte','Dein höchster Punktestand in einer Partie.','star','score',[2500,8000,20000,45000],[40,110,240,520]]
];
const QUESTS=[
  Q('d_games','daily','games',2,3,'Spiele Partien','Jede gestartete Partie zählt, auch Solo.','gamepad','daily'),
  Q('d_wins','daily','wins',1,8,'Gewinne eine Partie','Ein Sieg in beliebigem Modus.','trophy','daily'),
  Q('d_conq','daily','conq',5,5,'Erobere Gebiete','Jede Eroberung zählt.','swords','daily'),
  Q('d_conq2','daily','conq',12,8,'Erobere 12 Gebiete','Jede Eroberung zählt.','swords','daily'),
  Q('d_build','daily','built',8,6,'Baue Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','daily'),
  Q('d_build2','daily','built',20,9,'Baue 20 Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','daily'),
  Q('d_terr','daily','terr',3,4,'Besitze Gebiete','Besitze gleichzeitig 3 Gebiete.','map','daily'),
  Q('d_mins','daily','mins',10,4,'Spiele 10 Minuten','Zeit in Partien, auch Solo.','clock','daily'),
  Q('d_found','daily','found',3,6,'Grabe 3 Funde aus','Vergrabene Funde in der Kolonie.','gem','daily'),
  Q('d_sunk','daily','sunk',1,7,'Versenke ein Schiff','Deine Kriegsschiffe zählen.','anchor','daily'),
  Q('d_allied','daily','allied',1,6,'Schließe ein Bündnis','Jedes neue Bündnis zählt.','handshake','daily'),
  Q('d_score','daily','score',500,7,'Erreiche 500 Punkte','Dein höchster Punktestand in einer Partie.','star','daily'),
  Q('b_daily','daily','bonus',12,6,'Bonus für alle erledigten Quests','Schließe alle Quests oben ab, um ihn freizuschalten.','chest','daily'),
  Q('w_games','weekly','games',5,10,'Spiele 5 Partien','Jede gestartete Partie zählt, auch Solo.','gamepad','weekly'),
  Q('w_wins','weekly','wins',1,14,'Gewinne eine Partie','Ein Sieg in beliebigem Modus.','trophy','weekly'),
  Q('w_days','weekly','days',3,14,'Spiele an verschiedenen Tagen','Spiele an einem Tag mindestens eine Partie.','calendar','weekly'),
  Q('w_conq','weekly','conq',10,12,'Erobere Gebiete','Jede Eroberung zählt.','swords','weekly'),
  Q('w_conq2','weekly','conq',25,18,'Erobere 25 Gebiete','Jede Eroberung zählt.','swords','weekly'),
  Q('w_build','weekly','built',40,14,'Baue 40 Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','weekly'),
  Q('w_build2','weekly','built',80,18,'Baue 80 Gebäude','Außenposten, Häfen, Wälle und Schiffe zählen.','hammer','weekly'),
  Q('w_sunk','weekly','sunk',3,16,'Versenke gegnerische Schiffe','Deine Kriegsschiffe zählen.','anchor','weekly'),
  Q('w_sunk2','weekly','sunk',8,18,'Versenke 8 Schiffe','Deine Kriegsschiffe zählen.','anchor','weekly'),
  Q('w_terr','weekly','terr',15,14,'Besitze viele Gebiete','Gleichzeitig 15 Gebiete halten.','map','weekly'),
  Q('w_terr2','weekly','terr',25,16,'Besitze 25 Gebiete','Gleichzeitig 25 Gebiete halten.','map','weekly'),
  Q('w_found','weekly','found',10,14,'Grabe Funde aus','Vergrabene Funde in der Kolonie.','gem','weekly'),
  Q('w_found2','weekly','found',25,16,'Grabe 25 Funde aus','Vergrabene Funde in der Kolonie.','gem','weekly'),
  Q('w_allied','weekly','allied',1,12,'Schließe ein Bündnis','Jedes neue Bündnis zählt.','handshake','weekly'),
  Q('w_allied2','weekly','allied',2,16,'Schließe 2 Bündnisse','Jedes neue Bündnis zählt.','handshake','weekly'),
  Q('w_mins','weekly','mins',120,14,'Spiele 2 Stunden','Zeit in Partien, auch Solo.','clock','weekly'),
  Q('w_score','weekly','score',3000,18,'Erreiche 3000 Punkte','Dein höchster Punktestand in einer Partie.','star','weekly'),
  Q('b_weekly','weekly','bonus',17,16,'Bonus für alle erledigten Quests','Schließe alle Quests oben ab, um ihn freizuschalten.','chest','weekly')
];
for(const[key,cat,title,desc,sub,ic,stat,goals,rew]of CAREER)goals.forEach((g,i)=>QUESTS.push(Q(`c_${key}_${i+1}`,'career',stat,g,rew[i],title,desc,ic,cat,{key,tier:i+1,tiers:goals.length,sub})));
/*Q-END*/
const MAX_STATS=['terr','score'];
const REPORT_KEYS=['games','wins','found','allied','terr','score','built','conq','sunk','mins'];
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
    /* Kein await auf Supabase-Aufrufe direkt im Callback (Deadlock im SDK) – Arbeit läuft danach in einem eigenen Tick. */
    AW.sb.auth.onAuthStateChange((ev,s)=>{AW.user=s?s.user:null;AW.profile=null;
      if(ev==='SIGNED_OUT'&&!Remote.userOut){console.warn('Unerwartet abgemeldet (SIGNED_OUT)');try{toast('Abgemeldet (Sitzung ungültig)','bad')}catch(e){}}
      Remote.userOut=false;
      setTimeout(async()=>{try{if(AW.user)await Remote.loadProfile()}catch(e){console.warn('loadProfile:',e)}AW.emit()},0)});
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
  async oauth(provider){const o={provider,options:{redirectTo:location.origin+location.pathname}};const{error}=(AW.user&&AW.user.is_anonymous&&AW.sb.auth.linkIdentity)?await AW.sb.auth.linkIdentity(o):await AW.sb.auth.signInWithOAuth(o);if(error){console.warn('oauth:',error.message);const m=error.message||'';throw new Error(/not enabled|unsupported provider/i.test(m)?'Anbieter in Supabase nicht aktiviert (Authentication → Providers)':/manual linking/i.test(m)?'Supabase: „Allow manual linking“ aktivieren (Authentication → Sign In / Providers)':'Anmeldung fehlgeschlagen: '+m)}},
  async signOut(){Remote.userOut=true;await AW.sb.auth.signOut();try{await Remote.anon()}catch(e){AW.user=null}},
  async reset(email){await AW.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname})},
  async setPhone(phone){const{error}=await AW.sb.auth.updateUser({phone});if(error)throw new Error('Nummer konnte nicht gespeichert werden')},
  async verifyPhone(phone,token){const{error}=await AW.sb.auth.verifyOtp({phone,token,type:'phone_change'});if(error)throw new Error('Code ungültig');await Remote.loadProfile()},
  async update(p){
    p={...p};if('avatar' in p)p.avatar=safeAvatar(p.avatar);
    if('username' in p){const nm=cleanName(p.username);if(nm.length<2)throw new Error('Name zu kurz');delete p.username;const{error}=await AW.sb.rpc('set_username',{n:nm});if(error)throw new Error('Name konnte nicht gespeichert werden')}
    if(Object.keys(p).length){const{error}=await AW.sb.from('profiles').update(p).eq('id',AW.user.id);if(error)throw new Error('Speichern nicht möglich')}
    await Remote.loadProfile()},
  async buy(id){const{error}=await AW.sb.rpc('buy_item',{item:id});if(error)throw new Error(error.message);await Remote.loadProfile()},
  async claim(id){const{error}=await AW.sb.rpc('claim_quest',{qid:id});if(error)throw new Error(error.message);await Remote.loadProfile()},
  async report(p){const{error}=await AW.sb.rpc('report_stats',{p});if(error)console.warn('report_stats fehlgeschlagen (schema.sql ausgeführt?):',error.message);else await Remote.loadProfile()},
  async players(){const{data}=await AW.sb.from('leaderboard_players').select('*').order('wins',{ascending:false}).limit(100);return data||[]},
  async clans(){const{data}=await AW.sb.from('leaderboard_clans').select('*').order('wins',{ascending:false}).limit(100);return data||[]},
  async potd(){const{data}=await AW.sb.from('player_of_day').select('*').limit(1);const r=data&&data[0];return r&&r.wins>0?r:null},
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
  /* Forum: Meldungen (Bugs, Vorschläge, Spieler-Reports). Lesen darf nur das Team und der Verfasser. */
  async forumThreads(){const{data,error}=await AW.sb.rpc('forum_list');if(error){console.warn('forum_list:',error.message);throw new Error(/function|schema cache/i.test(error.message)?'Server noch nicht aktualisiert: supabase/schema.sql im SQL-Editor ausführen':'Forum konnte nicht geladen werden')}return data||[]},
  async forumOpen(id){const{data,error}=await AW.sb.rpc('forum_open',{tid:id});if(error){console.warn('forum_open:',error.message);throw new Error('Beitrag konnte nicht geladen werden')}return data||[]},
  async forumSend(k,t,b){const{data,error}=await AW.sb.rpc('forum_send',{k,t,b});if(error)throw new Error(error.message);return data},
  async forumReply(id,b){const{error}=await AW.sb.rpc('forum_reply',{tid:id,b});if(error)throw new Error(error.message)},
  async forumClose(id,c){const{error}=await AW.sb.rpc('forum_close',{tid:id,c:!!c});if(error)throw new Error('Keine Berechtigung')},
  async forumDel(id){const{error}=await AW.sb.rpc('forum_remove',{tid:id});if(error)throw new Error('Keine Berechtigung')},
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
    if(!p){p={id:'local',username:lsGet('ak_name','Gast'),tag:randTag(),clan_tag:'',rubys:0,wins:0,games:0,avatar:null,hat:null,flag:null,crown:null,pattern:null,ship:null,bskin:null,tskin:null,rskin:null,owned:[],quests:{},stats:{},is_admin:false,created_at:new Date().toISOString()};lsSet(LP+'profile',p)}
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
    if('avatar' in p)a.avatar=safeAvatar(p.avatar);
    if('hat' in p){if(p.hat&&!a.owned.includes('hat:'+p.hat))throw new Error('Nicht freigeschaltet');a.hat=p.hat}
    if('flag' in p){if(p.flag&&!a.owned.includes('flag:'+p.flag))throw new Error('Nicht freigeschaltet');a.flag=p.flag}
    for(const k of['crown','pattern','ship','bskin','tskin','rskin'])if(k in p){if(p[k]&&!a.owned.includes(k+':'+p[k]))throw new Error('Nicht freigeschaltet');a[k]=p[k]}
    lsSet('ak_name',a.username);Local.save()},
  async buy(id){const it=SHOP_BY_ID[id],a=AW.profile;if(!it)throw new Error('Unbekannt');if(a.owned.includes(id))throw new Error('Schon gekauft');if(a.rubys<it.price)throw new Error('Nicht genug Rubys');a.rubys-=it.price;a.owned.push(id);Local.save()},
  bucket(kind){const a=AW.profile;a.stats=a.stats||{};const k=periodKey(kind);const b=a.stats[kind]=(a.stats[kind]&&a.stats[kind].k===k)?a.stats[kind]:{k,v:{}};return b},
  async claim(id){const q=QUESTS.find(x=>x[0]===id),a=AW.profile;if(!q)throw new Error('Unbekannt');const b=Local.bucket(q[1]);
    if((a.quests[id])===b.k)throw new Error('Schon abgeholt');
    if(q[2]==='bonus'){if(!QUESTS.filter(x=>x[1]===q[1]&&x[2]!=='bonus').every(x=>a.quests[x[0]]===b.k))throw new Error('Noch nicht geschafft')}
    else if((b.v[q[2]]||0)<q[3])throw new Error('Noch nicht geschafft');
    a.quests[id]=b.k;a.rubys+=q[4];Local.save()},
  async report(p){const a=AW.profile,today=dayKey();
    for(const kind of['daily','weekly','career']){const b=Local.bucket(kind);
      for(const k in p){if(!REPORT_KEYS.includes(k))continue;const v=Math.max(0,Math.min(500,+p[k]||0));b.v[k]=MAX_STATS.includes(k)?Math.max(b.v[k]||0,v):(b.v[k]||0)+Math.min(v,50)}
      if(p.games&&b.v.dl!==today){b.v.dl=today;b.v.days=(b.v.days||0)+1}}
    if(p.games){const st=a.stats.streak||{n:0,last:''},y=new Date(Date.now()-864e5).toISOString().slice(0,10);
      if(st.last!==today){st.n=st.last===y?st.n+1:1;st.last=today}a.stats.streak=st}
    a.games+=Math.min(1,+p.games||0);a.wins+=Math.min(1,+p.wins||0);Local.save()},
  async players(){const a=AW.profile;return[{username:a.username,tag:a.tag,clan_tag:a.clan_tag,wins:a.wins,games:a.games}].concat(lsGet(LP+'fake',[]))},
  async clans(){const a=AW.profile;return a.clan_tag?[{clan_tag:a.clan_tag,wins:a.wins,games:a.games,members:1}]:[]},
  async potd(){const p=AW.profile,b=p&&p.stats&&p.stats.daily,w=b&&b.k===dayKey()?(b.v.wins||0):0;return w>0?{username:p.username,clan_tag:p.clan_tag,wins:w}:null},
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
  /* Forum im Gastmodus: liegt nur lokal, damit das Formular trotzdem funktioniert. */
  async forumThreads(){const l=lsGet(LP+'forum',[]);const a=AW.profile||{};
    return l.map(x=>({id:x.id,kind:x.kind,title:x.title,body:x.body,status:x.status,created_at:x.created_at,last_at:(x.posts&&x.posts.length?x.posts[x.posts.length-1].created_at:x.created_at),author_name:a.username||'Gast',author_tag:a.tag||'0000',replies:(x.posts||[]).length,mine:true})).sort((x,y)=>String(y.last_at).localeCompare(String(x.last_at)))},
  async forumOpen(id){const x=lsGet(LP+'forum',[]).find(t=>t.id===id);return x?((x.posts||[]).map(p=>({...p,is_admin:!!p.admin,mine:!p.admin}))):[]},
  async forumSend(k,tt,bb){const l=lsGet(LP+'forum',[]);
    if(l.filter(x=>Date.now()-new Date(x.created_at).getTime()<864e5).length>=8)throw new Error('Zu viele Meldungen – bitte morgen wieder');
    const id='f'+Date.now().toString(36);
    l.unshift({id,kind:k,title:String(tt).slice(0,120),body:String(bb).slice(0,4000),status:'open',created_at:new Date().toISOString(),posts:[]});
    lsSet(LP+'forum',l);return id},
  async forumReply(id,b){const l=lsGet(LP+'forum',[]),x=l.find(t=>t.id===id);if(!x)throw new Error('Beitrag nicht gefunden');
    if(x.status==='closed')throw new Error('Beitrag ist geschlossen');const a=AW.profile||{};
    x.posts=x.posts||[];x.posts.push({id:'p'+Date.now().toString(36),body:String(b).slice(0,2000),created_at:new Date().toISOString(),author_name:a.username||'Gast',author_tag:a.tag||'0000',admin:false});lsSet(LP+'forum',l)},
  async forumClose(id,c){const l=lsGet(LP+'forum',[]),x=l.find(t=>t.id===id);if(!x)return;x.status=c?'closed':'open';lsSet(LP+'forum',l)},
  async forumDel(id){lsSet(LP+'forum',lsGet(LP+'forum',[]).filter(t=>t.id!==id))},
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
  {id:'d18',version:'v21.5',title:'Forum für Bugs, Vorschläge und Spieler-Reports',body:'Im Menü gibt es jetzt ein Forum. Melde dort Fehler, schreibe Vorschläge oder erstatte einen Spieler-Report – mit Name#Tag, Zeit und Beschreibung. Nur das Team kann alle Meldungen lesen und Rückfragen stellen; deine eigene Meldung und die Antworten darauf siehst du weiterhin selbst, niemand sonst.',created_at:'2026-11-24T18:10:00Z'},
  {id:'d17',version:'v21.4',title:'Wege wieder auf dem kürzesten Weg',body:'Die automatischen Wege zwischen deinen Städten laufen wieder auf dem kürzesten Weg. Ein Fehler beim Glätten der Route hat jeden Weg pro Schritt um ein Drittel gestreckt, deshalb zogen sich die Verbindungen in riesigen Bögen über die Karte, statt Nachbargebiete direkt zu verbinden.',created_at:'2026-11-24T16:20:00Z'},
  {id:'d16',version:'v21.3',title:'37 Karriere-Quests',body:'Die Karriere ist noch einmal deutlich gewachsen: aus 20 sind 37 Quests geworden, jede mit vier bis fünf Stufen. Neue Linien wie Spielmarathon, Ausdauer, Champion, Feldzug, Imperium, Stadtplaner, Metropole, Admiral, Flottenherr, Botschafter, Friedensstifter, Sammler, Archäologe, Kontinent und Mythos geben auch langjährigen Spielern noch Ziele. Tages- und Wochenquests bleiben unverändert.',created_at:'2026-11-24T15:45:00Z'},
  {id:'d15',version:'v21.2',title:'Karriere mit 20 Quests',body:'Die Karriere ist neu aufgeteilt: statt einiger langer Linien gibt es jetzt zwanzig Karriere-Quests mit je vier bis fünf Stufen – vom Vielspieler über den Belagerer bis zur Legende. Jede Karte zeigt ihre Stufen als nummerierte Punkte, den aktuellen Stand und die Belohnung. Tages- und Wochenquests bleiben unverändert. Der GitHub-Pages-Build ist repariert, die Änderungen sind wieder online.',created_at:'2026-11-24T15:10:00Z'},
  {id:'d14',version:'v21.1',title:'Mehr Tages- und Wochenquests',body:'Die Erfolge sind jetzt deutlich voller: zwölf Tagesquests und siebzehn Wochenquests warten auf dich, jede mit eigenem Symbol, eigener Farbe und eigener Belohnung. Die Karriere bleibt bei 44 Stufen in elf Linien – dafür ist die Liste aufgeräumt: Symbol, Aufgabe und Abholen-Knopf stehen in einer Reihe, der Balken zeigt direkt darunter den Stand. Abholbereite Quests leuchten in ihrer Farbe, abgeholte sind klar als erledigt markiert.',created_at:'2026-11-24T14:20:00Z'},
  {id:'d13',version:'v21',title:'Liquid Glass, neue Skins und mehr Quests',body:'Die Oberfläche und das Hauptmenü sind jetzt aus flüssigem Glas: weiche Spiegelungen, tiefe Unschärfe und Farbverläufe, die sich über die Karten legen. Alle Kosmetik ist neu gezeichnet: 18 Hüte, 12 Kronen und 10 Schiffe als detaillierte SVG-Dateien, dazu neue Muster, Gebäude-, Händler- und Wege-Skins – die Preise passen zur neuen Qualität. Die Erfolge sind überarbeitet: Fortschrittsbalken in der Farbe der Quest, große Abholen-Knöpfe, klare Abgeholt-Markierung und ein Prozentwert, der den echten Stand zeigt. Die Karriere bleibt bei 44 Stufen, dafür gibt es jetzt 12 Tages- und 17 Wochenquests.',created_at:'2026-11-24T12:00:00Z'},
  {id:'d11',version:'v19',title:'Erfolge, Profil und Weltkarte neu',body:'Großes Update im Stil von FrontWars: Erfolge mit Täglich, Wöchentlich, Karriere und Events, dazu Tagesserie und Bonus-Belohnungen. Das Profil zeigt Statistiken, Modi und die letzten Spiele, dein Profilbild schneidest du selbst zu. Neu im Spiel: automatische Wege mit Händlern, Kriegsschiffe, feste Modi (Klassisch 2x, Schnell 3x, Chaos), keine Marionettenstaaten mehr, Skins für Gebäude, Händler und Wege sowie schärfere Grafik. Außerdem behoben: Tasten nach dem Benutzen der Regler und der VSync-Fehler.',created_at:'2026-11-22T12:00:00Z'},
  {id:'d10',version:'v18',title:'Flaggen im Mehrspieler',body:'Im Mehrspieler siehst du jetzt auch die Flaggen der anderen: Sie wehen auf der Hauptstadt des jeweiligen Spielers. Wer fremde Kosmetik nicht sehen mag, blendet sie in den Einstellungen unter Spiel aus.',created_at:'2026-11-21T22:30:00Z'},
  {id:'d9',version:'v17',title:'Profilbild hochladen',body:'Du kannst jetzt ein eigenes Profilbild hochladen. Öffne dein Profil, wähle ein Bild (PNG, JPG oder WebP), es wird mittig zugeschnitten und klein gespeichert. Es erscheint im Profil und oben im Header, mit dem Papierkorb-Knopf entfernst du es wieder.',created_at:'2026-11-21T21:00:00Z'},
  {id:'d8',version:'v16',title:'Kosmetik im Mehrspieler',body:'Im Mehrspieler siehst du jetzt die Kosmetik der anderen: ihre Krone, ihr Muster auf der Karte und ihr Schiff auf dem Wasser. Wer die Kosmetik anderer nicht sehen mag, schaltet sie in den Einstellungen unter Spiel aus.',created_at:'2026-11-21T20:00:00Z'},
  {id:'d7',version:'v15',title:'Kronen, Muster und Schiffe',body:'Neue Kosmetik im Shop: Kronen, Muster und Schiffe. Die Krone trägt, wer das meiste Land hat: Sie steht über dem Namen seiner Hauptstadt und in der Bestenliste, alle tragen standardmäßig die goldene Krone, im Shop gibt es sieben weitere. Muster färben deine Gebiete auf der Weltkarte (acht Stück), Schiffe ersetzen dein Floß auf dem Wasser (sechs Stück). Alles lässt sich im Inventar ausrüsten. Die Rubys sind jetzt Pixel-Kristalle.',created_at:'2026-11-21T19:00:00Z'},
  {id:'d6',version:'v14',title:'Neue Weltkarten-Oberfläche',body:'Die Weltkarte sieht jetzt aus wie bei FrontWars: Bestenliste links oben (Besitz, Gebiete, Truppen), unten die Bauleiste mit den Tasten 1 bis 6 (Wall, Außenposten, Linie, Hafen, Floß, Weg), Material und Truppen mit Anteilsleiste sowie Leisten zum Spenden von Truppen und Material. Unten rechts stehen Ereignisse und das Team. Das Seitenpanel rechts ist weg, Bauen geht über die Leiste oder per Rechtsklick. Die Flüsse winden sich jetzt natürlicher durchs Land, und die Rubys sind jetzt rote Kristalle in der Akzentfarbe.',created_at:'2026-11-21T14:00:00Z'},
  {id:'d5',version:'v13',title:'Modi, Unlimited, Flüsse und viele Neuerungen',body:'Neuer Modus-Knopf im Startmenü: FFA (7 Gegner) und Unlimited (3,5× große Karte, doppelt so große Kolonie, 5 Gegner, kein Ende). Das Startgebiet wählst du jetzt in 15 Sekunden direkt auf der Karte. Flüsse auf der Karte: baue Häfen und Flöße daran. Flöße fahren jetzt nur noch über Wasser. Spielzeit im Kopf, nach einem Sieg kannst du weiterspielen, Rechtsklick halten baut mehrere Räume. Tasten: Q/R scrollen, 1/2/3 Reiter, Tab wechselt Kolonie und Karte. Neu: Inventar für Kosmetik, Spieler des Tages, mehr Einstellungen (Tasten, VSync, FPS-Limit, Grafikqualität, Interface-Größe, Standard-Truppenanteil), roter Rahmen bei Angriffen und Quest-Anzeige im Spiel.',created_at:'2026-11-21T12:00:00Z'},
  {id:'d4',version:'v12',title:'Tunnelansicht und neue Weltkarte',body:'Taste T zeigt in der Kolonie grün Gegrabenes und rot Unbebaubares: Linksklick markiert, ziehen malt mehrere, Tunnel sind 2,5× schneller. Auf der Weltkarte verschmelzen eigene Gebiete, die Hauptstadt wird mit dem Reich größer. Rechtsklick aufs eigene Gebiet öffnet das Bauen-Menü: Verteidigungswall, Außenposten, Linien, Hafen, Floß, Wege. Marionettenstaaten geben einen Teil der Beute.',created_at:'2026-11-20T20:00:00Z'},
  {id:'d1',version:'v11',title:'Neues Design, Konten und Shop',body:'Komplett neues Glas-Interface, Anmeldung mit E-Mail, GitHub oder Discord, Rubys durch Quests, Hüte und Flaggen im Shop, Clans über freie Tags und Ranglisten.',created_at:'2026-11-17T09:00:00Z'},
  {id:'d2',version:'v10',title:'Schutzzeit am Start',body:'Zu Beginn kann niemand angreifen: Leicht 2:30, Normal 1:30, Schwer 1:00 Minuten.',created_at:'2026-11-10T09:00:00Z'},
  {id:'d3',version:'v9',title:'Powerups in der Kolonie',body:'Zufällig vergrabene Funde liegen im Boden. Grabe Tunnel dorthin, dann werden sie geborgen.',created_at:'2026-11-03T09:00:00Z'}
];

let API=REMOTE?Remote:Local;
Object.assign(AW,{
  signIn:(...a)=>API.signIn(...a),signUp:(...a)=>API.signUp(...a),secure:(...a)=>API.secure(...a),oauth:(...a)=>API.oauth(...a),signOut:async()=>{await API.signOut();AW.emit()},
  reset:(...a)=>API.reset(...a),setPhone:(...a)=>API.setPhone(...a),verifyPhone:(...a)=>API.verifyPhone(...a),
  update:async p=>{await API.update(p);AW.emit()},buy:async id=>{await API.buy(id);AW.emit()},claim:async id=>{await API.claim(id);AW.emit()},report:p=>API.report(p).then(()=>AW.emit()),
  players:()=>API.players(),potd:()=>API.potd(),clans:()=>API.clans(),news:()=>API.news(),newsSave:n=>API.newsSave(n),newsDel:id=>API.newsDel(id),
  adminProfiles:q=>API.adminProfiles(q),adminUpdate:(i,p)=>API.adminUpdate(i,p),
  friends:()=>API.friends(),friendRequest:n=>API.friendRequest(n),friendRespond:(i,a)=>API.friendRespond(i,a),friendRemove:i=>API.friendRemove(i),
  lobbies:()=>API.lobbies(),lobbyCreate:l=>API.lobbyCreate(l),lobbyFind:c=>API.lobbyFind(c),lobbyUpdate:(c,p)=>API.lobbyUpdate(c,p),lobbyClose:c=>API.lobbyClose(c),channel:(c,h)=>API.channel(c,h),
  forumThreads:()=>API.forumThreads(),forumOpen:i=>API.forumOpen(i),forumSend:(k,t,b)=>API.forumSend(k,t,b),forumReply:(i,b)=>API.forumReply(i,b),forumClose:(i,c)=>API.forumClose(i,c),forumDel:i=>API.forumDel(i)
});
AW.init=async()=>{try{await API.init()}catch(e){console.warn('Backend nicht erreichbar, Gastmodus',e);AW.remote=false;API=Local;await Local.init();}AW.ready=true;AW.emit()};
