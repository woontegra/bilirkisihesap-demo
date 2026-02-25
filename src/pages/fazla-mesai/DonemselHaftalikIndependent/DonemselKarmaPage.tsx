/**
 * FazlaMesaiBilirkisi1Page.tsx
 * SADECE UI + event bağlama.
 * Hesaplama, API, mantık YAPMAZ.
 * Butonlar sadece action çağırır.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * KATMAN MİMARİSİ - BEYAN vs HESAP AYIRIMI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1️⃣ HESAP KATMANI (Calculation Layer)
 * ────────────────────────────────────────
 * - Kullanılan State: davaci, taniklar (eski Beyan/Witness tipleri)
 * - Fonksiyonlar: handleCalculate(), recalculate(), calculateFromBackend()
 * - Amaç: FM hesaplama, 270 düşümü, zamanaşımı
 * - Kaynak: TEK KAYNAK - mevcut hesap zinciri
 * - Değişmez: useMemo zinciri, calculateFM fonksiyonları
 * 
 * 2️⃣ BEYAN KATMANI (Declaration Layer)
 * ────────────────────────────────────────
 * - Kullanılan State: declarations (Declaration[] - yeni çoklu dönem modeli)
 * - Komponentler: DavaciDeclarationManager, TanikDeclarationManager
 * - Amaç: SADECE UI, tablo önizleme, ispat açıklaması, dağıtım açıklaması
 * - Hesaba ETKİSİ: YOK - declarations hiçbir hesap fonksiyonuna parametre olarak GÖNDERİLMEZ
 * 
 * ⚠️ KESİN KURAL:
 * - declarations → HESAP FONKSİYONLARINA PARAMETRE OLARAK GÖNDERİLMEYECEK
 * - Hesap motoru → TEK KAYNAK (davaci, taniklar)
 * - Beyanlar → SADECE dağıtım/ispat/önizleme için
 */

import { calculateOvertimeWith270AndLimitation } from "./localUtils/calculateOvertimeWith270AndLimitation";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { flushSync, createPortal } from "react-dom";
import { format } from "date-fns";
import ReportPreviewButton from "./localComponents/ReportPreviewButton";
import Layout from "./localComponents/Layout";
import FooterActions from "@/components/FooterActions";
import { useKaydet } from "./localHooks/useKaydet";
import { safeNumber, safeCurrency } from "./localUtils/safeFormat";
import { API_BASE_URL } from "./localUtils/apiClient";
import { splitByAsgariUcretPeriods } from "./localUtils/dateSegmentationCore";
// DonemselPage.tsx - DONEMSEL scenario only
import { asgariUcretler, getAsgariUcretByDate } from "./localUtils/asgariUcretler";
import { generateDynamicIntervalsFromWitnesses, calculateOvertimeHours } from "./localUtils/intervalHelper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Youtube } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import KatsayiModal from "./KatsayiModal";
import MahsuplasamaModal from "./MahsuplasamaModal";
import { getAsgariUcretPeriods } from "./localConstants/asgariUcretPeriods";
import { calculateOvertimeTable } from "./localUtils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "./localUtils/overtimeCalculator";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "./localUtils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays } from "date-fns";
import { getScopedStorageKey } from "./localUtils/storageKey";
import { applyAnnualLeaveExclusions } from "@/utils/fazlaMesai/applyAnnualLeaveExclusions";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";
import "@/styles/soft-glow.css";

// State ve actions
import { useFazlaMesaiBilirkisi1State } from "./state";
import { handleCalculate, handleLoadCalculation, handlePrepareSaveData } from "./actions";
import { saveCalculation } from "./save";
import { fmt, toUTC, toISODateUTC, formatTR, formatDateTRStr, normalizeTime, normalizeDate } from "./utils";
import type { PeriodRow, Beyan, Witness, ExcludedDay } from "./contract";

// Toast
import { ToastProvider, useToast, Toaster } from "./toast";

// Components
import NoteCard from "./NoteCard";
import DavaciDeclarationManager from "./components/DavaciDeclarationManager";
import TanikDeclarationManager from "./components/TanikDeclarationManager";
import WeeklyPatternEditor from "./components/WeeklyPatternEditor";
import SeasonalWorkPatternEditor from "./components/SeasonalWorkPatternEditor";
import WitnessSeasonalEditor from "./components/WitnessSeasonalEditor";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig, type ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { Copy } from "lucide-react";
const USE_NEW_BILIRKISI1_REPORT = true;

// Constants (for display/formatting only - business logic in backend)
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const WEEKLY_WORK_LIMIT = 45;
const STANDARD_DAILY_REFERENCE_HOURS = 7.5;
const FAZLA_MESAI_DENOMINATOR = 225;
const FAZLA_MESAI_KATSAYI = 1.5;
const INCLUDED_OVERTIME_HOURS = 270;

const apply270RuleFrontend = (periods: PeriodRow[]): PeriodRow[] => {
  if (!periods || periods.length === 0) return [];
  
  const periodsByYear = new Map<number, PeriodRow[]>();
  
  for (const p of periods) {
    if (!p.startISO) continue;
    const year = new Date(p.startISO).getFullYear();
    if (!periodsByYear.has(year)) {
      periodsByYear.set(year, []);
    }
    periodsByYear.get(year)!.push(p);
  }
  
  const result: PeriodRow[] = [];
  const sortedYears = Array.from(periodsByYear.keys()).sort((a, b) => a - b);
  
  for (const year of sortedYears) {
    const yearPeriods = periodsByYear.get(year)!;
    yearPeriods.sort((a, b) => {
      const aMs = a.startISO ? new Date(a.startISO).getTime() : 0;
      const bMs = b.startISO ? new Date(b.startISO).getTime() : 0;
      return aMs - bMs;
    });
    let kalanSaat = INCLUDED_OVERTIME_HOURS;
    
    for (const p of yearPeriods) {
      const originalWeeks = p.originalWeekCount ?? p.weeks;
      const { fmHours } = p;
      
      if (!fmHours || originalWeeks <= 0 || kalanSaat <= 0) {
        result.push({ ...p, weeks: originalWeeks, originalWeekCount: originalWeeks });
        continue;
      }
      
      const teorikHafta = kalanSaat / fmHours;
      const yuvarlanmisHafta = Math.round(teorikHafta);
      const dusulecekHafta = Math.min(yuvarlanmisHafta, originalWeeks);
      const dusulenSaat = dusulecekHafta * fmHours;
      
      kalanSaat -= dusulenSaat;
      if (kalanSaat < 0) kalanSaat = 0;
      
      const adjustedWeeks = Math.max(0, originalWeeks - dusulecekHafta);
      
      result.push({ ...p, weeks: adjustedWeeks, originalWeekCount: originalWeeks });
    }
  }
  
  return result;
};

// GEÇİCİ: computeClassic stub (backend'e taşındı)
const computeClassic = (payload: any) => {
  console.warn('[computeClassic] Bu fonksiyon artık backend\'te. Frontend stub çalıştı.');
  return {
    periods: [],
    text: 'Backend\'ten veri bekleniyor...',
    weeklyOvertime: 0,
  };
};

// GEÇİCİ: calculateWitnessBasedOvertime stub (backend'e taşındı)
const calculateWitnessBasedOvertime = (payload: any) => {
  console.warn('[calculateWitnessBasedOvertime] Bu fonksiyon artık backend\'te. Frontend stub çalıştı.');
  return [];
};

// Types are now imported from contract.ts

type Props = { titleOverride?: string };

// Form state type (for calculation triggers)
type FormState = {
  davaci: Beyan;
  taniklar: Witness[];
  gir: string;
  cik: string;
  weeklyDays: string;
  activeTab: "tatilsiz" | "tatilli";
  exclusions: ExcludedDay[];
  finalWeeklyOvertime: number;
  include270: boolean;
  iseGiris: string;
  istenCikis: string;
  zamanasimiBaslangic: string | null;
  haftalikMesai: number;
  katSayi: number;
};

// Helper function: Calculate week count between dates with annual leave deduction
// LOGIC: Sum annual leave days in the period → divide by 7 → round → deduct from weeks
const calculateWeekCount = (start: Date, end: Date, exclusions: ExcludedDay[]): number => {
  try {
    // Calculate base weeks from date range
    const totalDays = Math.max(0, differenceInCalendarDays(end, start) + 1);
    const baseWeeks = totalDays / 7;
    
    console.log(`🔢 [calculateWeekCount] Start: ${start.toISOString()}, End: ${end.toISOString()}`);
    console.log(`🔢 [calculateWeekCount] Total days: ${totalDays}, Base weeks: ${baseWeeks}`);
    console.log(`🔢 [calculateWeekCount] Exclusions count: ${exclusions?.length || 0}`);
    
    // Sum annual leave days that overlap with this period
    let totalAnnualLeaveDays = 0;
    
    if (exclusions && exclusions.length > 0) {
      exclusions.forEach((excl) => {
        const exclStart = normalizeLocalDate(excl.start);
        const exclEnd = normalizeLocalDate(excl.end);
        const startDate = normalizeLocalDate(start);
        const endDate = normalizeLocalDate(end);
        
        // Check if exclusion overlaps with period
        if (exclStart <= endDate && exclEnd >= startDate) {
          const overlapStart = exclStart > startDate ? exclStart : startDate;
          const overlapEnd = exclEnd < endDate ? exclEnd : endDate;
          const overlapDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          totalAnnualLeaveDays += overlapDays;
          console.log(`  ✂️ Exclusion overlap: ${overlapDays} days`);
        }
      });
    }
    
    // Calculate week deduction: days / 7, then round
    const weeksToDeduct = Math.round(totalAnnualLeaveDays / 7);
    
    // Deduct from base weeks and round the final result
    const finalWeeks = Math.max(0, Math.round(baseWeeks) - weeksToDeduct);
    
    console.log(`🔢 [calculateWeekCount] Annual leave days: ${totalAnnualLeaveDays}, Weeks to deduct: ${weeksToDeduct}, Final weeks: ${finalWeeks}`);
    
    return finalWeeks;
  } catch (err) {
    console.error('❌ [calculateWeekCount] Error:', err);
    return 0;
  }
};

