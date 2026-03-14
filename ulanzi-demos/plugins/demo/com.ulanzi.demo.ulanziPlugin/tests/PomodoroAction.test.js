/**
 * @file PomodoroAction.test.js
 * @description Tests for PomodoroAction state machine and render.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');

const { sandbox, classes } = createSandbox(['PomodoroAction.js'], ['BaseAction', 'PomodoroAction']);
const { BaseAction, PomodoroAction } = classes;

const CTX = 'pomodoro__ctx__1';

let action;

function makeAction(settings = {}) {
  action = new PomodoroAction();
  action.handleAdd(makeJsn(CTX, 'com.ulanzi.ulanzideck.demo.pomodoro'));
  Object.assign(action._buttons[CTX].settings, settings);
  return action;
}

let patch;

beforeEach(() => {
  jest.useFakeTimers();
  // Sync sandbox timer refs so the vm context picks up Jest's fake timers
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

describe('PomodoroAction – idle state', () => {
  test('renders POMODORO label in idle state', () => {
    const action = makeAction();
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('POMODORO');
  });

  test('renders TAP TO START hint in idle state', () => {
    const action = makeAction();
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('TAP TO START');
  });

  test('state is idle after init', () => {
    const action = makeAction();
    expect(action._state[CTX].state).toBe('idle');
  });
});

describe('PomodoroAction – work state', () => {
  test('onPress from idle transitions to work state', () => {
    const action = makeAction({ workMin: 1 });
    action.handleRun(makeJsn(CTX, ''));
    expect(action._state[CTX].state).toBe('work');
  });

  test('onPress from idle renders countdown', () => {
    const action = makeAction({ workMin: 1 });
    action.handleRun(makeJsn(CTX, ''));
    const texts = patch.getLastCanvas().texts();
    // Should contain mm:ss format
    expect(texts.some((t) => /^\d{2}:\d{2}$/.test(t))).toBe(true);
  });

  test('renders WORK label during work state', () => {
    const action = makeAction({ workMin: 1 });
    action.handleRun(makeJsn(CTX, ''));
    expect(patch.getLastCanvas().texts()).toContain('WORK');
  });

  test('_tick decrements remaining and re-renders', () => {
    const action = makeAction({ workMin: 1 });
    action.handleRun(makeJsn(CTX, ''));
    const before = action._state[CTX].remaining;
    action._tick(CTX);
    expect(action._state[CTX].remaining).toBe(before - 1);
  });

  test('onPress during work pauses the timer', () => {
    const action = makeAction({ workMin: 25 });
    action.handleRun(makeJsn(CTX, '')); // start
    action.handleRun(makeJsn(CTX, '')); // pause
    expect(action._state[CTX].paused).toBe(true);
  });

  test('second onPress during work resumes the timer', () => {
    const action = makeAction({ workMin: 25 });
    action.handleRun(makeJsn(CTX, '')); // start
    action.handleRun(makeJsn(CTX, '')); // pause
    action.handleRun(makeJsn(CTX, '')); // resume
    expect(action._state[CTX].paused).toBe(false);
  });
});

describe('PomodoroAction – work → break transition', () => {
  test('work reaching 0 shows toast and transitions to break', () => {
    const action = makeAction({ workMin: 1, breakMin: 5 });
    action.handleRun(makeJsn(CTX, '')); // start work
    // Drive remaining to 1 then tick to 0
    action._state[CTX].remaining = 1;
    action._tick(CTX);
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('Work done'));
    expect(action._state[CTX].state).toBe('break');
  });
});

describe('PomodoroAction – break → idle transition', () => {
  test('break reaching 0 shows toast and transitions to idle', () => {
    const action = makeAction({ workMin: 1, breakMin: 1 });
    action.handleRun(makeJsn(CTX, '')); // start work
    action._state[CTX].remaining = 1;
    action._tick(CTX); // → break
    action._state[CTX].remaining = 1;
    action._tick(CTX); // → idle
    expect(sandbox.$UD.toast).toHaveBeenCalledWith(expect.stringContaining('Break over'));
    expect(action._state[CTX].state).toBe('idle');
  });
});
