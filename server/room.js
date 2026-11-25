'use strict';
/* Ein Raum = ein Match. Nachfolger des Browser-Hosts in js/net.js: besitzt die Welt, prueft jeden Befehl, sendet init/snap.
   Keine echten Timer: die Zeit kommt ausschliesslich ueber tick(dtSeconds). */
const C=require('./config');
const {cleanName,cosmClean}=require('./protocol');
const realCreateWorld=require('./sim/world-vm').createWorld;
const MAXSTEP=50; /* Schritte je tick() begrenzen, falls der Aufrufer stockt */
const isInt=n=>Number.isInteger(n);

class Room{
  constructor({id,mode,send,onEmpty,seed,createWorld,config}){
    this.C=config||C;this.id=id;this.seed=seed;this.mode=['classic','fast','chaos','unlimited'].includes(mode)?mode:'classic';this.state='waiting';
    this._send=send;this._onEmpty=onEmpty;
    this.humans=new Map(); /* sub -> {sub,pid,name,ready,info,fid,absentAt} */
    this.nowMs=0;this.countdown=0;this._acc=0;this._snapMs=0;this._closed=false;this._lastCd=-1;
    this.world=(createWorld||realCreateWorld)({mode:this.mode,mapSeed:seed,seed,prot:this.C.PROT_S});
  }
  _send2(sub,msg){try{this._send(sub,msg)}catch(e){}}
  _present(){return[...this.humans.values()].filter(h=>h.absentAt==null)}
  _broadcast(msg){for(const h of this._present())this._send2(h.sub,msg)}
  _roomMsg(){
    return{t:'room',state:this.state,seed:this.seed,mode:this.mode,players:[...this.humans.values()].map(h=>({name:h.name,ready:h.ready})),countdown:Math.ceil(this.countdown)}}
  _pushRoom(){this._broadcast(this._roomMsg())}
  listing(){return{id:this.id,mode:this.mode,state:this.state,humans:this.humans.size,max:this.C.MAX_HUMANS,countdown:this.state==='countdown'?Math.ceil(this.countdown):0}}

  join(sub,pid,name){
    if(this._closed||typeof sub!=='string'||typeof pid!=='string')return'started';
    const old=this.humans.get(sub);
    for(const h of this.humans.values())if(h!==old&&h.pid===pid)return'full';
    if(this.state==='running'||this.state==='ended'){
      if(!old||old.fid==null||old.bot)return'started';
      old.pid=pid;old.absentAt=null;this._sendInit(old);return'ok';
    }
    if(old){old.pid=pid;old.name=cleanName(name)||old.name;this._pushRoom();return'ok'}
    if(this.humans.size>=this.C.MAX_HUMANS)return'full';
    this.humans.set(sub,{sub,pid,joinedAt:this.nowMs,name:cleanName(name)||'Spieler',ready:false,info:null,fid:null,absentAt:null,bot:false});
    this._pushRoom();return'ok';
  }
  leave(sub){
    const h=this.humans.get(sub);if(!h||this._closed)return;
    if(this.state==='waiting'||this.state==='countdown'){
      this.humans.delete(sub);
      if(this.humans.size===0)return this._close();
      this._updateCountdown();this._pushRoom();
    }else if(this.state==='running'&&h.fid!=null&&!h.bot&&h.absentAt==null){
      h.absentAt=this.nowMs;
      this._checkEnd();
    }
  }
  ready(sub,m){
    const h=this.humans.get(sub);
    if(!h||this._closed||(this.state!=='waiting'&&this.state!=='countdown'))return;
    try{
      if(!m||typeof m!=='object'||typeof m.sp!=='string'||!isInt(m.start)||!this.world.validStart(m.sp,m.start))return this._send2(sub,{t:'nack',why:'start'});
      for(const o of this.humans.values())if(o!==h&&o.ready&&o.info.start===m.start)return this._send2(sub,{t:'nack',why:'start'});
      h.info={sp:m.sp,start:m.start,c:cosmClean(m.c)};
      if(typeof m.name==='string'){const n=cleanName(m.name);if(n)h.name=n}
      h.ready=true;
    }catch(e){return this._send2(sub,{t:'nack',why:'start'})}
    this._send2(sub,{t:'ack'});
    this._updateCountdown();this._pushRoom();
  }
  _readyN(){let n=0;for(const h of this.humans.values())if(h.ready)n++;return n}
  _updateCountdown(){
    const ok=this._readyN()>=this.C.MIN_HUMANS;
    if(ok&&this.state==='waiting'){this.state='countdown';this.countdown=this.C.COUNTDOWN_S;this._lastCd=-1}
    else if(!ok&&this.state==='countdown'){this.state='waiting';this.countdown=0}
  }
  _start(){
    for(const h of [...this.humans.values()])if(!h.ready){this._send2(h.sub,{t:'nack',why:'notready'});this.humans.delete(h.sub)}
    const list=[...this.humans.values()];
    if(list.length<this.C.MIN_HUMANS){this.state='waiting';this.countdown=0;if(!list.length)this._close();return}
    this.state='running';this.countdown=0;
    this.world.initWorld(list.map(h=>({pid:h.pid,name:h.name,species:h.info.sp,start:h.info.start,c:h.info.c})));
    list.forEach((h,i)=>{h.fid=i+1});
    for(const h of list)this._sendInit(h);
    this._pushRoom();
    this._acc=0;this._snapMs=0;
  }
  _sendInit(h){
    const info=this.world.initInfo(),fids={};
    for(const o of this.humans.values())if(o.fid!=null)fids[o.pid]=o.fid;
    for(const o of this.humans.values())if(o.fid!=null&&info.Fi&&info.Fi[o.fid])info.Fi[o.fid].c=o.info.c;
    const w=this.world.snap();/* aktueller Weltzustand (auch beim Wiedereintritt) */
    this._send2(h.sub,{t:'init',seed:this.seed,mode:this.mode,...info,T:w.T,F:w.F,C:w.C,M:w.M,sp:w.sp,sm:w.sm,gt:w.gt,fids,hp:null,d:info.d});
  }

