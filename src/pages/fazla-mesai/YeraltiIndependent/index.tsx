import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { flushSync, createPortal } from "react-dom";
import ReportPreviewButton from "./localComponents/ReportPreviewButton";
import Layout from "./localComponents/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast, ToastProvider, Toaster } from "./localContext/ToastContext";
import { useKaydetContext } from "./localHooks/useKaydet";
import { API_BASE_URL, apiPost } from "./localUtils/apiClient";
import { asgariUcretler } from "./localUtils/asgariUcretler";
import { Button } from "./localComponents/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./localComponents/ui/card";
import { Input } from "./localComponents/ui/input";
import { Label } from "./localComponents/ui/label";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";
import UbgtKatsayiModal from "./localComponents/UbgtKatsayiModal";
import MahsuplasamaModal from "./localComponents/MahsuplasamaModal";
import { getAsgariUcretPeriods } from "./localConstants/asgariUcretPeriods";
import { calculateOvertimeTable } from "./localUtils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "./localUtils/overtimeCalculator";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "./localUtils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays, format } from "date-fns";
// apply270Rule backend'de - frontend'te gereksiz
import { getScopedStorageKey } from "./localUtils/storageKey";
import { YillikIzinDislamalariPanel } from "./localComponents/YillikIzinDislamalariPanel";
// Soft glow styles removed for isolation

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "./localComponents/report";
import type { ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_YERALTI_REPORT = true;

// NOT: computeClassic ve calculateWitnessBasedOvertime fonksiyonları artık backend'te.
// Frontend sadece backend'ten gelen verileri kullanıyor.

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

// Constants (previously from constants.ts) - FOR UI DISPLAY ONLY
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const WEEKLY_WORK_LIMIT = 37.5;
const STANDARD_DAILY_REFERENCE_HOURS = 6.25;
const FAZLA_MESAI_DENOMINATOR = 187.5;
const FAZLA_MESAI_KATSAYI = 2;

// Helper functions - FOR UI DISPLAY ONLY
const fmt = (n: number) =>
  `${(n ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;

const formatHoursAsTime = (decimalHours: number) => {
  let hours = Math.floor(decimalHours);
  let minutes = Math.round((decimalHours - hours) * 60);
  
  // Yuvarlama hatası için: 60 dakika = 1 saat
  if (minutes >= 60) {
    hours += 1;
    minutes = 0;
  }
  
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

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

function FazlaMesaiAlacagiPage({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error, info } = useToast();
  const { kaydetAc, isSaving, KaydetModal } = useKaydetContext();
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-yeralti-isci");
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
    if (p.includes("yeralti")) return "Yeraltı İşçileri Fazla Mesai Hesaplama";
    return "Standart Fazla Mesai";
  }, [path]);
  const resolvedTitle = titleOverride || pageTitle;
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [include270, setInclude270] = useState(false);
  const [mode270, setMode270] = useState<"none" | "detailed" | "simple">("none");
  const [show270Dropdown, setShow270Dropdown] = useState(false);
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
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  const [isCalculating, setIsCalculating] = useState(false);
  const calcSeq = useRef(0);
  const [backendResult, setBackendResult] = useState<{ textPeriods?: any[] }>({});

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
      const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
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
  }, [zForm, iseGiris]);
  
  const handleZamanasimiCancel = useCallback(() => {
    setShowZamanaModal(false);
    if (prevZamanaRef.current) {
      setZamanasimiBaslangic(prevZamanaRef.current);
    }
    prevZamanaRef.current = null;
  }, []);

  // Dışlamalar
  const [exclusions, setExclusions] = useState<Excl[]>([]);
  const [exclusionImportTrigger, setExclusionImportTrigger] = useState(0);
  // Dışlama kaydetme/yükleme
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: Excl[]; createdAt: string }[]>([]);
  // Quick-add temp states
  const [yilStart, setYilStart] = useState("");
  const [yilEnd, setYilEnd] = useState("");
  const [yilDays, setYilDays] = useState("");

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

  // Boş satır oluşturma (diğer sayfalarla aynı yapı)
  const createManualRow = useCallback((): PeriodRow => {
    return {
      rangeLabel: "",
      weeks: 0,
      brut: 0,
      katsayi: katSayi || 1,
      fmHours: 0,
      calc225: FAZLA_MESAI_DENOMINATOR,
      factor: FAZLA_MESAI_KATSAYI,
      fm: 0,
      net: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
  }, [katSayi]);

  // Altına yeni boş satır ekleme (satır kopyalamaz)
  const duplicateRow = useCallback((i: number) => {
    setRows((prev) => {
      const copy = [...prev];
      const newRow = createManualRow();
      copy.splice(i + 1, 0, newRow);
      return copy;
    });
  }, [createManualRow]);

  // Satır silme (en az 1 satır kalmalı)
  const deleteRow = useCallback((i: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  // Backend save-and-continue: detect caseId from URL and load if present
  const caseIdRef = useRef<string | null>(null);
  const loadRanRef = useRef<string | null>(null); // Yüklenen ID'yi takip et
  const backendRequestIdRef = useRef(0); // Sadece en güncel backend cevabı rows'u güncellesin (stale response ezmesin)
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
          
          // Saatler ve davaci
          const loadedDavaci = getVal('davaci');
          if (loadedDavaci !== undefined) {
            setDavaci({
              ...loadedDavaci,
              dateIn: loadedIseGiris || loadedDavaci.dateIn || "",
              dateOut: loadedIstenCikis || loadedDavaci.dateOut || "",
            });
            // Davaci'dan gir/cik'i de set et
            if (loadedDavaci.in) setGir(loadedDavaci.in);
            if (loadedDavaci.out) setCik(loadedDavaci.out);
          }
          
          // Notes
          if (json?.notes !== undefined) setNotes(json.notes || "");
          
          // Diğer alanlar
          const loadedWeeklyDays = getVal('weeklyDays');
          if (loadedWeeklyDays !== undefined) setWeeklyDays(loadedWeeklyDays);
          
          // Manuel değiştirilmiş rows varsa yükle
          const loadedRows = getVal('rows');
          if (loadedRows && Array.isArray(loadedRows) && loadedRows.length > 0) {
            setRows(loadedRows);
          }
          
          const loadedTaniklar = getVal('taniklar');
          if (Array.isArray(loadedTaniklar)) setTaniklar(loadedTaniklar);
          
          const loadedExclusions = getVal('exclusions');
          if (loadedExclusions !== undefined) setExclusions(loadedExclusions);
          
          const loadedInclude270 = getVal('include270');
          if (loadedInclude270 !== undefined) setInclude270(!!loadedInclude270);
          
          const loadedMode270 = getVal('mode270');
          if (loadedMode270 !== undefined) setMode270(loadedMode270);
          
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

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + r.fm, 0), [rows]);
  const totalNet = useMemo(() => rows.reduce((a, r) => a + r.net, 0), [rows]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

  // Dinamik metin: rows'tan dönem metinleri (yeraltiReportConfig ve wordTableSections'dan ÖNCE tanımlanmalı)
  const fmPeriods = useMemo(() => {
    return rows.map(row => ({
      label: row.rangeLabel || '',
      text: row.text || `${row.rangeLabel}\n${row.weeks} hafta × ${row.brut}₺ × ${row.fmHours}h = ${row.fm}₺`
    }));
  }, [rows]);

  // YENİ RAPOR SİSTEMİ: Config
  const yeraltiReportConfig = useMemo((): ReportConfig => {
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
      ],
      customSections: [
        ...((): React.ReactNode[] => {
          const fmTextVal = fmPeriods.length > 0
            ? fmPeriods.map(p => p.text).join("\n\n")
            : (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
          if (!fmTextVal) return [];
          return [{
            title: "Fazla Mesai Açıklama",
            content: (
              <div style={{ minWidth: 0, wordBreak: "break-word", whiteSpace: "pre-wrap", textAlign: "left", padding: "8px 0" }}>
                {fmTextVal}
              </div>
            ),
            condition: true,
          }];
        })(),
        ...(exclusions && exclusions.length > 0 ? [{
          title: "Yıllık İzin Dışlamaları",
          content: (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", fontSize: "10px" }}>
              <thead style={{ background: "#f3f4f6" }}>
                <tr>
                  <th style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left" }}>Tür</th>
                  <th style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left" }}>Başlangıç</th>
                  <th style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left" }}>Bitiş</th>
                  <th style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left" }}>Gün</th>
                </tr>
              </thead>
              <tbody>
                {(exclusions as Excl[]).map((ex, i) => (
                  <tr key={ex.id || i}>
                    <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{ex.type || "Yıllık İzin"}</td>
                    <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{ex.start ? new Date(ex.start).toLocaleDateString("tr-TR") : "-"}</td>
                    <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{ex.end ? new Date(ex.end).toLocaleDateString("tr-TR") : "-"}</td>
                    <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{String(ex.days ?? "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          condition: true,
        }] : []),
      ],
      periodData: {
        title: "Fazla Mesai Hesaplama Cetveli",
        headers: ["Dönem", "Hafta Sayısı", "Ücret (BRÜT)", "Katsayı", "FM Saati", "Fazla Mesai Ücreti"],
        rows: rows.map(row => [
          row.rangeLabel,
          row.weeks.toString(),
          `${fmtLocal(row.brut)}₺`,
          row.katsayi.toFixed(4),
          fmtLocal(row.fmHours),
          `${fmtLocal(row.fm)}₺`,
        ]),
        footer: [
          "Toplam Fazla Mesai:",
          "",
          "",
          "",
          "",
          `${fmtLocal(totalBrut)}₺`,
        ],
        alignRight: [1, 2, 3, 4, 5],
        fontSize: '10px',
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
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, rows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari, fmPeriods, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  // Bölüm bazlı Word tabloları (Standart / Tanikli / HaftalikKarma / Donemsel ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (yeraltiReportConfig.infoRows && yeraltiReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: yeraltiReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const fmTextVal = fmPeriods.length > 0
      ? fmPeriods.map(p => p.text).join("\n\n")
      : (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
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
      const exclRows = (exclusions || []).map((ex: Excl) => [
        ex.type || "Yıllık İzin",
        ex.start ? new Date(ex.start).toLocaleDateString("tr-TR") : "-",
        ex.end ? new Date(ex.end).toLocaleDateString("tr-TR") : "-",
        String(ex.days ?? "-"),
      ]);
      const nExcl = adaptToWordTable({ headers: ["Tür", "Başlangıç", "Bitiş", "Gün"], rows: exclRows });
      sections.push({ id: "yillik-izin-dislamalari", title: "Yıllık İzin Dışlamaları", html: buildWordTable(nExcl.headers, nExcl.rows) });
    }

    const pd = yeraltiReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer && pd.footer.length > 0) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = yeraltiReportConfig.grossToNetData?.rows;
    if (gnd && gnd.length > 0) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = yeraltiReportConfig.mahsuplasmaData;
    if (md && md.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [yeraltiReportConfig, fmPeriods, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  const handlePrint = useCallback(() => {
    if (USE_NEW_YERALTI_REPORT) {
      const targetEl = document.getElementById("yeralti-print-wrapper");
      if (!targetEl) {
        window.print();
        return;
      }
      const title = yeraltiReportConfig.title;
      const contentHtml = targetEl.innerHTML;
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${contentHtml}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
      };
    } else {
      window.print();
    }
  }, [yeraltiReportConfig.title]);

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
      setTaniklar([]);
      setExclusions([]);
      
      // SORUN FİX: Yeni hesaplamada kayıt ID'sini ve adını temizle
      caseIdRef.current = null;
      setCurrentRecordName(null);
      loadRanRef.current = null;
      
      // URL'den ID'yi kaldır
      navigate("/fazla-mesai/yeralti-isci", { replace: true });
      
      info("Yeni hesaplama başlatıldı.");
    } catch {}
  };

  const save = () => {
    // Merkezi kayıt sistemini kullan - modal açılır ve kayıt adı girilir
    kaydetAc({
      hesapTuru: "fazla_mesai_yeralti_isci",
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
            taniklar,
            exclusions,
            include270,
            mode270,
            zamanasimi,
            zamanasimiBaslangic,
            pageType: "yeralti-isci",
            route: "/fazla-mesai/yeralti-isci",
            rows: rows, // Manuel değişiklikler için rows'u kaydet
            // SORUN FİX: ...(caseData?.data || {}) KALDIRILDI - içiçe form objesi oluşturuyordu
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
        taniklar,
        exclusions,
        include270,
        mode270,
        zamanasimi,
        zamanasimiBaslangic,
        pageType: "yeralti-isci",
        route: "/fazla-mesai/yeralti-isci",
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `/fazla-mesai/yeralti-isci/:id`,
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
    taniklar,
    gir,
    cik,
    weeklyDays,
    activeTab,
    exclusions,
    finalWeeklyOvertime,
    include270,
    mode270,
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
    mode270,
    iseGiris,
    istenCikis,
    zamanasimiBaslangic,
    haftalikMesai,
    katSayi,
  ]);

  // Form state değiştiğinde hesaplamayı tetikle
  // ÖNEMLİ: rows sadece backend'den gelecek; sadece en güncel isteğin cevabı kullanılır
  useEffect(() => {
    if (!iseGiris?.trim() || !istenCikis?.trim()) return;
    const requestId = ++backendRequestIdRef.current;
    const calculateFromBackend = async () => {
      try {
        setIsCalculating(true);
        
        // Backend'in beklediği formatta dışlama listesi (start/end YYYY-MM-DD, her zaman dizi)
        const exclusionsForApi = Array.isArray(exclusions)
          ? exclusions
              .filter((e) => e && (e.start || e.end || (e as any).start_date || (e as any).end_date))
              .map((e) => {
                const start = e.start ?? e.startDate ?? (e as any).start_date ?? "";
                const end = e.end ?? e.endDate ?? (e as any).end_date ?? "";
                const s = String(start).trim();
                const eStr = String(end).trim();
                return {
                  start: (s.length > 10 ? s.slice(0, 10) : s),
                  end: (eStr.length > 10 ? eStr.slice(0, 10) : eStr),
                  days: Number(e.days) || 0,
                };
              })
              .filter((e) => e.start.length >= 10 && e.end.length >= 10)
          : [];
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
          exclusions: exclusionsForApi,
          katSayi,
          zamanasimiBaslangic,
          include270,
          mode270,
          haftalikMesai,
          iseGiris,
          istenCikis,
        };
        

        const response = await apiPost('/api/fm/yeralti-isci', payload);

        if (!response.ok) {
          let errorMessage = 'Backend error';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
            console.error('❌ [Yeraltı İşçileri] Backend hata detayı:', errorData);
          } catch (e) {
            const errorText = await response.text();
            console.error('❌ [Yeraltı İşçileri] Backend hata metni:', errorText);
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (requestId !== backendRequestIdRef.current) return;
        setRows(result.rows || []);
        setBackendResult({ textPeriods: result.textPeriods || [] });
        setTimeout(() => setIsCalculating(false), 200);
      } catch (err) {
        if (requestId === backendRequestIdRef.current) {
          setIsCalculating(false);
          setRows([]);
        }
        console.error('[Yeraltı İşçileri] Backend error:', err);
      }
    };

    calculateFromBackend();
  }, [
    davaci,
    taniklar,
    weeklyDays,
    activeTab,
    exclusions,
    exclusionImportTrigger,
    katSayi,
    zamanasimiBaslangic,
    include270,
    mode270,
    haftalikMesai,
    iseGiris,
    istenCikis,
    gir,
    cik,
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
      const hasWitnesses = (taniklar || []).some(t => t.in && t.out);
      
      // En az bir beyan kaynağı olmalı
      if (!hasDavaci && !hasWitnesses) {
        return;
      }
      
      const witnessesForCalc = (taniklar || []).filter(t => t.in && t.out).map(t => ({
        in: normalizeTime(t.in) || '',
        out: normalizeTime(t.out) || '',
        dateIn: normalizeDate(t.dateIn) || '',
        dateOut: normalizeDate(t.dateOut) || '',
      }));
      
      // Davacı verisi yoksa tanıklardan al
      let finalDavaciStart = davaciBeyaniStart;
      let finalDavaciEnd = davaciBeyaniEnd;
      
      if (!finalDavaciStart || !finalDavaciEnd) {
        if (witnessesForCalc.length > 0) {
          finalDavaciStart = normalizeTime(witnessesForCalc[0].in) || finalDavaciStart || '07:00';
          finalDavaciEnd = normalizeTime(witnessesForCalc[0].out) || finalDavaciEnd || '19:00';
        }
        if (!finalDavaciStart) finalDavaciStart = '07:00';
        if (!finalDavaciEnd) finalDavaciEnd = '19:00';
      }
      
      // Haftalık fazla mesai backend'ten rows ile geliyor, burada hesaplamaya gerek yok
      // setFinalWeeklyOvertime zaten rows güncellendiğinde otomatik güncelleniyor
    } catch (err) {
      console.error('recalculate error:', err);
    }
  }, [davaci, taniklar, weeklyDays, activeTab]);

  // Form değiştikçe interval ve fazla mesai zincirini otomatik çalıştır (canlı veriler)
  useEffect(() => {
    try { handleCalculateOvertime(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci, taniklar, weeklyDays, activeTab]);

  // davaci, taniklar değiştiğinde recalculate çağır
  useEffect(() => {
    recalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci, taniklar, gir, cik, weeklyDays, activeTab]);

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
        const fromForm = (caseData as any)?.data?.form?.taniklar;
        setCaseData((prev: any) => ({
          ...(prev || {}),
          taniklar: Array.isArray(fromForm) ? fromForm : [],
        }));
      }
    } catch {}
    // ✅ Tanık beyanlarını veritabanındaki JSON'dan çıkar (data.form.taniklar veya anahtar tarama)
    const dataObj: any = caseData?.data || {};
    const formObj: any = dataObj?.form || {};
    const allKeys = Object.keys(dataObj);

    let witnesses: any[] = [];
    if (Array.isArray(formObj.taniklar)) witnesses.push(...formObj.taniklar);
    if (Array.isArray(dataObj.taniklar)) witnesses.push(...dataObj.taniklar);
    for (const key of allKeys) {
      if (key.toLowerCase().includes("tanik") && key !== "taniklar") {
        const val = (dataObj as any)[key];
        if (Array.isArray(val)) witnesses.push(...val);
        else if (val && typeof val === "object") witnesses.push(val);
      }
    }
    if (witnesses.length === 0 && (!taniklar || taniklar.length === 0)) {
      return;
    }
    const witnessesToUse = witnesses.length > 0 ? witnesses : (taniklar || []);

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
    
    // Haftalık fazla mesai backend'ten rows ile geliyor, burada hesaplamaya gerek yok
    // setFinalWeeklyOvertime zaten rows güncellendiğinde otomatik güncelleniyor
    
    // Eski calculateIntervals'i kullanarak sonuçları set et (geriye dönük uyumluluk için)
    const results = calculateIntervals(witnessesToUse, davaciMin, davaciMax);
    setIntervals(results);
    // Tabloyu doldurmak için overtimeResults'u da üret (haftalık FM backend'den rows ile gelir)
    try {
      const mod = await import("@/utils/intervalHelper");
      const calculateOvertimeHours = (mod as any).calculateOvertimeHours as (xs: any[]) => { results: any[] };
      const toStr = (v: any) => (v == null ? "" : String(v));
      const finalIntervals = (witnessesToUse as any[]).map((w) => {
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

  // ESKİ KOD - Silindi (fmPeriods yukarı taşındı - yeraltiReportConfig'den önce)
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

      const adjustedPeriods = classic.periods || [];

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
  // Haftalık fazla mesaiyi backend'ten gelen rows'dan hesapla
  useEffect(() => {
    console.log('[Yeraltı İşçileri] rows state değişti, length:', rows?.length, 'ilk fmHours:', rows?.[0]?.fmHours);
    if (rows && rows.length > 0) {
      // İlk satırın fmHours değerini kullan (tüm satırlar aynı FM saatine sahip olmalı)
      const firstRow = rows[0];
      if (firstRow && firstRow.fmHours !== undefined) {
        console.log('[Yeraltı İşçileri] setHaftalikMesai:', firstRow.fmHours);
        setHaftalikMesai(Number(firstRow.fmHours));
      }
    } else {
      setHaftalikMesai(0);
    }
  }, [rows]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: '80px' }}>
          <div className="mb-8 flex justify-end">
            <div className="flex items-center gap-2">
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
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 md:p-8 space-y-4">
        <div className="w-full space-y-6">
        {/* Ana Form */}
        <div className="space-y-4">
          {/* Üst Alan - Tarihler ve Beyanlar */}
          <div className="space-y-4 divide-y divide-gray-100">
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
                    <div className="bg-gray-50 dark:bg-gray-800" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', border:'1px solid #d1d5db', borderRadius:6, padding:10, marginBottom:12}}>
                      <div><div className="text-gray-600 dark:text-gray-400" style={{fontSize:12}}>Davacı</div><div className="text-gray-900 dark:text-gray-100" style={{fontSize:13, fontWeight:600}}>-</div></div>
                      <div><div className="text-gray-600 dark:text-gray-400" style={{fontSize:12}}>Haftalık Fazla Mesai</div><div className="text-gray-900 dark:text-gray-100" style={{fontSize:13, fontWeight:600}}>{haftalikMesai.toFixed(2).replace('.', ',')} saat</div></div>
                      <div><div className="text-gray-600 dark:text-gray-400" style={{fontSize:12}}>İşe Giriş</div><div className="text-gray-900 dark:text-gray-100" style={{fontSize:13, fontWeight:600}}>{iseGiris || '-'}</div></div>
                      <div><div className="text-gray-600 dark:text-gray-400" style={{fontSize:12}}>İşten Çıkış</div><div className="text-gray-900 dark:text-gray-100" style={{fontSize:13, fontWeight:600}}>{istenCikis || '-'}</div></div>
                      <div><div className="text-gray-600 dark:text-gray-400" style={{fontSize:12}}>Haftalık Gün</div><div className="text-gray-900 dark:text-gray-100" style={{fontSize:13, fontWeight:600}}>{weeklyDays}</div></div>
                    </div>

                    {/* Beyanlar */}
                    <div style={{marginBottom:12}}>
                      <div className="border border-gray-200 dark:border-gray-600" style={{borderRadius:6}}>
                        <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" style={{padding:'8px 10px', fontSize:13, fontWeight:600}}>Davacı Beyanı</div>
                        <div className="text-gray-900 dark:text-gray-100" style={{padding:'10px', fontSize:12}}>
                          <div>-</div>
                        </div>
                      </div>
                    </div>

                    {/* Hesaplama Tablosu */}
                    <div id="calc-table" className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden mb-3">
                      <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Fazla Mesai Hesaplama Tablosu</div>
                      <table className="w-full border-collapse text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left text-gray-900 dark:text-gray-100">Tarih Aralığı</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">Hafta Sayısı</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">Ücret</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">Kat Sayı Çarpanı</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">Fazla Mesai Saati</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">187.5</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">2</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-gray-900 dark:text-gray-100">Fazla Mesai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={`row-${i}-${r.startISO}-${r.endISO}-${r.fmHours}-${r.fm}`}>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-left text-gray-900 dark:text-gray-100">{r.rangeLabel}</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{r.weeks}</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{fmt(r.brut)}</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{r.katsayi}</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{formatHoursAsTime(r.fmHours)}</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">187.5</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">2</td>
                              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{fmt(r.fm)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {rows.length>0 && (
                          <tfoot>
                            <tr>
                              <td colSpan={7} className="border border-gray-300 dark:border-gray-600 text-right font-semibold px-2 py-1.5 text-gray-900 dark:text-gray-100">Toplam Fazla Mesai:</td>
                              <td className="border border-gray-300 dark:border-gray-600 font-semibold px-2 py-1.5 text-right text-gray-900 dark:text-gray-100">{fmt(totalBrut)}</td>
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
                        <div className="border border-gray-300 dark:border-gray-600" style={{borderRadius:6, overflow:'hidden', marginBottom:12}}>
                          <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" style={{padding:'8px 10px', fontSize:13, fontWeight:600}}>Brütten Nete Çevirme</div>
                          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                            <tbody>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>Brüt Fazla Mesai</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(brutToplam)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>SSK Primi (15%)</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(ssk)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>Gelir Vergisi (15%)</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(gelirNum)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>Damga Vergisi (0,759%)</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(damga)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>Denge Vergisi</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(denge)}</td></tr>
                              <tr><td className="border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" style={{padding:6, fontWeight:700}}>Net Fazla Mesai</td><td className="border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right', fontWeight:700}}>{tr(net)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>1/3 Hakkaniyet İndirimi (Bilgi)</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(hakkaniyet)}</td></tr>
                              <tr><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6}}>Mahsuplaşma Miktarı (Bilgi)</td><td className="border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" style={{padding:6, textAlign:'right'}}>{tr(mahsup)}</td></tr>
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
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">Haftada Çalışılan Gün <span className="text-gray-500" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500" value={weeklyDays} onChange={(e)=>setWeeklyDays(String(Number(e.target.value)||0))} readOnly={isReadOnly} />
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
              iseGiris={iseGiris || undefined}
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
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davaci.in} onChange={(e)=>{const val=e.target.value; setGir(val); setDavaci((p)=>({...p,in:val}));}} readOnly={isReadOnly} />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Saati</div>
                    <input type="time" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={davaci.out} onChange={(e)=>{const val=e.target.value; setCik(val); setDavaci((p)=>({...p,out:val}));}} readOnly={isReadOnly} />
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
          {zamanasimiBaslangic && rows.length > 0 && (
            <div className="text-xs text-blue-600 mt-2 mb-2 leading-tight">
              Zamanaşımı başlangıç tarihi: {format(new Date(zamanasimiBaslangic), "dd.MM.yyyy")} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
            </div>
          )}
          
          {/* Alt Alan - Dışlamalar (akordiyon panel) ve Tablo */}
          <div className="soft-card space-y-3" style={{ padding: '16px' }}>
            <YillikIzinDislamalariPanel
              exclusions={exclusions}
              setExclusions={setExclusions}
              success={success}
              showToastError={error}
              onExclusionsImported={() => setExclusionImportTrigger((n) => n + 1)}
            />
            <div className="text-xs text-gray-600 -mb-1 flex items-center gap-1">
              <span className="cursor-help" title="Tablo işe giriş–çıkış tarihine göre yıl bazında otomatik oluşturulur. Yıl tamamlanmamışsa, aralık çıkış tarihiyle sınırlanır.">ℹ️</span>
              <span>Tablo yıl bazında otomatik oluşturulur.</span>
            </div>
            <div className="mt-2 mb-2">
              <table className="table-auto w-full text-sm border border-gray-300" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-[#f8f9fa]" style={{ borderBottom: '2px solid #d0d0d0' }}>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Tarih Aralığı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Hafta Sayısı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Ücret</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Kat Sayı Çarpanı <span className="text-gray-500" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Fazla Mesai Saati <span className="text-gray-500" title="Hesaplanan haftalık fazla mesai saati; gerekirse satır bazlı düzenleyebilirsiniz.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">187.5</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">2</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Fazla Mesai</th>
                    <th className="border-0 bg-transparent w-16"></th>
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
                      <td className="border border-gray-300 px-2 py-1.5 text-right">187.5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">2</td>
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
                              // Boş bırakılırsa veya 0 ise otomatik asgari ücreti kullan (YERalti işçileri için ÇİFT asgari ücret)
                              const au = asgariUcretler.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
                              const yeraltiUcret = au.brut * 2; // Yeraltı işçileri çift asgari ücret alır
                              e.target.value = `${yeraltiUcret.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const kats = katSayi;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((row.weeks * yeraltiUcret).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, brut: yeraltiUcret, fm, net, katsayi: kats };
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
                            return fmt(au.brut * 2); // Yeraltı işçileri çift asgari ücret
                          })()}
                          className="w-32 text-right rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{Number(r.katsayi.toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        <input
                          type="text"
                          value={formatHoursAsTime(r.fmHours)}
                          key={`fm-${i}-${r.startISO}-${r.fmHours}`}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            let v = 0;
                            if (val.includes(':')) {
                              const [h, m] = val.split(':').map(n => Number(n) || 0);
                              v = h + (m / 60);
                            } else {
                              v = Number(String(val).replace(/\./g, '').replace(',', '.')) || 0;
                            }
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
                              return { ...row, fmHours: v, fm, net, fmManual: true };
                            }));
                          }}
                          onBlur={(e) => {
                            let v = 0;
                            const val = e.target.value.trim();
                            if (val.includes(':')) {
                              const [h, m] = val.split(':').map(n => Number(n) || 0);
                              v = h + (m / 60);
                            } else {
                              v = Number(String(val).replace(/\./g, '').replace(',', '.')) || 0;
                            }
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
                      <td className="border border-gray-300 px-2 py-1.5 text-right">187.5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">2</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{fmt(r.fm)}</td>
                      {/* Satır ekleme ve silme butonları - sadece hover'da görünür */}
                      <td className="border-0 bg-transparent w-16 p-0">
                        {hoveredRow === i && (
                          <div className="flex gap-1 justify-center items-center">
                            <span
                              className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer text-lg leading-none"
                              onClick={() => duplicateRow(i)}
                              title="Altına yeni boş satır ekle"
                            >
                              +
                            </span>
                            <span
                              className="row-delete-icon text-red-500 hover:text-red-600 cursor-pointer text-lg leading-none"
                              onClick={() => {
                                if (rows.length <= 1) return;
                                deleteRow(i);
                              }}
                              style={{ opacity: rows.length <= 1 ? 0.3 : 1, cursor: rows.length <= 1 ? 'not-allowed' : 'pointer' }}
                              title={rows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                            >
                              −
                            </span>
                          </div>
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

          {/* İki Ayrı Kart: Solda Brütten Nete, Sağda Mahsuplaşma - ZARİF */}
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

            {/* Kart 2: Hakkaniyet İndirimi + Mahsuplaşma (Dönemsel Haftalık ile aynı yapı) */}
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
                    value={`${(Number(brutYillik || 0) / 3).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
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

        {/* Notlar */}
        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
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

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      {USE_NEW_YERALTI_REPORT && (
        <div id="yeralti-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={yeraltiReportConfig} />
        </div>
      )}

      {KaydetModal()}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={save}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: `${resolvedTitle} Rapor`,
          copyTargetId: "yeralti-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #yeralti-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #yeralti-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="yeralti-word-copy">
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
  );
}

export default function YeraltiIndependent(props: Props) {
  return (
    <ToastProvider>
      <Toaster />
      <FazlaMesaiAlacagiPage {...props} />
    </ToastProvider>
  );
}
