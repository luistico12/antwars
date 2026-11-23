'use strict';
/* Eine Welt je Match: dieselben Dateien wie im Browser (js/game-core.js, js/game-world.js,
   js/game-sea.js) laufen in einem eigenen vm-Kontext. Anzeige und Kolonie sind Attrappen.
   Fraktion 0 ist auf dem Server ein toter Platzhalter, Menschen sind 1…n. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installStubs } = require('./stubs');
const { seeded } = require('../../tests/helpers/prng');

const ROOT = path.resolve(__dirname, '../..');
const FILES = ['js/game-core.js', 'js/game-world.js', 'js/game-sea.js'];
let CODE = null;

const EPILOGUE = `
;globalThis.__world=(function(){
  var __humans=[],__tb={},__init=initWorld,__launch=launch,__update=updateWorld;
  function __snap(){
    return {gt:+gtime.toFixed(1),sp:speed,sm:SIMV,
      T:T.map(function(x){return [x.owner,Math.round(x.troops*10)/10,x.isCap?1:0]}),
      F:F.map(function(f){return f.alive?1:0}),
      C:F.map(function(f){return f.capital}),
      M:marches.map(function(m){return {f:m.f,a:m.from.id,b:m.to.id,n:m.n,t:+(m.t||0).toFixed(2),dur:+m.dur.toFixed(2),ph:m.phase,ft:+(m.ft||0).toFixed(2),fd:m.fdur,sd:m.seed,A:m.A,Dp:m.Dp,D0:m.D0,w:m.win?1:0,ar:m.attRem,dr:m.defRem,dO:m.dOwner}})};
  }
  return {
    setup:function(mode,mapSeed){
      modeKey=mode;diffKey='normal';newMap(mapSeed);
    },
    initWorld:function(humans){
      __humans=[];__tb={};
      var list=(humans||[]).map(function(h,i){return {pid:h.pid,fid:i+1,name:h.name,species:h.species,start:h.start,c:h.c||null}});
      list.forEach(function(h){__humans.push(h.fid)});
      __init({hostStart:null,humans:list});
      return list.map(function(h){return {fid:h.fid,pid:h.pid}});
    },
    step:function(dt){__update(dt)},
    snap:__snap,
    initInfo:function(){
      return {Fi:F.map(function(f){return {n:f.name,sp:f.species,rgb:f.rgb,hum:f.human?1:0,c:null}}),d:diffKey,gt:+gtime.toFixed(1)};
    },
    validStart:function(sp,id){
      var t=T[id];return !!t&&!!SP[sp]&&t.terrain===SP[sp].terr;
    },
    launch:function(fid,fromId,toId,n){
      var f=F[fid],from=T[fromId],to=T[toId];
      if(!f||!f.alive||!f.human)return false;
      if(typeof n!=='number'||!isFinite(n))return false;
      n=Math.floor(n);
      if(!from||!to||from.owner!==fid||!from.adj.includes(toId))return false;
      if(!(n>=1)||n>Math.floor(from.troops)-1)return false;
      __launch(from,to,n,fid);
      return true;
    },
    troopTick:function(fid,tileId){
      var f=F[fid],x=T[tileId];
      if(!f||!f.alive||!f.human)return false;
      var now=Date.now(),tb=__tb[fid];
      if(!tb){tb={v:12,t:now};__tb[fid]=tb}
      tb.v=Math.min(12,tb.v+((now-tb.t)/1000)*6);tb.t=now;
      if(!x||x.owner!==fid||tb.v<1||x.troops>=100)return false;
      tb.v-=1;x.troops=Math.floor(x.troops)+1;
      return true;
    },
    botize:function(fid){
      var f=F[fid];if(!f)return false;f.human=false;f.timer=3;return true;
    },
    human:function(fid){
      var f=F[fid];return !!(f&&f.alive&&f.human);
    },
    over:function(){
      var alive=F.filter(function(f){return f.alive&&f.id!==0});
      var humans=__humans.filter(function(id){return F[id]&&F[id].alive&&F[id].human});
      var over=humans.length===0||alive.length<=1;
      return {over:over,winnerFid:(humans.length===1&&alive.length===1)?humans[0]:null};
    },
    dispose:function(){__tb={};__humans=[]}
  };
})();
`;

function source() {
  if (CODE) return CODE;
  const parts = [];
  parts.push('Math.random=(' + seeded.toString() + ')(__SEED__);');
  for (const f of FILES) parts.push(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  parts.push(EPILOGUE);
  CODE = parts.join('\n;\n');
  return CODE;
}

function createWorld({ mode = 'ffa', mapSeed = 1, seed = 1 } = {}) {
  if (!['ffa', 'unlimited', 'classic', 'fast', 'chaos'].includes(mode)) throw new Error('mode');
  const sandbox = { __SEED__: seed >>> 0 };
  installStubs(sandbox);
  vm.createContext(sandbox);
  vm.runInContext(source(), sandbox, { filename: 'antwars-world.js' });
  const w = sandbox.__world;
  if (!w) throw new Error('world api missing');
  const key = mode === 'ffa' ? 'classic' : mode;
  w.setup(key, mapSeed);
  return w;
}

module.exports = { createWorld };
