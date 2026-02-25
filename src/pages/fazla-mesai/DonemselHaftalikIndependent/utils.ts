/**
 * utils.ts
 * Fazla Mesai Bilirkişi 1 sayfası için yardımcı fonksiyonlar
 */

import { normalizeLocalDate } from "./localUtils/dateHelpers";

// Para formatı
export const fmt = (n: number) =>
  `${(n ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;

// Tarih string'ini UTC Date'e çevir
export const toUTC = (dateString: string) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

// Date'i ISO string'e çevir (UTC)
export const toISODateUTC = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// Date'i Türkçe formatla
export const formatTR = (d: Date) => d.toLocaleDateString("tr-TR");

// Tarih string'ini Türkçe formatla
export const formatDateTRStr = (dateStr?: string) => {
  try {
    if (!dateStr) return "";
    const d = normalizeLocalDate(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(dateStr || "");
  }
};

// Saat string'ini normalize et
export const normalizeTime = (timeStr?: string | null) => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Tarih string'ini normalize et
export const normalizeDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    const out = `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(
      2,
      "0"
    )}`;
    return out;
  }
  return s;
};
