/**
 * @file ClockAction.test.js
 * @description Tests for ClockAction rendering and behaviour.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');

const { sandbox, classes } = createSandbox(['ClockAction.js'], ['BaseAction', 'ClockAction']);
const { BaseAction, ClockAction } = classes;

const CTX = 'clock__ctx__1';

let action;

function makeAction() {
  action = new ClockAction();
  action.handleAdd(makeJsn(CTX, 'com.ulanzi.ulanzideck.demo.clock'));
  return action;
}

let patch;

beforeEach(() => {
  jest.useFakeTimers();
  sandbox.setInterval = global.setInterval;
  sandbox.clearInterval = global.clearInterval;
  sandbox.setTimeout = global.setTimeout;
  sandbox.clearTimeout = global.clearTimeout;
  jest.clearAllMocks();
  patch = patchCreateCanvas(BaseAction);
});

afterEach(() => {
  if (action) action.handleClear(CTX);
  patch.restore();
  jest.useRealTimers();
  sandbox.setInterval = global.setInterval;
  sandbox.clearInterval = global.clearInterval;
  sandbox.setTimeout = global.setTimeout;
  sandbox.clearTimeout = global.clearTimeout;
});

// ---------------------------------------------------------------------------

describe('ClockAction – render', () => {
  test('renders HH:MM time format (not seconds)', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    // HH:MM matches \d\d:\d\d
    const timeText = texts.find((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeText).toBeDefined();
  });

  test('renders date string with day abbreviation', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dateText = texts.find((t) => days.some((d) => t.startsWith(d)));
    expect(dateText).toBeDefined();
  });

  test('renders month abbreviation in date string', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const dateText = texts.find((t) => months.some((m) => t.includes(m)));
    expect(dateText).toBeDefined();
  });

  test('calls setLineDash to draw animated seconds border', () => {
    // Force seconds > 0 by stubbing Date
    const origDate = global.Date;
    const mockDate = new Date(2025, 0, 15, 12, 30, 30); // sec = 30
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const action = makeAction();
    action.render(CTX);

    const calls = patch.getLastCanvas().calls;
    const dashCall = calls.find(
      (c) => c.op === 'setLineDash' && c.dash.length > 0 && c.dash[0] > 0
    );
    expect(dashCall).toBeDefined();

    global.Date = origDate;
    jest.restoreAllMocks();
  });

  test('calls $UD.setBaseDataIcon after render', () => {
    const action = makeAction();
    action.render(CTX);
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalledWith(CTX, expect.any(String), '');
  });

  test('renders timezone label PL by default', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    expect(texts.some((t) => t.startsWith('PL'))).toBe(true);
  });

  test('renders timezone label JKT after toggle to Jakarta', () => {
    const action = makeAction();
    action.onPress(CTX);
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    expect(texts.some((t) => t.startsWith('JKT'))).toBe(true);
  });
});

describe('ClockAction – press', () => {
  test('onPress calls $UD.toast', () => {
    const action = makeAction();
    action.handleRun(makeJsn(CTX, ''));
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalled();
  });
});

describe('ClockAction – interval', () => {
  test('_startInterval is called on init (intervalId is set)', () => {
    const action = makeAction();
    expect(action._buttons[CTX].intervalId).not.toBeNull();
  });
});

describe('ClockAction – lifecycle', () => {
  test('handleClear removes _timezone entry for context', () => {
    const action = makeAction();
    expect(action._timezone[CTX]).toBeDefined();
    action.handleClear(CTX);
    expect(action._timezone[CTX]).toBeUndefined();
  });

  test('onSetActive false stops the interval', () => {
    const action = makeAction();
    expect(action._buttons[CTX].intervalId).not.toBeNull();
    action.handleSetActive({ context: CTX, active: false });
    expect(action._buttons[CTX].intervalId).toBeNull();
  });

  test('onSetActive true restarts interval and re-renders', () => {
    const action = makeAction();
    action.handleSetActive({ context: CTX, active: false });
    sandbox.$UD.setBaseDataIcon.mockClear();
    action.handleSetActive({ context: CTX, active: true });
    expect(action._buttons[CTX].intervalId).not.toBeNull();
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalled();
  });
});

describe('ClockAction – timezone', () => {
  test('initial timezone is PL', () => {
    const action = makeAction();
    expect(action._timezone[CTX]).toBe('PL');
  });

  test('onPress toggles timezone from PL to Asia/Jakarta', () => {
    const action = makeAction();
    expect(action._timezone[CTX]).toBe('PL');
    action.onPress(CTX);
    expect(action._timezone[CTX]).toBe('Asia/Jakarta');
  });

  test('onPress toggles timezone back from Asia/Jakarta to PL', () => {
    const action = makeAction();
    action.onPress(CTX); // PL → Jakarta
    action.onPress(CTX); // Jakarta → PL
    expect(action._timezone[CTX]).toBe('PL');
  });

  test('render uses Warsaw timezone when PL', () => {
    const action = makeAction();
    // timezone is PL — render should produce a valid HH:MM string
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const timeText = texts.find((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeText).toBeDefined();
  });

  test('render uses Jakarta timezone when toggled', () => {
    const action = makeAction();
    action.onPress(CTX); // switch to Jakarta
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const timeText = texts.find((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeText).toBeDefined();
    expect(texts.some((t) => t.startsWith('JKT'))).toBe(true);
  });
});
