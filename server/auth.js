'use strict';
/* Prüft Supabase-Zugangstoken nur über die öffentlichen Schlüssel (JWKS).
   Auf dem Spielserver liegt kein Geheimnis. Fehler enthalten nie das Token. */
const { jwtVerify, createRemoteJWKSet } = require('jose');

function createVerifier({ jwks, supabaseUrl, issuer, audience } = {}) {
  if (!supabaseUrl && !issuer) throw new Error('auth: supabaseUrl fehlt');
  const iss = issuer || supabaseUrl.replace(/\/+$/, '') + '/auth/v1';
  const aud = audience || 'authenticated';
  const key = jwks || createRemoteJWKSet(new URL((supabaseUrl || '').replace(/\/+$/, '') + '/auth/v1/.well-known/jwks.json'));
  return async function verify(token) {
    try {
      if (typeof token !== 'string' || token.length < 10) throw new Error('auth');
      const { payload } = await jwtVerify(token, key, { issuer: iss, audience: aud, algorithms: ['ES256', 'RS256'] });
      if (!payload || typeof payload.sub !== 'string' || !payload.sub) throw new Error('auth');
      return { sub: payload.sub, anon: payload.is_anonymous === true };
    } catch (e) {
      throw new Error('auth');
    }
  };
}

module.exports = { createVerifier };
