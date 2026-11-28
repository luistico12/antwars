'use strict';
/* Erzeugt die SVG-Dateien für alle Kosmetik-Skins unter img/skins/.
   Aufruf: node scripts/gen-skins.js  (die Dateien sind eingecheckt, das Skript ist nur zum Nachbauen). */
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'img', 'skins');
const wrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">${body}</svg>\n`;
const lin = (id, a, b, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

/* ============================== Hüte (32×24) ============================== */
const HATS = {
  cap: `<defs>${lin('c', '#ff8b8b', '#bf2a30')}</defs>
<path d="M6.5 16c0-5.6 4-9.6 9.5-9.6S25.5 10.4 25.5 16z" fill="url(#c)" stroke="#7d1b20" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M3 16.6h26.2c1.2 0 1.9.9 1.5 2-.4 1.5-2.3 2.6-4.6 2.6H7.4C5 21.2 3 19.7 3 18.1c0-.8.3-1.5 1-1.5z" fill="#d13a40" stroke="#7d1b20" stroke-width="1.2" stroke-linejoin="round"/>
<circle cx="16" cy="6.4" r="1.6" fill="#ffd23f" stroke="#7d1b20" stroke-width=".7"/>
<path d="M10.6 9.6c1.4-1.5 3.4-2.2 5.2-2.2" stroke="#ffd9d9" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".75"/>`,
  beanie: `<defs>${lin('b', '#8ad9ff', '#2c74ad')}</defs>
<path d="M7 14.4c0-5.2 4-8.6 9-8.6s9 3.4 9 8.6z" fill="url(#b)" stroke="#1b5279" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M6.4 14.2h19.2v3.4c0 1.2-1 2.2-2.2 2.2H8.6c-1.2 0-2.2-1-2.2-2.2z" fill="#5cb9e9" stroke="#1b5279" stroke-width="1.2"/>
<path d="M9 15v4.4M12 15v4.4M15 15v4.4M18 15v4.4M21 15v4.4" stroke="#1b5279" stroke-width=".9" opacity=".65"/>
<circle cx="16" cy="4.8" r="2.7" fill="#fff6f6" stroke="#1b5279" stroke-width="1"/>
<path d="M11.4 9.2c.9-1.1 2-1.8 3.2-2.1" stroke="#d9f4ff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/>`,
  flower: `<path d="M15.4 13.4c0 3.4.6 5.6 2 7.4" stroke="#3f8f3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<path d="M17 18.6c1.8-.6 3.4-.4 4.6.4-1.6 1.2-3.2 1.4-4.6.4z" fill="#59b84f" stroke="#2f6f2c" stroke-width=".8"/>
<g stroke="#b03060" stroke-width="1"><circle cx="16" cy="5.4" r="2.6" fill="#ff9ecb"/><circle cx="10.6" cy="8.4" r="2.6" fill="#ff9ecb"/><circle cx="21.4" cy="8.4" r="2.6" fill="#ff9ecb"/><circle cx="12.4" cy="12.2" r="2.4" fill="#ff8ac8"/><circle cx="19.6" cy="12.2" r="2.4" fill="#ff8ac8"/></g>
<circle cx="16" cy="9.4" r="2.9" fill="#ffd23f" stroke="#c08b00" stroke-width=".9"/>
<circle cx="15.2" cy="8.6" r=".8" fill="#fff3b0" opacity=".9"/>`,
  party: `<defs>${lin('p', '#7fe0ff', '#2f7fe0')}</defs>
<path d="M16 2.6 22.6 18H9.4z" fill="url(#p)" stroke="#163b66" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M10.8 15.2h10.4l1 2.4H9.8z" fill="#ffd23f" stroke="#163b66" stroke-width=".8"/>
<path d="M12.6 10.4h6.8M14 6.2h4" stroke="#ff6fb5" stroke-width="2" stroke-linecap="round"/>
<circle cx="16" cy="2.8" r="2.2" fill="#ff8ac8" stroke="#163b66" stroke-width=".9"/>
<path d="M13 4.6l1 2.4" stroke="#bfe9ff" stroke-width="1" opacity=".8" stroke-linecap="round"/>`,
  helmet: `<defs>${lin('h', '#eef3fb', '#8d97a8')}</defs>
<path d="M6 16c0-5.8 4.4-9.8 10-9.8s10 4 10 9.8z" fill="url(#h)" stroke="#4c5464" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M6 15.4h20v2.4H6z" fill="#aab4c6" stroke="#4c5464" stroke-width="1.1"/>
<path d="M16 10.6v9.2" stroke="#4c5464" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="16" cy="10" r="1.7" fill="#ffd23f" stroke="#4c5464" stroke-width=".7"/>
<g fill="#5c6576"><circle cx="9.4" cy="12.6" r=".8"/><circle cx="22.6" cy="12.6" r=".8"/><circle cx="12.6" cy="8.2" r=".7"/><circle cx="19.4" cy="8.2" r=".7"/></g>
<path d="M8.6 11c1.2-2.4 3.2-3.8 5.4-4.4" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>`,
  top: `<defs>${lin('t', '#3a3f4c', '#12141a')}</defs>
<path d="M9 16V5.2c0-1.4 1-2.4 2.4-2.4h9.2c1.4 0 2.4 1 2.4 2.4V16z" fill="url(#t)" stroke="#0a0c11" stroke-width="1.2"/>
<path d="M9 12.6h14v3.4H9z" fill="#ff5757" stroke="#0a0c11" stroke-width="1"/>
<rect x="3.4" y="15.6" width="25.2" height="3.6" rx="1.8" fill="#22262f" stroke="#0a0c11" stroke-width="1.2"/>
<path d="M11.6 5.6v6.6" stroke="#5b6272" stroke-width="1.2" opacity=".8" stroke-linecap="round"/>`,
  pirate: `<path d="M3.4 16.4c2.6-6 7-9.4 12.6-9.4s10 3.4 12.6 9.4z" fill="#20242e" stroke="#0c0e13" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M3.2 16.2c3-1.6 6.6-2.4 12.8-2.4s9.8.8 12.8 2.4c-1.4 3-6.2 4.6-12.8 4.6S4.6 19.2 3.2 16.2z" fill="#2b3140" stroke="#0c0e13" stroke-width="1.2"/>
<path d="M9.6 12.2c2-2.4 4.4-3.6 6.4-3.6s4.4 1.2 6.4 3.6" stroke="#e9e4d4" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<circle cx="16" cy="13.4" r="2.5" fill="#f2ede0" stroke="#0c0e13" stroke-width=".7"/>
<g fill="#0c0e13"><circle cx="15.1" cy="13.1" r=".6"/><circle cx="16.9" cy="13.1" r=".6"/><path d="M14.6 14.7h2.8l-1.4 1.2z"/></g>
<path d="M13 17.2h6" stroke="#8a8f9c" stroke-width=".9"/>`,
  wizard: `<defs>${lin('w', '#8b6bf0', '#3b1f9c')}</defs>
<path d="M16 1.6 24 15.4H8z" fill="url(#w)" stroke="#25145e" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M4.6 15.4h22.8c1.4 0 2.2 1 2 2.2-.2 1.6-2 2.8-4 2.8H6.6c-2 0-3.8-1.2-4-2.8-.2-1.2.6-2.2 2-2.2z" fill="#5b3fd1" stroke="#25145e" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M13 8.2l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" fill="#ffd23f"/>
<circle cx="19.4" cy="11.6" r="1.2" fill="#ffe98a"/>
<circle cx="11.6" cy="13.2" r=".9" fill="#ffe98a"/>`,
  crown: `<defs>${lin('k', '#ffe27a', '#e0a51a')}</defs>
<path d="M4 15.4 5.4 5.6l4.4 4.4L16 3.4l6.2 6.6 4.4-4.4 1.4 9.8z" fill="url(#k)" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>
<rect x="4" y="14" width="24" height="4.6" rx="1.6" fill="#ffcf3a" stroke="#8a5a00" stroke-width="1.1"/>
<g><circle cx="8.4" cy="16.3" r="1.1" fill="#ff5757"/><circle cx="16" cy="16.3" r="1.3" fill="#4aa3ff"/><circle cx="23.6" cy="16.3" r="1.1" fill="#59d17a"/></g>
<path d="M6.6 7.4 7.4 13" stroke="#fff6c4" stroke-width="1" opacity=".85" stroke-linecap="round"/>`,
  halo: `<defs><radialGradient id="hg"><stop offset="0" stop-color="#fffbd0" stop-opacity=".95"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="16" cy="7.2" rx="10.6" ry="4.2" fill="none" stroke="url(#hg)" stroke-width="6" opacity=".7"/>
<ellipse cx="16" cy="7.2" rx="8.4" ry="3" fill="none" stroke="#fff6b8" stroke-width="2.4"/>
<ellipse cx="16" cy="7.2" rx="8.4" ry="3" fill="none" stroke="#ffd23f" stroke-width="1" opacity=".9"/>
<path d="M10 4.8c2-1 4-1.4 6-1.4" stroke="#fff" stroke-width=".9" opacity=".8" stroke-linecap="round"/>`,
  cowboy: `<defs>${lin('cw', '#b07a45', '#6b4421')}</defs>
<path d="M2.6 15.8c3.4-1.6 7.6-2.4 13.4-2.4s10 .8 13.4 2.4c-2 3.4-6.8 5-13.4 5S4.6 19.2 2.6 15.8z" fill="url(#cw)" stroke="#3d2710" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M9 14.6V8.2c0-2.6 3.2-4.2 7-4.2s7 1.6 7 4.2v6.4c-2-1.2-4.4-1.8-7-1.8s-5 .6-7 1.8z" fill="#c08a52" stroke="#3d2710" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M9 12.4c2-1.2 4.4-1.8 7-1.8s5 .6 7 1.8" stroke="#5a3a1a" stroke-width="2.6" fill="none"/>
<circle cx="16" cy="12.4" r="1.4" fill="#ffd23f" stroke="#5a3a1a" stroke-width=".7"/>
<path d="M12 7c1-1.2 2.4-1.8 4-1.8" stroke="#e8c69a" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>`,
  chef: `<path d="M7 16c-2.6 0-4.6-2-4.6-4.6 0-2.4 1.8-4.4 4.2-4.6.4-3 3-5.2 6.4-5.2 2.4 0 4.4 1.2 5.6 3 2.6-.2 4.8 1.8 4.8 4.4 0 2.6-2 4.6-4.6 4.6z" fill="#f7f9ff" stroke="#9aa4b6" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M8 16h16v3.4c0 1.2-1 2.2-2.2 2.2H10.2c-1.2 0-2.2-1-2.2-2.2z" fill="#e6ebf5" stroke="#9aa4b6" stroke-width="1.2"/>
<path d="M10 18.2h12M8.4 12c0-1.6 1.2-2.8 2.8-3M19.4 8.4c1.6.2 2.8 1.4 2.8 3" stroke="#c9d2e0" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  viking: `<defs>${lin('v', '#dfe7f4', '#8b95a8')}</defs>
<path d="M7 16c0-5.6 4-9.6 9-9.6s9 4 9 9.6z" fill="url(#v)" stroke="#3f4757" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M6 15.4h20v2.6H6z" fill="#aab4c6" stroke="#3f4757" stroke-width="1.1"/>
<path d="M15.2 10.4h1.6v9h-1.6z" fill="#aab4c6" stroke="#3f4757" stroke-width=".9"/>
<path d="M7.4 11c-2.6-2.4-4.4-2.4-5 0-.6 2.4 1.6 3.8 4.4 3.4z" fill="#f2e6cc" stroke="#7a6042" stroke-width="1.1"/>
<path d="M24.6 11c2.6-2.4 4.4-2.4 5 0 .6 2.4-1.6 3.8-4.4 3.4z" fill="#f2e6cc" stroke="#7a6042" stroke-width="1.1"/>
<circle cx="12" cy="13.4" r=".9" fill="#5c6576"/><circle cx="20" cy="13.4" r=".9" fill="#5c6576"/>`,
  headphones: `<defs>${lin('hd', '#5d6472', '#22262f')}</defs>
<path d="M6.4 15.4V12c0-5.2 4.3-9.4 9.6-9.4S25.6 6.8 25.6 12v3.4" fill="none" stroke="url(#hd)" stroke-width="3.4" stroke-linecap="round"/>
<rect x="3.4" y="12.2" width="6.4" height="9.4" rx="2.4" fill="#ff5757" stroke="#7d1b20" stroke-width="1.1"/>
<rect x="22.2" y="12.2" width="6.4" height="9.4" rx="2.4" fill="#ff5757" stroke="#7d1b20" stroke-width="1.1"/>
<rect x="4.6" y="14" width="4" height="5.8" rx="1.4" fill="#3a3f4c"/>
<rect x="23.4" y="14" width="4" height="5.8" rx="1.4" fill="#3a3f4c"/>
<path d="M8.6 5.6c1.8-1.6 4-2.4 7.4-2.4" stroke="#9aa4b6" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/>`,
  mushroom: `<defs>${lin('m', '#ff7b7b', '#b8232b')}</defs>
<path d="M9.4 14.4c0-5 3-8.6 6.6-8.6s6.6 3.6 6.6 8.6z" fill="url(#m)" stroke="#6e1418" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M5 14.2c0-5.4 4.9-9.6 11-9.6s11 4.2 11 9.6c0 1.4-1.2 2.4-2.8 2.4H7.8c-1.6 0-2.8-1-2.8-2.4z" fill="url(#m)" stroke="#6e1418" stroke-width="1.3" stroke-linejoin="round"/>
<g fill="#fff6e6"><circle cx="10.4" cy="10.6" r="1.7"/><circle cx="16.4" cy="8.2" r="2"/><circle cx="21.8" cy="11.4" r="1.5"/><circle cx="13" cy="13.4" r="1"/></g>
<path d="M11.6 16.8c1.4.5 2.8.8 4.4.8s3-.3 4.4-.8" stroke="#3a1414" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>`,
  miner: `<defs>${lin('mn', '#ffe27a', '#e0a51a')}</defs>
<path d="M6.6 16c0-5.6 4.2-9.6 9.4-9.6s9.4 4 9.4 9.6z" fill="url(#mn)" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M3.2 16.2h27.6c.9 0 1.4.7 1.2 1.6-.4 1.5-2.4 2.4-4.6 2.4H7.6c-2.2 0-4.2-.9-4.6-2.4-.2-.9.3-1.6 1.2-1.6z" fill="#ffcf3a" stroke="#8a5a00" stroke-width="1.1"/>
<path d="M13.4 12.8V10h5.2v2.8z" fill="#5d6472" stroke="#2b303b" stroke-width="1"/>
<circle cx="16" cy="11.6" r="2.3" fill="#fffbe0" stroke="#2b303b" stroke-width=".9"/>
<path d="M14.8 10.6l1.6-.8" stroke="#fff" stroke-width=".9" stroke-linecap="round"/>`,
  santa: `<defs>${lin('s', '#ff6f6f', '#b31f26')}</defs>
<path d="M8 15.2c0-4.6 3.4-8 8-8 3.6 0 6.4 2 7.4 5.4 2.6-1 5.2.6 5.2 3.4 0 2.6-2.2 4.6-5 4.6z" fill="url(#s)" stroke="#6e1418" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M6.6 14.6h19.4v3c0 1.2-1 2-2.2 2H8.8c-1.2 0-2.2-.8-2.2-2z" fill="#fbf7ee" stroke="#b9b2a4" stroke-width="1.1"/>
<circle cx="27.4" cy="12" r="2.6" fill="#fbf7ee" stroke="#b9b2a4" stroke-width="1"/>
<path d="M11 9c1.4-1.4 3.2-2.2 5.2-2.2" stroke="#ffd9d9" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/>`,
  astro: `<defs>${lin('a', '#eef3fb', '#9aa4b6')}</defs>
<path d="M5 15.6C5 8.8 9.8 3.4 16 3.4S27 8.8 27 15.6z" fill="url(#a)" stroke="#4c5464" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M8.6 11.4c0-3.4 3.2-6 7.4-6s7.4 2.6 7.4 6c0 3.6-3.2 6.4-7.4 6.4s-7.4-2.8-7.4-6.4z" fill="#12203a" stroke="#4c5464" stroke-width="1.2"/>
<path d="M10.6 9.6c1.2-2 3.2-3.2 5.6-3.2 1 0 1.8.2 2.6.6-2.6.4-4.6 1.8-5.6 4-.8-.3-1.8-.8-2.6-1.4z" fill="#ffd76a" opacity=".85"/>
<rect x="6.6" y="16.2" width="18.8" height="3.4" rx="1.4" fill="#cfd6e2" stroke="#4c5464" stroke-width="1.1"/>
<circle cx="16" cy="4.6" r="1" fill="#ff5757" stroke="#4c5464" stroke-width=".6"/>`
};

/* ============================== Kronen (64×36) ============================== */
const crownBase = (g1, g2, stroke, jewel) => `<defs>${lin('g', g1, g2)}</defs>
<path d="M3 31 4.4 7.4l10.2 9.2L32 2l17.4 14.6 10.2-9.2L61 31z" fill="url(#g)" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="2.2" fill="${g1}" stroke="${stroke}" stroke-width="1.6"/>
<g><circle cx="14" cy="30.6" r="2.1" fill="${jewel}"/><circle cx="26" cy="30.6" r="2.1" fill="#fff6c4" opacity=".8"/><circle cx="38" cy="30.6" r="2.1" fill="#fff6c4" opacity=".8"/><circle cx="50" cy="30.6" r="2.1" fill="${jewel}"/></g>
<path d="M6.4 10.6 7.4 27" stroke="#fff" stroke-width="1.4" opacity=".55" stroke-linecap="round"/>`;
const CROWNS = {
  gold: crownBase('#ffe27a', '#e0a51a', '#8a5a00', '#ff5757') + `<circle cx="32" cy="9.6" r="2.6" fill="#ff5757" stroke="#8a5a00" stroke-width=".9"/>`,
  monarch: `<defs>${lin('g', '#fff0a0', '#d98b12')}</defs>
<path d="M4 31 5 5.4l10.6 9.8L32 1l16.4 14.2L59 5.4 60 31z" fill="url(#g)" stroke="#7a4212" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M4 24.6h56v4.2H4z" fill="#8a3fd1" stroke="#4a1f78" stroke-width="1.4"/>
<rect x="3" y="27" width="58" height="7.6" rx="3.8" fill="#f7f3ea" stroke="#9a9285" stroke-width="1.5"/>
<g fill="#f7f3ea"><circle cx="5.4" cy="5.4" r="2.4"/><circle cx="58.6" cy="5.4" r="2.4"/><circle cx="32" cy="1.8" r="2.6"/></g>
<g><circle cx="16" cy="26.8" r="2.2" fill="#59d17a"/><circle cx="32" cy="26.8" r="2.6" fill="#ff5757"/><circle cx="48" cy="26.8" r="2.2" fill="#4aa3ff"/></g>
<path d="M7.6 8.6 8.6 24" stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>`,
  ruby: `<defs>${lin('g', '#ff7b8f', '#a30f2c')}</defs>
<path d="M3 31 4.4 7.4l10.2 9.2L32 2l17.4 14.6 10.2-9.2L61 31z" fill="url(#g)" stroke="#5c0618" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="2.2" fill="#c0183a" stroke="#5c0618" stroke-width="1.6"/>
<g fill="#ffe3e7"><path d="M14 25.4l2.4 3.2-2.4 3.2-2.4-3.2z"/><path d="M26 25.4l2 3.2-2 3.2-2-3.2z"/><path d="M38 25.4l2 3.2-2 3.2-2-3.2z"/><path d="M50 25.4l2.4 3.2-2.4 3.2-2.4-3.2z"/></g>
<path d="M32 4.6l3.6 5.2-3.6 5.2-3.6-5.2z" fill="#ffe3e7" stroke="#5c0618" stroke-width="1"/>
<path d="M6.4 10.6 7.4 27" stroke="#ffd9df" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>`,
  amethyst: `<defs>${lin('g', '#d9bfff', '#6b32c0')}</defs>
<path d="M9 31 12 12l8 6 12-14 12 14 8-6 3 19z" fill="url(#g)" stroke="#34125e" stroke-width="1.8" stroke-linejoin="round"/>
<g fill="#c9a8ff" stroke="#34125e" stroke-width="1.2"><path d="M32 3.4l4.4 6.6L32 16 27.6 10z"/><path d="M16 16.4l3.4 4.6L16 26l-3.4-5z"/><path d="M48 16.4l3.4 4.6L48 26l-3.4-5z"/></g>
<rect x="9" y="26.4" width="46" height="7.4" rx="2" fill="#8b5cd6" stroke="#34125e" stroke-width="1.6"/>
<g fill="#f0e2ff"><circle cx="18" cy="30" r="1.8"/><circle cx="32" cy="30" r="2.2"/><circle cx="46" cy="30" r="1.8"/></g>
<path d="M13 16.6l-1.4 12" stroke="#fff" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>`,
  laurel: `<defs>${lin('g', '#ffe27a', '#d98b12')}</defs>
<path d="M8 30c-4-6-4-14 1-20 1 4 2 6 4 8-2 4-2 8 0 12z" fill="#4c9a3c" stroke="#1f4a18" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M56 30c4-6 4-14-1-20-1 4-2 6-4 8 2 4 2 8 0 12z" fill="#4c9a3c" stroke="#1f4a18" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M4 14c3-1 5-1 7 0M6 20c3-1 5-1 7 0M8 26c3-1 5-1 7 0M60 14c-3-1-5-1-7 0M58 20c-3-1-5-1-7 0M56 26c-3-1-5-1-7 0" stroke="#2f6b24" stroke-width="1.1" fill="none"/>
<path d="M14 30 15.4 12l8 6.6L32 8l8.6 10.6 8-6.6L50 30z" fill="url(#g)" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="14" y="27" width="36" height="6.4" rx="1.8" fill="#ffcf3a" stroke="#8a5a00" stroke-width="1.4"/>
<circle cx="32" cy="30.2" r="2" fill="#ff5757"/>
<path d="M17 14.6l-.8 12" stroke="#fff" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>`,
  halo: `<defs><radialGradient id="hg"><stop offset="0" stop-color="#fffbd0" stop-opacity=".95"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>${lin('g', '#ffe98a', '#e0a51a')}</defs>
<ellipse cx="32" cy="9" rx="24" ry="8" fill="none" stroke="url(#hg)" stroke-width="10" opacity=".65"/>
<ellipse cx="32" cy="9" rx="19" ry="5.6" fill="none" stroke="#fff6b8" stroke-width="3.6"/>
<ellipse cx="32" cy="9" rx="19" ry="5.6" fill="none" stroke="#ffd23f" stroke-width="1.4"/>
<path d="M10 30 12 20l8 5.6L32 15l12 10.6 8-5.6 2 10z" fill="url(#g)" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="10" y="27" width="44" height="7" rx="2" fill="#ffcf3a" stroke="#8a5a00" stroke-width="1.4"/>
<g><circle cx="20" cy="30.4" r="1.8" fill="#ff5757"/><circle cx="32" cy="30.4" r="2.1" fill="#4aa3ff"/><circle cx="44" cy="30.4" r="1.8" fill="#59d17a"/></g>`,
  inferno: `<defs>${lin('g', '#3a3f4c', '#111318')}${lin('f', '#ffb347', '#ff3b1a')}</defs>
<path d="M3 31 5 8l8 7 5-9 6 8 8-13 8 13 6-8 5 9 8-7 2 23z" fill="url(#g)" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>
<g fill="url(#f)"><path d="M32 2c3 5 6 7 6 11s-2.6 6.6-6 6.6S26 16.4 26 13c0-2.6 1.6-4.4 3.4-6.6.4 2.6 1.4 4 3 4.6C31.8 8.6 30 6.4 32 2z"/><path d="M15 14c2 3 3.6 4.6 3.6 7.4 0 2.6-1.6 4.4-3.6 4.4s-3.6-1.8-3.6-4.4c0-1.8 1-3 2-4.6.2 1.8.8 2.8 1.8 3.2-.6-1.6-1.6-3.2-.2-6z"/><path d="M49 14c2 3 3.6 4.6 3.6 7.4 0 2.6-1.6 4.4-3.6 4.4s-3.6-1.8-3.6-4.4c0-1.8 1-3 2-4.6.2 1.8.8 2.8 1.8 3.2-.6-1.6-1.6-3.2-.2-6z"/></g>
<rect x="3" y="27.4" width="58" height="7" rx="2" fill="#23262f" stroke="#000" stroke-width="1.5"/>
<g fill="#ff7a1a"><circle cx="16" cy="31" r="1.6"/><circle cx="32" cy="31" r="1.9"/><circle cx="48" cy="31" r="1.6"/></g>`,
  prism: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe3ff"/><stop offset=".35" stop-color="#7aa8ff"/><stop offset=".7" stop-color="#c58bff"/><stop offset="1" stop-color="#ffe27a"/></linearGradient></defs>
<path d="M3 31 4.4 7.4l10.2 9.2L32 2l17.4 14.6 10.2-9.2L61 31z" fill="url(#g)" stroke="#2b3f6b" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="2.2" fill="#1d2a44" stroke="#2b3f6b" stroke-width="1.6"/>
<g fill="#e8f6ff"><path d="M14 24.8l2.6 3.4-2.6 3.4-2.6-3.4z"/><path d="M26 24.8l2.2 3.4-2.2 3.4-2.2-3.4z"/><path d="M38 24.8l2.2 3.4-2.2 3.4-2.2-3.4z"/><path d="M50 24.8l2.6 3.4-2.6 3.4-2.6-3.4z"/></g>
<path d="M32 4.4l3.4 5-3.4 5-3.4-5z" fill="#fff" opacity=".9"/>
<path d="M6.4 10.6 7.4 27" stroke="#fff" stroke-width="1.5" opacity=".75" stroke-linecap="round"/>`,
  frost: `<defs>${lin('g', '#e6faff', '#6fb7e0')}</defs>
<path d="M6 31 9 10l7.4 6L32 1l15.6 15 7.4-6 3 21z" fill="url(#g)" stroke="#2c6b96" stroke-width="1.7" stroke-linejoin="round"/>
<g stroke="#ffffff" stroke-width="1.3" opacity=".85" fill="none"><path d="M32 4v18M32 8l-6 5M32 8l6 5M32 15l-6 5M32 15l6 5"/><path d="M16 14v12M16 18l-4 3M16 18l4 3"/><path d="M48 14v12M48 18l-4 3M48 18l4 3"/></g>
<rect x="6" y="27" width="52" height="7" rx="2.2" fill="#a8dcf5" stroke="#2c6b96" stroke-width="1.5"/>
<g fill="#ffffff"><circle cx="18" cy="30.5" r="1.8"/><circle cx="32" cy="30.5" r="2.1"/><circle cx="46" cy="30.5" r="1.8"/></g>`,
  toxic: `<defs>${lin('g', '#b6ff6a', '#3f8f1f')}</defs>
<path d="M3 31 4.4 7.4l10.2 9.2L32 2l17.4 14.6 10.2-9.2L61 31z" fill="url(#g)" stroke="#24540f" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="2.2" fill="#4c9a2c" stroke="#24540f" stroke-width="1.6"/>
<g fill="#d9ff9a" stroke="#24540f" stroke-width=".8"><circle cx="14" cy="30.6" r="2.4"/><circle cx="26" cy="30.6" r="1.6"/><circle cx="38" cy="30.6" r="2.6"/><circle cx="50" cy="30.6" r="1.8"/></g>
<path d="M12 18c1 3 2 4 2 6s-1 3-2 3-2-1-2-3 1-3 2-6zM22 22c.8 2.4 1.6 3.2 1.6 4.6 0 1.4-.8 2.4-1.6 2.4s-1.6-1-1.6-2.4S21.2 24.4 22 22z" fill="#b6ff6a" opacity=".8"/>
<circle cx="32" cy="9.6" r="2.8" fill="#eaffc4" stroke="#24540f" stroke-width=".9"/>
<path d="M6.4 10.6 7.4 27" stroke="#f0ffd8" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>`,
  sun: `<defs>${lin('g', '#fff0a0', '#e08b12')}<radialGradient id="sg"><stop offset="0" stop-color="#fff8c4"/><stop offset="1" stop-color="#ffb347"/></radialGradient></defs>
<g stroke="#e0a51a" stroke-width="2.8" stroke-linecap="round"><path d="M32 4.4v-2.8M32 25.6v3M19.2 21.4l-2 3M44.8 21.4l2 3M18.6 15.6h-3.4M45.4 15.6h3.4M22 8.6l-2.2-2.4M42 8.6l2.2-2.4"/></g>
<circle cx="32" cy="15" r="10" fill="url(#sg)" stroke="#a35f00" stroke-width="1.6"/>
<path d="M3 31 4.4 22l10.2 4.4L32 16l17.4 10.4L59 22l2 9z" fill="url(#g)" stroke="#8a5a00" stroke-width="1.7" stroke-linejoin="round"/>
<rect x="3" y="28" width="58" height="6.6" rx="2" fill="#ffcf3a" stroke="#8a5a00" stroke-width="1.4"/>
<path d="M26 11c1.6-1.6 4-2.4 6-2.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".85"/>`,
  obsidian: `<defs>${lin('g', '#4b5162', '#0b0d12')}</defs>
<path d="M3 31 7 6l8.4 8.6L32 1l16.6 13.6L57 6l4 25z" fill="url(#g)" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="1.6" fill="#171a21" stroke="#000" stroke-width="1.6"/>
<path d="M32 6.6l3.4 6.4L32 19l-3.4-6z" fill="#ff3b5c" stroke="#4a0418" stroke-width=".9"/>
<g fill="#ff3b5c" opacity=".9"><circle cx="14" cy="30.6" r="1.8"/><circle cx="50" cy="30.6" r="1.8"/></g>
<g stroke="#8b93a6" stroke-width="1.2" opacity=".65" fill="none"><path d="M11 12l-2 18M53 12l2 18"/></g>`,
  coral: `<defs>${lin('g', '#ffb3d1', '#c2185b')}</defs>
<path d="M12 31c-3-6-2-12 2-16 0 4 1 6 3 7-2-6 0-12 5-15 0 5 1 8 3 10 1-5 4-8 8-9-2 6-1 10 2 13 3 3 4 7 3 10z" fill="url(#g)" stroke="#7d0c3c" stroke-width="1.6" stroke-linejoin="round"/>
<g fill="#ffe0ec" opacity=".9"><circle cx="16" cy="20" r="1.5"/><circle cx="28" cy="14" r="1.7"/><circle cx="44" cy="17" r="1.4"/></g>
<rect x="8" y="27" width="48" height="7" rx="2.4" fill="#e0528c" stroke="#7d0c3c" stroke-width="1.5"/>
<g fill="#fff0f6"><circle cx="18" cy="30.5" r="1.7"/><circle cx="32" cy="30.5" r="2"/><circle cx="46" cy="30.5" r="1.7"/></g>`
};

/* ============================== Schiffe (64×48) ============================== */
const hull = (fill, stroke, extra = '') => `<path d="M6 33h52l-7 12H13z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M9 37h46" stroke="${stroke}" stroke-width="1" opacity=".65"/>${extra}`;
const SHIPS = {
  leaf: `<defs>${lin('s', '#a6e87f', '#3b7a2a')}</defs>
${hull('#7a5228', '#3d2710', '<path d="M13 33h38l-4 5H17z" fill="#5aa83c" stroke="#2f5a1c" stroke-width="1.2"/>')}
<rect x="30.6" y="8" width="2.4" height="25" fill="#3d2710"/>
<path d="M33 9c12 2 18 8 17 22H33z" fill="url(#s)" stroke="#22471a" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M33 12c3 4 3 12 0 16M33 11c9 0 15 4 16 12" stroke="#d9ffb8" stroke-width="1.1" fill="none" opacity=".8"/>
<path d="M3 34c-2-3 2-5 4-3" stroke="#6b4421" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  viking: `<defs>${lin('s', '#ffe27a', '#e0a51a')}</defs>
${hull('#8a5a30', '#3d2710', '<g fill="#c0392b" stroke="#5c1a12" stroke-width=".8"><circle cx="18" cy="37" r="3"/><circle cx="32" cy="37" r="3"/><circle cx="46" cy="37" r="3"/></g>')}
<rect x="30.6" y="6" width="2.6" height="27" fill="#3d2710"/>
<path d="M33 8c13 2 18 10 17 24H33z" fill="url(#s)" stroke="#8a5a00" stroke-width="1.4"/>
<path d="M33 11h16M33 18h16.4M33 25h13" stroke="#c0392b" stroke-width="2.6"/>
<path d="M20 32c-2-6 2-11 7-12-3 4-3 8 0 12z" fill="#e8dcbc" stroke="#7a6042" stroke-width="1.2"/>
<path d="M4 33c-4-4-4-10 0-13 1 3 2 5 4 6-2 2-2 5 0 7z" fill="#f2e6cc" stroke="#7a6042" stroke-width="1.2"/>`,
  pirate: `<defs>${lin('s', '#3a3f4c', '#101218')}</defs>
${hull('#2e2e3a', '#0b0b10', '<g fill="#0b0b10"><rect x="12" y="33" width="4" height="3" rx="1"/><rect x="24" y="33" width="4" height="3" rx="1"/><rect x="36" y="33" width="4" height="3" rx="1"/><rect x="48" y="33" width="4" height="3" rx="1"/></g>')}
<rect x="30.8" y="4" width="2.4" height="29" fill="#0b0b10"/>
<path d="M33 6h15c-1.6 3-1.6 5 0 8H33z" fill="#151519" stroke="#000" stroke-width="1.2"/>
<path d="M33 8c11 2 15 9 15 24H33z" fill="#f2ede0" stroke="#8a8474" stroke-width="1.3"/>
<circle cx="40" cy="15" r="4" fill="#151519"/>
<g fill="#f2ede0"><circle cx="38.8" cy="14" r="1.1"/><circle cx="41.2" cy="14" r="1.1"/><path d="M39 17.4h2l-1 1.6z"/></g>
<path d="M4 31l6-4M60 31l-6-4" stroke="#0b0b10" stroke-width="2" stroke-linecap="round"/>`,
  steam: `<defs>${lin('s', '#e6ebf5', '#9aa4b6')}</defs>
${hull('#b8c0cc', '#4c5464', '<rect x="14" y="30" width="36" height="4" rx="2" fill="#8d97a8" stroke="#4c5464" stroke-width="1"/>')}
<rect x="20" y="16" width="13" height="16" rx="1.6" fill="#eef2f8" stroke="#4c5464" stroke-width="1.4"/>
<rect x="23" y="8" width="7" height="9" rx="1.4" fill="#5d6472" stroke="#2b303b" stroke-width="1.2"/>
<g fill="#cfd5de" opacity=".9"><circle cx="26.6" cy="5" r="2.4"/><circle cx="31.4" cy="2.6" r="1.7"/></g>
<g fill="#6fb7ff" stroke="#2b5b86" stroke-width="1"><rect x="24" y="19" width="5" height="5" rx="1"/><rect x="24" y="26" width="5" height="4" rx="1"/></g>
<g fill="#8d97a8" stroke="#4c5464" stroke-width="1.2"><circle cx="41" cy="27" r="5.4"/><circle cx="54" cy="27" r="5.4"/></g>
<g stroke="#dfe6f2" stroke-width="1.4"><path d="M41 22v10M36 27h10M54 22v10M49 27h10"/></g>`,
  duck: `<defs>${lin('s', '#ffe27a', '#e0a51a')}</defs>
<ellipse cx="36" cy="30" rx="21" ry="9" fill="url(#s)" stroke="#b8860b" stroke-width="1.4"/>
<path d="M40 22c0-6 4-10 9-10s9 4 9 10c0 5-4 8-9 8s-9-3-9-8z" fill="#ffe27a" stroke="#b8860b" stroke-width="1.4"/>
<path d="M57 24l7 3-7 3z" fill="#ff8a1f" stroke="#a34a00" stroke-width="1.1" stroke-linejoin="round"/>
<circle cx="53" cy="22" r="1.7" fill="#111"/>
<path d="M14 34c-4-3-8-1-8 3s4 5 6 3" fill="#ffd23f" stroke="#b8860b" stroke-width="1.3"/>
<path d="M28 30c2 4 6 5 10 4" stroke="#fff3b0" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path d="M10 38c6 4 40 4 50-2" stroke="#6fb7ff" stroke-width="2" fill="none" opacity=".7"/>`,
  golden: `<defs>${lin('s', '#fff0a0', '#c0392b')}${lin('h', '#ffe27a', '#b8860b')}</defs>
${hull('url(#h)', '#6b4a00', '<path d="M10 36h44" stroke="#fff3b0" stroke-width="1.6"/>')}
<rect x="30.8" y="4" width="2.6" height="29" fill="#6b4a00"/>
<path d="M33 6c14 3 19 12 18 26H33z" fill="url(#s)" stroke="#7d1b20" stroke-width="1.4"/>
<path d="M34 10c9 1 15 5 17 12" stroke="#ffd9d9" stroke-width="1.4" fill="none" opacity=".8"/>
<path d="M33 9c-8 1-14 5-16 10h16z" fill="#f7f3ea" stroke="#8a8474" stroke-width="1.2"/>
<g fill="#ffd23f" stroke="#6b4a00" stroke-width=".8"><circle cx="18" cy="35" r="2"/><circle cx="32" cy="35" r="2"/><circle cx="46" cy="35" r="2"/></g>`,
  ghost: `<defs>${lin('s', '#e8f6ff', '#8fb8d6')}</defs>
<ellipse cx="32" cy="30" rx="24" ry="11" fill="#0f2233" stroke="#07131f" stroke-width="1.4" opacity=".75"/>
<path d="M28 30V8c6-4 14-2 16 6 2 8 0 14-4 16z" fill="url(#s)" stroke="#5f8fb0" stroke-width="1.3" opacity=".85"/>
<g fill="#0f2233" opacity=".65"><circle cx="35" cy="15" r="1.8"/><circle cx="41" cy="19" r="1.8"/><circle cx="33" cy="22" r="1.2"/></g>
<path d="M8 27c4-3 8-2 10 1M6 32c5-2 9 0 11 3" stroke="#bcdff5" stroke-width="1.5" fill="none" opacity=".8"/>
<path d="M14 30c6-5 26-5 38 0" stroke="#e8f6ff" stroke-width="1.4" fill="none" opacity=".5"/>`,
  ice: `<defs>${lin('s', '#e6faff', '#6fb7e0')}${lin('h', '#bfe9ff', '#5aa0c8')}</defs>
${hull('url(#h)', '#2c6b96')}
<rect x="30.8" y="5" width="2.4" height="28" fill="#2c6b96"/>
<path d="M33 7l9 12-9 14z" fill="url(#s)" stroke="#2c6b96" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M33 9l-8 10 8 10z" fill="#eef9ff" stroke="#2c6b96" stroke-width="1.2"/>
<g stroke="#ffffff" stroke-width="1.1" opacity=".85"><path d="M12 33l3 6M24 33l2 6M46 33l-2 6M56 33l-3 6"/></g>
<path d="M8 40c8 3 40 3 48-1" stroke="#bfe9ff" stroke-width="1.4" fill="none" opacity=".7"/>`,
  paper: `<defs>${lin('s', '#ffffff', '#cfd6e2')}</defs>
<path d="M8 33h48l-10 10H18z" fill="#f7f9ff" stroke="#8d97a8" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M8 33l14-9 8 9z" fill="#e6ebf5" stroke="#8d97a8" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M33 8l16 24H33z" fill="url(#s)" stroke="#8d97a8" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M33 8l-12 24h12z" fill="#eef2f8" stroke="#8d97a8" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M33 8v24M21 32l12-9M45 32l-12-9" stroke="#b6c0d0" stroke-width="1" opacity=".9"/>
<path d="M44 36l6 4M16 38l-4 3" stroke="#8d97a8" stroke-width="1" opacity=".6"/>`,
  turtle: `<defs>${lin('s', '#a6e87f', '#3b7a2a')}</defs>
<ellipse cx="33" cy="30" rx="19" ry="10" fill="url(#s)" stroke="#24540f" stroke-width="1.5"/>
<g fill="#2f6b24" opacity=".55"><path d="M33 21l7 5-3 8h-8l-3-8z"/><path d="M16 29l5-4 3 6-4 5z"/><path d="M50 29l-5-4-3 6 4 5z"/></g>
<path d="M52 26c4 0 7 2 7 5s-3 5-7 4z" fill="#8fd66a" stroke="#24540f" stroke-width="1.3"/>
<circle cx="56" cy="29" r="1.1" fill="#111"/>
<path d="M14 30c-4-1-7 1-7 4s3 4 6 3" fill="#8fd66a" stroke="#24540f" stroke-width="1.2"/>
<g fill="#8fd66a" stroke="#24540f" stroke-width="1.1"><ellipse cx="22" cy="39" rx="3.4" ry="2.4"/><ellipse cx="44" cy="39" rx="3.4" ry="2.4"/></g>
<path d="M19 24c4-3 10-4 14-3" stroke="#d9ffb8" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/>`
};

/* ============================== AntWars + (nur mit Mitgliedschaft) ============================== */
HATS.pharaoh = `<defs>${lin('p', '#ffe9a8', '#c99312')}</defs>
<path d="M9 16c0-6 3-10 7-10s7 4 7 10z" fill="url(#p)" stroke="#8a5a00" stroke-width="1.2"/>
<path d="M6.6 14.4c-1.6 3-1.4 6 .6 8.2h17.6c2-2.2 2.2-5.2.6-8.2-1.4 1.6-4 2.6-9.4 2.6s-8-1-9.4-2.6z" fill="#2f6fd0" stroke="#123a72" stroke-width="1.2" stroke-linejoin="round"/>
<g stroke="#7fb0f0" stroke-width="1" opacity=".85"><path d="M10 17.4v4M13.4 17.8v4M18.6 17.8v4M22 17.4v4"/></g>
<path d="M16 6.4c1.8 0 3.2 1.4 3.2 3.2S17.8 13 16 13s-3.2-1.6-3.2-3.4S14.2 6.4 16 6.4z" fill="#ffd23f" stroke="#8a5a00" stroke-width=".9"/>
<circle cx="15.2" cy="9.2" r=".7" fill="#7a4a00"/>
<path d="M18.6 7.4c1.6-1 3.2-.6 4 0-1 1.2-2.4 1.6-4 .6z" fill="#e0b030" stroke="#8a5a00" stroke-width=".7"/>`;
HATS.nebula = `<defs><radialGradient id="nb"><stop offset="0" stop-color="#6a3fd0"/><stop offset="1" stop-color="#160c2e"/></radialGradient></defs>
<path d="M7 17c0-7 4-12 9-12s9 5 9 12z" fill="url(#nb)" stroke="#0a0618" stroke-width="1.2"/>
<path d="M9.4 17c0-5.4 2.8-9 6.6-9s6.6 3.6 6.6 9z" fill="#2a1a52" opacity=".75"/>
<g fill="#fff"><circle cx="12" cy="10.6" r="1"/><circle cx="18.6" cy="8.6" r=".8"/><circle cx="16" cy="13" r=".7"/><circle cx="21" cy="12.4" r=".6"/><circle cx="9.6" cy="14.6" r=".6"/></g>
<path d="M6.4 16.6h19.2c1.2 0 1.8.8 1.6 1.8-.3 1.6-2 2.6-4 2.6H8.8c-2 0-3.7-1-4-2.6-.2-1 .4-1.8 1.6-1.8z" fill="#3c2470" stroke="#0a0618" stroke-width="1.1"/>
<path d="M11 9.4c1.4-1.6 3-2.4 4.6-2.6" stroke="#c6b0ff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>`;
CROWNS.omega = `<defs>${lin('g', '#5b6580', '#0c0e14')}</defs>
<path d="M3 31 4.6 7l10 9.4L32 2l17.4 14.4 10-9.4L61 31z" fill="url(#g)" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/>
<rect x="3" y="26.6" width="58" height="8" rx="1.6" fill="#191c24" stroke="#000" stroke-width="1.6"/>
<circle cx="32" cy="17" r="9.4" fill="#0b0d12" stroke="#8b93a6" stroke-width="1.4"/>
<path d="M27.4 21.4c-2.4-2.6-2.4-7 0-9.4M36.6 21.4c2.4-2.6 2.4-7 0-9.4" stroke="#ff4fd8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<g fill="#ff4fd8"><circle cx="13" cy="30.6" r="1.8"/><circle cx="32" cy="30.6" r="2"/><circle cx="51" cy="30.6" r="1.8"/></g>
<path d="M7.6 11.6 6.8 27" stroke="#c9d2e0" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>`;
CROWNS.aurora = `<defs><linearGradient id="au" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#41e0d0"/><stop offset=".45" stop-color="#7aa8ff"/><stop offset="1" stop-color="#c58bff"/></linearGradient><linearGradient id="au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".8"/><stop offset="1" stop-color="#7aa8ff" stop-opacity="0"/></linearGradient></defs>
<path d="M3 31 4.6 7l10 9.4L32 2l17.4 14.4 10-9.4L61 31z" fill="url(#au)" stroke="#2b3f6b" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M3 31 4.6 7l10 9.4L32 2z" fill="url(#au2)" opacity=".55"/>
<rect x="3" y="26.6" width="58" height="8" rx="2.2" fill="#132036" stroke="#2b3f6b" stroke-width="1.6"/>
<g fill="#e8fbff"><path d="M14 24.8l2.4 3.4-2.4 3.4-2.4-3.4z"/><path d="M26 24.8l2 3.4-2 3.4-2-3.4z"/><path d="M38 24.8l2 3.4-2 3.4-2-3.4z"/><path d="M50 24.8l2.4 3.4-2.4 3.4-2.4-3.4z"/></g>
<g stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".75"><path d="M10 8.6v6M46 8.6v6M22 6.6v5M42 6.6v5"/></g>
<circle cx="32" cy="9.6" r="2.6" fill="#ffffff" opacity=".9"/>`;
SHIPS.leviathan = `<defs>${lin('l', '#3fd6b0', '#0f5f52')}${lin('h', '#0b3a33', '#04110f')}</defs>
${hull('url(#h)', '#03100e')}
<path d="M14 33c6-8 20-11 34-6 6 2 10 4 12 6-8 1-14 3-22 0-10-4-18 0-24 0z" fill="url(#l)" stroke="#03100e" stroke-width="1.4" stroke-linejoin="round"/>
<g fill="#7bf0d2"><circle cx="30" cy="27" r="1.6"/><circle cx="40" cy="26" r="1.4"/><circle cx="50" cy="27.6" r="1.2"/></g>
<path d="M14 33c-6-2-9 2-8 6 1 3 5 4 8 2" fill="#1c8f78" stroke="#03100e" stroke-width="1.3"/>
<path d="M56 28c4-2 6 0 6 3s-2 4-5 3z" fill="#1c8f78" stroke="#03100e" stroke-width="1.2"/>
<circle cx="59" cy="29.6" r="1" fill="#03100e"/>
<path d="M32 2l2 22 12-6-6 10" fill="none" stroke="#3fd6b0" stroke-width="2" stroke-linejoin="round" opacity=".8"/>
<path d="M12 36c14-3 28-3 44 0" stroke="#7bf0d2" stroke-width="1.2" fill="none" opacity=".55"/>`;
SHIPS.nebula = `<defs>${lin('s', '#7a4de0', '#1a0f33')}${lin('h', '#2a1a52', '#0a0618')}</defs>
${hull('url(#h)', '#0a0618')}
<rect x="30.8" y="4" width="2.6" height="29" fill="#0a0618"/>
<path d="M33 6c14 3 19 12 18 26H33z" fill="url(#s)" stroke="#3c2470" stroke-width="1.4"/>
<g fill="#fff"><circle cx="40" cy="12" r="1.2"/><circle cx="47" cy="18" r=".9"/><circle cx="38" cy="22" r="1"/><circle cx="46" cy="26" r=".7"/><circle cx="36" cy="16" r=".7"/></g>
<path d="M33 9c-8 1-13 5-15 10h15z" fill="#241a44" stroke="#3c2470" stroke-width="1.2"/>
<path d="M20 19l-4 4 4 2" fill="none" stroke="#c6b0ff" stroke-width="1.2" opacity=".7"/>
<g fill="#ff4fd8"><circle cx="18" cy="35" r="2"/><circle cx="32" cy="35" r="2"/><circle cx="46" cy="35" r="2"/></g>`;

/* Kriegsschiff: Kanonen an der Bordwand, roter Wimpel am Mast */
const WAR_ADD = `<g stroke="#1c1008" stroke-width=".9" stroke-linejoin="round">
<g fill="#2b2f38"><rect x="12" y="28.4" width="9" height="3.6" rx="1.2"/><rect x="25" y="28.4" width="9" height="3.6" rx="1.2"/><rect x="38" y="28.4" width="9" height="3.6" rx="1.2"/></g>
<g fill="#0c0e13"><circle cx="12.6" cy="30.2" r="1"/><circle cx="25.6" cy="30.2" r="1"/><circle cx="38.6" cy="30.2" r="1"/></g>
<path d="M31 1.4h12.6l-4.2 3.4 4.2 3.4H31z" fill="#ff5757" stroke="#7d1b20" stroke-width=".8"/>
<path d="M30.4 1h2.2v9h-2.2z" fill="#1c1008" stroke="none"/>
<g fill="#ffd23f" stroke="none" opacity=".9"><circle cx="17" cy="40.4" r="1.4"/><circle cx="32" cy="40.4" r="1.4"/><circle cx="47" cy="40.4" r="1.4"/></g>
</g>`;
/* Handelsschiff: Kisten an Deck, Münzen und ein Wimpel in Gold */
const TRADE_ADD = `<g stroke="#3d2710" stroke-width=".9" stroke-linejoin="round">
<g fill="#b8874a"><rect x="11" y="33" width="10" height="7" rx="1.2"/><rect x="23" y="35" width="8" height="5" rx="1.1"/></g>
<g fill="none" stroke="#7a5a2a" stroke-width=".8"><path d="M11 36.6h10M16 33v7M23 37.6h8"/></g>
<g fill="#ffd23f" stroke="#8a5a00"><circle cx="45" cy="37" r="2.6"/><circle cx="51" cy="39.4" r="1.8"/></g>
<path d="M45 34.4v5.2M51 37.6v3.6" stroke="#8a5a00" stroke-width=".8" fill="none"/>
<path d="M40.6 2.4h10l-3.4 2.8 3.4 2.8h-10z" fill="#ffd23f" stroke="#8a5a00" stroke-width=".8"/>
<path d="M40 1.6h2v8h-2z" fill="#3d2710" stroke="none"/>
</g>`;

function write(dir, id, svg) {
  const d = path.join(OUT, dir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, id + '.svg'), svg);
}
for (const [id, body] of Object.entries(HATS)) write('hats', id, wrap(32, 24, body));
for (const [id, body] of Object.entries(CROWNS)) write('crowns', id, wrap(64, 36, body));
for (const [id, body] of Object.entries(SHIPS)) {
  write('ships', id, wrap(64, 48, body));
  write('wships', id, wrap(64, 48, body + WAR_ADD));
  write('tships', id, wrap(64, 48, body + TRADE_ADD));
}
console.log(`Hüte: ${Object.keys(HATS).length}, Kronen: ${Object.keys(CROWNS).length}, Schiffe: ${Object.keys(SHIPS).length} (+ Krieg und Handel)`);
