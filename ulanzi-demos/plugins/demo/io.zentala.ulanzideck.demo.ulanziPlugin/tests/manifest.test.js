/**
 * @file manifest.test.js
 * @description Consistency check between manifest.json and plugin/uuids.js.
 * Catches the class of bug where one is renamed/added without updating the other —
 * which historically caused a silent breakage (Property Inspector pointed at a stale
 * 3-segment UUID for weeks before anyone noticed).
 */
const path = require('path');
const fs = require('fs');
const { UUIDS } = require('../plugin/uuids.js');

const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

describe('manifest.json ↔ uuids.js consistency', () => {
  test('plugin UUID matches UUIDS.PLUGIN', () => {
    expect(manifest.UUID).toBe(UUIDS.PLUGIN);
  });

  test('every action UUID in manifest exists in UUIDS', () => {
    const uuidValues = new Set(Object.values(UUIDS));
    for (const action of manifest.Actions) {
      expect(uuidValues.has(action.UUID)).toBe(true);
    }
  });

  test('every UUIDS entry (except PLUGIN) has a matching action in manifest', () => {
    const manifestUUIDs = new Set(manifest.Actions.map((a) => a.UUID));
    for (const [key, value] of Object.entries(UUIDS)) {
      if (key === 'PLUGIN') continue;
      expect(manifestUUIDs.has(value)).toBe(true);
    }
  });

  test('every action UUID is prefixed with the plugin UUID', () => {
    for (const action of manifest.Actions) {
      expect(action.UUID.startsWith(`${UUIDS.PLUGIN}.`)).toBe(true);
    }
  });

  test('every action references an existing PropertyInspector file', () => {
    const pluginDir = path.join(__dirname, '..');
    for (const action of manifest.Actions) {
      const piPath = path.join(pluginDir, action.PropertyInspectorPath);
      expect(fs.existsSync(piPath)).toBe(true);
    }
  });

  test('every action references an existing Icon file', () => {
    const pluginDir = path.join(__dirname, '..');
    for (const action of manifest.Actions) {
      const iconPath = path.join(pluginDir, action.Icon);
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  test("every action's States[].Image points to an existing file", () => {
    const pluginDir = path.join(__dirname, '..');
    for (const action of manifest.Actions) {
      for (const state of action.States || []) {
        const imgPath = path.join(pluginDir, state.Image);
        expect(fs.existsSync(imgPath)).toBe(true);
      }
    }
  });

  test('plugin-level Icon and CategoryIcon files exist', () => {
    const pluginDir = path.join(__dirname, '..');
    expect(fs.existsSync(path.join(pluginDir, manifest.Icon))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, manifest.CategoryIcon))).toBe(true);
  });
});
