const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1280,height:800}}),errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
await pg.goto('file://'+__dirname+'/../index.html');await pg.waitForTimeout(800);
for(const tab of ['daily','weekly','career','event']){await pg.evaluate(t=>{UI.achTab=t;openScreen('achievements')},tab);await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>!!document.querySelector('.qx-body')&&document.querySelector('.qx-body').innerHTML.length>50),'Erfolge-Tab '+tab);
  if(tab==='daily')await pg.screenshot({path:'/tmp/shots/q-daily.png'});if(tab==='career'){ok(await pg.evaluate(()=>document.querySelectorAll('.qx-cc').length>=11),'Karriere zeigt Karten');await pg.screenshot({path:'/tmp/shots/q-career.png'})}}
for(const t of ['stats','hist','acc']){await pg.evaluate(t=>{UI.profTab=t;openScreen('profile')},t);await pg.waitForTimeout(150);ok(await pg.evaluate(()=>!!document.querySelector('.pf-r')&&document.querySelector('.pf-r').innerHTML.length>30),'Profil-Tab '+t);if(t==='stats')await pg.screenshot({path:'/tmp/shots/p-stats.png'})}
ok(await pg.evaluate(()=>{Hist.begin();Hist.end(true);return Hist.list()[0].res==='win'}),'Spielverlauf speichert Ergebnis');
await pg.evaluate(()=>{UI.profTab='hist';openScreen('profile')});await pg.waitForTimeout(150);ok(await pg.evaluate(()=>!!document.querySelector('.pf-g')),'Letzte Spiele zeigt Eintrag');
ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));await b.close();process.exit(fails?1:0)})();
