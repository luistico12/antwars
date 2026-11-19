/* Friends-UI-Test: Remote-Backend mit gemocktem Supabase-RPC (die SQL-Logik wird separat gegen Postgres geprüft). */
const {chromium}=require('playwright');const path=require('path');
const url='file://'+path.resolve(__dirname,'../index.html');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto(url);await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  await pg.click('#nmSkip');
  /* Gastmodus: Screen öffnet, Anfrage wird mit klarer Meldung abgelehnt */
  await pg.click('#rail [data-s=friends]');await pg.waitForSelector('#frF');
  await pg.fill('#frI','Anna#1234');await pg.click('#frF button[type=submit]');
  ok(/Server/.test(await pg.textContent('#frMsg')),'Gastmodus meldet: Freunde brauchen Server');
  /* Remote mit Mock */
  await pg.evaluate(()=>{
    const rows=[{id:'f1',other_id:'u2',username:'Bob',tag:'0042',status:'accepted',incoming:false},{id:'f2',other_id:'u3',username:'Cara',tag:'0007',status:'pending',incoming:true},{id:'f3',other_id:'u4',username:'Dan',tag:'0099',status:'pending',incoming:false}];
    window.__calls=[];
    AW.sb={rpc:async(n,a)=>{__calls.push([n,a]);if(n==='my_friends')return{data:rows.slice()};if(n==='friend_respond'){const r=rows.find(x=>x.id===a.fid);if(a.acc)r.status='accepted';else rows.splice(rows.indexOf(r),1)}if(n==='friend_remove')rows.splice(rows.findIndex(x=>x.id===a.fid),1);return{data:'ok'}}};
    API=Remote;AW.user={id:'me',is_anonymous:true};UI.friends=null;render();
  });
  await pg.waitForSelector('[data-fa]');
  ok(await pg.$$eval('.li',l=>l.length)===3,'Liste zeigt Freund, Anfrage, gesendete Anfrage');
  await pg.fill('#frI','Eva#0001');await pg.click('#frF button[type=submit]');
  await pg.waitForFunction(()=>__calls.some(c=>c[0]==='friend_request'));
  ok(await pg.evaluate(()=>JSON.stringify(__calls.find(c=>c[0]==='friend_request')[1]))==='{"n":"Eva","tg":"0001"}','Anfrage sendet Name und Tag getrennt');
  await pg.fill('#frI','ohne-tag');await pg.click('#frF button[type=submit]');
  ok(/Format/.test(await pg.textContent('#frMsg')),'Eingabe ohne #Tag wird abgelehnt');
  await pg.click('[data-fa]');await pg.waitForFunction(()=>!document.querySelector('[data-fa]'));
  ok(await pg.$$eval('[data-fr]',l=>l.length)===3,'Anfrage angenommen → drei Einträge mit Entfernen-Knopf');
  await pg.click('[data-fr]');await pg.waitForFunction(()=>document.querySelectorAll('[data-fr]').length===2);
  ok(true,'Freund entfernt');
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
