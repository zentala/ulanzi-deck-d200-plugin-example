---
name: ulanzi-button
description: Guide for implementing Ulanzi Studio plugin button actions using Method A (browser JS + canvas). Use when asked to add/modify a plugin action for UlanziStudio/UlanziDeck.
user-invocable: true
---

# Ulanzi Studio Plugin Button — Method A (Browser JS + Canvas)

## Overview

Method A uses plain browser JavaScript with no module system. All files are loaded as `<script>` tags in `plugin/app.html`. The global `$UD` (UlanziStreamDeck instance) is available in all scripts after the SDK is loaded.

## File Structure

```
<reverse-dns>.<plugin-name>.ulanziPlugin/
├── manifest.json                         # Plugin + action declarations
├── plugin/
│   ├── app.html                          # Entry point; loads all scripts via <script> tags
│   ├── app.js                            # Routes $UD events → action instances
│   ├── uuids.js                          # Shared UUID constants (PLUGIN + per-action)
│   ├── actions/
│   │   ├── BaseAction.js                 # Abstract base class
│   │   └── XxxAction.js                  # One file per action
│   └── libs/js/
│       └── ulanzideckApi.js              # SDK — defines $UD global
├── assets/icons/                         # PNG icon files referenced by manifest
├── property-inspector/                   # HTML inspector UIs per action
└── tests/                                # Jest tests (vm sandbox, no browser needed)
```

### `plugin/app.html` Script Loading Order

```html
<script src="libs/js/constants.js"></script>
<script src="libs/js/eventEmitter.js"></script>
<script src="libs/js/utils.js"></script>
<script src="libs/js/ulanzideckApi.js"></script>  <!-- defines $UD -->
<script src="actions/BaseAction.js"></script>
<script src="actions/ClockAction.js"></script>
<!-- ...other actions... -->
<script src="app.js"></script>  <!-- must be last -->
```

## BaseAction API

All actions extend `BaseAction`. Override only the methods you need.

### Lifecycle hooks (called by `app.js` dispatcher)

| Method | When called | Override for |
|--------|-------------|--------------|
| `handleAdd(jsn)` | Button added to canvas | Do not override; calls `onInit` |
| `handleClear(context)` | Button removed | Calls `_stopInterval`, deletes state |
| `handleSetActive(jsn)` | Canvas visibility change | Calls `onSetActive` |
| `handleRun(jsn)` | Button pressed | Calls `onPress` |
| `handleParams(jsn)` | Settings received | Calls `onSettings` |

### Abstract methods to override

```javascript
_defaultSettings()          // Return default settings object
onInit(context)             // Called after handleAdd; start interval here
onPress(context)            // Button press handler
onSetActive(context, active) // Start/stop interval on visibility change
onSettings(context, params) // Settings updated; re-render if needed
render(context)             // Draw canvas and call setBaseDataIcon
```

### Canvas utilities (from BaseAction)

```javascript
// Create a canvas element
const { canvas, ctx } = this.createCanvas(196, 196);

// Render centered text
this.renderText(ctx, 'Hello', x, y, {
  font: 'bold 48px monospace',
  color: '#ffffff',
  align: 'center',   // optional, default 'center'
});

// Render a progress bar
this.renderProgressBar(ctx, value, max, x, y, width, height, '#4a9eff');

// Convert canvas to base64 (no data: prefix)
const base64 = this.canvasToBase64(canvas);

// Start a recurring interval (auto-stops previous one)
this._startInterval(context, 1000, () => this.render(context));

// Stop the interval
this._stopInterval(context);
```

### Canvas render pattern

```javascript
render(context) {
  const state = this._buttons[context];
  if (!state) return;

  const SIZE = 196;
  const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

  // Background
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Draw content
  this.renderText(ctx, 'Hello', SIZE / 2, SIZE / 2, {
    font: 'bold 48px sans-serif',
    color: '#ffffff',
  });

  // Push to button display
  $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
}
```

## $UD API

The global `$UD` is a `UlanziStreamDeck` instance created by the SDK.

### Connection

