# Ulanzi D200 – Kompletny Raport: Własne Pluginy i Kontrola Urządzenia

> Badane źródła: oficjalne SDK Ulanzi, plugin-common-node, community Home Assistant, Hackaday, redphx/strmdck, rlaneth/badustudio
> Data: 2026-03-14

---

## TL;DR – Dwie drogi

| Podejście | Wymaga oficjalnej aplikacji? | Język | Trudność |
|---|---|---|---|
| **A) Oficjalny plugin SDK** | TAK (UlanziStudio musi działać) | Node.js / JS | Średnia |
| **B) Bezpośredni dostęp przez USB/ADB** | NIE | Python / C++ | Wysoka |

---

## Architektura – jak to działa

### Podejście A: Oficjalny Plugin SDK

```
[Twój plugin Node.js / JS]
        ↕ WebSocket (localhost, random port)
[Aplikacja UlanziStudio (PC)]
        ↕ USB
[Urządzenie Ulanzi D200]
```

Aplikacja UlanziStudio jest **wymaganym pośrednikiem** – ona trzyma sterownik USB.
Twój plugin to osobny proces JS, który komunikuje się z aplikacją przez lokalny WebSocket.

### Podejście B: Bezpośredni dostęp (bez aplikacji)

```
[Twój skrypt Python / program C++]
        ↕ USB (HID, niezaszyfrowany protokół)
[Urządzenie Ulanzi D200]
```

LUB przez ADB (urządzenie ma otwarty root shell!):

```
[Twój skrypt] → adb push → [D200: Linux Buildroot na Rockchip RK3308HS]
                              → /dev/fb0 (framebuffer)
                              → adb shell ./twoj_program
```

---

## Sprzęt – co jest w środku D200

- **CPU**: Quad-core Rockchip RK3308HS
- **OS**: Linux 5.10.160 (kernel z Androida, userspace Buildroot)
- **ADB**: **Otwarty root shell** – Ulanzi zostawiło go otwartego fabrycznie!
- **USB protokół**: Niezaszyfrowany, zrozumiały po sniffingu Wiresharkiem
- **Framebuffer**: `/dev/fb0` – bezpośredni dostęp do wyświetlacza

---

## PODEJŚCIE A – Oficjalny Plugin SDK (Node.js)

### 1. Struktura pluginu

Każdy plugin to folder z rozszerzeniem `.ulanziPlugin`:

```
com.twojafirma.twojplugin.ulanziPlugin/
├── manifest.json          ← definicja pluginu
├── en.json               ← tłumaczenia EN
├── pl.json               ← tłumaczenia PL (opcjonalne)
├── assets/               ← ikony, obrazki
├── libs/                 ← biblioteki (plugin-common-node)
├── plugin/
│   ├── app.html          ← entry point (ładuje app.js)
│   └── app.js            ← główna logika pluginu
└── property-inspector/
    └── mojaction/
        └── inspector.html ← UI konfiguracji przycisku
```

### 2. manifest.json

```json
{
  "Name": "Mój Plugin",
  "Author": "TwojeImie",
  "Version": "1.0.0",
  "Description": "Opis pluginu",
  "UUID": "com.twojafirma.twojplugin",
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
      "Name": "Moja Akcja",
      "UUID": "com.twojafirma.twojplugin.mojaction",
      "Tooltip": "Co robi ten przycisk",
      "Icon": "assets/ikona",
      "SupportedInMultiActions": false,
      "PropertyInspectorPath": "property-inspector/mojaction/inspector.html"
    }
  ]
}
```

**Konwencja UUID:**
- Plugin (main service): `com.firma.ulanzistudio.nazwaplugin` (4 segmenty)
- Akcja: `com.firma.ulanzistudio.nazwaplugin.nazwaakcji` (5+ segmentów)

### 3. Instalacja SDK

```bash
# w folderze plugin/
npm install ws
# skopiuj plugin-common-node do libs/
```

Lub użyj submodułu Git:
```bash
git submodule add https://github.com/UlanziTechnology/plugin-common-node libs/plugin-common-node
```

### 4. app.js – pełny przykład

