/* ===== Weltkarte: Zustand ===== */
const FCOL=[[74,163,255],[224,82,61],[179,107,224],[230,194,60],[80,200,140],[240,140,60],[230,120,190],[140,200,230]];
const FNAME=['Du','Rote Kolonie','Violette Kolonie','Gelbe Kolonie','Grüne Kolonie','Orange Kolonie','Rosa Kolonie','Hellblaue Kolonie'];
const DIFFS={easy:{regen:0.8,think:7,atk:1,ratio:1.5},normal:{regen:1,think:5,atk:1.05,ratio:1.25},hard:{regen:1.3,think:3.2,atk:1.15,ratio:1.1}};
const STR_COST={out:[{mat:40,food:20},{mat:80,food:40}],line:[{mat:25,food:10},{mat:45,food:20}]};
let MW=GW*CS,MH=GH*CS,modeKey='classic';
let contWin=false,M=null,F=[],T=[],marches=[],fxs=[],started=false,over=false,speed=1,gtime=0,selT=null,hovT=null,pct=50;
let setupSp='ground',setupStart=null,diffKey='normal',baseCanvas=null,ownCanvas=null,strCanvas=null,ownDirty=true,strDirty=true,dockDirty=true;
const mcam={x:0,y:0,z:1};
const H={v:0,recent:{}};
const PX="'Chakra Petch',system-ui,sans-serif";
const newStr=()=>({out:0,lines:{}});
const heatStage=()=>Math.min(5,Math.floor(H.v/20));
function addHeat(fid){H.recent[fid]=gtime;const k=Object.values(H.recent).filter(t=>gtime-t<150).length;H.v=Math.min(100,H.v+8+7*(k-1))}
const isFriend=(a,b)=>a===b||(a===0&&b>0&&F[b].allied)||(b===0&&a>0&&F[a].allied);

function newMap(seed){
  setMapDims(MODES[modeKey].scale);MW=GW*CS;MH=GH*CS;if(typeof applyDensity==='function')applyDensity();
  M=buildMap(seed);T=M.terrs;baseCanvas=renderBase(M);
  for(const t of T){t.str=newStr();t.col=null;t.item=null;t.walls=[];t.port=null}
  F=[{id:0,isPlayer:true,name:'Du',species:setupSp,rgb:FCOL[0],alive:true,capital:-1}];
  if(typeof seaReset==='function')seaReset();
  setupStart=null;selT=null;hovT=null;ownDirty=true;strDirty=true;mcam.x=0;mcam.y=0;mcam.z=1;
}
function placeItems(){return;
  const types=Object.keys(PW);
  const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const cap=F[0]&&F[0].capital>=0?F[0].capital:-1,dist=new Map();
  if(cap>=0){dist.set(cap,0);const q=[cap];while(q.length){const c=q.shift();for(const n of T[c].adj)if(!dist.has(n)){dist.set(n,dist.get(c)+1);q.push(n)}}}
  const mk=t=>{t.item={type:pick(types),pct:10+Math.floor(Math.random()*6)}};
  const near=shuf(T.filter(t=>t.owner<=-1&&(dist.get(t.id)||99)<=2)).slice(0,4);near.forEach(mk);
  const rest=shuf(T.filter(t=>!t.item&&t.owner!==0&&!t.isCap));rest.slice(0,Math.max(0,9-near.length)).forEach(mk);
}
function collectItem(t){
  if(!t.item)return;
  G.items.push({type:t.item.type,pct:t.item.pct,from:t.name});
  toast(`Powerup: ${PW[t.item.type]} +${t.item.pct}% (${t.name})`,'good');t.item=null;
}
/* Weltteil des Spielstarts (auch vom Server genutzt). hostStart===null: F[0] ist ein toter Platzhalter ohne Gebiet, alle Menschen sind Fraktionen 1..n. */
function initWorld({hostStart,humans}){
  const D=DIFFS[diffKey],hum=humans,srv=hostStart===null,st=srv?null:T[hostStart];
  for(const t of T){t.owner=-1;t.isCap=false;t.troops=6+Math.floor(Math.random()*12);t.str=newStr();t.col=null;t.item=null;t.walls=[];t.port=null}
  if(typeof seaReset==='function')seaReset();
  const taken=[],dist=(a,b)=>Math.hypot(a.lx-b.lx,a.ly-b.ly);
  if(srv)F=[{id:0,isPlayer:true,alive:false,capital:-1,name:'Server'}];
  else{F=[{id:0,isPlayer:true,name:'Du',species:setupSp,rgb:FCOL[0],alive:true,capital:hostStart}];
    st.owner=0;st.isCap=true;st.troops=3;taken.push(st)}
  hum.forEach(h=>{const ht=T[h.start];ht.owner=h.fid;ht.isCap=true;ht.troops=3;taken.push(ht);
    F.push({id:h.fid,isPlayer:false,human:true,pid:h.pid,name:h.name,species:h.species,rgb:FCOL[h.fid],alive:true,capital:h.start,allied:false,dipCool:0,hurt:-999})});
  const total=srv?Math.max(hum.length+1,1+MODES[modeKey].bots)+1:Math.max(2+hum.length,1+MODES[modeKey].bots);
  for(let b=1+hum.length;b<total;b++){
    let best=null,bs=-1;
    if(MODES[modeKey].rnd){const fr=T.filter(q=>q.owner===-1&&q.adj.some(i=>T[i].owner===-1));best=fr[Math.floor(Math.random()*fr.length)]||null}
    if(!best)for(const t of T){if(t.owner!==-1)continue;const d=Math.min(...taken.map(q=>dist(q,t)));if(d>bs){bs=d;best=t}}
    best.owner=b;best.isCap=true;best.troops=14;taken.push(best);
    F.push({id:b,isPlayer:false,name:FNAME[b],species:SP_BY_TERR[best.terrain],rgb:FCOL[b],alive:true,capital:best.id,timer:D.think*(1+b*0.4),allied:false,dipCool:0,hurt:-999});
    const free=best.adj.map(i=>T[i]).filter(x=>x.owner===-1);
    if(free.length){const x=free[Math.floor(Math.random()*free.length)];x.owner=b;x.troops=8}
  }
  placeItems();
  contWin=modeKey==='unlimited';marches=[];fxs=[];H.v=0;H.recent={};started=true;over=false;gtime=0;selT=null;SIMV=MODES[modeKey].spd;speed=SIMV;ownDirty=true;strDirty=true;
}
function startGame(){
  setColonyDims(modeKey==='unlimited'?2:1);
  const st=T[setupStart],hum=(typeof NET!=='undefined'&&NET.role==='host')?NET.humans:[];
  initWorld({hostStart:setupStart,humans:hum});
  newG();st.col=makeColony(st,'capital',setupSp);curT=st.id;col=st.col;
  computeStats(col);syncAnts(true);
}
function atkMul(f){return SP[f.species].atk*(f.isPlayer?(1+0.2*G.upg.atk)*pwMul('atk'):DIFFS[diffKey].atk)}
function defMul(f){return SP[f.species].def*(f.isPlayer?(1+0.2*G.upg.def)*pwMul('def'):1)}
function strMul(t,fromId){const s=t.str;if(!s)return 1;let m=1+0.4*s.out;const l=fromId==null?0:(s.lines[fromId]||0);return m*(1+0.6*l)}
function defMulT(t,fromId,pt){if(t.owner<0)return 1;const f=F[t.owner];return defMul(f)*(t.isCap?1.25:1)*(SP[f.species].terr===t.terrain?1.15:1)*strMul(t,fromId)*(typeof wallMul==='function'?wallMul(t,fromId,pt):1)}
function defPower(t,fromId,pt){return t.troops*defMulT(t,fromId,pt)}

