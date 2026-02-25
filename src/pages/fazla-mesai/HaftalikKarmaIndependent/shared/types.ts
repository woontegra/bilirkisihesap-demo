/**
 * shared/types.ts
 * Ortak tip tanımları - Tüm senaryolar tarafından kullanılır
 */

export type { Declaration, Period, WeeklyPattern, PatternDay } from "../declarationModel";

export interface Beyan {
  in: string;
  out: string;
  dateIn?: string;
  dateOut?: string;
}

export interface Witness extends Beyan {
  id: number;
}

export interface ExcludedDay {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer";
  start: string;
  end: string;
  days: number;
}

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
  periodLabel?: string;
}

export interface ZamanasimiData {
  davaTarihi: string;
  arabuluculukBaslangic: string;
  arabuluculukBitis: string;
  arabuluculukGun: number;
  nihaiBaslangic: string;
}

export interface LoadCalculationResponse {
  success: boolean;
  data?: FazlaMesaiBilirkisi1SavedData;
  name?: string;
  error?: string;
}

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
