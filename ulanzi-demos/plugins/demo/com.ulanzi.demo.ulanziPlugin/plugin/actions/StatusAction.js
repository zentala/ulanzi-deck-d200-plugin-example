/**
 * @file StatusAction.js
 * @description CPU usage monitor. Uses two os.cpus() samples to calculate delta %.
 * Falls back to 0 if os module unavailable.
 */
class StatusAction extends BaseAction {
  constructor() {
    super();
    /** @type {Object.<string, {idle:number,total:number}>} */
    this._lastSample = {};
    /** @type {Object.<string, boolean>} */
    this._alerted = {};
    // Resolve os module once
    this._os = this._resolveOs();
  }

  _resolveOs() {
    if (typeof window !== 'undefined' && window.os && window.os.cpus) return window.os;
    if (typeof global !== 'undefined' && global.os && global.os.cpus) return global.os;
    try { return require('os'); } catch (_) { return null; }
  }

  _defaultSettings() {
    return { alertThreshold: 80, intervalSec: 2, showCores: true };
  }

  onInit(context) {
    this._restartInterval(context);
  }

  onSetActive(context, active) {
    if (active) this._restartInterval(context);
    else this._stopInterval(context);
  }

  onPress(context) {
    this._alerted[context] = false;
    this.render(context);
  }

  onSettings(context, params) {
    this._restartInterval(context);
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const usage     = this._measureCpu(context);
    const threshold = s.alertThreshold || 80;
    const coreCount = this._os ? this._os.cpus().length : 0;

    let color;
    if (usage >= threshold) {
      color = '#f85149';
      if (!this._alerted[context]) {
        this._alerted[context] = true;
        $UD.toast(`CPU alert: ${usage}%`);
      }
    } else if (usage >= threshold * 0.75) {
      color = '#ffaa00';
      this._alerted[context] = false;
    } else {
      color = '#39d353';
      this._alerted[context] = false;
    }

    const { canvas, ctx } = this.createCanvas(72, 72);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 72, 72);
    // Tinted overlay
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    ctx.fillStyle = `rgba(${r},${g},${b},0.18)`;
    ctx.fillRect(0, 0, 72, 72);

    this.renderText(ctx, 'CPU', 8, 12, { font: '10px sans-serif', color: '#ffffff', align: 'left' });
    this.renderText(ctx, `${usage}%`, 36, 38, { font: 'bold 26px monospace', color: '#ffffff' });
    this.renderProgressBar(ctx, usage, 100, 6, 52, 60, 6, color);
    if (s.showCores && coreCount > 0) {
      this.renderText(ctx, `${coreCount} cores`, 65, 65, { font: '9px sans-serif', color: 'rgba(255,255,255,0.5)', align: 'right' });
    }

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }

  _restartInterval(context) {
    const state = this._buttons[context];
    if (!state) return;
    const ms = (state.settings.intervalSec || 2) * 1000;
    this._startInterval(context, ms, () => this.render(context));
    this.render(context);
  }

  _measureCpu(context) {
    if (!this._os) return 0;
    const cores = this._os.cpus();
    let idle = 0, total = 0;
    for (const c of cores) {
      for (const v of Object.values(c.times)) total += v;
      idle += c.times.idle;
    }
    const prev = this._lastSample[context] || { idle: 0, total: 0 };
    this._lastSample[context] = { idle, total };
    const dt = total - prev.total;
    if (dt === 0) return 0;
    return Math.round(((dt - (idle - prev.idle)) / dt) * 100);
  }
}