```javascript
import UlanziApi, { Utils } from '../libs/plugin-common-node/index.js';

const $UD = new UlanziApi();
const ACTION_UUID = 'com.twojafirma.twojplugin.mojaction';

// Cache aktywnych przycisków: context → dane
const buttons = new Map();

// === POŁĄCZENIE ===
$UD.connect('com.twojafirma.twojplugin');

// === ZDARZENIA PRZYCHODZĄCE ===

// Przycisk dodany do layoutu
$UD.onAdd((data) => {
  const { context } = data;
  buttons.set(context, { active: false, settings: {} });
  updateButton(context);
});

// Przycisk naciśnięty
$UD.onRun((data) => {
  const { context } = data;
  console.log('Naciśnięto:', context);
  // Twoja logika akcji tutaj
  doSomething(context);
});

// Wciśnięcie / puszczenie
$UD.onKeyDown((data) => console.log('keyDown', data));
$UD.onKeyUp((data) => console.log('keyUp', data));

// Aktywacja/deaktywacja (zmiana widoku w aplikacji)
$UD.onSetActive((data) => {
  const { context, active } = data;
  const btn = buttons.get(context);
  if (btn) btn.active = active;
  if (active) updateButton(context); // odśwież gdy widoczny
});

// Przycisk usunięty
$UD.onClear((data) => {
  // data to tablica contextów
  data.forEach(ctx => buttons.delete(ctx));
});

// Ustawienia zmienione przez Property Inspector
$UD.onParamFromApp((data) => {
  const { context, param } = data;
  const btn = buttons.get(context);
  if (btn) {
    btn.settings = { ...btn.settings, ...param };
    updateButton(context);
  }
});

// Enkoder obracany (jeśli urządzenie ma pokrętła)
$UD.onDialRotate((data) => {
  const { context, direction } = data; // direction: 1 lub -1
  console.log('Obrót:', direction);
});

// === WYŚWIETLANIE IKON ===

function updateButton(context) {
  // Opcja 1: Predefiniowany stan (numerowany styl)
  $UD.setStateIcon(context, 0, 'Tekst');

  // Opcja 2: Obrazek base64 PNG
  const base64png = getMyIcon(); // twoja funkcja
  $UD.setBaseDataIcon(context, base64png, 'Etykieta');

  // Opcja 3: Ścieżka do pliku w folderze pluginu
  $UD.setPathIcon(context, 'assets/moja_ikona.png', 'Etykieta');

  // Opcja 4: Animowany GIF (base64)
  $UD.setGifDataIcon(context, base64gif, 'Animacja');

  // Opcja 5: Animowany GIF z pliku
  $UD.setGifPathIcon(context, 'assets/animacja.gif', 'Animacja');
}

// === GENEROWANIE WŁASNEJ IKONY (Canvas API) ===
// Działa w kontekście przeglądarki (app.html ładuje app.js)
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

// === IKONA DYNAMICZNA (np. zegar, temperatura) ===
function startLiveUpdate(context) {
  setInterval(() => {
    if (!buttons.get(context)?.active) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pl-PL', {
      hour: '2-digit', minute: '2-digit'
    });
    const icon = generateIcon(timeStr, '#16213e');
    $UD.setBaseDataIcon(context, icon, '');
  }, 1000);
}

// === USTAWIENIA (persystencja) ===

$UD.onDidReceiveSettings((data) => {
  const { context, param } = data;
  if (param) {
    const btn = buttons.get(context);
    if (btn) btn.settings = param;
  }
});

function saveSettings(context, settings) {
  $UD.setSettings(settings, context);       // zapis per-akcja
}

function loadSettings(context) {
  $UD.getSettings(context);                 // odpowiedź przyjdzie w onDidReceiveSettings
}

function saveGlobalSettings(settings) {
  $UD.setGlobalSettings(settings, null);   // współdzielone przez cały plugin
}

// === SYSTEM ===

$UD.toast('Plugin załadowany!');            // powiadomienie popup
$UD.logMessage('Debug info', 'info');       // logi do pliku
$UD.showAlert(context);                     // wskaźnik błędu na przycisku
$UD.hotkey('ctrl+shift+F5');               // wyzwól skrót klawiszowy
$UD.openUrl('https://example.com');        // otwórz w przeglądarce
```

