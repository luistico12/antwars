/* Anonyme Anmeldung am Server aus → Server bleibt aktiv, Registrieren funktioniert (kein „Kein Server konfiguriert“). */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"}',contentType:'text/javascript'}));
  await pg.route('**/supabase.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>{window.__calls=[];return{auth:{
    getSession:async()=>({data:{session:null}}),signInAnonymously:async()=>({data:null,error:{message:'Anonymous sign-ins are disabled'}}),
    onAuthStateChange(){},signUp:async(a)=>{__calls.push(['signUp',a.email]);return{error:null}}}}}}`}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  ok(await pg.evaluate(()=>AW.remote&&API===Remote),'Server bleibt aktiv, kein Wechsel auf Gastmodus');
  await pg.waitForSelector('#lgF');
  ok(/nicht aktiviert|not enabled/.test(await pg.textContent('#login')),'Hinweis, dass anonymes Spielen am Server aus ist');
  await pg.click('[data-m=up]');await pg.fill('#lgN','Tester');await pg.fill('#lgE','a@b.de');await pg.fill('#lgP','passwort123');await pg.click('#lgF button[type=submit]');
  await pg.waitForSelector('#lgMsg .msg.ok');
  ok(await pg.evaluate(()=>__calls.some(c=>c[0]==='signUp'&&c[1]==='a@b.de')),'Registrierung geht an den Server');
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
