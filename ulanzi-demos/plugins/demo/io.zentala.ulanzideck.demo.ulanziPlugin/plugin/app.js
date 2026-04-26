/**
 * @file app.js
 * @description Plugin entry point. Connects to UlanziStudio and routes events
 * to action handlers by UUID. Uses global $UD (UlanziStreamDeck instance).
 */

/** @type {Object.<string, BaseAction>} UUID → action instance */
const ACTIONS = {
  [UUIDS.CLOCK]: new ClockAction(),
  [UUIDS.COUNTER]: new CounterAction(),
  [UUIDS.STATUS]: new StatusAction(),
  [UUIDS.CALENDAR]: new CalendarAction(),
  [UUIDS.POMODORO]: new PomodoroAction(),
  [UUIDS.WEATHER]: new WeatherAction(),
};

/** @type {Object.<string, BaseAction>} context → action (for event routing) */
const CONTEXT_MAP = {};

$UD.connect(UUIDS.PLUGIN);

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
