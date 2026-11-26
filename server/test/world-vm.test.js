const test=require('node:test'),assert=require('node:assert');
const {createWorld}=require('../sim/world-vm');
const find=(w,sp,skip)=>{for(let i=0;i<5000;i++){if(i===skip)continue;if(w.validStart(sp,i))return i}throw new Error('kein Start fuer '+sp)};
test('Welt mit zwei Menschen: Platzhalter 0, Starts, lebende Fraktionen, Zeitlauf',()=>{
  const w=createWorld({mode:'classic',mapSeed:1,seed:1});
  const a=find(w,'ground'),b=find(w,'leaf');
  w.initWorld([{pid:'a',name:'A',species:'ground',start:a,c:null},{pid:'b',name:'B',species:'leaf',start:b,c:null}]);
  let s=w.snap();
  assert.strictEqual(s.F[0],0);
  assert.strictEqual(s.T[a][0],1);assert.strictEqual(s.T[b][0],2);
  assert.strictEqual(s.F.filter(x=>x).length,Math.max(2+1,1+7));
  assert.strictEqual(s.F.filter(x=>x).length,8);
  for(let i=0;i<600;i++)w.step(0.1);
  s=w.snap();assert.ok(Math.abs(s.gt-60)<=0.1,'gt '+s.gt);
  assert.strictEqual(w.launch(1,a,b,5),false);
  assert.strictEqual(w.launch(2,a,b,5),false);
  assert.strictEqual(w.initInfo().Fi[0].n,'Server');
  assert.deepStrictEqual(w.over().over,false);
  w.dispose();
});
test('gleicher Seed gleiche Welt, anderer Seed andere',()=>{
  const mk=seed=>{const w=createWorld({mode:'classic',mapSeed:1,seed});
    w.initWorld([{pid:'a',name:'A',species:'ground',start:find(w,'ground'),c:null}]);
    for(let i=0;i<300;i++)w.step(0.1);const r=JSON.stringify(w.snap());w.dispose();return r};
  assert.strictEqual(mk(5),mk(5));assert.notStrictEqual(mk(5),mk(6));
});
test('troopTick: Zeit wird eingespeist, Eimer 12, +6/s',()=>{
  const w=createWorld({mode:'classic',mapSeed:1,seed:1});
  const a=find(w,'ground'),b=find(w,'leaf');
  w.initWorld([{pid:'a',name:'A',species:'ground',start:a,c:null},{pid:'b',name:'B',species:'leaf',start:b,c:null}]);
  let ok=0;for(let i=0;i<100;i++)if(w.troopTick(1,a,1000))ok++;
  assert.ok(ok<=12&&ok>=1,'ok '+ok);
  assert.strictEqual(w.troopTick(1,a,NaN),false);
  w.dispose();
});
