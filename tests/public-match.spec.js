/* Teil A: WebSocket-Transport gegen den echten Server (im selben Prozess, Fake-Verifier). */
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const {start}=require('../server/index.js');
const root=path.resolve(__dirname,'..'),PORT=8766,url=`http://localhost:${PORT}/index.html`;
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fake=async t=>{if(typeof t==='string'&&t.startsWith('tok:'))return{sub:t.slice(4),anon:false};throw new Error('auth')};
(async()=>{
  const srv=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await sleep(800);
  const h=await start({port:0,verify:fake,config:{HOST:'127.0.0.1',ALLOWED_ORIGINS:[`http://localhost:${PORT}`]}});
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  try{
    await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
    await pg.addInitScript(()=>{try{localStorage.setItem('aw_consent',JSON.stringify({set:true,prefs:true,ads:false}))}catch(e){}});
    await pg.goto(url);await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready&&typeof WSNet!=='undefined');
    const wsurl=`ws://127.0.0.1:${h.port}/`;
    ok(await pg.evaluate(async u=>{try{await WSNet.open(u,'bad');return false}catch(e){return true}},wsurl),'ungültiges Token: open() lehnt ab');
    await pg.evaluate(async u=>{window.got=[];NET.onmsg=m=>got.push(m);window.ch=await WSNet.open(u,'tok:alice');window.wsGone=false;ch.onclose=()=>{wsGone=true};
      NET.begin({ch,host:false,players:[],server:true});NET.onmsg=m=>got.push(m);ch.send({t:'join',mode:'classic'})},wsurl);
    await pg.waitForFunction(()=>got.some(m=>m.t==='room'),null,{timeout:5000});ok(true,'room nach join empfangen');
    ok(await pg.evaluate(()=>NET.server===true&&NET.role==='guest'),'NET.server gesetzt');
    await pg.evaluate(()=>{ch.send({t:'ready',name:'Alice',sp:Object.keys(SP)[0],start:T.findIndex(t=>t.terrain===SP[Object.keys(SP)[0]].terr),c:null})});
    await pg.waitForFunction(()=>got.some(m=>m.t==='ack'||m.t==='nack'),null,{timeout:5000});ok(true,'ack/nack nach ready empfangen');
    ok(await pg.evaluate(()=>{started=true;over=false;NET.live=true;NET.hostPid='x';NET.tick();const r=NET.miss.x===undefined&&NET.server;started=false;NET.live=false;return r}),'tick() kehrt im Servermodus sofort zurück');
    await h.close();
    await pg.waitForFunction(()=>wsGone,null,{timeout:5000}).catch(async e=>{console.log(await pg.evaluate(()=>JSON.stringify({c:wsGone})));throw e});ok(true,'onclose beim Serverende');
    ok(errs.length===0,'keine pageerror: '+errs.join(' | '));
  }catch(e){ok(false,'Abbruch: '+e.message.split('\n')[0]);console.log(errs.join('\n'))}
  await b.close();try{await h.close()}catch(e){}srv.kill();process.exit(fails?1:0);
})();
