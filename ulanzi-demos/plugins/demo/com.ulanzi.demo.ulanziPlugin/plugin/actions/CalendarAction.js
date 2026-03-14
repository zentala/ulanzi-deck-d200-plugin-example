/**
 * @file CalendarAction.js
 * @description Torn-off calendar style action. Displays current day, month
 * name, year, and day-of-week. Refreshes at midnight (polls every 60s).
 */
// eslint-disable-next-line no-unused-vars
class CalendarAction extends BaseAction {
  constructor() {
    super();
    /** @type {Object.<string, number>} Per-context last rendered day-of-month. */
    this._lastDay = {};
  }

  _defaultSettings() {
    return {};
  }

  onInit(context) {
    this._lastDay[context] = -1;
    this.render(context);
    this._startInterval(context, 60000, () => {
      const today = new Date().getDate();
      if (today !== this._lastDay[context]) {
        this._lastDay[context] = today;
        this.render(context);
      }
    });
  }

  onSetActive(context, active) {
    if (active) {
      this.render(context);
      this._startInterval(context, 60000, () => {
        const today = new Date().getDate();
        if (today !== this._lastDay[context]) {
          this._lastDay[context] = today;
          this.render(context);
        }
      });
    } else {
      this._stopInterval(context);
    }
  }

  handleClear(context) {
    super.handleClear(context);
    delete this._lastDay[context];
  }

  onPress(_context) {
    $UD.openUrl('https://calendar.google.com');
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;

    const now = new Date();
    const months = [
      'JANUARY',
      'FEBRUARY',
      'MARCH',
      'APRIL',
      'MAY',
      'JUNE',
      'JULY',
      'AUGUST',
      'SEPTEMBER',
      'OCTOBER',
      'NOVEMBER',
      'DECEMBER',
    ];
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    const monthName = months[now.getMonth()];
    const year = String(now.getFullYear());
    const dayNum = String(now.getDate());
    const dayName = days[now.getDay()];

    const SIZE = 196;
    const HEADER_H = 58;
    const { canvas, ctx } = this.createCanvas(SIZE, SIZE);

    // Full background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Red header strip
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, SIZE, HEADER_H);

    // White body
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, HEADER_H, SIZE, SIZE - HEADER_H);

    // Divider line
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, HEADER_H, SIZE, 1);

    // Month name in header
    this.renderText(ctx, monthName, SIZE / 2, 34, {
      font: 'bold 24px sans-serif',
      color: '#ffffff',
    });

    // Year in header
    this.renderText(ctx, year, SIZE / 2, 52, {
      font: '16px sans-serif',
      color: 'rgba(255,255,255,0.7)',
    });

    // Day number — huge, in white body area
    this.renderText(ctx, dayNum, SIZE / 2, 138, {
      font: 'bold 96px sans-serif',
      color: '#1a1a1a',
    });

    // Day of week
    this.renderText(ctx, dayName, SIZE / 2, 178, {
      font: '14px sans-serif',
      color: '#888888',
    });

    this._lastDay[context] = now.getDate();
    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
