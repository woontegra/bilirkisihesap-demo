/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 * Request ve Response interface'leri burada tanımlanacak.
 */

import type { HaftaTatiliTableRow, DateRange, ExcludedDay, HaftaTatiliNetSummary } from "./state";

// Kaydedilmiş hafta tatili verisi formatı
export interface HaftaTatiliSavedData {
  data?: {
    form?: HaftaTatiliFormData;
    results?: HaftaTatiliResultsData;
  };
  form?: HaftaTatiliFormData;
  workerPeriods?: DateRange[];
  selectedHolidays?: string[];
  excludedDays?: ExcludedDay[];
  zamanasimi?: { active: boolean; start: string | null };
  haftaTatiliKullanim?: {
    baslangic: string;
    bitis: string;
    gunSayisi: number;
  };
  periods?: HaftaTatiliTableRow[];
  settlement?: {
    hakkaniyet: number;
    settleAmount: string;
    sonuc: number;
  };
}

export interface HaftaTatiliFormData {
  workerPeriods?: DateRange[];
  selectedHolidays?: string[];
  excludedDays?: ExcludedDay[];
  zamanasimi?: { active: boolean; start: string | null };
  haftaTatiliKullanim?: {
    baslangic: string;
    bitis: string;
    gunSayisi: number;
  };
  periods?: HaftaTatiliTableRow[];
  katsayi?: number;
  calculatedHaftaTatiliDays?: number;
  settlement?: {
    hakkaniyet: number;
    settleAmount: string;
    sonuc: number;
  };
}

export interface HaftaTatiliResultsData {
  totals?: {
    brut: number;
    net: number;
  };
  brut?: number;
  net?: number;
  netConversion?: HaftaTatiliNetSummary;
}

// Kayıt kaydetme request
export interface HaftaTatiliSaveData {
  data: {
    form: HaftaTatiliFormData;
    results: HaftaTatiliResultsData;
  };
  start_date?: string | null;
  end_date?: string | null;
  brut_total: number;
  net_total: number;
  notes: string;
  periods?: HaftaTatiliTableRow[];
  totalBrut?: number;
  totalNet?: number;
  netConversion?: HaftaTatiliNetSummary;
  settlement?: {
    hakkaniyet: number;
    settleAmount: string;
    sonuc: number;
  };
  workerPeriods?: DateRange[];
  selectedHolidays?: string[];
  calculatedHaftaTatiliDays?: number;
  katsayi?: number;
  zamanasimi?: { active: boolean; start: string | null };
  excludedDays?: ExcludedDay[];
  haftaTatiliKullanim?: {
    baslangic: string;
    bitis: string;
    gunSayisi: number;
  };
}