### 5. app.html – entry point

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
<!-- Kolejność ładowania ma znaczenie! -->
<script src="../libs/plugin-common-node/index.js"></script>
<script src="app.js" type="module"></script>
</body>
</html>
```

### 6. Property Inspector (UI konfiguracji)

`property-inspector/mojaction/inspector.html` – pojawia się gdy klikniesz przycisk w UlanziStudio:

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
      <div class="sdpi-item-label">Kolor tła</div>
      <input type="color" id="bgColor" class="sdpi-item-value">
    </div>
    <div class="sdpi-item">
      <div class="sdpi-item-label">Tekst</div>
      <input type="text" id="labelText" class="sdpi-item-value" placeholder="np. CPU">
    </div>
    <button id="saveBtn">Zapisz</button>
  </div>

  <script src="../../libs/plugin-common-node/index.js"></script>
  <script>
    const $UD = new UlanziApi();
    $UD.connect('com.twojafirma.twojplugin');

    // Odbierz aktualne ustawienia
    $UD.onDidReceiveSettings((data) => {
      if (data.param?.bgColor) {
        document.getElementById('bgColor').value = data.param.bgColor;
      }
      if (data.param?.labelText) {
        document.getElementById('labelText').value = data.param.labelText;
      }
    });

    // Wyślij ustawienia do głównego pluginu
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

### 7. Kompletne API – wszystkie metody

#### Wyświetlanie

| Metoda | Opis |
|--------|------|
| `setStateIcon(ctx, stateIndex, text)` | Predefiniowany styl nr N |
| `setBaseDataIcon(ctx, base64, text)` | Obrazek PNG jako base64 |
| `setPathIcon(ctx, path, text)` | Obrazek z pliku (względna ścieżka) |
| `setGifDataIcon(ctx, base64, text)` | GIF animowany (base64) |
| `setGifPathIcon(ctx, path, text)` | GIF animowany z pliku |

#### Komunikacja

| Metoda | Opis |
|--------|------|
| `sendParamFromPlugin(settings, ctx)` | Plugin → Aplikacja (persist) |
| `sendToPropertyInspector(settings, ctx)` | Plugin → Inspector (transient) |
| `sendToPlugin(settings)` | Inspector → Plugin |

#### Ustawienia

| Metoda | Opis |
|--------|------|
| `setSettings(obj, ctx)` | Zapisz ustawienia akcji |
| `getSettings(ctx)` | Pobierz ustawienia akcji |
| `setGlobalSettings(obj, ctx)` | Zapisz globalne ustawienia pluginu |
| `getGlobalSettings(ctx)` | Pobierz globalne |

#### System

| Metoda | Opis |
|--------|------|
| `toast(msg)` | Popup powiadomienie |
| `showAlert(ctx)` | Ikonka błędu na przycisku |
| `logMessage(msg, level)` | Log do pliku |
| `hotkey(key)` | Wyzwól skrót OS |
| `openUrl(url, local, param)` | Otwórz URL |
| `openView(url, w, h, x, y, param)` | Otwórz popup okno |
| `selectFileDialog(filter)` | Picker pliku |
| `selectFolderDialog()` | Picker folderu |

#### Zdarzenia przychodzące

| Event | Trigger |
|-------|---------|
| `onConnected()` | WebSocket nawiązany |
| `onAdd(data)` | Przycisk przypisany do klawisza |
| `onRun(data)` | Przycisk naciśnięty (główna logika) |
| `onKeyDown(data)` | Wciśnięcie |
| `onKeyUp(data)` | Puszczenie |
| `onSetActive(data)` | Aktywacja/deaktywacja widoku |
| `onClear(data)` | Przycisk usunięty (array of contexts) |
| `onDialRotate(data)` | Obrót enkodera (dir: 1/-1) |
| `onParamFromApp(data)` | Konfiguracja z aplikacji |
| `onSendToPlugin(data)` | Dane z Property Inspector |
| `onDidReceiveSettings(data)` | Odpowiedź na getSettings |

---

## PODEJŚCIE B – Bezpośredni dostęp (BEZ aplikacji)

### Metoda B1: Python przez USB (redphx/strmdck)

Projekt [redphx/strmdck](https://github.com/redphx/strmdck) – USB sniffing przez Wireshark, protokół niezaszyfrowany.

```bash
pip install strmdck
```

```python
# Koncepcja – patrz aktualne README repozytorium
from strmdck import StreamDeck

deck = StreamDeck()
deck.connect()

# Ustaw obraz na przycisku (PIL Image)
from PIL import Image, ImageDraw
img = Image.new('RGB', (72, 72), color='#1a1a2e')
draw = ImageDraw.Draw(img)
draw.text((10, 25), "Hello!", fill='white')
deck.set_key_image(key_index=0, image=img)

