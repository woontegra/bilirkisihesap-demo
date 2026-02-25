/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

import { API_BASE_URL, apiPost } from "./localUtils/apiClient";
import { yukleHesap } from "./localUtils/kaydetServisi";
import type {
  CalculateIhbarBorclarRequest,
  CalculateIhbarBorclarResponse,
  LoadCalculationResponse,
} from "./contract";

// Route path'leri
const ROUTES = {
  CALCULATE: "/api/ihbar/borclar",
} as const;

// Calculation type
const CALCULATION_TYPE = "ihbar_borclar";

// Load endpoint
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;

/**
 * İhbar Tazminatı hesaplama API çağrısı
 */
export async function calculateIhbarBorclar(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost(ROUTES.CALCULATE, request);

  if (!response.ok) {
    const errorResult = await response.json().catch(() => ({
      error: `HTTP error! status: ${response.status}`,
    }));
    return {
      success: false,
      error: errorResult.error || `HTTP error! status: ${response.status}`,
    };
  }

  const data = await response.json();
  return data;
}

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  caseId: string
): Promise<LoadCalculationResponse> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    
    const response = await fetch(`${LOAD_ENDPOINT}/${caseId}`, {
      headers: {
        "x-tenant-id": String(tenantId)
      }
    });
    
    // Response'un JSON olup olmadığını kontrol et
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Kayıt bulunamadı (ID: ${caseId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
      }
      throw new Error(data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`);
    }
    
    // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
    // data field'ı JSON string olabilir veya object olabilir
    let payload = {};
    
    if (data.data) {
      // data field'ı string ise parse et
      if (typeof data.data === 'string') {
        try {
          payload = JSON.parse(data.data);
        } catch {
          payload = {};
        }
      } else {
        payload = data.data;
      }
    }
    
    // loadCalculation'dan gelen veriyi direkt kullan (dönüşüm yapmadan)
    return {
      data: payload, // Orijinal payload'ı da döndür
      formValues: payload.form || payload.formValues || {},
      appliedEklenti: payload.appliedEklenti || null,
      totals: payload.results?.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 },
      brutTazminat: payload.results?.brut || payload.brutTazminat || 0,
      netTazminat: payload.results?.net || payload.netTazminat || 0,
      notes: data.notes || data.aciklama || "",
      name: data.name || data.notes || data.aciklama || "" // Mevcut kaydın ismi
    };
  } catch (err: any) {
    console.error('Kayıt yükleme hatası:', err);
    throw err;
  }
}
