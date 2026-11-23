'use strict';
/* Ratenbegrenzung je Verbindung und Obergrenze je Quell-IP. */
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
module.exports={TokenBucket,IpCounter};
