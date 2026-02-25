/**
 * calculations.ts
 * SADECE saf hesaplama fonksiyonları olacak.
 * State import etme.
 * API çağırma.
 * Tarih picker, UI, dispatch kullanma.
 * Input → Output mantığında çalış.
 */

import type { ExtraItem, WorkPeriodTotals } from "./contract";

/**
 * String'den sayıya çevirme helper
 */
export function parseNum(v: string): number {
  return Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Sayıyı formatla (TL formatı - sağa hizalı)
 */
export function fmtCurrency(n: number | undefined): string {
  const num = n ?? 0;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `${formatted}₺`;
}

/**
 * Sayıyı formatla (sadece sayı, TL işareti yok)
 */
export function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

/**
 * Toplam brüt ücret hesapla
 */
export function calculateTotalBrut(
  brut: string,
  prim: string,
  ikramiye: string,
  yol: string,
  yemek: string,
  extras: ExtraItem[]
): number {
  const brutNum = parseNum(brut);
  const primNum = parseNum(prim);
  const ikramiyeNum = parseNum(ikramiye);
  const yolNum = parseNum(yol);
  const yemekNum = parseNum(yemek);
  const extrasTotal = extras.reduce((sum, ex) => sum + parseNum(ex.value), 0);
  
  return brutNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
}