  cmd(sub,c){
    try{
      if(this.state!=='running'||this._closed||!c||typeof c!=='object')return;
      const h=this.humans.get(sub);if(!h||h.fid==null||h.bot||h.absentAt!=null)return;
      if(c.k==='launch'){
        if(!isInt(c.from)||!isInt(c.to)||!isInt(c.n)||c.n<1)return;
        this.world.launch(h.fid,c.from,c.to,c.n);
      }else if(c.k==='tr'){
        if(!isInt(c.tile))return;
        this.world.troopTick(h.fid,c.tile,this.nowMs);
      }
    }catch(e){}
  }

  tick(dt){
    if(this._closed||!(dt>0)||!isFinite(dt))return;
    this.nowMs+=dt*1000;
    if(this.state==='waiting'||this.state==='countdown'){
      /* Platzhalter ohne ready fliegen nach READY_TIMEOUT_S raus (Pong aendert daran nichts) */
      const lim=(this.C.READY_TIMEOUT_S||120)*1000;
      for(const h of [...this.humans.values()])
        if(!h.ready&&this.nowMs-h.joinedAt>=lim){this._send2(h.sub,{t:'err',why:'room'});this.leave(h.sub)}
      if(this._closed)return;
    }
    if(this.state==='countdown'){
      this.countdown-=dt;
      if(this.countdown<=0)this._start();
      else if(Math.ceil(this.countdown)!==this._lastCd){this._lastCd=Math.ceil(this.countdown);this._pushRoom()}
      return;
    }
    if(this.state!=='running')return;
    /* abwesende Menschen: nach der Frist uebernimmt ein Bot */
    let botted=false;
    for(const h of this.humans.values())if(h.absentAt!=null&&!h.bot&&this.nowMs-h.absentAt>=this.C.GRACE_S*1000){
      botted=true;h.bot=true;h.absentAt=null;try{this.world.setBot(h.fid)}catch(e){}
    }
    try{
      this._acc+=dt;let n=0;
      while(this._acc>=this.C.STEP_DT-1e-9&&n<MAXSTEP){const k=this.world.simv?this.world.simv():1;for(let i=0;i<k;i++)this.world.step(this.C.STEP_DT);this._acc-=this.C.STEP_DT;n++}
      if(this._acc>=this.C.STEP_DT)this._acc=0;
      this._snapMs+=dt*1000;
      let snap=null;
      if(this._snapMs>=this.C.SNAP_MS){this._snapMs=0;snap=this.world.snap();this._broadcast({t:'snap',...snap})}
      const o=this.world.over();
      if(o.over)return this._end(o.winnerFid);
      if(snap||botted)this._checkEnd(snap);
    }catch(e){this._end(null)}
  }
  _checkEnd(snap){
    if(this.state!=='running')return;
    try{
      const s=snap||this.world.snap();
      const alive=[...this.humans.values()].some(h=>h.fid!=null&&!h.bot&&s.F[h.fid]);
      if(!alive)this._end(null);
    }catch(e){this._end(null)}
  }
  _end(winner){
    if(this.state==='ended')return;
    this.state='ended';this._broadcast({t:'end',winner:isInt(winner)?winner:null});
    this._close();
  }
  _close(){
    if(this._closed)return;this._closed=true;
    this.humans.clear();
    try{this.world.dispose()}catch(e){}
    try{this._onEmpty()}catch(e){}
  }
}
module.exports={Room};
