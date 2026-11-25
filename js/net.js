/* ===== Mehrspieler (Host-Prinzip, ohne eigenen Server) =====
   Der Host führt die Welt (Bots, Märsche, Kämpfe) wie im Einzelspiel und sendet ca. 2× pro Sekunde einen Schnappschuss.
   Gäste spielen ihre Kolonie lokal, simulieren die Welt aber nicht, sondern übernehmen den Schnappschuss, und senden Befehle.
   Transport: der Lobby-Kanal (AW.channel: Supabase Realtime bzw. BroadcastChannel im Gastmodus). Ein späterer Server
   oder WebRTC muss nur `NET.ch` (send/leave) und den Aufruf von `NET.onmsg` / `NET.onPresence` ersetzen. */
const NET={server:false,role:null,ch:null,live:false,players:[],humans:[],ready:{},fid:0,hostPid:null,sent:false,sentSp:null,sentStart:null,miss:{},timer:null,
  active(){return !!this.role},
  /* Von der Lobby beim Spielstart übergeben */
  begin({ch,host,players,server}){
    this.close(true);Object.assign(this,{server:!!server,role:host?'host':'guest',ch,players:players||[],humans:[],ready:{},fid:0,hostPid:host?PID:null,live:false,sent:false,miss:{}});
    this.timer=setInterval(()=>this.tick(),500);this.refreshStart();
  },
  send(m){if(this.ch)this.ch.send({...m,p:PID})},
  cmd(c){if(this.role==='guest'&&this.live)this.send({t:'cmd',...c})},
  close(silent){
    clearInterval(this.timer);this.timer=null;
    if(this.ch){try{if(this.role==='host'&&this.live&&!silent)this.send({t:'hostleft'});this.ch.leave()}catch(e){}}
    Object.assign(this,{server:false,role:null,ch:null,live:false,players:[],humans:[],ready:{},sent:false});
    const b=$('#btnStart');if(b)b.textContent=t('Spiel starten');
  },
  /* Ansicht eines Gastes: Fraktions-ID des Gasts und die des Hosts (0) vertauschen, damit sich jeder selbst als „0“ sieht */
  V(h){return h===0?this.fid:h===this.fid?0:h},
  guestPids(){return this.players.map(p=>p.pid).filter(x=>x&&x!==PID)},
  onPresence(l){this.players=l;if(this.live){const now=Date.now();for(const p of l)delete this.miss[p.pid]}this.refreshStart()},
  /* Verbindungsprüfung: ein verschwundener Gast wird zum Bot, ein verschwundener Host beendet die Partie für Gäste */
  tick(){
    if(this.server||!this.live||!started||over)return;
    const present=new Set(this.players.map(p=>p.pid)),now=Date.now();
    const watch=this.role==='host'?this.humans.map(h=>h.pid):[this.hostPid];
    for(const pid of watch){
      if(present.has(pid)){delete this.miss[pid];continue}
      this.miss[pid]=this.miss[pid]||now;
      if(now-this.miss[pid]<5000)continue;
      if(this.role==='host'){const h=this.humans.find(x=>x.pid===pid),f=h&&F[h.fid];
        if(f&&f.human){f.human=false;f.timer=3;toast(`${f.name} hat das Spiel verlassen. Ein Bot übernimmt`,'')}delete this.miss[pid]}
      else this.hostGone();
    }
  },
  hostGone(){if(!started||over)return;toast(LANG==='de'?'Der Host hat die Partie verlassen.':'The host left the match.','bad');endGame(false)},
  refreshStart(){
    const b=$('#btnStart');if(!b||started)return;
    if(this.role==='host'&&!this.live){const n=this.guestPids().length,r=this.guestPids().filter(p=>this.ready[p]).length;
      b.disabled=setupStart==null||r<n;b.textContent=r<n?`${t('Warte auf Spieler')} (${r}/${n})`:t('Spiel starten')}
    else if(this.role==='guest'){b.disabled=setupStart==null||this.sent;b.textContent=this.sent?t('Warte auf Host …'):t('Bereit')}
  },

  /* ---------- Host ---------- */
  startHost(){ /* vor startGame(): Mitspieler festlegen und Startgebiete prüfen */
    const used=new Set([setupStart]),hum=[];let ok=true;
    for(const pid of this.guestPids()){
      const r=this.ready[pid],t0=r&&T[r.start];
      if(!r||!t0||!SP[r.species]||t0.terrain!==SP[r.species].terr||used.has(r.start)){
        ok=false;delete this.ready[pid];this.send({t:'nack',to:pid,why:'start'});continue}
      used.add(r.start);hum.push({pid,fid:hum.length+1,name:r.name,species:r.species,start:r.start,c:r.c});
    }
    if(!ok){toast(LANG==='de'?'Ein Startgebiet war ungültig. Der Spieler wählt neu.':'A start area was invalid. The player picks again.','bad');this.refreshStart();return false}
    this.humans=hum;return true;
  },
  afterStartHost(){
    this.live=true;for(const h of this.humans)if(F[h.fid])F[h.fid].cosm=h.c;
    this.send({t:'init',...this.snap(),hp:PID,fids:Object.fromEntries(this.humans.map(h=>[h.pid,h.fid])),d:diffKey,
      Fi:F.map((f,h)=>({n:h===0?AW.name:f.name,sp:f.species,rgb:f.rgb,hum:f.human?1:0,c:h===0?cosmPack():((this.humans.find(x=>x.fid===h)||{}).c||null)}))});
    clearInterval(this.snapIv);this.snapIv=setInterval(()=>{if(this.role==='host'&&this.live&&started)this.send({t:'snap',...this.snap()})},500);
  },
  snap(){
    return{gt:+gtime.toFixed(1),sp:speed,sm:SIMV,T:T.map(x=>[x.owner,Math.round(x.troops*10)/10,x.isCap?1:0]),F:F.map(f=>f.alive?1:0),C:F.map(f=>f.capital),
      M:marches.map(m=>({f:m.f,a:m.from.id,b:m.to.id,n:m.n,t:+(m.t||0).toFixed(2),dur:+m.dur.toFixed(2),ph:m.phase,ft:+(m.ft||0).toFixed(2),fd:m.fdur,sd:m.seed,A:m.A,Dp:m.Dp,D0:m.D0,w:m.win?1:0,ar:m.attRem,dr:m.defRem,dO:m.dOwner}))};
  },
  /* Befehl eines Gastes prüfen und ausführen; alles Unsinnige wird verworfen */
  hostCmd(m){
    if(!this.live||!started||over)return;
    const h=this.humans.find(x=>x.pid===m.p);if(!h||!F[h.fid]||!F[h.fid].alive||!F[h.fid].human)return;
    if(m.k==='launch'){
      const from=T[m.from],to=T[m.to],n=Math.floor(+m.n);
      if(!from||!to||from.owner!==h.fid||!from.adj.includes(to.id)||!(n>=1)||n>Math.floor(from.troops)-1)return;
      launch(from,to,n,h.fid);
    }else if(m.k==='tr'){
      const x=T[m.tile],now=Date.now();
      h.tb=Math.min(12,(h.tb==null?12:h.tb)+((now-(h.tl||now))/1000)*6);h.tl=now;
      if(!x||x.owner!==h.fid||h.tb<1||x.troops>=100)return;
      h.tb-=1;x.troops=Math.floor(x.troops)+1;
    }
  },

  /* ---------- Gast ---------- */
  applyInit(s){
    SIMV=s.sm||2;speed=SIMV;this.fid=s.fids[PID];this.hostPid=s.hp;diffKey=s.d;const V=h=>this.V(h),nf=[];
    s.Fi.forEach((f,h)=>{const i=V(h);nf[i]={id:i,isPlayer:i===0,human:!!f.hum,name:i===0?'Du':f.n,species:f.sp,rgb:f.rgb,alive:!!s.F[h],capital:s.C[h],allied:false,dipCool:0,hurt:-999,timer:99,cosm:cosmClean(f.c)}});
    F=nf;
    T.forEach((x,i)=>{const d=s.T[i];x.owner=V(d[0]);x.troops=d[1];x.isCap=!!d[2];x.str=newStr();if(x.owner!==0)x.col=null});
    marches=[];fxs=[];gtime=s.gt;ownDirty=true;strDirty=true;this.live=true;
  },
  applySnap(s){
    if(!this.live||!started)return;
    const V=h=>this.V(h);this.applying=true;
    try{
      s.T.forEach((d,i)=>{const x=T[i],no=V(d[0]);
        if(no!==x.owner){const old=x.owner;setOwner(x,no,d[1]);
          const[px,py]=wpos(x);fxs.push({k:'ripple',x:px,y:py,t:0,dur:1.6,c:(F[no]&&F[no].rgb)||[200,200,200]});
          if(no===0&&old!==0&&!over){x.conqN=4;toast(`${x.name} erobert!`,'good');askConquest(x)}}
        else x.troops=d[1]});
    }finally{this.applying=false}
    s.T.forEach((d,i)=>{T[i].isCap=!!d[2]});
    s.F.forEach((al,h)=>{const f=F[V(h)];if(!f)return;f.capital=s.C[h];if(!al&&f.alive)eliminate(f.id,-1)});
    marches=s.M.map(m=>({f:V(m.f),from:T[m.a],to:T[m.b],n:m.n,t:m.t,dur:m.dur,phase:m.ph,ft:m.ft,fdur:m.fd,seed:m.sd,A:m.A,Dp:m.Dp,D0:m.D0,win:!!m.w,attRem:m.ar,defRem:m.dr,dOwner:m.dO==null?m.dO:V(m.dO)}));
    gtime=s.gt;ownDirty=true;strDirty=true;
    if(s.sp!==this.lastSp){this.lastSp=s.sp;if($('#pause').hidden&&typeof setSpeedUI==='function')setSpeedUI(s.sp)}
  },
  /* Eingehende Nachrichten (von der Lobby weitergereicht) */
  onmsg(m){
    if(!this.role||m.p===PID)return;
    if(this.role==='host'){
      if(m.t==='ready'&&!this.live){
        const sp=SP[m.sp],t0=T[m.start];
        if(!sp||!t0||t0.terrain!==sp.terr||m.start===setupStart||Object.entries(this.ready).some(([k,v])=>k!==m.p&&v.start===m.start)){this.send({t:'nack',to:m.p,why:'start'});return}
        this.ready[m.p]={name:cleanName(m.name)||'Spieler',species:m.sp,start:m.start,c:cosmClean(m.c)};this.send({t:'ack',to:m.p});this.refreshStart();
      }else if(m.t==='cmd')this.hostCmd(m);
    }else{
      if(m.t==='nack'&&m.to===PID){this.sent=false;toast(LANG==='de'?'Startgebiet nicht möglich. Wähle ein anderes.':'Start area not possible. Pick another.','bad');this.refreshStart()}
      else if(m.t==='init'&&!started&&this.sent){setupSp=this.sentSp;setupStart=this.sentStart;F[0].species=setupSp;$('#btnStart').disabled=false;const o=NET.origStart;this.live=false;o.call($('#btnStart'));this.applyInit(m);
        toast(LANG==='de'?'Mehrspieler: Die Welt läuft beim Host.':'Multiplayer: the world runs on the host.','good')}
      else if(m.t==='snap')this.applySnap(m);
      else if(m.t==='hostleft'&&started&&!over){toast(LANG==='de'?'Der Host hat die Partie beendet.':'The host ended the match.','bad');endGame(false)}
      else if(m.t==='err'&&this.server)toast(LANG==='de'?'Server: Beitritt nicht möglich ('+String(m.why).slice(0,40)+').':'Server: cannot join ('+String(m.why).slice(0,40)+').','bad');
      else if(m.t==='end'&&started&&!over)endGame(false);
    }
  }
};

