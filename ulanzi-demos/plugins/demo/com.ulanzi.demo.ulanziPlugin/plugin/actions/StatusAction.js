/**
 * @file StatusAction.js
 * @description CPU usage monitor action for the Ulanzi D200.
 * Reads CPU metrics via Node.js os.cpus() (available through UsePrivateApi).
 * Measures usage by comparing two samples separated by the configured interval.
 * Fires a toast alert when usage exceeds the configured threshold.
 */

import { BaseAction } from './BaseAction.js';

/** @type {{ alertThreshold: number, intervalSec: number, showCores: boolean }} */
const DEFAULT_SETTINGS = {
  alertThreshold: 80,
  intervalSec: 2,
  showCores: true,
};

/** @typedef {{ idle: number, total: number }} CpuSample */

export class StatusAction extends BaseAction {
  constructor(api, actionUUID) {
    super(api, actionUUID);
    /** @type {Map<string, CpuSample>} context → last CPU sample */
    this._lastSample = new Map();
    /** @type {Map<string, boolean>} context → whether alert was already sent */
    this._alerted = new Map();
  }

  /** @param {string} context */
  onInit(context) {
    this.$UD.getSettings(context);
    this._restartInterval(context);
  }

  /** @param {string} context */
  onSetActive(context) {
    this._stopInterval(context);
    this._restartInterval(context);
  }

  /** @param {string} context @param {number} _elapsed */
  onPress(context, _elapsed) {
    // Reset alert state so the next threshold crossing fires a new toast
    this._alerted.set(context, false);
    this.$UD.toast('CPU monitor active');
  }

  /**
   * @param {string} context
   * @param {{ alertThreshold?: number, intervalSec?: number, showCores?: boolean }} payload
   */
  onSettings(context, payload) {
    const state = this._buttons.get(context);
    if (!state) return;
    state.settings = { ...DEFAULT_SETTINGS, ...state.settings, ...payload };
    this.$UD.setSettings(context, state.settings);
    this._restartInterval(context);
  }

  /** @param {string} context */
  render(context) {
    const state = this._buttons.get(context);
    if (!state) return;
    const settings = { ...DEFAULT_SETTINGS, ...state.settings };

    const usage = this._measureCpuUsage(context);
    const coreCount = (window.os && window.os.cpus) ? window.os.cpus().length : 0;

    // Threshold-based color
    let color;
    if (usage >= settings.alertThreshold) {
      color = '#f85149'; // red
      if (!this._alerted.get(context)) {
        this._alerted.set(context, true);
        this.$UD.toast(`CPU alert: ${usage}%`);
      }
    } else if (usage >= settings.alertThreshold * 0.75) {
      color = '#ffaa00'; // yellow
      this._alerted.set(context, false);
    } else {
      color = '#39d353'; // green
      this._alerted.set(context, false);
    }

    const { canvas, ctx } = this.createCanvas(72, 72);

    // Dynamic background derived from alert color
    const bgAlpha = 0.18;
    ctx.fillStyle = `rgba(0,0,0,0.92)`;
    ctx.fillRect(0, 0, 72, 72);
    ctx.fillStyle = color.replace(/^#/, '') ? this._hexToRgba(color, bgAlpha) : 'transparent';
    ctx.fillRect(0, 0, 72, 72);

    // "CPU" label – top left
    this.renderText(ctx, 'CPU', 8, 14, {
      font: '10px sans-serif',
      color: '#ffffff',
      align: 'left',
    });

    // Usage percentage – centre
    this.renderText(ctx, `${usage}%`, 36, 46, {
      font: 'bold 28px monospace',
      color: '#ffffff',
    });

    // Progress bar – 60×6px at y=50
    this.renderProgressBar(ctx, usage, 100, 6, 52, 60, 6, color);

    // Core count – bottom right
    if (settings.showCores && coreCount > 0) {
      this.renderText(ctx, `${coreCount} cores`, 66, 68, {
        font: '9px sans-serif',
        color: 'rgba(255,255,255,0.6)',
        align: 'right',
      });
    }

    const base64 = this.canvasToBase64(canvas);
    this.$UD.setBaseDataIcon(context, base64, '');
  }

  // ---------------------------------------------------------------------------
  // CPU measurement
  // ---------------------------------------------------------------------------

  /**
   * Calculates CPU usage (0-100) by delta between two os.cpus() samples.
   * Falls back to 0 if os module is unavailable.
   * @param {string} context
   * @returns {number}
   */
  _measureCpuUsage(context) {
    if (!window.os || !window.os.cpus) return 0;

    const cores = window.os.cpus();
    let idle = 0;
    let total = 0;
    for (const core of cores) {
      for (const [, val] of Object.entries(core.times)) {
        total += val;
      }
      idle += core.times.idle;
    }

    const prev = this._lastSample.get(context) || { idle: 0, total: 0 };
    this._lastSample.set(context, { idle, total });

    const deltaTotal = total - prev.total;
    const deltaIdle  = idle  - prev.idle;
    if (deltaTotal === 0) return 0;
    return Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** @param {string} context */
  _restartInterval(context) {
    this._stopInterval(context);
    const state = this._buttons.get(context);
    if (!state) return;
    const settings = { ...DEFAULT_SETTINGS, ...state.settings };
    const ms = settings.intervalSec * 1000;
    state.intervalId = setInterval(() => this.render(context), ms);
    this.render(context);
  }

  /** @param {string} context */
  _stopInterval(context) {
    const state = this._buttons.get(context);
    if (!state || state.intervalId === null) return;
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  /**
   * Converts a hex color string to rgba().
   * @param {string} hex - e.g. '#f85149'
   * @param {number} alpha
   * @returns {string}
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

export default StatusAction;
