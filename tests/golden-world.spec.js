/* Goldenes Weltprotokoll: festes Einzelspiel (SEED=1), NET.snap() bei Schritt 300/600/1200. GOLDEN=update schreibt neu. */
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');const {seeded}=require('./helpers/prng');
const FILE=path.resolve(__dirname,'golden/world-seed1.json');
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:800}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(`Math.random=(${seeded.toString()})(1);`);
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  const snaps=await pg.evaluate(()=>{
    newMap(1);const sp=SP[setupSp];setupStart=T.find(t=>t.terrain===sp.terr).id;startGame();
    const out={};
    for(let i=1;i<=1200;i++){
      if(i===100||i===400){const cap=T[F[0].capital],nb=cap.adj[0];launch(cap,T[nb],Math.floor(cap.troops)-1,0)}
      updateWorld(0.1);
      if(i===300||i===600||i===1200)out[i]=JSON.stringify(NET.snap());
    }
    return out;
  });
  await b.close();
  let fails=errs.length;errs.forEach(e=>console.log('FAIL pageerror '+e));
  if(process.env.GOLDEN==='update'){fs.writeFileSync(FILE,JSON.stringify(snaps,null,1));console.log('golden geschrieben')}
  else{const g=JSON.parse(fs.readFileSync(FILE,'utf8'));for(const k of Object.keys(g)){const c=g[k]===snaps[k];console.log((c?'PASS ':'FAIL ')+'Schritt '+k);if(!c)fails++}}
  process.exit(fails?1:0);
})();
