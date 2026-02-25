import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";
import ZamanasimiModal from "@/components/ZamanasimiModal";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL, apiPost } from "./localUtils/apiClient";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";
import { asgariUcretler } from "./localUtils/asgariUcretler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import UbgtKatsayiModal from "@/pages/ubgt-alacagi/UbgtIndependent/UbgtKatsayiModal";
import MahsuplasamaModal from "@/pages/hafta-tatili-alacagi/StandardIndependent/MahsuplasamaModal";
import { calculateOvertimeTable } from "./localUtils/calculateOvertimeTable";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "./localUtils/incomeTaxCore";
import { getScopedStorageKey } from "./localUtils/storageKey";
import Vardiya48Independent from "./Vardiya48Independent";
import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_VARDIYA24_REPORT = true;

// ===== SİLİNEN DOSYALARDAN SADECE UI HELPER FUNCTIONS =====
// calculations.ts, constants.ts backend'e taşındı
// Sadece UI için gerekli helper fonksiyonlar ve constantlar burada

// Constants (sadece frontend UI için)
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const SSK_ORANI = 0.15;
const FAZLA_MESAI_DENOMINATOR = 225;
const FAZLA_MESAI_KATSAYI = 1.5;
const INCLUDED_OVERTIME_HOURS = 270;

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

