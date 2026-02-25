/**
 * actions.ts
 * Kullanıcı aksiyonları burada olacak.
 * Action → api → calculations akışına uyar.
 * Butonlar doğrudan hesap yapmaz.
 */

import { loadCalculation as loadCalculationFromSave } from "./save";
import type {
  HaftaTatiliSavedData,
  HaftaTatiliSaveData,
} from "./contract";

const CALCULATION_TYPE = "hafta_tatili_standart";

/**
 * Kayıt yükleme aksiyonu
 */
export async function handleLoadCalculation(
  caseId: string
): Promise<{
  formData: HaftaTatiliSavedData;
  name: string;
} | null> {
  try {
    const result = await loadCalculationFromSave(caseId, CALCULATION_TYPE);

    if (result.success && result.data) {
      return {
        formData: result.data,
        name: result.name || "",
      };
    }

    return null;
  } catch (err: any) {
    console.error("[Hafta Tatili] Hesaplama yüklenirken hata oluştu:", err);
    return null;
  }
}

/**
 * Kayıt kaydetme için veri hazırlama
 */
export function prepareSaveData(
  dateRanges: any[],
  selectedHolidayIds: string[],
  haftaTatiliExcludedDays: any[],
  haftaTatiliExpiryStart: string | null,
  haftaTatiliKullanimBaslangic: string,
  haftaTatiliKullanimBitis: string,
  haftaTatiliKullanimGunSayisi: number,
  haftaTatiliRows: any[],
  haftaTatiliTotalBrutFromRows: number,
  haftaTatiliNetSummary: any,
  totalDays: number,
  katsayi: number
): HaftaTatiliSaveData {
  // Tarih aralığı özetleri
  const startDate = dateRanges
    .filter(r => r.start)
    .map(r => new Date(r.start).getTime())
    .sort((a,b)=>a-b)[0];
  const endDate = dateRanges
    .filter(r => r.end)
    .map(r => new Date(r.end).getTime())
    .sort((a,b)=>b-a)[0];

  const startDateStr = startDate ? new Date(startDate).toISOString().slice(0,10) : null;
  const endDateStr = endDate ? new Date(endDate).toISOString().slice(0,10) : null;

  const haftaTatiliData = {
    periods: haftaTatiliRows,
    totalBrut: haftaTatiliTotalBrutFromRows,
    totalNet: haftaTatiliNetSummary.net,
    netConversion: haftaTatiliNetSummary,
    settlement: {
      hakkaniyet: haftaTatiliNetSummary.hakkaniyet,
      settleAmount: haftaTatiliNetSummary.settleAmount,
      sonuc: Math.max(0, haftaTatiliNetSummary.brut - haftaTatiliNetSummary.hakkaniyet),
    },
    workerPeriods: dateRanges,
    selectedHolidays: selectedHolidayIds,
    calculatedHaftaTatiliDays: totalDays,
    katsayi,
    zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
    excludedDays: haftaTatiliExcludedDays.map((day: any) => {
      // Type field'ını MUTLAKA koru - eğer varsa kullan, yoksa "Diğer" ata
      const originalType = day.type || (day as any).type;
      let typeValue = "Diğer";
      if (originalType !== undefined && originalType !== null && String(originalType).trim() !== "") {
        typeValue = String(originalType).trim();
      }
      return {
        id: day.id || Math.random().toString(36).slice(2),
        type: typeValue,
        start: day.start || "",
        end: day.end || "",
        days: day.days || 0,
      };
    }),
    haftaTatiliKullanim: {
      baslangic: haftaTatiliKullanimBaslangic,
      bitis: haftaTatiliKullanimBitis,
      gunSayisi: haftaTatiliKullanimGunSayisi,
    },
    startDate: startDateStr,
    endDate: endDateStr,
    notes: "",
  };

  return {
    data: {
      form: {
        workerPeriods: dateRanges,
        selectedHolidays: selectedHolidayIds,
        excludedDays: haftaTatiliExcludedDays.map((day: any) => {
      // Type field'ını MUTLAKA koru - eğer varsa kullan, yoksa "Diğer" ata
      const originalType = day.type || (day as any).type;
      let typeValue = "Diğer";
      if (originalType !== undefined && originalType !== null && String(originalType).trim() !== "") {
        typeValue = String(originalType).trim();
      }
      return {
        id: day.id || Math.random().toString(36).slice(2),
        type: typeValue,
        start: day.start || "",
        end: day.end || "",
        days: day.days || 0,
      };
    }),
        zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
        haftaTatiliKullanim: {
          baslangic: haftaTatiliKullanimBaslangic,
          bitis: haftaTatiliKullanimBitis,
          gunSayisi: haftaTatiliKullanimGunSayisi,
        },
        periods: haftaTatiliRows,
        katsayi,
        calculatedHaftaTatiliDays: totalDays,
        settlement: haftaTatiliData.settlement,
      },
      results: {
        totals: { brut: haftaTatiliTotalBrutFromRows, net: haftaTatiliNetSummary.net },
        brut: haftaTatiliTotalBrutFromRows,
        net: haftaTatiliNetSummary.net,
        netConversion: haftaTatiliNetSummary,
      }
    },
    // Geriye dönük uyumluluk için eski alanlar (backend için)
    start_date: startDateStr,
    end_date: endDateStr,
    brut_total: haftaTatiliTotalBrutFromRows,
    net_total: haftaTatiliNetSummary.net,
    notes: "",
    ...haftaTatiliData,
  };
}
