/**
 * save.ts
 * Fazla Mesai Bilirkişi 1 sayfası için kaydetme fonksiyonları
 */

import type { FazlaMesaiBilirkisi1SaveData, PeriodRow } from "./contract";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE_URL}/api/saved-cases`;

export interface SaveResult {
  id: number;
  success: boolean;
  message?: string;
  name?: string;
}

/**
 * Hesaplama kaydetme
 */
export async function saveCalculation(
  kayitAdi: string,
  veri: FazlaMesaiBilirkisi1SaveData,
  mevcutId?: string | number | null
): Promise<SaveResult> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");

    const payload = {
      name: kayitAdi || "",
      type: "donemsel_haftalik_fazla_mesai",
      data: {
        ...veri.data,
        net_total: veri.net_total,
        brut_total: veri.brut_total,
        fm_total: veri.fm_total,
        pageType: veri.pageType || "donemsel-haftalik",
        start_date: veri.data.form?.iseGiris || "",
        end_date: veri.data.form?.istenCikis || "",
      },
    };

    const validId = mevcutId && mevcutId !== "" && mevcutId !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
    const url = validId ? `${API_URL}/${validId}` : API_URL;
    const method = validId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": String(tenantId),
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Backend'den beklenmeyen yanıt alındı (Status: ${response.status}).`
      );
    }

    const result = await response.json();

    if (!response.ok) {
      const errorMessage = result.message || result.error || `Kayıt işlemi başarısız oldu (${response.status})`;
      throw new Error(errorMessage);
    }

    const savedId = result.id;
    const savedName = result.name || kayitAdi;

    return {
      id: savedId || Number(mevcutId) || 0,
      success: true,
      message: mevcutId ? "Kayıt başarıyla güncellendi" : "Kayıt başarıyla kaydedildi",
      name: savedName,
    };
  } catch (error: any) {
    console.error("Kayıt hatası:", error);
    throw new Error(error.message || "Kayıt sırasında bir hata oluştu");
  }
}

/**
 * Kayıt yükleme
 */
export async function loadCalculation(
  kayitId: string | number,
  beklenenTur?: string
): Promise<{
  success: boolean;
  data?: any;
  name?: string;
  error?: string;
}> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    console.log('🔍 [SAVE.TS] loadCalculation called with:', { kayitId, beklenenTur, tenantId });
    
    const response = await fetch(`${API_URL}/${kayitId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": String(tenantId),
      },
    });

    console.log('📡 [SAVE.TS] API response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('📦 [SAVE.TS] API result:', result);
    console.log('📦 [SAVE.TS] result.type:', result.type, 'beklenenTur:', beklenenTur);
    
    if (beklenenTur && result.type !== beklenenTur) {
      console.warn('⚠️ [SAVE.TS] Type mismatch!', { resultType: result.type, beklenenTur });
      return {
        success: false,
        error: `Bu kayıt farklı bir hesap türüne ait (${result.type})`,
      };
    }
    
    console.log('✅ [SAVE.TS] Returning success with data');
    return {
      success: true,
      data: result.data || result,
      name: result.name,
    };
  } catch (error: any) {
    console.error("[loadCalculation] Yükleme hatası:", error);
    return {
      success: false,
      error: error.message || "Kayıt yüklenirken bir hata oluştu",
    };
  }
}

/**
 * Kayıt için veri hazırlama
 */
export function prepareSaveData(
  rows: PeriodRow[],
  iseGiris: string,
  istenCikis: string,
  gir: string,
  cik: string,
  weeklyDays: string,
  davaci: any,
  davali: any,
  taniklar: any[],
  exclusions: any[],
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
): FazlaMesaiBilirkisi1SaveData {
  console.log('[Bilirkişi-1] prepareSaveData çağrıldı, rows:', rows.length, 'satır');
  console.log('[Bilirkişi-1] prepareSaveData - rows örnek:', rows[0]);
  console.log('[Bilirkişi-1] prepareSaveData - rows[0].brut:', rows[0]?.brut);
  console.log('[Bilirkişi-1] prepareSaveData - rows[0].fm:', rows[0]?.fm);
  console.log('[Bilirkişi-1] prepareSaveData - rows[0].fmHours:', rows[0]?.fmHours);
  
  const totalBrut = rows.reduce((sum, r) => sum + (r.brut || 0), 0);
  const totalFm = rows.reduce((sum, r) => sum + (r.fm || 0), 0);
  const totalNet = rows.reduce((sum, r) => sum + (r.net || 0), 0);
  
  console.log('[Bilirkişi-1] prepareSaveData - totalBrut:', totalBrut);
  console.log('[Bilirkişi-1] prepareSaveData - totalFm:', totalFm);
  console.log('[Bilirkişi-1] prepareSaveData - totalNet:', totalNet);

  return {
    data: {
      form: {
        iseGiris,
        istenCikis,
        gir,
        cik,
        weeklyDays,
        davaci,
        davali,
        taniklar,
        exclusions,
        rows,
        notes,
        include270,
        haftaDususBilgisi,
        zamanasimi,
        zamanasimiBaslangic,
        katSayi,
        hasCustomKatsayi,
        mahsuplasmaMiktari,
        mahsuplasamaData,
      },
      results: {
        totals: {
          brut: totalBrut,
          fm: totalFm,
          net: totalNet,
        },
        brut: totalBrut,
        fm: totalFm,
        net: totalNet,
      },
    },
    brut_total: totalBrut,
    fm_total: totalFm,
    net_total: totalNet,
    pageType: "donemsel-haftalik",
  };
}
