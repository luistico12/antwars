'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } = require('jose');
const { createVerifier } = require('../auth');

const URL = 'https://proj.supabase.co';
const ISS = URL + '/auth/v1';

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'k1'; jwk.alg = 'ES256'; jwk.use = 'sig';
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims = {}, opt = {}) => new SignJWT({ is_anonymous: true, ...claims })
    .setProtectedHeader({ alg: opt.alg || 'ES256', kid: 'k1' })
    .setSubject(opt.sub || 'user-1')
    .setIssuer(opt.iss || ISS)
    .setAudience(opt.aud || 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opt.exp || '1h')
    .sign(opt.key || privateKey);
  return { verify: createVerifier({ jwks, supabaseUrl: URL }), sign, privateKey };
}

test('gültiges Token ergibt sub und anon', async () => {
  const { verify, sign } = await setup();
  const r = await verify(await sign());
  assert.strictEqual(r.sub, 'user-1');
  assert.strictEqual(r.anon, true);
});

test('abgelaufenes Token wird abgelehnt', async () => {
  const { verify, sign } = await setup();
  await assert.rejects(() => verify(sign({}, { exp: Math.floor(Date.now() / 1000) - 60 })), /auth/);
});

test('falscher iss wird abgelehnt', async () => {
  const { verify, sign } = await setup();
  await assert.rejects(() => verify(sign({}, { iss: 'https://other.supabase.co/auth/v1' })), /auth/);
});

test('falsche aud wird abgelehnt', async () => {
  const { verify, sign } = await setup();
  await assert.rejects(() => verify(sign({}, { aud: 'other' })), /auth/);
});

test('fremder Schlüssel wird abgelehnt', async () => {
  const { verify, sign } = await setup();
  const other = await generateKeyPair('ES256');
  await assert.rejects(() => verify(sign({}, { key: other.privateKey })), /auth/);
});

test('alg none wird abgelehnt', async () => {
  const { verify } = await setup();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: 'x', iss: ISS, aud: 'authenticated', exp: 9999999999 }) + '.';
  await assert.rejects(() => verify(token), /auth/);
});

test('Fehlermeldung enthält das Token nicht', async () => {
  const { verify, sign } = await setup();
  const token = await sign({}, { aud: 'wrong' });
  try { await verify(token); assert.fail('muss werfen'); }
  catch (e) { assert.strictEqual(e.message, 'auth'); assert.ok(!e.message.includes(token)); }
});
