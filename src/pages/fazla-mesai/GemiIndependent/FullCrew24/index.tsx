import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { flushSync } from "react-dom";
import ZamanasimiModal from "@/components/ZamanasimiModal";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
import { Youtube, Copy } from "lucide-react";
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
import { normalizeLocalDate } from "@/utils/dateHelpers";
import { calculateOvertime as calcOT, type Interval as OTInterval, type SalaryPeriod as OTSalaryPeriod } from "@/utils/overtimeCalculator";
import { generateDynamicIntervals, calculateIntervals } from "@/utils/intervalHelper";
import { differenceInDays, differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { getScopedStorageKey } from "@/utils/storageKey";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import "@/styles/soft-glow.css";

// ===== SİLİNEN DOSYALARDAN SADECE UI HELPER FUNCTIONS =====
// calculations.ts, constants.ts, validations.ts backend'e taşındı

// Constants (sadece frontend UI için) - FULL CREW 24 ÖZEL!
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const INCLUDED_OVERTIME_HOURS = 270;
const WEEKLY_WORK_LIMIT = 45; // FullCrew24 için 45!
const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const FULL_CREW_24_WEEKLY_OVERTIME = 35; // SABİT 35 SAAT!
const MAX_WEEKS_PER_YEAR = 52;
const HALF_YEAR_DAY_LIMIT = 183;

type ExcludedDay = {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer" | "UBGT";
  start: string;
  end: string;
  days: number;
};

const fmt = (n: number) =>
  `${(n ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;

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

const normalizeDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
  }
  return s;
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

const hasOvertimeResults = (overtimeResults: unknown): overtimeResults is Array<unknown> =>
  Array.isArray(overtimeResults) && overtimeResults.length > 0;

const toISODateUTC = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
  const path = location?.pathname || "";
  const [calculationType, setCalculationType] = useState<"gunluk" | "7-24">("7-24");
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("fazla-gemi-7-24");
  
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
        ? "Gemi Adamları 7/24 Hesaplama"
        : "Gemi Adamları Günlük Çalışan Fazla Mesai Hesaplama";
    }
    return "Standart Fazla Mesai";
  }, [path, calculationType]);
  const resolvedTitle = titleOverride || pageTitle;
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [fmPeriods, setFmPeriods] = useState<Array<{ startDate: string; endDate: string; text: string }>>([]);
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
  const [haftalikMesai, setHaftalikMesai] = useState<number>(FULL_CREW_24_WEEKLY_OVERTIME);

  // Beyanlar
  const [davaci, setDavaci] = useState<Beyan>({ in: "", out: "" });
  const [taniklar, setTaniklar] = useState<Witness[]>([{ id: 1, in: "", out: "", dateIn: "", dateOut: "" }]);
  
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
  
  // Davacı dönemlerinden gün sayısını hesapla
  const davaciPeriodDays = useMemo(() => {
    const daysMap: Record<string, number> = {};
    davaciPeriods.forEach(period => {
      if (period.dateIn && period.dateOut) {
        const start = normalizeLocalDate(normalizeDate(period.dateIn) || "");
        const end = normalizeLocalDate(normalizeDate(period.dateOut) || "");
        if (start && end && end >= start) {
          const diffTime = end.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          daysMap[period.id] = diffDays;
        } else {
          daysMap[period.id] = 0;
        }
      } else {
        daysMap[period.id] = 0;
      }
    });
    return daysMap;
  }, [davaciPeriods]);
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
      // Yükleme sırasında bu effect'i devre dışı bırak
      if (loadRanRef.current) {
        return;
      }
      
      const next = { in: gir || "", out: cik || "", dateIn: iseGiris || "", dateOut: istenCikis || "" };
      const cur = davaci || ({} as any);
      if (cur.in !== next.in || cur.out !== next.out || cur.dateIn !== next.dateIn || cur.dateOut !== next.dateOut) {
        setDavaci(next);
        
        // davaciPeriods'u da güncelle
        setDavaciPeriods((prev) => {
          if (prev.length > 0) {
            return prev.map((p, idx) => 
              idx === 0 
                ? { ...p, in: gir || "", out: cik || "", dateIn: iseGiris || "", dateOut: istenCikis || "" }
                : p
            );
          }
          return [{ id: "1", in: gir || "", out: cik || "", dateIn: iseGiris || "", dateOut: istenCikis || "" }];
        });
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

  // Boş satır oluşturma (diğer sayfalarla aynı yapı) - 7/24 için sabit 35 saat
  const createManualRow = useCallback((): PeriodRow => {
    return {
      rangeLabel: "",
      weeks: 0,
      brut: 0,
      katsayi: 1,
      fmHours: FULL_CREW_24_WEEKLY_OVERTIME, // 7/24 için sabit 35 saat
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
        
        const d = data.formValues || {};
        
        // davaciPeriods'u geri yükle
        if (data.formValues?.davaciPeriods && Array.isArray(data.formValues.davaciPeriods)) {
          setDavaciPeriods(data.formValues.davaciPeriods);
          // davaciPeriods'tan gir ve cik'i güncelle
          if (data.formValues.davaciPeriods.length > 0) {
            const firstPeriod = data.formValues.davaciPeriods[0];
            if (firstPeriod.in) setGir(firstPeriod.in);
            if (firstPeriod.out) setCik(firstPeriod.out);
          }
        } else if (data.formValues?.davaci) {
          // Eski kayıtlar için davaci'den davaciPeriods oluştur
          setDavaciPeriods([{
            id: "1",
            dateIn: data.formValues.davaci.dateIn || "",
            dateOut: data.formValues.davaci.dateOut || "",
            in: data.formValues.davaci.in || "",
            out: data.formValues.davaci.out || "",
          }]);
          if (data.formValues.davaci.in) setGir(data.formValues.davaci.in);
          if (data.formValues.davaci.out) setCik(data.formValues.davaci.out);
        } else {
          // Formda kaydedilmiş gir/cik varsa onları kullan
          if (d.gir !== undefined) setGir(d.gir);
          if (d.cik !== undefined) setCik(d.cik);
        }
        
        if (data.notes !== undefined) setNotes(data.notes || "");
        if (d.weeklyDays !== undefined) setWeeklyDays(d.weeklyDays);
        if (d.davaci !== undefined) setDavaci(d.davaci);
        if (d.taniklar !== undefined) setTaniklar(d.taniklar);
        if (d.puantaj !== undefined) setPuantaj(d.puantaj);
        if (d.exclusions !== undefined) setExclusions(d.exclusions);
        if (d.include270 !== undefined) setInclude270(!!d.include270);
        if (d.zamanasimi !== undefined) setZamanasimi(d.zamanasimi);
        if (d.zamanasimiBaslangic !== undefined) setZamanasimiBaslangic(d.zamanasimiBaslangic);
        if (d.pageType !== undefined) {
          // pageType'a göre calculationType'ı ayarla ve yönlendir
          if (d.pageType === "gemi-7-24") {
            setCalculationType("7-24");
          } else if (d.pageType === "gemi") {
            // Günlük kaydı, Günlük sayfasına yönlendir
            console.log('🔄 Günlük kaydı tespit edildi, yönlendiriliyor...');
            window.location.href = `/fazla-mesai/gemi?caseId=${loadId}`;
            return;
          } else {
            setCalculationType("gunluk");
          }
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        // Yükleme tamamlandıktan sonra useEffect'i yeniden aktif et
        setTimeout(() => {
          loadRanRef.current = false;
        }, 500);
        
        success(`Kayıt yüklendi (#${loadId})`);
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError("Kayıt yüklenemedi");
        loadRanRef.current = false;
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

  const handleHesapla = async (include270Override?: boolean) => {
    try {
      console.log('[GEMİ FULLCREW24 FM] Backend çağrısı yapılıyor...');
      setIsCalculating(true);

      // davaciPeriods'tan bilgileri al (eğer varsa)
      const davaciData = davaciPeriods.length > 0 && davaciPeriods[0].dateIn ? {
        dateIn: davaciPeriods[0].dateIn,
        dateOut: davaciPeriods[0].dateOut,
        in: davaciPeriods[0].in || "00:00",
        out: davaciPeriods[0].out || "00:00",
      } : davaci;

      console.log('🔍 [DEBUG] davaciPeriods:', davaciPeriods);
      console.log('🔍 [DEBUG] davaciData:', davaciData);
      console.log('🔍 [DEBUG] davaci:', davaci);

      if (!davaciData?.dateIn || !davaciData?.dateOut) {
        console.warn('⚠️ Davacı bilgileri eksik! Hesaplama yapılamaz.');
        setRows([]);
        setIsCalculating(false);
        return;
      }

      // Backend'e gönderilecek payload
      const payload = {
        davaci: {
          dateIn: normalizeDate(davaciData?.dateIn),
          dateOut: normalizeDate(davaciData?.dateOut),
          in: normalizeTime(davaciData?.in) || "00:00",
          out: normalizeTime(davaciData?.out) || "00:00",
        },
        witnesses: (taniklar || []).map((t) => ({
          id: t.id,
          dateIn: normalizeDate(t?.dateIn),
          dateOut: normalizeDate(t?.dateOut),
          in: normalizeTime(t?.in) || "00:00",
          out: normalizeTime(t?.out) || "00:00",
        })),
        exclusions: exclusions || [],
        katSayi: 1,
        zamanasimiBaslangic: zamanasimiBaslangic ? toISODateUTC(new Date(zamanasimiBaslangic)) : null,
        include270: include270Override !== undefined ? include270Override : include270,
        haftalikMesai: FULL_CREW_24_WEEKLY_OVERTIME,
        iseGiris: normalizeDate(davaciData?.dateIn),
        istenCikis: normalizeDate(davaciData?.dateOut),
      };

      console.log('📤 [GEMİ FULLCREW24 FM] Payload:', JSON.stringify(payload, null, 2));

      const response = await apiPost('/api/fm/gemi-full-crew24', payload);

      console.log('📥 [GEMİ FULLCREW24 FM] Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Backend hatası: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ [Gemi FullCrew24] Backend hata detayı:', errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ [Gemi FullCrew24] Backend hata metni:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ [GEMİ FULLCREW24 FM] Backend sonucu:', JSON.stringify(data, null, 2));

      // Backend'den gelen satırları ayarla
      setRows(data.rows || []);
      setFmPeriods(data.textPeriods || []);

      setIsCalculating(false);
    } catch (error) {
      console.error('❌ [GEMİ FULLCREW24 FM] HATA:', error);
      setRows([]);
      setIsCalculating(false);
    }
  };

  const handleHesapla_OLD = (include270Override?: boolean) => {
    // ESKİ FRONTEND HESAPLAMA KODU - ARTIK KULLANILMIYOR
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[DEV] Old calculation method - DEPRECATED');
    }
    try {
      const mySeq = ++calcSeq.current;
      // Tablo her zaman görünür olacak, veri yoksa boş satır gösterilecek
      if (!hasOvertimeResults(overtimeResults)) {
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
          
          // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
          // Hesaplama: (7×24 - 77 dinlenme - 48 yasal çalışma - 8 hafta tatili) = 35 saat
          const fmHours = FULL_CREW_24_WEEKLY_OVERTIME;
          
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
  };

  // include270 veya zamanaşımı başlangıcı değiştiğinde yeniden hesapla
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zamanasimiBaslangic, include270]);

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

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("fullcrew24-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = resolvedTitle;
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
  }, [resolvedTitle]);

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
        window.location.href = "/fazla-mesai/gemi-7-24";
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
  }, [iseGiris, istenCikis, id, info]);

  const save = () => {
    // Merkezi kayıt sistemini kullan
    // netYillik: brütten nete çeviri sonucu (ekranda gösterilen net değer)
    // brutYillik: brütten nete çeviri için kullanılan brüt değer
    kaydetAc({
      hesapTuru: "fazla_mesai_gemi_7_24",
      veri: {
        // Yeni format: data içinde form ve results
        data: {
          form: {
            iseGiris,
            istenCikis,
            weeklyDays,
            gir,
            cik,
            davaci: davaciPeriods.length > 0 ? davaciPeriods[0] : davaci,
            taniklar,
            puantaj,
            exclusions,
            include270,
            zamanasimi,
            zamanasimiBaslangic,
            davaciPeriods,
            pageType: "gemi-7-24",
            route: "/fazla-mesai/gemi-7-24",
            calculationType: "7-24",
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
        davaci: davaciPeriods.length > 0 ? davaciPeriods[0] : davaci,
        taniklar,
        puantaj,
        exclusions,
        davaciPeriods,
        include270,
        zamanasimi,
        zamanasimiBaslangic,
        pageType: "gemi-7-24",
        route: "/fazla-mesai/gemi-7-24",
        calculationType: "7-24",
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `/fazla-mesai/gemi-7-24/:id`,
    });
  };

  // Ortalama Hesapla
  const parseTime = (t: string) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t || "");
    if (!m) return null;
    return Number(m[1]) + Number(m[2]) / 60;
  };
  // Dinamik ara dinlenme (İK 68): <=11 saat 1; >11 saat ise max(1.5, roundHalfUp(g/7.5))
  const roundToHalf = (x: number) => Math.round(x * 2) / 2;
  const computeBreakHours = (dailyGross: number) => {
    if (!isFinite(dailyGross) || dailyGross <= 0) return 0;
    if (dailyGross <= 11) return 1;
    const base = dailyGross / 7.5; // her 7,5 saate 1 saat
    const r = roundToHalf(base);
    return Math.max(1.5, r);
  };
  // Klasik akış: giriş/çıkıştan günlük ve haftalık saat, adım adım metin
  const computeClassic = () => {
    // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
    // Hesaplama: (7×24 - 77 dinlenme - 48 yasal çalışma - 8 hafta tatili) = 35 saat
    const text = `7/24 çalışan hesabı:\n`+
                 `7 gün × 24 saat = 168 saat (toplam)\n`+
                 `168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n`+
                 `91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = ${FULL_CREW_24_WEEKLY_OVERTIME} saat haftalık fazla mesai`;
    setStepsText(text);
    return { daily: null as number | null, weekly: null as number | null };
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

  // 7/24 çalışanlar için: dateSegmentationCore.ts'den tarih bölünmelerini al
  useEffect(() => {
    try {
      // Önce geçerli tanık beyanlarını filtrele (dateIn ve dateOut dolu olanlar)
      const gecerliTaniklar = (taniklar || []).filter(t => t.dateIn && t.dateOut);
      
      // Tanık beyanları varsa sadece onları kullan, davacı beyanını hiç kullanma
      if (gecerliTaniklar.length > 0) {
        // Tanık beyanlarının en erken başlangıç ve en geç bitiş tarihlerini bul
        let minStartDate: Date | null = null;
        let maxEndDate: Date | null = null;
        
        gecerliTaniklar.forEach(tanik => {
          const startDate = normalizeLocalDate(normalizeDate(tanik.dateIn) || "");
          const endDate = normalizeLocalDate(normalizeDate(tanik.dateOut) || "");
          
          if (startDate && endDate) {
            if (!minStartDate || startDate < minStartDate) {
              minStartDate = startDate;
            }
            if (!maxEndDate || endDate > maxEndDate) {
              maxEndDate = endDate;
            }
          }
        });
        
        if (!minStartDate || !maxEndDate) {
          setOvertimeResults([]);
          return;
        }
        
        // BACKEND'DEN GELİYOR - Local hesaplama kaldırıldı
        // Backend zaten /api/fm/gemi-full-crew24 ile tüm hesaplamaları yapıyor
        
        // Her tanık için sonuç oluştur (UI için minimal veri)
        const results = gecerliTaniklar.map(tanik => ({
          start: range.startDate,
          end: range.endDate,
          start_time: "", // 7/24 çalışanlar için saat gerekmez
          end_time: "", // 7/24 çalışanlar için saat gerekmez
          haftalikGun: Number(weeklyDays) || 6,
          brutCalisma: 0,
          gunlukSaat: 0,
          haftalikCalisma: 0,
          fazlaMesai: FULL_CREW_24_WEEKLY_OVERTIME, // Sabit 35 saat
          weeklyOvertime: FULL_CREW_24_WEEKLY_OVERTIME, // Sabit 35 saat
        }));
        
        setOvertimeResults(results as any);
      } else {
        // Tanık beyanı yoksa davacı dönemlerini kullan
        const gecerliDavaciPeriods = davaciPeriods.filter(p => p.dateIn && p.dateOut);
        
        if (gecerliDavaciPeriods.length === 0) {
          setOvertimeResults([]);
          return;
        }
        
        // Davacı dönemlerinin en erken başlangıç ve en geç bitiş tarihlerini bul
        let minStartDate: Date | null = null;
        let maxEndDate: Date | null = null;
        
        gecerliDavaciPeriods.forEach(period => {
          const startDate = normalizeLocalDate(normalizeDate(period.dateIn) || "");
          const endDate = normalizeLocalDate(normalizeDate(period.dateOut) || "");
          
          if (startDate && endDate) {
            if (!minStartDate || startDate < minStartDate) {
              minStartDate = startDate;
            }
            if (!maxEndDate || endDate > maxEndDate) {
              maxEndDate = endDate;
            }
          }
        });
        
        if (!minStartDate || !maxEndDate) {
          setOvertimeResults([]);
          return;
        }
        
        // Davacı dönemlerini tanık formatına çevir
        const davaciAsWitnesses = gecerliDavaciPeriods.map((p, idx) => ({
          id: idx + 1,
          dateIn: p.dateIn,
          dateOut: p.dateOut,
        }));
        
        // BACKEND'DEN GELİYOR - Local hesaplama kaldırıldı
        // Backend zaten /api/fm/gemi-full-crew24 ile tüm hesaplamaları yapıyor
        
        // Her normalize edilmiş aralık için 7/24 çalışan sonuçlarını oluştur
        const results = normalizedRanges.map(range => ({
          start: range.startDate,
          end: range.endDate,
          start_time: "", // 7/24 çalışanlar için saat gerekmez
          end_time: "", // 7/24 çalışanlar için saat gerekmez
          haftalikGun: Number(weeklyDays) || 6,
          brutCalisma: 0,
          gunlukSaat: 0,
          haftalikCalisma: 0,
          fazlaMesai: FULL_CREW_24_WEEKLY_OVERTIME, // Sabit 35 saat
          weeklyOvertime: FULL_CREW_24_WEEKLY_OVERTIME, // Sabit 35 saat
        }));
        
        setOvertimeResults(results as any);
      }
    } catch (err) {
      console.error("7/24 çalışan hesaplama hatası:", err);
      setOvertimeResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, davaci?.dateIn, davaci?.dateOut, davaciPeriods, taniklar, weeklyDays]);

  // Form değiştikçe interval ve fazla mesai zincirini otomatik çalıştır (canlı veriler)
  // 7/24 çalışanlar için bu useEffect'e gerek yok, yukarıdaki useEffect yeterli
  // useEffect(() => {
  //   try { handleCalculateOvertime(); } catch {}
  // }, [davaci, taniklar, weeklyDays]);

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
    const results = calculateIntervals(witnesses, davaciMin, davaciMax);
    setIntervals(results);
    // eslint-disable-next-line no-console
    console.log("Hesaplanan dönemler:", results);

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

  // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
  const weeklyFMHours = FULL_CREW_24_WEEKLY_OVERTIME;

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
          if (Number(weeklyDays) === 7 && activeTab === 'tatilli') {
            // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
            // Hesaplama: (7×24 - 77 dinlenme - 48 yasal çalışma - 8 hafta tatili) = 35 saat
            lines.push(
              `${label}: 7/24 çalışan hesabı\n`+
              `7 gün × 24 saat = 168 saat (toplam)\n`+
              `168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n`+
              `91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = ${FULL_CREW_24_WEEKLY_OVERTIME} saat haftalık fazla mesai\n`
            );
          } else {
            // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
            // Hesaplama: (7×24 - 77 dinlenme - 48 yasal çalışma - 8 hafta tatili) = 35 saat
            lines.push(
              `${label}: 7/24 çalışan hesabı\n`+
              `7 gün × 24 saat = 168 saat (toplam)\n`+
              `168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n`+
              `91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = ${FULL_CREW_24_WEEKLY_OVERTIME} saat haftalık fazla mesai\n`
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

  // Rapor config (fmText'ten sonra)
  const fullCrew24ReportConfig = useMemo((): ReportConfig => {
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

    if (fullCrew24ReportConfig.infoRows && fullCrew24ReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: fullCrew24ReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
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

    const pd = fullCrew24ReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer?.length) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = fullCrew24ReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = fullCrew24ReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [fullCrew24ReportConfig, fmText, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  // Auto compute classic text and periods when inputs change
  useEffect(() => {
    // Dev test kaldırıldı; hesaplama butona bağlı çalışacak
    // 7/24 çalışanlar için açıklamalı hesaplama metni
    // Hesaplama: (7×24 - 77 dinlenme - 48 yasal çalışma - 8 hafta tatili) = 35 saat
    const t7_24 = `7/24 çalışan hesabı:\n`+
                  `7 gün × 24 saat = 168 saat (toplam)\n`+
                  `168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n`+
                  `91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = ${FULL_CREW_24_WEEKLY_OVERTIME} saat haftalık fazla mesai`;
    
    setTxtTatilsiz(t7_24);
    setTxtTatilli(t7_24);
    setTxtUnderSeven(t7_24);
    
    // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
    setHaftalikMesai(FULL_CREW_24_WEEKLY_OVERTIME);
    // recompute rows
    handleHesapla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, weeklyDays, gir, cik, exclusions, activeTab]);

  // 7/24 çalışanlar için sabit haftalık fazla mesai: 35 saat
  useEffect(() => {
    setFmHoursAuto(FULL_CREW_24_WEEKLY_OVERTIME);
  }, []);

  // 7/24 çalışanlar için haftalık fazla mesai sabit 35 saat olduğu için bu useEffect'e gerek yok
  // useEffect(() => {
  //   handleHesapla();
  // }, [fmHoursAuto]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6 lg:p-8 pb-28 md:pb-32">
        <div className="max-w-7xl mx-auto w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8 pb-20 space-y-6 divide-y divide-gray-200 dark:divide-gray-600">
        {/* Ana Form - Üst Alan */}
        <div className="space-y-4 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {/* Üst kısımdaki Hesaplama Görünümü butonu kaldırıldı - Alt kısımda Yazdır butonunun yanındaki kalacak */}
              {false && <ReportPreviewButton
                title=""
                copyTargetId="rapor-icerik"
                buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
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
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Fazla Mesai</div><div style={{fontSize:13, fontWeight:600}}>{haftalikMesai.toFixed(2).replace('.', ',')} saat</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>İşe Giriş</div><div style={{fontSize:13, fontWeight:600}}>{iseGiris || '-'}</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>İşten Çıkış</div><div style={{fontSize:13, fontWeight:600}}>{istenCikis || '-'}</div></div>
                      <div><div style={{fontSize:12, color:'#6b7280'}}>Haftalık Gün</div><div style={{fontSize:13, fontWeight:600}}>{weeklyDays}</div></div>
                    </div>

                    {/* Beyanlar */}
                    <div style={{marginBottom:12}}>
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
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>240</th>
                            <th style={{border:'1px solid #d1d5db', padding:'6px'}}>1,25</th>
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
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>240</td>
                              <td style={{border:'1px solid #e5e7eb', padding:'6px', textAlign:'right'}}>1,25</td>
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
                      const gelirMatrahi = Math.max(0, brutToplam - ssk);
                      const gelirNum = calculateIncomeTaxForYear(selectedYear, gelirMatrahi);
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
                              <tr><td style={{border:'1px solid #e5e7eb', padding:6}}>Gelir Vergisi (%15, %20, %27, %35, %40)</td><td style={{border:'1px solid #e5e7eb', padding:6, textAlign:'right'}}>{tr(gelirNum)}</td></tr>
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
              />}
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
              {videoLink && (
                <Button
                  onClick={() => window.open(videoLink, "_blank")}
                  variant="outline"
                  size="sm"
                  className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 hover:text-red-700"
                >
                  <Youtube className="h-4 w-4" />
                  Kullanım Videosu İzle
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1 flex items-center gap-1">Haftada Çalışılan Gün <span className="text-gray-500 dark:text-gray-400" title="Haftada çalışılan gün sayısı 1 ile 7 arasında olmalıdır.">ℹ️</span></div>
                <input title="1-7 arası gün sayısı giriniz" className="w-full min-w-0 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" value={weeklyDays} onChange={(e)=>setWeeklyDays(Number(e.target.value)||0)} />
              </div>
            </div>

          {/* Zamanaşımı Modal - Optimize edilmiş component */}
          <ZamanasimiModal
            isOpen={showZamanaModal}
            onClose={() => {
              setShowZamanaModal(false);
              if (prevZamanaRef.current) {
                setZamanasimiBaslangic(prevZamanaRef.current);
              }
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
            iseGiris={iseGiris || davaciPeriods[0]?.dateIn || undefined}
          />
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200">Beyan Bilgileri</div>
            <details className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">Davacı Beyanı</summary>
              <div className="p-4 space-y-4">
                {davaciPeriods.map((period, index) => (
                  <div key={period.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Tarihi</div>
                        <input 
                          type="date" 
                          max="9999-12-31"
                          className="w-full min-w-0 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                          value={period.dateIn || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && value.length > 10) {
                              const parts = value.split('-');
                              if (parts[0] && parts[0].length > 4) {
                                parts[0] = parts[0].substring(0, 4);
                                updateDavaciPeriod(period.id, { dateIn: parts.join('-') });
                                return;
                              }
                            }
                            updateDavaciPeriod(period.id, { dateIn: value });
                          }} 
                        />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Tarihi</div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            max="9999-12-31"
                            className="flex-1 min-w-0 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                            value={period.dateOut || ''} 
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value && value.length > 10) {
                                const parts = value.split('-');
                                if (parts[0] && parts[0].length > 4) {
                                  parts[0] = parts[0].substring(0, 4);
                                  updateDavaciPeriod(period.id, { dateOut: parts.join('-') });
                                  return;
                                }
                              }
                              updateDavaciPeriod(period.id, { dateOut: value });
                            }} 
                          />
                          {davaciPeriods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDavaciPeriod(period.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition h-11 flex items-center rounded-full px-3 font-semibold"
                              title="Sil"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDavaciPeriod}
                  className="w-full border-2 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  + Yeni Dönem Ekle
                </button>
              </div>
            </details>

            <details className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">Tanık Beyanları</summary>
              <div className="p-4 space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Giriş Tarihi</div>
                        <input type="date" className="w-full min-w-0 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.dateIn || ''} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateIn:e.target.value}:r))} />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 dark:text-gray-300 font-semibold mb-1">Çıkış Tarihi</div>
                        <input type="date" className="w-full min-w-0 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" value={t.dateOut || ''} onChange={(e)=>setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateOut:e.target.value}:r))} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {idx === 0 ? (
                        <div />
                      ) : (
                        <button type="button" className="text-sm font-semibold border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full px-3 py-2" onClick={()=>setTaniklar((arr)=>arr.filter((_,i)=>i!==idx))}>🗑️ Kaldır</button>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" className="text-sm font-semibold border-2 border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white rounded-full px-3 py-2 transition" onClick={()=>setTaniklar((a)=>{ const nextId = a.reduce((m,x)=>Math.max(m,x.id),0)+1; return [...a,{ id: nextId, in:"", out:"", dateIn:"", dateOut:"" }]; })}>+ Tanık Ekle</button>
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
          <div className="pt-6">
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
                    <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#f1f3f5] border rounded-md p-3">
                  <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{fmText || txtUnderSeven || "Giriş/çıkış saatlerini giriniz."}</pre>
                  <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                    <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Alt Alan - Dışlamalar (akordiyon panel) ve Tablo */}
          <div className="pt-6 space-y-3">
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
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
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
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/40 dark:hover:text-green-300"
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

            {/* Zamanaşımı Bilgisi */}
            {zamanasimiBaslangic && rows.length > 0 && (
              <div className="text-xs text-blue-600 mt-2 mb-2 leading-tight">
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
                      className="hover:bg-gray-50"
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

            {/* Kart 2: Hakkaniyet İndirimi + Mahsuplaşma (Dönemsel Haftalık ile aynı yapı) */}
            <Card className="md:col-span-1 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-l-4 border-pink-500 dark:border-pink-600 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-gray-800/50">
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

          {/* Notlar - tek kart içinde, Alt Alan'ın son bölümü */}
          <div className="pt-6 notes-content">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Notlar
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">⚓</span>
                <span>Gemi adamları 7/24 çalışan için fazla mesai hesaplaması yapılır.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs">⏱️</span>
                <span>Haftalık 35 saat sabit fazla mesai hesaplanır.</span>
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
      <div id="fullcrew24-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={fullCrew24ReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={save}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: `${resolvedTitle} Rapor`,
          copyTargetId: "fullcrew24-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #fullcrew24-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #fullcrew24-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="fullcrew24-word-copy">
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
          onPdf: () => downloadPdfFromDOM(`${resolvedTitle} Rapor`, "report-content"),
        }}
      />
    </Layout>
  );
}
