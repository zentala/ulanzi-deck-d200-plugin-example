/**
 * @file ClockAction.js
 * @description Displays a live digital clock on a D200 button key.
 * Updates every second via setInterval. Shows time (HH:MM or HH:MM:SS)
 * and optional date line. Background uses a subtle dark gradient.
 */

import { BaseAction } from './BaseAction.js';

/** @type {{ bgColor: string, textColor: string, showSeconds: boolean, showDate: boolean }} */
const DEFAULT_SETTINGS = {
  bgColor: '#0d1117',
  textColor: '#ffffff',
  showSeconds: true,
  showDate: true,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class ClockAction extends BaseAction {
  constructor(api, actionUUID) {
    super(api, actionUUID);
  }

  /** @param {string} context */
  onInit(context) {
    this.$UD.getSettings(context);
    this._startInterval(context);
  }

  /** @param {string} context */
  onSetActive(context) {
    this._stopInterval(context);
    this._startInterval(context);
  }

  /** @param {string} context @param {number} _elapsed */
  onPress(context, _elapsed) {
    this.$UD.toast('Clock running');
  }

  /**
   * @param {string} context
   * @param {{ bgColor?: string, textColor?: string, showSeconds?: boolean, showDate?: boolean }} payload
   */
  onSettings(context, payload) {
    const state = this._buttons.get(context);
    if (!state) return;
    state.settings = { ...DEFAULT_SETTINGS, ...state.settings, ...payload };
    this.$UD.setSettings(context, state.settings);
    // Re-render all contexts for this action
    for (const ctx of this._buttons.keys()) this.render(ctx);
  }

  /** @param {string} context */
  render(context) {
    const state = this._buttons.get(context);
    if (!state) return;
    const settings = { ...DEFAULT_SETTINGS, ...state.settings };

    const { canvas, ctx } = this.createCanvas(72, 72);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 72);
    grad.addColorStop(0, settings.bgColor);
    grad.addColorStop(1, '#1a2332');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 72, 72);

    // Border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 71, 71);

    // Time string
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeStr = settings.showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;

    this.renderText(ctx, timeStr, 36, 32, {
      font: 'bold 22px monospace',
      color: settings.textColor,
      align: 'center',
    });

    // Date string
    if (settings.showDate) {
      const day = DAY_NAMES[now.getDay()];
      const date = String(now.getDate()).padStart(2, '0');
      this.renderText(ctx, `${day} ${date}`, 36, 54, {
        font: '12px sans-serif',
        color: '#8b949e',
        align: 'center',
      });
    }

    const base64 = this.canvasToBase64(canvas);
    this.$UD.setBaseDataIcon(context, base64, '');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** @param {string} context */
  _startInterval(context) {
    const state = this._buttons.get(context);
    if (!state || state.intervalId !== null) return;
    state.intervalId = setInterval(() => this.render(context), 1000);
    this.render(context);
  }

  /** @param {string} context */
  _stopInterval(context) {
    const state = this._buttons.get(context);
    if (!state || state.intervalId === null) return;
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

export default ClockAction;
