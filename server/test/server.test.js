const test=require('node:test'),assert=require('node:assert');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const WebSocket=require('ws');
const {start}=require('../index');
const {createVerifier}=require('../auth');
const O='https://ok.example';
const fake=async t=>{if(typeof t==='string'&&t.startsWith('tok:'))return{sub:t.slice(4),anon:false};throw new Error('auth')};
const CFG={HOST:'127.0.0.1',ALLOWED_ORIGINS:[O],AUTH_MS:300};
async function srv(extra={},o={}){return start({port:0,verify:o.verify||fake,now:o.now||Date.now,blocklistPath:o.blocklistPath,config:{...CFG,...extra}})}
function wsOpen(h,opt={}){
  return new Promise((res,rej)=>{
    const ws=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O,...(opt.headers||{})}});
    ws.msgs=[];ws.on('message',d=>ws.msgs.push(JSON.parse(d)));
    ws.closed=new Promise(r=>ws.on('close',c=>r(c)));
    ws.on('open',()=>res(ws));ws.on('error',rej);
  });
}
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms=2000){const t=Date.now();while(Date.now()-t<ms){const v=f();if(v)return v;await wait(10)}throw new Error('timeout')}
const auth=(sub,pid='aaaa')=>JSON.stringify({t:'auth',token:'tok:'+sub,pid});
async function login(h,sub,pid){const ws=await wsOpen(h,{});ws.send(auth(sub,pid));await until(()=>ws.msgs.some(m=>m.t==='authed'));return ws}
function get(h,p,headers={}){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:h.port,path:p,headers},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res({status:r.statusCode,headers:r.headers,body:b}))}).on('error',rej)})}
async function withSrv(fn,extra,o){const h=await srv(extra,o);try{await fn(h)}finally{await h.close()}}

