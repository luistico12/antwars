'use strict';
/* Attrappen für Anzeige und Kolonie. Sie dürfen keine Spielregeln entscheiden:
   alles, was eine Weltentscheidung wäre, bleibt hier wirkungslos. */

function ctxStub() {
  const target = {
    canvas: { width: 10, height: 10 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {}, setLineDash() {}, save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    drawImage() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
    drawIcon() {}
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function canvasStub() {
  return {
    width: 0, height: 0, style: {}, dataset: {},
    getContext: () => ctxStub(),
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    appendChild() {}, setAttribute() {},
    toDataURL: () => 'data:,'
  };
}

function elementStub() {
  return {
    hidden: false, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
    width: 0, height: 0, children: [],
    appendChild() {}, removeChild() {}, insertAdjacentHTML() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    getContext: () => ctxStub(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    querySelector: () => elementStub(), querySelectorAll: () => [],
    focus() {}, blur() {}, click() {}, closest: () => null
  };
}

function installStubs(sandbox) {
  const doc = {
    createElement: tag => (tag === 'canvas' ? canvasStub() : elementStub()),
    getElementById: () => elementStub(),
    querySelector: () => elementStub(),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    head: { appendChild() {} },
    body: elementStub(),
    documentElement: elementStub()
  };
  sandbox.window = sandbox;
  sandbox.document = doc;
  sandbox.console = console;
  sandbox.performance = { now: () => 0 };
  sandbox.location = { href: 'http://server/', origin: 'http://server' };
  sandbox.navigator = { userAgent: 'node' };
  sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sandbox.setTimeout = () => 0;
  sandbox.clearTimeout = () => {};
  sandbox.setInterval = () => 0;
  sandbox.clearInterval = () => {};
  sandbox.requestAnimationFrame = () => 0;
  sandbox.cancelAnimationFrame = () => {};

  /* Anzeige und Kolonie: wirkungslos */
  for (const k of ['toast', 'flashHit', 'renderColSwitch', 'updateSetupPanel', 'renderSetup',
    'syncAnts', 'setColonyDims', 'applyDensity', 'collectItem', 'drawPatternCell',
    'flagImg', 'drawIcon', 'drawRoadLayer', 'drawWarships', 'openColony', 'lobbyRefresh',
    'qStat', 'addHeat', 'endGame', 'renderHeader', 'homeShow', 'closeScreens', 'askConquest',
    'computeStats', 'computeRegions', 'roadChanged', 'roadsChanged']) {
    sandbox[k] = () => {};
  }
  sandbox.qStat = () => {};
  sandbox.askConquest = () => {};
  sandbox.flashHit = () => {};
  sandbox.makeColony = () => ({ tid: -1, grid: [], stats: {} });
  sandbox.makeCanvas = (w, h) => { const c = canvasStub(); c.width = w; c.height = h; return c; };
  sandbox.newG = () => {
    sandbox.G = { upg: { atk: 0, def: 0 }, mat: 0, food: 0, matCap: 1e9, foodCap: 1e9, items: [], time: 0, power: {} };
  };
  sandbox.G = { upg: { atk: 0, def: 0 }, mat: 0, food: 0, matCap: 1e9, foodCap: 1e9, items: [], time: 0, power: {} };
  sandbox.PW = {};
  sandbox.DAYLEN = 100;
  sandbox.ST = { hideCosm: true };
  sandbox.PID = 'server';
  sandbox.NET = null;
  sandbox.pwMul = () => 1;
  sandbox.pick = a => a[Math.floor(Math.random() * a.length)];
  sandbox.cosmOf = () => ({});
  sandbox.svDraw = () => true;
  sandbox.drawShip = () => false;
  sandbox.flagImg = () => ({ complete: false, naturalWidth: 0 });
  sandbox.drawPatternCell = () => {};
  sandbox.roadLink = () => false;
  sandbox.roadChanged = () => {};
  sandbox.roadsChanged = () => {};
  sandbox.tradeReset = () => {};
  sandbox.updateTrade = () => {};
  sandbox.manualReset = () => {};
  sandbox.renderBase = w => w;
  sandbox.captureBase = () => {};
  sandbox.syncCosmetics = () => {};
  return sandbox;
}

module.exports = { installStubs, ctxStub, canvasStub, elementStub };
