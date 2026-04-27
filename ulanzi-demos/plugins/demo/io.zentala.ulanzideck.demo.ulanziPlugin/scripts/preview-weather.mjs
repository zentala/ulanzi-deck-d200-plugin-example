/**
 * @file preview-weather.mjs
 * @description Renders WeatherAction in 4 states to PNG files for visual review.
 * Loads the action source via vm + @napi-rs/canvas, simulates each render state.
 *
 * Usage: node scripts/preview-weather.mjs
 * Output: scripts/preview-out/*.png
 */

import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dirname, '..', 'plugin');
const OUT_DIR = join(__dirname, 'preview-out');
mkdirSync(OUT_DIR, { recursive: true });

const read = (rel) => readFileSync(join(PLUGIN_DIR, rel), 'utf8');

// Capture the latest base64 sent to setBaseDataIcon and the canvas instance used
let lastBase64 = null;
let lastCanvas = null;

const sandbox = {
  $UD: {
    setBaseDataIcon: (_ctx, base64) => {
      lastBase64 = base64;
    },
    toast: () => {},
    sendParamFromPlugin: () => {},
    openUrl: () => {},
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  Promise,
  Math,
  fetch: () => Promise.reject(new Error('disabled in preview')),
  // document.createElement('canvas') uses real @napi-rs/canvas
  document: {
    createElement: (tag) => {
      if (tag !== 'canvas') return {};
      const canvas = createCanvas(196, 196);
      lastCanvas = canvas;
      // Wrap toDataURL to match browser API
      const orig = canvas.toDataURL ? canvas.toDataURL.bind(canvas) : null;
      canvas.toDataURL = function () {
        const buf = canvas.toBuffer('image/png');
        return 'data:image/png;base64,' + buf.toString('base64');
      };
      void orig;
      return canvas;
    },
  },
  URL: { createObjectURL: () => 'blob:mock' },
};

vm.createContext(sandbox);

const sources = [
  read('actions/BaseAction.js'),
  read('actions/WeatherAction.js'),
  'this.WeatherAction = WeatherAction;',
].join('\n');

vm.runInContext(sources, sandbox);
const WeatherAction = sandbox.WeatherAction;

/**
 * Render a single state, save the canvas as PNG.
 * @param {string} name           filename (without extension)
 * @param {object} settings       merged into _defaultSettings
 * @param {object} state          { temp, code, error, loading }
 */
function snap(name, settings, state) {
  const action = new WeatherAction();
  const ctx = `preview___${name}`;

  // Bypass handleAdd's onInit (which kicks off fetch) — set up state manually
  action._buttons[ctx] = {
    settings: { ...action._defaultSettings(), ...settings },
    intervalId: null,
  };
  action._state[ctx] = { temp: null, code: null, error: null, loading: false, ...state };

  lastCanvas = null;
  action.render(ctx);

  if (!lastCanvas) {
    console.error(`[${name}] no canvas captured`);
    return;
  }
  const out = join(OUT_DIR, `${name}.png`);
  writeFileSync(out, lastCanvas.toBuffer('image/png'));
  console.log(`Generated: ${out}`);
}

// ---------------------------------------------------------------------------
// Render states
// ---------------------------------------------------------------------------

snap('01-clear', { locationLabel: 'WAW', units: 'celsius' }, { temp: 18, code: 0, loading: false });
snap('02-partly-cloudy', { locationLabel: 'WAW', units: 'celsius' }, { temp: 12, code: 2, loading: false });
snap('03-rain', { locationLabel: 'NYC', units: 'celsius' }, { temp: 7, code: 63, loading: false });
snap('04-snow', { locationLabel: 'OSL', units: 'celsius' }, { temp: -3, code: 73, loading: false });
snap('05-thunderstorm', { locationLabel: 'JKT', units: 'celsius' }, { temp: 27, code: 95, loading: false });
snap('06-fahrenheit', { locationLabel: 'JFK', units: 'fahrenheit' }, { temp: 72, code: 1, loading: false });
snap('07-loading', { locationLabel: 'WAW' }, { temp: null, loading: true });
snap('08-offline', { locationLabel: 'WAW' }, { temp: null, error: 'HTTP 500', loading: false });

console.log('\nDone. Preview folder:', OUT_DIR);
