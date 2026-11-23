'use strict';
/* Jede Nachricht vom Client wird geprüft. Nur bekannte Typen und Felder kommen durch. */
const MAX = 4096;
const PID_RE = /^[a-z0-9]{4,8}$/;
const FIELDS = {
  auth: ['t', 'token', 'pid'],
  join: ['t', 'mode', 'room', 'p'],
  leave: ['t', 'p'],
  ready: ['t', 'name', 'sp', 'start', 'c', 'p'],
  cmd: ['t', 'k', 'from', 'to', 'n', 'tile', 'p']
};
const MODES = new Set(['ffa', 'unlimited']);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e6;
const isNum = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9;
const isStr = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n;

function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
}

function parseClientMsg(raw) {
  if (typeof raw !== 'string') return { ok: false };
  if (raw.length > MAX) return { ok: false };
  let m;
  try { m = JSON.parse(raw); } catch (e) { return { ok: false }; }
  if (!isObj(m) || !isStr(m.t, 12)) return { ok: false };
  const allowed = FIELDS[m.t];
  if (!allowed) return { ok: false };
  for (const k of Object.keys(m)) if (!allowed.includes(k)) return { ok: false };
  if (m.p !== undefined && !isStr(m.p, 16)) return { ok: false };

  switch (m.t) {
    case 'auth':
      if (!isStr(m.token, MAX) || m.token.length < 10 || !PID_RE.test(String(m.pid || ''))) return { ok: false };
      return { ok: true, msg: m };
    case 'join':
      if (!MODES.has(m.mode)) return { ok: false };
      if (m.room !== undefined && !/^r[0-9]{1,6}$/.test(String(m.room))) return { ok: false };
      return { ok: true, msg: m };
    case 'leave':
      return { ok: true, msg: m };
    case 'ready': {
      if (!isInt(m.start) || !isStr(m.sp, 16)) return { ok: false };
      if (typeof m.name !== 'string' || m.name.length > 24) return { ok: false };
      if (m.c !== undefined && m.c !== null && !isObj(m.c)) return { ok: false };
      return { ok: true, msg: m };
    }
    case 'cmd': {
      if (m.k === 'launch') {
        if (!isInt(m.from) || !isInt(m.to) || !isNum(m.n)) return { ok: false };
        return { ok: true, msg: m };
      }
      if (m.k === 'tr') {
        if (!isInt(m.tile)) return { ok: false };
        return { ok: true, msg: m };
      }
      return { ok: false };
    }
    default:
      return { ok: false };
  }
}

/* Kosmetik auf bekannte, kleine Werte begrenzen (keine Bilder, keine Fremdinhalte). */
function cleanCosm(c) {
  if (!isObj(c)) return null;
  const out = {};
  for (const k of ['hat', 'crown', 'pattern', 'ship', 'bskin', 'tskin', 'rskin', 'flag']) {
    if (typeof c[k] === 'string' && /^[a-z0-9_]{1,16}$/.test(c[k])) out[k] = c[k];
  }
  return Object.keys(out).length ? out : null;
}

module.exports = { parseClientMsg, cleanName, cleanCosm, MAX, PID_RE };
