/**
 * state.ts
 * Fazla Mesai Bilirkişi 1 sayfası state yönetimi
 */

import { useState, useRef } from "react";
import type { PeriodRow, Beyan, Witness, ExcludedDay, ZamanasimiData } from "./contract";
import type { Declaration } from "./declarationModel";

/**
 * Fazla Mesai Bilirkişi 1 state hook'u
 */
export function useFazlaMesaiBilirkisi1State() {
  // Kayıt bilgileri
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const isLoadingFromSavedRef = useRef<boolean>(false);
  const loadRanRef = useRef<string | null>(null);
  const caseIdRef = useRef<string | null>(null);
  
  // Tarih ve saat bilgileri
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [gir, setGir] = useState("");
  const [cik, setCik] = useState("");
  
  // Hesaplama sonuçları
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [backendRows, setBackendRows] = useState<PeriodRow[]>([]);
  const rowsRef = useRef<PeriodRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [include270, setInclude270] = useState(false);
  const [mode270, setMode270] = useState<"none" | "detailed" | "simple">("none");
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [haftaDususBilgisi, setHaftaDususBilgisi] = useState<number | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [notes, setNotes] = useState("");
  
  // Klasik akış
  const [stepsText, setStepsText] = useState<string>("");
  const [txtTatilsiz, setTxtTatilsiz] = useState<string>("");
  const [txtTatilli, setTxtTatilli] = useState<string>("");
  const [txtUnderSeven, setTxtUnderSeven] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [fmHoursAuto, setFmHoursAuto] = useState<number>(0);
  const [haftalikMesai, setHaftalikMesai] = useState<number>(0);
  
  // Beyanlar
  const [davaci, setDavaci] = useState<Beyan>({ in: "", out: "" });
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  
  // Hesaplama Senaryosu - SADECE UI kontrolü için (hesap fonksiyonlarına GİTMEZ)
  const [calculationScenario, setCalculationScenario] = useState<"" | "STANDART" | "HAFTALIK_KARMA" | "DONEMSEL" | "DONEMSEL_HAFTALIK_KARMA">("STANDART");
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SENARYO-SPECIFIC STATE - Her senaryo kendi state'ine sahip
  // ═══════════════════════════════════════════════════════════════════════════
  
  // STANDART Senaryosu State (basit giriş/çıkış)
  const [standardState, setStandardState] = useState({
    davaci: { in: "", out: "", dateIn: "", dateOut: "" },
    taniklar: [{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }] as Witness[],
    exclusions: [] as ExcludedDay[]
  });
  
  // HAFTALIK_KARMA Senaryosu State (B MODEL - Sanal günlük satırlar)
  // SABİT 2 GÜN GRUBU - Haftalık desen günlük satırlara çevrilir
  const [haftalikKarmaState, setHaftalikKarmaState] = useState({
    // Davacı için tarih ve gün grupları
    weeklyStartDateISO: "" as string,
    weeklyEndDateISO: "" as string,
    dayGroups: [
      { dayCount: 0, startTime: "", endTime: "" },
      { dayCount: 0, startTime: "", endTime: "" }
    ] as Array<{ dayCount: number; startTime: string; endTime: string }>,
    // Tanıklar için bağımsız state
    witnesses: [] as Array<{ 
      id: number; 
      name: string; 
      startDateISO: string; 
      endDateISO: string; 
      dayGroups: Array<{ days: number; startTime: string; endTime: string }>
    }>,
    exclusions: [] as ExcludedDay[]
  });
  
  // DONEMSEL Senaryosu State (dönemler, SINGLE pattern only)
  const [donemselState, setDonemselState] = useState({
    davaciDeclaration: null as Declaration | null,
    tanikDeclarations: [] as Declaration[],
    exclusions: [] as ExcludedDay[]
  });
  
  // DONEMSEL_HAFTALIK_KARMA Senaryosu State (dönemler, MIXED pattern allowed)
  const [donemselKarmaState, setDonemselKarmaState] = useState({
    davaciDeclaration: null as Declaration | null,
    tanikDeclarations: [] as Declaration[],
    exclusions: [] as ExcludedDay[]
  });
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [backendResult, setBackendResult] = useState<{ textPeriods?: any[]; weeklyOvertimeHours?: number }>({});
  const [haftalikFazlaMesai, setHaftalikFazlaMesai] = useState<number | null>(null);
  const [overtimeResults, setOvertimeResults] = useState<any[]>([]);
  const [finalWeeklyOvertime, setFinalWeeklyOvertime] = useState<number>(0);
  const [caseData, setCaseData] = useState<any>(() => ({
    davaci: {
      startDate: "",
      endDate: "",
      startTime: "07:30",
      endTime: "17:30",
    },
    taniklar: [],
    saved: false,
  }));
  const [intervals, setIntervals] = useState<any[]>([]);
  
  // Zamanaşımı
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [zamanasimi, setZamanasimi] = useState<ZamanasimiData | null>(null);
  const [zamanasimiBaslangic, setZamanasimiBaslangic] = useState<string | null>(null);
  const prevZamanaRef = useRef<string | null>(null);
  const [zForm, setZForm] = useState<{ dava: string; bas: string; bit: string }>({ dava: "", bas: "", bit: "" });
  
  // Dışlamalar - Global state (YillikIzinDislamalariPanel ile yönetilir)
  const [exclusions, setExclusions] = useState<ExcludedDay[]>([]);
  
  // Brütten Nete Çevir
  const [brut, setBrut] = useState(0);
  const [mahsuplasmaMiktari, setMahsuplasmaMiktari] = useState<string>("");
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [month: number]: number } }>({});
  
  // Rapor
  const [showNewBilirkisi1ReportModal, setShowNewBilirkisi1ReportModal] = useState(false);
  
  // Kat Sayı
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [katSayi, setKatSayi] = useState(1);
  
  // View/Print mode
  const [isViewMode, setIsViewMode] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  // Calc sequence
  const calcSeq = useRef(0);

  return {
    // Kayıt bilgileri
    currentRecordName,
    setCurrentRecordName,
    isLoadingFromSavedRef,
    loadRanRef,
    caseIdRef,
    
    // Tarih ve saat
    iseGiris,
    setIseGiris,
    istenCikis,
    setIstenCikis,
    weeklyDays,
    setWeeklyDays,
    gir,
    setGir,
    cik,
    setCik,
    
    // Hesaplama sonuçları
    // rows is now derived via useMemo in index.tsx
    rows,
    setRows,
    backendRows,
    setBackendRows,
    rowsRef,
    hoveredRow,
    setHoveredRow,
    include270,
    setInclude270,
    mode270,
    setMode270,
    show270Dropdown,
    setShow270Dropdown,
    haftaDususBilgisi,
    setHaftaDususBilgisi,
    refreshFlag,
    setRefreshFlag,
    notes,
    setNotes,
    
    // Klasik akış
    stepsText,
    setStepsText,
    txtTatilsiz,
    setTxtTatilsiz,
    txtTatilli,
    setTxtTatilli,
    txtUnderSeven,
    setTxtUnderSeven,
    activeTab,
    setActiveTab,
    fmHoursAuto,
    setFmHoursAuto,
    haftalikMesai,
    setHaftalikMesai,
    
    // Beyanlar
    davaci,
    setDavaci,
    taniklar,
    setTaniklar,
    
    // Hesaplama Senaryosu (UI kontrolü)
    calculationScenario,
    setCalculationScenario,
    
    // Senaryo-Specific State
    standardState,
    setStandardState,
    haftalikKarmaState,
    setHaftalikKarmaState,
    donemselState,
    setDonemselState,
    donemselKarmaState,
    setDonemselKarmaState,
    
    isCalculating,
    setIsCalculating,
    backendResult,
    setBackendResult,
    haftalikFazlaMesai,
    setHaftalikFazlaMesai,
    overtimeResults,
    setOvertimeResults,
    finalWeeklyOvertime,
    setFinalWeeklyOvertime,
    caseData,
    setCaseData,
    intervals,
    setIntervals,
    
    // Zamanaşımı
    showZamanaModal,
    setShowZamanaModal,
    zamanasimi,
    setZamanasimi,
    zamanasimiBaslangic,
    setZamanasimiBaslangic,
    prevZamanaRef,
    zForm,
    setZForm,
    
    // Dışlamalar
    exclusions,
    setExclusions,
    // Brütten Nete
    brut,
    setBrut,
    mahsuplasmaMiktari,
    setMahsuplasmaMiktari,
    showMahsuplasamaModal,
    setShowMahsuplasamaModal,
    mahsuplasamaData,
    setMahsuplasamaData,
    
    // Rapor
    showNewBilirkisi1ReportModal,
    setShowNewBilirkisi1ReportModal,
    
    // Kat Sayı
    showKatsayiModal,
    setShowKatsayiModal,
    hasCustomKatsayi,
    setHasCustomKatsayi,
    katSayi,
    setKatSayi,
    
    // View/Print
    isViewMode,
    setIsViewMode,
    isPrintMode,
    setIsPrintMode,
    
    // Calc
    calcSeq,
  };
}
