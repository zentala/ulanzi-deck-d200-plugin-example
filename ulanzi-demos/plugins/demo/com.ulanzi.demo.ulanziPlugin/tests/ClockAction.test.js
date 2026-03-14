/**
 * @file ClockAction.test.js
 * @description Tests for ClockAction rendering and behaviour.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');

const { sandbox, classes } = createSandbox(['ClockAction.js'], ['BaseAction', 'ClockAction']);
const { BaseAction, ClockAction } = classes;

const CTX = 'clock__ctx__1';

function makeAction() {
  const action = new ClockAction();
  action.handleAdd(makeJsn(CTX, 'com.ulanzi.ulanzideck.demo.clock'));
  return action;
}

let patch;

beforeEach(() => {
  jest.clearAllMocks();
  patch = patchCreateCanvas(BaseAction);
});

afterEach(() => {
  patch.restore();
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
});

describe('ClockAction – press', () => {
  test('onPress calls $UD.toast', () => {
    const action = makeAction();
    action.handleRun(makeJsn(CTX, ''));
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('Clock'));
  });
});

describe('ClockAction – interval', () => {
  test('_startInterval is called on init (intervalId is set)', () => {
    const action = makeAction();
    expect(action._buttons[CTX].intervalId).not.toBeNull();
  });
});