/* ===== Diplomatie ===== */
/* Soldat aus der Kolonie ins Gebiet (im Mehrspieler-Gast an den Host gemeldet) */
function addTroops(t,n){t.troops=Math.floor(t.troops)+n;if(typeof NET!=='undefined'&&NET.role==='guest')NET.cmd({k:'tr',tile:t.id,n})}
function proposeAlliance(fid){
  const f=F[fid];if(!f||!f.alive||f.allied)return;
  if(f.dipCool>0)return toast(`${f.name} will gerade nicht verhandeln (${Math.ceil(f.dipCool)}s)`,'bad');
  let ch=0.6-0.1*heatStage();if(gtime-f.hurt<90)ch-=0.4;ch=clamp(ch,0.08,0.9);
  if(Math.random()<ch){f.allied=true;toast(`${f.name} ist jetzt dein Verbündeter`,'good')}
  else{f.dipCool=45;toast(`${f.name} lehnt das Bündnis ab`,'bad')}
}
function breakAlliance(fid){const f=F[fid];if(!f||!f.allied)return;f.allied=false;f.dipCool=120;H.v=Math.min(100,H.v+10);toast(`Bündnis mit ${f.name} gelöst. Dein Ruf leidet`,'bad')}

/* ===== Märsche und Kämpfe ===== */
const wpos=t=>[t.lx*CS+5,t.ly*CS+5];
const PROT={easy:150,normal:90,hard:60};
const rtime=()=>gtime/SIMV;
const protLeft=()=>started?Math.max(0,PROT[diffKey]-rtime()):0;
const clockT=s=>{s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s%60).padStart(2,'0')};
const mmss=s=>Math.floor(s/60)+':'+String(Math.ceil(s%60)%60).padStart(2,'0');
function launch(from,to,n,fid){
  if(to.owner!==fid&&!isFriend(fid,to.owner)&&protLeft()>0){if(fid===0)toast(`Schutzzeit: noch ${mmss(protLeft())}. Bis dahin kann niemand angreifen`,'bad');return false}
  from.troops-=n;
  const d=Math.hypot(from.lx-to.lx,from.ly-to.ly),road=fid===0&&typeof roadLink==='function'&&roadLink(from,to);
  marches.push({from,to,n,f:fid,t:0,dur:(2.5+d*0.14)/(fid===0?pwMul('speed'):1)/(road?2.2:1),phase:'walk',ft:0,fdur:2.4,seed:(Math.random()*1e6)|0});
  if(fid===0&&to.owner>0&&!isFriend(0,to.owner)){F[to.owner].hurt=gtime;addHeat(to.owner)}
  if(to.owner===0&&fid!==0&&!isFriend(0,fid)){
    toast(`Angriff auf ${to.name}: ${F[fid].name} schickt ${n} Soldaten`,'bad');
    if(typeof flashHit==='function')flashHit();
    for(const a of F){if(a.isPlayer||!a.alive||!a.allied||a.id===fid)continue;
      const h=T.find(t=>t.owner===a.id&&t.adj.includes(to.id)&&t.troops>=14);
      if(h){const k=Math.min(12,Math.floor(h.troops*0.35));if(k>=3){launch(h,to,k,a.id);toast(`${a.name} schickt dir ${k} Soldaten zu Hilfe`,'good')}}}
  }
}
function startFight(m){
  const to=m.to,f=F[m.f];
  if(isFriend(m.f,to.owner)){m.phase='join';return}
  m.phase='fight';m.ft=0;
  m.A=m.n*atkMul(f);m.Dp=defPower(to,m.sea?null:m.from.id,m.sea?m.land:null);m.D0=to.troops;m.win=m.A>m.Dp;
  m.attRem=m.win?(m.A-m.Dp)/m.A:0;m.defRem=m.win?0:(m.Dp-m.A)/m.Dp;
  m.dOwner=to.owner;
}
function addFloat(x,y,txt,c){fxs.push({k:'text',x,y,t:0,dur:1.8,txt,c})}
function resolve(m){
  if(m.sea&&m.home&&m.home.port&&m.home.owner===m.f)m.home.port.rafts=Math.min(m.home.port.max,m.home.port.rafts+1);
  const to=m.to,f=F[m.f];if(!f.alive)return;
  const[px,py]=wpos(to);
  if(m.phase==='join'||isFriend(m.f,to.owner)){to.troops+=m.n;addFloat(px,py-22,'+'+m.n,'#9be86a');return}
  const fr=m.sea?null:m.from.id,lp=m.sea?m.land:null,dm=defMulT(to,fr,lp),mine=to.owner===0,mineAtk=m.f===0;
  const A=m.n*atkMul(f),Dp=defPower(to,fr,lp);
  if(A>Dp){
    const surv=Math.max(1,Math.round((A-Dp)/atkMul(f)*0.85)),lost=Math.floor(to.troops),wasCap=to.isCap;
    addFloat(px,py-24,'-'+lost,'#ff8a70');
    setOwner(to,m.f,surv);
    fxs.push({k:'ripple',x:px,y:py,t:0,dur:1.6,c:f.rgb});
    if(mineAtk){qStat('conq');toast(`${to.name} erobert!`,'good');to.conqN=clamp(3+Math.round(lost/7)+(wasCap?3:0),3,10);askConquest(to)}
    else if(mine)toast(`${to.name} ist verloren`,'bad');
  }else{
    const loss=A/dm;to.troops=Math.max(1,to.troops-loss);
    addFloat(px,py-24,'-'+Math.round(loss),'#ff8a70');addFloat(px-14,py-12,'-'+m.n,'#ffd9a0');
    if(mineAtk)toast(`Angriff auf ${to.name} gescheitert`,'bad');else if(mine)toast(`${to.name} hält stand`,'good');
  }
}
function setOwner(t,nw,troops){
  const old=t.owner,wasCap=t.isCap;
  t.owner=nw;t.troops=troops;t.isCap=false;t.str=newStr();ownDirty=true;strDirty=true;t.walls=[];t.port=null;if(typeof roadsChanged==='function')roadsChanged();
  if(old===0){t.col=null;renderColSwitch()}
  if(nw===0)t.col=null;
  if(nw===0)collectItem(t);
  if(old>0&&wasCap)relocateCapital(old);
  if(old===0&&wasCap)relocateCapital(0);
  if(old>=0&&!T.some(x=>x.owner===old))eliminate(old,nw);
  if(old===0&&started&&!over&&col&&col.tid===t.id){const n=T.find(x=>x.owner===0&&x.col);if(n)openColony(n.id,true)}
}
function relocateCapital(fid){
  const f=F[fid],own=T.filter(x=>x.owner===fid);if(!own.length)return;
  const sc=x=>(x.col?1000+dugCount(x.col):0)+x.troops;
  const best=own.reduce((a,b)=>sc(b)>sc(a)?b:a);
  best.isCap=true;f.capital=best.id;
  if(fid===0){
    if(!best.col){best.col=makeColony(best,'conquest',F[0].species,3);renderColSwitch()}
    toast(`Hauptstadt verloren! Neue Hauptstadt: ${best.name}`,'bad');
  }else toast(`${f.name} verlegt ihre Hauptstadt nach ${best.name}`,'');
}
function eliminate(fid,by){
  const f=F[fid];f.alive=false;marches=marches.filter(m=>m.f!==fid);
  if(fid===0){endGame(false);return}
  toast(`${f.name} wurde ausgelöscht`,by===0?'good':'');
  if(!contWin&&F.every(x=>x.isPlayer||!x.alive))endGame(true);
}
function endGame(win){
  over=true;
  $('#endCont').hidden=!win;
  $('#endT').textContent=win?'Sieg!':'Niederlage';
  $('#endP').textContent=win?`Alle Gegner sind besiegt. Dein Volk herrscht über das Land (Tag ${dayNo()}).`:`Du hast kein Gebiet mehr. Die Kolonien sind verloren (Tag ${dayNo()}).`;
  $('#end').hidden=false;
}
const dayNo=()=>G?Math.floor(G.time/DAYLEN)+1:1;