test('falscher Origin wird beim Upgrade abgelehnt',()=>withSrv(async h=>{
  const st=await new Promise(res=>{const ws=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:'https://evil.example'}});ws.on('unexpected-response',(q,r)=>res(r.statusCode));ws.on('error',()=>{})});
  assert.strictEqual(st,403);
  const st2=await new Promise(res=>{const ws=new WebSocket('ws://127.0.0.1:'+h.port+'/');ws.on('unexpected-response',(q,r)=>res(r.statusCode));ws.on('error',()=>{})});
  assert.strictEqual(st2,403);
}));
test('erste Nachricht kein auth → geschlossen nach Frist',()=>withSrv(async h=>{
  const ws=await wsOpen(h);const t=Date.now();
  assert.strictEqual(await ws.closed,1008);assert.ok(Date.now()-t<2000);
  const ws2=await wsOpen(h);ws2.send(JSON.stringify({t:'join',mode:'classic'}));assert.strictEqual(await ws2.closed,1008);
}));
test('ungültiges Token → geschlossen, Server nimmt danach neue Verbindung an',()=>withSrv(async h=>{
  const ws=await wsOpen(h);ws.send(JSON.stringify({t:'auth',token:'bad',pid:'aaaa'}));
  assert.strictEqual(await ws.closed,1008);
  const w2=await login(h,'u1');w2.close();
}));
test('Frame über 4096 Bytes, Binärframe, Müll → geschlossen; /healthz antwortet',()=>withSrv(async h=>{
  const bad=[()=>'x'.repeat(5000),()=>Buffer.from([1,2,3]),()=>'null',()=>'[]',()=>'123',()=>'{kaputt'];
  for(const b of bad){const ws=await wsOpen(h);ws.send(b());const c=await ws.closed;assert.ok(c===1008||c===1009||c===1003||c===1006,String(c))}
  const ws=await login(h,'u2');ws.send(Buffer.from([1]));await ws.closed;
  const r=await get(h,'/healthz');assert.strictEqual(r.status,200);assert.strictEqual(r.body,'ok');
}));
test('dasselbe Konto zweimal: zweite abgelehnt, erste bleibt; Wiederverbinden nach Abbruch geht',()=>withSrv(async h=>{
  const a=await login(h,'same');
  const b=await wsOpen(h);b.send(auth('same'));
  await until(()=>b.msgs.some(m=>m.t==='err'&&m.why==='duplicate'));await b.closed;
  assert.strictEqual(a.readyState,1);
  a.close();await a.closed;
  const c=await login(h,'same');assert.strictEqual(c.readyState,1);
}));
test('Flut: 200 Nachrichten in einer Sekunde → Verbindung wird geschlossen',()=>withSrv(async h=>{
  const ws=await login(h,'flood');
  for(let i=0;i<200;i++)ws.send(JSON.stringify({t:'leave'}));
  assert.strictEqual(await ws.closed,1006);/* terminate(): kein Close-Handshake */
}));
test('fünfte Verbindung derselben IP wird abgelehnt',()=>withSrv(async h=>{
  const ws=[];for(let i=0;i<4;i++)ws.push(await wsOpen(h));
  const st=await new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O}});w.on('unexpected-response',(q,r)=>res(r.statusCode));w.on('error',()=>{})});
  assert.strictEqual(st,429);
  for(const w of ws)w.close();
  await Promise.all(ws.map(w=>w.closed));
  await until(async()=>true);await wait(50);
  const again=await wsOpen(h);again.close();
}));
test('CF-Connecting-IP zählt von Loopback: andere IP hat eigenes Limit',()=>withSrv(async h=>{
  const ws=[];for(let i=0;i<4;i++)ws.push(await wsOpen(h,{headers:{'CF-Connecting-IP':'203.0.113.5'}}));
  const other=await wsOpen(h,{headers:{'CF-Connecting-IP':'203.0.113.6'}});
  const st=await new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O,'CF-Connecting-IP':'203.0.113.5'}});w.on('unexpected-response',(q,r)=>res(r.statusCode));w.on('error',()=>{})});
  assert.strictEqual(st,429);
  const junk=await wsOpen(h,{headers:{'CF-Connecting-IP':'nonsense'}});
  [...ws,other,junk].forEach(w=>w.close());
}));
test('Sperrliste: gesperrte sub und IP werden abgelehnt; fehlende Datei ist leer',async()=>{
  const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bl-')),'block.txt');
  await withSrv(async h=>{
    const ok=await login(h,'fine');ok.close();
  },{}, {blocklistPath:f});
  fs.writeFileSync(f,'# kommentar\nbadsub\n198.51.100.7\n');
  await withSrv(async h=>{
    const ws=await wsOpen(h);ws.send(auth('badsub'));assert.strictEqual(await ws.closed,1008);
    const st=await new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O,'CF-Connecting-IP':'198.51.100.7'}});w.on('unexpected-response',(q,r)=>res(r.statusCode));w.on('error',()=>{})});
    assert.strictEqual(st,403);
    fs.writeFileSync(f,'');h.reloadBlocklist();
    const g=await login(h,'badsub');g.close();
  },{}, {blocklistPath:f});
});
test('GET /matches enthält keine sub, keine pid, keine Namen; CORS nur für erlaubten Origin',()=>withSrv(async h=>{
  const a=await login(h,'secretsub1','pidaaaa');const b=await login(h,'secretsub2','pidbbbb');
  a.send(JSON.stringify({t:'join',mode:'classic'}));b.send(JSON.stringify({t:'join',mode:'classic'}));
  await until(()=>a.msgs.some(m=>m.t==='room'));
  const r=await get(h,'/matches',{Origin:O});
  assert.strictEqual(r.status,200);assert.strictEqual(r.headers['cache-control'],'no-store');
  assert.strictEqual(r.headers['access-control-allow-origin'],O);
  const list=JSON.parse(r.body);assert.strictEqual(list.length,1);
  assert.deepStrictEqual(Object.keys(list[0]).sort(),['countdown','humans','id','max','mode','state']);
  assert.strictEqual(list[0].humans,2);
  assert.ok(!/secretsub|pidaaaa|pidbbbb|Spieler/.test(r.body));
  const r2=await get(h,'/matches',{Origin:'https://evil.example'});assert.strictEqual(r2.headers['access-control-allow-origin'],undefined);
  assert.strictEqual((await get(h,'/other')).status,404);
  a.close();b.close();
}));
test('11. Raum wird nicht angelegt: Beitritt liefert err{why:full}',()=>withSrv(async h=>{
  const a=await login(h,'p1','aaaa'),b=await login(h,'p2','bbbb');
  a.send(JSON.stringify({t:'join',mode:'classic'}));await until(()=>a.msgs.some(m=>m.t==='room'));
  b.send(JSON.stringify({t:'join',mode:'classic'}));
  await until(()=>b.msgs.some(m=>m.t==='err'&&m.why==='full'));
  assert.strictEqual((JSON.parse((await get(h,'/matches')).body)).length,1);
  a.close();b.close();
},{MAX_ROOMS:1,MAX_HUMANS:1}));
test('Wiederverbinden im Wartesaal: Spieler kann nach Abbruch erneut beitreten',()=>withSrv(async h=>{
  const a=await login(h,'r1','aaaa');a.send(JSON.stringify({t:'join',mode:'classic'}));await until(()=>a.msgs.some(m=>m.t==='room'));
  a.close();await a.closed;await until(async()=>true);await wait(50);
  assert.strictEqual(JSON.parse((await get(h,'/matches')).body).length,0);
  const b=await login(h,'r1','aaaa');b.send(JSON.stringify({t:'join',mode:'classic'}));await until(()=>b.msgs.some(m=>m.t==='room'));b.close();
}));
test('Token eines fremden Schlüssels wird über den echten Serverpfad abgelehnt',async()=>{
  const mine=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}),other=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
  const jwk={...other.publicKey.export({format:'jwk'}),kid:'k1'};
  const supabaseUrl='https://x.supabase.co';
  const verify=createVerifier({getKeys:async()=>[jwk],supabaseUrl});
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const hp=b64({alg:'ES256',kid:'k1',typ:'JWT'})+'.'+b64({sub:'u',aud:'authenticated',iss:supabaseUrl+'/auth/v1',exp:Math.floor(Date.now()/1000)+600});
  const sig=crypto.sign('sha256',Buffer.from(hp),{key:mine.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  await withSrv(async h=>{
    const ws=await wsOpen(h);ws.send(JSON.stringify({t:'auth',token:hp+'.'+sig,pid:'aaaa'}));
    assert.strictEqual(await ws.closed,1008);
  },{}, {verify});
});

