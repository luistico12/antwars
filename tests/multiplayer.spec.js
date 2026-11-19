/* Mehrspieler-Test: Host + Gast im selben Browser, Lobby über BroadcastChannel (Gastmodus-Backend), per lokalem HTTP-Server. */
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),PORT=8765,url=`http://localhost:${PORT}/index.html`;
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const srv=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await sleep(800);
  const b=await chromium.launch();const ctx=await b.newContext();const errs=[];
  const mk=async name=>{const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(name+': '+e.message));
    await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
    await pg.addInitScript(()=>{try{localStorage.setItem('aw_consent',JSON.stringify({set:true,prefs:true,ads:false}))}catch(e){}});
    await pg.goto(url);await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);const sk=await pg.$('#nmSkip');if(sk)await sk.click();
    await pg.evaluate(n=>AW.update({username:n}),name);return pg};
  try{
    const H=await mk('Hosty'),G=await mk('Gasti');
    await H.click('#hCreate');await H.waitForFunction(()=>LOB.code);const code=await H.evaluate(()=>LOB.code);
    await G.evaluate(c=>lobJoin(c),code);
    await H.waitForFunction(()=>LOB.players.length===2,null,{timeout:15000});ok(true,'Gast ist in der Lobby');
    await H.click('#lobStart');
    await G.waitForFunction(()=>NET.active()&&!$('#home').offsetParent,null,{timeout:10000});
    ok(await H.evaluate(()=>NET.role)==='host'&&await G.evaluate(()=>NET.role)==='guest','Rollen Host/Gast gesetzt');
    const pick=async(pg,first)=>pg.evaluate(f=>{const sp=SP[setupSp],ids=T.filter(t=>t.terrain===sp.terr).map(t=>t.id);const id=f?ids[0]:ids[ids.length-1];mapClick(id);return id},first);
    const hs=await pick(H,true),gs=await pick(G,false);
    ok(await H.$eval('#btnStart',e=>e.disabled),'Host-Start gesperrt, bis der Gast bereit ist');
    await G.click('#btnStart');
    await H.waitForFunction(()=>!$('#btnStart').disabled,null,{timeout:10000});ok(true,'Host-Start frei, nachdem der Gast bereit ist');
    await H.click('#btnStart');
    await G.waitForFunction(()=>started&&NET.live,null,{timeout:10000});ok(true,'Gast ist im Spiel (Init-Schnappschuss angekommen)');
    ok(await G.evaluate(g=>T[g].owner===0&&T.filter(t=>t.owner===0).length===1,gs),'Gast besitzt genau sein Startgebiet als „Du“');
    ok(await G.evaluate(h=>{const o=T[h].owner;return o>0&&F[o].name==='Hosty'},hs),'Gast sieht den Host als Gegner mit Namen');
    ok(await H.evaluate(g=>T[g].owner===1&&F[1].human===true,gs),'Host führt den Gast als menschliche Fraktion 1');
    ok(await H.evaluate(()=>F.length)===4,'vier Fraktionen (Host, Gast, zwei Bots)');
    /* Befehl: Gast greift an */
    await H.evaluate(()=>{gtime=1000});
    await G.waitForFunction(()=>gtime>900,null,{timeout:5000});
    const n0=await H.evaluate(g=>T[g].troops,gs);
    await G.evaluate(g=>{const from=T[g],to=T[T[g].adj[0]];launch(from,to,2,0)},gs);
    await H.waitForFunction(()=>marches.length>0,null,{timeout:5000});ok(true,'Host führt gültigen Angriffsbefehl aus');
    ok(await H.evaluate(g=>T[g].troops,gs)<n0,'Soldaten wurden beim Host abgezogen');
    await G.waitForFunction(()=>marches.length>0,null,{timeout:5000});ok(true,'Gast sieht den Marsch im nächsten Schnappschuss');
    /* ungültige Befehle */
    const before=await H.evaluate(()=>marches.length+'/'+T.map(t=>t.troops|0).join());
    await G.evaluate(h=>{NET.cmd({k:'launch',from:h,to:T[h].adj[0],n:1});NET.cmd({k:'launch',from:-5,to:3,n:1e9});NET.cmd({k:'tr',tile:h,n:50})},hs);
    await sleep(800);
    ok(await H.evaluate(h=>T[h].owner===0,hs),'Host-Gebiet bleibt unangetastet (Befehl für fremdes Gebiet verworfen)');
    ok(await H.evaluate(()=>!marches.some(m=>m.f===0)),'kein Marsch des Hosts durch fremde Befehle ausgelöst');
    /* Host beendet → Gast erfährt es */
    await H.evaluate(()=>$('#endBtn').click());
    await G.waitForFunction(()=>over,null,{timeout:6000});ok(true,'Gast wird informiert, wenn der Host die Partie beendet');
    ok(errs.length===0,'keine pageerror: '+errs.join(' | '));
  }catch(e){ok(false,'Abbruch: '+e.message.split('\n')[0]);console.log(errs.join('\n'))}
  await b.close();srv.kill();process.exit(fails?1:0);
})();
