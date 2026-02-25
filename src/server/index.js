import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Fazla Mesai split route imports
import bilirkisi1Routes from './routes/fazlaMesai/bilirkisi1Routes.js';
import bilirkisi2Routes from './routes/fazlaMesai/bilirkisi2Routes.js';
import standartRoutes from './routes/fazlaMesai/standartRoutes.js';
import vardiya12Routes from './routes/fazlaMesai/vardiya12Routes.js';
import vardiya24Routes from './routes/fazlaMesai/vardiya24Routes.js';
import gemiRoutes from './routes/fazlaMesai/gemiRoutes.js';
import evRoutes from './routes/fazlaMesai/evRoutes.js';
import fazlaSurelerleCalismaRoutes from './routes/fazlaMesai/fazlaSurelerleCalismaRoutes.js';

// Optional legacy combined routes (kept if needed)
// import genericFMRoutes from './routes/fazlaMesaiRoutes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Demo tracking – inline so it always works (no auth, file at project root)
const DEMO_STATS_FILE = path.join(process.cwd(), 'demo-stats.json');
const DEMO_DEFAULT = { calculation: 0, preview_click: 0, demo_click: 0, subscribe_click: 0 };
function demoReadStats() {
  try {
    if (fs.existsSync(DEMO_STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEMO_STATS_FILE, 'utf8'));
      return { ...DEMO_DEFAULT, ...data };
    }
  } catch (e) { /* ignore */ }
  return { ...DEMO_DEFAULT };
}
function demoEnsureFile() {
  if (!fs.existsSync(DEMO_STATS_FILE)) {
    fs.writeFileSync(DEMO_STATS_FILE, JSON.stringify(DEMO_DEFAULT, null, 2), 'utf8');
  }
}
app.get('/demo-stats', (_req, res) => {
  try {
    demoEnsureFile();
    res.json(demoReadStats());
  } catch (e) {
    res.status(500).json({});
  }
});
app.post('/demo-track', (req, res) => {
  try {
    demoEnsureFile();
    const stats = demoReadStats();
    const event = req.body?.event;
    if (event != null && typeof stats[event] === 'number') {
      stats[event] += 1;
      fs.writeFileSync(DEMO_STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// Mount split module routes
app.use('/api/fazla-mesai/bilirkisi1', bilirkisi1Routes);
app.use('/api/fazla-mesai/bilirkisi2', bilirkisi2Routes);
app.use('/api/fazla-mesai/standart', standartRoutes);
app.use('/api/fazla-mesai/vardiya12', vardiya12Routes);
app.use('/api/fazla-mesai/vardiya24', vardiya24Routes);
app.use('/api/fazla-mesai/gemi', gemiRoutes);
app.use('/api/fazla-mesai/ev', evRoutes);
app.use('/api/fazla-mesai/fazla-surelerle-calisma', fazlaSurelerleCalismaRoutes);

// If you still use legacy combined routes, uncomment below
// app.use('/api/fazla-mesai', genericFMRoutes);

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

export default app;
