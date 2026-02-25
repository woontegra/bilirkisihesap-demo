/**
 * Demo tracking route logic.
 * Runtime implementation lives in src/server/routes/demoTracking.js
 * and is registered in src/server/index.js.
 *
 * - POST /demo-track  body: { event: "calculation" | "preview_click" | "demo_click" | "subscribe_click" }
 * - GET  /demo-stats  returns { calculation, preview_click, demo_click, subscribe_click }
 * - Stats file: project root / demo-stats.json (created if missing).
 */

import fs from 'fs';
import path from 'path';

const STATS_FILE = path.join(process.cwd(), 'demo-stats.json');

export const DEFAULT_STATS = {
  calculation: 0,
  preview_click: 0,
  demo_click: 0,
  subscribe_click: 0,
};

export function readStats(): typeof DEFAULT_STATS {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf8');
      const data = JSON.parse(raw) as Partial<typeof DEFAULT_STATS>;
      return { ...DEFAULT_STATS, ...data };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_STATS };
}

export function writeStats(stats: typeof DEFAULT_STATS): void {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

export function ensureFile(): void {
  if (!fs.existsSync(STATS_FILE)) {
    writeStats(DEFAULT_STATS);
  }
}

export type DemoEvent = keyof typeof DEFAULT_STATS;

export function incrementEvent(event: DemoEvent): void {
  ensureFile();
  const stats = readStats();
  if (typeof stats[event] === 'number') {
    stats[event] += 1;
    writeStats(stats);
  }
}
