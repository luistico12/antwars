/* Öffentliche Spiele: Bildschirm, Beitritt, Matchstart, Schnappschüsse, Abbruch mit Bot.
   Startet den echten Server aus server/ mit einer Test-Tokenprüfung und einem lokalen Dateiserver. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { start } = require('../server/index');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8766;
const BASE = `http://127.0.0.1:${PORT}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
function staticServer() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let rel = decodeURIComponent((q.url || '/').split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
      });
    }).listen(PORT, '127.0.0.1', () => res(s));
  });
}

(async () => {
  await new Promise(r => require('net').createServer().listen(0, () => r())).catch(() => { });
  const files = await staticServer();
  const srv = await start({
    port: 0,
    verify: async token => {
      if (token === 'tokenAAAAAAAAAAAA') return { sub: 'sub-A', anon: true };
      if (token === 'tokenBBBBBBBBBBBB') return { sub: 'sub-B', anon: true };
      throw new Error('auth');
    },
    allowedOrigins: [BASE],
    config: { COUNTDOWN_S: 1, GRACE_S: 2, MAX_ROOMS: 3, SNAP_MS: 200 }
  });
  const SERVER_URL = 'http://127.0.0.1:' + srv.port;
  const b = await chromium.launch();
  const errs = [];
  const mk = async (name, token) => {
    const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
    pg.on('pageerror', e => errs.push(name + ': ' + e.message));
    await pg.route('**/config.js', r => r.fulfill({ body: 'window.AW_CONFIG={}', contentType: 'text/javascript' }));
    await pg.addInitScript(() => { try { localStorage.setItem('aw_consent', JSON.stringify({ set: true, prefs: true, ads: false })); localStorage.setItem('aw_lang', JSON.stringify('de')) } catch (e) { } });
    await pg.goto(BASE + '/index.html');
    await pg.waitForFunction(() => typeof AW !== 'undefined' && AW.ready);
    for (const s of ['#nmSkip', '#ckAll']) { const e = await pg.$(s); if (e) await e.click(); }
    await pg.evaluate(t => {
      AW.sb = { auth: { getSession: async () => ({ data: { session: { access_token: t } } }) } };
    }, token);
    return pg;
  };
  let A, B;
  try {
    A = await mk('A', 'tokenAAAAAAAAAAAA');
    B = await mk('B', 'tokenBBBBBBBBBBBB');

    await A.click('#hPublic');
    await A.waitForSelector('#pmRetry');
    ok((await A.textContent('#scrP')).includes('Server nicht erreichbar'), 'ohne SERVER_URL erscheint „Server nicht erreichbar“');

    await A.evaluate(async url => { CFG.SERVER_URL = url; openScreen('publicMatches', undefined, false) }, SERVER_URL);
    await A.waitForFunction(() => document.querySelector('#scrP').textContent.includes('Gerade keine öffentlichen Spiele.'), null, { timeout: 10000 });
    ok(true, 'mit Server erscheint die leere Liste');

    /* A legt den wartenden Raum an (erster Raum = r1) */
    await A.evaluate(() => pmJoin({ id: 'r1', mode: 'ffa', state: 'waiting' }));
    await A.waitForFunction(() => NET.role === 'guest' && NET.roomId === 'r1', null, { timeout: 10000 });
    ok(true, 'A tritt bei und bekommt eine Raum-ID');

    /* B sieht den Raum und klickt Beitreten */
    await B.evaluate(async url => { CFG.SERVER_URL = url; openScreen('publicMatches', undefined, false) }, SERVER_URL);
    await B.waitForFunction(() => document.querySelector('#scrP').textContent.includes('FFA') && document.querySelector('[data-pmjoin]'), null, { timeout: 10000 });
    await B.click('[data-pmjoin]');
    await B.waitForFunction(() => NET.role === 'guest' && NET.roomId === 'r1', null, { timeout: 10000 });
    ok(true, 'B sieht den wartenden Raum und tritt über den Knopf bei');

    const pick = (pg, first) => pg.evaluate(f => {
      const sp = SP[setupSp];
      const list = T.filter(q => q.terrain === sp.terr);
      mapClick((f ? list[0] : list[list.length - 1]).id);
    }, first);
    await pick(A, true); await pick(B, false);
    await A.waitForFunction(() => started && NET.live, null, { timeout: 20000 });
    await B.waitForFunction(() => started && NET.live, null, { timeout: 20000 });
    ok(true, 'beide Seiten starten nach dem Countdown');

    const g0 = await A.evaluate(() => gtime);
    await sleep(900);
    ok(await A.evaluate(() => gtime) > g0 && await B.evaluate(() => gtime) > 0, 'Schnappschüsse laufen bei beiden weiter');

    ok(await B.evaluate(() => F.some(f => f.human && f.id !== 0)), 'B sieht die menschlichen Fraktionen');

    /* A verlässt die Seite: nach der Schonfrist übernimmt ein Bot, B spielt weiter */
    if (await A.evaluate(() => started)) await A.close();
    await sleep(3500);
    ok(await B.evaluate(() => started && !over), 'B spielt nach dem Abbruch von A weiter');
    const list = await (await fetch(SERVER_URL + '/matches')).json();
    ok(Array.isArray(list), 'Matchliste bleibt abrufbar');
    await B.close();
    await sleep(3500);
    const after = await (await fetch(SERVER_URL + '/matches')).json();
    ok(after.length === 0, 'leerer Raum verschwindet aus der Liste');
    ok(errs.length === 0, 'keine pageerror: ' + errs.join(' | '));
  } catch (e) {
    ok(false, 'Abbruch: ' + e.message.split('\n')[0]);
    for (const [n, pg] of [['A', A], ['B', B]]) {
      if (!pg) continue;
      try { console.log('STATE ' + n, await pg.evaluate(() => JSON.stringify({ role: NET.role, room: NET.roomId, sent: NET.sent, started, over, scr: SCR.cur && SCR.cur.name, body: (document.querySelector('#scrP').textContent || '').slice(0, 120), toasts: document.querySelector('#toasts').textContent }))); } catch (x) { }
    }
    console.log(errs.join('\n'));
  }
  await b.close();
  await srv.close();
  files.close();
  process.exit(fails ? 1 : 0);
})();
