/**
 * @file ClockAction.test.js
 * @description Tests for ClockAction rendering and behaviour.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');
const { UUIDS } = require('../plugin/uuids.js');

const { sandbox, classes } = createSandbox(['ClockAction.js'], ['BaseAction', 'ClockAction']);
const { BaseAction, ClockAction } = classes;

const CTX = 'clock__ctx__1';

let action;

function makeAction() {
  action = new ClockAction();
  action.handleAdd(makeJsn(CTX, UUIDS.CLOCK));
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

  test('renders default tz1 label (WAW) by default', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    expect(texts.some((t) => t.startsWith('WAW'))).toBe(true);
  });

  test('renders default tz2 label (UTC) after toggle', () => {
    const action = makeAction();
    action.onPress(CTX);
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    expect(texts.some((t) => t.startsWith('UTC'))).toBe(true);
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
  test('handleClear removes _slot entry for context', () => {
    const action = makeAction();
    expect(action._slot[CTX]).toBeDefined();
    action.handleClear(CTX);
    expect(action._slot[CTX]).toBeUndefined();
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
  test('initial slot is 1 (tz1)', () => {
    const action = makeAction();
    expect(action._slot[CTX]).toBe(1);
  });

  test('onPress toggles slot from 1 to 2', () => {
    const action = makeAction();
    expect(action._slot[CTX]).toBe(1);
    action.onPress(CTX);
    expect(action._slot[CTX]).toBe(2);
  });

  test('onPress toggles slot back from 2 to 1', () => {
    const action = makeAction();
    action.onPress(CTX); // 1 → 2
    action.onPress(CTX); // 2 → 1
    expect(action._slot[CTX]).toBe(1);
  });

  test('render produces valid HH:MM in tz1 (default Europe/Warsaw)', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const timeText = texts.find((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeText).toBeDefined();
  });

  test('render produces valid HH:MM in tz2 after toggle (default UTC)', () => {
    const action = makeAction();
    action.onPress(CTX); // switch to slot 2
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const timeText = texts.find((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeText).toBeDefined();
    expect(texts.some((t) => t.startsWith('UTC'))).toBe(true);
  });

  test('render honours custom tz1 / tz1Label settings', () => {
    const action = makeAction();
    action._buttons[CTX].settings.tz1 = 'America/New_York';
    action._buttons[CTX].settings.tz1Label = 'NYC';
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    expect(texts.some((t) => t.startsWith('NYC'))).toBe(true);
  });
});

describe('ClockAction – Intl compatibility (old Chromium/Electron simulation)', () => {
  // Regression test: older Electron/Chromium does not support timeZoneName:'shortOffset'.
  // If render() uses an unsupported Intl option it throws silently and setBaseDataIcon
  // is never called — leaving the button stuck on the static manifest icon.
  test('render still calls setBaseDataIcon when Intl.DateTimeFormat throws on unknown timeZoneName', () => {
    const OriginalIntl = sandbox.Intl;
    // Simulate old Chromium: throw RangeError for any unknown timeZoneName option
    sandbox.Intl = {
      DateTimeFormat: function (locale, opts) {
        if (
          opts &&
          opts.timeZoneName &&
          opts.timeZoneName !== 'short' &&
          opts.timeZoneName !== 'long'
        ) {
          throw new RangeError('invalid timeZoneName: ' + opts.timeZoneName);
        }
        return new OriginalIntl.DateTimeFormat(locale, opts);
      },
    };
    sandbox.Intl.DateTimeFormat.supportedLocalesOf = OriginalIntl.DateTimeFormat.supportedLocalesOf;

    const action = makeAction();
    sandbox.$UD.setBaseDataIcon.mockClear();

    expect(() => action.render(CTX)).not.toThrow();
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalled();

    sandbox.Intl = OriginalIntl;
  });
});
