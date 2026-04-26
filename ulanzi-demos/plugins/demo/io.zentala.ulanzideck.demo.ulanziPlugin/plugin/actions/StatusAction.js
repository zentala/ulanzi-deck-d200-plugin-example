/**
 * @file StatusAction.js
 * @description CPU load + temperature monitor with EMA smoothing and overheat alerts.
 *
 * Data sources (in priority order):
 *   1. LibreHardwareMonitor HTTP API – provides both CPU load% and temperature.
 *      Start LHM → Options → Remote Web Server → Enable (default port 8085).
 *      Free download: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor
 *   2. Web Worker timing benchmark – CPU load estimate when LHM unavailable.
 *      Less accurate; measures JS-thread busyness, not OS-level load.
 *
 * Smoothing: EMA (alpha=0.35) applied to both CPU% and temperature readings.
 *
 * Alerts:
 *   CPU  > cpuThreshold  (default 90%) → orange/red + toast
 *   Temp > tempThreshold (default 85°C) → red + urgent toast
 */
// eslint-disable-next-line no-unused-vars
class StatusAction extends BaseAction {
  constructor() {
    super();
    /** @type {Object.<string, number|null>} */
    this._cpu = {};
    /** @type {Object.<string, number|null>} */
    this._temp = {};
    /** @type {Object.<string, {cpu:boolean,temp:boolean}>} */
    this._alerted = {};
    /** @type {Worker|null} – fallback when LHM unavailable */
    this._worker = this._spawnWorker();
    /** @type {boolean} – true once LHM responds successfully */
    this._lhmAvailable = false;
  }

  // ---------------------------------------------------------------------------
  // Web Worker – fallback CPU load estimation
  // ---------------------------------------------------------------------------

