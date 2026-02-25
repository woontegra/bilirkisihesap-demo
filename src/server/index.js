import express from 'express';
import cors from 'cors';

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
