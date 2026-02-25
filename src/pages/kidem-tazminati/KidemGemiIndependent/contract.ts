/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 * Request ve Response interface'leri burada tanımlanacak.
 */

// Kayıt yükleme request (saved-cases endpoint)
export interface LoadCalculationRequest {
  loadId: string;
}

// Kayıt yükleme response
export interface LoadCalculationResponse {
  name?: string;
  notes?: string;
  aciklama?: string;
  data?: KidemGemiSavedData | string; // JSON string veya object olabilir
  brut_total?: number;
  net_total?: number;
}

// Kaydedilmiş kıdem tazminatı (gemi adamları) verisi formatı
export interface KidemGemiSavedData {
  form?: KidemGemiFormData;
  formValues?: KidemGemiFormData;
  results?: KidemGemiResultsData;
  data?: {
    form?: KidemGemiFormData;
    results?: KidemGemiResultsData;
  };
  appliedEklenti?: { field: string; value: number } | number | null;
  totals?: TotalsData;
  brutTazminat?: number;
  netTazminat?: number;
  brut?: number;
  net?: number;
  notes?: string;
}

export interface KidemGemiFormData {
  iseGiris?: string;
  istenCikis?: string;
  brut?: string;
  brutUcret?: string;
  prim?: string;
  diger?: string;
  startDate?: string;
  endDate?: string;
  exitDate?: string;
  isSGK?: boolean;
  extras?: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

export interface KidemGemiResultsData {
  totals?: TotalsData;
  brut?: number;
  net?: number;
  brutTazminat?: number;
  netTazminat?: number;
}

export interface TotalsData {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}

// Kayıt yükleme sonucu (loadCalculation fonksiyonunun döndürdüğü format)
export interface LoadCalculationResult {
  data: any; // Orijinal payload
  formValues: KidemGemiFormData;
  appliedEklenti: { field: string; value: number } | number | null;
  totals: TotalsData;
  brutTazminat: number;
  netTazminat: number;
  notes: string;
  name: string | null;
}

// Kayıt kaydetme request (kaydetAc tarafından kullanılır)
export interface KidemGemiSaveData {
  data: {
    form: KidemGemiFormData;
    results: KidemGemiResultsData;
  };
  brut_total: number;
  net_total: number;
}
