'use strict';
/* Weltsimulation je Match in einem eigenen vm-Kontext. Laedt die Browser-Skripte unveraendert aus js/. */
const vm=require('vm'),fs=require('fs'),path=require('path');
const {seeded}=require('../../tests/helpers/prng');
const ROOT=path.resolve(__dirname,'../..');
const SRC=['js/game-core.js','js/game-world.js','js/game-sea.js','js/game-trade.js'].map(f=>({f,code:fs.readFileSync(path.join(ROOT,f),'utf8')}));
const STUBS=fs.readFileSync(path.join(__dirname,'stubs.js'),'utf8');

function createWorld({mode,mapSeed,seed}){
  const ctx=vm.createContext({console});
  const run=(code,name)=>vm.runInContext(code,ctx,{filename:name});
  run(STUBS,'stubs.js');
  for(const s of SRC)run(s.code,s.f);
  ctx.__rng=seeded(seed);run('Math.random=__rng','world-vm-rng');
  run(`modeKey=${JSON.stringify(mode)};newMap(${+mapSeed});`,'world-vm-init');
  const ev=code=>run(code,'world-vm-eval');
  const W={
    initWorld(humans,reseed){
      if(reseed!=null){ctx.__rng=seeded(reseed);run('Math.random=__rng','world-vm-rng')}
      humans.forEach((h,i)=>{h.fid=i+1});
      ctx.__humans=humans;
      ev('initWorld({hostStart:null,humans:__humans})');
    },
    simv(){return ev('SIMV')},
    adj(id){return JSON.parse(ev(`JSON.stringify(T[${+id}].adj)`))},
    step(dt){ctx.__dt=dt;ev('updateWorld(__dt)')},
    snap(){return JSON.parse(ev(`JSON.stringify({gt:+gtime.toFixed(1),sp:speed,sm:SIMV,T:T.map(x=>[x.owner,Math.round(x.troops*10)/10,x.isCap?1:0]),F:F.map(f=>f.alive?1:0),C:F.map(f=>f.capital),
      M:marches.map(m=>({f:m.f,a:m.from.id,b:m.to.id,n:m.n,t:+(m.t||0).toFixed(2),dur:+m.dur.toFixed(2),ph:m.phase,ft:+(m.ft||0).toFixed(2),fd:m.fdur,sd:m.seed,A:m.A,Dp:m.Dp,D0:m.D0,w:m.win?1:0,ar:m.attRem,dr:m.defRem,dO:m.dOwner}))})`))},
    initInfo(){return JSON.parse(ev(`JSON.stringify({Fi:F.map((f,h)=>({n:h===0?'Server':f.name,sp:f.species||'ground',rgb:f.rgb||FCOL[0],hum:f.human?1:0})),d:diffKey,gt:+gtime.toFixed(1)})`))},
    launch(fid,fromId,toId,n){
      n=Math.floor(+n);
      ctx.__a=[fid,fromId,toId,n];
      return ev(`(function(){const[fid,fi,ti,n]=__a,from=T[fi],to=T[ti],f=F[fid];
        if(!f||!f.alive||!f.human||!from||!to||from.owner!==fid||!from.adj.includes(to.id)||!(n>=1)||n>Math.floor(from.troops)-1)return false;
        return launch(from,to,n,fid)!==false})()`);
    },
    troopTick(fid,tileId,nowMs){
      ctx.__a=[fid,tileId,+nowMs];
      return ev(`(function(){const[fid,id,now]=__a,x=T[id],f=F[fid];if(!f||!f.alive||!f.human)return false;
        const h=__humans.find(q=>q.fid===fid);if(!h)return false;
        if(!isFinite(now))return false;h.tb=Math.min(12,(h.tb==null?12:h.tb)+Math.max(0,(now-(h.tl||now))/1000)*6);h.tl=now;
        if(!x||x.owner!==fid||h.tb<1||x.troops>=100)return false;
        h.tb-=1;x.troops=Math.floor(x.troops)+1;return true})()`);
    },
    setBot(fid){
      ctx.__a=[fid];
      ev('(function(){const f=F[__a[0]];if(f&&f.alive&&f.human){f.human=false;f.timer=3}})()');
    },
    validStart(species,tileId){
      ctx.__a=[species,tileId];
      return ev('(function(){const[sp,id]=__a;return !!(SP[sp]&&T[id]&&T[id].terrain===SP[sp].terr)})()');
    },
    over(){
      return JSON.parse(ev(`JSON.stringify((function(){
        if(contWin)return{over:false,winnerFid:null};
        const alive=F.filter(f=>f.alive&&f.id>0);
        if(alive.length>1)return{over:false,winnerFid:null};
        return{over:true,winnerFid:alive.length===1&&alive[0].human?alive[0].id:null}})())`));
    },
    dispose(){for(const k of Object.keys(ctx))try{delete ctx[k]}catch(e){}}
  };
  return W;
}
module.exports={createWorld};
