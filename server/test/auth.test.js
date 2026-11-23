'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { createVerifier, jwksFromUrl } = require('../auth');

const URL_ = 'https://proj.supabase.co';
const NOW = 1_700_000_000;
const b64 = (b) => Buffer.from(b).toString('base64url');
const kp = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const A = kp();
const jwkOf = (k, kid) => ({ ...k.publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' });
const goodPayload = () => ({ sub: 'u1', iss: URL_ + '/auth/v1', aud: 'authenticated', exp: NOW + 100, is_anonymous: true });
function sign(payload, { header = {}, key = A.privateKey, raw } = {}) {
  const h = b64(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1', ...header }));
  const p = b64(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const sig = raw || crypto.sign('sha256', Buffer.from(h + '.' + p), { key, dsaEncoding: 'ieee-p1363' });
  return h + '.' + p + '.' + b64(sig);
}
const mk = (keys = [jwkOf(A, 'k1')]) => createVerifier({ getKeys: async () => keys, supabaseUrl: URL_, now: () => NOW * 1000 });
const rejects = (v, t) => assert.rejects(v(t), (e) => e instanceof Error && e.message === 'auth');

test('gültiges Token ergibt sub und anon', async () => {
  assert.deepStrictEqual(await mk()(sign(goodPayload())), { sub: 'u1', anon: true });
  const p = goodPayload(); delete p.is_anonymous;
  assert.deepStrictEqual(await mk()(sign(p)), { sub: 'u1', anon: false });
});
test('abgelaufenes Token wird abgelehnt', async () => {
  await rejects(mk(), sign({ ...goodPayload(), exp: NOW }));
  await rejects(mk(), sign({ ...goodPayload(), exp: NOW - 1 }));
});
test('nbf in der Zukunft wird abgelehnt', async () => {
  await rejects(mk(), sign({ ...goodPayload(), nbf: NOW + 5 }));
});
test('falscher iss (anderes Projekt) wird abgelehnt', async () => {
  await rejects(mk(), sign({ ...goodPayload(), iss: 'https://other.supabase.co/auth/v1' }));
});
test('falsche aud wird abgelehnt, aud-Array akzeptiert', async () => {
  await rejects(mk(), sign({ ...goodPayload(), aud: 'anon' }));
  await rejects(mk(), sign({ ...goodPayload(), aud: ['x'] }));
  assert.strictEqual((await mk()(sign({ ...goodPayload(), aud: ['x', 'authenticated'] }))).sub, 'u1');
});
test('fremder Schlüssel wird abgelehnt', async () => {
  await rejects(mk(), sign(goodPayload(), { key: kp().privateKey }));
});
test('alg none und alg HS256 werden abgelehnt', async () => {
  const p = b64(JSON.stringify(goodPayload()));
  await rejects(mk(), b64(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + p + '.');
  await rejects(mk(), sign(goodPayload(), { header: { alg: 'none' } }));
  await rejects(mk(), sign(goodPayload(), { header: { alg: 'HS256' } }));
  await rejects(mk(), sign(goodPayload(), { header: { alg: 'es256' } }));
});
test('Header mit jwk/jku/x5u wird abgelehnt', async () => {
  for (const k of ['jwk', 'jku', 'x5u']) await rejects(mk(), sign(goodPayload(), { header: { [k]: 'x' } }));
});
test('kid fehlt oder unbekannt wird abgelehnt', async () => {
  await rejects(mk(), sign(goodPayload(), { header: { kid: 'nope' } }));
  await rejects(mk(), sign(goodPayload(), { header: { kid: undefined } }));
  await rejects(mk(), sign(goodPayload(), { header: { kid: 5 } }));
});
test('falsche Signaturlänge wird abgelehnt', async () => {
  await rejects(mk(), sign(goodPayload(), { raw: Buffer.alloc(63, 1) }));
  await rejects(mk(), sign(goodPayload(), { raw: Buffer.alloc(65, 1) }));
  await rejects(mk(), sign(goodPayload(), { raw: Buffer.alloc(0) }));
});
test('Segmentanzahl und Müll werden abgelehnt', async () => {
  const t = sign(goodPayload());
  await rejects(mk(), t + '.x');
  await rejects(mk(), t.split('.').slice(0, 2).join('.'));
  await rejects(mk(), '');
  await rejects(mk(), undefined);
  await rejects(mk(), 42);
  await rejects(mk(), { toString() { return t; } });
  await rejects(mk(), 'a.b.c');
  await rejects(mk(), t + '=');
});
test('Payload muss Objekt sein', async () => {
  for (const s of ['[]', '"x"', 'null', '5', '{bad']) await rejects(mk(), sign(s));
});
test('exp fehlt oder nicht numerisch wird abgelehnt', async () => {
  const p = goodPayload(); delete p.exp;
  await rejects(mk(), sign(p));
  await rejects(mk(), sign({ ...goodPayload(), exp: String(NOW + 100) }));
  await rejects(mk(), sign({ ...goodPayload(), exp: null }));
});
test('sub leer, kein String oder zu lang wird abgelehnt', async () => {
  await rejects(mk(), sign({ ...goodPayload(), sub: '' }));
  await rejects(mk(), sign({ ...goodPayload(), sub: 5 }));
  await rejects(mk(), sign({ ...goodPayload(), sub: 'x'.repeat(129) }));
  assert.strictEqual((await mk()(sign({ ...goodPayload(), sub: 'x'.repeat(128) }))).sub.length, 128);
});
test('geerbte Claims (__proto__) zählen nicht', async () => {
  const s = '{"__proto__":{"sub":"evil","iss":"' + URL_ + '/auth/v1","aud":"authenticated","exp":' + (NOW + 100) + '}}';
  await rejects(mk(), sign(s));
});
test('is_anonymous nur bei echtem true', async () => {
  assert.strictEqual((await mk()(sign({ ...goodPayload(), is_anonymous: 'true' }))).anon, false);
});
test('Fehlermeldung enthält das Token nicht', async () => {
  const t = sign({ ...goodPayload(), exp: NOW - 1 });
  try { await mk()(t); assert.fail(); } catch (e) {
    assert.strictEqual(e.message, 'auth');
    for (const part of t.split('.')) assert.ok(!String(e.stack).includes(part));
  }
});
test('getKeys wirft oder liefert Müll -> auth', async () => {
  const t = sign(goodPayload());
  await rejects(createVerifier({ getKeys: async () => { throw new Error('boom ' + t); }, supabaseUrl: URL_, now: () => NOW * 1000 }), t);
  await rejects(mk([null, 5, { kid: 'k1', kty: 'EC' }]), t);
  await rejects(mk('x'), t);
});
test('RSA-Schlüssel mit passender kid wird abgelehnt', async () => {
  const r = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  await rejects(mk([{ ...r.publicKey.export({ format: 'jwk' }), kid: 'k1' }]), sign(goodPayload()));
});

test('jwksFromUrl: Cache, Neuladen höchstens einmal pro Minute bei unbekannter kid', async () => {
  let calls = 0, t = 0, keys = [{ kid: 'a' }];
  const g = jwksFromUrl('https://x/jwks', { fetchJson: async () => { calls++; return { keys }; }, now: () => t });
  assert.deepStrictEqual(await g(), [{ kid: 'a' }]);
  await g(); assert.strictEqual(calls, 1);
  t = 30_000; keys = [{ kid: 'a' }, { kid: 'b' }];
  assert.strictEqual((await g('b')).length, 1); assert.strictEqual(calls, 1);
  t = 61_000;
  assert.strictEqual((await g('b')).length, 2); assert.strictEqual(calls, 2);
  assert.strictEqual((await g('zzz')).length, 2); assert.strictEqual(calls, 2); // < 1 min
  t = 61_000 + 10 * 60_000 + 1; await g(); assert.strictEqual(calls, 3); // TTL
});
test('jwksFromUrl: fehlschlagender Kaltstart wird 10 s gedrosselt und erholt sich', async () => {
  let calls = 0, tm = 0, up = false;
  const g = jwksFromUrl('https://x/', { fetchJson: async () => { calls++; if (!up) throw new Error('net'); return { keys: [{ kid: 'a' }] }; }, now: () => tm });
  await assert.rejects(g('a')); assert.strictEqual(calls, 1);
  tm = 9_000; for (let i = 0; i < 20; i++) await assert.rejects(g('a'));
  assert.strictEqual(calls, 1);
  up = true; tm = 10_000;
  assert.strictEqual((await g('a')).length, 1); assert.strictEqual(calls, 2);
});
test('jwksFromUrl: fehlschlagende TTL-Erneuerung nutzt alte Schlüssel, gedrosselt', async () => {
  let calls = 0, tm = 0, up = true;
  const g = jwksFromUrl('https://x/', { fetchJson: async () => { calls++; if (!up) throw new Error('net'); return { keys: [{ kid: 'a' }] }; }, now: () => tm });
  await g('a'); up = false;
  tm = 10 * 60_000; assert.strictEqual((await g('a')).length, 1); assert.strictEqual(calls, 2);
  tm += 9_000; for (let i = 0; i < 20; i++) assert.strictEqual((await g('a')).length, 1);
  assert.strictEqual(calls, 2);
  tm += 1_000; await g('a'); assert.strictEqual(calls, 3);
  // Verifier funktioniert weiter mit alten Schlüsseln
  const v = createVerifier({ getKeys: async () => [jwkOf(A, 'k1')], supabaseUrl: URL_, now: () => NOW * 1000 });
  assert.strictEqual((await v(sign(goodPayload()))).sub, 'u1');
});
test('jwksFromUrl: unbekannte kid höchstens ein Abruf pro 60 s', async () => {
  let calls = 0, tm = 0;
  const g = jwksFromUrl('https://x/', { fetchJson: async () => { calls++; return { keys: [{ kid: 'a' }] }; }, now: () => tm });
  await g('a');
  for (tm = 1_000; tm < 60_000; tm += 1_000) await g('zzz');
  assert.strictEqual(calls, 1);
  tm = 60_000; await g('zzz'); assert.strictEqual(calls, 2);
  for (tm = 61_000; tm < 120_000; tm += 1_000) await g('zzz');
  assert.strictEqual(calls, 2);
});
test('jwksFromUrl: ungültige Antwort wird verworfen', async () => {
  const g = jwksFromUrl('https://x/', { fetchJson: async () => ({ keys: 'x' }), now: () => 0 });
  await assert.rejects(g());
});
