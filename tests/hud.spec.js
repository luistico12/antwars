/* Weltkarten-HUD: Bestenliste, Bauleiste (Tasten 1-6), Spenden, Ereignisse, kein Seitenpanel. */
const {chromium}=require('playwright');const path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1500,height:850}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id);startGame()});
  await pg.waitForTimeout(500);await pg.evaluate(()=>{setSpeedUI(0);setView('map');G.mat=G.matCap=400;G.food=G.foodCap=400;updateSide()});
  ok(await pg.evaluate(()=>!$('#wmHud').hidden&&getComputedStyle($('#side')).display==='none'),'HUD sichtbar, Seitenpanel weg');
  ok(await pg.evaluate(()=>$$('#wmLb tbody tr').length>=4&&$('#wmLb tr.me')!==null),'Bestenliste mit eigener Zeile');
  ok(await pg.evaluate(()=>$$('#wmSlots .slot').length===6),'Bauleiste mit 6 Plätzen');
  /* Taste 1 ohne Auswahl: vormerken, Klick aufs eigene Gebiet baut Wall-Modus */
  await pg.evaluate(()=>{selT=null;updateHud()});
  await pg.keyboard.press('1');
  ok(await pg.evaluate(()=>hudArm==='wall'),'Taste 1 merkt Verteidigungswall vor');
  await pg.evaluate(()=>mapClick(T.find(t=>t.owner===0).id));
  ok(await pg.evaluate(()=>!!placing&&placing.kind==='wall'),'Klick aufs eigene Gebiet startet die Wall-Platzierung');
  await pg.evaluate(()=>{placing=null});
  /* Außenposten per Klick auf den Platz mit Auswahl */
  const o0=await pg.evaluate(()=>{const t=T.find(t=>t.owner===0);selT=t.id;return[t.str.out,G.mat]});
  await pg.click('#wmSlots .slot[data-i="1"]');
  const o1=await pg.evaluate(()=>{const t=T.find(t=>t.owner===0);return[t.str.out,G.mat]});
  ok(o1[0]===o0[0]+1&&o1[1]<o0[1],'Außenposten über die Bauleiste gebaut und bezahlt');
  /* Truppenanteil und Spenden */
  await pg.evaluate(()=>{const r=$('#wmPct');r.value=30;r.dispatchEvent(new Event('input'))});
  ok(await pg.evaluate(()=>pct===30&&$('#pct').value==='30'),'Truppenanteil-Leiste setzt pct');
  await pg.evaluate(()=>{const r=$('#wmDm');r.value=50;r.dispatchEvent(new Event('input'))});
  ok(await pg.evaluate(()=>donM===50&&/50%/.test($('#wmDmV').textContent)),'Material-Spenden-Leiste');
  /* Ereignisse */
  await pg.evaluate(()=>{toast('Testereignis','good');updateHud()});
  ok(await pg.evaluate(()=>/Testereignis/.test($('#wmEvBody').textContent)),'Ereignisse zeigen Meldungen');
  await pg.click('#wmEv [data-t="team"]');
  ok(await pg.evaluate(()=>/Verbündet/.test($('#wmEvBody').textContent)),'Team-Reiter');
  await pg.screenshot({path:'/tmp/hud.png'});
  ok(errs.length===0,'keine Seitenfehler '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
