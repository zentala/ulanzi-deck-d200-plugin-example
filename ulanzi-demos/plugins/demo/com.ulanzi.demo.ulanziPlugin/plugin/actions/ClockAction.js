/**
 * @file ClockAction.js
 * @description Digital clock action. Updates every second via setInterval.
 */
class ClockAction extends BaseAction {
  _defaultSettings() {
    return { bgColor: '#0d1117', textColor: '#ffffff', showSeconds: true, showDate: true };
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
    const sec  = String(now.getSeconds()).padStart(2, '0');
    const timeStr = s.showSeconds ? `${hh}:${mm}:${sec}` : `${hh}:${mm}`;
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const dateStr = `${days[now.getDay()]} ${now.getDate()}`;

    const { canvas, ctx } = this.createCanvas(72, 72);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 72);
    grad.addColorStop(0, s.bgColor || '#0d1117');
    grad.addColorStop(1, '#1a2332');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 72, 72);

    // Border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 71, 71);

    // Time
    this.renderText(ctx, timeStr, 36, 32, { font: 'bold 18px monospace', color: s.textColor || '#ffffff' });

    // Date
    if (s.showDate) {
      this.renderText(ctx, dateStr, 36, 54, { font: '11px sans-serif', color: '#8b949e' });
    }

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
