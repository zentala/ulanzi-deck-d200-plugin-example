# PRD & Implementation Spec: Ulanzi Demo Plugin – Approach A (Official Plugin SDK)

```
Document: SPEC-A-plugin-sdk.md
Status: READY FOR IMPLEMENTATION
Version: 1.0.0
Date: 2026-03-14
Target repo: ulanzi-demos/plugins/demo/
```

---

## 1. Goal and Scope

### Goal

Create a reference Ulanzi D200 demo plugin using the official SDK (`plugin-common-node`) that:

- Demonstrates key API capabilities (Canvas rendering, settings persistence, encoder, lifecycle events)
- Serves as a blueprint for subsequent plugins in the monorepo
- Is a fully functional plugin installed through UlanziStudio

### Scope

Three actions available in UlanziStudio as a single plugin `io.zentala.ulanzideck.demo`:

| Action | UUID | Description |
|---|---|---|
| ClockAction | `io.zentala.ulanzideck.demo.clock` | Digital clock updated every second |
| CounterAction | `io.zentala.ulanzideck.demo.counter` | Counter with step and color configuration |
| StatusAction | `io.zentala.ulanzideck.demo.status` | CPU monitor with threshold alert |

### Out of Scope

- Server-side backend (plugin runs locally, no external APIs)
- Rotary encoder support
- Animated GIFs (use canvas dynamic rendering instead)
- PL localization (EN only)

---

## 2. File Structure

```
ulanzi-demos/
└── plugins/
    └── demo/
        └── io.zentala.ulanzideck.demo.ulanziPlugin/
            ├── manifest.json
            ├── en.json
            ├── assets/
            │   ├── plugin-icon.png           # 72x72px
            │   ├── clock-action.png          # 72x72px
            │   ├── counter-action.png        # 72x72px
            │   └── status-action.png         # 72x72px
            ├── libs/
            │   ├── plugin-common-node/       # Git submodule
            │   └── plugin-common-html/       # Git submodule
            ├── plugin/
            │   ├── app.html                  # Entry point
            │   ├── app.js                    # Dispatcher (~80 lines)
            │   └── actions/
            │       ├── BaseAction.js         # Base class (~120 lines)
            │       ├── ClockAction.js        # Clock (~100 lines)
            │       ├── CounterAction.js      # Counter (~130 lines)
            │       └── StatusAction.js       # CPU monitor (~150 lines)
            └── property-inspector/
                ├── clock/inspector.html
                ├── counter/inspector.html
                └── status/inspector.html
```

---

## 3. manifest.json

```json
{
  "Name": "Ulanzi Demo",
  "Author": "ulanzi-demos",
  "Version": "1.0.0",
  "Description": "Reference demo plugin: clock, counter, CPU status",
  "UUID": "io.zentala.ulanzideck.demo",
  "CodeType": "JavaScript",
  "MinSoftwareVersion": "6.1",
  "CodePath": "plugin/app.html",
  "UsePrivateApi": true,
  "OS": [
    { "Platform": "windows", "MinimumVersion": "10" },
    { "Platform": "mac", "MinimumVersion": "10.11" }
  ],
  "Actions": [
    {
      "Name": "Clock",
      "UUID": "io.zentala.ulanzideck.demo.clock",
      "Tooltip": "Digital clock updated every second",
      "Icon": "assets/clock-action",
      "SupportedInMultiActions": false,
      "PropertyInspectorPath": "property-inspector/clock/inspector.html"
    },
    {
      "Name": "Counter",
      "UUID": "io.zentala.ulanzideck.demo.counter",
      "Tooltip": "Tap to increment/decrement. Hold to reset.",
      "Icon": "assets/counter-action",
      "SupportedInMultiActions": false,
      "PropertyInspectorPath": "property-inspector/counter/inspector.html"
    },
    {
      "Name": "CPU Status",
      "UUID": "io.zentala.ulanzideck.demo.status",
      "Tooltip": "CPU usage monitor with threshold alert",
      "Icon": "assets/status-action",
      "SupportedInMultiActions": false,
      "PropertyInspectorPath": "property-inspector/status/inspector.html"
    }
  ]
}
```

