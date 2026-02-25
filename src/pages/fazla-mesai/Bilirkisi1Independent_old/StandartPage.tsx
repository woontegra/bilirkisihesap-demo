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
import { asgariUcretler, getAsgariUcretByDate } from "./localUtils/asgariUcretler";
import { generateDynamicIntervalsFromWitnesses, calculateOvertimeHours } from "./localUtils/intervalHelper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Youtube } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";
import KatsayiModal from "./KatsayiModal";
import MahsuplasamaModal from "./MahsuplasamaModal";
import { getAsgariUcretPeriods } from "./localConstants/asgariUcretPeriods";
import { calculateOvertimeTable } from "./localUtils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "./localUtils/overtimeCalculator";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "./localUtils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays } from "date-fns";
import { getScopedStorageKey } from "./localUtils/storageKey";
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

// YENİ RAPOR SİSTEMİ
import { BaseReportModal, type ReportConfig } from "@/components/report";
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
// LOGIC: Sum annual leave days in the period → divide by 6 → round → deduct from weeks
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
    
    // Calculate week deduction: days / 6, then round
    const weeksToDeduct = Math.round(totalAnnualLeaveDays / 6);
    
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
}: {
  zForm: { dava: string; bas: string; bit: string };
  setZForm: React.Dispatch<React.SetStateAction<{ dava: string; bas: string; bit: string }>>;
  onApply: () => void;
  onCancel: () => void;
  showToastError: (msg: string) => void;
  isReadOnly?: boolean;
}) {
  // Hesaplamaları useMemo ile optimize et
  const hesaplama = useMemo(() => {
    const dava = zForm.dava ? toUTC(zForm.dava) : null;
    const bas = zForm.bas ? toUTC(zForm.bas) : null;
    const bit = zForm.bit ? toUTC(zForm.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : null;
    const limit = dava ? subYears(dava, 5) : null;
    
    // Pandemi dönemi: 13 Mart 2020 - 15 Haziran 2020 (+94 gün)
    const pandemiBaslangic = new Date('2020-03-13');
    const pandemiBitis = new Date('2020-06-15');
    const pandemiGun = 94;
    
    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    let pandemiEklendi = false;
    
    // ✅ FIX: Pandemi kontrolü iseGiris bazlı (nihai değil)
    // İşe giriş tarihi pandemi döneminden önce ise 94 gün ekle
    if (nihai && bas && bas < pandemiBaslangic) {
      nihai = subDays(nihai, pandemiGun);
      pandemiEklendi = true;
    }
    
    return { dava, bas, bit, gun, limit, nihai, pandemiEklendi };
  }, [zForm.dava, zForm.bas, zForm.bit]);

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
              Zamanaşımı süresi {hesaplama.pandemiEklendi ? "(5 yıl + 94 gün)" : "(5 yıl)"}: <b>{hesaplama.limit ? format(hesaplama.limit, "dd.MM.yyyy") : "-"}</b>
            </div>
            <div>
              Arabuluculuk süresi: <b>{hesaplama.gun != null ? `${hesaplama.gun} gün` : "-"}</b>
            </div>
            {hesaplama.pandemiEklendi && (
              <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fbbf24' }}>
                <b>Pandemi Dönemi:</b> 13 Mart 2020 - 15 Haziran 2020 arası pandemi hak kaybı süresi nedeniyle +94 gün eklendi.
              </div>
            )}
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

export default function FazlaMesaiBilirkisi1Page({ titleOverride }: Props) {
  return (
    <ToastProvider>
      <FazlaMesaiBilirkisi1PageContent titleOverride={titleOverride} />
    </ToastProvider>
  );
}

function FazlaMesaiBilirkisi1PageContent({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving, KaydetModal } = useKaydet({ success, error: showToastError });
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-bilirkisi-1");
  
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
    calcSeq,
  } = useFazlaMesaiBilirkisi1State();
  
  // STANDART PAGE - Scenario is hardcoded to STANDART
  useEffect(() => {
    setCalculationScenario('STANDART');
  }, [setCalculationScenario]);
  
  // Page title
  const pageTitle = useMemo(() => {
    const p = path.toLowerCase();
    if (p.includes("bilirkisi1") || p.includes("bilirkişi1") || p.includes("bilirkisi-1")) return "Bilirkişiler İçin - 1 Fazla Mesai Hesaplama";
    if (p.includes("bilirkisi2") || p.includes("bilirkişi2") || p.includes("bilirkisi-2")) return "Bilirkişiler İçin - 2 Fazla Mesai Hesaplama";
    return "Standart Fazla Mesai";
  }, [path]);
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
  
  // Zamanaşımı modal callback'leri
  const handleZamanasimiApply = useCallback(() => {
    try {
      const basUTC = zForm.bas ? toUTC(zForm.bas) : null;
      const bitUTC = zForm.bit ? toUTC(zForm.bit) : null;
      const arabuluculukGun = (basUTC && bitUTC) ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1) : 0;
      const davaUTC = zForm.dava ? toUTC(zForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      let nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;
      
      // Pandemi dönemi kontrolü: 13 Mart 2020 - 15 Haziran 2020 (+94 gün)
      const pandemiBitis = new Date('2020-06-15');
      const pandemiGun = 94;
      
      if (nihai && nihai <= pandemiBitis) {
        nihai = subDays(nihai, pandemiGun);
      }
      
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
  }, [zForm, setZamanasimi, setZamanasimiBaslangic, setShowZamanaModal]);
  
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
    [setCaseData, setCurrentRecordName, setIseGiris, setIstenCikis, setGir, setCik, setNotes, setWeeklyDays, setDavaci, setTaniklar, setExclusions, setInclude270, setZamanasimi, setZamanasimiBaslangic, setKatSayi, setHasCustomKatsayi, setMahsuplasmaMiktari, setMahsuplasamaData, isViewMode, isPrintMode, success, showToastError]
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

  // ACTIVE ROWS - STANDART PAGE: Always use standartFinalRows
  const activeRows = useMemo(() => {
    console.log('🔍 [STANDART PAGE] standartFinalRows.length:', standartFinalRows.length);
    return standartFinalRows;
  }, [standartFinalRows]);

  // finalRows alias for backward compatibility
  const finalRows = activeRows;
  
  // ═══════════════════════════════════════════════════════════
  // SCENARIO HOOKS - Her senaryo kendi dosyasında
  // ═══════════════════════════════════════════════════════════
  
  // STANDART HESAPLAMA - ESKİ DOSYA MANTIĞI
  const derivedRows = useMemo(() => {
    const dateIn = standardState.davaci.dateIn;
    const dateOut = standardState.davaci.dateOut;
    const timeIn = standardState.davaci.in;
    const timeOut = standardState.davaci.out;
    
    if (!dateIn || !dateOut || !timeIn || !timeOut) {
      console.log('[CALC] Eksik davacı verisi');
      return [];
    }

    // 1) DAVACI VE TANIKLARI HAZIRLA
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

    console.log('[CALC] Davacı objesi:', davaci);
    
    // 2) TANIK OVERLAP SPLIT - Uzun tanıkları parçala
    const splitWitnesses: any[] = [];
    
    const sortedWitnesses = [...witnesses].sort((a, b) => 
      new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime()
    );
    
    sortedWitnesses.forEach((witness, idx) => {
      const wStart = new Date(witness.dateIn);
      const wEnd = new Date(witness.dateOut);
      
      const overlappingWitnesses = sortedWitnesses.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const oStart = new Date(other.dateIn);
        const oEnd = new Date(other.dateOut);
        return oStart > wStart && oStart < wEnd;
      });
      
      if (overlappingWitnesses.length === 0) {
        splitWitnesses.push(witness);
      } else {
        let currentStart = wStart;
        
        const sortedOverlaps = overlappingWitnesses.sort((a, b) => 
          new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime()
        );
        
        sortedOverlaps.forEach(overlap => {
          const overlapStart = new Date(overlap.dateIn);
          const overlapEnd = new Date(overlap.dateOut);
          
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
          
          const nextStart = new Date(overlapEnd);
          nextStart.setDate(nextStart.getDate() + 1);
          currentStart = nextStart;
        });
        
        if (currentStart <= wEnd) {
          splitWitnesses.push({
            ...witness,
            dateIn: currentStart.toISOString().split('T')[0],
            dateOut: wEnd.toISOString().split('T')[0]
          });
        }
      }
    });
    
    console.log('[CALC] Split edilmiş tanıklar:', splitWitnesses.length);
    splitWitnesses.forEach((w: any, idx: number) => {
      console.log(`  Tanık ${idx}: ${w.dateIn} → ${w.dateOut} | ${w.in} - ${w.out}`);
    });
    
    // 3) generateDynamicIntervalsFromWitnesses ile birleşik aralıkları al
    let intervals = generateDynamicIntervalsFromWitnesses(davaci, splitWitnesses);
    
    console.log('[CALC] Intervals:', intervals.length);
    intervals.forEach((int: any, idx: number) => {
      console.log(`  Interval ${idx}: ${int.start} → ${int.end} | ${int.start_time} - ${int.end_time}`);
    });
    
    if (!intervals || intervals.length === 0) {
      console.log('[CALC] Intervals boş, davacı tarihleriyle devam ediliyor');
      intervals = [{
        start: dateIn,
        end: dateOut,
        start_time: timeIn,
        end_time: timeOut
      }];
    }
    
    // 3) HER INTERVAL İÇİN ASGARI ÜCRET DÖNEMLERİNE BÖL VE SATIR OLUŞTUR
    let generatedRows: any[] = [];
    
    intervals.forEach((interval: any, intervalIdx: number) => {
      const intervalStart = new Date(interval.start);
      const intervalEnd = new Date(interval.end);
      
      // FM hesapla (interval'dan gelen saatlerle) - HER INTERVAL İÇİN AYRI
      const intervalTimeIn = interval.start_time || timeIn;
      const intervalTimeOut = interval.end_time || timeOut;
      
      const [girH, girM] = intervalTimeIn.split(':').map(Number);
      const [cikH, cikM] = intervalTimeOut.split(':').map(Number);
      const girMinutes = girH * 60 + girM;
      const cikMinutes = cikH * 60 + cikM;
      const dailyMinutes = cikMinutes - girMinutes;
      const dailyBrut = dailyMinutes / 60;
      
      let breakHours = 1;
      if (dailyBrut >= 11) breakHours = 1.5;
      if (dailyBrut >= 14) breakHours = 2;
      
      const dailyNet = Math.max(0, dailyBrut - breakHours);
      const workDays = Number(weeklyDays) || 6;
      
      let fmHours = 0;
      if (workDays === 7 && activeTab === 'tatilli') {
        const weeklyNormal = 6 * dailyNet;
        const holidayOvertime = Math.max(0, dailyNet - 7.5);
        const weeklyTotal = weeklyNormal + holidayOvertime;
        fmHours = Math.max(0, weeklyTotal - 45);
      } else {
        const weeklyTotal = dailyNet * workDays;
        fmHours = Math.max(0, weeklyTotal - 45);
      }
      
      // İlk interval'ın FM saatini kaydet (metin hesaplama için)
      if (intervalIdx === 0) {
        witnessIntersectionFMRef.current = fmHours;
      }
      
      // Bu interval için asgari ücret dönemlerine böl
      const asgariUcretPeriods = splitByAsgariUcretPeriods(intervalStart, intervalEnd);
      
      asgariUcretPeriods.forEach((period) => {
        const rowStart = period.start;
        const rowEnd = period.end;
        
        const startFormatted = format(rowStart, 'dd.MM.yyyy');
        const endFormatted = format(rowEnd, 'dd.MM.yyyy');
        
        const segStartISO = `${rowStart.getFullYear()}-${String(rowStart.getMonth() + 1).padStart(2, '0')}-${String(rowStart.getDate()).padStart(2, '0')}`;
        const segEndISO = `${rowEnd.getFullYear()}-${String(rowEnd.getMonth() + 1).padStart(2, '0')}-${String(rowEnd.getDate()).padStart(2, '0')}`;
        
        const diffMs = rowEnd.getTime() - rowStart.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        const weeks = Math.round(diffDays / 7);
        
        const asgariUcret = getAsgariUcretByDate(segStartISO) || 17002.12;
        
        generatedRows.push({
          id: `period-${generatedRows.length}`,
          startISO: segStartISO,
          endISO: segEndISO,
          rangeLabel: `${startFormatted} – ${endFormatted}`,
          weeks: weeks,
          brut: asgariUcret,
          katsayi: katSayi,
          fmHours: fmHours, // Bu interval'ın FM saati
          fm: 0,
          net: 0,
          year: rowStart.getFullYear(),
        });
      });
    });
    
    console.log('[CALC] Generated rows:', generatedRows.length);
    console.log('[CALC] FM Hours per row:', generatedRows.map(r => ({ range: r.rangeLabel, fmHours: r.fmHours })));
    
    // 4) 270 DÜŞÜM
    if (include270) {
      if (mode270 === 'simple') {
        // YARGITAY: 270 / 52 = 5.2 saat haftalık düşüm
        const YARGITAY_270_WEEKLY_DEDUCTION = 5.2;
        generatedRows = generatedRows.map((row) => {
          const adjustedFmHours = Math.max(0, row.fmHours - YARGITAY_270_WEEKLY_DEDUCTION);
          return {
            ...row,
            fmHours: adjustedFmHours
          };
        });
      } else if (mode270 === 'detailed') {
        // ŞİRKET: Detaylı hesaplama
        const iseGirisTarihi = new Date(dateIn);
        const istenCikisTarihi = new Date(dateOut);
        
        generatedRows = generatedRows.map((row) => {
          const tabloSatirlari = [{
            baslangic: new Date(row.startISO),
            bitis: new Date(row.endISO)
          }];
          
          const sonuclar = calculateOvertimeWith270AndLimitation({
            iseGirisTarihi,
            istenCikisTarihi,
            haftalikFazlaMesaiSaati: row.fmHours,
            zamanaSimiTarihi: zamanasimiBaslangic ? new Date(zamanasimiBaslangic) : undefined,
            yillikIzinler: [],
            tabloSatirlari
          });
          
          return {
            ...row,
            weeks: sonuclar[0]?.fmHafta || 0,
            originalWeekCount: row.weeks,
          };
        });
      }
    }
    
    // 5) ZAMANAŞIMI
    if (zamanasimiBaslangic) {
      const zamanasimiDate = new Date(zamanasimiBaslangic);
      generatedRows = generatedRows
        .map(row => {
          const rowStartDate = new Date(row.startISO);
          const rowEndDate = new Date(row.endISO);
          
          if (rowEndDate < zamanasimiDate) return null;
          
          if (rowStartDate < zamanasimiDate && rowEndDate >= zamanasimiDate) {
            const adjustedStartISO = `${zamanasimiDate.getFullYear()}-${String(zamanasimiDate.getMonth() + 1).padStart(2, '0')}-${String(zamanasimiDate.getDate()).padStart(2, '0')}`;
            const adjustedStartFormatted = format(zamanasimiDate, 'dd.MM.yyyy');
            const endFormatted = format(rowEndDate, 'dd.MM.yyyy');
            const diffMs = rowEndDate.getTime() - zamanasimiDate.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
            const adjustedWeeks = Math.round(diffDays / 7);
            
            return {
              ...row,
              startISO: adjustedStartISO,
              rangeLabel: `${adjustedStartFormatted} – ${endFormatted}`,
              weeks: adjustedWeeks,
            };
          }
          
          return row;
        })
        .filter(Boolean);
    }
    
    // 6) FM VE NET HESAPLA
    generatedRows = generatedRows.map(row => {
      const fm = row.weeks * row.brut * row.katsayi * row.fmHours / 225 * 1.5;
      return {
        ...row,
        fm,
        net: fm
      };
    });
    
    // 7) Sırala
    generatedRows.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
    
    console.log('[CALC] Final rows:', generatedRows.length);
    return generatedRows;
  }, [
    standardState.davaci.dateIn,
    standardState.davaci.dateOut,
    standardState.davaci.in,
    standardState.davaci.out,
    standardState.taniklar,
    weeklyDays,
    activeTab,
    katSayi,
    zamanasimiBaslangic,
    include270,
    mode270
  ]);

  // derivedRows değiştiğinde standartFinalRows'u güncelle
  useEffect(() => {
    console.log('🔄 [DERIVED ROWS] Updating standartFinalRows, length:', derivedRows.length);
    setStandartFinalRows(derivedRows);
  }, [derivedRows]);

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

  // LEGACY CODE REMOVED - Using StandartScenario hook instead
  // ═══════════════════════════════════════════════════════════

  // Row manipulation functions removed - using scenario hooks instead

  // Dinamik metin: TANIK KESİŞİMİ BAZLI (TEK KAYNAK: witnessIntersectionFMRef)
  const fmPeriods = useMemo(() => {
    console.log('🔍 [fmPeriods] finalRows.length:', finalRows.length);
    
    const result = [];
    
    // DAVACI KARTI
    const dateIn = standardState.davaci.dateIn;
    const dateOut = standardState.davaci.dateOut;
    const timeIn = standardState.davaci.in;
    const timeOut = standardState.davaci.out;
    
    if (dateIn && dateOut && timeIn && timeOut) {
      console.log('✅ [fmPeriods] Davacı verileri:', { dateIn, dateOut, timeIn, timeOut });
      
      // Günlük brüt saat hesapla
      const [girH, girM] = timeIn.split(':').map(Number);
      const [cikH, cikM] = timeOut.split(':').map(Number);
      const girMinutes = girH * 60 + girM;
      const cikMinutes = cikH * 60 + cikM;
      const dailyMinutes = cikMinutes - girMinutes;
      const dailyBrut = dailyMinutes / 60;
      
      // Ara dinlenme
      let breakHours = 1;
      if (dailyBrut >= 11) breakHours = 1.5;
      if (dailyBrut >= 14) breakHours = 2;
      
      const dailyNet = Math.max(0, dailyBrut - breakHours);
      const workDays = Number(weeklyDays) || 6;
      
      // DAVACI KENDİ FM SAATİNİ HESAPLA (tanık olmadan)
      let davaciWeeklyFM = 0;
      let davaciText = '';
      
      // HAFTA TATİLLİ (weeklyDays = 7 VE activeTab = "tatilli")
      if (workDays === 7 && activeTab === 'tatilli') {
        const weeklyNormal = 6 * dailyNet;
        const holidayOvertime = Math.max(0, dailyNet - 7.5);
        const weeklyTotal = weeklyNormal + holidayOvertime;
        davaciWeeklyFM = Math.max(0, weeklyTotal - 45);
        
        davaciText = `DAVACI:
${timeIn} - ${timeOut} = ${dailyBrut.toFixed(2)} saat çalışma
- ${breakHours.toFixed(2)} saat ara dinlenme
= ${dailyNet.toFixed(2)} saat günlük çalışma
6 x ${dailyNet.toFixed(2)} = ${weeklyNormal.toFixed(2)} saat çalışma
${dailyNet.toFixed(2)} - 7,5 = ${holidayOvertime.toFixed(2)} saat hafta tatili fazla çalışma
= ${weeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${davaciWeeklyFM.toFixed(2)} saat haftalık fazla mesai`;
      } else {
        const weeklyTotal = dailyNet * workDays;
        davaciWeeklyFM = Math.max(0, weeklyTotal - 45);
        
        davaciText = `DAVACI:
${timeIn} - ${timeOut} = ${dailyBrut.toFixed(2)} saat çalışma
- ${breakHours.toFixed(2)} saat ara dinlenme
= ${dailyNet.toFixed(2)} saat günlük çalışma
${workDays} x ${dailyNet.toFixed(2)} = ${weeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${davaciWeeklyFM.toFixed(2)} saat haftalık fazla mesai`;
      }
      
      result.push({
        label: 'Davacı',
        text: davaciText,
        fmHours: davaciWeeklyFM
      });
    }
    
    // TANIKLAR KARTI (her tanık için ayrı kart - HER TANIĞIN KENDİ FM SAATİ)
    if (standardState.taniklar && standardState.taniklar.length > 0) {
      const witnesses = standardState.taniklar;
      
      // Davacı saatlerini al (tanık saatlerini kesmek için)
      const [dGirH, dGirM] = timeIn ? timeIn.split(':').map(Number) : [0, 0];
      const [dCikH, dCikM] = timeOut ? timeOut.split(':').map(Number) : [24, 0];
      const dGirMinutes = dGirH * 60 + dGirM;
      const dCikMinutes = dCikH * 60 + dCikM;
      
      witnesses.forEach((tanik, idx) => {
        if (!tanik.dateIn || !tanik.dateOut || !tanik.in || !tanik.out) return;
        
        const [tGirH, tGirM] = tanik.in.split(':').map(Number);
        const [tCikH, tCikM] = tanik.out.split(':').map(Number);
        let tGirMinutes = tGirH * 60 + tGirM;
        let tCikMinutes = tCikH * 60 + tCikM;
        
        // KRİTİK: Tanık saatlerini davacı saatleri ile kes
        // Tanık davacıdan önce başlayamaz, davacıdan sonra çıkamaz
        if (timeIn && timeOut) {
          tGirMinutes = Math.max(tGirMinutes, dGirMinutes);
          tCikMinutes = Math.min(tCikMinutes, dCikMinutes);
        }
        
        const tDailyMinutes = Math.max(0, tCikMinutes - tGirMinutes);
        const tDailyBrut = tDailyMinutes / 60;
        
        // Kesilmiş saatleri formatla (gösterim için)
        const kesikGirH = Math.floor(tGirMinutes / 60);
        const kesikGirM = tGirMinutes % 60;
        const kesikCikH = Math.floor(tCikMinutes / 60);
        const kesikCikM = tCikMinutes % 60;
        const kesikTimeIn = `${String(kesikGirH).padStart(2, '0')}:${String(kesikGirM).padStart(2, '0')}`;
        const kesikTimeOut = `${String(kesikCikH).padStart(2, '0')}:${String(kesikCikM).padStart(2, '0')}`;
        
        let tBreakHours = 1;
        if (tDailyBrut >= 11) tBreakHours = 1.5;
        if (tDailyBrut > 14) tBreakHours = 2;
        
        const tDailyNet = Math.max(0, tDailyBrut - tBreakHours);
        const tWorkDays = Number(weeklyDays) || 6;
        
        let tWeeklyFM = 0;
        let tanikText = '';
        
        if (tWorkDays === 7 && activeTab === 'tatilli') {
          const weeklyNormal = 6 * tDailyNet;
          const holidayOvertime = Math.max(0, tDailyNet - 7.5);
          const weeklyTotal = weeklyNormal + holidayOvertime;
          tWeeklyFM = Math.max(0, weeklyTotal - 45);
          
          tanikText = `TANIK ${idx + 1}:
${kesikTimeIn} - ${kesikTimeOut} = ${tDailyBrut.toFixed(2)} saat çalışma
- ${tBreakHours.toFixed(2)} saat ara dinlenme
= ${tDailyNet.toFixed(2)} saat günlük çalışma
6 x ${tDailyNet.toFixed(2)} = ${weeklyNormal.toFixed(2)} saat çalışma
${tDailyNet.toFixed(2)} - 7,5 = ${holidayOvertime.toFixed(2)} saat hafta tatili fazla çalışma
= ${weeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${tWeeklyFM.toFixed(2)} saat haftalık fazla mesai`;
        } else {
          const tWeeklyTotal = tDailyNet * tWorkDays;
          tWeeklyFM = Math.max(0, tWeeklyTotal - 45);
          
          tanikText = `TANIK ${idx + 1}:
${kesikTimeIn} - ${kesikTimeOut} = ${tDailyBrut.toFixed(2)} saat çalışma
- ${tBreakHours.toFixed(2)} saat ara dinlenme
= ${tDailyNet.toFixed(2)} saat günlük çalışma
${tWorkDays} x ${tDailyNet.toFixed(2)} = ${tWeeklyTotal.toFixed(2)} saat çalışma
- 45 saat haftalık çalışma saati
= ${tWeeklyFM.toFixed(2)} saat haftalık fazla mesai`;
        }
        
        result.push({
          label: `Tanık ${idx + 1}`,
          text: tanikText,
          fmHours: tWeeklyFM
        });
      });
    }
    
    return result;
  }, [finalRows, standardState.davaci, standardState.taniklar, weeklyDays, activeTab, witnessIntersectionFMRef.current]);

  // Apply annual leave deduction to derivedRows BEFORE sync to finalRows
  // RULE: Sum days per row year → divide by 6 → round → deduct from weeks → minimum 1
  const derivedRowsWithExclusions = useMemo(() => {
    if (!exclusions || exclusions.length === 0) {
      return derivedRows;
    }
    
    console.log('📋 [EXCLUSIONS] Applying annual leave deduction to derivedRows');
    
    return derivedRows.map(row => {
      if (!row.startISO || !row.endISO) return row;
      
      const rowStart = new Date(row.startISO);
      const rowEnd = new Date(row.endISO);
      
      // Sum annual leave days that overlap with this row
      let totalAnnualLeaveDays = 0;
      
      exclusions.forEach((excl) => {
        const exclStart = new Date(excl.start);
        const exclEnd = new Date(excl.end);
        
        // Check overlap
        if (exclStart <= rowEnd && exclEnd >= rowStart) {
          const overlapStart = exclStart > rowStart ? exclStart : rowStart;
          const overlapEnd = exclEnd < rowEnd ? exclEnd : rowEnd;
          const overlapDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          totalAnnualLeaveDays += overlapDays;
        }
      });
      
      // Calculate deduction: days / 6, round
      const weeksToDeduct = Math.round(totalAnnualLeaveDays / 6);
      
      // If no deduction needed, return original row
      if (weeksToDeduct === 0) return row;
      
      // Apply deduction: original weeks - deduction, minimum 1
      const newWeeks = Math.max(1, row.weeks - weeksToDeduct);
      
      // Recalculate FM with new weeks
      const newFm = newWeeks * row.brut * row.katsayi * row.fmHours / 225 * 1.5;
      
      console.log(`  ${row.rangeLabel}: ${row.weeks} hafta → ${newWeeks} hafta (${totalAnnualLeaveDays} gün / 6 = ${weeksToDeduct} hafta düşüm)`);
      
      return {
        ...row,
        weeks: newWeeks,
        fm: newFm
      };
    });
  }, [derivedRows, exclusions]);
  
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

  // STANDART PAGE - No HAFTALIK_KARMA sync needed
  
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
      
      success("Yeni hesaplama başlatıldı.");
    } catch {}
  };

  const handleSave = () => {
    console.log('💾 [SAVE] Saving with finalRows:', finalRows.length, 'rows');
    console.log('💾 [SAVE] First row:', finalRows[0]);
    console.log('💾 [SAVE] Active scenario:', calculationScenario);
    kaydetAc({
      hesapTuru: "fazla_mesai_bilirkisi1",
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
      customSections: fmPeriods.length > 0 ? [
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
              borderRadius: '6px'
            }}>
              {fmPeriods.map((p, idx) => (
                <pre key={idx} style={{
                  fontSize: '9px',
                  whiteSpace: 'pre-wrap',
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
      ] : [],
      periodData: {
        title: "Fazla Mesai Hesaplama Cetveli",
        headers: ["Dönem", "Hafta Sayısı", "Ücret (BRÜT)", "Katsayı", "FM Saati", "225", "1,5", "Fazla Mesai Ücreti"],
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
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, backendResult.weeklyOvertimeHours, haftalikMesai, fmPeriods, finalRows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari]);
  
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
      <div className="p-4 md:p-6 lg:p-8 page-background">

        <div className="space-y-4">
        {/* Ana Form - Tam Sayfa */}
        <div className="space-y-4">
          {/* Üst Alan - Tarihler ve Beyanlar */}
          <div className="soft-card space-y-4 divide-y divide-gray-100 text-sm leading-tight" style={{ padding: '20px', fontSize: '13px', lineHeight: '1.3' }}>
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
              {videoLink && (
                <Button
                  onClick={() => window.open(videoLink, "_blank")}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 hover:text-red-700"
                >
                  <Youtube className="h-4 w-4" />
                  Kullanım Videosu İzle
                </Button>
              )}
              <Button
                onClick={handleNewCalculation}
                variant="outline"
                size="sm"
                className="gap-2 border-gray-300 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Yeni Hesapla
              </Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-xs text-gray-700 font-medium mb-1 flex items-center gap-1 leading-tight">Haftada Çalışılan Gün <span className="text-gray-500" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className="w-full rounded-lg border-[0.5px] border-gray-300 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 leading-tight" value={weeklyDays} onChange={(e)=>setWeeklyDays(String(Number(e.target.value)||0))} readOnly={isReadOnly} />
              </div>
            </div>

          {/* Zamanaşımı Modal - React.memo ile optimize edilmiş component */}
          {showZamanaModal && (
            <ZamanasimiModalContent
              zForm={zForm}
              setZForm={setZForm}
              onApply={handleZamanasimiApply}
              onCancel={handleZamanasimiCancel}
              showToastError={showToastError}
              isReadOnly={isReadOnly}
            />
          )}
            {/* ═══════════════════════════════════════════════════════════════════════════ */}
            {/* SCENARIO NAVIGATION - Navigate between independent pages */}
            {/* ═══════════════════════════════════════════════════════════════════════════ */}
            <div className="rounded-md border-2 border-blue-300 bg-blue-50 p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm font-bold text-blue-900">📋 Hesaplama Senaryosu</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/standart/${effectiveId}` : '/fazla-mesai/bilirkisi-1/standart';
                    navigate(basePath, { replace: true });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all bg-blue-600 text-white border-blue-600 shadow-md"
                >
                  <div className="font-semibold">STANDART</div>
                  <div className="text-xs mt-1 opacity-80">Tek giriş/çıkış</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/haftalik-karma/${effectiveId}` : '/fazla-mesai/bilirkisi-1/haftalik-karma';
                    navigate(basePath, { replace: true });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                >
                  <div className="font-semibold">HAFTALIK KARMA</div>
                  <div className="text-xs mt-1 opacity-80">Haftalık desen</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/donemsel/${effectiveId}` : '/fazla-mesai/bilirkisi-1/donemsel';
                    navigate(basePath, { replace: true });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                >
                  <div className="font-semibold">DÖNEMSEL</div>
                  <div className="text-xs mt-1 opacity-80">Dönem listesi</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const basePath = effectiveId ? `/fazla-mesai/bilirkisi-1/donemsel-karma/${effectiveId}` : '/fazla-mesai/bilirkisi-1/donemsel-karma';
                    navigate(basePath, { replace: true });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                >
                  <div className="font-semibold">DÖNEMSEL KARMA</div>
                  <div className="text-xs mt-1 opacity-80">Dönem + Haftalık</div>
                </button>
              </div>
            </div>

            <div className="rounded-md border-[0.5px] border-gray-200 bg-[#e9ecef] px-3 py-1.5 text-xs font-semibold text-gray-800 mb-2 leading-tight">Beyan Bilgileri</div>
            
            {/* Davacı Beyanı - STANDART PAGE: Always visible */}
            <details className="rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg leading-tight">Davacı Beyanı</summary>
              <div className="p-4 space-y-4">
                {/* STANDART: Basit giriş */}
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
                          if (value && value.includes('-')) {
                            const parts = value.split('-');
                            if (parts[0] && parts[0].length > 4) {
                              parts[0] = parts[0].substring(0, 4);
                              value = parts.join('-');
                              e.target.value = value;
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
                          if (value && value.includes('-')) {
                            const parts = value.split('-');
                            if (parts[0] && parts[0].length > 4) {
                              parts[0] = parts[0].substring(0, 4);
                              value = parts.join('-');
                              e.target.value = value;
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
              </div>
            </details>

            {/* Tanık Beyanları - STANDART PAGE: Always visible */}
            <details className="rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg leading-tight">Tanık Beyanları</summary>
              <div className="p-4 space-y-4">
                {/* STANDART: Basit giriş */}
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
                      className="w-full px-3 py-2 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 border border-green-300 rounded transition-colors"
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

              </div>
              </details>


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
                            <div key={idx} className="p-3 rounded-lg border bg-white shadow-sm text-sm leading-relaxed whitespace-pre-line">
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
                            <div key={idx} className="p-3 rounded-lg border bg-white shadow-sm text-sm leading-relaxed whitespace-pre-line">
                              {p.text}
                            </div>
                          ))}
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
              {show270Dropdown && (
                <div 
                  className="fixed inset-0 z-[45]" 
                  onClick={() => setShow270Dropdown(false)}
                />
              )}
              
              {/* Ana Buton */}
              <button
                type="button"
                onClick={() => setShow270Dropdown(!show270Dropdown)}
                className={`relative z-50 inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
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
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-200">
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
          
          {/* Alt Alan - Dışlamalar ve Tablo */}
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
                    finalRows.map((r, i) => {
                      return (
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
                      );
                    })
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
            <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200 md:col-span-2">
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

            {/* Kart 2: Mahsuplaşma - ZARİF */}
            <Card className="md:col-span-1 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-l-4 border-pink-500 dark:border-pink-600 shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-pink-900 dark:text-pink-400 flex items-center gap-2">
                  <svg className="w-6 h-6 text-pink-500 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Mahsuplaşma
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    1/3 Hakkaniyet İndirimi
                  </Label>
                  <Input
                    type="text"
                    value={`${(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}₺`}
                    disabled
                    className="w-full h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Toplam Fazla Mesai ({brutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) − 1/3 Hakkaniyet İndirimi ({(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) =
                    <span className="ml-1 font-semibold">{(brutYillik - (Number(brutYillik || 0) / 3)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
                  </p>
                </div>
                <div>
                  <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mahsuplaşma Miktarı
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      value={(() => {
                        const num = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                        return num > 0 ? `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : '';
                      })()}
                      onChange={(e) => {
                        const v = String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim();
                        setMahsuplasmaMiktari(v);
                      }}
                      placeholder="0,00₺"
                      className="flex-1 h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:focus:ring-pink-400 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200"
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

      {/* YENİ RAPOR SİSTEMİ: BaseReportModal */}
      {USE_NEW_BILIRKISI1_REPORT && (
        <BaseReportModal
          open={showNewBilirkisi1ReportModal}
          onClose={() => setShowNewBilirkisi1ReportModal(false)}
          config={bilirkisi1ReportConfig}
        />
      )}
      
      <FooterActions
        onPrint={handlePrint}
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
          title: "",
          copyTargetId: "rapor-icerik",
          onButtonClick: () => {
            if (USE_NEW_BILIRKISI1_REPORT) {
              setShowNewBilirkisi1ReportModal(true);
            }
          },
          renderContent: () => {
            console.log('🖨️ [PREVIEW] renderContent called');
            console.log('🖨️ [PREVIEW] finalRows.length:', finalRows.length);
            console.log('🖨️ [PREVIEW] finalRows[0]:', finalRows[0]);
            console.log('🖨️ [PREVIEW] iseGiris:', iseGiris, 'istenCikis:', istenCikis);
            return (
            <div id="rapor-icerik" style={{fontFamily:'Inter, Arial, sans-serif', color:'#111827'}}>
              <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>{resolvedTitle} Hesap Özeti</div>

              {/* Özet Tablo */}
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:12, border:'1px solid #d1d5db'}}>
                <thead style={{background:'#f3f4f6'}}>
                  <tr>
                    <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Alan</th>
                    <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Değer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşe Giriş</td>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{iseGiris || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşten Çıkış</td>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{istenCikis || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Haftalık Gün</td>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{weeklyDays}</td>
                  </tr>
                  <tr>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Haftalık Fazla Mesai</td>
                    <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{(backendResult.weeklyOvertimeHours || haftalikMesai || 0).toFixed(2).replace('.', ',')} saat</td>
                  </tr>
                  <tr style={{background:'#f3f4f6', fontWeight:600}}>
                    <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Toplam Fazla Mesai</td>
                    <td style={{border:'1px solid #d1d5db', padding:'8px'}}>{fmt(totalBrut)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Metin Hesaplaması - GRID FORMAT */}
              {(fmPeriods.length > 0 || txtTatilsiz || txtTatilli || txtUnderSeven) && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>Metin Hesaplaması</div>
                  <div style={{padding:'10px', background:'#f9fafb', border:'1px solid #d1d5db', borderRadius:6}}>
                    {fmPeriods.length > 0 ? (
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px'}}>
                        {fmPeriods.map((p, idx) => (
                          <div key={idx} style={{padding:'12px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', fontSize:13, lineHeight:1.6, whiteSpace:'pre-line'}}>
                            {p.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{padding:'12px', fontSize:13, fontFamily:'monospace', lineHeight:1.6, color:'#374151'}}>
                        {Number(weeklyDays) === 7 ? (
                          activeTab === "tatilsiz" ? (txtTatilsiz || "Giriş/çıkış saatlerini giriniz.") : (txtTatilli || "Giriş/çıkış saatlerini giriniz.")
                        ) : (
                          txtUnderSeven || "Giriş/çıkış saatlerini giriniz."
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hesaplama Tablosu */}
              <div id="calc-table" style={{marginTop:16, marginBottom:12}}>
                <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>Fazla Mesai Hesaplama Cetveli</div>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, border:'1px solid #d1d5db'}}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Tarih Aralığı</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'center'}}>Hafta Sayısı</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>Ücret</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>Kat Sayı Çarpanı</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>Fazla Mesai Saati</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'center'}}>225</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'center'}}>1,5</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>Fazla Mesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'left', whiteSpace:'nowrap'}}>{r.rangeLabel}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'center'}}>{r.weeks}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(r.brut)}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'center'}}>225</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'center'}}>1,5</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(r.fm)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {finalRows.length>0 && (
                    <tfoot style={{background:'#f3f4f6'}}>
                      <tr>
                        <td colSpan={7} style={{border:'1px solid #d1d5db', textAlign:'right', fontWeight:600, padding:'8px'}}>Toplam Fazla Mesai:</td>
                        <td style={{border:'1px solid #d1d5db', fontWeight:600, padding:'8px', textAlign:'right'}}>{fmt(totalBrut)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Brütten Nete Çevir */}
              <div style={{marginTop:16, marginBottom:12}}>
                <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>Brütten Nete Çeviri</div>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, border:'1px solid #d1d5db'}}>
                  <tbody>
                    <tr style={{background:'#f3f4f6', fontWeight:600}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Brüt Fazla Mesai</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(brutYillik)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>SGK Primi (%14)</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(Math.round(brutYillik * 0.14 * 100) / 100)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşsizlik Primi (%1)</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(Math.round(brutYillik * 0.01 * 100) / 100)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Gelir Vergisi {gelirVergisiDilimleri}</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(gelirVergisi)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Damga Vergisi (binde 7,59)</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(damgaVergisi)}</td>
                    </tr>
                    <tr style={{background:'#dcfce7', fontWeight:600, color:'#16a34a'}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Net Fazla Mesai</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(netYillik)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mahsuplaşma */}
              <div style={{marginTop:16, marginBottom:12}}>
                <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>Mahsuplaşma</div>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, border:'1px solid #d1d5db'}}>
                  <tbody>
                    <tr style={{background:'#f3f4f6', fontWeight:600}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Toplam Fazla Mesai</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(brutYillik)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>1/3 Hakkaniyet İndirimi</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(Number(brutYillik || 0) / 3)}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Mahsuplaşma Miktarı</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>
                        {(() => {
                          const num = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                          return num > 0 ? fmt(num) : '0,00₺';
                        })()}
                      </td>
                    </tr>
                    <tr style={{background:'#f3f4f6', fontWeight:700}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Sonuç</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>
                        {fmt(brutYillik - (Number(brutYillik || 0) / 3) - (Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            );
          },
        }}
      />
    </div>
    </Layout>
    {KaydetModal ? <KaydetModal /> : null}
    <Toaster />
  </>
  );
}
