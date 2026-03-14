/**
 * @file app.js
 * @description Main dispatcher for the Ulanzi Demo plugin.
 * Connects to the UlanziStudio WebSocket bridge, instantiates all actions,
 * and routes every SDK lifecycle event to the matching action handler.
 */

import ClockAction from './actions/ClockAction.js';
import CounterAction from './actions/CounterAction.js';
import StatusAction from './actions/StatusAction.js';

const PLUGIN_UUID = 'com.ulanzi.demo';

/** @type {UlanziApi} – injected by plugin-common-node/index.js as a global */
const api = window.$UD;

/** Map of action UUID → action instance */
const actionMap = {
  'com.ulanzi.demo.clock':   new ClockAction(api, 'com.ulanzi.demo.clock'),
  'com.ulanzi.demo.counter': new CounterAction(api, 'com.ulanzi.demo.counter'),
  'com.ulanzi.demo.status':  new StatusAction(api, 'com.ulanzi.demo.status'),
};

/** Map of button context → action instance (populated on onAdd, cleared on onClear) */
const contextRegistry = new Map();

/**
 * Returns the action responsible for a given button context.
 * @param {string} context
 * @returns {import('./actions/BaseAction.js').BaseAction | undefined}
 */
function actionForContext(context) {
  return contextRegistry.get(context);
}

// ---------------------------------------------------------------------------
// SDK event wiring
// ---------------------------------------------------------------------------

api.onConnected(() => {
  api.toast('Demo Plugin loaded');
});

api.onAdd((actionUUID, context, settings) => {
  const action = actionMap[actionUUID];
  if (!action) return;
  contextRegistry.set(context, action);
  action.handleAdd(context, settings);
});

api.onClear((actionUUID, context) => {
  const action = actionForContext(context);
  if (action) action.handleClear(context);
  contextRegistry.delete(context);
});

api.onRun((actionUUID, context, settings) => {
  const action = actionForContext(context);
  if (action) action.handleRun(context, settings);
});

api.onKeyDown((actionUUID, context, settings) => {
  const action = actionForContext(context);
  if (action) action.handleKeyDown(context, settings);
});

api.onKeyUp((actionUUID, context, settings) => {
  const action = actionForContext(context);
  if (action) action.handleKeyUp(context, settings);
});

api.onSetActive((actionUUID, context, settings) => {
  const action = actionForContext(context);
  if (action) action.handleSetActive(context, settings);
});

api.onParamFromApp((actionUUID, context, payload) => {
  const action = actionForContext(context);
  if (action) action.handleParamFromApp(context, payload);
});

api.onDialRotate((actionUUID, context, settings, ticks) => {
  const action = actionForContext(context);
  if (action) action.handleDialRotate(context, settings, ticks);
});

api.onDidReceiveSettings((actionUUID, context, settings) => {
  const action = actionForContext(context);
  if (action) action.handleDidReceiveSettings(context, settings);
});

// Connect to the UlanziStudio bridge
api.connect(PLUGIN_UUID);
