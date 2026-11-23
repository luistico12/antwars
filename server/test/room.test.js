'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Room } = require('../room');

function roomOf(extra = {}) {
  const msgs = [];
  let empty = 0;
  const room = new Room({
    id: 'r1', mode: 'ffa', seed: 1, countdownS: 2, graceS: 30, snapMs: 0.5,
    send: (s, m) => msgs.push({ s, m }), onEmpty: () => empty++, ...extra
  });
  return { room, msgs, emptyCount: () => empty };
}
function starts(room, species, n) {
  const out = [];
  for (let i = 0; i < 400 && out.length < n; i++) if (room.world.validStart(species, i)) out.push(i);
  return out;
}
function twoReady(extra = {}) {
  const r = roomOf(extra);
  r.room.join('s1', 'aaaa');
  r.room.join('s2', 'bbbb');
  const st = starts(r.room, 'ground', 2);
  r.room.ready('s1', { name: 'A', sp: 'ground', start: st[0] });
  r.room.ready('s2', { name: 'B', sp: 'ground', start: st[1] });
  return { ...r, st };
}
function runCountdown(r) { r.room.tick(2.1); }
function tileOf(room, sub) {
  const fid = room.members.get(sub).fid;
  return room.world.snap().T.findIndex(t => t[0] === fid);
}

test('Countdown startet erst ab 2 bereiten Menschen und fällt zurück', () => {
  const r = roomOf();
  r.room.join('s1', 'aaaa');
  r.room.join('s2', 'bbbb');
  const st = starts(r.room, 'ground', 2);
  r.room.ready('s1', { name: 'A', sp: 'ground', start: st[0] });
  assert.strictEqual(r.room.state, 'waiting');
  r.room.ready('s2', { name: 'B', sp: 'ground', start: st[1] });
  assert.strictEqual(r.room.state, 'countdown');
  r.room.leave('s2');
  assert.strictEqual(r.room.state, 'waiting');
  assert.strictEqual(r.room.countdown, 0);
});

test('init geht an alle, jeder sieht fids für alle pids und hp null', () => {
  const r = twoReady();
  runCountdown(r);
  assert.strictEqual(r.room.state, 'running');
  const inits = r.msgs.filter(x => x.m.t === 'init');
  assert.strictEqual(inits.length, 2);
  for (const { m } of inits) {
    assert.strictEqual(m.hp, null);
    assert.deepStrictEqual(Object.keys(m.fids).sort(), ['aaaa', 'bbbb']);
    assert.ok(m.Fi[0] && m.Fi[0].n === 'Server');
    assert.ok(m.T.length > 0);
  }
});

test('Abbruch: nach 29 s dieselbe Fraktion, nach 31 s Bot', () => {
  const a = twoReady();
  runCountdown(a);
  const fid = a.room.members.get('s1').fid;
  a.room.leave('s1');
  a.room.tick(29);
  assert.strictEqual(a.room.join('s1', 'cccc'), 'ok');
  assert.strictEqual(a.room.members.get('s1').fid, fid);
  assert.ok(a.msgs.some(x => x.m.t === 'init' && x.s === 's1' && x.m.fids.cccc === fid));

  const b = twoReady();
  runCountdown(b);
  const fid2 = b.room.members.get('s1').fid;
  b.room.leave('s1');
  b.room.tick(31);
  assert.strictEqual(b.room.members.has('s1'), false);
  assert.strictEqual(b.room.world.human(fid2), false);
});

test('feindliche Befehle werden ignoriert und werfen nicht', () => {
  const r = twoReady();
  runCountdown(r);
  const before = JSON.stringify(r.room.world.snap());
  const tile = tileOf(r.room, 's1');
  const bad = [
    { k: 'launch', from: tile, to: tile, n: NaN },
    { k: 'launch', from: tile, to: tile, n: -1 },
    { k: 'launch', from: -1, to: 99999, n: 1e9 },
    { k: 'launch', from: '1', to: 2, n: 5 },
    { k: 'tr', tile: -1 },
    { k: 'tr', tile: 99999 }
  ];
  for (const m of bad) assert.doesNotThrow(() => r.room.cmd('s1', m));
  assert.doesNotThrow(() => r.room.cmd('unknown', { k: 'launch', from: 0, to: 1, n: 1 }));
  assert.strictEqual(JSON.stringify(r.room.world.snap()), before);
});

test('tr-Dauerfeuer: 100 Befehle erhöhen die Truppen um höchstens 18', () => {
  const r = twoReady();
  runCountdown(r);
  const tile = tileOf(r.room, 's1');
  const start = r.room.world.snap().T[tile][1];
  for (let i = 0; i < 100; i++) r.room.cmd('s1', { k: 'tr', tile });
  const end = r.room.world.snap().T[tile][1];
  assert.ok(end - start <= 18, 'Zuwachs ' + (end - start));
});

test('leerer Raum ruft onEmpty einmal und tickt danach nicht mehr', () => {
  let steps = 0;
  const world = {
    validStart: () => true, initWorld: () => [], snap: () => ({ T: [], F: [] }),
    step: () => steps++, over: () => ({ over: false }), dispose() {}, botize() {}, human: () => true
  };
  const r = roomOf({ world });
  r.room.join('s1', 'aaaa');
  r.room.leave('s1');
  assert.strictEqual(r.emptyCount(), 1);
  r.room.tick(1);
  assert.strictEqual(steps, 0);
  r.room.leave('s1');
  assert.strictEqual(r.emptyCount(), 1);
});
