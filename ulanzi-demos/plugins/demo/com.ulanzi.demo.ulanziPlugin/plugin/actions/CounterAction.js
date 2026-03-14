/**
 * @file CounterAction.js
 * @description Tap-to-count action with configurable step, direction, and colors.
 * Settings are persisted via sendParamFromPlugin.
 */
class CounterAction extends BaseAction {
  _defaultSettings() {
    return { step: 1, direction: 'increment', bgColor: '#1a1a2e',
             incrementColor: '#39d353', decrementColor: '#f85149', value: 0 };
  }

  onInit(context) {
    this.render(context);
  }

  onPress(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const delta = s.direction === 'increment' ? Number(s.step) : -Number(s.step);
    s.value = (s.value || 0) + delta;
    $UD.sendParamFromPlugin({ value: s.value }, context);
    this.render(context);
  }

  onSetActive(context, active) {
    if (active) this.render(context);
  }

  onSettings(context, params) {
    if (params && params.action === 'reset') {
      const state = this._buttons[context];
      if (state) {
        state.settings.value = 0;
        $UD.sendParamFromPlugin({ value: 0 }, context);
      }
    }
    this.render(context);
  }

  render(context) {
    const state = this._buttons[context];
    if (!state) return;
    const s = state.settings;
    const value = s.value || 0;

    const { canvas, ctx } = this.createCanvas(72, 72);
    ctx.fillStyle = s.bgColor || '#1a1a2e';
    ctx.fillRect(0, 0, 72, 72);

    // Label
    this.renderText(ctx, 'COUNTER', 36, 12, { font: '9px sans-serif', color: '#8b949e' });

    // Value
    const valueColor = value > 0
      ? (s.incrementColor || '#39d353')
      : value < 0 ? (s.decrementColor || '#f85149') : '#8b949e';
    this.renderText(ctx, String(value), 36, 38, { font: 'bold 26px monospace', color: valueColor });

    // Step hint
    const sign = s.direction === 'increment' ? '+' : '-';
    this.renderText(ctx, `step: ${sign}${s.step}`, 36, 60, { font: '9px sans-serif', color: '#8b949e' });

    $UD.setBaseDataIcon(context, this.canvasToBase64(canvas), '');
  }
}
