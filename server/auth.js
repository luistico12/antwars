'use strict';
// Supabase-Zugriffstoken (JWT, ES256) gegen die öffentlichen Schlüssel (JWKS) prüfen.
// Nur node:crypto / node:https, kein Geheimnis auf dem Server. Jeder Fehler wirft Error('auth').
const crypto = require('node:crypto');
const https = require('node:https');

const SEG = /^[A-Za-z0-9_-]+$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const own = (o, k) => (has(o, k) ? o[k] : undefined);
const fail = () => new Error('auth');

function parseJson(seg) {
  if (!SEG.test(seg)) throw fail();
  const v = JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw fail();
  return v;
}

function createVerifier({ getKeys, supabaseUrl, now = Date.now }) {
  const issuer = supabaseUrl + '/auth/v1';
  return async function verify(token) {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw fail();
      const parts = token.split('.');
      if (parts.length !== 3) throw fail();
      const [h, p, s] = parts;
      const header = parseJson(h);
      if (own(header, 'alg') !== 'ES256') throw fail();
      for (const k of ['jku', 'jwk', 'x5u', 'x5c']) if (has(header, k)) throw fail();
      const kid = own(header, 'kid');
      if (typeof kid !== 'string' || !kid) throw fail();
      if (!SEG.test(s)) throw fail();
      const sig = Buffer.from(s, 'base64url');
      if (sig.length !== 64) throw fail();
      const keys = await getKeys(kid);
      if (!Array.isArray(keys)) throw fail();
      const jwk = keys.find((k) => k && typeof k === 'object' && k.kid === kid);
      if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw fail();
      const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      if (!crypto.verify('sha256', Buffer.from(h + '.' + p), { key, dsaEncoding: 'ieee-p1363' }, sig)) throw fail();
      const c = parseJson(p);
      const t = Math.floor(now() / 1000);
      const exp = own(c, 'exp');
      if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= t) throw fail();
      const nbf = own(c, 'nbf');
      if (nbf !== undefined && (typeof nbf !== 'number' || !Number.isFinite(nbf) || nbf > t)) throw fail();
      if (own(c, 'iss') !== issuer) throw fail();
      const aud = own(c, 'aud');
      if (!(aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated')))) throw fail();
      const sub = own(c, 'sub');
      if (typeof sub !== 'string' || !sub || sub.length > 128) throw fail();
      return { sub, anon: own(c, 'is_anonymous') === true };
    } catch {
      throw fail();
    }
  };
}

const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;
function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('jwks')); }
      const chunks = []; let n = 0;
      res.on('data', (d) => {
        n += d.length;
        if (n > MAX_BYTES) { req.destroy(); return reject(new Error('jwks')); }
        chunks.push(d);
      });
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('jwks')); } });
      res.on('error', () => reject(new Error('jwks')));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('jwks')); });
    req.on('error', () => reject(new Error('jwks')));
  });
}

function jwksFromUrl(url, { fetchJson = httpsJson, now = Date.now } = {}) {
  const TTL = 10 * 60_000, MIN_RELOAD = 60_000;
  let keys = null, loadedAt = -Infinity, attemptAt = -Infinity, inflight = null;
  async function load() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        attemptAt = now();
        const doc = await fetchJson(url);
        if (!doc || !Array.isArray(doc.keys)) throw new Error('jwks');
        keys = doc.keys; loadedAt = now();
      } finally { inflight = null; }
    })();
    return inflight;
  }
  return async function getKeys(kid) {
    const t = now();
    if (!keys || t - loadedAt >= TTL) await load();
    else if (kid !== undefined && !keys.some((k) => k && k.kid === kid) && t - attemptAt >= MIN_RELOAD) await load();
    return keys;
  };
}

module.exports = { createVerifier, jwksFromUrl };
