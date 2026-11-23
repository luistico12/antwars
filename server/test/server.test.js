'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { start } = require('../index');

const ORIGIN = 'https://ok.test';
const verify = async (token) => {
  if (token === 'good1token') return { sub: 'sub-1', anon: true };
  if (token === 'good2token') return { sub: 'sub-2', anon: true };
  if (token === 'blockedtoken') return { sub: 'sub-blocked', anon: true };
  throw new Error('auth');
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const once = (ws, ev) => new Promise(res => ws.once(ev, (...a) => res(a)));
const closed = ws => new Promise(res => { if (ws.readyState === 3) return res(1); ws.once('close', c => res(c)); });

async function boot(extra = {}) {
  const s = await start({ port: 0, verify, allowedOrigins: [ORIGIN], authMs: 150, config: { MAX_ROOMS: 3 }, ...extra });
  return { s, url: 'ws://127.0.0.1:' + s.port + '/ws', http: 'http://127.0.0.1:' + s.port };
}
function connect(url, origin = ORIGIN) {
  const ws = new WebSocket(url, { headers: { origin } });
  ws.on('error', () => { });
  return ws;
}
async function authed(url, token = 'good1token', pid = 'aaaa') {
  const ws = connect(url);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'auth', token, pid }));
  await sleep(30);
  return ws;
}

test('falscher Origin wird abgelehnt, /healthz läuft', async () => {
  const { s, url, http } = await boot();
  const ws = connect(url, 'https://evil.test');
  const [err] = await once(ws, 'error');
  assert.ok(err);
  const r = await fetch(http + '/healthz');
  assert.strictEqual(await r.text(), 'ok');
  await s.close();
});

test('erste Nachricht kein auth → nach Frist geschlossen', async () => {
  const { s, url } = await boot();
  const ws = connect(url);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'join', mode: 'ffa' }));
  const code = await closed(ws);
  assert.ok(code);
  await s.close();
});

test('ungültiges Token → geschlossen, Server nimmt danach neue Verbindung an', async () => {
  const { s, url, http } = await boot();
  const ws = connect(url);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'auth', token: 'schlecht', pid: 'aaaa' }));
  await closed(ws);
  const r = await fetch(http + '/healthz');
  assert.strictEqual(await r.text(), 'ok');
  const ok = await authed(url);
  assert.strictEqual(ok.readyState, 1);
  ok.close();
  await s.close();
});

test('Binärframe, Nicht-Objekt und kaputtes JSON schließen die Verbindung', async () => {
  const { s, url, http } = await boot();
  for (const payload of [Buffer.from([1, 2, 3]), 'null', '[]', '123', '{']) {
    const ws = await authed(url);
    ws.send(payload);
    await closed(ws);
    assert.strictEqual(await (await fetch(http + '/healthz')).text(), 'ok');
  }
  await s.close();
});

test('Frame über 4096 Bytes wird geschlossen', async () => {
  const { s, url } = await boot();
  const ws = await authed(url);
  ws.send(JSON.stringify({ t: 'cmd', k: 'tr', tile: 1, pad: 'x'.repeat(5000) }));
  await closed(ws);
  await s.close();
});

test('dasselbe Konto zweimal: zweite abgelehnt, erste bleibt', async () => {
  const { s, url } = await boot();
  const a = await authed(url, 'good1token');
  const b = connect(url);
  await once(b, 'open');
  const got = [];
  b.on('message', d => got.push(JSON.parse(d)));
  b.send(JSON.stringify({ t: 'auth', token: 'good1token', pid: 'bbbb' }));
  await closed(b);
  assert.ok(got.some(m => m.t === 'err' && m.why === 'duplicate'));
  assert.strictEqual(a.readyState, 1);
  a.close();
  await s.close();
});

test('Flut: Verbindung wird geschlossen, Server lebt weiter', async () => {
  const { s, url, http } = await boot();
  const ws = await authed(url);
  for (let i = 0; i < 300; i++) { try { ws.send(JSON.stringify({ t: 'leave' })); } catch (e) { } }
  await closed(ws);
  assert.strictEqual(await (await fetch(http + '/healthz')).text(), 'ok');
  await s.close();
});

test('fünfte Verbindung derselben IP wird abgelehnt', async () => {
  const { s, url } = await boot();
  const socks = [];
  for (let i = 0; i < 4; i++) { const w = connect(url); await once(w, 'open'); socks.push(w); }
  const fifth = connect(url);
  await once(fifth, 'error');
  for (const w of socks) w.close();
  await s.close();
});

test('Sperrliste: gesperrte sub wird abgelehnt', async () => {
  const file = path.join(os.tmpdir(), 'aw-block-' + process.pid + '.txt');
  fs.writeFileSync(file, 'sub-blocked\n');
  const { s, url } = await boot({ blocklistPath: file });
  const ws = connect(url);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'auth', token: 'blockedtoken', pid: 'aaaa' }));
  await closed(ws);
  fs.unlinkSync(file);
  await s.close();
});

test('GET /matches enthält keine sub, pid oder Namen', async () => {
  const { s, url, http } = await boot();
  const a = await authed(url, 'good1token');
  a.send(JSON.stringify({ t: 'join', mode: 'ffa' }));
  await sleep(400);
  const raw = await (await fetch(http + '/matches')).text();
  const list = JSON.parse(raw);
  assert.ok(Array.isArray(list) && list.length === 1);
  assert.ok(!/"sub"|"pid"|"name"/.test(raw));
  assert.deepStrictEqual(Object.keys(list[0]).sort(), ['countdown', 'humans', 'id', 'max', 'mode', 'state']);
  a.close();
  await s.close();
});

test('11. Raum wird nicht angelegt (hier Grenze 1)', async () => {
  const { s, url } = await boot({ config: { MAX_ROOMS: 1 } });
  const a = await authed(url, 'good1token');
  const got = [];
  a.on('message', d => got.push(JSON.parse(d)));
  a.send(JSON.stringify({ t: 'join', mode: 'ffa' }));
  await sleep(400);
  const b = await authed(url, 'good2token', 'bbbb');
  const gotB = [];
  b.on('message', d => gotB.push(JSON.parse(d)));
  b.send(JSON.stringify({ t: 'join', mode: 'unlimited' }));
  await sleep(400);
  assert.ok(gotB.some(m => m.t === 'err' && m.why === 'full'));
  a.close(); b.close();
  await s.close();
});
