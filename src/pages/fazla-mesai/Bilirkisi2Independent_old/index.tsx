import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { flushSync, createPortal } from "react-dom";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { safeNumber, safeCurrency } from "@/utils/safeFormat";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
import { asgariUcretler } from "@/utils/asgariUcretler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Youtube } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import UbgtKatsayiModal from "@/pages/ubgt-alacagi/UbgtIndependent/UbgtKatsayiModal";
import MahsuplasamaModal from "@/pages/hafta-tatili-alacagi/StandardIndependent/MahsuplasamaModal";
import { getAsgariUcretPeriods } from "@/constants/asgariUcretPeriods";
import { calculateOvertimeTable } from "@/utils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "@/utils/overtimeCalculator";
import { normalizeLocalDate } from "@/utils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "@/utils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays, format } from "date-fns";
// apply270Rule backend'de - frontend'te gereksiz
import { getScopedStorageKey } from "@/utils/storageKey";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";
import "@/styles/soft-glow.css";

// Constants (for display/formatting only - business logic in backend)
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const WEEKLY_WORK_LIMIT = 45;
const STANDARD_DAILY_REFERENCE_HOURS = 7.5;
const FAZLA_MESAI_DENOMINATOR = 225;
const FAZLA_MESAI_KATSAYI = 1.5;
const INCLUDED_OVERTIME_HOURS = 270;

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

// Helper types (previously from calculations.ts)
type ExcludedDay = {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer" | "UBGT";
  start: string;
  end: string;
  days: number;
};
type PeriodRow = {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  calc225: number;
  factor: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  text?: string;
  manual?: boolean;
};

