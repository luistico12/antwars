/* SVG-Skins: Katalog, Shop-Tabs, Ausrüsten, Zeichnen auf der Weltkarte. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1400,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  ok(await pg.evaluate(()=>['crown','pattern','ship','hat','bskin','tskin','rskin'].every(k=>SHOP.some(i=>i.kind===k))),'Shop kennt alle Kosmetik-Arten');
  ok(await pg.evaluate(()=>HAT_IDS.length>=16&&CROWN_IDS.length>=12&&SHIP_IDS.length>=9&&Object.keys(PATTERN_FN).length>=10),'Katalog ist deutlich gewachsen');
  ok(await pg.evaluate(()=>CROWN_IDS.every(id=>crownURL(id).endsWith('/crowns/'+id+'.svg'))),'Kronen-Bilder zeigen auf SVG-Dateien');
  await pg.evaluate(()=>{AW.profile.rubys=50000;return Promise.all(SHOP.map(i=>AW.buy(i.id)))});
  for(const [tab,sel,min] of [['hat','img.cos',16],['crown','img.cos',12],['ship','img.cos',9],['pattern','canvas',10]]){
    await pg.evaluate(t=>{UI.shopTab=t;openScreen('shop')},tab);await pg.waitForTimeout(300);
    const n=await pg.evaluate(s=>document.querySelectorAll('.shopit '+s).length,sel);
    ok(n>=min,`Shop-Tab ${tab}: ${n} Vorschauen`);
    if(sel==='img.cos'){await pg.waitForTimeout(300);
      ok(await pg.evaluate(()=>[...document.querySelectorAll('.shopit img.cos')].every(i=>i.naturalWidth>0)),`Shop-Tab ${tab}: alle SVG geladen`)}
  }
  await pg.screenshot({path:'/tmp/shop_crown.png'});
  await pg.evaluate(async()=>{await AW.update({crown:'prism',pattern:'hearts',ship:'viking',hat:'viking'})});
  ok(await pg.evaluate(()=>COSM.crown==='prism'&&COSM.pattern==='hearts'&&COSM.ship==='viking'&&COSM.hat==='viking'),'Ausrüsten setzt COSM');
  let bad=false;try{await pg.evaluate(()=>AW.update({crown:'nope'}))}catch(e){bad=true}
  ok(bad,'Nicht besessene Krone lässt sich nicht ausrüsten');
  await pg.evaluate(()=>{closeScreens();UI.invTab='crown';openScreen('inventory')});await pg.waitForTimeout(350);
  ok(await pg.evaluate(()=>/Prisma/.test(document.body.innerText)),'Inventar zeigt Krone');
  await pg.evaluate(()=>closeScreens());
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id);startGame()});await pg.waitForTimeout(900);
  await pg.evaluate(()=>{setSpeedUI(0);setView('map');T.forEach(x=>{if(x.owner!==0&&x.owner>=0)x.owner=-1});T.slice(0,25).forEach(x=>{if(x.owner<0)x.owner=0});ownDirty=true;_lead.t=0});
  await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>leaderFid(performance.now()+1000)===0),'Spieler ist Gebietsführer');
  ok(await pg.evaluate(()=>{const im=skinImg('crown','prism');return !!im&&im.complete&&im.naturalWidth>0}),'Kronen-SVG ist im Spiel geladen');
  await pg.screenshot({path:'/tmp/world_cosm.png'});
  ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
