'use strict';
/* Ratenbegrenzung je Verbindung und Obergrenze je Quell-IP. */
const net=require('node:net');
const C=require('./config');
class TokenBucket{
  constructor(burst,perSecond,now=Date.now){this.burst=burst;this.rate=perSecond;this.now=now;this.tokens=burst;this.last=now()}
  take(){
    const t=this.now();
    if(t>this.last){this.tokens=Math.min(this.burst,this.tokens+(t-this.last)/1000*this.rate)}
    this.last=t;
    if(this.tokens>=1){this.tokens-=1;return true}
    return false;
  }
}
class IpCounter{
  constructor(max=C.CONN_PER_IP){this.max=max;this.m=new Map()}
  open(ip){const n=this.m.get(ip)||0;if(n>=this.max)return false;this.m.set(ip,n+1);return true}
  close(ip){const n=this.m.get(ip)||0;if(n<=1)this.m.delete(ip);else this.m.set(ip,n-1)}
}
/* Schluessel je Quelle: IPv4 unveraendert, '::ffff:a.b.c.d' -> IPv4, sonstiges IPv6 auf /64 reduziert,
   Ungueltiges -> fester Fallback-Schluessel (alle Ungueltigen teilen sich ein Limit). */
const BAD_IP='invalid';
function normIp(raw){
  if(typeof raw!=='string')return BAD_IP;
  let a=raw.trim();const z=a.indexOf('%');if(z>=0)a=a.slice(0,z);
  const k=net.isIP(a);
  if(k===4)return a;
  if(k!==6)return BAD_IP;
  a=a.toLowerCase();
  let tail=null;
  const m=a.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if(m){
    const o=m[2].split('.').map(Number);
    tail=((o[0]<<8)|o[1]).toString(16)+':'+((o[2]<<8)|o[3]).toString(16);
    a=m[1]+tail;
  }
  const halves=a.split('::');
  if(halves.length>2)return BAD_IP;
  const head=halves[0]?halves[0].split(':'):[];
  const rest=halves.length===2&&halves[1]?halves[1].split(':'):[];
  const fill=halves.length===2?8-head.length-rest.length:0;
  if(fill<0||(halves.length===1&&head.length!==8))return BAD_IP;
  const g=head.concat(Array(fill).fill('0'),rest).map(x=>parseInt(x,16));
  if(g.length!==8||g.some(x=>!(x>=0&&x<=0xffff)))return BAD_IP;
  if(g[0]===0&&g[1]===0&&g[2]===0&&g[3]===0&&g[4]===0&&g[5]===0xffff)return(g[6]>>8)+'.'+(g[6]&255)+'.'+(g[7]>>8)+'.'+(g[7]&255);
  return g.slice(0,4).map(x=>x.toString(16)).join(':')+'::/64';
}
/* Ereignisse je Schluessel im gleitenden Fenster (z. B. Beitrittsversuche je IP und Minute) */
class RateWindow{
  constructor(max,windowMs,now=Date.now){this.max=max;this.w=windowMs;this.now=now;this.m=new Map()}
  hit(key){
    const t=this.now();
    if(this.m.size>5000)for(const [k,a] of this.m)if(!a.length||t-a[a.length-1]>=this.w)this.m.delete(k);
    const a=(this.m.get(key)||[]).filter(x=>t-x<this.w);
    if(a.length>=this.max){this.m.set(key,a);return false}
    a.push(t);this.m.set(key,a);return true;
  }
}
module.exports={TokenBucket,IpCounter,normIp,RateWindow};