**Notes:**
- Plugin `UUID`: 4 segments (SDK convention)
- Action `UUID`: 5 segments
- `UsePrivateApi: true` required for `os.cpus()` in StatusAction
- `CodePath` points to HTML, not JS – SDK constraint (browser context)

---

## 4. en.json

```json
{
  "Clock": "Clock",
  "Counter": "Counter",
  "CPU Status": "CPU Status",
  "Background Color": "Background Color",
  "Text Color": "Text Color",
  "Step": "Step",
  "Direction": "Direction",
  "Increment": "Increment",
  "Decrement": "Decrement",
  "Positive Color": "Positive Color",
  "Negative Color": "Negative Color",
  "Alert Threshold (%)": "Alert Threshold (%)",
  "Update Interval (s)": "Update Interval (s)",
  "Show Seconds": "Show Seconds",
  "Show Date": "Show Date",
  "Show Core Count": "Show Core Count",
  "Save": "Save",
  "Reset": "Reset"
}
```

---

## 5. Action 1: ClockAction

### Behavior

- `onAdd`: registers context, starts `setInterval(1000)` per context
- Every second: generates 72x72px canvas with current time, calls `setBaseDataIcon`
- `onSetActive({ active: false })`: stops interval; `active: true` – resumes
- `onRun`: `$UD.toast('Clock running')` (no tap action, pedagogical)
- `onClear`: `clearInterval`, removes from map

### Canvas 72x72 Rendering

```
Layers:
1. Background: gradient #0d1117 → #1a2332
2. Frame: #30363d, 1px
3. Time "14:32:07": bold 22px monospace, white, y=32, centered
4. Date "SUN 14": 12px sans-serif, #8b949e, y=54, centered
```

### Property Inspector

| Field | Type | Default | Key |
|---|---|---|---|
| Background Color | `<input type="color">` | `#0d1117` | `bgColor` |
| Text Color | `<input type="color">` | `#ffffff` | `textColor` |
| Show Seconds | `<input type="checkbox">` | `true` | `showSeconds` |
| Show Date | `<input type="checkbox">` | `true` | `showDate` |

Flow: change → `sendToPlugin(settings)` → `onParamFromApp` → `updateSettings` → re-render

### Events

| Event | Reaction |
|---|---|
| `onAdd` | Register, `getSettings`, start interval |
| `onSetActive` | Stop/start interval |
| `onClear` | clearInterval, remove from map |
| `onParamFromApp` | Update settings, `setSettings`, re-render |
| `onDidReceiveSettings` | Load saved settings |
| `onRun` | toast |

---

## 6. Action 2: CounterAction

### Behavior

- Counter per context, initial value: `0`
- `onRun` (tap): change value by `direction * step`
- `onKeyDown` + hold > 600ms → reset to 0 + `toast('Counter reset')`
- `onDialRotate`: right = `+step`, left = `-step`
- Value persisted via `setSettings`

### Canvas 72x72 Rendering

```
Layers:
1. Background: bgColor (default #1a1a2e)
2. Label "COUNTER": 10px, #8b949e, top
3. Counter value: bold 28px monospace
   - >0: incrementColor (#39d353)
   - <0: decrementColor (#f85149)
   - =0: #8b949e
4. "step: ±N": 10px, #8b949e, bottom
```

### Property Inspector

| Field | Type | Default | Key |
|---|---|---|---|
| Step | `<input type="number" min="1" max="100">` | `1` | `step` |
| Direction | `<select>` (Increment/Decrement) | `increment` | `direction` |
| Background Color | `<input type="color">` | `#1a1a2e` | `bgColor` |
| Positive Color | `<input type="color">` | `#39d353` | `incrementColor` |
| Negative Color | `<input type="color">` | `#f85149` | `decrementColor` |
| Reset Button | `<button>` | — | sends `{ action: 'reset' }` |

