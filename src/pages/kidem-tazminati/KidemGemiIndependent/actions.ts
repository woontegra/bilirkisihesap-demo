/**
 * actions.ts
 * Kullanıcı aksiyonları burada olacak.
 * Action → calculations akışına uyar.
 * Butonlar doğrudan hesap yapmaz.
 */

import {
  calculateKullanilacakBrutUcret,
  calculateTavanBilgisi,
  calculateKidemTazminati,
  calculateDamgaVergisi,
  calculateCiplakBrutUcret,
  calculateMuafiyetTutari,
  calculateGelirVergisi,
  calculateNetDisplay,
  checkKidemTazminatiHakki,
} from "./calculations";
import type { KidemGemiFormValuesState, TotalsState } from "./state";

/**
 * Tavan uygulanmış brüt ücret hesaplama aksiyonu
 */
export function handleCalculateKullanilacakBrutUcret(
  formValues: KidemGemiFormValuesState,
  exitDate: string
): number {
  return calculateKullanilacakBrutUcret(formValues, exitDate);
}

/**
 * Tavan bilgisi hesaplama aksiyonu
 */
export function handleCalculateTavanBilgisi(
  formValues: KidemGemiFormValuesState,
  exitDate: string
): {
  tavanUygulandiFlag: boolean;
  tavanDegeriValue: number | null;
  warnings: string[];
} {
  return calculateTavanBilgisi(formValues, exitDate);
}

/**
 * Kıdem tazminatı hesaplama aksiyonu
 */
export function handleCalculateKidemTazminati(
  kullanilacakBrutUcret: number,
  totals: TotalsState
): number {
  return calculateKidemTazminati(kullanilacakBrutUcret, totals);
}

/**
 * Damga vergisi hesaplama aksiyonu
 */
export function handleCalculateDamgaVergisi(brut: number): number {
  return calculateDamgaVergisi(brut);
}

/**
 * Çıplak brüt ücret hesaplama aksiyonu
 */
export function handleCalculateCiplakBrutUcret(formValues: KidemGemiFormValuesState): number {
  return calculateCiplakBrutUcret(formValues);
}

/**
 * Muafiyet tutarı hesaplama aksiyonu
 */
export function handleCalculateMuafiyetTutari(ciplakBrutUcret: number): number {
  return calculateMuafiyetTutari(ciplakBrutUcret);
}

/**
 * Gelir vergisi hesaplama aksiyonu
 */
export function handleCalculateGelirVergisi(
  brutTazminat: number,
  muafiyetTutari: number,
  selectedYear: number
): number {
  return calculateGelirVergisi(brutTazminat, muafiyetTutari, selectedYear);
}

/**
 * Net ücret hesaplama aksiyonu
 */
export function handleCalculateNetDisplay(
  brutTazminat: number,
  damgaVergisi: number,
  gelirVergisi: number
): number {
  return calculateNetDisplay(brutTazminat, damgaVergisi, gelirVergisi);
}

/**
 * Kıdem tazminatı hakkı kontrolü aksiyonu
 */
export function handleCheckKidemTazminatiHakki(totals: TotalsState): boolean {
  return checkKidemTazminatiHakki(totals);
}
