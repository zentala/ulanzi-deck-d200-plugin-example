# Vision: Ulanzi as Personal Ecosystem Hub

```
Date: 2026-03-14
Status: DRAFT (clarified 2026-03-14)
Author: zentala
```

## Clarified Decisions

| Question | Answer |
|---|---|
| Directus instance | Local Docker |
| Temperature source | External weather API |
| Tauri app → Directus | YES — Tauri app writes to Directus |
| Wisp Flow API | NO API — integration via hotkey only |
| Voice recognition | External tool (not Wisp Flow built-in) |
| Which apps use Directus | Only Pomodoro-type (session/activity tracking). Other apps have own data patterns. |

---

## The Big Picture

Ulanzi D200 is not just a stream deck — it is the **physical control panel for a personal productivity OS**.
It bridges hardware interaction (button press, visual feedback) with a distributed ecosystem of apps,
all anchored to a central **Directus** data layer.

```
┌─────────────────────────────────────────────────────────────┐
│                   PERSONAL ECOSYSTEM                        │
│                                                             │
│  [Tauri App]          [Pomodoro Web]   [Clock Tauri App]   │
│         │                   │                  │           │
│         └─────────────┬─────┘                  │           │
│                       ▼                         │           │
│              ┌──────────────────┐               │           │
│              │   DIRECTUS API   │◄──────────────┘           │
│              │  (central store) │                           │
│              └────────┬─────────┘                          │
│                       │ REST API (fetch)                    │
│                       ▼                                     │
│              ┌──────────────────┐                          │
│              │  ULANZI PLUGINS  │◄── $UD.hotkey/openUrl    │
│              │  (Node.js/JS)    │──► visual feedback       │
│              └────────┬─────────┘                          │
│                       │                                     │
│                       ▼                                     │
│              ┌──────────────────┐                          │
│              │   D200 DEVICE    │                          │
│              │  (physical HW)   │                          │
│              └──────────────────┘                          │
│                                                             │
│  [Wisp Flow] ← hotkey trigger ← button press              │
│      │ voice recording → transcription                     │
│      └────────────────────────► Directus                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concept: Activity-Driven Workflow

Every 10 minutes, Ulanzi **pulses** (animated icon) on one dedicated button — asking:
> "What are you doing right now?"

User clicks the button → **Wisp Flow opens** (via hotkey or custom protocol) → user speaks for 5–10 seconds
→ transcription saved to Directus as a **work log entry** tagged with current Pomodoro session.

This creates a timestamped voice activity log with near-zero friction.

---

## Apps & Integrations

### 1. Pomodoro (existing action → full integration)

**Current state:** ClockAction/PomodoroAction in demo plugin, isolated.

**Target:**
- Pomodoro plugin reads/writes session data to **Directus** (`pomodoro_sessions` collection)
- Each session has: `started_at`, `ended_at`, `task_id` (linked to Trello card), `voice_logs[]`
- Web UI (separate React app) visualizes sessions, streaks, stats — replaces need for embedded UI
- D200 button shows: current session countdown, session #N today, break indicator

**Ulanzi plugin capabilities needed:**
```javascript
// Fetch current session from Directus on init + poll every 5s
setInterval(async () => {
  const session = await fetch(`${DIRECTUS_URL}/items/pomodoro_sessions?filter[status]=active`)
  updateButtonDisplay(session);
}, 5000);

// On button press: start/stop session
$UD.onRun(async ({ context }) => {
  await fetch(`${DIRECTUS_URL}/items/pomodoro_sessions`, {
    method: 'POST',
    body: JSON.stringify({ status: 'active', started_at: new Date() })
  });
});
```

---

### 2. Activity Check-in via Wisp Flow

**Concept:** Dedicated button on D200 for "voice context capture"

**Flow:**
1. Plugin runs `setInterval` every 10 minutes
2. When interval fires: button starts **pulsing animation** (canvas frame animation)
3. User clicks → `$UD.hotkey('ctrl+shift+W')` (or custom URI) → triggers Wisp Flow recording
4. Wisp Flow transcribes → POSTs to Directus `activity_logs` collection
5. Plugin receives webhook OR polls Directus → updates button icon to show last log snippet

**Button states:**
```
[idle]        → clock icon, "last log N min ago"
[pulsing]     → animated ring, "check in now!"
[recording]   → mic icon, "speaking..."
[saved]       → checkmark, "logged 14:32"
```

**Directus collection: `activity_logs`**
```json
{
  "id": "uuid",
  "created_at": "2026-03-14T14:32:00Z",
  "transcript": "Working on Ulanzi plugin integration...",
  "pomodoro_session_id": "uuid",
  "trello_card_id": "optional"
}
```

**Technical note:** Wisp Flow has no API — integration via hotkey only:
- `$UD.hotkey('ctrl+shift+W')` — global hotkey registered in Wisp Flow starts recording
- Voice recognition is handled by an external tool (not Wisp Flow built-in)
- After recording, the external voice recognition processes audio → sends transcript to Directus
- Plugin polls Directus to confirm the log was saved → shows confirmation on button

---

### 3. Tauri App Integration (task/state sync)

**Concept:** There's a Tauri desktop app that writes its state to Directus. Ulanzi reads from there.

**Data flow:**
- Tauri app writes current state to Directus (e.g., active task, status)
- Ulanzi plugin reads from Directus → shows on button
- No direct communication between plugin and Tauri app (no IPC needed)

**Button behavior:**
- Shows current active task/state from Tauri app via Directus
- `onRun` → `$UD.hotkey()` to focus/trigger the Tauri app window

---

### 4. Clock/Timer Tauri App (second screen)

**Concept:** The Tauri desktop app (second monitor) should react to D200 state changes

**Integration pattern:**
- Both Ulanzi plugin and Tauri app subscribe to same Directus collections (real-time via WebSocket/polling)
- Directus becomes the **event bus** between apps
- When Pomodoro session starts → Ulanzi writes to Directus → Tauri app reads → shows timer
- No direct IPC needed — Directus as shared state

```
D200 button press
       │
       ▼
