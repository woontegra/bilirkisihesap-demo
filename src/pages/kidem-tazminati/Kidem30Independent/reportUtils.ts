/**
 * reportUtils.ts
 * Lokal report utility fonksiyonları - SADECE bu sayfa için
 */

export type KidemReportData = {
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  calismaSuresi?: string;
  brutUcret?: number;
  prim?: number;
  ikramiye?: number;
  yemek?: number;
  yol?: number;
  diger?: number;
  extras?: Array<{ id: string; label: string; value: number }>;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: {
    toplam: number;
    yil: number;
    ay: number;
    gun: number;
  };
  damgaVergisi?: number;
  gelirVergisi?: number;
  muafiyetTutari?: number;
  gelirVergisiUygulanacak?: boolean;
  tavanUygulandi?: boolean;
  tavanDegeri?: number | null;
  warnings?: string[];
  kullanilacakBrutUcret?: number;
};

export const computeToplamBrutFromTotals = (totals: { toplam: number; yil: number; ay: number; gun: number }) => {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  const aylikBrut = totals.toplam || 0;
  
  return aylikBrut * yil + (aylikBrut / 12) * ay + (aylikBrut / 365) * gun;
};

export const formatCalismaSuresi = (totals: { yil: number; ay: number; gun: number }) => {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  
  const parts: string[] = [];
  if (yil > 0) parts.push(`${yil} Yıl`);
  if (ay > 0) parts.push(`${ay} Ay`);
  if (gun > 0) parts.push(`${gun} Gün`);
  
  return parts.length > 0 ? parts.join(" ") : "0 Yıl 0 Ay 0 Gün";
};

export const buildKidemReportData = ({
  formValues,
  calismaSuresi,
  toplamBrut,
  netTazminat,
  totals,
  damgaVergisi = 0,
  gelirVergisi = 0,
  gelirVergisiUygulanacak = false,
  tavanUygulandi = false,
  tavanDegeri = null,
  warnings = [],
  kullanilacakBrutUcret = 0,
}: {
  formValues: any;
  calismaSuresi: string;
  toplamBrut: number;
  netTazminat: number;
  totals: { toplam: number; yil: number; ay: number; gun: number };
  damgaVergisi?: number;
  gelirVergisi?: number;
  gelirVergisiUygulanacak?: boolean;
  tavanUygulandi?: boolean;
  tavanDegeri?: number | null;
  warnings?: string[];
  kullanilacakBrutUcret?: number;
}): KidemReportData => {
  // Extras'ı parse et
  const parsedExtras = (formValues.extras || []).map((item: any) => ({
    id: item.id || '',
    label: item.label || '',
    value: Number(String(item.value || "0").replace(/\./g, "").replace(",", ".")) || 0,
  }));

  return {
    iseGirisTarihi: formValues.startDate || formValues.iseGiris ? new Date(formValues.startDate || formValues.iseGiris).toLocaleDateString("tr-TR") : undefined,
    istenCikisTarihi: formValues.exitDate || formValues.endDate || formValues.istenCikis ? new Date(formValues.exitDate || formValues.endDate || formValues.istenCikis).toLocaleDateString("tr-TR") : undefined,
    calismaSuresi,
    brutUcret: Number(String(formValues.brutUcret || formValues.brut || "0").replace(/\./g, "").replace(",", ".")) || 0,
    prim: Number(String(formValues.prim || "0").replace(/\./g, "").replace(",", ".")) || 0,
    ikramiye: Number(String(formValues.ikramiye || "0").replace(/\./g, "").replace(",", ".")) || 0,
    yemek: Number(String(formValues.yemek || "0").replace(/\./g, "").replace(",", ".")) || 0,
    yol: Number(String(formValues.yol || "0").replace(/\./g, "").replace(",", ".")) || 0,
    diger: Number(String(formValues.diger || "0").replace(/\./g, "").replace(",", ".")) || 0,
    extras: parsedExtras,
    toplamBrut,
    netTazminat,
    totals,
    damgaVergisi,
    gelirVergisi,
    gelirVergisiUygulanacak,
    tavanUygulandi,
    tavanDegeri,
    warnings,
    kullanilacakBrutUcret,
  };
};
