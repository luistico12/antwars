/* Gleichwertigkeit: dasselbe Szenario im echten Browser und im Server-vm liefert denselben snap()-Text (Schritt 100 und 600). */
const {chromium}=require('playwright');const path=require('path');const {execFileSync}=require('child_process');const {seeded}=require('./helpers/prng');
(async()=>{
  const srv=JSON.parse(execFileSync('node',[path.resolve(__dirname,'../server/test/emit-scenario.js')],{encoding:'utf8',maxBuffer:1<<28}));
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:800}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  const br=await pg.evaluate(`(function(){
    modeKey='ffa';Math.random=(${seeded.toString()})(1);newMap(1);
    const first=sp=>T.find(t=>t.terrain===SP[sp].terr).id,a=first('ground'),bb=first('leaf');
    Math.random=(${seeded.toString()})(1);
    initWorld({hostStart:null,humans:[{pid:'a',name:'A',species:'ground',start:a,fid:1},{pid:'b',name:'B',species:'leaf',start:bb,fid:2}]});
    const out={};
    for(let i=1;i<=1200;i++){
      if(i===50)out.l50=launch(T[a],T[T[a].adj[0]],2,1)!==false;
      if(i===950)out.l950=launch(T[a],T[T[a].adj[0]],2,1)!==false;
      updateWorld(0.1);
      if(i===100||i===600||i===1200)out['s'+i]=JSON.stringify(NET.snap());
    }
    return out})()`);
  await b.close();
  let fails=errs.length;errs.forEach(e=>console.log('FAIL pageerror '+e));
  for(const k of ['l50','l950','s100','s600','s1200']){const c=br[k]===srv[k]&&br[k]!==undefined;console.log((c?'PASS ':'FAIL ')+k);if(!c){fails++;console.log(' browser '+String(br[k]).slice(0,300));console.log(' server  '+String(srv[k]).slice(0,300))}}
  process.exit(fails?1:0);
})();