// Helper functions - FOR UI DISPLAY ONLY
const fmt = (n: number) =>
  `${(n ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;

const toUTC = (dateString: string) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

const toISODateUTC = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const formatTR = (d: Date) => d.toLocaleDateString("tr-TR");

const formatDateTRStr = (dateStr?: string) => {
  try {
    if (!dateStr) return "";
    const d = normalizeLocalDate(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(dateStr || "");
  }
};

const normalizeTime = (timeStr?: string | null) => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const normalizeDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    const out = `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(
      2,
      "0"
    )}`;
    return out;
  }
  return s;
};


type Beyan = { in: string; out: string; dateIn?: string; dateOut?: string };
type Witness = Beyan & { id: number };

// Excl tipi artık calculations.ts'den import edilen ExcludedDay ile aynı
type Excl = ExcludedDay;

type Props = { titleOverride?: string };

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
    const nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    return { dava, bas, bit, gun, limit, nihai };
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

  const handleBasBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && zForm.bit && /^\d{4}-\d{2}-\d{2}$/.test(zForm.bit)) {
      const newDate = new Date(newValue);
      const endDate = new Date(zForm.bit);
      if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
        showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
        setZForm((p) => ({ ...p, bas: zForm.bit }));
      }
    }
  }, [zForm.bit, setZForm, showToastError]);

  const handleBitBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && zForm.bas && /^\d{4}-\d{2}-\d{2}$/.test(zForm.bas)) {
      const newDate = new Date(newValue);
      const startDate = new Date(zForm.bas);
      if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
        showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
        setZForm((p) => ({ ...p, bit: zForm.bas }));
      }
    }
  }, [zForm.bas, setZForm, showToastError]);

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
                onBlur={handleBasBlur}
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
                onBlur={handleBitBlur}
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
            <div style={{ color: '#1d4ed8', fontWeight: 500, marginTop: '0.25rem' }}>
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

export default function FazlaMesaiAlacagiPage({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-bilirkisi-2");
  
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
    if (p.includes("bilirkisi1") || p.includes("bilirkişi1") || p.includes("bilirkisi-1")) return "Bilirkişiler İçin - 2";
    if (p.includes("bilirkisi2") || p.includes("bilirkişi2") || p.includes("bilirkisi-2")) return "Bilirkişiler İçin - 2";
    return "Standart Fazla Mesai";
  }, [path]);
  const resolvedTitle = titleOverride || pageTitle;
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [include270, setInclude270] = useState(false);
  const [haftaDususBilgisi, setHaftaDususBilgisi] = useState<number | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [notes, setNotes] = useState("");
  // Klasik akış saatleri ve açıklama
  const [gir, setGir] = useState("");
  const [cik, setCik] = useState("");
  const [stepsText, setStepsText] = useState<string>("");
  const [txtTatilsiz, setTxtTatilsiz] = useState<string>("");
  const [txtTatilli, setTxtTatilli] = useState<string>("");
  const [txtUnderSeven, setTxtUnderSeven] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [fmHoursAuto, setFmHoursAuto] = useState<number>(0);
  const [haftalikMesai, setHaftalikMesai] = useState<number>(0);

  // Beyanlar
  const [davaci, setDavaci] = useState<Beyan>({ in: "", out: "" });
  const [davali, setDavali] = useState<Beyan>({ in: "", out: "" });
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  const [isCalculating, setIsCalculating] = useState(false);
  const calcSeq = useRef(0);
  const [backendResult, setBackendResult] = useState<{ textPeriods?: any[]; weeklyOvertimeHours?: number }>({});

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

  // Davacı state'ini UI senkronu için güncelle - ÇİFT YÖNLÜ SENKRON
  useEffect(() => {
    setDavaci(prev => ({
      ...prev,
      in: gir || "",
      out: cik || "",
      dateIn: iseGiris || "",
      dateOut: istenCikis || "",
    }));
  }, [gir, cik, iseGiris, istenCikis]);
  
  // TERS YÖNDE SENKRON: davaci değiştiğinde iseGiris/istenCikis'i güncelle
  useEffect(() => {
    if (davaci?.dateIn && davaci.dateIn !== iseGiris) setIseGiris(davaci.dateIn);
    if (davaci?.dateOut && davaci.dateOut !== istenCikis) setIstenCikis(davaci.dateOut);
  }, [davaci]);
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
  const [zamanasimiBaslangic, setZamanasimiBaslangic] = useState<string | null>(null);
  const prevZamanaRef = useRef<string | null>(null);
  const [zForm, setZForm] = useState<{ dava: string; bas: string; bit: string }>({ dava: "", bas: "", bit: "" });
  
  // Zamanaşımı modal callback'leri - useCallback ile optimize
  const handleZamanasimiApply = useCallback(() => {
    try {
      const basUTC = zForm.bas ? toUTC(zForm.bas) : null;
      const bitUTC = zForm.bit ? toUTC(zForm.bit) : null;
      const arabuluculukGun = (basUTC && bitUTC) ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1) : 0;
      const davaUTC = zForm.dava ? toUTC(zForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      const nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;
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
  }, [zForm]);
  
  const handleZamanasimiCancel = useCallback(() => {
    setShowZamanaModal(false);
    if (prevZamanaRef.current) {
      setZamanasimiBaslangic(prevZamanaRef.current);
    }
    prevZamanaRef.current = null;
  }, []);

  // Dışlamalar (YillikIzinDislamalariPanel ile yönetilir)
  const [exclusions, setExclusions] = useState<Excl[]>([]);

  // Brütten Nete Çevir (FM toplamı üzerinden)
  const [brut, setBrut] = useState(0);
  // Bu bölüm artık tablo toplamını doğrudan dönüştürür (yıl çarpanı yok)
  const brutYillik = brut;
  const sskPrim = brutYillik * SSK_ORANI;
  // Gelir vergisi matrahı: brüt - (SSK+işsizlik)
  const gelirVergisi = Math.max(0, brutYillik - sskPrim) * GELIR_VERGISI_ORANI;
  const gelirVergisiDilimleri = "(%15)";
  const damgaVergisi = brutYillik * DAMGA_VERGISI_ORANI;
  const netYillik = brutYillik - (sskPrim + gelirVergisi + damgaVergisi);
  const [mahsuplasmaMiktari, setMahsuplasmaMiktari] = useState<string>("");
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [month: number]: number } }>({});

  // Kat Sayı Hesapla modal state
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [katSayi, setKatSayi] = useState(1);

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

  // Satır çoğaltma fonksiyonu
  const duplicateRow = useCallback((i: number) => {
    setRows((prev) => {
      const copy = [...prev];
      // Kaynak satırı da düzenlenebilir yap
      copy[i] = { ...copy[i], manual: true };
      // Yeni satırı ekle
      const newRow = { ...copy[i], manual: true };
      copy.splice(i + 1, 0, newRow);
      return copy;
    });
  }, []);

  // Backend save-and-continue: detect caseId from URL and load if present
  const caseIdRef = useRef<string | null>(null);
  const loadRanRef = useRef<string | null>(null); // Yüklenen ID'yi takip et
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
  
  useEffect(() => {
    try {
      // Hem path parametresi (:id) hem de query string (?caseId=) destekle
      const queryId = new URLSearchParams(window.location.search).get("caseId");
      const loadId = id || queryId; // useParams'dan gelen id veya query string'den
      
      // Aynı ID zaten yüklendiyse tekrar yükleme
      if (loadRanRef.current === loadId) return;
      
      caseIdRef.current = loadId || null;
      if (!loadId) return;
      
      loadRanRef.current = loadId; // Yüklenen ID'yi kaydet
      
      (async () => {
        try {
          const tenantId = Number(localStorage.getItem("tenant_id") || "1");
          const res = await fetch(`${API_BASE_URL}/api/saved-cases/${loadId}`, { headers: { "x-tenant-id": String(tenantId) } });
          if (!res.ok) throw new Error("load_failed");
          const json = await res.json();
          setCaseData(json);
          // Kayıt adını sakla (güncelleme için)
          if (json?.name) setCurrentRecordName(json.name);
          
          // Verileri birden fazla olası konumdan yükle (uyumluluk için)
          // data.form (yeni format) veya data (eski format) veya root (en eski)
          const dataObj = json?.data || {};
          const formObj = dataObj?.form || {};
          
          // Öncelik: formObj > dataObj > json root
          const getVal = (key: string) => formObj[key] ?? dataObj[key] ?? json?.[key];
          
          // Tarihler
          const loadedIseGiris = getVal('iseGiris') || json?.start_date;
          const loadedIstenCikis = getVal('istenCikis') || json?.end_date;
          if (loadedIseGiris) setIseGiris(loadedIseGiris);
          if (loadedIstenCikis) setIstenCikis(loadedIstenCikis);
          
          // Saatler
          const loadedGir = getVal('gir');
          const loadedCik = getVal('cik');
          if (loadedGir) setGir(loadedGir);
          if (loadedCik) setCik(loadedCik);
          
          // Notes
          if (json?.notes !== undefined) setNotes(json.notes || "");
          
          // Diğer alanlar
          const loadedWeeklyDays = getVal('weeklyDays');
          if (loadedWeeklyDays !== undefined) setWeeklyDays(loadedWeeklyDays);
          
          const loadedDavaci = getVal('davaci');
          if (loadedDavaci !== undefined) setDavaci(loadedDavaci);
          
          const loadedDavali = getVal('davali');
          if (loadedDavali !== undefined) setDavali(loadedDavali);
          
          const loadedTaniklar = getVal('taniklar');
          if (loadedTaniklar !== undefined) setTaniklar(loadedTaniklar);
          
          const loadedExclusions = getVal('exclusions');
          if (loadedExclusions !== undefined) setExclusions(loadedExclusions);
          
          const loadedInclude270 = getVal('include270');
          if (loadedInclude270 !== undefined) setInclude270(!!loadedInclude270);
          
          const loadedZamanasimi = getVal('zamanasimi');
          if (loadedZamanasimi !== undefined) setZamanasimi(loadedZamanasimi);
          
          const loadedZamanasimiBaslangic = getVal('zamanasimiBaslangic');
          if (loadedZamanasimiBaslangic !== undefined) setZamanasimiBaslangic(loadedZamanasimiBaslangic);
          
          if (!isViewMode && !isPrintMode) {
            success(`Kayıt yüklendi (#${loadId})`);
          }
        } catch {
          error("Kayıt yüklenemedi");
        }
      })();
    } catch {}
  }, [id]);

  // ---- No persistence: ensure fresh state on reload ----
  useEffect(() => {
    try {
      // Clear any previous persisted key if exists from older versions
      localStorage.removeItem(getScopedStorageKey("fm_page_state_v1"));
    } catch {}
  }, []);


  // Initialize page type on mount and whenever path changes
  useEffect(() => {
    try { initializePageType(); } catch {}
  }, [location.pathname, initializePageType]);

  // Zamanaşımını kaldır
  const handleZamanasimiIptal = () => {
    try {
      setZamanasimi(null);
      setZamanasimiBaslangic(null);
      prevZamanaRef.current = null;
      info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
    } catch {}
  };

  const handleInclude270Change = (e: any) => {
    const checked = !!e?.target?.checked;
    setInclude270(checked);
  };

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + r.fm, 0), [rows]);
  const totalNet = useMemo(() => rows.reduce((a, r) => a + r.net, 0), [rows]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleNewCalculation = () => {
    try {
      if (!caseData?.saved && ((caseData?.taniklar?.length ?? 0) > 0 || !!caseData?.davaci?.startDate)) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      // eslint-disable-next-line no-console
      console.debug("[DEV] Yeni hesaplama başlatıldı.");
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
      setDavali({ in: "", out: "" });
      setTaniklar([]);
      setExclusions([]);
      info("Yeni hesaplama başlatıldı.");
    } catch {}
  };

  const save = () => {
    // Merkezi kayıt sistemini kullan - modal açılır ve kayıt adı girilir
    kaydetAc({
      hesapTuru: "fazla_mesai_bilirkisi_2",
      veri: {
        // Yeni format: data içinde form ve results
        data: {
          form: {
            iseGiris,
            istenCikis,
            weeklyDays,
            gir,
            cik,
            davaci,
            davali,
            taniklar,
            exclusions,
            include270,
            zamanasimi,
            zamanasimiBaslangic,
            pageType: "bilirkisi2",
            route: "/fazla-mesai/bilirkisi-2",
            ...(caseData?.data || {}),
          },
          results: {
            totals: { brut: totalBrut, net: totalNet },
            brut: totalBrut,
            net: totalNet,
          }
        },
        // Geriye dönük uyumluluk için eski alanlar (backend için)
        start_date: iseGiris,
        end_date: istenCikis,
        brut_total: Number(totalBrut.toFixed(2)),
        net_total: Number(totalNet.toFixed(2)),
        notes,
        weeklyDays,
        gir,
        cik,
        davaci,
        davali,
        taniklar,
        exclusions,
        include270,
        zamanasimi,
        zamanasimiBaslangic,
        pageType: "bilirkisi2",
        route: "/fazla-mesai/bilirkisi-2",
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `/fazla-mesai/bilirkisi-2/:id`,
      onSuccess: (result) => {
        // Kayıt başarılı olduğunda, bir sonraki kayıt için ID ve ismi sakla
        // Bu sayede ikinci kayıtte modal açılmaz, direkt güncelleme yapılır
        if (result.id) {
          caseIdRef.current = String(result.id);
        }
        // Modal'dan girilen kayıt adını sakla
        if (result.name) {
          setCurrentRecordName(result.name);
        }
      },
    });
  };

  const weeklyMode = weeklyDays === "7" ? "tatilli" : "tatilsiz";

  // Form state objesi
  const formState: FormState = useMemo(() => ({
    davaci,
    davali,
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
    davali,
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

  // Form state değiştiğinde hesaplamayı tetikle
  // ÖNEMLİ: rows sadece backend'den gelecek
  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        setIsCalculating(true);
        
        const payload = {
          davaci: {
            in: gir || "",
            out: cik || "",
            dateIn: iseGiris || "",
            dateOut: istenCikis || "",
          },
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
        };
        
        console.log('[Bilirkişi-2 Frontend] Payload:', {
          zamanasimiBaslangic,
          include270,
          haftalikMesai,
        });

        const response = await apiPost('/api/fm/bilirkisi2', payload);

        if (!response.ok) {
          let errorMessage = 'Backend error';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
            console.error('❌ [Bilirkişi-2] Backend hata detayı:', errorData);
          } catch (e) {
            const errorText = await response.text();
            console.error('❌ [Bilirkişi-2] Backend hata metni:', errorText);
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Backend direkt {rows, totalBrut, totalNet, textPeriods, weeklyOvertimeHours} döndürüyor
        setRows(result.rows || []);
        setBackendResult({ 
          textPeriods: result.textPeriods || [],
          weeklyOvertimeHours: result.weeklyOvertimeHours || 0
        });

        setTimeout(() => {
          setIsCalculating(false);
        }, 200);
      } catch (err) {
        setIsCalculating(false);
        console.error('[Bilirkişi-2] Backend error:', err);
        setRows([]);
      }
    };

    calculateFromBackend();
  }, [
    davaci,
    taniklar,
    weeklyDays,
    activeTab,
    exclusions,
    katSayi,
    zamanasimiBaslangic,
    include270,
    haftalikMesai,
    iseGiris,
    istenCikis,
    gir,   // ✅ Saat değişikliğini yakala
    cik,   // ✅ Saat değişikliğini yakala
  ]);

  const recalculateAll = () => {
    setRefreshFlag(prev => prev + 1);
  };

  // Tanık bazlı fazla mesai hesaplama fonksiyonu
  const recalculate = useCallback(() => {
    try {
      const davaciBeyaniStart = normalizeTime(davaci?.in) || '';
      const davaciBeyaniEnd = normalizeTime(davaci?.out) || '';
      
      // Tüm beyan kaynaklarını kontrol et
      const hasDavaci = davaciBeyaniStart && davaciBeyaniEnd;
      const davaliStart = normalizeTime(davali?.in) || '';
      const davaliEnd = normalizeTime(davali?.out) || '';
      const hasDavali = davaliStart && davaliEnd;
      const hasWitnesses = (taniklar || []).some(t => t.in && t.out);
      
      // En az bir beyan kaynağı olmalı
      if (!hasDavaci && !hasDavali && !hasWitnesses) {
        return;
      }
      
      const witnessesForCalc = (taniklar || []).filter(t => t.in && t.out).map(t => ({
        in: normalizeTime(t.in) || '',
        out: normalizeTime(t.out) || '',
        dateIn: normalizeDate(t.dateIn) || '',
        dateOut: normalizeDate(t.dateOut) || '',
      }));
      
      // Davacı verisi yoksa diğer kaynaklardan al
      let finalDavaciStart = davaciBeyaniStart;
      let finalDavaciEnd = davaciBeyaniEnd;
      
      if (!finalDavaciStart || !finalDavaciEnd) {
        // Önce davalıyı dene
        if (davaliStart && davaliEnd) {
          finalDavaciStart = davaliStart;
          finalDavaciEnd = davaliEnd;
        }
        
        // Davalı yoksa tanıkları dene
        if ((!finalDavaciStart || !finalDavaciEnd) && witnessesForCalc.length > 0) {
          finalDavaciStart = normalizeTime(witnessesForCalc[0].in) || finalDavaciStart || '07:00';
          finalDavaciEnd = normalizeTime(witnessesForCalc[0].out) || finalDavaciEnd || '19:00';
        }
        
        // Son çare: varsayılan değerler
        if (!finalDavaciStart) finalDavaciStart = '07:00';
        if (!finalDavaciEnd) finalDavaciEnd = '19:00';
      }
      
      const fmResult = calculateWitnessBasedOvertime({
        davaciStart: finalDavaciStart,
        davaciEnd: finalDavaciEnd,
        witnesses: witnessesForCalc,
        mode: 'davaci',
        weeklyDays: Number(weeklyDays) || 6,
        isTatilli: Number(weeklyDays) === 7 && activeTab === 'tatilli',
      });
      
      setFinalWeeklyOvertime(fmResult.weeklyOvertime);
    } catch (err) {
      console.error('recalculate error:', err);
    }
  }, [davaci, taniklar, davali, weeklyDays, activeTab]);

  // Form değiştikçe interval ve fazla mesai zincirini otomatik çalıştır (canlı veriler)
  useEffect(() => {
    try { handleCalculateOvertime(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci, taniklar, weeklyDays, activeTab]);

  // davaci, taniklar, davali değiştiğinde recalculate çağır
  useEffect(() => {
    recalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci, taniklar, davali, gir, cik, weeklyDays, activeTab]);

  // Sekme (tatilli/tatilsiz) veya gün sayısı ya da giriş/çıkış saatleri değiştiğinde açıklama metnini güncelle
  // NOT: Artık computeClassic fmText useMemo içinde çağrılıyor, burada ayrıca çağırmaya gerek yok
  useEffect(() => {
    // computeClassic artık fmText useMemo içinde çağrılıyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weeklyDays, gir, cik]);


  // Fazla mesai hesapla (canlı form verileri)
  const handleCalculateOvertime = async () => {
    try {
      if (!caseData) {
        console.warn("[DEV] Yeni sekme başlatıldı, varsayılan boş case oluşturuluyor.");
        setCaseData({ taniklar: [], davaci: {} } as any);
      }
      if (caseData && !Array.isArray(caseData.taniklar)) {
        console.warn("[DEV] Tanık dizisi geçersiz, yeniden başlatılıyor.");
        setCaseData((prev: any) => ({ ...(prev || {}), taniklar: [] }));
      }
    } catch {}
    // ✅ Tanık beyanlarını veritabanındaki JSON'dan çıkar (anahtar tarama)
    // eslint-disable-next-line no-console
    console.log("DEBUG caseData.data raw:", caseData?.data);
    const dataObj: any = caseData?.data || {};
    const allKeys = Object.keys(dataObj);
    // eslint-disable-next-line no-console
    console.log("DEBUG mevcut alanlar:", allKeys);

    let witnesses: any[] = [];
    for (const key of allKeys) {
      if (key.toLowerCase().includes("tanik")) {
        const val = (dataObj as any)[key];
        if (Array.isArray(val)) witnesses.push(...val);
        else if (val && typeof val === "object") witnesses.push(val);
      }
    }

    // eslint-disable-next-line no-console
    console.log("Tanık beyanları:", witnesses);
    if (witnesses.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("Tanık beyanı bulunamadı, hesaplama yapılmadı.");
      return;
    }

    const davaciMin = (caseData as any)?.data?.davaci?.in || "07:30";
    const davaciMax = (caseData as any)?.data?.davaci?.out || "17:30";
    // eslint-disable-next-line no-console
    console.debug("DEBUG davaci sınırları:", { davaciMin, davaciMax });
    
    // Yeni tanık bazlı hesaplama algoritmasını kullan
    const davaciBeyaniStart = normalizeTime(davaci?.in) || davaciMin;
    const davaciBeyaniEnd = normalizeTime(davaci?.out) || davaciMax;
    
    const witnessesForCalc = (taniklar || []).filter(t => t.in && t.out).map(t => ({
      in: normalizeTime(t.in) || '',
      out: normalizeTime(t.out) || '',
      dateIn: normalizeDate(t.dateIn) || '',
      dateOut: normalizeDate(t.dateOut) || '',
    }));
    
    const fmResult = calculateWitnessBasedOvertime({
      davaciStart: davaciBeyaniStart,
      davaciEnd: davaciBeyaniEnd,
      witnesses: witnessesForCalc,
      mode: 'davaci',
      weeklyDays: Number(weeklyDays) || 6,
      isTatilli: Number(weeklyDays) === 7 && activeTab === 'tatilli',
    });
    
    setFinalWeeklyOvertime(fmResult.weeklyOvertime);
    
    // Eski calculateIntervals'i kullanarak sonuçları set et (geriye dönük uyumluluk için)
    const results = calculateIntervals(witnesses, davaciMin, davaciMax);
    setIntervals(results);
    // eslint-disable-next-line no-console
    console.log("Hesaplanan dönemler:", results);
    // eslint-disable-next-line no-console
    console.log("📊 Tanık bazlı hesaplama sonucu:", fmResult, "Haftalık FM:", fmResult.weeklyOvertime);

    // Tabloyu doldurmak için overtimeResults'u da üret
    try {
      const mod = await import("@/utils/intervalHelper");
      const calculateOvertimeHours = (mod as any).calculateOvertimeHours as (xs: any[]) => { results: any[] };
      const toStr = (v: any) => (v == null ? "" : String(v));
      const finalIntervals = (witnesses as any[]).map((w) => {
        const sDate = normalizeDate(toStr(w.baslangic ?? w.startDate ?? w.tarih1 ?? w.dateIn ?? w.date_in ?? w.date_start ?? w.start_date)) || "";
        const eDate = normalizeDate(toStr(w.bitis ?? w.endDate ?? w.tarih2 ?? w.dateOut ?? w.date_out ?? w.date_end ?? w.end_date)) || "";
        const sTime = normalizeTime(toStr(w.gir ?? w.startTime ?? w.giris ?? w['in'] ?? w.entry ?? w.start_hour ?? w.startTimeStr)) || "";
        const eTime = normalizeTime(toStr(w.cik ?? w.endTime ?? w.cikis ?? w['out'] ?? w.exit ?? w.end_hour ?? w.endTimeStr)) || "";
        return { start: sDate, end: eDate, start_time: sTime, end_time: eTime, haftalikGun: 6 };
      }).filter(it => it.start && it.end && it.start_time && it.end_time);
      const { results: otResults } = calculateOvertimeHours(finalIntervals);
      setOvertimeResults(otResults as any);
    } catch {}
    // Tanık bazlı hesaplamadan sonra akış artık devam edecek (erken dönüş kaldırıldı)
    // Debug group per request
    // eslint-disable-next-line no-console
    console.group("🧮 handleCalculateOvertime Debug");
    const davaciBeyani = {
      startDate: normalizeDate(davaci?.dateIn) || '',
      endDate: normalizeDate(davaci?.dateOut) || '',
      startTime: normalizeTime(davaci?.in) || '',
      endTime: normalizeTime(davaci?.out) || '',
    };
    const tanikBeyanlari = (taniklar || []).map((t) => ({
      type: 'tanik',
      startDate: normalizeDate(t?.dateIn) || '',
      endDate: normalizeDate(t?.dateOut) || '',
      startTime: normalizeTime(t?.in) || '',
      endTime: normalizeTime(t?.out) || '',
    }));
    const haftalikGunSayisi = Number(weeklyDays) || 0;
    // eslint-disable-next-line no-console
    console.log("📥 Gelen form verileri:", { davaciBeyani, tanikBeyanlari, haftalikGunSayisi });
    try {
      const mod = await import("@/utils/intervalHelper");
      const generateDynamicIntervalsFromWitnesses = (mod as any).generateDynamicIntervalsFromWitnesses;
      const calculateOvertimeHours = (mod as any).calculateOvertimeHours;

      // Tanık aralıklarını tam beyan olarak geçir
      // eslint-disable-next-line no-console
      console.log("⚙️ generateDynamicIntervalsFromWitnesses çağrıldı, gelen tanık sayısı:", tanikBeyanlari?.length, "davacı:", davaciBeyani);
      const finalIntervals = generateDynamicIntervalsFromWitnesses(
        {
          startDate: davaciBeyani.startDate,
          endDate: davaciBeyani.endDate,
          startTime: davaciBeyani.startTime,
          endTime: davaciBeyani.endTime,
          haftalikGunSayisi,
        },
        tanikBeyanlari
      );

      // eslint-disable-next-line no-console
      console.log("📆 generateDynamicIntervals sonucu:", finalIntervals);

      // Bu aralıklardan fazla mesai hesapla
      const { results, toplamFazlaMesai } = calculateOvertimeHours(finalIntervals);
      // eslint-disable-next-line no-console
      console.log("✅ Hesaplanan sonuçlar:", results, "Toplam:", toplamFazlaMesai);

      setOvertimeResults(results as any);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("❌ handleCalculateOvertime hata:", err);
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
    // Ana tabloyu güncelleme tetiklemesi burada kaldırıldı; yalnızca mount'ta bir kez çağrılacak.
  };

  // Dinamik metin: computeClassic'ten gelen dönemleri kart grid yapısında göstermek için
  // ÖNEMLİ: Metin ve tablo aynı computeClassic çıktısını kullanır
  const fmPeriods = useMemo(() => {
    // Backend'den gelen textPeriods'u kullan
    if (backendResult.textPeriods && backendResult.textPeriods.length > 0) {
      return backendResult.textPeriods.map((p: any) => ({
        label: `${formatDateTRStr(p.startDate)} – ${formatDateTRStr(p.endDate)}`,
        text: p.text || '',
      }));
    }
    
    // Fallback: rows'tan text al (eğer textPeriods henüz gelmemişse)
    return rows.map(row => ({
      label: row.rangeLabel || '',
      text: row.text || `${row.rangeLabel}\n${row.weeks} hafta × ${row.brut}₺ × ${row.fmHours}h = ${row.fm}₺`
    }));
  }, [backendResult.textPeriods, rows]);
  
  // ESKİ KOD - Silindi
  /*
    const fmPeriods = useMemo(() => {
    try {
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

  // Auto compute classic text and periods when inputs change
  // NOT: Artık computeClassic fmText useMemo içinde çağrılıyor, burada ayrıca çağırmaya gerek yok
  // Eski local hesaplamalar kaldırıldı - artık tek kaynak calculations.ts'deki computeClassic
  useEffect(() => {
    // computeClassic artık fmText useMemo içinde çağrılıyor
    // Haftalık fazla mesai hesaplaması da computeClassic içinde yapılıyor
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
    // Haftalık fazla mesaiyi computeClassic'ten al
    if (classic && adjustedPeriods && adjustedPeriods.length > 0) {
      // İlk dönemin FM saatini kullan (tüm dönemler aynı FM saatine sahip olmalı)
      const firstPeriod = adjustedPeriods[0];
      if (firstPeriod && firstPeriod.fmHours !== undefined) {
        setHaftalikMesai(Number(firstPeriod.fmHours.toFixed(2)));
      }
    } else {
      setHaftalikMesai(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, weeklyDays, gir, cik, exclusions, activeTab, davaci, taniklar, katSayi, zamanasimiBaslangic, include270, haftalikMesai]);

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Ana Form (2 kolon) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Üst Alan - Tarihler ve Beyanlar */}
          <div className="soft-card space-y-4 divide-y divide-gray-100" style={{ padding: '24px' }}>
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
                      <div style={{border:'1px solid #e5e7eb', borderRadius:6}}>
                        <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Davalı Beyanı</div>
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
                          {rows.map((r, i) => (
                            <tr key={i}>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'left'}}>{r.rangeLabel}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.weeks}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.brut)}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.katsayi}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>225</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>1,5</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.fm)}</td>
                            </tr>
                          ))}
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
                <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">Haftada Çalışılan Gün <span className="text-gray-500" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500" value={weeklyDays} onChange={(e)=>setWeeklyDays(String(Number(e.target.value)||0))} readOnly={isReadOnly} />
              </div>
            </div>

          {/* Zamanaşımı Modal - React.memo ile optimize edilmiş component */}
          {showZamanaModal && (
            <ZamanasimiModalContent
              zForm={zForm}
              setZForm={setZForm}
              onApply={handleZamanasimiApply}
              onCancel={handleZamanasimiCancel}
              showToastError={error}
              isReadOnly={isReadOnly}
            />
          )}
            <div className="rounded-md border border-gray-200 bg-[#e9ecef] px-3 py-2 text-sm font-semibold text-gray-800 mb-3">Beyan Bilgileri</div>
            
            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg">Davacı Beyanı</summary>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davaci.dateIn || ''} 
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
                        setDavaci((p)=>({...p, dateIn: value})); recalculate();
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davaci.dateOut && /^\d{4}-\d{2}-\d{2}$/.test(davaci.dateOut)) {
                          const newDate = new Date(newValue);
                          const outDate = new Date(davaci.dateOut);
                          if (!isNaN(newDate.getTime()) && !isNaN(outDate.getTime()) && newDate > outDate) {
                            error("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                            setDavaci((p)=>({...p, dateIn: davaci.dateOut || ''}));
                            recalculate();
                          }
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davaci.dateOut || ''} 
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
                        setDavaci((p)=>({...p, dateOut: value})); recalculate();
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davaci.dateIn && /^\d{4}-\d{2}-\d{2}$/.test(davaci.dateIn)) {
                          const newDate = new Date(newValue);
                          const inDate = new Date(davaci.dateIn);
                          if (!isNaN(newDate.getTime()) && !isNaN(inDate.getTime()) && newDate < inDate) {
                            error("Çıkış tarihi, giriş tarihinden önce olamaz.");
                            setDavaci((p)=>({...p, dateOut: davaci.dateIn || ''}));
                            recalculate();
                          }
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Saati</div>
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davaci.in} onChange={(e)=>{setDavaci((p)=>({...p,in:e.target.value})); recalculate();}} readOnly={isReadOnly} />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Saati</div>
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davaci.out} onChange={(e)=>{setDavaci((p)=>({...p,out:e.target.value})); recalculate();}} readOnly={isReadOnly} />
                  </div>
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg">Davalı Beyanı</summary>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davali.dateIn || ''} 
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
                        setDavali((p)=>({...p, dateIn: value})); recalculate();
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davali.dateOut && /^\d{4}-\d{2}-\d{2}$/.test(davali.dateOut)) {
                          const newDate = new Date(newValue);
                          const outDate = new Date(davali.dateOut);
                          if (!isNaN(newDate.getTime()) && !isNaN(outDate.getTime()) && newDate > outDate) {
                            error("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                            setDavali((p)=>({...p, dateIn: davali.dateOut || ''}));
                            recalculate();
                          }
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davali.dateOut || ''} 
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
                        setDavali((p)=>({...p, dateOut: value})); recalculate();
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davali.dateIn && /^\d{4}-\d{2}-\d{2}$/.test(davali.dateIn)) {
                          const newDate = new Date(newValue);
                          const inDate = new Date(davali.dateIn);
                          if (!isNaN(newDate.getTime()) && !isNaN(inDate.getTime()) && newDate < inDate) {
                            error("Çıkış tarihi, giriş tarihinden önce olamaz.");
                            setDavali((p)=>({...p, dateOut: davali.dateIn || ''}));
                            recalculate();
                          }
                        }
                      }}
                      readOnly={isReadOnly} 
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Saati</div>
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davali.in} onChange={(e)=>{setDavali((p)=>({...p,in:e.target.value})); recalculate();}} readOnly={isReadOnly} />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Saati</div>
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davali.out} onChange={(e)=>{setDavali((p)=>({...p,out:e.target.value})); recalculate();}} readOnly={isReadOnly} />
                  </div>
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg">Tanık Beyanları</summary>
              <div className="p-4 space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                        <input 
                          type="date" 
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                          value={t.dateIn || ''} 
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
                            setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateIn:value}:r)); recalculate();
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && t.dateOut && /^\d{4}-\d{2}-\d{2}$/.test(t.dateOut)) {
                              const newDate = new Date(newValue);
                              const outDate = new Date(t.dateOut);
                              if (!isNaN(newDate.getTime()) && !isNaN(outDate.getTime()) && newDate > outDate) {
                                error("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                                setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateIn:t.dateOut || ''}:r));
                                recalculate();
                              }
                            }
                          }}
                          readOnly={isReadOnly} 
                        />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                        <input 
                          type="date" 
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                          value={t.dateOut || ''} 
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
                            setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateOut:value}:r)); recalculate();
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && t.dateIn && /^\d{4}-\d{2}-\d{2}$/.test(t.dateIn)) {
                              const newDate = new Date(newValue);
                              const inDate = new Date(t.dateIn);
                              if (!isNaN(newDate.getTime()) && !isNaN(inDate.getTime()) && newDate < inDate) {
                                error("Çıkış tarihi, giriş tarihinden önce olamaz.");
                                setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateOut:t.dateIn || ''}:r));
                                recalculate();
                              }
                            }
                          }}
                          readOnly={isReadOnly} 
                        />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Saati</div>
                        <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={t.in} onChange={(e)=>{setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,in:e.target.value}:r)); recalculate();}} readOnly={isReadOnly} />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Saati</div>
                        <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={t.out} onChange={(e)=>{setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,out:e.target.value}:r)); recalculate();}} readOnly={isReadOnly} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {idx === 0 ? (
                        <div />
                      ) : (
                        <button className="text-xs border border-red-300 text-red-600 rounded-md px-2 py-2" onClick={()=>{setTaniklar((arr)=>arr.filter((_,i)=>i!==idx)); recalculate();}}>🗑️ Kaldır</button>
                      )}
                    </div>
                  </div>
                ))}
                <button className="text-xs border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white rounded-md px-2 py-1" onClick={()=>{setTaniklar((a)=>{ const nextId = a.reduce((m,x)=>Math.max(m,x.id),0)+1; return [...a,{ id: nextId, in:"", out:"", dateIn:"", dateOut:"" }]; }); recalculate();}}>+ Tanık Ekle</button>
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
          
          {/* Alt Alan - Dışlamalar ve Tablo */}
          <div className="soft-card space-y-3" style={{ padding: '16px' }}>
            <YillikIzinDislamalariPanel
              exclusions={exclusions}
              setExclusions={setExclusions}
              success={success}
              showToastError={error}
            />
            <div className="text-xs text-gray-600 -mb-1 flex items-center gap-1">
              <span className="cursor-help" title="Tablo işe giriş–çıkış tarihine göre yıl bazında otomatik oluşturulur. Yıl tamamlanmamışsa, aralık çıkış tarihiyle sınırlanır.">ℹ️</span>
              <span>Tablo yıl bazında otomatik oluşturulur.</span>
            </div>

            {/* 270 saat dahil + Zamanaşımı linki */}
            <div className="flex flex-wrap items-center gap-4 mb-3 mt-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
              <input
                type="checkbox"
                id="include270"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                onChange={handleInclude270Change}
                checked={include270}
              />
              <label htmlFor="include270" className="text-sm text-gray-800 select-none">
                Sözleşmede yıllık 270 saate kadar fazla mesai ücrete dahildir.
              </label>
              <div className="relative group cursor-pointer">
                <span className="text-blue-500 text-sm font-semibold">?</span>
                <div className="absolute left-5 top-0 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-md p-3 w-72 text-xs text-gray-700 z-50">
                  Her yıl (tam veya kısmi fark etmeksizin) işçinin ilk 270 saatlik fazla mesaisi ücrete dahil sayılır. Bu nedenle her çalışma yılı için 270 saate karşılık gelen hafta sayısı, yıl içindeki ilk dönemlerden başlanarak düşülür.
                </div>
              </div>
              {/* Zamanaşımı İtirazı (button) */}
              <button
                type="button"
                onClick={()=>{ prevZamanaRef.current = zamanasimiBaslangic ?? null; if (zamanasimiBaslangic) setZamanasimiBaslangic(null); setShowZamanaModal(true); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-md shadow-sm hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                Zamanaşımı İtirazı
              </button>
              <Button type="button" variant="outline" onClick={() => setShowKatsayiModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm">Kat Sayı Hesapla</Button>
              {hasCustomKatsayi && (
                <Button type="button" variant="outline" onClick={removeGlobalCoefficient} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50">Kat Sayı Kaldır</Button>
              )}
              {zamanasimiBaslangic && (
                <button
                  type="button"
                  onClick={handleZamanasimiIptal}
                  className="ml-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                  title="Zamanaşımı itirazını kaldır"
                >
                  Zamanaşımı İtirazını Kaldır
                </button>
              )}
            </div>
            {include270 && haftaDususBilgisi !== null && (
              <div className="mt-2 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-md p-2">
                270 saatlik yasal sınır kapsamında her çalışma yılı için toplam <b>{haftaDususBilgisi}</b> hafta hesaplamadan çıkarılmıştır.
              </div>
            )}

            {/* Üst bilgi: Zamanaşımı etiketi */}
            {zamanasimiBaslangic && rows.length > 0 && (
              <div className="text-sm text-blue-600 mt-2 mb-2">
                Zamanaşımı başlangıç tarihi: {formatTR(normalizeLocalDate(zamanasimiBaslangic))} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
              </div>
            )}

            <div className="mt-2 mb-2">
              <table className="table-auto w-full text-sm border border-gray-300" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-[#f8f9fa]" style={{ borderBottom: '2px solid #d0d0d0' }}>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Tarih Aralığı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Hafta Sayısı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Ücret</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Kat Sayı Çarpanı <span className="text-gray-500" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Fazla Mesai Saati <span className="text-gray-500" title="Hesaplanan haftalık fazla mesai saati; gerekirse satır bazlı düzenleyebilirsiniz.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">225</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">1,5</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Fazla Mesai</th>
                    <th className="border-0 bg-transparent w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1.5">—</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">0</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(0)}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        <input
                          value="0,00"
                          readOnly
                          className="w-24 text-right rounded border border-gray-300 px-2 py-1 bg-gray-50"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">225</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{fmt(0)}</td>
                      <td className="border-0 bg-transparent w-8"></td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-gray-50"
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="border border-gray-300 px-2 py-1.5">
                        {r.manual ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={r.startISO}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                setRows((arr) => arr.map((row, idx) => {
                                  if (idx !== i) return row;
                                  const newLabel = `${formatDateTRStr(newStart)}–${formatDateTRStr(row.endISO)}`;
                                  // Hafta sayısını yeniden hesapla
                                  const newWeeks = calculateWeekCount(new Date(newStart), new Date(row.endISO), exclusions);
                                  // FM'i yeniden hesapla
                                  const kats = katSayi;
                                  const fmHours = row.fmHours || 0;
                                  const step1 = Number((newWeeks * row.brut).toFixed(6));
                                  const step2 = Number((step1 * kats).toFixed(6));
                                  const step3 = Number((step2 * fmHours).toFixed(6));
                                  const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                  const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                  const fm = Number(step5.toFixed(2));
                                  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                  return { ...row, startISO: newStart, rangeLabel: newLabel, weeks: newWeeks, fm, net };
                                }));
                              }}
                              className="w-28 text-xs rounded border border-gray-300 px-1 py-0.5"
                            />
                            <span>–</span>
                            <input
                              type="date"
                              value={r.endISO}
                              onChange={(e) => {
                                const newEnd = e.target.value;
                                setRows((arr) => arr.map((row, idx) => {
                                  if (idx !== i) return row;
                                  const newLabel = `${formatDateTRStr(row.startISO)}–${formatDateTRStr(newEnd)}`;
                                  // Hafta sayısını yeniden hesapla
                                  const newWeeks = calculateWeekCount(new Date(row.startISO), new Date(newEnd), exclusions);
                                  // FM'i yeniden hesapla
                                  const kats = katSayi;
                                  const fmHours = row.fmHours || 0;
                                  const step1 = Number((newWeeks * row.brut).toFixed(6));
                                  const step2 = Number((step1 * kats).toFixed(6));
                                  const step3 = Number((step2 * fmHours).toFixed(6));
                                  const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                  const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                  const fm = Number(step5.toFixed(2));
                                  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                  return { ...row, endISO: newEnd, rangeLabel: newLabel, weeks: newWeeks, fm, net };
                                }));
                              }}
                              className="w-28 text-xs rounded border border-gray-300 px-1 py-0.5"
                            />
                          </div>
                        ) : (
                          r.rangeLabel
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        {r.manual ? (
                          <input
                            type="number"
                            value={r.weeks}
                            onChange={(e) => {
                              const newWeeks = Number(e.target.value) || 0;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                // FM'i yeniden hesapla
                                const kats = katSayi;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((newWeeks * row.brut).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, weeks: newWeeks, fm, net };
                              }));
                            }}
                            className="w-16 text-right text-xs rounded border border-gray-300 px-1 py-0.5"
                          />
                        ) : (
                          r.weeks
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        <input
                          type="text"
                          defaultValue={r.brut > 0 ? `${r.brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : ''}
                          key={`brut-${i}-${r.startISO}`}
                          onFocus={(e) => {
                            // Focus olunca ham değeri göster (₺ olmadan)
                            const numVal = Number(String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                            if (numVal > 0) {
                              e.target.value = String(numVal).replace('.', ',');
                            }
                          }}
                          onBlur={(e) => {
                            const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                            // Blur olunca formatla ve state güncelle (₺ ile)
                            if (v === 0 || isNaN(v)) {
                              // Boş bırakılırsa veya 0 ise otomatik asgari ücreti kullan
                              const au = asgariUcretler.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
                              e.target.value = `${au.brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const kats = katSayi;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((row.weeks * au.brut).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, brut: au.brut, fm, net, katsayi: kats };
                              }));
                            } else {
                              e.target.value = `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const kats = katSayi;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((row.weeks * v).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, brut: v, fm, net, katsayi: kats };
                              }));
                            }
                          }}
                          placeholder={(() => {
                            const au = asgariUcretler.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
                            return fmt(au.brut);
                          })()}
                          className="w-32 text-right rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        <input
                          type="text"
                          defaultValue={r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          key={`fm-${i}-${r.startISO}`}
                          onFocus={(e) => {
                            // Focus olunca ham değeri göster
                            const numVal = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')) || 0;
                            if (numVal > 0) {
                              e.target.value = String(numVal).replace('.', ',');
                            }
                          }}
                          onBlur={(e) => {
                            const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')) || 0;
                            // Blur olunca formatla ve state güncelle
                            e.target.value = v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            setRows((arr) => arr.map((row, idx) => {
                              if (idx !== i) return row;
                              const kats = katSayi;
                              const step1 = Number((row.weeks * row.brut).toFixed(6));
                              const step2 = Number((step1 * kats).toFixed(6));
                              const step3 = Number((step2 * v).toFixed(6));
                              const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                              const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                              const fm = Number(step5.toFixed(2));
                              const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                              return { ...row, fmHours: v, fm, net, fmManual: true, katsayi: kats };
                            }));
                          }}
                          className="w-24 text-right rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">225</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{fmt(r.fm)}</td>
                      {/* Satır çoğaltma butonu - tablonun sağında */}
                      <td className="border-0 bg-transparent w-8 p-0">
                        {hoveredRow === i && (
                          <span
                            className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer"
                            onClick={() => duplicateRow(i)}
                            title="Bu satırı kopyalayarak altına yeni bir satır ekler. Farklı dönemler için ayrı ayarlar kullanabilirsiniz."
                          >
                            +
                          </span>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                  {rows.length > 0 && (
                    <tr style={{ borderTop: '2px solid #999' }} className="bg-[#f1f3f5]">
                      <td className="border border-gray-300 px-2 py-1.5 font-semibold">Toplam Fazla Mesai:</td>
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5" />
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">{fmt(totalBrut)}</td>
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

          {/* İki Ayrı Kart: Solda Brütten Nete, Sağda Mahsuplaşma */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kart 1: Brütten Nete Çevir */}
            <div className="p-6 bg-gray-50 rounded-lg border md:col-span-2">
              <h3 className="text-lg font-semibold mb-4 fade-section">Brütten Nete Çevir</h3>
              <label className="block font-medium text-gray-700 mb-1">Brüt Fazla Mesai</label>
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
                className="w-full p-2 border rounded mb-4"
              />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Brüt Fazla Mesai</span>
                  <span className="font-semibold text-gray-900">{fmt(brutYillik)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-red-600">SGK Primi (%14)</span>
                  <span className="font-semibold text-red-600">-{fmt(Math.round(brutYillik * 0.14 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-red-600">İşsizlik Primi (%1)</span>
                  <span className="font-semibold text-red-600">-{fmt(Math.round(brutYillik * 0.01 * 100) / 100)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-red-600">Gelir Vergisi {gelirVergisiDilimleri}</span>
                  <span className="font-semibold text-red-600">-{fmt(gelirVergisi)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                  <span className="font-semibold text-red-600">-{fmt(damgaVergisi)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-green-700">Net Fazla Mesai</span>
                  <span className="text-sm font-bold text-green-700">{fmt(netYillik)}</span>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-4">Tablodaki brüt fazla mesai toplamının nete çevrimi</p>
            </div>

            {/* Kart 2: Mahsuplaşma */}
            <Card className="md:col-span-1 soft-card">
              <CardHeader>
                <CardTitle className="text-lg fade-section">Mahsuplaşma</CardTitle>
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
                    className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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

        {/* Sağ: Not Alanı */}
        <div>
          <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 notes-content">
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs">ℹ️</span>
                  <span>Arayüz statik form görünümündedir.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs">⏱️</span>
                  <span>Tarih ve saat değişince hesaplamalar otomatik güncellenir.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs">📋</span>
                  <span>Tablo biçimi raporlara uygundur.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs">💱</span>
                  <span>Rakamlar TR formatında gösterilir.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Kat Sayı Hesapla Modal */}
      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      {/* Mahsuplaşma Modal */}
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={rows.map((r) => {
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
      
      <FooterActions
        onPrint={handlePrint}
        onSave={save}
        previewButton={{
          title: "",
          copyTargetId: "rapor-icerik",
          renderContent: () => (
            <div id="rapor-icerik" style={{fontFamily:'Inter, Arial, sans-serif', color:'#111827'}}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12}}>
                <div style={{fontSize:18, fontWeight:700}}>{resolvedTitle} Hesaplama Cetveli</div>
                <div style={{textAlign:'right', fontSize:12, color:'#374151'}}>
                  <div><strong>MERCAN DANIŞMANLIK</strong></div>
                  <div>Dijital Hesaplama Aracı</div>
                  <div>Tarih: {new Date().toLocaleDateString('tr-TR')}</div>
                </div>
              </div>

              {/* Özet Grid */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', border:'1px solid #d1d5db', borderRadius:6, padding:10, marginBottom:12, background:'#fafafa'}}>
                <div><div style={{fontSize:12, color:'#6b7280'}}>Davacı</div><div style={{fontSize:13, fontWeight:600}}>-</div></div>
                <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Fazla Mesai</div><div style={{fontSize:13, fontWeight:600}}>{(backendResult.weeklyOvertimeHours || haftalikMesai || 0).toFixed(2).replace('.', ',')} saat</div></div>
                <div><div style={{fontSize:12, color:'#6b7280'}}>İşe Giriş</div><div style={{fontSize:13, fontWeight:600}}>{iseGiris || '-'}</div></div>
                <div><div style={{fontSize:12, color:'#6b7280'}}>İşten Çıkış</div><div style={{fontSize:13, fontWeight:600}}>{istenCikis || '-'}</div></div>
                <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Gün</div><div style={{fontSize:13, fontWeight:600}}>{weeklyDays}</div></div>
              </div>

              {/* Metin Hesaplaması - GRID FORMAT */}
              {(fmPeriods.length > 0 || txtTatilsiz || txtTatilli || txtUnderSeven) && (
                <div style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                  <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Metin Hesaplaması</div>
                  <div style={{padding:'10px', background:'#fafafa', borderTop:'1px solid #e5e7eb'}}>
                    {fmPeriods.length > 0 ? (
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px'}}>
                        {fmPeriods.map((p, idx) => (
                          <div key={idx} style={{padding:'12px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', fontSize:13, lineHeight:1.6, whiteSpace:'pre-line'}}>
                            {p.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:13, fontFamily:'monospace', lineHeight:1.6, color:'#374151'}}>
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
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'left', whiteSpace:'nowrap'}}>{r.rangeLabel}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.weeks}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.brut)}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>225</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>1,5</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>{fmt(r.fm)}</td>
                      </tr>
                    ))}
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

              {/* Brütten Nete Çevir */}
              <div style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Brütten Nete Çevir</div>
                <div style={{padding:'10px', fontSize:12, background:'#fafafa', borderTop:'1px solid #e5e7eb'}}>
                  <div style={{marginBottom:6}}>
                    <span>Brüt Fazla Mesai: </span>
                    <strong>{fmt(brutYillik)}</strong>
                  </div>
                  <div style={{marginBottom:6, color:'#dc2626'}}>
                    SGK Primi (%14): -{fmt(Math.round(brutYillik * 0.14 * 100) / 100)}
                  </div>
                  <div style={{marginBottom:6, color:'#dc2626'}}>
                    İşsizlik Primi (%1): -{fmt(Math.round(brutYillik * 0.01 * 100) / 100)}
                  </div>
                  <div style={{marginBottom:6, color:'#dc2626'}}>
                    Gelir Vergisi {gelirVergisiDilimleri}: -{fmt(gelirVergisi)}
                  </div>
                  <div style={{marginBottom:6, color:'#dc2626'}}>
                    Damga Vergisi (binde 7,59): -{fmt(damgaVergisi)}
                  </div>
                  <div style={{marginTop:8, fontWeight:600, color:'#16a34a'}}>
                    Net Fazla Mesai: {fmt(netYillik)}
                  </div>
                </div>
              </div>

              {/* Mahsuplaşma */}
              <div style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Mahsuplaşma</div>
                <div style={{padding:'10px', fontSize:12, background:'#fafafa', borderTop:'1px solid #e5e7eb'}}>
                  <div style={{marginBottom:8}}>
                    <div style={{marginBottom:4}}>1/3 Hakkaniyet İndirimi:</div>
                    <div style={{fontWeight:600}}>{fmt(Number(brutYillik || 0) / 3)}</div>
                  </div>
                  <div style={{marginBottom:8}}>
                    <div style={{marginBottom:4}}>Mahsuplaşma Miktarı:</div>
                    <div style={{fontWeight:600}}>
                      {(() => {
                        const num = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                        return num > 0 ? fmt(num) : '0,00₺';
                      })()}
                    </div>
                  </div>
                  <div style={{marginTop:8, paddingTop:8, borderTop:'1px solid #e5e7eb'}}>
                    <div style={{marginBottom:4, fontSize:11, color:'#6b7280'}}>
                      Toplam Fazla Mesai ({fmt(brutYillik)}) − 1/3 Hakkaniyet İndirimi ({fmt(Number(brutYillik || 0) / 3)}) − Mahsuplaşma ({(() => {
                        const num = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                        return num > 0 ? fmt(num) : '0,00₺';
                      })()}) =
                    </div>
                    <div style={{fontSize:14, fontWeight:700, color:'#111827'}}>
                      {fmt(brutYillik - (Number(brutYillik || 0) / 3) - (Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ),
        }}
      />
    </div>
    </Layout>
  );
}
