# Ulanzi D200 — Complete Report: Custom Plugins and Device Control

> Sources surveyed: official Ulanzi SDK, plugin-common-node, Home Assistant community, Hackaday, redphx/strmdck, rlaneth/badustudio
> Date: 2026-03-14

---

## TL;DR — Two Paths

| Approach | Requires the official app? | Language | Difficulty |
|---|---|---|---|
| **A) Official Plugin SDK** | YES (UlanziStudio must be running) | Node.js / JS | Medium |
| **B) Direct USB/ADB access** | NO | Python / C++ | High |

---

## Architecture — How It Works

### Approach A: Official Plugin SDK

```
[Your Node.js / JS plugin]
        ↕ WebSocket (localhost, random port)
[UlanziStudio app (PC)]
        ↕ USB
[Ulanzi D200 device]
```

UlanziStudio is the **required intermediary** — it owns the USB driver.
Your plugin is a separate JS process that talks to the app over a local WebSocket.

### Approach B: Direct access (no app)

```
[Your Python script / C++ binary]
        ↕ USB (HID, unencrypted protocol)
[Ulanzi D200 device]
```

Or via ADB (the device ships with an open root shell):

```
[Your script] → adb push → [D200: Linux Buildroot on Rockchip RK3308HS]
                              → /dev/fb0 (framebuffer)
                              → adb shell ./your_program
```

---

## Hardware — What's Inside the D200

- **CPU**: Quad-core Rockchip RK3308HS
- **OS**: Linux 5.10.160 (Android-derived kernel, Buildroot userspace)
- **ADB**: **Open root shell** — Ulanzi left it open from the factory
- **USB protocol**: Unencrypted, decodable from a Wireshark capture
- **Framebuffer**: `/dev/fb0` — direct access to the display

---

## APPROACH A — Official Plugin SDK (Node.js)

### 1. Plugin structure

Each plugin is a folder with the `.ulanziPlugin` extension:

```
com.yourcompany.yourplugin.ulanziPlugin/
├── manifest.json          ← plugin descriptor
├── en.json                ← EN translations
├── pl.json                ← PL translations (optional)
├── assets/                ← icons, images
├── libs/                  ← libraries (plugin-common-node)
├── plugin/
│   ├── app.html           ← entry point (loads app.js)
│   └── app.js             ← main plugin logic
└── property-inspector/
    └── myaction/
        └── inspector.html ← per-button configuration UI
```

### 2. manifest.json

```json
{
  "Name": "My Plugin",
  "Author": "YourName",
  "Version": "1.0.0",
  "Description": "Plugin description",
  "UUID": "com.yourcompany.yourplugin",
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
      "Name": "My Action",
      "UUID": "com.yourcompany.yourplugin.myaction",
      "Tooltip": "What this button does",
      "Icon": "assets/icon",
      "SupportedInMultiActions": false,
      "PropertyInspectorPath": "property-inspector/myaction/inspector.html"
    }
  ]
}
```

**UUID convention:**
- Plugin (main service): `com.company.ulanzistudio.pluginname` (4 segments)
- Action: `com.company.ulanzistudio.pluginname.actionname` (5+ segments)

### 3. SDK installation

```bash
# inside the plugin folder
npm install ws
# copy plugin-common-node into libs/
```

Or use a Git submodule:
```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-node libs/plugin-common-node
```

### 4. app.js — full example