test('Ping-Flut zählt gegen den Token-Bucket → terminate',()=>withSrv(async h=>{
  const ws=await login(h,'pingflood');
  for(let i=0;i<200;i++)ws.ping();
  assert.strictEqual(await ws.closed,1006);
  assert.ok(h.stats().flood>=1);
}));
test('Binärframe und Müll nach Anmeldung → terminate (1006)',()=>withSrv(async h=>{
  const a=await login(h,'bin1');a.send(Buffer.from([1]));assert.strictEqual(await a.closed,1006);
  const b=await login(h,'bin2');b.send('{kaputt');assert.strictEqual(await b.closed,1006);
}));
test('Doppelanmeldung gleichzeitig: genau eine Verbindung je Konto',()=>{
  const slow=async t=>{await wait(60);return fake(t)};
  return withSrv(async h=>{
    const dup0=h.stats().dup;
    const ws=await Promise.all([wsOpen(h),wsOpen(h),wsOpen(h)]);
    for(const w of ws)w.send(auth('race'));
    await Promise.all(ws.map(w=>Promise.race([w.closed,until(()=>w.msgs.some(m=>m.t==='authed'))])));
    await wait(100);
    const authed=ws.filter(w=>w.msgs.some(m=>m.t==='authed'));
    assert.strictEqual(authed.length,1);
    assert.strictEqual(ws.filter(w=>w.readyState===1).length,1);
    assert.strictEqual(h.stats().dup-dup0,2);/* stats sind prozessweit */
  },{},{verify:slow});
});
test('Beitritts-Ratenlimit je IP und Minute (JOIN_PER_MIN) gegen Raum-Churn',()=>withSrv(async h=>{
  const ws=await login(h,'churn');
  for(let i=0;i<3;i++){ws.send(JSON.stringify({t:'join',mode:'classic'}));ws.send(JSON.stringify({t:'leave'}));await wait(120)}
  ws.send(JSON.stringify({t:'join',mode:'classic'}));
  await until(()=>ws.msgs.some(m=>m.t==='err'&&m.why==='rate'));
  /* andere IP (über CF-Connecting-IP) hat eigenes Limit */
  const o=await wsOpen(h,{headers:{'CF-Connecting-IP':'203.0.113.9'}});o.send(auth('other'));
  await until(()=>o.msgs.some(m=>m.t==='authed'));
  o.send(JSON.stringify({t:'join',mode:'classic'}));
  await until(()=>o.msgs.some(m=>m.t==='room'));
  ws.close();o.close();
},{JOIN_PER_MIN:3,MSG_BURST:100}));
test('IPv6 aus demselben /64 teilt sich das Verbindungslimit; ::ffff:-Form zählt als IPv4',()=>withSrv(async h=>{
  const hd=a=>({'CF-Connecting-IP':a});
  const ws=[];
  for(const a of['2001:db8:1:2::1','2001:db8:1:2:aaaa::5','2001:DB8:1:2:0:0:0:9','2001:db8:1:2:ffff:ffff:ffff:ffff'])ws.push(await wsOpen(h,{headers:hd(a)}));
  const st=await new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O,...hd('2001:db8:1:2::77')}});w.on('unexpected-response',(q,r)=>res(r.statusCode));w.on('error',()=>{})});
  assert.strictEqual(st,429);
  const v4=[];for(let i=0;i<4;i++)v4.push(await wsOpen(h,{headers:hd(i%2?'::ffff:198.51.100.7':'198.51.100.7')}));
  const st2=await new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:'+h.port+'/',{headers:{Origin:O,...hd('198.51.100.7')}});w.on('unexpected-response',(q,r)=>res(r.statusCode));w.on('error',()=>{})});
  assert.strictEqual(st2,429);
  [...ws,...v4].forEach(w=>w.close());
}));
test('Auth-Nachricht mit 6000-Zeichen-Token geht durch, 9000 nicht; danach gilt 4096',()=>withSrv(async h=>{
  const big=await wsOpen(h);big.send(JSON.stringify({t:'auth',token:'tok:'+'a'.repeat(6000),pid:'aaaa'}));
  await until(()=>big.msgs.some(m=>m.t==='authed'));
  big.send(JSON.stringify({t:'leave',pad:'x'.repeat(5000)}));assert.strictEqual(await big.closed,1006);
  const huge=await wsOpen(h);huge.send(JSON.stringify({t:'auth',token:'tok:'+'a'.repeat(9000),pid:'aaaa'}));
  const c=await huge.closed;assert.ok(c===1006||c===1009||c===1008);
}));
test('makeCrashGuard: loggt ohne Token/IP, >20 in 60 s → exit(1)',()=>{
  const {makeCrashGuard}=require('../index');
  const logs=[];let code=null,t=0,errs=0;
  const g=makeCrashGuard({exit:c=>{code=c},log:m=>logs.push(m),now:()=>t,onError:()=>errs++});
  const jwt='eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJhYmMifQ.c2lnbmF0dXJlc2lnbmF0dXJl';
  const e=new TypeError('bad token '+jwt+' from 203.0.113.5 and 2001:db8::1');
  for(let i=0;i<20;i++){t+=100;g('uncaughtException',e)}
  assert.strictEqual(code,null);assert.strictEqual(errs,20);
  const all=logs.join('\n');
  assert.ok(/TypeError/.test(all));
  assert.ok(!all.includes('eyJ')&&!all.includes('203.0.113')&&!all.includes('2001:db8')&&!all.includes('bad token'),all);
  t+=100;g('unhandledRejection',e);assert.strictEqual(code,1);
  /* verteilt über Zeit: kein Exit */
  let c2=null,t2=0;const g2=makeCrashGuard({exit:c=>{c2=c},log:()=>{},now:()=>t2});
  for(let i=0;i<100;i++){t2+=5000;g2('x',new Error('x'))}
  assert.strictEqual(c2,null);
  g2('x','kein Fehlerobjekt');assert.strictEqual(c2,null);
});
test('normIp: IPv4, ::ffff:, /64, ungültig',()=>{
  const {normIp}=require('../limits');
  assert.strictEqual(normIp('1.2.3.4'),'1.2.3.4');
  assert.strictEqual(normIp('::ffff:1.2.3.4'),'1.2.3.4');
  assert.strictEqual(normIp('::ffff:0102:0304'),'1.2.3.4');
  assert.strictEqual(normIp('2001:db8:1:2:3:4:5:6'),normIp('2001:DB8:1:2::'));
  assert.notStrictEqual(normIp('2001:db8:1:2::1'),normIp('2001:db8:1:3::1'));
  assert.strictEqual(normIp('::1'),normIp('0:0:0:0:ffff::1'));
  for(const bad of['','nonsense',undefined,null,'1.2.3','::g','1:2:3:4:5:6:7:8:9'])assert.strictEqual(normIp(bad),'invalid');
});
