/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

import { loadCalculation as loadCalculationFromSave } from "./save";
import type {
  NetFromGrossRequest,
  NetFromGrossResponse,
  LoadCalculationResponse,
  GrossFromNetData,
} from "./contract";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Route path'leri
const ROUTES = {
  NET_FROM_GROSS: "/api/bakiye-ucret/net-from-gross",
  GROSS_FROM_NET: "/api/bakiye-ucret/gross-from-net",
} as const;

// Calculation type
const CALCULATION_TYPE = "davaci_ucreti";

/**
 * Net from Gross API çağrısı
 */
export async function calculateNetFromGross(
  request: NetFromGrossRequest
): Promise<NetFromGrossResponse> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";
    
    const response = await fetch(`${API_BASE_URL}${ROUTES.NET_FROM_GROSS}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        gross: request.gross,
        year: request.year,
      }),
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => ({
        error: `HTTP error! status: ${response.status}`,
      }));
      return {
        success: false,
        error: errorResult.error || `HTTP error! status: ${response.status}`,
      };
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "API çağrısı başarısız oldu",
    };
  }
}

/**
 * Gross from Net API çağrısı (Netten Brüte - Ücret Alacağı ile aynı kurallar)
 */
export async function calculateGrossFromNet(
  netInput: number,
  year: number
): Promise<{ success: boolean; data?: GrossFromNetData; error?: string }> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";

    const response = await fetch(`${API_BASE_URL}${ROUTES.GROSS_FROM_NET}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ netInput, year }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP error! status: ${response.status}`,
      };
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "API çağrısı başarısız oldu";
    return { success: false, error: message };
  }
}

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  caseId: string
): Promise<LoadCalculationResponse> {
  const result = await loadCalculationFromSave(caseId, CALCULATION_TYPE);
  return {
    success: result.success,
    data: result.data,
    name: result.name,
    error: result.error,
  };
}
