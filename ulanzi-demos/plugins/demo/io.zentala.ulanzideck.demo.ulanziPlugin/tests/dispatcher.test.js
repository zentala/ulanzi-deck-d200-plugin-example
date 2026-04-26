/**
 * @file dispatcher.test.js
 * @description Integration tests for app.js event dispatcher.
 * Loads the full plugin sandbox (all actions + app.js) and verifies that
 * $UD events are correctly routed to action handlers via jsn.uuid (action type UUID).
 *
 * Per apiTypes.d.ts: jsn.uuid = action type UUID, jsn.actionid = instance ID.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLUGIN_DIR = path.join(__dirname, '..', 'plugin');
const read = (rel) => fs.readFileSync(path.join(PLUGIN_DIR, rel), 'utf8');

const { UUIDS } = require('../plugin/uuids.js');

const ACTION_IDS = {
  clock: UUIDS.CLOCK,
  counter: UUIDS.COUNTER,
  status: UUIDS.STATUS,
  calendar: UUIDS.CALENDAR,
  pomodoro: UUIDS.POMODORO,
};

/** Encode context the same way the real SDK does: uuid___key___actionid */
function encodeCtx(actionid, key = 'k1') {
  return `${UUIDS.PLUGIN}___${key}___${actionid}`;
}

/**
 * Build a full dispatcher sandbox: browser shims + all actions + app.js.
 * Returns { sandbox, handlers } where handlers.<event>(jsn) fires the callback.
 */
function createDispatcherSandbox() {
  const callbacks = {};

  const $UD = {
    connect: jest.fn(),
    toast: jest.fn(),
    setBaseDataIcon: jest.fn(),
    sendParamFromPlugin: jest.fn(),
    openUrl: jest.fn(),
    onConnected: jest.fn(),
    onAdd: jest.fn((fn) => {
      callbacks.add = fn;
    }),
    onRun: jest.fn((fn) => {
      callbacks.run = fn;
    }),
    onSetActive: jest.fn((fn) => {
      callbacks.setactive = fn;
    }),
    onParamFromApp: jest.fn((fn) => {
      callbacks.paramfromapp = fn;
    }),
    onParamFromPlugin: jest.fn((fn) => {
      callbacks.paramfromplugin = fn;
    }),
    onClear: jest.fn((fn) => {
      callbacks.clear = fn;
    }),
    onKeyDown: jest.fn(),
    onKeyUp: jest.fn(),
    onDialRotate: jest.fn(),
  };

  // Canvas shim (inline — same as BROWSER_SHIMS but without external dep)
  const canvasShim = `
const document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const calls = [];
    const ctx = {
      calls, fillStyle:'', strokeStyle:'', lineWidth:0, font:'',
      textAlign:'center', textBaseline:'middle',
      fillRect:   (...a) => calls.push({op:'fillRect', args:a}),
      strokeRect: (...a) => calls.push({op:'strokeRect', args:a}),
      fillText:   (t,x,y) => calls.push({op:'fillText', text:t, x, y}),
      createLinearGradient: () => ({addColorStop:()=>{}}),
      setLineDash: (d) => calls.push({op:'setLineDash', dash:d}),
      lineDashOffset: 0,
      beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, arcTo:()=>{},
      arc:()=>{}, closePath:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{},
    };
    return { getContext:()=>ctx, width:196, height:196, toDataURL:()=>'data:image/png;base64,MOCK' };
  }
};
const URL = { createObjectURL: () => 'blob:mock' };
class Worker { constructor(){} terminate(){} }
const fetch = () => Promise.reject(new Error('fetch not available'));
`;

  const sandbox = {
    $UD,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Math,
    Blob: class Blob {},
    performance: { now: () => Date.now() },
  };

  vm.createContext(sandbox);

  const sources = [
    canvasShim,
    read('uuids.js'),
    read('actions/BaseAction.js'),
    read('actions/ClockAction.js'),
    read('actions/CounterAction.js'),
    read('actions/StatusAction.js'),
    read('actions/CalendarAction.js'),
    read('actions/PomodoroAction.js'),
    read('app.js'),
  ].join('\n');

  vm.runInContext(sources, sandbox);

  const fire = (event, jsn) => {
    if (!callbacks[event]) throw new Error(`No handler registered for '${event}'`);
    callbacks[event](jsn);
  };

  return { sandbox, $UD, fire };
}

