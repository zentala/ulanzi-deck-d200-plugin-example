# PRD & Implementation Spec: Ulanzi Demo Plugin – Approach A (Official Plugin SDK)

```
Document: SPEC-A-plugin-sdk.md
Status: READY FOR IMPLEMENTATION
Version: 1.0.0
Date: 2026-03-14
Target repo: ulanzi-demos/plugins/demo/
```

---

## 1. Cel i zakres

### Cel

Stworzyć referencyjne demo pluginu Ulanzi D200 korzystające z oficjalnego SDK (`plugin-common-node`), które:

- Demonstruje kluczowe możliwości API (Canvas rendering, persistencja ustawień, enkoder, eventy cyklu życia)
- Służy jako blueprint dla kolejnych pluginów w monorepo
- Jest w pełni działającym pluginem instalowanym przez UlanziStudio

### Zakres

Trzy akcje dostępne w UlanziStudio jako jeden plugin `io.zentala.ulanzideck.demo`:

| Akcja | UUID | Opis |
|---|---|---|
| ClockAction | `io.zentala.ulanzideck.demo.clock` | Zegar cyfrowy aktualizowany co sekundę |
| CounterAction | `io.zentala.ulanzideck.demo.counter` | Licznik z konfiguracją kroku i koloru |
| StatusAction | `io.zentala.ulanzideck.demo.status` | Monitor CPU z alertem progowym |

### Poza zakresem

- Backend server-side (plugin działa lokalnie, bez zewnętrznych API)
- Wsparcie dla enkodera obrotowego
- Animowane GIF-y (zamiast tego canvas dynamic rendering)
- Lokalizacja PL (tylko EN)

---

## 2. Struktura plików

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
            │   ├── app.js                    # Dispatcher (~80 linii)
            │   └── actions/
            │       ├── BaseAction.js         # Klasa bazowa (~120 linii)
            │       ├── ClockAction.js        # Zegar (~100 linii)
            │       ├── CounterAction.js      # Licznik (~130 linii)
            │       └── StatusAction.js       # CPU monitor (~150 linii)
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

**Uwagi:**
- `UUID` pluginu: 4 segmenty (konwencja SDK)
- `UUID` akcji: 5 segmentów
- `UsePrivateApi: true` wymagane dla `os.cpus()` w StatusAction
- `CodePath` wskazuje na HTML, nie JS – ograniczenie SDK (kontekst przeglądarki)

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

## 5. Akcja 1: ClockAction

### Zachowanie

- `onAdd`: rejestruje kontekst, uruchamia `setInterval(1000)` per kontekst
- Co sekundę: generuje canvas 72x72px z aktualnym czasem, wywołuje `setBaseDataIcon`
- `onSetActive({ active: false })`: zatrzymuje interval; `active: true` – wznawia
- `onRun`: `$UD.toast('Clock running')` (brak akcji kliknięcia, pedagogicznie)
- `onClear`: `clearInterval`, usuwa z mapy

### Renderowanie canvas 72x72

```
Warstwy:
1. Tło: gradient #0d1117 → #1a2332
2. Ramka: #30363d, 1px
3. Czas "14:32:07": bold 22px monospace, biały, y=32, wyśrodkowany
4. Data "SUN 14": 12px sans-serif, #8b949e, y=54, wyśrodkowany
```

### Property Inspector

| Pole | Typ | Domyślnie | Klucz |
|---|---|---|---|
| Background Color | `<input type="color">` | `#0d1117` | `bgColor` |
| Text Color | `<input type="color">` | `#ffffff` | `textColor` |
| Show Seconds | `<input type="checkbox">` | `true` | `showSeconds` |
| Show Date | `<input type="checkbox">` | `true` | `showDate` |

Przepływ: zmiana → `sendToPlugin(settings)` → `onParamFromApp` → `updateSettings` → re-render

### Eventy

| Event | Reakcja |
|---|---|
| `onAdd` | Zarejestruj, `getSettings`, start interval |
| `onSetActive` | Stop/start interval |
| `onClear` | clearInterval, usuń z mapy |
| `onParamFromApp` | Aktualizuj ustawienia, `setSettings`, re-render |
| `onDidReceiveSettings` | Załaduj zapisane ustawienia |
| `onRun` | toast |

---

## 6. Akcja 2: CounterAction

### Zachowanie

- Licznik per kontekst, wartość startowa: `0`
- `onRun` (tap): zmień wartość wg `direction * step`
- `onKeyDown` + hold > 600ms → reset do 0 + `toast('Counter reset')`
- `onDialRotate`: prawo = `+step`, lewo = `-step`
- Wartość persystowana przez `setSettings`

### Renderowanie canvas 72x72

```
Warstwy:
1. Tło: bgColor (domyślnie #1a1a2e)
2. Etykieta "COUNTER": 10px, #8b949e, góra
3. Wartość licznika: bold 28px monospace
   - >0: incrementColor (#39d353)
   - <0: decrementColor (#f85149)
   - =0: #8b949e
4. "step: ±N": 10px, #8b949e, dół
```

