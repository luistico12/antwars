'use strict';
/* Gleichwertigkeitsszenario: gibt snap()-Texte nach 100 und 600 Schritten aus. Gegenstueck: tests/equiv-world.spec.js (Browser). */
const {createWorld}=require('../sim/world-vm');
const w=createWorld({mode:'ffa',mapSeed:1,seed:1});
const first=sp=>{for(let i=0;i<5000;i++)if(w.validStart(sp,i))return i;throw new Error('kein Start')};
const a=first('ground'),b=first('leaf');
w.initWorld([{pid:'a',name:'A',species:'ground',start:a,c:null},{pid:'b',name:'B',species:'leaf',start:b,c:null}],1);
const out={};
for(let i=1;i<=1200;i++){
  if(i===50)out.l50=w.launch(1,a,w.adj(a)[0],2);/* in der Schutzzeit abgelehnt, in beiden Welten */
  if(i===950)out.l950=w.launch(1,a,w.adj(a)[0],2);
  w.step(0.1);
  if(i===100||i===600||i===1200)out['s'+i]=JSON.stringify(w.snap());
}
process.stdout.write(JSON.stringify(out));
