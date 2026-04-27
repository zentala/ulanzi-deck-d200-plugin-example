/**
 * @file generate-action-previews.mjs
 * @description Generates one PNG per action render state. Output goes to
 * assets/previews/*.png and is committed to the repo so README.md can embed
 * them. Re-run via `pnpm previews` whenever a render() method changes.
 *
 * Deterministic: mocks Date and randomness so PNGs only change when render
 * code changes — not when wall-clock time advances.
 *
 * Usage: node scripts/generate-action-previews.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dirname, '..', 'plugin');
const OUT_DIR = join(__dirname, '..', 'assets', 'previews');
mkdirSync(OUT_DIR, { recursive: true });

const read = (rel) => readFileSync(join(PLUGIN_DIR, rel), 'utf8');

// ---------------------------------------------------------------------------
// Sandbox factory — one fresh sandbox per action render to keep state isolated
// ---------------------------------------------------------------------------

/**
 * Build a sandbox that loads BaseAction + the requested action file.
 * Uses real @napi-rs/canvas (not a recording mock) so the resulting PNG
 * matches what UlanziStudio's Chromium will draw.
 *
 * @param {string} actionFile  e.g. 'ClockAction.js'
 * @param {Date}   fixedNow    Date returned by `new Date()` inside the sandbox
 */
function makeSandbox(actionFile, fixedNow) {
  let lastCanvas = null;

  const FixedDate = class extends Date {
    constructor(...args) {
      if (args.length === 0) super(fixedNow.getTime());
      else super(...args);
    }
    static now() {
      return fixedNow.getTime();
    }
  };

  const sandbox = {
    $UD: {
      setBaseDataIcon: () => {},
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
    Date: FixedDate,
    Intl,
    fetch: () => Promise.reject(new Error('disabled in preview')),
    URL: { createObjectURL: () => 'blob:mock' },
    Blob: class Blob {},
    performance: { now: () => fixedNow.getTime() },
    document: {
      createElement: (tag) => {
        if (tag !== 'canvas') return {};
        const canvas = createCanvas(196, 196);
        lastCanvas = canvas;
        canvas.toDataURL = () =>
          'data:image/png;base64,' + canvas.toBuffer('image/png').toString('base64');
        return canvas;
      },
    },
  };

  vm.createContext(sandbox);

  const sources = [
    read('actions/BaseAction.js'),
    read(`actions/${actionFile}`),
    `this.ActionClass = ${actionFile.replace('.js', '')};`,
  ].join('\n');

  vm.runInContext(sources, sandbox);

  return {
    ActionClass: sandbox.ActionClass,
    getCanvas: () => lastCanvas,
  };
}

/**
 * Save the latest canvas drawn by an action.
 * @param {object} canvas  @napi-rs/canvas instance
 * @param {string} name    filename without extension
 */
function save(canvas, name) {
  if (!canvas) {
    console.error(`[${name}] no canvas captured`);
    return;
  }
  const out = join(OUT_DIR, `${name}.png`);
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`Generated: assets/previews/${name}.png`);
}

// Fixed wall clock — Monday 14 March 2026, 09:41 local. Deterministic across runs.
const NOW = new Date(2026, 2, 14, 9, 41, 23);

// ---------------------------------------------------------------------------
// ClockAction
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('ClockAction.js', NOW);
  const a = new ActionClass();
  const ctx = 'preview___clock';
  a._buttons[ctx] = { settings: { ...a._defaultSettings() }, intervalId: null };
  a._slot[ctx] = 1;
  a.render(ctx);
  save(getCanvas(), 'clock');
}

// ---------------------------------------------------------------------------
// CounterAction
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('CounterAction.js', NOW);
  const a = new ActionClass();
  const ctx = 'preview___counter';
  a._buttons[ctx] = {
    settings: { ...a._defaultSettings(), value: 5 },
    intervalId: null,
  };
  a.render(ctx);
  save(getCanvas(), 'counter');
}

// ---------------------------------------------------------------------------
// StatusAction (CPU + temp)
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('StatusAction.js', NOW);
  const a = new ActionClass();
  const ctx = 'preview___status';
  a._buttons[ctx] = { settings: a._defaultSettings(), intervalId: null };
  a._cpu[ctx] = 42;
  a._temp[ctx] = 67;
  a._alerted[ctx] = { cpu: false, temp: false };
  a.render(ctx);
  save(getCanvas(), 'status');
}

// ---------------------------------------------------------------------------
// CalendarAction
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('CalendarAction.js', NOW);
  const a = new ActionClass();
  const ctx = 'preview___calendar';
  a._buttons[ctx] = { settings: a._defaultSettings(), intervalId: null };
  a._lastDay[ctx] = -1;
  a.render(ctx);
  save(getCanvas(), 'calendar');
}

// ---------------------------------------------------------------------------
// PomodoroAction — 2 states (idle, work mid-session)
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('PomodoroAction.js', NOW);
  const a = new ActionClass();

  const idleCtx = 'preview___pomo_idle';
  a._buttons[idleCtx] = { settings: a._defaultSettings(), intervalId: null };
  a._state[idleCtx] = {
    state: 'idle',
    remaining: 0,
    total: 0,
    count: 0,
    paused: false,
    autoPaused: false,
  };
  a.render(idleCtx);
  save(getCanvas(), 'pomodoro-idle');

  const workCtx = 'preview___pomo_work';
  a._buttons[workCtx] = { settings: a._defaultSettings(), intervalId: null };
  a._state[workCtx] = {
    state: 'work',
    remaining: 18 * 60 + 23,
    total: 25 * 60,
    count: 2,
    paused: false,
    autoPaused: false,
  };
  a.render(workCtx);
  save(getCanvas(), 'pomodoro-work');
}

// ---------------------------------------------------------------------------
// WeatherAction — one PNG per condition + 2 special states
// ---------------------------------------------------------------------------
{
  const { ActionClass, getCanvas } = makeSandbox('WeatherAction.js', NOW);

  /**
   * @param {string} name
   * @param {object} settingsOverride
   * @param {object} state  { temp, code, error, loading }
   */
  function snap(name, settingsOverride, state) {
    const a = new ActionClass();
    const ctx = `preview___w_${name}`;
    a._buttons[ctx] = {
      settings: { ...a._defaultSettings(), ...settingsOverride },
      intervalId: null,
    };
    a._state[ctx] = { temp: null, code: null, error: null, loading: false, ...state };
    a.render(ctx);
    save(getCanvas(), `weather-${name}`);
  }

  snap('clear', { locationLabel: 'WAW' }, { temp: 18, code: 0 });
  snap('partly-cloudy', { locationLabel: 'WAW' }, { temp: 12, code: 2 });
  snap('overcast', { locationLabel: 'LON' }, { temp: 9, code: 3 });
  snap('fog', { locationLabel: 'SFO' }, { temp: 11, code: 45 });
  snap('drizzle', { locationLabel: 'AMS' }, { temp: 8, code: 53 });
  snap('rain', { locationLabel: 'NYC' }, { temp: 7, code: 63 });
  snap('snow', { locationLabel: 'OSL' }, { temp: -3, code: 73 });
  snap('thunderstorm', { locationLabel: 'JKT' }, { temp: 27, code: 95 });
  snap('fahrenheit', { locationLabel: 'JFK', units: 'fahrenheit' }, { temp: 72, code: 1 });
  snap('loading', { locationLabel: 'WAW' }, { loading: true });
  snap('offline', { locationLabel: 'WAW' }, { error: 'HTTP 500' });
}

console.log('\nAll action previews regenerated.');