### Property Inspector

| Pole | Typ | Domyślnie | Klucz |
|---|---|---|---|
| Step | `<input type="number" min="1" max="100">` | `1` | `step` |
| Direction | `<select>` (Increment/Decrement) | `increment` | `direction` |
| Background Color | `<input type="color">` | `#1a1a2e` | `bgColor` |
| Positive Color | `<input type="color">` | `#39d353` | `incrementColor` |
| Negative Color | `<input type="color">` | `#f85149` | `decrementColor` |
| Reset Button | `<button>` | — | wysyła `{ action: 'reset' }` |

### Eventy

| Event | Reakcja |
|---|---|
| `onAdd` | Zarejestruj, załaduj `value` z `getSettings`, render |
| `onRun` | Zmień wartość (jeśli `!wasLongPress`), zapisz, render |
| `onKeyDown` | Zapisz `keyDownTimestamp` |
| `onKeyUp` | Jeśli elapsed > 600ms → reset, toast, flaga `wasLongPress=true` |
| `onDialRotate` | `±step`, render |
| `onClear` | Usuń z mapy |
| `onParamFromApp` | Aktualizuj ustawienia; jeśli `action==='reset'` → value=0 |
| `onDidReceiveSettings` | Przywróć stan |

---

## 7. Akcja 3: StatusAction (CPU Monitor)

### Zachowanie

- Mierzy CPU usage co `intervalSec` (domyślnie `2s`)
- Algorytm: dwie próbki `os.cpus()` z różnicą czasu → `(delta_busy / delta_total) * 100`
- Kolor tła dynamiczny wg progu alertu:
  - `< alertThreshold`: zielony `#39d353`
  - `>= alertThreshold && < alertThreshold+20`: żółty `#ffaa00`
  - `>= alertThreshold+20`: czerwony `#f85149`
- Gdy `>= alertThreshold`: `showAlert(context)` + jeden toast
- `onRun`: force-refresh CPU

### Renderowanie canvas 72x72

```
Warstwy:
1. Tło: dynamiczny kolor (zielony/żółty/czerwony)
2. Etykieta "CPU": 10px, biały, góra-lewo
3. Wartość "%": bold 28px monospace, biały, środek
4. Pasek postępu: 60x6px, y=50
5. "N cores": 9px, rgba(255,255,255,0.6), prawo-dół
```

### Property Inspector

| Pole | Typ | Domyślnie | Klucz |
|---|---|---|---|
| Alert Threshold (%) | `<input type="range" min="50" max="95">` | `80` | `alertThreshold` |
| Update Interval (s) | `<select>` (1s/2s/5s) | `2` | `intervalSec` |
| Show Core Count | `<input type="checkbox">` | `true` | `showCores` |

Slider pokazuje live wartość (`<span id="thresholdDisplay">`). Zapis przez "Save" button.

### Eventy

| Event | Reakcja |
|---|---|
| `onAdd` | Zarejestruj, załaduj ustawienia, zainicjuj pierwszą próbkę CPU, start interval |
| `onSetActive` | Stop/start interval |
| `onClear` | clearInterval, usuń z mapy |
| `onRun` | Force-refresh CPU, render |
| `onParamFromApp` | Aktualizuj progi, restart interval |
| `onDidReceiveSettings` | Przywróć ustawienia |

---

## 8. BaseAction.js – interfejs

```javascript
/**
 * @file BaseAction.js
 * @description Abstract base for all demo plugin actions.
 * Manages button lifecycle, settings persistence, and canvas utilities.
 */
class BaseAction {
  constructor(api, actionUUID) { ... }

  // Lifecycle – wywoływane przez app.js dispatcher
  handleAdd(data) { ... }           // rejestruje context, getSettings, wywołuje onInit
  handleClear(data) { ... }         // clearInterval, usuwa z mapy
  handleSetActive(data) { ... }     // stop/start interval
  handleRun(data) { ... }           // wywołuje onPress
  handleKeyDown(data) { ... }
  handleKeyUp(data) { ... }
  handleParams(data) { ... }        // wywołuje onSettings
  handleDialRotate(data) { ... }
  handleReceiveSettings(data) { ... }

  // Canvas utilities
  createCanvas(width = 72, height = 72) { ... }   // → { canvas, ctx }
  canvasToBase64(canvas) { ... }                   // → base64 string (bez prefixu)
  renderText(ctx, text, options) { ... }           // wyśrodkowany tekst
  renderProgressBar(ctx, value, max, options) { ... }

  // Abstract – muszą być nadpisane
  onInit(context) { throw new Error('Not implemented'); }
  onPress(context) { throw new Error('Not implemented'); }
  onSettings(context, params) { throw new Error('Not implemented'); }
  render(context) { throw new Error('Not implemented'); }
}
```