```javascript
$UD.connect(PLUGIN_UUID);       // Call once in app.js with 4-segment UUID
$UD.onConnected(() => { ... }); // Fired when WebSocket opens
```

### Event handlers (register in app.js)

```javascript
$UD.onAdd((jsn) => { ... });            // jsn.uuid, jsn.context, jsn.param
$UD.onRun((jsn) => { ... });            // Button pressed; jsn.context
$UD.onSetActive((jsn) => { ... });      // Visibility change; jsn.context, jsn.active
$UD.onParamFromApp((jsn) => { ... });   // Settings from inspector
$UD.onParamFromPlugin((jsn) => { ... }); // Settings from plugin
$UD.onClear((jsn) => { ... });          // jsn.param is an array of { context }
```

### Actions (call from within action handlers)

```javascript
$UD.setBaseDataIcon(context, base64, title); // Set custom canvas icon
$UD.openUrl('https://example.com');          // Open URL in browser
$UD.toast('Message text');                   // Show toast notification
$UD.sendParamFromPlugin(param, context);     // Send params to inspector
```

## `manifest.json` Fields

### Plugin-level

```json
{
  "Name": "My Plugin",
  "UUID": "com.vendor.category.plugin",   // MUST be exactly 4 dot-segments
  "Icon": "assets/icons/plugin-icon.png",
  "CategoryIcon": "assets/icons/categoryIcon.png",
  "Author": "Author Name",
  "Version": "1.0.0",
  "Description": "What it does",
  "Type": "JavaScript",
  "CodePath": "plugin/app.html",
  "PrivateAPI": true,
  "SupportedInMultiActions": false,
  "Software": { "MinimumVersion": "6.1" },
  "OS": [
    { "Platform": "windows", "MinimumVersion": "10" },
    { "Platform": "mac", "MinimumVersion": "10.11" }
  ]
}
```

### Per-action

```json
{
  "Name": "Clock",
  "UUID": "com.vendor.category.plugin.clock",  // 5 segments
  "Tooltip": "Short description",
  "Icon": "assets/icons/clock-icon.png",
  "PropertyInspectorPath": "property-inspector/clock/inspector.html",
  "SupportedInMultiActions": false,
  "state": 0,
  "States": [
    { "Name": "clock", "Image": "assets/icons/clock-icon.png" }
  ]
}
```

### States array rules

- Each State object should only have `Name` and `Image`
- **Do NOT add `TitleAlignment` or `FontSize`** — these interfere with canvas rendering
- `"state": 0` is required at the action level (not inside States)

## `app.js` Routing Pattern

```javascript
const PLUGIN_UUID = 'com.vendor.category.plugin'; // 4 segments

const ACTIONS = {
  'com.vendor.category.plugin.clock':   new ClockAction(),
  'com.vendor.category.plugin.counter': new CounterAction(),
};

const CONTEXT_MAP = {}; // context string → action instance

$UD.connect(PLUGIN_UUID);

$UD.onAdd((jsn) => {
  const action = ACTIONS[jsn.uuid];  // route by UUID on add
  if (!action) return;
  CONTEXT_MAP[jsn.context] = action;
  action.handleAdd(jsn);
});

$UD.onRun((jsn) => {
  const a = CONTEXT_MAP[jsn.context]; // route by context thereafter
  if (a) a.handleRun(jsn);
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
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `TitleAlignment` / `FontSize` in States | Remove them; they conflict with canvas rendering |
| UUID has fewer or more than 4 segments at plugin level | Must be exactly 4 dot-segments (e.g., `com.vendor.cat.name`) |
| UUID has fewer than 5 segments at action level | Must be 5 segments (plugin UUID + action suffix) |
| Missing `"state": 0` at action level | Add it at action level, not inside States |
| Canvas not updating | Ensure `$UD.setBaseDataIcon(context, base64, '')` is called at end of `render()` |
| `this._buttons[context]` is undefined in render | Always guard: `if (!state) return;` |
| Script load order wrong | Load SDK before BaseAction, BaseAction before action classes, app.js last |
