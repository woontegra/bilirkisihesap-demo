import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./localContext/ToastContext";
import { safeNumber, safeCurrency, safeDays } from "./localUtils/safeFormat";
import NoteCard from "./NoteCard";
import EklentiModal from "./localComponents/EklentiModal";
import FooterActions from "@/components/FooterActions";
import { BaseReportModal, ReportContentFromConfig, type ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import KaydetModal from "./localComponents/KaydetModal";
import { useKaydetContext } from "./localHooks/useKaydet";
import { Trash2, Plus, AlertTriangle, Save, Download, Youtube, Copy } from "lucide-react";

// Bolt tasarım stilleri – Gemi/Davacı ile aynı
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";
const btnImport = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2";
const btnSave = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnEklenti = "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500";
import { getVideoLink } from "./localConfig/videoLinks";

// Report modal system
const USE_NEW_KIDEM_MEVSIMLIK_REPORT = true;

import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./localUtils/extraCalculationsStorage";
import { API_BASE_URL } from "./localUtils/apiClient";
import { parseMoney } from "./localUtils/parseMoney";
// Constants - inline
const NET_REDUCTION_FACTOR = 0.85;
const RECORD_TYPE = "kidem_mevsimlik";
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const REDIRECT_BASE_PATH = "/kidem-tazminati/mevsimlik";
const PRINT_TITLE = "Kıdem Tazminatı - Mevsimlik İşçi";
const PRINT_HEADING = "MEVSİMLİK İŞÇİ KIDEM TAZMİNATI";

// Helper functions - inline
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (n: number | undefined) => `${fmt(n)}₺`;
type WorkPeriod = any;

// Mevsimlik hesaplama fonksiyonları - inline
const calculatePeriodDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
};

const convertDaysToYilAyGun = (totalDays: number) => {
  const yil = Math.floor(totalDays / 365);
  const kalanGun = totalDays % 365;
  const ay = Math.floor(kalanGun / 30);
  const gun = kalanGun % 30;
  return { yil, ay, gun };
};

const formatCalismaSuresi = (totals: { yil: number; ay: number; gun: number }) => {
  const yil = totals?.yil ?? 0;
  const ay = totals?.ay ?? 0;
  const gun = totals?.gun ?? 0;
  return `${yil} Yıl ${ay} Ay ${gun} Gün`;
};

const normalizeAmount = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

type KidemReportData = {
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  calismaSuresi?: string;
  brutUcret?: number;
  prim?: number;
  ikramiye?: number;
  yemek?: number;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: { toplam: number; yil: number; ay: number; gun: number };
  damgaVergisi?: number;
  gelirVergisi?: number;
  gelirVergisiUygulanacak?: boolean;
};

const buildKidemReportData = (args: {
  formValues?: Record<string, unknown>;
  calismaSuresi?: string;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: { toplam: number; yil: number; ay: number; gun: number };
  damgaVergisi?: number;
  gelirVergisi?: number;
  gelirVergisiUygulanacak?: boolean;
}): KidemReportData => {
  const { formValues = {}, calismaSuresi, toplamBrut, netTazminat, totals, damgaVergisi, gelirVergisi, gelirVergisiUygulanacak } = args;
  const getField = (primary: string, fallback?: string) => (formValues?.[primary] ?? (fallback ? formValues?.[fallback] : undefined)) as string | undefined;
  return {
    iseGirisTarihi: getField("iseGiris", "startDate") || "",
    istenCikisTarihi: getField("istenCikis", "endDate") || "",
    calismaSuresi,
    brutUcret: normalizeAmount(getField("brut", "brutUcret")),
    prim: normalizeAmount(getField("prim")),
    ikramiye: normalizeAmount(getField("ikramiye")),
    yemek: normalizeAmount(getField("yemek")),
    toplamBrut,
    netTazminat,
    totals,
    damgaVergisi,
    gelirVergisi,
    gelirVergisiUygulanacak,
  };
};

const calculateMevsimlikKidemTazminati = (brutUcret: number, yil: number, ay: number, gun: number, exitDate?: Date) => {
  // Önce brüt ücrete tavan kontrolü uygula
  let kullanilacakBrut = brutUcret;
  let tavanUygulandi = false;
  const warnings = [];
  
  if (exitDate) {
    const tavan = findKidemTavan(exitDate);
    if (tavan && brutUcret > tavan) {
      kullanilacakBrut = tavan;
      tavanUygulandi = true;
      warnings.push(`Brüt ücrete tavan uygulandı: ${fmtCurrency(tavan)}`);
    }
  }
  
  // Tavanlı brüt ücret ile hesapla
  const yilTutar = kullanilacakBrut * yil;
  const ayTutar = (kullanilacakBrut / 12) * ay;
  const gunTutar = (kullanilacakBrut / 360) * gun;
  const brutKidem = yilTutar + ayTutar + gunTutar;
  
  return {
    kullanilacakBrut,
    yilTutar,
    ayTutar,
    gunTutar,
    toplamTutar: brutKidem,
    brutTazminatTutari: brutKidem,
    netTazminatTutari: brutKidem * NET_REDUCTION_FACTOR,
    tavanUygulandi,
    warnings,
  };
};

import { findKidemTavan } from "./localUtils/findKidemTavan";
import { asgariUcretler } from "./localUtils/asgariUcretler";
import { printPageContent } from "./localUtils/printPage";
// Soft glow styles removed - not needed for isolation

// getAsgariUcret - inline
const getAsgariUcret = (date: Date) => {
  const found = asgariUcretler.find(a => {
    const start = new Date(a.start);
    const end = new Date(a.end);
    return date >= start && date <= end;
  });
  return found ? found.brut : null;
};

// API servis fonksiyonları
const saveCalculation = async (data: any) => {
  try {
    const response = await fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Kayıt işlemi başarısız oldu');
    return result;
  } catch (err) {
    console.error('Kayıt hatası:', err);
    throw err;
  }
};