// ============================================================================
// ZAMANAŞIMI MODAL COMPONENT - React.memo ile optimize edilmiş
// ============================================================================
const ZamanasimiModalContent = React.memo(function ZamanasimiModalContent({
  zForm,
  setZForm,
  onApply,
  onCancel,
  showToastError,
  isReadOnly = false,
  iseGiris,
}: {
  zForm: { dava: string; bas: string; bit: string };
  setZForm: React.Dispatch<React.SetStateAction<{ dava: string; bas: string; bit: string }>>;
  onApply: () => void;
  onCancel: () => void;
  showToastError: (msg: string) => void;
  isReadOnly?: boolean;
  iseGiris?: string;
}) {
  // Hesaplamaları useMemo ile optimize et (Standart ile aynı pandemi kuralı - işe giriş bazlı)
  const hesaplama = useMemo(() => {
    const dava = zForm.dava ? toUTC(zForm.dava) : null;
    const bas = zForm.bas ? toUTC(zForm.bas) : null;
    const bit = zForm.bit ? toUTC(zForm.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : null;
    const limit = dava ? subYears(dava, 5) : null;
    
    const pandemiBaslangic = new Date('2020-03-13');
    const pandemiBitis = new Date('2020-06-15');
    const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseGirisDate) {
      if (iseGirisDate < pandemiBaslangic) pandemiGun = 94;
      else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
        pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
      }
    }
    const pandemiEklendi = pandemiGun > 0;
    
    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    if (pandemiEklendi && nihai) nihai = subDays(nihai, pandemiGun);
    
    return { dava, bas, bit, gun, limit, nihai, pandemiEklendi };
  }, [zForm.dava, zForm.bas, zForm.bit, iseGiris]);

  const handleDavaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, dava: e.target.value }));
  }, [setZForm]);

  const handleBasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, bas: e.target.value }));
  }, [setZForm]);

  const handleBitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, bit: e.target.value }));
  }, [setZForm]);

  // ❌ REMOVED: onBlur validation causes input trembling

  // ❌ REMOVED: onBlur validation causes input trembling

  // Portal ile body'ye render et
  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
        onClick={onCancel}
      />
      <div 
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          width: '100%',
          maxWidth: '28rem',
          padding: '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
          Zamanaşımı Hesaplama
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>
              Dava Tarihi
            </div>
            <input
              type="date"
              value={zForm.dava}
              onChange={handleDavaChange}
              readOnly={isReadOnly}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>
                Arabuluculuk Başlangıç
              </div>
              <input
                type="date"
                value={zForm.bas}
                onChange={handleBasChange}
                readOnly={isReadOnly}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>
                Arabuluculuk Bitiş
              </div>
              <input
                type="date"
                value={zForm.bit}
                onChange={handleBitChange}
                readOnly={isReadOnly}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
            <div>
              Dava tarihi: <b>{hesaplama.dava ? format(hesaplama.dava, "dd.MM.yyyy") : "-"}</b>
            </div>
            <div>
              Zamanaşımı süresi (5 yıl): <b>{hesaplama.limit ? format(hesaplama.limit, "dd.MM.yyyy") : "-"}</b>
            </div>
            <div>
              Arabuluculuk süresi: <b>{hesaplama.gun != null ? `${hesaplama.gun} gün` : "-"}</b>
            </div>
            <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fbbf24' }}>
              <b>Pandemi Dönemi:</b> 13 Mart 2020 - 15 Haziran 2020 arası pandemi hak kaybı süresi nedeniyle +94 gün eklendi.
            </div>
            <div style={{ color: '#1d4ed8', fontWeight: 500, marginTop: '0.5rem' }}>
              Nihai zamanaşımı başlangıç tarihi: <b>{hesaplama.nihai ? format(hesaplama.nihai, "dd.MM.yyyy") : "-"}</b>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.375rem 0.75rem', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onApply}
            style={{ padding: '0.375rem 0.75rem', fontSize: '14px', border: '1px solid #2563eb', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default function DonemselPage({ titleOverride }: Props) {
  return (
    <ToastProvider>
      <DonemselPageContent titleOverride={titleOverride} />
    </ToastProvider>
  );
}

function DonemselPageContent({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving, KaydetModal } = useKaydet({ success, error: showToastError });
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-donemsel-haftalik");
  
  const path = location?.pathname || "";
  
  // State - tüm state'ler state.ts'den geliyor
  const {
    currentRecordName,
    setCurrentRecordName,
    isLoadingFromSavedRef,
    loadRanRef,
    caseIdRef,
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
    davaci,
    setDavaci,
    taniklar,
    setTaniklar,
    // Hesaplama Senaryosu (UI kontrolü)
    calculationScenario,
    setCalculationScenario,
    // ═══ SENARYO-SPECIFIC STATE ═══
    standardState,
    setStandardState,
    haftalikKarmaState,
    setHaftalikKarmaState,
    donemselState,
    setDonemselState,
    donemselKarmaState,
    setDonemselKarmaState,
    // ═══ HESAP KATMANI (Calculation Layer) ═══
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
    showZamanaModal,
    setShowZamanaModal,
    zamanasimi,
    setZamanasimi,
    zamanasimiBaslangic,
    setZamanasimiBaslangic,
    prevZamanaRef,
    zForm,
    setZForm,
    exclusions,
    setExclusions,
    showExclusionSaveModal,
    setShowExclusionSaveModal,
    showExclusionLoadModal,
    setShowExclusionLoadModal,
    exclusionSaveName,
    setExclusionSaveName,
    savedExclusionSets,
    setSavedExclusionSets,
    yilStart,
    setYilStart,
    yilEnd,
    setYilEnd,
    yilDays,
    setYilDays,
    brut,
    setBrut,
    mahsuplasmaMiktari,
    setMahsuplasmaMiktari,
    showMahsuplasamaModal,
    setShowMahsuplasamaModal,
    mahsuplasamaData,
    setMahsuplasamaData,
    showNewBilirkisi1ReportModal,
    setShowNewBilirkisi1ReportModal,
    showKatsayiModal,
    setShowKatsayiModal,
    hasCustomKatsayi,
    setHasCustomKatsayi,
    katSayi,
    setKatSayi,
    isViewMode,
    setIsViewMode,
    isPrintMode,
    setIsPrintMode,
    hasManualChanges,
    setHasManualChanges,
    calcSeq,
  } = useFazlaMesaiBilirkisi1State();
  
  // DONEMSEL PAGE - Scenario is hardcoded to DONEMSEL
  useEffect(() => {
    console.log('🔄 [DONEMSEL] Setting scenario to DONEMSEL, pathname:', location.pathname);
    setCalculationScenario('DONEMSEL');
  }, [setCalculationScenario, location.pathname]);
  
  // Default Yaz/Kış aylarını set et (eğer boşsa) - sadece ilk yüklemede
  useEffect(() => {
    if (!donemselState.summerPattern || !donemselState.winterPattern) {
      console.log('🔄 [DONEMSEL] Setting default summer/winter patterns');
      setDonemselState(prev => ({
        ...prev,
        summerPattern: prev.summerPattern || { months: [4, 5, 6, 7, 8, 9], workDays: 6, startTime: "08:00", endTime: "20:00" },
        winterPattern: prev.winterPattern || { months: [1, 2, 3, 10, 11, 12], workDays: 6, startTime: "09:00", endTime: "18:00" }
      }));
    }
  }, [donemselState.summerPattern, donemselState.winterPattern, setDonemselState]);
  
  // Page title - Dönemsel sayfası
  const pageTitle = "Dönemsel Fazla Mesai Hesaplama";
  const resolvedTitle = titleOverride || pageTitle;
  
  // Tanık beyanları: her zaman en az 1 boş satır göster
  useEffect(() => {
    try {
      if (!Array.isArray(taniklar) || taniklar.length === 0) {
        setTaniklar([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taniklar]);
  
  // Davacı state'ini UI senkronu için güncelle - ÇİFT YÖNLÜ SENKRON
  // ═══ SENARYO BAĞIMSIZLIĞI: Her senaryo kendi tarihlerini kullanır ═══
  // davaci ve iseGiris/istenCikis arasında senkronizasyon KALDIRILDI
  // Her senaryo kendi state'inden okur (standardState, haftalikKarmaState, vb.)
  
  // Zamanaşımı modal callback'leri (Standart ile aynı pandemi kuralı - işe giriş bazlı)
  const handleZamanasimiApply = useCallback(() => {
    try {
      const basUTC = zForm.bas ? toUTC(zForm.bas) : null;
      const bitUTC = zForm.bit ? toUTC(zForm.bit) : null;
      const arabuluculukGun = (basUTC && bitUTC) ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1) : 0;
      const davaUTC = zForm.dava ? toUTC(zForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      let nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;
      
      const pandemiBaslangic = new Date('2020-03-13');
      const pandemiBitis = new Date('2020-06-15');
      const effectiveIseGiris = iseGiris || standardState.davaci?.dateIn || haftalikKarmaState.weeklyStartDateISO;
      const iseGirisDate = effectiveIseGiris ? toUTC(effectiveIseGiris) : null;
      let pandemiGun = 0;
      if (iseGirisDate) {
        if (iseGirisDate < pandemiBaslangic) pandemiGun = 94;
        else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
          pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
        }
      }
      if (pandemiGun > 0 && nihai) nihai = subDays(nihai, pandemiGun);
      
      const payload = {
        davaTarihi: zForm.dava || "",
        arabuluculukBaslangic: zForm.bas || "",
        arabuluculukBitis: zForm.bit || "",
        arabuluculukGun,
        nihaiBaslangic: nihai ? toISODateUTC(nihai) : "",
      };
      setZamanasimi(payload);
      if (payload.nihaiBaslangic) {
        prevZamanaRef.current = null;
        setZamanasimiBaslangic(payload.nihaiBaslangic);
      }
      setShowZamanaModal(false);
    } catch {
      setShowZamanaModal(false);
    }
  }, [zForm, iseGiris, standardState.davaci?.dateIn, haftalikKarmaState.weeklyStartDateISO, setZamanasimi, setZamanasimiBaslangic, setShowZamanaModal]);
  
  const handleZamanasimiCancel = useCallback(() => {
    setShowZamanaModal(false);
    if (prevZamanaRef.current) {
      setZamanasimiBaslangic(prevZamanaRef.current);
    }
    prevZamanaRef.current = null;
  }, [setShowZamanaModal, setZamanasimiBaslangic]);
  
  // Brütten Nete Çevir hesaplamaları
  const brutYillik = brut;
  const sskPrim = brutYillik * SSK_ORANI;
  const gelirVergisi = Math.max(0, brutYillik - sskPrim) * GELIR_VERGISI_ORANI;
  const gelirVergisiDilimleri = "(%15)";
  const damgaVergisi = brutYillik * DAMGA_VERGISI_ORANI;
  const netYillik = brutYillik - (sskPrim + gelirVergisi + damgaVergisi);

  // Kat sayı uygulama fonksiyonu
  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    setKatSayi(katsayi);
    setHasCustomKatsayi(true);
    // ❌ setRows REMOVED - rows is derived via useMemo, katSayi change triggers recalc
  }, []);

  // Kat sayı kaldırma fonksiyonu
  const resetGlobalCoefficient = useCallback(() => {
    setKatSayi(1);
    setHasCustomKatsayi(false);
    // ❌ setRows REMOVED - rows is derived via useMemo, katSayi change triggers recalc
  }, []);

  const createManualRow = useCallback((): PeriodRow => {
    return {
      id: Math.random(),
      startISO: "",
      endISO: "",
      rangeLabel: "",
      weeks: 0,
      originalWeekCount: 0,
      brut: 0,
      fmHours: 0,
      katsayi: katSayi || 1,
      fm: 0,
      net: 0,
      manual: true,
    };
  }, [katSayi]);

  // View/Print mode detection
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const viewParam = params.get("view");
      const printParam = params.get("print");
      const viewMode = viewParam === "true";
      const printMode = printParam === "true";
      setIsViewMode(viewMode);
      setIsPrintMode(printMode);
      
      if (printMode) {
        // Print mode: otomatik yazdır (veriler yüklendikten sonra)
        const printTimeout = setTimeout(() => {
          window.print();
        }, 2000);
        return () => clearTimeout(printTimeout);
      }
    } catch {}
  }, [location.search]);
  
  // Veri yükleme fonksiyonu
  const loadCalculation = useCallback(
    async (caseId: string) => {
      console.log('🚀 [LOAD] loadCalculation called with caseId:', caseId);
      try {
        const result = await handleLoadCalculation(caseId);
        console.log('📦 [LOAD] handleLoadCalculation result:', result);

        if (result) {
          const { formData, name } = result;
          setCaseData(formData);
          
          // Kayıt adını sakla (güncelleme için)
          if (name) setCurrentRecordName(name);
          
          // URL'yi güncelle - effectiveId için ID ekle
          if (caseId && !effectiveId) {
            console.log('🔗 [LOAD] Updating URL with caseId:', caseId);
            navigate(`/fazla-mesai/donemsel-haftalik/${caseId}`, { replace: true });
          }
          
          // Verileri birden fazla olası konumdan yükle (uyumluluk için)
          const dataObj = formData?.data || formData || {};
          const formObj = dataObj?.form || {};
          
          // Öncelik: formObj > dataObj > formData root
          const getVal = (key: string) => formObj[key] ?? dataObj[key] ?? formData?.[key];
          
          // Tarihler
          const loadedIseGiris = getVal('iseGiris') || formData?.start_date || formData?.ise_giris;
          const loadedIstenCikis = getVal('istenCikis') || formData?.end_date || formData?.isten_cikis;
          if (loadedIseGiris) setIseGiris(loadedIseGiris);
          if (loadedIstenCikis) setIstenCikis(loadedIstenCikis);
          
          // Saatler
          const loadedGir = getVal('gir');
          const loadedCik = getVal('cik');
          if (loadedGir && loadedGir.trim()) setGir(loadedGir);
          if (loadedCik && loadedCik.trim()) setCik(loadedCik);
          
          // KRİTİK: Scenario'yu EN BAŞTA set et
          // Bu, yanlış scenario'nun çalışmasını önler
          const loadedActiveScenario = getVal('activeScenario');
          if (loadedActiveScenario !== undefined) {
            console.log('✅ [LOAD] Setting activeScenario FIRST:', loadedActiveScenario);
            setCalculationScenario(loadedActiveScenario);
          } else {
            console.log('✅ [LOAD] No saved scenario, defaulting to STANDART');
            setCalculationScenario('STANDART');
          }
          
          // Notes
          const loadedNotes = getVal('notes');
          if (loadedNotes !== undefined) setNotes(loadedNotes || "");
          
          // Diğer alanlar
          const loadedWeeklyDays = getVal('weeklyDays');
          if (loadedWeeklyDays !== undefined) setWeeklyDays(loadedWeeklyDays);
          
          const loadedDavaci = getVal('davaci');
          console.log('🔍 [LOAD] loadedDavaci:', loadedDavaci);
          if (loadedDavaci !== undefined) {
            setDavaci({
              ...loadedDavaci,
              dateIn: loadedIseGiris || loadedDavaci.dateIn || "",
              dateOut: loadedIstenCikis || loadedDavaci.dateOut || "",
            });
            if (loadedDavaci.in) setGir(loadedDavaci.in);
            if (loadedDavaci.out) setCik(loadedDavaci.out);
            
            // CRITICAL: Update standardState.davaci for UI and calculations
            // ALWAYS update regardless of scenario
            const updatedDavaci = {
              dateIn: loadedIseGiris || loadedDavaci.dateIn || "",
              dateOut: loadedIstenCikis || loadedDavaci.dateOut || "",
              in: loadedDavaci.in || "",
              out: loadedDavaci.out || "",
            };
            console.log('✅ [LOAD] Updating standardState.davaci:', updatedDavaci);
            setStandardState(prev => {
              const newState = {
                ...prev,
                davaci: updatedDavaci
              };
              console.log('📊 [LOAD] New standardState after davaci update:', newState);
              return newState;
            });
          } else {
            console.warn('⚠️ [LOAD] loadedDavaci is undefined');
          }
          
          
          const loadedTaniklar = getVal('taniklar');
          console.log('🔍 [LOAD] loadedTaniklar:', loadedTaniklar);
          if (loadedTaniklar !== undefined) {
            setTaniklar(loadedTaniklar);
            
            // CRITICAL: Update standardState.taniklar for UI and calculations
            // ALWAYS update regardless of scenario
            console.log('✅ [LOAD] Updating standardState.taniklar:', loadedTaniklar);
            setStandardState(prev => {
              const newState = {
                ...prev,
                taniklar: loadedTaniklar || []
              };
              console.log('📊 [LOAD] Final standardState after taniklar update:', newState);
              return newState;
            });
          } else {
            console.warn('⚠️ [LOAD] loadedTaniklar is undefined');
          }
          
          const loadedExclusions = getVal('exclusions');
          if (loadedExclusions !== undefined) setExclusions(loadedExclusions);
          
          const loadedInclude270 = getVal('include270');
          if (loadedInclude270 !== undefined) {
            const include270Value = !!loadedInclude270;
            setInclude270(include270Value);
          }
          
          const loadedZamanasimi = getVal('zamanasimi');
          if (loadedZamanasimi !== undefined) setZamanasimi(loadedZamanasimi);
          
          const loadedZamanasimiBaslangic = getVal('zamanasimiBaslangic');
          if (loadedZamanasimiBaslangic !== undefined) setZamanasimiBaslangic(loadedZamanasimiBaslangic);
          
          // Kat sayı
          const loadedKatSayi = getVal('katSayi');
          if (loadedKatSayi !== undefined) {
            setKatSayi(loadedKatSayi);
            setHasCustomKatsayi(!!getVal('hasCustomKatsayi'));
          }
          
          // Mahsuplaşma
          const loadedMahsuplasmaMiktari = getVal('mahsuplasmaMiktari');
          if (loadedMahsuplasmaMiktari !== undefined) setMahsuplasmaMiktari(loadedMahsuplasmaMiktari);
          
          const loadedMahsuplasamaData = getVal('mahsuplasamaData');
          if (loadedMahsuplasamaData !== undefined) setMahsuplasamaData(loadedMahsuplasamaData);
          
          // Scenario-specific state loading
          const loadedHaftalikKarmaState = getVal('haftalikKarmaState');
          if (loadedHaftalikKarmaState !== undefined) {
            // Always sync haftalikKarmaState with davaci to ensure consistency
            const fixedState = { ...loadedHaftalikKarmaState };
            const davaci = getVal('davaci');
            const loadedWeeklyDays = getVal('weeklyDays');
            
            if (davaci?.dateIn && davaci?.dateOut) {
              // Sync dates from davaci to ensure consistency
              if (fixedState.weeklyStartDateISO !== davaci.dateIn) {
                console.log('🔧 [LOAD] Syncing weeklyStartDateISO:', davaci.dateIn, '(was:', fixedState.weeklyStartDateISO, ')');
                fixedState.weeklyStartDateISO = davaci.dateIn;
              }
              if (fixedState.weeklyEndDateISO !== davaci.dateOut) {
                console.log('🔧 [LOAD] Syncing weeklyEndDateISO:', davaci.dateOut, '(was:', fixedState.weeklyEndDateISO, ')');
                fixedState.weeklyEndDateISO = davaci.dateOut;
              }
              
              // B MODEL: Sync dayGroups with davaci times (SABİT 2 GRUP)
              if (davaci.in && davaci.out && loadedWeeklyDays) {
                const totalDays = Number(loadedWeeklyDays) || 6;
                // 2 gruba böl: Örneğin 6 gün = 3+3 veya 4+2
                const group1Days = Math.ceil(totalDays / 2);
                const group2Days = totalDays - group1Days;
                
                console.log('🔧 [LOAD] Syncing dayGroups (B MODEL):', {
                  group1: `${group1Days} days × ${davaci.in}-${davaci.out}`,
                  group2: `${group2Days} days × ${davaci.in}-${davaci.out}`
                });
                
                fixedState.dayGroups = [
                  { dayCount: group1Days, startTime: davaci.in, endTime: davaci.out },
                  { dayCount: group2Days, startTime: davaci.in, endTime: davaci.out }
                ];
              }
            }
            
            console.log('✅ [LOAD] Setting haftalikKarmaState:', fixedState);
            setHaftalikKarmaState(fixedState);
          }
          
          const loadedDonemselState = getVal('donemselState');
          if (loadedDonemselState !== undefined) {
            console.log('✅ [LOAD] Setting donemselState:', loadedDonemselState);
            setDonemselState(loadedDonemselState);
            
            // CRITICAL: Dönemsel state yüklenirken standardState.davaci'yi de güncelle
            // Bu sayede derivedRows useMemo tetiklendiğinde tarihler hazır olur
            if (loadedIseGiris && loadedIstenCikis) {
              console.log('✅ [LOAD] Syncing standardState.davaci for DONEMSEL:', {
                dateIn: loadedIseGiris,
                dateOut: loadedIstenCikis,
                in: loadedGir || '',
                out: loadedCik || ''
              });
              setStandardState(prev => ({
                ...prev,
                davaci: {
                  dateIn: loadedIseGiris,
                  dateOut: loadedIstenCikis,
                  in: loadedGir || '',
                  out: loadedCik || ''
                }
              }));
            }
          }
          
          const loadedDonemselKarmaState = getVal('donemselKarmaState');
          if (loadedDonemselKarmaState !== undefined) {
            console.log('✅ [LOAD] Setting donemselKarmaState:', loadedDonemselKarmaState);
            setDonemselKarmaState(loadedDonemselKarmaState);
          }
          
          // ROWS ARTIK SCENARIO HOOKS TARAFINDAN HESAPLANIYOR
          // Kayıtlı rows'ları yükleme - scenario hooks otomatik hesaplayacak
          // const loadedRows = getVal('rows') || dataObj?.rows || formData?.rows || [];
          // console.log('📋 [LOAD] loadedRows:', loadedRows);
          console.log('📋 [LOAD] Rows will be recalculated by scenario hooks based on loaded inputs');
          
          if (!isViewMode && !isPrintMode) {
            success(`Kayıt yüklendi`);
          }
        }
      } catch (err: any) {
        showToastError(err.message || "Kayıt yüklenemedi");
      }
    },
    [effectiveId, navigate, setCaseData, setCurrentRecordName, setIseGiris, setIstenCikis, setGir, setCik, setNotes, setWeeklyDays, setDavaci, setTaniklar, setExclusions, setInclude270, setZamanasimi, setZamanasimiBaslangic, setKatSayi, setHasCustomKatsayi, setMahsuplasmaMiktari, setMahsuplasamaData, isViewMode, isPrintMode, success, showToastError]
  );

  // ID değiştiğinde yükle
  useEffect(() => {
    console.log('🔄 [EFFECT] effectiveId changed:', effectiveId);
    if (effectiveId) {
      console.log('✅ [EFFECT] Calling loadCalculation with ID:', effectiveId);
      loadCalculation(effectiveId);
      // Mark that this page was loaded from a saved calculation
      isLoadingFromSavedRef.current = true;
      loadRanRef.current = true;
    } else {
      console.warn('⚠️ [EFFECT] effectiveId is empty, not loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  // ---- No persistence: ensure fresh state on reload ----
  useEffect(() => {
    try {
      // Clear any previous persisted key if exists from older versions
      localStorage.removeItem(getScopedStorageKey("fm_page_state_v1"));
    } catch {}
  }, []);


  // Initialize page type on mount and whenever path changes
  useEffect(() => {
    // Placeholder: perform any per-path initialization needed when route changes
  }, [location.pathname]);

  // Zamanaşımını kaldır
  const handleZamanasimiIptal = () => {
    try {
      setZamanasimi(null);
      setZamanasimiBaslangic(null);
      prevZamanaRef.current = null;
      success("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
    } catch {}
  };

  const handleInclude270Change = (e: any) => {
    const checked = !!e?.target?.checked;
    setInclude270(checked);
    // ❌ setRows REMOVED - 270 logic now in derivedRows useMemo
    // 270 deduction will be applied automatically when derivedRows recalculates
  };

  // Quick-add: Yıllık izin gününü otomatik hesapla (dahil) – kullanıcı yine düzenleyebilir
  useEffect(() => {
    if (yilStart && yilEnd) {
      try {
        const s = toUTC(yilStart); const e = toUTC(yilEnd);
        const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
        setYilDays(String(days));
      } catch {}
    }
  }, [yilStart, yilEnd]);

  // ═══════════════════════════════════════════════════════════
  // EXCLUSIONS SYNC - Scenario değiştiğinde exclusions'ı senkronize et
  // ═══════════════════════════════════════════════════════════
  // Her scenario kendi exclusions'ını scenario state'inde tutar
  // Global exclusions UI'da gösterilir ve aktif scenario ile senkronize edilir
  useEffect(() => {
    // Scenario değiştiğinde, o scenario'nun exclusions'ını global state'e yükle
    switch (calculationScenario) {
      case "STANDART":
        setExclusions(standardState.exclusions || []);
        break;
      case "HAFTALIK_KARMA":
        setExclusions(haftalikKarmaState.exclusions || []);
        break;
      case "DONEMSEL":
        setExclusions(donemselState.exclusions || []);
        break;
      case "DONEMSEL_HAFTALIK_KARMA":
        setExclusions(donemselKarmaState.exclusions || []);
        break;
      default:
        setExclusions([]);
    }
  }, [calculationScenario, standardState.exclusions, haftalikKarmaState.exclusions, donemselState.exclusions, donemselKarmaState.exclusions]);

  // Exclusions değiştiğinde, aktif scenario'nun state'ini güncelle
  useEffect(() => {
    switch (calculationScenario) {
      case "STANDART":
        if (JSON.stringify(exclusions) !== JSON.stringify(standardState.exclusions)) {
          setStandardState(prev => ({ ...prev, exclusions }));
        }
        break;
      case "HAFTALIK_KARMA":
        if (JSON.stringify(exclusions) !== JSON.stringify(haftalikKarmaState.exclusions)) {
          setHaftalikKarmaState(prev => ({ ...prev, exclusions }));
        }
        break;
      case "DONEMSEL":
        if (JSON.stringify(exclusions) !== JSON.stringify(donemselState.exclusions)) {
          setDonemselState(prev => ({ ...prev, exclusions }));
        }
        break;
      case "DONEMSEL_HAFTALIK_KARMA":
        if (JSON.stringify(exclusions) !== JSON.stringify(donemselKarmaState.exclusions)) {
          setDonemselKarmaState(prev => ({ ...prev, exclusions }));
        }
        break;
    }
  }, [exclusions, calculationScenario]);

  // SCENARIO-SPECIFIC FINAL ROWS - Her senaryo kendi rows'una sahip
  const [standartFinalRows, setStandartFinalRows] = useState<any[]>([]);
  const [haftalikKarmaFinalRows, setHaftalikKarmaFinalRows] = useState<any[]>([]);
  const [donemselFinalRows, setDonemselFinalRows] = useState<any[]>([]);
  const [donemselHaftalikFinalRows, setDonemselHaftalikFinalRows] = useState<any[]>([]);

  // NET VALIDATION - AUTO-CALC için hazır mı?
  const isAutoCalcReady = Boolean(
    standardState.davaci.dateIn &&
    standardState.davaci.dateOut &&
    standardState.davaci.in &&
    standardState.davaci.out &&
    !isCalculating
  );
  
  // WITNESS INTERSECTION FM HOURS - TEK KAYNAK
  // Bu değer hem tabloda hem metinde kullanılacak
  const witnessIntersectionFMRef = useRef<number>(0);

  // ═══════════════════════════════════════════════════════════
  // SCENARIO HOOKS - Her senaryo kendi dosyasında
  // ═══════════════════════════════════════════════════════════
  
  // ❌ SCENARIO HOOK'LARI KALDIRILDI
  // Artık tüm hesaplama derivedRows useMemo içinde yapılıyor (HaftalikKarmaPage.tsx gibi)

  // DERIVED ROWS - Dönemsel hesaplama
  const derivedRows = useMemo(() => {
    // DONEMSEL PAGE - Always calculate DONEMSEL rows
    console.log('🔍 [DONEMSEL] Calculating derivedRows, scenario:', calculationScenario);
    console.log('🔍 [DONEMSEL] donemselState:', donemselState);
    
    // Default değerler - eğer state boşsa kullan
    const summerPattern = donemselState.summerPattern || { 
      months: [4, 5, 6, 7, 8, 9], 
      workDays: 6, 
      startTime: "08:00", 
      endTime: "20:00" 
    };
    const winterPattern = donemselState.winterPattern || { 
      months: [1, 2, 3, 10, 11, 12], 
      workDays: 6, 
      startTime: "09:00", 
      endTime: "18:00" 
    };
    
    // Doğrulama: Tüm aylar seçilmiş mi?
    const totalMonths = summerPattern.months.length + winterPattern.months.length;
    if (totalMonths !== 12) {
      console.warn('⚠️ [DONEMSEL] Tüm aylar seçilmedi:', totalMonths, '/12 - Using defaults');
      // Default değerlerle devam et, boş array döndürme
    }
    
    // Davacı tarih aralığını al (STANDART state'ten)
    const dateIn = standardState.davaci.dateIn;
    const dateOut = standardState.davaci.dateOut;
    
    if (!dateIn || !dateOut) {
      console.warn('⚠️ [DONEMSEL] Davacı tarih aralığı eksik');
      return [];
    }
    
    console.log('📅 [DONEMSEL] Tarih aralığı:', dateIn, '→', dateOut);
    console.log('🌞 [DONEMSEL] Yaz ayları:', summerPattern.months, 'Saatler:', summerPattern.startTime, '-', summerPattern.endTime);
    console.log('❄️ [DONEMSEL] Kış ayları:', winterPattern.months, 'Saatler:', winterPattern.startTime, '-', winterPattern.endTime);
    
    // Tanık kesişimlerini hesapla (DONEMSEL - Yaz/Kış tanıklar)
    const davaci = {
      startDate: dateIn,
      endDate: dateOut,
      startTime: summerPattern.startTime,
      endTime: summerPattern.endTime
    };
    
    // DONEMSEL tanıkları al (witnessesSeasons)
    const witnessesSeasons = donemselState.witnessesSeasons || [];
    
    console.log('📊 [DONEMSEL] Tanık sayısı:', witnessesSeasons.length);
    console.log('📊 [DONEMSEL] Tanık verileri:', witnessesSeasons);
    
    // Tanıkları STANDART formatına çevir (kesişim için)
    // Her tanık için Yaz/Kış saatlerini kullanacağız ama kesişim için geçici bir saat kullan
    const splitWitnesses = witnessesSeasons
      .filter((w: any) => w.dateIn && w.dateOut) // Sadece tarih bilgisi olanları al
      .map((w: any) => {
        // Tanık tarihlerini davacı tarih aralığı ile kırp
        let witnessStart = w.dateIn;
        let witnessEnd = w.dateOut;
        
        // Tanık davacıdan önce başlıyorsa, davacı başlangıcına ayarla
        if (witnessStart < dateIn) witnessStart = dateIn;
        
        // Tanık davacıdan sonra bitiyorsa, davacı bitişine ayarla
        if (witnessEnd > dateOut) witnessEnd = dateOut;
        
        return {
          startDateISO: witnessStart,
          endDateISO: witnessEnd,
          start_time: w.summerPattern?.startTime || '07:00',
          end_time: w.summerPattern?.endTime || '18:00',
          // TANIK SEZON BİLGİLERİNİ SAKLA - Sezon kırpması için gerekli
          summerPattern: w.summerPattern || { months: [6, 7, 8], startTime: '07:00', endTime: '18:00', workDays: 6 },
          winterPattern: w.winterPattern || { months: [12, 1, 2], startTime: '08:00', endTime: '17:00', workDays: 6 }
        };
      })
      .filter((w: any) => w.startDateISO < w.endDateISO); // Geçersiz aralıkları filtrele
    
    console.log('📊 [DONEMSEL] Split witnesses (kırpılmış):', splitWitnesses);
    
    // TANIK OVERLAP SPLIT: Tanıklı Standart sayfasındaki mantığı uygula
    const finalSplitWitnesses: any[] = [];
    
    const sortedWitnesses = [...splitWitnesses].sort((a, b) => 
      new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime()
    );
    
    sortedWitnesses.forEach((witness, idx) => {
      const wStart = new Date(witness.startDateISO);
      const wEnd = new Date(witness.endDateISO);
      
      // Bu tanıkla çakışan diğer tanıkları bul
      const overlappingWitnesses = sortedWitnesses.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const oStart = new Date(other.startDateISO);
        const oEnd = new Date(other.endDateISO);
        return oStart > wStart && oStart < wEnd;
      });
      
      if (overlappingWitnesses.length === 0) {
        // Çakışma yoksa olduğu gibi ekle
        finalSplitWitnesses.push(witness);
      } else {
        // Çakışma varsa parçala
        let currentStart = wStart;
        
        const sortedOverlaps = overlappingWitnesses.sort((a, b) => 
          new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime()
        );
        
        sortedOverlaps.forEach(overlap => {
          const overlapStart = new Date(overlap.startDateISO);
          const overlapEnd = new Date(overlap.endDateISO);
          
          // Çakışmadan önceki bölümü ekle
          if (currentStart < overlapStart) {
            const segmentEnd = new Date(overlapStart);
            segmentEnd.setDate(segmentEnd.getDate() - 1);
            
            if (segmentEnd >= currentStart) {
              finalSplitWitnesses.push({
                ...witness,
                startDateISO: currentStart.toISOString().split('T')[0],
                endDateISO: segmentEnd.toISOString().split('T')[0]
              });
            }
          }
          
          // Çakışmadan sonraki başlangıç noktasını güncelle
          const nextStart = new Date(overlapEnd);
          nextStart.setDate(nextStart.getDate() + 1);
          currentStart = nextStart;
        });
        
        // Son bölümü ekle
        if (currentStart <= wEnd) {
          finalSplitWitnesses.push({
            ...witness,
            startDateISO: currentStart.toISOString().split('T')[0],
            endDateISO: wEnd.toISOString().split('T')[0]
          });
        }
      }
    });
    
    console.log('📊 [DONEMSEL] Final split witnesses (overlap split sonrası):', finalSplitWitnesses.length);
    finalSplitWitnesses.forEach((w: any, idx: number) => {
      console.log(`  Tanık ${idx}: ${w.startDateISO} → ${w.endDateISO}`);
      console.log(`    Yaz ayları: ${w.summerPattern?.months?.join(',') || 'YOK'}`);
      console.log(`    Kış ayları: ${w.winterPattern?.months?.join(',') || 'YOK'}`);
    });
    
    // Tanık kesişimlerini uygula - tüm tarih noktalarını topla
    let intervals: Array<{ start: string; end: string; start_time: string; end_time: string }> = [];
    
    if (finalSplitWitnesses.length === 0) {
      // Tanık yoksa sadece davacı dönemi
      intervals = [{
        start: dateIn,
        end: dateOut,
        start_time: summerPattern.startTime,
        end_time: summerPattern.endTime
      }];
    } else {
      // Tüm tarih noktalarını topla
      const allDates = new Set<string>();
      allDates.add(dateIn);
      allDates.add(dateOut);
      
      finalSplitWitnesses.forEach((w: any) => {
        allDates.add(w.startDateISO);
        allDates.add(w.endDateISO);
      });
      
      const sortedDates = Array.from(allDates).sort();
      
      // Her tarih aralığı için interval oluştur
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const intervalStart = sortedDates[i];
        const intervalEnd = sortedDates[i + 1];
        
        // Bu aralıkta hangi tanıklar var?
        const witnessesInInterval = finalSplitWitnesses.filter((w: any) => {
          return w.startDateISO <= intervalStart && w.endDateISO >= intervalEnd;
        });
        
        // SADECE TANIKLI DÖNEMLERİ EKLE
        if (witnessesInInterval.length > 0) {
          // İlk tanığın saatlerini ve sezon bilgilerini kullan
          const witnessData = witnessesInInterval[0];
          const start_time = witnessData.start_time || summerPattern.startTime;
          const end_time = witnessData.end_time || summerPattern.endTime;
          
          intervals.push({
            start: intervalStart,
            end: intervalEnd,
            start_time: start_time,
            end_time: end_time,
            witnessSeasonData: witnessData // Tanığın sezon bilgilerini sakla
          });
        }
      }
    }
    
    console.log('📊 [DONEMSEL] Intervals (tanık kesişimleri ile):', intervals.length);
    intervals.forEach((int, idx) => {
      console.log(`  Interval ${idx + 1}: ${int.start} - ${int.end} | ${int.start_time} - ${int.end_time}`);
    });
    
    let generatedRows: any[] = [];
    
    // Her interval'ı işle
    intervals.forEach((interval, intervalIdx) => {
      const intervalStartDate = new Date(interval.start);
      const intervalEndDate = new Date(interval.end);
      
      // Bu interval'ı asgari ücret dönemlerine böl
      const segments = splitByAsgariUcretPeriods(intervalStartDate, intervalEndDate);
      
      segments.forEach((seg) => {
        const segStart = seg.start;
        const segEnd = seg.end;
        
        const startFormatted = format(segStart, 'dd.MM.yyyy');
        const endFormatted = format(segEnd, 'dd.MM.yyyy');
        
        // Manuel ISO format - timezone sorununu önle
        const segStartISO = `${segStart.getFullYear()}-${String(segStart.getMonth() + 1).padStart(2, '0')}-${String(segStart.getDate()).padStart(2, '0')}`;
        const segEndISO = `${segEnd.getFullYear()}-${String(segEnd.getMonth() + 1).padStart(2, '0')}-${String(segEnd.getDate()).padStart(2, '0')}`;
        
        // Hafta sayısını hesapla
        const diffMs = segEnd.getTime() - segStart.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
        const weeks = Math.round(diffDays / 7);
        
        // Asgari ücreti bul
        const asgariUcret = getAsgariUcretByDate(segStartISO) || 17002.12;
        
        // Bu segment hangi aylara denk geliyor? (Yaz mı Kış mı?)
        // Basit yaklaşım: Segment başlangıç ayına bak
        const segStartMonth = segStart.getMonth() + 1; // 1-12
        
        const isSummer = summerPattern.months.includes(segStartMonth);
        const pattern = isSummer ? summerPattern : winterPattern;
        
        // FM saatini hesapla - 2 SATIR SİSTEMİ (days1 ve days2 kullan)
        let fmHours = 0;
        
        const days1 = pattern.days1 || 0;
        const days2 = pattern.days2 || 0;
        
        if (days1 > 0 && days2 > 0 && pattern.startTime2 && pattern.endTime2) {
          // 2 FARKLI SAAT HESAPLAMA
          console.log(`📊 [2 SATIR] ${isSummer ? '🌞 Yaz' : '❄️ Kış'} - ${days1} gün + ${days2} gün`);
          
          // 1. Satır
          const [gir1H, gir1M] = pattern.startTime.split(':').map(Number);
          const [cik1H, cik1M] = pattern.endTime.split(':').map(Number);
          const daily1Minutes = (cik1H * 60 + cik1M) - (gir1H * 60 + gir1M);
          const daily1Brut = daily1Minutes / 60;
          
          // Ara dinlenme: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h (4857/68 + Yargıtay)
          let break1Hours = 1;
          if (daily1Brut >= 15) break1Hours = 3;
          else if (daily1Brut >= 14) break1Hours = 2;
          else if (daily1Brut >= 11) break1Hours = 1.5;
          
          const daily1Net = Math.max(0, daily1Brut - break1Hours);
          let total1 = daily1Net * days1;
          
          // 2. Satır
          const [gir2H, gir2M] = pattern.startTime2.split(':').map(Number);
          const [cik2H, cik2M] = pattern.endTime2.split(':').map(Number);
          const daily2Minutes = (cik2H * 60 + cik2M) - (gir2H * 60 + gir2M);
          const daily2Brut = daily2Minutes / 60;
          
          let break2Hours = 1;
          if (daily2Brut >= 15) break2Hours = 3;
          else if (daily2Brut >= 14) break2Hours = 2;
          else if (daily2Brut >= 11) break2Hours = 1.5;
          
          const daily2Net = Math.max(0, daily2Brut - break2Hours);
          let total2 = daily2Net * days2;
          
          // HAFTA TATİLİ KONTROLÜ - Toplam 7 gün ve hasWeeklyHoliday true ise
          let holidayOvertime = 0;
          if ((days1 + days2) === 7 && pattern.hasWeeklyHoliday) {
            const holidayRow = pattern.weeklyHolidayRow || 2;
            
            if (holidayRow === 1) {
              // 1. satırdan 1 gün hafta tatili
              const normalDays1 = days1 - 1;
              holidayOvertime = Math.max(0, daily1Net - 7.5);
              total1 = (daily1Net * normalDays1) + holidayOvertime;
              console.log(`  🎉 Hafta tatili (1. satır): ${holidayOvertime.toFixed(2)}h (${daily1Net.toFixed(2)}h - 7.5h)`);
            } else {
              // 2. satırdan 1 gün hafta tatili
              const normalDays2 = days2 - 1;
              holidayOvertime = Math.max(0, daily2Net - 7.5);
              total2 = (daily2Net * normalDays2) + holidayOvertime;
              console.log(`  🎉 Hafta tatili (2. satır): ${holidayOvertime.toFixed(2)}h (${daily2Net.toFixed(2)}h - 7.5h)`);
            }
          }
          
          const weeklyTotal = total1 + total2;
          const roundedWeekly = Math.round(weeklyTotal);
          fmHours = Math.max(0, roundedWeekly - 45);
          
          console.log(`  1. Satır: ${days1} gün × ${pattern.startTime}-${pattern.endTime} = ${total1.toFixed(2)}h`);
          console.log(`  2. Satır: ${days2} gün × ${pattern.startTime2}-${pattern.endTime2} = ${total2.toFixed(2)}h`);
          console.log(`  Haftalık toplam: ${weeklyTotal.toFixed(2)}h, FM: ${fmHours.toFixed(2)}h`);
        } else if (days1 > 0) {
          // TEK SAAT HESAPLAMA (days1 kullan)
          const [girH, girM] = pattern.startTime.split(':').map(Number);
          const [cikH, cikM] = pattern.endTime.split(':').map(Number);
          const girMinutes = girH * 60 + girM;
          const cikMinutes = cikH * 60 + cikM;
          const dailyMinutes = cikMinutes - girMinutes;
          const dailyBrut = dailyMinutes / 60;
          
          // Ara dinlenme: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h (4857/68 + Yargıtay)
          let breakHours = 1;
          if (dailyBrut >= 15) breakHours = 3;
          else if (dailyBrut >= 14) breakHours = 2;
          else if (dailyBrut >= 11) breakHours = 1.5;
          
          const dailyNet = Math.max(0, dailyBrut - breakHours);
          const weeklyTotal = dailyNet * days1;
          const roundedWeekly = Math.round(weeklyTotal);
          fmHours = Math.max(0, roundedWeekly - 45);
          
          console.log(`  Tek satır: ${days1} gün × ${pattern.startTime}-${pattern.endTime}, FM: ${fmHours.toFixed(2)}h`);
        } else {
          // FALLBACK: weeklyDays kullan (eski mantık)
          const [girH, girM] = pattern.startTime.split(':').map(Number);
          const [cikH, cikM] = pattern.endTime.split(':').map(Number);
          const dailyBrut = ((cikH * 60 + cikM) - (girH * 60 + girM)) / 60;
          
          let breakHours = 1;
          if (dailyBrut >= 15) breakHours = 3;
          else if (dailyBrut >= 14) breakHours = 2;
          else if (dailyBrut >= 11) breakHours = 1.5;
          
          const dailyNet = Math.max(0, dailyBrut - breakHours);
          const workDays = Number(weeklyDays) || 6;
          const weeklyTotal = dailyNet * workDays;
          const roundedWeekly = Math.round(weeklyTotal);
          fmHours = Math.max(0, roundedWeekly - 45);
        }
        
        console.log(`📊 [DONEMSEL] ${startFormatted}: ${isSummer ? '🌞 Yaz' : '❄️ Kış'}, FM: ${fmHours.toFixed(2)} saat/hafta`);
        
        generatedRows.push({
          id: `period-${generatedRows.length}`,
          startISO: segStartISO,
          endISO: segEndISO,
          rangeLabel: `${startFormatted} – ${endFormatted}`,
          weeks: weeks,
          brut: asgariUcret,
          katsayi: katSayi || 1,
          fmHours: fmHours,
          fm: 0, // Henüz hesaplanmadı
          net: 0,
          year: segStart.getFullYear(),
          season: isSummer ? 'summer' : 'winter',
          witnessSeasonData: interval.witnessSeasonData // Tanık sezon bilgisini row'a aktar
        });
      });
    });
    
    console.log('📋 [DONEMSEL] Generated rows:', generatedRows.length);
    
    // ═══════════════════════════════════════════════════════════
    // 3. AŞAMA SEGMENTASYON: SEZON BAZLI TARİH KIRPMA
    // ═══════════════════════════════════════════════════════════
    console.log('🌡️ [SEZON SPLIT] Başlangıç - satır sayısı:', generatedRows.length);
    
    const seasonSegmentedRows: any[] = [];
    
    generatedRows.forEach((row, rowIdx) => {
      const rowStart = new Date(row.startISO);
      const rowEnd = new Date(row.endISO);
      
      // TANIK BAZLI SEZON AYLARI - Tanık varsa tanığın aylarını kullan, yoksa davacının
      const witnessSeasonData = row.witnessSeasonData;
      const activeSummerPattern = witnessSeasonData?.summerPattern || summerPattern;
      const activeWinterPattern = witnessSeasonData?.winterPattern || winterPattern;
      const activeSummerMonths = activeSummerPattern.months || summerPattern.months;
      
      console.log(`🌡️ [SEZON SPLIT] Satır ${rowIdx}: ${row.rangeLabel}`);
      console.log(`  📌 Tanık var mı: ${!!witnessSeasonData}, Yaz ayları: ${activeSummerMonths.join(',')}`);
      
      // Bu satırı ay ay ilerleyerek sezonlara böl
      let currentDate = new Date(rowStart);
      let currentSeasonStart = new Date(rowStart);
      let currentSeason: 'summer' | 'winter' | null = null;
      
      // İlk günün sezonunu belirle - TANIK BAZLI
      const firstMonth = currentDate.getMonth() + 1;
      currentSeason = activeSummerMonths.includes(firstMonth) ? 'summer' : 'winter';
      
      while (currentDate <= rowEnd) {
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const isSummer = activeSummerMonths.includes(currentMonth);
        const newSeason = isSummer ? 'summer' : 'winter';
        
        // Sezon değişimi veya son gün kontrolü
        const isLastDay = currentDate.getTime() === rowEnd.getTime();
        const seasonChanged = newSeason !== currentSeason;
        
        if (seasonChanged || isLastDay) {
          // Mevcut sezonu kapat
          let segmentEnd = new Date(currentDate);
          
          if (seasonChanged) {
            // Sezon değişti - önceki günü bitiş yap
            segmentEnd.setDate(segmentEnd.getDate() - 1);
          }
          // isLastDay ise currentDate zaten son gün
          
          // Segment oluştur
          const segStartISO = `${currentSeasonStart.getFullYear()}-${String(currentSeasonStart.getMonth() + 1).padStart(2, '0')}-${String(currentSeasonStart.getDate()).padStart(2, '0')}`;
          const segEndISO = `${segmentEnd.getFullYear()}-${String(segmentEnd.getMonth() + 1).padStart(2, '0')}-${String(segmentEnd.getDate()).padStart(2, '0')}`;
          
          const segStartFormatted = format(currentSeasonStart, 'dd.MM.yyyy');
          const segEndFormatted = format(segmentEnd, 'dd.MM.yyyy');
          
          // Hafta sayısını hesapla
          const diffMs = segmentEnd.getTime() - currentSeasonStart.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
          const weeks = Math.round(diffDays / 7);
          
          // Sezona göre pattern seç - TANIK BAZLI
          const pattern = currentSeason === 'summer' ? activeSummerPattern : activeWinterPattern;
          
          // FM saatini hesapla - 2 SATIR SİSTEMİ (days1 ve days2 kullan)
          let fmHours = 0;
          
          const days1 = pattern.days1 || 0;
          const days2 = pattern.days2 || 0;
          
          if (days1 > 0 && days2 > 0 && pattern.startTime2 && pattern.endTime2) {
            // 2 FARKLI SAAT HESAPLAMA
            console.log(`  📊 [TANIK 2 SATIR] ${currentSeason === 'summer' ? '🌞 Yaz' : '❄️ Kış'} - ${days1} gün + ${days2} gün`);
            
            // 1. Satır
            const [gir1H, gir1M] = pattern.startTime.split(':').map(Number);
            const [cik1H, cik1M] = pattern.endTime.split(':').map(Number);
            const daily1Minutes = (cik1H * 60 + cik1M) - (gir1H * 60 + gir1M);
            const daily1Brut = daily1Minutes / 60;
            
            let break1Hours = 1;
            if (daily1Brut >= 15) break1Hours = 3;
            else if (daily1Brut >= 14) break1Hours = 2;
            else if (daily1Brut >= 11) break1Hours = 1.5;
            
            const daily1Net = Math.max(0, daily1Brut - break1Hours);
            let total1 = daily1Net * days1;
            
            // 2. Satır
            const [gir2H, gir2M] = pattern.startTime2.split(':').map(Number);
            const [cik2H, cik2M] = pattern.endTime2.split(':').map(Number);
            const daily2Minutes = (cik2H * 60 + cik2M) - (gir2H * 60 + gir2M);
            const daily2Brut = daily2Minutes / 60;
            
            let break2Hours = 1;
            if (daily2Brut >= 15) break2Hours = 3;
            else if (daily2Brut >= 14) break2Hours = 2;
            else if (daily2Brut >= 11) break2Hours = 1.5;
            
            const daily2Net = Math.max(0, daily2Brut - break2Hours);
            let total2 = daily2Net * days2;
            
            // HAFTA TATİLİ KONTROLÜ - Toplam 7 gün ve hasWeeklyHoliday true ise
            let holidayOvertime = 0;
            if ((days1 + days2) === 7 && pattern.hasWeeklyHoliday) {
              const holidayRow = pattern.weeklyHolidayRow || 2;
              
              if (holidayRow === 1) {
                // 1. satırdan 1 gün hafta tatili
                const normalDays1 = days1 - 1;
                holidayOvertime = Math.max(0, daily1Net - 7.5);
                total1 = (daily1Net * normalDays1) + holidayOvertime;
                console.log(`    🎉 Hafta tatili (1. satır): ${holidayOvertime.toFixed(2)}h`);
              } else {
                // 2. satırdan 1 gün hafta tatili
                const normalDays2 = days2 - 1;
                holidayOvertime = Math.max(0, daily2Net - 7.5);
                total2 = (daily2Net * normalDays2) + holidayOvertime;
                console.log(`    🎉 Hafta tatili (2. satır): ${holidayOvertime.toFixed(2)}h`);
              }
            }
            
            const weeklyTotal = total1 + total2;
            const roundedWeekly = Math.round(weeklyTotal);
            fmHours = Math.max(0, roundedWeekly - 45);
            
            console.log(`    1. Satır: ${days1} gün × ${pattern.startTime}-${pattern.endTime} = ${total1.toFixed(2)}h`);
            console.log(`    2. Satır: ${days2} gün × ${pattern.startTime2}-${pattern.endTime2} = ${total2.toFixed(2)}h`);
            console.log(`    Haftalık toplam: ${weeklyTotal.toFixed(2)}h, FM: ${fmHours.toFixed(2)}h`);
          } else if (days1 > 0) {
            // TEK SAAT HESAPLAMA (days1 kullan)
            const [girH, girM] = pattern.startTime.split(':').map(Number);
            const [cikH, cikM] = pattern.endTime.split(':').map(Number);
            const girMinutes = girH * 60 + girM;
            const cikMinutes = cikH * 60 + cikM;
            const dailyMinutes = cikMinutes - girMinutes;
            const dailyBrut = dailyMinutes / 60;
            
            // Ara dinlenme
            let breakHours = 1;
            if (dailyBrut >= 15) breakHours = 3;
            else if (dailyBrut >= 14) breakHours = 2;
            else if (dailyBrut >= 11) breakHours = 1.5;
            
            const dailyNet = Math.max(0, dailyBrut - breakHours);
            const weeklyTotal = dailyNet * days1;
            const roundedWeekly = Math.round(weeklyTotal);
            fmHours = Math.max(0, roundedWeekly - 45);
            
            console.log(`    Tek satır: ${days1} gün × ${pattern.startTime}-${pattern.endTime}, FM: ${fmHours.toFixed(2)}h`);
          } else {
            // FALLBACK: weeklyDays kullan (eski mantık)
            const [girH, girM] = pattern.startTime.split(':').map(Number);
            const [cikH, cikM] = pattern.endTime.split(':').map(Number);
            const dailyBrut = ((cikH * 60 + cikM) - (girH * 60 + girM)) / 60;
            
            let breakHours = 1;
            if (dailyBrut >= 15) breakHours = 3;
            else if (dailyBrut >= 14) breakHours = 2;
            else if (dailyBrut >= 11) breakHours = 1.5;
            
            const dailyNet = Math.max(0, dailyBrut - breakHours);
            const workDays = Number(weeklyDays) || 6;
            
            // FM hesaplama - activeTab'a göre
            if (workDays === 7 && activeTab === 'tatilli') {
              // HAFTA TATİLLİ HESAPLAMA
              const weeklyNormal = 6 * dailyNet;
              const holidayOvertime = Math.max(0, dailyNet - 7.5);
              const weeklyTotal = weeklyNormal + holidayOvertime;
              const roundedWeekly = Math.round(weeklyTotal);
              fmHours = Math.max(0, roundedWeekly - 45);
            } else {
              // HAFTA TATİLSİZ HESAPLAMA
              const weeklyTotal = dailyNet * workDays;
              const roundedWeekly = Math.round(weeklyTotal);
              fmHours = Math.max(0, roundedWeekly - 45);
            }
          }
          
          console.log(`  ✂️ Segment: ${segStartFormatted} - ${segEndFormatted} (${currentSeason === 'summer' ? '🌞 Yaz' : '❄️ Kış'}), Saatler: ${pattern.startTime}-${pattern.endTime}, FM: ${fmHours.toFixed(2)} saat/hafta`);
          
          seasonSegmentedRows.push({
            ...row, // Orijinal satırın tüm özelliklerini miras al
            id: `period-${seasonSegmentedRows.length}`,
            startISO: segStartISO,
            endISO: segEndISO,
            rangeLabel: `${segStartFormatted} – ${segEndFormatted}`,
            weeks: weeks,
            fmHours: fmHours,
            season: currentSeason
          });
          
          // Yeni sezon başlat (eğer sezon değişti ise)
          if (seasonChanged && !isLastDay) {
            currentSeasonStart = new Date(currentDate);
            currentSeason = newSeason;
          }
        }
        
        // Bir sonraki güne geç
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    console.log('🌡️ [SEZON SPLIT] Sonuç - satır sayısı:', seasonSegmentedRows.length);
    
    // Sezon segmentasyonu sonrası satırları kullan
    generatedRows = seasonSegmentedRows;
    
    // ═══════════════════════════════════════════════════════════
    // 270 SAAT DÜŞÜMÜ (eğer aktifse)
    // ═══════════════════════════════════════════════════════════
    if (include270 && mode270 === 'simple') {
      // YARGITAY (simple): Haftalık 5.2 saat düşüm (270/52)
      const YARGITAY_270_WEEKLY_DEDUCTION = 5.2;
      console.log('🔻 [270] Applying Yargıtay deduction: -5.2 hours per week');
      generatedRows = generatedRows.map(row => ({
        ...row,
        fmHours: Math.max(0, row.fmHours - YARGITAY_270_WEEKLY_DEDUCTION)
      }));
    } else if (include270 && mode270 === 'detailed') {
      // ŞİRKET (detailed): Use proper calculateOvertimeWith270AndLimitation function
      console.log('🔻 [270] Applying Şirket deduction using calculateOvertimeWith270AndLimitation');
      
      // Tarih kontrolü - geçerli tarihler var mı?
      if (!standardState.davaci.dateIn || !standardState.davaci.dateOut) {
        console.warn('⚠️ [270] Davacı tarihleri eksik, 270 şirket modu atlanıyor');
      } else {
        const iseGirisTarihi = new Date(standardState.davaci.dateIn);
        const istenCikisTarihi = new Date(standardState.davaci.dateOut);
        
        // Tarih geçerliliği kontrolü
        if (isNaN(iseGirisTarihi.getTime()) || isNaN(istenCikisTarihi.getTime())) {
          console.warn('⚠️ [270] Geçersiz tarih formatı, 270 şirket modu atlanıyor');
        } else {
          // Haftalık FM saati - ilk satırdan al (tüm satırlar aynı olmalı)
          const haftalikFazlaMesaiSaati = generatedRows.length > 0 ? generatedRows[0].fmHours : 0;
          
          // Tablo satırlarını hazırla - Date objelerine dönüştür
          const tabloSatirlari = generatedRows.map(row => ({
            baslangic: new Date(row.startISO),
            bitis: new Date(row.endISO)
          }));
          
          // Call the proper 270 calculation function
          const sonuclar = calculateOvertimeWith270AndLimitation({
            iseGirisTarihi,
            istenCikisTarihi,
            haftalikFazlaMesaiSaati,
            zamanaSimiTarihi: zamanasimiBaslangic ? new Date(zamanasimiBaslangic) : undefined,
            yillikIzinler: [], // TODO: Add yıllık izin support if needed
            tabloSatirlari
          });
          
          console.log('🔻 [270] Şirket calculation results:', sonuclar);
          
          // Sonuçları generatedRows'a uygula
          // calculateOvertimeWith270AndLimitation SonucSatiri[] döndürür: { baslangic, bitis, fmHafta }
          generatedRows = generatedRows.map((row, idx) => {
            const sonuc = sonuclar[idx];
            if (sonuc && sonuc.fmHafta !== undefined) {
              // fmHafta (hafta sayısı) değerini weeks olarak kullan
              // NOT: Bu aslında FM hafta sayısı, weeks (çalışma haftası) değil
              // Ama 270 şirket modunda fmHours yerine fmHafta kullanılıyor
              return {
                ...row,
                weeks: sonuc.fmHafta // 270 düşümü uygulanmış hafta sayısı
              };
            }
            return row;
          });
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // ZAMANAŞIMI FİLTRELEME (GÜN/AY/YIL HASSAS)
    // ═══════════════════════════════════════════════════════════
    if (zamanasimiBaslangic) {
      const zamanasimiDate = new Date(zamanasimiBaslangic);
      console.log('⏰ [ZAMANAŞIMI] Filtering rows before:', zamanasimiDate.toISOString());
      
      generatedRows = generatedRows
        .map(row => {
          const rowStart = new Date(row.startISO);
          const rowEnd = new Date(row.endISO);
          
          // Satır tamamen zamanaşımı öncesinde mi?
          if (rowEnd < zamanasimiDate) {
            console.log(`  ❌ Row ${row.rangeLabel} is before statute of limitations`);
            return null; // Tamamen zamanaşımı öncesi - sil
          }
          
          // Satır tamamen zamanaşımı sonrasında mı?
          if (rowStart >= zamanasimiDate) {
            console.log(`  ✅ Row ${row.rangeLabel} is after statute of limitations - keep as is`);
            return row; // Tamamen zamanaşımı sonrası - olduğu gibi tut
          }
          
          // Satır zamanaşımı tarihini kesiyor - başlangıcı güncelle
          console.log(`  ✂️ Row ${row.rangeLabel} crosses statute of limitations - adjusting start date`);
          const newStartISO = `${zamanasimiDate.getFullYear()}-${String(zamanasimiDate.getMonth() + 1).padStart(2, '0')}-${String(zamanasimiDate.getDate()).padStart(2, '0')}`;
          const newStartFormatted = format(zamanasimiDate, 'dd.MM.yyyy');
          const endFormatted = format(rowEnd, 'dd.MM.yyyy');
          
          // Yeni hafta sayısını hesapla
          const diffMs = rowEnd.getTime() - zamanasimiDate.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
          const newWeeks = Math.round(diffDays / 7);
          
          return {
            ...row,
            startISO: newStartISO,
            rangeLabel: `${newStartFormatted} – ${endFormatted}`,
            weeks: newWeeks
          };
        })
        .filter(row => row !== null);
    }
    
    // FM ve NET hesapla
    generatedRows = generatedRows.map(row => {
      const fm = row.weeks * row.brut * row.katsayi * row.fmHours / 225 * 1.5;
      const net = fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI);
      return {
        ...row,
        fm: Number(fm.toFixed(2)),
        net: Number(net.toFixed(2))
      };
    });
    
    return generatedRows;
  }, [
    calculationScenario, 
    standardState.davaci.dateIn,
    standardState.davaci.dateOut,
    standardState.davaci.in,
    standardState.davaci.out,
    standardState.taniklar,
    JSON.stringify(donemselState.summerPattern),
    JSON.stringify(donemselState.winterPattern),
    JSON.stringify(donemselState.witnessesSeasons),
    katSayi, 
    weeklyDays,
    activeTab, // Sekme değişiminde FM yeniden hesaplansın
    include270, // 270 saat düşümü değişiminde yeniden hesapla
    mode270, // 270 modu değişiminde yeniden hesapla
    zamanasimiBaslangic // Zamanaşımı değişiminde yeniden hesapla
  ]);

  // ═══════════════════════════════════════════════════════════
  // DAVACI METİN HESAPLAMA (DİNAMİK VERİ / SABİT FORMAT)
  // ═══════════════════════════════════════════════════════════
  const claimantTextCalculation = useMemo(() => {
    const summerPattern = donemselState.summerPattern;
    const winterPattern = donemselState.winterPattern;
    const workDays = Number(weeklyDays) || 6;

    // Ay adlarını oluştur
    const getMonthNames = (months: number[]) => {
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                         'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return months.sort((a, b) => a - b).map(m => monthNames[m - 1]).join(', ');
    };

    const summerMonths = getMonthNames(summerPattern.months);
    const winterMonths = getMonthNames(winterPattern.months);

    // Yaz dönemi hesaplama - 2 SATIR SİSTEMİ
    let summerWeeklyTotal = 0;
    let summerFmHours = 0;
    let summerText = '';
    
    const summerDays1 = summerPattern.days1 || 0;
    const summerDays2 = summerPattern.days2 || 0;
    
    if (summerDays1 > 0 && summerDays2 > 0 && summerPattern.startTime2 && summerPattern.endTime2) {
      // 2 farklı saat var
      const days1 = summerDays1;
      
      // 1. Satır
      const [s1H, s1M] = summerPattern.startTime.split(':').map(Number);
      const [e1H, e1M] = summerPattern.endTime.split(':').map(Number);
      const daily1Brut = ((e1H * 60 + e1M) - (s1H * 60 + s1M)) / 60;
      let break1 = 1;
      if (daily1Brut >= 15) break1 = 3;
      else if (daily1Brut >= 14) break1 = 2;
      else if (daily1Brut >= 11) break1 = 1.5;
      const daily1Net = Math.max(0, daily1Brut - break1);
      const total1 = daily1Net * days1;
      
      // 2. Satır
      const [s2H, s2M] = summerPattern.startTime2.split(':').map(Number);
      const [e2H, e2M] = summerPattern.endTime2.split(':').map(Number);
      const daily2Brut = ((e2H * 60 + e2M) - (s2H * 60 + s2M)) / 60;
      let break2 = 1;
      if (daily2Brut >= 15) break2 = 3;
      else if (daily2Brut >= 14) break2 = 2;
      else if (daily2Brut >= 11) break2 = 1.5;
      const daily2Net = Math.max(0, daily2Brut - break2);
      let total2 = daily2Net * summerPattern.days2;
      
      // HAFTA TATİLİ KONTROLÜ
      let holidayOvertime = 0;
      if ((summerDays1 + summerDays2) === 7 && summerPattern.hasWeeklyHoliday) {
        const holidayRow = summerPattern.weeklyHolidayRow || 2;
        
        if (holidayRow === 1) {
          const normalDays1 = summerDays1 - 1;
          holidayOvertime = Math.max(0, daily1Net - 7.5);
          total1 = (daily1Net * normalDays1) + holidayOvertime;
        } else {
          const normalDays2 = summerPattern.days2 - 1;
          holidayOvertime = Math.max(0, daily2Net - 7.5);
          total2 = (daily2Net * normalDays2) + holidayOvertime;
        }
      }
      
      summerWeeklyTotal = Math.round(total1 + total2);
      summerFmHours = Math.max(0, summerWeeklyTotal - 45);
      
      const fmt = (n: number) => n.toFixed(2).replace('.', ',');
      if (summerPattern.hasWeeklyHoliday && (summerDays1 + summerDays2) === 7) {
        const holidayRow = summerPattern.weeklyHolidayRow || 2;
        
        if (holidayRow === 1) {
          summerText = `${summerDays1 - 1} gün ${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${summerDays1 - 1} gün X ${fmt(daily1Net)} saat = ${fmt(daily1Net * (summerDays1 - 1))} saat
${fmt(daily1Net)} - 7,5 saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai
${summerPattern.days2} gün ${summerPattern.startTime2} - ${summerPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${summerPattern.days2} gün X ${fmt(daily2Net)} saat = ${fmt(daily2Net * summerPattern.days2)} saat`;
        } else {
          summerText = `${days1} gün ${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${days1} gün X ${fmt(daily1Net)} saat = ${fmt(total1)} saat
${summerPattern.days2 - 1} gün ${summerPattern.startTime2} - ${summerPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${summerPattern.days2 - 1} gün X ${fmt(daily2Net)} saat = ${fmt(daily2Net * (summerPattern.days2 - 1))} saat
${fmt(daily2Net)} - 7,5 saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai`;
        }
      } else {
        summerText = `${days1} gün ${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${days1} gün X ${fmt(daily1Net)} saat = ${fmt(total1)} saat
${summerPattern.days2} gün ${summerPattern.startTime2} - ${summerPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${summerPattern.days2} gün X ${fmt(daily2Net)} saat = ${fmt(total2)} saat`;
      }
    } else {
      // Tek saat
      const [summerStartH, summerStartM] = summerPattern.startTime.split(':').map(Number);
      const [summerEndH, summerEndM] = summerPattern.endTime.split(':').map(Number);
      const summerDailyBrut = ((summerEndH * 60 + summerEndM) - (summerStartH * 60 + summerStartM)) / 60;
      let summerBreakHours = 1;
      if (summerDailyBrut >= 15) summerBreakHours = 3;
      else if (summerDailyBrut >= 14) summerBreakHours = 2;
      else if (summerDailyBrut >= 11) summerBreakHours = 1.5;
      const summerDailyNet = Math.max(0, summerDailyBrut - summerBreakHours);
      summerWeeklyTotal = Math.round(summerDailyNet * workDays);
      summerFmHours = Math.max(0, summerWeeklyTotal - 45);
      
      const fmt = (n: number) => n.toFixed(2).replace('.', ',');
      summerText = `${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(summerDailyBrut)} saat çalışma ${fmt(summerBreakHours)} saat ara dinlenme = ${fmt(summerDailyNet)} saat,
${workDays} gün X ${fmt(summerDailyNet)} saat = ${fmt(summerWeeklyTotal)} saat`;
    }

    // Kış dönemi hesaplama - 2 SATIR SİSTEMİ
    let winterWeeklyTotal = 0;
    let winterFmHours = 0;
    let winterText = '';
    
    const winterDays1 = winterPattern.days1 || 0;
    const winterDays2 = winterPattern.days2 || 0;
    
    if (winterDays1 > 0 && winterDays2 > 0 && winterPattern.startTime2 && winterPattern.endTime2) {
      // 2 farklı saat var
      const days1 = winterDays1;
      
      // 1. Satır
      const [w1H, w1M] = winterPattern.startTime.split(':').map(Number);
      const [we1H, we1M] = winterPattern.endTime.split(':').map(Number);
      const daily1Brut = ((we1H * 60 + we1M) - (w1H * 60 + w1M)) / 60;
      let break1 = 1;
      if (daily1Brut >= 15) break1 = 3;
      else if (daily1Brut >= 14) break1 = 2;
      else if (daily1Brut >= 11) break1 = 1.5;
      const daily1Net = Math.max(0, daily1Brut - break1);
      const total1 = daily1Net * days1;
      
      // 2. Satır
      const [w2H, w2M] = winterPattern.startTime2.split(':').map(Number);
      const [we2H, we2M] = winterPattern.endTime2.split(':').map(Number);
      const daily2Brut = ((we2H * 60 + we2M) - (w2H * 60 + w2M)) / 60;
      let break2 = 1;
      if (daily2Brut >= 15) break2 = 3;
      else if (daily2Brut >= 14) break2 = 2;
      else if (daily2Brut >= 11) break2 = 1.5;
      const daily2Net = Math.max(0, daily2Brut - break2);
      let total2 = daily2Net * winterPattern.days2;
      
      // HAFTA TATİLİ KONTROLÜ
      let holidayOvertime = 0;
      if ((winterDays1 + winterDays2) === 7 && winterPattern.hasWeeklyHoliday) {
        const holidayRow = winterPattern.weeklyHolidayRow || 2;
        
        if (holidayRow === 1) {
          const normalDays1 = winterDays1 - 1;
          holidayOvertime = Math.max(0, daily1Net - 7.5);
          total1 = (daily1Net * normalDays1) + holidayOvertime;
        } else {
          const normalDays2 = winterPattern.days2 - 1;
          holidayOvertime = Math.max(0, daily2Net - 7.5);
          total2 = (daily2Net * normalDays2) + holidayOvertime;
        }
      }
      
      winterWeeklyTotal = Math.round(total1 + total2);
      winterFmHours = Math.max(0, winterWeeklyTotal - 45);
      
      const fmt = (n: number) => n.toFixed(2).replace('.', ',');
      if (winterPattern.hasWeeklyHoliday && (winterDays1 + winterDays2) === 7) {
        const holidayRow = winterPattern.weeklyHolidayRow || 2;
        
        if (holidayRow === 1) {
          winterText = `${winterDays1 - 1} gün ${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${winterDays1 - 1} gün X ${fmt(daily1Net)} saat = ${fmt(daily1Net * (winterDays1 - 1))} saat
${fmt(daily1Net)} - 7,5 saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai
${winterPattern.days2} gün ${winterPattern.startTime2} - ${winterPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${winterPattern.days2} gün X ${fmt(daily2Net)} saat = ${fmt(daily2Net * winterPattern.days2)} saat`;
        } else {
          winterText = `${days1} gün ${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${days1} gün X ${fmt(daily1Net)} saat = ${fmt(total1)} saat
${winterPattern.days2 - 1} gün ${winterPattern.startTime2} - ${winterPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${winterPattern.days2 - 1} gün X ${fmt(daily2Net)} saat = ${fmt(daily2Net * (winterPattern.days2 - 1))} saat
${fmt(daily2Net)} - 7,5 saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai`;
        }
      } else {
        winterText = `${days1} gün ${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(daily1Brut)} saat çalışma ${fmt(break1)} saat ara dinlenme = ${fmt(daily1Net)} saat,
${days1} gün X ${fmt(daily1Net)} saat = ${fmt(total1)} saat
${winterPattern.days2} gün ${winterPattern.startTime2} - ${winterPattern.endTime2} = ${fmt(daily2Brut)} saat çalışma ${fmt(break2)} saat ara dinlenme = ${fmt(daily2Net)} saat,
${winterPattern.days2} gün X ${fmt(daily2Net)} saat = ${fmt(total2)} saat`;
      }
    } else {
      // Tek saat
      const [winterStartH, winterStartM] = winterPattern.startTime.split(':').map(Number);
      const [winterEndH, winterEndM] = winterPattern.endTime.split(':').map(Number);
      const winterDailyBrut = ((winterEndH * 60 + winterEndM) - (winterStartH * 60 + winterStartM)) / 60;
      let winterBreakHours = 1;
      if (winterDailyBrut >= 15) winterBreakHours = 3;
      else if (winterDailyBrut >= 14) winterBreakHours = 2;
      else if (winterDailyBrut >= 11) winterBreakHours = 1.5;
      const winterDailyNet = Math.max(0, winterDailyBrut - winterBreakHours);
      winterWeeklyTotal = Math.round(winterDailyNet * workDays);
      winterFmHours = Math.max(0, winterWeeklyTotal - 45);
      
      const fmt = (n: number) => n.toFixed(2).replace('.', ',');
      winterText = `${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(winterDailyBrut)} saat çalışma ${fmt(winterBreakHours)} saat ara dinlenme = ${fmt(winterDailyNet)} saat,
${workDays} gün X ${fmt(winterDailyNet)} saat = ${fmt(winterWeeklyTotal)} saat`;
    }

    // Format helper
    const fmt = (n: number) => n.toFixed(2).replace('.', ',');

    // SABİT FORMAT - DİNAMİK VERİ (2 SATIR SİSTEMİ DESTEKLİ)
    const text = `DAVACI:

Yaz : ${summerMonths}
${summerText}
Net haftalık çalışma = ${fmt(summerWeeklyTotal)} saat,
${fmt(summerWeeklyTotal)} – 45 saat yasal haftalık çalışma = ${fmt(summerFmHours)} saat haftalık fazla mesai

Kış : ${winterMonths}
${winterText}
Net haftalık çalışma = ${fmt(winterWeeklyTotal)} saat,
${fmt(winterWeeklyTotal)} – 45 saat yasal haftalık çalışma = ${fmt(winterFmHours)} saat haftalık fazla mesai`;

    return text;
  }, [
    JSON.stringify(donemselState.summerPattern),
    JSON.stringify(donemselState.winterPattern),
    weeklyDays
  ]);

  // Sekme değiştiğinde ESKİ VERİYİ TEMİZLE
  // DISABLED: Route-based architecture doesn't need scenario clearing
  // useEffect(() => {
  //   console.log('🔄 [SCENARIO SWITCH] Active scenario:', calculationScenario);
  //   
  //   if (calculationScenario !== 'HAFTALIK_KARMA') {
  //     console.log('🧹 [CLEAR] Clearing HAFTALIK_KARMA rows');
  //     setHaftalikKarmaFinalRows([]);
  //   }
  //   
  //   if (calculationScenario !== 'STANDART') {
  //     console.log('🧹 [CLEAR] Clearing STANDART rows');
  //     setStandartFinalRows([]);
  //   }
  // }, [calculationScenario]);

  // LEGACY CODE BELOW - Will be removed after refactor is complete
  // ═══════════════════════════════════════════════════════════
  const derivedRowsOLD = useMemo(() => {
    const dateIn = standardState.davaci.dateIn;
    const dateOut = standardState.davaci.dateOut;
    const timeIn = standardState.davaci.in;
    const timeOut = standardState.davaci.out;
    
    if (!dateIn || !dateOut || !timeIn || !timeOut) {
      return [];
    }
    
    // Aktif senaryoya göre rows dön
    switch (calculationScenario) {
      case "STANDART_OLD": {
        // Eğer rows state'i doluysa, onu kullan
        if (rows.length > 0) {
          return rows;
        }
        
        // BİLİRKİŞİ-1 TANIK KESİŞİM MANTĞI
        const davaci = {
          startDate: dateIn,
          endDate: dateOut,
          startTime: timeIn,
          endTime: timeOut,
          haftalikGunSayisi: Number(weeklyDays) || 6
        };
        
        // DEBUG: Tanık verilerini kontrol et
        console.log('🔍 Tüm tanıklar:', standardState.taniklar);
        
        const witnesses = standardState.taniklar
          .map((t, idx) => {
            const hasAllFields = t.dateIn && t.dateOut && t.in && t.out;
            if (!hasAllFields) {
              console.warn(`⚠️ Tanık ${idx + 1} eksik veri:`, {
                dateIn: t.dateIn || 'EKSİK',
                dateOut: t.dateOut || 'EKSİK',
                in: t.in || 'EKSİK',
                out: t.out || 'EKSİK'
              });
            }
            return { ...t, idx, hasAllFields };
          })
          .filter(t => t.hasAllFields)
          .map(t => ({
            dateIn: t.dateIn,
            dateOut: t.dateOut,
            in: t.in,
            out: t.out
          }));
        
        console.log('✅ Geçerli tanıklar:', witnesses);
        witnesses.forEach((w, idx) => {
          console.log(`  Tanık ${idx + 1}: ${w.dateIn} → ${w.dateOut} (${w.in} - ${w.out})`);
        });
        
        // Eğer tanık yoksa, boş dön
        if (witnesses.length === 0) {
          console.error('❌ Hiç geçerli tanık bulunamadı!');
          return [];
        }
        
        // ═══════════════════════════════════════════════════════════
        // TANIK OVERLAP SPLIT - UZUN SÜREN TANIKLARI PARÇALA
        // ═══════════════════════════════════════════════════════════
        // SORUN: Tanık 2 (2018-2024) içinde Tanık 1 (2019-2023) varsa,
        // generateDynamicIntervalsFromWitnesses Tanık 2'yi 2019'da kesiyor
        // ama 2023'ten sonraki kısmını kaybediyor.
        // ÇÖZÜM: Uzun tanıkları, ara tanıkların başlangıç/bitiş tarihlerine göre split et
        
        const splitWitnesses: any[] = [];
        
        // Kronolojik sırala
        const sortedWitnesses = [...witnesses].sort((a, b) => 
          new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime()
        );
        
        sortedWitnesses.forEach((witness, idx) => {
          const wStart = new Date(witness.dateIn);
          const wEnd = new Date(witness.dateOut);
          
          // Bu tanığı kesen diğer tanıkları bul
          const overlappingWitnesses = sortedWitnesses.filter((other, otherIdx) => {
            if (otherIdx === idx) return false;
            const oStart = new Date(other.dateIn);
            const oEnd = new Date(other.dateOut);
            // other bu witness'in içinde mi?
            return oStart > wStart && oStart < wEnd;
          });
          
          if (overlappingWitnesses.length === 0) {
            // Kesişim yok, olduğu gibi ekle
            splitWitnesses.push(witness);
          } else {
            // Kesişim var, split et
            let currentStart = wStart;
            
            // Kesişen tanıkları başlangıç tarihine göre sırala
            const sortedOverlaps = overlappingWitnesses.sort((a, b) => 
              new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime()
            );
            
            sortedOverlaps.forEach(overlap => {
              const overlapStart = new Date(overlap.dateIn);
              const overlapEnd = new Date(overlap.dateOut);
              
              // Overlap başlamadan önceki kısmı ekle
              if (currentStart < overlapStart) {
                const segmentEnd = new Date(overlapStart);
                segmentEnd.setDate(segmentEnd.getDate() - 1);
                
                if (segmentEnd >= currentStart) {
                  splitWitnesses.push({
                    ...witness,
                    dateIn: currentStart.toISOString().split('T')[0],
                    dateOut: segmentEnd.toISOString().split('T')[0]
                  });
                }
              }
              
              // Overlap'ten sonraki kısmı için currentStart'ı güncelle
              const nextStart = new Date(overlapEnd);
              nextStart.setDate(nextStart.getDate() + 1);
              currentStart = nextStart;
            });
            
            // Son overlap'ten sonra kalan kısmı ekle
            if (currentStart <= wEnd) {
              splitWitnesses.push({
                ...witness,
                dateIn: currentStart.toISOString().split('T')[0],
                dateOut: wEnd.toISOString().split('T')[0]
              });
            }
          }
        });
        
        console.log('🔪 Split edilmiş tanıklar:', splitWitnesses.length, 'adet');
        splitWitnesses.forEach((w, idx) => {
          console.log(`  Split ${idx + 1}: ${w.dateIn} → ${w.dateOut} (${w.in} - ${w.out})`);
        });
        
        // ═══════════════════════════════════════════════════════════
        // TANIK KESİŞİMİ - ESKİ BİLİRKİŞİ-1 MANTIĞI (KANITLANMIŞ)
        // ═══════════════════════════════════════════════════════════
        // generateDynamicIntervalsFromWitnesses ZATEN:
        // - Tanık dönemlerini split ediyor
        // - Yeni tanık başladığında önceki dönemi 1 gün önce kesiyor
        // - Davacı tarih aralığını alt/üst sınır olarak kullanıyor
        // - Saatleri kesişim ile hesaplıyor
        const intervals = generateDynamicIntervalsFromWitnesses(davaci, splitWitnesses);
        
        console.log('📊 Tanık kesişim sonucu - intervals:', intervals?.length || 0, 'adet');
        if (intervals && intervals.length > 0) {
          intervals.forEach((int, idx) => {
            console.log(`  Interval ${idx + 1}: ${int.start} → ${int.end} (${int.start_time} - ${int.end_time})`);
          });
        }
        
        if (!intervals || intervals.length === 0) {
          witnessIntersectionFMRef.current = 0;
          console.error('❌ generateDynamicIntervalsFromWitnesses boş döndü!');
          return [];
        }
        
        // ═══════════════════════════════════════════════════════════
        // BİLİRKİŞİ-1 HESAP ZİNCİRİ (ZORUNLU SIRA)
        // ═══════════════════════════════════════════════════════════
        // 1️⃣ Tanık kesişimi ✅ (generateDynamicIntervalsFromWitnesses)
        // 2️⃣ FM hesaplama ✅ (HER INTERVAL İÇİN AYRI)
        // 3️⃣ Asgari ücret dönemlerine bölme
        // 4️⃣ 270 saat düşüm
        // 5️⃣ Zamanaşımı filtreleme
        // 6️⃣ Katsayı uygulama
        // ═══════════════════════════════════════════════════════════
        
        let generatedRows: any[] = [];
        
        // 3️⃣ ASGARİ ÜCRET DÖNEMLERİNE BÖL
        // Her interval'ı asgari ücret dönemlerine böl
        intervals.forEach((interval, intervalIdx) => {
          const intervalStartDate = new Date(interval.start);
          const intervalEndDate = new Date(interval.end);
          
          // ═══════════════════════════════════════════════════════════
          // FM SAATİ HESAPLAMA - BU INTERVAL İÇİN (activeTab'a göre)
          // ═══════════════════════════════════════════════════════════
          const intersectedIn = interval.start_time || timeIn;
          const intersectedOut = interval.end_time || timeOut;
          
          // Günlük brüt saat hesapla (KESİŞEN SAATLER)
          const [girH, girM] = intersectedIn.split(':').map(Number);
          const [cikH, cikM] = intersectedOut.split(':').map(Number);
          const girMinutes = girH * 60 + girM;
          const cikMinutes = cikH * 60 + cikM;
          const dailyMinutes = cikMinutes - girMinutes;
          const dailyBrut = dailyMinutes / 60;
          
          // Ara dinlenme: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h (4857/68 + Yargıtay)
          let breakHours = 1;
          if (dailyBrut >= 15) breakHours = 3;
          else if (dailyBrut >= 14) breakHours = 2;
          else if (dailyBrut >= 11) breakHours = 1.5;
          
          const dailyNet = Math.max(0, dailyBrut - breakHours);
          const workDays = Number(weeklyDays) || 6;
          
          // FM hesaplama (activeTab'a göre)
          let fmHours = 0;
          
          if (workDays === 7 && activeTab === 'tatilli') {
            // HAFTA TATİLLİ HESAPLAMA
            const weeklyNormal = 6 * dailyNet;
            const holidayOvertime = Math.max(0, dailyNet - 7.5);
            const weeklyTotal = weeklyNormal + holidayOvertime;
            const roundedWeekly = Math.round(weeklyTotal);
            fmHours = Math.max(0, roundedWeekly - 45);
          } else {
            // HAFTA TATİLSİZ HESAPLAMA
            const weeklyTotal = dailyNet * workDays;
            const roundedWeekly = Math.round(weeklyTotal);
            fmHours = Math.max(0, roundedWeekly - 45);
          }
          
          console.log(`📊 [INTERVAL ${intervalIdx + 1}] FM Hours: ${fmHours.toFixed(2)}`);
          
          // Store FM hours for witness intersection calculation (first interval only)
          if (intervalIdx === 0) {
            witnessIntersectionFMRef.current = fmHours;
          }
          
          // Bu interval'ı asgari ücret dönemlerine böl (dateSegmentationCore kullan)
          const segments = splitByAsgariUcretPeriods(intervalStartDate, intervalEndDate);
          
          console.log(`  📅 Asgari ücret segmentleri: ${segments.length} adet`);
          
          segments.forEach((seg, segIdx) => {
            const segStart = seg.start;
            const segEnd = seg.end;
            
            const startFormatted = format(segStart, 'dd.MM.yyyy');
            const endFormatted = format(segEnd, 'dd.MM.yyyy');
            
            // ISO tarih formatı (YYYY-MM-DD)
            const segStartISO = segStart.toISOString().split('T')[0];
            const segEndISO = segEnd.toISOString().split('T')[0];
            
            // Hafta sayısını hesapla
            const diffMs = segEnd.getTime() - segStart.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
            const weeks = Math.round(diffDays / 7);
            console.log(`  📅 Hafta sayısı: ${weeks}`);
            
            // Asgari ücreti bul (segment başlangıç tarihine göre)
            console.log(`  🔍 Segment tarihleri: ${startFormatted} (${segStartISO}) → ${endFormatted} (${segEndISO})`);
            const asgariUcret = getAsgariUcretByDate(segStartISO) || 17002.12;
            console.log(`  💰 ${startFormatted} için asgari ücret: ${asgariUcret} TL`);
            
            generatedRows.push({
              id: `period-${generatedRows.length}`,
              startISO: segStartISO,
              endISO: segEndISO,
              rangeLabel: `${startFormatted} – ${endFormatted}`,
              weeks: weeks,
              brut: asgariUcret,
              katsayi: 1,
              fmHours: fmHours,
              fm: 0, // Henüz hesaplanmadı
              net: 0,
              year: segStart.getFullYear(),
            });
          });
        });
        
        console.log('📋 Asgari ücret segmentasyonu sonrası - generatedRows:', generatedRows.length, 'adet');
        generatedRows.forEach((row, idx) => {
          console.log(`  Row ${idx + 1}: ${row.rangeLabel}`);
        });
        
        // 4️⃣ 270 SAAT DÜŞÜM (eğer aktifse)
        if (include270 && mode270 === 'simple') {
          // YARGITAY (simple): Haftalık 5.2 saat düşüm (270/52)
          const YARGITAY_270_WEEKLY_DEDUCTION = 5.2;
          console.log('🔻 [270] Applying Yargıtay deduction: -5.2 hours per week');
          generatedRows = generatedRows.map(row => ({
            ...row,
            fmHours: Math.max(0, row.fmHours - YARGITAY_270_WEEKLY_DEDUCTION)
          }));
        } else if (include270 && mode270 === 'detailed') {
          // ŞİRKET (detailed): Use proper calculateOvertimeWith270AndLimitation function
          console.log('🔻 [270] Applying Şirket deduction using calculateOvertimeWith270AndLimitation');
          
          const iseGirisTarihi = new Date(standardState.davaci.dateIn);
          const istenCikisTarihi = new Date(standardState.davaci.dateOut);
          const haftalikFazlaMesaiSaati = generatedRows[0]?.fmHours || 0;
          
          // Convert generatedRows to tabloSatirlari format
          const tabloSatirlari = generatedRows.map(row => ({
            baslangic: new Date(row.startISO),
            bitis: new Date(row.endISO)
          }));
          
          // Call the proper 270 calculation function
          const sonuclar = calculateOvertimeWith270AndLimitation({
            iseGirisTarihi,
            istenCikisTarihi,
            haftalikFazlaMesaiSaati,
            zamanaSimiTarihi: zamanasimiBaslangic ? new Date(zamanasimiBaslangic) : undefined,
            yillikIzinler: [], // TODO: Add yıllık izin support if needed
            tabloSatirlari
          });
          
          // Map results back to generatedRows
          // IMPORTANT: Preserve fmHours, only update weeks
          generatedRows = generatedRows.map((row, idx) => ({
            ...row,
            weeks: sonuclar[idx]?.fmHafta || 0,
            originalWeekCount: row.weeks,
            fmHours: row.fmHours // ✅ Preserve FM hours (Şirket mode reduces weeks, not hours)
          }));
          
          const totalDeductedWeeks = generatedRows.reduce((sum, r) => sum + (r.originalWeekCount - r.weeks), 0);
          console.log(`🔻 [270] Total weeks deducted: ${totalDeductedWeeks}`);
        }
        
        // 5️⃣ ZAMANAŞIMI FİLTRELEME (GÜN/AY/YIL HASSAS)
        if (zamanasimiBaslangic) {
          const zamanasimiDate = new Date(zamanasimiBaslangic);
          
          generatedRows = generatedRows
            .map(row => {
              const rowStartDate = new Date(row.startISO);
              const rowEndDate = new Date(row.endISO);
              
              // Eğer period.end < Z → DÖNEMİ TAMAMEN SİL
              if (rowEndDate < zamanasimiDate) {
                return null;
              }
              
              // Eğer period.start < Z < period.end → period.start = Z
              if (rowStartDate < zamanasimiDate && rowEndDate >= zamanasimiDate) {
                // Başlangıç tarihini zamanaşımı tarihine eşitle
                const adjustedStartISO = zamanasimiDate.toISOString().split('T')[0];
                const adjustedStartFormatted = format(zamanasimiDate, 'dd.MM.yyyy');
                const endFormatted = format(rowEndDate, 'dd.MM.yyyy');
                
                // Hafta sayısını yeniden hesapla (kırpılmış dönem için)
                const diffMs = rowEndDate.getTime() - zamanasimiDate.getTime();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
                const weeksRaw = diffDays / 7;
                const adjustedWeeks = Math.round(weeksRaw);
                
                return {
                  ...row,
                  startISO: adjustedStartISO,
                  rangeLabel: `${adjustedStartFormatted} – ${endFormatted}`,
                  weeks: adjustedWeeks,
                };
              }
              
              // Eğer period.start >= Z → DOKUNMA
              return row;
            })
            .filter(row => row !== null); // null olanları çıkar
        }
        
        // 6️⃣ KATSAYI UYGULAMA + FINAL FM HESAPLAMA
        const finalKatsayi = katSayi || 1;
        generatedRows = generatedRows.map(row => {
          // FM tutarı hesapla: weeks × brut × katsayi × fmHours / 225 × 1.5
          const step1 = row.weeks * row.brut;
          const step2 = step1 * finalKatsayi;
          const step3 = step2 * row.fmHours;
          const step4 = step3 / 225;
          const step5 = step4 * 1.5;
          const fm = Number(step5.toFixed(2));
          const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
          
          return {
            ...row,
            katsayi: finalKatsayi,
            fm: fm,
            net: net,
          };
        });
        
        return generatedRows;
      }
      case "HAFTALIK_KARMA": {
        // Haftalık Karma: Use FM hours from text calculation (SINGLE SOURCE)
        
        const dateIn = haftalikKarmaState.weeklyStartDateISO;
        const dateOut = haftalikKarmaState.weeklyEndDateISO;
        
        if (!dateIn || !dateOut) {
          return [];
        }
        
        // Get FM hours from text calculation (CANONICAL SOURCE)
        const fmHoursMap = (window as any).__haftalikKarmaFMHours as Map<string, number> || new Map();
        
        const davaciWeeklyFMHours = fmHoursMap.get('Davacı') || 0;
        
        console.log('📊 [HAFTALIK_KARMA] Using text calculation FM hours:', davaciWeeklyFMHours);
        
        // Store davacı FM hours for reference
        witnessIntersectionFMRef.current = davaciWeeklyFMHours;
        
        // Generate rows per witness period with FM from text calculation
        const allPeriods: Array<{
          startISO: string;
          endISO: string;
          label: string;
        }> = [];
        
        // 1) Davacı period
        allPeriods.push({
          startISO: dateIn,
          endISO: dateOut,
          label: 'Davacı'
        });
        
        // 2) Witness periods
        if (haftalikKarmaState.witnesses && haftalikKarmaState.witnesses.length > 0) {
          haftalikKarmaState.witnesses.forEach((witness, idx) => {
            if (witness.startDateISO && witness.endDateISO) {
              allPeriods.push({
                startISO: witness.startDateISO,
                endISO: witness.endDateISO,
                label: `Tanık ${idx + 1}`
              });
            }
          });
        }
        
        const generatedRows: any[] = [];
        
        // Generate rows for each period
        for (const period of allPeriods) {
          const periodStart = new Date(period.startISO);
          const periodEnd = new Date(period.endISO);
          
          // Get FM from text calculation (SINGLE SOURCE)
          const periodWeeklyFMHours = fmHoursMap.get(period.label) || 0;
          
          console.log(`📊 [HAFTALIK_KARMA] ${period.label} FM from text:`, periodWeeklyFMHours);
          
          // Split by minimum wage periods
          const segments = splitByAsgariUcretPeriods(periodStart, periodEnd);
          
          for (const seg of segments) {
            const segStart = new Date(seg.start);
            const segEnd = new Date(seg.end);
            
            const segStartISO = segStart.toISOString().split('T')[0];
            const segEndISO = segEnd.toISOString().split('T')[0];
            
            const startFormatted = format(segStart, 'dd.MM.yyyy');
            const endFormatted = format(segEnd, 'dd.MM.yyyy');
            
            // Calculate weeks
            const diffMs = segEnd.getTime() - segStart.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
            const weeks = Math.round(diffDays / 7);
            
            // Get minimum wage
            const asgariUcret = getAsgariUcretByDate(segStartISO) || 17002.12;
            
            // Calculate FM using period-specific FM hours
            const fm = weeks * asgariUcret * katSayi * periodWeeklyFMHours / 225 * 1.5;
            
            generatedRows.push({
              startISO: segStartISO,
              endISO: segEndISO,
              rangeLabel: `${startFormatted} – ${endFormatted}`,
              weeks,
              brut: asgariUcret,
              katsayi: katSayi,
              fmHours: periodWeeklyFMHours,
              fm,
              net: 0,
              manual: false,
              periodLabel: period.label
            });
          }
        }
        
        // Apply statute of limitations if set
        if (zamanasimiBaslangic) {
          const zamanasimiDate = new Date(zamanasimiBaslangic);
          
          return generatedRows
            .map(row => {
              const rowStartDate = new Date(row.startISO);
              const rowEndDate = new Date(row.endISO);
              
              if (rowEndDate < zamanasimiDate) {
                return null;
              }
              
              if (rowStartDate < zamanasimiDate && rowEndDate >= zamanasimiDate) {
                const adjustedStartISO = zamanasimiDate.toISOString().split('T')[0];
                const adjustedStartFormatted = format(zamanasimiDate, 'dd.MM.yyyy');
                const endFormatted = format(rowEndDate, 'dd.MM.yyyy');
                
                const diffMs = rowEndDate.getTime() - zamanasimiDate.getTime();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
                const adjustedWeeks = Math.round(diffDays / 7);
                
                const adjustedFm = adjustedWeeks * row.brut * row.katsayi * row.fmHours / 225 * 1.5;
                
                return {
                  ...row,
                  startISO: adjustedStartISO,
                  rangeLabel: `${adjustedStartFormatted} – ${endFormatted}`,
                  weeks: adjustedWeeks,
                  fm: adjustedFm
                };
              }
              
              return row;
            })
            .filter(Boolean);
        }
        
        // Apply 270 deduction if enabled
        if (include270 && mode270 !== "none") {
          const appliedYears = new Set<number>();
          
          return generatedRows.map(row => {
            const year = new Date(row.startISO).getFullYear();
            
            if (mode270 === "simple" && !appliedYears.has(year)) {
              appliedYears.add(year);
              const deductedFMHours = Math.max(0, row.fmHours - (270 / 52));
              const adjustedFm = row.weeks * row.brut * row.katsayi * deductedFMHours / 225 * 1.5;
              
              return {
                ...row,
                fmHours: deductedFMHours,
                fm: adjustedFm
              };
            }
            
            return row;
          });
        }
        
        return generatedRows;
      }
      case "DONEMSEL":
        return []; // TODO: Dönemsel hesaplama
      case "DONEMSEL_HAFTALIK_KARMA":
        return []; // TODO: Dönemsel karma hesaplama
      default:
        return [];
    }
  }, [calculationScenario, rows, weeklyDays, standardState.davaci.dateIn, standardState.davaci.dateOut, standardState.davaci.in, standardState.davaci.out, standardState.taniklar, katSayi, zamanasimiBaslangic, include270, mode270, activeTab, haftalikKarmaState.weeklyStartDateISO, haftalikKarmaState.weeklyEndDateISO, haftalikKarmaState.dayGroups]);
  
  const derivedRowsWithExclusions = useMemo(
    () =>
      applyAnnualLeaveExclusions(derivedRows, exclusions, {
        minWeeks: 1,
      }),
    [derivedRows, exclusions]
  );

  // ACTIVE ROWS - Aktif senaryoya göre seç
  const activeRows = useMemo(() => {
    if (calculationScenario === 'STANDART') return standartFinalRows;
    if (calculationScenario === 'HAFTALIK_KARMA') return haftalikKarmaFinalRows;
    if (calculationScenario === 'DONEMSEL') return donemselFinalRows;
    if (calculationScenario === 'DONEMSEL_HAFTALIK_KARMA') return donemselHaftalikFinalRows;
    return [];
  }, [calculationScenario, standartFinalRows, haftalikKarmaFinalRows, donemselFinalRows, donemselHaftalikFinalRows]);

  // finalRows alias; setFinalRows satır ekleme/silme ve hücre düzenlemesi için
  const finalRows = activeRows;
  const setFinalRows = useCallback((rows: any[]) => {
    if (calculationScenario === 'STANDART') setStandartFinalRows(rows);
    else if (calculationScenario === 'HAFTALIK_KARMA') setHaftalikKarmaFinalRows(rows);
    else if (calculationScenario === 'DONEMSEL') setDonemselFinalRows(rows);
    else if (calculationScenario === 'DONEMSEL_HAFTALIK_KARMA') setDonemselHaftalikFinalRows(rows);
  }, [calculationScenario]);
  
  // Debug: finalRows içeriğini logla
  useEffect(() => {
    if (calculationScenario === 'DONEMSEL' && finalRows.length > 0) {
      console.log('📊 [DONEMSEL] finalRows for table:', finalRows.length, 'rows');
      console.log('📊 [DONEMSEL] İlk 3 satır:', finalRows.slice(0, 3).map(r => ({
        rangeLabel: r.rangeLabel,
        startISO: r.startISO,
        endISO: r.endISO,
        weeks: r.weeks,
        fmHours: r.fmHours
      })));
    }
  }, [calculationScenario, finalRows]);
  
  // Reset isLoadingFromSavedRef after initial load completes
  useEffect(() => {
    if (isLoadingFromSavedRef.current && finalRows.length > 0) {
      // Give it a moment to settle, then allow syncs again
      const timer = setTimeout(() => {
        console.log('🔓 [SYNC] Resetting isLoadingFromSavedRef - ready for new calculations');
        isLoadingFromSavedRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [finalRows.length]);

  // SYNC: derivedRowsWithExclusions → scenario-specific finalRows
  // ONLY for STANDART route - other scenarios are isolated
  useEffect(() => {
    // Route guard: Only run for /standart route
    if (!location.pathname.includes('/standart')) return;
    
    console.log('🔄 [SYNC] Syncing to', calculationScenario, 'finalRows:', derivedRowsWithExclusions.length, 'rows');
    
    if (calculationScenario === 'STANDART') {
      setStandartFinalRows([...derivedRowsWithExclusions]);
      rowsRef.current = derivedRowsWithExclusions;
    }
  }, [derivedRowsWithExclusions, calculationScenario, location.pathname]);

  // SYNC: derivedRowsWithExclusions → HAFTALIK_KARMA finalRows
  useEffect(() => {
    if (!location.pathname.includes('/haftalik-karma')) return;
    if (calculationScenario === 'HAFTALIK_KARMA') {
      setHaftalikKarmaFinalRows([...derivedRowsWithExclusions]);
      rowsRef.current = derivedRowsWithExclusions;
    }
  }, [derivedRowsWithExclusions, calculationScenario, location.pathname]);

  // SYNC: derivedRowsWithExclusions → DONEMSEL / DONEMSEL_HAFTALIK_KARMA (dönemsel-haftalik sayfasında tablo + satır ekle/sil)
  useEffect(() => {
    if (!location.pathname.includes('/donemsel-haftalik')) return;
    if (calculationScenario === 'DONEMSEL') {
      setDonemselFinalRows([...derivedRowsWithExclusions]);
      rowsRef.current = derivedRowsWithExclusions;
    }
    if (calculationScenario === 'DONEMSEL_HAFTALIK_KARMA') {
      setDonemselHaftalikFinalRows([...derivedRowsWithExclusions]);
      rowsRef.current = derivedRowsWithExclusions;
    }
  }, [derivedRowsWithExclusions, calculationScenario, location.pathname]);

  // Row manipulation functions (after finalRows is defined)
  const duplicateRow = useCallback((i: number) => {
    const updated = [...finalRows];
    // Create NEW EMPTY row (not a copy)
    const newRow = createManualRow();
    // Insert below current row
    updated.splice(i + 1, 0, newRow);
    setFinalRows(updated);
  }, [finalRows, createManualRow]);

  const deleteRow = useCallback((i: number) => {
    if (finalRows.length <= 1) {
      console.warn('[deleteRow] Cannot delete - at least 1 row must remain');
      return;
    }
    const updated = finalRows.filter((_, idx) => idx !== i);
    setFinalRows(updated);
  }, [finalRows]);

  // Toplam hesaplamaları - finalRows kullan
  const totalBrut = useMemo(() => finalRows.reduce((a, r) => a + (r.fm || 0), 0), [finalRows]);
  const totalFm = useMemo(() => finalRows.reduce((a, r) => a + (r.fm || 0), 0), [finalRows]);
  const totalNet = useMemo(() => finalRows.reduce((a, r) => a + (r.net || 0), 0), [finalRows]);
  
  // Brüt değerini güncelle (brütten nete çeviri için)
  useEffect(() => {
    setBrut(totalFm);
  }, [totalFm, setBrut]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

  const handlePrint = useCallback(() => {
    if (USE_NEW_BILIRKISI1_REPORT) {
      setShowNewBilirkisi1ReportModal(true);
    } else {
      window.print();
    }
  }, []);

  const handleNewCalculation = () => {
    try {
      if (!caseData?.saved && ((caseData?.taniklar?.length ?? 0) > 0 || !!caseData?.davaci?.startDate)) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // State'leri temizle
      setStandardState({
        davaci: { in: "", out: "", dateIn: "", dateOut: "" },
        taniklar: [{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }],
        exclusions: []
      });
      
      setDonemselState({
        davaciDeclaration: null,
        tanikDeclarations: [],
        exclusions: [],
        summerPattern: { months: [4, 5, 6, 7, 8, 9], startTime: "08:00", endTime: "20:00", workDays: 6 },
        winterPattern: { months: [1, 2, 3, 10, 11, 12], startTime: "09:00", endTime: "18:00", workDays: 6 },
        witnessesSeasons: []
      });
      
      setHaftalikKarmaState({
        weeklyStartDateISO: "",
        weeklyEndDateISO: "",
        dayGroups: [
          { dayCount: 0, startTime: "", endTime: "" },
          { dayCount: 0, startTime: "", endTime: "" }
        ],
        witnesses: [],
        exclusions: []
      });
      
      setCaseData({
        davaci: {
          startDate: "",
          endDate: "",
          startTime: "07:30",
          endTime: "17:30",
        },
        taniklar: [],
        exclusions: [],
        saved: false,
      });
      setRows([]);
      setOvertimeResults([]);
      setIntervals([]);
      setNotes("");
      setIseGiris("");
      setIstenCikis("");
      setGir("");
      setCik("");
      setDavaci({ in: "", out: "" });
      setTaniklar([]);
      setExclusions([]);
      
      // RESET: Kayıtlı dosya flag'lerini sıfırla
      isLoadingFromSavedRef.current = false;
      loadRanRef.current = false;
      caseIdRef.current = null;
      
      // Yeni sayfaya yönlendir
      navigate("/fazla-mesai/donemsel-haftalik", { replace: true });
      
      success("Yeni hesaplama başlatıldı.");
    } catch {}
  };

  const handleSave = () => {
    console.log('💾 [SAVE] Saving with finalRows:', finalRows.length, 'rows');
    console.log('💾 [SAVE] First row:', finalRows[0]);
    console.log('💾 [SAVE] Active scenario:', calculationScenario);
    console.log('💾 [SAVE] effectiveId:', effectiveId);
    console.log('💾 [SAVE] currentRecordName:', currentRecordName);
    kaydetAc({
      hesapTuru: "donemsel_haftalik_fazla_mesai",
      veri: {
        data: {
          form: {
            iseGiris: standardState.davaci.dateIn,
            istenCikis: standardState.davaci.dateOut,
            weeklyDays,
            gir: standardState.davaci.in,
            cik: standardState.davaci.out,
            davaci: standardState.davaci,
            taniklar: standardState.taniklar,
            exclusions,
            activeScenario: calculationScenario,
            activeTab,
            rows: finalRows, // ✅ Save finalRows in form.rows so they can be loaded back
            // Scenario-specific state
            standardState,
            haftalikKarmaState,
            donemselState,
            donemselKarmaState,
          },
          results: {
            rows: finalRows,
            totalBrut: totalFm,
            totalNet: totalNet,
            weeklyFMHours: witnessIntersectionFMRef.current,
          }
        }
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName || undefined,
      redirectPath: "/fazla-mesai/donemsel-haftalik/:id",
    });
  };

  const weeklyMode = weeklyDays === "7" ? "tatilli" : "tatilsiz";

  // Form state objesi
  const formState: FormState = useMemo(() => ({
    davaci,
    taniklar,
    gir,
    cik,
    weeklyDays,
    activeTab,
    exclusions,
    finalWeeklyOvertime,
    include270,
    iseGiris,
    istenCikis,
    zamanasimiBaslangic,
    haftalikMesai,
    katSayi,
  }), [
    davaci,
    taniklar,
    gir,
    cik,
    weeklyDays,
    activeTab,
    exclusions,
    finalWeeklyOvertime,
    include270,
    iseGiris,
    istenCikis,
    zamanasimiBaslangic,
    haftalikMesai,
    katSayi,
  ]);

  // Tab change - NO RESET for STANDART scenario
  // Rows should persist after calculation

  // AUTO-CALC USEEFFECT - TEK TETİKLEYİCİ
  useEffect(() => {
    if (!isAutoCalcReady) {
      return;
    }

    if (isLoadingFromSavedRef.current) {
      return;
    }

    const performCalculation = async () => {
      try {
        setIsCalculating(true);
        
        // STANDART senaryo için standardState'ten veri al
        const inputIseGiris = standardState.davaci.dateIn;
        const inputIstenCikis = standardState.davaci.dateOut;
        const inputGir = standardState.davaci.in;
        const inputCik = standardState.davaci.out;
        
        // LOKAL HESAPLAMA - computeClassic kullan
        const calculationResult = computeClassic(
          inputIseGiris,
          inputIstenCikis,
          inputGir,
          inputCik,
          Number(weeklyDays) || 6
        );
        
        if (!calculationResult || calculationResult.length === 0) {
          setRows([]);
          setIsCalculating(false);
          return;
        }
        
        // ❌ ESKİ 270/KATSAYI LOJİĞİ KALDIRILDI
        // Artık tüm hesaplar derivedRows useMemo içinde yapılıyor
        // Bu useEffect sadece computeClassic sonucunu rows state'e yazıyor
        let finalRows = calculationResult;
        
        if (hasManualChanges && currentRows.length > 0) {
          // Manuel değişiklikleri koru: Backend'den gelen rows ile mevcut rows'u birleştir
          // Manuel satırları (yeni eklenen veya değiştirilen) bul
          const manualRows = currentRows.filter((r: any) => r.manual && !newRows.some((nr: any) => nr.startISO === r.startISO && nr.endISO === r.endISO));
          
          // Aynı startISO ve endISO'ya sahip satırları eşleştir ve manuel değişiklikleri koru
          finalRows = newRows.map((newRow: any, idx: number) => {
            // Mevcut rows'da aynı startISO ve endISO'ya sahip satırı bul
            const existingRow = currentRows.find((r: any) => 
              r.startISO === newRow.startISO && r.endISO === newRow.endISO
            );
            
            if (existingRow && (existingRow.manual || existingRow.fmManual || existingRow.brutManual)) {
              // Manuel değişiklikleri koru
              const finalBrut = existingRow.brut !== undefined && existingRow.brutManual ? existingRow.brut : newRow.brut;
              const finalFmHours = existingRow.fmHours !== undefined && existingRow.fmManual ? existingRow.fmHours : newRow.fmHours;
              // 270 saatlik düşüm: include270 durumuna göre backend'den gelen weeks değerini kullan
              // include270: true → düşüm uygulanmış weeks
              // include270: false → düşüm uygulanmamış weeks
              // Kullanıcı manuel olarak weeks değiştirmişse ve include270: false ise mevcut değeri kullan
              const finalWeeks = include270 
                ? newRow.weeks // Backend'den gelen weeks değeri (270 saatlik düşüm uygulanmış)
                : newRow.weeks; // Backend'den gelen weeks değeri (270 saatlik düşüm uygulanmamış) - her zaman backend'den gelen değeri kullan
              const finalStartISO = existingRow.startISO !== undefined && existingRow.manual ? existingRow.startISO : newRow.startISO;
              const finalEndISO = existingRow.endISO !== undefined && existingRow.manual ? existingRow.endISO : newRow.endISO;
              
              // FM ve net'i yeniden hesapla
              // 1. Manuel brut veya fmHours değişmişse
              // 2. include270 durumu değişmişse (weeks değeri değişti)
              const kats = existingRow.katsayi || newRow.katsayi || 1;
              const step1 = Number((finalWeeks * finalBrut).toFixed(6));
              const step2 = Number((step1 * kats).toFixed(6));
              const step3 = Number((step2 * finalFmHours).toFixed(6));
              const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
              const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
              const finalFm = Number(step5.toFixed(2));
              const finalNet = Number((finalFm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
              
              return {
                ...newRow,
                // Manuel değişiklikleri koru
                brut: finalBrut,
                fmHours: finalFmHours,
                weeks: finalWeeks,
                startISO: finalStartISO,
                endISO: finalEndISO,
                fm: finalFm,
                net: finalNet,
                katsayi: existingRow.katsayi || newRow.katsayi || 1,
                // Manuel flag'leri koru
                manual: existingRow.manual || false,
                fmManual: existingRow.fmManual || false,
                brutManual: existingRow.brutManual || false,
              };
            }
            
            return newRow;
          });
          
          // Manuel satırları sona ekle
          if (manualRows.length > 0) {
            finalRows = [...finalRows, ...manualRows];
          }
          
          finalRows = finalRows.map(r => ({
            ...r,
            originalWeekCount: r.originalWeekCount ?? r.weeks
          }));
          
          if (include270) {
            // ✅ YARGITAY (simple): Reduce FM HOURS by 5.2, keep weeks same
            if (mode270 === "simple") {
              const YARGITAY_270_WEEKLY_DEDUCTION = 5.2;
              finalRows = finalRows.map((row: any) => {
                const adjustedFmHours = Math.max(0, Number((row.fmHours - YARGITAY_270_WEEKLY_DEDUCTION).toFixed(2)));
                const kats = katSayi;
                const step1 = Number((row.weeks * row.brut).toFixed(6));
                const step2 = Number((step1 * kats).toFixed(6));
                const step3 = Number((step2 * adjustedFmHours).toFixed(6));
                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                const fm = Number(step5.toFixed(2));
                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                return { ...row, fmHours: adjustedFmHours, katsayi: kats, fm, net };
              });
              setHaftaDususBilgisi(null);
            }
            // ✅ ŞİRKET (detailed): Reduce WEEKS, keep FM hours same
            else if (mode270 === "detailed") {
              const beforeWeeks = finalRows.reduce((sum, r) => sum + (r.originalWeekCount || r.weeks || 0), 0);
              finalRows = apply270RuleFrontend(finalRows);
              const afterWeeks = finalRows.reduce((sum, r) => sum + (r.weeks || 0), 0);
              const deductedWeeks = beforeWeeks - afterWeeks;
              setHaftaDususBilgisi(Math.round(deductedWeeks));
              
              // Tüm satırlar için FM/net'i yeniden hesapla
              finalRows = finalRows.map((row: any) => {
                const kats = katSayi;
                const step1 = Number((row.weeks * row.brut).toFixed(6));
                const step2 = Number((step1 * kats).toFixed(6));
                const step3 = Number((step2 * row.fmHours).toFixed(6));
                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                const fm = Number(step5.toFixed(2));
                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                return { ...row, katsayi: kats, fm, net };
              });
            }
          } else {
            setHaftaDususBilgisi(null);
          }
          
          // Skip redundant FM/net calculation if already done in 270 logic above
          if (!include270 || (mode270 !== "simple" && mode270 !== "detailed")) {
            finalRows = finalRows.map((row: any) => {
              const kats = katSayi;
              const step1 = Number((row.weeks * row.brut).toFixed(6));
              const step2 = Number((step1 * kats).toFixed(6));
              const step3 = Number((step2 * row.fmHours).toFixed(6));
              const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
              const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
              const fm = Number(step5.toFixed(2));
              const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
              return {
                ...row,
                katsayi: kats,
                fm,
                net
              };
            });
          }
        }
        
        // KRITIK: Rows state'e YAZ
        setRows(finalRows);

        setTimeout(() => {
          setIsCalculating(false);
        }, 200);
      } catch (err: any) {
        setIsCalculating(false);
        showToastError(err.message || 'Hesaplama sırasında bir hata oluştu');
      }
    };

    performCalculation();
  }, [isAutoCalcReady]); // TEK DEPENDENCY

  const recalculateAll = () => {
    setRefreshFlag(prev => prev + 1);
  };

  const handleCalculateOvertime = async () => {
    // FORCE CALC - for debugging only
    if (rows.length > 0) {
      setFinalRows(rows);
    } else if (derivedRows.length > 0) {
      setFinalRows(derivedRows);
    }
  };

  // Dinamik metin: TANIK KESİŞİMİ BAZLI (TEK KAYNAK: witnessIntersectionFMRef)
  const fmPeriods = useMemo(() => {
    // HAFTALIK_KARMA: Kendi logic'i ile hesapla (finalRows'a bağlı değil)
    if (calculationScenario === "HAFTALIK_KARMA") {
      if (!haftalikKarmaState.weeklyStartDateISO || !haftalikKarmaState.weeklyEndDateISO) {
        return [];
      }
      
      // Hukuki ara dinlenme (4857/68 + Yargıtay): 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h
      const calculateLegalBreak = (dailyHours: number): number => {
        if (dailyHours <= 4) return 0.25;
        if (dailyHours <= 7.5) return 0.50;
        if (dailyHours < 11) return 1.00;
        if (dailyHours < 14) return 1.50;
        if (dailyHours < 15) return 2.00;
        return 3.00;
      };
      
      // Helper function: Gün gruplarından metin üret
      const generateWeeklyText = (dayGroups: any[], title: string) => {
        if (!dayGroups || dayGroups.length === 0) {
          return null;
        }
        
        // Helper: Format number with comma decimal separator
        const fmt = (n: number) => n.toFixed(2).replace('.', ',');
        
        let textLines: string[] = [];
        let groupTotals: number[] = [];
        
        dayGroups.forEach((group) => {
          const days = group.dayCount || group.days || 0;
          if (!group.startTime || !group.endTime || days === 0) {
            return;
          }
          
          const [girH, girM] = group.startTime.split(':').map(Number);
          const [cikH, cikM] = group.endTime.split(':').map(Number);
          const girMinutes = girH * 60 + girM;
          const cikMinutes = cikH * 60 + cikM;
          const dailyMinutes = cikMinutes - girMinutes;
          const dailyHours = dailyMinutes / 60;
          
          // Hukuki ara dinlenme (günlük çalışma süresine göre)
          const breakPerDay = calculateLegalBreak(dailyHours);
          const netDaily = dailyHours - breakPerDay;
          const groupTotal = netDaily * days;
          
          groupTotals.push(groupTotal);
          
          // Format: "3 gün 07:00 - 18:00 = 11.00 saat çalışma 1,5 saat ara dinlenme = 9,5 saat,"
          textLines.push(`${days} gün ${group.startTime} - ${group.endTime} = ${dailyHours.toFixed(2)} saat çalışma ${fmt(breakPerDay)} saat ara dinlenme = ${fmt(netDaily)} saat,`);
          // Format: "3 Gün X 9,5 saat = 28,5 saat,"
          textLines.push(`${days} Gün X ${fmt(netDaily)} saat = ${fmt(groupTotal)} saat,`);
          textLines.push(''); // Empty line between groups
        });
        
        if (groupTotals.length === 0) {
          return null;
        }
        
        // Toplam hesaplama - tek yerde yuvarlama, tüm metin ve hesapta aynı değer
        const totalNet = groupTotals.reduce((sum, val) => sum + val, 0);
        const roundedWeekly = Math.round(totalNet);
        const weeklyOvertime = Math.max(0, roundedWeekly - 45);
        
        // Format: "Toplam çalışma = 28,5 saat + 37,5 saat = 66 saat"
        const groupSums = groupTotals.map(g => `${fmt(g)} saat`).join(' + ');
        textLines.push(`Toplam çalışma = ${groupSums} = ${roundedWeekly} saat`);
        textLines.push(`Net haftalık çalışma = ${roundedWeekly} saat,`);
        textLines.push(`${roundedWeekly} – 45 saat yasal haftalık çalışma = ${weeklyOvertime} saat haftalık fazla mesai`);
        
        return {
          label: title,
          text: textLines.join('\n'),
          weeklyFMHours: weeklyOvertime
        };
      };
      
      const results: Array<{ label: string; text: string }> = [];
      const fmHoursMap = new Map<string, number>();
      
      // 1) DAVACI metni
      const davaciText = generateWeeklyText(haftalikKarmaState.dayGroups, 'Davacı Beyanı');
      if (davaciText) {
        results.push(davaciText);
        fmHoursMap.set('Davacı', davaciText.weeklyFMHours);
      }
      
      // 2) Her TANIK için ayrı metin (DAVACI SAATLERİYLE KESİŞİM - GROUP INDEX BAZLI)
      if (haftalikKarmaState.witnesses && haftalikKarmaState.witnesses.length > 0) {
        const davaciGroups = haftalikKarmaState.dayGroups || [];
        
        haftalikKarmaState.witnesses.forEach((witness, idx) => {
          let witnessGroups =
            witness.dayGroups && witness.dayGroups.length > 0
              ? [...witness.dayGroups]
              : [...haftalikKarmaState.dayGroups];
          
          // GROUP INDEX BAZLI KESİŞİM: finalStart = max(davaci[g].start, tanik[g].start), finalEnd = min(davaci[g].end, tanik[g].end)
          witnessGroups = witnessGroups.map((group: any, groupIdx: number) => {
            const davaciGroup = davaciGroups[groupIdx];
            if (!davaciGroup?.startTime || !davaciGroup?.endTime) return group;
            const [tGirH, tGirM] = (group.startTime || '07:00').split(':').map(Number);
            const [tCikH, tCikM] = (group.endTime || '18:00').split(':').map(Number);
            const [dGirH, dGirM] = (davaciGroup.startTime || '07:00').split(':').map(Number);
            const [dCikH, dCikM] = (davaciGroup.endTime || '18:00').split(':').map(Number);
            const tGirMins = tGirH * 60 + tGirM;
            const tCikMins = tCikH * 60 + tCikM;
            const dGirMins = dGirH * 60 + dGirM;
            const dCikMins = dCikH * 60 + dCikM;
            const kesikGir = Math.max(tGirMins, dGirMins);
            const kesikCik = Math.min(tCikMins, dCikMins);
            const pad = (n: number) => String(n).padStart(2, '0');
            return {
              ...group,
              startTime: `${pad(Math.floor(kesikGir / 60))}:${pad(kesikGir % 60)}`,
              endTime: `${pad(Math.floor(kesikCik / 60))}:${pad(kesikCik % 60)}`
            };
          });
          
          const witnessText = generateWeeklyText(
            witnessGroups,
            `Tanık ${idx + 1} Beyanı`
          );
          if (witnessText) {
            results.push(witnessText);
            fmHoursMap.set(`Tanık ${idx + 1}`, witnessText.weeklyFMHours);
          }
        });
      }
      
      (window as any).__haftalikKarmaFMHours = fmHoursMap;
      
      return results;
    }
    
    // DONEMSEL: finalRows'tan metin hesaplaması oluştur (STANDART kontrolünden ÖNCE)
    if (calculationScenario === "DONEMSEL") {
      if (finalRows.length === 0) {
        return [];
      }
      
      console.log('🔍 [fmPeriods] DONEMSEL scenario - creating fmPeriods from finalRows:', finalRows.length);
      console.log('🔍 [fmPeriods] donemselState:', donemselState);
      console.log('🔍 [fmPeriods] donemselState.summerPattern:', donemselState.summerPattern);
      console.log('🔍 [fmPeriods] donemselState.winterPattern:', donemselState.winterPattern);
      
      // Yaz ve Kış pattern bilgilerini al
      const summerPattern = donemselState.summerPattern || { months: [4, 5, 6, 7, 8, 9], startTime: "07:00", endTime: "18:00" };
      const winterPattern = donemselState.winterPattern || { months: [1, 2, 3, 10, 11, 12], startTime: "08:00", endTime: "19:00" };
      
      console.log('🔍 [fmPeriods] AFTER DEFAULT - summerPattern:', summerPattern);
      console.log('🔍 [fmPeriods] AFTER DEFAULT - winterPattern:', winterPattern);
      
      // Ay isimlerini belirle - seçilen ayların tam listesi
      const getMonthNames = (months: number[]) => {
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const sorted = [...months].sort((a, b) => a - b);
        if (sorted.length === 0) return '';
        
        // Ardışık ayları grupla (örn: Nis-Eyl veya Oca-Mar, Eki-Ara)
        const groups: string[] = [];
        let start = sorted[0];
        let prev = sorted[0];
        
        for (let i = 1; i <= sorted.length; i++) {
          const current = sorted[i];
          // Ardışık değilse veya son eleman ise grubu kapat
          if (i === sorted.length || current !== prev + 1) {
            if (start === prev) {
              groups.push(monthNames[start - 1]);
            } else {
              groups.push(`${monthNames[start - 1]}-${monthNames[prev - 1]}`);
            }
            start = current;
          }
          prev = current;
        }
        
        return groups.join(', ');
      };
      
      // Çalışma saatlerini hesapla (toplam - ara dinlenme)
      const calculateWorkHours = (startTime: string, endTime: string) => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const totalHours = (endH * 60 + endM - startH * 60 - startM) / 60;
        
        // Ara dinlenme: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h (4857/68 + Yargıtay)
        let breakHours = 1;
        if (totalHours >= 15) breakHours = 3;
        else if (totalHours >= 14) breakHours = 2;
        else if (totalHours >= 11) breakHours = 1.5;
        
        const workHours = totalHours - breakHours;
        return { totalHours, workHours, breakHours };
      };
      
      const summerWork = calculateWorkHours(summerPattern.startTime, summerPattern.endTime);
      const winterWork = calculateWorkHours(winterPattern.startTime, winterPattern.endTime);
      
      // Tek bir metin oluştur (tüm dönemler için)
      console.log('🔍 [fmPeriods] Summer months:', summerPattern.months);
      console.log('🔍 [fmPeriods] Winter months:', winterPattern.months);
      const summerMonthNames = getMonthNames(summerPattern.months);
      const winterMonthNames = getMonthNames(winterPattern.months);
      console.log('🔍 [fmPeriods] Summer month names:', summerMonthNames);
      console.log('🔍 [fmPeriods] Winter month names:', winterMonthNames);
      
      // Her dönem için gün sayısı ve toplam saat hesapla
      // Her satırın içindeki günleri yaz/kış olarak ayır
      let summerTotalDays = 0;
      let winterTotalDays = 0;
      
      finalRows.forEach(row => {
        const startDate = new Date(row.startISO || '');
        const endDate = new Date(row.endISO || '');
        
        console.log(`🔍 [DAYS] Row: ${row.rangeLabel}, Start: ${row.startISO}, End: ${row.endISO}`);
        
        // Bu satırdaki her günü kontrol et - yaz mı kış mı
        let currentDate = new Date(startDate);
        let rowSummerDays = 0;
        let rowWinterDays = 0;
        
        while (currentDate <= endDate) {
          const currentMonth = currentDate.getMonth() + 1; // 1-12
          const isSummer = summerPattern.months.includes(currentMonth);
          
          if (isSummer) {
            summerTotalDays++;
            rowSummerDays++;
          } else {
            winterTotalDays++;
            rowWinterDays++;
          }
          
          // Bir sonraki güne geç
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log(`  → Summer days: ${rowSummerDays}, Winter days: ${rowWinterDays}`);
      });
      
      console.log(`🔍 [DAYS] TOTAL - Summer: ${summerTotalDays} days, Winter: ${winterTotalDays} days`);
      
      // Toplam gün ve hafta sayısı
      const totalDays = summerTotalDays + winterTotalDays;
      const totalWeeks = totalDays / 7;
      
      // Toplam saat hesabı
      const summerTotalHours = summerTotalDays * summerWork.workHours;
      const winterTotalHours = winterTotalDays * winterWork.workHours;
      const totalHours = summerTotalHours + winterTotalHours;
      
      // Haftalık ortalama
      const weeklyAverage = totalHours / totalWeeks;
      const weeklyFM = Math.max(0, weeklyAverage - 45);
      
      // Format helper
      const fmt = (n: number) => n.toFixed(2).replace('.', ',');
      
      // SABİT FORMAT - DİNAMİK VERİ
      let davacıText = '';
      
      if (Number(weeklyDays) === 7 && activeTab === 'tatilli') {
        // HAFTA TATİLLİ MODU - HAFTA TATİLİ FAZLA MESAİSİ DAHİL
        const haftaTatiliYasal = 7.5;
        
        // Yaz dönemi hafta tatili hesabı
        const summer6GunToplam = summerWork.workHours * 6;
        const summerHtFm = Math.max(0, summerWork.workHours - haftaTatiliYasal);
        const summer7GunToplam = summer6GunToplam + summerHtFm;
        const roundedSummer7 = Math.round(summer7GunToplam);
        const summerFmWith7Days = Math.max(0, roundedSummer7 - 45);
        
        // Kış dönemi hafta tatili hesabı
        const winter6GunToplam = winterWork.workHours * 6;
        const winterHtFm = Math.max(0, winterWork.workHours - haftaTatiliYasal);
        const winter7GunToplam = winter6GunToplam + winterHtFm;
        const roundedWinter7 = Math.round(winter7GunToplam);
        const winterFmWith7Days = Math.max(0, roundedWinter7 - 45);
        
        davacıText = `DAVACI:

Yaz : ${summerMonthNames} ${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(summerWork.totalHours)} saat çalışma ${fmt(summerWork.breakHours)} saat ara dinlenme = ${fmt(summerWork.workHours)} saat,
6 gün X ${fmt(summerWork.workHours)} saat = ${fmt(summer6GunToplam)} saat
Net haftalık çalışma = ${fmt(summer6GunToplam)} saat,
${fmt(summerWork.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(summerHtFm)} saat hafta tatili fazla mesai,
${fmt(summer6GunToplam)} saat + ${fmt(summerHtFm)} saat (hafta tatili) = ${fmt(summer7GunToplam)} saat
Net haftalık çalışma = ${roundedSummer7} saat,
${roundedSummer7} – 45 saat yasal haftalık çalışma = ${summerFmWith7Days} saat haftalık fazla mesai

Kış : ${winterMonthNames} ${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(winterWork.totalHours)} saat çalışma ${fmt(winterWork.breakHours)} saat ara dinlenme = ${fmt(winterWork.workHours)} saat,
6 gün X ${fmt(winterWork.workHours)} saat = ${fmt(winter6GunToplam)} saat
${fmt(winterWork.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(winterHtFm)} saat hafta tatili fazla mesai,
${fmt(winter6GunToplam)} saat + ${fmt(winterHtFm)} saat (hafta tatili) = ${fmt(winter7GunToplam)} saat
Net haftalık çalışma = ${roundedWinter7} saat,
${roundedWinter7} – 45 saat yasal haftalık çalışma = ${winterFmWith7Days} saat haftalık fazla mesai`;
      } else {
        // HAFTA TATİLSİZ MODU - STANDART (tek yerde yuvarlama)
        const summerWeeklyRaw = summerWork.workHours * Number(weeklyDays);
        const roundedSummerWeekly = Math.round(summerWeeklyRaw);
        const summerFmStandart = Math.max(0, roundedSummerWeekly - 45);
        const winterWeeklyRaw = winterWork.workHours * Number(weeklyDays);
        const roundedWinterWeekly = Math.round(winterWeeklyRaw);
        const winterFmStandart = Math.max(0, roundedWinterWeekly - 45);
        davacıText = `DAVACI:

Yaz : ${summerMonthNames} ${summerPattern.startTime} - ${summerPattern.endTime} = ${fmt(summerWork.totalHours)} saat çalışma ${fmt(summerWork.breakHours)} saat ara dinlenme = ${fmt(summerWork.workHours)} saat,
${weeklyDays} gün X ${fmt(summerWork.workHours)} saat = ${fmt(summerWeeklyRaw)} saat
Net haftalık çalışma = ${roundedSummerWeekly} saat,
${roundedSummerWeekly} – 45 saat yasal haftalık çalışma = ${summerFmStandart} saat haftalık fazla mesai

Kış : ${winterMonthNames} ${winterPattern.startTime} - ${winterPattern.endTime} = ${fmt(winterWork.totalHours)} saat çalışma ${fmt(winterWork.breakHours)} saat ara dinlenme = ${fmt(winterWork.workHours)} saat,
${weeklyDays} gün X ${fmt(winterWork.workHours)} saat = ${fmt(winterWeeklyRaw)} saat
Net haftalık çalışma = ${roundedWinterWeekly} saat,
${roundedWinterWeekly} – 45 saat yasal haftalık çalışma = ${winterFmStandart} saat haftalık fazla mesai`;
      }
      
      const results = [{
        label: 'Davacı Beyanı - Dönemsel Hesaplama',
        text: davacıText,
        weeklyFMHours: weeklyFM,
        startDate: finalRows[0]?.startISO || '',
        endDate: finalRows[finalRows.length - 1]?.endISO || '',
        startTime: '',
        endTime: '',
        weeks: 0,
        brut: 0,
        katsayi: 1.5,
        fm: 0,
        net: 0
      }];
      
      // Tanık beyanlarını ekle
      const witnessesSeasons = donemselState.witnessesSeasons || [];
      witnessesSeasons.forEach((witness: any, idx: number) => {
        if (!witness.dateIn || !witness.dateOut) return;
        
        // Tanığın kendi yaz/kış pattern'larını al
        const witnessSummerPattern = witness.summerPattern || { months: [6, 7, 8], startTime: "07:00", endTime: "18:00", days1: 6, days2: 0 };
        const witnessWinterPattern = witness.winterPattern || { months: [12, 1, 2], startTime: "08:00", endTime: "17:00", days1: 6, days2: 0 };
        
        // Tanığın ay isimlerini hesapla
        const witnessSummerMonthNames = getMonthNames(witnessSummerPattern.months);
        const witnessWinterMonthNames = getMonthNames(witnessWinterPattern.months);
        
        // Tanığın çalışma saatlerini hesapla - 2 SATIR SİSTEMİ
        const witnessSummerWork = calculateWorkHours(witnessSummerPattern.startTime, witnessSummerPattern.endTime);
        const witnessWinterWork = calculateWorkHours(witnessWinterPattern.startTime, witnessWinterPattern.endTime);
        
        // 2. satır çalışma saatleri (varsa)
        let witnessSummerWork2 = { totalHours: 0, breakHours: 0, workHours: 0 };
        let witnessWinterWork2 = { totalHours: 0, breakHours: 0, workHours: 0 };
        
        if (witnessSummerPattern.days2 && witnessSummerPattern.days2 > 0 && witnessSummerPattern.startTime2 && witnessSummerPattern.endTime2) {
          witnessSummerWork2 = calculateWorkHours(witnessSummerPattern.startTime2, witnessSummerPattern.endTime2);
        }
        
        if (witnessWinterPattern.days2 && witnessWinterPattern.days2 > 0 && witnessWinterPattern.startTime2 && witnessWinterPattern.endTime2) {
          witnessWinterWork2 = calculateWorkHours(witnessWinterPattern.startTime2, witnessWinterPattern.endTime2);
        }
        
        // Tanık için yaz/kış gün sayılarını hesapla
        let witnessSummerDays = 0;
        let witnessWinterDays = 0;
        
        const witnessStartDate = new Date(witness.dateIn);
        const witnessEndDate = new Date(witness.dateOut);
        let currentDate = new Date(witnessStartDate);
        
        while (currentDate <= witnessEndDate) {
          const currentMonth = currentDate.getMonth() + 1;
          const isSummer = witnessSummerPattern.months.includes(currentMonth);
          
          if (isSummer) {
            witnessSummerDays++;
          } else {
            witnessWinterDays++;
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Tanık için toplam hesaplama
        const witnessTotalDays = witnessSummerDays + witnessWinterDays;
        const witnessTotalWeeks = witnessTotalDays / 7;
        const witnessSummerHours = witnessSummerDays * witnessSummerWork.workHours;
        const witnessWinterHours = witnessWinterDays * witnessWinterWork.workHours;
        const witnessTotalHours = witnessSummerHours + witnessWinterHours;
        const witnessWeeklyAverage = witnessTotalHours / witnessTotalWeeks;
        const witnessWeeklyFM = Math.max(0, witnessWeeklyAverage - 45);
        
        // SABİT FORMAT - DİNAMİK VERİ (TANIĞIN KENDİ VERİLERİ)
        let witnessText = '';
        
        // YAZ DÖNEMİ HESAPLAMA
        const summerDays1 = witnessSummerPattern.days1 || 0;
        const summerDays2 = witnessSummerPattern.days2 || 0;
        const summerHasHoliday = witnessSummerPattern.hasWeeklyHoliday || false;
        const summerHolidayRow = witnessSummerPattern.weeklyHolidayRow || 2;
        
        let summerText = '';
        if (summerDays2 > 0 && witnessSummerPattern.startTime2 && witnessSummerPattern.endTime2) {
          // 2 SATIR SİSTEMİ
          let total1 = witnessSummerWork.workHours * summerDays1;
          let total2 = witnessSummerWork2.workHours * summerDays2;
          
          // Hafta tatili kontrolü
          let holidayText = '';
          if ((summerDays1 + summerDays2) === 7 && summerHasHoliday) {
            const haftaTatiliYasal = 7.5;
            if (summerHolidayRow === 1) {
              const normalDays1 = summerDays1 - 1;
              const holidayOvertime = Math.max(0, witnessSummerWork.workHours - haftaTatiliYasal);
              total1 = (witnessSummerWork.workHours * normalDays1) + holidayOvertime;
              holidayText = `\n${fmt(witnessSummerWork.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai (Grup 1'den)`;
            } else {
              const normalDays2 = summerDays2 - 1;
              const holidayOvertime = Math.max(0, witnessSummerWork2.workHours - haftaTatiliYasal);
              total2 = (witnessSummerWork2.workHours * normalDays2) + holidayOvertime;
              holidayText = `\n${fmt(witnessSummerWork2.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai (Grup 2'den)`;
            }
          }
          
          const weeklyTotal = total1 + total2;
          const roundedWeekly = Math.round(weeklyTotal);
          const fmHours = Math.max(0, roundedWeekly - 45);
          
          summerText = `Yaz : ${witnessSummerMonthNames}
${summerDays1} gün ${witnessSummerPattern.startTime} - ${witnessSummerPattern.endTime} = ${fmt(witnessSummerWork.totalHours)} saat çalışma ${fmt(witnessSummerWork.breakHours)} saat ara dinlenme = ${fmt(witnessSummerWork.workHours)} saat × ${summerDays1} gün = ${fmt(total1)} saat
${summerDays2} gün ${witnessSummerPattern.startTime2} - ${witnessSummerPattern.endTime2} = ${fmt(witnessSummerWork2.totalHours)} saat çalışma ${fmt(witnessSummerWork2.breakHours)} saat ara dinlenme = ${fmt(witnessSummerWork2.workHours)} saat × ${summerDays2} gün = ${fmt(total2)} saat${holidayText}
Net haftalık çalışma = ${roundedWeekly} saat,
${roundedWeekly} – 45 saat yasal haftalık çalışma = ${fmHours} saat haftalık fazla mesai`;
        } else {
          // TEK SATIR SİSTEMİ
          const weeklyTotal = witnessSummerWork.workHours * summerDays1;
          const roundedWeekly = Math.round(weeklyTotal);
          const fmHours = Math.max(0, roundedWeekly - 45);
          
          summerText = `Yaz : ${witnessSummerMonthNames} ${witnessSummerPattern.startTime} - ${witnessSummerPattern.endTime} = ${fmt(witnessSummerWork.totalHours)} saat çalışma ${fmt(witnessSummerWork.breakHours)} saat ara dinlenme = ${fmt(witnessSummerWork.workHours)} saat,
${summerDays1} gün X ${fmt(witnessSummerWork.workHours)} saat = ${fmt(weeklyTotal)} saat
Net haftalık çalışma = ${roundedWeekly} saat,
${roundedWeekly} – 45 saat yasal haftalık çalışma = ${fmHours} saat haftalık fazla mesai`;
        }
        
        // KIŞ DÖNEMİ HESAPLAMA
        const winterDays1 = witnessWinterPattern.days1 || 0;
        const winterDays2 = witnessWinterPattern.days2 || 0;
        const winterHasHoliday = witnessWinterPattern.hasWeeklyHoliday || false;
        const winterHolidayRow = witnessWinterPattern.weeklyHolidayRow || 2;
        
        let winterText = '';
        if (winterDays2 > 0 && witnessWinterPattern.startTime2 && witnessWinterPattern.endTime2) {
          // 2 SATIR SİSTEMİ
          let total1 = witnessWinterWork.workHours * winterDays1;
          let total2 = witnessWinterWork2.workHours * winterDays2;
          
          // Hafta tatili kontrolü
          let holidayText = '';
          if ((winterDays1 + winterDays2) === 7 && winterHasHoliday) {
            const haftaTatiliYasal = 7.5;
            if (winterHolidayRow === 1) {
              const normalDays1 = winterDays1 - 1;
              const holidayOvertime = Math.max(0, witnessWinterWork.workHours - haftaTatiliYasal);
              total1 = (witnessWinterWork.workHours * normalDays1) + holidayOvertime;
              holidayText = `\n${fmt(witnessWinterWork.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai (Grup 1'den)`;
            } else {
              const normalDays2 = winterDays2 - 1;
              const holidayOvertime = Math.max(0, witnessWinterWork2.workHours - haftaTatiliYasal);
              total2 = (witnessWinterWork2.workHours * normalDays2) + holidayOvertime;
              holidayText = `\n${fmt(witnessWinterWork2.workHours)} - ${fmt(haftaTatiliYasal)} saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai (Grup 2'den)`;
            }
          }
          
          const weeklyTotal = total1 + total2;
          const roundedWeekly = Math.round(weeklyTotal);
          const fmHours = Math.max(0, roundedWeekly - 45);
          
          winterText = `Kış : ${witnessWinterMonthNames}
${winterDays1} gün ${witnessWinterPattern.startTime} - ${witnessWinterPattern.endTime} = ${fmt(witnessWinterWork.totalHours)} saat çalışma ${fmt(witnessWinterWork.breakHours)} saat ara dinlenme = ${fmt(witnessWinterWork.workHours)} saat × ${winterDays1} gün = ${fmt(total1)} saat
${winterDays2} gün ${witnessWinterPattern.startTime2} - ${witnessWinterPattern.endTime2} = ${fmt(witnessWinterWork2.totalHours)} saat çalışma ${fmt(witnessWinterWork2.breakHours)} saat ara dinlenme = ${fmt(witnessWinterWork2.workHours)} saat × ${winterDays2} gün = ${fmt(total2)} saat${holidayText}
Net haftalık çalışma = ${roundedWeekly} saat,
${roundedWeekly} – 45 saat yasal haftalık çalışma = ${fmHours} saat haftalık fazla mesai`;
        } else {
          // TEK SATIR SİSTEMİ
          const weeklyTotal = witnessWinterWork.workHours * winterDays1;
          const roundedWeekly = Math.round(weeklyTotal);
          const fmHours = Math.max(0, roundedWeekly - 45);
          
          winterText = `Kış : ${witnessWinterMonthNames} ${witnessWinterPattern.startTime} - ${witnessWinterPattern.endTime} = ${fmt(witnessWinterWork.totalHours)} saat çalışma ${fmt(witnessWinterWork.breakHours)} saat ara dinlenme = ${fmt(witnessWinterWork.workHours)} saat,
${winterDays1} gün X ${fmt(witnessWinterWork.workHours)} saat = ${fmt(weeklyTotal)} saat
Net haftalık çalışma = ${roundedWeekly} saat,
${roundedWeekly} – 45 saat yasal haftalık çalışma = ${fmHours} saat haftalık fazla mesai`;
        }
        
        const witnessName = witness.name || `Tanık ${idx + 1}`;
        
        witnessText = `${witnessName.toUpperCase()}:

${summerText}

${winterText}`;
        
        results.push({
          label: `${witnessName} Beyanı - Dönemsel Hesaplama`,
          text: witnessText,
          weeklyFMHours: witnessWeeklyFM,
          startDate: witness.dateIn,
          endDate: witness.dateOut,
          startTime: '',
          endTime: '',
          weeks: 0,
          brut: 0,
          katsayi: 1.5,
          fm: 0,
          net: 0
        });
      });
      
      return results;
    }
    
    // DONEMSEL_HAFTALIK_KARMA: Henüz metin hesaplaması yok
    if (calculationScenario === "DONEMSEL_HAFTALIK_KARMA") {
      return [];
    }
    
    // STANDART: Mevcut logic (DEĞİŞTİRİLMEDİ)
    if (finalRows.length === 0) {
      return [];
    }
    
    // SCENARIO-AWARE: Sadece aktif scenario'nun verilerini kullan
    let dateIn = '';
    let dateOut = '';
    let timeIn = '';
    let timeOut = '';
    
    switch (calculationScenario) {
      case "STANDART":
        dateIn = standardState.davaci.dateIn;
        dateOut = standardState.davaci.dateOut;
        timeIn = standardState.davaci.in;
        timeOut = standardState.davaci.out;
        break;
      default:
        return [];
    }
    
    if (!dateIn || !dateOut || !timeIn || !timeOut) {
      return [];
    }
    
    const davaci = {
      startDate: dateIn,
      endDate: dateOut,
      startTime: timeIn,
      endTime: timeOut,
      haftalikGunSayisi: Number(weeklyDays) || 6
    };
    
    const witnesses = standardState.taniklar
      .filter(t => t.dateIn && t.dateOut && t.in && t.out)
      .map(t => ({
        dateIn: t.dateIn,
        dateOut: t.dateOut,
        in: t.in,
        out: t.out
      }));
    
    console.log('🔍 [fmPeriods] Witnesses found:', witnesses.length);
    console.log('🔍 [fmPeriods] finalRows count:', finalRows.length);
    console.log('🔍 [fmPeriods] witnessIntersectionFMRef:', witnessIntersectionFMRef.current);
    
    if (witnesses.length === 0) {
      console.log('❌ [fmPeriods] No witnesses - returning empty');
      return [];
    }
    
    // Kesişim hesapla
    const intervals = generateDynamicIntervalsFromWitnesses(davaci, witnesses);
    
    if (!intervals || intervals.length === 0) {
      return [];
    }
    
    // İlk interval'dan kesişen saatleri al
    const firstInterval = intervals[0];
    const intersectedIn = firstInterval.start_time || timeIn;
    const intersectedOut = firstInterval.end_time || timeOut;
    
    // Günlük brüt saat hesapla (KESİŞEN SAATLER)
    const [girH, girM] = intersectedIn.split(':').map(Number);
    const [cikH, cikM] = intersectedOut.split(':').map(Number);
    const girMinutes = girH * 60 + girM;
    const cikMinutes = cikH * 60 + cikM;
    const dailyMinutes = cikMinutes - girMinutes;
    const dailyBrut = dailyMinutes / 60;
    
    // Ara dinlenme: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h (4857/68 + Yargıtay)
    let breakHours = 1;
    if (dailyBrut >= 15) breakHours = 3;
    else if (dailyBrut >= 14) breakHours = 2;
    else if (dailyBrut >= 11) breakHours = 1.5;
    
    const dailyNet = Math.max(0, dailyBrut - breakHours);
    const workDays = Number(weeklyDays) || 6;
    
    // TEK KAYNAK: derivedRows'da hesaplanan FM saatini kullan
    const calculatedWeeklyFM = witnessIntersectionFMRef.current;
    
    // Her satır için metni oluştur
    return finalRows.map(row => {
      let text = '';
      
      // HAFTA TATİLLİ (weeklyDays = 7 VE activeTab = "tatilli")
      if (workDays === 7 && activeTab === 'tatilli') {
        // Hafta tatili HARİÇ günler: 6 gün × günlük_net
        const weeklyNormal = 6 * dailyNet;
        
        // Hafta tatili günü fazla çalışma: günlük_net - 7.5
        const holidayOvertime = Math.max(0, dailyNet - 7.5);
        
        // Toplam haftalık çalışma
        const weeklyTotal = weeklyNormal + holidayOvertime;
        
        // Haftalık fazla mesai (TEK KAYNAK'tan)
        const weeklyFMCalculated = calculatedWeeklyFM;
        
        text = `${intersectedIn} - ${intersectedOut} = ${dailyBrut.toFixed(2)} saat çalışma
- ${breakHours.toFixed(2)} saat ara dinlenme
= ${dailyNet.toFixed(2)} saat günlük çalışma
6 x ${dailyNet.toFixed(2)} = ${weeklyNormal.toFixed(2)} saat çalışma
${dailyNet.toFixed(2)} - 7,5 = ${holidayOvertime.toFixed(2)} saat hafta tatili fazla çalışma
= ${weeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${weeklyFMCalculated.toFixed(2)} saat haftalık fazla mesai`;
      } else {
        // HAFTA TATİLSİZ (weeklyDays < 7 VEYA activeTab = "tatilsiz")
        const weeklyTotal = dailyNet * workDays;
        
        text = `${intersectedIn} - ${intersectedOut} = ${dailyBrut.toFixed(2)} saat çalışma
- ${breakHours.toFixed(2)} saat ara dinlenme
= ${dailyNet.toFixed(2)} saat günlük çalışma
${workDays} x ${dailyNet.toFixed(2)} = ${weeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${calculatedWeeklyFM.toFixed(2)} saat haftalık fazla mesai`;
      }
      
      return {
        label: row.rangeLabel || '',
        text: text
      };
    });
  }, [finalRows, standardState.davaci, standardState.taniklar, weeklyDays, activeTab, calculationScenario, haftalikKarmaState.weeklyStartDateISO, haftalikKarmaState.weeklyEndDateISO, haftalikKarmaState.dayGroups, JSON.stringify(donemselState.summerPattern), JSON.stringify(donemselState.winterPattern)]);

  // YENİ RAPOR SİSTEMİ: Config (fmPeriods'tan SONRA tanımlanmalı)
  const bilirkisi1ReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // SGK ve İşsizlik Primi
    const sgkPrimi = Math.round(brutYillik * 0.14 * 100) / 100;
    const issizlikPrimi = Math.round(brutYillik * 0.01 * 100) / 100;
    
    // Mahsuplaşma hesabı
    const mahsuplasmaNum = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
    const hakkaniyetIndirimi = Number(brutYillik || 0) / 3;
    const mahsuplamaSonucu = Math.max(0, brutYillik - hakkaniyetIndirimi - mahsuplasmaNum);

    return {
      title: resolvedTitle,
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Haftada Çalışılan Gün", value: `${weeklyDays} gün` },
        { label: "Haftalık Çalışma Saati", value: `${(backendResult.weeklyOvertimeHours || haftalikMesai || 0).toFixed(2).replace('.', ',')} saat` },
      ],
      customSections: [
        ...(fmPeriods.length > 0 ? [
          {
            title: "Fazla Mesai Açıklama",
            condition: true,
            content: (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                background: '#f9fafb',
                border: '1px solid #999',
                padding: '8px',
                margin: '8px 0',
                borderRadius: '6px',
                minWidth: 0,
                width: '100%'
              }}>
                {fmPeriods.map((p, idx) => (
                  <pre key={idx} style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    minWidth: 0,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    padding: '8px',
                    margin: '0',
                    fontFamily: 'ui-monospace, monospace',
                    borderRadius: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {p.text}
                  </pre>
                ))}
              </div>
            ),
          },
        ] : []),
        ...((exclusions || []).length > 0 ? [
          {
            title: "Yıllık İzin Dışlamaları",
            condition: true,
            content: (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '9px', marginBottom: '12px' }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Tür</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Başlangıç</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bitiş</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Gün</th>
                  </tr>
                </thead>
                <tbody>
                  {(exclusions || []).map((ex: ExcludedDay) => (
                    <tr key={ex.id}>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.type || 'Yıllık İzin'}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.start ? new Date(ex.start).toLocaleDateString('tr-TR') : '-'}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.end ? new Date(ex.end).toLocaleDateString('tr-TR') : '-'}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{ex.days ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          },
        ] : []),
      ],
      periodData: {
        title: "Fazla Mesai Hesaplama Cetveli",
        headers: ["Dönem", "Hafta Sayısı", "Ücret (BRÜT)", "Katsayı", "FM Saati", "225", "1,5", "Fazla Mesai Ücreti"],
        columnWidths: ['22%', '9%', '14%', '8%', '9%', '7%', '7%', '14%'],
        rows: finalRows.map(row => [
          row.rangeLabel,
          row.weeks.toString(),
          `${fmtLocal(row.brut)}₺`,
          row.katsayi.toFixed(4),
          row.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          "225",
          "1,5",
          `${fmtLocal(row.fm)}₺`,
        ]),
        footer: [
          "Toplam Fazla Mesai:",
          "",
          "",
          "",
          "",
          "",
          "",
          `${fmtLocal(totalBrut)}₺`,
        ],
        alignRight: [1, 2, 3, 4, 5, 6, 7],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık Fazla Mesai Alacağı", value: `${fmtLocal(brutYillik)}₺` },
          { label: "SGK İşçi Primi (%14)", value: `-${fmtLocal(sgkPrimi)}₺`, isDeduction: true },
          { label: "İşsizlik Sigortası Primi (%1)", value: `-${fmtLocal(issizlikPrimi)}₺`, isDeduction: true },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net Yıllık Fazla Mesai Alacağı", value: `${fmtLocal(netYillik)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Net Yıllık Fazla Mesai Alacağı", value: `${fmtLocal(brutYillik)}₺` },
          { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtLocal(hakkaniyetIndirimi)}₺`, isDeduction: true },
          { label: "Mahsuplaşma Miktarı", value: `-${fmtLocal(mahsuplasmaNum)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmtLocal(mahsuplamaSonucu)}₺`,
        },
      },
    };
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, backendResult.weeklyOvertimeHours, haftalikMesai, fmPeriods, finalRows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari, exclusions]);

  // Bölüm bazlı Word tabloları (StandartIndependent / TanikliStandartIndependent ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (bilirkisi1ReportConfig.infoRows && bilirkisi1ReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: bilirkisi1ReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const fmTextVal = fmPeriods.length > 0
      ? fmPeriods.map(p => p.text).join("\n\n")
      : claimantTextCalculation || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
    if (fmTextVal) {
      const escaped = String(fmTextVal)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const html = `<table border="1" cellpadding="2" cellspacing="0"><tr><td><pre style="white-space:pre-wrap;margin:0;padding:8px;font-size:13px;word-break:break-word;">${escaped}</pre></td></tr></table><p>&nbsp;</p>`;
      sections.push({ id: "fazla-mesai-aciklama", title: "Fazla Mesai Açıklama", html });
    }

    if ((exclusions || []).length > 0) {
      const exclRows = (exclusions || []).map((ex: ExcludedDay) => [
        ex.type || "Yıllık İzin",
        ex.start ? new Date(ex.start).toLocaleDateString("tr-TR") : "-",
        ex.end ? new Date(ex.end).toLocaleDateString("tr-TR") : "-",
        String(ex.days ?? "-"),
      ]);
      const nExcl = adaptToWordTable({ headers: ["Tür", "Başlangıç", "Bitiş", "Gün"], rows: exclRows });
      sections.push({ id: "yillik-izin-dislamalari", title: "Yıllık İzin Dışlamaları", html: buildWordTable(nExcl.headers, nExcl.rows) });
    }

    const pd = bilirkisi1ReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer && pd.footer.length > 0) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = bilirkisi1ReportConfig.grossToNetData?.rows;
    if (gnd && gnd.length > 0) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = bilirkisi1ReportConfig.mahsuplasmaData;
    if (md && md.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [bilirkisi1ReportConfig, fmPeriods, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, claimantTextCalculation, exclusions]);
  
  // ESKİ KOD - Silindi
  /*
    const fmPeriods = useMemo(() => {
    try {
    ...
      const classic = computeClassic({
        davaci,
        witnesses: taniklar,
        weeklyDays: Number(weeklyDays) || 6,
        activeTab,
        exclusions,
        katSayi,
        zamanasimiBaslangic,
        include270,
        haftalikMesai,
        iseGiris,
        istenCikis,
      });

      const periods = classic.periods;
      const adjustedPeriods = periods; // 270 kuralı backend'de uygulanıyor

      if (!classic || !adjustedPeriods || adjustedPeriods.length === 0) {
        return [];
      }

      // computeClassic'ten gelen dönemleri label + text formatında döndür
      return adjustedPeriods.map(p => {
        const label = `${formatDateTRStr(p.startDate)} – ${formatDateTRStr(p.endDate)}`;
        return {
          label,
          text: `${label}:\n${p.text}`
        };
      });
    } catch {
      return [];
    }
  }, [rows]); // Backend'den gelen rows'a göre güncelle
  */

  // NOTE: computeClassic is only used for fmText display, NOT for table calculations
  // Table calculations are done via derivedRows → derivedRowsWithExclusions → finalRows
  // haftalikMesai is derived from derivedRows, not from computeClassic

  // Haftalık FM saatini DOM render sonrası span'dan 50ms gecikme ile oku ve fmHoursAuto'ya yaz
  useEffect(() => {
    const timeout = setTimeout(() => {
      const span = document.getElementById('haftalikFazlaMesai');
      if (span) {
        const raw = (span.textContent || '').trim().replace(',', '.');
        const value = parseFloat(raw);
        if (!isNaN(value)) {
          setFmHoursAuto(value);
        }
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [haftalikMesai]);

  // fmHoursAuto güncellenince formState useEffect ile otomatik güncellenecek

  const isReadOnly = isViewMode || isPrintMode;
  
  return (
    <>
    <Layout
      title={resolvedTitle}
      description={isViewMode ? "Rapor Görüntüleme" : isPrintMode ? "Yazdırma" : "Fazla Mesai Alacağı Hesaplama"}
      headerRight={
        <ReportPreviewButton
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-4 py-2 transition-colors flex items-center"
        />
      }
      hideHeader={true}
      fluid={true}
      pageKey="fazla-mesai"
      noBackgroundColor={true}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: '80px' }}>
          <div className="mb-8 flex justify-end">
            {videoLink && (
              <Button
                onClick={() => window.open(videoLink, "_blank")}
                variant="outline"
                size="sm"
                className="gap-2 rounded-full px-4 py-2.5 font-medium text-sm border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950 dark:text-red-400 transition-all"
              >
                <Youtube className="h-4 w-4" />
                Kullanım Videosu İzle
              </Button>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 md:p-8 space-y-4">
        <div className="w-full space-y-4">
        {/* Ana Form - Tam Sayfa */}
        <div className="space-y-4">
          {/* Üst Alan - Tarihler ve Beyanlar */}
          <div className="space-y-4 divide-y divide-gray-100 text-sm leading-tight" style={{ fontSize: '13px', lineHeight: '1.3' }}>
            <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
              <ReportPreviewButton
                title=""
                copyTargetId="rapor-icerik"
                buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
                hideButton={true}
                renderContent={() => (
                  <div id="rapor-icerik" style={{fontFamily:'Inter, Arial, sans-serif', color:'#111827'}}>
                    <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12}}>
                      <div style={{fontSize:18, fontWeight:700}}>{resolvedTitle} Hesaplama Cetveli</div>
                      <div style={{textAlign:'right', fontSize:12, color:'#374151'}}>
                        <div>Tarih: {new Date().toLocaleDateString('tr-TR')}</div>
                      </div>
                    </div>

                    {/* Özet Grid */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', border:'1px solid #d1d5db', borderRadius:6, padding:10, marginBottom:12, background:'#fafafa'}}>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Davacı</div><div style={{fontSize:13, fontWeight:600}}>-</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Davalı</div><div style={{fontSize:13, fontWeight:600}}>-</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Fazla Mesai</div><div style={{fontSize:13, fontWeight:600}}>{(backendResult.weeklyOvertimeHours || haftalikMesai || 0).toFixed(2).replace('.', ',')} saat</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>İşe Giriş</div><div style={{fontSize:13, fontWeight:600}}>{iseGiris || '-'}</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>İşten Çıkış</div><div style={{fontSize:13, fontWeight:600}}>{istenCikis || '-'}</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Gün</div><div style={{fontSize:13, fontWeight:600}}>{weeklyDays}</div></div>
                    </div>

                    {/* Beyanlar */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:12}}>
                      <div style={{border:'1px solid #e5e7eb', borderRadius:6}}>
                        <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Davacı Beyanı</div>
                        <div style={{padding:'10px', fontSize:12}}>
                          <div>-</div>
                        </div>
                      </div>
                    </div>

                    {/* Hesaplama Tablosu */}
                    <div id="calc-table" style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                      <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Fazla Mesai Hesaplama Tablosu</div>
                      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                        <thead style={{background:'#f9fafb'}}>
                          <tr>
                            <th style={{border:'1px solid #d1d5db', padding:'6px', textAlign:'left'}}>Tarih Aralığı</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>Hafta Sayısı</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>Ücret</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>Kat Sayı Çarpanı</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>Fazla Mesai Saati</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>225</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>1,5</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>Fazla Mesai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            let displayLabel = r.rangeLabel;
                            if (i === 0 && rows.length > 1 && rows[1].startISO) {
                              const nextStartDate = new Date(rows[1].startISO);
                              const adjustedEndDate = new Date(nextStartDate);
                              adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
                              const startFormatted = r.rangeLabel.split(' – ')[0];
                              const endFormatted = adjustedEndDate.toLocaleDateString('tr-TR');
                              displayLabel = `${startFormatted} – ${endFormatted}`;
                            }
                            return (
                            <tr key={`row-${i}-${r.startISO}-${r.endISO}-${r.fmHours}-${r.fm}`}>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'left'}}>{displayLabel}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.weeks}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.brut)}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.katsayi}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>225</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>1,5</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.fm)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                        {rows.length>0 && (
                          <tfoot>
                            <tr>
                              <td colSpan={7} style={{border:'1px solid #d1d5db', textAlign:'right', fontWeight:600, padding:'6px'}}>Toplam Fazla Mesai:</td>
                              <td style={{border:'1px solid #d1d5db', fontWeight:600, padding:'6px', textAlign:'right'}}>{fmt(totalBrut)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Brütten Nete Çevirme */}
                    {(() => {
                      const brutToplam = Number(totalBrut.toFixed(2));
                      const hakkaniyet = Number((brutToplam / 3).toFixed(2));
                      // Net hesaplamaya dahil edilmez: hakkaniyet ve mahsup sadece bilgilendirme
                      const ssk = Number((brutToplam * SSK_ORANI).toFixed(2));
                      const gelir = Number(
                        Math.max(0, brutToplam - ssk) * GELIR_VERGISI_ORANI
                      ).toFixed(2);
                      const gelirNum = Number(gelir);
                      const damga = Number(
                        (brutToplam * DAMGA_VERGISI_ORANI).toFixed(2)
                      );
                      const denge = 0;
                      const mahsup = 0;
                      const net = Number((brutToplam - (ssk + gelirNum + damga) - denge).toFixed(2));
                      const tr = (n:number)=> n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
                      return (
                        <div style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                          <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Brütten Nete Çevirme</div>
                          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                            <tbody>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Brüt Fazla Mesai</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(brutToplam)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>SSK Primi (15%)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(ssk)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Gelir Vergisi (15%)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(gelirNum)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Damga Vergisi (0,759%)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(damga)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Denge Vergisi</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(denge)}</td></tr>
                              <tr><td style={{border:'1px solid #d1d5db', padding:6, fontWeight:700}}>Net Fazla Mesai</td><td style={{border:'1px solid #d1d5db', padding:6, textAlign:'right', fontWeight:700}}>{tr(net)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>1/3 Hakkaniyet İndirimi (Bilgi)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(hakkaniyet)}</td></tr>
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Mahsuplaşma Miktarı (Bilgi)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(mahsup)}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {/* Yasal Uyarı */}
                    <div style={{fontSize:11, color:'#6b7280', textAlign:'right'}}>
                      Bu hesaplama yalnızca bilgilendirme amaçlıdır. Resmî belge değildir.
                    </div>
                  </div>
                )}
              />
            </div>
            {isViewMode && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                📄 Rapor görüntüleme modu - Bu sayfa sadece görüntüleme amaçlıdır.
              </div>
            )}
            {isPrintMode && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                🖨️ Yazdırma modu - Sayfa yazdırılmaya hazırlanıyor...
              </div>
            )}

          {/* Zamanaşımı Modal - React.memo ile optimize edilmiş component */}
          {showZamanaModal && (
            <ZamanasimiModalContent
              zForm={zForm}
              setZForm={setZForm}
              onApply={handleZamanasimiApply}
              onCancel={handleZamanasimiCancel}
              showToastError={showToastError}
              isReadOnly={isReadOnly}
              iseGiris={iseGiris || standardState.davaci?.dateIn || haftalikKarmaState.weeklyStartDateISO || undefined}
            />
          )}
            {/* ═══════════════════════════════════════════════════════════════════════════ */}
            {/* HESAPLAMA SENARYOSU SEÇİMİ - SADECE UI KONTROLÜ (HESABA ETKİSİ YOK) */}
            {/* ═══════════════════════════════════════════════════════════════════════════ */}
            <div className="rounded-md border-2 border-blue-300 bg-blue-50 p-4 mb-4" style={{ display: 'none' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm font-bold text-blue-900">📋 Hesaplama Senaryosu</div>
                <div className="text-xs text-blue-700 italic">(UI kontrolü - hesap motoruna etkisi yok)</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/standart/${effectiveId}` : '/fazla-mesai/bilirkisi-1/standart';
                    navigate(basePath);
                  }}
                  disabled={isReadOnly}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    calculationScenario === "STANDART"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold">STANDART</div>
                  <div className="text-xs mt-1 opacity-80">Tek giriş/çıkış</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/haftalik-karma/${effectiveId}` : '/fazla-mesai/bilirkisi-1/haftalik-karma';
                    navigate(basePath);
                  }}
                  disabled={isReadOnly}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    calculationScenario === "HAFTALIK_KARMA"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold">HAFTALIK KARMA</div>
                  <div className="text-xs mt-1 opacity-80">Haftalık desen</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/donemsel/${effectiveId}` : '/fazla-mesai/bilirkisi-1/donemsel';
                    navigate(basePath);
                  }}
                  disabled={isReadOnly}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    calculationScenario === "DONEMSEL"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold">DÖNEMSEL</div>
                  <div className="text-xs mt-1 opacity-80">Dönem listesi</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/donemsel-karma/${effectiveId}` : '/fazla-mesai/bilirkisi-1/donemsel-karma';
                    navigate(basePath);
                  }}
                  disabled={isReadOnly}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    calculationScenario === "DONEMSEL_HAFTALIK_KARMA"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold">DÖNEMSEL + KARMA</div>
                  <div className="text-xs mt-1 opacity-80">Dönem + desen</div>
                </button>
              </div>
              
              {!calculationScenario && (
                <div className="mt-3 text-xs text-blue-700 bg-blue-100 border border-blue-300 rounded px-3 py-2">
                  ⚠️ Lütfen bir senaryo seçin. Seçim yapılmadan beyan alanları kapalıdır.
                </div>
              )}
            </div>

            <div className="rounded-md border-[0.5px] border-gray-200 bg-[#e9ecef] px-3 py-1.5 text-xs font-semibold text-gray-800 leading-tight mb-2">Beyan Bilgileri</div>
            
            {/* Davacı Beyanı - Senaryo seçilmeden kapalı */}
            {calculationScenario ? (
              <details className="rounded-lg border border-gray-200" open>
                <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg leading-tight">Davacı Beyanı</summary>
              <div className="p-4 space-y-4">
                {/* STANDART: Sadece basit giriş */}
                {calculationScenario === "STANDART" && (
                  <div className="pb-4 border-b border-gray-200">
                    <div className="text-xs text-gray-600 mb-2 italic">Basit Giriş (Tek Dönem)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                      <input 
                        type="date" 
                        className="w-full rounded-md border-[0.5px] border-gray-200 px-2 py-1 text-xs leading-tight" 
                        value={standardState.davaci.dateIn || ''} 
                        max="9999-12-31"
                        onChange={(e)=>{
                          let value = e.target.value;
                          // Yıl validasyonu: maksimum 9999
                          if (value && value.length >= 4) {
                            const parts = value.split('-');
                            if (parts[0]) {
                              const year = parseInt(parts[0], 10);
                              if (year > 9999) {
                                // Yılı 9999'a sınırla
                                value = '9999-' + (parts[1] || '01') + '-' + (parts[2] || '01');
                                e.target.value = value;
                              } else if (parts[0].length > 4) {
                                // Yıl 5+ haneli ise 4 haneye kırp
                                value = parts[0].slice(0, 4) + '-' + (parts[1] || '01') + '-' + (parts[2] || '01');
                                e.target.value = value;
                              }
                            }
                          }
                          setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, dateIn: value } }));
                        }}
                        readOnly={isReadOnly} 
                      />
                    </div>
                    <div>
                      <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                      <input 
                        type="date" 
                        className="w-full rounded-md border-[0.5px] border-gray-200 px-2 py-1 text-xs leading-tight" 
                        value={standardState.davaci.dateOut || ''} 
                        max="9999-12-31"
                        onChange={(e)=>{
                          let value = e.target.value;
                          // Yıl validasyonu: maksimum 9999
                          if (value && value.length >= 4) {
                            const parts = value.split('-');
                            if (parts[0]) {
                              const year = parseInt(parts[0], 10);
                              if (year > 9999) {
                                // Yılı 9999'a sınırla
                                value = '9999-' + (parts[1] || '12') + '-' + (parts[2] || '31');
                                e.target.value = value;
                              } else if (parts[0].length > 4) {
                                // Yıl 5+ haneli ise 4 haneye kırp
                                value = parts[0].slice(0, 4) + '-' + (parts[1] || '12') + '-' + (parts[2] || '31');
                                e.target.value = value;
                              }
                            }
                          }
                          setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, dateOut: value } }));
                        }}
                        readOnly={isReadOnly} 
                      />
                    </div>
                    <div>
                      <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Saati</div>
                      <input 
                        type="time" 
                        className="w-full rounded-md border-[0.5px] border-gray-200 px-2 py-1 text-xs leading-tight" 
                        value={standardState.davaci.in} 
                        onChange={(e)=>{
                          setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, in: e.target.value } }));
                        }} 
                        readOnly={isReadOnly} 
                      />
                    </div>
                    <div>
                      <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Saati</div>
                      <input 
                        type="time" 
                        className="w-full rounded-md border-[0.5px] border-gray-200 px-2 py-1 text-xs leading-tight" 
                        value={standardState.davaci.out} 
                        onChange={(e)=>{
                          setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, out: e.target.value } }));
                        }} 
                        readOnly={isReadOnly} 
                      />
                    </div>
                  </div>
                  
                  {/* OTOMATIK HESAPLAMA - Buton yok, veri girilince otomatik hesaplanır */}
                  {isCalculating && (
                    <div className="flex justify-center mt-4">
                      <div className="text-sm text-blue-600 animate-pulse">
                        Hesaplanıyor...
                      </div>
                    </div>
                  )}
                  </div>
                )}

                {/* HAFTALIK_KARMA: BAĞIMSIZ HESAP - Manuel tablo oluşturma */}
                {calculationScenario === "HAFTALIK_KARMA" && (
                  <div className="space-y-4">
                    <div className="text-xs text-gray-600 italic">Haftalık Karma Hesaplama</div>
                    
                    {/* A) TARİH BLOĞU - ÜSTTE */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-900 mb-2">Tarih Aralığı</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">İşe Giriş Tarihi</label>
                          <input
                            type="date"
                            value={haftalikKarmaState.weeklyStartDateISO}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (value && value.includes('-')) {
                                const parts = value.split('-');
                                if (parts[0] && parts[0].length > 4) {
                                  parts[0] = parts[0].substring(0, 4);
                                  value = parts.join('-');
                                  e.target.value = value;
                                }
                              }
                              setHaftalikKarmaState(prev => ({ ...prev, weeklyStartDateISO: value }));
                            }}
                            max="9999-12-31"
                            disabled={isReadOnly}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">İşten Çıkış Tarihi</label>
                          <input
                            type="date"
                            value={haftalikKarmaState.weeklyEndDateISO}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (value && value.includes('-')) {
                                const parts = value.split('-');
                                if (parts[0] && parts[0].length > 4) {
                                  parts[0] = parts[0].substring(0, 4);
                                  value = parts.join('-');
                                  e.target.value = value;
                                }
                              }
                              setHaftalikKarmaState(prev => ({ ...prev, weeklyEndDateISO: value }));
                            }}
                            max="9999-12-31"
                            disabled={isReadOnly}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* B) GÜN GRUPLARI - SABİT 2 GRUP (B MODEL) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-700">Haftalık Çalışma Deseni (2 Grup)</label>
                        <div className="text-xs text-gray-600">
                          Toplam: <span className="font-semibold text-blue-600">
                            {haftalikKarmaState.dayGroups.reduce((sum, g) => sum + (g.dayCount || 0), 0)}
                          </span> gün
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {haftalikKarmaState.dayGroups.slice(0, 2).map((group, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded p-2">
                            <div className="text-xs font-semibold text-gray-700 w-16">Grup {idx + 1}</div>
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Gün Sayısı</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="7"
                                  value={group.dayCount}
                                  onChange={(e) => {
                                    const newGroups = [...haftalikKarmaState.dayGroups];
                                    newGroups[idx].dayCount = parseInt(e.target.value) || 0;
                                    setHaftalikKarmaState(prev => ({ ...prev, dayGroups: newGroups }));
                                  }}
                                  disabled={isReadOnly}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Başlangıç</label>
                                <input
                                  type="time"
                                  value={group.startTime}
                                  onChange={(e) => {
                                    const newGroups = [...haftalikKarmaState.dayGroups];
                                    newGroups[idx].startTime = e.target.value;
                                    setHaftalikKarmaState(prev => ({ ...prev, dayGroups: newGroups }));
                                  }}
                                  disabled={isReadOnly}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Bitiş</label>
                                <input
                                  type="time"
                                  value={group.endTime}
                                  onChange={(e) => {
                                    const newGroups = [...haftalikKarmaState.dayGroups];
                                    newGroups[idx].endTime = e.target.value;
                                    setHaftalikKarmaState(prev => ({ ...prev, dayGroups: newGroups }));
                                  }}
                                  disabled={isReadOnly}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* B MODEL: SABİT 2 GRUP - Ekle/Sil butonu YOK */}
                    </div>
                    
                  </div>
                )}

                {/* DONEMSEL: Yaz/Kış dönem girişi */}
                {calculationScenario === "DONEMSEL" && (
                  <div>
                    <div className="text-xs text-gray-600 mb-3 italic">Dönemsel Giriş (Yaz / Kış)</div>
                    <SeasonalWorkPatternEditor
                      summerPattern={donemselState.summerPattern || { months: [6, 7, 8], startTime: "07:00", endTime: "18:00" }}
                      winterPattern={donemselState.winterPattern || { months: [12, 1, 2], startTime: "08:00", endTime: "17:00" }}
                      onSummerUpdate={(pattern) => {
                        setDonemselState(prev => ({ ...prev, summerPattern: pattern }));
                      }}
                      onWinterUpdate={(pattern) => {
                        setDonemselState(prev => ({ ...prev, winterPattern: pattern }));
                      }}
                      dateIn={standardState.davaci.dateIn}
                      dateOut={standardState.davaci.dateOut}
                      onDateInChange={(date) => {
                        setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, dateIn: date } }));
                      }}
                      onDateOutChange={(date) => {
                        setStandardState(prev => ({ ...prev, davaci: { ...prev.davaci, dateOut: date } }));
                      }}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}

                {/* DONEMSEL_HAFTALIK_KARMA: Çoklu dönem beyan yönetimi (MIXED pattern allowed) */}
                {calculationScenario === "DONEMSEL_HAFTALIK_KARMA" && (
                  <div>
                    <div className="text-xs text-gray-600 mb-3 italic">Dönemsel + Haftalık Karma (Her dönem içinde karma desen)</div>
                    <DavaciDeclarationManager
                      declaration={donemselKarmaState.davaciDeclaration}
                      onUpdate={(updatedDeclaration) => {
                        setDonemselKarmaState(prev => ({ ...prev, davaciDeclaration: updatedDeclaration }));
                      }}
                      isReadOnly={isReadOnly}
                      scenario="DONEMSEL_HAFTALIK_KARMA"
                    />
                  </div>
                )}
              </div>
              </details>
            ) : (
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                🔒 Davacı Beyanı - Hesaplama senaryosu seçilmeden kapalıdır
              </div>
            )}

            {/* Tanık Beyanları - Senaryo seçilmeden kapalı */}
            {calculationScenario ? (
              <details className="rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg leading-tight">Tanık Beyanları</summary>
              <div className="p-4 space-y-4">
                {/* STANDART: Sadece basit giriş */}
                {calculationScenario === "STANDART" && (
                  <div className="pb-4 border-b border-gray-200">
                    <div className="text-xs text-gray-600 mb-2 italic">Basit Giriş (Tek Dönem)</div>
                  <div className="space-y-3">
                    {standardState.taniklar.map((t, idx) => (
                      <div key={t.id} className="border border-green-200 rounded-lg p-3 space-y-3 bg-green-50">
                        {/* Tanık adı ve sil butonu */}
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={(t as any).name || ''}
                            onChange={(e)=>{
                              setStandardState(prev => ({ 
                                ...prev, 
                                taniklar: prev.taniklar.map((r,i)=>i===idx?{...r, name:e.target.value}:r)
                              }));
                            }}
                            placeholder="Tanık adı"
                            className="text-sm font-semibold border-b-2 border-green-400 px-2 py-1 bg-transparent focus:outline-none focus:border-green-600"
                            readOnly={isReadOnly}
                          />
                          {!isReadOnly && idx > 0 && (
                            <button
                              type="button"
                              onClick={()=>{
                                setStandardState(prev => ({ 
                                  ...prev, 
                                  taniklar: prev.taniklar.filter((_,i)=>i!==idx)
                                }));
                              }}
                              className="text-xs text-red-600 hover:bg-red-100 px-2 py-1 border border-red-300 rounded"
                            >
                              🗑️ Kaldır
                            </button>
                          )}
                        </div>
                        
                        {/* Tarih alanları */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">İşe Giriş</label>
                            <input
                              type="date"
                              value={t.dateIn || ''}
                              onChange={(e)=>{
                                let value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    value = parts.join('-');
                                    e.target.value = value;
                                  }
                                }
                                setStandardState(prev => ({ 
                                  ...prev, 
                                  taniklar: prev.taniklar.map((r,i)=>i===idx?{...r,dateIn:value}:r)
                                }));
                              }}
                              max="9999-12-31"
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">İşten Çıkış</label>
                            <input
                              type="date"
                              value={t.dateOut || ''}
                              onChange={(e)=>{
                                let value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    value = parts.join('-');
                                    e.target.value = value;
                                  }
                                }
                                setStandardState(prev => ({ 
                                  ...prev, 
                                  taniklar: prev.taniklar.map((r,i)=>i===idx?{...r,dateOut:value}:r)
                                }));
                              }}
                              max="9999-12-31"
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                        
                        {/* Saat alanları */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Saati</label>
                            <input
                              type="time"
                              value={t.in}
                              onChange={(e)=>{
                                setStandardState(prev => ({ 
                                  ...prev, 
                                  taniklar: prev.taniklar.map((r,i)=>i===idx?{...r,in:e.target.value}:r)
                                }));
                              }}
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Saati</label>
                            <input
                              type="time"
                              value={t.out}
                              onChange={(e)=>{
                                setStandardState(prev => ({ 
                                  ...prev, 
                                  taniklar: prev.taniklar.map((r,i)=>i===idx?{...r,out:e.target.value}:r)
                                }));
                              }}
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button 
                      className="text-xs border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white rounded-md px-2 py-1" 
                      onClick={()=>{
                        setStandardState(prev => {
                          const nextId = prev.taniklar.reduce((m,x)=>Math.max(m,x.id),0)+1;
                          return {
                            ...prev,
                            taniklar: [...prev.taniklar, { id: nextId, in:"", out:"", dateIn:"", dateOut:"" }]
                          };
                        });
                      }}
                    >
                      + Tanık Ekle
                    </button>
                  </div>
                  </div>
                )}

                {/* HAFTALIK_KARMA: BAĞIMSIZ TANIK BEYANLARI */}
                {calculationScenario === "HAFTALIK_KARMA" && (
                  <div className="space-y-4">
                    <div className="text-xs text-gray-600 italic">Haftalık Karma - Tanık Beyanları</div>
                    
                    {haftalikKarmaState.witnesses.map((witness, idx) => (
                      <div key={witness.id} className="border border-green-200 rounded-lg p-3 space-y-3 bg-green-50">
                        {/* Tanık adı ve sil butonu */}
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={witness.name}
                            onChange={(e) => {
                              const newWitnesses = [...haftalikKarmaState.witnesses];
                              newWitnesses[idx].name = e.target.value;
                              setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                            }}
                            placeholder="Tanık adı"
                            className="text-sm font-semibold border-b-2 border-green-400 px-2 py-1 bg-transparent focus:outline-none focus:border-green-600"
                            readOnly={isReadOnly}
                          />
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setHaftalikKarmaState(prev => ({
                                  ...prev,
                                  witnesses: prev.witnesses.filter((_, i) => i !== idx)
                                }));
                              }}
                              className="text-xs text-red-600 hover:bg-red-100 px-2 py-1 border border-red-300 rounded"
                            >
                              🗑️ Kaldır
                            </button>
                          )}
                        </div>
                        
                        {/* Tarih alanları */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">İşe Giriş</label>
                            <input
                              type="date"
                              value={witness.startDateISO}
                              onChange={(e) => {
                                let value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    value = parts.join('-');
                                    e.target.value = value;
                                  }
                                }
                                const newWitnesses = [...haftalikKarmaState.witnesses];
                                newWitnesses[idx].startDateISO = value;
                                setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                              }}
                              max="9999-12-31"
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">İşten Çıkış</label>
                            <input
                              type="date"
                              value={witness.endDateISO}
                              onChange={(e) => {
                                let value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    value = parts.join('-');
                                    e.target.value = value;
                                  }
                                }
                                const newWitnesses = [...haftalikKarmaState.witnesses];
                                newWitnesses[idx].endDateISO = value;
                                setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                              }}
                              max="9999-12-31"
                              disabled={isReadOnly}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                        
                        {/* Gün grupları */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-700">Gün Grupları</label>
                            <span className="text-xs text-gray-600">
                              Toplam: <span className="font-semibold text-green-600">
                                {witness.dayGroups.reduce((sum, g) => sum + (g.days || 0), 0)}
                              </span> gün
                            </span>
                          </div>
                          <div className="space-y-1">
                            {witness.dayGroups.map((group, gIdx) => (
                              <div key={`${witness.id}-${gIdx}`} className="flex items-center gap-2 bg-white border border-gray-200 rounded p-2">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={group.days}
                                    onChange={(e) => {
                                      const newWitnesses = [...haftalikKarmaState.witnesses];
                                      newWitnesses[idx].dayGroups[gIdx].days = parseInt(e.target.value) || 0;
                                      setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                                    }}
                                    disabled={isReadOnly}
                                    placeholder="Gün"
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded disabled:bg-gray-100"
                                  />
                                  <input
                                    type="time"
                                    value={group.startTime}
                                    onChange={(e) => {
                                      const newWitnesses = [...haftalikKarmaState.witnesses];
                                      newWitnesses[idx].dayGroups[gIdx].startTime = e.target.value;
                                      setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded disabled:bg-gray-100"
                                  />
                                  <input
                                    type="time"
                                    value={group.endTime}
                                    onChange={(e) => {
                                      const newWitnesses = [...haftalikKarmaState.witnesses];
                                      newWitnesses[idx].dayGroups[gIdx].endTime = e.target.value;
                                      setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded disabled:bg-gray-100"
                                  />
                                </div>
                                {!isReadOnly && witness.dayGroups.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newWitnesses = [...haftalikKarmaState.witnesses];
                                      newWitnesses[idx].dayGroups = newWitnesses[idx].dayGroups.filter((_, i) => i !== gIdx);
                                      setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                                    }}
                                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-300 rounded"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                const newWitnesses = [...haftalikKarmaState.witnesses];
                                newWitnesses[idx].dayGroups.push({ days: 1, startTime: "09:00", endTime: "18:00" });
                                setHaftalikKarmaState(prev => ({ ...prev, witnesses: newWitnesses }));
                              }}
                              className="mt-1 w-full px-2 py-1 text-xs text-green-600 bg-white hover:bg-green-50 border border-green-300 rounded"
                            >
                              + Grup Ekle
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = haftalikKarmaState.witnesses.reduce((max, w) => Math.max(max, w.id), 0) + 1;
                          setHaftalikKarmaState(prev => ({
                            ...prev,
                            witnesses: [
                              ...prev.witnesses,
                              { 
                                id: nextId, 
                                name: `Tanık ${nextId}`, 
                                startDateISO: "", 
                                endDateISO: "", 
                                dayGroups: [{ days: 6, startTime: "09:00", endTime: "18:00" }] 
                              }
                            ]
                          }));
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 border border-green-300 rounded transition-colors"
                      >
                        + Tanık Ekle
                      </button>
                    )}
                  </div>
                )}

                {/* DONEMSEL: Yaz/Kış tanık beyanları */}
                {calculationScenario === "DONEMSEL" && (
                  <div>
                    <div className="text-xs text-gray-600 mb-3 italic">Dönemsel Giriş (Yaz / Kış) - Tanıklar</div>
                    <WitnessSeasonalEditor
                      witnesses={donemselState.witnessesSeasons || []}
                      onWitnessesUpdate={(witnesses) => {
                        setDonemselState(prev => ({ ...prev, witnessesSeasons: witnesses }));
                      }}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}

                {/* DONEMSEL_HAFTALIK_KARMA: Çoklu dönem tanık beyan yönetimi (MIXED pattern allowed) */}
                {calculationScenario === "DONEMSEL_HAFTALIK_KARMA" && (
                  <div>
                    <div className="text-xs text-gray-600 mb-3 italic">Dönemsel + Haftalık Karma (Her dönem içinde karma desen)</div>
                    <TanikDeclarationManager
                      declarations={donemselKarmaState.tanikDeclarations}
                      onUpdate={(updatedWitnesses) => {
                        setDonemselKarmaState(prev => ({ ...prev, tanikDeclarations: updatedWitnesses }));
                      }}
                      isReadOnly={isReadOnly}
                      scenario="DONEMSEL_HAFTALIK_KARMA"
                    />
                  </div>
                )}
              </div>
              </details>
            ) : (
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                🔒 Tanık Beyanları - Hesaplama senaryosu seçilmeden kapalıdır
              </div>
            )}


            {isCalculating && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="animate-spin h-4 w-4 text-[#0d6efd]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                Hesaplanıyor...
              </div>
            )}
          </div>

          {/* Orta Alan - Fazla Mesai Gösterimi */}
          <div className="soft-card" style={{ padding: '16px' }}>
            {/* Kırmızı uyarı metni */}
            <div className="text-sm text-red-600 font-medium mb-3">
              Hesaplamalar asgari ücret dönemlerine göre yapılmıştır
            </div>
            
            {/* Akordiyon - Metin Hesaplaması */}
            <details className="rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg hover:bg-gray-100 transition-colors flex items-center justify-between list-none leading-tight">
                <span>Metin Hesaplaması</span>
                <svg className="w-4 h-4 transition-transform duration-200 details-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <style>{`
                details[open] .details-arrow {
                  transform: rotate(180deg);
                }
                details summary::-webkit-details-marker {
                  display: none;
                }
                details summary::marker {
                  display: none;
                }
              `}</style>
              <div className="p-4">
                {Number(weeklyDays) === 7 ? (
                  <>
                    <div className="flex gap-2 text-sm mb-3">
                      <button type="button" onClick={()=>setActiveTab("tatilsiz")} className={`px-3 py-1.5 rounded-md border ${activeTab==='tatilsiz'?'bg-[#0d6efd] text-white':'bg-gray-100 text-gray-800'}`}>Hafta Tatilsiz</button>
                      <button type="button" onClick={()=>setActiveTab("tatilli")} className={`px-3 py-1.5 rounded-md border ${activeTab==='tatilli'?'bg-[#0d6efd] text-white':'bg-gray-100 text-gray-800'}`}>Hafta Tatilli</button>
                    </div>
                    <div className="bg-[#f1f3f5] border rounded-md p-3">
                      {fmPeriods.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {fmPeriods.map((p, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-white shadow-sm leading-relaxed whitespace-pre-line" style={{ fontFamily: 'Times New Roman, serif', fontSize: '10pt' }}>
                              {p.text}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700">
                          {activeTab === "tatilsiz" ? (txtTatilsiz || "Giriş/çıkış saatlerini giriniz.") : (txtTatilli || "Giriş/çıkış saatlerini giriniz.")}
                        </div>
                      )}
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#f1f3f5] border rounded-md p-3">
                      {fmPeriods.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {fmPeriods.map((p, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-white shadow-sm leading-relaxed whitespace-pre-line" style={{ fontFamily: 'Times New Roman, serif', fontSize: '10pt' }}>
                              {p.text}
                            </div>
                          ))}
                        </div>
                      ) : claimantTextCalculation ? (
                        <div className="bg-white p-4 rounded-md text-[13px] leading-relaxed text-gray-700 whitespace-pre-line border">
                          {claimantTextCalculation}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700">
                          {txtUnderSeven || "Giriş/çıkış saatlerini giriniz."}
                        </div>
                      )}
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>

          {/* HESAPLAMA KURALLARI - ZARİF BUTONLAR */}
          <div className="mt-5 mb-4 flex flex-wrap items-center gap-3 text-sm">
            {/* 270 SAAT DÜŞÜM - DROPDOWN BUTON */}
            <div className="relative">
              {/* Arka plan overlay - dropdown açıkken */}
              {/* Ana Buton */}
              <button
                type="button"
                onClick={() => setShow270Dropdown(!show270Dropdown)}
                className={`relative z-10 inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                  mode270 !== "none"
                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-transparent shadow-md hover:from-purple-600 hover:to-indigo-700"
                    : "bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600"
                }`}
              >
                {mode270 !== "none" && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span>
                  {mode270 === "none" && "270 Saat Düşüm"}
                  {mode270 === "detailed" && "270 Saat (Şirket)"}
                  {mode270 === "simple" && "270 Saat (Yargıtay)"}
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${show270Dropdown ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menü */}
              {show270Dropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden animate-in fade-in duration-200">
                  {/* Kapalı */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode270("none");
                      setInclude270(false);
                      setShow270Dropdown(false);
                      setHaftaDususBilgisi(null);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100 ${
                      mode270 === "none" ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        mode270 === "none" ? "border-purple-500 bg-purple-500" : "border-gray-300"
                      }`}>
                        {mode270 === "none" && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">Kapalı</div>
                        <div className="text-xs text-gray-500 mt-0.5">270 saat düşümü uygulanmaz</div>
                      </div>
                      {mode270 === "none" && (
                        <svg className="w-4 h-4 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Şirket Uygulaması */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode270("detailed");
                      setInclude270(true);
                      setShow270Dropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100 ${
                      mode270 === "detailed" ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        mode270 === "detailed" ? "border-purple-500 bg-purple-500" : "border-gray-300"
                      }`}>
                        {mode270 === "detailed" && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">Şirket Uygulaması</div>
                        <div className="text-xs text-gray-500 mt-0.5">İşe giriş yılı bazlı detaylı hesap</div>
                      </div>
                      {mode270 === "detailed" && (
                        <svg className="w-4 h-4 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Yargıtay Uygulaması */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode270("simple");
                      setInclude270(true);
                      setShow270Dropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors ${
                      mode270 === "simple" ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        mode270 === "simple" ? "border-purple-500 bg-purple-500" : "border-gray-300"
                      }`}>
                        {mode270 === "simple" && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">Yargıtay Uygulaması</div>
                        <div className="text-xs text-gray-500 mt-0.5">270 / 52 basit düşüm</div>
                      </div>
                      {mode270 === "simple" && (
                        <svg className="w-4 h-4 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ZAMANAŞIMI - ZARİF BUTON */}
            <button
              type="button"
              onClick={() => {
                prevZamanaRef.current = zamanasimiBaslangic ?? null;
                if (zamanasimiBaslangic) setZamanasimiBaslangic(null);
                setShowZamanaModal(true);
              }}
              className={`inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                zamanasimiBaslangic
                  ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-transparent shadow-md hover:from-blue-600 hover:to-cyan-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {zamanasimiBaslangic && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}</span>
            </button>

            {/* KATSAYI - ZARİF BUTON */}
            <button
              type="button"
              onClick={() => setShowKatsayiModal(true)}
              className={`inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                hasCustomKatsayi
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md hover:from-green-600 hover:to-emerald-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50 hover:text-green-600"
              }`}
            >
              {hasCustomKatsayi && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{hasCustomKatsayi ? "Katsayı" : "Kat Sayı Hesapla"}</span>
            </button>
          </div>

          {/* 270 Saat Bilgisi */}
          {include270 && haftaDususBilgisi !== null && (
            <div className="mt-2 text-xs text-gray-700 bg-blue-50 border-[0.5px] border-blue-100 rounded-md p-1.5 leading-tight">
              270 saatlik yasal sınır kapsamında her çalışma yılı için toplam <b>{haftaDususBilgisi}</b> hafta hesaplamadan çıkarılmıştır.
            </div>
          )}

          {/* Zamanaşımı Bilgisi */}
          {zamanasimiBaslangic && finalRows.length > 0 && (
            <div className="text-xs text-blue-600 mt-2 mb-2 leading-tight">
              Zamanaşımı başlangıç tarihi: {formatTR(normalizeLocalDate(zamanasimiBaslangic))} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
            </div>
          )}
          
          {/* Alt Alan - Dışlamalar (akordiyon panel) ve Tablo */}
          <div className="soft-card space-y-3" style={{ padding: '16px' }}>
            <YillikIzinDislamalariPanel
              exclusions={exclusions}
              setExclusions={setExclusions}
              success={success}
              showToastError={showToastError}
            />
            <div className="text-xs text-gray-600 -mb-1 flex items-center gap-1">
              <span className="cursor-help" title="Tablo işe giriş–çıkış tarihine göre yıl bazında otomatik oluşturulur. Yıl tamamlanmamışsa, aralık çıkış tarihiyle sınırlanır.">ℹ️</span>
              <span>Tablo yıl bazında otomatik oluşturulur.</span>
            </div>
            <div className="mt-2 mb-2 overflow-x-auto w-full" style={{ maxWidth: '100%' }}>
              <table className="w-full text-xs border-[0.5px] border-gray-300" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', lineHeight: '1.2' }}>
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '2%' }} />
                </colgroup>
                <thead className="bg-[#f8f9fa]" style={{ borderBottom: '2px solid #d0d0d0' }}>
                  <tr>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-left font-semibold text-xs leading-tight">Tarih Aralığı</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Hafta</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Ücret</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Kat Sayı <span className="text-gray-500" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">FM Saati <span className="text-gray-500" title="Hesaplanan haftalık fazla mesai saati; gerekirse satır bazlı düzenleyebilirsiniz.">ℹ️</span></th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">225</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">1,5</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Fazla Mesai</th>
                    <th className="border-0 bg-transparent w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {finalRows.length === 0 ? (
                    <tr>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight">—</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">0</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">{fmt(0)}</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          value="0,00"
                          readOnly
                          className="w-full max-w-20 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-xs bg-gray-50 leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">225</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1,5</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-medium text-xs leading-tight">{fmt(0)}</td>
                      <td className="border-0 bg-transparent w-16"></td>
                    </tr>
                  ) : (
                    finalRows.map((r, i) => (
                    <tr 
                      key={r.id || `row-${i}`} 
                      className="hover:bg-gray-50"
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight">
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={r.startISO}
                            onChange={(e) => {
                              const updated = [...finalRows];
                              updated[i] = { ...updated[i], startISO: e.target.value };
                              // Update rangeLabel
                              const startFormatted = formatDateTRStr(e.target.value);
                              const endFormatted = formatDateTRStr(updated[i].endISO);
                              updated[i].rangeLabel = `${startFormatted} – ${endFormatted}`;
                              setFinalRows(updated);
                            }}
                            className="w-24 text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight"
                          />
                          <span>–</span>
                          <input
                            type="date"
                            value={r.endISO}
                            onChange={(e) => {
                              const updated = [...finalRows];
                              updated[i] = { ...updated[i], endISO: e.target.value };
                              // Update rangeLabel
                              const startFormatted = formatDateTRStr(updated[i].startISO);
                              const endFormatted = formatDateTRStr(e.target.value);
                              updated[i].rangeLabel = `${startFormatted} – ${endFormatted}`;
                              setFinalRows(updated);
                            }}
                            className="w-24 text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight"
                          />
                        </div>
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        {r.manual ? (
                          <input
                            type="number"
                            step="0.01"
                            value={r.weeks || ''}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              const updated = [...finalRows];
                              updated[i] = { ...updated[i], weeks: v };
                              // Recalculate FM
                              const newFm = updated[i].fmHours * v * updated[i].brut * updated[i].katsayi / 225 * 1.5;
                              updated[i].fm = newFm;
                              setFinalRows(updated);
                            }}
                            className="w-14 text-right text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          r.weeks
                        )}
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          type="number"
                          step="0.01"
                          value={r.brut || ''}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            const updated = [...finalRows];
                            updated[i] = { ...updated[i], brut: v };
                            // Recalculate FM
                            const newFm = updated[i].fmHours * updated[i].weeks * v * updated[i].katsayi / 225 * 1.5;
                            updated[i].fm = newFm;
                            setFinalRows(updated);
                          }}
                          placeholder={(() => {
                            const au = asgariUcretler.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
                            return String(au.brut);
                          })()}
                          className="w-full max-w-32 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-xs leading-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                        <input
                          type="text"
                          value={Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          onChange={(e) => {
                            const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')) || 0;
                            const updated = [...finalRows];
                            updated[i] = { ...updated[i], katsayi: v };
                            // Recalculate FM
                            const newFm = updated[i].fmHours * updated[i].weeks * updated[i].brut * v / 225 * 1.5;
                            updated[i].fm = newFm;
                            setFinalRows(updated);
                          }}
                          className="w-full max-w-20 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-xs leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          type="number"
                          step="0.01"
                          value={r.fmHours !== undefined && r.fmHours !== null ? Number(r.fmHours.toFixed(1)) : 0}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            const updated = [...finalRows];
                            updated[i] = { ...updated[i], fmHours: Math.max(0, v) };
                            // Recalculate FM
                            const newFm = Math.max(0, v) * updated[i].weeks * updated[i].brut * updated[i].katsayi / 225 * 1.5;
                            updated[i].fm = newFm;
                            setFinalRows(updated);
                          }}
                          className="w-full max-w-20 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-xs leading-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">225</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1,5</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-medium text-xs leading-tight">{fmt(r.fm)}</td>
                      {/* Satır çoğaltma ve silme butonları - tablonun sağında */}
                      <td className="border-0 bg-transparent w-16 p-0">
                        {hoveredRow === i && (
                          <div className="flex gap-1 justify-center items-center">
                            <span
                              className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer text-lg leading-none"
                              onClick={() => duplicateRow(i)}
                              title="Altına yeni bir satır ekle"
                            >
                              +
                            </span>
                            <span
                              className="row-delete-icon text-red-500 hover:text-red-600 cursor-pointer text-lg leading-none"
                              onClick={() => {
                                if (finalRows.length <= 1) return;
                                deleteRow(i);
                              }}
                              style={{ opacity: finalRows.length <= 1 ? 0.3 : 1, cursor: finalRows.length <= 1 ? 'not-allowed' : 'pointer' }}
                              title={finalRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                            >
                              −
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                  {finalRows.length > 0 && (
                    <tr style={{ borderTop: '1px solid #999' }} className="bg-[#f1f3f5]">
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 font-semibold text-xs leading-tight">Toplam Fazla Mesai:</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">{fmt(totalBrut)}</td>
                      <td className="border-0 bg-transparent w-16"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Zamanaşımı bilgi notu */}
            {!zamanasimiBaslangic && zamanasimi?.nihaiBaslangic && (
              <div className="mt-2 text-xs text-gray-700 bg-yellow-50 border border-yellow-100 rounded-md p-2">
                Zamanaşımı başlangıç tarihi: <b>{formatTR(normalizeLocalDate(zamanasimi.nihaiBaslangic))}</b> — önceki dönemler hesaba dahil edilmemiştir.
              </div>
            )}

            
          </div>

          {/* İki Ayrı Kart: Solda Brütten Nete, Sağda Mahsuplaşma */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kart 1: Brütten Nete Çevir - ZARİF */}
            <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 md:col-span-2">
              <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
                Brütten Nete Çevir
              </h3>
              <label className="block font-medium text-gray-700 dark:text-gray-300 mb-2 text-sm">Brüt Fazla Mesai</label>
              <input
                type="text"
                placeholder="Örn: 25.000,00₺"
                value={brut > 0 ? String(brut).replace('.', ',') : ''}
                onChange={(e) => {
                  const cursorPos = e.target.selectionStart;
                  const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                  setBrut(v);
                  setTimeout(() => {
                    if (e.target) e.target.setSelectionRange(cursorPos, cursorPos);
                  }, 0);
                }}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 mb-4"
              />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                  <span className="text-gray-700 dark:text-gray-300">Brüt Fazla Mesai</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutYillik)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                  <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(Math.round(brutYillik * 0.14 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                  <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(Math.round(brutYillik * 0.01 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                  <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(gelirVergisi)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                  <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)}</span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net Fazla Mesai</span>
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(netYillik)}</span>
                </div>
              </div>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-4 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">Tablodaki brüt fazla mesai toplamının nete çevrimi</p>
            </div>

            {/* Kart 2: Mahsuplaşma */}
            <Card className="md:col-span-1">
              <CardContent className="space-y-6 pt-6">
                {/* Hakkaniyet İndirimi Bölümü */}
                <div>
                  <h3 className="text-base font-bold text-pink-900 dark:text-pink-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Hakkaniyet İndirimi
                  </h3>
                  <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    1/3 Hakkaniyet İndirimi
                  </Label>
                  <Input
                    type="text"
                    value={`${(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ₺`}
                    disabled
                    className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Toplam Fazla Mesai ({brutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) − 1/3 Hakkaniyet İndirimi ({(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) =
                    <span className="ml-1 font-semibold">{(brutYillik - (Number(brutYillik || 0) / 3)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </p>
                </div>
                
                {/* Mahsuplaşma Bölümü */}
                <div>
                  <h3 className="text-base font-bold text-pink-900 dark:text-pink-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Mahsuplaşma
                  </h3>
                  <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mahsuplaşma Miktarı
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      value={(() => {
                        const num = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                        return num > 0 ? `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '';
                      })()}
                      onChange={(e) => {
                        const v = String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim();
                        setMahsuplasmaMiktari(v);
                      }}
                      placeholder="0,00 ₺"
                      className="flex-1 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      style={{ minWidth: '140px' }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMahsuplasamaModal(true)}
                      className="text-xs flex-shrink-0 whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Mahsuplaşma </span>Ekle
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Notlar - En Alta */}
        <div className="mt-6">
          <NoteCard isReadOnly={isReadOnly} />
        </div>
      </div>

      {/* Kat Sayı Hesapla Modal */}
      <KatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      {/* Mahsuplaşma Modal */}
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={finalRows.map((r) => {
          let period = r.rangeLabel || "";
          if (period) {
            period = period.replace(/[–—]/g, "-");
            period = period.replace(/(\d{2})\/(\d{2})\/(\d{4})/g, "$1.$2.$3");
            period = period.replace(/\s*-\s*/g, " - ");
            period = period.trim();
          }
          
          return {
            period: period,
            weekCount: r.weeks,
            wage: r.brut,
            coefficient: r.katsayi,
            dailyWage: 0,
            haftaTatiliDays: 0,
            haftaTatiliTotal: 0,
          };
        })}
        onSave={(total, data) => {
          setMahsuplasmaMiktari(String(total));
          setMahsuplasamaData(data);
        }}
      />

      {/* PDF için gizli rapor içeriği */}
      {USE_NEW_BILIRKISI1_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={bilirkisi1ReportConfig} />
        </div>
      )}
      
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : (
          // KAYDET: Hesaplama yoksa
          finalRows.length === 0 ? "Kaydet" :
          // GÜNCELLE: Hesaplama var VE (kayıtlı dosya VAR VEYA kayıtlı dosyadan yüklendi)
          (effectiveId || loadRanRef.current) ? "Güncelle" :
          // KAYDET: Hesaplama var ama ilk kez kaydediliyor
          "Kaydet"
        )}
        previewButton={{
          title: `${resolvedTitle} Rapor`,
          copyTargetId: "donemsel-haftalik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #donemsel-haftalik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #donemsel-haftalik-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="donemsel-haftalik-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button
                        type="button"
                        className="copy-icon-btn"
                        onClick={() => copySectionForWord(sec.id)}
                        title="Word'e kopyala"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(`${resolvedTitle} Rapor`, "report-content"),
        }}
      />
    </div>
    </div>
    </div>
    </div>
    </Layout>
    {KaydetModal ? <KaydetModal /> : null}
    <Toaster />
  </>
  );
}