/* ===== Eroberte Gebiete: werden immer behalten und verschmelzen mit dem Reich ===== */
function askConquest(t){chooseConquest(t.id)}
function chooseConquest(id){
  const t=T[id];
  if(t.owner===0){const n=t.conqN||4,m=n*6,fo=n*4;G.mat=Math.min(G.matCap,G.mat+m);G.food=Math.min(G.foodCap,G.food+fo);toast(`${t.name} gehört jetzt zu deinem Reich: +${m} Erde, +${fo} Blätter`,'good');renderColSwitch()}
  ownDirty=true;
}

function updateWorld(dt){
  gtime+=dt;const D=DIFFS[diffKey];
  if(typeof updateSea==='function')updateSea(dt);
  H.v=Math.max(0,H.v-0.25*dt);
  for(const f of F)if(f.dipCool>0)f.dipCool=Math.max(0,f.dipCool-dt);
  for(const t of T){
    if(t.owner===0){const o=t.str.out;if(o&&t.troops<30)t.troops=Math.min(30,t.troops+0.05*o*dt)}
    else if(t.owner>0&&!F[t.owner].human){const cp=t.isCap,mx=cp?60:30;if(t.troops<mx)t.troops=Math.min(mx,t.troops+(cp?0.5:0.15)*D.regen*dt+0.05*t.str.out*dt)}
  }
  for(let i=marches.length-1;i>=0;i--){const m=marches[i];
    if(m.phase==='walk'){m.t+=dt;if(m.t>=m.dur)startFight(m)}
    if(m.phase==='join'){marches.splice(i,1);resolve(m);if(over)return;continue}
    if(m.phase==='fight'){m.ft+=dt;if(m.ft>=m.fdur){marches.splice(i,1);resolve(m);if(over)return}}}
  for(let i=fxs.length-1;i>=0;i--){fxs[i].t+=dt;if(fxs[i].t>=fxs[i].dur)fxs.splice(i,1)}
  for(const f of F){if(f.isPlayer||f.human||!f.alive)continue;f.timer-=dt;if(f.timer<=0){f.timer=D.think*(0.7+Math.random()*0.6)*(1-0.08*heatStage());botThink(f)}}
}
function botBuild(f){
  const mine=T.filter(t=>t.owner===f.id&&t.troops>=12&&t.adj.some(i=>T[i].owner!==f.id));
  if(!mine.length)return false;const t=pick(mine);
  const foes=t.adj.filter(i=>T[i].owner!==f.id&&T[i].owner!==-1);
  if(foes.length&&t.walls&&t.walls.length<2&&Math.random()<0.3&&M.bp){const pts=M.bp.get(t.id+'-'+pick(foes));if(pts&&pts.length){const q=pick(pts);t.walls.push({x:q[0],y:q[1]});t.troops-=5;return true}}
  if(foes.length&&Math.random()<0.6){const n=pick(foes);if((t.str.lines[n]||0)<2){t.str.lines[n]=(t.str.lines[n]||0)+1;t.troops-=4;strDirty=true;return true}}
  if(t.str.out<2){t.str.out++;t.troops-=5;strDirty=true;return true}return false;
}
function botThink(f){
  const D=DIFFS[diffKey],hs=heatStage();let best=null,bs=-1e9;
  for(const t of T){
    if(t.owner!==f.id)continue;
    const avail=Math.floor(t.troops)-(t.isCap?8:4);if(avail<6)continue;
    const send=Math.floor(avail*0.85);
    for(const ai of t.adj){const a=T[ai];if(a.owner===f.id)continue;if(f.allied&&a.owner===0)continue;
      const need=D.ratio-(a.owner===0?hs*0.1:0);
      const ratio=send*atkMul(f)/Math.max(1,defPower(a,t.id));if(ratio<need)continue;
      const sc=ratio+(a.owner<0?0.4:0)+(a.isCap?0.8:0)+(a.owner===0?0.2+hs*0.45:0)+Math.random()*0.3;
      if(sc>bs){bs=sc;best={t,a,send}}}
  }
  if(best){launch(best.t,best.a,best.send,f.id);return}
  if(Math.random()<0.5&&botBuild(f))return;
  for(const t of T){
    if(t.owner!==f.id||Math.floor(t.troops)<14)continue;
    if(t.adj.some(i=>T[i].owner!==f.id))continue;
    const nb=t.adj.map(i=>T[i]).filter(a=>a.owner===f.id&&a.adj.some(i=>T[i].owner!==f.id));
    if(nb.length){const dst=nb.reduce((p,q)=>q.troops<p.troops?q:p);launch(t,dst,Math.floor(t.troops*0.7),f.id);return}
  }
}
function buildStr(t,kind,nid){
  if(t.owner!==0)return;
  const lv=kind==='out'?t.str.out:(t.str.lines[nid]||0);
  if(lv>=2)return toast('Schon auf höchster Stufe','bad');
  const c=STR_COST[kind][lv];
  if(G.mat<c.mat)return toast('Zu wenig Material','bad');if(G.food<c.food)return toast('Zu wenig Blätter','bad');
  G.mat-=c.mat;G.food-=c.food;
  if(kind==='out')t.str.out++;else t.str.lines[nid]=lv+1;
  qStat('built');
  strDirty=true;const[px,py]=wpos(t);fxs.push({k:'ripple',x:px,y:py,t:0,dur:1,c:[240,200,110]});
  toast(kind==='out'?`Außenposten in ${t.name} (Stufe ${lv+1})`:`Verteidigungslinie gegen ${T[nid].name} (Stufe ${lv+1})`,'good');
}

