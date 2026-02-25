/**
 * calculations.ts
 * SADECE saf hesaplama fonksiyonları olacak.
 * State import etme.
 * API çağırma.
 * Tarih picker, UI, dispatch kullanma.
 * Input → Output mantığında çalış.
 */

import { findKidemTavan } from "./localUtils/findKidemTavan";
import { parseMoney } from "./localUtils/parseMoney";
import { calculateIncomeTaxForYear } from "./localUtils/incomeTaxCore";

/**
 * String'den sayıya çevirme helper
 */
export function parseNum(v: string): number {
  return parseMoney(v || "0");
}

/**
 * Sayıyı formatla (TL formatı - ₺ sağda)
 */
export function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Sayıyı formatla ve TL işareti ekle (₺ sağda)
 */
export function fmtCurrency(n: number | undefined): string {
  return `${fmt(n)}₺`;
}

/**
 * Tavan uygulanmış aylık brüt ücreti hesapla (Gemi adamları için)
 */
export function calculateKullanilacakBrutUcret(
  formValues: {
    brutUcret?: string;
    brut?: string;
    prim?: string;
    ikramiye?: string;
    yol?: string;
    yemek?: string;
    diger?: string;
    extras?: Array<{ id: string; label: string; value: string }>;
  },
  exitDate: string
): number {
  const brutUcret =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");

  const extrasTotal = (formValues.extras || []).reduce((acc: number, item: any) => {
    return acc + parseMoney(item.value || "0");
  }, 0);

  const toplamBrutUcret = brutUcret + extrasTotal;

  // Tavan kontrolü
  if (exitDate) {
    const exitDateObj = new Date(exitDate);
    const tavan = findKidemTavan(exitDateObj);

    if (tavan && toplamBrutUcret > tavan) {
      return tavan;
    }
  }

  return toplamBrutUcret;
}

/**
 * Tavan bilgisi hesapla
 */
export function calculateTavanBilgisi(
  formValues: {
    brutUcret?: string;
    brut?: string;
    prim?: string;
    ikramiye?: string;
    yol?: string;
    yemek?: string;
    diger?: string;
    extras?: Array<{ id: string; label: string; value: string }>;
  },
  exitDate: string
): {
  tavanUygulandiFlag: boolean;
  tavanDegeriValue: number | null;
  warnings: string[];
} {
  const brutUcret =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");

  const extrasTotal = (formValues.extras || []).reduce((acc: number, item: any) => {
    return acc + parseMoney(item.value || "0");
  }, 0);

  const toplamBrutUcret = brutUcret + extrasTotal;

  const warnings: string[] = [];
  let tavanUygulandiFlag = false;
  let tavanDegeriValue: number | null = null;

  if (exitDate) {
    const exitDateObj = new Date(exitDate);
    const tavan = findKidemTavan(exitDateObj);

    if (tavan && toplamBrutUcret > tavan) {
      tavanUygulandiFlag = true;
      tavanDegeriValue = tavan;
      warnings.push(
        `Aylık brüt ücret, dönem tavanı olan ${tavan.toLocaleString("tr-TR")} TL'yi aştığı için tavan seviyesine çekildi.`
      );
    }
  }

  return { tavanUygulandiFlag, tavanDegeriValue, warnings };
}

/**
 * Kıdem tazminatı hesapla (brüt)
 */
export function calculateKidemTazminati(
  kullanilacakBrutUcret: number,
  totals: { toplam: number; yil: number; ay: number; gun: number }
): number {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  return kullanilacakBrutUcret * yil + (kullanilacakBrutUcret / 12) * ay + (kullanilacakBrutUcret / 365) * gun;
}

/**
 * Damga vergisi hesapla
 */
export function calculateDamgaVergisi(brut: number): number {
  return brut * 0.00759;
}

/**
 * Çıplak brüt ücret hesapla
 */
export function calculateCiplakBrutUcret(formValues: {
  brut?: string;
  brutUcret?: string;
}): number {
  const brutValue = formValues.brut || formValues.brutUcret || '';
  return parseNum(brutValue);
}

/**
 * Muafiyet tutarı hesapla (24 ay kuralı - GVK 25/7)
 */
export function calculateMuafiyetTutari(ciplakBrutUcret: number): number {
  return ciplakBrutUcret * 24;
}

/**
 * Gelir vergisi hesapla (24 ay kuralına göre)
 */
export function calculateGelirVergisi(
  brutTazminat: number,
  muafiyetTutari: number,
  selectedYear: number
): number {
  // 24 ay kuralı: Kıdem tazminatı > muafiyet tutarı ise gelir vergisi uygulanır
  if (brutTazminat <= muafiyetTutari) {
    return 0;
  }

  // Vergiye tabi tutar
  const vergiyeTabiTutar = brutTazminat - muafiyetTutari;

  // Gelir vergisi hesapla (year, income)
  return calculateIncomeTaxForYear(selectedYear, vergiyeTabiTutar);
}

/**
 * Net ücret hesapla (damga vergisi ve gelir vergisi düşülmüş)
 */
export function calculateNetDisplay(
  brutTazminat: number,
  damgaVergisi: number,
  gelirVergisi: number
): number {
  return brutTazminat - damgaVergisi - gelirVergisi;
}

/**
 * 1 yıl kontrolü - Kıdem tazminatı hakkı var mı?
 */
export function checkKidemTazminatiHakki(totals: {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}): boolean {
  // totals.yil 0 ise kıdem tazminatı hakkı yok (1 yılın altında)
  return totals.yil > 0;
}
