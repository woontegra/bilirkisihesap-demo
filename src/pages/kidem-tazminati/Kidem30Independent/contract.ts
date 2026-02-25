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
  data?: Kidem30SavedData | string; // JSON string veya object olabilir
  brut_total?: number;
  net_total?: number;
}

// Kaydedilmiş kıdem tazminatı verisi formatı
export interface Kidem30SavedData {
  form?: Kidem30FormData;
  formValues?: Kidem30FormData;
  results?: Kidem30ResultsData;
  data?: {
    form?: Kidem30FormData;
    results?: Kidem30ResultsData;
  };
  appliedEklenti?: { field: string; value: number } | number | null;
  totals?: TotalsData;
  brutTazminat?: number;
  netTazminat?: number;
  brut?: number;
  net?: number;
  notes?: string;
}

export interface Kidem30FormData {
  brutUcret?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  diger?: string;
  startDate?: string;
  endDate?: string;
  exitDate?: string;
  iseGiris?: string;
  istenCikis?: string;
  isIhbar?: boolean;
  ihbarTarihi?: string;
  ihbarSuresi?: string;
  isKidemTavan?: boolean;
  isYabanci?: boolean;
  isSGK?: boolean;
  isGelirVergisi?: boolean;
  isDamgaVergisi?: boolean;
  extras?: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

export interface Kidem30ResultsData {
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
  formValues: Kidem30FormData;
  appliedEklenti: { field: string; value: number } | number | null;
  totals: TotalsData;
  brutTazminat: number;
  netTazminat: number;
  notes: string;
  name: string | null;
  baseProfile?: Record<string, unknown> | null; // Dosya temel profili
}

// Kayıt kaydetme request (kaydetAc tarafından kullanılır)
export interface Kidem30SaveData {
  data: {
    form: Kidem30FormData;
    results: Kidem30ResultsData;
  };
  brut_total: number;
  net_total: number;
}
