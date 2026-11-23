const test=require('node:test'),assert=require('node:assert');
const {Room}=require('../room');
const {createWorld}=require('../sim/world-vm');
const C=require('../config');

function mk(opts={}){
  const out=[];let empty=0;
  const room=new Room({id:'r1',mode:opts.mode||'ffa',seed:1,send:(sub,msg)=>out.push({sub,msg}),onEmpty:()=>empty++,createWorld:opts.createWorld});
  return {room,out,empty:()=>empty,of:(sub,t)=>out.filter(o=>o.sub===sub&&o.msg.t===t).map(o=>o.msg)};
}
/* gueltige Starts fuer ground/leaf aus der echten Welt */
function starts(){
  const w=createWorld({mode:'ffa',mapSeed:1,seed:1});const r={};
  for(const sp of['ground','leaf']){for(let i=0;i<5000;i++)if(w.validStart(sp,i)){r[sp]=i;break}}
  w.dispose();return r;
}
const S=starts();
const rd=(room,sub,sp)=>room.ready(sub,{name:sub,sp,start:S[sp],c:null});
function running(opts){
  const h=mk(opts);
  assert.strictEqual(h.room.join('s1','aaaa','A'),'ok');assert.strictEqual(h.room.join('s2','bbbb','B'),'ok');
  rd(h.room,'s1','ground');rd(h.room,'s2','leaf');
  h.room.tick(C.COUNTDOWN_S+1);
  return h;
}

test('countdown startet erst ab 2 bereiten Menschen und fällt zurück, wenn einer geht',()=>{
  const h=mk();const r=h.room;
  r.join('s1','aaaa','A');r.join('s2','bbbb','B');
  rd(r,'s1','ground');assert.strictEqual(r.state,'waiting');
  rd(r,'s2','leaf');assert.strictEqual(r.state,'countdown');
  assert.strictEqual(r.listing().countdown>0,true);
  r.tick(10);assert.strictEqual(r.state,'countdown');
  r.leave('s2');assert.strictEqual(r.state,'waiting');
  assert.strictEqual(h.empty(),0);
  r.tick(C.COUNTDOWN_S+5);assert.strictEqual(r.state,'waiting');
  r.leave('s1');assert.strictEqual(h.empty(),1);
});

test('init geht an alle, jeder sieht fids für alle pids und hp null',()=>{
  const h=running();
  for(const sub of['s1','s2']){
    const i=h.of(sub,'init');assert.strictEqual(i.length,1);
    assert.deepStrictEqual(i[0].fids,{aaaa:1,bbbb:2});
    assert.strictEqual(i[0].hp,null);assert.ok(Array.isArray(i[0].Fi));assert.ok(i[0].d);
  }
  assert.strictEqual(h.room.state,'running');
  h.room.tick(1);assert.ok(h.of('s1','snap').length>=1);
  h.room.leave('s1');h.room.leave('s2');
});

test('Abbruch: nach 29 s Rückkehr mit neuem pid bekommt dieselbe Fraktion, nach 31 s ist sie Bot',()=>{
  let h=running();
  h.room.leave('s2');h.room.tick(29);
  assert.strictEqual(h.room.join('s2','cccc','B'),'ok');
  const i=h.of('s2','init');assert.strictEqual(i.length,2);
  assert.deepStrictEqual(i[1].fids,{aaaa:1,cccc:2});assert.strictEqual(i[1].Fi[2].hum,1);
  h.room.tick(60);assert.strictEqual(h.room.state,'running');
  h.room.leave('s1');h.room.leave('s2');
  h=running();
  h.room.leave('s2');h.room.tick(31);
  assert.strictEqual(h.room.join('s2','cccc','B'),'started');
  h.room.tick(0.5);
  const s=h.of('s1','snap').pop();assert.ok(s);
  assert.strictEqual(h.room.state,'running');
});

test('Bot nach Frist: Fraktion nicht mehr menschlich',()=>{
  const worlds=[];
  const h=running({createWorld:o=>{const w=createWorld(o);worlds.push(w);return w}});
  h.room.leave('s2');h.room.tick(31);
  assert.strictEqual(worlds[0].initInfo().Fi[2].hum,0);
  assert.strictEqual(worlds[0].initInfo().Fi[1].hum,1);
  h.room.leave('s1');
});