// ---------------------------------------------------------------------------

describe('app.js dispatcher — onAdd routing', () => {
  let $UD, fire;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ $UD, fire } = createDispatcherSandbox());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('routes clock actionid → ClockAction renders icon on add', () => {
    const ctx = encodeCtx(ACTION_IDS.clock);
    fire('add', { uuid: ACTION_IDS.clock, context: ctx, param: null });

    expect($UD.setBaseDataIcon).toHaveBeenCalledWith(ctx, expect.any(String), '');
  });

  test('routes counter actionid → CounterAction renders icon on add', () => {
    const ctx = encodeCtx(ACTION_IDS.counter);
    fire('add', { uuid: ACTION_IDS.counter, context: ctx, param: null });

    expect($UD.setBaseDataIcon).toHaveBeenCalledWith(ctx, expect.any(String), expect.any(String));
  });

  test('routes calendar actionid → CalendarAction renders icon on add', () => {
    const ctx = encodeCtx(ACTION_IDS.calendar);
    fire('add', { uuid: ACTION_IDS.calendar, context: ctx, param: null });

    expect($UD.setBaseDataIcon).toHaveBeenCalledWith(ctx, expect.any(String), '');
  });

  test('routes pomodoro actionid → PomodoroAction renders icon on add', () => {
    const ctx = encodeCtx(ACTION_IDS.pomodoro);
    fire('add', { uuid: ACTION_IDS.pomodoro, context: ctx, param: null });

    expect($UD.setBaseDataIcon).toHaveBeenCalledWith(ctx, expect.any(String), expect.any(String));
  });

  test('unknown actionid is silently ignored — no render', () => {
    const ctx = encodeCtx('com.unknown.action');
    fire('add', { uuid: 'com.unknown.action', context: ctx, param: null });

    expect($UD.setBaseDataIcon).not.toHaveBeenCalled();
  });

  test('plugin UUID as actionid is ignored — catches uuid vs actionid regression', () => {
    // This is the exact bug: passing the plugin UUID (4 segments) instead of
    // the action UUID (5 segments). Should NOT route to any action.
    const pluginUUID = UUIDS.PLUGIN;
    const ctx = encodeCtx(pluginUUID);
    fire('add', { uuid: pluginUUID, context: ctx, param: null });

    expect($UD.setBaseDataIcon).not.toHaveBeenCalled();
  });
});

describe('app.js dispatcher — onRun routing via CONTEXT_MAP', () => {
  let $UD, fire;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ $UD, fire } = createDispatcherSandbox());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('onRun after onAdd triggers re-render', () => {
    const ctx = encodeCtx(ACTION_IDS.clock);
    fire('add', { uuid: ACTION_IDS.clock, context: ctx, param: null });
    $UD.setBaseDataIcon.mockClear();

    fire('run', { context: ctx });

    // ClockAction.onPress toggles timezone and re-renders
    expect($UD.setBaseDataIcon).toHaveBeenCalled();
  });

  test('onRun without prior onAdd is silently ignored', () => {
    fire('run', { context: 'unknown___k1___unknown' });
    expect($UD.setBaseDataIcon).not.toHaveBeenCalled();
  });
});

describe('app.js dispatcher — onClear routing', () => {
  let $UD, fire;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ $UD, fire } = createDispatcherSandbox());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('onClear after onAdd removes context from CONTEXT_MAP — onRun no longer fires', () => {
    const ctx = encodeCtx(ACTION_IDS.clock);
    fire('add', { uuid: ACTION_IDS.clock, context: ctx, param: null });
    fire('clear', { param: [{ context: ctx }] });
    $UD.setBaseDataIcon.mockClear();

    fire('run', { context: ctx });
    expect($UD.setBaseDataIcon).not.toHaveBeenCalled();
  });
});
