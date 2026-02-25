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
  calculateNetDisplay,
  checkKidemTazminatiHakki,
} from "./calculations";
import type { FormValuesState, TotalsState } from "./state";

/**
 * Tavan uygulanmış brüt ücret hesaplama aksiyonu
 */
export function handleCalculateKullanilacakBrutUcret(
  formValues: FormValuesState,
  exitDate: string
): number {
  return calculateKullanilacakBrutUcret(formValues, exitDate);
}

/**
 * Tavan bilgisi hesaplama aksiyonu
 */
export function handleCalculateTavanBilgisi(
  formValues: FormValuesState,
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
): {
  brutTazminat: number;
  netTazminat: number;
} {
  return calculateKidemTazminati(kullanilacakBrutUcret, totals);
}

/**
 * Damga vergisi hesaplama aksiyonu
 */
export function handleCalculateDamgaVergisi(brut: number): number {
  return calculateDamgaVergisi(brut);
}

/**
 * Net ücret hesaplama aksiyonu
 */
export function handleCalculateNetDisplay(brut: number): number {
  return calculateNetDisplay(brut);
}

/**
 * Kıdem tazminatı hakkı kontrolü aksiyonu
 */
export function handleCheckKidemTazminatiHakki(totals: TotalsState): boolean {
  return checkKidemTazminatiHakki(totals);
}
