/**
 * @file app.js
 * @description Plugin entry point. Connects to UlanziStudio and routes events
 * to action handlers by UUID. Uses global $UD (UlanziStreamDeck instance).
 */

const PLUGIN_UUID = 'com.ulanzi.demo';

/** @type {Object.<string, BaseAction>} UUID → action instance */
const ACTIONS = {
  'com.ulanzi.demo.clock':   new ClockAction(),
  'com.ulanzi.demo.counter': new CounterAction(),
  'com.ulanzi.demo.status':  new StatusAction(),
};

/** @type {Object.<string, BaseAction>} context → action (for onClear routing) */
const CONTEXT_MAP = {};

/** @param {object} jsn @param {string} method */
function dispatch(jsn, method) {
  const action = ACTIONS[jsn.action];
  if (action) action[method](jsn);
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  $UD.toast('Demo Plugin loaded');
});

$UD.onAdd(jsn => {
  CONTEXT_MAP[jsn.context] = ACTIONS[jsn.action];
  dispatch(jsn, 'handleAdd');
});

$UD.onRun(jsn         => dispatch(jsn, 'handleRun'));
$UD.onSetActive(jsn   => dispatch(jsn, 'handleSetActive'));
$UD.onParamFromApp(jsn => dispatch(jsn, 'handleParams'));
$UD.onParamFromPlugin(jsn => dispatch(jsn, 'handleParams'));

$UD.onClear(jsn => {
  if (!jsn.param) return;
  for (const item of jsn.param) {
    const context = item.context;
    const action = CONTEXT_MAP[context];
    if (action) {
      action.handleClear(context);
      delete CONTEXT_MAP[context];
    }
  }
});