const loadCalculation = async (id: string) => {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    
    const response = await fetch(`${LOAD_ENDPOINT}/${id}`, {
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
        throw new Error(`Kayıt bulunamadı (ID: ${id}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
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
    
    // loadCalculation'dan gelen veriyi direkt kullan (dönüşüm yapmadan)
    return {
      data: payload, // Orijinal payload'ı da döndür
      formValues: payload.form || payload.formValues || {},
      appliedEklenti: payload.appliedEklenti || null,
      totals: payload.results?.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 },
      brutTazminat: payload.results?.brut || payload.brutTazminat || 0,
      netTazminat: payload.results?.net || payload.netTazminat || 0,
      notes: data.notes || data.aciklama || "",
      name: data.name || null
    };
  } catch (err: any) {
    console.error('Kayıt yükleme hatası:', err);
    throw err;
  }
};

const toNumber = (value: string | null | undefined) =>
  Number.parseFloat(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

export default function KidemMevsimlikIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { success, error: showToastError } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);
  
  // Query parametrelerinden caseId'yi de kontrol et
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  
  // Çalışma dönemleri state
  const [periods, setPeriods] = useState<WorkPeriod[]>([
    { start: '', end: '', days: 0 }
  ]);
  
  // Toplam çalışma günü (state'ten hesaplanır, override edilebilir)
  const [totalDays, setTotalDays] = useState<number>(0);
  const [totalDaysManual, setTotalDaysManual] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false); // Kullanıcı manuel override yaptı mı?
  
  const [formValues, setFormValues] = useState({
    brutUcret: '',
    prim: '',
    ikramiye: '',
    yemek: '',
    exitDate: '',
    isIhbar: false,
    ihbarTarihi: '',
    ihbarSuresi: '14',
    isKidemTavan: true,
    isYabanci: false,
    isSGK: true,
    isGelirVergisi: true,
    isDamgaVergisi: true,
    isDamgaVergisiMatrahi: false,
    isDamgaVergisiOrani: false,
    isDamgaVergisiTutari: false,
    isDamgaVergisiMatrahiTutari: false,
    isDamgaVergisiOraniTutari: false,
    isDamgaVergisiTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutari: false,
    isDamgaVergisiOraniTutariTutari: false,
    isDamgaVergisiTutariTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutariTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutariTutari: false,
  });
  
  // Extras (ek alanlar) state
  type ExtraItem = { id: string; label: string; value: string };
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [appliedEklenti, setAppliedEklenti] = useState<any>(null);
  const [exitDate, setExitDate] = useState<string>('');
  const [matchedTavanState, setMatchedTavanState] = useState<KidemTavan | null>(null);
  const [asgariHata, setAsgariHata] = useState<string | null>(null);
  const [tavanUygulandi, setTavanUygulandi] = useState<boolean>(false);
  const [tavanDegeri, setTavanDegeri] = useState<number | null>(null);
  
  // Brüt'ten Net'e çeviri için state
  const [brutTazminat, setBrutTazminat] = useState(0);
  const [netTazminat, setNetTazminat] = useState(0);
  // Merkezi kayıt sistemi
  const { kaydetAc, isSaving, isModalOpen, kaydetKapat, handleSave, currentOptions } = useKaydetContext();
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  
  // Not: Otomatik gün hesaplama handleUpdatePeriod içinde yapılıyor
  // useEffect kullanmıyoruz çünkü tarih değişikliği direkt handleUpdatePeriod'da işleniyor
  
  // Toplam gün hesapla (state'ten, input'tan değil)
  // useMemo ile toplamı hesapla - periods array'inin içeriği değiştiğinde yeniden hesapla
  const calculatedTotalDays = useMemo(() => {
    return periods.reduce((acc, p) => acc + (p.days || 0), 0);
  }, [periods]); // periods array'i değiştiğinde tetikle
  
  // Toplam gün state'ini güncelle
  useEffect(() => {
    setTotalDays(calculatedTotalDays);
    
    // Eğer kullanıcı manuel override yapmadıysa, otomatik hesaplanan değeri göster
    if (!isManualOverride) {
      setTotalDaysManual(calculatedTotalDays > 0 ? calculatedTotalDays.toString() : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedTotalDays]); // calculatedTotalDays değiştiğinde tetikle
  
  // Yıl/Ay/Gün hesaplamaları
  const { yil, ay, gun } = useMemo(() => {
    const effectiveDays = totalDaysManual ? parseFloat(totalDaysManual.replace(/\./g, "").replace(',', '.')) || totalDays : totalDays;
    return convertDaysToYilAyGun(effectiveDays);
  }, [totalDays, totalDaysManual]);

  // 360 gün kontrolü - Mevsimlik işçi için minimum çalışma süresi
  const kidemTazminatiHakkiYok = useMemo(() => {
    const effectiveDays = totalDaysManual ? parseFloat(totalDaysManual.replace(/\./g, "").replace(',', '.')) || totalDays : totalDays;
    return effectiveDays > 0 && effectiveDays < 360;
  }, [totalDays, totalDaysManual]);
  
  // Extras fonksiyonları
  const addExtra = useCallback(() => {
    setExtras(prev => [...prev, { id: Math.random().toString(36).slice(2), label: "Eklenti", value: "" }]);
  }, []);

  const setExtra = useCallback((id: string, patch: Partial<ExtraItem>) => {
    setExtras(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeExtra = useCallback((id: string) => {
    setExtras(prev => prev.filter(x => x.id !== id));
  }, []);

  // Kaydedilmiş setleri yükle
  useEffect(() => {
    if (showImportModal) {
      getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal]);

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }

    const items: { id: string; name: string; value: string }[] = [];
    if (formValues.prim?.trim()) items.push({ id: "prim", name: "Prim", value: formValues.prim.trim() });
    if (formValues.ikramiye?.trim()) items.push({ id: "ikramiye", name: "İkramiye", value: formValues.ikramiye.trim() });
    if (formValues.yemek?.trim()) items.push({ id: "yemek", name: "Yemek", value: formValues.yemek.trim() });
    extras.forEach(item => items.push({ id: item.id, name: item.label, value: item.value }));

    if (items.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }
    const saveResult = await saveExtraCalculationsSet(saveName.trim(), items);
    if (saveResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const FIXED_EXTRA_IDS = ["prim", "ikramiye", "yemek"];
  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      const primItem = data.find((x: { id: string }) => x.id === "prim");
      const ikramiyeItem = data.find((x: { id: string }) => x.id === "ikramiye");
      const yemekItem = data.find((x: { id: string }) => x.id === "yemek");
      const extrasData = data.filter((x: { id: string }) => !FIXED_EXTRA_IDS.includes(x.id));
      setFormValues(prev => ({
        ...prev,
        ...(primItem?.value && { prim: primItem.value }),
        ...(ikramiyeItem?.value && { ikramiye: ikramiyeItem.value }),
        ...(yemekItem?.value && { yemek: yemekItem.value }),
      }));
      setExtras(extrasData.map((item: { id: string; name: string; value: string }) => ({ id: item.id, label: item.name, value: item.value })));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      showToastError("Yüklenecek veri bulunamadı");
    }
  };

  const handleDeleteExtra = async (id: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;

    const deleteResult = await deleteExtraCalculationsSet(id);
    if (deleteResult) {
      success("Set silindi");
      await getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  // Brüt ücret hesapla
  const brutUcretToplam = useMemo(() => {
    const base = toNumber(formValues.brutUcret) +
      toNumber(formValues.prim) +
      toNumber(formValues.ikramiye) +
      toNumber(formValues.yemek);
    const extrasSum = extras.reduce((acc, it) => acc + toNumber(it.value), 0);
    return base + extrasSum;
  }, [formValues.brutUcret, formValues.prim, formValues.ikramiye, formValues.yemek, extras]);
  
  // exitDate'i en son çalışma döneminin bitiş tarihi olarak otomatik belirle
  const effectiveExitDate = useMemo(() => {
    // En son dönemin bitiş tarihini kullan
    const periodsWithEndDates = periods.filter(p => p.end && p.end.trim() !== '');
    if (periodsWithEndDates.length > 0) {
      // Tarihleri sırala ve en son bitiş tarihini al
      const sortedPeriods = [...periodsWithEndDates].sort((a, b) => {
        const dateA = new Date(a.end).getTime();
        const dateB = new Date(b.end).getTime();
        return dateB - dateA; // En yeni tarih önce
      });
      return sortedPeriods[0].end;
    }
    // Eğer hiç bitiş tarihi yoksa, exitDate state'ini kullan
    return exitDate || '';
  }, [periods, exitDate]);
  
  // Kıdem tazminatı hesaplama (yeni formül)
  const kidemHesaplama = useMemo(() => {
    const exitDate = effectiveExitDate ? new Date(effectiveExitDate) : undefined;
    return calculateMevsimlikKidemTazminati(brutUcretToplam, yil, ay, gun, exitDate);
  }, [brutUcretToplam, yil, ay, gun, effectiveExitDate]);
  
  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    
    let isMounted = true; // Component unmount kontrolü
    
    const fetchData = async () => {
      try {
        const data = await loadCalculation(loadId);
        
        if (!isMounted) return; // Component unmount olduysa işlemi durdur
        
        // Tarih formatını dönüştür (DD.MM.YYYY -> YYYY-MM-DD)
        const convertDateFormat = (dateStr: string): string => {
          if (!dateStr) return '';
          // DD.MM.YYYY formatını kontrol et
          if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
          // Zaten YYYY-MM-DD formatındaysa veya ISO formatındaysa olduğu gibi dön
          return dateStr.split('T')[0];
        };

        // Eski formatı yeni formata dönüştür
        if (data.formValues?.periods) {
          // Periods array'indeki tarihleri dönüştür
          const convertedPeriods = data.formValues.periods.map((period: any) => ({
            ...period,
            start: convertDateFormat(period.start),
            end: convertDateFormat(period.end)
          }));
          setPeriods(convertedPeriods);
          setTotalDaysManual(data.formValues.totalDays || data.formValues.totalDaysManual || '');
        } else if (data.formValues?.startDate && data.formValues?.endDate) {
          // Eski tek dönem formatı - yeni formata dönüştür
          const startDate = data.formValues.startDate ? new Date(data.formValues.startDate).toISOString().split('T')[0] : '';
          const endDate = data.formValues.endDate ? new Date(data.formValues.endDate).toISOString().split('T')[0] : '';
          setPeriods([{
            start: startDate,
            end: endDate,
            days: calculatePeriodDays(startDate, endDate)
          }]);
        }
        
        setFormValues(prev => ({
          ...prev,
          ...data.formValues,
          exitDate: data.formValues.exitDate ? new Date(data.formValues.exitDate).toISOString().split('T')[0] : '',
          ihbarTarihi: data.formValues.ihbarTarihi ? new Date(data.formValues.ihbarTarihi).toISOString().split('T')[0] : ''
        }));
        
        // Extras'ı yükle
        if (data.formValues?.extras && Array.isArray(data.formValues.extras)) {
          setExtras(data.formValues.extras);
        } else {
          setExtras([]);
        }
        
        setExitDate(data.formValues.exitDate || '');
        setAppliedEklenti(data.appliedEklenti || null);
        if (data.name) {
          setCurrentRecordName(data.name);
        }
        success('Kayıt yüklendi');
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError('Kayıt yüklenirken hata oluştu');
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Sadece id değiştiğinde çalışsın
  
  // Dönem ekle
  const handleAddPeriod = useCallback(() => {
    setPeriods(prev => [...prev, { start: '', end: '', days: 0 }]);
  }, []);
  
  // Dönem sil
  const handleRemovePeriod = useCallback((index: number) => {
    setPeriods(prev => {
      if (prev.length <= 1) return prev; // En az bir dönem kalmalı
      return prev.filter((_, i) => i !== index);
    });
  }, []);
  
  // Dönem güncelle (tarih veya manuel gün)
  const handleUpdatePeriod = useCallback((index: number, field: 'start' | 'end' | 'days', value: string | number) => {
    setPeriods(prev => prev.map((period, i) => {
      if (i !== index) return period;
      
      if (field === 'days') {
        // Manuel gün değişikliği - override modunda, direkt state'e yaz
        const daysValue = typeof value === 'string' ? parseInt(value, 10) || 0 : value;
        return { ...period, days: daysValue >= 0 ? daysValue : 0 };
      } else {
        // Tarih değişikliği - otomatik hesaplanacak (manuel override kaybolur)
        let dateValue = value as string;
        
        // Yıl kısmını 4 karakterle sınırla
        if (dateValue && dateValue.includes('-')) {
          const parts = dateValue.split('-');
          if (parts[0] && parts[0].length > 4) {
            parts[0] = parts[0].substring(0, 4);
            dateValue = parts.join('-');
          }
        }
        
        const updatedPeriod = { ...period, [field]: dateValue };
        
        // Eğer her iki tarih de varsa otomatik hesapla
        if (updatedPeriod.start && updatedPeriod.end) {
          updatedPeriod.days = calculatePeriodDays(updatedPeriod.start, updatedPeriod.end);
        } else {
          updatedPeriod.days = 0;
        }
        return updatedPeriod;
      }
    }));
  }, []);
  
  // Eklenti isteği
  const handleRequestEklenti = useCallback((title: string, fieldKey: string) => {
    setModalTitle(title);
    setModalOpen(true);
    // Field key'i modal'a geçirmek için
    (window as any).__eklentiFieldKey = fieldKey;
  }, []);
  
  // Eklenti uygula
  const handleApplyEklenti = useCallback((eklenti: number) => {
    const fieldKey = (window as any).__eklentiFieldKey || 'ikramiye';
    setAppliedEklenti(eklenti);
    
    // Eğer extra alanı ise
    if (fieldKey.startsWith('extra:')) {
      const extraId = fieldKey.replace('extra:', '');
      setExtra(extraId, { value: String(eklenti.toFixed(2)).replace('.', ',') });
    } else {
      // Normal form alanı ise
      setFormValues(prev => ({
        ...prev,
        [fieldKey]: String(eklenti.toFixed(2)).replace('.', ',')
      }));
    }
    
    setModalOpen(false);
    success('Eklenti uygulandı');
  }, [success, setExtra]);

  // Asgari ücret live validation
  useEffect(() => {
    if (!effectiveExitDate || !formValues.brutUcret) {
      setAsgariHata(null);
      return;
    }
    const minUcret = getAsgariUcret(new Date(effectiveExitDate));
    // Asgari ücret bulunamazsa validation'ı atla
    if (!minUcret) {
      setAsgariHata(null);
      return;
    }
    const brutValue = toNumber(formValues.brutUcret);
    if (!brutValue) {
      setAsgariHata(null);
      return;
    }
    // Sadece asgari ücret varsa ve brüt değer düşükse hata göster
    if (minUcret && brutValue < minUcret) {
      const year = new Date(effectiveExitDate).getFullYear();
      const formattedMin = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minUcret);
      setAsgariHata(`Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${formattedMin}₺).`);
    } else {
      setAsgariHata(null);
    }
  }, [effectiveExitDate, formValues.brutUcret]);

  // Hesaplamaları güncelle (tavan kontrolü calculations.ts içinde yapılıyor)
  useEffect(() => {
    const { matchedTavan } =
      { brutTazminatTutari: 0, netTazminatTutari: 0 }; // Backend'den gelecek

    setMatchedTavanState(matchedTavan);
    
    // Brüt tazminat = Kıdem tazminatı hesaplama toplamı (tavan kontrolü zaten yapıldı)
    const finalBrutTazminat = kidemHesaplama.toplamTutar;
    
    // Tavan uygulandıysa uyarıyı göster
    const tavanUygulandiFlag = kidemHesaplama.warnings && kidemHesaplama.warnings.length > 0;
    if (tavanUygulandiFlag && effectiveExitDate) {
      const exitDate = new Date(effectiveExitDate);
      const tavan = findKidemTavan(exitDate);
      setTavanDegeri(tavan);
    } else {
      setTavanDegeri(null);
    }
    setTavanUygulandi(tavanUygulandiFlag);
    
    setBrutTazminat(finalBrutTazminat);
    
    // Net hesaplama: Brüt - Damga Vergisi (binde 7,59)
    const damgaVergisiTutar = finalBrutTazminat * 0.00759;
    setNetTazminat(finalBrutTazminat - damgaVergisiTutar);
  }, [formValues, effectiveExitDate, kidemHesaplama.toplamTutar, kidemHesaplama.warnings]);

  const damgaVergisi = brutTazminat * 0.00759;
  
  // İlk ve son tarihleri periods'dan al
  const iseGirisTarihi = useMemo(() => {
    const periodsWithStartDates = periods.filter(p => p.start && p.start.trim() !== '');
    if (periodsWithStartDates.length > 0) {
      const sortedPeriods = [...periodsWithStartDates].sort((a, b) => {
        const dateA = new Date(a.start).getTime();
        const dateB = new Date(b.start).getTime();
        return dateA - dateB; // En eski tarih önce
      });
      return sortedPeriods[0].start;
    }
    return '';
  }, [periods]);
  
  const istenCikisTarihi = useMemo(() => {
    return effectiveExitDate || '';
  }, [effectiveExitDate]);
  
  // Report data hazırla
  const reportData = useMemo(() => {
    const totals = {
      toplam: kidemHesaplama.kullanilacakBrut || brutUcretToplam,
      yil,
      ay,
      gun,
    };
    
    const calismaSuresiLabel = formatCalismaSuresi({ yil, ay, gun });
    
    return buildKidemReportData({
      formValues: {
        ...formValues,
        iseGiris: iseGirisTarihi,
        istenCikis: istenCikisTarihi,
      },
      calismaSuresi: calismaSuresiLabel,
      toplamBrut: brutTazminat,
      netTazminat,
      totals,
      damgaVergisi,
      gelirVergisi: 0,
      gelirVergisiUygulanacak: false,
    });
  }, [
    kidemHesaplama.kullanilacakBrut,
    brutUcretToplam,
    yil,
    ay,
    gun,
    iseGirisTarihi,
    istenCikisTarihi,
    formValues,
    brutTazminat,
    netTazminat,
    damgaVergisi,
  ]);

  // YENİ RAPOR SİSTEMİ: State
  const [showNewMevsimlikReportModal, setShowNewMevsimlikReportModal] = useState(false);

  // YENİ RAPOR SİSTEMİ: Config
  const kidemMevsimlikReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLocalCurrency = (n: number) => `${fmtLocal(n)}₺`;
    
    const totals = {
      toplam: kidemHesaplama.kullanilacakBrut || brutUcretToplam,
      yil,
      ay,
      gun,
    };

    // Aylık brüt ücret - kullanilacakBrut kullan
    // Aylık brüt ücret - tavan uygulanmışsa tavan değerini kullan, değilse kullanilacakBrut
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : (kidemHesaplama.kullanilacakBrut || brutUcretToplam);
    
    const yilTutar = aylikBrutUcret * totals.yil;
    const ayTutar = (aylikBrutUcret / 12) * totals.ay;
    const gunTutar = (aylikBrutUcret / 360) * totals.gun; // Mevsimlik için 360 gün kullanılıyor
    const sonuc = yilTutar + ayTutar + gunTutar;

    const calismaSuresiLabel = formatCalismaSuresi({ yil, ay, gun });

    return {
      title: "Mevsimlik İşçi Kıdem Tazminatı",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: calismaSuresiLabel || "-" },
      ],
      customSections: [
        {
          title: "Ücret Bileşenleri",
          condition: true,
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bileşen</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Çıplak Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.brutUcret || "0"))}</td>
                </tr>
                {parseMoney(formValues.prim || "0") > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Prim</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.prim || "0"))}</td>
                  </tr>
                )}
                {parseMoney(formValues.ikramiye || "0") > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>İkramiye</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.ikramiye || "0"))}</td>
                  </tr>
                )}
                {parseMoney(formValues.yemek || "0") > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yemek</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.yemek || "0"))}</td>
                  </tr>
                )}
                {extras.map((extra) => (
                  <tr key={extra.id}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{extra.label}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(extra.value || "0"))}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Kıdem Tazminatı</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(kidemHesaplama.kullanilacakBrut || brutUcretToplam)}</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        {
          title: "Kıdem Tazminatı Hesaplama",
          condition: true,
          content: (
            <>
              {tavanUygulandi && tavanDegeri && (
                <div style={{ 
                  marginBottom: '12px', 
                  padding: '8px 12px', 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '4px',
                  borderLeft: '4px solid #ef4444'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                    ⚠️ Tavan Ücret Uyarısı
                  </div>
                  <div style={{ fontSize: '10px', color: '#991b1b' }}>
                    Aylık brüt ücret, dönem tavanı olan {fmtLocalCurrency(tavanDegeri)}'yi aştığı için tavan seviyesine çekilmiştir. Hesaplamalar tavan değeri üzerinden yapılmıştır.
                  </div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmtLocal(aylikBrutUcret)} × {totals.yil} yıl
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtLocalCurrency(yilTutar)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmtLocal(aylikBrutUcret)} / 12 × {totals.ay} ay
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtLocalCurrency(ayTutar)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmtLocal(aylikBrutUcret)} / 360 × {totals.gun} gün
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtLocalCurrency(gunTutar)}
                    </td>
                  </tr>
                  <tr style={{ background: '#eff6ff', fontWeight: 600 }}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      Toplam
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#2563eb', fontSize: '12px' }}>
                      {fmtLocalCurrency(sonuc)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Kıdem Tazminatı", value: fmtLocalCurrency(brutTazminat) },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocalCurrency(damgaVergisi)}`, isDeduction: true },
          { label: "Net Kıdem Tazminatı", value: fmtLocalCurrency(netTazminat), isNet: true },
        ],
      },
    };
  }, [formValues, yil, ay, gun, kidemHesaplama.kullanilacakBrut, brutUcretToplam, brutTazminat, damgaVergisi, netTazminat, iseGirisTarihi, istenCikisTarihi, tavanUygulandi, tavanDegeri, extras]);

  // Bölüm bazlı Word tabloları (DavaciUcreti / Kidem30 / KidemGemi ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const totals = { toplam: kidemHesaplama.kullanilacakBrut || brutUcretToplam, yil, ay, gun };
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : (kidemHesaplama.kullanilacakBrut || brutUcretToplam);
    const yilTutar = aylikBrutUcret * totals.yil;
    const ayTutar = (aylikBrutUcret / 12) * totals.ay;
    const gunTutar = (aylikBrutUcret / 360) * totals.gun;
    const sonuc = yilTutar + ayTutar + gunTutar;
    const calismaSuresiLabel = formatCalismaSuresi({ yil, ay, gun });

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş Tarihi", iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["İşten Çıkış Tarihi", istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["Çalışma Süresi", calismaSuresiLabel || "-"],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt Ücret", value: fmtCurrency(parseMoney(formValues.brutUcret || "0")) },
    ];
    if (parseMoney(formValues.prim || "0") > 0) bilesenData.push({ label: "Prim", value: fmtCurrency(parseMoney(formValues.prim || "0")) });
    if (parseMoney(formValues.ikramiye || "0") > 0) bilesenData.push({ label: "İkramiye", value: fmtCurrency(parseMoney(formValues.ikramiye || "0")) });
    if (parseMoney(formValues.yemek || "0") > 0) bilesenData.push({ label: "Yemek", value: fmtCurrency(parseMoney(formValues.yemek || "0")) });
    extras.filter((ex) => parseMoney(ex.value || "0") > 0).forEach((ex) => {
      bilesenData.push({ label: ex.label, value: fmtCurrency(parseMoney(ex.value || "0")) });
    });
    bilesenData.push({ label: "Toplam Kıdem Tazminatı", value: fmtCurrency(kidemHesaplama.kullanilacakBrut || brutUcretToplam) });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({ id: "ucret-bilesenleri", title: "Ücret Bileşenleri", html: buildWordTable(n2.headers, n2.rows) });

    if (tavanUygulandi && tavanDegeri) {
      const n3 = adaptToWordTable({
        headers: ["Tavan Uyarısı"],
        rows: [[`Aylık brüt ücret, dönem tavanı olan ${fmtCurrency(tavanDegeri)}'yi aştığı için tavan seviyesine çekilmiştir.`]],
      });
      sections.push({ id: "tavan-uyarisi", title: "Tavan Uyarısı", html: buildWordTable(n3.headers, n3.rows) });
    }

    const hesapRows: { label: string; value: string }[] = [
      { label: `${fmt(aylikBrutUcret)} × ${totals.yil} yıl`, value: fmtCurrency(yilTutar) },
      { label: `${fmt(aylikBrutUcret)} / 12 × ${totals.ay} ay`, value: fmtCurrency(ayTutar) },
      { label: `${fmt(aylikBrutUcret)} / 360 × ${totals.gun} gün`, value: fmtCurrency(gunTutar) },
      { label: "Toplam", value: fmtCurrency(sonuc) },
    ];
    const n4 = adaptToWordTable(hesapRows);
    sections.push({ id: "kidem-hesap", title: "Kıdem Tazminatı Hesaplama", html: buildWordTable(n4.headers, n4.rows) });

    const grossNetRows = kidemMevsimlikReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n5 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [formValues, extras, yil, ay, gun, kidemHesaplama.kullanilacakBrut, brutUcretToplam, iseGirisTarihi, istenCikisTarihi, tavanUygulandi, tavanDegeri, kidemMevsimlikReportConfig]);

  // Yazdırma: modal açılmadan doğrudan yazdırma penceresi açılır (#report-content gizli div'de her zaman var)
  const handlePrint = useCallback(() => {
    if (USE_NEW_KIDEM_MEVSIMLIK_REPORT) {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      const title = kidemMevsimlikReportConfig.title;
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0 auto; font-size: 10px; max-width: 16cm; }
    table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid !important; table-layout: fixed; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
</html>`;
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
      const content = document.querySelector('#kidem-print');
      if (!content) return;
      const clone = content.cloneNode(true) as HTMLElement;
      clone.id = 'print-root';
      document.body.appendChild(clone);
      window.print();
      document.body.removeChild(clone);
    }
  }, [kidemMevsimlikReportConfig.title]);
  
  // Kaydetme işlemi - tıklanınca modal her zaman açılır (diğer sayfalardaki gibi)
  const handleSaveRecord = useCallback(() => {
    const iseGiris = periods[0]?.start || formValues.startDate || null;
    const istenCikis = effectiveExitDate || formValues.exitDate || null;
    
    // Extras'ı form'a ekle
    const formDataWithExtras = { 
      ...formValues, 
      periods, 
      totalDaysManual, 
      exitDate: formValues.exitDate,
      extras: extras || []
    };
    
    kaydetAc({
      hesapTuru: "kidem_mevsimlik",
      veri: {
        data: {
          form: formDataWithExtras,
          results: {
            totals: { toplam: brutTazminat, yil, ay, gun },
            brut: brutTazminat,
            net: netTazminat
          }
        },
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: brutTazminat || 0,
        net_total: netTazminat || 0,
        start_date: iseGiris,
        end_date: istenCikis,
        total: brutTazminat || 0,
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      redirectPath: `${REDIRECT_BASE_PATH}/:id`,
      onSuccess: (result) => {
        if (result.name) {
          setCurrentRecordName(result.name);
        }
      },
    });
  }, [formValues, effectiveExitDate, periods, totalDaysManual, yil, ay, gun, brutTazminat, netTazminat, effectiveId, currentRecordName, kaydetAc, extras]);
  
  // Yeni hesaplama
  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = (periods.length > 0 && periods[0]?.start) && !id;
      if (hasUnsavedData) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) {
          return;
        }
      }
      
      if (id) {
        window.location.href = REDIRECT_BASE_PATH;
        return;
      }
      
      setFormValues({
        brutUcret: '', prim: '', ikramiye: '', yemek: '',
        startDate: '', endDate: '', exitDate: '', isIhbar: false, ihbarTarihi: '', ihbarSuresi: '14',
        isKidemTavan: true, isYabanci: false, isSGK: true, isGelirVergisi: true, isDamgaVergisi: true,
        iseGiris: '', istenCikis: '', brut: '', extras: []
      });
      setPeriods([]);
      setBrutTazminat(0);
      setNetTazminat(0);
      setExitDate('');
      setAppliedEklenti(undefined);
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [periods, id]);

  const videoLink = getVideoLink("kidem-mevsimlik");

  return (
    <ToastProvider>
      <div>
        <div style={{ height: "4px", background: "#1E88E5" }} />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "80px" }}>
            {/* Header */}
            <div className="mb-8 flex justify-end">
              <div className="flex items-center gap-2">
                {videoLink && (
                  <button
                    onClick={() => window.open(videoLink, "_blank")}
                    className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600 dark:hover:bg-gray-700 transition-all"
                  >
                    <Youtube className="h-4 w-4" />
                    Kullanım Videosu İzle
                  </button>
                )}
              </div>
            </div>

            {/* Ana Form Kartı */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-8 space-y-6">

                {/* Çalışma Dönemleri */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    {periods.map((period, index) => (
                      <div key={index} className="flex items-end gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs text-gray-500 mb-1">Giriş Tarihi</label>
                          <input
                            type="date"
                            value={period.start}
                            onChange={(e) => handleUpdatePeriod(index, 'start', e.target.value)}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.end && /^\d{4}-\d{2}-\d{2}$/.test(period.end)) {
                                const newDate = new Date(newValue);
                                const endDate = new Date(period.end);
                                if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                                  error("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                                  handleUpdatePeriod(index, 'start', period.end);
                                }
                              }
                            }}
                            className={inputClass}
                          />
                        </div>
                        <span className="text-gray-400 mb-2">—</span>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs text-gray-500 mb-1">Çıkış Tarihi</label>
                          <input
                            type="date"
                            value={period.end}
                            onChange={(e) => handleUpdatePeriod(index, 'end', e.target.value)}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.start && /^\d{4}-\d{2}-\d{2}$/.test(period.start)) {
                                const newDate = new Date(newValue);
                                const startDate = new Date(period.start);
                                if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                                  error("Çıkış tarihi, giriş tarihinden önce olamaz.");
                                  handleUpdatePeriod(index, 'end', period.start);
                                }
                              }
                            }}
                            className={inputClass}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <label className="block text-xs text-gray-500 mb-1">Gün</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={period.days || ''}
                              onChange={(e) => handleUpdatePeriod(index, 'days', e.target.value)}
                              placeholder="0"
                              min={0}
                              className={`${inputClass} text-center flex-1`}
                            />
                            <span className="text-sm text-gray-500 min-w-[60px] whitespace-nowrap">≈ {period.days} gün</span>
                          </div>
                        </div>
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => handleRemovePeriod(index)}
                            disabled={periods.length <= 1}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                            title="Sil"
                            aria-label="Dönemi sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddPeriod}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm text-blue-600 border border-dashed border-gray-200 hover:border-blue-400 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Yeni Dönem Ekle
                    </button>
                  </div>
                  
                  {/* Toplam Çalışma Günü */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Toplam Çalışma Günü</label>
                    <input
                      type="text"
                      value={totalDaysManual}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d,.-]/g, '');
                        setTotalDaysManual(value);
                        setIsManualOverride(true);
                      }}
                      onBlur={() => {
                        if (!totalDaysManual || totalDaysManual === '' || totalDaysManual === '0') {
                          setTotalDaysManual(totalDays.toString());
                          setIsManualOverride(false);
                        }
                      }}
                      placeholder="Otomatik hesaplanır"
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-500 mt-1">Tüm dönemlerin toplamı otomatik olarak hesaplanır</p>
                  </div>
                </div>

                {/* Çıplak Brüt Ücret */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Çıplak Brüt Ücret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formValues.brutUcret}
                    onChange={(e) => setFormValues(prev => ({ ...prev, brutUcret: e.target.value }))}
                    placeholder="Örn: 25.000,00"
                    className={inputClass}
                  />
                  {asgariHata && <p className="text-sm text-red-600 mt-1">{asgariHata}</p>}
                </div>

                {/* Ekstra Hesaplamalar - Davacı/Gemi ile aynı düzen */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">₺</div>
                      Ekstra Hesaplamalar
                    </h2>
                    <div className="flex gap-3">
                      <button onClick={() => setShowImportModal(true)} className={btnImport}>
                        <Download className="w-4 h-4" />
                        İçe Aktar
                      </button>
                      <button
                        onClick={() => setShowSaveModal(true)}
                        disabled={!(extras.length > 0 || (formValues.prim || '').trim() || (formValues.ikramiye || '').trim() || (formValues.yemek || '').trim())}
                        className={btnSave}
                      >
                        <Save className="w-4 h-4" />
                        Kaydet
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 -mt-2">
                    Prim, İkramiye, Yemek vb.
                    <span className="cursor-help text-orange-500 ml-1" title="Çıplak brüt ücrete ek olarak prim, ikramiye, yemek gibi düzenli ödemeleri buraya ekleyebilirsiniz.">ⓘ</span>
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={formValues.prim}
                          onChange={(e) => setFormValues(prev => ({ ...prev, prim: e.target.value }))}
                          placeholder="Örn: 2.500,00"
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900"
                        />
                        <button type="button" className={btnEklenti} style={{ flexShrink: 0 }} onClick={() => handleRequestEklenti("Prim için eklenti hesapla", "prim")}>
                          Eklenti Hesapla
                          <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                        </button>
                      </div>
                      <button type="button" onClick={() => setFormValues(prev => ({ ...prev, prim: '' }))} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500" aria-label="Temizle">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={formValues.ikramiye}
                          onChange={(e) => setFormValues(prev => ({ ...prev, ikramiye: e.target.value }))}
                          placeholder="Örn: 1.000,00"
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900"
                        />
                        <button type="button" className={btnEklenti} style={{ flexShrink: 0 }} onClick={() => handleRequestEklenti("İkramiye için eklenti hesapla", "ikramiye")}>
                          Eklenti Hesapla
                          <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                        </button>
                      </div>
                      <button type="button" onClick={() => setFormValues(prev => ({ ...prev, ikramiye: '' }))} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500" aria-label="Temizle">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={formValues.yemek}
                          onChange={(e) => setFormValues(prev => ({ ...prev, yemek: e.target.value }))}
                          placeholder="Örn: 1.200,00"
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900"
                        />
                        <button type="button" className={btnEklenti} style={{ flexShrink: 0 }} onClick={() => handleRequestEklenti("Yemek için eklenti hesapla", "yemek")}>
                          Eklenti Hesapla
                          <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yemek bedeli değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                        </button>
                      </div>
                      <button type="button" onClick={() => setFormValues(prev => ({ ...prev, yemek: '' }))} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500" aria-label="Temizle">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {extras.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        <input value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900" placeholder="Kalem Adı" />
                        <div className="flex-1 flex items-center gap-2">
                          <input value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900" placeholder="Tutar" />
                          <button type="button" className={btnEklenti} style={{ flexShrink: 0 }} onClick={() => handleRequestEklenti(`${it.label || 'Ek kalem'} için eklenti hesapla`, `extra:${it.id}`)}>
                            Eklenti Hesapla
                            <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                          </button>
                        </div>
                        <button type="button" onClick={() => removeExtra(it.id)} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500" aria-label="Satırı Sil">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={addExtra} className="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2.5 rounded-full border border-dashed border-gray-200 hover:border-blue-400">
                      + Ekle
                    </button>
                  </div>
                </div>

                {/* Toplam Kıdem Tazminatı */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Toplam Kıdem Tazminatı</span>
                  <span className="text-lg font-bold text-blue-600">{fmtCurrency(brutUcretToplam)}</span>
                </div>
                <p className="text-xs text-gray-500 -mt-2">Çıplak brüt ücret + ekstra hesaplamalar toplamı</p>

            {kidemTazminatiHakkiYok && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-orange-800 font-medium">Kıdem Tazminatı Hakkı Uyarısı</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Mevsimlik işçiler için 360 günden az çalışma süresine sahip olanlara kıdem tazminatı hakkı doğmaz. Toplam çalışma süreniz 360 günün altında olduğu için kıdem tazminatı hesaplanamaz.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tavanUygulandi && tavanDegeri && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Kıdem Tavanı Uygulandı</p>
                    <p className="text-xs text-red-700 mt-1">
                      Brüt ücret ({fmtCurrency(brutUcretToplam)}) dönem tavanını ({fmtCurrency(tavanDegeri)}) aştığı için hesaplama tavan ücret üzerinden yapılmıştır.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Yazdırılacak içerik başlangıcı */}
            <div id="kidem-print" className="space-y-6">
              {/* Sonuç Kartı */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Kıdem Tazminatı Hesaplaması</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Detaylı hesaplama sonuçları</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{fmt(kidemHesaplama.kullanilacakBrut)}₺ × {yil} yıl</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(kidemHesaplama.yilTutar)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{fmt(kidemHesaplama.kullanilacakBrut)}₺ / 12 × {ay} ay</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(kidemHesaplama.ayTutar)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{fmt(kidemHesaplama.kullanilacakBrut)}₺ / 360 × {gun} gün</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(kidemHesaplama.gunTutar)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Toplam Kıdem Tazminatı</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmtCurrency(kidemHesaplama.toplamTutar)}</span>
                  </div>
                </div>
              </div>

              {/* Brüt'ten Net'e Çeviri */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-yellow-100 dark:border-yellow-800/50">
                <h3 className="text-base font-bold text-yellow-900 dark:text-yellow-200 mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">₺</span>
                  Brüt'ten Net'e Çeviri
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-yellow-100 dark:border-gray-600">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Brüt Kıdem Tazminatı</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(brutTazminat)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-yellow-100 dark:border-gray-600 text-red-600 dark:text-red-400">
                    <span className="text-sm">Damga Vergisi (Binde 7,59)</span>
                    <span className="font-semibold">-{fmtCurrency(damgaVergisi)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-base font-semibold text-green-700 dark:text-green-400">Net Kıdem Tazminatı</span>
                    <span className="text-lg font-bold text-green-700 dark:text-green-400">{fmtCurrency(netTazminat)}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Yazdırılacak içerik sonu */}

            <NoteCard />
              </div>
            </div>
            
            <EklentiModal 
              key={modalTitle} 
              open={modalOpen} 
              onClose={() => setModalOpen(false)} 
              title={modalTitle}
              onApply={handleApplyEklenti}
            />

            {/* Kaydet Modal */}
            {showSaveModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ekstra Hesaplamaları Kaydet</h3>
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Set adı girin"
                    className={`${inputClass} mb-4`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveExtra();
                      if (e.key === "Escape") { setShowSaveModal(false); setSaveName(""); }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowSaveModal(false); setSaveName(""); }} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:border-blue-400 transition-all">İptal</button>
                    <button onClick={handleSaveExtra} className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all">Kaydet</button>
                  </div>
                </div>
              </div>
            )}

            {/* İçe Aktar Modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Kaydedilmiş Setleri İçe Aktar</h3>
                  {savedSets.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Henüz kaydedilmiş set bulunmuyor</p>
                  ) : (
                    <div className="space-y-2">
                      {savedSets.map((set) => (
                        <div key={set.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{set.name}</div>
                            <div className="text-xs text-gray-500">{set.data.length} kalem • {new Date(set.createdAt).toLocaleDateString("tr-TR")}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleImportExtra(set.name)} className="p-2 rounded-full border border-gray-200 hover:border-blue-400 transition-all" aria-label="İçe aktar">
                              <Download className="w-4 h-4 text-gray-600" />
                            </button>
                            <button onClick={() => handleDeleteExtra(set.id)} className="p-2 rounded-full border border-gray-200 hover:border-red-400 text-red-600 transition-all" aria-label="Sil">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => setShowImportModal(false)} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:border-blue-400 transition-all">Kapat</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rapor içeriği yazdırma için her zaman DOM'da (gizli); modal sadece önizleme için */}
      {USE_NEW_KIDEM_MEVSIMLIK_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={kidemMevsimlikReportConfig} />
        </div>
      )}
      {USE_NEW_KIDEM_MEVSIMLIK_REPORT && (
        <BaseReportModal
          open={showNewMevsimlikReportModal}
          onClose={() => setShowNewMevsimlikReportModal(false)}
          config={kidemMevsimlikReportConfig}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveRecord}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          copyTargetId: "kidem-mevsimlik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kidem-mevsimlik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #kidem-mevsimlik-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="kidem-mevsimlik-word-copy">
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
              <div style={{ display: "none" }}>
                <ReportContentFromConfig config={kidemMevsimlikReportConfig} />
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PRINT_TITLE, "report-content"),
        }}
      />

      {/* Kaydet Modal */}
      <KaydetModal
        open={isModalOpen}
        onClose={kaydetKapat}
        onSave={handleSave}
        isSaving={isSaving}
        defaultName={currentOptions?.mevcutKayitAdi || ""}
      />

      <Toaster />
    </ToastProvider>
  );
}
