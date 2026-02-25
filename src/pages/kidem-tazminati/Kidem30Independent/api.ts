/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
import type {
  LoadCalculationRequest,
  LoadCalculationResponse,
  LoadCalculationResult,
  Kidem30SavedData,
} from "./contract";

// Route path'leri
const ROUTES = {
  SAVED_CASES: "/api/saved-cases",
} as const;

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  request: LoadCalculationRequest
): Promise<LoadCalculationResult> {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  const response = await fetch(`${API_BASE_URL}${ROUTES.SAVED_CASES}/${request.loadId}`, {
    headers: {
      "x-tenant-id": String(tenantId),
    },
  });

  // Response'un JSON olup olmadığını kontrol et
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
  }

  const data: LoadCalculationResponse = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Kayıt bulunamadı (ID: ${request.loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`
      );
    }
    throw new Error(
      data.notes || `Yükleme işlemi başarısız oldu (${response.status})`
    );
  }

  // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
  // data field'ı JSON string olabilir veya object olabilir
  let payload: Kidem30SavedData = {};

  if (data.data) {
    // data field'ı string ise parse et
    if (typeof data.data === "string") {
      try {
        payload = JSON.parse(data.data);
      } catch {
        payload = {};
      }
    } else {
      payload = data.data as Kidem30SavedData;
    }
  }

  // Yeni ve eski format desteği
  const formData = payload.form || payload.formValues || payload.data?.form || {};
  const resultsData = payload.results || payload.data?.results || {};

  return {
    data: payload, // Orijinal payload'ı da döndür
    formValues: formData,
    appliedEklenti: payload.appliedEklenti || null,
    totals: resultsData.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 },
    brutTazminat: resultsData.brut || payload.brut || payload.brutTazminat || 0,
    netTazminat: resultsData.net || payload.net || payload.netTazminat || 0,
    notes: data.notes || data.aciklama || "",
    name: data.name || null, // Kayıt adını da döndür
    baseProfile: (data as any).baseProfile ?? null, // Dosya temel profili
  };
}
