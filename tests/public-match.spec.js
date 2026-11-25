/* Teil A: WebSocket-Transport gegen den echten Server (im selben Prozess, Fake-Verifier). */
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const {start}=require('../server/index.js');
const root=path.resolve(__dirname,'..'),let PORT,url;
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
  }catch(e){ok(false,'Abbruch: '+e.message.split('\n')[0]);console.log(errs.join('\n'))}
  await b.close();try{await h.close()}catch(e){}srv.kill();process.exit(fails?1:0);
})();
