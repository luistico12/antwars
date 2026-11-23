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
  assert.strictEqual(p(Buffer.from('{"t":"join","mode":"ffa"}')).ok,true);
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
