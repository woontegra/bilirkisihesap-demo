import { API_BASE_URL } from "../localUtils/apiClient";

const API_URL = API_BASE_URL + "/api/saved-cases";

export type HesapTuru = string;

export interface KayitSonucu {
  id: number;
  success: boolean;
  message?: string;
  name?: string;
}

export async function kaydetHesap(
  kayitAdi: string,
  hesapTuru: HesapTuru,
  veri: any,
  mevcutId?: string | number | null
): Promise<KayitSonucu> {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  let dataPayload: any;
  if (veri.data) {
    dataPayload = { ...veri.data };
    dataPayload.net_total = veri.net_total || veri.data.results?.net || veri.data.net_total;
    dataPayload.brut_total = veri.brut_total || veri.data.results?.brut || veri.data.brut_total;
    dataPayload.ise_giris = veri.data.form?.iseGiris || veri.data.form?.startDate || veri.ise_giris || veri.start_date;
    dataPayload.isten_cikis = veri.data.form?.istenCikis || veri.data.form?.endDate || veri.isten_cikis || veri.end_date;
    dataPayload.start_date = veri.data.form?.startDate || veri.start_date;
    dataPayload.end_date = veri.data.form?.endDate || veri.end_date;
  } else {
    const iseGiris = veri.ise_giris || veri.start_date || veri.startDate || veri.formValues?.startDate || null;
    const istenCikis = veri.isten_cikis || veri.end_date || veri.endDate || veri.formValues?.endDate || null;
    const brutTotal = veri.brut_total || veri.totalBrut || veri.brut || 0;
    const netTotal = veri.net_total || veri.totalNet || veri.net || 0;
    dataPayload = {
      form: veri.formValues || veri.form || {},
      results: { totals: veri.totals || {}, brut: brutTotal, net: netTotal },
      ise_giris: iseGiris,
      isten_cikis: istenCikis,
      brut_total: brutTotal,
      net_total: netTotal,
    };
  }
  const payload = { name: kayitAdi || "", type: hesapTuru, data: dataPayload };
  const validId = mevcutId != null && mevcutId !== "" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
  const url = validId ? API_URL + "/" + validId : API_URL;
  const method = validId ? "PUT" : "POST";
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) },
    body: JSON.stringify(payload),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Backend'den beklenmeyen yanıt (Status: " + response.status + ")");
  }
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || result.error || "Kayıt işlemi başarısız");
  }
  return {
    id: result.id || Number(mevcutId) || 0,
    success: true,
    message: mevcutId ? "Kayıt başarıyla güncellendi" : "Kayıt başarıyla kaydedildi",
    name: result.name || kayitAdi,
  };
}