/* ===== Weltkarte: Zeichnen ===== */
function renderStructures(){
  const c=makeCanvas(MW,MH),g=c.getContext('2d');
  const draw=(x,y,dx,dy,t,lv,mine)=>{
    for(let l=0;l<lv;l++){const off=3+l*3;
      for(let k=0;k<CS;k+=5){g.fillStyle=((k/5)|0)%2?'#2a1a0c':rgb(mixc(F[t.owner].rgb,[255,255,255],0.2));
        if(dx!==0)g.fillRect(mine?x*CS+CS-off-2:x*CS+off-1,y*CS+k,3,5);else g.fillRect(x*CS+k,mine?y*CS+CS-off-2:y*CS+off-1,5,3)}}
  };
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const a=M.tid[y*GW+x];if(a<0)continue;
    for(const[dx,dy]of[[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=GW||ny>=GH)continue;const b=M.tid[ny*GW+nx];if(b<0||b===a)continue;
      const la=T[a].owner>=0?T[a].str.lines[b]||0:0,lb=T[b].owner>=0?T[b].str.lines[a]||0:0;
      if(la)draw(x,y,dx,dy,T[a],la,true);
      if(lb)draw(nx,ny,dx,dy,T[b],lb,false)}
  }
  return c;
}
/* Verschmolzene Gebiete: Fläche des zusammenhängenden Reichs, die Hauptstadt wird damit größer, Städte bleiben klein */
function computeRegions(){
  const seen=new Set();
  for(const t of T){t.regArea=0}
  for(const t of T){
    if(seen.has(t.id)||t.owner<0)continue;
    const comp=[t],q=[t];seen.add(t.id);
    while(q.length){const a=q.pop();for(const i of a.adj){const b=T[i];if(!seen.has(i)&&mergedTerr(a,b)&&mergedTerr(t,b)){seen.add(i);comp.push(b);q.push(b)}}}
    const area=comp.reduce((s,x)=>s+x.cells.length,0);for(const x of comp)x.regArea=area;
  }
}
function nestSize(t){
  if(t.isCap)return 1.35+clamp((t.regArea||t.cells.length)/650,0,1.35);
  return clamp(0.6+t.troops/160,0.6,0.88);
}
function drawNest(g,sp,x,y,sz){
  g.save();g.translate(x,y);g.scale(sz,sz);
  const R=(a,b,w,h,cc)=>{g.fillStyle=cc;g.fillRect(a,b,w,h)};
  if(sp==='termite'){
    for(let i=0;i<18;i++){const hw=3+Math.pow(i/18,0.8)*9,yy=-i;R(-hw,yy,hw*2,1,i%3===0?'#a67c46':'#c9a064')}
    for(let i=0;i<18;i++){R(-1-(i%2),-i,1,1,'#8a6234')}R(-2,-1,4,3,'#2a1a0c');R(-11,0,22,1,'#7a5a30');
  }else if(sp==='leaf'){
    R(-2,-12,4,13,'#5a3a1c');R(-2,-12,1,13,'#7a5230');
    ell(g,0,-15,10,7,'#235a2c');ell(g,-1,-17,8,5,'#2f7a3a');ell(g,-3,-19,4,2,'#52b05a');ell(g,-8,-10,5,3,'#2f7a3a');ell(g,8,-10,5,3,'#2f7a3a');
    R(-5,0,10,2,'#7a4f28');R(-2,0,4,2,'#22140a');
  }else{
    for(let i=0;i<12;i++){const hw=2+i*1.2;R(-hw,-12+i,hw*2,1,i%3===0?'#7a4f28':'#8e5d30')}
    R(-2,-1,4,2,'#22140a');R(-6,-4,2,1,'#a8764a');
  }
  g.restore();
}
function drawTower(g,x,y,lv,c){
  g.fillStyle='#2a1a0c';g.fillRect(x-6,y-1,12,13);g.fillStyle='#8a5a30';g.fillRect(x-5,y,10,11);g.fillStyle='#a8764a';g.fillRect(x-5,y,3,11);
  g.fillStyle='#2a1a0c';g.fillRect(x-8,y-4,16,5);g.fillStyle='#caa06a';g.fillRect(x-7,y-3,14,3);
  g.fillStyle='#2a1a0c';g.fillRect(x-1,y-12,2,9);g.fillStyle=rgb(c);g.fillRect(x+1,y-12,7,4);
  if(lv>1){g.fillStyle='#f0b94a';g.fillRect(x-3,y+4,6,2)}
}
const gemIc={};
function gemIcon(type){
  if(!gemIc[type]){const c=document.createElement('canvas');try{drawIcon(c,PWIC[type])}catch(e){}gemIc[type]=c}
  return gemIc[type];
}
const GEMCOL={dig:'#c8a050',forage:'#6fc24c',egg:'#f0e4c0',farm:'#e0914f',atk:'#e0523d',def:'#4a7ab8',speed:'#f0b94a'};
function drawGem(g,x,y,now,item){
  const p=0.5+0.5*Math.sin(now/300),by=Math.round(y+Math.sin(now/420+x)*2),col=item?GEMCOL[item.type]||'#46d3e8':'#46d3e8';
  g.fillStyle=`rgba(255,225,120,${0.2+0.2*p})`;g.beginPath();g.arc(x,by,24+p*3,0,6.283);g.fill();
  g.fillStyle='#120a04';g.fillRect(x-20,by-20,40,40);
  g.fillStyle=col;g.fillRect(x-18,by-18,36,36);
  g.fillStyle='#1c120a';g.fillRect(x-15,by-15,30,30);
  if(item){const ic=gemIcon(item.type),sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=false;g.drawImage(ic,x-12,by-12,24,24);g.imageSmoothingEnabled=sm;
    g.font='700 12px '+PX;g.textAlign='center';g.textBaseline='alphabetic';const tx='+'+item.pct+'%',tw=g.measureText(tx).width+8;
    g.fillStyle='rgba(22,13,6,.95)';g.fillRect(x-tw/2,by+21,tw,15);g.strokeStyle=col;g.lineWidth=1;g.strokeRect(x-tw/2+.5,by+21.5,tw-1,14);g.fillStyle='#fff';g.fillText(tx,x,by+33)}
}
function clampMapCam(){
  const vw=MW/mcam.z,vh=MH/mcam.z;
  mcam.x=clamp(mcam.x,0,Math.max(0,MW-vw));mcam.y=clamp(mcam.y,0,Math.max(0,MH-vh));
}
function drawMap(g,now){
  g.setTransform(RD,0,0,RD,0,0);g.fillStyle='#1b0f07';g.fillRect(0,0,MW,MH);
  clampMapCam();g.setTransform(mcam.z*RD,0,0,mcam.z*RD,-mcam.x*mcam.z*RD,-mcam.y*mcam.z*RD);
  g.imageSmoothingEnabled=false;
  g.drawImage(baseCanvas,0,0);
  if(ownDirty){ownCanvas=renderOwners(M,F);computeRegions();ownDirty=false}
  if(strDirty){strCanvas=renderStructures();strDirty=false}
  g.drawImage(ownCanvas,0,0);g.drawImage(strCanvas,0,0);
  if(typeof drawRoadLayer==='function')drawRoadLayer(g,now);
  const fillT=(t,style)=>{g.fillStyle=style;for(const i of t.cells)g.fillRect((i%GW)*CS,((i/GW)|0)*CS,CS,CS)};
  if(!started){for(const t of T)if(t.terrain!==SP[setupSp].terr)fillT(t,'rgba(12,8,3,.5)')}
  if(hovT!=null)fillT(T[hovT],'rgba(255,255,255,.16)');
  if(selT!=null){fillT(T[selT],'rgba(255,255,255,.22)');for(const ai of T[selT].adj)fillT(T[ai],'rgba(255,255,255,.08)')}
  g.textAlign='center';g.textBaseline='middle';
  const lead=started?leaderFid(now):-1;
  for(const t of T){
    const px=t.lx*CS+5,py=t.ly*CS+5;
    g.font='600 11px '+PX;g.lineWidth=3;g.strokeStyle='rgba(20,12,4,.85)';g.strokeText(t.name,px,py-17);g.fillStyle='#fff6dc';g.fillText(t.name,px,py-17);
    if(lead>=0&&t.isCap&&t.owner===lead)drawCrown(g,cosmOf(lead).crown||null,px,py-24,2);
    if(!started){
      if(t.terrain===SP[setupSp].terr&&setupStart!==t.id){g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.beginPath();g.arc(px,py,13+Math.sin(now/300)*2,0,6.283);g.stroke()}
      if(setupStart===t.id){drawCapMark(g,px,py,FCOL[0]);drawNest(g,setupSp,px,py+26,1)}
      continue;
    }
    if(t.owner>=0&&!svDraw(g,'city',cosmOf(t.owner).bskin||'default',rgb(F[t.owner].rgb),px,py+30,nestSize(t)*0.55,F[t.owner].species))drawNest(g,F[t.owner].species,px,py+28,nestSize(t));
    const flg=t.isCap&&t.owner>=0&&typeof cosmOf==='function'?cosmOf(t.owner).flag:null;
    if(flg){const im=flagImg(flg);if(im.complete&&im.naturalWidth){g.fillStyle='#d9d0b8';g.fillRect(px-1,py+2,1,16);g.drawImage(im,px,py+2,13,9)}}
    const txt=String(Math.floor(t.troops));g.font='700 13px '+PX;
    const w=g.measureText(txt).width+12,col2=t.owner>=0?F[t.owner].rgb:[170,160,140];
    g.fillStyle='rgba(22,13,6,.86)';g.fillRect(px-w/2,py-8,w,16);
    g.strokeStyle=rgb(col2);g.lineWidth=2;g.strokeRect(px-w/2+1,py-7,w-2,14);g.setLineDash([]);
    g.fillStyle='#fff';g.fillText(txt,px,py+1);
    if(t.isCap)drawCapMark(g,px-w/2-8,py,col2);
    if(t.item)drawGem(g,px,py-66,now,t.item);
  }
  if(typeof drawSeaLayer==='function')drawSeaLayer(g,now);
  for(const m of marches)drawMarch(g,m,now);
  drawFx(g,now);
  if(typeof drawSeaTop==='function')drawSeaTop(g,now);
  g.setTransform(1,0,0,1,0,0);
}
function drawCapMark(g,x,y,c){
  g.fillStyle='rgba(20,12,4,.9)';g.beginPath();g.moveTo(x-8,y+7);g.lineTo(x,y-8);g.lineTo(x+8,y+7);g.closePath();g.fill();
  g.fillStyle=rgb(c);g.beginPath();g.moveTo(x-5,y+5);g.lineTo(x,y-4);g.lineTo(x+5,y+5);g.closePath();g.fill();
}
function miniPal(c){return{body:rgb(mixc(c,[16,8,4],0.55)),hi:rgb(c),head:rgb(mixc(c,[16,8,4],0.7)),eye:'#fff',leg:rgb(mixc(c,[16,8,4],0.8)),mand:'#fff'}}
function drawMarch(g,m,now){
  const[ax,ay]=m.sea?m.a:wpos(m.from),[bx,by]=m.sea?m.b:wpos(m.to),c=F[m.f].rgb,len=Math.hypot(bx-ax,by-ay)||1,ux=(bx-ax)/len,uy=(by-ay)/len,pal=miniPal(c);
  if(m.phase==='walk'&&m.sea){drawSeaMarch(g,m,now,ax,ay,bx,by,ux,uy,len,pal);return}
  if(m.phase==='walk'){
    const p=m.t/m.dur;
    g.setLineDash([6,5]);g.lineDashOffset=-now/40;g.strokeStyle=rgb(c,0.8);g.lineWidth=2;g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();g.setLineDash([]);
    const k=Math.min(14,Math.ceil(m.n/3)),sp=F[m.f].species;
    for(let i=k-1;i>=0;i--){const d=p*len-i*7,lat=Math.sin(i*2.7+m.seed)*5;if(d<0||d>len)continue;
      drawAnt(g,ax+ux*d-uy*lat,ay+uy*d+ux*lat,ux,uy,now/60+i,'w',sp,i<3?'leaf':null,0.46,pal)}
    const hx=ax+ux*p*len,hy=ay+uy*p*len;
    g.fillStyle='#2a1a0c';g.fillRect(hx+4,hy-16,2,12);g.fillStyle=rgb(c);g.fillRect(hx+6,hy-16,8,5);
    g.font='700 12px '+PX;g.textAlign='center';g.lineWidth=3;g.strokeStyle='rgba(20,12,4,.9)';g.strokeText(m.n,hx,hy-22);g.fillStyle='#fff';g.fillText(m.n,hx,hy-22);
  }else if(m.phase==='fight')drawBattle(g,m,now,ux,uy,pal);
}
function drawBattle(g,m,now,ux,uy,pal){
  const[cx,cy]=m.sea?m.b:wpos(m.to),p=clamp(m.ft/m.fdur,0,1),e=p*p*(3-2*p),f=F[m.f],dc=m.dOwner>=0?F[m.dOwner].rgb:[170,160,140],dsp=m.dOwner>=0?F[m.dOwner].species:'ground',dpal=m.dOwner>=0?miniPal(dc):{body:'#5a5248',hi:'#8a8070',head:'#403a32',eye:'#ddd',leg:'#2a2620',mand:'#ccc'};
  const px=-uy,py=ux,fr=now/1000;
  for(let i=0;i<7;i++){const a=i*0.9+fr*2,r=8+Math.sin(fr*6+i)*3;g.fillStyle=`rgba(210,185,140,${0.22+0.1*Math.sin(fr*8+i)})`;g.beginPath();g.arc(cx+Math.cos(a)*14,cy+Math.sin(a)*8+4,r,0,6.283);g.fill()}
  const nA=Math.max(1,Math.min(9,Math.ceil(m.n/4)*(1-e*(1-m.attRem)))|0),nD=Math.max(1,Math.min(9,Math.ceil(m.D0/4)*(1-e*(1-m.defRem)))|0);
  const row=(n,side,spc,pl)=>{for(let i=0;i<n;i++){const lat=(i-(n-1)/2)*7,lunge=Math.sin(fr*9+i*1.7+(side>0?0:2))*3.2+2,bx=cx-ux*side*(10-lunge)+px*lat,by=cy-uy*side*(10-lunge)+py*lat;
      drawAnt(g,bx,by,ux*side,uy*side,fr*18+i,'s',spc,null,0.6,pl)}};
  row(nA,1,f.species,pal);row(nD,-1,dsp,dpal);
  const sd=Math.floor(fr*14);g.fillStyle='#ffe9a0';
  for(let i=0;i<6;i++){const a=hash2(sd,i,m.seed)*6.283,r=hash2(i,sd,m.seed)*16;g.fillRect(cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.7,2,2)}
  g.fillStyle='#fff';for(let i=0;i<3;i++){const a=hash2(sd,i+9,m.seed)*6.283,r=hash2(i+4,sd,m.seed)*20;g.fillRect(cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.7,1,3)}
  const bw=44,by2=cy-34;g.fillStyle='rgba(20,12,4,.9)';g.fillRect(cx-bw/2-2,by2-2,bw+4,12);
  g.fillStyle='#2a1a0c';g.fillRect(cx-bw/2,by2,bw,3);g.fillStyle=rgb(f.rgb);g.fillRect(cx-bw/2,by2,bw*(1-e*(1-m.attRem)),3);
  g.fillStyle='#2a1a0c';g.fillRect(cx-bw/2,by2+5,bw,3);g.fillStyle=rgb(dc);g.fillRect(cx-bw/2,by2+5,bw*(1-e*(1-m.defRem)),3);
}
function drawFx(g,now){
  for(const f of fxs){const p=f.t/f.dur;
    if(f.k==='text'){g.globalAlpha=1-p*p;g.font='700 15px '+PX;g.textAlign='center';g.lineWidth=4;g.strokeStyle='rgba(20,12,4,.95)';g.strokeText(f.txt,f.x,f.y-p*22);g.fillStyle=f.c;g.fillText(f.txt,f.x,f.y-p*22);g.globalAlpha=1}
    else if(f.k==='ripple'){g.globalAlpha=1-p;g.strokeStyle=rgb(f.c);g.lineWidth=4*(1-p)+1;g.beginPath();g.arc(f.x,f.y,6+p*46,0,6.283);g.stroke();g.beginPath();g.arc(f.x,f.y,3+p*28,0,6.283);g.stroke();g.globalAlpha=1}}
}

