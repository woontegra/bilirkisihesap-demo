import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./toast";
import ToplamHesaplama from "./localComponents/ToplamHesaplama";
import NoteCard from "./localComponents/NoteCard";
import EklentiModal from "./localComponents/EklentiModal";
import FooterActions from "@/components/FooterActions";
import { useKaydetContext, KaydetProvider } from "./localKaydet/KaydetProvider";
import { AlertTriangle, Trash2, Save, Download, Youtube, Copy } from "lucide-react";

// Bolt tasarım stilleri – Gemi/Mevsimlik ile aynı
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";
const btnImport = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2";
const btnSave = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnEklenti = "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500";
import { getVideoLink } from "./localConfig/videoLinks";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./localUtils/extraCalculationsStorage";
import { calculateIncomeTaxForYear } from "./localUtils/incomeTaxCore";
import { differenceInYears, differenceInMonths, differenceInDays } from "date-fns";
import { API_BASE_URL } from "./localConstants/apiBaseUrl";
import { asgariUcretler } from "./localConstants/asgariUcretler";
import { findKidemTavan } from "./localUtils/findKidemTavan";
// Constants - inline
const NET_REDUCTION_FACTOR = 0.85;
const RECORD_TYPE = "kidem_basin";
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const REDIRECT_BASE_PATH = "/kidem-tazminati/basin";
const PRINT_TITLE = "Kıdem Tazminatı - Basın İş";
const PRINT_HEADING = "BASIN İŞ KIDEM TAZMİNATI";

// Helper functions - inline
const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (n: number | undefined) => `${fmt(n ?? 0)}₺`;

// getAsgariUcret - inline
const getAsgariUcret = (date: Date) => {
  const found = asgariUcretler.find(a => {
    const start = new Date(a.start);
    const end = new Date(a.end);
    return date >= start && date <= end;
  });
  return found ? found.brut : null;
};

import "./localStyles/soft-glow.css";
import { parseMoney } from "./localUtils/parseMoney";
import KidemTazminatiReportModal, {
  buildKidemReportData,
  computeToplamBrutFromTotals,
  formatCalismaSuresi,
} from "./localComponents/KidemTazminatiReportModal";

// YENİ RAPOR SİSTEMİ – 16cm sabit genişlik (Word’e yapıştırmada taşmaz)
import { BaseReportModal, ReportContentFromConfig, type ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_KIDEM_BASIN_REPORT = true;

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
      name: data.name || data.notes || data.aciklama || "" // Mevcut kaydın ismi
    };
  } catch (err: any) {
    console.error('Kayıt yükleme hatası:', err);
    throw err;
  }
};

