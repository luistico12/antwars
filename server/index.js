'use strict';
/* Öffentlicher Spielserver: HTTP (/healthz, /matches) und WebSocket.
   Kein Geheimnis im Prozess, keine Token oder IP-Adressen in Logs. */
const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const baseConfig = require('./config');
const { parseClientMsg } = require('./protocol');
const { TokenBucket, IpCounter } = require('./limits');
const { Room } = require('./room');

function readBlocklist(file) {
  if (!file) return new Set();
  try {
    return new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')));
  } catch (e) { return new Set(); }
}

function clientIp(req) {
  const peer = req.socket.remoteAddress || '';
  const local = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  const cf = String(req.headers['cf-connecting-ip'] || '').slice(0, 64);
  return local && cf ? cf : peer;
}

async function start(opts = {}) {
  const cfg = { ...baseConfig, ...(opts.config || {}) };
  const allowedOrigins = opts.allowedOrigins || cfg.ALLOWED_ORIGINS;
  const allowFile = opts.allowFileOrigin != null ? opts.allowFileOrigin : cfg.ALLOW_FILE_ORIGIN;
  const verify = opts.verify;
  if (typeof verify !== 'function') throw new Error('verify fehlt');

  let blocklist = readBlocklist(opts.blocklistPath);
  const clients = new Map();   /* sub → { ws, pid, room } */
  const rooms = new Map();
  const ipCount = new IpCounter(cfg.CONN_PER_IP);
  let nextRoom = 1;

  const send = (sub, msg) => {
    const c = clients.get(sub);
    if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
  };

  function newRoom(mode) {
    const id = 'r' + nextRoom++;
    const seed = Math.floor(Math.random() * 1e6);
    const room = new Room({
      id, mode, seed, send,
      minHumans: cfg.MIN_HUMANS, maxHumans: cfg.MAX_HUMANS,
      countdownS: cfg.COUNTDOWN_S, graceS: cfg.GRACE_S,
      snapMs: cfg.SNAP_MS, stepDt: cfg.STEP_DT,
      onEmpty: () => { if (rooms.get(id) === room) rooms.delete(id); }
    });
    rooms.set(id, room);
    return room;
  }

  function matchList() {
    return [...rooms.values()].filter(r => !r.done).map(r => r.listing());
  }

  const server = http.createServer((req, res) => {
    const url = (req.url || '').split('?')[0];
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || (allowFile && origin === 'file://'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'GET' && url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }
    if (req.method === 'GET' && url === '/matches') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(matchList()));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: cfg.MAX_MSG_BYTES, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    const okOrigin = origin ? (allowedOrigins.includes(origin) || (allowFile && origin === 'file://')) : false;
    if (!okOrigin) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    const ip = clientIp(req);
    if (!ipCount.open(ip)) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      ws.__ip = ip;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', ws => {
    const conn = {
      ws, sub: null, pid: null, room: null, authed: false, busy: false,
      bucket: new TokenBucket(cfg.MSG_BURST, cfg.MSG_PER_S),
      last: Date.now(), ip: ws.__ip
    };
    const authTimer = setTimeout(() => close('auth'), opts.authMs != null ? opts.authMs : cfg.AUTH_MS);

    function close(code) {
      try { ws.close(code ? 4400 + (code === 'auth' ? 1 : 0) : 1000); } catch (e) { }
    }
    function fail() { close('auth'); }

    /* Nachrichten werden der Reihe nach verarbeitet: auth und join dürfen nicht überholen. */
    const handle = async (data, isBinary) => {
      if (!conn.bucket.take()) return close('flood');
      if (isBinary) return close('bad');
      const text = typeof data === 'string' ? data : (Buffer.isBuffer(data) ? data.toString('utf8') : '');
      if (!text) return close('bad');
      conn.last = Date.now();
      const p = parseClientMsg(text);
      if (!p.ok) { return close('bad'); }
      const m = p.msg;

      if (!conn.authed) {
        if (m.t !== 'auth') return close('auth');
        if (conn.busy) return close('bad');
        conn.busy = true;
        let who;
        try { who = await verify(m.token); } catch (e) { conn.busy = false; return fail(); }
        conn.busy = false;
        if (!who || !who.sub) return fail();
        if (blocklist.has(who.sub) || blocklist.has(conn.ip)) return close('blocked');
        if (clients.has(who.sub)) {
          try { ws.send(JSON.stringify({ t: 'err', why: 'duplicate' })); } catch (e) { }
          return setTimeout(() => close('duplicate'), 20);
        }
        conn.sub = who.sub; conn.pid = m.pid; conn.authed = true; conn.anon = !!who.anon;
        clearTimeout(authTimer);
        clients.set(conn.sub, conn);
        try { ws.send(JSON.stringify({ t: 'ack' })); } catch (e) { }
        return;
      }

      if (m.t === 'auth') return close('bad');
      if (m.t === 'join') {
        if (conn.room) return;
        try {
        let room = m.room ? rooms.get(m.room) : null;
        if (room && room.done) room = null;
        if (!room) room = [...rooms.values()].find(r => !r.done && r.mode === m.mode && r.state === 'waiting' && r.space() > 0);
        if (!room) {
          if (rooms.size >= cfg.MAX_ROOMS) return send(conn.sub, { t: 'err', why: 'full' });
          room = newRoom(m.mode);
        }
        const r = room.join(conn.sub, conn.pid);
        if (r === 'ok') { conn.room = room.id; send(conn.sub, { t: 'ack' }); }
        else if (r === 'full') send(conn.sub, { t: 'err', why: 'full' });
        else send(conn.sub, { t: 'err', why: 'started' });
        } catch (e) { send(conn.sub, { t: 'err', why: 'full' }); }
        return;
      }
      if (m.t === 'leave') {
        if (conn.room) { rooms.get(conn.room)?.leave(conn.sub); conn.room = null; }
        return;
      }
      if (m.t === 'ready' || m.t === 'cmd') {
        const r = conn.room && rooms.get(conn.room);
        if (!r) return send(conn.sub, { t: 'err', why: 'room' });
        if (m.t === 'ready') r.ready(conn.sub, m);
        else r.cmd(conn.sub, m);
      }
    };
    let chain = Promise.resolve();
    ws.on('message', (data, isBinary) => {
      chain = chain.then(() => handle(data, isBinary)).catch(() => { });
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (conn.sub) {
        if (clients.get(conn.sub) === conn) clients.delete(conn.sub);
        if (conn.room) rooms.get(conn.room)?.leave(conn.sub);
      }
      if (conn.ip) ipCount.close(conn.ip);
    });
    ws.on('error', () => { });
  });

  const step = setInterval(() => {
    for (const r of [...rooms.values()]) {
      try { r.tick(cfg.STEP_DT); } catch (e) { /* ein Raum darf nie den Prozess stoppen */ }
    }
  }, cfg.STEP_DT * 1000);
  const idle = setInterval(() => {
    const now = Date.now();
    for (const c of clients.values()) {
      if (now - c.last > cfg.IDLE_MS) { try { c.ws.close(4402); } catch (e) { } }
    }
  }, 10000);
  const blockTimer = setInterval(() => { blocklist = readBlocklist(opts.blocklistPath); }, 30000);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port != null ? opts.port : cfg.PORT, opts.host || cfg.HOST, () => resolve());
  });
  const port = server.address().port;

  return {
    port,
    rooms,
    matches: matchList,
    close: async () => {
      clearInterval(step); clearInterval(idle); clearInterval(blockTimer);
      for (const c of wss.clients) { try { c.terminate(); } catch (e) { } }
      clients.clear();
      await new Promise(res => wss.close(() => res()));
      if (server.closeAllConnections) server.closeAllConnections();
      await new Promise(res => server.close(() => res()));
    }
  };
}

if (require.main === module) {
  const cfg = require('./config');
  if (!cfg.SUPABASE_URL) { console.error('SUPABASE_URL fehlt (öffentliche URL des Projekts).'); process.exit(1); }
  const { createVerifier } = require('./auth');
  const verify = createVerifier({ supabaseUrl: cfg.SUPABASE_URL });
  start({ port: cfg.PORT, verify, blocklistPath: process.env.BLOCKLIST || '' })
    .then(s => console.log('Ant Wars Server läuft auf ' + cfg.HOST + ':' + s.port))
    .catch(e => { console.error('Start fehlgeschlagen:', e.message); process.exit(1); });
}

module.exports = { start };
