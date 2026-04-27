/**
 * @file WeatherAction.js
 * @description Current weather conditions from Open-Meteo (open-meteo.com).
 *
 * Why Open-Meteo: free, no API key, no signup, CORS-enabled, surprisingly accurate.
 * Endpoint: https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,weather_code
 *
 * Settings (Property Inspector):
 *   - latitude / longitude (decimal degrees)
 *   - locationLabel       (≤4 chars, shown above the temperature)
 *   - units               'celsius' | 'fahrenheit'
 *   - refreshMin          poll interval in minutes (default 15)
 *
 * Display: top label, large temperature, weather emoji + short condition.
 * On press: forces an immediate refetch.
 *
 * WMO weather codes mapped from https://open-meteo.com/en/docs (Weather variable docs).
 */
// eslint-disable-next-line no-unused-vars
class WeatherAction extends BaseAction {
  constructor() {
    super();
    /** @type {Object.<string, {temp:number|null,code:number|null,error:string|null,loading:boolean}>} */
    this._state = {};
  }

  _defaultSettings() {
    return {
      latitude: 52.23,
      longitude: 21.01,
      locationLabel: 'WAW',
      units: 'celsius',
      refreshMin: 15,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onInit(context) {
    this._state[context] = { temp: null, code: null, error: null, loading: true };
    this._restartInterval(context);
  }

  onSetActive(context, active) {
    if (active) this._restartInterval(context);
    else this._stopInterval(context);
  }

  onPress(context) {
    this._fetchWeather(context);
  }

  onSettings(context, _params) {
    this._restartInterval(context);
  }

  handleClear(context) {
    super.handleClear(context);
    delete this._state[context];
  }

  _restartInterval(context) {
    const state = this._buttons[context];
    if (!state) return;
    // Floor at 5 minutes — open-meteo's free tier asks consumers to be
    // reasonable. Defaults to 15. Lower values get clamped silently.
    const ms = Math.max(5, state.settings.refreshMin || 15) * 60 * 1000;
    this._startInterval(context, ms, () => this._fetchWeather(context));
    this._fetchWeather(context);
    this.render(context);
  }

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  _fetchWeather(context) {
    const state = this._buttons[context];
    const ps = this._state[context];
    if (!state || !ps) return;
    const s = state.settings;
    const tempUnit = s.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${encodeURIComponent(s.latitude)}` +
      `&longitude=${encodeURIComponent(s.longitude)}` +
      '&current=temperature_2m,weather_code' +
      `&temperature_unit=${tempUnit}`;

    ps.loading = true;
    this.render(context);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const cur = data && data.current;
        if (!cur || typeof cur.temperature_2m !== 'number') {
          throw new Error('malformed response');
        }
        ps.temp = cur.temperature_2m;
        ps.code = typeof cur.weather_code === 'number' ? cur.weather_code : null;
        ps.error = null;
        ps.loading = false;
        this.render(context);
      })
      .catch((err) => {
        ps.error = (err && err.message) || 'fetch failed';
        ps.loading = false;
        this.render(context);
      });
  }

  // ---------------------------------------------------------------------------
  // Weather code mapping (WMO)
  // ---------------------------------------------------------------------------

  /**
   * Map a WMO weather code to an icon type + human label.
   * iconType drives _drawWeatherIcon — vector primitives, font-independent.
   * (Earlier versions used emoji; replaced because Chromium emoji font fallback
   * is not guaranteed on every Ulanzi runtime build.)
   *
   * @param {number|null} code
   * @returns {{ iconType: string, label: string }}
   */
  _describeCode(code) {
    if (code === null || code === undefined) return { iconType: 'none', label: '' };
    if (code === 0) return { iconType: 'sun', label: 'Clear' };
    if (code === 1) return { iconType: 'sun-cloud', label: 'Mainly clear' };
    if (code === 2) return { iconType: 'sun-cloud', label: 'Partly cloudy' };
    if (code === 3) return { iconType: 'cloud', label: 'Overcast' };
    if (code === 45 || code === 48) return { iconType: 'fog', label: 'Fog' };
    if (code >= 51 && code <= 57) return { iconType: 'drizzle', label: 'Drizzle' };
    if (code >= 61 && code <= 67) return { iconType: 'rain', label: 'Rain' };
    if (code >= 71 && code <= 77) return { iconType: 'snow', label: 'Snow' };
    if (code >= 80 && code <= 82) return { iconType: 'rain', label: 'Showers' };
    if (code >= 85 && code <= 86) return { iconType: 'snow', label: 'Snow showers' };
    if (code >= 95 && code <= 99) return { iconType: 'thunderstorm', label: 'Thunderstorm' };
    return { iconType: 'none', label: `Code ${code}` };
  }

  /**
   * Draw a small weather icon using only canvas vector primitives.
   * No font dependencies — works wherever Canvas2D works.
   * Origin (cx, cy) is the icon centre. Each icon fits inside ~size×size box.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} iconType  one of: sun, sun-cloud, cloud, fog, drizzle, rain, snow, thunderstorm, none
   * @param {number} cx
   * @param {number} cy
   * @param {number} size  bounding box edge length
   */
  _drawWeatherIcon(ctx, iconType, cx, cy, size) {
    const r = size / 2;
    ctx.save();

    // ---- Helpers
    /** Draw a filled circle. */
    const circle = (x, y, rad, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    };
    /** Draw a stylised cloud (4 overlapping circles + base bar). */
    const cloud = (x, y, scale = 1, fill = '#e8eef7') => {
      const u = scale;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x - 9 * u, y, 7 * u, 0, Math.PI * 2);
      ctx.arc(x, y - 4 * u, 9 * u, 0, Math.PI * 2);
      ctx.arc(x + 9 * u, y, 7 * u, 0, Math.PI * 2);
      ctx.arc(x, y + 4 * u, 11 * u, 0, Math.PI * 2);
      ctx.fill();
    };
    /** Draw N short vertical lines below a point. */
    const drops = (x, y, n, len, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const spread = 14;
      for (let i = 0; i < n; i++) {
        const dx = x + (i - (n - 1) / 2) * (spread / Math.max(1, n - 1));
        ctx.beginPath();
        ctx.moveTo(dx, y);
        ctx.lineTo(dx, y + len);
        ctx.stroke();
      }
    };

    if (iconType === 'sun') {
      // Sun + 8 rays
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r * 0.65), cy + Math.sin(a) * (r * 0.65));
        ctx.lineTo(cx + Math.cos(a) * (r * 0.95), cy + Math.sin(a) * (r * 0.95));
        ctx.stroke();
      }
      circle(cx, cy, r * 0.45, '#ffd54f');
    } else if (iconType === 'sun-cloud') {
      // Sun top-right peeking out behind a cloud
      circle(cx + r * 0.35, cy - r * 0.35, r * 0.32, '#ffd54f');
      // Sun rays (short)
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 4 + (i - 2) * 0.4;
        const sx = cx + r * 0.35 + Math.cos(a) * r * 0.42;
        const sy = cy - r * 0.35 + Math.sin(a) * r * 0.42;
        const ex = cx + r * 0.35 + Math.cos(a) * r * 0.55;
        const ey = cy - r * 0.35 + Math.sin(a) * r * 0.55;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      cloud(cx - 2, cy + 4, 0.95);
    } else if (iconType === 'cloud') {
      cloud(cx, cy, 1.1);
    } else if (iconType === 'fog') {
      // 3 stacked horizontal bars
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const off = -r * 0.5 + i * (r * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, cy + off);
        ctx.lineTo(cx + r * 0.7, cy + off);
        ctx.stroke();
      }
    } else if (iconType === 'drizzle') {
      cloud(cx, cy - r * 0.2, 0.95);
      drops(cx, cy + r * 0.4, 3, 6, '#4fc3f7');
    } else if (iconType === 'rain') {
      cloud(cx, cy - r * 0.2, 0.95);
      drops(cx, cy + r * 0.4, 3, 12, '#4fc3f7');
    } else if (iconType === 'snow') {
      cloud(cx, cy - r * 0.2, 0.95);
      // 3 snowflake dots
      const sy = cy + r * 0.5;
      circle(cx - 8, sy, 2.5, '#ffffff');
      circle(cx, sy + 3, 2.5, '#ffffff');
      circle(cx + 8, sy, 2.5, '#ffffff');
    } else if (iconType === 'thunderstorm') {
      cloud(cx, cy - r * 0.2, 0.95);
      // Lightning bolt zigzag
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 4);
      ctx.lineTo(cx + 5, cy + 4);
      ctx.lineTo(cx - 1, cy + 14);
      ctx.lineTo(cx + 6, cy + 14);
      ctx.lineTo(cx - 4, cy + 26);
      ctx.lineTo(cx + 1, cy + 16);
      ctx.lineTo(cx - 6, cy + 16);
      ctx.closePath();
      ctx.fill();
    } else {
      // 'none' — short dash
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(cx - 8, cy - 1, 16, 2);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const ps = this._state[context] || { temp: null, code: null, error: null, loading: false };

    const SIZE = 196;
    const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

    // Background
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Top — location label
    this.renderText(ctx, (s.locationLabel || '').toUpperCase(), SIZE / 2, 26, {
      font: 'bold 18px sans-serif',
      color: 'rgba(255,255,255,0.55)',
    });

    if (ps.error) {
      // Triangle warning glyph drawn with primitives (no font dependency)
      ctx.fillStyle = '#f85149';
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, 60);
      ctx.lineTo(SIZE / 2 - 24, 102);
      ctx.lineTo(SIZE / 2 + 24, 102);
      ctx.closePath();
      ctx.fill();
      // exclamation mark cut-out
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(SIZE / 2 - 2, 76, 4, 14);
      ctx.fillRect(SIZE / 2 - 2, 94, 4, 4);

      this.renderText(ctx, 'OFFLINE', SIZE / 2, 132, {
        font: 'bold 18px sans-serif',
        color: '#f85149',
      });
      this.renderText(ctx, ps.error.slice(0, 20), SIZE / 2, 162, {
        font: '11px sans-serif',
        color: 'rgba(255,255,255,0.4)',
      });
    } else if (ps.temp === null) {
      // Loading: 3 dots; idle: dash. Both font-independent.
      if (ps.loading) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(SIZE / 2 - 16 + i * 16, SIZE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(SIZE / 2 - 16, SIZE / 2 - 2, 32, 4);
      }
    } else {
      const unitChar = s.units === 'fahrenheit' ? '°F' : '°C';
      const tempStr = `${Math.round(ps.temp)}${unitChar}`;
      const { iconType, label } = this._describeCode(ps.code);

      // Big temperature
      this.renderText(ctx, tempStr, SIZE / 2, 96, {
        font: 'bold 58px sans-serif',
        color: '#ffffff',
      });

      // Weather icon (vector — no emoji font needed)
      this._drawWeatherIcon(ctx, iconType, SIZE / 2, 150, 36);

      // Condition label
      if (label) {
        this.renderText(ctx, label, SIZE / 2, 180, {
          font: '13px sans-serif',
          color: 'rgba(255,255,255,0.6)',
        });
      }
    }

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
