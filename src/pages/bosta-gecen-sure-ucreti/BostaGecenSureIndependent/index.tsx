import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import KidemTazminatiForm from "@/pages/is-tazminati/KidemTazminatiForm";
import EklentiModal from "@/pages/is-tazminati/EklentiModal";

// Constants (inline)
const PAGE_TITLE = "Boşta Geçen Süre Ücreti";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };
const FORM_LABELS = { BRUT: "Brüt Ücret", NET: "Net", NOTE: "Not", NOTE_PLACEHOLDER: "Not giriniz" };
const NOTE_TEXT = "İşverenin haksız feshi nedeniyle işçinin yeni iş bulana kadar geçen sürede uğradığı kazanç kaybını karşılamak için ödenen tazminattır. İş güvencesi kapsamındaki işçiler için geçerlidir ve genellikle 4 aylık brüt ücret tutarında hesaplanır.";

// Helper functions & types (inline)
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
type Totals = { toplam: number; yil: number; ay: number; gun: number };

const validateBostaGecenSureForm = (form: any) => {
  const errors: string[] = [];
  if (!form.totals || !form.totals.toplam || form.totals.toplam <= 0) {
    errors.push("Geçerli bir toplam ücret giriniz");
  }
  return { isValid: errors.length === 0, errors };
};
import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