### Events

| Event | Reaction |
|---|---|
| `onAdd` | Register, load `value` from `getSettings`, render |
| `onRun` | Change value (if `!wasLongPress`), save, render |
| `onKeyDown` | Save `keyDownTimestamp` |
| `onKeyUp` | If elapsed > 600ms → reset, toast, set `wasLongPress=true` |
| `onDialRotate` | `±step`, render |
| `onClear` | Remove from map |
| `onParamFromApp` | Update settings; if `action==='reset'` → value=0 |
| `onDidReceiveSettings` | Restore state |

---

## 7. Action 3: StatusAction (CPU Monitor)

### Behavior

- Measures CPU usage every `intervalSec` (default `2s`)
- Algorithm: two samples of `os.cpus()` with time delta → `(delta_busy / delta_total) * 100`
- Dynamic background color by alert threshold:
  - `< alertThreshold`: green `#39d353`
  - `>= alertThreshold && < alertThreshold+20`: yellow `#ffaa00`
  - `>= alertThreshold+20`: red `#f85149`
- When `>= alertThreshold`: `showAlert(context)` + one toast
- `onRun`: force-refresh CPU

### Canvas 72x72 Rendering

```
Layers:
1. Background: dynamic color (green/yellow/red)
2. Label "CPU": 10px, white, top-left
3. Value "%": bold 28px monospace, white, center
4. Progress bar: 60x6px, y=50
5. "N cores": 9px, rgba(255,255,255,0.6), bottom-right
```

### Property Inspector

| Field | Type | Default | Key |
|---|---|---|---|
| Alert Threshold (%) | `<input type="range" min="50" max="95">` | `80` | `alertThreshold` |
| Update Interval (s) | `<select>` (1s/2s/5s) | `2` | `intervalSec` |
| Show Core Count | `<input type="checkbox">` | `true` | `showCores` |

Slider shows live value (`<span id="thresholdDisplay">`). Save via "Save" button.

### Events

| Event | Reaction |
|---|---|
| `onAdd` | Register, load settings, initialize first CPU sample, start interval |
| `onSetActive` | Stop/start interval |
| `onClear` | clearInterval, remove from map |
| `onRun` | Force-refresh CPU, render |
| `onParamFromApp` | Update thresholds, restart interval |
| `onDidReceiveSettings` | Restore settings |

---

## 8. BaseAction.js – Interface

```javascript
/**
 * @file BaseAction.js
 * @description Abstract base for all demo plugin actions.
 * Manages button lifecycle, settings persistence, and canvas utilities.
 */
class BaseAction {
  constructor(api, actionUUID) { ... }

  // Lifecycle – called by app.js dispatcher
  handleAdd(data) { ... }           // registers context, getSettings, calls onInit
  handleClear(data) { ... }         // clearInterval, removes from map
  handleSetActive(data) { ... }     // stop/start interval
  handleRun(data) { ... }           // calls onPress
  handleKeyDown(data) { ... }
  handleKeyUp(data) { ... }
  handleParams(data) { ... }        // calls onSettings
  handleDialRotate(data) { ... }
  handleReceiveSettings(data) { ... }

  // Canvas utilities
  createCanvas(width = 72, height = 72) { ... }   // → { canvas, ctx }
  canvasToBase64(canvas) { ... }                   // → base64 string (without prefix)
  renderText(ctx, text, options) { ... }           // centered text
  renderProgressBar(ctx, value, max, options) { ... }

  // Abstract – must be overridden
  onInit(context) { throw new Error('Not implemented'); }
  onPress(context) { throw new Error('Not implemented'); }
  onSettings(context, params) { throw new Error('Not implemented'); }
  render(context) { throw new Error('Not implemented'); }
}
```

---

## 9. app.js – Dispatcher

