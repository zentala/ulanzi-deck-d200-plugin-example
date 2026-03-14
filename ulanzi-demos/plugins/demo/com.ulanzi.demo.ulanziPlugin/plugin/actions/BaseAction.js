/**
 * @file BaseAction.js
 * @description Abstract base for demo plugin actions.
 * Manages lifecycle, canvas utilities, and settings via sendParamFromPlugin.
 */
class BaseAction {
  constructor() {
    /** @type {Object.<string, {settings: object, intervalId: number|null}>} */
    this._buttons = {};
  }

  // --- Lifecycle (called by app.js dispatcher) ---

  handleAdd(jsn) {
    const ctx = jsn.context;
    this._buttons[ctx] = {
      settings: { ...this._defaultSettings() },
      intervalId: null,
    };
    if (jsn.param) {
      this._buttons[ctx].settings = { ...this._buttons[ctx].settings, ...jsn.param };
    }
    this.onInit(ctx);
  }

  handleClear(context) {
    this._stopInterval(context);
    delete this._buttons[context];
  }

  handleSetActive(jsn) {
    // subclasses may override to stop/start interval
    this.onSetActive(jsn.context, jsn.active);
  }

  handleRun(jsn) {
    this.onPress(jsn.context);
  }

  handleParams(jsn) {
    const ctx = jsn.context;
    if (!this._buttons[ctx]) return;
    this._buttons[ctx].settings = { ...this._buttons[ctx].settings, ...jsn.param };
    this.onSettings(ctx, jsn.param);
  }

  // --- Canvas utilities ---

  /** @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }} */
  createCanvas(w = 72, h = 72) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  /** @returns {string} base64 without data: prefix */
  canvasToBase64(canvas) {
    return canvas.toDataURL('image/png').split(',')[1];
  }

  /**
   * Draw text centered at (x, y).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {{ font?: string, color?: string, align?: CanvasTextAlign }} [opts]
   */
  renderText(ctx, text, x, y, opts = {}) {
    ctx.font      = opts.font  || '14px sans-serif';
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a filled progress bar.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} value  current value
   * @param {number} max    maximum value
   * @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {string} color  fill color
   */
  renderProgressBar(ctx, value, max, x, y, w, h, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h);
    const fill = Math.max(0, Math.min(1, value / max)) * w;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, fill, h);
  }

  // --- Internal helpers ---

  _stopInterval(context) {
    const state = this._buttons[context];
    if (state && state.intervalId !== null) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  _startInterval(context, ms, fn) {
    this._stopInterval(context);
    const state = this._buttons[context];
    if (state) state.intervalId = setInterval(fn, ms);
  }

  // --- Abstract (must override) ---
  _defaultSettings() { return {}; }
  onInit(context)            { /* override */ }
  onPress(context)           { /* override */ }
  onSetActive(context, active) { /* override */ }
  onSettings(context, params)  { /* override */ }
  render(context)            { /* override */ }
}
