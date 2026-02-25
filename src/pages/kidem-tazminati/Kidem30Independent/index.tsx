import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./toast";
import { safeNumber, safeCurrency, safeDays } from "./utils";
import KidemTazminatiForm from "./KidemTazminatiForm";
import ToplamHesaplama from "./ToplamHesaplama";
import NoteCard from "./NoteCard";
import EklentiModal from "./EklentiModal";
import { saveCalculation } from "./save";
import { usePageStyle } from "./localHooks/usePageStyle";
import {
  buildKidemReportData,
  formatCalismaSuresi,
} from "./reportUtils";
import { AlertTriangle, Plus, Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "./localConfig/videoLinks";
import Kidem30ReportModal from "./Kidem30ReportModal";
import { BaseReportModal, ReportContentFromConfig, type ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
const USE_NEW_KIDEM30_REPORT = true; // Dönemsel ile aynı sürüklenebilir modal
// Constants
const RECORD_TYPE = "kidem_30isci";
const REDIRECT_BASE_PATH = "/kidem-tazminati/30isci";
const PRINT_TITLE = "Kıdem Tazminatı - İş Kanununa Göre";
const PRINT_HEADING = "30 İŞÇİDEN FAZLA İŞYERİ KIDEM TAZMİNATI";

// API
import { loadCalculation as loadCalculationAPI } from "./api";
import type { LoadCalculationRequest } from "./contract";

// State, actions, calculations
import { useKidem30State } from "./state";
import {
  handleCalculateKullanilacakBrutUcret,
  handleCalculateTavanBilgisi,
  handleCalculateKidemTazminati,
  handleCalculateDamgaVergisi,
  handleCalculateNetDisplay,
  handleCheckKidemTazminatiHakki,
} from "./actions";
import { fmt, fmtCurrency } from "./calculations";
import { parseMoney } from "./utils";

// Tarih normalizasyon fonksiyonu: gg.aa.yyyy formatını yyyy-mm-dd formatına çevir
// Sadece tam tarih formatında (gg.aa.yyyy veya yyyy-mm-dd) normalize eder
// Kullanıcı yazarken (eksik tarih formatında) normalize etmez - döngüyü önlemek için
const normalizeDate = (value: string): string => {
  if (!value) return "";
  
  // Eğer zaten yyyy-mm-dd formatındaysa, direkt döndür
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // Eğer gg.aa.yyyy formatındaysa, normalize et
  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 3) {
      const [gun, ay, yil] = parts;
      // Tüm parçaların dolu olduğundan emin ol (tam tarih formatı)
      if (gun && ay && yil && gun.length > 0 && ay.length > 0 && yil.length === 4) {
        // Ay ve günü 2 haneli yap
        const normalizedAy = ay.padStart(2, "0");
        const normalizedGun = gun.padStart(2, "0");
        return `${yil}-${normalizedAy}-${normalizedGun}`;
      }
    }
  }
  
  // Tam tarih formatı değilse, olduğu gibi döndür (kullanıcı yazarken)
  return value;
};

// Yüklenen veriyi normalize eden fonksiyon (ESKİ ve YENİ format desteği)
function normalizeLoaded(payload: any) {
  // Yeni format
  if (payload.data) {
    return {
      form: payload.data.form || {},
      totals: payload.data.results?.totals || {},
      brut: payload.data.results?.brut || 0,
      net: payload.data.results?.net || 0,
      notes: payload.data.notes || ""
    };
  }

  // Eski format
  return {
    form: payload.formValues || {},
    totals: payload.totals || {},
    brut: payload.brutTazminat || 0,
    net: payload.netTazminat || 0,
    notes: payload.notes || ""
  };
}

// API servis fonksiyonları (api.ts'den import ediliyor)
const loadCalculation = async (id: string) => {
  return await loadCalculationAPI({ loadId: id });
};

