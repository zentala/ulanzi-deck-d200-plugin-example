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
 * Minimal browser shims injected into every vm sandbox.
 * Creates a fake canvas that records draw calls.
 */
const BROWSER_SHIMS = `
const document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const calls = [];
    const ctx = {
      calls,
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '',
      font: '', textAlign: 'center', textBaseline: 'middle',
      fillRect:   (...a) => calls.push({ op: 'fillRect', args: a }),
      strokeRect: (...a) => calls.push({ op: 'strokeRect', args: a }),
      fillText:   (t,x,y) => calls.push({ op: 'fillText', text: t, x, y }),
      strokeText: (t,x,y) => calls.push({ op: 'strokeText', text: t, x, y }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      setLineDash: (d) => calls.push({ op: 'setLineDash', dash: d }),
      lineDashOffset: 0,
      beginPath: () => calls.push({ op: 'beginPath' }),
      moveTo: (...a) => calls.push({ op: 'moveTo', args: a }),
      lineTo: (...a) => calls.push({ op: 'lineTo', args: a }),
      arcTo:  (...a) => calls.push({ op: 'arcTo', args: a }),
      arc:    (...a) => calls.push({ op: 'arc', args: a }),
      closePath: () => calls.push({ op: 'closePath' }),
      stroke: () => calls.push({ op: 'stroke' }),
      save:   () => calls.push({ op: 'save' }),
      restore:() => calls.push({ op: 'restore' }),
    };
    return {
      getContext: () => ctx,
      width: 196, height: 196,
      toDataURL: () => 'data:image/png;base64,MOCK',
    };
  }
};
const URL    = { createObjectURL: () => 'blob:mock' };
class Worker { constructor(){} terminate() {} }
const fetch  = () => Promise.reject(new Error('fetch not available'));
`;

/**
 * Create a vm sandbox with jest mocks for $UD and load the given action files.
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
 * @returns {{ canvas: object, ctx: object, calls: object[], texts: () => string[] }}
 */
function makeCanvas() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    fillRect: (...a) => calls.push({ op: 'fillRect', args: a }),
    strokeRect: (...a) => calls.push({ op: 'strokeRect', args: a }),
    fillText: (t, x, y) => calls.push({ op: 'fillText', text: t, x, y }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setLineDash: (d) => calls.push({ op: 'setLineDash', dash: d }),
    lineDashOffset: 0,
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => {},
    closePath: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
  };
  const canvas = {
    width: 196,
    height: 196,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,MOCK',
  };
  return {
    canvas,
    ctx,
    calls,
    texts: () => calls.filter((c) => c.op === 'fillText').map((c) => c.text),
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

module.exports = { createSandbox, makeCanvas, patchCreateCanvas, makeJsn, readPlugin };
