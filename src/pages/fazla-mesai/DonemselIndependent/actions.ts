/**
 * actions.ts
 * Fazla Mesai Bilirkişi 1 sayfası için action fonksiyonları
 */

import { calculateFazlaMesaiBilirkisi1, loadCalculation } from "./api";
import { prepareSaveData } from "./save";
import { normalizeTime, normalizeDate } from "./utils";
import type { PeriodRow, Beyan, Witness, ExcludedDay } from "./contract";

/**
 * Backend'den hesaplama yapma
 */
export async function handleCalculate(
  davaci: Beyan,
  taniklar: Witness[],
  weeklyDays: string,
  activeTab: "tatilsiz" | "tatilli",
  exclusions: ExcludedDay[],
  katSayi: number,
  zamanasimiBaslangic: string | null,
  include270: boolean,
  haftalikMesai: number,
  iseGiris: string,
  istenCikis: string,
  gir: string,
  cik: string
): Promise<{
  success: boolean;
  rows?: PeriodRow[];
  totalBrut?: number;
  totalNet?: number;
  textPeriods?: any[];
  weeklyOvertimeHours?: number;
  stepsText?: string;
  error?: string;
}> {
  const payload = {
    davaci: {
      in: gir || "",
      out: cik || "",
      dateIn: iseGiris || "",
      dateOut: istenCikis || "",
    },
    witnesses: taniklar,
    weeklyDays: Number(weeklyDays) || 6,
    activeTab,
    exclusions,
    katSayi,
    zamanasimiBaslangic,
    include270,
    haftalikMesai,
    iseGiris,
    istenCikis,
  };

  console.log('[Bilirkişi-1 Frontend] Hesaplama payload:', {
    include270,
    weeklyDays: payload.weeklyDays,
    activeTab,
    exclusionsCount: exclusions.length
  });

  return await calculateFazlaMesaiBilirkisi1(payload);
}

/**
 * Kayıt yükleme
 */
export async function handleLoadCalculation(
  caseId: string
): Promise<{
  formData: any;
  name: string;
} | null> {
  try {
    const result = await loadCalculation(caseId, "donemsel_fazla_mesai");

    if (result.success && result.data) {
      return {
        formData: result.data,
        name: result.name || "",
      };
    }

    return null;
  } catch (err: any) {
    console.error("[Dönemsel Fazla Mesai] Hesaplama yüklenirken hata oluştu:", err);
    return null;
  }
}

/**
 * Kayıt kaydetme için veri hazırlama
 */
export function handlePrepareSaveData(
  rows: PeriodRow[],
  iseGiris: string,
  istenCikis: string,
  gir: string,
  cik: string,
  weeklyDays: string,
  davaci: Beyan,
  davali: Beyan,
  taniklar: Witness[],
  exclusions: ExcludedDay[],
  notes: string,
  include270: boolean,
  haftaDususBilgisi: number | null,
  zamanasimi: any,
  zamanasimiBaslangic: string | null,
  katSayi: number,
  hasCustomKatsayi: boolean,
  mahsuplasmaMiktari: string,
  mahsuplasamaData: any,
  brut: number,
  net: number,
  fm: number
) {
  console.log('[Bilirkişi-1] handlePrepareSaveData çağrıldı, rows:', rows.length, 'satır');
  console.log('[Bilirkişi-1] handlePrepareSaveData - rows örnek:', rows[0]);
  return prepareSaveData(
    rows,
    iseGiris,
    istenCikis,
    gir,
    cik,
    weeklyDays,
    davaci,
    davali,
    taniklar,
    exclusions,
    notes,
    include270,
    haftaDususBilgisi,
    zamanasimi,
    zamanasimiBaslangic,
    katSayi,
    hasCustomKatsayi,
    mahsuplasmaMiktari,
    mahsuplasamaData,
    brut,
    net,
    fm
  );
}
