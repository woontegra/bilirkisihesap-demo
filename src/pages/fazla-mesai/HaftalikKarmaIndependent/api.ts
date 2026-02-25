/**
 * api.ts
 * Fazla Mesai Bilirkişi 1 sayfası için backend API çağrıları
 */

import { apiPost } from "./localUtils/apiClient";
import { loadCalculation as loadCalculationFromSave } from "./save";
import type { LoadCalculationResponse } from "./contract";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Route path'leri
const ROUTES = {
  BILIRKISI1: "/api/fm/bilirkisi1",
} as const;

// Calculation type (must match database type exactly)
const CALCULATION_TYPE = "haftalik_karma_fazla_mesai";

/**
 * Fazla Mesai Bilirkişi 1 hesaplama API çağrısı
 */
export async function calculateFazlaMesaiBilirkisi1(payload: any): Promise<{
  success: boolean;
  rows?: any[];
  totalBrut?: number;
  totalNet?: number;
  textPeriods?: any[];
  weeklyOvertimeHours?: number;
  stepsText?: string;
  error?: string;
}> {
  try {
    const response = await apiPost(ROUTES.BILIRKISI1, payload);

    if (!response.ok) {
      let errorMessage = 'Backend error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json();
    return {
      success: true,
      rows: result.rows || [],
      totalBrut: result.totalBrut || 0,
      totalNet: result.totalNet || 0,
      textPeriods: result.textPeriods || [],
      weeklyOvertimeHours: result.weeklyOvertimeHours || 0,
      stepsText: result.stepsText || "",
    };
  } catch (error: any) {
    console.error("[Fazla Mesai Bilirkişi 1] API error:", error);
    return {
      success: false,
      error: error.message || "API çağrısı başarısız oldu",
    };
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
