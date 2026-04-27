/**
 * @file helpers.js
 * @description Shared vm sandbox factory for plugin action tests.
 * Loads browser-style plain JS files (no module system) via Node's vm module.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLUGIN_DIR = path.join(__dirname, '..', 'plugin');

/**
 * Read a file from the plugin directory.
 * @param {string} relPath - relative to plugin/
 * @returns {string}
 */
function readPlugin(relPath) {
  return fs.readFileSync(path.join(PLUGIN_DIR, relPath), 'utf8');
}

/**
 * Recording-context factory. One source of truth for the mock's Canvas2D
 * surface — used by both makeCanvas() (jest path) and BROWSER_SHIMS (vm path,
 * via String(fn) injection so the same definition runs inside the sandbox).
 *
 * Coverage rationale: every method an action *could* plausibly call. We
 * learned the hard way (twice) that lazily growing the mock breaks 13 tests
 * the moment a render() introduces a new primitive. Better to overshoot once.
 */
function _makeRecordingCtx() {
  const calls = [];
  const noop = () => {};
  const push = (op, extra) => calls.push(extra ? Object.assign({ op }, extra) : { op });
  return {
    calls,
    // — properties (mutable, accept any assignment without complaint)
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    filter: 'none',
    lineDashOffset: 0,
    // — rectangles
    fillRect: (...a) => push('fillRect', { args: a }),
    strokeRect: (...a) => push('strokeRect', { args: a }),
    clearRect: (...a) => push('clearRect', { args: a }),
    // — text
    fillText: (t, x, y) => push('fillText', { text: t, x, y }),
    strokeText: (t, x, y) => push('strokeText', { text: t, x, y }),
    measureText: (t) => ({ width: (t || '').length * 7 }),
    // — paths
    beginPath: () => push('beginPath'),
    closePath: () => push('closePath'),
    moveTo: (...a) => push('moveTo', { args: a }),
    lineTo: (...a) => push('lineTo', { args: a }),
    bezierCurveTo: (...a) => push('bezierCurveTo', { args: a }),
    quadraticCurveTo: (...a) => push('quadraticCurveTo', { args: a }),
    arc: (...a) => push('arc', { args: a }),
    arcTo: (...a) => push('arcTo', { args: a }),
    ellipse: (...a) => push('ellipse', { args: a }),
    rect: (...a) => push('rect', { args: a }),
    roundRect: (...a) => push('roundRect', { args: a }),
    // — drawing ops
    fill: () => push('fill'),
    stroke: () => push('stroke'),
    clip: () => push('clip'),
    // — transform
    save: () => push('save'),
    restore: () => push('restore'),
    translate: (...a) => push('translate', { args: a }),
    rotate: (...a) => push('rotate', { args: a }),
    scale: (...a) => push('scale', { args: a }),
    transform: (...a) => push('transform', { args: a }),
    setTransform: (...a) => push('setTransform', { args: a }),
    resetTransform: () => push('resetTransform'),
    // — gradients & patterns
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createConicGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    // — line dash
    setLineDash: (d) => push('setLineDash', { dash: d }),
    getLineDash: () => [],
    // — images & pixel data
    drawImage: (...a) => push('drawImage', { args: a }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: noop,
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    // — hit testing
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
}

/**
 * Minimal browser shims injected into every vm sandbox. The `_makeRecordingCtx`
 * source is concatenated verbatim so the sandbox runs the same definition.
 */
const BROWSER_SHIMS = `
${String(_makeRecordingCtx)}
const document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const ctx = _makeRecordingCtx();
    return {
      getContext: () => ctx,
      width: 196, height: 196,
      toDataURL: () => 'data:image/png;base64,MOCK',
    };
  }
};
const URL = { createObjectURL: () => 'blob:mock' };
class Worker { constructor(){} terminate() {} }
const fetch = () => Promise.reject(new Error('fetch not available'));
`;

/**
 * Create a vm sandbox with jest mocks for $UD and load the given action files.
 *
 * NOTE: BaseAction.js is always loaded first (all actions extend it). Include
 * 'BaseAction' in exportNames if you need direct access to the class (e.g. for
 * patchCreateCanvas).
 *
 * Timer globals (setInterval, clearInterval, setTimeout, clearTimeout) are
 * captured at call time. To use jest.useFakeTimers() effectively, call it
 * BEFORE createSandbox, or re-sync the sandbox properties in beforeEach:
 *   sandbox.setInterval = global.setInterval; // etc.
 *
 * @param {string[]} actionFiles - relative paths inside plugin/actions/ to load (after BaseAction)
 * @param {string[]} exportNames - class names to extract from the sandbox
 * @returns {{ sandbox: object, classes: object }}
 */
function createSandbox(actionFiles, exportNames) {
  const sandbox = {
    $UD: {
      toast: jest.fn(),
      setBaseDataIcon: jest.fn(),
      sendParamFromPlugin: jest.fn(),
      openUrl: jest.fn(),
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Intl,
    Blob: class Blob {},
    performance: { now: () => Date.now() },
    Math,
  };

  vm.createContext(sandbox);

  const sources = [
    BROWSER_SHIMS,
    readPlugin('actions/BaseAction.js'),
    ...actionFiles.map((f) => readPlugin(`actions/${f}`)),
    // Expose classes to the outer context
    exportNames.map((n) => `this.${n} = ${n};`).join('\n'),
  ].join('\n');

  vm.runInContext(sources, sandbox);

  const classes = {};
  for (const name of exportNames) {
    classes[name] = sandbox[name];
  }

  return { sandbox, classes };
}

/**
 * Create a recording canvas helper (used to inspect draw calls in render tests).
 * Uses the same `_makeRecordingCtx` factory as the vm sandbox path.
 *
 * @returns {{ canvas: object, ctx: object, calls: object[], texts: () => string[] }}
 */
function makeCanvas() {
  const ctx = _makeRecordingCtx();
  const canvas = {
    width: 196,
    height: 196,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,MOCK',
  };
  return {
    canvas,
    ctx,
    calls: ctx.calls,
    texts: () => ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text),
  };
}

/**
 * Patch BaseAction.prototype.createCanvas to return a recording canvas.
 * Returns a getter for the last canvas created.
 *
 * @param {Function} BaseAction
 * @returns {{ getLastCanvas: () => object|null, restore: () => void }}
 */
function patchCreateCanvas(BaseAction) {
  const original = BaseAction.prototype.createCanvas;
  let last = null;
  BaseAction.prototype.createCanvas = function () {
    const rec = makeCanvas();
    last = rec;
    return { canvas: rec.canvas, ctx: rec.ctx };
  };
  return {
    getLastCanvas: () => last,
    reset: () => {
      last = null;
    },
    restore: () => {
      BaseAction.prototype.createCanvas = original;
    },
  };
}

/**
 * Build a minimal jsn object for handleAdd.
 * @param {string} context
 * @param {string} uuid
 * @param {object} [param]
 */
function makeJsn(context, uuid, param = null) {
  return { context, uuid, param };
}

module.exports = {
  createSandbox,
  makeCanvas,
  patchCreateCanvas,
  makeJsn,
  readPlugin,
  BROWSER_SHIMS,
};