/* ===== Weltkarte: Eingabe ===== */
function mapWorld(e){
  const cv=$('#mv'),r=cv.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*MW,sy=(e.clientY-r.top)/r.height*MH;
  return[sx/mcam.z+mcam.x,sy/mcam.z+mcam.y];
}
function terrAtEvent(e){
  const[x,y]=mapWorld(e),cx=Math.floor(x/CS),cy=Math.floor(y/CS);if(cx<0||cy<0||cx>=GW||cy>=GH)return null;
  const t=M.tid[cy*GW+cx];return t<0?null:t;
}
function mapClick(id){
  if(!started){
    if(id==null)return;const t=T[id],sp=SP[setupSp];
    if(t.terrain!==sp.terr){toast(`${sp.name} starten nur im Gebiet „${TERR[sp.terr].name}“`,'bad');return}
    if(setupStart!=null)T[setupStart].owner=-1;
    setupStart=id;t.owner=0;ownDirty=true;updateSetupPanel();return;
  }
  if(over)return;
  if(id==null){selT=null;return}
  const t=T[id];
  if(selT!=null&&selT!==id&&T[selT].owner===0&&T[selT].adj.includes(id)&&sideTab==='info'&&t.owner===0){
    const from=T[selT],n=Math.floor((Math.floor(from.troops)-1)*pct/100);
    if(n<1){toast('Zu wenige Soldaten für einen Marsch','bad');return}
    launch(from,t,n,0);return;
  }
  if(t.owner!==0&&selT!=null&&T[selT].owner===0){toast('Rechtsklick auf das Gebiet öffnet Angriff, Bündnis und Spenden','good');return}
  selT=selT===id?null:id;
}
