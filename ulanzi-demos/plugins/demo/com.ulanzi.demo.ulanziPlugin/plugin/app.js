/**
 * @file app.js
 * @description Plugin entry point. Connects to UlanziStudio and routes events
 * to action handlers by UUID. Uses global $UD (UlanziStreamDeck instance).
 */

const PLUGIN_UUID = 'com.ulanzi.ulanzideck.demo';

/** @type {Object.<string, BaseAction>} UUID → action instance */
const ACTIONS = {
  'com.ulanzi.ulanzideck.demo.clock': new ClockAction(),
  'com.ulanzi.ulanzideck.demo.counter': new CounterAction(),
  'com.ulanzi.ulanzideck.demo.status': new StatusAction(),
  'com.ulanzi.ulanzideck.demo.calendar': new CalendarAction(),
  'com.ulanzi.ulanzideck.demo.pomodoro': new PomodoroAction(),
};

/** @type {Object.<string, BaseAction>} context → action (for event routing) */
const CONTEXT_MAP = {};

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  $UD.toast('Demo Plugin loaded');
});

$UD.onAdd((jsn) => {
  const action = ACTIONS[jsn.uuid];
  if (!action) return;
  CONTEXT_MAP[jsn.context] = action;
  action.handleAdd(jsn);
});

$UD.onRun((jsn) => {
  const a = CONTEXT_MAP[jsn.context];
  if (a) a.handleRun(jsn);
});
$UD.onSetActive((jsn) => {
  const a = CONTEXT_MAP[jsn.context];
  if (a) a.handleSetActive(jsn);
});
$UD.onParamFromApp((jsn) => {
  const a = CONTEXT_MAP[jsn.context];
  if (a) a.handleParams(jsn);
});
$UD.onParamFromPlugin((jsn) => {
  const a = CONTEXT_MAP[jsn.context];
  if (a) a.handleParams(jsn);
});

$UD.onClear((jsn) => {
  if (!jsn.param) return;
  for (const item of jsn.param) {
    const a = CONTEXT_MAP[item.context];
    if (a) {
      a.handleClear(item.context);
      delete CONTEXT_MAP[item.context];
    }
  }
});
