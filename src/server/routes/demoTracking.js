import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const STATS_FILE = path.join(process.cwd(), 'demo-stats.json');

const DEFAULT_STATS = {
  calculation: 0,
  preview_click: 0,
  demo_click: 0,
  subscribe_click: 0,
};

function readStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf8');
      const data = JSON.parse(raw);
      return { ...DEFAULT_STATS, ...data };
    }
  } catch (err) {
    // ignore
  }
  return { ...DEFAULT_STATS };
}

function writeStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

function ensureFile() {
  if (!fs.existsSync(STATS_FILE)) {
    writeStats(DEFAULT_STATS);
  }
}

// POST /demo-track  body: { "event": "calculation" | "preview_click" | "demo_click" | "subscribe_click" }
router.post('/demo-track', (req, res) => {
  try {
    ensureFile();
    const stats = readStats();
    const event = req.body?.event;
    if (event != null && typeof stats[event] === 'number') {
      stats[event] += 1;
      writeStats(stats);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// GET /demo-stats
router.get('/demo-stats', (req, res) => {
  try {
    ensureFile();
    const stats = readStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({});
  }
});

export default router;
