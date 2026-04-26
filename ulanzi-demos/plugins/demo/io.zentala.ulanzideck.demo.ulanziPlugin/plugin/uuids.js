/**
 * @file uuids.js
 * @description Single source of truth for plugin and action UUIDs.
 * Loaded as a global script in app.html and in every Property Inspector,
 * and required by Jest tests via module.exports. Keep in sync with manifest.json.
 */
const UUIDS = Object.freeze({
  PLUGIN: 'io.zentala.ulanzideck.demo',
  CLOCK: 'io.zentala.ulanzideck.demo.clock',
  COUNTER: 'io.zentala.ulanzideck.demo.counter',
  STATUS: 'io.zentala.ulanzideck.demo.status',
  CALENDAR: 'io.zentala.ulanzideck.demo.calendar',
  POMODORO: 'io.zentala.ulanzideck.demo.pomodoro',
  WEATHER: 'io.zentala.ulanzideck.demo.weather',
});

if (typeof module !== 'undefined') module.exports = { UUIDS };
