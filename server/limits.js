'use strict';
/* Einfache Ratenbegrenzung: Eimer je Verbindung und Verbindungszahl je IP. */
class TokenBucket {
  constructor(burst, perSecond, now = Date.now) {
    this.burst = burst; this.per = perSecond; this.now = now;
    this.v = burst; this.t = now();
  }
  take() {
    const t = this.now();
    this.v = Math.min(this.burst, this.v + ((t - this.t) / 1000) * this.per);
    this.t = t;
    if (this.v < 1) return false;
    this.v -= 1;
    return true;
  }
}
class IpCounter {
  constructor(limit) { this.limit = limit; this.m = new Map(); }
  open(ip) {
    const n = this.m.get(ip) || 0;
    if (n >= this.limit) return false;
    this.m.set(ip, n + 1);
    return true;
  }
  close(ip) {
    const n = this.m.get(ip) || 0;
    if (n <= 1) this.m.delete(ip); else this.m.set(ip, n - 1);
  }
  count(ip) { return this.m.get(ip) || 0; }
}
module.exports = { TokenBucket, IpCounter };
