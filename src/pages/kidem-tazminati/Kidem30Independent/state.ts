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
 * Form values state interface
 */
export interface FormValuesState {
  brutUcret: string;
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  diger: string;
  startDate: string;
  endDate: string;
  exitDate: string;
  isIhbar: boolean;
  ihbarTarihi: string;
  ihbarSuresi: string;
  isKidemTavan: boolean;
  isYabanci: boolean;
  isSGK: boolean;
  isGelirVergisi: boolean;
  isDamgaVergisi: boolean;
  [key: string]: any;
}

/**
 * State hook'u
 */
export function useKidem30State() {
  const [totals, setTotals] = useState<TotalsState>({
    toplam: 0,
    yil: 0,
    ay: 0,
    gun: 0,
  });

  const [formValues, setFormValues] = useState<FormValuesState>({
    brutUcret: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    diger: "",
    startDate: "",
    endDate: "",
    exitDate: "",
    isIhbar: false,
    ihbarTarihi: "",
    ihbarSuresi: "14",
    isKidemTavan: true,
    isYabanci: false,
    isSGK: true,
    isGelirVergisi: true,
    isDamgaVergisi: true,
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
    ikramiye: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  const [brutTazminat, setBrutTazminat] = useState(0);
  const [netTazminat, setNetTazminat] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNewKidem30ReportModal, setShowNewKidem30ReportModal] = useState(false);

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
    warnings,
    setWarnings,
    isLoading,
    setIsLoading,
    showReportModal,
    setShowReportModal,
    showNewKidem30ReportModal,
    setShowNewKidem30ReportModal,
  };
}
