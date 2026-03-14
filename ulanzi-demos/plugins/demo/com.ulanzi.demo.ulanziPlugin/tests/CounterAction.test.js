/**
 * @file CounterAction.test.js
 * @description Tests for CounterAction render and press behaviour.
 */
const { createSandbox, patchCreateCanvas, makeJsn } = require('./helpers');

const { sandbox, classes } = createSandbox(['CounterAction.js'], ['BaseAction', 'CounterAction']);
const { BaseAction, CounterAction } = classes;

const CTX = 'counter__ctx__1';

function makeAction(settings = {}) {
  const action = new CounterAction();
  action.handleAdd(makeJsn(CTX, 'com.ulanzi.ulanzideck.demo.counter'));
  Object.assign(action._buttons[CTX].settings, settings);
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

describe('CounterAction – render', () => {
  test('renders 0 at init', () => {
    const action = makeAction();
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('0');
  });

  test('renders COUNTER label', () => {
    const action = makeAction();
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('COUNTER');
  });

  test('renders step hint with + sign for increment direction', () => {
    const action = makeAction({ step: 1, direction: 'increment' });
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('step: +1');
  });

  test('renders step hint with - sign for decrement direction', () => {
    const action = makeAction({ step: 2, direction: 'decrement' });
    action.render(CTX);
    expect(patch.getLastCanvas().texts()).toContain('step: -2');
  });
});

describe('CounterAction – press', () => {
  test('onPress increments value and re-renders', () => {
    const action = makeAction({ step: 1, direction: 'increment', value: 0 });
    action.handleRun(makeJsn(CTX, ''));
    expect(action._buttons[CTX].settings.value).toBe(1);
    expect(patch.getLastCanvas().texts()).toContain('1');
  });

  test('onPress with direction=decrement decrements value', () => {
    const action = makeAction({ step: 3, direction: 'decrement', value: 10 });
    action.handleRun(makeJsn(CTX, ''));
    expect(action._buttons[CTX].settings.value).toBe(7);
  });

  test('onPress calls sendParamFromPlugin with new value', () => {
    const action = makeAction({ step: 1, direction: 'increment', value: 4 });
    action.handleRun(makeJsn(CTX, ''));
    expect(sandbox.$UD.sendParamFromPlugin).toHaveBeenCalledWith({ value: 5 }, CTX);
  });
});
