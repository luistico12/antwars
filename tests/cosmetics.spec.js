/* Kronen, Muster, Schiffe: Shop, Inventar, Ausrüsten, Zeichnen auf der Weltkarte. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1400,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  ok(await pg.evaluate(()=>['crown','pattern','ship'].every(k=>SHOP.some(i=>i.kind===k))),'Shop kennt Kronen, Muster, Schiffe');
  ok(await pg.evaluate(()=>Object.values(CROWN_ART).every(a=>a.m.every(r=>r.length===13))&&Object.values(SHIP_ART).every(a=>a.m.every(r=>r.length===14))),'Pixel-Masken haben einheitliche Breite');
  await pg.evaluate(()=>{AW.profile.rubys=500;return Promise.all(SHOP.filter(i=>['crown','pattern','ship'].includes(i.kind)).map(i=>AW.buy(i.id)))});
  await pg.evaluate(()=>{UI.shopTab='crown';openScreen('shop')});await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>document.querySelectorAll('.shopit canvas').length===7),'Kronen-Tab zeigt 7 Vorschauen');
  await pg.screenshot({path:'/tmp/shop_crown.png'});
  await pg.evaluate(()=>{UI.shopTab='ship';render()});await pg.waitForTimeout(100);await pg.screenshot({path:'/tmp/shop_ship.png'});
  await pg.evaluate(()=>{UI.shopTab='pattern';render()});await pg.waitForTimeout(100);await pg.screenshot({path:'/tmp/shop_pattern.png'});
  await pg.evaluate(async()=>{await AW.update({crown:'prism',pattern:'hearts',ship:'viking'})});
  ok(await pg.evaluate(()=>COSM.crown==='prism'&&COSM.pattern==='hearts'&&COSM.ship==='viking'),'Ausrüsten setzt COSM');
  let bad=false;try{await pg.evaluate(()=>AW.update({crown:'nope'}))}catch(e){bad=true}
  ok(bad,'Nicht besessene Krone lässt sich nicht ausrüsten');
  await pg.evaluate(()=>{closeScreens();UI.invTab='crown';openScreen('inventory')});await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>/Prisma/.test(document.body.innerText)),'Inventar zeigt Krone');
  await pg.evaluate(()=>closeScreens());
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id);startGame()});await pg.waitForTimeout(500);
  await pg.evaluate(()=>{setSpeedUI(0);setView('map');const mine=T.filter(t=>t.owner===0);const t=T.find(x=>x.owner!==0&&x.isCap);
    /* Spieler zum Führer machen */ T.forEach(x=>{if(x.owner!==0&&x.owner>=0)x.owner=-1});T.slice(0,25).forEach(x=>{if(x.owner<0)x.owner=0});ownDirty=true;_lead.t=0});
  await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>leaderFid(performance.now()+1000)===0),'Spieler ist Gebietsführer');
  await pg.screenshot({path:'/tmp/world_cosm.png'});
  ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
