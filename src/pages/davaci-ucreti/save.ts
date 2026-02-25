/**
 * save.ts
 * Lokal kaydetme fonksiyonu - SADECE bu sayfa için
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE_URL}/api/saved-cases`;

export interface SaveResult {
  id: number;
  success: boolean;
  message?: string;
  name?: string;
}

export async function saveCalculation(
  kayitAdi: string,
  hesapTuru: string,
  veri: any,
  mevcutId?: string | number | null
): Promise<SaveResult> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");

    let dataPayload = {};
    
    if (veri.data) {
      dataPayload = {
        ...veri.data,
        net_total: veri.net_total || veri.data.results?.net || veri.data.net_total,
        brut_total: veri.brut_total || veri.data.results?.brut || veri.data.brut_total,
      };
    } else {
      const brutTotal = veri.brut_total || veri.brutTazminat || veri.totalBrut || veri.brut || 0;
      const netTotal = veri.net_total || veri.netTazminat || veri.totalNet || veri.net || 0;
      
      dataPayload = {
        form: veri.formValues || veri.form || {},
        results: {
          totals: veri.totals || {},
          brut: brutTotal,
          net: netTotal
        },
        brut_total: brutTotal,
        net_total: netTotal,
      };
    }
    
    const payload = {
      name: kayitAdi || "",
      type: hesapTuru,
      data: dataPayload,
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
    
    const response = await fetch(`${API_URL}/${kayitId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": String(tenantId),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (beklenenTur && result.type !== beklenenTur) {
      return {
        success: false,
        error: `Bu kayıt farklı bir hesap türüne ait (${result.type})`,
      };
    }
    
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
