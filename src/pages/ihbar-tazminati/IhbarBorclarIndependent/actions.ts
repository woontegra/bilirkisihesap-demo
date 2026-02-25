/**
 * actions.ts
 * Kullanıcı aksiyonları burada olacak.
 * Action → api → calculations akışına uyar.
 * Butonlar doğrudan hesap yapmaz.
 */

import { calculateIhbarBorclar, loadCalculation } from "./api";
import type {
  IhbarBorclarFormData,
  WorkPeriodTotals,
  CalculateIhbarBorclarRequest,
  LoadCalculationResponse,
  IhbarBorclarSaveData,
} from "./contract";

/**
 * İhbar Tazminatı hesaplama aksiyonu
 */
export async function handleCalculateIhbarBorclar(
  formValues: IhbarBorclarFormData | null,
  totals: WorkPeriodTotals,
  selectedYear: number,
  onSuccess: (data: {
    weeks: number;
    amount: number;
    gelirVergisi: number;
    gelirVergisiDilimleri: string;
    damgaVergisi: number;
    net: number;
  }) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    if (!formValues || totals.toplam <= 0) {
      return;
    }

    const requestData: CalculateIhbarBorclarRequest = {
      brut: formValues.brutUcret || formValues.brut || "0",
      prim: formValues.prim || "0",
      ikramiye: formValues.ikramiye || "0",
      yol: formValues.yol || "0",
      yemek: formValues.yemek || "0",
      diger: "0",
      extras: formValues.extras || [],
      totals: totals,
      exitYear: selectedYear
    };

    const response = await calculateIhbarBorclar(requestData);
    
    if (response.success && response.data) {
      onSuccess({
        weeks: response.data.weeks || 2,
        amount: response.data.brut || 0,
        gelirVergisi: response.data.gelirVergisi || 0,
        gelirVergisiDilimleri: response.data.gelirVergisiDilimleri || "",
        damgaVergisi: response.data.damgaVergisi || 0,
        net: response.data.net || 0,
      });
    } else {
      if (onError) {
        onError(response.error || "Hesaplama başarısız oldu");
      }
    }
  } catch (error: any) {
    console.error("İhbar tazminatı hesaplama hatası:", error);
    if (onError) {
      onError(error.message || "Hesaplama hatası oluştu");
    }
  }
}

/**
 * Kayıt yükleme aksiyonu
 */
export async function handleLoadCalculation(
  caseId: string
): Promise<LoadCalculationResponse | null> {
  try {
    return await loadCalculation(caseId);
  } catch (err: any) {
    console.error("[İhbar Borçlar Kanunu] Hesaplama yüklenirken hata oluştu:", err);
    return null;
  }
}

/**
 * Kayıt kaydetme için veri hazırlama
 */
export function prepareSaveData(
  formValues: IhbarBorclarFormData | null,
  totals: WorkPeriodTotals,
  amount: number,
  net: number
): IhbarBorclarSaveData {
  const iseGiris = formValues?.iseGiris || formValues?.startDate || null;
  const istenCikis = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || null;
  
  // Extras'ı form'a ekle
  const formDataWithExtras: IhbarBorclarFormData = {
    ...(formValues || {}),
    extras: formValues?.extras || []
  };
  
  return {
    data: {
      form: formDataWithExtras,
      results: {
        totals,
        brut: amount,
        net: net
      }
    },
    ise_giris: iseGiris,
    isten_cikis: istenCikis,
    brut_total: Number(amount.toFixed(2)),
    net_total: Number(net.toFixed(2)),
    start_date: iseGiris,
    end_date: istenCikis,
    total: Number(amount.toFixed(2)),
  };
}