  _spawnWorker() {
    try {
      const code = `
        let baseline = null;
        function bench() {
          const s = performance.now();
          let n = 0;
          while (performance.now() - s < 100) n++;
          return n;
        }
        baseline = bench(); // calibrate on first run (assume idle)
        setInterval(function() {
          const n = bench();
          const load = baseline > 0
            ? Math.max(0, Math.min(100, Math.round((1 - n / baseline) * 100)))
            : 0;
          postMessage(load);
        }, 2000);
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = (e) => {
        if (this._lhmAvailable) return; // LHM is running, ignore worker data
        this._onCpuSample(e.data);
      };
      return worker;
    } catch {
      return null;
    }
  }

  _onCpuSample(raw) {
    for (const ctx of Object.keys(this._buttons)) {
      this._cpu[ctx] = this._smooth(this._cpu[ctx], raw);
      this._checkAlerts(ctx);
      this.render(ctx);
    }
  }

  // ---------------------------------------------------------------------------
  // LibreHardwareMonitor – primary data source
  // ---------------------------------------------------------------------------

  _fetchLHM(context) {
    const state = this._buttons[context];
    if (!state) return;
    const port = state.settings.lhmPort || 8085;

    fetch(`http://localhost:${port}/data.json`)
      .then((r) => r.json())
      .then((data) => {
        this._lhmAvailable = true;
        const { load, temp } = this._scanLHM(data);
        if (load !== null) this._cpu[context] = this._smooth(this._cpu[context], load);
        if (temp !== null) this._temp[context] = this._smooth(this._temp[context], temp);
        this._checkAlerts(context);
        this.render(context);
      })
      .catch(() => {
        this._lhmAvailable = false;
        // keep existing values; Worker provides CPU fallback
      });
  }

  /**
   * Walk LibreHardwareMonitor JSON tree and extract CPU load% and Package temp.
   * LHM structure: root → Hardware[] → Sensor groups → Sensor leaves
   *   Load sensor:  { Text: "CPU Total",   Value: "42.3 %",  SensorType: "Load" }
   *   Temp sensor:  { Text: "CPU Package", Value: "67.0 °C", SensorType: "Temperature" }
   *
   * @param {object} node
   * @param {{ load: number|null, temp: number|null }} [acc]
   * @returns {{ load: number|null, temp: number|null }}
   */
  _scanLHM(node, acc = { load: null, temp: null }) {
    if (!node) return acc;

    const text = (node.Text || '').toLowerCase();
    const val = node.Value || '';

    if (acc.load === null && val.includes('%') && !val.includes('°')) {
      if (text === 'cpu total' || text.includes('cpu total')) {
        const n = parseFloat(val);
        if (!isNaN(n)) acc.load = n;
      }
    }

    if (acc.temp === null && val.includes('°')) {
      if (
        text.includes('package') ||
        text.includes('tdie') ||
        text === 'cpu' ||
        text === 'cpu temp'
      ) {
        const n = parseFloat(val);
        if (!isNaN(n)) acc.temp = n;
      }
    }

    if (Array.isArray(node.Children)) {
      for (const child of node.Children) {
        this._scanLHM(child, acc);
        if (acc.load !== null && acc.temp !== null) break;
      }
    }

    return acc;
  }

  // ---------------------------------------------------------------------------
  // EMA smoothing
  // ---------------------------------------------------------------------------

  /**
   * Exponential moving average.
   * @param {number|null} prev  previous smoothed value
   * @param {number}      next  new raw sample
   * @param {number}      [alpha=0.35]  weight of new sample (0–1)
   * @returns {number}
   */
  _smooth(prev, next, alpha = 0.35) {
    if (prev === null) return Math.round(next);
    return Math.round(alpha * next + (1 - alpha) * prev);
  }

  // ---------------------------------------------------------------------------
  // Alert logic
  // ---------------------------------------------------------------------------

  _checkAlerts(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const al = this._alerted[context] || { cpu: false, temp: false };

    const temp = this._temp[context];
    const cpu = this._cpu[context];

    if (temp !== null && temp >= (s.tempThreshold || 85)) {
      if (!al.temp) {
        al.temp = true;
        $UD.toast(`\uD83D\uDD25 CPU overheat: ${temp.toFixed(0)}\u00B0C`);
      }
    } else {
      al.temp = false;
    }

    if (cpu !== null && cpu >= (s.cpuThreshold || 90)) {
      if (!al.cpu) {
        al.cpu = true;
        $UD.toast(`\u26A0 CPU load: ${cpu}%`);
      }
    } else {
      al.cpu = false;
    }

    this._alerted[context] = al;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  _defaultSettings() {
    return { cpuThreshold: 90, tempThreshold: 85, intervalSec: 3, lhmPort: 8085 };
  }

  onInit(context) {
    this._cpu[context] = null;
    this._temp[context] = null;
    this._alerted[context] = { cpu: false, temp: false };
    this._restartInterval(context);
  }

  onSetActive(context, active) {
    if (active) this._restartInterval(context);
    else this._stopInterval(context);
  }

  onPress(context) {
    this._alerted[context] = { cpu: false, temp: false };
    this._fetchLHM(context);
    this.render(context);
  }

  onSettings(context) {
    this._restartInterval(context);
  }

  handleClear(context) {
    super.handleClear(context);
    delete this._cpu[context];
    delete this._temp[context];
    delete this._alerted[context];
    if (Object.keys(this._buttons).length === 0 && this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }

  _restartInterval(context) {
    const state = this._buttons[context];
    if (!state) return;
    const ms = (state.settings.intervalSec || 3) * 1000;
    this._startInterval(context, ms, () => this._fetchLHM(context));
    this._fetchLHM(context);
    this.render(context);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const cpu = this._cpu[context];
    const temp = this._temp[context];
    const al = this._alerted[context] || {};

    const { canvas, ctx } = this.createCanvas(196, 196);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 196, 196);

    // Alert tint
    if (al.temp || al.cpu) {
      ctx.fillStyle = 'rgba(248,81,73,0.15)';
      ctx.fillRect(0, 0, 196, 196);
    }

    // CPU section (top half)
    this._renderSection(ctx, {
      label: 'CPU',
      value: cpu !== null ? `${cpu}%` : '—',
      hint: cpu !== null ? null : this._lhmAvailable ? null : 'no data',
      barValue: cpu,
      barMax: 100,
      color: this._sectionColor(cpu, s.cpuThreshold || 90),
      y0: 8,
      height: 86,
    });

    // Divider
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(12, 98, 172, 2);

    // TEMP section (bottom half)
    this._renderSection(ctx, {
      label: 'TEMP',
      value: temp !== null ? `${temp.toFixed(0)}\u00B0C` : '—',
      hint: temp !== null ? null : 'install LHM',
      barValue: temp,
      barMax: 110,
      color: this._sectionColor(temp, s.tempThreshold || 85),
      y0: 102,
      height: 86,
    });

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }

  _renderSection(ctx, { label, value, hint, barValue, barMax, color, y0, height }) {
    this.renderText(ctx, label, 14, y0 + 14, {
      font: '18px sans-serif',
      color: 'rgba(255,255,255,0.45)',
      align: 'left',
    });
    this.renderText(ctx, value, 98, y0 + 48, {
      font: 'bold 46px monospace',
      color: '#ffffff',
    });
    if (hint) {
      this.renderText(ctx, hint, 98, y0 + 72, {
        font: '16px sans-serif',
        color: 'rgba(255,255,255,0.3)',
      });
    }
    if (barValue !== null) {
      this.renderProgressBar(ctx, barValue, barMax, 12, y0 + height - 12, 172, 8, color);
    }
  }

  /**
   * @param {number|null} value
   * @param {number}      threshold
   * @returns {string} hex colour
   */
  _sectionColor(value, threshold) {
    if (value === null) return '#444';
    if (value >= threshold) return '#f85149'; // red
    if (value >= threshold * 0.75) return '#ffaa00'; // orange
    return '#39d353'; // green
  }
}
