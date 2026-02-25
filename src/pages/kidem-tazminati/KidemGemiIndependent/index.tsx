import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./toast";
import { safeNumber, safeCurrency, safeDays } from "./localUtils/safeFormat";
import KidemTazminatiForm from "./localComponents/KidemTazminatiForm";
import ToplamHesaplama from "./localComponents/ToplamHesaplama";
import EklentiModal from "./localComponents/EklentiModal";
import KidemTazminatiReportModal, {
  buildKidemReportData,
  formatCalismaSuresi,
} from "./KidemTazminatiReportModal";
import FooterActions from "@/components/FooterActions";
import { AlertTriangle, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";
import { saveCalculation } from "./save";
// YENİ RAPOR SİSTEMİ – 16cm sabit genişlik (Word’e yapıştırmada taşmaz)
import { BaseReportModal, ReportContentFromConfig, type ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_KIDEM_GEMI_REPORT = true;
// Constants - inline
const RECORD_TYPE = "kidem_gemi";
const REDIRECT_BASE_PATH = "/kidem-tazminati/gemi";
const PRINT_TITLE = "Kıdem Tazminatı - Gemi Adamları";
const PRINT_HEADING = "GEMİ ADAMLARI KIDEM TAZMİNATI";

// State, actions, calculations, api
import { useKidemGemiState } from "./state";
import {
  handleCalculateKullanilacakBrutUcret,
  handleCalculateTavanBilgisi,
  handleCalculateKidemTazminati,
  handleCalculateDamgaVergisi,
  handleCalculateCiplakBrutUcret,
  handleCalculateMuafiyetTutari,
  handleCalculateGelirVergisi,
  handleCalculateNetDisplay,
  handleCheckKidemTazminatiHakki,
} from "./actions";
import { fmt, fmtCurrency, parseNum } from "./calculations";
import { loadCalculation as loadCalculationAPI } from "./api";
import type { LoadCalculationRequest } from "./contract";
import { parseMoney } from "./localUtils/parseMoney";

// API servis fonksiyonları (api.ts'den import ediliyor)
const loadCalculation = async (id: string) => {
  return await loadCalculationAPI({ loadId: id });
};

function KidemGemiIndependentInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { success, error: showToastError } = useToast();
  
  // Query parametrelerinden caseId'yi de kontrol et
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("kidem-gemi");
  
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    kullanilacakBrutUcret,
    setKullanilacakBrutUcret,
    warnings,
    setWarnings,
    isLoading,
    setIsLoading,
    showNewGemiReportModal,
    setShowNewGemiReportModal,
  } = useKidemGemiState();
  
  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    
    let isMounted = true; // Component unmount kontrolü
    
    const fetchData = async () => {
      try {
        console.log('[KidemGemiIndependent] Loading calculation with ID:', loadId);
        const loadedData = await loadCalculation(loadId);
        console.log('[KidemGemiIndependent] Loaded data:', loadedData);
        
        if (!isMounted) return; // Component unmount olduysa işlemi durdur
        
        // data kontrolü
        if (!loadedData) {
          console.warn('[KidemGemiIndependent] No data loaded');
          showToastError('Kayıt verisi bulunamadı');
          return;
        }
        
        // loadCalculation'dan gelen veriyi direkt kullan (dönüşüm yapmadan)
        const formData = loadedData.formValues || {};
        
        console.log('[KidemGemiIndependent] formData before setFormValues:', formData);
        console.log('[KidemGemiIndependent] formData.iseGiris:', formData.iseGiris);
        console.log('[KidemGemiIndependent] formData.istenCikis:', formData.istenCikis);
        console.log('[KidemGemiIndependent] formData.brut:', formData.brut);
        
        // State'leri direkt set et - extras'ı da ekle
        setFormValues({
          iseGiris: formData.iseGiris || '',
          istenCikis: formData.istenCikis || '',
          brut: formData.brut || '',
          brutUcret: formData.brutUcret || '',
          prim: formData.prim || '',
          ikramiye: formData.ikramiye || '',
          yol: formData.yol || '',
          yemek: formData.yemek || '',
          diger: formData.diger || '',
          isSGK: formData.isSGK ?? true,
          startDate: formData.startDate || '',
          endDate: formData.endDate || '',
          exitDate: formData.exitDate || '',
          extras: formData?.extras || [],
          ...formData,
        });
        
        console.log('[KidemGemiIndependent] formValues set edildi');
        setTotals(loadedData.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 });
        setBrutTazminat(loadedData.brutTazminat || 0);
        setNetTazminat(loadedData.netTazminat || 0);
        
        // Exit date'i set et (tavan kontrolü için gerekli)
        const exitDateValue = formData.istenCikis || formData.endDate || formData.exitDate || '';
        if (exitDateValue) {
          setExitDate(exitDateValue);
          console.log('[KidemGemiIndependent] exitDate set edildi:', exitDateValue);
        }
        
        // Applied eklenti varsa set et
        if (loadedData.appliedEklenti) {
          setAppliedEklenti(loadedData.appliedEklenti);
        }
        
        // Kayıt adını set et (güncelleme için gerekli)
        if (loadedData.name) {
          setCurrentRecordName(loadedData.name);
        }
        
        success('Kayıt yüklendi');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError(`Kayıt yüklenirken hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // id değiştiğinde çalışsın
  
  // Form değişikliklerini işle - sadece gemi alanları
  const handleFormChange = useCallback((newValues: any) => {
    setFormValues(prev => {
      const updated = { ...prev, ...newValues };
      
      // Extras'ı her zaman güncelle - eğer newValues'da varsa onu kullan, yoksa öncekini koru
      if (newValues.extras !== undefined) {
        updated.extras = newValues.extras;
      } else if (!updated.extras) {
        updated.extras = [];
      }
      
      // iseGiris → startDate mapping
      if (newValues.iseGiris !== undefined) {
        updated.iseGiris = newValues.iseGiris;
        updated.startDate = newValues.iseGiris;
      }
      
      // istenCikis → endDate + exitDate mapping
      if (newValues.istenCikis !== undefined) {
        updated.istenCikis = newValues.istenCikis;
        updated.endDate = newValues.istenCikis;
        updated.exitDate = newValues.istenCikis;
        setExitDate(newValues.istenCikis);
      }
      
      // brut
      if (newValues.brut !== undefined) {
        updated.brut = newValues.brut;
        updated.brutUcret = newValues.brut;
      }
      
      // prim
      if (newValues.prim !== undefined) {
        updated.prim = newValues.prim;
      }
      
      // ikramiye
      if (newValues.ikramiye !== undefined) {
        updated.ikramiye = newValues.ikramiye;
      }
      
      // yol
      if (newValues.yol !== undefined) {
        updated.yol = newValues.yol;
      }
      
      // yemek
      if (newValues.yemek !== undefined) {
        updated.yemek = newValues.yemek;
      }
      
      // diger
      if (newValues.diger !== undefined) {
        updated.diger = newValues.diger;
      }
      
      // exitDate
      if (newValues.exitDate) {
        updated.exitDate = newValues.exitDate;
        setExitDate(newValues.exitDate);
      }
      
      return updated;
    });
  }, []);
  
  // Modal functions
  const openModal = (modalName: string) => setActiveModal(modalName);
  const closeModal = () => setActiveModal(null);
  
  // Eklenti isteği
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

  // Tavan kontrolü ile totals güncelleme
  const handleTotalsChange = useCallback((incomingTotals: { toplam: number; yil: number; ay: number; gun: number }) => {
    setTotals(incomingTotals);
  }, []);
  
  // Hesaplamaları güncelle
  useEffect(() => {
    // exitDate state yerine formValues.istenCikis kullan (state senkronizasyon sorunu)
    const effectiveExitDate = formValues.istenCikis || formValues.exitDate || formValues.endDate || exitDate;
    const kullanilacakBrutUcretValue = handleCalculateKullanilacakBrutUcret(formValues, effectiveExitDate);
    const tavanBilgisi = handleCalculateTavanBilgisi(formValues, effectiveExitDate);
    const finalBrutTazminat = handleCalculateKidemTazminati(kullanilacakBrutUcretValue, totals);
    const damgaVergisiValue = handleCalculateDamgaVergisi(finalBrutTazminat);
    const netTazminatValue = finalBrutTazminat - damgaVergisiValue; // Geçici değer, gerçek net brutNetDisplay üzerinden hesaplanıyor

    setWarnings(tavanBilgisi.warnings);
    setBrutTazminat(finalBrutTazminat);
    setNetTazminat(netTazminatValue);
    setKullanilacakBrutUcret(kullanilacakBrutUcretValue);
    setMatchedTavanState(null);
    setTavanUygulandi(tavanBilgisi.tavanUygulandiFlag);
    setTavanDegeri(tavanBilgisi.tavanDegeriValue);
  }, [
    formValues.brut,
    formValues.brutUcret,
    formValues.prim,
    formValues.ikramiye,
    formValues.yol,
    formValues.yemek,
    formValues.diger,
    formValues.istenCikis,
    formValues.exitDate,
    formValues.endDate,
    formValues.extras,
    exitDate,
    totals
  ]);

  // 1 yıl kontrolü - Diğer sayfalar için minimum çalışma süresi
  const kidemTazminatiHakkiYok = useMemo(() => {
    return !handleCheckKidemTazminatiHakki(totals);
  }, [totals]);
  
  // Yeni hesaplama
  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = formValues.iseGiris && !id;
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
        iseGiris: '',
        istenCikis: '',
        brut: '',
        brutUcret: '',
        prim: '',
        ikramiye: '',
        yol: '',
        yemek: '',
        diger: '',
        isSGK: true,
        startDate: '',
        endDate: '',
        exitDate: '',
        extras: [],
      });
      setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
      setBrutTazminat(0);
      setNetTazminat(0);
      setExitDate('');
      setAppliedEklenti(undefined);
      setWarnings([]);
      setTavanUygulandi(false);
      setTavanDegeri(null);
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id]);

  // Tavan uygulandıysa da brutTazminat zaten tavan uygulanmış değer (finalBrutTazminat)
  // Bu yüzden direkt brutTazminat kullan
  const brutNetDisplay = brutTazminat;
  
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
  
  // Gemi adamları için vergi kuralları (Basın İşçileri ile aynı):
  // - Damga vergisi: Her halükarda binde 7,59 oranında kesilir
  // - Gelir vergisi: 24 ay kuralına göre uygulanır (GVK 25/7)
  const ciplakBrutUcret = useMemo(() => handleCalculateCiplakBrutUcret(formValues), [formValues]);
  const muafiyetTutari = useMemo(() => handleCalculateMuafiyetTutari(ciplakBrutUcret), [ciplakBrutUcret]);
  
  // Damga vergisi: Her halükarda kesilir
  const damgaVergisi = useMemo(() => handleCalculateDamgaVergisi(brutNetDisplay), [brutNetDisplay]);
  
  // Gelir vergisi: 24 ay kuralına göre uygulanır (GVK 25/7)
  const brutKidemTazminati = brutNetDisplay;
  const gelirVergisiUygulanacak = useMemo(() => brutKidemTazminati > muafiyetTutari, [brutKidemTazminati, muafiyetTutari]);
  const gelirVergisi = useMemo(() => {
    if (!gelirVergisiUygulanacak) return 0;
    return handleCalculateGelirVergisi(brutKidemTazminati, muafiyetTutari, selectedYear);
  }, [gelirVergisiUygulanacak, brutKidemTazminati, muafiyetTutari, selectedYear]);
  
  const netDisplay = useMemo(() => handleCalculateNetDisplay(brutNetDisplay, damgaVergisi, gelirVergisi), [brutNetDisplay, damgaVergisi, gelirVergisi]);
  const calismaSuresiLabel = formatCalismaSuresi(totals);
  const reportData = buildKidemReportData({
    formValues,
    calismaSuresi: calismaSuresiLabel,
    toplamBrut: brutNetDisplay,
    netTazminat: netDisplay,
    totals,
    damgaVergisi,
    gelirVergisi,
    muafiyetTutari,
    gelirVergisiUygulanacak,
  });

  // YENİ RAPOR SİSTEMİ: Config
  const kidemGemiReportConfig = useMemo((): ReportConfig => {
    // Aylık brüt ücret - tavan uygulanmışsa tavan değerini kullan, değilse kullanilacakBrutUcret
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : kullanilacakBrutUcret;
    
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
      { label: "Brüt Kıdem Tazminatı", value: fmtCurrency(brutNetDisplay) },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(damgaVergisi)}`, isDeduction: true },
    ];

    if (gelirVergisiUygulanacak) {
      grossToNetRows.push(
        { label: `24 Aylık Muafiyet (${selectedYear})`, value: `-${fmtCurrency(muafiyetTutari)}`, isDeduction: true },
        { label: "Gelir Vergisi", value: `-${fmtCurrency(gelirVergisi)}`, isDeduction: true }
      );
    }

    grossToNetRows.push({ label: "Net Kıdem Tazminatı", value: fmtCurrency(netDisplay), isNet: true });

    return {
      title: "Gemi Adamları Kıdem Tazminatı",
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
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(parseMoney(formValues.brutUcret || formValues.brut || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Prim</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(parseMoney(formValues.prim || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>İkramiye</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(parseMoney(formValues.ikramiye || "0"))}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yemek</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(parseMoney(formValues.yemek || "0"))}</td>
                </tr>
                {(formValues.extras || []).filter((ex: { value?: string }) => parseMoney(ex?.value || "0") > 0).map((ex: { id: string; label?: string; name?: string; value?: string }) => (
                  <tr key={ex.id}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.label || ex.name || "Ekstra"}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(parseMoney(ex?.value || "0"))}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Kıdem Tazminatı</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(kullanilacakBrutUcret)}</td>
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
                    Aylık brüt ücret, dönem tavanı olan {fmtCurrency(tavanDegeri)}'yi aştığı için tavan seviyesine çekilmiştir. Hesaplamalar tavan değeri üzerinden yapılmıştır.
                  </div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmt(aylikBrutUcret)} × {totals.yil} yıl
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtCurrency(yilTutar)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmt(aylikBrutUcret)} / 12 × {totals.ay} ay
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtCurrency(ayTutar)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      {fmt(aylikBrutUcret)} / 365 × {totals.gun} gün
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtCurrency(gunTutar)}
                    </td>
                  </tr>
                  <tr style={{ background: '#eff6ff', fontWeight: 600 }}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>
                      Toplam
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#2563eb', fontSize: '12px' }}>
                      {fmtCurrency(sonuc)}
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
  }, [formValues, totals, kullanilacakBrutUcret, brutNetDisplay, damgaVergisi, gelirVergisi, gelirVergisiUygulanacak, muafiyetTutari, selectedYear, netDisplay, calismaSuresiLabel, fmt, fmtCurrency, tavanUygulandi, tavanDegeri]);

  // Bölüm bazlı Word tabloları (DavaciUcreti / Kidem30 ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const aylikBrutUcret = tavanUygulandi && tavanDegeri ? tavanDegeri : kullanilacakBrutUcret;
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
    (formValues.extras || []).filter((ex: { value?: string }) => parseMoney(ex?.value || "0") > 0).forEach((ex: { id: string; label?: string; name?: string; value?: string }) => {
      bilesenData.push({ label: ex.label || ex.name || "Ekstra", value: fmtCurrency(parseMoney(ex?.value || "0")) });
    });
    bilesenData.push({ label: "Toplam Kıdem Tazminatı", value: fmtCurrency(kullanilacakBrutUcret) });
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
      { label: "Toplam", value: fmtCurrency(sonuc) },
    ];
    const n4 = adaptToWordTable(hesapRows);
    sections.push({ id: "kidem-hesap", title: "Kıdem Tazminatı Hesaplama", html: buildWordTable(n4.headers, n4.rows) });

    const grossNetRows = kidemGemiReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n5 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [formValues, totals, kullanilacakBrutUcret, calismaSuresiLabel, tavanUygulandi, tavanDegeri, kidemGemiReportConfig, fmt, fmtCurrency]);

  // Yazdırma işlemi artık FooterActions component'inde merkezi olarak yapılıyor
  // previewButton prop'u ile FooterActions otomatik olarak modal içeriğini kullanarak yazdırıyor
  
  const handleSave = useCallback(async (kayitAdi?: string) => {
    try {
      setIsSaving(true);
      const hasAnyValue = Object.values(formValues).some((v) => v && String(v).trim() !== "");
      if (!hasAnyValue) {
        showToastError("Lütfen en az bir ücret bilgisi girin");
        return;
      }
      const iseGiris = formValues.iseGiris || formValues.startDate || null;
      const istenCikis = formValues.istenCikis || formValues.exitDate || formValues.endDate || null;
      const brutForNet = tavanUygulandi && tavanDegeri ? tavanDegeri : brutTazminat;
      const netForSave = netDisplay;
      const formDataWithExtras = { ...formValues, extras: formValues.extras || [] };
      const finalKayitAdi = kayitAdi || currentRecordName || "Kıdem Tazminatı Gemi - " + new Date().toLocaleDateString("tr-TR");
      const result = await saveCalculation(
        finalKayitAdi,
        RECORD_TYPE,
        {
          data: { form: formDataWithExtras, results: { totals, brut: brutForNet, net: netForSave } },
          ise_giris: iseGiris,
          isten_cikis: istenCikis,
          brut_total: brutForNet || 0,
          net_total: netForSave || 0,
          start_date: iseGiris,
          end_date: istenCikis,
          total: brutForNet || 0,
        },
        effectiveId
      );
      if (result.success) {
        success("Hesaplama kaydedildi");
        if (result.name) setCurrentRecordName(result.name);
        setShowSaveNameModal(false);
        setSaveNameInput("");
        if (result.id && !effectiveId) navigate(REDIRECT_BASE_PATH + "/" + result.id);
      }
    } catch (err: any) {
      showToastError(err.message || "Kaydetme hatası");
    } finally {
      setIsSaving(false);
    }
  }, [formValues, totals, brutTazminat, tavanUygulandi, tavanDegeri, netDisplay, effectiveId, currentRecordName, showToastError, success, navigate]);

  const handleSaveClick = useCallback(() => {
    if (currentRecordName && effectiveId) {
      handleSave(currentRecordName);
    } else {
      setSaveNameInput(currentRecordName || "");
      setShowSaveNameModal(true);
    }
  }, [currentRecordName, effectiveId, handleSave]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("report-content");
    if (!targetEl) return;
    const title = kidemGemiReportConfig.title;
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
  }, [kidemGemiReportConfig.title]);

  // Header butonları kaldırıldı

  // Memoize initial values to prevent unnecessary re-renders (30 İşçiden Fazla sayfasındaki gibi)
  const memoizedInitialBrut = useMemo(() => formValues.brutUcret || formValues.brut || "", [formValues.brutUcret, formValues.brut]);
  const memoizedInitialIseGiris = useMemo(() => formValues.iseGiris || formValues.startDate || "", [formValues.iseGiris, formValues.startDate]);
  const memoizedInitialIstenCikis = useMemo(() => formValues.istenCikis || formValues.exitDate || formValues.endDate || "", [formValues.istenCikis, formValues.exitDate, formValues.endDate]);
  const memoizedInitialPrim = useMemo(() => formValues.prim || "", [formValues.prim]);

  return (
    <div>
      <div style={{ height: "4px", background: "#6A1B9A" }} />
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
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div id="kidem-print" className="p-8 space-y-6">
          <KidemTazminatiForm
            embedInCard={true}
            onTotalsChange={handleTotalsChange}
            appliedEklenti={appliedEklenti}
            onRequestEklenti={handleRequestEklenti}
            onExitDateChange={(date) => {
              setExitDate(date);
            }}
            hideEmploymentDates={false}
            showIhbarShortcut={false}
            ihbarRoute="gemi"
            onValuesChange={handleFormChange}
            initialBrut={memoizedInitialBrut}
            initialIseGiris={memoizedInitialIseGiris}
            initialIstenCikis={memoizedInitialIstenCikis}
            initialPrim={memoizedInitialPrim}
            initialIkramiye={formValues.ikramiye || ""}
            initialYol={formValues.yol || ""}
            initialYemek={formValues.yemek || ""}
            initialExtras={formValues.extras || []}
            customTotalFormatter={fmtCurrency}
          />
          
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

          {tavanUygulandi && tavanDegeri && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">Tavan Uyarısı</p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">Hesaplanan kıdem tazminatı dönem tavanını aştığı için {fmtCurrency(tavanDegeri)} olarak sınırlandırılmıştır.</p>
                </div>
              </div>
            </div>
          )}

          <ToplamHesaplama 
            toplam={kullanilacakBrutUcret || parseMoney(formValues.brutUcret || formValues.brut || 0)} 
            yil={totals.yil} 
            ay={totals.ay} 
            gun={totals.gun} 
            warnings={warnings}
          />
          
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-yellow-100 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center text-white text-sm">₺</div>
              Brüt'ten Net'e Çeviri
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              {gelirVergisiUygulanacak
                ? `Brüt tutardan binde 7,59 oranında damga vergisi ve gelir vergisi kesintisi yapılmıştır. (Kıdem tazminatı toplamı (${fmtCurrency(brutNetDisplay)}), çıplak brüt ücretin 24 katından (${fmtCurrency(muafiyetTutari)}) fazla olduğu için gelir vergisi uygulanmıştır.)`
                : `193 sayılı Gelir Vergisi Kanunun 25/7. maddesine göre kıdem tazminatının 24 aylığı aşmayan tutarı için gelir vergisi uygulanmamalıdır. Kıdem tazminatı toplamı (${fmtCurrency(brutNetDisplay)}), çıplak brüt ücretin 24 katından (${fmtCurrency(muafiyetTutari)}) fazla olmadığı için gelir vergisi uygulanmamıştır. Damga vergisi her halükarda binde 7,59 oranında kesilmiştir.`
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
          </div>
        </div>
      </div>

      {/* YENİ RAPOR SİSTEMİ: KidemReportModal (16cm) */}
      {/* Rapor içeriği yazdırma için her zaman DOM'da (gizli); modal sadece önizleme için */}
      {USE_NEW_KIDEM_GEMI_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={kidemGemiReportConfig} />
        </div>
      )}
      {USE_NEW_KIDEM_GEMI_REPORT && (
        <BaseReportModal
          open={showNewGemiReportModal}
          onClose={() => setShowNewGemiReportModal(false)}
          config={kidemGemiReportConfig}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Gemi Adamları Kıdem Tazminatı",
          copyTargetId: "kidem-gemi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kidem-gemi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #kidem-gemi-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="kidem-gemi-word-copy">
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
                <ReportContentFromConfig config={kidemGemiReportConfig} />
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM("Gemi Adamları Kıdem Tazminatı", "report-content"),
        }}
      />

      {showSaveNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSaveNameModal(false); setSaveNameInput(""); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">Hesaplamayı Kaydet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Hesaplamanızı kaydetmek için bir isim giriniz.</p>
            <div className="py-2">
              <label htmlFor="kayit-adi-gemi" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Hesaplama Adı</label>
              <input
                id="kayit-adi-gemi"
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
              <button type="button" onClick={() => { setShowSaveNameModal(false); setSaveNameInput(""); }} disabled={isSaving} className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all disabled:opacity-50">İptal</button>
              <button type="button" onClick={() => { if (saveNameInput.trim()) handleSave(saveNameInput.trim()); else showToastError("Lütfen bir isim girin"); }} disabled={isSaving || !saveNameInput.trim()} className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50">{isSaving ? "Kaydediliyor..." : "Kaydet"}</button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}

export default function KidemGemiIndependent() {
  return (
    <ToastProvider>
      <KidemGemiIndependentInner />
    </ToastProvider>
  );
}