test('feindliche Befehle werden ignoriert und werfen nicht',()=>{
  const h=running();const r=h.room;const w=h;
  const ns=[NaN,-1,0,1.5,1e9,'5',null,undefined,{},[]],ids=[-1,99999,'a',null,2.5,undefined,{},NaN];
  const before=JSON.stringify(h.of('s1','snap'));
  assert.doesNotThrow(()=>{
    for(const n of ns)r.cmd('s1',{k:'launch',from:S.ground,to:S.leaf,n});
    for(const a of ids)for(const b of ids){r.cmd('s1',{k:'launch',from:a,to:b,n:1});r.cmd('s1',{k:'tr',tile:a})}
    r.cmd('s1',{k:'launch',from:S.ground,to:S.leaf,n:1});     /* nicht benachbart */
    r.cmd('s1',{k:'launch',from:S.leaf,to:S.ground,n:1});     /* fremdes Gebiet */
    r.cmd('nobody',{k:'launch',from:S.ground,to:S.leaf,n:1});
    for(const bad of[null,undefined,5,'x',[],{k:'zzz'},{k:'launch'},{__proto__:{k:'tr'}}])r.cmd('s1',bad);
    r.cmd('s1',{k:'tr',tile:S.leaf});
  });
  r.tick(0.1);
  r.leave('s1');r.leave('s2');
  const h2=mk();h2.room.join('s1','aaaa','A');
  assert.doesNotThrow(()=>{h2.room.cmd('s1',{k:'launch',from:0,to:1,n:1});h2.room.cmd('s1',{k:'tr',tile:S.ground})});
  assert.strictEqual(h2.room.state,'waiting');
  h2.room.leave('s1');
});

test('tr-Dauerfeuer: 100 Befehle in einer Sekunde erhöhen die Truppen um höchstens 12+6',()=>{
  let okCount=0;
  const h=running({createWorld:o=>{const w=createWorld(o);const t=w.troopTick;w.troopTick=(...a)=>{const r=t(...a);if(r)okCount++;return r};return w}});
  for(let i=0;i<100;i++){h.room.cmd('s1',{k:'tr',tile:S.ground});h.room.tick(0.01)}
  assert.ok(okCount>=1&&okCount<=18,'ok '+okCount);
  h.room.leave('s1');h.room.leave('s2');
});

test('leerer Raum ruft onEmpty einmal und danach keine Timer mehr',()=>{
  let steps=0,disposed=0;
  const fake=()=>({initWorld(){},adj:()=>[],step(){steps++},snap:()=>({gt:0,sp:1,T:[],F:[0,1,1],C:[0,0,0],M:[]}),initInfo:()=>({Fi:[{},{hum:1},{hum:1}],d:'x',gt:0}),
    launch:()=>false,troopTick:()=>false,validStart:()=>true,over:()=>({over:false,winnerFid:null}),setBot(){},dispose(){disposed++}});
  const h=mk({createWorld:fake});const r=h.room;
  r.join('s1','aaaa','A');r.join('s2','bbbb','B');rd(r,'s1','ground');rd(r,'s2','leaf');
  r.tick(C.COUNTDOWN_S+1);assert.strictEqual(r.state,'running');
  r.leave('s1');r.leave('s2');r.tick(C.GRACE_S+1);
  assert.strictEqual(h.empty(),1);assert.strictEqual(disposed,1);
  const n=steps;r.tick(10);r.tick(10);r.leave('s1');
  assert.strictEqual(steps,n);assert.strictEqual(h.empty(),1);assert.strictEqual(disposed,1);
});

test('Raum voll und gestartet',()=>{
  const h=mk();
  for(let i=0;i<C.MAX_HUMANS;i++)assert.strictEqual(h.room.join('s'+i,'p'+('000'+i).slice(-4),'N'),'ok');
  assert.strictEqual(h.room.join('x','zzzz','N'),'full');
  assert.strictEqual(h.room.join('s0','dup1','N'),'ok');
  const g=running();assert.strictEqual(g.room.join('neu','qqqq','N'),'started');
  g.room.leave('s1');g.room.leave('s2');
});
