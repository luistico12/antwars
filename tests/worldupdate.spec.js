/* Update: Tunnelansicht (T, Linksklick/Ziehen), verschmolzene Gebiete, Hauptstadt, Wall, Hafen, Wege, Floß-Angriff. */
const {chromium}=require('playwright');const path=require('path');const {seeded}=require('./helpers/prng');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:800}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  /* feste Zufallsfolge, damit die Karte (und der Test) bei jedem Lauf gleich ist; anderer Startwert: SEED=n */
  await pg.addInitScript(`Math.random=(${seeded.toString()})(${+(process.env.SEED||1)});`);
  await pg.route('**/config.js',r=>r.fulfill({body:'window.AW_CONFIG={}',contentType:'text/javascript'}));
  await pg.goto('file://'+path.resolve(__dirname,'../index.html'));await pg.waitForFunction(()=>typeof AW!=='undefined'&&AW.ready);
  for(const s of ['#nmSkip','#ckAll']){const e=await pg.$(s);if(e)await e.click()}
  await pg.click('#hSolo');await pg.evaluate(()=>{const sp=SP[setupSp];mapClick(T.find(t=>t.terrain===sp.terr).id)});
  await pg.evaluate(()=>{setSpeedUI(0);G.mat=200;G.food=200});

  /* ---- Tunnelansicht ---- */
  await pg.keyboard.press('t');
  ok(await pg.evaluate(()=>col.buildSel==='tunnel'),'Taste T schaltet die Tunnelansicht ein');
  ok(await pg.evaluate(()=>ROOMS.tunnel.need<=2),'Tunnel brauchen höchstens 2 statt 5 Arbeit (2,5× schneller)');
  const px=(c,r)=>pg.evaluate(([c,r])=>{const rc=cv.getBoundingClientRect();return[rc.left+((c*CELLW+CELLW/2-ccam.x)*ccam.z)*rc.width/VW,rc.top+((r*CELLH+CELLH/2-ccam.y)*ccam.z)*rc.height/VH]},[c,r]);
  await pg.evaluate(()=>{ccam.z=1;ccam.x=ENT_X-VW/2;ccam.y=GY-100;clampCam()});
  const cell=await pg.evaluate(()=>{for(let r=MR+4;r<MR+14;r++){let ok=true;for(let k=0;k<4;k++){const q=col.grid[(r+k)*COLS+ENT_C];if(!q||q.s!==0||isWaterCell(col,ENT_C,r+k))ok=false}if(ok)return r}return -1});
  ok(cell>0,'freie Zellen für den Test gefunden');
  const m0=await pg.evaluate(()=>G.mat);
  const[x0,y0]=await px(20,cell),[x1,y1]=await px(20,cell+3);
  await pg.mouse.move(x0,y0);await pg.mouse.down();await pg.mouse.move((x0+x1)/2,(y0+y1)/2,{steps:6});await pg.mouse.move(x1,y1,{steps:6});await pg.mouse.up();
  const n=await pg.evaluate(c=>{let n=0;for(let r=0;r<ROWS;r++)for(let q=0;q<COLS;q++){const k=col.grid[r*COLS+q];if(k.s===3&&k.build&&k.build.kind==='tunnel')n++}return n},cell);
  ok(n>=4,`Linksklick halten und ziehen malt mehrere Abschnitte (${n})`);
  ok(m0-(await pg.evaluate(()=>G.mat))===n,'Material wird je Abschnitt abgezogen');
  const[sx,sy]=await px(20,cell+6);await pg.mouse.click(sx,sy);
  ok(await pg.evaluate(c=>col.grid[(c+6)*COLS+ENT_C].s!==0,cell),'Einzelklick markiert eine Zelle');
  await pg.screenshot({path:'/tmp/tunnel-view.png'});
  await pg.evaluate(()=>{setSpeedUI(1)});await pg.waitForTimeout(6000);
  const done=await pg.evaluate(c=>{let n=0;for(let r=0;r<ROWS;r++)for(let q=0;q<COLS;q++){const k=col.grid[r*COLS+q];if(k.s===2&&k.kind==='tunnel')n++}return n},cell);
  ok(done>6,`Tunnel werden fertig gegraben (${done} Gänge)`);
  await pg.evaluate(()=>setSpeedUI(0));
  await pg.keyboard.press('t');ok(await pg.evaluate(()=>col.buildSel===null),'T schaltet wieder aus');

  /* ---- Weltkarte: verschmelzen, Hauptstadt ---- */
  await pg.evaluate(()=>{setView('map');G.mat=G.matCap=400;G.food=G.foodCap=400});
  const w=await pg.evaluate(()=>{
    const cap=T[F[0].capital],nb=cap.adj.map(i=>T[i]).filter(x=>x.owner===-1);if(nb.length<3)nb.push(...cap.adj.map(i=>T[i]).filter(x=>!nb.includes(x)&&x.owner!==0&&!x.isCap).slice(0,3-nb.length));
    nb.slice(0,3).forEach(x=>setOwner(x,0,5));
    ownDirty=true;drawMap(mg,performance.now());
    const a=nb[0];
    return{merged:mergedTerr(cap,a),capSize:nestSize(cap),cityMax:Math.max(...nb.slice(0,3).map(nestSize)),cols:T.filter(t=>t.owner===0&&t.col).map(t=>t.id),cap:cap.id,reg:cap.regArea,own:cap.cells.length}});
  ok(w.merged,'eigene Nachbargebiete verschmelzen');
  ok(w.capSize>w.cityMax,`Hauptstadt (${w.capSize.toFixed(2)}) größer als normale Städte (${w.cityMax.toFixed(2)})`);
  ok(w.reg>w.own,'Hauptstadt wächst mit der Fläche des Reichs');
  ok(w.cols.length===1&&w.cols[0]===w.cap,'Kolonie nur für die Hauptstadt');
  const rw=await pg.evaluate(()=>{let t=T.find(x=>x.owner===-1&&!x.isCap);if(!t){t=T.find(x=>x.owner!==0&&!x.isCap);setOwner(t,-1,0)}t.conqN=5;G.mat=100;G.food=100;const m=G.mat;setOwner(t,0,4);t.conqN=5;chooseConquest(t.id);return{dm:G.mat-m,hasCol:!!t.col,puppet:T.some(x=>x.puppet)}});
  ok(!rw.hasCol&&rw.dm>0,`Eroberung wird immer behalten (+${rw.dm} Material) ohne eigene Kolonie`);
  ok(!rw.puppet,'es gibt keine Marionettenstaaten mehr');

  /* ---- Kreismenü auf eigenem Gebiet ---- */
  await pg.evaluate(()=>{G.mat=G.matCap=400;G.food=G.foodCap=400});
  const open=()=>pg.evaluate(()=>{const t=T[F[0].capital];terrAtEvent=()=>t.id;mapWorld=()=>[t.lx*CS,t.ly*CS];openRadial({clientX:560,clientY:380});
    return[...document.querySelectorAll('#radial [data-r]')].map(e=>e.dataset.r+(e.classList.contains('dis')?'!':'')).join(',')});
  const clean=s=>s.replace(/!/g,'');
  ok(clean(await open())==='info,build,x,atk','Eigenes Gebiet: Info, Bauen, Schließen, Wall in der Mitte');
  await pg.click('#radial [data-r=build]');
  const bm=clean(await pg.evaluate(()=>[...document.querySelectorAll('#radial [data-r]')].map(e=>e.dataset.r).join(',')));
  ok(/^back,out,line,port(,raft,war)?(,ship)?,atk$/.test(bm)&&!/road/.test(bm),'Bauen-Menü: Außenposten, Linie, Hafen (ohne Weg): '+bm);
  await pg.click('#radial [data-r=out]');
  ok(await pg.evaluate(()=>T[F[0].capital].str.out)===1,'Außenposten per Kreismenü gebaut');
  await open();await pg.click('#radial [data-r=atk]');
  ok(await pg.evaluate(()=>placing&&placing.kind==='wall'),'Wall: Platziermodus startet');
  const wl=await pg.evaluate(()=>{const t=T[F[0].capital],m=G.mat;const e={clientX:0,clientY:0};mapWorld=()=>[t.lx*CS+8,t.ly*CS];seaClick(e);return{n:t.walls.length,dm:m-G.mat,placing:!!placing}});
  ok(wl.n===1&&wl.dm===50&&!wl.placing,'Wall steht frei im Gebiet und kostet Material');
  const wm=await pg.evaluate(()=>{const t=T[F[0].capital],nbr=t.adj[0];const p=M.bp.get(t.id+'-'+nbr);t.walls.push({x:p[0][0],y:p[0][1]});return wallMul(t,nbr)});
  ok(wm>1,`Wall nahe der Grenze verstärkt die Verteidigung (×${wm})`);

  /* ---- Hafen, Floß, Weg, Seeangriff ---- */
  const sea=await pg.evaluate(()=>{
    G.mat=G.matCap=400;G.food=G.foodCap=400;
    const mine=T.filter(t=>t.owner===0&&!t.puppet&&t.coast.length);
    if(!mine.length)return{err:'kein Küstengebiet'};
    const t=mine[0];buildPort(t);const hasPort=!!t.port;
    buildRaft(t);buildRaft(t);buildRaft(t);buildRaft(t);
    const rafts=t.port.rafts;
    t.troops=40;
    const src=seaSource();
    gtime=999;
    let foe=null,okl=false;
    for(const x of T.filter(x=>x.owner!==0&&x.coast.length&&!x.adj.includes(t.id)&&x.owner!==-2)){
      const cell=landingCell(x,cellPos(x.coast[0])[0],cellPos(x.coast[0])[1]);
      foe=x;okl=launchSea(src,x,10,cell);if(okl)break}
    return{hasPort,rafts,okl,after:t.port.rafts,id:t.id,foe:foe.id}});
  ok(sea.hasPort,'Hafen auf Küstengebiet gebaut');
  ok(sea.rafts===3,'Floß-Maximum 3 pro Hafen');
  ok(sea.okl&&sea.after===2,'Seeangriff startet und verbraucht ein Floß');
  await pg.screenshot({path:'/tmp/sea-march.png'});
  await pg.evaluate(()=>{for(let i=0;i<1500;i++){updateWorld(0.1);if(!marches.some(m=>m.sea))break}});
  ok(await pg.evaluate(()=>!marches.some(m=>m.sea)),'Seemarsch kommt an und wird abgewickelt');
  ok(await pg.evaluate(id=>T[id].port.rafts===3,sea.id),'Floß kehrt zum Hafen zurück');
  const rd2=await pg.evaluate(()=>{
    const mine=T.filter(t=>t.owner===0);if(mine.length<2){const x=T[mine[0].adj[0]];setOwner(x,0,3);mine.push(x)}
    const a=mine[0],bb=T[a.adj.find(i=>T[i].owner===0)];
    G.mat=50;G.food=50;const m0=G.mat;
    for(let i=0;i<600;i++)updateSea(0.1);
    return{links:links.length,done:links.filter(l=>l.p>=1).length,link:roadLink(a,bb),tr:traders.length,gift:G.mat>m0,hasDel:typeof startRoad!=='undefined'}});
  ok(rd2.links>0&&rd2.done===rd2.links,`Wege entstehen automatisch (${rd2.links} Verbindungen fertig)`);
  ok(rd2.link,'Städte sind per Weg verbunden');
  ok(rd2.tr>0,`Händler laufen auf den Wegen (${rd2.tr})`);
  ok(rd2.gift,'Händler geben beim Betreten eines Gebäudes Material ab');
  ok(!rd2.hasDel,'Weg-Maltool ist entfernt');
  const war=await pg.evaluate(()=>{
    G.mat=G.matCap=400;G.food=G.foodCap=400;const t=T.find(x=>x.owner===0&&x.port);if(!t)return{err:1};
    buildWar(t);const[px,py]=cellPos(t.port.idx);let spot=null;
    for(let r=20;r<200&&!spot;r+=10)for(let a=0;a<6.28&&!spot;a+=0.4){const x=px+Math.cos(a)*r,y=py+Math.sin(a)*r,i=cellOf(x,y);if(i>=0&&!M.land[i])spot=[x,y]}
    const ok1=spot&&placeWar(spot[0],spot[1]);
    const foe=T.find(x=>x.owner>0);
    marches.push({from:foe,to:t,n:20,f:foe.owner,t:0,dur:50,phase:'walk',ft:0,fdur:2,seed:1,sea:true,a:[spot[0]+20,spot[1]],b:[spot[0]+30,spot[1]],path:[[spot[0]+20,spot[1]],[spot[0]+30,spot[1]]],land:{x:0,y:0},home:null});
    for(let i=0;i<40;i++)updateWarships(0.5);
    return{placed:ok1,ships:warships.length,left:marches.find(m=>m.dur===50)?marches.find(m=>m.dur===50).n:0}});
  ok(war.placed&&war.ships===1,'Kriegsschiff lässt sich platzieren');
  ok(war.left<20,`Kriegsschiff greift gegnerische Schiffe an (${war.left}/20 übrig)`);
  await pg.evaluate(()=>{setView('map');drawMap(mg,performance.now())});
  await pg.screenshot({path:'/tmp/map-final.png'});
  ok(errs.length===0,'keine pageerror: '+errs.join('|'));
  await b.close();process.exit(fails?1:0);
})();
