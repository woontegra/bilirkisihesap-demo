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
const PAGE_TITLE = "Kötü Niyet Tazminatı";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };
const FORM_LABELS = { WEEK_RULE: "Hafta (geçici kural)", CALCULATION: "Hesap", BRUT: "Brüt", NET: "Net" };
const NOTE_TEXT_1 = "1- Kötü niyet tazminatından iş güvencesinden yararlanamayan işçiler yararlanabilir.";
const NOTE_TEXT_2 = "2- İhbar önelinin 3 katı tutarında hesaplama yapılır.";
const NOTE_TEXT_3 = "3- Borçlar Kanunu 434'üncü maddesinde düzenlenmiştir. İş Kanunu'nda yoktur, ancak Borçlar Kanununa tabi veya İş Kanunu'na tabi olsa dahi iş güvencesi kapsamı dışındaki çalışanlar için geçerlidir.";
const NOTE_TEXT_4 = "4- Hizmet sözleşmesinin fesih hakkının kötüye kullanılarak sona erdirildiği durumlarda işveren, işçiye fesih bildirim süresine ait ücretin 3 katı tutarında tazminat ödemekle yükümlüdür. Sözleşmenin belirsiz süreli olması gerekir.";
const NOTE_TEXT_5 = "5- İşverence yapılan feshin hangi andan itibaren kötü niyetli olduğu ölçütü Yargıtay kararlarında belirlenmiştir. Nitekim Yargıtay objektif iyi niyet kurallarına aykırılık ölçütüne başvurmaktadır. Tutar: İşçinin (giydirilmiş) ücreti esas alınır (193 sayılı Kanuna Göre; Kötü niyet tazminatı bir hizmet karşılığı ödenmeyip, tazminat mahiyetinde yapılan bir ödeme olduğundan gelir vergisi kesintisi yapılmaması gerekiyor. Ancak binde 7,59 oranında damga vergisi kesintisi yapılması gerekiyor.), süre olarak ihbar süresinin 3 katıdır";

// Helper functions & types (inline)
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
type Totals = { toplam: number; yil: number; ay: number; gun: number };