/* ---------- Einhängen in die Spiel-Funktionen ---------- */
(function(){
  /* Gast: Welt wird nicht simuliert, nur Animationen laufen weiter */
  const uw=updateWorld;
  updateWorld=function(dt){
    if(NET.role==='guest'){gtime+=dt;for(const m of marches){if(m.phase==='walk')m.t=Math.min(m.dur,m.t+dt);else if(m.phase==='fight')m.ft=Math.min(m.fdur,m.ft+dt)}
      for(let i=fxs.length-1;i>=0;i--){fxs[i].t+=dt;if(fxs[i].t>=fxs[i].dur)fxs.splice(i,1)}return}
    uw(dt);
  };
  /* Gast: Angriffe gehen als Befehl an den Host */
  const la=launch;
  launch=function(from,to,n,fid){
    if(NET.role==='guest'&&NET.live){
      if(fid!==0)return false;
      if(to.owner!==0&&protLeft()>0){toast(`Schutzzeit: noch ${mmss(protLeft())}. Bis dahin kann niemand angreifen`,'bad');return false}
      NET.cmd({k:'launch',from:from.id,to:to.id,n});return true;
    }
    return la(from,to,n,fid);
  };
  /* Gast: Falschmeldungen durch Zwischenzustände beim Übernehmen unterdrücken */
  const el=eliminate;eliminate=function(f,by){if(NET.applying)return;el(f,by)};
  /* Gast: Bündnisse, Spenden und Bauen sind im Mehrspieler (noch) nicht möglich */
  const pa=proposeAlliance;proposeAlliance=function(fid){if(NET.role==='guest'){toast(LANG==='de'?'Bündnisse gibt es im Mehrspieler noch nicht.':'Alliances are not available in multiplayer yet.','bad');return}pa(fid)};
  /* Host beendet seine Partie → alle Gäste informieren */
  const eg=endGame;endGame=function(win){eg(win);if(NET.role==='host'&&NET.live){NET.send({t:'end'})}};
  /* Gast: Startgebiet nach „Bereit“ sperren */
  const mc=mapClick;mapClick=function(id){if(NET.role==='guest'&&NET.sent&&!started)return;return mc(id)};
  const usp=updateSetupPanel;updateSetupPanel=function(){usp();NET.refreshStart()};
  /* Startknopf: Host wartet auf bereite Gäste, Gast meldet sich bereit */
  const bs=$('#btnStart');NET.origStart=bs.onclick;
  bs.onclick=function(){
    if(NET.role==='guest'&&!started){
      if(setupStart==null||NET.sent)return;
      NET.sent=true;NET.sentSp=setupSp;NET.sentStart=setupStart;NET.send({t:'ready',name:AW.name,sp:setupSp,start:setupStart,c:cosmPack()});NET.refreshStart();return}
    if(NET.role==='host'&&!NET.live){
      if(!NET.startHost())return;
      NET.origStart.call(this);NET.afterStartHost();return}
    NET.origStart.call(this);
  };
  $('#endBtn').addEventListener('click',()=>NET.close());
})();
