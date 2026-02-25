/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

import { API_BASE_URL } from "@/utils/apiClient";
import type {
  PrimCalculateRequest,
  PrimCalculateResponse,
  LoadCalculationRequest,
  LoadCalculationResponse,
} from "./contract";

// Route path'leri
const ROUTES = {
  CALCULATE: "/api/prim-alacagi/calculate",
  SAVED_CASES: "/api/saved-cases",
} as const;

/**
 * Prim hesaplama API çağrısı
 */
export async function calculatePrim(
  request: PrimCalculateRequest
): Promise<PrimCalculateResponse> {
  const tenantId = localStorage.getItem("tenant_id") || "1";

  const response = await fetch(`${API_BASE_URL}${ROUTES.CALCULATE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": tenantId,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
    };
  }

  return await response.json();
}

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  request: LoadCalculationRequest
): Promise<LoadCalculationResponse> {
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

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Kayıt bulunamadı (ID: ${request.loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`
      );
    }
    throw new Error(
      data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`
    );
  }

  return data;
}