```javascript
import UlanziApi, { Utils } from '../libs/plugin-common-node/index.js';

const $UD = new UlanziApi();
const ACTION_UUID = 'com.yourcompany.yourplugin.myaction';

// Cache of active buttons: context → state
const buttons = new Map();

// === CONNECTION ===
$UD.connect('com.yourcompany.yourplugin');

// === INCOMING EVENTS ===

// Button added to the layout
$UD.onAdd((data) => {
  const { context } = data;
  buttons.set(context, { active: false, settings: {} });
  updateButton(context);
});

// Button pressed
$UD.onRun((data) => {
  const { context } = data;
  console.log('Pressed:', context);
  // Your action logic here
  doSomething(context);
});

// Press / release
$UD.onKeyDown((data) => console.log('keyDown', data));
$UD.onKeyUp((data) => console.log('keyUp', data));

// Activation / deactivation (view change in the app)
$UD.onSetActive((data) => {
  const { context, active } = data;
  const btn = buttons.get(context);
  if (btn) btn.active = active;
  if (active) updateButton(context); // refresh when visible
});

// Button removed
$UD.onClear((data) => {
  // data is an array of contexts
  data.forEach(ctx => buttons.delete(ctx));
});

// Settings changed via the Property Inspector
$UD.onParamFromApp((data) => {
  const { context, param } = data;
  const btn = buttons.get(context);
  if (btn) {
    btn.settings = { ...btn.settings, ...param };
    updateButton(context);
  }
});

// Encoder rotated (if the device has dials)
$UD.onDialRotate((data) => {
  const { context, direction } = data; // direction: 1 or -1
  console.log('Rotate:', direction);
});

// === RENDERING ICONS ===

function updateButton(context) {
  // Option 1: predefined state (numbered style)
  $UD.setStateIcon(context, 0, 'Text');

  // Option 2: base64 PNG image
  const base64png = getMyIcon(); // your function
  $UD.setBaseDataIcon(context, base64png, 'Label');

  // Option 3: file path inside the plugin folder
  $UD.setPathIcon(context, 'assets/my_icon.png', 'Label');

  // Option 4: animated GIF (base64)
  $UD.setGifDataIcon(context, base64gif, 'Animation');

  // Option 5: animated GIF from file
  $UD.setGifPathIcon(context, 'assets/animation.gif', 'Animation');
}

// === GENERATING A CUSTOM ICON (Canvas API) ===
// Runs in a browser context (app.html loads app.js)
function generateIcon(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = color || '#1a1a2e';
  ctx.fillRect(0, 0, 72, 72);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 36, 36);

  return canvas.toDataURL('image/png').split(',')[1]; // base64
}

// === LIVE ICON (e.g. clock, temperature) ===
function startLiveUpdate(context) {
  setInterval(() => {
    if (!buttons.get(context)?.active) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    });
    const icon = generateIcon(timeStr, '#16213e');
    $UD.setBaseDataIcon(context, icon, '');
  }, 1000);
}

// === SETTINGS (persistence) ===

$UD.onDidReceiveSettings((data) => {
  const { context, param } = data;
  if (param) {
    const btn = buttons.get(context);
    if (btn) btn.settings = param;
  }
});

function saveSettings(context, settings) {
  $UD.setSettings(settings, context);       // per-action save
}

function loadSettings(context) {
  $UD.getSettings(context);                 // reply arrives via onDidReceiveSettings
}

function saveGlobalSettings(settings) {
  $UD.setGlobalSettings(settings, null);    // shared across the whole plugin
}

// === SYSTEM ===

$UD.toast('Plugin loaded!');                // popup notification
$UD.logMessage('Debug info', 'info');       // file logs
$UD.showAlert(context);                     // error indicator on the button
$UD.hotkey('ctrl+shift+F5');                // trigger an OS shortcut
$UD.openUrl('https://example.com');         // open in browser
```

### 5. app.html — entry point

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
<!-- Load order matters! -->
<script src="../libs/plugin-common-node/index.js"></script>
<script src="app.js" type="module"></script>
</body>
</html>
```

### 6. Property Inspector (configuration UI)

`property-inspector/myaction/inspector.html` — shown when you click a button in UlanziStudio:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="../../libs/common-html/style.css">
</head>
<body>
  <div class="sdpi-wrapper">
    <div class="sdpi-item">
      <div class="sdpi-item-label">Background color</div>
      <input type="color" id="bgColor" class="sdpi-item-value">
    </div>
    <div class="sdpi-item">
      <div class="sdpi-item-label">Label</div>
      <input type="text" id="labelText" class="sdpi-item-value" placeholder="e.g. CPU">
    </div>
    <button id="saveBtn">Save</button>
  </div>

  <script src="../../libs/plugin-common-node/index.js"></script>
  <script>
    const $UD = new UlanziApi();
    $UD.connect('com.yourcompany.yourplugin');

    // Receive the current settings
    $UD.onDidReceiveSettings((data) => {
      if (data.param?.bgColor) {
        document.getElementById('bgColor').value = data.param.bgColor;
      }
      if (data.param?.labelText) {
        document.getElementById('labelText').value = data.param.labelText;
      }
    });

    // Send settings to the main plugin
    document.getElementById('saveBtn').addEventListener('click', () => {
      const settings = {
        bgColor: document.getElementById('bgColor').value,
        labelText: document.getElementById('labelText').value,
      };
      $UD.sendToPlugin(settings); // → app.js onParamFromApp
    });
  </script>
</body>
</html>
```

