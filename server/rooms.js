'use strict';
/* Raumverwaltung: ein wartender Raum je Modus, hoechstens MAX_ROOMS Raeume, sub -> Raum fuer Wiedereintritt. */
const crypto=require('node:crypto');
const {Room}=require('./room');
class Rooms{
  constructor({config,send,seedFn,createWorld}){
    this.C=config;this._send=send;this._createWorld=createWorld;
    this._seed=seedFn||(()=>crypto.randomInt(1,2147483647));
    this.rooms=new Map();   /* id -> Room */
    this.bySub=new Map();   /* sub -> Room */
  }
  _wrapSend(sub,msg){
    /* wer beim Start als "nicht bereit" entfernt wird, gehoert zu keinem Raum mehr */
    if(msg&&msg.t==='nack'&&msg.why==='notready')this.bySub.delete(sub);
    this._send(sub,msg);
  }
  roomOf(sub){
    const r=this.bySub.get(sub);
    if(!r)return null;
    if(r._closed||!r.humans.has(sub)){this.bySub.delete(sub);return null}
    return r;
  }
  _joinable(mode){
    for(const r of this.rooms.values())
      if(r.mode===mode&&(r.state==='waiting'||r.state==='countdown')&&r.humans.size<this.C.MAX_HUMANS)return r;
    return null;
  }
  _create(mode){
    if(this.rooms.size>=this.C.MAX_ROOMS)return null;
    let id;do{id=crypto.randomBytes(4).toString('hex')}while(this.rooms.has(id));
    const room=new Room({id,mode,seed:this._seed(),createWorld:this._createWorld,
      send:(s,m)=>this._wrapSend(s,m),
      onEmpty:()=>{
        this.rooms.delete(id);
        for(const [s,r] of this.bySub)if(r===room)this.bySub.delete(s);
      }});
    this.rooms.set(id,room);
    return room;
  }
  join(sub,pid,name,mode){
    const cur=this.roomOf(sub);
    if(cur){const res=cur.join(sub,pid,name);return res==='ok'?{room:cur}:{err:res}}
    let room=this._joinable(mode),fresh=false;
    if(!room){room=this._create(mode);fresh=true}
    if(!room)return{err:'full'};
    const res=room.join(sub,pid,name);
    if(res!=='ok'){if(fresh&&room.humans.size===0)room._close();return{err:res}}
    this.bySub.set(sub,room);
    return{room};
  }
  /* Wiedereintritt nach Verbindungsabbruch: Raum erneut informieren (init im laufenden Match) */
  resume(sub,pid){
    const r=this.roomOf(sub);if(!r)return null;
    const res=r.join(sub,pid,'');
    if(res!=='ok'){this.bySub.delete(sub);return null}
    return r;
  }
  leave(sub){
    const r=this.roomOf(sub);if(!r)return;
    r.leave(sub);
    if(r._closed||!r.humans.has(sub))this.bySub.delete(sub);
  }
  listing(){return[...this.rooms.values()].map(r=>r.listing())}
  tick(dt){for(const r of [...this.rooms.values()])r.tick(dt)}
  dispose(){for(const r of [...this.rooms.values()])r._close();this.rooms.clear();this.bySub.clear()}
}
module.exports={Rooms};
