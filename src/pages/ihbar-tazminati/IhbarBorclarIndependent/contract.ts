/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 * Request ve Response interface'leri burada tanımlanacak.
 */

// Extra Item tipi
export interface ExtraItem {
  id: string;
  label: string;
  value: string;
}

// Form Values tipi
export interface IhbarBorclarFormData {
  iseGiris?: string;
  istenCikis?: string;
  brut?: string;
  brutUcret?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  extras?: ExtraItem[];
  startDate?: string;
  endDate?: string;
  exitDate?: string;
}

// Totals tipi
export interface WorkPeriodTotals {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}

// İhbar Tazminatı Hesaplama Request
export interface CalculateIhbarBorclarRequest {
  brut: string;
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  diger: string;
  extras: ExtraItem[];
  totals: WorkPeriodTotals;
  exitYear: number;
}

// İhbar Tazminatı Hesaplama Response
export interface CalculateIhbarBorclarResponse {
  success: boolean;
  data?: {
    weeks: number;
    brut: number;
    gelirVergisi: number;
    gelirVergisiDilimleri: string;
    damgaVergisi: number;
    net: number;
  };
  error?: string;
}

// Kayıt yükleme response
export interface LoadCalculationResponse {
  data: any;
  formValues: IhbarBorclarFormData;
  appliedEklenti: any;
  totals: WorkPeriodTotals;
  brutTazminat: number;
  netTazminat: number;
  notes: string;
  name: string;
}

// Kaydedilmiş veri formatı
export interface IhbarBorclarSavedData {
  data?: {
    form?: IhbarBorclarFormData;
    results?: {
      totals: WorkPeriodTotals;
      brut: number;
      net: number;
    };
  };
  form?: IhbarBorclarFormData;
  results?: {
    totals: WorkPeriodTotals;
    brut: number;
    net: number;
  };
  ise_giris?: string;
  isten_cikis?: string;
  brut_total?: number;
  net_total?: number;
  start_date?: string;
  end_date?: string;
  total?: number;
}

// Kayıt kaydetme request
export interface IhbarBorclarSaveData {
  data: {
    form: IhbarBorclarFormData;
    results: {
      totals: WorkPeriodTotals;
      brut: number;
      net: number;
    };
  };
  ise_giris: string | null;
  isten_cikis: string | null;
  brut_total: number;
  net_total: number;
  start_date: string | null;
  end_date: string | null;
  total: number;
}
