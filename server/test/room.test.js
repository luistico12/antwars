const test=require('node:test'),assert=require('node:assert');
const {Room}=require('../room');
const {createWorld}=require('../sim/world-vm');
const C=require('../config');

function mk(opts={}){
  const out=[];let empty=0;
  const room=new Room({id:'r1',mode:opts.mode||'classic',seed:1,send:(sub,msg)=>out.push({sub,msg}),onEmpty:()=>empty++,createWorld:opts.createWorld});
  return {room,out,empty:()=>empty,of:(sub,t)=>out.filter(o=>o.sub===sub&&o.msg.t===t).map(o=>o.msg)};
}
/* gueltige Starts fuer ground/leaf aus der echten Welt */
function starts(){
  const w=createWorld({mode:'classic',mapSeed:1,seed:1});const r={};
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

/* Schutzzeit (normal: 90 s) ablaufen lassen, damit Angriffe grundsaetzlich erlaubt sind */
function aged(){const h=running();for(let i=0;i<95;i++)h.room.tick(1);assert.strictEqual(h.room.state,'running');return h}

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
    const w=h.room.world.snap();
    assert.ok(Array.isArray(i[0].T)&&i[0].T.length===w.T.length);assert.deepStrictEqual(i[0].T[S.ground],w.T[S.ground]);
    assert.strictEqual(i[0].T[S.ground][0],1);assert.strictEqual(i[0].T[S.leaf][0],2);
    assert.deepStrictEqual(i[0].F,w.F);assert.deepStrictEqual(i[0].C,w.C);assert.strictEqual(typeof i[0].gt,'number');
    assert.ok(Array.isArray(i[0].M));
    assert.strictEqual(typeof i[0].Fi[1].c,'object');assert.ok('c' in i[0].Fi[2]);
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
  assert.ok(Array.isArray(i[1].T)&&Array.isArray(i[1].F)&&Array.isArray(i[1].C));
  assert.deepStrictEqual(i[1].T,h.room.world.snap().T);   /* aktueller Zustand, nicht der vom Start */
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
  const h=aged();const r=h.room;
  const ns=[NaN,-1,0,1.5,1e9,'5',null,undefined,{},[]],ids=[-1,99999,'a',null,2.5,undefined,{},NaN];
  const state=()=>{const x=r.world.snap();return JSON.stringify({T:x.T,M:x.M,F:x.F})};
  const before=state();
  assert.doesNotThrow(()=>{
    for(const n of ns)r.cmd('s1',{k:'launch',from:S.ground,to:S.leaf,n});
    for(const a of ids)for(const b of ids){r.cmd('s1',{k:'launch',from:a,to:b,n:1});r.cmd('s1',{k:'tr',tile:a})}
    r.cmd('s1',{k:'launch',from:S.ground,to:S.leaf,n:1});     /* nicht benachbart */
    r.cmd('s1',{k:'launch',from:S.leaf,to:S.ground,n:1});     /* fremdes Gebiet */
    r.cmd('s1',{k:'launch',from:S.leaf,to:r.world.adj(S.leaf)[0],n:1});  /* fremdes Gebiet, benachbartes Ziel */
    r.cmd('s1',{k:'launch',from:S.ground,to:r.world.adj(S.ground)[0],n:99});  /* mehr als vorhanden */
    r.cmd('nobody',{k:'launch',from:S.ground,to:S.leaf,n:1});
    for(const bad of[null,undefined,5,'x',[],{k:'zzz'},{k:'launch'},{__proto__:{k:'tr'}}])r.cmd('s1',bad);
    r.cmd('s1',{k:'tr',tile:S.leaf});
  });
  assert.strictEqual(state(),before,'feindliche Befehle duerfen Truppen, Besitzer und Maersche nicht aendern');
  r.tick(0.1);
  r.leave('s1');r.leave('s2');
  const h2=mk();h2.room.join('s1','aaaa','A');
  assert.doesNotThrow(()=>{h2.room.cmd('s1',{k:'launch',from:0,to:1,n:1});h2.room.cmd('s1',{k:'tr',tile:S.ground})});
  assert.strictEqual(h2.room.state,'waiting');
  h2.room.leave('s1');
});

