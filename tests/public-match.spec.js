/* Teil A: WebSocket-Transport gegen den echten Server (im selben Prozess, Fake-Verifier). */
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const {start}=require('../server/index.js');
const root=path.resolve(__dirname,'..');let PORT,url;
const freePort=()=>new Promise(r=>{const n=require('net').createServer().listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>r(p))})});
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fake=async t=>{if(typeof t==='string'&&t.startsWith('tok:'))return{sub:t.slice(4),anon:false};throw new Error('auth')};
(async()=>{
  PORT=await freePort();url=`http://localhost:${PORT}/index.html`;
  const srv=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await sleep(800);
  const h=await start({port:0,verify:fake,config:{HOST:'127.0.0.1',ALLOWED_ORIGINS:[`http://localhost:${PORT}`]}});
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  try{
    await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
    await pg.addInitScript(()=>{try{localStorage.setItem('aw_consent',JSON.stringify({set:true,prefs:true,ads:false}))}catch(e){}});
    await pg.goto(url);await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready&&typeof WSNet!=='undefined');
    const wsurl=`ws://127.0.0.1:${h.port}/`;
    ok(await pg.evaluate(async u=>{try{await WSNet.open(u,'bad');return false}catch(e){return true}},wsurl),'ungültiges Token: open() lehnt ab');
    const rej=await pg.evaluate(async()=>{window.socks=0;const W=WebSocket;window.WebSocket=function(u){socks++;return new W(u)};const r={};
      for(const u of ['ws://example.com/','http://x/','nonsense','']){try{await WSNet.open(u,'tok:z');r[u]='open'}catch(e){r[u]=e.message}}
      r.n=socks;try{await WSNet.open('wss://127.0.0.1:1/','tok:z')}catch(e){r.wss=e.message}r.n2=socks;window.WebSocket=W;return r});
    ok(rej['ws://example.com/']==='insecure'&&rej['http://x/']==='insecure'&&rej.nonsense==='url'&&rej['']==='url'&&rej.n===0,'ws:// extern, http:, ungültige URL: Reject ohne Socket');
    ok(rej.wss==='ws'&&rej.n2===1,'wss:// wird bis zum Verbindungsfehler geführt');
    await pg.evaluate(async u=>{window.got=[];const real=NET.onmsg.bind(NET);window.realOnmsg=real;NET.onmsg=m=>{got.push(m);real(m)};window.ch=await WSNet.open(u,'tok:alice');window.wsGone=false;ch.onclose=()=>{wsGone=true};
      NET.begin({ch,host:false,players:[],server:true});ch.send({t:'join',mode:'classic'})},wsurl);
    await pg.waitForFunction(()=>got.some(m=>m.t==='room'),null,{timeout:5000});ok(true,'room nach join empfangen');
    ok(await pg.evaluate(()=>NET.server===true&&NET.role==='guest'),'NET.server gesetzt');
    await pg.evaluate(()=>{ch.send({t:'ready',name:'Alice',sp:Object.keys(SP)[0],start:-1,c:null})});
    await pg.waitForFunction(()=>got.some(m=>m.t==='nack'),null,{timeout:5000});ok(!(await pg.evaluate(()=>got.some(m=>m.t==='ack'))),'ungültiges Startgebiet: genau nack, kein ack');
    /* echter NET.onmsg-Pfad: err -> Toast, init mit sm -> SIMV/speed */
    await pg.evaluate(()=>{window.msgs=[];const t0=toast;toast=function(m,k){msgs.push(m);return t0(m,k)}});
    await pg.evaluate(()=>NET.onmsg({t:'err',why:'x'.repeat(100)}));
    ok(await pg.evaluate(()=>msgs.length===1&&!/x{41}/.test(msgs[0])),'err -> Toast, Grund auf 40 Zeichen gekürzt');
    const ini=await pg.evaluate(()=>{const sp=setupSp,id=T.find(t=>t.terrain===SP[sp].terr).id;mapClick(id);
      NET.sent=true;NET.sentSp=sp;NET.sentStart=id;
      const Fi=[{n:'Host',sp,rgb:[1,2,3],hum:0,c:null},{n:'Alice',sp,rgb:[4,5,6],hum:1,c:null}];
      NET.onmsg({t:'init',sm:5,sp:5,gt:0,d:diffKey,hp:null,fids:{[PID]:1},Fi,F:[1,1],C:[0,0],M:[],T:T.map(()=>[0,10,0])});
      return{simv:SIMV,speed,started,live:NET.live}});
    ok(ini.simv===5&&ini.speed===5&&ini.started&&ini.live,'init mit sm: SIMV und speed gesetzt (echter onmsg-Pfad)');
    ok(await pg.evaluate(()=>{started=true;over=false;NET.live=true;NET.hostPid='x';NET.players=[];NET.tick();const r=NET.miss.x===undefined&&NET.server;started=false;NET.live=false;return r}),'tick() kehrt im Servermodus sofort zurück');
    await h.close();
    await pg.waitForFunction(()=>wsGone,null,{timeout:5000}).catch(async e=>{console.log(await pg.evaluate(()=>JSON.stringify({c:wsGone})));throw e});ok(true,'onclose beim Serverende');
    ok(errs.length===0,'keine pageerror: '+errs.join(' | '));

    /* ===== Teil B: Bildschirm „Öffentliche Spiele“ ===== */
    const mk=async cfg=>{const c=await b.newContext({locale:'de-DE'});await c.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG='+JSON.stringify(cfg),contentType:'text/javascript'}));
      await c.addInitScript(()=>{try{localStorage.setItem('aw_consent',JSON.stringify({set:true,prefs:true,ads:false}))}catch(e){}});
      const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready&&typeof WSNet!=='undefined');await p.evaluate(()=>{const l=document.getElementById('login');if(l)l.hidden=true});return p};
    const p1=await mk({});
    ok(await p1.locator('#rail [data-s="publicMatches"]').isVisible(),'Menüeintrag „Öffentliche Spiele“ sichtbar');
    await p1.click('#rail [data-s="publicMatches"]');
    await p1.waitForSelector('#pmRetry',{timeout:5000});
    ok((await p1.textContent('#scrP')).includes('Server nicht erreichbar')&&(await p1.textContent('#scrP')).includes('Erneut versuchen'),'ohne SERVER_URL: „Server nicht erreichbar“ mit „Erneut versuchen“');
    await p1.click('#pmRetry');await p1.waitForSelector('#pmRetry',{timeout:5000});ok(true,'Erneut versuchen bleibt stabil');
    const h2=await start({port:0,verify:fake,config:{HOST:'127.0.0.1',ALLOWED_ORIGINS:[`http://localhost:${PORT}`]}});
    const cfg2={SERVER_URL:`ws://127.0.0.1:${h2.port}/`};
    const pa=await mk(cfg2);
    await pa.evaluate(async u=>{window.ch=await WSNet.open(u,'tok:alice');NET.begin({ch,host:false,players:[],server:true});ch.send({t:'join',mode:'classic'})},cfg2.SERVER_URL);
    const pb=await mk(cfg2);
    await pb.evaluate(()=>{AW.sb={auth:{getSession:async()=>({data:{session:{access_token:'tok:bob'}}})}}});
    await pb.click('#rail [data-s="publicMatches"]');
    await pb.waitForSelector('#pmList [data-m="classic"]',{timeout:8000});
    const row=await pb.textContent('#pmList');ok(/Klassisch|Classic/i.test(row)&&row.includes('1/8')&&row.includes('wartet'),'wartender Raum in der Liste: '+row.replace(/\s+/g,' ').slice(0,60));
    await pb.click('#pmList [data-m="classic"]');
    await pb.waitForFunction(()=>NET.server&&NET.role==='guest'&&document.querySelector('#btnStart')&&document.querySelector('#btnStart').textContent.trim()===t('Bereit'),null,{timeout:8000});
    ok(true,'Beitreten: Startgebiet-Menü, #btnStart zeigt „Bereit“');
    const en=await pb.evaluate(()=>['Öffentliche Spiele','Server nicht erreichbar','Erneut versuchen','voll','wartet','läuft','Beitreten','Zufällig beitreten'].every(k=>EN[k]));
    ok(en,'DE- und EN-Texte vorhanden');
    await h2.close();
    ok(errs.length===0,'Teil B: keine pageerror: '+errs.join(' | '));

    /* ===== Teil C: Karte/Modus vom Server, Bereit, Countdown, init ===== */
    const h3=await start({port:0,verify:fake,config:{HOST:'127.0.0.1',ALLOWED_ORIGINS:[`http://localhost:${PORT}`],COUNTDOWN_S:2}});
    const cfg3={SERVER_URL:`ws://127.0.0.1:${h3.port}/`};
    const pj=async who=>{const p=await mk(cfg3);await p.evaluate(w=>{AW.sb={auth:{getSession:async()=>({data:{session:{access_token:'tok:'+w}}})}}},who);
      await p.click('#rail [data-s="publicMatches"]');await p.waitForSelector('#pmJoin',{timeout:8000});
      await p.evaluate(()=>{UI.pm.mode='fast'});await p.click('#pmJoin');
      await p.waitForFunction(()=>NET.server&&NET.roomSeen&&document.querySelector('#netRoom'),null,{timeout:8000});return p};
    const c1=await pj('carl'),c2=await pj('dora');
    const st=async p=>p.evaluate(()=>({seed:CUR.seed,rs:NET.roomSeen.seed,mode:modeKey,rm:NET.roomSeen.mode,n:T.length,room:document.querySelector('#netRoom').textContent,btn:document.querySelector('#btnStart').textContent.trim()}));
    const s1=await st(c1),s2=await st(c2);
    ok(s1.seed===s1.rs&&s2.seed===s2.rs&&s1.seed===s2.seed&&s1.mode==='fast'&&s2.mode==='fast','Client-Karte == Raum-Seed/Modus (beide Clients)');
    const srvN=await new Promise(res=>{const W=require('../server/sim/world-vm');const w=W.createWorld({mode:'fast',mapSeed:s1.seed,seed:1});const v=w.snap().T.length;w.dispose();res(v)});
    ok(s1.n===srvN&&s2.n===srvN,'T.length gleich Server ('+srvN+')');
    ok(/Warte auf Spieler/.test(s1.room)||/Start in/.test(s1.room),'Spielerliste/„Warte auf Spieler“ im Setup-Panel');
    for(const [p,k] of [[c1,0],[c2,1]]){
      await p.evaluate(k=>{const sp=setupSp,l=T.filter(q=>q.terrain===SP[sp].terr);mapClick(l[k?l.length-1:0].id)},k);
      await p.click('#btnStart');
    }
    await c1.waitForFunction(()=>started&&NET.live,null,{timeout:15000}).catch(async e=>{console.log(await c1.evaluate(()=>JSON.stringify({s:started,l:NET.live,sent:NET.sent,room:NET.room,b:document.querySelector('#btnStart').textContent,ss:setupStart})));throw e});await c2.waitForFunction(()=>started&&NET.live,null,{timeout:15000});
    const f=await c1.evaluate(()=>({nf:F.length,me:F[0].isPlayer,hum:F.filter(x=>x.human).length,own:T.filter(x=>x.owner===0).length}));
    ok(f.nf>=3&&f.me&&f.hum===2&&f.own>=1,'init angewendet: Fraktionen/Menschen stimmen '+JSON.stringify(f));
    ok(await c1.evaluate(()=>{const l=T.length;NET.onmsg({t:'init',T:[],Fi:[],F:[],C:[],fids:{}});return T.length===l}),'init mit falscher T-Länge nach Start ignoriert ohne Exception');
    await h3.close();
    ok(errs.length===0,'Teil C: keine pageerror: '+errs.join(' | '));

    /* ===== Teil D: Ende zu Ende (Schutzzeit, Angriff, Weggang, Bot, Raum weg) ===== */
    const h4=await start({port:0,verify:fake,config:{HOST:'127.0.0.1',ALLOWED_ORIGINS:[`http://localhost:${PORT}`],COUNTDOWN_S:2,GRACE_S:2,PROT_S:5}});
    const cfg4={SERVER_URL:`ws://127.0.0.1:${h4.port}/`};
    const mm=async()=>(await fetch(`http://127.0.0.1:${h4.port}/matches`)).json();
    const pj4=async who=>{const p=await mk(cfg4);await p.evaluate(w=>{AW.sb={auth:{getSession:async()=>({data:{session:{access_token:'tok:'+w}}})}}},who);
      await p.click('#rail [data-s="publicMatches"]');await p.waitForSelector('#pmJoin',{timeout:8000});
      await p.evaluate(()=>{UI.pm.mode='fast'});await p.click('#pmJoin');
      await p.waitForFunction(()=>NET.server&&NET.roomSeen&&document.querySelector('#netRoom'),null,{timeout:8000});return p};
    const da=await pj4('erna'),db=await pj4('finn');
    ok((await mm()).some(r=>r.state==='waiting'&&r.humans===2),'/matches: Raum mit 2 Spielern');
    for(const [p,k] of [[da,0],[db,1]]){
      await p.evaluate(k=>{const sp=setupSp,l=T.filter(q=>q.terrain===SP[sp].terr);mapClick(l[k?l.length-1:0].id)},k);
      await p.click('#btnStart');
    }
    for(const p of [da,db])await p.waitForFunction(()=>started&&NET.live,null,{timeout:15000});
    ok((await mm()).some(r=>r.state==='running'),'/matches: Raum läuft');
    /* Angriff vor Ende der Schutzzeit: abgelehnt, kein Marsch */
    const src=()=>da.evaluate(()=>{let best=null;for(const t of T)if(t.owner===0&&(!best||t.troops>best.troops))best=t;
      if(!best)return null;const to=best.adj.find(i=>T[i].owner!==0);return{from:best.id,to,n:Math.max(1,Math.floor(best.troops/2)),tr:best.troops}});
    const a0=await src();ok(a0&&a0.to!=null&&a0.n>=1,'A hat Angriffsziel '+JSON.stringify(a0));
    const g0=await db.evaluate(()=>gtime);
    await da.evaluate(a=>NET.cmd({k:'launch',from:a.from,to:a.to,n:a.n}),a0);
    await db.waitForFunction(g=>gtime>g+1,g0,{timeout:8000});ok(true,'B sieht steigende gtime');
    ok(await db.evaluate(()=>marches.length===0),'Angriff in der Schutzzeit abgelehnt (kein Marsch bei B)');
    /* nach der Schutzzeit: Angriff wird ausgeführt und ist bei B sichtbar */
    await db.waitForFunction(()=>gtime/SIMV>5.5,null,{timeout:15000});
    const a1=await src();
    await da.evaluate(a=>NET.cmd({k:'launch',from:a.from,to:a.to,n:a.n}),a1);
    await db.waitForFunction(()=>marches.length>0,null,{timeout:8000}).catch(()=>{});
    ok(await db.evaluate(()=>marches.length>0),'Angriff nach Schutzzeit: Marsch im Schnappschuss von B');
    /* A schließt: nach GRACE wird die Fraktion Bot, B läuft weiter */
    const room=[...h4._rooms.rooms.values()][0];
    await da.context().close();
    await sleep(500);ok(room.humans.size===2&&![...room.humans.values()].some(h=>h.bot),'A weg: innerhalb der Schonfrist noch kein Bot');
    const t0=Date.now();
    while(Date.now()-t0<8000&&![...room.humans.values()].some(h=>h.bot))await sleep(200);
    ok([...room.humans.values()].filter(h=>h.bot).length===1,'nach GRACE_S ist As Fraktion Bot');
    const g1=await db.evaluate(()=>gtime);await db.waitForFunction(g=>gtime>g+1,g1,{timeout:8000});
    ok(await db.evaluate(()=>started&&NET.live),'B spielt weiter');
    await db.context().close();
    const t1=Date.now();while(Date.now()-t1<8000&&(await mm()).length)await sleep(200);
    ok((await mm()).length===0,'/matches: Raum nach Weggang beider verschwunden');
    await h4.close();
    ok(errs.length===0,'Teil D: keine pageerror: '+errs.join(' | '));
  }catch(e){ok(false,'Abbruch: '+e.message.split('\n')[0]);console.log(e.message.slice(0,600),errs.join('\n'))}
  await b.close();try{await h.close()}catch(e){}srv.kill();process.exit(fails?1:0);
})();