```javascript
/**
 * @file app.js
 * @description Plugin entry point. Connects to UlanziStudio, routes SDK events
 * to action handlers based on action UUID in event payload.
 */
import UlanziApi from '../libs/plugin-common-node/index.js';
import ClockAction from './actions/ClockAction.js';
import CounterAction from './actions/CounterAction.js';
import StatusAction from './actions/StatusAction.js';

const PLUGIN_UUID = 'io.zentala.ulanzideck.demo';
const $UD = new UlanziApi();

// context → action instance (for onClear which has no 'action' field)
const contextRegistry = new Map();

const actions = {
  'io.zentala.ulanzideck.demo.clock':   new ClockAction($UD, 'io.zentala.ulanzideck.demo.clock'),
  'io.zentala.ulanzideck.demo.counter': new CounterAction($UD, 'io.zentala.ulanzideck.demo.counter'),
  'io.zentala.ulanzideck.demo.status':  new StatusAction($UD, 'io.zentala.ulanzideck.demo.status'),
};

function dispatch(data, handlerName) {
  const action = actions[data?.action];
  if (action) {
    if (handlerName === 'handleAdd') contextRegistry.set(data.context, action);
    action[handlerName](data);
  }
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => $UD.toast('Demo Plugin loaded'));
$UD.onAdd(data     => dispatch(data, 'handleAdd'));
$UD.onRun(data     => dispatch(data, 'handleRun'));
$UD.onKeyDown(data => dispatch(data, 'handleKeyDown'));
$UD.onKeyUp(data   => dispatch(data, 'handleKeyUp'));
$UD.onSetActive(data       => dispatch(data, 'handleSetActive'));
$UD.onClear(ctxArray       => ctxArray.forEach(ctx => {
  const action = contextRegistry.get(ctx);
  if (action) { action.handleClear([ctx]); contextRegistry.delete(ctx); }
}));
$UD.onParamFromApp(data    => dispatch(data, 'handleParams'));
$UD.onDialRotate(data      => dispatch(data, 'handleDialRotate'));
$UD.onDidReceiveSettings(d => dispatch(d, 'handleReceiveSettings'));
```

---

## 10. app.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <script src="../libs/plugin-common-node/index.js"></script>
  <script src="app.js" type="module"></script>
</body>
</html>
```

---

## 11. Data Flow Diagram

```
D200 DEVICE
     │ USB
     ▼
┌─────────────────────────────────┐
│         UlanziStudio (PC)       │
│  WebSocket Server (localhost)   │
└────────────────┬────────────────┘
                 │ WebSocket
                 ▼
┌────────────────────────────────────────────────────┐
│              app.html (Browser/Electron context)   │
│                                                    │
│  UlanziApi ($UD) – WebSocket client                │
│         │ events                                   │
│         ▼                                          │
│  app.js dispatcher (routes by event.action UUID)   │
│         │                                          │
│   ┌─────┼──────┬────────────┐                      │
│   ▼     ▼      ▼            ▼                      │
│  Clock Counter Status   BaseAction                 │
│  (interval) (Map)  (os.cpus poll)                  │
│         │                                          │
│         │ Canvas API → base64                      │
│         ▼                                          │
│  $UD.setBaseDataIcon(ctx, b64, text)               │
│         │ WebSocket                                │
└─────────┼──────────────────────────────────────────┘
          ▼
   UlanziStudio → USB → D200 LCD

PROPERTY INSPECTOR (iframe in UlanziStudio):
  inspector.html
  $UD.sendToPlugin(settings)  ──→  onParamFromApp → handleParams
  $UD.onDidReceiveSettings    ←──  sendToPropertyInspector(settings, ctx)
