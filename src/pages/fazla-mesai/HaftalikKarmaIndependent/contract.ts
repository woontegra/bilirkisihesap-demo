/**
 * contract.ts
 * Fazla Mesai Bilirkişi 1 sayfası için tip tanımları
 */

// Beyan Modeli - Davacı ve tanıklar için ortak kullanılacak beyan/dağıtım verisi
export type { Declaration, Period, WeeklyPattern, PatternDay } from "./declarationModel";

// Beyan tipi
export interface Beyan {
  in: string;
  out: string;
  dateIn?: string;
  dateOut?: string;
}

// Tanık tipi
export interface Witness extends Beyan {
  id: number;
}

// Dışlanan gün tipi
export interface ExcludedDay {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer" | "UBGT";
  start: string;
  end: string;
  days: number;
}

// Dönem satırı tipi
export interface PeriodRow {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  calc225: number;
  factor: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  text?: string;
  manual?: boolean;
}

// Zamanaşımı tipi
export interface ZamanasimiData {
  davaTarihi: string;
  arabuluculukBaslangic: string;
  arabuluculukBitis: string;
  arabuluculukGun: number;
  nihaiBaslangic: string;
}

// Kayıt yükleme response
export interface LoadCalculationResponse {
  success: boolean;
  data?: FazlaMesaiBilirkisi1SavedData;
  name?: string;
  error?: string;
}

// Kaydedilmiş fazla mesai bilirkişi 1 verisi formatı
export interface FazlaMesaiBilirkisi1SavedData {
  data?: {
    form?: FazlaMesaiBilirkisi1FormData;
    results?: FazlaMesaiBilirkisi1ResultsData;
  };
  form?: FazlaMesaiBilirkisi1FormData;
  iseGiris?: string;
  istenCikis?: string;
  gir?: string;
  cik?: string;
  weeklyDays?: string;
  davaci?: Beyan;
  davali?: Beyan;
  taniklar?: Witness[];
  exclusions?: ExcludedDay[];
  rows?: PeriodRow[];
  notes?: string;
  include270?: boolean;
  haftaDususBilgisi?: number | null;
  zamanasimi?: ZamanasimiData;
  zamanasimiBaslangic?: string | null;
  katSayi?: number;
  hasCustomKatsayi?: boolean;
  mahsuplasmaMiktari?: string;
  mahsuplasamaData?: { [year: number]: { [month: number]: number } };
  start_date?: string;
  end_date?: string;
}

export interface FazlaMesaiBilirkisi1FormData {
  iseGiris?: string;
  istenCikis?: string;
  gir?: string;
  cik?: string;
  weeklyDays?: string;
  davaci?: Beyan;
  davali?: Beyan;
  taniklar?: Witness[];
  exclusions?: ExcludedDay[];
  rows?: PeriodRow[];
  notes?: string;
  include270?: boolean;
  haftaDususBilgisi?: number | null;
  zamanasimi?: ZamanasimiData;
  zamanasimiBaslangic?: string | null;
  katSayi?: number;
  hasCustomKatsayi?: boolean;
  mahsuplasmaMiktari?: string;
  mahsuplasamaData?: { [year: number]: { [month: number]: number } };
}

export interface FazlaMesaiBilirkisi1ResultsData {
  totals?: {
    totalBrut: number;
    totalFm: number;
    totalNet: number;
  };
  brut?: number;
  fm?: number;
  net?: number;
}

// Kayıt kaydetme request
export interface FazlaMesaiBilirkisi1SaveData {
  data: {
    form: FazlaMesaiBilirkisi1FormData;
    results: FazlaMesaiBilirkisi1ResultsData;
  };
  brut_total: number;
  fm_total: number;
  net_total: number;
  pageType?: string;
}
