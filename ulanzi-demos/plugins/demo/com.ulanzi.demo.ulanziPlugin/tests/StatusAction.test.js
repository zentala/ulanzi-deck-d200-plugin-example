/**
 * @file StatusAction.test.js
 * @description Integration tests for StatusAction rendering logic.
 *
 * Tests verify:
 *  - LHM JSON parsing (CPU load + temperature extraction)
 *  - EMA smoothing behaviour
 *  - Section color thresholds
 *  - Alert toast triggers
 *  - Canvas render output (what text appears on screen)
 *  - Worker lifecycle (terminate on last context removal)
 *
 * Run: pnpm test
 */
const { createSandbox, patchCreateCanvas } = require('./helpers');

const { sandbox, classes } = createSandbox(['StatusAction.js'], ['BaseAction', 'StatusAction']);
const { BaseAction, StatusAction } = classes;

let patch;

beforeEach(() => {
  jest.clearAllMocks();
  patch = patchCreateCanvas(BaseAction);
});

afterEach(() => {
  patch.restore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal LHM JSON node tree. */
function lhmTree({ cpuLoad = null, cpuTemp = null } = {}) {
  const children = [];

  if (cpuLoad !== null) {
    children.push({
      Text: 'CPU Total',
      Value: `${cpuLoad.toFixed(1)} %`,
      SensorType: 'Load',
      Children: [],
    });
  }

  if (cpuTemp !== null) {
    children.push({
      Text: 'CPU Package',
      Value: `${cpuTemp.toFixed(1)} °C`,
      SensorType: 'Temperature',
      Children: [],
    });
  }

  return {
    Text: 'Root',
    Children: [{ Text: 'CPU', Children: children }],
  };
}

/** Create a StatusAction with one context pre-initialised (no handleAdd — avoids starting intervals). */
function makeAction(settings = {}) {
  const action = new StatusAction();
  const context = 'test___key___aid';
  action._buttons[context] = {
    settings: { ...action._defaultSettings(), ...settings },
    intervalId: null,
  };
  action._cpu[context] = null;
  action._temp[context] = null;
  action._alerted[context] = { cpu: false, temp: false };
  return { action, context };
}

// ---------------------------------------------------------------------------
// 1. LHM parsing
// ---------------------------------------------------------------------------

describe('_scanLHM – data extraction', () => {
  test('extracts CPU load from LHM tree', () => {
    const { action } = makeAction();
    const result = action._scanLHM(lhmTree({ cpuLoad: 42.3 }));
    expect(result.load).toBeCloseTo(42.3, 1);
  });

  test('extracts CPU temperature from LHM tree', () => {
    const { action } = makeAction();
    const result = action._scanLHM(lhmTree({ cpuTemp: 67.0 }));
    expect(result.temp).toBeCloseTo(67.0, 1);
  });

  test('extracts both load and temp simultaneously', () => {
    const { action } = makeAction();
    const result = action._scanLHM(lhmTree({ cpuLoad: 55.5, cpuTemp: 72.0 }));
    expect(result.load).toBeCloseTo(55.5, 1);
    expect(result.temp).toBeCloseTo(72.0, 1);
  });

  test('returns null for missing sensors', () => {
    const { action } = makeAction();
    const result = action._scanLHM({ Text: 'Root', Children: [] });
    expect(result.load).toBeNull();
    expect(result.temp).toBeNull();
  });

  test('handles deeply nested tree', () => {
    const { action } = makeAction();
    const deep = {
      Text: 'Root',
      Children: [
        {
          Text: 'Motherboard',
          Children: [
            {
              Text: 'Intel CPU',
              Children: [
                {
                  Text: 'CPU Total',
                  Value: '33.7 %',
                  SensorType: 'Load',
                  Children: [],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(action._scanLHM(deep).load).toBeCloseTo(33.7, 1);
  });
});

// ---------------------------------------------------------------------------
// 2. EMA smoothing
// ---------------------------------------------------------------------------

describe('_smooth – exponential moving average', () => {
  test('returns raw value when no previous sample', () => {
    const { action } = makeAction();
    expect(action._smooth(null, 60)).toBe(60);
  });

  test('blends previous and new value', () => {
    const { action } = makeAction();
    const result = action._smooth(40, 80, 0.5);
    expect(result).toBe(60); // 0.5*80 + 0.5*40
  });

  test('repeated samples converge toward stable value', () => {
    const { action } = makeAction();
    let v = 0;
    for (let i = 0; i < 20; i++) v = action._smooth(v, 50, 0.3);
    expect(v).toBeGreaterThan(45);
    expect(v).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// 3. Section color
// ---------------------------------------------------------------------------

describe('_sectionColor', () => {
  test('returns green below 75% of threshold', () => {
    const { action } = makeAction();
    expect(action._sectionColor(30, 90)).toBe('#39d353');
  });

  test('returns orange between 75% and 100% of threshold', () => {
    const { action } = makeAction();
    // 75% of 90 = 67.5 → 70 is orange
    expect(action._sectionColor(70, 90)).toBe('#ffaa00');
  });

  test('returns red at or above threshold', () => {
    const { action } = makeAction();
    expect(action._sectionColor(90, 90)).toBe('#f85149');
    expect(action._sectionColor(95, 90)).toBe('#f85149');
  });

  test('returns grey for null (no data)', () => {
    const { action } = makeAction();
    expect(action._sectionColor(null, 90)).toBe('#444');
  });
});

// ---------------------------------------------------------------------------
// 4. Alert logic
// ---------------------------------------------------------------------------

describe('_checkAlerts', () => {
  test('fires CPU toast when load exceeds threshold', () => {
    const { action, context } = makeAction({ cpuThreshold: 90 });
    action._cpu[context] = 95;
    action._temp[context] = 60;
    action._checkAlerts(context);
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('CPU load'));
  });

  test('fires temp toast when temperature exceeds threshold', () => {
    const { action, context } = makeAction({ tempThreshold: 85 });
    action._cpu[context] = 30;
    action._temp[context] = 92;
    action._checkAlerts(context);
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('overheat'));
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('92'));
  });

  test('does not fire toast below threshold', () => {
    const { action, context } = makeAction({ cpuThreshold: 90, tempThreshold: 85 });
    action._cpu[context] = 50;
    action._temp[context] = 60;
    action._checkAlerts(context);
    expect(sandbox.$UD.toast).not.toHaveBeenCalled();
  });

  test('fires toast only once per alert episode (not every render)', () => {
    const { action, context } = makeAction({ cpuThreshold: 90 });
    action._cpu[context] = 95;
    action._checkAlerts(context);
    action._checkAlerts(context);
    action._checkAlerts(context);
    expect(sandbox.$UD.toast).toHaveBeenCalledTimes(1);
  });

  test('re-fires toast after recovery and new spike', () => {
    const { action, context } = makeAction({ cpuThreshold: 90 });
    action._cpu[context] = 95;
    action._checkAlerts(context); // first alert

    action._cpu[context] = 40;
    action._checkAlerts(context); // recovery → clears flag

    action._cpu[context] = 95;
    action._checkAlerts(context); // second alert
    expect(sandbox.$UD.toast).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Canvas render output – what's actually shown on the button
// ---------------------------------------------------------------------------

describe('render – what appears on screen', () => {
  test('shows CPU percentage when data is available', () => {
    const { action, context } = makeAction();
    action._cpu[context] = 42;
    action._temp[context] = null;
    action.render(context);
    expect(patch.getLastCanvas().texts()).toContain('42%');
  });

  test('shows CPU dash when no data', () => {
    const { action, context } = makeAction();
    action._cpu[context] = null;
    action._temp[context] = null;
    action.render(context);
    const texts = patch.getLastCanvas().texts();
    // Expect two dashes (one for each section)
    expect(texts.filter((t) => t === '—').length).toBe(2);
  });

  test('shows temperature in Celsius', () => {
    const { action, context } = makeAction();
    action._cpu[context] = 30;
    action._temp[context] = 67;
    action.render(context);
    expect(patch.getLastCanvas().texts()).toContain('67°C');
  });

  test('shows section labels CPU and TEMP', () => {
    const { action, context } = makeAction();
    action.render(context);
    const texts = patch.getLastCanvas().texts();
    expect(texts).toContain('CPU');
    expect(texts).toContain('TEMP');
  });

  test('shows install hint when temp unavailable', () => {
    const { action, context } = makeAction();
    action._cpu[context] = null;
    action._temp[context] = null;
    action.render(context);
    expect(patch.getLastCanvas().texts()).toContain('install LHM');
  });

  test('does not show install hint when temp available', () => {
    const { action, context } = makeAction();
    action._temp[context] = 55;
    action.render(context);
    expect(patch.getLastCanvas().texts()).not.toContain('install LHM');
  });
});

// ---------------------------------------------------------------------------
// 6. onPress – alert reset and re-render
// ---------------------------------------------------------------------------

describe('onPress', () => {
  test('resets alert flags so toast can fire again after manual refresh', () => {
    const { action, context } = makeAction({ cpuThreshold: 90 });
    action._cpu[context] = 95;
    action._alerted[context] = { cpu: true, temp: true }; // alerts already fired

    action.onPress(context);

    expect(action._alerted[context]).toEqual({ cpu: false, temp: false });
  });

  test('calls render after press', () => {
    const { action, context } = makeAction();
    action._cpu[context] = 50;
    action._temp[context] = 60;

    action.onPress(context);

    expect(sandbox.$UD.setBaseDataIcon).toHaveBeenCalledWith(context, expect.any(String), '');
  });
});

// ---------------------------------------------------------------------------
// 7. handleClear – Worker lifecycle
// ---------------------------------------------------------------------------

describe('handleClear – Worker termination', () => {
  test('nulls out _worker when last context is removed', () => {
    const action = new StatusAction();
    expect(action._worker).not.toBeNull();

    const ctx = 'worker_test_ctx';
    action._buttons[ctx] = { settings: action._defaultSettings(), intervalId: null };
    action._cpu[ctx] = null;
    action._temp[ctx] = null;
    action._alerted[ctx] = { cpu: false, temp: false };

    action.handleClear(ctx);
    expect(action._worker).toBeNull();
  });

  test('preserves _worker when other contexts still exist', () => {
    const action = new StatusAction();

    ['ctx1', 'ctx2'].forEach((ctx) => {
      action._buttons[ctx] = { settings: action._defaultSettings(), intervalId: null };
      action._cpu[ctx] = null;
      action._temp[ctx] = null;
      action._alerted[ctx] = { cpu: false, temp: false };
    });

    action.handleClear('ctx1'); // ctx2 still registered
    expect(action._worker).not.toBeNull();
  });
});
