/**
 * @file CounterAction.js
 * @description Tap-to-count button action with configurable step, direction, and colors.
 * Short press: increment or decrement. Long press (>600 ms): reset to zero.
 * Dial rotation also adjusts the counter value.
 */

import { BaseAction } from './BaseAction.js';

/** @type {{ step: number, direction: string, bgColor: string, incrementColor: string, decrementColor: string }} */
const DEFAULT_SETTINGS = {
  step: 1,
  direction: 'increment',
  bgColor: '#1a1a2e',
  incrementColor: '#39d353',
  decrementColor: '#f85149',
};

/** Long-press threshold in milliseconds. */
const LONG_PRESS_MS = 600;

export class CounterAction extends BaseAction {
  constructor(api, actionUUID) {
    super(api, actionUUID);
    /** @type {Map<string, number>} context → current counter value */
    this._values = new Map();
  }

  /** @param {string} context */
  onInit(context) {
    this.$UD.getSettings(context);
    if (!this._values.has(context)) this._values.set(context, 0);
    this.render(context);
  }

  /**
   * Handles short press (increment/decrement) and long press (reset).
   * @param {string} context
   * @param {number} elapsed - ms since keyDown
   */
  onPress(context, elapsed) {
    const state = this._buttons.get(context);
    if (!state) return;

    if (elapsed >= LONG_PRESS_MS) {
      // Long press → reset
      this._values.set(context, 0);
      state.wasLongPress = true;
      this.$UD.toast('Counter reset');
    } else {
      // Short press → apply step
      if (state.wasLongPress) {
        state.wasLongPress = false;
        return; // swallow the keyUp that follows a long press
      }
      const settings = { ...DEFAULT_SETTINGS, ...state.settings };
      const delta = settings.direction === 'decrement' ? -settings.step : settings.step;
      const current = this._values.get(context) || 0;
      this._values.set(context, current + delta);
    }

    this.$UD.setSettings(context, { value: this._values.get(context) });
    this.render(context);
  }

  /**
   * Dial rotation adjusts value by ticks × step.
   * @param {string} context
   * @param {number} ticks - positive = clockwise, negative = counter-clockwise
   */
  onDialRotate(context, ticks) {
    const state = this._buttons.get(context);
    if (!state) return;
    const settings = { ...DEFAULT_SETTINGS, ...state.settings };
    const delta = ticks * settings.step;
    const current = this._values.get(context) || 0;
    this._values.set(context, current + delta);
    this.$UD.setSettings(context, { value: this._values.get(context) });
    this.render(context);
  }

  /**
   * Handles messages from the Property Inspector.
   * Supports { action: 'reset' } to zero the counter from the PI panel.
   * @param {string} context
   * @param {object} payload
   */
  onSettings(context, payload) {
    const state = this._buttons.get(context);
    if (!state) return;

    if (payload && payload.action === 'reset') {
      this._values.set(context, 0);
      this.$UD.toast('Counter reset');
    } else {
      state.settings = { ...DEFAULT_SETTINGS, ...state.settings, ...payload };
      this.$UD.setSettings(context, state.settings);
    }
    this.render(context);
  }

  /** @param {string} context */
  render(context) {
    const state = this._buttons.get(context);
    if (!state) return;
    const settings = { ...DEFAULT_SETTINGS, ...state.settings };
    const value = this._values.get(context) || 0;

    const { canvas, ctx } = this.createCanvas(72, 72);

    // Background
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, 72, 72);

    // "COUNTER" label – top centre
    this.renderText(ctx, 'COUNTER', 36, 14, {
      font: '10px sans-serif',
      color: '#8b949e',
    });

    // Value – bold, coloured by sign
    const valueColor = value >= 0 ? settings.incrementColor : settings.decrementColor;
    this.renderText(ctx, String(value), 36, 46, {
      font: 'bold 28px monospace',
      color: valueColor,
    });

    // Step indicator – bottom centre
    const sign = settings.direction === 'decrement' ? '-' : '+';
    this.renderText(ctx, `step: ${sign}${settings.step}`, 36, 66, {
      font: '10px sans-serif',
      color: '#8b949e',
    });

    const base64 = this.canvasToBase64(canvas);
    this.$UD.setBaseDataIcon(context, base64, '');
  }
}

export default CounterAction;
