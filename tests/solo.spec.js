/* Einzelspiel-Smoketest: Start ohne Anmeldung, 3 Bots, Welt läuft ohne Fehler. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  const sk=await pg.$('#nmSkip');if(sk)await sk.click();
  const ck=await pg.$('#ckAll');if(ck)await ck.click();
  await pg.click('#hSolo');
  await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id)});
  await pg.click('#btnStart');
  ok(await pg.evaluate(()=>started&&F.length===4&&F.filter(f=>!f.isPlayer&&!f.human).length===3),'Einzelspiel startet mit 3 Bots');
  await pg.evaluate(()=>{gtime=500;for(let i=0;i<300;i++)updateWorld(0.1)});
  ok(true,'Welt läuft 30 s Spielzeit');
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