type PeriodRow = {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number; // 12 veya 9 sabit değer
  fmType: "12" | "9"; // Bilirkişi formatı: 12 saatlik veya 9 saatlik hafta
  haftaCount: number; // h12 veya h9 değeri (ceil veya floor)
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
  const videoLink = getVideoLink("fazla-vardiya24");
  
  const path = location?.pathname || "";
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const initializePageType = useCallback(() => {
    try {
      // Placeholder: perform any per-path initialization needed when route changes
      // Intentionally minimal to avoid UI/logic side-effects
    } catch {}
  }, []);
  const [vardiyaType, setVardiyaType] = useState<"24" | "48">("24");
  const pageTitle = useMemo(() => {
    const p = path.toLowerCase();
    if (p.includes("bilirkisi1") || p.includes("bilirkişi1") || p.includes("bilirkisi-1")) return "Bilirkişiler İçin - 1";
    if (p.includes("bilirkisi2") || p.includes("bilirkişi2") || p.includes("bilirkisi-2")) return "Bilirkişiler İçin - 2";
    // Vardiya tipine göre başlık belirle
    if (vardiyaType === "48") return "48 Saat Çalışma Hesaplama";
    return "24 Saat Çalışma Hesaplama";
  }, [path, vardiyaType]);
  const resolvedTitle = titleOverride || pageTitle;
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [weeklyDays, setWeeklyDays] = useState("6");
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  // Bilirkişi formatı: sabit değerler (saat alanları kaldırıldı)
  const [stepsText, setStepsText] = useState<string>("");
  // Bilirkişi formatı başlangıç değerleri (24 saat sistemi: 12-9 saat)
  const bilirkisiDefaultText = `24/24 Bilirkişi Formatı:\n12 saatlik haftalar: (hafta/2 yukarı yuvarla) × 12 saat\n9 saatlik haftalar: (hafta/2 aşağı yuvarla) × 9 saat`;
  const [txtTatilsiz, setTxtTatilsiz] = useState<string>(bilirkisiDefaultText);
  const [txtTatilli, setTxtTatilli] = useState<string>(bilirkisiDefaultText);
  const [txtUnderSeven, setTxtUnderSeven] = useState<string>(bilirkisiDefaultText);
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [fmHoursAuto, setFmHoursAuto] = useState<number>(0);
  // Bilirkişi formatı: haftalık FM saati sabit 10.5 ((12+9)/2)
  const haftalikMesai = 10.5;

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

  // Davacı Beyanı tarih alanları değiştiğinde hesaplamayı tetikle
  useEffect(() => {
    try {
      // Davacı beyanındaki tarihlerden iseGiris/istenCikis'i güncelle
      if (davaci.dateIn && davaci.dateIn !== iseGiris) {
        setIseGiris(davaci.dateIn);
      }
      if (davaci.dateOut && davaci.dateOut !== istenCikis) {
        setIstenCikis(davaci.dateOut);
      }
    } catch {}
  }, [davaci.dateIn, davaci.dateOut]);
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

  // Dışlamalar (YillikIzinDislamalariPanel ile yönetilir)
  const [exclusions, setExclusions] = useState<Excl[]>([]);

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

  // YENİ RAPOR SİSTEMİ: State
  // Kat Sayı Hesapla modal state
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);

  // Kat sayı uygulama fonksiyonu
  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    setRows((prev) => prev.map((r) => {
      // Bilirkişi formatı: haftaCount * fmHours (12 veya 9)
      const toplamFM = r.haftaCount * r.fmHours;
      // DÖNEM HESABI: fazlaMesaiTutari = (toplamFM * ucret * katsayi * 1.5) / 225
      const step1 = Number((toplamFM * r.brut).toFixed(6));
      const step2 = Number((step1 * katsayi).toFixed(6));
      const step3 = Number((step2 * 1.5).toFixed(6));
      const step4 = Number((step3 / 225).toFixed(6));
      const fm = Number(step4.toFixed(2));
      const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
      return { ...r, katsayi, fm, net };
    }));
    setHasCustomKatsayi(true);
  }, []);

  // Kat sayı kaldırma fonksiyonu
  const removeGlobalCoefficient = useCallback(() => {
    setRows((prev) => prev.map((r) => {
      const katsayi = 1;
      // Bilirkişi formatı: haftaCount * fmHours (12 veya 9)
      const toplamFM = r.haftaCount * r.fmHours;
      // DÖNEM HESABI: fazlaMesaiTutari = (toplamFM * ucret * katsayi * 1.5) / 225
      const step1 = Number((toplamFM * r.brut).toFixed(6));
      const step2 = Number((step1 * katsayi).toFixed(6));
      const step3 = Number((step2 * 1.5).toFixed(6));
      const step4 = Number((step3 / 225).toFixed(6));
      const fm = Number(step4.toFixed(2));
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
      fmHours: 12,
      fmType: "12",
      haftaCount: 0,
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
      
      console.log('[loadCalculation] Backend response:', data);
      console.log('[loadCalculation] data.data type:', typeof data.data);
      console.log('[loadCalculation] data.data:', data.data);
      
      if (data.data) {
        // data field'ı string ise parse et
        if (typeof data.data === 'string') {
          try {
            payload = JSON.parse(data.data);
            console.log('[loadCalculation] Parsed payload:', payload);
          } catch {
            payload = {};
          }
        } else {
          payload = data.data;
        }
      }
      
      console.log('[loadCalculation] Final payload:', payload);
      console.log('[loadCalculation] payload.form:', payload.form);
      
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
        const d = data.formValues || {};
        
        // DEBUG: Yüklenen veriyi kontrol et
        console.log('[Vardiya24] Yüklenen data:', data);
        console.log('[Vardiya24] formValues (d):', d);
        console.log('[Vardiya24] d.iseGiris:', d.iseGiris);
        console.log('[Vardiya24] data.start_date:', data.start_date);
        
        // Tarihler: önce form içinden, sonra üst seviyeden al
        const loadedIseGiris = d.iseGiris || data.start_date;
        const loadedIstenCikis = d.istenCikis || data.end_date;
        
        console.log('[Vardiya24] loadedIseGiris:', loadedIseGiris);
        console.log('[Vardiya24] loadedIstenCikis:', loadedIstenCikis);
        
        if (loadedIseGiris) setIseGiris(loadedIseGiris);
        if (loadedIstenCikis) setIstenCikis(loadedIstenCikis);
        if (data.notes !== undefined) setNotes(data.notes || "");
        
        if (d.weeklyDays !== undefined) setWeeklyDays(d.weeklyDays);
        // Bilirkişi formatı: gir/cik alanları kaldırıldı
        if (d.davaci !== undefined) setDavaci(d.davaci);
        if (d.taniklar !== undefined) setTaniklar(d.taniklar);
        if (d.puantaj !== undefined) setPuantaj(d.puantaj);
        if (d.exclusions !== undefined) setExclusions(d.exclusions);
        if (d.zamanasimi !== undefined) setZamanasimi(d.zamanasimi);
        if (d.zamanasimiBaslangic !== undefined) setZamanasimiBaslangic(d.zamanasimiBaslangic);
        
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

  // 24/24 BİLİRKİŞİ HESAPLAMA – DAVACI → TANIK → SON ARALIK ALGORİTMASI
  const handleHesapla = async () => {
    try {
      console.log('🚀 [VARDIYA24 FM] Backend çağrısı yapılıyor...');
      
      if (!iseGiris || !istenCikis) {
        setRows([]);
        return;
      }

      // A) Davacı tarih aralığını al
      const dStart = normalizeDate(iseGiris) || '';
      const dEnd = normalizeDate(istenCikis) || '';
      
      if (!dStart || !dEnd) {
        setRows([]);
        return;
      }
      
      setIsCalculating(true);
      
      const dStartDate = new Date(dStart);
      const dEndDate = new Date(dEnd);

      // ============================================================================
      // BACKEND'E İSTEK GÖNDER - TÜM HESAPLAMA BACKEND'TE YAPILIYOR
      // ============================================================================
      
      // Tanık tarihlerini davacı tarihleri içinde kırp ve backend'e gönder
      const clippedIntervals: { start: string; end: string }[] = [];
      
      taniklar.forEach((t) => {
        if (!t.dateIn || !t.dateOut) return;
        
        const tStart = new Date(t.dateIn);
        const tEnd = new Date(t.dateOut);
        
        if (tEnd < dStartDate || tStart > dEndDate) return;
        
        const clippedStart = tStart < dStartDate ? dStart : t.dateIn;
        const clippedEnd = tEnd > dEndDate ? dEnd : t.dateOut;
        
        clippedIntervals.push({
          start: clippedStart,
          end: clippedEnd
        });
      });

      // Hesaplama yapılacak aralıklar
      let overtimeResults: { start: string; end: string }[] = [];
      
      if (clippedIntervals.length === 0) {
        overtimeResults = [{ start: dStart, end: dEnd }];
      } else {
        overtimeResults = clippedIntervals;
      }
      
      const payload = {
        iseGiris: dStart,
        istenCikis: dEnd,
        girisSaati: '00:00', // Vardiya24'te saat kullanılmıyor
        cikisSaati: '00:00', // Vardiya24'te saat kullanılmıyor
        weeklyDays: Number(weeklyDays) || 6,
        exclusions: exclusions || [],
        katSayi: 1,
        zamanasimiBaslangic: zamanasimiBaslangic ? normalizeDate(zamanasimiBaslangic) : null,
        include270: false, // Bu sayfada 270 saat düşüm yok
        haftalikMesai: haftalikMesai, // 10.5 sabit
        overtimeResults,
        davaciBeyani: {
          startDate: dStart,
          endDate: dEnd,
        },
      };
      
      console.log('📦 [VARDIYA24 FM] Payload:', payload);
      
      const response = await apiPost('/api/fm/vardiya24', payload);
      
      console.log('📥 [VARDIYA24 FM] Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Backend hatası: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ [Vardiya24] Backend hata detayı:', errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ [Vardiya24] Backend hata metni:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const backendResult = await response.json();
      
      console.log('✅ [VARDIYA24 FM] Backend sonucu:', backendResult);
      
      // Backend'den gelen sonuçları işle ve tabloya dönüştür
      const backendRows = backendResult.rows || [];
      
      const newRows: PeriodRow[] = backendRows.map((row: any) => {
        const startISO = row.startDate || '';
        const endISO = row.endDate || '';
        
        return {
          rangeLabel: `${formatDateTRStr(startISO)}–${formatDateTRStr(endISO)}`,
          weeks: row.weeks || 0,
          brut: row.brut || 0,
          katsayi: row.katSayi || 1,
          fmHours: row.fmHours || 0,
          fmType: row.fmType || "12",
          haftaCount: row.weeks || 0,
          fmManual: false,
          calc225: 225,
          factor: 1.5,
          fm: row.fm || 0,
          net: row.net || 0,
          startISO,
          endISO,
        };
      });
      
      setRows(newRows);
      
      setTimeout(() => {
        setIsCalculating(false);
      }, 200);
    } catch (error) {
      console.error('❌ [VARDIYA24 FM] HATA:', error);
      setIsCalculating(false);
      showToastError?.(`Hesaplama hatası: ${error.message || 'Bilinmeyen hata'}`);
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
  // Tanık beyanları değiştiğinde de hesaplamayı tetikle
  const taniklarStr = JSON.stringify(taniklar);
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, exclusions, taniklarStr]);

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

  // Zamanaşımı başlangıcı değiştiğinde yeniden hesapla
  useEffect(() => {
    try { handleHesapla(); } catch {}
  }, [zamanasimiBaslangic]);

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + r.fm, 0), [rows]);
  const totalNet = useMemo(() => rows.reduce((a, r) => a + r.net, 0), [rows]);
  // Brütten Nete Çevir alanını otomatik olarak tablo toplamına senkronize et
  useEffect(() => {
    try { setBrut(Number(totalBrut.toFixed(2))); } catch {}
  }, [totalBrut]);

  // YENİ RAPOR SİSTEMİ: Config
  const vardiya24ReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // SGK ve İşsizlik Primi
    const sgkPrimi = Math.round(brutYillik * 0.15 * 100) / 100;
    const issizlikPrimi = 0; // Bu sayfa için işsizlik yok
    
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
        ...((): Array<{ title: string; content: React.ReactNode; condition: boolean }> => {
          const fmTextVal = (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
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
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık Fazla Mesai Alacağı", value: `${fmtLocal(brutYillik)}₺` },
          { label: "SGK İşçi Primi (%15)", value: `-${fmtLocal(sgkPrimi)}₺`, isDeduction: true },
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
  }, [resolvedTitle, iseGiris, istenCikis, weeklyDays, rows, totalBrut, brutYillik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netYillik, mahsuplasmaMiktari, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  // Bölüm bazlı Word tabloları
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (vardiya24ReportConfig.infoRows && vardiya24ReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: vardiya24ReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const fmTextVal = (Number(weeklyDays) === 7 ? (activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli) : txtUnderSeven) || "";
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

    const pd = vardiya24ReportConfig.periodData;
    if (pd && pd.headers && pd.rows && pd.rows.length > 0) {
      const allRows = [...pd.rows];
      if (pd.footer && pd.footer.length > 0) allRows.push(pd.footer as any);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: allRows });
      sections.push({ id: "fazla-mesai-cetvel", title: pd.title || "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = vardiya24ReportConfig.grossToNetData?.rows;
    if (gnd && gnd.length > 0) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = vardiya24ReportConfig.mahsuplasmaData;
    if (md && md.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [vardiya24ReportConfig, weeklyDays, activeTab, txtTatilsiz, txtTatilli, txtUnderSeven, exclusions]);

  const handlePrint = useCallback(() => {
    if (USE_NEW_VARDIYA24_REPORT) {
      const targetEl = document.getElementById("vardiya24-print-wrapper");
      if (!targetEl) {
        window.print();
        return;
      }
      const title = vardiya24ReportConfig.title;
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
  }, [vardiya24ReportConfig.title]);

  // Yazdır butonu: rapor config'den HTML üretip doğrudan yazdır
  const handlePrintReport = useCallback(() => {
    try {
      const config = vardiya24ReportConfig;
      let html = '<div id="report-content" style="font-family: Inter, Arial, sans-serif; color: #111827; font-size: 10px;">';
      html += `<h2 style="font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">${config.title}</h2>`;
      if (config.sections?.info && config.infoRows) {
        html += '<div class="report-section" style="margin-bottom: 12px;"><table style="width: 100%; border-collapse: collapse;"><tbody>';
        config.infoRows.forEach(row => {
          if (row.condition !== false) {
            html += `<tr><td style="border: 1px solid #999; padding: 4px 6px; font-weight: 600; width: 40%;">${row.label}</td><td style="border: 1px solid #999; padding: 4px 6px;">${row.value}</td></tr>`;
          }
        });
        html += '</tbody></table></div>';
      }
      if (config.sections?.periodTable && config.periodData) {
        html += '<div class="report-section" style="margin-bottom: 12px;">';
        html += `<h2 class="report-section-title" style="font-size: 12px; margin: 8px 0 6px 0; font-weight: 600;">${config.periodData.title || "Dönemler"}</h2>`;
        html += '<table style="width: 100%; border-collapse: collapse;"><thead style="background: #f3f4f6;"><tr>';
        config.periodData.headers.forEach(h => {
          html += `<th style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: left; font-weight: 600;">${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        config.periodData.rows.forEach(row => {
          html += '<tr>';
          row.forEach((cell, idx) => {
            const align = config.periodData!.alignRight?.includes(idx) ? 'right' : 'left';
            html += `<td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: ${align};">${cell}</td>`;
          });
          html += '</tr>';
        });
        if (config.periodData.footer) {
          html += '<tr style="font-weight: 600; background: #f9fafb;">';
          config.periodData.footer.forEach((cell, idx) => {
            const align = config.periodData!.alignRight?.includes(idx) ? 'right' : 'left';
            html += `<td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: ${align};">${cell}</td>`;
          });
          html += '</tr>';
        }
        html += '</tbody></table></div>';
      }
      if (config.sections?.grossToNet && config.grossToNetData) {
        html += '<div class="report-section" style="margin-bottom: 12px;">';
        html += `<h2 class="report-section-title" style="font-size: 12px; margin: 8px 0 6px 0; font-weight: 600;">${config.grossToNetData.title || "Brüt'ten Net'e"}</h2>`;
        html += '<table style="width: 100%; border-collapse: collapse;"><tbody>';
        config.grossToNetData.rows.forEach(row => {
          const style = row.isNet ? 'font-weight: 600; background: #f0fdf4;' : row.isDeduction ? 'color: #dc2626;' : '';
          html += `<tr style="${style}"><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: left;">${row.label}</td><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: right;">${row.value}</td></tr>`;
        });
        html += '</tbody></table></div>';
      }
      if (config.sections?.mahsuplasma && config.mahsuplasmaData) {
        html += '<div class="report-section report-section-last" style="margin-bottom: 12px;">';
        html += `<h2 class="report-section-title" style="font-size: 12px; margin: 8px 0 6px 0; font-weight: 600;">${config.mahsuplasmaData.title || "Mahsuplaşma"}</h2>`;
        html += '<table style="width: 100%; border-collapse: collapse;"><tbody>';
        config.mahsuplasmaData.rows.forEach(row => {
          const style = row.isDeduction ? 'color: #dc2626;' : '';
          html += `<tr style="${style}"><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: left;">${row.label}</td><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: right;">${row.value}</td></tr>`;
        });
        html += `<tr style="font-weight: 600; background: #f0fdf4;"><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: left;">${config.mahsuplasmaData.netRow.label}</td><td style="border: 1px solid #999; padding: 4px 6px; font-size: 10px; text-align: right;">${config.mahsuplasmaData.netRow.value}</td></tr>`;
        html += '</tbody></table></div>';
      }
      html += '</div>';
      const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>${config.title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}h2{font-size:12px;margin:8px 0 6px 0;page-break-after:avoid!important}.report-section{page-break-inside:avoid!important}.report-section-last{page-break-after:auto!important}.report-section-title{page-break-after:avoid!important}tr{page-break-inside:avoid!important}</style></head><body>${html}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {}
          setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
        };
      }
    } catch (err) {
      console.error("Vardiya24 print error:", err);
      showToastError?.("Yazdırma sırasında hata oluştu");
    }
  }, [vardiya24ReportConfig, showToastError]);

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
        window.location.href = "/fazla-mesai/vardiya24";
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
      // Bilirkişi formatı: gir/cik alanları kaldırıldı
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
    // DEBUG: Kaydedilen veriyi kontrol et
    console.log('[Vardiya24] Kaydetme - iseGiris:', iseGiris);
    console.log('[Vardiya24] Kaydetme - istenCikis:', istenCikis);
    
    // Merkezi kayıt sistemini kullan
    // netYillik: brütten nete çeviri sonucu (ekranda gösterilen net değer)
    // brutYillik: brütten nete çeviri için kullanılan brüt değer
    kaydetAc({
      hesapTuru: "fazla_mesai_vardiya_24",
      veri: {
        // Yeni format: data içinde form ve results
        data: {
          form: {
            // Önce eski verileri al (varsa), sonra yeni değerlerle üzerine yaz
            ...(caseData?.data || {}),
            // Yeni değerler - bunlar eski değerleri override eder
            iseGiris,
            istenCikis,
            weeklyDays,
            // Bilirkişi formatı: saat alanları kaldırıldı
            davaci,
            taniklar,
            puantaj,
            exclusions,
            zamanasimi,
            zamanasimiBaslangic,
            pageType: "vardiya-24",
            route: "/fazla-mesai/vardiya24",
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
        // Bilirkişi formatı: saat alanları kaldırıldı
        davaci,
        taniklar,
        puantaj,
        exclusions,
        zamanasimi,
        zamanasimiBaslangic,
        pageType: "vardiya-24",
        route: "/fazla-mesai/vardiya24",
      },
      mevcutId: id || caseIdRef.current,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `/fazla-mesai/vardiya24/:id`,
    });
  };

  // Bilirkişi formatı: tarih değişikliğinde otomatik hesaplama
  // Kaydet butonuna gerek yok, tarih değişince tablo otomatik güncellenir
  // Tanık beyanları değiştiğinde de tablo güncellenir
  useEffect(() => {
    try { handleHesapla(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, exclusions, taniklarStr]);

  // Bilirkişi formatı açıklama metni (bir kez ayarla)
  useEffect(() => {
    const bilirkisiText = `24/24 Bilirkişi Formatı:\n` +
                          `12 saatlik haftalar: (hafta/2 yukarı yuvarla) × 12 saat\n` +
                          `9 saatlik haftalar: (hafta/2 aşağı yuvarla) × 9 saat`;
    setTxtTatilsiz(bilirkisiText);
    setTxtTatilli(bilirkisiText);
    setTxtUnderSeven(bilirkisiText);
    
    // Tabloyu yeniden hesapla
    handleHesapla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iseGiris, istenCikis, weeklyDays, exclusions]);

  // 48 saat çalışma seçildiğinde vardiya48 sayfasına yönlendir
  useEffect(() => {
  if (vardiyaType === "48") {
      navigate("/fazla-mesai/vardiya48");
  }
  }, [vardiyaType, navigate]);

  return (
    <Layout
      title={resolvedTitle}
      description="Fazla Mesai Alacağı Hesaplama"
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
              {/* Hesaplama Görünümü ve Yeni Hesaplama butonları kaldırıldı - üstte merkezi buton var */}
              {false && (
                <ReportPreviewButton
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

                    {/* Metin Hesaplaması */}
                    {(txtTatilsiz || txtTatilli || txtUnderSeven) && (
                      <div style={{border:'1px solid #d1d5db', borderRadius:6, overflow:'hidden', marginBottom:12}}>
                        <div style={{background:'#f3f4f6', padding:'8px 10px', fontSize:13, fontWeight:600}}>Metin Hesaplaması</div>
                        <div style={{padding:'10px', fontSize:12, fontFamily:'monospace', whiteSpace:'pre-wrap', background:'#fafafa', borderTop:'1px solid #e5e7eb'}}>
                          {Number(weeklyDays) === 7 ? (
                            activeTab === "tatilsiz" ? (txtTatilsiz || "Bilirkişi formatı yükleniyor...") : (txtTatilli || "Bilirkişi formatı yükleniyor...")
                          ) : (
                            txtUnderSeven || txtTatilsiz || "Bilirkişi formatı yükleniyor..."
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
                          Damga Vergisi (Binde 7,59): -{fmt(damgaVergisi)}
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
                              const num = Number(String(mahsuplasmaMiktari || '').replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                              return num > 0 ? fmt(num) : '0,00₺';
                            })()}
                          </div>
                        </div>
                        <div style={{marginTop:8, paddingTop:8, borderTop:'1px solid #e5e7eb'}}>
                          <div style={{marginBottom:4, fontSize:11, color:'#6b7280'}}>
                            Toplam Fazla Mesai ({fmt(brutYillik)}) − 1/3 Hakkaniyet İndirimi ({fmt(Number(brutYillik || 0) / 3)}) − Mahsuplaşma ({(() => {
                              const num = Number(String(mahsuplasmaMiktari || '').replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
                              return num > 0 ? fmt(num) : '0,00₺';
                            })()}) =
                          </div>
                          <div style={{fontSize:14, fontWeight:700, color:'#111827'}}>
                            {fmt(brutYillik - (Number(brutYillik || 0) / 3) - (Number(String(mahsuplasmaMiktari || '').replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />
              )}
              {/* Eski Yeni Hesaplama butonu kaldırıldı - üstte merkezi buton var */}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div>
                <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">Vardiya Tipi <span className="text-gray-500" title="24 saat veya 48 saat çalışma seçeneğini seçiniz.">ℹ️</span></div>
                <Select
                  value={vardiyaType}
                  onChange={(e) => setVardiyaType(e.target.value as "24" | "48")}
                  className="w-full"
                >
                  <option value="24">24 Saat Çalışma</option>
                  <option value="48">48 Saat Çalışma</option>
                </Select>
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
            <div className="rounded-md border border-gray-200 bg-[#e9ecef] px-3 py-2 text-sm font-semibold text-gray-800 mb-2">Beyan Bilgileri</div>
            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg">Davacı Beyanı</summary>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davaci.dateIn || ''} 
                      max="9999-12-31"
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
                        setDavaci((p)=>({...p, dateIn: value}));
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davaci.dateOut && /^\d{4}-\d{2}-\d{2}$/.test(davaci.dateOut)) {
                          const newDate = new Date(newValue);
                          const outDate = new Date(davaci.dateOut);
                          if (!isNaN(newDate.getTime()) && !isNaN(outDate.getTime()) && newDate > outDate) {
                            showToastError("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                            setDavaci((p)=>({...p, dateIn: davaci.dateOut || ''}));
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                    <input 
                      type="date" 
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                      value={davaci.dateOut || ''} 
                      max="9999-12-31"
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
                        setDavaci((p)=>({...p, dateOut: value}));
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && davaci.dateIn && /^\d{4}-\d{2}-\d{2}$/.test(davaci.dateIn)) {
                          const newDate = new Date(newValue);
                          const inDate = new Date(davaci.dateIn);
                          if (!isNaN(newDate.getTime()) && !isNaN(inDate.getTime()) && newDate < inDate) {
                            showToastError("Çıkış tarihi, giriş tarihinden önce olamaz.");
                            setDavaci((p)=>({...p, dateOut: davaci.dateIn || ''}));
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 bg-[#f8f9fa] rounded-t-lg">Tanık Beyanları</summary>
              <div className="p-4 space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Giriş Tarihi</div>
                        <input 
                          type="date" 
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                          value={t.dateIn || ''} 
                          max="9999-12-31"
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
                            setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateIn:value}:r));
                          }}
                        />
                      </div>
                      <div>
                        <div className="text-[13px] text-gray-700 font-medium mb-1">Çıkış Tarihi</div>
                        <input 
                          type="date" 
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" 
                          value={t.dateOut || ''} 
                          max="9999-12-31"
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
                            setTaniklar((arr)=>arr.map((r,i)=>i===idx?{...r,dateOut:value}:r));
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {idx === 0 ? (
                        <div />
                      ) : (
                        <button className="text-xs border border-red-300 text-red-600 rounded-md px-2 py-2" onClick={()=>setTaniklar((arr)=>arr.filter((_,i)=>i!==idx))}>🗑️ Kaldır</button>
                      )}
                    </div>
                  </div>
                ))}
                <button className="text-xs border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white rounded-md px-2 py-1" onClick={()=>setTaniklar((a)=>{ const nextId = a.reduce((m,x)=>Math.max(m,x.id),0)+1; return [...a,{ id: nextId, in:"", out:"", dateIn:"", dateOut:"" }]; })}>+ Tanık Ekle</button>
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
                      {activeTab === "tatilsiz" && (
                        <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{txtTatilsiz || "Bilirkişi formatı yükleniyor..."}</pre>
                      )}
                      {activeTab === "tatilli" && (
                        <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{txtTatilli || txtTatilsiz || "Bilirkişi formatı yükleniyor..."}</pre>
                      )}
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#f1f3f5] border rounded-md p-3">
                      <pre className="bg-gray-50 p-4 rounded-md font-light text-[13px] leading-relaxed tracking-tight font-mono text-gray-700 whitespace-pre-wrap">{txtUnderSeven || txtTatilsiz || "Bilirkişi formatı yükleniyor..."}</pre>
                      <div className="text-sm font-mono mt-2 font-semibold" style={{ display: 'none' }}>
                        <strong>Haftalık Fazla Mesai:</strong> <span id="haftalikFazlaMesai">{haftalikMesai.toFixed(2).replace('.', ',')}</span> saat
                      </div>
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>

          {/* HESAPLAMA KURALLARI - ZARİF BUTONLAR (270 saat düşüm bu sayfada yok) */}
          <div className="mt-5 mb-4 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setShowZamanaModal(true)}
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

          {zamanasimiBaslangic && rows.length > 0 && (
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

            <div className="mt-2 mb-2">
              <table className="table-auto w-full text-sm border border-gray-300" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-[#f8f9fa]" style={{ borderBottom: '2px solid #d0d0d0' }}>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Tarih Aralığı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Hafta Sayısı</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Ücret</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Kat Sayı Çarpanı <span className="text-gray-500" title="Katsayı varsayılan 1 olarak alınır.">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">FM Saati <span className="text-gray-500" title="Bilirkişi formatı: 12 veya 9 saatlik haftalar">ℹ️</span></th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">225</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">1,5</th>
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
                      <td className="border border-gray-300 px-2 py-1.5 text-right">—</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">225</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,5</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{fmt(0)}</td>
                      <td className="border-0 bg-transparent w-16"></td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                    <tr 
                      key={i} 
                      className={`hover:bg-gray-50 ${r.fmType === "9" ? "bg-blue-50/30" : ""}`}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="border border-gray-300 px-2 py-1.5">{r.rangeLabel}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{r.weeks}</td>
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
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">
                        <span className={`px-2 py-0.5 rounded ${r.fmType === "9" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                          {r.fmHours}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">225</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">1,5</td>
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

            {/* HESAPLAMA KURALLARI - ZARİF BUTONLAR'I BURADAN KALDIRDIK, YUKARI TAŞIDIK - STANDART FM İLE AYNI YER */}
            {/* Butonlar yukarıda, Bilirkişi Formatı'ndan hemen sonra */}

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

        </div>
        </div>

        {/* Notlar */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-900/30 dark:to-cyan-900/30 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Notlar
            </h3>
          </div>
          <div className="p-6 notes-content">
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">📅</span>
                <span>Hesaplama işe giriş-çıkış tarihleri arasında yıl bazında yapılır.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs">⚙️</span>
                <span>Katsayı hesabı farklı yöntemlerle (otomatik, manuel, özel) yapılabilir.</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-xs">💼</span>
                <span>Brüt ücreti değiştirerek farklı dönemlerde farklı ücretler uygulayabilirsiniz.</span>
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
            brutFazlaMesai: r.fm
          };
        })}
        onSave={(miktarStr) => {
          setMahsuplasmaMiktari(miktarStr);
        }}
      />

      {/* TODO: Dışlama Kaydetme/Yükleme Modal'ları eklenecek */}

      {/* Zamanaşımı Modal */}
      <ZamanasimiModal
        open={showZamanaModal}
        onClose={() => setShowZamanaModal(false)}
        onApply={(date) => {
          setZamanasimiBaslangic(date || "");
          setShowZamanaModal(false);
        }}
        currentDate={zamanasimiBaslangic || ""}
      />

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      {USE_NEW_VARDIYA24_REPORT && (
        <div id="vardiya24-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={vardiya24ReportConfig} />
        </div>
      )}

      </div>
      </div>
      </div>

      <FooterActions
        pageKey="fazla-mesai"
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={save}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: `${resolvedTitle} Rapor`,
          copyTargetId: "vardiya24-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #vardiya24-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #vardiya24-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="vardiya24-word-copy">
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
    </Layout>
  );
}


// GEREKSIZ KODLAR S�L�ND� - VARDIYA 24 SABAH FIX
// Dropdown Men� ve fazladan butonlar kald�r�ld� ��nk� zaten yukar�da do�ru yerde (sat�r 1750) var.
