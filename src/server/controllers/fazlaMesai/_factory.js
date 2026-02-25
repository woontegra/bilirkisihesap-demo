import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function makeController(modelKey) {
  return {
    async saveCalculation(req, res) {
      try {
        const payload = req.body?.json_data ?? req.body ?? {};
        const rec = await prisma[modelKey].create({ data: { json_data: payload } });
        res.json(rec);
      } catch (err) {
        res.status(500).json({ error: 'save_failed', details: String(err?.message || err) });
      }
    },
    async getCalculations(_req, res) {
      try {
        const rows = await prisma[modelKey].findMany({ orderBy: { id: 'desc' } });
        res.json(rows);
      } catch (err) {
        res.status(500).json({ error: 'list_failed', details: String(err?.message || err) });
      }
    },
    async deleteCalculation(req, res) {
      try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'invalid_id' });
        await prisma[modelKey].delete({ where: { id } });
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: 'delete_failed', details: String(err?.message || err) });
      }
    }
  };
}
