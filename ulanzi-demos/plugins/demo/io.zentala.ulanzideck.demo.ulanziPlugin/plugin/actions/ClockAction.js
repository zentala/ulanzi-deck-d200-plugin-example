/**
 * @file ClockAction.js
 * @description Digital clock action. Shows date on top, HH:MM large in centre,
 * timezone code + offset at bottom. Animated seconds-progress border (2px, r=6).
 * Updates every second via setInterval. Press to toggle timezone: Warsaw ↔ Jakarta.
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
    super.handleClear(context);
    delete this._timezone[context];
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;

    const tz = this._timezone[context] || 'PL';
    const tzName = tz === 'PL' ? 'Europe/Warsaw' : 'Asia/Jakarta';
    const now = new Date();

    // HH:MM
    const timeStr = now.toLocaleTimeString('en-GB', {
      timeZone: tzName,
      hour: '2-digit',
      minute: '2-digit',
    });

    // "MON 14 MAR"
    const dateStr = now
      .toLocaleDateString('en-US', {
        timeZone: tzName,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      .toUpperCase();

    // Timezone abbreviation — 'short' is universally supported
    const tzAbbr =
      new Intl.DateTimeFormat('en-US', {
        timeZone: tzName,
        timeZoneName: 'short',
      })
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')?.value || (tz === 'PL' ? 'CET' : 'WIB');

    // Bottom label: "PL · CET" or "JKT · WIB"
    const tzLabel = tz === 'PL' ? 'PL' : 'JKT';
    const tzLine = `${tzLabel} · ${tzAbbr}`;

    const sec = now.getSeconds();
    const SIZE = 196;
    const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, s.bgColor || '#0d1117');
    grad.addColorStop(1, '#1a2332');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Seconds-progress border — 2px stroke, r=6
    // Perimeter: 2*(w-2r) + 2*(h-2r) + 2*PI*r  where w=h=190, r=6
    const bx = 3,
      by = 3,
      bw = 190,
      bh = 190,
      br = 6;
    const perimeter = 2 * (bw - 2 * br) + 2 * (bh - 2 * br) + 2 * Math.PI * br;
    const dashLen = (sec / 60) * perimeter;

    /**
     * Draws a clockwise rounded-rect path starting from top-left corner.
     * @param {CanvasRenderingContext2D} c
     */
    function roundedRectPath(c) {
      c.beginPath();
      c.moveTo(bx + br, by);
      c.lineTo(bx + bw - br, by);
      c.arcTo(bx + bw, by, bx + bw, by + br, br);
      c.lineTo(bx + bw, by + bh - br);
      c.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
      c.lineTo(bx + br, by + bh);
      c.arcTo(bx, by + bh, bx, by + bh - br, br);
      c.lineTo(bx, by + br);
      c.arcTo(bx, by, bx + br, by, br);
      c.closePath();
    }

    if (sec > 0) {
      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([dashLen, perimeter - dashLen]);
      ctx.lineDashOffset = 0;
      roundedRectPath(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // TOP — date: "MON 14 MAR"
    if (s.showDate) {
      this.renderText(ctx, dateStr, 98, 34, {
        font: "14px 'Courier New', monospace",
        color: '#8b949e',
      });
    }

    // CENTRE — time: "09:41"
    this.renderText(ctx, timeStr, 98, 112, {
      font: "bold 58px 'Courier New', monospace",
      color: s.textColor || '#ffffff',
    });

    // BOTTOM — timezone: "PL · CET+1"
    this.renderText(ctx, tzLine, 98, 170, {
      font: "13px 'Courier New', monospace",
      color: '#6a8caf',
    });

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