function Kidem30IndependentContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { success: toastSuccess, error: toastError } = useToast();
  const pageStyle = usePageStyle();
  
  // Query parametrelerinden caseId'yi de kontrol et (EditCalculation'dan gelen yönlendirme için)
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const loadedIdRef = useRef<string | null>(null); // Son yüklenen ID'yi tut
  // State
  const {
    totals,
    setTotals,
    formValues,
    setFormValues,
    activeModal,
    setActiveModal,
    appliedEklenti,
    setAppliedEklenti,
    currentRecordName,
    setCurrentRecordName,
    exitDate,
    setExitDate,
    matchedTavanState,
    setMatchedTavanState,
    tavanUygulandi,
    setTavanUygulandi,
    tavanDegeri,
    setTavanDegeri,
    eklentiValues,
    setEklentiValues,
    applyFunctions,
    setApplyFunctions,
    brutTazminat,
    setBrutTazminat,
    netTazminat,
    setNetTazminat,
    warnings,
    setWarnings,
    isLoading,
    setIsLoading,
    showReportModal,
    setShowReportModal,
    showNewKidem30ReportModal,
    setShowNewKidem30ReportModal,
  } = useKidem30State();

  // Tavan kontrolü ile totals güncelleme
  const handleTotalsChange = useCallback((incomingTotals: { toplam: number; yil: number; ay: number; gun: number }) => {
    setTotals(incomingTotals);
    // Tavan kontrolü ve warnings, useEffect içinde tavanBilgisi ile yapılıyor
  }, []);

  
  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    console.log('[Kidem30Independent] useEffect triggered, effectiveId:', effectiveId, 'id:', id);
    const loadId = effectiveId;
    
    // ID yoksa veya daha önce bu ID yüklenmişse skip et
    if (!loadId) {
      console.log('[Kidem30Independent] No loadId, skipping load');
      setIsLoading(false);
      return;
    }
    
    // Aynı ID'yi tekrar yükleme (sonsuz döngüyü önle)
    if (loadedIdRef.current === loadId) {
      console.log('[Kidem30Independent] ID already loaded, skipping:', loadId);
      return;
    }
    
    let isMounted = true; // Component unmount kontrolü
    
    const fetchData = async () => {
      try {
        console.log('[Kidem30Independent] Starting load for ID:', loadId);
        setIsLoading(true);
        loadedIdRef.current = loadId; // ID'yi işaretle
        
        const loadedData = await loadCalculation(loadId);
        console.log('[Kidem30Independent] Loaded data:', loadedData);
        
        if (!isMounted) {
          console.log('[Kidem30Independent] Component unmounted, aborting');
          return;
        }
        
        // data kontrolü
        if (!loadedData) {
          console.warn('[Kidem30Independent] No data loaded');
          toastError('Kayıt verisi bulunamadı');
          setIsLoading(false);
          loadedIdRef.current = null; // Başarısız olursa tekrar deneyebilsin
          return;
        }
        
        // Form değerlerini set et
        if (loadedData.formValues) {
          console.log('[Kidem30Independent] Setting formValues:', loadedData.formValues);
          setFormValues(loadedData.formValues);
        }
        
        // Totals'ı set et
        if (loadedData.totals) {
          console.log('[Kidem30Independent] Setting totals:', loadedData.totals);
          setTotals(loadedData.totals);
        }
        
        // Brüt ve net tazminatı set et
        if (loadedData.brutTazminat !== undefined) {
          console.log('[Kidem30Independent] Setting brutTazminat:', loadedData.brutTazminat);
          setBrutTazminat(loadedData.brutTazminat);
        }
        
        if (loadedData.netTazminat !== undefined) {
          console.log('[Kidem30Independent] Setting netTazminat:', loadedData.netTazminat);
          setNetTazminat(loadedData.netTazminat);
        }
        
        // Eklenti bilgisini de yükle
        if (loadedData.appliedEklenti) {
          console.log('[Kidem30Independent] Setting appliedEklenti:', loadedData.appliedEklenti);
          setAppliedEklenti(loadedData.appliedEklenti);
        }
        
        // Kayıt adını da set et (güncelleme için gerekli)
        if (loadedData.name) {
          console.log('[Kidem30Independent] Setting currentRecordName:', loadedData.name);
          setCurrentRecordName(loadedData.name);
        }
        console.log('[Kidem30Independent] Load complete');
        setIsLoading(false);
        toastSuccess('Kayıt yüklendi');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[Kidem30Independent] Load error:', err);
        setIsLoading(false);
        loadedIdRef.current = null; // Hata durumunda tekrar deneyebilsin
        toastError(`Kayıt yüklenirken hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      console.log('[Kidem30Independent] Cleanup, unmounting');
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]); // Sadece effectiveId değişince çalışsın

  // Form değişikliklerini işle
  const handleFormChange = useCallback((newValues: any) => {
    setFormValues(prev => {
      // Extras array'ini karşılaştır (referans eşitliği yerine içerik kontrolü)
      const extrasChanged = newValues.extras !== undefined && 
        (JSON.stringify(newValues.extras) !== JSON.stringify(prev.extras || []));
      
      // Tarih değerlerini normalize et (sadece tam tarih formatında)
      // Eğer tarih tam formatında değilse (kullanıcı yazarken), normalize etme ve karşılaştırma yapma
      const isIseGirisComplete = newValues.iseGiris !== undefined && 
        (/^\d{4}-\d{2}-\d{2}$/.test(newValues.iseGiris) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(newValues.iseGiris));
      const isIstenCikisComplete = newValues.istenCikis !== undefined && 
        (/^\d{4}-\d{2}-\d{2}$/.test(newValues.istenCikis) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(newValues.istenCikis));
      
      const normalizedIseGiris = isIseGirisComplete && newValues.iseGiris !== undefined ? normalizeDate(newValues.iseGiris) : undefined;
      const normalizedIstenCikis = isIstenCikisComplete && newValues.istenCikis !== undefined ? normalizeDate(newValues.istenCikis) : undefined;
      
      // Değerler gerçekten değişti mi kontrol et
      // Sadece tam tarih formatında karşılaştırma yap (kullanıcı yazarken döngüyü önlemek için)
      const iseGirisChanged = normalizedIseGiris !== undefined && 
        (normalizedIseGiris !== prev.startDate && normalizedIseGiris !== prev.iseGiris);
      const istenCikisChanged = normalizedIstenCikis !== undefined && 
        (normalizedIstenCikis !== prev.endDate && normalizedIstenCikis !== prev.istenCikis);
      
      // Eğer tarih tam formatında değilse, sadece orijinal değeri karşılaştır (döngüyü önlemek için)
      const iseGirisPartialChanged = !isIseGirisComplete && newValues.iseGiris !== undefined && 
        newValues.iseGiris !== prev.iseGiris;
      const istenCikisPartialChanged = !isIstenCikisComplete && newValues.istenCikis !== undefined && 
        newValues.istenCikis !== prev.istenCikis;
      
      const hasChanges = 
        iseGirisChanged ||
        istenCikisChanged ||
        iseGirisPartialChanged ||
        istenCikisPartialChanged ||
        (newValues.brut !== undefined && newValues.brut !== prev.brutUcret && newValues.brut !== prev.brut) ||
        (newValues.prim !== undefined && newValues.prim !== prev.prim) ||
        (newValues.ikramiye !== undefined && newValues.ikramiye !== prev.ikramiye) ||
        (newValues.yol !== undefined && newValues.yol !== prev.yol) ||
        (newValues.yemek !== undefined && newValues.yemek !== prev.yemek) ||
        extrasChanged;
      
      // Değişiklik yoksa state güncellemesi yapma
      if (!hasChanges) {
        return prev;
      }
      
      const updated = { ...prev, ...newValues };
      // Extras'ı özellikle ekle (array referansı değişebilir)
      if (newValues.extras !== undefined) {
        updated.extras = newValues.extras;
      }
      // KidemTazminatiForm'dan gelen iseGiris ve istenCikis'i startDate ve endDate'e map et
      // Sadece normalize edilmiş değerleri kullan (tam tarih formatında)
      if (normalizedIseGiris !== undefined) {
        updated.startDate = normalizedIseGiris;
        updated.iseGiris = newValues.iseGiris; // Orijinal değeri de sakla
      } else if (iseGirisPartialChanged) {
        // Tam formatında değilse, sadece orijinal değeri sakla (normalize etme)
        updated.iseGiris = newValues.iseGiris;
      }
      if (normalizedIstenCikis !== undefined) {
        updated.endDate = normalizedIstenCikis;
        updated.exitDate = normalizedIstenCikis;
        updated.istenCikis = newValues.istenCikis; // Orijinal değeri de sakla
        setExitDate(normalizedIstenCikis);
      } else if (istenCikisPartialChanged) {
        // Tam formatında değilse, sadece orijinal değeri sakla (normalize etme)
        updated.istenCikis = newValues.istenCikis;
      }
      if (newValues.exitDate) {
        const normalizedExitDate = normalizeDate(newValues.exitDate);
        if (normalizedExitDate !== newValues.exitDate) {
          // Sadece normalize edilmiş değer farklıysa güncelle
          setExitDate(normalizedExitDate);
        }
      }
      // Ekstra hesaplamalar (prim, ikramiye, yol, yemek) kaydedilsin
      if (newValues.prim !== undefined) updated.prim = newValues.prim;
      if (newValues.ikramiye !== undefined) updated.ikramiye = newValues.ikramiye;
      if (newValues.yol !== undefined) updated.yol = newValues.yol;
      if (newValues.yemek !== undefined) updated.yemek = newValues.yemek;
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
    toastSuccess('Eklenti uygulandı');
  }, [applyFunctions, toastSuccess]);
  
  // exitDate'i formValues'den otomatik al (eğer set edilmemişse)
  const effectiveExitDate = useMemo(() => {
    return exitDate || formValues.exitDate || formValues.endDate || formValues.istenCikis || '';
  }, [exitDate, formValues.exitDate, formValues.endDate, formValues.istenCikis]);

  // Tavan uygulanmış aylık brüt ücreti hesapla (useMemo ile)
  const kullanilacakBrutUcret = useMemo(() => {
    return handleCalculateKullanilacakBrutUcret(formValues, effectiveExitDate);
  }, [formValues, effectiveExitDate]);

  // Tavan uygulandı mı kontrolü
  const tavanBilgisi = useMemo(() => {
    return handleCalculateTavanBilgisi(formValues, effectiveExitDate);
  }, [formValues, effectiveExitDate]);
  
  // Hesaplamaları güncelle
  useEffect(() => {
    const result = handleCalculateKidemTazminati(kullanilacakBrutUcret, totals);
    setBrutTazminat(result.brutTazminat);
    setNetTazminat(result.netTazminat);
    setTavanUygulandi(tavanBilgisi.tavanUygulandiFlag);
    setTavanDegeri(tavanBilgisi.tavanDegeriValue);
    setWarnings(tavanBilgisi.warnings);
  }, [kullanilacakBrutUcret, totals, tavanBilgisi]);

  // 1 yıl kontrolü - Diğer sayfalar için minimum çalışma süresi
  const kidemTazminatiHakkiYok = useMemo(() => {
    return !handleCheckKidemTazminatiHakki(totals);
  }, [totals]);

  // Brüt'ten Net'e çeviri için GERÇEK TOPLAM tutarı kullan (tavan değil)
  // brutTazminat zaten tavan uygulanmış toplam brüt kıdem tazminatı
  const brutNetDisplay = brutTazminat;
  const damgaVergisi = handleCalculateDamgaVergisi(brutNetDisplay);
  const netDisplay = handleCalculateNetDisplay(brutNetDisplay);
  const calismaSuresiLabel = formatCalismaSuresi(totals);
  const reportData = buildKidemReportData({
    formValues,
    calismaSuresi: calismaSuresiLabel,
    toplamBrut: brutNetDisplay,
    netTazminat: netDisplay,
    totals,
    damgaVergisi,
    gelirVergisi: 0, // Kidem 30 İşçi sayfasında gelir vergisi uygulanmıyor
    gelirVergisiUygulanacak: false,
    tavanUygulandi,
    tavanDegeri,
    warnings,
    kullanilacakBrutUcret,
  });

  // Yeni rapor modalı config (dönemsel ile aynı sürüklenebilir modal)
  const kidem30ReportConfig = useMemo((): ReportConfig => {
    const extrasTotal = (reportData.extras || []).reduce((acc, item) => acc + (item.value || 0), 0);
    const toplamBrutUcret = (reportData.brutUcret || 0) + (reportData.prim || 0) + (reportData.ikramiye || 0) + (reportData.yemek || 0) + (reportData.yol || 0) + (reportData.diger || 0) + extrasTotal;
    const aylikBrut = reportData.kullanilacakBrutUcret || (reportData.totals?.toplam || 0);
    const yilTutar = aylikBrut * (reportData.totals?.yil || 0);
    const ayTutar = (aylikBrut / 12) * (reportData.totals?.ay || 0);
    const gunTutar = (aylikBrut / 365) * (reportData.totals?.gun || 0);
    const t = reportData.totals || { yil: 0, ay: 0, gun: 0 };
    return {
      title: "Kıdem Tazminatı Raporu",
      sections: { info: true, periodTable: false, grossToNet: true, mahsuplasma: false },
      infoRows: [
        { label: "İşe Giriş", value: reportData.iseGirisTarihi || "-" },
        { label: "İşten Çıkış", value: reportData.istenCikisTarihi || "-" },
        { label: "Çalışma Süresi", value: reportData.calismaSuresi || "-" },
      ],
      customSections: [
        {
          title: "Ekstra Hesaplamalar",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
              <tbody>
                <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '30%' }}>Çıplak Brüt</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.brutUcret)}</td></tr>
                <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>Prim</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.prim)}</td></tr>
                <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>İkramiye</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.ikramiye)}</td></tr>
                <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>Yemek</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.yemek)}</td></tr>
                {(reportData.yol || 0) > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>Yol</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.yol)}</td></tr>}
                {(reportData.diger || 0) > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>Diğer</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(reportData.diger)}</td></tr>}
                {(reportData.extras || []).map((ex) => <tr key={ex.id}><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>{ex.label || 'Ekstra'}</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(ex.value)}</td></tr>)}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Brüt</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(toplamBrutUcret)}</td></tr>
              </tbody>
            </table>
          ),
        },
        ...(reportData.tavanUygulandi || (reportData.warnings && reportData.warnings.length > 0)
          ? [{
              title: "Tavan Uyarısı",
              condition: true,
              content: (
                <div style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '6px', padding: '10px 12px', fontSize: '10px' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>Tavan Ücret Uyarısı</p>
                  <div style={{ color: '#7f1d1d', lineHeight: 1.4 }}>
                    {reportData.warnings && reportData.warnings.length > 0
                      ? reportData.warnings.map((w, i) => (
                          <div key={i} style={{ marginBottom: i < reportData.warnings!.length - 1 ? 4 : 0 }}>{w}</div>
                        ))
                      : <div>Hesaplanan aylık brüt ücret, yürürlükteki kıdem tazminatı tavanı nedeniyle tavan tutarı ile sınırlandırılmıştır.</div>
                    }
                  </div>
                </div>
              ),
            }]
          : []),
        {
          title: "Kıdem Tazminatı Hesaplama Detayları",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
              <thead style={{ background: '#f3f4f6' }}><tr><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Hesaplama</th><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th></tr></thead>
              <tbody>
                {t.yil > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{fmtCurrency(aylikBrut)} × {t.yil} yıl</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(yilTutar)}</td></tr>}
                {t.ay > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{fmtCurrency(aylikBrut)} / 12 × {t.ay} ay</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(ayTutar)}</td></tr>}
                {(t.gun > 0 || (t.yil > 0 && t.gun === 0)) && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{fmtCurrency(aylikBrut)} / 365 × {t.gun} gün</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(t.gun > 0 ? gunTutar : 0)}</td></tr>}
                <tr style={{ backgroundColor: '#eff6ff', fontWeight: 600 }}><td style={{ border: '1px solid #999', padding: '5px 8px', color: '#2563eb' }}>Toplam Kıdem Tazminatı</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#2563eb' }}>{fmtCurrency(reportData.toplamBrut)}</td></tr>
              </tbody>
            </table>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        fontSize: "10px",
        rows: [
          { label: "Brüt Kıdem Tazminatı", value: fmtCurrency(reportData.toplamBrut) },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(reportData.damgaVergisi ?? 0)}`, isDeduction: true },
          { label: "Net Kıdem Tazminatı", value: fmtCurrency(reportData.netTazminat), isNet: true },
        ],
      },
    };
  }, [reportData]);

  // Bölüm bazlı Word tabloları (DavaciUcreti ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const extrasTotal = (reportData.extras || []).reduce((acc, item) => acc + (item.value || 0), 0);
    const toplamBrutUcret = (reportData.brutUcret || 0) + (reportData.prim || 0) + (reportData.ikramiye || 0) + (reportData.yemek || 0) + (reportData.yol || 0) + (reportData.diger || 0) + extrasTotal;
    const aylikBrut = reportData.kullanilacakBrutUcret || (reportData.totals?.toplam || 0);
    const t = reportData.totals || { yil: 0, ay: 0, gun: 0 };
    const yilTutar = aylikBrut * t.yil;
    const ayTutar = (aylikBrut / 12) * t.ay;
    const gunTutar = (aylikBrut / 365) * t.gun;

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş", reportData.iseGirisTarihi || "-"],
        ["İşten Çıkış", reportData.istenCikisTarihi || "-"],
        ["Çalışma Süresi", reportData.calismaSuresi || "-"],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt", value: fmtCurrency(reportData.brutUcret) },
      { label: "Prim", value: fmtCurrency(reportData.prim) },
      { label: "İkramiye", value: fmtCurrency(reportData.ikramiye) },
      { label: "Yemek", value: fmtCurrency(reportData.yemek) },
    ];
    if ((reportData.yol || 0) > 0) bilesenData.push({ label: "Yol", value: fmtCurrency(reportData.yol) });
    if ((reportData.diger || 0) > 0) bilesenData.push({ label: "Diğer", value: fmtCurrency(reportData.diger) });
    (reportData.extras || []).forEach((ex) => bilesenData.push({ label: ex.label || "Ekstra", value: fmtCurrency(ex.value) }));
    bilesenData.push({ label: "Toplam Brüt", value: fmtCurrency(toplamBrutUcret) });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({ id: "ekstra-hesaplamalar", title: "Ekstra Hesaplamalar", html: buildWordTable(n2.headers, n2.rows) });

    if (reportData.tavanUygulandi || (reportData.warnings && reportData.warnings.length > 0)) {
      const warningText = (reportData.warnings || []).join(" ");
      const n3 = adaptToWordTable({ headers: ["Tavan Uyarısı"], rows: [[warningText || "Tavan uygulandı."]] });
      sections.push({ id: "tavan-uyarisi", title: "Tavan Uyarısı", html: buildWordTable(n3.headers, n3.rows) });
    }

    const hesapRows: { label: string; value: string }[] = [];
    if (t.yil > 0) hesapRows.push({ label: `${fmtCurrency(aylikBrut)} × ${t.yil} yıl`, value: fmtCurrency(yilTutar) });
    if (t.ay > 0) hesapRows.push({ label: `${fmtCurrency(aylikBrut)} / 12 × ${t.ay} ay`, value: fmtCurrency(ayTutar) });
    hesapRows.push({ label: `${fmtCurrency(aylikBrut)} / 365 × ${t.gun} gün`, value: fmtCurrency(t.gun > 0 ? gunTutar : 0) });
    hesapRows.push({ label: "Toplam Kıdem Tazminatı", value: fmtCurrency(reportData.toplamBrut) });
    const n4 = adaptToWordTable(hesapRows);
    sections.push({ id: "kidem-hesap", title: "Kıdem Tazminatı Hesaplama Detayları", html: buildWordTable(n4.headers, n4.rows) });

    const grossNetRows = kidem30ReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n5 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [reportData, kidem30ReportConfig]);

  // useReportExport ile birebir aynı print HTML/CSS (modal Yazdır çıktısı ile footer Yazdır çıktısı aynı olsun)
  const REPORT_PRINT_STYLES = `@page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0 auto; font-size: 10px; max-width: 16cm; }
    table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid !important; table-layout: fixed; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
    h2 { font-size: 12px; margin: 8px 0 6px 0; page-break-after: avoid !important; page-break-before: auto; }
    div { margin-bottom: 10px; }
    .report-section { page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3; widows: 3; }
    .report-section-last { page-break-after: auto !important; break-after: auto !important; }
    .report-section-title { page-break-after: avoid !important; break-after: avoid !important; }
    table { page-break-inside: avoid !important; break-inside: avoid !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    button { display: none !important; }`;

  const printReportContentFromHtml = useCallback((contentHtml: string, reportTitle: string) => {
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${reportTitle}</title><style>${REPORT_PRINT_STYLES}</style></head><body>${contentHtml}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
      };
    }
  }, []);

  const printReportContent = useCallback((targetEl: HTMLElement) => {
    printReportContentFromHtml(targetEl.outerHTML, kidem30ReportConfig.title);
  }, [kidem30ReportConfig.title, printReportContentFromHtml]);

  // Yazdırma işlemi - Footer ve modal yazdır aynı rapor içeriğini (ReportContentFromConfig) kullanır; modal Yazdır ile birebir aynı çıktı
  const handlePrint = useCallback(() => {
    if (USE_NEW_KIDEM30_REPORT) {
      const tempContainer = document.createElement("div");
      tempContainer.id = "kidem30-print-temp";
      tempContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:16cm;visibility:hidden;pointer-events:none;z-index:-1;";
      document.body.appendChild(tempContainer);
      const root = createRoot(tempContainer);
      try {
        flushSync(() => {
          root.render(React.createElement(ReportContentFromConfig, { config: kidem30ReportConfig }));
        });
        const el = tempContainer.querySelector("#report-content") as HTMLElement | null;
        if (el && el.outerHTML && el.innerHTML.trim().length > 100) {
          const contentHtml = el.outerHTML;
          root.unmount();
          document.body.removeChild(tempContainer);
          // Modal içindeki Yazdır ile aynı HTML/CSS (useReportExport ile birebir)
          printReportContentFromHtml(contentHtml, kidem30ReportConfig.title);
        } else {
          root.unmount();
          document.body.removeChild(tempContainer);
          toastError("Yazdırma içeriği hazırlanamadı");
        }
      } catch (e) {
        try {
          root.unmount();
          if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        } catch {}
        toastError("Yazdırma hatası");
      }
      return;
    }
    try {
      // Modal'daki report-content elementini bul
      let targetEl = document.getElementById("report-content");
      
      // Eğer modal açık değilse, modal'ı geçici olarak aç ve içeriği al
      if (!targetEl) {
        setShowReportModal(true);
        // Modal'ın render olması için kısa bir bekleme
        setTimeout(() => {
          const newTargetEl = document.getElementById("report-content");
          if (newTargetEl) {
            printReportContent(newTargetEl);
            // Yazdırma işlemi başladıktan sonra modal'ı kapat
            setTimeout(() => {
              setShowReportModal(false);
            }, 500);
          } else {
            setShowReportModal(false);
            toastError("Yazdırma içeriği bulunamadı");
          }
        }, 200);
        return;
      }
      
      // Modal açıksa direkt yazdır
      printReportContent(targetEl);
    } catch (err) {
      console.error('Print error:', err);
      toastError("Yazdırma hatası");
    }
  }, [showReportModal, setShowReportModal, toastError, kidem30ReportConfig, printReportContent, printReportContentFromHtml]);

  // Eski handlePrint (yedek - kullanılmıyor)
  const handlePrintOld = useCallback(() => {
    // Programmatic print: Sadece hesaplama içeriğini yazdır
    const content = document.querySelector('#kidem-print');
    if (!content) {
      console.error('Print: #kidem-print bulunamadı');
      return;
    }

    const clone = content.cloneNode(true) as HTMLElement;
    clone.id = 'print-root';
    
    document.body.appendChild(clone);
    window.print();
    document.body.removeChild(clone);
  }, []);

  // Gerçek kaydetme işlemi
  const handleSave = useCallback(async (kayitAdi?: string) => {
    try {
      setIsSaving(true);
      // Basit validation - en az bir ücret bilgisi olmalı
      const hasAnyValue = Object.values(formValues).some(v => v && String(v).trim() !== '');
      if (!hasAnyValue) {
        toastError("Lütfen en az bir ücret bilgisi girin");
        return;
      }
      
      // Tavan uygulandıysa tavan değerini kullan, değilse brutTazminat'ı kullan
      const brutNetDisplay = tavanUygulandi && tavanDegeri ? tavanDegeri : brutTazminat;
      const damgaVergisi = brutNetDisplay * 0.00759;
      const netDisplay = brutNetDisplay - damgaVergisi;
      
      // Standart payload formatı
      const iseGiris = formValues.startDate || formValues.iseGiris || null;
      const istenCikis = formValues.exitDate || formValues.endDate || formValues.istenCikis || null;
      
      const finalKayitAdi = kayitAdi || currentRecordName || `Kıdem Tazminatı - ${new Date().toLocaleDateString("tr-TR")}`;
      
      const result = await saveCalculation(
        finalKayitAdi,
        RECORD_TYPE,
        {
          data: {
            form: formValues,
            results: {
              totals,
              brut: brutNetDisplay,
              net: netDisplay
            }
          },
          ise_giris: iseGiris,
          isten_cikis: istenCikis,
          brut_total: brutNetDisplay || 0,
          net_total: netDisplay || 0,
          start_date: iseGiris,
          end_date: istenCikis,
          total: brutNetDisplay || 0,
        },
        effectiveId
      );

      if (result.success) {
        toastSuccess("Hesaplama kaydedildi");
        if (result.name) {
          setCurrentRecordName(result.name);
        }
        setShowSaveNameModal(false);
        setSaveNameInput("");
        if (result.id && !effectiveId) {
          navigate(`${REDIRECT_BASE_PATH}/${result.id}`);
        }
      }
    } catch (err: any) {
      toastError(err.message || "Kaydetme hatası");
    } finally {
      setIsSaving(false);
    }
  }, [formValues, totals, brutTazminat, tavanUygulandi, tavanDegeri, effectiveId, currentRecordName, toastError, toastSuccess, navigate]);

  // Kaydetme butonuna tıklama - modal aç
  const handleSaveClick = useCallback(() => {
    // Eğer zaten bir isim varsa ve mevcut kayıt varsa direkt kaydet
    if (currentRecordName && effectiveId) {
      handleSave(currentRecordName);
    } else {
      // Yeni kayıt için isim sor
      setSaveNameInput(currentRecordName || "");
      setShowSaveNameModal(true);
    }
  }, [currentRecordName, effectiveId, handleSave]);
  
  // Yeni hesaplama - Fazla mesai sayfasındaki gibi sadece state'leri temizle
  const handleNewCalculation = useCallback(() => {
    try {
      // Kaydedilmemiş veriler varsa onay al (opsiyonel - fazla mesai sayfasında var)
      const hasUnsavedData = (formValues.startDate || formValues.iseGiris) && !id;
      if (hasUnsavedData) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) {
          return;
        }
      }
      
      // ID varsa URL'den kaldır ve sayfayı yeniden yükle
      if (id) {
        window.location.href = REDIRECT_BASE_PATH;
        return;
      }
      
      // ID yoksa sadece state'leri temizle
      setFormValues({
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
        iseGiris: '',
        istenCikis: '',
        brut: '',
        extras: []
      });
      
      // Totals'ı sıfırla
      setTotals({
        toplam: 0,
        yil: 0,
        ay: 0,
        gun: 0
      });
      
      // Diğer state'leri temizle
      setBrutTazminat(0);
      setNetTazminat(0);
      setExitDate('');
      setAppliedEklenti(undefined);
      loadedIdRef.current = null; // Yeni hesaplama için ref'i temizle
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id]);
  
  // Header butonları kaldırıldı

  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialBrut = useMemo(() => formValues.brutUcret || formValues.brut || "", [formValues.brutUcret, formValues.brut]);
  // Initial değerleri sadece gerçekten değiştiğinde güncelle (döngüyü önlemek için)
  // useRef ile önceki değerleri takip et - sadece tam tarih formatında güncelle
  const prevInitialsRef = useRef({
    iseGiris: "",
    istenCikis: "",
  });
  
  const memoizedInitialIseGiris = useMemo(() => {
    const current = formValues.startDate || formValues.iseGiris || "";
    // Sadece tam tarih formatında ve gerçekten değiştiğinde güncelle
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(current) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(current);
    if (isCompleteDate && current !== prevInitialsRef.current.iseGiris && current.length > 0) {
      prevInitialsRef.current.iseGiris = current;
      return current;
    }
    // Tam tarih formatında değilse, önceki değeri koru (kullanıcı yazarken döngüyü önlemek için)
    return prevInitialsRef.current.iseGiris || current;
  }, [formValues.startDate, formValues.iseGiris]);
  
  const memoizedInitialIstenCikis = useMemo(() => {
    const current = formValues.exitDate || formValues.endDate || formValues.istenCikis || "";
    // Sadece tam tarih formatında ve gerçekten değiştiğinde güncelle
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(current) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(current);
    if (isCompleteDate && current !== prevInitialsRef.current.istenCikis && current.length > 0) {
      prevInitialsRef.current.istenCikis = current;
      return current;
    }
    // Tam tarih formatında değilse, önceki değeri koru (kullanıcı yazarken döngüyü önlemek için)
    return prevInitialsRef.current.istenCikis || current;
  }, [formValues.exitDate, formValues.endDate, formValues.istenCikis]);
  const memoizedInitialPrim = useMemo(() => formValues.prim || "", [formValues.prim]);
  const memoizedInitialIkramiye = useMemo(() => formValues.ikramiye || "", [formValues.ikramiye]);
  const memoizedInitialYol = useMemo(() => formValues.yol || "", [formValues.yol]);
  const memoizedInitialYemek = useMemo(() => formValues.yemek || "", [formValues.yemek]);
  const memoizedInitialExtras = useMemo(() => formValues.extras || [], [formValues.extras]);

  // Loading state UI
  if (isLoading && effectiveId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Kayıt yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ height: "4px", background: pageStyle?.color || "#6A1B9A" }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: '80px' }}>
          {/* Header */}
          <div className="mb-8 flex justify-end items-center">
            <div className="flex items-center gap-2">
              {getVideoLink("kidem-30isci") && (
                <button
                  onClick={() => window.open(getVideoLink("kidem-30isci"), "_blank")}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-600 transition-all"
                >
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-8 space-y-6">
          <KidemTazminatiForm
            embedInCard={true}
            onTotalsChange={handleTotalsChange}
            appliedEklenti={appliedEklenti}
            onRequestEklenti={handleRequestEklenti}
            onExitDateChange={setExitDate}
            showEmploymentDates={true}
            showBrutInput={true}
            showPrimInput={true}
            showIkramiyeInput={true}
            showYolInput={true}
            showYemekInput={true}
            showExtras={true}
            showIhbarShortcut={false}
            ihbarRoute="30isci"
            onValuesChange={handleFormChange}
            initialBrut={memoizedInitialBrut}
            initialIseGiris={memoizedInitialIseGiris}
            initialIstenCikis={memoizedInitialIstenCikis}
            initialPrim={memoizedInitialPrim}
            initialIkramiye={memoizedInitialIkramiye}
            initialYol={memoizedInitialYol}
            initialYemek={memoizedInitialYemek}
            initialExtras={memoizedInitialExtras}
            customTotalFormatter={fmtCurrency}
          />
          
          {warnings?.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">Tavan Uyarısı</p>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-1 space-y-1">
                    {warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {kidemTazminatiHakkiYok && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">Kıdem Tazminatı Hakkı Uyarısı</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">1 yılın (365 gün) altında çalışma süresine sahip olanlara kıdem tazminatı hakkı doğmaz. Toplam çalışma süreniz 1 yılın altında olduğu için kıdem tazminatı hesaplanamaz.</p>
                </div>
              </div>
            </div>
          )}

          <div id="kidem-print" className="space-y-6">
            <ToplamHesaplama 
              toplam={kullanilacakBrutUcret} 
              yil={totals.yil} 
              ay={totals.ay}
              warnings={warnings} 
              gun={totals.gun} 
            />
          
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-yellow-100 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center text-white text-sm">₺</div>
                Brüt'ten Net'e Çeviri
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-yellow-100 dark:border-gray-600">
                  <span className="text-gray-700 dark:text-gray-300">Brüt Kıdem Tazminatı</span>
                  <span className="font-semibold dark:text-amber-200">{fmtCurrency(brutNetDisplay)}</span>
                </div>
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
          </div>

          {exitDate && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Çıkış Tarihi:</span> {new Date(exitDate).toLocaleDateString('tr-TR')} tarihinde işten ayrılan bir çalışanın hesaplaması yapılıyor.
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">✏️</div>
              Notlar
            </h2>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-600">
              <p className="text-xs text-gray-600 dark:text-gray-400">Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir. Prim, İkramiye gibi ücretlerin hesaplanmasında son 12 aylık bordroda yer alan tüm kalemler toplanır, toplam 360'a bölünür, 30 ile çarpılır.</p>
            </div>
          </div>
            </div>
          </div>
        </div>
          
        {/* Eklenti Modal - tüm alanlar için (prim/ikramiye/yemek + extra:ID) */}
          {activeModal && (
            <EklentiModal
              open={true}
              title={
                activeModal === "prim"
                  ? "Prim Hesaplama"
                  : activeModal === "ikramiye"
                  ? "İkramiye Hesaplama"
                  : activeModal === "yemek"
                  ? "Yemek Hesaplama"
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
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          copyTargetId: "kidem30-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kidem30-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #kidem30-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="kidem30-word-copy">
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
                <ReportContentFromConfig config={kidem30ReportConfig} />
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PRINT_TITLE, "report-content"),
        }}
      />

      {/* Yeni rapor: dönemsel ile aynı sürüklenebilir modal */}
      {USE_NEW_KIDEM30_REPORT && (
        <BaseReportModal
          open={showNewKidem30ReportModal}
          onClose={() => setShowNewKidem30ReportModal(false)}
          config={kidem30ReportConfig}
        />
      )}
      {/* Eski modal (USE_NEW_KIDEM30_REPORT=false iken) */}
      {!USE_NEW_KIDEM30_REPORT && (
        <Kidem30ReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          data={reportData}
        />
      )}

      {/* Kaydetme İsim Modal – tüm sayfalarla aynı görünüm */}
      {showSaveNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSaveNameModal(false); setSaveNameInput(""); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">Hesaplamayı Kaydet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Hesaplamanızı kaydetmek için bir isim giriniz.</p>
            <div className="py-2">
              <label htmlFor="kayit-adi-30" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Hesaplama Adı</label>
              <input
                id="kayit-adi-30"
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz - Kıdem Tazminatı"
                className="w-full mb-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveNameInput.trim()) handleSave(saveNameInput.trim());
                  if (e.key === "Escape") { setShowSaveNameModal(false); setSaveNameInput(""); }
                }}
                autoFocus
                disabled={isSaving}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Bu isim kaydedilen hesaplamalarınız sayfasında görünecektir.</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowSaveNameModal(false); setSaveNameInput(""); }} disabled={isSaving} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:border-blue-400 transition-all disabled:opacity-50">İptal</button>
              <button type="button" onClick={() => { if (saveNameInput.trim()) handleSave(saveNameInput.trim()); else toastError("Lütfen bir isim girin"); }} disabled={isSaving || !saveNameInput.trim()} className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50">{isSaving ? "Kaydediliyor..." : "Kaydet"}</button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}

export default function Kidem30Independent() {
  return (
    <ToastProvider>
      <Kidem30IndependentContent />
    </ToastProvider>
  );
}
