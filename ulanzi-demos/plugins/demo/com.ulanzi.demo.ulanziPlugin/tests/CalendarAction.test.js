/**
 * @file CalendarAction.test.js
 * @description Tests for CalendarAction render and press behaviour.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');

const { sandbox, classes } = createSandbox(['CalendarAction.js'], ['BaseAction', 'CalendarAction']);
const { BaseAction, CalendarAction } = classes;

const CTX = 'calendar__ctx__1';

function makeAction() {
  const action = new CalendarAction();
  action.handleAdd(makeJsn(CTX, 'com.ulanzi.ulanzideck.demo.calendar'));
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

describe('CalendarAction – render', () => {
  test('renders month name in uppercase', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const months = [
      'JANUARY',
      'FEBRUARY',
      'MARCH',
      'APRIL',
      'MAY',
      'JUNE',
      'JULY',
      'AUGUST',
      'SEPTEMBER',
      'OCTOBER',
      'NOVEMBER',
      'DECEMBER',
    ];
    expect(texts.some((t) => months.includes(t))).toBe(true);
  });

  test('renders current day number', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const day = String(new Date().getDate());
    expect(texts).toContain(day);
  });

  test('renders day-of-week in uppercase', () => {
    const action = makeAction();
    action.render(CTX);
    const texts = patch.getLastCanvas().texts();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    expect(texts.some((t) => days.includes(t))).toBe(true);
  });

  test('calls $UD.setBaseDataIcon after render', () => {
    const action = makeAction();
    action.render(CTX);
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalledWith(CTX, expect.any(String), '');
  });
});

describe('CalendarAction – press', () => {
  test('onPress opens Google Calendar URL', () => {
    const action = makeAction();
    action.handleRun(makeJsn(CTX, ''));
    expect(sandbox.$UD.openUrl).toHaveBeenCalledWith('https://calendar.google.com');
  });

  test('onPress does not call toast', () => {
    const action = makeAction();
    action.handleRun(makeJsn(CTX, ''));
    expect(sandbox.$UD.toast).not.toHaveBeenCalled();
  });
});

describe('CalendarAction – interval', () => {
  test('interval is started on init (intervalId is set)', () => {
    const action = makeAction();
    expect(action._buttons[CTX].intervalId).not.toBeNull();
  });
});
