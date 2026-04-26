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
    const ms = Math.max(1, state.settings.refreshMin || 15) * 60 * 1000;
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
   * Map a WMO weather code to a {emoji, label} pair.
   * @param {number|null} code
   * @returns {{ emoji: string, label: string }}
   */
  _describeCode(code) {
    if (code === null || code === undefined) return { emoji: '—', label: '' };
    if (code === 0) return { emoji: '☀', label: 'Clear' };
    if (code === 1) return { emoji: '🌤', label: 'Mainly clear' };
    if (code === 2) return { emoji: '⛅', label: 'Partly cloudy' };
    if (code === 3) return { emoji: '☁', label: 'Overcast' };
    if (code === 45 || code === 48) return { emoji: '🌫', label: 'Fog' };
    if (code >= 51 && code <= 57) return { emoji: '🌦', label: 'Drizzle' };
    if (code >= 61 && code <= 67) return { emoji: '🌧', label: 'Rain' };
    if (code >= 71 && code <= 77) return { emoji: '🌨', label: 'Snow' };
    if (code >= 80 && code <= 82) return { emoji: '🌦', label: 'Showers' };
    if (code >= 85 && code <= 86) return { emoji: '🌨', label: 'Snow showers' };
    if (code >= 95 && code <= 99) return { emoji: '⛈', label: 'Thunderstorm' };
    return { emoji: '—', label: `Code ${code}` };
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
      this.renderText(ctx, '⚠', SIZE / 2, 90, {
        font: '52px sans-serif',
        color: '#f85149',
      });
      this.renderText(ctx, 'OFFLINE', SIZE / 2, 138, {
        font: 'bold 18px sans-serif',
        color: '#f85149',
      });
      this.renderText(ctx, ps.error.slice(0, 20), SIZE / 2, 168, {
        font: '11px sans-serif',
        color: 'rgba(255,255,255,0.4)',
      });
    } else if (ps.temp === null) {
      this.renderText(ctx, ps.loading ? '…' : '—', SIZE / 2, 110, {
        font: '64px sans-serif',
        color: 'rgba(255,255,255,0.4)',
      });
    } else {
      const unitChar = s.units === 'fahrenheit' ? '°F' : '°C';
      const tempStr = `${Math.round(ps.temp)}${unitChar}`;
      const { emoji, label } = this._describeCode(ps.code);

      // Big temperature
      this.renderText(ctx, tempStr, SIZE / 2, 96, {
        font: 'bold 58px sans-serif',
        color: '#ffffff',
      });

      // Weather emoji
      this.renderText(ctx, emoji, SIZE / 2, 148, {
        font: '38px sans-serif',
        color: '#ffffff',
      });

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
