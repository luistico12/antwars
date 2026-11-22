/* Profilbild: Upload (zugeschnitten, verkleinert), Header, Entfernen, Validierung. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1400,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  ok(await pg.evaluate(()=>safeAvatar('data:image/png;base64,AAAA')==='data:image/png;base64,AAAA'),'safeAvatar nimmt PNG-Data-URL');
  ok(await pg.evaluate(()=>[ 'javascript:alert(1)','data:image/svg+xml;base64,AAAA','data:image/png;base64,AA"onerror="x','http://x/y.png',null,5,'data:image/png;base64,'+'A'.repeat(30001) ].every(v=>safeAvatar(v)===null)),'safeAvatar lehnt SVG, Skripte, Fremdlinks und Übergroßes ab');
  let bad=await pg.evaluate(async()=>{await AW.update({avatar:'javascript:alert(1)'});return AW.profile.avatar});
  ok(bad===null,'AW.update speichert ungültiges Bild nicht');
  /* großes, nicht quadratisches PNG erzeugen */
  const png=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=200;const g=c.getContext('2d');g.fillStyle='#e33';g.fillRect(0,0,400,200);g.fillStyle='#38f';g.fillRect(150,50,100,100);return c.toDataURL('image/png').split(',')[1]});
  require('fs').writeFileSync('/tmp/av.png',Buffer.from(png,'base64'));
  await pg.evaluate(()=>openScreen('profile'));await pg.waitForTimeout(200);
  await pg.setInputFiles('#pAvF','/tmp/av.png');await pg.waitForSelector('#cropC');await pg.fill('#cropZ','1.5');await pg.click('#cropOk');await pg.waitForTimeout(500);
  const av=await pg.evaluate(()=>AW.profile.avatar);
  ok(!!av&&/^data:image\/(webp|jpeg);base64,/.test(av)&&av.length<30000,'Upload speichert verkleinertes Bild ('+(av||'').length+' Zeichen)');
  const dim=await pg.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=()=>r([i.naturalWidth,i.naturalHeight]);i.src=AW.profile.avatar}));
  ok(dim[0]===96&&dim[1]===96,'Bild ist 96×96');
  ok(await pg.evaluate(()=>!!document.querySelector('.avbig img')&&!!document.querySelector('#hdrProf .av img')),'Profil und Header zeigen das Bild');
  await pg.screenshot({path:'/tmp/avatar.png'});
  await pg.click('#pAvX');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>AW.profile.avatar===null&&!document.querySelector('.avbig img')&&!document.querySelector('#hdrProf .av img')),'Entfernen stellt das Standard-Symbol wieder her');
  ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));
  await b.close();console.log(fails?fails+' FEHLER':'ALLES OK');process.exit(fails?1:0);
})();
