/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 * Request ve Response interface'leri burada tanımlanacak.
 */

// Prim hesaplama request
export interface PrimCalculateRequest {
  rows: PrimRowRequest[];
}

export interface PrimRowRequest {
  id: string;
  principal: string;
  percent: string;
}

// Prim hesaplama response
export interface PrimCalculateResponse {
  success: boolean;
  data?: {
    amounts: number[];
    total: number;
  };
  error?: string;
}

// Kayıt yükleme request (saved-cases endpoint)
export interface LoadCalculationRequest {
  loadId: string;
}

// Kayıt yükleme response
export interface LoadCalculationResponse {
  name?: string;
  notes?: string;
  aciklama?: string;
  data?: PrimSavedData | string; // JSON string veya object olabilir
  brut_total?: number;
  net_total?: number;
}

// Kaydedilmiş prim verisi formatı
export interface PrimSavedData {
  form?: PrimFormData;
  formValues?: PrimFormData;
  results?: PrimResultsData;
  data?: {
    form?: PrimFormData;
    results?: PrimResultsData;
  };
  rows?: PrimRowRequest[];
  brutInputForNet?: string;
  brut_total?: number;
  net_total?: number;
}

export interface PrimFormData {
  rows?: PrimRowRequest[];
  brutInputForNet?: string;
}

export interface PrimResultsData {
  total?: number;
  amounts?: number[];
  brutForNetConversion?: number;
  rows?: PrimRowRequest[];
}

// Kayıt kaydetme request (kaydetAc tarafından kullanılır)
export interface PrimSaveData {
  data: {
    form: PrimFormData;
    results: PrimResultsData;
  };
  brut_total: number;
  net_total: number;
  rows: Array<{
    index: number;
    principal: number;
    percent: number;
    amount: number;
  }>;
}
