import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const saveCalculation = async (req, res) => {
  try {
    const { hesaplama_turu, tarih, toplam_fazla_mesai, ayrintilar } = req.body;

    if (!hesaplama_turu || !tarih) {
      return res.status(400).json({ error: "Eksik parametre." });
    }

    // Accept ayrintilar as object or JSON string
    let details = ayrintilar;
    if (typeof details === "string") {
      try { details = JSON.parse(details); } catch { details = { raw: details }; }
    }

    const created = await prisma.hesaplama.create({
      data: {
        hesaplama_turu,
        tarih: new Date(tarih),
        toplam_fazla_mesai: Number(isNaN(Number(toplam_fazla_mesai)) ? 0 : toplam_fazla_mesai),
        ayrintilar: details || {},
      },
      select: { id: true },
    });

    res.json({ success: true, id: created.id });
  } catch (err) {
    console.error("[saveCalculation] Error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const getCalculations = async (req, res) => {
  try {
    const rows = await prisma.hesaplama.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        hesaplama_turu: true,
        tarih: true,
        toplam_fazla_mesai: true,
        created_at: true,
      },
    });
    res.json(rows);
  } catch (err) {
    console.error("[getCalculations] Error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const getCalculationById = async (req, res) => {
  try {
    const row = await prisma.hesaplama.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!row) return res.status(404).json({ error: "Kayıt bulunamadı." });
    res.json(row);
  } catch (err) {
    console.error("[getCalculationById] Error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const deleteCalculation = async (req, res) => {
  try {
    await prisma.hesaplama.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: "Kayıt silindi." });
  } catch (err) {
    console.error("[deleteCalculation] Error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};