---

## 9. app.js – dispatcher

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

// context → action instance (dla onClear który nie ma pola 'action')
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

## 11. Diagram przepływu danych

```
URZĄDZENIE D200
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

PROPERTY INSPECTOR (iframe w UlanziStudio):
  inspector.html
  $UD.sendToPlugin(settings)  ──→  onParamFromApp → handleParams
  $UD.onDidReceiveSettings    ←──  sendToPropertyInspector(settings, ctx)
```

---

## 12. Kluczowe decyzje techniczne

**D1: BaseAction zamiast monolitycznego app.js**
Limit 250 linii/plik wymusza podział. BaseAction eliminuje duplikację lifecycle.
`app.js` = czysty dispatcher < 80 linii.

**D2: CPU measurement przez dwie próbki os.cpus()**
Pojedyncza próbka = wartości kumulatywne od startu. Dwie próbki z delta = bieżące %.
`process.cpuUsage()` odrzucone – mierzy tylko bieżący proces.

**D3: UsePrivateApi: true dla os.cpus()**
Canvas działa w browser context, ale `os` to Node.js API.
`UsePrivateApi` umożliwia dostęp przez Electron/NW.js bridge.
Sprawdź czy require `const os = require('os')` czy import – zależy od plugin-common-node.

**D4: Osobne setInterval per kontekst w ClockAction**
Użytkownik może mieć ten sam przycisk na wielu ekranach. Map<context, interval> izoluje każdy.

**D5: Save button w PI, nie auto-save**
Auto-save przy każdej zmianie = nadmiarowe setBaseDataIcon calls. Dedykowany Save button.

**D6: Hold-to-reset przez keyDown/keyUp timestamp**
Brak natywnego long-press w SDK. elapsed > 600ms = reset. Flaga `wasLongPress` blokuje onRun.

**D7: Canvas 72x72px**
Wynika ze struktury demo analogclock w oficjalnym SDK repo.

---

## 13. Zależności

| Zależność | Źródło | Metoda |
|---|---|---|
| `plugin-common-node` | github.com/UlanziTechnology/plugin-common-node | Git submodule |
| `plugin-common-html` | github.com/UlanziTechnology/plugin-common-html | Git submodule |

```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-node libs/plugin-common-node
git submodule add https://github.com/UlanziTechnology/plugin-common-html libs/plugin-common-html
```

Brak zewnętrznych npm packages. Canvas API z przeglądarki. `os` z Node.js przez UsePrivateApi.

---

## 14. Jak uruchomić

### Lokalizacja folderu pluginów

| OS | Ścieżka |
|---|---|
| Windows | `%APPDATA%\UlanziStudio\plugins\` |
| macOS | `~/Library/Application Support/UlanziStudio/plugins/` |

### Deployment (symlink – wygodne przy dev)

```powershell
# Windows (PowerShell jako Administrator)
New-Item -ItemType SymbolicLink `
  -Path "$env:APPDATA\UlanziStudio\plugins\io.zentala.ulanzideck.demo.ulanziPlugin" `
  -Target (Resolve-Path ".\io.zentala.ulanzideck.demo.ulanziPlugin")
```

```bash
# macOS
ln -s $(pwd)/io.zentala.ulanzideck.demo.ulanziPlugin \
  ~/Library/Application\ Support/UlanziStudio/plugins/io.zentala.ulanzideck.demo.ulanziPlugin
```

### Kroki

1. Zamknij UlanziStudio
2. Stwórz symlink lub skopiuj folder
3. Uruchom UlanziStudio
4. Plugin widoczny w "My Plugins"
5. Przeciągnij akcję na przycisk D200
6. Toast "Demo Plugin loaded" = sukces

### Debugowanie

Logi: `%APPDATA%\UlanziStudio\logs\` (Windows) lub `~/Library/Application Support/UlanziStudio/logs/` (macOS)

---

## 15. Kolejność implementacji

```
1. manifest.json + en.json            → plugin widoczny w UI
2. plugin/app.html                    → entry point
3. libs/ (submoduły)                  → SDK dostępne
4. plugin/app.js (stub: connect + toast onConnected)
                                      → WERYFIKACJA: toast po załadowaniu
5. plugin/actions/BaseAction.js       → shared lifecycle + canvas
6. plugin/actions/ClockAction.js + dispatch w app.js
                                      → WERYFIKACJA: zegar na przycisku
7. property-inspector/clock/inspector.html
                                      → WERYFIKACJA: zmiana koloru
8. CounterAction.js + counter/inspector.html
                                      → WERYFIKACJA: licznik + hold reset
9. StatusAction.js + status/inspector.html
                                      → WERYFIKACJA: CPU + alert kolor
10. assets/ (PNG 72x72)               → finalne ikony
```

---

## 16. Pliki do stworzenia

| Plik | Priorytet | Linii est. |
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
| `assets/*.png` (4 pliki) | P3 | binary |
