/**
 * @file generate-icons.mjs
 * @description Generates 5 distinct 64×64 PNG icons for UlanziStudio plugin actions.
 * Uses the `canvas` npm package (Node.js native canvas bindings).
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'assets', 'icons');

mkdirSync(ICONS_DIR, { recursive: true });

/**
 * Save a canvas as PNG to the icons directory.
 * @param {import('canvas').Canvas} canvas
 * @param {string} filename
 */
function saveIcon(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  // @napi-rs/canvas returns a Buffer directly; canvas returns a Buffer too
  const outPath = join(ICONS_DIR, filename);
  writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}

// ---------------------------------------------------------------------------
// Clock icon — dark bg + white clock face hint + "12" text
// ---------------------------------------------------------------------------
{
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 64, 64);

  // Clock circle
  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(32, 32, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Hour hand (pointing to 12)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(32, 14);
  ctx.stroke();

  // Minute hand (pointing to 3)
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(50, 32);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(32, 32, 2, 0, Math.PI * 2);
  ctx.fill();

  saveIcon(canvas, 'clock-icon.png');
}

// ---------------------------------------------------------------------------
// Counter icon — dark bg + white "+1" text
// ---------------------------------------------------------------------------
{
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 64, 64);

  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+1', 32, 32);

  saveIcon(canvas, 'counter-icon.png');
}

// ---------------------------------------------------------------------------
// CPU Status icon — dark bg + green "CPU" text
// ---------------------------------------------------------------------------
{
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 64, 64);

  // Small bar chart
  const barColor = '#00c853';
  const bars = [0.4, 0.7, 0.55, 0.85, 0.65];
  const barW = 8;
  const barMaxH = 24;
  const startX = 8;
  const baseY = 46;

  bars.forEach((h, i) => {
    const barH = Math.round(h * barMaxH);
    ctx.fillStyle = barColor;
    ctx.fillRect(startX + i * 11, baseY - barH, barW, barH);
  });

  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#00c853';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CPU', 32, 55);

  saveIcon(canvas, 'status-icon.png');
}

// ---------------------------------------------------------------------------
// Calendar icon — red header top 20px + white background + dark "31" text
// ---------------------------------------------------------------------------
{
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');

  // White body
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);

  // Red header (top 20px)
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(0, 0, 64, 20);

  // Border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 63, 63);

  // "CAL" label in header
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CAL', 32, 10);

  // Day number
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.textBaseline = 'middle';
  ctx.fillText('31', 32, 44);

  saveIcon(canvas, 'calendar-icon.png');
}

// ---------------------------------------------------------------------------
// Pomodoro icon — dark bg + red tomato shape
// ---------------------------------------------------------------------------
{
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 64, 64);

  // Tomato body (red circle)
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.arc(32, 36, 20, 0, Math.PI * 2);
  ctx.fill();

  // Tomato highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(26, 30, 7, 0, Math.PI * 2);
  ctx.fill();

  // Stem (green)
  ctx.strokeStyle = '#43a047';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.lineTo(32, 22);
  ctx.stroke();

  // Leaf
  ctx.fillStyle = '#43a047';
  ctx.beginPath();
  ctx.ellipse(28, 18, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(36, 18, 5, 3, 0.5, 0, Math.PI * 2);
  ctx.fill();

  saveIcon(canvas, 'pomodoro-icon.png');
}

console.log('All icons generated successfully.');