test('Kontrollfall: ein legitimer Angriff veraendert den Zustand',()=>{
  const h=aged();const r=h.room;
  const x=r.world.snap();let ok=false;
  const before=JSON.stringify({T:x.T,M:x.M});
  for(let i=0;i<x.T.length&&!ok;i++)if(x.T[i][0]===1&&x.T[i][1]>=3)for(const t of r.world.adj(i))if(x.T[t][0]!==1){ok=r.world.launch(1,i,t,1);if(ok)break}
  assert.ok(ok,'legitimer Start muss klappen');
  const y=r.world.snap();
  assert.notStrictEqual(JSON.stringify({T:y.T,M:y.M}),before);
  r.leave('s1');r.leave('s2');
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

test('room und init enthalten seed und mode des Raums',()=>{
  const h=mk({mode:'fast'});h.room.join('s1','aaaa','A');
  const r=h.of('s1','room')[0];assert.strictEqual(r.seed,1);assert.strictEqual(r.mode,'fast');
  const g=running({mode:'fast'});const i=g.of('s1','init')[0];assert.strictEqual(i.seed,1);assert.strictEqual(i.mode,'fast');
});

test('Squatter: Spieler ohne ready fliegt nach READY_TIMEOUT_S raus, Pong ändert nichts; Bereite bleiben',()=>{
  const h=mk();
  h.room.join('sq','aaaa','Sq');h.room.join('ok','bbbb','Ok');rd(h.room,'ok','ground');
  h.room.tick(C.READY_TIMEOUT_S-1);
  assert.ok(h.room.humans.has('sq'));
  h.room.tick(2);
  assert.ok(!h.room.humans.has('sq'));assert.ok(h.room.humans.has('ok'));
  assert.deepStrictEqual(h.of('sq','err').map(m=>m.why),['room']);
  /* Platz ist wieder frei */
  assert.strictEqual(h.room.join('neu','cccc','N'),'ok');
});
test('Squatter allein im Raum: Raum wird geschlossen; im Countdown ebenso',()=>{
  const h=mk();h.room.join('sq','aaaa','Sq');h.room.tick(C.READY_TIMEOUT_S+1);
  assert.strictEqual(h.empty(),1);
  const c=mk();c.room.join('a','aaaa','A');c.room.join('b','bbbb','B');c.room.join('z','zzzz','Z');
  rd(c.room,'a','ground');rd(c.room,'b','leaf');
  assert.strictEqual(c.room.state,'countdown');
  c.room.tick(C.READY_TIMEOUT_S+1);
  assert.ok(!c.room.humans.has('z'));
});
test('Rooms.tick: werfender Raum wird beendet, andere laufen weiter',()=>{
  const {Rooms}=require('../rooms');
  const out=[];let errs=0;
  const rooms=new Rooms({config:C,send:(s,m)=>out.push({s,m}),onError:()=>errs++});
  const a=rooms.join('a','aaaa','A','classic').room;
  const b=rooms.join('b','bbbb','B','fast').room;
  const c=rooms.join('c','cccc','C','chaos').room;
  let ticks=0;const ob=c.tick.bind(c);c.tick=dt=>{ticks++;return ob(dt)};
  b.tick=()=>{throw new Error('kaputt')};
  rooms.tick(0.1);
  assert.strictEqual(errs,1);
  assert.ok(b._closed);assert.ok(!rooms.rooms.has(b.id));
  assert.ok(out.some(o=>o.s==='b'&&o.m.t==='end'));
  assert.ok(!a._closed&&!c._closed);assert.strictEqual(ticks,1);
  assert.strictEqual(rooms.roomOf('b'),null);
  rooms.tick(0.1);assert.strictEqual(ticks,2);
  rooms.dispose();
});