Ulanzi plugin → POST /directus/items/pomodoro_sessions
                         │
              ┌──────────┤
              ▼          ▼
        Tauri Clock   Pomodoro Web
        (reads state) (reads state)
```

---

### 5. Temperature Display

**Source options:**
- Home Assistant (via REST API `GET /api/states/sensor.temperature_XXXX`)
- OpenWeatherMap / weatherapi.com
- Local sensor on same network

**Implementation:** Direct `fetch()` from plugin — temperature APIs return JSON, no special handling needed.

```javascript
const WEATHER_API = 'https://api.weatherapi.com/v1/current.json?key=KEY&q=Warsaw';
setInterval(async () => {
  const { current } = await fetch(WEATHER_API).then(r => r.json());
  renderTemperature(context, `${current.temp_c}°C`, current.condition);
}, 300_000); // every 5 min
```

---

### 6. Notifications

**Concept:** One dedicated D200 button as "notification center indicator"

**Sources:**
- Directus `notifications` collection (apps write here, Ulanzi reads)
- OR: apps post directly to a `/notify` endpoint on a lightweight local HTTP bridge

**Button behavior:**
- `count === 0` → neutral gray icon
- `count > 0` → red badge with count, pulsing
- `onRun` → clear notifications + open notification list (URL or hotkey to relevant app)

---

## Technical Architecture for Integrative Plugins

### What plugins CAN do (confirmed by SDK research)

| Capability | Method | Use case |
|---|---|---|
| HTTP REST calls | `fetch()` (browser context) | Directus API, weather, Trello |
| Polling data | `setInterval()` | Every N seconds check state |
| Trigger hotkeys | `$UD.hotkey('ctrl+shift+X')` | Open Wisp Flow, focus apps |
| Open URLs / protocols | `$UD.openUrl(url)` | Custom app protocols, browser |
| Open popup window | `$UD.openView(url, w, h)` | Mini dashboard overlay |
| WebSocket client | `new WebSocket()` | Real-time Directus subscriptions |
| Persistent settings | `$UD.setGlobalSettings()` | API URLs, tokens |
| Visual feedback | Canvas API → `setBaseDataIcon` | All dynamic icons |

### What plugins CANNOT do (limitations)

- Direct IPC with other processes (no Node.js IPC, no named pipes from browser context)
- File system access (browser sandbox)
- Native OS notifications (can only trigger via hotkey to other app)
- Guaranteed delivery of events when UlanziStudio not running

### Recommended Integration Pattern

**Every integrative plugin should:**
1. Store `directusUrl` and `directusToken` in **global settings** (configured once via PI)
2. Use `setInterval` for polling at appropriate cadence (1s for timers, 5–30s for task data, 5min for weather)
3. Implement graceful degradation — show "offline" state when API unreachable
4. Write state changes to Directus rather than calling other apps directly (decoupled)

### Global Settings Schema (shared across plugins)

```javascript
// Set once, readable by all plugin actions:
$UD.setGlobalSettings({
  directusUrl: 'http://localhost:8055',
  directusToken: 'your-static-token',
  wispFlowHotkey: 'ctrl+shift+W',
  trelloTauriHotkey: 'ctrl+shift+T',
  activityCheckInIntervalMin: 10,
  weatherApiKey: '...',
  weatherLocation: 'Warsaw',
  homeAssistantUrl: 'http://homeassistant.local:8123',
  homeAssistantToken: '...',
});
```

---

## Plugin Roadmap

### Phase 1 – Foundation (demo plugin already done)
- [x] ClockAction — time display
- [x] CounterAction — generic counter
- [x] StatusAction — CPU monitor

### Phase 2 – Directus Integration
- [ ] **PomodoroAction** (Directus-backed) — replaces standalone pomodoro
- [ ] **ActivityCheckInAction** — 10-min pulse → Wisp Flow trigger
- [ ] Shared `DirectusClient` utility (fetch wrapper with auth, error handling)
- [ ] Settings screen for Directus URL/token (global PI)

### Phase 3 – App Ecosystem
- [ ] **TrelloCardAction** — shows active task from Directus mirror
- [ ] **NotificationsAction** — badge counter, clear on press
- [ ] **WeatherAction** (or **TemperatureAction**) — local/API temperature

### Phase 4 – Advanced
- [ ] **TimerAction** (synced with Tauri clock app via Directus)
- [ ] Pomodoro Web App (React + Directus — separate repo)
- [ ] Wisp Flow local HTTP bridge (if custom protocol not feasible)

---

## Open Questions

1. **Voice recognition tool**: Which external tool handles transcription? Does it POST to Directus directly, or needs a bridge?

2. **Pomodoro Web App**: New repo or subfolder in this monorepo?

3. **Tauri App schema**: What Directus collection/fields does the Tauri app write? What data is available for Ulanzi to display?

4. **Wisp Flow hotkey**: What is the exact hotkey to trigger recording?

---

## Definition of "Integration Ready" Plugin

A plugin action is considered **ecosystem-ready** when it:
- Reads initial state from Directus on `onAdd`
- Polls Directus at appropriate interval on `onSetActive(true)`
- Writes state changes to Directus on user interaction
- Handles API errors gracefully (shows error icon, retries with backoff)
- Stores its API config in global settings (not hardcoded)
- Documents which Directus collections it reads/writes in its file header
