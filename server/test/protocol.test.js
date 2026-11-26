const test=require('node:test'),assert=require('node:assert');
const {parseClientMsg:p,cosmClean,cleanName}=require('../protocol');
test('parseClientMsg lehnt Nicht-Objekte, Arrays, unbekannte t, zu lange Strings, Buffer mit Binärmüll ab',()=>{
  for(const raw of['1','"x"','null','[]','[{"t":"leave"}]','{}','{"t":"zzz"}','{"t":5}','nicht json','{"t":"join","mode":"x"}',
    '{"t":"auth","token":"x","pid":"AB"}','{"t":"cmd","k":"launch","from":1.5,"to":2,"n":3}','{"t":"cmd","k":"tr","tile":"1"}',
    JSON.stringify({t:'ready',name:'x'.repeat(65),sp:'ground',start:1,c:null}),
    JSON.stringify({t:'ready',name:'x',sp:'ground',start:1,c:[]}),
    JSON.stringify({t:'leave',pad:'x'.repeat(5000)}),
    Buffer.from([0xff,0xfe,0x00,0x7b]),Buffer.from('{"t":"leave"}�'),123,undefined,null,{t:'leave'}])
    assert.strictEqual(p(raw).ok,false,String(raw).slice(0,40));
  assert.deepStrictEqual(p('{"t":"leave"}'),{ok:true,msg:{t:'leave'}});
  assert.strictEqual(p(Buffer.from('{"t":"join","mode":"classic"}')).ok,true);
  assert.strictEqual(p(JSON.stringify({t:'auth',token:'t'.repeat(900),pid:'ab12'})).ok,true);
  const r=p(JSON.stringify({t:'ready',name:'A',sp:'ground',start:3,c:{crown:'gold',__proto__:{x:1},evil:'a',flag:'<b>'}}));
  assert.deepStrictEqual(r.msg.c,{crown:'gold'});
});
test('cosmClean und cleanName',()=>{
  assert.deepStrictEqual(cosmClean(JSON.parse('{"__proto__":{"crown":"a"},"ship":"viking"}')),{ship:'viking'});
  assert.strictEqual(Object.getPrototypeOf(cosmClean({})),Object.prototype);
  assert.strictEqual(cleanName(' a#b \n c\u0000 '+'x'.repeat(30)).length,20);
  assert.strictEqual(cleanName(null),'');
});

test('Kosmetik-Whitelist und ID-Regex decken alle Client-IDs aus js/ ab (inkl. bskin)',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const src=['svgart.js','flags.js','backend.js','cosmetics.js'].map(f=>fs.readFileSync(path.join(__dirname,'../../js',f),'utf8')).join('\n;');
  const ctx=vm.createContext({console,Image:function(){},document:{getElementById(){return null},createElement(){return{getContext(){return{}},style:{}}}},window:{},localStorage:{getItem(){return null},setItem(){}},navigator:{}});
  vm.runInContext(src+';this.__o={crown:CROWN_IDS,ship:SHIP_IDS,pattern:Object.keys(PATTERN_FN),flag:Object.keys(FL),bskin:Object.keys(BSKINS),pack:Object.keys(cosmPack())}',ctx);
  const o=ctx.__o;
  assert.ok(o.bskin.length>0&&o.flag.length>0&&o.pattern.length>0&&o.crown.length>0&&o.ship.length>0);
  for(const k of o.pack)assert.ok(['crown','pattern','ship','flag','bskin'].includes(k),k);
  for(const k of['crown','pattern','ship','flag','bskin'])for(const id of o[k]){
    assert.deepStrictEqual(cosmClean({[k]:id}),{[k]:id},k+':'+id);
  }
  assert.deepStrictEqual(cosmClean({bskin:'x y'}),{});
});
test('auth: Token bis 8192 Zeichen erlaubt (Verifier-Limit), darüber nicht',()=>{
  const m=n=>JSON.stringify({t:'auth',token:'a'.repeat(n),pid:'aaaa'});
  assert.strictEqual(p(m(8192),9000).ok,true);
  assert.strictEqual(p(m(8193),9000).ok,false);
  assert.strictEqual(p(m(3000)).ok,Buffer.byteLength(m(3000))<=4096);
  assert.strictEqual(p(m(6000)).ok,false);/* Standardgrenze 4096 für normale Nachrichten */
});
