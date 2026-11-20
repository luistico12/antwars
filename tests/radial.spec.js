/* Angriffskreis: Schwert in der Mitte, Segmente je nach Lage (wild / Bot / verbündet), Info bleibt offen, Material-Spende wirkt. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1100,height:760}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id)});await pg.click('#btnStart');
  await pg.evaluate(()=>{gtime=999;setSpeedUI(0);setView('map')});
  const open=(owner,ally)=>pg.evaluate(([o,al])=>{const t=T.find(x=>x.owner===o);if(o>0)F[o].allied=al;terrAtEvent=()=>t.id;openRadial({clientX:560,clientY:380});
    return[...document.querySelectorAll('#radial [data-r]')].map(e=>e.dataset.r+(e.classList.contains('dis')?'!':'')).join(',')},[owner,ally]);
  const keys=s=>s.replace(/!/g,'');
  ok(keys(await open(-1,false))==='info,ship,atk','wilde Ameisen: Info, Floß-Angriff, Angriff');
  ok(keys(await open(1,false))==='info,ally,ship,atk','Bot ohne Bündnis: Info, Bündnis, Floß-Angriff, Angriff');
  ok(keys(await open(1,true))==='info,troops,brk,mat,ship,atk','Verbündet: Info, Truppen, Bündnis lösen, Material, Floß, Angriff');
  ok(/!/.test((await open(1,true)).split(',').find(x=>x.startsWith('atk'))),'Angriff auf Verbündete ist gesperrt');
  await pg.click('#radial [data-r=info]');
  ok(!(await pg.$eval('#radial',e=>e.hidden))&&/Gebiete/.test(await pg.textContent('#radialWhy')),'Info zeigt Daten und lässt den Kreis offen');
  const m0=await pg.evaluate(()=>{G.mat=100;return G.mat});
  await pg.evaluate(()=>{const t=T.find(x=>x.owner===1);window.__t0=t.troops});
  await pg.click('#radial [data-r=mat]');
  ok(await pg.evaluate(()=>G.mat)===m0-30&&await pg.evaluate(()=>T.find(x=>x.owner===1).troops-__t0)===3,'Material spenden: −30 Material, +3 Soldaten beim Verbündeten');
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