# Nasłuchuj zdarzeń
def on_key_press(key, state):
    print(f"Klawisz {key}: {'wciśnięty' if state else 'puszczony'}")

deck.on_key_change(on_key_press)
deck.run()
```

### Metoda B2: ADB Root Shell (bezpośrednio na urządzeniu)

D200 ma **otwarty root ADB** – możesz uruchamiać kod bezpośrednio na urządzeniu!

```bash
# Sprawdź czy urządzenie jest widoczne
adb devices

# Wejdź na urządzenie jako root
adb shell

# Sprawdź framebuffer
ls -la /dev/fb0

# Wypchnij własny binarny program
adb push moj_program /userdata/moj_program
adb shell chmod +x /userdata/moj_program
adb shell /userdata/moj_program
```

#### Bezpośredni zapis do framebuffera (C++/Python)

```cpp
// Zapis do /dev/fb0 (dostęp przez ADB shell)
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>

int fb = open("/dev/fb0", O_RDWR);
// mmap i zapisuj piksele bezpośrednio
// Format: RGB565 lub RGBA8888 (zależy od konfiguracji)
```

```python
# Python przez ADB - wyślij obraz jako bajty do /dev/fb0
import subprocess

def push_image_to_display(raw_rgb_bytes):
    with open('/tmp/frame.raw', 'wb') as f:
        f.write(raw_rgb_bytes)
    subprocess.run(['adb', 'push', '/tmp/frame.raw', '/userdata/frame.raw'])
    subprocess.run(['adb', 'shell', 'cat /userdata/frame.raw > /dev/fb0'])
```

---

## Przykłady zastosowań

### 1. Ikona pokazująca zużycie CPU (plugin SDK)

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
    // zatrzymaj gdy nieaktywny: onSetActive({ active: false }) → clearInterval
  }
});
```

### 2. Zmiana ikony co N sekund (animacja własna)

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

### 3. Integracja z API (pogoda, powiadomienia)

```javascript
$UD.onRun(async ({ context }) => {
  const response = await fetch('https://api.weatherapi.com/v1/current.json?key=KEY&q=Warsaw');
  const data = await response.json();
  const temp = `${data.current.temp_c}°C`;
  const icon = generateIcon(temp, '#003366');
  $UD.setBaseDataIcon(context, icon, 'Pogoda');
});
```

---

## Które podejście wybrać?

| Cel | Rekomendacja |
|-----|-------------|
| Szybki start, chcę pluginy integrowane z Ulanzi UI | **Podejście A** – oficjalny SDK |
| Chcę działać bez oficjalnej aplikacji | **Podejście B1** – Python strmdck |
| Chcę maksymalną kontrolę / uruchomić własny kod NA urządzeniu | **Podejście B2** – ADB root shell |
| Home Assistant integracja | [redphx/homedeck](https://github.com/redphx/homedeck) |

---

## Zasoby

- [UlanziDeckPlugin-SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK) – oficjalne SDK + demo (analog clock, TeamSpeak 5)
- [plugin-common-node](https://github.com/UlanziTechnology/plugin-common-node) – Node.js library
- [plugin-common-html](https://github.com/UlanziTechnology/plugin-common-html) – HTML/CSS library dla Property Inspector
- [redphx/strmdck](https://github.com/redphx/strmdck) – Python USB library (bez oficjalnej aplikacji)
- [redphx/homedeck](https://github.com/redphx/homedeck) – Home Assistant integration
- [rlaneth/badustudio](https://github.com/rlaneth/badustudio) – Bad Apple na D200 (ADB + framebuffer, C++)
- [Hackaday: D200 hacking](https://hackaday.com/tag/ulanzi-d200/) – artykuły techniczne
- [HA Community thread](https://community.home-assistant.io/t/ulanzi-stream-deck-d200-with-home-assistant/846627) – dyskusja community

---

## Ograniczenia

- **Podejście A**: wymaga działającej aplikacji UlanziStudio na PC
- **Podejście A**: ikony renderowane przez app.html (kontekst przeglądarki), nie czysty Node.js
- **Podejście B1**: protokół USB odwrotnie inżynierowany – może nie być 100% stabilny po update firmware
- **Podejście B2**: ADB dostęp może zostać zamknięty w przyszłych aktualizacjach firmware
- SDK licencja: **AGPL 3.0** – kod modyfikacji musi być open source jeśli udostępniasz usługę
