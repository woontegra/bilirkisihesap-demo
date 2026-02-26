/**
 * 🔐 HARD FREEZE – FINAL
 *
 * PAGE: Standart Fazla Mesai
 * STATUS: COMPLETED & HARD-FROZEN
 *
 * This file contains VERIFIED and VALIDATED calculation logic.
 * It is a REFERENCE implementation.
 *
 * ------------------------------------------------------------
 * ⛔ ABSOLUTE RULES
 * ------------------------------------------------------------
 * - NO automatic edits
 * - NO Cursor / Windsurf auto-fix
 * - NO refactor, cleanup, optimization, formatting
 * - NO regeneration, snapshot restore, or template overwrite
 * - NO indirect changes via shared utils or global state
 *
 * ------------------------------------------------------------
 * ✅ ALLOWED (EXPLICIT UNLOCK REQUIRED)
 * ------------------------------------------------------------
 * Changes are ONLY allowed if ALL of the following are true:
 * 1. HARD FREEZE block is MANUALLY removed
 * 2. Change is SINGLE-PURPOSE and SINGLE-LOCATION
 * 3. Change is INTENTIONALLY reviewed
 * 4. HARD FREEZE block is RE-APPLIED immediately after
 *
 * ------------------------------------------------------------
 * 🛑 WORKFLOW ENFORCEMENT
 * ------------------------------------------------------------
 * If you are not 100% certain:
 * - WHAT will change
 * - WHERE it will change
 * - WHY it is required
 *
 * STOP. DO NOT EDIT.
 *
 * ------------------------------------------------------------
 * NOTE
 * ------------------------------------------------------------
 * This page is a CANONICAL reference.
 * Other pages must COPY from this file.
 * This file must NEVER be modified to fix other pages.
 */

// ===== LOGLAMA SİSTEMİ =====
const LOG_ENABLED = true;
const LOG_PREFIX = '[STANDART FM]';

const logger = {
  input: (field: string, value: any, extra?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`📝 ${LOG_PREFIX} [INPUT] ${field}:`, value, extra || '');
  },
  state: (stateName: string, value: any, extra?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`🔄 ${LOG_PREFIX} [STATE] ${stateName}:`, value, extra || '');
  },
  effect: (effectName: string, dependencies?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`⚡ ${LOG_PREFIX} [EFFECT] ${effectName}`, dependencies || '');
  },
  calc: (calcName: string, result?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`🧮 ${LOG_PREFIX} [CALC] ${calcName}`, result || '');
  },
  error: (location: string, error: any) => {
    console.error(`❌ ${LOG_PREFIX} [ERROR] ${location}:`, error);
  },
  warn: (message: string, data?: any) => {
    console.warn(`⚠️ ${LOG_PREFIX} [WARN] ${message}`, data || '');
  },
  info: (message: string, data?: any) => {
    if (!LOG_ENABLED) return;
    console.info(`ℹ️ ${LOG_PREFIX} [INFO] ${message}`, data || '');
  },
  row: (action: string, rowData?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`📊 ${LOG_PREFIX} [ROW] ${action}`, rowData || '');
  },
  api: (endpoint: string, data?: any) => {
    if (!LOG_ENABLED) return;
    console.log(`🌐 ${LOG_PREFIX} [API] ${endpoint}`, data || '');
  }
};

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('WINDOW', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('UNHANDLED PROMISE', {
    reason: event.reason,
    promise: event.promise
  });
});

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { flushSync, createPortal } from "react-dom";
import Layout from "./localComponents/Layout";
import ZamanasimiModal from "./localComponents/ZamanasimiModal";
import FooterActions from "@/components/FooterActions";
import { useToast } from "./localHooks/useToast";
import { useKaydet } from "./localHooks/useKaydet";
import FazlaMesaiStandartReportModal from "./FazlaMesaiStandartReportModal";
import { safeNumber, safeCurrency } from "./localUtils/safeFormat";
import { API_BASE_URL, apiPost } from "./localUtils/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";

// YENİ RAPOR SİSTEMİ
import { BaseReportModal, ReportContentFromConfig, type ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_FAZLA_MESAI_REPORT = true;
import { asgariUcretler } from "./localConstants/asgariUcretler";
import { normalizeCurrency } from "./localUtils/currencyNormalizeCore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getScopedStorageKey } from "@/utils/storageKey";
import { Label } from "@/components/ui/label";
import UbgtKatsayiModal from "./localComponents/UbgtKatsayiModal";
import MahsuplasamaModal from "./localComponents/MahsuplasamaModal";
import NotCard from "./localComponents/NotCard";
import { getAsgariUcretPeriods } from "./localConstants/asgariUcretPeriods";
import { calculateOvertimeTable } from "./localUtils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "./localUtils/overtimeCalculator";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "./localUtils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { calculateOvertimeWith270AndLimitation } from "./localUtils/calculateOvertimeWith270AndLimitation";
import { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "./localUtils/incomeTaxCore";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";
import { segmentOvertimeResult } from "./localUtils/dateSegmentationCore";
import "./soft-glow.css";

// ===== SİLİNEN DOSYALARDAN HELPER FUNCTIONS =====
// calculations.ts, constants.ts, validations.ts dosyaları backend'e taşındığı için
// bu helper fonksiyonları buraya eklendi

// Constants - Frontend hesaplama için
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const WEEKLY_WORK_LIMIT = 45;
const STANDARD_DAILY_REFERENCE_HOURS = 7.5;
const FAZLA_MESAI_DENOMINATOR = 225;
const FAZLA_MESAI_KATSAYI = 1.5;
const INCLUDED_OVERTIME_HOURS = 270;

// Type definitions
type ExcludedDay = {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer" | "UBGT";
  start: string;
  end: string;
  days: number;
};

// Helper functions
const fmt = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value)) return '0,00₺';
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
};

// Bolt tasarım stili (Kıdem/İhbar ile aynı)
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100";

const formatTR = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('tr-TR');
};

// Tarih validasyon helper'ı
const validateDate = (dateStr: string): { valid: boolean; message?: string } => {
  if (!dateStr) return { valid: false, message: 'Tarih boş olamaz' };
  
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.test(dateStr);
  if (!match) return { valid: false, message: 'Tarih formatı YYYY-MM-DD olmalıdır' };
  
  const [yilStr, ayStr, gunStr] = dateStr.split('-');
  const yil = parseInt(yilStr, 10);
  const ay = parseInt(ayStr, 10);
  const gun = parseInt(gunStr, 10);
  
  // Yıl kontrolü
  if (yil < 1900 || yil > 2100) {
    return { valid: false, message: `Geçersiz yıl: ${yil}. Yıl 1900-2100 arasında olmalıdır.` };
  }
  
  // Ay kontrolü
  if (ay < 1 || ay > 12) {
    return { valid: false, message: `Geçersiz ay: ${ay}. Ay 1-12 arasında olmalıdır.` };
  }
  
  // Gün kontrolü
  const date = new Date(yil, ay - 1, gun);
  if (date.getFullYear() !== yil || date.getMonth() !== ay - 1 || date.getDate() !== gun) {
    return { valid: false, message: `Geçersiz tarih: ${dateStr}. Bu tarih geçerli değil (örn: 29 Şubat artık yıl değilse).` };
  }
  
  return { valid: true };
};

// Saat validasyon helper'ı
const validateTime = (timeStr: string): { valid: boolean; message?: string } => {
  if (!timeStr) return { valid: false, message: 'Saat boş olamaz' };
  
  const match = /^(\d{1,2}):(\d{2})$/.test(timeStr);
  if (!match) return { valid: false, message: 'Saat formatı HH:MM olmalıdır' };
  
  const [saatStr, dakikaStr] = timeStr.split(':');
  const saat = parseInt(saatStr, 10);
  const dakika = parseInt(dakikaStr, 10);
  
  if (saat < 0 || saat > 23) {
    return { valid: false, message: `Geçersiz saat: ${saat}. Saat 0-23 arasında olmalıdır.` };
  }
  
  if (dakika < 0 || dakika > 59) {
    return { valid: false, message: `Geçersiz dakika: ${dakika}. Dakika 0-59 arasında olmalıdır.` };
  }
  
  return { valid: true };
};

const normalizeDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  
  // DD.MM.YYYY formatı
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    const normalizedYear = yil && yil.length === 4 ? yil : `20${yil}`;
    const result = `${normalizedYear}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
    logger.info('normalizeDate (DD.MM.YYYY)', { input: s, output: result });
    return result;
  }
  
  // YYYY-MM-DD formatı - Yıl validasyonu
  if (s.includes("-")) {
    const parts = s.split("-");
    if (parts.length === 3) {
      let [yil, ay, gun] = parts;
      
      // Yıl 4 haneden az ise düzelt
      if (yil.length < 4) {
        yil = yil.length === 2 ? `20${yil}` : yil.padStart(4, '20');
        const result = `${yil}-${ay}-${gun}`;
        logger.warn('normalizeDate: Yıl düzeltildi', { input: s, output: result });
        return result;
      }
    }
  }
  
  return s;
};

const normalizeTime = (timeStr?: string | null): string | null => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
  const normalized = normalizeTime(timeStr);
  if (!normalized) return null;
  const [h, m] = normalized.split(":").map(Number);
  return { hours: h, minutes: m };
};

const toUTC = (dateString: string): Date => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

const toISODateUTC = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toDateStripped = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const hasOvertimeResults = (results: any[]): boolean => {
  return Array.isArray(results) && results.length > 0;
};

const isValidWeeklyDayCount = (n: number): boolean => {
  return n >= 1 && n <= 7;
};

const calculateDailyWorkHours = (startTime: string, endTime: string): number => {
  const startMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(startTime || "");
  const endMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(endTime || "");
  
  if (!startMatch || !endMatch) return 0;
  
  const startHour = Number(startMatch[1]);
  const startMinute = Number(startMatch[2]);
  const endHour = Number(endMatch[1]);
  const endMinute = Number(endMatch[2]);
  
  const totalStart = startHour * 60 + startMinute;
  let totalEnd = endHour * 60 + endMinute;
  
  if (totalEnd < totalStart) {
    totalEnd += 24 * 60;
  }
  
  const totalMinutes = totalEnd - totalStart;
  const totalHours = totalMinutes / 60;
  
  return totalHours;
};

const computeBreakHours = (dailyGross: number): number => {
  if (!Number.isFinite(dailyGross) || dailyGross <= 0) return 0;
  // 🔧 ARA DİNLENME – 4857/68 + Yargıtay (üst sınırlar 1 dk eksik: 10:59, 13:59, 14:59)
  if (dailyGross <= 4) return 0.25;      // ≤4 saat → 15 dk
  if (dailyGross <= 7.5) return 0.5;     // 4–7.5 saat → 30 dk
  if (dailyGross < 11) return 1;         // 7.5–10:59 → 1 saat
  if (dailyGross < 14) return 1.5;       // 11:00–13:59 → 1,5 saat
  if (dailyGross < 15) return 2;         // 14:00–14:59 → 2 saat
  return 3;                               // 15 saat ve üzeri → 3 saat
};

const calculateWeekCount = (startDate: Date, endDate: Date, exclusions: ExcludedDay[] = []): number => {
  try {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    const diffTime = end.getTime() - start.getTime();
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Dışlanabilir günleri çıkar (TÜM tipler dahil: Yıllık İzin, Rapor, Diğer)
    const effExclusions = (exclusions || []);
    if (effExclusions.length > 0) {
      effExclusions.forEach(excl => {
        const exclStart = normalizeLocalDate(excl.start);
        const exclEnd = normalizeLocalDate(excl.end);
        
        if (exclStart && exclEnd) {
          // Dışlama aralığının dönem içindeki kısmını hesapla
          const overlapStart = exclStart < start ? start : exclStart;
          const overlapEnd = exclEnd > end ? end : exclEnd;
          
          // Çakışma varsa günleri çıkar
          if (overlapStart <= overlapEnd) {
            const excludedDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            totalDays = Math.max(0, totalDays - excludedDays);
          }
        }
      });
    }
    
    let totalWeeks = Math.round(totalDays / 7);
    
    if (totalWeeks < 1) totalWeeks = 1;
    if (totalWeeks > 52) totalWeeks = 52;
    
    return totalWeeks;
  } catch {
    return 1;
  }
};

const formatDateTRStr = (dateStr?: string): string => {
  try {
    if (!dateStr) return "";
    const d = normalizeLocalDate(dateStr);
    if (!d) return String(dateStr || "");
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(dateStr || "");
  }
};

const extractHaftaDususWeeks = (value: any): number | null => {
  if (typeof value === "number" && value > 0) return value;
  if (typeof value !== "string") return null;
  const byHafta = value.match(/(\d+(?:[.,]\d+)?)\s*hafta/i);
  if (byHafta && byHafta[1]) {
    return Number(byHafta[1].replace(",", ".")) || null;
  }
  return null;
};

type CalculationRow = {
  id: string;
  startDate: string;
  endDate: string;
  year: number | null;
  fmHours: number;
  wage: number;
  weekCount: number;
  originalWeekCount: number;
  overtimeAmount: number;
  isManual: boolean;
} & {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmManual?: boolean;
  calc225: number;
  factor: number;
  fm: number; // Brüt Fazla Mesai
  net: number; // Net Fazla Mesai (kesintiler sonrası)
  startISO: string;
  endISO: string;
  manual?: boolean; // UI uyumluluğu için
  deductedWeeks?: number;
  deductedHours?: number;
  partialDeductHours?: number;
  adjustedHours?: number;
};

const buildRowId = (prefix = "row") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const syncRowAliases = (row: CalculationRow): CalculationRow => {
  const isManual = row.isManual ?? row.manual ?? false;
  const derivedYear = row.year ?? (row.startISO ? new Date(row.startISO).getFullYear() : null);
  return {
    ...row,
    isManual,
    manual: isManual,
    startDate: row.startISO,
    endDate: row.endISO,
    year: derivedYear && !isNaN(derivedYear) ? derivedYear : null,
    weekCount: row.weekCount ?? row.weeks,
    originalWeekCount: row.originalWeekCount ?? row.weekCount ?? row.weeks,
    wage: row.wage ?? row.brut,
    overtimeAmount: row.overtimeAmount ?? row.fm,
  };
};

type Beyan = { in: string; out: string; dateIn?: string; dateOut?: string };
type Witness = Beyan & { id: number };

// Excl tipi artık calculations.ts'den import edilen ExcludedDay ile aynı
type Excl = ExcludedDay;

type Props = { titleOverride?: string };

export default function FazlaMesaiAlacagiPage({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info, toasts, dismiss: dismissToast } = useToast();
  const { kaydetAc, isSaving, KaydetModal } = useKaydet({ success, error: showToastError });
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-standart");
  const path = location?.pathname || "";
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const initializePageType = useCallback(() => {
    try {
      // Placeholder: perform any per-path initialization needed when route changes
      // Intentionally minimal to avoid UI/logic side-effects
    } catch {}
  }, []);
  const pageTitle = useMemo(() => {
    const p = path.toLowerCase();
    if (p.includes("bilirkisi1") || p.includes("bilirkişi1") || p.includes("bilirkisi-1")) return "Bilirkişiler İçin - 1";
    if (p.includes("bilirkisi2") || p.includes("bilirkişi2") || p.includes("bilirkisi-2")) return "Bilirkişiler İçin - 2";
    return "Standart Fazla Mesai";
  }, [path]);
  const resolvedTitle = titleOverride || pageTitle;
  
  // ✅ CONTROLLED DATE INPUTS: ISO strings (YYYY-MM-DD)
  const [iseGiris, _setIseGiris] = useState("");
  const setIseGiris = useCallback((value: string | ((prev: string) => string)) => {
    const newValue = typeof value === 'function' ? value(iseGiris) : value;
    logger.input('iseGiris', newValue);
    _setIseGiris(value);
  }, [iseGiris]);
  
  const [istenCikis, _setIstenCikis] = useState("");
  const setIstenCikis = useCallback((value: string | ((prev: string) => string)) => {
    const newValue = typeof value === 'function' ? value(istenCikis) : value;
    logger.input('istenCikis', newValue);
    _setIstenCikis(value);
  }, [istenCikis]);
  
  const [weeklyDays, _setWeeklyDays] = useState("6");
  // Logged setWeeklyDays wrapper
  const setWeeklyDays = useCallback((value: string | ((prev: string) => string)) => {
    const newValue = typeof value === 'function' ? value(weeklyDays) : value;
    logger.input('weeklyDays (Haftada Çalışılan Gün)', newValue);
    _setWeeklyDays(value);
  }, [weeklyDays]);
  
  const [rowInputValues, setRowInputValues] = useState<Record<string, string>>({});
  // ✅ REMOVED: rowFmHoursInputValues - FM input is now display-only, no state needed
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // 270 Saat modu: "none" (Kapalı), "detailed" (Şirket), "simple" (Yargıtay)
  const [mode270, _setMode270] = useState<"none" | "detailed" | "simple">("none");
  const setMode270 = useCallback((value: "none" | "detailed" | "simple" | ((prev: "none" | "detailed" | "simple") => "none" | "detailed" | "simple")) => {
    const newValue = typeof value === 'function' ? value(mode270) : value;
    logger.state('mode270', newValue);
    _setMode270(value);
  }, [mode270]);

  // 270 dropdown açık/kapalı state
  const [show270Dropdown, setShow270Dropdown] = useState(false);

  // Derived states (geriye dönük uyumluluk için)
  const include270 = mode270 === "detailed" || mode270 === "simple";
  const use270Simple = mode270 === "simple";
  
  const [haftaDususBilgisi, setHaftaDususBilgisi] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  // Klasik akış saatleri ve açıklama
  const [gir, setGir] = useState("");
  const [cik, setCik] = useState("");
  const [stepsText, setStepsText] = useState<string>("");
  const [txtTatilsiz, setTxtTatilsiz] = useState<string>("");
  const [txtTatilli, setTxtTatilli] = useState<string>("");
  const [txtUnderSeven, setTxtUnderSeven] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");

  // Beyanlar
  const [davaci, setDavaci] = useState<Beyan>({ in: "", out: "" });
  const [davali, setDavali] = useState<Beyan>({ in: "", out: "" });
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  const [puantaj, setPuantaj] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [isCalculating, setIsCalculating] = useState(false);
  
  // ✅ REMOVED: calcSeq, hasLoadedRows - legacy manual calculation refs

  // ✅ TEK KAYNAK: Haftalık fazla mesai saati - davacı beyanından türetilir
  const weeklyFMSaat = useMemo(() => {
    const davaciGirisSaati = davaci?.in || "";
    const davaciCikisSaati = davaci?.out || "";
    
    if (!davaciGirisSaati || !davaciCikisSaati) return 0;
    
    const raw = calculateDailyWorkHours(davaciGirisSaati, davaciCikisSaati);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    
    const brk = computeBreakHours(raw);
    const dailyWork = Math.max(0, raw - brk);
    const nwd = Number(weeklyDays) || 0;
    
    let fmCalc = 0;
    if (nwd === 7) {
      if (activeTab === 'tatilsiz') {
        const w = dailyWork * 7;
        fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
      } else {
        const extraHT = Math.max(0, dailyWork - STANDARD_DAILY_REFERENCE_HOURS);
        const w = dailyWork * 6 + extraHT;
        fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
      }
    } else if (nwd > 0 && nwd < 7) {
      const w = dailyWork * nwd;
      fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
    }
    
    return Number(fmCalc.toFixed(2));
  }, [davaci?.in, davaci?.out, weeklyDays, activeTab]);

  // Zamanaşımı state - MUST be declared before apply270 useCallback
  const [zamanasimiBaslangic, _setZamanasimiBaslangic] = useState<string | null>(null);
  // Logged setZamanasimiBaslangic wrapper
  const setZamanasimiBaslangic = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    const newValue = typeof value === 'function' ? value(zamanasimiBaslangic) : value;
    logger.state('zamanasimiBaslangic', newValue);
    _setZamanasimiBaslangic(value);
  }, [zamanasimiBaslangic]);

  // ✅ SINGLE SOURCE: 270 deduction pure function
  const YARGITAY_270_WEEKLY_DEDUCTION = 5.2; // 5.2 saat/hafta (rounded for clean display)
  
  // ✅ PURE FUNCTION: Apply 270 deduction to weekly FM
  // This is the ONLY place where 270 logic exists
  const apply270 = useCallback(({
    weeklyFM,
    mode270Value,
    year,
    appliedYears,
    row,
    exclusions
  }: {
    weeklyFM: number;
    mode270Value: string;
    year: number | null;
    appliedYears: Set<number>;
    row?: any;
    exclusions?: Excl[];
  }): { fmHours: number; weekCount: number } => {
    const originalWeekCount = row?.weeks ?? 0;

    if (mode270Value === "none") {
      return { fmHours: weeklyFM, weekCount: originalWeekCount };
    }

    // YARGITAY: Reduce FM HOURS, keep week count same
    // ✅ DOĞRU KURAL: 5.2 saat TÜM SATIRLARDAN düşülür (yılda kaç parça olursa olsun)
    if (mode270Value === "simple") {
      // 🔧 Floating point precision fix: 6 - 5.2 = 0.8 (not 0.799999...)
      const fmHours = Math.max(0, Number((weeklyFM - YARGITAY_270_WEEKLY_DEDUCTION).toFixed(2)));
      return { fmHours, weekCount: originalWeekCount };
    }

    // ŞİRKET: Keep FM HOURS same, reduce WEEK COUNT
    if (mode270Value === "detailed") {
      // Call calculateOvertimeWith270AndLimitation for company 270 deduction
      if (!row || !iseGiris || !istenCikis) {
        return { fmHours: weeklyFM, weekCount: originalWeekCount };
      }
      
      try {
        // ✅ Convert exclusions to yillikIzinler format for Şirket 270
        const yillikIzinler = (exclusions || []).map(excl => ({
          baslangic: new Date(excl.start),
          bitis: new Date(excl.end),
          gunSayisi: excl.days
        }));
        
        const companyResult = calculateOvertimeWith270AndLimitation({
          iseGirisTarihi: new Date(iseGiris),
          istenCikisTarihi: new Date(istenCikis),
          haftalikFazlaMesaiSaati: weeklyFM,
          zamanaSimiTarihi: zamanasimiBaslangic ? new Date(zamanasimiBaslangic) : undefined,
          yillikIzinler,
          tabloSatirlari: [{
            baslangic: new Date(row.startISO),
            bitis: new Date(row.endISO)
          }]
        });
        
        // ŞİRKET 270: fmHafta is the ADJUSTED WEEK COUNT (not FM hours!)
        const adjustedWeekCount = companyResult[0]?.fmHafta ?? originalWeekCount;
        return { fmHours: weeklyFM, weekCount: adjustedWeekCount };
      } catch (err) {
        console.error('Company 270 calculation error:', err);
        return { fmHours: weeklyFM, weekCount: originalWeekCount };
      }
    }

    return { fmHours: weeklyFM, weekCount: originalWeekCount };
  }, [YARGITAY_270_WEEKLY_DEDUCTION, iseGiris, istenCikis, zamanasimiBaslangic]);

  // ✅ REMOVED: commitDates - dates are now controlled, no commit needed

  // ✅ REMOVED: Davacı feedback loop - davaci is already set from inputs, no need to sync back
  // This was causing circular dependency and input flickering

  // Tanık beyanları: her zaman en az 1 boş satır göster
  useEffect(() => {
    try {
      if (!Array.isArray(taniklar) || taniklar.length === 0) {
        setTaniklar([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taniklar]);
  // Önizleme için haftalık FM (bilgi kutusu)
  const [haftalikFazlaMesai, setHaftalikFazlaMesai] = useState<number | null>(null);
  const [fmPreviewSource, setFmPreviewSource] = useState<"davaci"|"davali"|"tanik"|null>(null);
  
  // Rapor Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  
  // YENİ RAPOR SİSTEMİ: State
  const [showNewFMReportModal, setShowNewFMReportModal] = useState(false);
  // DEMO: Modal shown when user clicks Önizleme (no real report)
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [calculationSent, setCalculationSent] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewPayload, setPreviewPayload] = useState<{ type: "davaci"|"davali"|"tanik"; entry: string; exit: string } | null>(null);
  const [previewTouched, setPreviewTouched] = useState<boolean>(false);
  const [overtimeResults, setOvertimeResults] = useState<any[]>([]);
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

  // ✅ REMOVED: Davacı feedback loop - this was syncing davaci back to inputs
  // Creates circular dependency: input → davaci → input (flickering)
  // Input values should flow ONE WAY: input → commitDates → state → davaci
  const [intervals, setIntervals] = useState<any[]>([]);
  // Zamanaşımı
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [zamanasimi, setZamanasimi] = useState<{
    davaTarihi: string;
    arabuluculukBaslangic: string;
    arabuluculukBitis: string;
    arabuluculukGun: number;
    nihaiBaslangic: string;
  } | null>(null);
  // ✅ MOVED UP: zamanasimiBaslangic now declared before apply270 (line 541)
  
  const prevZamanaRef = useRef<string | null | undefined>(undefined); // undefined = ilk mount
  const rowsBeforeZamanaRef = useRef<CalculationRow[] | null>(null);
  const skipNextZamanaEffectRef = useRef<boolean>(false);
  const [zForm, setZForm] = useState<{ dava: string; bas: string; bit: string }>({ dava: "", bas: "", bit: "" });

  // Dışlamalar
  const [exclusions, _setExclusions] = useState<Excl[]>([]);
  // Logged setExclusions wrapper
  const setExclusions = useCallback((value: Excl[] | ((prev: Excl[]) => Excl[])) => {
    const newValue = typeof value === 'function' ? value(exclusions) : value;
    logger.state('exclusions', `${newValue.length} dışlama`, {
      types: newValue.map(e => e.type).join(', ')
    });
    _setExclusions(value);
  }, [exclusions]);
  
  // Dışlama kaydetme/yükleme
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: Excl[]; createdAt: string }[]>([]);
  // Quick-add temp states
  const [yilStart, setYilStart] = useState("");
  const [yilEnd, setYilEnd] = useState("");
  const [yilDays, setYilDays] = useState("");
  const [rapStart, setRapStart] = useState("");
  const [rapEnd, setRapEnd] = useState("");
  const [rapDays, setRapDays] = useState("");

  // Brütten Nete Çevir (FM toplamı üzerinden)
  const [brut, setBrut] = useState(0);
  // Bu bölüm artık tablo toplamını doğrudan dönüştürür (yıl çarpanı yok)
  const brutYillik = brut;
  const sskPrim = brutYillik * SSK_ORANI;
  
  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    if (istenCikis) {
      const year = new Date(istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [istenCikis]);
  
  // Progressive gelir vergisi hesaplama: matrah = brüt - (SSK+işsizlik)
  const gelirVergisiMatrahi = Math.max(0, brutYillik - sskPrim);
  const gelirVergisiResult = useMemo(() => calculateIncomeTaxWithBrackets(selectedYear, gelirVergisiMatrahi), [selectedYear, gelirVergisiMatrahi]);
  const gelirVergisi = gelirVergisiResult.tax;
  const gelirVergisiDilimleri = gelirVergisiResult.brackets;
  const damgaVergisi = brutYillik * DAMGA_VERGISI_ORANI;
  const netYillik = brutYillik - (sskPrim + gelirVergisi + damgaVergisi);
  const [mahsuplasmaMiktari, setMahsuplasmaMiktari] = useState<string>("");
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [month: number]: number } }>({});

  // Kat Sayı Hesapla modal state
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [katSayi, setKatSayi] = useState<number>(1);
  
  // ✅ MANUAL OVERRIDES: Store user's manual edits per row
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<CalculationRow>>>({});
  
  // ✅ MANUAL ROWS: Store user-added rows (via + button)
  const [manualRows, setManualRows] = useState<CalculationRow[]>([]);

  // ✅ AUTOMATIC TABLE GENERATION: rows derived from inputs via useMemo
  const rows = useMemo(() => {
    // Guard: Tarih veya saat eksikse boş tablo
    if (!iseGiris || !istenCikis || !davaci?.in || !davaci?.out) {
      logger.info('rows useMemo: Eksik input, boş tablo döndürülüyor');
      return [];
    }

    try {
      logger.info('rows useMemo: Hesaplama başlıyor', {
        iseGiris,
        istenCikis,
        'davaci.in': davaci.in,
        'davaci.out': davaci.out,
        weeklyDays,
        weeklyFMSaat,
        mode270
      });

      // ✅ Create appliedYears Set at useMemo level (not during render)
      const appliedYears = new Set<number>();

      // STEP 1: Calculate overtime intervals (from handleCalculateOvertime)
      const haftalikGunSayisi = Number(weeklyDays) || 0;
      const davaciInterval = {
        start: iseGiris,
        end: istenCikis,
        start_time: davaci.in,
        end_time: davaci.out,
        haftalikGun: haftalikGunSayisi,
      };

      // Import calculateOvertimeHours synchronously (already imported at top)
      const calculateOvertimeHours = (intervals: any[]) => {
        // Simplified inline version - just return basic structure
        return {
          results: intervals.map(interval => ({
            start: interval.start,
            end: interval.end,
            weeklyOvertimeHours: weeklyFMSaat,
          })),
          toplamFazlaMesai: 0
        };
      };

      const { results: overtimeResults } = calculateOvertimeHours([davaciInterval]);

      // STEP 2: Segment results by year and minimum wage periods (from handleHesapla)
      const tableRows: CalculationRow[] = [];
      
      (overtimeResults || []).forEach((result: any, resultIdx: number) => {
        // Segment by year and minimum wage
        const segments = segmentOvertimeResult(result);
        
        segments.forEach((segment, segIdx) => {
          let startDate = new Date(segment.start);
          let endDate = new Date(segment.end);
          
          // ✅ ZAMANAŞIMI UYGULAMASI: Nihai zamanaşımı başlangıç tarihine göre kırp
          if (zamanasimiBaslangic) {
            const limitDate = new Date(zamanasimiBaslangic);
            
            // KURAL 1: Segment tamamen zamanaşımından önce ise → ATLA
            if (endDate < limitDate) {
              logger.info('Zamanaşımı: Segment tamamen önce, atlandı', { 
                startISO: segment.start, 
                endISO: segment.end, 
                limitDate: zamanasimiBaslangic 
              });
              return;
            }
            
            // KURAL 2: Segment zamanaşımı ile çakışıyor ise → BAŞLANGIÇ TARİHİNİ KIRP
            if (startDate < limitDate && endDate >= limitDate) {
              logger.info('Zamanaşımı: Segment başlangıcı kırpıldı', { 
                oldStart: segment.start, 
                newStart: zamanasimiBaslangic, 
                limitDate: zamanasimiBaslangic 
              });
              // startDate'i kırp
              startDate = new Date(limitDate);
              // segment.start'ı güncelle
              const y = startDate.getFullYear();
              const m = String(startDate.getMonth() + 1).padStart(2, '0');
              const d = String(startDate.getDate()).padStart(2, '0');
              segment.start = `${y}-${m}-${d}`;
            }
            
            // KURAL 3: Segment tamamen zamanaşımından sonra ise → AYNEN KORU (hiçbir şey yapma)
          }
          
          // ✅ KIRPILMIŞ TARİHLERİ KULLAN
          const startISO = segment.start; // Kırpılmış tarih
          const endISO = segment.end;
          
          // Calculate weeks with exclusions
          const weeks = calculateWeekCount(startDate, endDate, exclusions);
          
          // Find minimum wage for this period
          const sortedAsgari = [...asgariUcretler].sort((a, b) => 
            new Date(b.start).getTime() - new Date(a.start).getTime()
          );
          
          const asgariUcret = sortedAsgari.find(au => {
            const auDate = new Date(au.start);
            return auDate <= startDate;
          });
          
          const brut = asgariUcret ? asgariUcret.brut : 0;
          
          // ✅ SINGLE SOURCE: Apply 270 deduction to weeklyFMSaat (kırpılmış tarihten yıl al)
          const year = startDate.getFullYear();
          
          // Build temporary row object for company 270 calculation
          const tempRow = {
            startISO,
            endISO,
            year,
            weeks
          };
          
          // ✅ CRITICAL: apply270 returns {fmHours, weekCount}
          // - YARGITAY: fmHours reduced, weekCount unchanged
          // - ŞİRKET: fmHours unchanged, weekCount reduced
          const { fmHours, weekCount: adjustedWeekCount } = apply270({
            weeklyFM: weeklyFMSaat,
            mode270Value: mode270,
            year,
            appliedYears,
            row: tempRow,
            exclusions
          });
          
          const kats = katSayi || 1;
          const hoursEffective = adjustedWeekCount * fmHours;  // ✅ Use adjusted week count
          const step3 = Number((brut * kats * hoursEffective).toFixed(6));
          const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
          const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
          const fm = Number(step5.toFixed(2));
          const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
          
          const base: CalculationRow = {
            id: `auto-${startISO || "na"}-${endISO || "na"}-${resultIdx}-${segIdx}`,
            startDate: startISO,
            endDate: endISO,
            year: startISO ? new Date(startISO).getFullYear() : null,
            fmHours,  // ✅ FM hours (Yargıtay affects this)
            wage: brut,
            weekCount: adjustedWeekCount,  // ✅ Week count (Şirket affects this)
            originalWeekCount: weeks,
            overtimeAmount: fm,
            isManual: false,
            rangeLabel: `${formatDateTRStr(startISO)}–${formatDateTRStr(endISO)}`,
            weeks: adjustedWeekCount,  // ✅ Use adjusted week count for consistency
            brut,
            katsayi: kats,
            fmManual: false,
            calc225: FAZLA_MESAI_DENOMINATOR,
            factor: FAZLA_MESAI_KATSAYI,
            fm,
            net,
            startISO,
            endISO,
            manual: false,
          };
          tableRows.push(syncRowAliases(base));
        });
      });

      logger.info('rows useMemo: Hesaplama tamamlandı', { rowCount: tableRows.length });
      
      // ✅ SINGLE SOURCE: apply270() returns {fmHours, weekCount}
      // - YARGITAY 270: Affects row.fmHours (FM hours reduced)
      // - ŞİRKET 270: Affects row.weekCount (week count reduced)
      // - Total FM = row.fmHours * row.weekCount
      
      return tableRows;
    } catch (err) {
      console.error('❌ rows useMemo hata:', err);
      return [];
    }
  }, [iseGiris, istenCikis, davaci?.in, davaci?.out, weeklyDays, weeklyFMSaat, exclusions, mode270, katSayi, apply270]);

  // ✅ HYBRID: Merge automatic rows, manual rows, and overrides
  const displayRows = useMemo(() => {
    // Start with automatic rows (filter out hidden ones)
    const automaticWithOverrides = rows
      .filter(row => !rowOverrides[row.id]?.hidden)
      .map(row => {
        const override = rowOverrides[row.id];
        if (!override) return row;
      
      // Merge override with automatic row
      const merged = { ...row, ...override };
      
      // Recalculate FM if any input changed
      if (override.weeks !== undefined || override.brut !== undefined || override.fmHours !== undefined) {
        const weeks = override.weeks ?? row.weeks;
        const brut = override.brut ?? row.brut;
        const fmHours = override.fmHours ?? row.fmHours;
        const kats = katSayi || 1;
        
        const hoursEffective = weeks * fmHours;
        const step3 = Number((brut * kats * hoursEffective).toFixed(6));
        const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
        const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
        const fm = Number(step5.toFixed(2));
        const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
        
        merged.fm = fm;
        merged.net = net;
        merged.overtimeAmount = fm;
      }
      
      return merged;
    });
    
    // Process manual rows with their overrides
    const manualWithOverrides = manualRows.map(row => {
      const override = rowOverrides[row.id];
      const merged = override ? { ...row, ...override } : row;
      
      // Recalculate FM for manual rows
      const weeks = merged.weeks ?? 0;
      const brut = merged.brut ?? 0;
      const fmHours = merged.fmHours ?? weeklyFMSaat;
      const kats = katSayi || 1;
      
      const hoursEffective = weeks * fmHours;
      const step3 = Number((brut * kats * hoursEffective).toFixed(6));
      const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
      const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
      const fm = Number(step5.toFixed(2));
      const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
      
      merged.fm = fm;
      merged.net = net;
      merged.overtimeAmount = fm;
      
      return merged;
    });
    
    // Combine automatic and manual rows with proper insertion order
    const result: CalculationRow[] = [];
    
    // Start with automatic rows
    for (const autoRow of automaticWithOverrides) {
      result.push(autoRow);
      
      // Insert any manual rows that should come after this automatic row
      const manualRowsAfterThis = manualWithOverrides.filter(
        (m: any) => m.insertAfter === autoRow.id
      );
      result.push(...manualRowsAfterThis);
    }
    
    // Add any manual rows that don't have insertAfter or reference non-existent rows
    const insertedManualIds = new Set(result.filter(r => r.isManual).map(r => r.id));
    const remainingManual = manualWithOverrides.filter(
      (m: any) => !insertedManualIds.has(m.id)
    );
    result.push(...remainingManual);
    
    return result;
  }, [rows, manualRows, rowOverrides, katSayi, weeklyFMSaat]);

  // ✅ REMOVED: setRows - rows is ONLY derived via useMemo, never set

  // Kat sayı uygulama fonksiyonu
  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    setKatSayi(katsayi);
    setHasCustomKatsayi(true);
  }, []);

  // Kat sayı kaldırma fonksiyonu
  const removeGlobalCoefficient = useCallback(() => {
    setKatSayi(1);
    setHasCustomKatsayi(false);
  }, []);

  const createManualRow = useCallback((): CalculationRow => {
    const base: CalculationRow = {
      id: buildRowId("manual"),
      startDate: "",
      endDate: "",
      year: null,
      // ✅ REMOVED fmHours - table reads directly from weeklyFMSaat
      wage: 0,
      weekCount: 0,
      originalWeekCount: 0,
      overtimeAmount: 0,
      isManual: true,
      rangeLabel: "",
      weeks: 0,
      brut: 0,
      katsayi: katSayi || 1,
      fmManual: true,
      calc225: 225,
      factor: 1.5,
      fm: 0,
      net: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
    return syncRowAliases(base);
  }, [katSayi]);

  // ✅ ADD ROW: Create new manual row after specific row
  const addRow = useCallback((afterRowId?: string) => {
    const newRow: CalculationRow = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startDate: "",
      endDate: "",
      year: null,
      fmHours: weeklyFMSaat,
      wage: 0,
      weekCount: 0,
      originalWeekCount: 0,
      overtimeAmount: 0,
      isManual: true,
      rangeLabel: "Manuel Satır",
      weeks: 0,
      brut: 0,
      katsayi: katSayi || 1,
      fmManual: true,
      calc225: FAZLA_MESAI_DENOMINATOR,
      factor: FAZLA_MESAI_KATSAYI,
      fm: 0,
      net: 0,
      startISO: "",
      endISO: "",
      manual: true,
      insertAfter: afterRowId, // Track where this row should be inserted
    };
    
    setManualRows(prev => [...prev, newRow]);
  }, [weeklyFMSaat, katSayi]);

  // ✅ REMOVE ROW: Delete row from automatic or manual
  const removeRow = useCallback((rowId: string) => {
    // Check if it's a manual row
    const isManual = manualRows.some(r => r.id === rowId);
    
    if (isManual) {
      // Remove from manual rows
      setManualRows(prev => prev.filter(r => r.id !== rowId));
      // Also remove any overrides for this row
      setRowOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[rowId];
        return newOverrides;
      });
    } else {
      // For automatic rows, we can't delete them, but we can hide them via override
      // Or we can just show an error - automatic rows should not be deleted
      console.warn('Cannot delete automatic row:', rowId);
      // Optionally: mark as hidden in overrides
      setRowOverrides(prev => ({
        ...prev,
        [rowId]: { ...prev[rowId], hidden: true }
      }));
    }
  }, [manualRows]);

  // Backend save-and-continue: detect caseId from URL and load if present
  const caseIdRef = useRef<string | null>(null);
  
  // ✅ REMOVED: loadRanRef, isBackendUpdateRef - legacy manual calculation refs
  
  const [isViewMode, setIsViewMode] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  
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

  // DEMO: Prevent copy and context menu (right-click) on document
  useEffect(() => {
    const preventCopy = (e: ClipboardEvent) => e.preventDefault();
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("copy", preventCopy);
    document.addEventListener("contextmenu", preventContextMenu);
    return () => {
      document.removeEventListener("copy", preventCopy);
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);
  
  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      
      const response = await fetch(`${API_BASE_URL}/api/saved-cases/${loadId}`, {
        headers: {
          "x-tenant-id": String(tenantId)
        }
      });
      
      // Response'un JSON olup olmadığını kontrol et
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Kayıt bulunamadı (ID: ${loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
        }
        throw new Error(data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`);
      }
      
      // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
      // data field'ı JSON string olabilir veya object olabilir
      let payload = {};
      
      if (data.data) {
        // data field'ı string ise parse et
        if (typeof data.data === 'string') {
          try {
            payload = JSON.parse(data.data);
          } catch {
            payload = {};
          }
        } else {
          payload = data.data;
        }
      }
      
      return {
        data: payload, // Orijinal payload'ı da döndür
        formValues: payload.form || payload.formValues || payload,
        name: data.name || data.notes || data.aciklama || "",
        start_date: data.start_date || payload.start_date || payload.startDate,
        end_date: data.end_date || payload.end_date || payload.endDate,
        notes: data.notes || data.aciklama || "",
        brut_total: data.brut_total || payload.brut_total || payload.brutTotal,
        net_total: data.net_total || payload.net_total || payload.netTotal,
      };
    } catch (err: any) {
      console.error('Kayıt yükleme hatası:', err);
      throw err;
    }
  };

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const loadId = id || new URLSearchParams(window.location.search).get("caseId");
    if (!loadId) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        caseIdRef.current = loadId;
        
        const data = await loadCalculation(loadId);
        
        if (!isMounted) return;
        
        // Eski format desteği için caseData'yı set et
        setCaseData({
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes,
          data: data.data?.form || data.formValues, // Yeni format veya eski format
        });
        
        // Form alanlarını doldur
        // Yeni format: data.data.form, eski format: data.formValues (geriye dönük uyumluluk için)
        const d = data.data?.form || data.formValues || {};
        
        // Tarih alanlarını yükle - önce üst seviyeden, yoksa form içinden
        console.log('[DESKTOP LOAD] data.start_date:', data.start_date);
        console.log('[DESKTOP LOAD] data.end_date:', data.end_date);
        console.log('[DESKTOP LOAD] d.iseGiris:', d.iseGiris);
        console.log('[DESKTOP LOAD] d.istenCikis:', d.istenCikis);
        console.log('[DESKTOP LOAD] d.gir:', d.gir);
        console.log('[DESKTOP LOAD] d.cik:', d.cik);
        
        if (data.start_date) {
          console.log('[DESKTOP LOAD] Setting iseGiris from data.start_date:', data.start_date);
          setIseGiris(data.start_date);
        } else if (d.iseGiris) {
          console.log('[DESKTOP LOAD] Setting iseGiris from d.iseGiris:', d.iseGiris);
          setIseGiris(d.iseGiris);
        }
        
        if (data.end_date) {
          console.log('[DESKTOP LOAD] Setting istenCikis from data.end_date:', data.end_date);
          setIstenCikis(data.end_date);
        } else if (d.istenCikis) {
          console.log('[DESKTOP LOAD] Setting istenCikis from d.istenCikis:', d.istenCikis);
          setIstenCikis(d.istenCikis);
        }
        
        if (data.notes !== undefined) setNotes(data.notes || "");
        
        // ✅ REMOVED: hasLoadedRows flag - not needed in automatic architecture
        if (d.weeklyDays !== undefined) setWeeklyDays(d.weeklyDays);
        if (d.gir !== undefined) setGir(d.gir);
        if (d.cik !== undefined) setCik(d.cik);
        if (d.davaci !== undefined) setDavaci(d.davaci);
        if (d.davali !== undefined) setDavali(d.davali);
        if (d.taniklar !== undefined) setTaniklar(d.taniklar);
        if (d.puantaj !== undefined) setPuantaj(d.puantaj);
        if (d.exclusions !== undefined) setExclusions(d.exclusions);
        if (d.include270 !== undefined) {
          // Geriye dönük uyumluluk: eski include270 boolean'ı mode270'e çevir
          setMode270(d.include270 ? "detailed" : "none");
        }
        if (d.mode270 !== undefined) setMode270(d.mode270);
        if (d.zamanasimi !== undefined) setZamanasimi(d.zamanasimi);
        if (d.zamanasimiBaslangic !== undefined) setZamanasimiBaslangic(d.zamanasimiBaslangic);
        if (d.intervals !== undefined && Array.isArray(d.intervals)) setIntervals(d.intervals);
        if (d.katSayi !== undefined) setKatSayi(d.katSayi);
        if (d.hasCustomKatsayi !== undefined) setHasCustomKatsayi(d.hasCustomKatsayi);
        if (d.mahsuplasmaMiktari !== undefined) setMahsuplasmaMiktari(d.mahsuplasmaMiktari);
        if (d.mahsuplasamaData !== undefined) setMahsuplasamaData(d.mahsuplasamaData);
        // ✅ REMOVED: rows loading - rows is ONLY derived from useMemo
        // fetchData should NOT set rows, only input states
        // The automatic architecture will recalculate rows from inputs
        if (d.rows !== undefined && Array.isArray(d.rows) && d.rows.length > 0) {
          console.log("📦 [LOAD] rows data exists in saved record (ignored - will be recalculated automatically)");
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        if (!isViewMode && !isPrintMode) {
          success(`Kayıt yüklendi (#${loadId})`);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError("Kayıt yüklenemedi");
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isViewMode, isPrintMode]);

  // ---- No persistence: ensure fresh state on reload ----
  useEffect(() => {
    try {
      // Clear any previous persisted key if exists from older versions
      localStorage.removeItem(getScopedStorageKey("fm_page_state_v1"));
    } catch {}
  }, []);

  const weeklyMode = weeklyDays === "7" ? "tatilli" : "tatilsiz";
  
  // Günlük çalışma saatleri (Davacı Beyanından)
  const dailyWorkingHours = useMemo(() => {
    const davaciGirisSaati = davaci?.in || "";
    const davaciCikisSaati = davaci?.out || "";
    if (!davaciGirisSaati || !davaciCikisSaati) return 0;
    const raw = calculateDailyWorkHours(davaciGirisSaati, davaciCikisSaati);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const brk = computeBreakHours(raw);
    return Math.max(0, raw - brk);
  }, [davaci?.in, davaci?.out]);

  // Haftalık çalışma saatleri (Davacı Beyanından)
  const weeklyFromDeclaration = useMemo(() => {
    const haftalikGunSayisi = Number(weeklyDays) || 0;
    if (haftalikGunSayisi === 7) {
      const extra = Math.max(0, dailyWorkingHours - STANDARD_DAILY_REFERENCE_HOURS);
      return dailyWorkingHours * 6 + extra;
    } else if (haftalikGunSayisi > 0 && haftalikGunSayisi < 7) {
      return dailyWorkingHours * haftalikGunSayisi;
    }
    return 0;
  }, [dailyWorkingHours, weeklyDays]);

  // Geriye dönük uyumluluk için weeklyHours
  const weeklyHours = weeklyFromDeclaration;

  // ✅ REMOVED: handleHesapla - legacy manual calculation
  // rows useMemo is the ONLY calculation source

  // ✅ REMOVED: Disabled auto-calculation useEffects
  // rows useMemo will automatically recalculate when inputs change

  // Initialize page type on mount and whenever path changes
  useEffect(() => {
    try { initializePageType(); } catch {}
  }, [location.pathname, initializePageType]);

  // NOT: 270 saat düşümü ve exclusions değişiklikleri backend'de uygulanır
  // Kullanıcı değişiklik yaptıktan sonra "Hesapla" butonuna basmalı

  // Rows değiştiğinde eksik input değerlerini senkronize et
  useEffect(() => {
    setRowInputValues((prev) => {
      let next = prev;
      let changed = false;
      rows.forEach((row) => {
        if (!row?.id) return;
        if (prev[row.id] === undefined && row.brut > 0) {
          if (!changed) {
            next = { ...prev };
            changed = true;
          }
          next[row.id] = `${String(row.brut).replace('.', ',')}₺`;
        }
      });
      return changed ? next : prev;
    });
  }, [rows]);

  // ✅ REMOVED: katSayi useEffect - katSayi is already in rows useMemo dependencies
  // Rows will recalculate automatically when katSayi changes
  // No need for manual setRows call

  // Zamanaşımını kaldır
  const handleZamanasimiIptal = () => {
    try {
      console.log('⏳ [IPTAL] Zamanaşımı kaldırılıyor');
      console.log('⏳ [IPTAL] rowsBeforeZamanaRef.current:', rowsBeforeZamanaRef.current?.length);
      
      // ✅ REMOVED: setRows - rows will recalculate automatically from useMemo
      // When zamanasimiBaslangic is cleared, rows useMemo will recalculate
      console.log('✅ [IPTAL] Zamanaşımı state temizleniyor, rows otomatik yenilenecek');
      info("Zamanaşımı itirazı kaldırıldı.");
      
      // State'leri temizle
      setZamanasimi(null);
      setZamanasimiBaslangic(null);
      prevZamanaRef.current = null;
      skipNextZamanaEffectRef.current = false;
      rowsBeforeZamanaRef.current = null;
      
      // ❌ OTOMATIK HESAPLAMA YOK - Kullanıcı manuel hesaplatmalı
      
    } catch (err) {
      console.error('❌ [IPTAL] Hata:', err);
      showToastError('Zamanaşımı kaldırma hatası');
    }
  };


  // TODO: Implement prescription (zamanaşımı) filter on frontend

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

  // Quick-add: Rapor gününü otomatik hesapla (dahil) – kullanıcı yine düzenleyebilir
  useEffect(() => {
    if (rapStart && rapEnd) {
      try {
        const s = toUTC(rapStart); const e = toUTC(rapEnd);
        const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
        setRapDays(String(days));
      } catch {}
    }
  }, [rapStart, rapEnd]);

  const totalBrut = useMemo(() => displayRows.reduce((a, r) => a + r.fm, 0), [displayRows]);
  const totalNet = useMemo(() => displayRows.reduce((a, r) => a + r.net, 0), [displayRows]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = iseGiris && istenCikis && !id;
      if (hasUnsavedData) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) {
          return;
        }
      }
      
      // ID varsa URL'den kaldır ve sayfayı yeniden yükle
      if (id) {
        window.location.href = "/fazla-mesai/standart";
        return;
      }
      
      // ID yoksa sadece state'leri temizle
      setCaseData({
        davaci: {
          startDate: "",
          endDate: "",
          startTime: "07:30",
          endTime: "17:30",
        },
        taniklar: [],
        puantaj: {},
        exclusions: [],
        saved: false,
      });
      // ✅ REMOVED: setRows - rows will be empty automatically when inputs are cleared
      setOvertimeResults([]);
      setIntervals([]);
      setNotes("");
      setIseGiris("");
      setIstenCikis("");
      setGir("");
      setCik("");
      setDavaci({ in: "", out: "" });
      setDavali({ in: "", out: "" });
      setTaniklar([]);
      setPuantaj({ start: "", end: "" });
      setExclusions([]);
      setCurrentRecordName(null);
      caseIdRef.current = null;
      console.log("🆕 [YENİ HESAPLAMA] Input states temizlendi, rows otomatik boşalacak");
      
      info("Yeni hesaplama başlatıldı.");
    } catch {}
  }, [iseGiris, istenCikis, id, info]);

  const save = () => {
    // Merkezi kayıt sistemini kullan
    // netYillik: brütten nete çeviri sonucu (ekranda gösterilen net değer)
    // brutYillik: brütten nete çeviri için kullanılan brüt değer
    console.log("💾 [SAVE] Kaydediliyor...");
    console.log("💾 [SAVE] rows:", rows);
    console.log("💾 [SAVE] rows sayısı:", rows.length);
    console.log("💾 [SAVE] İlk satır fmManual:", rows[0]?.fmManual, "fmHours:", rows[0]?.fmHours, "brut:", rows[0]?.brut);
    console.log("💾 [SAVE] brutYillik:", brutYillik, "netYillik:", netYillik);
    
    kaydetAc({
      hesapTuru: "fazla_mesai",
      veri: {
        // Yeni format: data içinde form ve results
        data: {
          form: {
            ...(caseData?.data || {}), // Eski verileri önce yükle
            // Sonra güncel değerlerle override et
            iseGiris,
            istenCikis,
            weeklyDays,
            gir,
            cik,
            davaci,
            davali,
            taniklar,
            puantaj,
            exclusions,
            include270,
            zamanasimi,
            zamanasimiBaslangic,
            intervals, // Periyot bilgileri
            katSayi, // Kat Sayı değeri
            hasCustomKatsayi, // Kat Sayı kullanılıyor mu?
            mahsuplasmaMiktari, // Mahsuplaşma miktarı
            mahsuplasamaData, // Mahsuplaşma detay verisi (yıl/ay bazlı)
            rows, // Manuel değişiklikler dahil tablo satırları (fmHours, fmManual flag'leri burada) - EN SON!
          },
          results: {
            totals: { brut: brutYillik, net: netYillik },
            brut: brutYillik,
            net: netYillik,
          }
        },
        // Geriye dönük uyumluluk için eski alanlar (backend için)
        start_date: iseGiris,
        end_date: istenCikis,
        brut_total: Number(brutYillik.toFixed(2)),
        net_total: Number(netYillik.toFixed(2)),
        notes,
        weeklyDays,
        gir,
        cik,
        davaci,
        davali,
        taniklar,
        puantaj,
        exclusions,
        include270,
        zamanasimi,
        zamanasimiBaslangic,
        intervals, // Geriye dönük uyumluluk için
        rows, // Manuel değişiklikler için tablo satırları
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `/fazla-mesai/standart/:id`,
    });
  };

  // Davacı beyanına göre hesaplama: davacı beyanı saatlerinden günlük ve haftalık saat, adım adım metin
  const computeClassic = () => {
    const davaciGirisSaati = davaci?.in || "";
    const davaciCikisSaati = davaci?.out || "";
    if (!davaciGirisSaati || !davaciCikisSaati) { setStepsText(""); return { daily: null as number | null, weekly: null as number | null }; }
    const raw = calculateDailyWorkHours(davaciGirisSaati, davaciCikisSaati); // günlük brüt çalışma
    if (!Number.isFinite(raw) || raw <= 0) { setStepsText(""); return { daily: null as number | null, weekly: null as number | null }; }
    const brk = computeBreakHours(raw);
    let daily = Math.max(0, raw - brk); // net çalışma
    let text = `${davaciGirisSaati || "??:??"} – ${davaciCikisSaati || "??:??"} = ${raw.toFixed(2)} saat çalışma\n`+
               `– ${brk.toFixed(2)} saat ara dinlenme\n`+
               `= ${daily.toFixed(2)} saat günlük çalışma\n\n`;
    let weeklyCalc = 0;
    const n = Number(weeklyDays) || 0;
    if (activeTab === "tatilli") {
      const daysWork = n > 0 ? Math.max(0, n - 1) : 6;
      const extra = Math.max(0, daily - STANDARD_DAILY_REFERENCE_HOURS);
      const weeklyWork = daily * daysWork;
      weeklyCalc = weeklyWork + extra;
      text += `${daysWork} x ${daily.toFixed(2)} = ${weeklyWork.toFixed(2)} saat haftalık çalışma\n`+
              `${daily.toFixed(2)} - 7.50 = ${extra.toFixed(2)} saat hafta tatili mesaisi\n`+
              `${weeklyWork.toFixed(2)} + ${extra.toFixed(2)} = ${weeklyCalc.toFixed(2)} saat\n`;
    } else {
      const daysWork = n > 0 ? n : 7;
      weeklyCalc = daily * daysWork;
      text += `${daysWork} × ${daily.toFixed(2)} = ${weeklyCalc.toFixed(2)} saat çalışma\n`;
    }
    const roundedWeekly = Math.round(weeklyCalc);
    const fmHours = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
    text += `Net haftalık çalışma = ${roundedWeekly} saat,\n`+
            `${roundedWeekly} – ${WEEKLY_WORK_LIMIT} saat haftalık yasal çalışma = ${fmHours} saat haftalık fazla mesai`;
    setStepsText(text);
    return { daily, weekly: weeklyCalc };
  };

  // ✅ REMOVED: Auto-calc useEffect - rows are now automatically derived via useMemo
  // No need for manual calculation triggering anymore
  
  // DEBUG: rows state değişikliklerini takip et
  useEffect(() => {
    console.log('🎯 [ROWS STATE] Güncellendi, yeni length:', rows.length);
    if (rows.length > 0) {
      console.log('🎯 [ROWS STATE] İlk satır:', rows[0]?.startDate, '→', rows[0]?.endDate);
      console.log('🎯 [ROWS STATE] Son satır:', rows[rows.length - 1]?.startDate, '→', rows[rows.length - 1]?.endDate);
    }
  }, [rows]);

  // Sekme (tatilli/tatilsiz) veya gün sayısı ya da davacı beyanı saatleri değiştiğinde açıklama metnini güncelle
  useEffect(() => {
    try { computeClassic(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weeklyDays, davaci?.in, davaci?.out]);

  // ✅ REMOVED: Disabled auto-calculation useEffect for activeTab
  // activeTab is already in rows useMemo dependencies via weeklyFMSaat

  // Zamanaşımı değiştiğinde tabloyu yeniden hesapla - GEÇİCİ OLARAK DEVRE DIŞI
  // useEffect(() => {
  //   // İlk mount'ta çalışmasın (prevZamanaRef undefined)
  //   if (prevZamanaRef.current === undefined) {
  //     console.log('⏳ [ZAMANAŞIMI useEffect] İlk mount (prevZamanaRef undefined), initialize ediliyor:', zamanasimiBaslangic);
  //     prevZamanaRef.current = zamanasimiBaslangic;
  //     return;
  //   }
    
  //   // Zamanaşımı değişmedi mi kontrol et
  //   if (prevZamanaRef.current === zamanasimiBaslangic) {
  //     console.log('⏳ [ZAMANAŞIMI useEffect] Değişmedi (prev:', prevZamanaRef.current, '= yeni:', zamanasimiBaslangic, '), atlanıyor');
  //     return;
  //   }
    
  //   console.log('⏳ [ZAMANAŞIMI useEffect] ✅ TETIKLENDI - prev:', prevZamanaRef.current, '→ yeni:', zamanasimiBaslangic);
  //   prevZamanaRef.current = zamanasimiBaslangic;
    
  //   if (rows.length > 0 || hasOvertimeResults(overtimeResults)) {
  //     console.log('⏳ [ZAMANAŞIMI useEffect] rows var (', rows.length, '), handleHesapla çağrılıyor');
  //     // loadRanRef'i geçici olarak false yap ki handleHesapla çalışsın
  //     const prevLoadRan = loadRanRef.current;
  //     loadRanRef.current = false;
  //     try { handleHesapla(undefined, true); } catch {}
  //     setTimeout(() => { loadRanRef.current = prevLoadRan; }, 100);
  //   } else {
  //     console.log('⏳ [ZAMANAŞIMI useEffect] ⚠️ rows yok ve overtimeResults yok, atlanıyor');
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [zamanasimiBaslangic]);

  // ZAMANAŞIMI ARTIK calculateOvertimeWith270AndLimitation İÇİNDE HALLOLUNUYORİ
  // Bu useEffect artık gereksiz çünkü zamanasimiBaslangic dependency'si
  // exclusions useEffect'inde zaten var (line 2029)
  // useEffect(() => {
  //   ... ESKİ ZAMANAŞIMI MANTIGI KALDIRILDI ...
  // }, [zamanasimiBaslangic]);

  // activeTab ve weeklyDays değişimi yukarıdaki useEffect'lerde halloldu

  // Fazla mesai hesapla (canlı form verileri) - Sadece Davacı Beyanı
  const handleCalculateOvertime = async () => {
    logger.calc('handleCalculateOvertime BAŞLADI', {
      'davaci.dateIn': davaci?.dateIn,
      'davaci.dateOut': davaci?.dateOut,
      'davaci.in': davaci?.in,
      'davaci.out': davaci?.out
    });
    
    // Davacı beyanı kontrolü
    const davaciBeyani = {
      startDate: normalizeDate(davaci?.dateIn) || '',
      endDate: normalizeDate(davaci?.dateOut) || '',
      startTime: normalizeTime(davaci?.in) || '',
      endTime: normalizeTime(davaci?.out) || '',
    };
    
    logger.calc('handleCalculateOvertime: Davacı beyanı normalize edildi', davaciBeyani);

    // Davacı beyanı eksikse hesaplama yapma
    if (!davaciBeyani.startDate || !davaciBeyani.endDate || !davaciBeyani.startTime || !davaciBeyani.endTime) {
      logger.warn('handleCalculateOvertime: Davacı beyanı eksik, hesaplama yapılmıyor', davaciBeyani);
      setOvertimeResults([]);
      setIntervals([]);
      return;
    }

    // eslint-disable-next-line no-console
    console.group("🧮 handleCalculateOvertime Debug (Davacı Beyanı)");
    const haftalikGunSayisi = Number(weeklyDays) || 0;
    console.log("📊 weeklyDays state:", weeklyDays, "→ haftalikGunSayisi:", haftalikGunSayisi);
    
    try {
      const mod = await import("@/utils/intervalHelper");
      const calculateOvertimeHours = (mod as any).calculateOvertimeHours;

      // Davacı beyanından direkt interval oluştur
      const davaciInterval = {
        start: davaciBeyani.startDate,
        end: davaciBeyani.endDate,
        start_time: davaciBeyani.startTime,
        end_time: davaciBeyani.endTime,
        haftalikGun: haftalikGunSayisi,
      };

      // eslint-disable-next-line no-console
      console.log("📥 Davacı beyanı interval:", davaciInterval);

      // Fazla mesai hesapla
      const { results, toplamFazlaMesai } = calculateOvertimeHours([davaciInterval]);
      // eslint-disable-next-line no-console
      console.log("✅ Hesaplanan sonuçlar:", results, "Toplam:", toplamFazlaMesai);
      
      // NOT: Segmentasyon handleHesapla içinde yapılacak
      // overtimeResults tek bir geniş aralık olarak kalır
      // handleHesapla içinde yıllara ve asgari ücret dönemlerine bölünür

      setOvertimeResults(results as any);
      setIntervals([davaciInterval]);
      
      // Results'u return et ki direkt kullanılabilsin
      return results as any[];
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("❌ handleCalculateOvertime hata:", err);
      setOvertimeResults([]);
      setIntervals([]);
      return [];
    } finally {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    // Üstteki gri bilgi kutusunun haftalık FM'yi göstermesi için, eğer boşsa gir/cik'i davacı saatlerinden çek
    const nIn = normalizeTime(davaciBeyani.startTime) || '';
    const nOut = normalizeTime(davaciBeyani.endTime) || '';
    if (!gir && nIn) {
      // eslint-disable-next-line no-console
      console.log('[DEV] gir set from claimant:', davaciBeyani.startTime, '→', nIn);
      setGir(nIn);
    }
    if (!cik && nOut) {
      // eslint-disable-next-line no-console
      console.log('[DEV] cik set from claimant:', davaciBeyani.endTime, '→', nOut);
      setCik(nOut);
    }
    // Eğer ana dönem tarihleri boşsa, davacı beyanından normalize ederek doldur
    const nStart = davaciBeyani.startDate || undefined;
    const nEnd = davaciBeyani.endDate || undefined;
    if (!iseGiris && nStart) {
      // eslint-disable-next-line no-console
      console.log('[DEV] iseGiris normalize & set:', davaciBeyani.startDate, '→', nStart);
      setIseGiris(nStart);
    }
    if (!istenCikis && nEnd) {
      // eslint-disable-next-line no-console
      console.log('[DEV] istenCikis normalize & set:', davaciBeyani.endDate, '→', nEnd);
      setIstenCikis(nEnd);
    }
  };

  const weeklyFMHours = Math.max(0, weeklyHours - WEEKLY_WORK_LIMIT);

  // Tek tarih aralığı için metin bloğu (tarih aralığı başlığı olmadan)
  const fmText = useMemo(() => {
    try {
      const arr = overtimeResults || [];
      if (!arr.length) return '';
      const r = arr[0] as any;
      
      // start_time ve end_time varsa yeni hesaplama fonksiyonunu kullan
      let brut = Number(r.brutCalisma ?? 0);
      let brk = 1; // varsayılan değer
      
      if (r.start_time && r.end_time) {
        const calculatedBrut = calculateDailyWorkHours(r.start_time, r.end_time);
        if (Number.isFinite(calculatedBrut) && calculatedBrut > 0) {
          brut = calculatedBrut;
          brk = computeBreakHours(brut);
        }
      } else if (brut > 0) {
        // Eğer start_time/end_time yoksa mevcut brut değerinden mola hesapla
        brk = computeBreakHours(brut);
      }
      
      // Net günlük çalışma = brut - mola (doğru hesaplama)
      const netGunluk = Math.max(0, brut - brk);
      const hg = Number(r.haftalikGun ?? 0);
      
      // Haftalık çalışma ve fazla mesaiyi netGunluk'a göre yeniden hesapla (tek yerde yuvarlama)
      const haftalik = netGunluk * hg;
      const roundedWeekly = Math.round(haftalik);
      const fm = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
      
      const fmtH = (n: number) => n.toFixed(2).replace(".", ",");
      
      // Tarih aralığı başlığı olmadan tek metin bloğu
      if (Number(weeklyDays) === 7 && activeTab === 'tatilli') {
        const weeklyWork = netGunluk * 6;
        const extraHT = Math.max(0, netGunluk - STANDARD_DAILY_REFERENCE_HOURS);
        const toplamCalisma = weeklyWork + extraHT;
        const roundedToplam = Math.round(toplamCalisma);
        const fmTatilli = Math.max(0, roundedToplam - WEEKLY_WORK_LIMIT);
        return `${r.start_time || ''}–${r.end_time || ''} = ${fmtH(brut)} saat çalışma\n`+
               `- ${fmtH(brk)} saat ara dinlenme = ${fmtH(netGunluk)} saat günlük çalışma\n`+
               `6 x ${fmtH(netGunluk)} = ${fmtH(weeklyWork)} saat haftalık çalışma\n`+
               `${fmtH(netGunluk)}-7,5 = ${fmtH(extraHT)} saat hafta tatili mesaisi\n`+
               `${fmtH(weeklyWork)}+${fmtH(extraHT)} = ${fmtH(toplamCalisma)} saat\n`+
               `Net haftalık çalışma = ${roundedToplam} saat,\n`+
               `${roundedToplam} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fmTatilli} saat haftalık fazla mesai`;
      } else {
        return `${r.start_time || ''}–${r.end_time || ''} = ${fmtH(brut)} saat çalışma\n`+
               `- ${fmtH(brk)} saat ara dinlenme = ${fmtH(netGunluk)} saat günlük çalışma\n`+
               `${hg} x ${fmtH(netGunluk)} = ${fmtH(haftalik)} saat\n`+
               `Net haftalık çalışma = ${roundedWeekly} saat,\n`+
               `${roundedWeekly} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fm} saat haftalık fazla mesai`;
      }
    } catch {
      return '';
    }
  }, [overtimeResults, activeTab, weeklyDays]);

  // YENİ RAPOR SİSTEMİ: Config
  const fazlaMesaiReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // SGK ve İşsizlik Primi
    const sgkPrimi = Math.round(brutYillik * 0.14 * 100) / 100;
    const issizlikPrimi = Math.round(brutYillik * 0.01 * 100) / 100;
    
    // Mahsuplaşma hesabı
    const mahsuplasmaNum = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
    const hakkaniyetIndirimi = Number(brutYillik || 0) / 3;
    const mahsuplamaSonucu = Math.max(0, brutYillik - hakkaniyetIndirimi - mahsuplasmaNum);

    const fmTextValue = fmText || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? (txtTatilsiz || "") : (txtTatilli || "")) : (txtUnderSeven || ""));

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
        { label: "Haftalık Çalışma Saati", value: `${weeklyFMSaat} saat` },
      ],
      customSections: [
        ...(fmTextValue ? [
          {
            title: "Fazla Mesai Açıklama",
            condition: true,
            content: (
              <pre style={{
                fontSize: '13px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                width: '100%',
                maxWidth: '100%',
                margin: 0,
                padding: '16px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 300,
                color: '#374151',
                boxSizing: 'border-box',
              }}>
                {fmTextValue}
              </pre>
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
                  {(exclusions || []).map((ex: Excl) => (
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
        fontSize: "9px",
        headers: ["Dönem", "Hafta Sayısı", "Ücret (BRÜT)", "Katsayı", "FM Saati", "225", "1,5", "Fazla Mesai Ücreti"],
        rows: displayRows.map(row => [
          row.rangeLabel,
          row.weeks.toString(),
          `${fmtLocal(row.brut)}₺`,
          row.katsayi.toFixed(4),
          row.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),  // ✅ SINGLE SOURCE: 1 decimal place
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
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, weeklyFMSaat, fmText, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, displayRows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari, exclusions]);

  // Bölüm bazlı Word tabloları (DavaciUcreti / Ihbar sayfaları ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (fazlaMesaiReportConfig.infoRows && fazlaMesaiReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: fazlaMesaiReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const fmTextVal = fmText || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
    if (fmTextVal) {
      // Newlines preserved - pre displays 6 lines like the real page (modal overflow fix)
      const escaped = String(fmTextVal)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const html = `<table border="1" cellpadding="2" cellspacing="0"><tr><td><pre style="white-space:pre-wrap;margin:0;padding:8px;font-size:13px;word-break:break-word;">${escaped}</pre></td></tr></table><p>&nbsp;</p>`;
      sections.push({ id: "fazla-mesai-aciklama", title: "Fazla Mesai Açıklama", html });
    }

    if ((exclusions || []).length > 0) {
      const exclRows = (exclusions || []).map((ex: Excl) => [
        ex.type || "Yıllık İzin",
        ex.start ? new Date(ex.start).toLocaleDateString("tr-TR") : "-",
        ex.end ? new Date(ex.end).toLocaleDateString("tr-TR") : "-",
        String(ex.days ?? "-"),
      ]);
      const nExcl = adaptToWordTable({ headers: ["Tür", "Başlangıç", "Bitiş", "Gün"], rows: exclRows });
      sections.push({ id: "yillik-izin-dislamalari", title: "Yıllık İzin Dışlamaları", html: buildWordTable(nExcl.headers, nExcl.rows) });
    }

    const pd = fazlaMesaiReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer && pd.footer.length > 0) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = fazlaMesaiReportConfig.grossToNetData?.rows;
    if (gnd && gnd.length > 0) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = fazlaMesaiReportConfig.mahsuplasmaData;
    if (md && md.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [fazlaMesaiReportConfig, fmText, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  // Auto compute classic text and periods when davacı beyanı inputs change
  useEffect(() => {
    // Davacı beyanı saatlerinden hesaplama
    const davaciGirisSaati = davaci?.in || "";
    const davaciCikisSaati = davaci?.out || "";
    if (davaciGirisSaati && davaciCikisSaati) {
      const raw = calculateDailyWorkHours(davaciGirisSaati, davaciCikisSaati); // günlük brüt
      if (Number.isFinite(raw) && raw > 0) {
        const brk = computeBreakHours(raw);
        const dailyWork = Math.max(0, raw - brk); // net günlük
        const fmtH = (n: number) => n.toFixed(2).replace(".", ",");
        const tatilsizWeekly = dailyWork * 7;
        const roundedTatilsiz = Math.round(tatilsizWeekly);
        const tatilsizFM = Math.max(0, roundedTatilsiz - WEEKLY_WORK_LIMIT);
        const t1 = `${davaciGirisSaati || "??:??"} - ${davaciCikisSaati || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
                   `- ${fmtH(brk)} saat ara dinlenme\n`+
                   `= ${fmtH(dailyWork)} saat günlük çalışma\n`+
                   `7 x ${fmtH(dailyWork)} = ${fmtH(tatilsizWeekly)} saat çalışma\n`+
                   `Net haftalık çalışma = ${roundedTatilsiz} saat,\n`+
                   `${roundedTatilsiz} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${tatilsizFM} saat haftalık fazla mesai`;
        setTxtTatilsiz(t1);

        const extraHT = Math.max(0, dailyWork - STANDARD_DAILY_REFERENCE_HOURS);
        const tatilliWeekly = dailyWork * 6 + extraHT;
        const roundedTatilli = Math.round(tatilliWeekly);
        const tatilliFM = Math.max(0, roundedTatilli - WEEKLY_WORK_LIMIT);
        const t2 = `${davaciGirisSaati || "??:??"} - ${davaciCikisSaati || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
                   `- ${fmtH(brk)} saat ara dinlenme\n`+
                   `= ${fmtH(dailyWork)} saat günlük çalışma\n`+
                   `6 x ${fmtH(dailyWork)} = ${fmtH(dailyWork*6)} saat çalışma\n`+
                   `${fmtH(dailyWork)} - 7,5 = ${fmtH(extraHT)} saat hafta tatili fazla çalışma mesaisi\n`+
                   `= ${fmtH(tatilliWeekly)} saat çalışma\n`+
                   `Net haftalık çalışma = ${roundedTatilli} saat,\n`+
                   `${roundedTatilli} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${tatilliFM} saat haftalık fazla mesai`;
        setTxtTatilli(t2);

        // 1..6 gün için tek kutu metni (weeklyDays dinamik)
        const n = Number(weeklyDays || '0');
        let tN_local = "";
        if (n >= 1 && n <= 7) {
          const weekly = dailyWork * n;
          const roundedWeekly = Math.round(weekly);
          const fmVal = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
          const last = fmVal > 0 ? `= ${fmVal} saat haftalık fazla mesai` : `= Fazla mesai bulunmamaktadır`;
          tN_local = `${davaciGirisSaati || "??:??"} - ${davaciCikisSaati || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
                     `- ${fmtH(brk)} saat ara dinlenme\n`+
                     `= ${fmtH(dailyWork)} saat günlük çalışma\n`+
                     `${n} x ${fmtH(dailyWork)} = ${fmtH(weekly)} saat çalışma\n`+
                     `Net haftalık çalışma = ${roundedWeekly} saat,\n`+
                     `${roundedWeekly} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma ${last}`;
          setTxtUnderSeven(tN_local);
        } else {
          setTxtUnderSeven("");
        }
        // Haftalık fazla mesaiyi doğrudan sayısal hesapla (sekme ve gün sayısına göre)
        const nwd = Number(weeklyDays) || 0;
        let fmCalc = 0;
        if (nwd === 7) {
          if (activeTab === 'tatilsiz') {
            const w = dailyWork * 7;
            fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
          } else {
            const extraHT2 = Math.max(0, dailyWork - STANDARD_DAILY_REFERENCE_HOURS);
            const w = dailyWork * 6 + extraHT2;
            fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
          }
        } else if (nwd > 0 && nwd < 7) {
          const w = dailyWork * nwd;
          fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
        } else {
          fmCalc = 0;
        }
        // weeklyFMSaat useMemo otomatik hesaplanıyor, state güncellemeye gerek yok
      } else {
        setTxtTatilsiz("");
        setTxtTatilli("");
        setTxtUnderSeven("");
      }
    } else {
      setTxtTatilsiz("");
      setTxtTatilli("");
      setTxtUnderSeven("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci?.in, davaci?.out, davaci?.dateIn, davaci?.dateOut, weeklyDays, activeTab, weeklyFromDeclaration]);

  // ✅ REMOVED: exclusions useEffect - legacy manual calculation
  // rows useMemo already handles exclusions automatically via calculateWeekCount
  
  // ✅ REMOVED: weeklyFMSaat useEffect - legacy manual calculation
  // rows useMemo already recalculates when weeklyFMSaat changes
  
  // ✅ REMOVED: All legacy useEffects with setRows and deleted refs
  // rows useMemo is the ONLY calculation source

  const isReadOnly = isViewMode || isPrintMode;
  
  // Print mode: Render report content directly
  if (isPrintMode) {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sgkPrimi = Math.round(brutYillik * 0.14 * 100) / 100;
    const issizlikPrimi = Math.round(brutYillik * 0.01 * 100) / 100;
    const mahsuplasmaNum = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
    const hakkaniyetIndirimi = Number(brutYillik || 0) / 3;
    const mahsuplamaSonucu = Math.max(0, brutYillik - hakkaniyetIndirimi - mahsuplasmaNum);

    return (
      <div className="p-8 bg-white" style={{ maxWidth: '210mm', margin: '0 auto' }}>
        <style>{`
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 15mm; }
          }
        `}</style>
        
        <h1 className="text-2xl font-bold mb-6 text-center">{resolvedTitle}</h1>
        
        {/* Bilgi Tablosu */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Genel Bilgiler</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <tbody>
              <tr><td className="border border-gray-300 px-3 py-2 font-medium bg-gray-50">İşe Giriş Tarihi</td><td className="border border-gray-300 px-3 py-2">{iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-"}</td></tr>
              <tr><td className="border border-gray-300 px-3 py-2 font-medium bg-gray-50">İşten Çıkış Tarihi</td><td className="border border-gray-300 px-3 py-2">{istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-"}</td></tr>
              <tr><td className="border border-gray-300 px-3 py-2 font-medium bg-gray-50">Haftada Çalışılan Gün</td><td className="border border-gray-300 px-3 py-2">{weeklyDays} gün</td></tr>
              <tr><td className="border border-gray-300 px-3 py-2 font-medium bg-gray-50">Haftalık Çalışma Saati</td><td className="border border-gray-300 px-3 py-2">{weeklyFMSaat} saat</td></tr>
            </tbody>
          </table>
        </div>

        {/* Fazla Mesai Cetveli */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Fazla Mesai Hesaplama Cetveli</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left">Dönem</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Hafta</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Ücret</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Katsayı</th>
                <th className="border border-gray-300 px-2 py-2 text-right">FM Saati</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Fazla Mesai</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-2 py-1">{row.rangeLabel}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{row.weeks}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmtLocal(row.brut)}₺</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{row.katsayi.toFixed(4)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{row.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium">{fmtLocal(row.fm)}₺</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border border-gray-300 px-2 py-2 text-right">Toplam:</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{fmtLocal(totalBrut)}₺</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Brütten Nete */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Brüt'ten Net'e Çeviri</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <tbody>
              <tr><td className="border border-gray-300 px-3 py-2">Brüt Yıllık Fazla Mesai</td><td className="border border-gray-300 px-3 py-2 text-right font-medium">{fmtLocal(brutYillik)}₺</td></tr>
              <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">SGK Primi (%14)</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(sgkPrimi)}₺</td></tr>
              <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">İşsizlik Primi (%1)</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(issizlikPrimi)}₺</td></tr>
              <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">Gelir Vergisi {gelirVergisiDilimleri}</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(gelirVergisi)}₺</td></tr>
              <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">Damga Vergisi (Binde 7,59)</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(damgaVergisi)}₺</td></tr>
              <tr className="bg-green-50 font-bold text-green-700"><td className="border border-gray-300 px-3 py-2">Net Yıllık Fazla Mesai</td><td className="border border-gray-300 px-3 py-2 text-right">{fmtLocal(netYillik)}₺</td></tr>
            </tbody>
          </table>
        </div>

        {/* Mahsuplaşma */}
        {mahsuplasmaNum > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Mahsuplaşma</h2>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Brüt Fazla Mesai</td><td className="border border-gray-300 px-3 py-2 text-right">{fmtLocal(brutYillik)}₺</td></tr>
                <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">1/3 Hakkaniyet İndirimi</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(hakkaniyetIndirimi)}₺</td></tr>
                <tr className="text-red-600"><td className="border border-gray-300 px-3 py-2">Mahsuplaşma Miktarı</td><td className="border border-gray-300 px-3 py-2 text-right">-{fmtLocal(mahsuplasmaNum)}₺</td></tr>
                <tr className="bg-blue-50 font-bold text-blue-700"><td className="border border-gray-300 px-3 py-2">Mahsuplaşma Sonucu</td><td className="border border-gray-300 px-3 py-2 text-right">{fmtLocal(mahsuplamaSonucu)}₺</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <>
    <Layout
      title={resolvedTitle}
      description={isViewMode ? "Rapor Görüntüleme" : isPrintMode ? "Yazdırma" : "Fazla Mesai Alacağı Hesaplama"}
      hideHeader={true}
      fluid={true}
      pageKey="fazla-mesai"
      noBackgroundColor={true}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        {/* Header / Navbar - Logo + Deneme Sürümü */}
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 py-2 flex items-center justify-between gap-3">
            <a href="/" className="flex items-center min-w-0">
              <img src="/logo.png" alt="Bilirkisi Hesaplama Araçları" className="h-12 sm:h-14 w-auto object-contain flex-shrink-0" />
            </a>
            <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
              Deneme Sürümü
            </span>
          </div>
        </header>
        {/* DEMO: Full-page watermark - fixed center, rotated, above content (pointer-events: none so clicks pass through) */}
        <div
          className="fixed pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-30deg)",
            zIndex: 50,
          }}
          aria-hidden="true"
        >
          <span
            className="text-gray-900 dark:text-gray-100 whitespace-nowrap"
            style={{ fontSize: "10vw", fontWeight: 800, opacity: 0.05 }}
          >
            DENEME SÜRÜMÜ
          </span>
        </div>
        {/* Sol / Sağ reklam alanları - Formu daraltmadan sayfa kenarlarında sabit */}
        {/* Önerilen görsel boyutları: 160×400 px (lg) veya 192×400 px (xl). Skyscraper için 160×600 px de uygun. */}
        {/* Sol/sağ banner: 192px genişlik, görsel 192×1400 px önerilir. Çerçeve/arka plan yok, sadece görsel. */}
        <aside className="hidden lg:flex fixed left-2 top-24 z-30 overflow-hidden flex-col items-center rounded-lg" style={{ width: 192, bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }} aria-label="Reklam alanı">
          <img src="/deneme%20test.png" alt="Deneme görsel" className="w-full h-full min-h-0 object-contain object-top rounded-lg" />
        </aside>
        <aside className="hidden lg:flex fixed top-24 z-30 overflow-hidden flex-col items-center rounded-lg" style={{ width: 192, right: 'max(1.25rem, calc(1.25rem + env(safe-area-inset-right)))', bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }} aria-label="Reklam alanı">
          <img src="/sagbanner.png" alt="Sağ banner" className="w-full h-full min-h-0 object-contain object-top rounded-lg" />
        </aside>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 select-none relative z-[2]" style={{ paddingBottom: 'max(6rem, calc(5rem + env(safe-area-inset-bottom, 0px)))' }}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
            Standart Fazla Mesai Hesaplama
          </h1>
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-end gap-2">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-6 md:p-8 space-y-4">
        <div className="w-full space-y-4">
        {/* Ana Form - Tam Sayfa */}
        <div className="space-y-4">
          {/* Üst Alan - Tarihler ve Beyanlar */}
          <div className="space-y-4 divide-y divide-gray-100 text-sm leading-tight" style={{ fontSize: '13px', lineHeight: '1.3' }}>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">Haftada Çalışılan Gün <span className="text-gray-500" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className={inputClass} value={weeklyDays} onChange={(e)=>{
                  const newVal = e.target.value;
                  setWeeklyDays(newVal);
                  console.log("📝 [WEEKLY DAYS] Değişti:", newVal);
                }} readOnly={isReadOnly} />
              </div>
            </div>

          {/* Zamanaşımı Modal - Portal ile body'ye render edilir */}
          <ZamanasimiModal
            isOpen={showZamanaModal}
            onClose={() => {
              setShowZamanaModal(false);
              // prevZamanaRef'e dokunma - useEffect'te otomatik güncellenir
            }}
            onApply={(payload) => {
              if (payload.nihaiBaslangic) {
                console.log('⏳ [MODAL] Zamanaşımı uygulandı:', payload.nihaiBaslangic);
                
                // Zamanaşımı uygulanmadan ÖNCE mevcut rows'u snapshot al (deep copy)
                if (rows.length > 0) {
                  rowsBeforeZamanaRef.current = JSON.parse(JSON.stringify(rows));
                  console.log('📸 [SNAPSHOT] Zamanaşımı öncesi snapshot alındı:', rows.length, 'satır');
                } else {
                  rowsBeforeZamanaRef.current = null;
                  console.log('⚠️ [SNAPSHOT] rows boş, snapshot alınmadı');
                }
                
                setZamanasimi(payload);
                setZamanasimiBaslangic(payload.nihaiBaslangic);
                
                info("Zamanaşımı uygulandı. Hesaplama için 'Hesapla' butonuna basın.");
              }
            }}
            zForm={zForm}
            setZForm={setZForm}
            showToastError={showToastError}
            iseGiris={iseGiris}
          />
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-l-4 border-purple-500 dark:border-purple-400 rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-bold text-purple-900 dark:text-purple-300">Beyan Bilgileri</span>
            </div>
            <details className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 dark:bg-gray-800/50" open>
              <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200 flex items-center justify-between list-none">
                <span>Davacı Beyanı</span>
                <svg className="w-5 h-5 transition-transform duration-200 details-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Giriş Tarihi</div>
                    <input 
                      type="date" 
                      className={inputClass}
                      value={iseGiris || ''}
                      onChange={(e) => setIseGiris(e.target.value)}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Çıkış Tarihi</div>
                    <input 
                      type="date" 
                      className={inputClass}
                      value={istenCikis || ''}
                      onChange={(e) => setIstenCikis(e.target.value)}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Giriş Saati</div>
                    <input 
                      type="time" 
                      className={inputClass}
                      value={davaci.in} 
                      onChange={(e)=>{
                        const value = e.target.value;
                        logger.input('davaci.in (Giriş Saati)', value);
                        setDavaci((p)=>({...p,in:value}));
                        if (!calculationSent) {
                          fetch("http://localhost:4000/demo-track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ event: "calculation" }),
                          }).catch(() => {});
                          setCalculationSent(true);
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Çıkış Saati</div>
                    <input 
                      type="time" 
                      className={inputClass}
                      value={davaci.out} 
                      onChange={(e)=>{
                        const value = e.target.value;
                        logger.input('davaci.out (Çıkış Saati)', value);
                        setDavaci((p)=>({...p,out:value}));
                        if (!calculationSent) {
                          fetch("http://localhost:4000/demo-track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ event: "calculation" }),
                          }).catch(() => {});
                          setCalculationSent(true);
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                </div>
              </div>
            </details>

            {isCalculating && (
              <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700 rounded-xl shadow-sm animate-in fade-in">
                <svg className="animate-spin h-5 w-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span className="text-sm font-medium text-purple-900 dark:text-purple-300">Hesaplanıyor...</span>
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
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg hover:bg-gray-100 transition-colors flex items-center justify-between list-none">
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
                      {activeTab === "tatilsiz" && (
                        <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{fmText || txtTatilsiz || "Giriş/çıkış saatlerini giriniz."}</pre>
                      )}
                      {activeTab === "tatilli" && (
                        <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{fmText || txtTatilli || "Giriş/çıkış saatlerini giriniz."}</pre>
                      )}
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{weeklyFMSaat.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#f1f3f5] border rounded-md p-3">
                      <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{fmText || txtUnderSeven || "Giriş/çıkış saatlerini giriniz."}</pre>
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{weeklyFMSaat.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>

          {/* HESAPLAMA KURALLARI - ZARİF BUTONLAR */}
          <div className="mt-5 mb-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 text-sm">
            {/* 270 SAAT DÜŞÜM - DROPDOWN BUTON */}
            <div className="relative w-full sm:w-auto sm:min-w-0">
              {/* Ana Buton */}
              <button
                type="button"
                onClick={() => setShow270Dropdown(!show270Dropdown)}
                className={`relative z-10 w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
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
                <div className="absolute top-full left-0 right-0 sm:right-auto sm:w-64 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden animate-in fade-in duration-200">
                  {/* Kapalı */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode270("none");
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
                if (zamanasimiBaslangic) {
                  handleZamanasimiIptal();
                } else {
                  setShowZamanaModal(true);
                }
              }}
              className={`w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                zamanasimiBaslangic
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-transparent shadow-md hover:from-blue-600 hover:to-blue-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {zamanasimiBaslangic && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}</span>
              <span 
                className={`cursor-help ${zamanasimiBaslangic ? "text-blue-100 hover:text-white" : "text-blue-600 hover:text-blue-700"}`}
                title="Zamanaşımı tarihinden önceki dönemler hesaba dahil edilmez"
              >
                ⓘ
              </span>
            </button>

            {/* KATSAYI - ZARİF BUTON */}
            <button
              type="button"
              onClick={() => {
                if (hasCustomKatsayi) {
                  removeGlobalCoefficient();
                } else {
                  setShowKatsayiModal(true);
                }
              }}
              className={`w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                hasCustomKatsayi
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white border-transparent shadow-md hover:from-green-600 hover:to-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50 hover:text-green-600"
              }`}
            >
              {hasCustomKatsayi && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{hasCustomKatsayi ? "Katsayı" : "Kat Sayı Hesapla"}</span>
              <span 
                className={`cursor-help ${hasCustomKatsayi ? "text-green-100 hover:text-white" : "text-green-600 hover:text-green-700"}`}
                title="Özel katsayı ile hesaplama yapın"
              >
                ⓘ
              </span>
            </button>
          </div>

          {/* 270 Düşüm Bilgisi */}
          {mode270 !== "none" && haftaDususBilgisi !== null && (
            <div className="mb-4 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
              {typeof haftaDususBilgisi === 'string' ? (
                <span>{haftaDususBilgisi}</span>
              ) : (
                <span>270 saatlik yasal sınır kapsamında her çalışma yılı için toplam <b>{haftaDususBilgisi}</b> hafta hesaplamadan çıkarılmıştır.</span>
              )}
            </div>
          )}

          {/* Alt Alan - Dışlamalar (akordiyon panel) ve Tablo */}
          <div className="soft-card space-y-3">
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

            {/* Üst bilgi: Zamanaşımı etiketi */}
            {zamanasimiBaslangic && rows.length > 0 && (
              <div className="text-sm text-blue-600 mt-2 mb-2">
                Zamanaşımı başlangıç tarihi: {formatTR(normalizeLocalDate(zamanasimiBaslangic))} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
              </div>
            )}

            <div className="fazla-mesai-table-wrapper mt-2 mb-2 overflow-x-auto w-full select-none -mx-1 sm:mx-0 px-1 sm:px-0" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
              <table className="w-full text-[11px] sm:text-xs border-[0.5px] border-gray-300 min-w-[680px]" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', lineHeight: '1.2' }}>
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '3%' }} />
                </colgroup>
                <thead className="bg-[#f8f9fa]" style={{ borderBottom: '1px solid #d0d0d0' }}>
                  <tr>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-left font-semibold text-xs leading-tight">Tarih Aralığı</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Hafta</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Ücret</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Kat Sayı <span className="hidden sm:inline text-gray-500 cursor-help" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">FM Saati <span className="hidden sm:inline text-gray-500 cursor-help" title="Hesaplanan haftalık fazla mesai saati; gerekirse satır bazlı düzenleyebilirsiniz.">ℹ️</span></th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">225</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">1,5</th>
                    <th className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-xs leading-tight">Fazla Mesai</th>
                    <th className="border-0 bg-transparent"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight">—</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">0</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">{fmt(0)}</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          value="0,00"
                          readOnly
                          className="w-full max-w-20 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-[11px] sm:text-xs bg-gray-50 leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">225</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1,5</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-medium text-[11px] sm:text-xs leading-tight">{fmt(0)}</td>
                      <td className="border-0 bg-transparent w-8"></td>
                    </tr>
                  ) : (
                    displayRows.map((r, i) => (
                    <tr 
                      key={r.id} 
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
                              const newStartISO = e.target.value;
                              setRowOverrides(prev => ({
                                ...prev,
                                [r.id]: {
                                  ...prev[r.id],
                                  startISO: newStartISO,
                                  startDate: newStartISO,
                                  rangeLabel: `${formatDateTRStr(newStartISO)}–${formatDateTRStr(r.endISO)}`,
                                }
                              }));
                            }}
                            className="w-24 text-[11px] sm:text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight"
                          />
                          <span>–</span>
                          <input
                            type="date"
                            value={r.endISO}
                            onChange={(e) => {
                              const newEndISO = e.target.value;
                              setRowOverrides(prev => ({
                                ...prev,
                                [r.id]: {
                                  ...prev[r.id],
                                  endISO: newEndISO,
                                  endDate: newEndISO,
                                  rangeLabel: `${formatDateTRStr(r.startISO)}–${formatDateTRStr(newEndISO)}`,
                                }
                              }));
                            }}
                            className="w-24 text-[11px] sm:text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight"
                          />
                        </div>
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          type="number"
                          value={r.weeks}
                          onChange={(e) => {
                            const newWeeks = Number(e.target.value) || 0;
                            setRowOverrides(prev => ({
                              ...prev,
                              [r.id]: {
                                ...prev[r.id],
                                weeks: newWeeks,
                                weekCount: newWeeks,
                              }
                            }));
                          }}
                          className="w-14 text-right text-[11px] sm:text-xs rounded border-[0.5px] border-gray-300 px-1 py-0.5 leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          type="text"
                          value={r.brut > 0 ? `${String(r.brut).replace('.', ',')}₺` : ''}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const numValue = Number(String(rawValue).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                            setRowOverrides(prev => ({
                              ...prev,
                              [r.id]: {
                                ...prev[r.id],
                                brut: numValue,
                                wage: numValue,
                              }
                            }));
                          }}
                          placeholder={(() => {
                            const normalizedAsgari = normalizeCurrency(asgariUcretler);
                            const au = normalizedAsgari.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || normalizedAsgari[normalizedAsgari.length - 1];
                            return fmt(au.brut);
                          })()}
                          className="w-full max-w-32 text-right rounded border-[0.5px] border-gray-300 px-1 py-0.5 text-[11px] sm:text-xs leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right text-[11px] sm:text-xs leading-tight">{Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">
                        <input
                          type="text"
                          value={String(r.fmHours || 0).replace('.', ',')}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const numValue = Number(String(rawValue).replace(',', '.').trim()) || 0;
                            setRowOverrides(prev => ({
                              ...prev,
                              [r.id]: {
                                ...prev[r.id],
                                fmHours: numValue,
                              }
                            }));
                          }}
                          className="w-14 text-right text-[11px] sm:text-xs rounded border-[0.5px] border-gray-200 px-1 py-0.5 leading-tight"
                        />
                      </td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">225</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right leading-tight">1,5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-[11px] sm:text-xs">{fmt(r.fm)}</td>
                      <td className="border-0 bg-transparent w-10 p-0">
                        {hoveredRow === i && (
                          <div className="flex items-center gap-1 justify-end pr-1">
                            <button
                              type="button"
                              className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer"
                              onClick={() => addRow(r.id)}
                              title="Bu satırın altına yeni bir satır ekler"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              disabled={displayRows.length <= 1}
                              className={`text-red-500 hover:text-red-600 cursor-pointer ${displayRows.length <= 1 ? "opacity-40 cursor-not-allowed" : ""}`}
                              onClick={() => {
                                if (displayRows.length <= 1) return;
                                removeRow(r.id);
                              }}
                              title={displayRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                            >
                              -
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                  {rows.length > 0 && (
                    <tr style={{ borderTop: '1px solid #999' }} className="bg-[#f1f3f5]">
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 font-semibold text-[11px] sm:text-xs leading-tight">Toplam Fazla Mesai:</td>
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5" />
                      <td className="border-[0.5px] border-gray-300 px-1 py-0.5 text-right font-semibold text-[11px] sm:text-xs leading-tight">{fmt(totalBrut)}</td>
                      <td className="border-0 bg-transparent w-8"></td>
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

          {/* İki Ayrı Kart: Solda Brütten Nete, Sağda Mahsuplaşma - DEMO: no selection */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
            {/* Kart 1: Brütten Nete Çevir */}
            <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 md:col-span-2">
              <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
                Brütten Nete Çevir
              </h3>
              <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Brüt Fazla Mesai</label>
              <input
                type="text"
                placeholder="Örn: 25.000,00₺"
                value={brut > 0 ? `${brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : ''}
                onChange={(e) => {
                  const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                  setBrut(v);
                }}
                className={`${inputClass} mb-4`}
              />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Brüt Fazla Mesai</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutYillik)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-red-600 dark:text-red-400">SGK Primi (%14)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(Math.round(brutYillik * 0.14 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-red-600 dark:text-red-400">İşsizlik Primi (%1)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(Math.round(brutYillik * 0.01 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-red-600 dark:text-red-400">Gelir Vergisi {gelirVergisiDilimleri}</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(gelirVergisi)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-red-600 dark:text-red-400">Damga Vergisi (binde 7,59)</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">Net Fazla Mesai</span>
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(netYillik)}</span>
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">Tablodaki brüt fazla mesai toplamının nete çevrimi</p>
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
                    })}₺`}
                    disabled
                    className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Toplam Fazla Mesai ({brutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) − 1/3 Hakkaniyet İndirimi ({(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) =
                    <span className="ml-1 font-semibold">{(brutYillik - (Number(brutYillik || 0) / 3)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
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
                        return num > 0 ? `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : '';
                      })()}
                      onChange={(e) => {
                        const v = String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim();
                        setMahsuplasmaMiktari(v);
                      }}
                      placeholder="0,00₺"
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
        <NotCard />
      </div>

      {/* Kat Sayı Hesapla Modal */}
      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      {/* Mahsuplaşma Modal */}
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        initialData={mahsuplasamaData}
        tableData={displayRows.map((r) => {
          // rangeLabel formatını modal'ın beklediği formata çevir
          // Örnek: "02.05.2019–02.05.2025" -> "02.05.2019 - 02.05.2025"
          // veya "02/05/2019–02/05/2025" -> "02.05.2019 - 02.05.2025"
          let period = r.rangeLabel;
          // Farklı tire karakterlerini normalize et
          period = period.replace(/[–—]/g, "-");
          // Tarih formatını normalize et (DD/MM/YYYY -> DD.MM.YYYY)
          period = period.replace(/(\d{2})\/(\d{2})\/(\d{4})/g, "$1.$2.$3");
          // Tire etrafına boşluk ekle
          period = period.replace(/\s*-\s*/g, " - ");
          period = period.trim();
          
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
      
      {/* Rapor Modal - ESKİ (Flag false olunca kullanılacak) */}
      {!USE_NEW_FAZLA_MESAI_REPORT && (
        <FazlaMesaiStandartReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          title={resolvedTitle}
          iseGiris={iseGiris}
          istenCikis={istenCikis}
          weeklyDays={Number(weeklyDays)}
          haftalikMesai={weeklyFMSaat}
          totalBrut={totalBrut}
          fmText={fmText || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? (txtTatilsiz || "") : (txtTatilli || "")) : (txtUnderSeven || ""))}
          rows={displayRows}
          brutYillik={brutYillik}
          gelirVergisi={gelirVergisi}
          gelirVergisiDilimleri={gelirVergisiDilimleri}
          damgaVergisi={damgaVergisi}
          netYillik={netYillik}
          mahsuplasmaMiktari={mahsuplasmaMiktari}
        />
      )}

      {/* Rapor Modal - YENİ (BaseReportModal) */}
      {USE_NEW_FAZLA_MESAI_REPORT && (
        <BaseReportModal
          open={showNewFMReportModal}
          onClose={() => setShowNewFMReportModal(false)}
          config={fazlaMesaiReportConfig}
        />
      )}

      {/* DEMO: Centered modal when user clicks Önizleme - no real report */}
      {showDemoModal && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] ring-1 ring-gray-200/80 dark:ring-gray-700/50 text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Üst dekoratif gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
            <div className="p-5 sm:p-8">
              <div id="demo-modal-title" className="flex justify-center mb-4 sm:mb-6">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 sm:p-4 ring-1 ring-gray-100 dark:ring-gray-700/50">
                  <img src="/login.png" alt="Bilirkisi Logo" className="h-16 sm:h-20 w-auto object-contain max-w-[180px] sm:max-w-[200px]" />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-[15px] leading-relaxed mb-6 sm:mb-8 whitespace-pre-line">
                Bu deneme sürümüdür.
                {"\n"}40'tan fazla tüm hesaplamalara erişim için lisans gereklidir.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pb-1">
                <Button
                  type="button"
                  onClick={async () => {
                    await fetch("http://localhost:4000/demo-track", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ event: "demo_click" }),
                    }).catch(() => {});
                    window.open("https://bilirkisihesap.com", "_blank");
                  }}
                  className="order-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200"
                >
                  Demo Talep Et
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await fetch("http://localhost:4000/demo-track", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ event: "subscribe_click" }),
                    }).catch(() => {});
                    window.open("https://bilirkisihesap.com/satin-al", "_blank");
                  }}
                  variant="outline"
                  className="order-2 border-2 border-purple-500/60 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-500 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                >
                  Abone Ol
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rapor içeriği PDF için her zaman DOM'da (gizli) */}
      {USE_NEW_FAZLA_MESAI_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={fazlaMesaiReportConfig} />
        </div>
      )}

      <FooterActions
        pageKey="fazla-mesai"
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation, disabled: true }}
        onSave={save}
        saveButtonProps={{
          disabled: true,
          title: "Demo sürümünde devre dışı",
          className: "!opacity-50 cursor-not-allowed",
          style: { opacity: 0.5, cursor: "not-allowed" },
        }}
        saveLabel="Kaydet"
        previewButton={{
          title: `${resolvedTitle} Rapor`,
          copyTargetId: "fazla-mesai-word-copy",
          hideWordDownload: true,
          onButtonClick: async () => {
            await fetch("http://localhost:4000/demo-track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "preview_click" }),
            }).catch(() => {});
            setShowDemoModal(true);
          },
          renderContent: () => <div id="fazla-mesai-word-copy" />,
          onPdf: () => {},
        }}
      />
    </div>
    </div>
    </div>
    </div>
    </Layout>
    {KaydetModal ? <KaydetModal /> : null}
      
      {/* Toast Notifications - Modern & Zarif */}
      <div className="fixed top-4 right-3 left-3 sm:left-auto sm:right-6 sm:top-6 z-[60] space-y-3 pointer-events-none max-w-md mx-auto sm:mx-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {toasts.map((toast) => {
          const isSuccess = toast.variant === "success";
          const isError = toast.variant === "error";
          const isInfo = toast.variant === "info";
          
          return (
            <div
              key={toast.id}
              className={`
                relative overflow-hidden pointer-events-auto
                backdrop-blur-xl bg-white/95 border
                rounded-2xl shadow-2xl
                transition-all duration-500 ease-out
                animate-in slide-in-from-right fade-in
                hover:shadow-3xl hover:scale-[1.02]
                ${isSuccess ? "border-green-200/50" : ""}
                ${isError ? "border-red-200/50" : ""}
                ${isInfo ? "border-blue-200/50" : ""}
              `}
              style={{
                animation: "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              {/* Gradient bar on left */}
              <div
                className={`
                  absolute left-0 top-0 bottom-0 w-1
                  ${isSuccess ? "bg-gradient-to-b from-green-400 to-emerald-600" : ""}
                  ${isError ? "bg-gradient-to-b from-red-400 to-rose-600" : ""}
                  ${isInfo ? "bg-gradient-to-b from-blue-400 to-indigo-600" : ""}
                `}
              />
              
              <div className="flex items-start gap-3 p-4 pl-5">
                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                  ${isSuccess ? "bg-green-100" : ""}
                  ${isError ? "bg-red-100" : ""}
                  ${isInfo ? "bg-blue-100" : ""}
                `}>
                  {isSuccess && (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isError && (
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {isInfo && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {toast.title && (
                    <div className={`
                      font-semibold text-sm leading-tight
                      ${isSuccess ? "text-green-900" : ""}
                      ${isError ? "text-red-900" : ""}
                      ${isInfo ? "text-blue-900" : ""}
                    `}>
                      {toast.title}
                    </div>
                  )}
                  {toast.description && (
                    <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {toast.description}
                    </div>
                  )}
                </div>
                
                {/* Close button */}
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                    text-gray-400 hover:text-gray-600 hover:bg-gray-100
                    transition-colors duration-200"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress bar */}
              {toast.durationMs && toast.durationMs > 0 && (
                <div
                  className={`
                    h-1 
                    ${isSuccess ? "bg-green-400/30" : ""}
                    ${isError ? "bg-red-400/30" : ""}
                    ${isInfo ? "bg-blue-400/30" : ""}
                  `}
                >
                  <div
                    className={`
                      h-full
                      ${isSuccess ? "bg-gradient-to-r from-green-400 to-emerald-500" : ""}
                      ${isError ? "bg-gradient-to-r from-red-400 to-rose-500" : ""}
                      ${isInfo ? "bg-gradient-to-r from-blue-400 to-indigo-500" : ""}
                    `}
                    style={{
                      animation: `shrink ${toast.durationMs}ms linear forwards`
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Toast & Accordion animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        /* Accordion arrow rotation */
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
  </>
  );
}
