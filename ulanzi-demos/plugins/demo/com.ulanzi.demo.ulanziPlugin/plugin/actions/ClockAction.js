/**
 * @file ClockAction.js
 * @description Digital clock action. Shows HH:MM (large), date below, and
 * an animated seconds-progress border arc drawn clockwise around the button.
 * Updates every second via setInterval. Press to toggle timezone between
 * Warsaw (PL) and Jakarta (JKT).
 */
// eslint-disable-next-line no-unused-vars
class ClockAction extends BaseAction {
  constructor() {
    super();
    /** @type {Object.<string, string>} context → timezone key ('PL' | 'Asia/Jakarta') */
    this._timezone = {};
  }

  _defaultSettings() {
    return { bgColor: '#0d1117', textColor: '#ffffff', showDate: true };
  }

  onInit(context) {
    this._timezone[context] = 'PL';
    this._startInterval(context, 1000, () => this.render(context));
    this.render(context);
  }

  onSetActive(context, active) {
    if (active) {
      this._startInterval(context, 1000, () => this.render(context));
      this.render(context);
    } else {
      this._stopInterval(context);
    }
  }

  onPress(context) {
    this._timezone[context] = this._timezone[context] === 'PL' ? 'Asia/Jakarta' : 'PL';
    this.render(context);
  }

  onSettings(context, _params) {
    this.render(context);
  }

  handleClear(context) {
    delete this._timezone[context];
    super.handleClear(context);
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;

    const tz = this._timezone[context] || 'PL';
    const tzName = tz === 'PL' ? 'Europe/Warsaw' : 'Asia/Jakarta';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
      timeZone: tzName,
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = now
      .toLocaleDateString('en-US', {
        timeZone: tzName,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      .toUpperCase();
    const tzLabel = tz === 'PL' ? 'PL' : 'JKT';

    const sec = now.getSeconds();

    const SIZE = 196;
    const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, s.bgColor || '#0d1117');
    grad.addColorStop(1, '#1a2332');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Seconds progress border using setLineDash on a rounded-rect path
    // Perimeter: 2*(w-2r) + 2*(h-2r) + 2*PI*r  where w=h=190, r=4
    const bx = 3,
      by = 3,
      bw = 190,
      bh = 190,
      br = 4;
    const perimeter = 2 * (bw - 2 * br) + 2 * (bh - 2 * br) + 2 * Math.PI * br;
    const dashLen = (sec / 60) * perimeter;

    /**
     * Draws a clockwise rounded-rect path starting from top-left corner arc.
     * @param {CanvasRenderingContext2D} c
     */
    function roundedRectPath(c) {
      c.beginPath();
      // Start at top edge after top-left arc
      c.moveTo(bx + br, by);
      // Top edge → top-right arc
      c.lineTo(bx + bw - br, by);
      c.arcTo(bx + bw, by, bx + bw, by + br, br);
      // Right edge → bottom-right arc
      c.lineTo(bx + bw, by + bh - br);
      c.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
      // Bottom edge → bottom-left arc
      c.lineTo(bx + br, by + bh);
      c.arcTo(bx, by + bh, bx, by + bh - br, br);
      // Left edge → top-left arc
      c.lineTo(bx, by + br);
      c.arcTo(bx, by, bx + br, by, br);
      c.closePath();
    }

    if (sec > 0) {
      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 3;
      ctx.setLineDash([dashLen, perimeter - dashLen]);
      ctx.lineDashOffset = 0;
      roundedRectPath(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Time — large, bold, centered
    this.renderText(ctx, timeStr, 98, 82, {
      font: 'bold 52px monospace',
      color: s.textColor || '#ffffff',
    });

    // Date below
    if (s.showDate) {
      this.renderText(ctx, dateStr, 98, 138, {
        font: '20px sans-serif',
        color: '#8b949e',
      });
    }

    // Timezone label — small, grayish-blue, below date
    this.renderText(ctx, tzLabel, 98, 168, {
      font: '16px sans-serif',
      color: '#6a8caf',
    });

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