### 7. Complete API — every method

#### Rendering

| Method | Description |
|--------|-------------|
| `setStateIcon(ctx, stateIndex, text)` | Predefined style #N |
| `setBaseDataIcon(ctx, base64, text)` | PNG image as base64 |
| `setPathIcon(ctx, path, text)` | Image from file (relative path) |
| `setGifDataIcon(ctx, base64, text)` | Animated GIF (base64) |
| `setGifPathIcon(ctx, path, text)` | Animated GIF from file |

#### Communication

| Method | Description |
|--------|-------------|
| `sendParamFromPlugin(settings, ctx)` | Plugin → App (persisted) |
| `sendToPropertyInspector(settings, ctx)` | Plugin → Inspector (transient) |
| `sendToPlugin(settings)` | Inspector → Plugin |

#### Settings

| Method | Description |
|--------|-------------|
| `setSettings(obj, ctx)` | Save action settings |
| `getSettings(ctx)` | Load action settings |
| `setGlobalSettings(obj, ctx)` | Save plugin-wide settings |
| `getGlobalSettings(ctx)` | Load plugin-wide settings |

#### System

| Method | Description |
|--------|-------------|
| `toast(msg)` | Popup notification |
| `showAlert(ctx)` | Error icon on the button |
| `logMessage(msg, level)` | Write to log file |
| `hotkey(key)` | Trigger an OS shortcut |
| `openUrl(url, local, param)` | Open URL |
| `openView(url, w, h, x, y, param)` | Open popup window |
| `selectFileDialog(filter)` | File picker |
| `selectFolderDialog()` | Folder picker |

#### Incoming events

| Event | Trigger |
|-------|---------|
| `onConnected()` | WebSocket established |
| `onAdd(data)` | Button assigned to a key |
| `onRun(data)` | Button pressed (main logic) |
| `onKeyDown(data)` | Key down |
| `onKeyUp(data)` | Key up |
| `onSetActive(data)` | View activation/deactivation |
| `onClear(data)` | Button removed (array of contexts) |
| `onDialRotate(data)` | Encoder rotated (dir: 1/-1) |
| `onParamFromApp(data)` | Configuration from the app |
| `onSendToPlugin(data)` | Data from the Property Inspector |
| `onDidReceiveSettings(data)` | Reply to getSettings |

---

## APPROACH B — Direct access (NO app)

### Method B1: Python over USB (redphx/strmdck)

