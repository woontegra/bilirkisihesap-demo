/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
import type {
  LoadCalculationRequest,
  LoadCalculationResponse,
  LoadCalculationResult,
  KidemGemiSavedData,
} from "./contract";

// Route path'leri
const ROUTES = {
  SAVED_CASES: "/api/saved-cases",
} as const;

// Normalize function for old and new data formats
function normalizeLoaded(payload: any) {
  // Yeni format: payload içinde direkt form ve results var
  if (payload.form && payload.results) {
    const form = payload.form || {};
    return {
      form: {
        ...form,
        iseGiris: form.iseGiris || form.startDate || '',
        istenCikis: form.istenCikis || form.endDate || form.exitDate || '',
        brut: form.brut || form.brutUcret || '',
        prim: form.prim || '',
        diger: form.diger || '',
        startDate: form.startDate || form.iseGiris || '',
        endDate: form.endDate || form.istenCikis || '',
        exitDate: form.exitDate || form.endDate || form.istenCikis || '',
        brutUcret: form.brutUcret || form.brut || '',
      },
      totals: payload.results.totals || {},
      brut: payload.results.brut || 0,
      net: payload.results.net || 0,
      notes: payload.notes || ""
    };
  }
  
  // payload.data içinde form ve results varsa (nested format)
  if (payload.data && payload.data.form && payload.data.results) {
    const form = payload.data.form || {};
    return {
      form: {
        ...form,
        startDate: form.startDate || form.iseGiris || '',
        endDate: form.endDate || form.istenCikis || '',
        exitDate: form.exitDate || form.endDate || form.istenCikis || '',
        iseGiris: form.startDate || form.iseGiris || '',
        istenCikis: form.exitDate || form.endDate || form.istenCikis || '',
        brutUcret: form.brutUcret || form.brut || '',
        brut: form.brutUcret || form.brut || '',
      },
      totals: payload.data.results.totals || {},
      brut: payload.data.results.brut || 0,
      net: payload.data.results.net || 0,
      notes: payload.data.notes || ""
    };
  }
  
  // loadCalculation'dan dönen format
  if (payload.formValues !== undefined) {
    const form = payload.formValues || {};
    return {
      form: {
        ...form,
        startDate: form.startDate || form.iseGiris || '',
        endDate: form.endDate || form.istenCikis || '',
        exitDate: form.exitDate || form.endDate || form.istenCikis || '',
        iseGiris: form.startDate || form.iseGiris || '',
        istenCikis: form.exitDate || form.endDate || form.istenCikis || '',
        brutUcret: form.brutUcret || form.brut || '',
        brut: form.brutUcret || form.brut || '',
      },
      totals: payload.totals || {},
      brut: payload.brutTazminat || 0,
      net: payload.netTazminat || 0,
      notes: payload.notes || ""
    };
  }

  // Eski format
  const form = payload.formValues || payload.form || {};
  return {
    form: {
      ...form,
      startDate: form.startDate || form.iseGiris || '',
      endDate: form.endDate || form.istenCikis || '',
      exitDate: form.exitDate || form.endDate || form.istenCikis || '',
      iseGiris: form.startDate || form.iseGiris || '',
      istenCikis: form.exitDate || form.endDate || form.istenCikis || '',
      brutUcret: form.brutUcret || form.brut || '',
      brut: form.brutUcret || form.brut || '',
    },
    totals: payload.totals || {},
    brut: payload.brutTazminat || payload.brut || 0,
    net: payload.netTazminat || payload.net || 0,
    notes: payload.notes || ""
  };
}

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  request: LoadCalculationRequest
): Promise<LoadCalculationResult> {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  const response = await fetch(`${API_BASE_URL}${ROUTES.SAVED_CASES}/${request.loadId}`, {
    headers: {
      "x-tenant-id": String(tenantId),
    },
  });

  // Response'un JSON olup olmadığını kontrol et
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
  }

  const data: LoadCalculationResponse = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Kayıt bulunamadı (ID: ${request.loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`
      );
    }
    throw new Error(
      data.notes || `Yükleme işlemi başarısız oldu (${response.status})`
    );
  }

  // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
  let payload: KidemGemiSavedData = {};

  if (data.data) {
    if (typeof data.data === "string") {
      try {
        payload = JSON.parse(data.data);
      } catch {
        payload = {};
      }
    } else {
      payload = data.data as KidemGemiSavedData;
    }
  }

  const normalized = normalizeLoaded(payload);

  return {
    data: payload,
    formValues: normalized.form,
    appliedEklenti: payload.appliedEklenti || null,
    totals: normalized.totals,
    brutTazminat: normalized.brut,
    netTazminat: normalized.net,
    notes: data.notes || data.aciklama || "",
    name: data.name || null,
  };
}
