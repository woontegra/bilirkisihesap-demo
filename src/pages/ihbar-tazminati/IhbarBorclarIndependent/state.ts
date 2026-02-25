/**
 * state.ts
 * Sadece bu sayfanın state'i.
 * Başka sayfa state'i ile bağlantı KURMA.
 */

import { useState } from "react";
import type { ExtraItem, WorkPeriodTotals, IhbarBorclarFormData } from "./contract";

/**
 * İhbar Borçlar Kanunu sayfası state hook'u
 */
export function useIhbarBorclarState() {
  const [totals, setTotals] = useState<WorkPeriodTotals>({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<IhbarBorclarFormData | null>(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  
  // Modal state management
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yol: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  
  // Extra calculations modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<any[]>([]);
  
  // Backend hesaplaması için state
  const [weeks, setWeeks] = useState(2);
  const [amount, setAmount] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);
  
  // YENİ RAPOR SİSTEMİ: State
  const [showNewIhbarBorclarReportModal, setShowNewIhbarBorclarReportModal] = useState(false);

  return {
    totals,
    setTotals,
    appliedEklenti,
    setAppliedEklenti,
    exitDate,
    setExitDate,
    formValues,
    setFormValues,
    currentRecordName,
    setCurrentRecordName,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    applyFunctions,
    setApplyFunctions,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    saveName,
    setSaveName,
    savedSets,
    setSavedSets,
    weeks,
    setWeeks,
    amount,
    setAmount,
    gelirVergisi,
    setGelirVergisi,
    gelirVergisiDilimleri,
    setGelirVergisiDilimleri,
    damgaVergisi,
    setDamgaVergisi,
    net,
    setNet,
    showNewIhbarBorclarReportModal,
    setShowNewIhbarBorclarReportModal,
  };
}
