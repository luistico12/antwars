'use strict';
/* Ein Raum = ein Match. Zeit läuft ausschließlich über tick(dt), damit Tests ohne Timer laufen. */
const { createWorld } = require('./sim/world-vm');
const { cleanName, cleanCosm } = require('./protocol');

const DEFAULTS = {
  maxHumans: 8, minHumans: 2, countdownS: 60, graceS: 30, snapMs: 500, stepDt: 0.1
};

class Room {
  constructor(opts) {
    Object.assign(this, DEFAULTS, opts);
    this.members = new Map();
    this.state = 'waiting';
    this.countdown = 0;
    this.humans = [];
    this.snapAcc = 0;
    this.lastCount = -1;
    this.done = false;
    this.world = this.world || createWorld({ mode: this.mode, mapSeed: this.seed, seed: this.seed });
  }

  space() { return this.maxHumans - this.members.size; }
  connected() { return [...this.members.values()].filter(m => !m.offline).length; }
  readyCount() { return [...this.members.values()].filter(m => m.ready && !m.offline).length; }

  listing() {
    return {
      id: this.id, mode: this.mode, state: this.state,
      humans: this.connected(), max: this.maxHumans,
      countdown: Math.ceil(this.countdown)
    };
  }
  /* An Mitglieder zusätzlich der Karten-Seed, damit alle dieselbe Karte sehen. */
  roomMsg() { return { t: 'room', ...this.listing(), seed: this.seed }; }

  broadcast(msg) {
    for (const m of this.members.values()) {
      if (!m.offline) this.send(m.sub, msg);
    }
  }

  join(sub, pid, name) {
    if (this.done) return 'started';
    const exist = this.members.get(sub);
    if (exist) {
      /* Neuladen mitten im Match innerhalb der Schonfrist: Fraktion zurück */
      if (this.state === 'running' && exist.offline && exist.grace > 0) {
        exist.pid = pid; exist.offline = false; exist.grace = 0;
        this._sendInit(exist);
        this.send(sub, this.roomMsg());
        return 'ok';
      }
      if (!exist.offline) return 'started';
    }
    if (this.state !== 'waiting' && this.state !== 'countdown') return 'started';
    if (this.members.size >= this.maxHumans) return 'full';
    const m = { sub, pid, name: cleanName(name) || 'Spieler', ready: false, offline: false, grace: 0, fid: 0 };
    this.members.set(sub, m);
    this.broadcast(this.roomMsg());
    return 'ok';
  }

  leave(sub) {
    const m = this.members.get(sub);
    if (!m) return;
    if (this.state === 'running') {
      if (m.offline) return;
      m.offline = true; m.grace = this.graceS;
      this.broadcast(this.roomMsg());
      return;
    }
    this.members.delete(sub);
    this._recount();
    if (!this.members.size) return this._empty();
    this.broadcast(this.roomMsg());
  }

  ready(sub, data) {
    const m = this.members.get(sub);
    if (!m || m.offline) return;
    if (this.state !== 'waiting' && this.state !== 'countdown') return;
    if (!this.world.validStart(data.sp, data.start)) return this.send(sub, { t: 'nack', why: 'start', to: m.pid });
    for (const o of this.members.values()) {
      if (o !== m && o.ready && o.start === data.start) return this.send(sub, { t: 'nack', why: 'start', to: m.pid });
    }
    m.ready = true; m.name = cleanName(data.name) || m.name;
    m.sp = data.sp; m.start = data.start; m.c = cleanCosm(data.c);
    this.send(sub, { t: 'ack' });
    this._recount();
    if (this.state === 'waiting' && this.readyCount() >= this.minHumans) {
      this.state = 'countdown'; this.countdown = this.countdownS;
    }
    this.broadcast(this.roomMsg());
  }

  _recount() {
    if (this.state === 'countdown' && this.readyCount() < this.minHumans) {
      this.state = 'waiting'; this.countdown = 0;
    }
  }

  cmd(sub, msg) {
    if (this.state !== 'running') return;
    const m = this.members.get(sub);
    if (!m || m.offline || !m.fid) return;
    if (msg.k === 'launch') this.world.launch(m.fid, msg.from, msg.to, msg.n);
    else if (msg.k === 'tr') this.world.troopTick(m.fid, msg.tile);
  }

  tick(dt) {
    if (this.done) return;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastCount) { this.lastCount = c; this.broadcast(this.roomMsg()); }
      if (this.countdown <= 0) this._start();
      return;
    }
    if (this.state !== 'running') return;

    for (const m of [...this.members.values()]) {
      if (!m.offline) continue;
      m.grace -= dt;
      if (m.grace > 0) continue;
      /* Schonfrist vorbei: die Fraktion übernimmt ein Bot */
      this.world.botize(m.fid);
      this.members.delete(m.sub);
    }
    const graceLeft = [...this.members.values()].some(m => m.offline && m.grace > 0 && m.fid);
    if (!this.connected() && !graceLeft) return this._finish(null);

    this.world.step(dt);
    this.snapAcc += dt;
    if (this.snapAcc >= this.snapMs / 1000) {
      this.snapAcc = 0;
      this.broadcast({ t: 'snap', ...this.world.snap() });
    }
    const o = this.world.over();
    if (o.over) this._finish(o.winnerFid);
  }

  _start() {
    const parts = [...this.members.values()].filter(m => m.ready && !m.offline);
    if (parts.length < this.minHumans) { this.state = 'waiting'; this.countdown = 0; return; }
    const humans = parts.map(m => ({ pid: m.pid, name: m.name, species: m.sp, start: m.start, c: m.c }));
    const assigned = this.world.initWorld(humans);
    this.humans = [];
    assigned.forEach((a, i) => {
      const m = parts[i];
      m.fid = a.fid;
      this.humans.push({ sub: m.sub, fid: a.fid });
    });
    this.state = 'running'; this.countdown = 0; this.snapAcc = 0;
    for (const m of this.members.values()) {
      if (!m.offline && m.fid) this._sendInit(m);
    }
    this.broadcast(this.roomMsg());
  }

  _sendInit(m) {
    const info = this.world.initInfo();
    const fids = {};
    for (const h of this.humans) {
      const mm = this.members.get(h.sub);
      if (mm) fids[mm.pid] = h.fid;
    }
    this.send(m.sub, { t: 'init', ...this.world.snap(), ...info, fids, hp: null, d: info.d, self: { sp: m.sp, start: m.start, fid: m.fid } });
  }

  _finish(winner) {
    if (this.done) return;
    this.broadcast({ t: 'end', winner: winner == null ? null : winner });
    this.state = 'ended';
    this._empty();
  }

  _empty() {
    if (this.done) return;
    this.done = true;
    this.state = 'ended';
    this.members.clear();
    try { this.world.dispose(); } catch (e) { }
    this.onEmpty();
  }
}

module.exports = { Room, DEFAULTS };
