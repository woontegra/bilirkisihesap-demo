import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { safeNumber, safeCurrency, safeDays } from "@/utils/safeFormat";
import Layout from "@/components/Layout";
import KidemTazminatiForm from "../../is-tazminati/KidemTazminatiForm";
import ToplamHesaplama from "../../is-tazminati/ToplamHesaplama";
import NoteCard from "./NoteCard";
import EklentiModal from "../../is-tazminati/EklentiModal";
import FooterActions from "@/components/FooterActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Plus, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVideoLink } from "@/config/videoLinks";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { API_BASE_URL } from "@/utils/apiClient";
// Constants - inline
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const PRINT_HEADING = "Toplu İş Sözleşmesi Kıdem Tazminatı Hesaplama";
const PRINT_TITLE = "Toplu İş Sözleşmesi Kıdem Tazminatı Hesaplama";
const RECORD_TYPE = "belirli-sureli";
const REDIRECT_BASE_PATH = "/kidem-tazminati/toplu-sozlesme";
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const NET_REDUCTION_FACTOR = 0.85;

// Helper functions - inline
const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const validateSave = (amount: number) => {
  if (!amount || amount <= 0) return { isValid: false, message: "Lütfen geçerli bir hesaplama yapın" };
  return { isValid: true };
};

