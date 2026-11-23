'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseClientMsg } = require('../protocol');

const ok = (o) => parseClientMsg(JSON.stringify(o)).ok === true;

test('gültige Nachrichten kommen durch', () => {
  assert.ok(ok({ t: 'auth', token: 'x'.repeat(40), pid: 'ab12' }));
  assert.ok(ok({ t: 'join', mode: 'ffa' }));
  assert.ok(ok({ t: 'join', mode: 'unlimited', room: 'r12' }));
  assert.ok(ok({ t: 'leave' }));
  assert.ok(ok({ t: 'ready', name: 'Ameise', sp: 'ground', start: 3, c: null }));
  assert.ok(ok({ t: 'cmd', k: 'launch', from: 1, to: 2, n: 5 }));
  assert.ok(ok({ t: 'cmd', k: 'tr', tile: 1 }));
});

test('Nicht-Objekte, Arrays und kaputtes JSON werden abgelehnt', () => {
  for (const raw of ['null', '[]', '123', '"x"', '{', '', Buffer.from('abc')]) {
    assert.strictEqual(parseClientMsg(raw).ok, false, String(raw));
  }
});

test('unbekannte Typen und fremde Felder werden abgelehnt', () => {
  assert.strictEqual(ok({ t: 'hack' }), false);
  assert.strictEqual(ok({ t: 'cmd', k: 'launch', from: 1, to: 2, n: 1, evil: 1 }), false);
  assert.strictEqual(ok({ t: 'auth', token: 'x'.repeat(40), pid: 'ab12', admin: true }), false);
});

test('lange Strings, falsche Typen und Zahlen werden abgelehnt', () => {
  assert.strictEqual(parseClientMsg(JSON.stringify({ t: 'auth', token: 'x'.repeat(5000), pid: 'ab12' })).ok, false);
  assert.strictEqual(ok({ t: 'auth', token: 'x', pid: 'ab12' }), false);
  assert.strictEqual(ok({ t: 'auth', token: 'x'.repeat(40), pid: 'AB' }), false);
  assert.strictEqual(ok({ t: 'ready', name: 'A', sp: 'ground', start: -1 }), false);
  assert.strictEqual(ok({ t: 'ready', name: 'A', sp: 'ground', start: 1.5 }), false);
  assert.strictEqual(ok({ t: 'ready', name: 'A', sp: 'ground', start: 1, c: 'x' }), false);
  assert.strictEqual(ok({ t: 'cmd', k: 'launch', from: '1', to: 2, n: 1 }), false);
  assert.strictEqual(ok({ t: 'cmd', k: 'launch', from: 1, to: 2, n: NaN }), false);
  assert.strictEqual(ok({ t: 'cmd', k: 'tr', tile: -5 }), false);
  assert.strictEqual(ok({ t: 'join', mode: 'solo' }), false);
  assert.strictEqual(ok({ t: 'join', mode: 'ffa', room: '../../../etc' }), false);
});
