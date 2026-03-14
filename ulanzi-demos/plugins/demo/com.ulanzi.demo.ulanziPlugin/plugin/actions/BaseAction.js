/**
 * @file BaseAction.js
 * @description Abstract base class for all Ulanzi Demo plugin actions.
 * Manages per-button state, wraps SDK calls, and provides canvas utilities.
 */

/** @typedef {{ settings: object, intervalId: number|null, keyDownAt: number|null, wasLongPress: boolean }} ButtonState */

export class BaseAction {
  /**
   * @param {UlanziApi} api - The global $UD SDK instance.
   * @param {string} actionUUID - The action's UUID string.
   */
  constructor(api, actionUUID) {
    /** @type {UlanziApi} */
    this.$UD = api;
    /** @type {string} */
    this.uuid = actionUUID;
    /** @type {Map<string, ButtonState>} */
    this._buttons = new Map();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle handlers (called by app.js dispatcher)
  // ---------------------------------------------------------------------------

  /** @param {string} context @param {object} settings */
  handleAdd(context, settings) {
    this._buttons.set(context, {
      settings: settings || {},
      intervalId: null,
      keyDownAt: null,
      wasLongPress: false,
    });
    this.onInit(context);
  }

  /** @param {string} context */
  handleClear(context) {
    const state = this._buttons.get(context);
    if (state && state.intervalId !== null) {
      clearInterval(state.intervalId);
    }
    this._buttons.delete(context);
  }

  /** @param {string} context @param {object} settings */
  handleRun(context, settings) {
    this._mergeSettings(context, settings);
    this.onInit(context);
  }

  /** @param {string} context @param {object} settings */
  handleKeyDown(context, settings) {
    const state = this._buttons.get(context);
    if (state) state.keyDownAt = Date.now();
  }

  /** @param {string} context @param {object} settings */
  handleKeyUp(context, settings) {
    const state = this._buttons.get(context);
    if (!state) return;
    const elapsed = state.keyDownAt !== null ? Date.now() - state.keyDownAt : 0;
    state.keyDownAt = null;
    this.onPress(context, elapsed);
  }

  /** @param {string} context @param {object} settings */
  handleSetActive(context, settings) {
    this._mergeSettings(context, settings);
    this.onSetActive(context);
  }

  /** @param {string} context @param {object} payload */
  handleParamFromApp(context, payload) {
    this.onSettings(context, payload);
  }

  /** @param {string} context @param {object} settings @param {number} ticks */
  handleDialRotate(context, settings, ticks) {
    this.onDialRotate(context, ticks);
  }

  /** @param {string} context @param {object} settings */
  handleDidReceiveSettings(context, settings) {
    this._mergeSettings(context, settings);
    this.render(context);
  }

  // ---------------------------------------------------------------------------
  // Canvas utilities
  // ---------------------------------------------------------------------------

  /**
   * Creates an off-screen canvas element.
   * @param {number} [w=72] @param {number} [h=72]
   * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
   */
  createCanvas(w = 72, h = 72) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  /**
   * Converts a canvas to a base64-encoded PNG string (without the data: prefix).
   * @param {HTMLCanvasElement} canvas
   * @returns {string}
   */
  canvasToBase64(canvas) {
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }

  /**
   * Draws horizontally-centred text on a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x - Centre x coordinate.
   * @param {number} y - Baseline y coordinate.
   * @param {{ font?: string, color?: string, align?: CanvasTextAlign }} [options]
   */
  renderText(ctx, text, x, y, options = {}) {
    ctx.font = options.font || '14px sans-serif';
    ctx.fillStyle = options.color || '#ffffff';
    ctx.textAlign = options.align || 'center';
    ctx.fillText(text, x, y);
  }

  /**
   * Draws a horizontal progress bar.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} value - Current value.
   * @param {number} max - Maximum value.
   * @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {string} color - Fill color.
   */
  renderProgressBar(ctx, value, max, x, y, w, h, color) {
    const filled = Math.round((Math.min(value, max) / max) * w);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, filled, h);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** @param {string} context @param {object} settings */
  _mergeSettings(context, settings) {
    const state = this._buttons.get(context);
    if (state && settings) state.settings = { ...state.settings, ...settings };
  }

  // ---------------------------------------------------------------------------
  // Abstract methods – subclasses MUST override
  // ---------------------------------------------------------------------------

  /** @param {string} _context */
  onInit(_context) { throw new Error(`${this.constructor.name}.onInit not implemented`); }

  /** @param {string} _context @param {number} _elapsed */
  onPress(_context, _elapsed) { throw new Error(`${this.constructor.name}.onPress not implemented`); }

  /** @param {string} _context @param {object} _payload */
  onSettings(_context, _payload) { throw new Error(`${this.constructor.name}.onSettings not implemented`); }

  /** @param {string} _context */
  render(_context) { throw new Error(`${this.constructor.name}.render not implemented`); }

  /** @param {string} _context */
  onSetActive(_context) { /* optional override */ }

  /** @param {string} _context @param {number} _ticks */
  onDialRotate(_context, _ticks) { /* optional override */ }
}

export default BaseAction;