[redphx/strmdck](https://github.com/redphx/strmdck) — protocol reverse-engineered with Wireshark, unencrypted.

```bash
pip install strmdck
```

```python
# Conceptual — see the upstream repository for the current API
from strmdck import StreamDeck

deck = StreamDeck()
deck.connect()

# Render an image on a button (PIL Image)
from PIL import Image, ImageDraw
img = Image.new('RGB', (72, 72), color='#1a1a2e')
draw = ImageDraw.Draw(img)
draw.text((10, 25), "Hello!", fill='white')
deck.set_key_image(key_index=0, image=img)

# Listen for events
def on_key_press(key, state):
    print(f"Key {key}: {'down' if state else 'up'}")

deck.on_key_change(on_key_press)
deck.run()
```

### Method B2: ADB root shell (run code on the device)

The D200 has an **open ADB root shell** — you can execute code directly on the device.

```bash
# Verify the device is visible
adb devices

# Enter the device as root
adb shell

# Inspect the framebuffer
ls -la /dev/fb0

# Push your own binary
adb push my_program /userdata/my_program
adb shell chmod +x /userdata/my_program
adb shell /userdata/my_program
```

#### Direct framebuffer writes (C++/Python)

```cpp
// Write to /dev/fb0 (access via ADB shell)
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>

int fb = open("/dev/fb0", O_RDWR);
// mmap and write pixels directly
// Format: RGB565 or RGBA8888 (depends on configuration)
```

```python
# Python via ADB — send raw bytes to /dev/fb0
import subprocess

def push_image_to_display(raw_rgb_bytes):
    with open('/tmp/frame.raw', 'wb') as f:
        f.write(raw_rgb_bytes)
    subprocess.run(['adb', 'push', '/tmp/frame.raw', '/userdata/frame.raw'])
    subprocess.run(['adb', 'shell', 'cat /userdata/frame.raw > /dev/fb0'])
```

---

## Use Cases

### 1. CPU usage indicator (Plugin SDK)

```javascript
// app.js
import os from 'os';

function getCpuUsage() {
  const cpus = os.cpus();
  const total = cpus.reduce((acc, cpu) => {
    const times = cpu.times;
    return acc + times.user + times.nice + times.sys + times.irq + times.idle;
  }, 0);
  const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
  return Math.round((1 - idle / total) * 100);
}

$UD.onSetActive(({ context, active }) => {
  if (active) {
    const interval = setInterval(() => {
      const usage = getCpuUsage();
      const color = usage > 80 ? '#ff4444' : usage > 50 ? '#ffaa00' : '#44ff44';
      const icon = generateIcon(`${usage}%`, color);
      $UD.setBaseDataIcon(context, icon, 'CPU');
    }, 2000);
    // stop when inactive: onSetActive({ active: false }) → clearInterval
  }
});
```

### 2. Frame-by-frame animation

```javascript
const frames = ['assets/frame1.png', 'assets/frame2.png', 'assets/frame3.png'];
let frameIndex = 0;

setInterval(() => {
  buttons.forEach((_, context) => {
    $UD.setPathIcon(context, frames[frameIndex], '');
  });
  frameIndex = (frameIndex + 1) % frames.length;
}, 500);
```

### 3. API integration (weather, notifications)

```javascript
$UD.onRun(async ({ context }) => {
  const response = await fetch('https://api.weatherapi.com/v1/current.json?key=KEY&q=Warsaw');
  const data = await response.json();
  const temp = `${data.current.temp_c}°C`;
  const icon = generateIcon(temp, '#003366');
  $UD.setBaseDataIcon(context, icon, 'Weather');
});
```

---

## Which Approach to Pick?

| Goal | Recommendation |
|------|----------------|
| Quick start, plugins integrated with the Ulanzi UI | **Approach A** — official SDK |
| Run without the official app | **Approach B1** — Python strmdck |
| Maximum control / run your own code ON the device | **Approach B2** — ADB root shell |
| Home Assistant integration | [redphx/homedeck](https://github.com/redphx/homedeck) |

---

## Resources

- [UlanziDeckPlugin-SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK) — official SDK + demos (analog clock, TeamSpeak 5)
- [plugin-common-node](https://github.com/UlanziTechnology/plugin-common-node) — Node.js library
- [plugin-common-html](https://github.com/UlanziTechnology/plugin-common-html) — HTML/CSS library for the Property Inspector
- [redphx/strmdck](https://github.com/redphx/strmdck) — Python USB library (no official app required)
- [redphx/homedeck](https://github.com/redphx/homedeck) — Home Assistant integration
- [rlaneth/badustudio](https://github.com/rlaneth/badustudio) — Bad Apple on the D200 (ADB + framebuffer, C++)
- [Hackaday: D200 hacking](https://hackaday.com/tag/ulanzi-d200/) — technical articles
- [HA community thread](https://community.home-assistant.io/t/ulanzi-stream-deck-d200-with-home-assistant/846627) — community discussion

---

## Limitations

- **Approach A**: requires UlanziStudio running on the PC
- **Approach A**: icons are rendered through app.html (browser context), not pure Node.js
- **Approach B1**: USB protocol is reverse-engineered — may break after a firmware update
- **Approach B2**: ADB access may be locked down in future firmware updates
- SDK license: **AGPL 3.0** — modifications must be open-sourced if you provide a hosted service
