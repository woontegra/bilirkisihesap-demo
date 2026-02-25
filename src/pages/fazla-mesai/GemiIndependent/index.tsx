import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ZamanasimiModal from "@/components/ZamanasimiModal";
import { flushSync } from "react-dom";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { asgariUcretler } from "@/utils/asgariUcretler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UbgtKatsayiModal from "@/pages/ubgt-alacagi/UbgtIndependent/UbgtKatsayiModal";
import MahsuplasamaModal from "@/pages/hafta-tatili-alacagi/StandardIndependent/MahsuplasamaModal";
import { getAsgariUcretPeriods } from "@/constants/asgariUcretPeriods";
import { calculateOvertimeTable } from "@/utils/calculateOvertimeTable";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "@/utils/overtimeCalculator";
import { normalizeLocalDate } from "@/utils/dateHelpers";
import { generateDynamicIntervals, calculateIntervals } from "@/utils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { getScopedStorageKey } from "@/utils/storageKey";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Constants (inline)
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

// Helper functions (inline)
const fmt = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value)) return '0,00₺';
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
};

const formatTR = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('tr-TR');
};

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

const normalizeDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
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

// Ara dinlenme: 4857/68 + Yargıtay (üst sınır 1 dk eksik) — 7,5–10:59→1; 11–13:59→1,5; 14–14:59→2; 15+→3
const computeBreakHours = (dailyGross: number): number => {
  if (!Number.isFinite(dailyGross) || dailyGross < 7.5) return 0;
  if (dailyGross < 11) return 1;
  if (dailyGross < 14) return 1.5;
  if (dailyGross < 15) return 2;
  return 3;
};

const calculateWeekCount = (startDate: Date, endDate: Date, exclusions: ExcludedDay[] = []): number => {
  try {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    const diffTime = end.getTime() - start.getTime();
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    let excludedDays = 0;
    for (const excl of exclusions) {
      if (!excl.start || !excl.end) continue;
      const exStart = new Date(excl.start);
      const exEnd = new Date(excl.end);
      if (isNaN(exStart.getTime()) || isNaN(exEnd.getTime())) continue;
      
      const overlapStart = exStart < start ? start : exStart;
      const overlapEnd = exEnd > end ? end : exEnd;
      
      if (overlapStart <= overlapEnd) {
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        excludedDays += overlapDays;
      }
    }
    
    const workDays = Math.max(0, totalDays - excludedDays);
    return Math.ceil(workDays / 7);
  } catch (error) {
    console.error("calculateWeekCount error:", error);
    return 0;
  }
};
// Validation fonksiyonları backend'de
import "@/styles/soft-glow.css";

type PeriodRow = {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  calc225: number;
  factor: number;
  fm: number; // Brüt Fazla Mesai
  net: number; // Net Fazla Mesai (kesintiler sonrası)
  startISO: string;
  endISO: string;
  manual?: boolean;
};

type Beyan = { in: string; out: string; dateIn?: string; dateOut?: string };
type Witness = Beyan & { id: number };

// Excl tipi artık calculations.ts'den import edilen ExcludedDay ile aynı
type Excl = ExcludedDay;

type Props = { titleOverride?: string };