export default function BostaGecenSureIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const location = useLocation();
  const navState = (location.state as any) || {};
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("bosta-gecen-sure");
  
  const [totals, setTotals] = useState<Totals>({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Eklenti modal durumu
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("Eklenti Hesaplama");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [applyFn, setApplyFn] = useState<(v: number) => void>(() => () => {});

  // Nav state'ten başlangıç değerleri
  const initialBrutFromNav = useMemo(() => {
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar;
      const val = Number(isNaN(fromQuery) ? fromState : fromQuery);
      if (!val || !isFinite(val)) return undefined;
      return String(val.toFixed(2)).replace(".", ",");
    } catch {
      return undefined;
    }
  }, [location.search, location.state, navState]);

  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    const exitDateStr = navState?.istenCikis || "";
    if (exitDateStr && exitDateStr.trim() !== "") {
      try {
        const exitDate = new Date(exitDateStr);
        if (!isNaN(exitDate.getTime())) {
          const year = exitDate.getFullYear();
          if (year >= 2010 && year <= 2030) {
            return year;
          }
        }
      } catch {
        // Hata durumunda mevcut yılı kullan
      }
    }
    return new Date().getFullYear();
  }, [navState?.istenCikis]);

  // Boşta geçen süre ücreti hesaplama - Backend
  const [calculation, setCalculation] = useState({ brutAmount: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, netAmount: 0 });

  useEffect(() => {
    if (totals.toplam > 0) {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      fetch(`${API_BASE_URL}/api/bosta-gecen-sure/calculate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": String(tenantId)
        },
        body: JSON.stringify({ totals, year: selectedYear })
      })
        .then(res => res.json())
        .then(result => {
          console.log("[BostaGecenSure] API Response:", result);
          if (result.success && result.data) {
            setCalculation({
              brutAmount: result.data.brutAmount || 0,
              sgk: result.data.sgk || 0,
              issizlik: result.data.issizlik || 0,
              gelirVergisi: result.data.gelirVergisi || 0,
              gelirVergisiDilimleri: result.data.gelirVergisiDilimleri || "",
              damgaVergisi: result.data.damgaVergisi || 0,
              netAmount: result.data.netAmount || 0
            });
          } else {
            console.error("[BostaGecenSure] API Error:", result.error);
            setCalculation({ brutAmount: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, netAmount: 0 });
          }
        })
        .catch(err => {
          console.error("Boşta geçen süre hesaplama hatası:", err);
          setCalculation({ brutAmount: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, netAmount: 0 });
        });
    } else {
      setCalculation({ brutAmount: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, netAmount: 0 });
    }
  }, [totals, selectedYear]);

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      // API_BASE_URL already imported from @/utils/apiClient
      
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
        notes: data.notes || data.aciklama || "",
        brut_total: data.brut_total || payload.brut_total || payload.total,
        net_total: data.net_total || payload.net_total || payload.total,
      };
    } catch (err: any) {
      console.error('Kayıt yükleme hatası:', err);
      throw err;
    }
  };

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    if (!id) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;
        
        const data = await loadCalculation(id);
        
        if (!isMounted) return;
        
        // Form alanlarını doldur
        const formData = data.formValues || data.data || {};
        
        // Yeni format: data.form içinde form verileri
        const form = formData.form || formData.data?.form || formData;
        const results = formData.results || formData.data?.results || {};
        
        // Totals verilerini yükle
        if (form.totals) {
          setTotals(form.totals);
        } else if (formData.totals) {
          setTotals(formData.totals);
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        success(`Kayıt yüklendi (#${id})`);
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

  // YENİ RAPOR SİSTEMİ: Config
  const bostaGecenSureReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return {
      title: "Boşta Geçen Süre Ücreti",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Aylık Toplam Ücret", value: totals.toplam ? `${fmtLocal(totals.toplam)} ₺` : "-" },
        { label: "Hesaplama Süresi", value: "4 Ay" },
        { label: "Brüt Boşta Geçen Süre Ücreti", value: calculation.brutAmount ? `${fmtLocal(calculation.brutAmount)} ₺` : "-" },
      ],
      customSections: [
        {
          title: "Boşta Geçen Süre Ücreti Hesaplama Detayı",
          content: (
            <div className="space-y-2 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-900 dark:text-blue-100 font-medium">
                  İş güvencesi kapsamındaki işçiler için geçerlidir ve genellikle 4 aylık brüt ücret tutarında hesaplanır.
                </p>
              </div>
              <div className="w-full space-y-6">
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="text-gray-600">Aylık Toplam Ücret:</div>
                  <div className="text-right font-medium">{fmtLocal(totals.toplam || 0)} ₺</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="text-gray-600">Hesaplama Süresi:</div>
                  <div className="text-right font-medium">4 Ay</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 pt-2 border-t">
                  <div className="text-gray-900 font-semibold">Brüt Boşta Geçen Süre Ücreti:</div>
                  <div className="text-right font-semibold">{fmtLocal(totals.toplam || 0)} ₺ × 4 = {fmtLocal(calculation.brutAmount)} ₺</div>
                </div>
              </div>
            </div>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Boşta Geçen Süre Ücreti", value: `${fmtLocal(calculation.brutAmount)} ₺` },
          { label: "SGK Primi (%14)", value: `-${fmtLocal(calculation.sgk)} ₺`, isDeduction: true },
          { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(calculation.issizlik)} ₺`, isDeduction: true },
          { label: `Gelir Vergisi ${calculation.gelirVergisiDilimleri}`, value: `-${fmtLocal(calculation.gelirVergisi)} ₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(calculation.damgaVergisi)} ₺`, isDeduction: true },
          { label: "Net Boşta Geçen Süre Ücreti", value: `${fmtLocal(calculation.netAmount)} ₺`, isNet: true },
        ],
      },
    };
  }, [totals, calculation]);

  const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (bostaGecenSureReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const hesaplamaRows: [string, string][] = [
      ["Aylık Toplam Ücret", `${fmtLocal(totals.toplam || 0)} ₺`],
      ["Hesaplama Süresi", "4 Ay"],
      ["Brüt Boşta Geçen Süre Ücreti", `${fmtLocal(totals.toplam || 0)} ₺ × 4 = ${fmtLocal(calculation.brutAmount)} ₺`],
    ];
    const n2 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: hesaplamaRows });
    sections.push({ id: "bosta-gecen-sure-hesaplama", title: "Boşta Geçen Süre Ücreti Hesaplama Detayı", html: buildWordTable(n2.headers, n2.rows) });

    const gnd = bostaGecenSureReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: bostaGecenSureReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [bostaGecenSureReportConfig, totals, calculation]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("bosta-gecen-sure-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = bostaGecenSureReportConfig.title;
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
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  }, [bostaGecenSureReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = validateBostaGecenSureForm(totals);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showToastError(firstError);
        return;
      }

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "bosta_gecen_sure_ucreti",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              totals,
            },
            results: {
              brutAmount: calculation.brutAmount,
              netAmount: calculation.netAmount,
              sgk: calculation.sgk,
              issizlik: calculation.issizlik,
              gelirVergisi: calculation.gelirVergisi,
              damgaVergisi: calculation.damgaVergisi,
              totals,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          brut_total: Number(calculation.brutAmount.toFixed(2)),
          net_total: Number(calculation.netAmount.toFixed(2)),
          totals,
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/bosta-gecen-sure-ucreti/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = totals.toplam > 0 || totals.yil > 0 || totals.ay > 0 || totals.gun > 0;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
      setEklentiValues({});
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/bosta-gecen-sure-ucreti";
      }
    } catch {}
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="Boşta Geçen Süre Ücreti Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="bosta-gecen-sure"
      noBackgroundColor={true}
      headerRight={
        videoLink ? (
          <Button
            onClick={() => window.open(videoLink, "_blank")}
            variant="outline"
            className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <Youtube className="h-4 w-4" />
            Kullanım Videosu
          </Button>
        ) : undefined
      }
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {videoLink && (
            <div className="mb-8 flex justify-end">
              <Button
                onClick={() => window.open(videoLink, "_blank")}
                variant="outline"
                className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              >
                <Youtube className="h-4 w-4" />
                Kullanım Videosu
              </Button>
            </div>
          )}

        <div id="bosta-print" className="w-full space-y-6">
          <div className="w-full">
            <KidemTazminatiForm
              onTotalsChange={setTotals}
              onRequestEklenti={(fieldKey, title, apply) => {
                setActiveField(fieldKey);
                setModalTitle(title || "Eklenti Hesaplama");
                setApplyFn(() => (v: number) => {
                  apply(v);
                });
                setModalOpen(true);
              }}
              showIhbarShortcut={false}
              hideEmploymentDates
              customTitle={`${PAGE_TITLE.toUpperCase()} HESAPLAMA`}
              initialBrut={initialBrutFromNav}
              initialIseGiris={navState?.iseGiris}
              initialIstenCikis={navState?.istenCikis}
              initialPrim={navState?.prim}
              initialIkramiye={navState?.ikramiye}
              initialYol={navState?.yol}
              initialYemek={navState?.yemek}
              extraCalculationsLabel="Ekstra Hesaplamalar (Prim, İkramiye, Yemek vb.)"
            />

            {/* Hesap bloğu */}
            <div className="mt-4 p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Brüt'ten Net'e Çeviri
              </h3>
              <div className="text-sm sm:text-base space-y-1">
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{FORM_LABELS.BRUT}:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(calculation.brutAmount)} ₺
                  </span>
                </p>
                <hr className="my-2 border-gray-200 dark:border-gray-600" />
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14):</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -{fmt(calculation.sgk)} ₺
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1):</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -{fmt(calculation.issizlik)} ₺
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {calculation.gelirVergisiDilimleri}:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -{fmt(calculation.gelirVergisi)} ₺
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59):</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -{fmt(calculation.damgaVergisi)} ₺
                  </span>
                </p>
                <hr className="my-2 border-gray-200 dark:border-gray-600" />
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{FORM_LABELS.NET}:</span>
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {fmt(calculation.netAmount)} ₺
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6">
              <div className="text-red-600 dark:text-red-400 font-semibold text-base sm:text-lg">
                {NOTE_TEXT}
              </div>
            </div>
          </div>
        </div>
        </div>

        <EklentiModal
          open={modalOpen}
          title={modalTitle}
          months={activeField ? eklentiValues[activeField] : undefined}
          onClose={() => setModalOpen(false)}
          onMonthsChange={(i, val) => {
            if (!activeField) return;
            setEklentiValues((prev) => {
              const arr = prev[activeField] ?? Array(12).fill("");
              const next = arr.slice();
              next[i] = val;
              return { ...prev, [activeField]: next };
            });
          }}
          onApply={(v) => {
            applyFn(v);
            setModalOpen(false);
            info("Eklenti hesaplandı", "Seçili kaleme uygulandı");
          }}
        />
      </div>

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="bosta-gecen-sure-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={bostaGecenSureReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Boşta Geçen Süre Ücreti Rapor",
          copyTargetId: "bosta-gecen-sure-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #bosta-gecen-sure-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #bosta-gecen-sure-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="bosta-gecen-sure-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Boşta Geçen Süre Ücreti Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
