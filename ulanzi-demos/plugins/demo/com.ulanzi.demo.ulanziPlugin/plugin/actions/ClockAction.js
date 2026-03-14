/**
 * @file ClockAction.js
 * @description Digital clock action. Shows HH:MM (large), date below, and
 * an animated seconds-progress border arc drawn clockwise around the button.
 * Updates every second via setInterval.
 */
class ClockAction extends BaseAction {
  _defaultSettings() {
    return { bgColor: '#0d1117', textColor: '#ffffff', showDate: true };
  }

  onInit(context) {
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
    $UD.toast('Clock running');
  }

  onSettings(context, params) {
    this.render(context);
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;

    const now  = new Date();
    const hh   = String(now.getHours()).padStart(2, '0');
    const mm   = String(now.getMinutes()).padStart(2, '0');
    const sec  = now.getSeconds();
    const timeStr = `${hh}:${mm}`;

    const days   = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;

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
    const bx = 3, by = 3, bw = 190, bh = 190, br = 4;
    const perimeter = 2 * (bw - 2 * br) + 2 * (bh - 2 * br) + 2 * Math.PI * br;
    const dashLen   = (sec / 60) * perimeter;

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
      c.arcTo(bx + bw, by,      bx + bw, by + br,      br);
      // Right edge → bottom-right arc
      c.lineTo(bx + bw, by + bh - br);
      c.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
      // Bottom edge → bottom-left arc
      c.lineTo(bx + br, by + bh);
      c.arcTo(bx,       by + bh, bx,       by + bh - br, br);
      // Left edge → top-left arc
      c.lineTo(bx, by + br);
      c.arcTo(bx, by,       bx + br, by,       br);
      c.closePath();
    }

    if (sec > 0) {
      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth   = 3;
      ctx.setLineDash([dashLen, perimeter - dashLen]);
      ctx.lineDashOffset = 0;
      roundedRectPath(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Time — large, bold, centered
    this.renderText(ctx, timeStr, 98, 90, {
      font: 'bold 52px monospace', color: s.textColor || '#ffffff',
    });

    // Date below
    if (s.showDate) {
      this.renderText(ctx, dateStr, 98, 148, {
        font: '20px sans-serif', color: '#8b949e',
      });
    }

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
