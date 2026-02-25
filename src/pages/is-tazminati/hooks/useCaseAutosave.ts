import { useEffect, useRef } from "react";
import { API_BASE_URL } from "@/utils/apiClient";
import { getScopedStorageKey } from "@/utils/storageKey";

export type CasePayload = {
  ad?: string;
  soyad?: string;
  cinsiyet?: string;
  dogum_tarihi?: string;
  kaza_tarihi?: string;
  rapor_tarihi?: string;
  asgari_ucret_yili?: string | number;
  asgari_ucret_tutari?: string | number;
  gelir?: string | number;
  // allow arbitrary extras as future extension
  [k: string]: any;
};

export function useCaseAutosave(data: CasePayload, enabled = true, delayMs = 500) {
  const timer = useRef<number | null>(null);
  const lastSaved = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data ?? {});
    if (serialized === lastSaved.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        // Minimal POST. Backend contract can be adjusted later.
        await fetch(`${API_BASE_URL}/api/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": "1" },
          body: serialized,
        });
        lastSaved.current = serialized;
        localStorage.removeItem(getScopedStorageKey("kidem_autosave_fallback"));
      } catch {
        // Fallback to localStorage
        localStorage.setItem(getScopedStorageKey("kidem_autosave_fallback"), serialized);
      }
    }, delayMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [data, enabled, delayMs]);
}