function KidemBasinIndependentInner() {
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
  
  const [totals, setTotals] = useState({
    toplam: 0,
    yil: 0,
    ay: 0,
    gun: 0
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tavanUygulandi, setTavanUygulandi] = useState<boolean>(false);
  const [tavanDegeri, setTavanDegeri] = useState<number | null>(null);
  
  const [formValues, setFormValues] = useState({
    brutUcret: '',
    prim: '',
    ikramiye: '',
    yol: '',
    yemek: '',
    diger: '',
    startDate: '',
    endDate: '',
    exitDate: '',
    isIhbar: false,
    ihbarTarihi: '',
    ihbarSuresi: '14',
    isKidemTavan: false,
    denemeSuresiGun: '',
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
    isDamgaVergisiMatrahiTutariTutariTutariTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutariTutariTutari: false,
  });
  
  // Extras (ek alanlar) state
  type ExtraItem = { id: string; label: string; value: string };
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  
  // Modal state management
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>('');
  
  // Mesleğe başlangıç tarihi state'i
  const [meslegeBaslangic, setMeslegeBaslangic] = useState<string>('');
  
  // Kıdem süresi ve çalışma süresi state'leri
  const [kidemSuresiState, setKidemSuresiState] = useState<{ yil: number; ay: number; gun: number }>({ yil: 0, ay: 0, gun: 0 });
  const [calismaSuresiState, setCalismaSuresiState] = useState<{ yil: number; ay: number; gun: number }>({ yil: 0, ay: 0, gun: 0 });
  
  // Asgari ücret kontrolü için state
  const [asgariHata, setAsgariHata] = useState<string | null>(null);
  
  // Toplam brüt ücret hesaplama (formValues + extras)
  const toplamBrutUcret = useMemo(() => {
    const toNumber = (value: string) =>
      Number.parseFloat(String(value).replace(/\./g, "").replace(",", ".")) || 0;
    
    const formTotal =
      toNumber(formValues.brutUcret) +
      toNumber(formValues.prim) +
      toNumber(formValues.ikramiye) +
      toNumber(formValues.yol) +
      toNumber(formValues.yemek) +
      toNumber(formValues.diger);
    
    const extrasSum = extras.reduce((acc, it) => acc + toNumber(it.value), 0);
    
    return formTotal + extrasSum;
  }, [formValues.brutUcret, formValues.prim, formValues.ikramiye, formValues.yol, formValues.yemek, formValues.diger, extras]);
  
  // Kıdem süresi hesaplama (Mesleğe Başlangıç → İşten Çıkış)
  // Mesleğe başlangıç varsa onu kullan, yoksa işe giriş tarihini kullan
  // Deneme süresi düşümü: Mesleğe başlangıç tarihine deneme süresi gün sayısı eklenir
  useEffect(() => {
    const baslangicTarihi = meslegeBaslangic || formValues.startDate;
    
    if (baslangicTarihi && formValues.endDate) {
      try {
        let start = new Date(baslangicTarihi);
        const end = new Date(formValues.endDate);
        
        // Deneme süresi düşümü: Başlangıç tarihine deneme süresi gün sayısını ekle
        const denemeSuresiGunSayisi = Number(formValues.denemeSuresiGun) || 0;
        if (denemeSuresiGunSayisi > 0) {
          start = new Date(start);
          start.setDate(start.getDate() + denemeSuresiGunSayisi);
        }
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          const yil = differenceInYears(end, start);
          const afterYears = new Date(start);
          afterYears.setFullYear(afterYears.getFullYear() + yil);
          
          const ay = differenceInMonths(end, afterYears);
          const afterMonths = new Date(afterYears);
          afterMonths.setMonth(afterMonths.getMonth() + ay);
          
          const gun = differenceInDays(end, afterMonths);
          
          setKidemSuresiState({ yil, ay, gun });
          // Kıdem tazminatı hesaplama için totals state'ini güncelle - toplamBrutUcret ile senkronize et
          setTotals(prev => ({ ...prev, yil, ay, gun, toplam: toplamBrutUcret }));
        } else {
          setKidemSuresiState({ yil: 0, ay: 0, gun: 0 });
          setTotals({ yil: 0, ay: 0, gun: 0, toplam: 0 });
        }
      } catch {
        setKidemSuresiState({ yil: 0, ay: 0, gun: 0 });
        setTotals({ yil: 0, ay: 0, gun: 0, toplam: 0 });
      }
    } else {
      setKidemSuresiState({ yil: 0, ay: 0, gun: 0 });
      setTotals({ yil: 0, ay: 0, gun: 0, toplam: 0 });
    }
  }, [meslegeBaslangic, formValues.startDate, formValues.endDate, formValues.denemeSuresiGun, toplamBrutUcret]);
  
  // Çalışma süresi hesaplama (İşe Giriş → İşten Çıkış)
  useEffect(() => {
    if (formValues.startDate && formValues.endDate) {
      try {
        const start = new Date(formValues.startDate);
        const end = new Date(formValues.endDate);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          const yil = differenceInYears(end, start);
          const afterYears = new Date(start);
          afterYears.setFullYear(afterYears.getFullYear() + yil);
          
          const ay = differenceInMonths(end, afterYears);
          const afterMonths = new Date(afterYears);
          afterMonths.setMonth(afterMonths.getMonth() + ay);
          
          const gun = differenceInDays(end, afterMonths);
          
          setCalismaSuresiState({ yil, ay, gun });
        } else {
          setCalismaSuresiState({ yil: 0, ay: 0, gun: 0 });
        }
      } catch {
        setCalismaSuresiState({ yil: 0, ay: 0, gun: 0 });
      }
    } else {
      setCalismaSuresiState({ yil: 0, ay: 0, gun: 0 });
    }
  }, [formValues.startDate, formValues.endDate]);
  
  // Eklenti values for each field (12 months each)
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  
  // Apply functions for each field
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  
  // Brüt'ten Net'e çeviri için state
  const [brutTazminat, setBrutTazminat] = useState(0);
  const [netTazminat, setNetTazminat] = useState(0);
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  // Merkezi kayıt sistemi
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    
    let isMounted = true; // Component unmount kontrolü
    
    const fetchData = async () => {
      try {
        const data = await loadCalculation(loadId);
        
        if (!isMounted) return; // Component unmount olduysa işlemi durdur
        
        // Form verilerini map et - hem eski hem yeni formatı destekle
        const formData = data.formValues || {};
        
        // Tarih alanlarını normalize et ve formatla
        const startDateValue = formData.startDate || formData.iseGiris || '';
        const endDateValue = formData.endDate || formData.istenCikis || '';
        const exitDateValue = formData.exitDate || formData.endDate || formData.istenCikis || '';
        const brutUcretValue = formData.brutUcret || formData.brut || '';
        
        const mappedFormValues = {
          ...formData,
          startDate: startDateValue ? new Date(startDateValue).toISOString().split('T')[0] : '',
          endDate: endDateValue ? new Date(endDateValue).toISOString().split('T')[0] : '',
          exitDate: exitDateValue ? new Date(exitDateValue).toISOString().split('T')[0] : '',
          brutUcret: brutUcretValue,
          ihbarTarihi: formData.ihbarTarihi ? new Date(formData.ihbarTarihi).toISOString().split('T')[0] : ''
        };
        
        setFormValues(prev => ({
          ...prev,
          ...mappedFormValues
        }));
        
        // Extras'ı yükle
        if (data.formValues?.extras && Array.isArray(data.formValues.extras)) {
          if (!isMounted) return;
          setExtras(data.formValues.extras);
        } else {
          if (!isMounted) return;
          setExtras([]);
        }
        
        if (!isMounted) return;
        setExitDate(mappedFormValues.exitDate || '');
        setAppliedEklenti(data.appliedEklenti || null);
        
        if (data.totals) {
          if (!isMounted) return;
          setTotals(data.totals);
        }
        
        if (data.brutTazminat !== undefined) {
          if (!isMounted) return;
          setBrutTazminat(data.brutTazminat);
        }
        
        if (data.netTazminat !== undefined) {
          if (!isMounted) return;
          setNetTazminat(data.netTazminat);
        }
        
        // Mesleğe başlangıç tarihini restore et
        if (data.formValues?.meslegeBaslangic) {
          setMeslegeBaslangic(data.formValues.meslegeBaslangic);
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        if (!isMounted) return;
        setCurrentRecordName(data.name || data.notes || null);
        
        if (!isMounted) return;
        success('Kayıt yüklendi');
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError('Kayıt yüklenirken hata oluştu');
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Sadece id değiştiğinde çalışsın
  
  // Extras fonksiyonları
  const addExtra = useCallback(() => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    setExtras(prev => [...prev, { id, label: "", value: "" }]);
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

    if (extras.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const items = extras.map(item => ({ id: item.id, name: item.label, value: item.value }));
    const saveResult = await saveExtraCalculationsSet(saveName.trim(), items);
    if (saveResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtras(data.map(item => ({ id: item.id, label: item.name, value: item.value })));
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
  
  // Form değişikliklerini işle
  const handleFormChange = useCallback((newValues: any) => {
    setFormValues(prev => {
      const updated = { ...prev, ...newValues };
      if (newValues.exitDate) {
        setExitDate(newValues.exitDate);
      }
      return updated;
    });
  }, []);
  
  // Modal functions
  const openModal = (modalName: string) => setActiveModal(modalName);
  const closeModal = () => setActiveModal(null);
  
  // Eklenti isteği (prim / ikramiye / yemek / extra:ID)
  const handleRequestEklenti = useCallback((fieldKey: string, title: string, apply: (v: number) => void) => {
    // Store the apply function for this field
    setApplyFunctions((prev) => ({ ...prev, [fieldKey]: apply }));
    // Initialize months array if not exists
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    // Open the modal
    openModal(fieldKey);
  }, [eklentiValues]);
  
  // Eklenti uygula: hem ilgili input'a yaz, hem de hedef alan bilgisiyle birlikte forma gönder
  const handleApplyEklenti = useCallback((value: number, fieldKey: string) => {
    // Önce, formdan gelen apply fonksiyonunu kullanarak ilgili alanı güncelle
    if (applyFunctions[fieldKey]) {
      applyFunctions[fieldKey](value);
    }

    // Ardından, KidemTazminatiForm içindeki useEffect'in doğru alanı güncellemesi için
    // field + value bilgisiyle birlikte appliedEklenti state'ini güncelle
    setAppliedEklenti({ field: fieldKey, value });

    closeModal();
    success('Eklenti uygulandı');
  }, [applyFunctions, success]);

  // Totals güncelleme (tavan kontrolü yok) - toplamBrutUcret ile senkronize et
  const handleTotalsChange = useCallback((incomingTotals: { toplam: number; yil: number; ay: number; gun: number }) => {
    // toplam değerini toplamBrutUcret ile override et, sadece yil, ay, gun'ı güncelle
    setTotals({ ...incomingTotals, toplam: toplamBrutUcret });
  }, [toplamBrutUcret]);
  
  // Hesaplamaları güncelle (tavan kontrolü yok)
  useEffect(() => {
    // totals.toplam zaten toplamBrutUcret ile senkronize edildi (extras dahil)
    // Direkt totals.toplam kullanarak hesaplama yap
    const toplamBrutKidem = computeToplamBrutFromTotals(totals);
    
    // Tavan kontrolü - AYLIK BRÜT ÜCRET üzerinden yapılmalı (toplam kıdem tazminatı değil!)
    let tavanUygulandiFlag = false;
    let tavanDegeriValue: number | null = null;
    if (exitDate) {
      const tavan = findKidemTavan(new Date(exitDate));
      // Tavan kontrolü: Aylık brüt ücret (toplamBrutUcret) tavanı aşıyor mu?
      if (tavan && toplamBrutUcret > tavan) {
        tavanUygulandiFlag = true;
        tavanDegeriValue = tavan;
      }
    }
    setTavanUygulandi(tavanUygulandiFlag);
    setTavanDegeri(tavanDegeriValue);
    
    // Basit kıdem hesaplama - tavan uygulanmışsa tavan değerini kullan
    let brutTazminatTutari = toplamBrutKidem;
    if (tavanUygulandiFlag && tavanDegeriValue) {
      // Tavan uygulanmışsa, aylık brüt ücret yerine tavan değerini kullanarak hesapla
      const tavanAylikBrut = tavanDegeriValue;
      brutTazminatTutari = 
        (tavanAylikBrut * totals.yil) +
        ((tavanAylikBrut / 12) * totals.ay) +
        ((tavanAylikBrut / 365) * totals.gun);
    }

    const netTazminatTutari = brutTazminatTutari * NET_REDUCTION_FACTOR;

    setBrutTazminat(brutTazminatTutari);
    setNetTazminat(netTazminatTutari);
  }, [formValues, exitDate, totals, toplamBrutUcret]);

  // 5 yıl kontrolü - Basın işçileri için minimum çalışma süresi
  const kidemTazminatiHakkiYok = useMemo(() => {
    // Eğer mesleğe başlangıç tarihi girilmişse → 5 yıl şartı uygulanır
    // Eğer mesleğe başlangıç tarihi girilmemişse → 5 yıl şartı uygulanmaz
    if (meslegeBaslangic && meslegeBaslangic.trim() !== '') {
      // Mesleğe başlangıç tarihi doluysa: 5 yılın altında kıdem tazminatı hakkı yok
      return totals.yil < 5;
    } else {
      // Mesleğe başlangıç tarihi boşsa: 5 yıl şartı yok (her durumda hesaplanır)
      return false;
    }
  }, [totals, meslegeBaslangic]);

  // Hesaplanacak yıl, ay, gün değerleri (6 ay kuralına göre)
  const hesaplanacakDegerler = useMemo(() => {
    if (kidemTazminatiHakkiYok) {
      return { yil: 0, ay: 0, gun: 0 };
    }
    
    let hesaplanacakYil = totals.yil || 0;
    let hesaplanacakAy = totals.ay || 0;
    let hesaplanacakGun = totals.gun || 0;
    
    // 5 yıldan sonra: 6 aydan az ise o yıl hesaplanmaz, 6 ay ve üstü ise hesaplanır
    // Eğer 5 yıl varsa ve ay 6'dan az ise, sadece 5 yıl hesaplanır (ay ve gün hesaplanmaz)
    if (hesaplanacakYil === 5 && hesaplanacakAy < 6) {
      hesaplanacakAy = 0;
      hesaplanacakGun = 0;
    }
    
    return { yil: hesaplanacakYil, ay: hesaplanacakAy, gun: hesaplanacakGun };
  }, [totals, kidemTazminatiHakkiYok]);

  // Hesaplama (6 ay kuralına göre) - deneme süresi artık başlangıç tarihine eklendiği için düşüm yapılmıyor
  // toplamBrutUcret kullan (extras dahil)
  const brutNetDisplay = kidemTazminatiHakkiYok ? 0 : Math.max(0,
    (toplamBrutUcret || 0) * hesaplanacakDegerler.yil +
    ((toplamBrutUcret || 0) / 12) * hesaplanacakDegerler.ay +
    ((toplamBrutUcret || 0) / 365) * hesaplanacakDegerler.gun
  );
  
  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    if (exitDate) {
      const year = new Date(exitDate).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [exitDate]);
  
  // Asgari ücret live validation
  useEffect(() => {
    if (!exitDate || !formValues.brutUcret) {
      setAsgariHata(null);
      return;
    }
    const minUcret = getAsgariUcret(new Date(exitDate));
    // Asgari ücret bulunamazsa validation'ı atla
    if (!minUcret) {
      setAsgariHata(null);
      return;
    }
    const toNumber = (value: string) =>
      Number.parseFloat(String(value).replace(/\./g, "").replace(",", ".")) || 0;
    const brutValue = toNumber(formValues.brutUcret);
    if (!brutValue) {
      setAsgariHata(null);
      return;
    }
    // Sadece asgari ücret varsa ve brüt değer düşükse hata göster
    if (minUcret && brutValue < minUcret) {
      const year = new Date(exitDate).getFullYear();
      const formattedMin = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minUcret);
      setAsgariHata(`Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${formattedMin} ₺).`);
    } else {
      setAsgariHata(null);
    }
  }, [exitDate, formValues.brutUcret]);
  
  // totals.toplam'ı toplamBrutUcret ile senkronize et
  useEffect(() => {
    setTotals(prev => ({ ...prev, toplam: toplamBrutUcret }));
  }, [toplamBrutUcret]);
  
  // Basın işçileri için vergi kuralları:
  // - Damga vergisi: Her halükarda binde 7,59 oranında kesilir
  // - Gelir vergisi: 24 ay kuralına göre uygulanır
  //   Çıplak brüt ücret × 24 = eşik değer
  //   Kıdem tazminatı toplamı > eşik değer → gelir vergisi uygulanır
  //   Kıdem tazminatı toplamı ≤ eşik değer → gelir vergisi uygulanmaz
  const toNumber = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  // KidemTazminatiForm'dan gelen değer 'brut' olarak geliyor (onValuesChange callback'inde)
  // handleFormChange içinde formValues'a merge ediliyor, bu yüzden formValues.brut olarak erişebiliriz
  const formValuesAny = formValues as any;
  const ciplakBrutUcret = useMemo(() => {
    const brutValue = formValuesAny.brut || formValues.brutUcret || '';
    return toNumber(brutValue);
  }, [formValuesAny.brut, formValues.brutUcret]);
  const esikDeger = useMemo(() => ciplakBrutUcret * 24, [ciplakBrutUcret]);
  
  // Damga vergisi: Her halükarda kesilir
  const damgaVergisi = useMemo(() => brutNetDisplay * 0.00759, [brutNetDisplay]);
  
  // Gelir vergisi: 24 ay kuralına göre uygulanır (GVK 25/7)
  // Kıdem tazminatı için brüt tutar (ihbar tazminatı sayfasındaki gibi direkt brüt tutar üzerinden hesaplanır)
  const brutKidemTazminati = brutNetDisplay;
  // 24 aylık muafiyet tutarı
  const muafiyetTutari = esikDeger;
  // Gelir vergisi uygulanacak mı kontrolü: 24 ay kuralı (GVK 25/7)
  const gelirVergisiUygulanacak = useMemo(() => brutKidemTazminati > muafiyetTutari, [brutKidemTazminati, muafiyetTutari]);
  // Gelir vergisi hesaplama: Kıdem tazminatında vergi matrahı, brüt kıdem tazminatının 24 aylık muafiyet tutarını aşan kısmıdır
  const gelirVergisi = useMemo(() => {
    if (!gelirVergisiUygulanacak) return 0;

    // 24 aylık istisnayı uygula
    const vergiMatrahi = Math.max(0, brutKidemTazminati - muafiyetTutari);

    // Sadece aşan kısım gelir vergisine tabi
    return calculateIncomeTaxForYear(selectedYear, vergiMatrahi);
  }, [gelirVergisiUygulanacak, selectedYear, brutKidemTazminati, muafiyetTutari]);
  
  const netDisplay = useMemo(() => brutNetDisplay - damgaVergisi - gelirVergisi, [brutNetDisplay, damgaVergisi, gelirVergisi]);
  
  // Report data hazırla
  const calismaSuresiLabel = formatCalismaSuresi(totals);
  const reportData = useMemo(() => {
    return buildKidemReportData({
      formValues,
      calismaSuresi: calismaSuresiLabel,
      toplamBrut: brutNetDisplay,
      netTazminat: netDisplay,
      totals,
      damgaVergisi,
      gelirVergisi,
      muafiyetTutari: gelirVergisiUygulanacak ? muafiyetTutari : undefined,
      gelirVergisiUygulanacak,
    });
  }, [
    formValues,
    calismaSuresiLabel,
    brutNetDisplay,
    netDisplay,
    totals,
    damgaVergisi,
    gelirVergisi,
    muafiyetTutari,
    gelirVergisiUygulanacak,
  ]);

  // YENİ RAPOR SİSTEMİ: State
  const [showNewBasinReportModal, setShowNewBasinReportModal] = useState(false);

  // YENİ RAPOR SİSTEMİ: Config
  const kidemBasinReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLocalCurrency = (n: number) => `${fmtLocal(n)}₺`;
    
    // Aylık brüt ücret - tavan uygulanmışsa tavan değerini kullan, değilse toplamBrutUcret
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : toplamBrutUcret;
    
    const yilTutar = aylikBrutUcret * totals.yil;
    const ayTutar = (aylikBrutUcret / 12) * totals.ay;
    const gunTutar = (aylikBrutUcret / 365) * totals.gun;
    const sonuc = yilTutar + ayTutar + gunTutar;

    const grossToNetRows: Array<{
      label: string;
      value: string;
      isDeduction?: boolean;
      isNet?: boolean;
    }> = [
      { label: "Brüt Kıdem Tazminatı", value: fmtLocalCurrency(brutNetDisplay) },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocalCurrency(damgaVergisi)}`, isDeduction: true },
    ];

    if (gelirVergisiUygulanacak) {
      grossToNetRows.push(
        { label: `24 Aylık Muafiyet (${selectedYear})`, value: `-${fmtLocalCurrency(muafiyetTutari)}`, isDeduction: true },
        { label: "Gelir Vergisi", value: `-${fmtLocalCurrency(gelirVergisi)}`, isDeduction: true }
      );
    }

    grossToNetRows.push({ label: "Net Kıdem Tazminatı", value: fmtLocalCurrency(netDisplay), isNet: true });

    return {
      title: "Basın İş Kıdem Tazminatı",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: (formValues.startDate || formValues.iseGiris) ? new Date(formValues.startDate || formValues.iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: (formValues.exitDate || formValues.endDate || formValues.istenCikis) ? new Date(formValues.exitDate || formValues.endDate || formValues.istenCikis).toLocaleDateString("tr-TR") : "-" },
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
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.brutUcret || formValues.brut || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Prim</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.prim || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>İkramiye</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.ikramiye || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yemek</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(formValues.yemek || "0"))}</td>
                </tr>
                {extras.filter((ex) => parseMoney(ex.value || "0") > 0).map((ex) => (
                  <tr key={ex.id}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.label}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(parseMoney(ex.value || "0"))}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Kıdem Tazminatı</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(toplamBrutUcret)}</td>
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
                      {fmtLocal(aylikBrutUcret)} / 365 × {totals.gun} gün
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtLocalCurrency(gunTutar)}
                    </td>
                  </tr>
                  <tr style={{ background: '#eff6ff', fontWeight: 600 }}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      Toplam Kıdem Tazminatı
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
        rows: grossToNetRows,
      },
    };
  }, [formValues, totals, toplamBrutUcret, brutNetDisplay, damgaVergisi, gelirVergisi, gelirVergisiUygulanacak, muafiyetTutari, selectedYear, netDisplay, calismaSuresiLabel, tavanUygulandi, tavanDegeri, extras]);

  // Bölüm bazlı Word tabloları (DavaciUcreti / Kidem30 / KidemGemi / KidemMevsimlik ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : toplamBrutUcret;
    const yilTutar = aylikBrutUcret * totals.yil;
    const ayTutar = (aylikBrutUcret / 12) * totals.ay;
    const gunTutar = (aylikBrutUcret / 365) * totals.gun;
    const sonuc = yilTutar + ayTutar + gunTutar;

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş Tarihi", (formValues.startDate || formValues.iseGiris) ? new Date(formValues.startDate || formValues.iseGiris).toLocaleDateString("tr-TR") : "-"],
        ["İşten Çıkış Tarihi", (formValues.exitDate || formValues.endDate || formValues.istenCikis) ? new Date(formValues.exitDate || formValues.endDate || formValues.istenCikis).toLocaleDateString("tr-TR") : "-"],
        ["Çalışma Süresi", calismaSuresiLabel || "-"],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt Ücret", value: fmtCurrency(parseMoney(formValues.brutUcret || formValues.brut || "0")) },
      { label: "Prim", value: fmtCurrency(parseMoney(formValues.prim || "0")) },
      { label: "İkramiye", value: fmtCurrency(parseMoney(formValues.ikramiye || "0")) },
      { label: "Yemek", value: fmtCurrency(parseMoney(formValues.yemek || "0")) },
    ];
    extras.filter((ex) => parseMoney(ex.value || "0") > 0).forEach((ex) => {
      bilesenData.push({ label: ex.label, value: fmtCurrency(parseMoney(ex.value || "0")) });
    });
    bilesenData.push({ label: "Toplam Kıdem Tazminatı", value: fmtCurrency(toplamBrutUcret) });
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
      { label: `${fmt(aylikBrutUcret)} / 365 × ${totals.gun} gün`, value: fmtCurrency(gunTutar) },
      { label: "Toplam Kıdem Tazminatı", value: fmtCurrency(sonuc) },
    ];
    const n4 = adaptToWordTable(hesapRows);
    sections.push({ id: "kidem-hesap", title: "Kıdem Tazminatı Hesaplama", html: buildWordTable(n4.headers, n4.rows) });

    const grossNetRows = kidemBasinReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n5 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [formValues, extras, totals, toplamBrutUcret, calismaSuresiLabel, tavanUygulandi, tavanDegeri, kidemBasinReportConfig]);

  // Yazdırma: modal açılmadan doğrudan yazdırma penceresi açılır (#report-content gizli div'de)
  const handlePrint = useCallback(() => {
    if (USE_NEW_KIDEM_BASIN_REPORT) {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      const title = kidemBasinReportConfig.title;
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
  }, [kidemBasinReportConfig.title]);
  
  // Kaydetme işlemi – tıklanınca her zaman aynı Kaydet modalı açılır (diğer sayfalarla tutarlı)
  const handleSave = useCallback(() => {
    const iseGiris = formValues.startDate || formValues.iseGiris || null;
    const istenCikis = formValues.exitDate || formValues.endDate || formValues.istenCikis || null;
    
    // Ekranda gösterilen net toplamı kullan (damga vergisi ve gelir vergisi kesintili)
    // netDisplay: ekranda gösterilen net değer (brutNetDisplay - damgaVergisi - gelirVergisi)
    // brutNetDisplay: hesaplanan brüt kıdem tazminatı (ekranda gösterilen)
    
    // Debug: değerleri kontrol et
    console.log('[KidemBasinIndependent] handleSave - brutNetDisplay:', brutNetDisplay);
    console.log('[KidemBasinIndependent] handleSave - netDisplay (ekranda gösterilen):', netDisplay);
    console.log('[KidemBasinIndependent] handleSave - damgaVergisi:', damgaVergisi);
    console.log('[KidemBasinIndependent] handleSave - gelirVergisi:', gelirVergisi);
    
    // Extras'ı form'a ekle
    const formDataWithExtras = {
      ...formValues,
      meslegeBaslangic,
      kidemSuresi: kidemSuresiState,
      calismaSuresi: calismaSuresiState,
      extras: extras || []
    };
    
    kaydetAc({
      hesapTuru: "kidem_basin",
      veri: {
        data: {
          form: formDataWithExtras,
          results: {
            totals,
            brut: brutNetDisplay, // Ekranda gösterilen brüt
            net: netDisplay // Ekranda gösterilen net (damga vergisi ve gelir vergisi kesintili)
          }
        },
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: brutNetDisplay || 0,
        net_total: netDisplay || 0,
        start_date: iseGiris,
        end_date: istenCikis,
        total: brutTazminat || 0,
        meslege_baslangic: meslegeBaslangic,
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `${REDIRECT_BASE_PATH}/:id`,
    });
  }, [formValues, totals, brutNetDisplay, netDisplay, effectiveId, kaydetAc, currentRecordName, extras, meslegeBaslangic, kidemSuresiState, calismaSuresiState]);
  
  // Yeni hesaplama
  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = (formValues.startDate || formValues.iseGiris) && !id;
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
        brutUcret: '', prim: '', ikramiye: '', yol: '', yemek: '', diger: '',
        startDate: '', endDate: '', exitDate: '', isIhbar: false, ihbarTarihi: '', ihbarSuresi: '14',
        isKidemTavan: true, isYabanci: false, isSGK: true, isGelirVergisi: true, isDamgaVergisi: true,
        iseGiris: '', istenCikis: '', brut: '', extras: []
      });
      setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
      setBrutTazminat(0);
      setNetTazminat(0);
      setExitDate('');
      setAppliedEklenti(undefined);
      setExtras([]); // Ek hesaplamaları temizle
      setCurrentRecordName(null); // Mevcut kayıt adını temizle
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id]);
  
  // Header butonları kaldırıldı

  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialBrut = useMemo(() => formValues.brutUcret || formValues.brut || "", [formValues.brutUcret, formValues.brut]);
  const memoizedInitialIseGiris = useMemo(() => formValues.startDate || formValues.iseGiris || "", [formValues.startDate, formValues.iseGiris]);
  const memoizedInitialIstenCikis = useMemo(() => formValues.exitDate || formValues.endDate || formValues.istenCikis || "", [formValues.exitDate, formValues.endDate, formValues.istenCikis]);
  const memoizedInitialPrim = useMemo(() => formValues.prim || "", [formValues.prim]);
  const memoizedInitialIkramiye = useMemo(() => formValues.ikramiye || "", [formValues.ikramiye]);

  return (
    <div>
      <div style={{ height: "4px", background: "#1E88E5" }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "80px" }}>
          {/* Header */}
          <div className="mb-8 flex justify-end">
            <div className="flex items-center gap-2">
              {getVideoLink("kidem-basin") && (
                <button
                  onClick={() => window.open(getVideoLink("kidem-basin"), "_blank")}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600 dark:hover:bg-gray-700 transition-all"
                >
                  <Youtube className="h-4 w-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>
          </div>

          {/* Ana Kart */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div id="kidem-print" className="p-8 space-y-6">
              {/* Tarih ve Süre Bilgileri */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="meslege-baslangic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mesleğe Başlangıç Tarihi</label>
                    <input id="meslege-baslangic" type="date" value={meslegeBaslangic} onChange={(e) => setMeslegeBaslangic(e.target.value)} max="9999-12-31" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="ise-giris" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İşe Giriş Tarihi</label>
                    <input id="ise-giris" type="date" value={formValues.startDate} onChange={(e) => { const v = e.target.value; setFormValues(prev => ({ ...prev, startDate: v })); }} max="9999-12-31" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="isten-cikis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İşten Çıkış Tarihi</label>
                    <input id="isten-cikis" type="date" value={formValues.endDate} onChange={(e) => { const v = e.target.value; setFormValues(prev => ({ ...prev, endDate: v })); setExitDate(v); }} max="9999-12-31" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kıdem Süresi</label>
                    <input type="text" value={`${kidemSuresiState.yil} yıl ${kidemSuresiState.ay} ay ${kidemSuresiState.gun} gün`} readOnly className={`${inputClass} bg-gray-50 dark:bg-gray-600`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Mesleğe Başlangıç&apos;tan İşten Çıkış&apos;a kadar</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Çalışma Süresi</label>
                    <input type="text" value={`${calismaSuresiState.yil} yıl ${calismaSuresiState.ay} ay ${calismaSuresiState.gun} gün`} readOnly className={`${inputClass} bg-gray-50 dark:bg-gray-600`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">İşe Giriş&apos;ten İşten Çıkış&apos;a kadar</p>
                  </div>
                </div>
              </div>

              {/* Çıplak Brüt Ücret */}
              <div>
                <label htmlFor="brut-ucret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Çıplak Brüt Ücret <span className="text-red-500">*</span></label>
                <input id="brut-ucret" type="text" value={formValues.brutUcret} onChange={(e) => setFormValues(prev => ({ ...prev, brutUcret: e.target.value }))} placeholder="Örn: 30000" className={inputClass} />
                {asgariHata && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{asgariHata}</p>}
              </div>

              {/* Ekstra Hesaplamalar - Davacı/Gemi düzeni */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">₺</div>
                    Ekstra Hesaplamalar
                  </h2>
                  <div className="flex gap-3">
                    <button onClick={() => { getAllExtraCalculationsSets().then(sets => { setSavedSets(sets); setShowImportModal(true); }); }} className={btnImport}>
                      <Download className="w-4 h-4" />
                      İçe Aktar
                    </button>
                    <button onClick={() => setShowSaveModal(true)} disabled={!(extras.length > 0 || (formValues.prim || '').trim() || (formValues.ikramiye || '').trim() || (formValues.yol || '').trim() || (formValues.yemek || '').trim() || (formValues.diger || '').trim())} className={btnSave}>
                      <Save className="w-4 h-4" />
                      Kaydet
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">Prim, İkramiye, Yol, Yemek vb.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={formValues.prim} onChange={(e) => setFormValues(prev => ({ ...prev, prim: e.target.value }))} placeholder="Örn: 2.500,00" className={inputClass} />
                      <button type="button" onClick={() => handleRequestEklenti('prim', 'Prim Eklenti', (v) => setFormValues(prev => ({ ...prev, prim: fmt(v) })))} className={btnEklenti}>Eklenti Hesapla</button>
                    </div>
                    <button type="button" onClick={() => setFormValues(prev => ({ ...prev, prim: '' }))} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={formValues.ikramiye} onChange={(e) => setFormValues(prev => ({ ...prev, ikramiye: e.target.value }))} placeholder="Örn: 1.000,00" className={inputClass} />
                      <button type="button" onClick={() => handleRequestEklenti('ikramiye', 'İkramiye Eklenti', (v) => setFormValues(prev => ({ ...prev, ikramiye: fmt(v) })))} className={btnEklenti}>Eklenti Hesapla</button>
                    </div>
                    <button type="button" onClick={() => setFormValues(prev => ({ ...prev, ikramiye: '' }))} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input disabled value="Yol" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={formValues.yol} onChange={(e) => setFormValues(prev => ({ ...prev, yol: e.target.value }))} placeholder="Örn: 500,00" className={inputClass} />
                      <button type="button" onClick={() => handleRequestEklenti('yol', 'Yol Eklenti', (v) => setFormValues(prev => ({ ...prev, yol: fmt(v) })))} className={btnEklenti}>Eklenti Hesapla</button>
                    </div>
                    <button type="button" onClick={() => setFormValues(prev => ({ ...prev, yol: '' }))} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={formValues.yemek} onChange={(e) => setFormValues(prev => ({ ...prev, yemek: e.target.value }))} placeholder="Örn: 1.200,00" className={inputClass} />
                      <button type="button" onClick={() => handleRequestEklenti('yemek', 'Yemek Eklenti', (v) => setFormValues(prev => ({ ...prev, yemek: fmt(v) })))} className={btnEklenti}>Eklenti Hesapla</button>
                    </div>
                    <button type="button" onClick={() => setFormValues(prev => ({ ...prev, yemek: '' }))} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input disabled value="Diğer" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={formValues.diger} onChange={(e) => setFormValues(prev => ({ ...prev, diger: e.target.value }))} placeholder="Örn: 200,00" className={inputClass} />
                      <button type="button" onClick={() => handleRequestEklenti('diger', 'Diğer Eklenti', (v) => setFormValues(prev => ({ ...prev, diger: fmt(v) })))} className={btnEklenti}>Eklenti Hesapla</button>
                    </div>
                    <button type="button" onClick={() => setFormValues(prev => ({ ...prev, diger: '' }))} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {extras.map((it) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <input value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Kalem Adı" />
                      <div className="flex-1 flex items-center gap-2">
                        <input value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className={`${inputClass} flex-1`} placeholder="Tutar" />
                        <button type="button" onClick={() => handleRequestEklenti(`extra:${it.id}`, `${it.label || 'Ek kalem'} için eklenti hesapla`, (v) => setExtra(it.id, { value: fmt(v) }))} className={btnEklenti}>Eklenti Hesapla</button>
                      </div>
                      <button type="button" onClick={() => removeExtra(it.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Satırı Sil"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addExtra} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium px-4 py-2.5 rounded-full border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500">+ Ekle</button>
                </div>
              </div>

              {/* Toplam */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Toplam</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtCurrency(toplamBrutUcret)}</span>
                </div>
              </div>
              {/* Deneme Süresi Düşümü */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-700">
                <div className="space-y-3">
                  <div>
                    <label htmlFor="deneme-suresi-gun" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deneme Süresi Düşümü (Gün)</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Davalı isterse ilk mesleğe başlangıç tarihinden itibaren deneme süresi uygulanır ve kıdem tazminatından düşülür. En fazla 90 gün (3 ay) düşüm yapılabilir.</p>
                    <div className="flex items-center gap-2">
                      <input id="deneme-suresi-gun" type="number" min="0" max="90" value={formValues.denemeSuresiGun || ''} onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 0 && Number(v) <= 90)) setFormValues(prev => ({ ...prev, denemeSuresiGun: v })); }} placeholder="0-90 gün arası" className="w-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">gün (max 90)</span>
                    </div>
                  </div>
                  {Number(formValues.denemeSuresiGun) > 0 && (
                    <div className="mt-2 p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-700">Deneme süresi ({Number(formValues.denemeSuresiGun) || 0} gün) mesleğe ilk giriş tarihine eklendi. Çalışma süresi bu tarihe göre hesaplanmaktadır.</div>
                  )}
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                  {warnings.map((w, i) => (<div key={i}>{w}</div>))}
                </div>
              )}

              {kidemTazminatiHakkiYok && (
                <div className="rounded-xl border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">Kıdem Tazminatı Hakkı Uyarısı</p>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">İlk kez kıdem tazminatı alacaklar için 5 yılın altında çalışma süresine sahip olanlara kıdem tazminatı hakkı doğmaz. Toplam çalışma süreniz 5 yılın altında olduğu için kıdem tazminatı hesaplanamaz.</p>
                    </div>
                  </div>
                </div>
              )}

              <ToplamHesaplama
                  toplam={toplamBrutUcret} 
                  yil={hesaplanacakDegerler.yil} 
                  ay={hesaplanacakDegerler.ay} 
                  gun={hesaplanacakDegerler.gun} 
                  onPrint={handlePrint}
                  warnings={warnings}
                  customFormatter={fmt}
                />
                
              {!kidemTazminatiHakkiYok && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-yellow-100 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center text-white text-sm">₺</div>
                      Brüt&apos;ten Net&apos;e Çeviri
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      {gelirVergisiUygulanacak
                        ? `Brüt tutardan binde 7,59 oranında damga vergisi ve gelir vergisi kesintisi yapılmıştır. (Kıdem tazminatı toplamı (${fmtCurrency(brutNetDisplay)}), çıplak brüt ücretin 24 katından (${fmtCurrency(esikDeger)}) fazla olduğu için gelir vergisi uygulanmıştır.)`
                        : `193 sayılı Gelir Vergisi Kanunun 25/7. maddesine göre kıdem tazminatının 24 aylığı aşmayan tutarı için gelir vergisi uygulanmamalıdır. Kıdem tazminatı toplamı (${fmtCurrency(brutNetDisplay)}), çıplak brüt ücretin 24 katından (${fmtCurrency(esikDeger)}) fazla olmadığı için gelir vergisi uygulanmamıştır. Damga vergisi her halükarda binde 7,59 oranında kesilmiştir.`
                      }
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-yellow-100 dark:border-gray-600">
                        <span className="text-gray-700 dark:text-gray-300">Brüt Kıdem Tazminatı</span>
                        <span className="font-semibold dark:text-amber-200">{fmtCurrency(brutNetDisplay)}</span>
                      </div>
                      {gelirVergisiUygulanacak && (
                        <div className="flex justify-between py-2 border-b border-yellow-100 dark:border-gray-600 text-red-600 dark:text-red-400">
                          <span>Gelir Vergisi (%15, %20, %27, %35, %40)</span>
                          <span>-{fmtCurrency(gelirVergisi)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-yellow-100 dark:border-gray-600 text-red-600 dark:text-red-400">
                        <span>Damga Vergisi (Binde 7,59)</span>
                        <span>-{fmtCurrency(damgaVergisi)}</span>
                      </div>
                      <div className="flex justify-between pt-3">
                        <span className="font-bold text-green-700 dark:text-green-400">Net Kıdem Tazminatı</span>
                        <span className="font-bold text-green-700 dark:text-green-400 text-lg">{fmtCurrency(netDisplay)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-slate-200 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Taksitlendirme</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">5953 Sayılı Basın Mesleğinde Çalışanlarla Çalıştıranlar Arasındaki Münasebetlerin Tanzimi Hakkında Kanun Madde 6&apos;ya göre: İşverenin maddi imkânsızlık sebebiyle gazetecinin tazminatını bir defada ödeyememesi halinde, tediye en çok dört taksitte yapılır ve bu taksitlerin tamamının süresi bir yılı geçemez.</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                        <span className="text-gray-600 dark:text-gray-400">Brüt Kıdem Tazminatı</span>
                        <span className="font-semibold dark:text-gray-100">{fmtCurrency(brutNetDisplay)}</span>
                      </div>
                      {[1, 2, 3, 4].map((taksitNo) => {
                        const taksitTutari = brutNetDisplay / 4;
                        return (
                          <div key={taksitNo} className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                            <span className="text-gray-600 dark:text-gray-400">{taksitNo}. Taksit</span>
                            <span className="font-semibold dark:text-gray-100">{fmtCurrency(taksitTutari)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between pt-3">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Toplam</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{fmtCurrency(brutNetDisplay)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {exitDate && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Çıkış Tarihi:</span> {new Date(exitDate).toLocaleDateString('tr-TR')} tarihinde işten ayrılan bir çalışanın hesaplaması yapılıyor.
                  </p>
                </div>
              )}

              <NoteCard />
            
            {/* Eklenti Modal - tüm alanlar için (prim/ikramiye/yemek + extra:ID) */}
            {activeModal && (
              <EklentiModal
                open={true}
                title={
                  activeModal === "prim"
                    ? "Prim Hesaplama"
                    : activeModal === "ikramiye"
                    ? "İkramiye Hesaplama"
                    : activeModal === "yol"
                    ? "Yol Hesaplama"
                    : activeModal === "yemek"
                    ? "Yemek Hesaplama"
                    : activeModal === "diger"
                    ? "Diğer Hesaplama"
                    : "Eklenti Hesaplama"
                }
                onClose={closeModal}
                months={eklentiValues[activeModal]}
                onMonthsChange={(i, val) => {
                  setEklentiValues((prev) => {
                    const arr = [...(prev[activeModal] || Array(12).fill(""))];
                    arr[i] = val;
                    return { ...prev, [activeModal]: arr };
                  });
                }}
                onApply={(v) => handleApplyEklenti(v, activeModal)}
              />
            )}

            </div>
          </div>
        </div>
      </div>

      {/* Kaydet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Ekstra Hesaplamaları Kaydet</h3>
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
              <button type="button" onClick={() => { setShowSaveModal(false); setSaveName(""); }} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all">İptal</button>
              <button type="button" onClick={handleSaveExtra} className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* İçe Aktar Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Kaydedilmiş Setleri İçe Aktar</h3>
            {savedSets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Henüz kaydedilmiş set bulunmuyor</p>
            ) : (
              <div className="space-y-2">
                {savedSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{set.data.length} kalem • {new Date(set.createdAt).toLocaleDateString("tr-TR")}</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleImportExtra(set.name)} className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300"><Download className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleDeleteExtra(set.id)} className="p-2 rounded-full border border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-500 text-red-600 dark:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Rapor içeriği yazdırma için her zaman DOM'da (gizli); modal sadece önizleme için */}
      {USE_NEW_KIDEM_BASIN_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={kidemBasinReportConfig} />
        </div>
      )}
      {USE_NEW_KIDEM_BASIN_REPORT && (
        <BaseReportModal
          open={showNewBasinReportModal}
          onClose={() => setShowNewBasinReportModal(false)}
          config={kidemBasinReportConfig}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          copyTargetId: "kidem-basin-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kidem-basin-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #kidem-basin-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="kidem-basin-word-copy">
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
                <ReportContentFromConfig config={kidemBasinReportConfig} />
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PRINT_TITLE, "report-content"),
        }}
      />
    </div>
  );
}

export default function KidemBasinIndependent() {
  return (
    <ToastProvider>
      <KaydetProvider>
        <KidemBasinIndependentInner />
        <Toaster />
      </KaydetProvider>
    </ToastProvider>
  );
}
