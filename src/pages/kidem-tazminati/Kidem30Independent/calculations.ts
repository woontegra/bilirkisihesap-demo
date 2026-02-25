/**
 * calculations.ts
 * SADECE saf hesaplama fonksiyonları olacak.
 * State import etme.
 * API çağırma.
 * Tarih picker, UI, dispatch kullanma.
 * Input → Output mantığında çalış.
 */

import { findKidemTavan, parseMoney } from "./utils";

// Constants
export const NET_REDUCTION_FACTOR = 0.85;

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
 * Tavan uygulanmış aylık brüt ücreti hesapla
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
  // TÜM ücret bileşenlerini topla
  const brutUcret =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");

  // Extras'ı da ekle
  const extrasTotal = (formValues.extras || []).reduce((acc: number, item: any) => {
    return acc + parseMoney(item.value || "0");
  }, 0);

  const toplamBrutUcret = brutUcret + extrasTotal;

  // Tavan kontrolü - ÖNCE aylık brüt ücreti tavan ile karşılaştır
  if (exitDate) {
    const exitDateObj = new Date(exitDate);
    const tavan = findKidemTavan(exitDateObj);

    // Tavan, aylık brüt ücretin üst sınırıdır
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
      const formattedTavan = tavan.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      warnings.push(
        `Aylık brüt ücret, dönem tavanı olan ${formattedTavan}₺'yi aştığı için tavan seviyesine çekilmiştir. Hesaplamalar tavan değeri üzerinden yapılmıştır.`
      );
    }
  }

  return { tavanUygulandiFlag, tavanDegeriValue, warnings };
}

/**
 * Kıdem tazminatı hesapla (brüt ve net)
 */
export function calculateKidemTazminati(
  kullanilacakBrutUcret: number,
  totals: { toplam: number; yil: number; ay: number; gun: number }
): {
  brutTazminat: number;
  netTazminat: number;
} {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  const finalBrutTazminat =
    kullanilacakBrutUcret * yil + (kullanilacakBrutUcret / 12) * ay + (kullanilacakBrutUcret / 365) * gun;

  const netTazminat = finalBrutTazminat * NET_REDUCTION_FACTOR;

  return {
    brutTazminat: finalBrutTazminat,
    netTazminat: netTazminat,
  };
}

/**
 * Damga vergisi hesapla
 */
export function calculateDamgaVergisi(brut: number): number {
  return brut * 0.00759;
}

/**
 * Net ücret hesapla (damga vergisi düşülmüş)
 */
export function calculateNetDisplay(brut: number): number {
  return brut - calculateDamgaVergisi(brut);
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
  // totals.yil 0 ise ve toplam gün 365'ten azsa kıdem tazminatı hakkı yok
  return !(totals.yil === 0 && totals.yil * 365 + totals.ay * 30 + totals.gun < 365);
}
