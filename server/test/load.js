'use strict';
/* Lasttest (nicht Teil von npm test): 10 Raeume x 8 Menschen, 300 simulierte Sekunden, je Modus classic und unlimited.
   Aufruf: cd server && node --expose-gc test/load.js [classic|fast|chaos|unlimited] */
const C=require('../config');
const {Rooms}=require('../rooms');
const {createWorld}=require('../sim/world-vm');
const ROOMS=10,HUMANS=8,SIM_S=300;
const mb=b=>(b/1048576).toFixed(0)+' MB';
const gc=()=>{if(global.gc)global.gc()};
const mem=()=>{gc();const m=process.memoryUsage();return{rss:m.rss,heap:m.heapUsed}};

function run(mode){
  let initBytes=0,snapBytes=0,snaps=0,ends=0;
  const send=(sub,msg)=>{
    if(msg.t==='init'){const n=Buffer.byteLength(JSON.stringify(msg));if(n>initBytes)initBytes=n}
    else if(msg.t==='snap'){const n=Buffer.byteLength(JSON.stringify(msg));if(n>snapBytes)snapBytes=n;snaps++}
    else if(msg.t==='end')ends++;
  };
  let seed=100;
  const rooms=new Rooms({config:C,send,seedFn:()=>++seed,createWorld});
  const base=mem();
  for(let r=0;r<ROOMS;r++){
    let room=null;
    for(let h=0;h<HUMANS;h++){const res=rooms.join(`s${r}_${h}`,`p${r}_${h}`,`P${h}`,mode);room=res.room}
    const used=new Set();
    for(let h=0;h<HUMANS;h++){
      const sp=h%2?'leaf':'ground';let st=-1;
      for(let i=0;i<20000;i++)if(!used.has(i)&&room.world.validStart(sp,i)){st=i;break}
      used.add(st);room.ready(`s${r}_${h}`,{name:`P${h}`,sp,start:st,c:null});
    }
  }
  const all=[...rooms.rooms.values()];
  /* Countdown + Start (nicht mitgezaehlt) */
  for(let t=0;t<C.COUNTDOWN_S+2;t++)rooms.tick(1);
  const running=all.filter(r=>r.state==='running').length;
  const setup=mem();
  const cpu0=process.cpuUsage();let peak=process.memoryUsage().rss;
  const n=Math.round(SIM_S/C.STEP_DT);
  for(let i=0;i<n;i++){rooms.tick(C.STEP_DT);if(i%100===0)peak=Math.max(peak,process.memoryUsage().rss)}
  const cpu=process.cpuUsage(cpu0);
  const end=mem();
  const stillRunning=all.filter(r=>r.state==='running').length;
  const cpuS=(cpu.user+cpu.system)/1e6;
  const res={mode,running,stillRunning,ends,setupRss:setup.rss,setupHeap:setup.heap,endRss:end.rss,endHeap:end.heap,peakRss:peak,cpuPerSimS:cpuS/SIM_S,initBytes,snapBytes,snaps};
  console.log(`[${mode}] Raeume laufend nach Start: ${running}/${ROOMS}, nach ${SIM_S}s noch laufend: ${stillRunning}, end-Nachrichten: ${ends}`);
  console.log(`[${mode}] RSS vor Raeumen ${mb(base.rss)}, nach Setup ${mb(setup.rss)} (heap ${mb(setup.heap)}), am Ende ${mb(end.rss)} (heap ${mb(end.heap)}), Spitze ${mb(peak)}`);
  console.log(`[${mode}] CPU je simulierter Sekunde (alle ${ROOMS} Raeume): ${(cpuS/SIM_S*1000).toFixed(1)} ms (=${(cpuS/SIM_S*100).toFixed(1)} % eines Kerns)`);
  console.log(`[${mode}] init ${initBytes} B, snap ${snapBytes} B (max), snaps gesendet ${snaps}`);
  rooms.dispose();
  return res;
}
const modes=process.argv[2]?[process.argv[2]]:['classic','unlimited'];
if(!global.gc)console.log('Hinweis: ohne --expose-gc sind die RSS-Werte ungenauer.');
console.log(`Node ${process.version}, ${ROOMS} Raeume x ${HUMANS} Menschen, STEP_DT ${C.STEP_DT}, SNAP_MS ${C.SNAP_MS}`);
/* jeder Modus in eigenem Prozess waere sauberer; hier per Argument moeglich */
for(const m of modes)run(m);