```

---

## 12. Key Technical Decisions

**D1: BaseAction instead of monolithic app.js**
250-line/file limit enforces separation. BaseAction eliminates lifecycle duplication.
`app.js` = clean dispatcher < 80 lines.

**D2: CPU measurement via two os.cpus() samples**
Single sample = cumulative values from boot. Two samples with delta = current %.
`process.cpuUsage()` rejected – measures only current process.

**D3: UsePrivateApi: true for os.cpus()**
Canvas runs in browser context, but `os` is Node.js API.
`UsePrivateApi` enables access via Electron/NW.js bridge.
Check whether require `const os = require('os')` or import – depends on plugin-common-node.

**D4: Separate setInterval per context in ClockAction**
User may have same button on multiple screens. Map<context, interval> isolates each.

**D5: Save button in PI, not auto-save**
Auto-save on every change = excessive setBaseDataIcon calls. Dedicated Save button.

**D6: Hold-to-reset via keyDown/keyUp timestamp**
No native long-press in SDK. elapsed > 600ms = reset. Flag `wasLongPress` blocks onRun.

**D7: Canvas 72x72px**
Derives from analogclock demo structure in official SDK repo.

---

## 13. Dependencies

| Dependency | Source | Method |
|---|---|---|
| `plugin-common-node` | github.com/UlanziTechnology/plugin-common-node | Git submodule |
| `plugin-common-html` | github.com/UlanziTechnology/plugin-common-html | Git submodule |

```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-node libs/plugin-common-node
git submodule add https://github.com/UlanziTechnology/plugin-common-html libs/plugin-common-html
```

No external npm packages. Canvas API from browser. `os` from Node.js via UsePrivateApi.

---

## 14. How to Run

### Plugin Folder Location

| OS | Path |
|---|---|
| Windows | `%APPDATA%\UlanziStudio\plugins\` |
| macOS | `~/Library/Application Support/UlanziStudio/plugins/` |

### Deployment (Symlink – convenient for dev)

```powershell
# Windows (PowerShell as Administrator)
New-Item -ItemType SymbolicLink `
  -Path "$env:APPDATA\UlanziStudio\plugins\io.zentala.ulanzideck.demo.ulanziPlugin" `
  -Target (Resolve-Path ".\io.zentala.ulanzideck.demo.ulanziPlugin")
```

```bash
# macOS
ln -s $(pwd)/io.zentala.ulanzideck.demo.ulanziPlugin \
  ~/Library/Application\ Support/UlanziStudio/plugins/io.zentala.ulanzideck.demo.ulanziPlugin
```

### Steps

1. Close UlanziStudio
2. Create symlink or copy folder
3. Launch UlanziStudio
4. Plugin visible in "My Plugins"
5. Drag action onto D200 button
6. Toast "Demo Plugin loaded" = success

### Debugging

Logs: `%APPDATA%\UlanziStudio\logs\` (Windows) or `~/Library/Application Support/UlanziStudio/logs/` (macOS)

---

## 15. Implementation Order

```
1. manifest.json + en.json            → plugin visible in UI
2. plugin/app.html                    → entry point
3. libs/ (submodules)                 → SDK available
4. plugin/app.js (stub: connect + toast onConnected)
                                      → VERIFY: toast on load
5. plugin/actions/BaseAction.js       → shared lifecycle + canvas
6. plugin/actions/ClockAction.js + dispatch in app.js
                                      → VERIFY: clock on button
7. property-inspector/clock/inspector.html
                                      → VERIFY: color change
8. CounterAction.js + counter/inspector.html
                                      → VERIFY: counter + hold reset
9. StatusAction.js + status/inspector.html
                                      → VERIFY: CPU + alert color
10. assets/ (PNG 72x72)               → final icons
```

---

## 16. Files to Create

| File | Priority | Est. Lines |
|---|---|---|
| `manifest.json` | P0 | 30 |
| `en.json` | P0 | 20 |
| `plugin/app.html` | P0 | 10 |
| `plugin/app.js` | P0 | ~80 |
| `plugin/actions/BaseAction.js` | P0 | ~120 |
| `plugin/actions/ClockAction.js` | P1 | ~100 |
| `plugin/actions/CounterAction.js` | P1 | ~130 |
| `plugin/actions/StatusAction.js` | P1 | ~150 |
| `property-inspector/clock/inspector.html` | P2 | ~80 |
| `property-inspector/counter/inspector.html` | P2 | ~100 |
| `property-inspector/status/inspector.html` | P2 | ~90 |
| `assets/*.png` (4 files) | P3 | binary |
