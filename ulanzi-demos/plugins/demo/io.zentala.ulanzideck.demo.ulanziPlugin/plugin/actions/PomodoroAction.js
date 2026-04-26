/**
 * @file PomodoroAction.js
 * @description Pomodoro work/break timer action.
 *
 * States: idle → work → (auto) break → idle
 * - Tap while idle: start work session
 * - Tap while work/break: pause / resume
 * - Work reaches 0: auto-switch to break
 * - Break reaches 0: auto-switch to idle
 *
 * Settings: workMin (default 25), breakMin (default 5)
 */
// eslint-disable-next-line no-unused-vars
class PomodoroAction extends BaseAction {
  constructor() {
    super();
    /**
     * Per-context runtime state (separate from settings stored in _buttons).
     * @type {Object.<string, {state: string, remaining: number, total: number, count: number, paused: boolean, autoPaused: boolean}>}
     */
    this._state = {};
  }

  _defaultSettings() {
    return { workMin: 25, breakMin: 5 };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onInit(context) {
    this._state[context] = {
      state: 'idle',
      remaining: 0,
      total: 0,
      count: 0,
      paused: false,
      autoPaused: false,
    };
    this.render(context);
  }

  onSetActive(context, active) {
    const ps = this._state[context];
    if (active) {
      // Resume only if the timer was auto-paused by going inactive (not manually paused)
      if (ps && ps.autoPaused) {
        ps.paused = false;
        ps.autoPaused = false;
        this._startInterval(context, 1000, () => this._tick(context));
      }
      this.render(context);
    } else {
      // Auto-pause the timer when view goes inactive (only if not already paused)
      if (ps && ps.state !== 'idle' && !ps.paused) {
        ps.paused = true;
        ps.autoPaused = true;
        this._stopInterval(context);
      }
    }
  }

  onPress(context) {
    const ps = this._state[context];
    if (!ps) return;

    if (ps.state === 'idle') {
      this._startWork(context);
    } else {
      // Toggle pause / resume
      if (ps.paused) {
        ps.paused = false;
        this._startInterval(context, 1000, () => this._tick(context));
      } else {
        ps.paused = true;
        this._stopInterval(context);
      }
      this.render(context);
    }
  }

  onSettings(context, _params) {
    // If idle, just re-render so preview reflects new durations
    const ps = this._state[context];
    if (ps && ps.state === 'idle') this.render(context);
  }

  handleClear(context) {
    super.handleClear(context);
    delete this._state[context];
  }

  // ---------------------------------------------------------------------------
  // Timer logic
  // ---------------------------------------------------------------------------

  _startWork(context) {
    const s = this._buttons[context].settings;
    const ps = this._state[context];
    const secs = (s.workMin || 25) * 60;
    ps.state = 'work';
    ps.remaining = secs;
    ps.total = secs;
    ps.paused = false;
    this._startInterval(context, 1000, () => this._tick(context));
    this.render(context);
  }

  _startBreak(context) {
    const s = this._buttons[context].settings;
    const ps = this._state[context];
    const secs = (s.breakMin || 5) * 60;
    ps.state = 'break';
    ps.remaining = secs;
    ps.total = secs;
    ps.paused = false;
    this._startInterval(context, 1000, () => this._tick(context));
    this.render(context);
  }

  _tick(context) {
    const ps = this._state[context];
    if (!ps || ps.paused) return;

    ps.remaining -= 1;

    if (ps.remaining <= 0) {
      if (ps.state === 'work') {
        ps.count += 1;
        this._stopInterval(context);
        $UD.toast('\uD83C\uDF45 Work done! Take a break.');
        this._startBreak(context);
      } else if (ps.state === 'break') {
        this._stopInterval(context);
        ps.state = 'idle';
        $UD.toast('\u2615 Break over! Back to work.');
        this.render(context);
      }
      return;
    }

    this.render(context);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const ps = this._state[context];
    if (!ps) return;

    const SIZE = 196;
    const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Colored tint based on state
    if (ps.state === 'work') {
      ctx.fillStyle = 'rgba(196,0,0,0.2)';
      ctx.fillRect(0, 0, SIZE, SIZE);
    } else if (ps.state === 'break') {
      ctx.fillStyle = 'rgba(0,196,0,0.2)';
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // Top label
    let label = 'POMODORO';
    if (ps.state === 'work') label = ps.paused ? 'WORK (PAUSED)' : 'WORK';
    if (ps.state === 'break') label = ps.paused ? 'BREAK (PAUSED)' : 'BREAK';
    this.renderText(ctx, label, SIZE / 2, 28, {
      font: 'bold 22px sans-serif',
      color: '#ffffff',
    });

    if (ps.state === 'idle') {
      // Tomato + tap instruction
      this.renderText(ctx, '\uD83C\uDF45', SIZE / 2, 95, {
        font: '52px sans-serif',
        color: '#ffffff',
      });
      this.renderText(ctx, 'TAP TO START', SIZE / 2, 148, {
        font: '14px sans-serif',
        color: 'rgba(255,255,255,0.5)',
      });
    } else {
      // Countdown mm:ss
      const m = Math.floor(ps.remaining / 60);
      const s = ps.remaining % 60;
      const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      this.renderText(ctx, timeStr, SIZE / 2, 106, {
        font: 'bold 52px monospace',
        color: '#ffffff',
      });

      // Progress arc
      const progress = ps.total > 0 ? (ps.total - ps.remaining) / ps.total : 0;
      const arcColor = ps.state === 'work' ? '#f85149' : '#39d353';
      ctx.save();
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(98, 98, 80, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Bottom: completed pomodoro count
    if (ps.count > 0) {
      this.renderText(ctx, `\uD83C\uDF45\u00D7${ps.count}`, SIZE / 2, 178, {
        font: '16px sans-serif',
        color: 'rgba(255,255,255,0.6)',
      });
    }

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