const validateKotuNiyetForm = (form: any) => {
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

export default function KotuNiyetIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const location = useLocation();
  const navState = (location.state as any) || {};
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("kotu-niyet");
  
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

  // Kötü niyet tazminatı hesaplama - Backend
  const [calculation, setCalculation] = useState({ weeks: 0, brutAmount: 0, damgaVergisi: 0, netAmount: 0 });

  useEffect(() => {
    if (totals.toplam > 0) {
      fetch(`${API_BASE_URL}/api/kotu-niyet/calculate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Tenant-Id": localStorage.getItem("tenant_id") || "1"
        },
        body: JSON.stringify({ totals, year: selectedYear })
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setCalculation(result.data);
          }
        })
        .catch(err => {
          console.error("Kötü niyet hesaplama hatası:", err);
          setCalculation({ weeks: 0, brutAmount: 0, damgaVergisi: 0, netAmount: 0 });
        });
    } else {
      setCalculation({ weeks: 0, brutAmount: 0, damgaVergisi: 0, netAmount: 0 });
    }
  }, [totals, selectedYear]);

  // API servis fonksiyonları - Kayıt yükleme
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
  const kotuNiyetReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return {
      title: "Kötü Niyet Tazminatı",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Aylık Toplam Ücret", value: totals.toplam ? `${fmtLocal(totals.toplam)} ₺` : "-" },
        { label: "İhbar Süresi (Hafta)", value: calculation.weeks.toString() },
        { label: "Hesaplama Formülü", value: `(${fmtLocal(totals.toplam || 0)} ₺ / 30 × ${calculation.weeks} × 7 × 3)` },
      ],
      customSections: [
        {
          title: "Kötü Niyet Tazminatı Hesaplama Detayı",
          content: (
            <div className="space-y-2 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-900 dark:text-blue-100 font-medium">
                  İhbar önelinin 3 katı tutarında hesaplama yapılır.
                </p>
              </div>
              <div className="space-y-1 mt-3">
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="text-gray-600">Günlük Ücret:</div>
                  <div className="text-right font-medium">{fmtLocal(totals.toplam || 0)} / 30 = {fmtLocal((totals.toplam || 0) / 30)}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="text-gray-600">İhbar Süresi Tutarı:</div>
                  <div className="text-right font-medium">{fmtLocal((totals.toplam || 0) / 30)} × {calculation.weeks} × 7 = {fmtLocal(((totals.toplam || 0) / 30) * calculation.weeks * 7)}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 pt-2 border-t">
                  <div className="text-gray-900 dark:text-gray-100 font-semibold">Kötü Niyet Tazminatı (×3):</div>
                  <div className="text-right font-semibold">{fmtLocal(calculation.brutAmount)} ₺</div>
                </div>
              </div>
            </div>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Kötü Niyet Tazminatı", value: `${fmtLocal(calculation.brutAmount)} ₺` },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(calculation.damgaVergisi)} ₺`, isDeduction: true },
          { label: "Net Kötü Niyet Tazminatı", value: `${fmtLocal(calculation.netAmount)} ₺`, isNet: true },
        ],
      },
    };
  }, [totals, calculation]);

  const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (kotuNiyetReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const gunlukUcret = (totals.toplam || 0) / 30;
    const ihbarTutari = gunlukUcret * calculation.weeks * 7;
    const hesaplamaRows: [string, string][] = [
      ["Günlük Ücret", `${fmtLocal(totals.toplam || 0)} / 30 = ${fmtLocal(gunlukUcret)}`],
      ["İhbar Süresi Tutarı", `${fmtLocal(gunlukUcret)} × ${calculation.weeks} × 7 = ${fmtLocal(ihbarTutari)}`],
      ["Kötü Niyet Tazminatı (×3)", `${fmtLocal(calculation.brutAmount)} ₺`],
    ];
    const n2 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: hesaplamaRows });
    sections.push({ id: "kotu-niyet-hesaplama", title: "Kötü Niyet Tazminatı Hesaplama Detayı", html: buildWordTable(n2.headers, n2.rows) });

    const gnd = kotuNiyetReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: kotuNiyetReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [kotuNiyetReportConfig, totals, calculation]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("kotu-niyet-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = kotuNiyetReportConfig.title;
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
  }, [kotuNiyetReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = validateKotuNiyetForm(totals);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showToastError(firstError);
        return;
      }

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "kotu_niyet_tazminati",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              totals,
            },
            results: {
              brutAmount: calculation.brutAmount,
              netAmount: calculation.netAmount,
              weeks: calculation.weeks,
              totals,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          calculation_type: "kotu_niyet_tazminati",
          brut_total: Number(calculation.brutAmount.toFixed(2)),
          net_total: Number(calculation.netAmount.toFixed(2)),
          totals,
          weeks: calculation.weeks,
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/kotu-niyet-tazminati/:id`,
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
        window.location.href = "/kotu-niyet-tazminati";
      }
    } catch {}
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="Kötü Niyet Tazminatı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="kotu-niyet"
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

        <div id="kotu-niyet-print" className="w-full space-y-6">
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
              customTitle="KÖTÜ NİYET TAZMİNATI HESAPLAMA"
              initialBrut={initialBrutFromNav}
              initialIseGiris={navState?.iseGiris}
              initialIstenCikis={navState?.istenCikis}
              initialPrim={navState?.prim}
              initialIkramiye={navState?.ikramiye}
              initialYol={navState?.yol}
              initialYemek={navState?.yemek}
            />

            {/* Kötü Niyet Tazminatı */}
            <div className="mt-4 p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {PAGE_TITLE}
              </h3>
              <div className="text-sm sm:text-base space-y-1">
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{FORM_LABELS.WEEK_RULE}:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {calculation.weeks} hafta
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{FORM_LABELS.CALCULATION}:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    ({fmt(totals.toplam || 0)} ₺ / 30 × {calculation.weeks} × 7 × 3)
                  </span>
                </p>
                <hr className="my-2 border-gray-200 dark:border-gray-600" />
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{FORM_LABELS.BRUT}:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(calculation.brutAmount)} ₺
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (Binde 7,59):</span>
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
              <p className="text-slate-600 dark:text-slate-300">{NOTE_TEXT_1}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">{NOTE_TEXT_2}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">{NOTE_TEXT_3}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">{NOTE_TEXT_4}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">{NOTE_TEXT_5}</p>
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
      <div id="kotu-niyet-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={kotuNiyetReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Kötü Niyet Tazminatı Rapor",
          copyTargetId: "kotu-niyet-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kotu-niyet-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #kotu-niyet-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="kotu-niyet-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Kötü Niyet Tazminatı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
