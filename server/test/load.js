'use strict';
/* Lasttest (kein Teil von npm test): node server/test/load.js
   Erzeugt 10 Welten mit je 8 Menschen, lässt 300 simulierte Sekunden laufen
   und meldet Speicher (RSS) und CPU-Zeit je simulierter Sekunde. */
const { createWorld } = require('../sim/world-vm');

const ROOMS = Number(process.env.ROOMS || 10);
const HUMANS = 8;
const SECONDS = 300;

function pickStarts(world) {
  const species = ['ground', 'leaf', 'termite'];
  const used = new Set(), out = [];
  for (let i = 0; i < 400 && out.length < HUMANS; i++) {
    if (used.has(i)) continue;
    if (world.validStart(species[out.length % species.length], i)) { used.add(i); out.push(i); }
  }
  return out;
}

function rss() { return Math.round(process.memoryUsage().rss / 1024 / 1024); }

const t0 = process.hrtime.bigint();
const base = rss();
const worlds = [];
for (let r = 0; r < ROOMS; r++) {
  const w = createWorld({ mode: r === ROOMS - 1 ? 'unlimited' : 'ffa', mapSeed: 100 + r, seed: 1 + r });
  const starts = pickStarts(w);
  w.initWorld(starts.map((start, i) => ({ pid: 'p' + i, name: 'Spieler ' + i, species: 'ground', start, c: null })));
  worlds.push(w);
}
const afterStart = rss();

const steps = Math.round(SECONDS / 0.1);
for (let s = 0; s < steps; s++) {
  for (const w of worlds) w.step(0.1);
}
const cpu = Number(process.hrtime.bigint() - t0) / 1e9;
const end = rss();

console.log('Räume:              ' + ROOMS);
console.log('RSS vor dem Start:  ' + base + ' MB');
console.log('RSS nach dem Start: ' + afterStart + ' MB');
console.log('RSS am Ende:        ' + end + ' MB');
console.log('CPU gesamt:         ' + cpu.toFixed(2) + ' s für ' + SECONDS + ' simulierte Sekunden');
console.log('CPU je Sim-Sekunde: ' + ((cpu / SECONDS) * 100).toFixed(1) + ' % eines Kerns');
for (const w of worlds) w.dispose();
