/**
 * @file WeatherAction.test.js
 * @description Tests for WeatherAction.
 *
 * Note: Real fetch() is mocked-to-reject in the sandbox (see helpers.js).
 * We cover the testable surfaces directly:
 *   - _describeCode (WMO weather code → emoji + label)
 *   - render output for loading / error / loaded states
 *   - lifecycle (init, clear, setActive)
 *   - onPress triggers _fetchWeather (mock spy)
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');
const { UUIDS } = require('../plugin/uuids.js');

const { sandbox, classes } = createSandbox(['WeatherAction.js'], ['BaseAction', 'WeatherAction']);
const { BaseAction, WeatherAction } = classes;

const CTX = 'weather__ctx__1';

let action;
let patch;

function makeAction(settings = {}) {
  action = new WeatherAction();
  action.handleAdd(makeJsn(CTX, UUIDS.WEATHER, settings));
  return action;
}

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

describe('WeatherAction – _describeCode (WMO mapping)', () => {
  test('code 0 is Clear', () => {
    const a = new WeatherAction();
    expect(a._describeCode(0).label).toBe('Clear');
  });

  test('code 2 is Partly cloudy', () => {
    const a = new WeatherAction();
    expect(a._describeCode(2).label).toBe('Partly cloudy');
  });

  test('code 45 / 48 is Fog', () => {
    const a = new WeatherAction();
    expect(a._describeCode(45).label).toBe('Fog');
    expect(a._describeCode(48).label).toBe('Fog');
  });

  test('codes 51-57 are Drizzle', () => {
    const a = new WeatherAction();
    expect(a._describeCode(51).label).toBe('Drizzle');
    expect(a._describeCode(57).label).toBe('Drizzle');
  });

  test('codes 61-67 are Rain', () => {
    const a = new WeatherAction();
    expect(a._describeCode(63).label).toBe('Rain');
  });

  test('codes 71-77 are Snow', () => {
    const a = new WeatherAction();
    expect(a._describeCode(73).label).toBe('Snow');
  });

  test('codes 95-99 are Thunderstorm', () => {
    const a = new WeatherAction();
    expect(a._describeCode(95).label).toBe('Thunderstorm');
    expect(a._describeCode(99).label).toBe('Thunderstorm');
  });

  test('null returns dash placeholder', () => {
    const a = new WeatherAction();
    expect(a._describeCode(null).emoji).toBe('—');
  });

  test('unknown code falls back to "Code N"', () => {
    const a = new WeatherAction();
    expect(a._describeCode(404).label).toBe('Code 404');
  });
});

describe('WeatherAction – render', () => {
  test('shows location label on top', () => {
    const a = makeAction({ locationLabel: 'NYC' });
    a._state[CTX] = { temp: 22, code: 0, error: null, loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('NYC');
  });

  test('shows temperature in celsius by default', () => {
    const a = makeAction();
    a._state[CTX] = { temp: 18.4, code: 1, error: null, loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('18°C');
  });

  test('shows temperature in fahrenheit when configured', () => {
    const a = makeAction({ units: 'fahrenheit' });
    a._state[CTX] = { temp: 72, code: 0, error: null, loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('72°F');
  });

  test('rounds temperature to integer', () => {
    const a = makeAction();
    a._state[CTX] = { temp: 18.7, code: 0, error: null, loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('19°C');
  });

  test('shows weather condition label', () => {
    const a = makeAction();
    a._state[CTX] = { temp: 5, code: 63, error: null, loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('Rain');
  });

  test('shows OFFLINE on error', () => {
    const a = makeAction();
    a._state[CTX] = { temp: null, code: null, error: 'HTTP 500', loading: false };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('OFFLINE');
  });

  test('shows loading ellipsis when temp is null and loading=true', () => {
    const a = makeAction();
    a._state[CTX] = { temp: null, code: null, error: null, loading: true };
    a.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('…');
  });

  test('calls $UD.setBaseDataIcon after render', () => {
    const a = makeAction();
    a._state[CTX] = { temp: 10, code: 0, error: null, loading: false };
    a.render(CTX);
    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalledWith(CTX, expect.any(String), '');
  });
});

describe('WeatherAction – lifecycle', () => {
  test('onInit creates default _state entry', () => {
    const a = makeAction();
    expect(a._state[CTX]).toBeDefined();
    expect(a._state[CTX].temp).toBeNull();
  });

  test('handleClear removes _state entry', () => {
    const a = makeAction();
    expect(a._state[CTX]).toBeDefined();
    a.handleClear(CTX);
    expect(a._state[CTX]).toBeUndefined();
  });

  test('onSetActive false stops the interval', () => {
    const a = makeAction();
    expect(a._buttons[CTX].intervalId).not.toBeNull();
    a.handleSetActive({ context: CTX, active: false });
    expect(a._buttons[CTX].intervalId).toBeNull();
  });

  test('onSetActive true restarts the interval', () => {
    const a = makeAction();
    a.handleSetActive({ context: CTX, active: false });
    a.handleSetActive({ context: CTX, active: true });
    expect(a._buttons[CTX].intervalId).not.toBeNull();
  });

  test('onPress triggers _fetchWeather (verified by spy)', () => {
    const a = makeAction();
    const spy = jest.spyOn(a, '_fetchWeather');
    a.onPress(CTX);
    expect(spy).toHaveBeenCalledWith(CTX);
  });
});

describe('WeatherAction – default settings', () => {
  test('default latitude is Warsaw', () => {
    const a = new WeatherAction();
    expect(a._defaultSettings().latitude).toBeCloseTo(52.23, 1);
  });

  test('default units are celsius', () => {
    const a = new WeatherAction();
    expect(a._defaultSettings().units).toBe('celsius');
  });

  test('default refreshMin is sane (>= 5 minutes, to respect API)', () => {
    const a = new WeatherAction();
    expect(a._defaultSettings().refreshMin).toBeGreaterThanOrEqual(5);
  });
});