type KidemFormValues = any;
type KidemTavan = any;
import "@/styles/soft-glow.css";
import { findKidemTavan } from "@/utils/findKidemTavan";
import { printPageContent } from "@/utils/printPage";
import KidemTazminatiReportModal, {
  computeToplamBrutFromTotals,
} from "../KidemTazminatiReportModal";

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
    const response = await fetch(`${LOAD_ENDPOINT}/${id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Yükleme işlemi başarısız oldu');
    return data;
  } catch (err) {
    console.error('Yükleme hatası:', err);
    throw err;
  }
};

export default function KidemTopluSozlesmeIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("kidem-toplu-sozlesme");
  
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
  
  const [formValues, setFormValues] = useState({
    brutUcret: '',
    prim: '',
    ikramiye: '',
    yol: '',
    yemek: '',
    diger: '',
    startDate: '',
    endDate: new Date().toISOString().split('T')[0],
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
    extras: [] as Array<{ id: string; label: string; value: string }>,
    isDamgaVergisiOraniTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutariTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutariTutari: false,
    isDamgaVergisiMatrahiTutariTutariTutariTutariTutariTutari: false,
    isDamgaVergisiOraniTutariTutariTutariTutariTutariTutari: false,
    isDamgaVergisiTutariTutariTutariTutariTutariTutariTutari: false,
  });
  
  // Modal state management
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>('');
  const [matchedTavanState, setMatchedTavanState] = useState<KidemTavan | null>(null);
  const [tavanUygulandi, setTavanUygulandi] = useState<boolean>(false);
  const [tavanDegeri, setTavanDegeri] = useState<number | null>(null);
  
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
  
  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          const data = await loadCalculation(id);
          console.log('[KidemTopluSozlesme] loadCalculation - data.formValues:', data.formValues);
          console.log('[KidemTopluSozlesme] loadCalculation - data.formValues.extras:', data.formValues?.extras);
          
          setFormValues(prev => {
            const loaded = {
              ...prev,
              ...data.formValues,
              startDate: data.formValues.startDate ? new Date(data.formValues.startDate).toISOString().split('T')[0] : '',
              endDate: data.formValues.endDate ? new Date(data.formValues.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              exitDate: data.formValues.exitDate ? new Date(data.formValues.exitDate).toISOString().split('T')[0] : '',
              ihbarTarihi: data.formValues.ihbarTarihi ? new Date(data.formValues.ihbarTarihi).toISOString().split('T')[0] : '',
              extras: data.formValues?.extras || prev.extras || [],
            };
            console.log('[KidemTopluSozlesme] loadCalculation - loaded.extras:', loaded.extras);
            return loaded;
          });
          setExitDate(data.formValues.exitDate || '');
          setAppliedEklenti(data.appliedEklenti || null);
          if (data.name) {
            setCurrentRecordName(data.name);
          }
          showToast('Kayıt yüklendi', 'success');
        } catch (err) {
          console.error('Kayıt yüklenirken hata oluştu:', err);
          showToast('Kayıt yüklenirken hata oluştu', 'error');
        }
      }
    };
    
    fetchData();
  }, [id, showToast]);
  
  // Form değişikliklerini işle
  const handleFormChange = useCallback((newValues: any) => {
    setFormValues(prev => {
      const updated = { ...prev, ...newValues };
      // Extras'ı her zaman güncelle - eğer newValues'da varsa onu kullan, yoksa öncekini koru
      if (newValues.extras !== undefined) {
        updated.extras = newValues.extras;
      } else if (!updated.extras) {
        updated.extras = [];
      }
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
    showToast('Eklenti uygulandı', 'success');
  }, [applyFunctions, showToast]);

  // Tavan kontrolü ile totals güncelleme
  const handleTotalsChange = useCallback((incomingTotals: { toplam: number; yil: number; ay: number; gun: number }) => {
    let updated = { ...incomingTotals };
    let wList: string[] = [];

    if (formValues?.endDate) {
      const tavan = findKidemTavan(new Date(formValues.endDate));

      if (tavan && updated.toplam > tavan) {
        updated.toplam = tavan;
        wList.push(
          `Toplam brüt ücret, dönemin kıdem tazminatı tavanı olan ${tavan.toLocaleString("tr-TR")} TL'yi aştığı için tavan seviyesine çekildi.`
        );
      }
    }

    setWarnings(wList);
    setTotals(updated);
  }, [formValues?.endDate]);
  
  // Hesaplamaları güncelle
  useEffect(() => {
    // Önce çalışma süresine göre toplam brüt kıdem tazminatını hesapla (ekstra hesaplamalar dahil)
    // Backend'den hesapla
    const calculateFromBackend = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/kidem/toplu-sozlesme`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brutUcret: formValues.brutUcret || "0",
            prim: formValues.prim || "0",
            ikramiye: formValues.ikramiye || "0",
            yol: formValues.yol || "0",
            yemek: formValues.yemek || "0",
            diger: formValues.diger || "0",
            extras: formValues.extras || [],
            totals: totals,
            exitDate: exitDate
          })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setBrutTazminat(result.data.brut || 0);
          setNetTazminat(result.data.net || 0);
        }
      } catch (error) {
        console.error("Kıdem tazminatı hesaplama hatası:", error);
      }
    };
    
    calculateFromBackend();
    setMatchedTavanState(matchedTavan);
    setTavanUygulandi(tavanUygulandiFlag || false);
    if (tavanUygulandiFlag && matchedTavan) {
      setTavanDegeri(matchedTavan.tutar);
    } else {
      setTavanDegeri(null);
    }
  }, [formValues, exitDate, totals]);

  // 1 yıl kontrolü - Diğer sayfalar için minimum çalışma süresi
  const kidemTazminatiHakkiYok = useMemo(() => {
    // totals.yil 0 ise kıdem tazminatı hakkı yok (1 yılın altında)
    return totals.yil === 0;
  }, [totals]);

  const brutNetDisplay =
    (totals.toplam || 0) * (totals.yil || 0) +
    ((totals.toplam || 0) / 12) * (totals.ay || 0) +
    ((totals.toplam || 0) / 365) * (totals.gun || 0);
  const damgaVergisi = brutNetDisplay * 0.00759;
  const netDisplay = brutNetDisplay - damgaVergisi;
  
  // Yazdırma işlemi
  const handlePrint = useCallback(() => {
    const content = document.querySelector('#kidem-print');
    if (!content) return;
    const clone = content.cloneNode(true) as HTMLElement;
    clone.id = 'print-root';
    document.body.appendChild(clone);
    window.print();
    document.body.removeChild(clone);
  }, []);
  
  // Kaydetme işlemi - Merkezi kayıt sistemini kullan
  const handleSave = useCallback(() => {
    const validation = validateSave(formValues);
    if (!validation.isValid) {
      showToast(validation.message, 'error');
      return;
    }
    
    const iseGiris = formValues.startDate || formValues.iseGiris || null;
    const istenCikis = formValues.exitDate || formValues.endDate || formValues.istenCikis || null;
    
    // Extras'ı garantile - eğer yoksa boş array kullan
    const formDataWithExtras = {
      ...formValues,
      extras: formValues.extras || [],
    };
    
    kaydetAc({
      hesapTuru: "kidem_toplu_sozlesme",
      veri: {
        data: {
          form: formDataWithExtras,
          results: {
            totals,
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
  }, [formValues, totals, brutTazminat, netTazminat, effectiveId, currentRecordName, kaydetAc, showToast]);
  
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
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id]);
  
  // Header butonları kaldırıldı

  return (
    <Layout 
      title=""
      description=""
      fluid
      hideHeader={true}
      pageKey="kidem-tazminati"
      noBackgroundColor={true}
    >
      {/* İçerik */}
      <div id="kidem-print" className="w-full max-w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <KidemTazminatiForm
              headerAction={
                <div className="flex items-center gap-2">
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
                    className="gap-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                    Yeni Hesapla
                  </Button>
                </div>
              }
              onTotalsChange={handleTotalsChange}
              appliedEklenti={appliedEklenti}
              onRequestEklenti={handleRequestEklenti}
              showEmploymentDates={true}
              showBrutInput={true}
              showPrimInput={true}
              showIkramiyeInput={true}
              showYolInput={true}
              showYemekInput={true}
              showExtras={true}
              showIhbarShortcut={false}
              ihbarRoute="toplu"
              onValuesChange={handleFormChange}
              initialExtras={formValues.extras || []}
            />
            
            {warnings.length > 0 && (
              <div className="p-3 bg-red-100 text-red-700 rounded mt-4 dark:bg-red-900/20 dark:text-red-300">
                {warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            
            {kidemTazminatiHakkiYok && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 soft-card">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                        Kıdem Tazminatı Hakkı Uyarısı
                      </p>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                        1 yılın (365 gün) altında çalışma süresine sahip olanlara kıdem tazminatı hakkı doğmaz. Toplam çalışma süreniz 1 yılın altında olduğu için kıdem tazminatı hesaplanamaz.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {tavanUygulandi && tavanDegeri && (
              <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 soft-card">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                        Tavan Uyarısı
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                        Hesaplanan kıdem tazminatı dönem tavanını aştığı için {fmt(tavanDegeri)} ₺ olarak sınırlandırılmıştır.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <ToplamHesaplama 
              toplam={totals.toplam} 
              yil={totals.yil} 
              ay={totals.ay} 
              gun={totals.gun} 
              onPrint={handlePrint}
              warnings={warnings}
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brüt'ten Net'e Çeviri</CardTitle>
                <CardDescription>Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Brüt Kıdem Tazminatı</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutNetDisplay)} ₺</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-red-600 dark:text-red-400">Damga Vergisi (Binde 7,59)</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)} ₺</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-base font-semibold text-red-600 dark:text-red-400">Net Kıdem Tazminatı</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{fmt(netDisplay)} ₺</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            {exitDate && (
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Çıkış Tarihi:</span> {new Date(exitDate).toLocaleDateString('tr-TR')} tarihinde işten ayrılan bir çalışanın hesaplaması yapılıyor.
                  </p>
                </CardContent>
              </Card>
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
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Kıdem Tazminatı",
          copyTargetId: "calc-table",
          renderContent: () => (
            <div>
              <div className="text-lg font-semibold mb-2">KIDEM TAZMİNATI HESAPLAMA</div>
              <div id="calc-table">
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as React.CSSProperties}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Alan</th>
                      <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>İşe Giriş</td>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>{formValues?.startDate || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>İşten Çıkış</td>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>{formValues?.endDate || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>Çıplak Brüt</td>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>{formValues?.brutUcret || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>Toplam Kıdem Tazminatı</td>
                      <td style={{border:'1px solid #ccc', padding:'6px'}}>{fmt(totals.toplam || 0)} ₺</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ),
        }}
      />
    </Layout>
  );
}
