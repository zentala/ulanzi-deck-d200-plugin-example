/**
 * @file types.d.ts
 * @description Ambient declarations for browser-context globals injected at runtime.
 *
 * $UD is injected by UlanziStudio as window.$UD.
 * UUIDS is defined in plugin/uuids.js and loaded via <script> tag.
 * Action classes (BaseAction and subclasses) are also loaded via <script> tags —
 * their shapes are inferred directly from the .js source files included in the
 * typecheck; no duplicate declarations needed here.
 */

// ---------------------------------------------------------------------------
// UlanziStreamDeck SDK ($UD)
// ---------------------------------------------------------------------------

/** Minimal surface of the UlanziStreamDeck runtime SDK injected as window.$UD. */
interface UlanziStreamDeck {
  /** Connect the plugin, registering the given plugin UUID with UlanziStudio. */
  connect(pluginUUID: string): void;
  /** Fired once the WebSocket connection to UlanziStudio is established. */
  onConnected(callback: () => void): void;
  /** Fired when a button with this plugin's action UUID is added to a slot. */
  onAdd(
    callback: (jsn: { uuid: string; context: string; param?: Record<string, unknown> }) => void
  ): void;
  /** Fired when the user presses a button. */
  onRun(callback: (jsn: { context: string }) => void): void;
  /** Fired when a button slot becomes visible/active. */
  onSetActive(callback: (jsn: { context: string; active: boolean }) => void): void;
  /** Fired with parameters sent from the Property Inspector (app side). */
  onParamFromApp(
    callback: (jsn: { context: string; param: Record<string, unknown> }) => void
  ): void;
  /** Fired with parameters sent from another plugin. */
  onParamFromPlugin(
    callback: (jsn: { context: string; param: Record<string, unknown> }) => void
  ): void;
  /** Fired when button slots are cleared/removed. */
  onClear(callback: (jsn: { param?: Array<{ context: string }> }) => void): void;
  /** Update the button icon using a base64-encoded PNG (without data: prefix). */
  setBaseDataIcon(context: string, base64: string, label: string): void;
  /** Send parameters from the plugin to the Property Inspector. */
  sendParamFromPlugin(params: Record<string, unknown>, context: string): void;
  /** Show a toast notification in UlanziStudio. */
  toast(message: string): void;
  /** Open a URL in the default browser. */
  openUrl(url: string): void;
}

declare const $UD: UlanziStreamDeck;

// ---------------------------------------------------------------------------
// UUIDS constants (plugin/uuids.js)
// ---------------------------------------------------------------------------

/** UUID constants for all plugin actions. Defined in plugin/uuids.js. */
declare const UUIDS: {
  readonly PLUGIN: string;
  readonly CLOCK: string;
  readonly COUNTER: string;
  readonly STATUS: string;
  readonly CALENDAR: string;
  readonly POMODORO: string;
};
