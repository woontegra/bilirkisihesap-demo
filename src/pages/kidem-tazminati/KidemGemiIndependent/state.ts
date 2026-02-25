/**
 * state.ts
 * Sadece bu sayfanın state'i.
 * Başka sayfa state'i ile bağlantı KURMA.
 */

import { useState } from "react";

/**
 * Totals state interface
 */
export interface TotalsState {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}

/**
 * Form values state interface (Gemi adamları için)
 */
export interface KidemGemiFormValuesState {
  iseGiris: string;
  istenCikis: string;
  brut: string;
  brutUcret: string;
  prim: string;
  diger: string;
  isSGK: boolean;
  startDate: string;
  endDate: string;
  exitDate: string;
  extras: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

/**
 * State hook'u
 */
export function useKidemGemiState() {
  const [totals, setTotals] = useState<TotalsState>({
    toplam: 0,
    yil: 0,
    ay: 0,
    gun: 0,
  });

  const [formValues, setFormValues] = useState<KidemGemiFormValuesState>({
    iseGiris: "",
    istenCikis: "",
    brut: "",
    brutUcret: "",
    prim: "",
    diger: "",
    isSGK: true,
    startDate: "",
    endDate: "",
    exitDate: "",
    extras: [],
  });

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [appliedEklenti, setAppliedEklenti] = useState<
    { field: string; value: number } | number | null
  >(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [matchedTavanState, setMatchedTavanState] = useState<any | null>(null);
  const [tavanUygulandi, setTavanUygulandi] = useState<boolean>(false);
  const [tavanDegeri, setTavanDegeri] = useState<number | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
  });
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  const [brutTazminat, setBrutTazminat] = useState(0);
  const [netTazminat, setNetTazminat] = useState(0);
  const [kullanilacakBrutUcret, setKullanilacakBrutUcret] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewGemiReportModal, setShowNewGemiReportModal] = useState(false);

  return {
    totals,
    setTotals,
    formValues,
    setFormValues,
    activeModal,
    setActiveModal,
    appliedEklenti,
    setAppliedEklenti,
    currentRecordName,
    setCurrentRecordName,
    exitDate,
    setExitDate,
    matchedTavanState,
    setMatchedTavanState,
    tavanUygulandi,
    setTavanUygulandi,
    tavanDegeri,
    setTavanDegeri,
    eklentiValues,
    setEklentiValues,
    applyFunctions,
    setApplyFunctions,
    brutTazminat,
    setBrutTazminat,
    netTazminat,
    setNetTazminat,
    kullanilacakBrutUcret,
    setKullanilacakBrutUcret,
    warnings,
    setWarnings,
    isLoading,
    setIsLoading,
    showNewGemiReportModal,
    setShowNewGemiReportModal,
  };
}
