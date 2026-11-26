/* Update v13: Einstellungen, Inventar, Spieler des Tages, Angriffsrahmen, Quest-Anzeige. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1400,height:800}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  ok(await pg.evaluate(()=>!!document.querySelector('#rail [data-s="inventory"]')),'Inventar-Knopf im Menü');
  await pg.evaluate(()=>openScreen('inventory'));
  ok(await pg.evaluate(()=>/Inventar|Inventory/.test(document.body.innerText)),'Inventar-Screen öffnet');
  await pg.evaluate(()=>closeScreens());
  await pg.evaluate(()=>{openSet();setTab='gfx';renderSet()});
  const g=await pg.evaluate(()=>document.querySelector('#setBox').innerText);
  ok(/VSync/.test(g)&&/FPS-Limit/.test(g)&&/Ultra/.test(g),'Grafik-Tab: VSync, FPS-Limit, Qualität');
  await pg.evaluate(()=>{ST.q='ultra';ST.density=QUAL.ultra.d;applyDensity();ST.fpsMax=30;ST.ui=115;applyUI();ST.pct=40;saveST()});
  ok(await pg.evaluate(()=>RD===2.5),'Ultra setzt Renderdichte 2,5');
  await pg.evaluate(()=>{$('#set').hidden=true});
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id)});
  await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>pct===40&&$('#pct').value==='40'),'Standard-Truppenanteil wird übernommen');
  await pg.evaluate(()=>flashHit());
  ok(await pg.evaluate(()=>$('#hitFrame').classList.contains('on')),'roter Rahmen blitzt');
  const f0=await pg.evaluate(()=>new Promise(r=>{let n=0;const t=performance.now();const f=()=>{n++;performance.now()-t<1000?nextFrame(f):r(n)};nextFrame(f)}));
  ok(f0>5,`Ohne VSync läuft die Schleife (${f0} Aufrufe/s)`);
  await pg.evaluate(()=>{achieveAnim(['q','daily','x',5,10,'Testquest','desc','trophy'])});
  ok(await pg.evaluate(()=>!document.querySelector('#qLive')&&$$('.qAch').length>0),'Kein Quest-Knopf im Spiel, Erfolgsmeldung erscheint');
  await pg.evaluate(()=>document.querySelector('.qAch').click());
  ok(await pg.evaluate(()=>$$('.qAch').length===0),'Erfolgsmeldung lässt sich wegklicken');
  /* Unlimited: große Kolonie */
  await pg.evaluate(()=>{modeKey='unlimited';started=false;over=false;newMap(5)});
  await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id);startGame()});
  await pg.waitForTimeout(500);
  const big=await pg.evaluate(()=>{setSpeedUI(0);setView('colony');for(let i=0;i<20;i++)drawColony(cg,i*50,ccam);return[COLS,ROWS,ENT_C,col.grid.length]});
  ok(big[0]===80&&big[3]===80*(12+44),'Unlimited: Kolonie 80 Spalten, '+big.join(','));
  ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