export default function FazlaMesaiAlacagiPage({ titleOverride }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const location = useLocation();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-gemi");
  const path = location?.pathname || "";
  const [calculationType, setCalculationType] = useState<"gunluk" | "7-24">(() => {
    return path.includes("gemi-7-24") ? "7-24" : "gunluk";
  });
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  
  useEffect(() => {
    if (path.includes("gemi-7-24")) {
      setCalculationType("7-24");
    } else if (path.includes("gemi") && !path.includes("gemi-7-24")) {
      setCalculationType("gunluk");
    }
  }, [path]);
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
    if (p.includes("gemi")) {
      return calculationType === "7-24" 
        ? "Gemi Adamları 7/24 Çalışan Fazla Mesai Hesaplama"
        : "Gemi Adamları Günlük Çalışan Fazla Mesai Hesaplama";
    }
    return "Standart Fazla Mesai";
  }, [path, calculationType]);
  const resolvedTitle = titleOverride || pageTitle;
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [include270, setInclude270] = useState(false);
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
  const [fmHoursAuto, setFmHoursAuto] = useState<number>(0);
  const [haftalikMesai, setHaftalikMesai] = useState<number>(0);

  // Beyanlar
  const [davaci, setDavaci] = useState<Beyan>({ in: "", out: "" });
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  const [puantaj, setPuantaj] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [avgHours, setAvgHours] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const calcSeq = useRef(0);

  // Tanık beyanları: her zaman en az 1 boş satır göster
  useEffect(() => {
    try {
      if (!Array.isArray(taniklar) || taniklar.length === 0) {
        setTaniklar([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taniklar]);

  // Davacı beyanı için çoklu dönem yönetimi
  type DavaciPeriod = { id: string; dateIn: string; dateOut: string; in: string; out: string };
  const [davaciPeriods, setDavaciPeriods] = useState<DavaciPeriod[]>([
    { id: "1", dateIn: "", dateOut: "", in: "", out: "" }
  ]);
  
  const addDavaciPeriod = () => {
    setDavaciPeriods((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), dateIn: "", dateOut: "", in: "", out: "" }
    ]);
  };
  
  const removeDavaciPeriod = (id: string) => {
    if (davaciPeriods.length > 1) {
      setDavaciPeriods((prev) => prev.filter((p) => p.id !== id));
    }
  };
  
  const updateDavaciPeriod = (id: string, updates: Partial<DavaciPeriod>) => {
    setDavaciPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Davacı dönemlerinden davaci state'ini güncelle (ilk dönem kullanılır)
  useEffect(() => {
    if (davaciPeriods.length > 0) {
      const firstPeriod = davaciPeriods[0];
      setDavaci((prev) => ({
        ...prev,
        dateIn: firstPeriod.dateIn || "",
        dateOut: firstPeriod.dateOut || "",
        in: firstPeriod.in || "",
        out: firstPeriod.out || "",
      }));
    }
  }, [davaciPeriods]);
  // Önizleme için haftalık FM (bilgi kutusu)
  const [haftalikFazlaMesai, setHaftalikFazlaMesai] = useState<number | null>(null);
  const [fmPreviewSource, setFmPreviewSource] = useState<"ortalama"|"davaci"|"tanik"|null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewPayload, setPreviewPayload] = useState<{ type: "ortalama"|"davaci"|"tanik"; entry: string; exit: string } | null>(null);
  const [previewTouched, setPreviewTouched] = useState<boolean>(false);
  const [avgDateIn, setAvgDateIn] = useState<string>("");
  const [avgDateOut, setAvgDateOut] = useState<string>("");
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

  // Davacı Beyanı ile tek başına hesaplama: üstteki tarih/saat alanları değiştikçe davaci state'ini senkronize et
  useEffect(() => {
    try {
      const next = { in: gir || "", out: cik || "", dateIn: iseGiris || "", dateOut: istenCikis || "" };
      const cur = davaci || ({} as any);
      if (cur.in !== next.in || cur.out !== next.out || cur.dateIn !== next.dateIn || cur.dateOut !== next.dateOut) {
        setDavaci(next);
      }
    } catch {}
  }, [gir, cik, iseGiris, istenCikis]);
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

  // Dışlamalar
  const [exclusions, setExclusions] = useState<Excl[]>([]);
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

  // Kat sayı uygulama fonksiyonu
  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    setRows((prev) => prev.map((r) => {
      const step1 = Number((r.weeks * r.brut).toFixed(6));
      const step2 = Number((step1 * katsayi).toFixed(6));
      const step3 = Number((step2 * r.fmHours).toFixed(6));
      const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
      const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
      const fm = Number(step5.toFixed(2));
      const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
      return { ...r, katsayi, fm, net };
    }));
    setHasCustomKatsayi(true);
  }, []);

  // Kat sayı kaldırma fonksiyonu
  const removeGlobalCoefficient = useCallback(() => {
    setRows((prev) => prev.map((r) => {
      const katsayi = 1;
      const step1 = Number((r.weeks * r.brut).toFixed(6));
      const step2 = Number((step1 * katsayi).toFixed(6));
      const step3 = Number((step2 * r.fmHours).toFixed(6));
      const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
      const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
      const fm = Number(step5.toFixed(2));
      const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
      return { ...r, katsayi, fm, net };
    }));
    setHasCustomKatsayi(false);
  }, []);

  // Boş satır oluşturma (diğer sayfalarla aynı yapı)
  const createManualRow = useCallback((): PeriodRow => {
    return {
      rangeLabel: "",
      weeks: 0,
      brut: 0,
      katsayi: 1,
      fmHours: 0,
      calc225: FAZLA_MESAI_DENOMINATOR,
      factor: FAZLA_MESAI_KATSAYI,
      fm: 0,
      net: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
  }, []);

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
        if (loadRanRef.current) return;
        loadRanRef.current = true;
        caseIdRef.current = loadId;
        
        const data = await loadCalculation(loadId);
        
        if (!isMounted) return;
        
        // Eski format desteği için caseData'yı set et
        setCaseData({
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes,
          data: data.formValues,
        });
        
        // Form alanlarını doldur
        if (data.start_date) setIseGiris(data.start_date);
        if (data.end_date) setIstenCikis(data.end_date);
        if (data.notes !== undefined) setNotes(data.notes || "");
        
        const d = data.formValues || {};
        if (d.weeklyDays !== undefined) setWeeklyDays(d.weeklyDays);
        if (d.gir !== undefined) setGir(d.gir);
        if (d.cik !== undefined) setCik(d.cik);
        // davaciPeriods'u önce yükle (useEffect davaci'yı güncelleyecek)
        if (d.davaciPeriods !== undefined && Array.isArray(d.davaciPeriods) && d.davaciPeriods.length > 0) {
          setDavaciPeriods(d.davaciPeriods);
        } else if (d.davaci !== undefined) {
          // Eski kayıtlar için: davaci varsa ama davaciPeriods yoksa, davaci'dan davaciPeriods oluştur
          setDavaciPeriods([{
            id: "1",
            dateIn: d.davaci.dateIn || "",
            dateOut: d.davaci.dateOut || "",
            in: d.davaci.in || "",
            out: d.davaci.out || ""
          }]);
        }
        if (d.taniklar !== undefined) setTaniklar(d.taniklar);
        if (d.puantaj !== undefined) setPuantaj(d.puantaj);
        if (d.exclusions !== undefined) setExclusions(d.exclusions);
        if (d.include270 !== undefined) setInclude270(!!d.include270);
        if (d.zamanasimi !== undefined) setZamanasimi(d.zamanasimi);
        if (d.zamanasimiBaslangic !== undefined) setZamanasimiBaslangic(d.zamanasimiBaslangic);
        if (d.pageType !== undefined) {
          // pageType'a göre calculationType'ı ayarla
          if (d.pageType === "gemi-7-24") {
            setCalculationType("7-24");
          } else {
            setCalculationType("gunluk");
          }
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        success(`Kayıt yüklendi (#${loadId})`);
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
  }, [id]);
  
  const caseIdRef = useRef<string | null>(null);
  const loadRanRef = useRef<boolean>(false);

  // ---- No persistence: ensure fresh state on reload ----
  useEffect(() => {
    try {
      // Clear any previous persisted key if exists from older versions
      localStorage.removeItem(getScopedStorageKey("fm_page_state_v1"));
    } catch {}
  }, []);

  const handleHesapla = (include270Override?: boolean) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[DEV] Sample data suppressed');
    }
    try {
      const mySeq = ++calcSeq.current;
      // Tablo her zaman görünür olacak, veri yoksa boş satır gösterilecek
      if (!overtimeResults || !Array.isArray(overtimeResults) || overtimeResults.length === 0) {
        setRows([]);
        return;
      }
      
      setIsCalculating(true);
      
      // Çoklu dönem hesaplama: calculateOvertimeTable ile tarih aralığını dönemlere böl
      const list: PeriodRow[] = ([] as PeriodRow[]).concat(...(overtimeResults as any[]).map((r: any) => {
        const partsFromPeriods = calculateOvertimeTable(r.start, r.end, 0);
        const parts: PeriodRow[] = partsFromPeriods.map(p => {
          const ps = normalizeLocalDate(p.startISO);
          const pe = normalizeLocalDate(p.endISO);
          const au = asgariUcretler.find(a => normalizeLocalDate(p.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(p.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
          const kats = 1;
          
          // Fazla mesai saatini metin hesaplamasıyla aynı şekilde hesapla
          // overtimeResults'tan gelen haftalikCalisma değerini kullan (zaten doğru hesaplanmış)
          const haftalikCalisma = Number(r.haftalikCalisma ?? 0);
          const fmHours = Number(Math.max(0, haftalikCalisma - WEEKLY_WORK_LIMIT).toFixed(2));
          
          // Dışlanabilir günleri hesaba kat
          const w = calculateWeekCount(ps, pe, exclusions);
          // Formül: Hafta sayısı X ücret X kat sayı X fazla mesai saati / FAZLA_MESAI_DENOMINATOR X 1.25 (Gemi Adamları için özel)
          const step1 = Number((w * au.brut).toFixed(6));
          const step2 = Number((step1 * kats).toFixed(6));
          const step3 = Number((step2 * fmHours).toFixed(6));
          const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
          const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
          const fm = Number(step5.toFixed(2));
          const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
          return {
            rangeLabel: `${formatDateTRStr(p.startISO)}–${formatDateTRStr(p.endISO)}`,
            weeks: w,
            brut: au.brut,
            katsayi: kats,
            fmHours,
            fmManual: false,
            calc225: FAZLA_MESAI_DENOMINATOR,
            factor: FAZLA_MESAI_KATSAYI,
            fm,
            net,
            startISO: p.startISO,
            endISO: p.endISO,
          } as PeriodRow;
        });
        return parts;
      }));
      let adjusted = list;

    // Zamanaşımı kontrolü: zamanaşımı başlangıç tarihinden önceki dönemleri filtrele veya başlangıcını ayarla
    if (zamanasimiBaslangic) {
      const zamanasimiBaslangicDate = normalizeLocalDate(zamanasimiBaslangic);
      adjusted = adjusted
        .map(r => {
          const rowStart = normalizeLocalDate(r.startISO);
          const rowEnd = normalizeLocalDate(r.endISO);
          
          // Dönem zamanaşımı başlangıç tarihinden sonra bitiyorsa, dönemi dahil et
          if (rowEnd >= zamanasimiBaslangicDate) {
            // Eğer dönem başlangıcı zamanaşımı başlangıcından önceyse, başlangıcı ayarla
            if (rowStart < zamanasimiBaslangicDate) {
              const newStartDate = zamanasimiBaslangicDate;
              // Yerel tarih metodlarını kullan (UTC metodları yerine) - saat dilimi farkı nedeniyle 1 gün sapma olmaması için
              const y = newStartDate.getFullYear();
              const m = String(newStartDate.getMonth() + 1).padStart(2, "0");
              const dd = String(newStartDate.getDate()).padStart(2, "0");
              const newStartISO = `${y}-${m}-${dd}`;
              
              // Yeni başlangıç tarihi ile hafta sayısını yeniden hesapla
              const w = calculateWeekCount(newStartDate, rowEnd, exclusions);
              
              // Ücret dönemi için asgari ücreti bul
              const au = asgariUcretler.find(a => normalizeLocalDate(newStartISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(newStartISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
              
              // Fazla mesai hesaplamasını yeniden yap
              const step1 = Number((w * au.brut).toFixed(6));
              const step2 = Number((step1 * r.katsayi).toFixed(6));
              const step3 = Number((step2 * r.fmHours).toFixed(6));
              const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
              const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
              const fm = Number(step5.toFixed(2));
              const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
              
              return {
                ...r,
                rangeLabel: `${formatDateTRStr(newStartISO)}–${formatDateTRStr(r.endISO)}`,
                weeks: w,
                brut: au.brut,
                fm,
                net,
                startISO: newStartISO,
              };
            }
            // Dönem zaten zamanaşımı başlangıcından sonra başlıyorsa, olduğu gibi bırak
            return r;
          }
          // Dönem zamanaşımı başlangıç tarihinden önce bitiyorsa, null döndür (filtrelenecek)
          return null;
        })
        .filter((r): r is PeriodRow => r !== null);
    }

    // 270-saat opsiyonu: işe giriş yılı baz alınarak her çalışma yılı (tam/kısmi) için 270 saat oransal düşüm
    const apply270 = include270Override !== undefined ? include270Override : include270;
    if (apply270) {
      try {
        const haftalikFazlaMesai = Number(haftalikMesai) || 0;
        let toplamDusulen = 0;
        try {
          const s = iseGiris ? normalizeLocalDate(iseGiris) : null;
          const e = istenCikis ? normalizeLocalDate(istenCikis) : null;
          if (s && e && !Number.isNaN(+s) && !Number.isNaN(+e) && e > s) {
            if (haftalikFazlaMesai > 0) {
              // Yıl segmentleri: [baslangic, bitis) her biri 365 güne kadar; son yıl dahil
              const years: { baslangic: Date; bitis: Date; gun: number; oran: number }[] = [];
              let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
              const endAll = new Date(e.getFullYear(), e.getMonth(), e.getDate());
              while (cur < endAll) {
                const next = new Date(cur.getTime());
                next.setFullYear(next.getFullYear() + 1);
                const segEnd = next > endAll ? endAll : next;
                const days = Math.max(0, Math.floor((toDateStripped(segEnd).getTime() - toDateStripped(cur).getTime()) / 86400000));
                const oran = days / 365;
                years.push({ baslangic: new Date(cur.getTime()), bitis: new Date(segEnd.getTime()), gun: days, oran });
                cur = segEnd;
              }

              adjusted = adjusted.map(r => ({ ...r }));
              // Satırları yıl içinde ilk dönemlerden başlayarak işlem yapmak için başlangıca göre sırala
              const sortedIdx = adjusted
                .map((r, i) => ({ i, d: normalizeLocalDate(r.startISO).getTime() }))
                .sort((a, b) => a.d - b.d)
                .map(x => x.i);
              years.forEach((y) => {
                // Her yıl için tam 270 saate karşılık gelen hafta sayısı
                const dusumHafta = Math.round(
                  INCLUDED_OVERTIME_HOURS / haftalikFazlaMesai
                );
                let kalan = dusumHafta;
                for (let k = 0; k < sortedIdx.length && kalan > 0; k++) {
                  const i = sortedIdx[k];
                  const r = adjusted[i];
                  const rowStart = normalizeLocalDate(r.startISO);
                  const rowEnd = normalizeLocalDate(r.endISO);
                  const kapsar = rowEnd > y.baslangic && rowStart < y.bitis; // yıl aralığı ile çakışıyorsa
                  if (!kapsar) continue;
                  const oldWeeks = r.weeks;
                  if (oldWeeks <= 0) continue;
                  const rm = Math.min(kalan, oldWeeks);
                  const newWeeks = Math.max(oldWeeks - rm, 0);
                  if (oldWeeks > 0 && r.fm) {
                    r.fm = r.fm * (newWeeks / oldWeeks);
                    r.net = r.fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI);
                  }
                  r.weeks = newWeeks;
                  kalan -= rm;
                  toplamDusulen += rm;
                }
              });
              if (calcSeq.current === mySeq) setHaftaDususBilgisi(toplamDusulen > 0 ? toplamDusulen : null);
            } else {
              if (calcSeq.current === mySeq) setHaftaDususBilgisi(null);
            }
          }
        } catch {}
        
      } catch {}
    } else {
      setHaftaDususBilgisi(null);
    }

      if (calcSeq.current === mySeq) setRows(adjusted);

      // kısa gecikme ile spinner'ı kapat
      setTimeout(() => {
        if (calcSeq.current === mySeq) setIsCalculating(false);
      }, 200);
    } catch {
      setIsCalculating(false);
      // hesaplama otomatik, kullanıcıyı rahatsız etmemek için toast göstermiyoruz
    }
  };

  // Sadece mount anında bir kez hesapla
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize page type on mount and whenever path changes
  useEffect(() => {
    try { initializePageType(); } catch {}
  }, [location.pathname, initializePageType]);

  // Overtime sonuçları değiştikçe tabloyu otomatik güncelle
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overtimeResults, include270, exclusions]);

  // Zamanaşımını kaldır
  const handleZamanasimiIptal = () => {
    try {
      setZamanasimi(null);
      setZamanasimiBaslangic(null);
      prevZamanaRef.current = null;
      handleHesapla();
      info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
    } catch {}
  };

  const handleInclude270Change = (e: any) => {
    const checked = !!e?.target?.checked;
    setInclude270(checked);
    // İşaretlenince anında hesaplamayı güncelle
    setTimeout(() => { try { handleHesapla(checked); } catch {} }, 0);
  };

  // Zamanaşımı başlangıcı değiştiğinde yeniden hesapla
  useEffect(() => {
    try { handleHesapla(); } catch {}
  }, [zamanasimiBaslangic]);

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

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + r.fm, 0), [rows]);
  const totalNet = useMemo(() => rows.reduce((a, r) => a + r.net, 0), [rows]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

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
        const basePath = calculationType === "7-24" ? "/fazla-mesai/gemi-7-24" : "/fazla-mesai/gemi";
        window.location.href = basePath;
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
        ortalama: {},
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
      setPuantaj({ start: "", end: "" });
      setExclusions([]);
      setCurrentRecordName(null);
      caseIdRef.current = null;
      loadRanRef.current = false;
      
      info("Yeni hesaplama başlatıldı.");
    } catch {}
  }, [iseGiris, istenCikis, id, calculationType, info]);

  const save = () => {
    // Merkezi kayıt sistemini kullan
    // netYillik: brütten nete çeviri sonucu (ekranda gösterilen net değer)
    // brutYillik: brütten nete çeviri için kullanılan brüt değer
    // calculationType'a göre hesapTuru belirle
    const hesapTuru = calculationType === "7-24" 
      ? "fazla_mesai_gemi_7_24" 
      : "fazla_mesai_gemi_gunluk";
    
    kaydetAc({
      hesapTuru,
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
            puantaj,
            exclusions,
            include270,
            zamanasimi,
            zamanasimiBaslangic,
            pageType: calculationType === "7-24" ? "gemi-7-24" : "gemi",
            route: calculationType === "7-24" ? "/fazla-mesai/gemi-7-24" : "/fazla-mesai/gemi",
            calculationType,
            ...(caseData?.data || {}),
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
        taniklar,
        puantaj,
        exclusions,
        include270,
        zamanasimi,
        zamanasimiBaslangic,
        pageType: calculationType === "7-24" ? "gemi-7-24" : "gemi",
        route: calculationType === "7-24" ? "/fazla-mesai/gemi-7-24" : "/fazla-mesai/gemi",
        calculationType,
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: calculationType === "7-24" ? `/fazla-mesai/gemi-7-24/:id` : `/fazla-mesai/gemi/:id`,
    });
  };

  // Ortalama Hesapla
  const parseTime = (t: string) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t || "");
    if (!m) return null;
    return Number(m[1]) + Number(m[2]) / 60;
  };
  // Ara dinlenme: 4857/68 + Yargıtay — 7,5–10:59→1; 11–13:59→1,5; 14–14:59→2; 15+→3
  const computeBreakHours = (dailyGross: number) => {
    if (!isFinite(dailyGross) || dailyGross < 7.5) return 0;
    if (dailyGross < 11) return 1;
    if (dailyGross < 14) return 1.5;
    if (dailyGross < 15) return 2;
    return 3;
  };
  // Klasik akış: giriş/çıkıştan günlük ve haftalık saat, adım adım metin
  const computeClassic = () => {
    const sin = parseTime(gir);
    const sout = parseTime(cik);
    if (sin == null || sout == null) { setStepsText(""); return { daily: null as number | null, weekly: null as number | null }; }
    const raw = sout - sin < 0 ? sout - sin + 24 : sout - sin; // günlük brüt çalışma
    const brk = computeBreakHours(raw);
    let daily = Math.max(0, raw - brk); // net çalışma
    let text = `${gir || "??:??"} – ${cik || "??:??"} = ${raw.toFixed(2)} saat çalışma\n`+
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
              `${daily.toFixed(2)} - ${STANDARD_DAILY_REFERENCE_HOURS.toFixed(2)} = ${extra.toFixed(2)} saat hafta tatili mesaisi\n`+
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
  const computeAvg = () => {
    const entries: number[] = [];
    const push = (b: Beyan) => {
      const sin = parseTime(b.in); const sout = parseTime(b.out);
      if (sin == null || sout == null) return;
      let dur = sout - sin;
      if (dur < 0) dur += 24; // gece devri
      const brk = computeBreakHours(dur);
      const net = Math.max(0, dur - brk);
      entries.push(net);
    };
    push(davaci); taniklar.forEach((w)=>push({ in: w.in, out: w.out }));
    if (entries.length === 0) { setAvgHours(null); return; }
    const avg = entries.reduce((a,b)=>a+b,0) / entries.length;
    setAvgHours(Number(avg.toFixed(2)));
  };

  const weeklyMode = weeklyDays === "7" ? "tatilli" : "tatilsiz";
  const weeklyHours = useMemo(() => {
    // Öncelik: klasik giriş/çıkıştan hesaplanan değer; yoksa beyan ortalaması
    const classic = (() => {
      const sin = parseTime(gir); const sout = parseTime(cik);
      if (sin == null || sout == null) return null;
      const raw = sout - sin < 0 ? sout - sin + 24 : sout - sin;
      const brk = computeBreakHours(raw);
      const daily = Math.max(0, raw - brk);
      const n = Number(weeklyDays) || 0;
      if (n === 7) {
        const extra = Math.max(0, daily - STANDARD_DAILY_REFERENCE_HOURS);
        return daily * 6 + extra;
      } else if (n > 0 && n < 7) {
        return daily * n;
      }
      return 0;
    })();
    if (classic != null) return classic;
    const h = avgHours ?? 0;
    const n = Number(weeklyDays) || 0;
    if (n === 7) {
      const extra = Math.max(0, h - STANDARD_DAILY_REFERENCE_HOURS);
      return h * 6 + extra;
    } else if (n > 0 && n < 7) {
      return h * n;
    }
    return 0;
  }, [avgHours, weeklyMode, weeklyDays, gir, cik, davaci, taniklar, puantaj]);

  // Form değiştikçe interval ve fazla mesai zincirini otomatik çalıştır (canlı veriler)
  useEffect(() => {
    try { handleCalculateOvertime(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaci, davaciPeriods, taniklar, weeklyDays]);

  // Sekme (tatilli/tatilsiz) veya gün sayısı ya da giriş/çıkış saatleri değiştiğinde açıklama metnini güncelle
  useEffect(() => {
    try { computeClassic(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weeklyDays, gir, cik]);

  // Sekme veya gün sayısı değiştiğinde tabloyu da güncelle
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weeklyDays]);

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
    // Form state'inden veri al
    // eslint-disable-next-line no-console
    console.group("🧮 handleCalculateOvertime Debug");
    
    // Davacı dönemlerinden veri al
    const gecerliDavaciPeriods = davaciPeriods.filter(p => p.dateIn && p.dateOut && p.in && p.out);
    
    // Eğer davacı dönemleri yoksa, eski davaci state'ini kullan
    const davaciBeyani = gecerliDavaciPeriods.length > 0 ? {
      startDate: normalizeDate(gecerliDavaciPeriods[0]?.dateIn) || '',
      endDate: normalizeDate(gecerliDavaciPeriods[0]?.dateOut) || '',
      startTime: normalizeTime(gecerliDavaciPeriods[0]?.in) || '',
      endTime: normalizeTime(gecerliDavaciPeriods[0]?.out) || '',
    } : {
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
    console.log("📥 Gelen form verileri:", { davaciBeyani, tanikBeyanlari, haftalikGunSayisi, davaciPeriods });
    
    // Davacı veya tanık beyanı yoksa hesaplama yapma
    if (!davaciBeyani.startDate || !davaciBeyani.endDate || !davaciBeyani.startTime || !davaciBeyani.endTime) {
      // eslint-disable-next-line no-console
      console.warn("Davacı beyanı eksik, hesaplama yapılmadı.");
      setOvertimeResults([]);
      // eslint-disable-next-line no-console
      console.groupEnd();
      return;
    }
    
    // Tanık beyanları varsa onları kullan, yoksa davacı dönemlerini tanık formatına çevir
    const gecerliTaniklar = tanikBeyanlari.filter(t => t.startDate && t.endDate && t.startTime && t.endTime);
    
    // Eğer tanık yoksa ve davacı dönemleri varsa, davacı dönemlerini tanık formatına çevir
    if (gecerliTaniklar.length === 0 && gecerliDavaciPeriods.length > 0) {
      const davaciAsWitnesses = gecerliDavaciPeriods.map((p, idx) => ({
        type: 'tanik',
        startDate: normalizeDate(p.dateIn) || '',
        endDate: normalizeDate(p.dateOut) || '',
        startTime: normalizeTime(p.in) || '',
        endTime: normalizeTime(p.out) || '',
      }));
      gecerliTaniklar.push(...davaciAsWitnesses);
    }
    
    try {
      const mod = await import("@/utils/intervalHelper");
      const generateDynamicIntervalsFromWitnesses = (mod as any).generateDynamicIntervalsFromWitnesses;
      const calculateOvertimeHours = (mod as any).calculateOvertimeHours;

      // Tanık aralıklarını tam beyan olarak geçir
      // eslint-disable-next-line no-console
      console.log("⚙️ generateDynamicIntervalsFromWitnesses çağrıldı, gelen tanık sayısı:", gecerliTaniklar?.length, "davacı:", davaciBeyani);
      const finalIntervals = generateDynamicIntervalsFromWitnesses(
        {
          startDate: davaciBeyani.startDate,
          endDate: davaciBeyani.endDate,
          startTime: davaciBeyani.startTime,
          endTime: davaciBeyani.endTime,
          haftalikGunSayisi,
        },
        gecerliTaniklar
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
      setOvertimeResults([]);
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

  const weeklyFMHours = Math.max(0, weeklyHours - WEEKLY_WORK_LIMIT);

  // Dinamik metin: tüm interval sonuçlarını tek metin bloğu olarak yazdır
  const fmText = useMemo(() => {
    try {
      const arr = overtimeResults || [];
      if (!arr.length) return '';
      const lines: string[] = [];
      let toplam = 0;
      for (const r of arr as any[]) {
        const periods = calculateOvertimeTable(r.start, r.end, 0);
        const brut = Number(r.brutCalisma ?? 0);
        const netGunluk = Number(r.gunlukSaat ?? 0);
        const hg = Number(r.haftalikGun ?? 0);
        const haftalik = Number(r.haftalikCalisma ?? 0);
        const fm = Number(r.fazlaMesai ?? 0);
        toplam += fm;
        periods.forEach(p => {
          const label = `${formatDateTRStr(p.startISO)} – ${formatDateTRStr(p.endISO)}`;
          // Ara dinlenme süresini brut değerinden hesapla
          const brk = computeBreakHours(brut);
          if (Number(weeklyDays) === 7 && activeTab === 'tatilli') {
            const weeklyWork = netGunluk * 6;
            const extraHT = Math.max(0, netGunluk - STANDARD_DAILY_REFERENCE_HOURS);
            const toplamCalisma = weeklyWork + extraHT;
            const roundedToplam = Math.round(toplamCalisma);
            const fmTatilli = Math.max(0, roundedToplam - WEEKLY_WORK_LIMIT);
            lines.push(
              `${label}: ${r.start_time || ''}–${r.end_time || ''} = ${brut.toFixed(2)} saat çalışma\n`+
              `- ${brk.toFixed(2)} saat ara dinlenme = ${netGunluk.toFixed(2)} saat günlük çalışma\n`+
              `6 x ${netGunluk.toFixed(2)} = ${weeklyWork.toFixed(2)} saat haftalık çalışma\n`+
              `${netGunluk.toFixed(2)}-${STANDARD_DAILY_REFERENCE_HOURS} = ${extraHT.toFixed(1).replace('.', ',')} saat hafta tatili mesaisi\n`+
              `${weeklyWork.toFixed(0)}+${extraHT.toFixed(1).replace('.', ',')} = ${toplamCalisma.toFixed(1).replace('.', ',')} saat\n`+
              `Net haftalık çalışma = ${roundedToplam} saat,\n`+
              `${roundedToplam} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fmTatilli} saat haftalık fazla mesai\n`
            );
          } else {
            const roundedHaftalik = Math.round(haftalik);
            const calculatedFM = Math.max(0, roundedHaftalik - WEEKLY_WORK_LIMIT);
            lines.push(
              `${label}: ${r.start_time || ''}–${r.end_time || ''} = ${brut.toFixed(2)} saat çalışma\n`+
              `- ${brk.toFixed(2)} saat ara dinlenme = ${netGunluk.toFixed(2)} saat günlük çalışma\n`+
              `${hg} x ${netGunluk.toFixed(2)} = ${haftalik.toFixed(2)} saat\n`+
              `Net haftalık çalışma = ${roundedHaftalik} saat,\n`+
              `${roundedHaftalik} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${calculatedFM} saat haftalık fazla mesai\n`
            );
          }
        });
      }
      // İstenmiyor: Toplam Fazla Mesai satırı
      return lines.join("\n");
    } catch {
      return '';
    }
  }, [overtimeResults, activeTab, weeklyDays]);

  const gemiReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sgkPrimi = Math.round(brutYillik * 0.14 * 100) / 100;
    const issizlikPrimi = Math.round(brutYillik * 0.01 * 100) / 100;
    const mahsuplasmaNum = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
    const hakkaniyetIndirimi = Number(brutYillik || 0) / 3;
    const mahsuplamaSonucu = Math.max(0, brutYillik - hakkaniyetIndirimi - mahsuplasmaNum);

    return {
      title: resolvedTitle,
      sections: { info: true, periodTable: true, grossToNet: true, mahsuplasma: true },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Haftada Çalışılan Gün", value: `${weeklyDays} gün` },
      ],
      customSections: [
        ...((): Array<{ title: string; content: React.ReactNode; condition: boolean }> => {
          const fmTextVal = fmText || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
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
        footer: ["Toplam Fazla Mesai:", "", "", "", "", `${fmtLocal(totalBrut)}₺`],
        alignRight: [1, 2, 3, 4, 5],
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
        netRow: { label: "Mahsuplaşma Sonucu", value: `${fmtLocal(mahsuplamaSonucu)}₺` },
      },
    };
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, rows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari, fmText, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (gemiReportConfig.infoRows && gemiReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: gemiReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const fmTextVal = fmText || (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
    if (fmTextVal) {
      const escaped = String(fmTextVal).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      sections.push({ id: "fazla-mesai-aciklama", title: "Fazla Mesai Açıklama", html: `<table border="1" cellpadding="2" cellspacing="0"><tr><td><pre style="white-space:pre-wrap;margin:0;padding:8px;font-size:13px;word-break:break-word;">${escaped}</pre></td></tr></table><p>&nbsp;</p>` });
    }

    if ((exclusions || []).length > 0) {
      const exclRows = (exclusions || []).map((ex: Excl) => [ex.type || "Yıllık İzin", ex.start ? new Date(ex.start).toLocaleDateString("tr-TR") : "-", ex.end ? new Date(ex.end).toLocaleDateString("tr-TR") : "-", String(ex.days ?? "-")]);
      const nExcl = adaptToWordTable({ headers: ["Tür", "Başlangıç", "Bitiş", "Gün"], rows: exclRows });
      sections.push({ id: "yillik-izin-dislamalari", title: "Yıllık İzin Dışlamaları", html: buildWordTable(nExcl.headers, nExcl.rows) });
    }

    const pd = gemiReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer?.length) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = gemiReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = gemiReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [gemiReportConfig, fmText, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("gemi-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = gemiReportConfig.title;
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
  }, [gemiReportConfig.title]);

  // Auto compute classic text and periods when inputs change
  useEffect(() => {
    // Dev test kaldırıldı; hesaplama butona bağlı çalışacak
    // classic explanation text
    const { daily } = computeClassic();
    // Dynamic texts for both modes
    const sin = parseTime(gir);
    const sout = parseTime(cik);
    if (sin != null && sout != null) {
      const raw = sout - sin < 0 ? sout - sin + 24 : sout - sin; // günlük brüt
      const brk = computeBreakHours(raw);
      const dailyWork = Math.max(0, raw - brk); // net günlük
      const fmtH = (n: number) => n.toFixed(2).replace(".", ",");
      const tatilsizWeekly = dailyWork * 7;
      const roundedTatilsiz = Math.round(tatilsizWeekly);
      const tatilsizFM = Math.max(0, roundedTatilsiz - WEEKLY_WORK_LIMIT);
      const t1 = `${gir || "??:??"} - ${cik || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
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
      const t2 = `${gir || "??:??"} - ${cik || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
                 `- ${fmtH(brk)} saat ara dinlenme\n`+
                 `= ${fmtH(dailyWork)} saat günlük çalışma\n`+
                 `6 x ${fmtH(dailyWork)} = ${fmtH(dailyWork*6)} saat çalışma\n`+
                 `${fmtH(dailyWork)} - ${STANDARD_DAILY_REFERENCE_HOURS} = ${fmtH(extraHT)} saat hafta tatili fazla çalışma mesaisi\n`+
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
        tN_local = `${gir || "??:??"} - ${cik || "??:??"} = ${fmtH(raw)} saat çalışma\n`+
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
          fmCalc = Math.max(0, Math.round(dailyWork * 7) - WEEKLY_WORK_LIMIT);
        } else {
          const extraHT2 = Math.max(0, dailyWork - STANDARD_DAILY_REFERENCE_HOURS);
          const w = dailyWork * 6 + extraHT2;
          fmCalc = Math.max(0, Math.round(w) - WEEKLY_WORK_LIMIT);
        }
      } else if (nwd > 0 && nwd < 7) {
        fmCalc = Math.max(0, Math.round(dailyWork * nwd) - WEEKLY_WORK_LIMIT);
      } else {
        fmCalc = 0;
      }
      setHaftalikMesai(Number(fmCalc.toFixed(2)));
    } else {
      setTxtTatilsiz("");
      setTxtTatilli("");
      setTxtUnderSeven("");
      setFmHoursAuto(0);
      setHaftalikMesai(0);
    }
    // recompute rows
    handleHesapla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, weeklyDays, gir, cik, exclusions, activeTab]);

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

  // fmHoursAuto güncellenince tabloyu yeniden hesapla (kullanıcı manuel girdiyse fmManual korunduğu için override edilmez)
  useEffect(() => {
    handleHesapla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmHoursAuto]);

  return (
    <Layout
      title={resolvedTitle}
      description="Fazla Mesai Alacağı Hesaplama"
      headerRight={
        <ReportPreviewButton
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-full px-4 py-2 transition-colors flex items-center"
        />
      }
      hideHeader={true}
      fluid={true}
      pageKey="fazla-mesai"
      noBackgroundColor={true}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6 lg:p-8 pb-28 md:pb-32 max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8 space-y-6">
              {/* Üst satır: Video + Select + Yeni Hesapla */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative">
                  <select
                    value={calculationType}
                    onChange={(e) => {
                      const value = e.target.value as "gunluk" | "7-24";
                      setCalculationType(value);
                      if (value === "gunluk") {
                        navigate("/fazla-mesai/gemi");
                      } else {
                        navigate("/fazla-mesai/gemi-7-24");
                      }
                    }}
                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition appearance-none cursor-pointer pr-8"
                  >
                    <option value="gunluk">Günlük Çalışan</option>
                    <option value="7-24">7/24 Çalışan</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {videoLink && (
                    <Button
                      onClick={() => window.open(videoLink, "_blank")}
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-full border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      <Youtube className="h-4 w-4" />
                      Kullanım Videosu İzle
                    </Button>
                  )}
                </div>
              </div>

          {/* Üst Alan - Tarihler ve Beyanlar (kart içi bölüm) */}
          <div className="space-y-4 divide-y divide-gray-200 dark:divide-gray-600 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1 flex items-center gap-1">Haftada Çalışılan Gün <span className="text-gray-500 dark:text-gray-400" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-4 py-2.5 h-11 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition" value={weeklyDays} onChange={(e)=>setWeeklyDays(Number(e.target.value)||0)} />
              </div>
            </div>

          {/* Zamanaşımı Modal - Portal ile body'ye render edilir */}
          <ZamanasimiModal
            isOpen={showZamanaModal}
            onClose={() => {
              setShowZamanaModal(false);
              prevZamanaRef.current = null;
            }}
            onApply={(payload) => {
              setZamanasimi(payload);
              if (payload.nihaiBaslangic) {
                prevZamanaRef.current = null;
                setZamanasimiBaslangic(payload.nihaiBaslangic);
              }
            }}
            zForm={zForm}
            setZForm={setZForm}
            showToastError={showToastError}
            iseGiris={iseGiris}
          />
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/60 px-4 py-2.5 text-sm font-bold text-gray-800 dark:text-gray-100">Beyan Bilgileri</div>
            <details className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">Davacı Beyanı</summary>
              <div className="p-4 space-y-4">
                {davaciPeriods.map((period, index) => (
                  <div key={period.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Tarihi</div>
                        <input 
                          type="date" 
                          max="9999-12-31"
                          className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                          value={period.dateIn || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Yıl kısmını 4 karakterle sınırla
                            if (value && value.length > 10) {
                              const parts = value.split('-');
                              if (parts[0] && parts[0].length > 4) {
                                parts[0] = parts[0].substring(0, 4);
                                const corrected = parts.join('-');
                                updateDavaciPeriod(period.id, { dateIn: corrected });
                                return;
                              }
                            }
                            updateDavaciPeriod(period.id, { dateIn: value });
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.dateOut && /^\d{4}-\d{2}-\d{2}$/.test(period.dateOut)) {
                              const newDate = new Date(newValue);
                              const outDate = new Date(period.dateOut);
                              if (!isNaN(newDate.getTime()) && !isNaN(outDate.getTime()) && newDate > outDate) {
                                showToastError("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                                updateDavaciPeriod(period.id, { dateIn: period.dateOut || '' });
                              }
                            }
                          }}
                        />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Tarihi</div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            max="9999-12-31"
                            className="flex-1 min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                            value={period.dateOut || ''} 
                            onChange={(e) => {
                              const value = e.target.value;
                              // Yıl kısmını 4 karakterle sınırla
                              if (value && value.length > 10) {
                                const parts = value.split('-');
                                if (parts[0] && parts[0].length > 4) {
                                  parts[0] = parts[0].substring(0, 4);
                                  const corrected = parts.join('-');
                                  updateDavaciPeriod(period.id, { dateOut: corrected });
                                  return;
                                }
                              }
                              updateDavaciPeriod(period.id, { dateOut: value });
                            }}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.dateIn && /^\d{4}-\d{2}-\d{2}$/.test(period.dateIn)) {
                                const newDate = new Date(newValue);
                                const inDate = new Date(period.dateIn);
                                if (!isNaN(newDate.getTime()) && !isNaN(inDate.getTime()) && newDate < inDate) {
                                  showToastError("Çıkış tarihi, giriş tarihinden önce olamaz.");
                                  updateDavaciPeriod(period.id, { dateOut: period.dateIn || '' });
                                }
                              }
                            }}
                          />
                          {davaciPeriods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDavaciPeriod(period.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition h-11 w-11 flex items-center justify-center rounded-full border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0"
                              title="Sil"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Saati</div>
                        <input 
                          type="time" 
                          className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                          value={period.in || ''} 
                          onChange={(e) => updateDavaciPeriod(period.id, { in: e.target.value })} 
                        />
                      </div>
<div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Saati</div>
                        <input 
                          type="time" 
                          className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                          value={period.out || ''}
                          onChange={(e) => updateDavaciPeriod(period.id, { out: e.target.value })} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDavaciPeriod}
                  className="w-full border-2 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold rounded-full px-4 py-2.5 text-sm transition"
                >
                  + Yeni Dönem Ekle
                </button>
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">Tanık Beyanları</summary>
              <div className="p-4 space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Tarihi</div>
                        <input type="date" className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.dateIn || ''} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateIn:e.target.value}:r))} />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Tarihi</div>
                        <input type="date" className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.dateOut || ''} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateOut:e.target.value}:r))} />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Saati</div>
                        <input type="time" className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.in} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,in:e.target.value}:r))} />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Saati</div>
                        <input type="time" className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium h-11 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.out} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,out:e.target.value}:r))} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {idx === 0 ? (
                        <div />
                      ) : (
                        <button type="button" className="text-sm font-semibold border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full px-4 py-2 transition" onClick={()=>setTaniklar((arr)=>arr.filter((_,i)=>i!==idx))}>🗑️ Kaldır</button>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" className="text-sm font-semibold border-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white rounded-full px-4 py-2.5 transition" onClick={()=>setTaniklar((a)=>{ const nextId = a.reduce((m,x)=>Math.max(m,x.id),0)+1; return [...a,{ id: nextId, in:"", out:"", dateIn:"", dateOut:"" }]; })}>+ Tanık Ekle</button>
              </div>
            </details>


            {isCalculating && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4 text-[#0d6efd] dark:text-blue-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                Hesaplanıyor...
              </div>
            )}
          </div>

          {/* Orta Alan - Fazla Mesai Gösterimi */}
          <div className="space-y-3 pt-2">
            {/* Kırmızı uyarı metni */}
            <div className="text-sm text-red-600 font-medium mb-3" style={{ fontWeight: '600' }}>
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
                    <div className="bg-[#f9fafb] border rounded-md p-3">
                      {activeTab === "tatilsiz" && (
                        <pre className="bg-white p-4 rounded-lg font-light text-[13px] font-mono text-gray-700 whitespace-pre-wrap" style={{ lineHeight: '1.8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>{fmText || txtTatilsiz || "Giriş/çıkış saatlerini giriniz."}</pre>
                      )}
                      {activeTab === "tatilli" && (
                        <pre className="bg-white p-4 rounded-lg font-light text-[13px] font-mono text-gray-700 whitespace-pre-wrap" style={{ lineHeight: '1.8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>{fmText || txtTatilli || "Giriş/çıkış saatlerini giriniz."}</pre>
                      )}
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#f9fafb] border rounded-md p-3">
                      <pre className="bg-white p-4 rounded-lg font-light text-[13px] font-mono text-gray-700 whitespace-pre-wrap" style={{ lineHeight: '1.8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>{fmText || txtUnderSeven || "Giriş/çıkış saatlerini giriniz."}</pre>
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>
          
          {/* Alt Alan - Dışlamalar (akordiyon panel) ve Tablo */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
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

            {/* HESAPLAMA KURALLARI - ZARİF BUTONLAR */}
            <div className="mt-5 mb-4 flex flex-wrap items-center gap-3 text-sm">
              {/* ZAMANAŞIMI - ZARİF BUTON */}
              <button
                type="button"
                onClick={()=>{ prevZamanaRef.current = zamanasimiBaslangic ?? null; if (zamanasimiBaslangic) setZamanasimiBaslangic(null); setShowZamanaModal(true); }}
                className={`inline-flex items-center gap-2.5 px-4 py-2 text-sm font-semibold rounded-full border transition-all duration-200 ${
                  zamanasimiBaslangic
                    ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-transparent shadow-md hover:from-blue-600 hover:to-cyan-700 dark:from-blue-600 dark:to-cyan-700"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
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
                className={`inline-flex items-center gap-2.5 px-4 py-2 text-sm font-semibold rounded-full border transition-all duration-200 ${
                  hasCustomKatsayi
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md hover:from-green-600 hover:to-emerald-700 dark:from-green-600 dark:to-emerald-700"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400"
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
                <thead className="bg-[#f3f4f6]" style={{ borderBottom: '2px solid #d0d0d0' }}>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Tarih Aralığı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Hafta Sayısı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Ücret</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Kat Sayı Çarpanı <span className="text-gray-500" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Fazla Mesai Saati <span className="text-gray-500" title="Hesaplanan haftalık fazla mesai saati; gerekirse satır bazlı düzenleyebilirsiniz.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">240</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">1,25</th>
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
                      <td className="border border-gray-300 px-2 py-1.5 text-right">240</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,25</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{fmt(0)}</td>
                      <td className="border-0 bg-transparent w-16"></td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-[#fafafa] transition-colors"
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="border border-gray-300 px-2 py-1.5">
                        {r.manual ? (
                          <div className="flex items-center gap-1">
                            <input type="date" value={r.startISO} onChange={(e) => {
                              const newStart = e.target.value;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const newLabel = `${formatDateTRStr(newStart)}–${formatDateTRStr(row.endISO)}`;
                                const newWeeks = calculateWeekCount(new Date(newStart), new Date(row.endISO), exclusions);
                                const kats = row.katsayi || 1; const fmHours = row.fmHours || 0;
                                const fm = Number(((newWeeks * row.brut * kats * fmHours * FAZLA_MESAI_KATSAYI) / FAZLA_MESAI_DENOMINATOR).toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, startISO: newStart, rangeLabel: newLabel, weeks: newWeeks, fm, net };
                              }));
                            }} className="w-28 text-xs rounded border border-gray-300 px-1 py-0.5" />
                            <span>–</span>
                            <input type="date" value={r.endISO} onChange={(e) => {
                              const newEnd = e.target.value;
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const newLabel = `${formatDateTRStr(row.startISO)}–${formatDateTRStr(newEnd)}`;
                                const newWeeks = calculateWeekCount(new Date(row.startISO), new Date(newEnd), exclusions);
                                const kats = row.katsayi || 1; const fmHours = row.fmHours || 0;
                                const fm = Number(((newWeeks * row.brut * kats * fmHours * FAZLA_MESAI_KATSAYI) / FAZLA_MESAI_DENOMINATOR).toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, endISO: newEnd, rangeLabel: newLabel, weeks: newWeeks, fm, net };
                              }));
                            }} className="w-28 text-xs rounded border border-gray-300 px-1 py-0.5" />
                          </div>
                        ) : r.rangeLabel}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        {r.manual ? (
                          <input type="number" value={r.weeks} onChange={(e) => {
                            const newWeeks = Number(e.target.value) || 0;
                            setRows((arr) => arr.map((row, idx) => {
                              if (idx !== i) return row;
                              const kats = row.katsayi || 1; const fmHours = row.fmHours || 0;
                              const fm = Number(((newWeeks * row.brut * kats * fmHours * FAZLA_MESAI_KATSAYI) / FAZLA_MESAI_DENOMINATOR).toFixed(2));
                              const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                              return { ...row, weeks: newWeeks, fm, net };
                            }));
                          }} className="w-16 text-right text-xs rounded border border-gray-300 px-1 py-0.5" />
                        ) : r.weeks}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        <input
                          type="text"
                          key={`brut-${i}-${r.brut}`}
                          defaultValue={r.brut > 0 ? `${r.brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : ''}
                          onFocus={(e) => {
                            const raw = r.brut > 0 ? r.brut.toString().replace('.', ',') : '';
                            e.target.value = raw;
                          }}
                          onBlur={(e) => {
                            const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                            if (v === 0 || isNaN(v)) {
                              const au = asgariUcretler.find(a => normalizeLocalDate(r.startISO) >= normalizeLocalDate(a.start) && normalizeLocalDate(r.startISO) <= normalizeLocalDate(a.end)) || asgariUcretler[asgariUcretler.length - 1];
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const kats = row.katsayi || 1;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((row.weeks * au.brut).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, brut: au.brut, fm, net };
                              }));
                              e.target.value = `${au.brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
                            } else {
                              setRows((arr) => arr.map((row, idx) => {
                                if (idx !== i) return row;
                                const kats = row.katsayi || 1;
                                const fmHours = row.fmHours || 0;
                                const step1 = Number((row.weeks * v).toFixed(6));
                                const step2 = Number((step1 * kats).toFixed(6));
                                const step3 = Number((step2 * fmHours).toFixed(6));
                                const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                                const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                                const fm = Number(step5.toFixed(2));
                                const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                                return { ...row, brut: v, fm, net };
                              }));
                              e.target.value = `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`;
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
                          key={`fmHours-${i}-${r.fmHours}`}
                          defaultValue={r.fmHours.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onFocus={(e) => {
                            const raw = r.fmHours > 0 ? r.fmHours.toString().replace('.', ',') : '';
                            e.target.value = raw;
                          }}
                          onBlur={(e)=>{
                            const v = Number(String(e.target.value).replace(/\./g,'').replace(',','.')) || 0;
                            setRows((arr)=>arr.map((row,idx)=>{
                              if (idx !== i) return row;
                              const kats = row.katsayi || 1;
                              const step1 = Number((row.weeks * row.brut).toFixed(6));
                              const step2 = Number((step1 * kats).toFixed(6));
                              const step3 = Number((step2 * v).toFixed(6));
                              const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
                              const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
                              const fm = Number(step5.toFixed(2));
                              const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
                              return { ...row, fmHours: v, fm, net, fmManual: true };
                            }));
                            e.target.value = v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          }}
                          className="w-24 text-right rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">240</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,25</td>
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
            <div className="p-6 bg-white border-l-4 border-yellow-500 md:col-span-2" style={{ borderRadius: '10px', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', borderLeft: '4px solid #eab308' }}>
              <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontWeight: '700', color: '#1f2937' }}>
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
                <div className="flex items-center justify-between pt-3" style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
                  <span className="text-sm" style={{ fontWeight: '700', color: '#1f2937' }}>Net Fazla Mesai</span>
                  <span className="text-sm" style={{ fontWeight: '700', color: '#15803d' }}>{fmt(netYillik)}</span>
                </div>
              </div>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-4 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">Tablodaki brüt fazla mesai toplamının nete çevrimi</p>
            </div>

            {/* Kart 2: Hakkaniyet İndirimi + Mahsuplaşma (Dönemsel Haftalık ile aynı yapı) */}
            <Card className="md:col-span-1 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-l-4 border-pink-500 dark:border-pink-600 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 dark:bg-gray-800/50">
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

          {/* Notlar - tek kart içinde, divide-y akışının son bölümü */}
          <div className="pt-6 notes-content">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Notlar
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">⚓</span>
                <span>Gemi adamları için günlük çalışma hesaplaması yapılır.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs">⏱️</span>
                <span>Tarih ve saat değişince hesaplamalar otomatik güncellenir.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs">⚙️</span>
                <span>Katsayı hesabı farklı yöntemlerle yapılabilir.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs">💱</span>
                <span>Rakamlar TR formatında gösterilir.</span>
              </li>
            </ul>
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
      <div id="gemi-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={gemiReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={save}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: path.toLowerCase().includes("gemi") && calculationType !== "7-24" ? "Gemi Adamları Günlük Hesaplama Rapor" : `${resolvedTitle} Rapor`,
          copyTargetId: "gemi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #gemi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #gemi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="gemi-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button type="button" className="copy-icon-btn" onClick={() => copySectionForWord(sec.id)} title="Word'e kopyala">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(path.toLowerCase().includes("gemi") && calculationType !== "7-24" ? "Gemi Adamları Günlük Hesaplama Rapor" : `${resolvedTitle} Rapor`, "report-content"),
        }}
        />
      </Layout>
  );
}
