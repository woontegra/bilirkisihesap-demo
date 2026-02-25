/**
 * Merkezi Kayıt Servisi – lokal kopya (bu sayfa için).
 */
import { API_BASE_URL } from "../localConstants/apiBaseUrl";

const API_URL = `${API_BASE_URL}/api/saved-cases`;

export type HesapTuru = "kidem_basin" | string;

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
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    let dataPayload: any = {};
    if (veri.data) {
      dataPayload = {
        ...veri.data,
        net_total: veri.net_total || veri.data.results?.net || veri.data.net_total,
        brut_total: veri.brut_total || veri.data.results?.brut || veri.data.brut_total,
        ise_giris: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.ise_giris || veri.start_date,
        isten_cikis: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.isten_cikis || veri.end_date,
        start_date: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.start_date,
        end_date: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.end_date,
        total: veri.total || veri.data.total || veri.data.results?.brut || veri.data.results?.totals?.toplam,
      };
    } else {
      const iseGiris = veri.ise_giris || veri.start_date || veri.formValues?.startDate || veri.formValues?.iseGiris || null;
      const istenCikis = veri.isten_cikis || veri.end_date || veri.exitDate || veri.formValues?.endDate || veri.formValues?.exitDate || veri.formValues?.istenCikis || null;
      const brutTotal = veri.brut_total || veri.brutTazminat || veri.totalBrut || veri.brut || 0;
      const netTotal = veri.net_total || veri.netTazminat || veri.totalNet || veri.net || 0;
      dataPayload = {
        form: veri.formValues || veri.form || {},
        results: { totals: veri.totals || {}, brut: brutTotal, net: netTotal },
        appliedEklenti: veri.appliedEklenti,
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: brutTotal,
        net_total: netTotal,
      };
    }
    const payload = { name: kayitAdi || "", type: hesapTuru, data: dataPayload };
    const validId = mevcutId && mevcutId !== "" && mevcutId !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
    const url = validId ? `${API_URL}/${validId}` : API_URL;
    const method = validId ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Backend'den beklenmeyen yanıt alındı (Status: ${response.status}).`);
    }
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || `Kayıt işlemi başarısız oldu (${response.status})`);
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
