/* Playwright-Test (Node): node tests/accounts.spec.js – prüft lokale Konten mit Name#Tag im Offline-Modus */
const {chromium}=require('playwright');const path=require('path');
const url='file://'+path.resolve(__dirname,'../index.html');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto(url);await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  ok(await pg.$eval('#login',e=>e.hidden||!e.querySelector('#lgF')),'kein Login-Zwang beim Start');
  ok(/^.{2,20}#\d{4}$/.test(await pg.evaluate(()=>AW.fullName)),'Name#Tag-Format');
  const t1=await pg.evaluate(()=>AW.tag);
  await pg.evaluate(()=>AW.update({username:'Max #Mustermann  '}));
  ok(await pg.evaluate(()=>AW.name)==='Max Mustermann','Name bereinigt (# und Leerzeichen)');
  ok(/^\d{4}$/.test(await pg.evaluate(()=>AW.tag)),'neuer Tag ist vierstellig');
  const err=await pg.evaluate(()=>AW.update({username:'#'}).then(()=>null,e=>e.message));
  ok(err==='Name zu kurz','zu kurzer Name wird abgelehnt');
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
