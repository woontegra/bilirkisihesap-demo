/**
 * actions.ts
 * Kullanıcı aksiyonları burada olacak.
 * Action → api → calculations akışına uyar.
 * Butonlar doğrudan hesap yapmaz.
 */

import { calculatePrim, loadCalculation } from "./api";
import { validatePrimForm, getBrutForNetConversion, calculateNetFromBrut, parseNum } from "./calculations";
import type { PrimRowRequest, PrimSavedData } from "./contract";

/**
 * Prim hesaplama aksiyonu
 */
export async function handleCalculatePrim(rows: PrimRowRequest[]): Promise<{
  amounts: number[];
  total: number;
} | null> {
  const result = await calculatePrim({ rows });
  
  if (result.success && result.data) {
    return {
      amounts: result.data.amounts || [],
      total: result.data.total || 0,
    };
  }
  
  return null;
}

/**
 * Kayıt yükleme aksiyonu
 */
export async function handleLoadCalculation(loadId: string): Promise<{
  formData: PrimSavedData;
  name: string;
  notes: string;
} | null> {
  try {
    const data = await loadCalculation({ loadId });
    
    // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
    // data field'ı JSON string olabilir veya object olabilir
    let payload: PrimSavedData = {};
    
    if (data.data) {
      // data field'ı string ise parse et
      if (typeof data.data === 'string') {
        try {
          payload = JSON.parse(data.data);
        } catch {
          payload = {};
        }
      } else {
        payload = data.data as PrimSavedData;
      }
    }
    
    const formData = payload.form || payload.formValues || payload;
    
    return {
      formData: formData as PrimSavedData,
      name: data.name || data.notes || data.aciklama || "",
      notes: data.notes || data.aciklama || "",
    };
  } catch (err: any) {
    console.error('Kayıt yükleme hatası:', err);
    throw err;
  }
}

/**
 * Kayıt kaydetme için veri hazırlama
 */
export function prepareSaveData(
  rows: PrimRowRequest[],
  amounts: number[],
  total: number,
  brutInputForNet: string
) {
  const brutForNetConversion = getBrutForNetConversion(brutInputForNet, total);
  const netTotal = calculateNetFromBrut(brutForNetConversion);
  
  return {
    data: {
      form: {
        rows: rows.map((r, i) => ({
          id: r.id,
          principal: r.principal,
          percent: r.percent,
          index: i + 1,
          amount: amounts[i] || 0,
        })),
        brutInputForNet,
      },
      results: {
        total,
        amounts,
        brutForNetConversion,
        rows: rows.map((r, i) => ({
          id: r.id,
          principal: r.principal,
          percent: r.percent,
          index: i + 1,
          amount: amounts[i] || 0,
        })),
      },
    },
    brut_total: Number(total.toFixed(2)),
    net_total: Number(netTotal.toFixed(2)),
    rows: rows.map((r, i) => ({
      index: i + 1,
      principal: parseNum(r.principal),
      percent: parseNum(r.percent),
      amount: amounts[i] || 0,
    })),
  };
}

/**
 * Form validasyonu aksiyonu
 */
export function handleValidateForm(rows: PrimRowRequest[]): {
  isValid: boolean;
  firstError?: string;
} {
  const validation = validatePrimForm(rows);
  return {
    isValid: validation.isValid,
    firstError: validation.errors[0],
  };
}
