import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";

// Constants (inline)
const PAGE_TITLE = "İşe Başlatmama Tazminatı";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };
const FORM_LABELS = {
  BRUT: "Çıplak Brüt Ücret",
  BRUT_HINT: "(Dava tarihindeki emsal yazılabilir.)",
  NOTE: "Not",
  NOTE_PLACEHOLDER: "Not giriniz"
};

// Helper functions & types (inline)
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
type Row = { label: string; value: number; k: number };

const validateIseAlmamaForm = (form: any) => {
  const errors: string[] = [];
  if (!form.brut || parseNum(form.brut) <= 0) {
    errors.push("Geçerli bir brüt ücret giriniz");
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

export default function IseAlmamaIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("ise-almama");
  const [brut, setBrut] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [brutInputForNet, setBrutInputForNet] = useState(""); // Brüt-net çevirisi için manuel input
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Asgari ücret kontrolü
  const asgariUcretHatasi = useMemo(() => {
    if (!endDate || !brut) return null;
    
    const minUcret = getAsgariUcretByDate(endDate);
    if (!minUcret) return null;
    
    const brutValue = parseNum(brut);
    if (!brutValue || brutValue === 0) return null;
    
    if (brutValue < minUcret) {
      const year = new Date(endDate).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmt(minUcret)} ₺).`;
    }
    
    return null;
  }, [endDate, brut]);

  // Hesaplanan değerler
  const brutVal = useMemo(() => parseNum(brut), [brut]);
  // Backend hesaplama
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (brutVal > 0) {
      const tenantId = localStorage.getItem("tenant_id") || "1";
      console.log("[IseAlmama] Sending brutUcret:", brutVal, "type:", typeof brutVal, "tenantId:", tenantId);
      fetch(`${API_BASE_URL}/api/ise-almama/calculate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Tenant-Id": tenantId
        },
        body: JSON.stringify({ brutUcret: brutVal })
      })
        .then(res => {
          console.log("[IseAlmama] Response status:", res.status);
          return res.json();
        })
        .then(result => {
          console.log("[IseAlmama] Response data:", result);
          if (result.success && result.data) {
            setRows(result.data.rows || []);
          } else {
            console.error("[IseAlmama] API error:", result.error);
            setRows([]);
          }
        })
        .catch(err => {
          console.error("[IseAlmama] Request failed:", err);
          setRows([]);
        });
    } else {
      console.log("[IseAlmama] brutVal <= 0, clearing rows. brutVal:", brutVal);
      setRows([]);
    }
  }, [brutVal]);
  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);
  
  // Brüt-net çevirisi için kullanılacak tutar
  const brutForNetConversion = useMemo(() => {
    const inputVal = parseNum(brutInputForNet);
    return inputVal > 0 ? inputVal : (rows[rows.length - 1]?.value || 0);
  }, [brutInputForNet, rows]);

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
        
        // Form alanlarını yükle
        if (form.brut) {
          setBrut(form.brut);
        } else if (formData.brut) {
          setBrut(formData.brut);
        }
        
        if (form.startDate) {
          setStartDate(form.startDate);
        } else if (formData.startDate) {
          setStartDate(formData.startDate);
        }
        
        if (form.endDate) {
          setEndDate(form.endDate);
        } else if (formData.endDate) {
          setEndDate(formData.endDate);
        }
        
        if (form.brutInputForNet) {
          setBrutInputForNet(form.brutInputForNet);
        } else if (formData.brutInputForNet) {
          setBrutInputForNet(formData.brutInputForNet);
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
  const iseAlmamaReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const damgaVergisi = brutForNetConversion * 0.00759;
    const netTotal = brutForNetConversion * (1 - 0.00759);

    return {
      title: "İşe Başlatmama Tazminatı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Çıplak Brüt Ücret", value: brutVal ? `${fmtLocal(brutVal)} ₺` : "-" },
        { label: "İşe Giriş Tarihi", value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-", condition: !!startDate },
        { label: "İşten Çıkış Tarihi", value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-", condition: !!endDate },
        { label: "Çalışma Süresi", value: workPeriod?.label || "-", condition: !!workPeriod },
      ],
      periodData: rows.length > 0 ? {
        title: "İşe Başlatmama Tazminatı Hesaplama Detayı",
        headers: ["Katsayı", "Hesaplama", "Tutar"],
        rows: rows.map(row => [
          `${row.k}x`,
          `${fmtLocal(brutVal)} × ${row.k}`,
          `${fmtLocal(row.value)} ₺`,
        ]),
        alignRight: [2],
      } : undefined,
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt İşe Başlatmama Tazminatı", value: `${fmtLocal(brutForNetConversion)} ₺` },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)} ₺`, isDeduction: true },
          { label: "Net İşe Başlatmama Tazminatı", value: `${fmtLocal(netTotal)} ₺`, isNet: true },
        ],
      },
    };
  }, [brutVal, startDate, endDate, workPeriod, rows, brutForNetConversion]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const infoRowsFiltered = (iseAlmamaReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = iseAlmamaReportConfig.periodData;
    if (pd?.rows?.length) {
      const n2 = adaptToWordTable({ headers: pd.headers, rows: pd.rows });
      sections.push({ id: "ise-almama-hesaplama", title: pd.title || "İşe Başlatmama Tazminatı Hesaplama Detayı", html: buildWordTable(n2.headers, n2.rows) });
    }

    const gnd = iseAlmamaReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: iseAlmamaReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [iseAlmamaReportConfig]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("ise-almama-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = iseAlmamaReportConfig.title;
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
  }, [iseAlmamaReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = validateIseAlmamaForm(brut);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showToastError(firstError);
        return;
      }

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "ise_almama_tazminati",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              brut,
              startDate,
              endDate,
              brutInputForNet,
            },
            results: {
              rows: rows.map(r => ({ kat: r.k, amount: r.value })),
              maxAmount: rows[rows.length - 1]?.value || 0,
              brutForNetConversion,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          brut_total: Number((rows[rows.length - 1]?.value || 0).toFixed(2)),
          net_total: Number((brutForNetConversion * (1 - 0.00759)).toFixed(2)),
          brut,
          rows: rows.map(r => ({ kat: r.k, amount: r.value })),
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/ise-almama-tazminati/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = brut || startDate || endDate;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setBrut("");
      setStartDate("");
      setEndDate("");
      setBrutInputForNet("");
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/ise-almama-tazminati";
      }
    } catch {}
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="İşe Başlatmama Tazminatı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="ise-almama"
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

        <div id="ise-almama-print" className="w-full space-y-6">
          {/* Hesaplama */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
            <div className="space-y-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">İşe Giriş Tarihi</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setStartDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                        const newDate = new Date(newValue);
                        const exitDate = new Date(endDate);
                        if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                          showToastError("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">İşten Çıkış Tarihi</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setEndDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
                        const newDate = new Date(newValue);
                        const startDateObj = new Date(startDate);
                        if (!isNaN(newDate.getTime()) && !isNaN(startDateObj.getTime()) && newDate < startDateObj) {
                          showToastError("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Çalışma Süresi</label>
                  <div className="mt-1 h-11 px-3 flex items-center rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {workPeriod ? `${workPeriod.years} Yıl ${workPeriod.months} Ay ${workPeriod.days} Gün` : "-"}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {FORM_LABELS.BRUT}
                </label>
                <input
                  value={brut}
                  onChange={(e) => setBrut(e.target.value)}
                  placeholder="Örn: 25.000"
                  className={`w-full mt-1 rounded-xl h-11 font-medium px-3 text-sm ${
                    asgariUcretHatasi ? "border-2 border-red-500" : "border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  }`}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {FORM_LABELS.BRUT_HINT}
                </div>
                {asgariUcretHatasi && (
                  <div className="text-xs text-red-600 mt-1 font-medium">
                    {asgariUcretHatasi}
                  </div>
                )}
              </div>

              <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                {rows.map((r, i) => (
                  <div
                    key={r.k}
                    className={`grid grid-cols-2 items-center px-4 py-3 text-sm sm:text-base ${
                      i !== rows.length - 1 ? "border-b border-gray-200 dark:border-gray-600" : ""
                    }`}
                  >
                    <div className="text-gray-700 dark:text-gray-300">{r.label}</div>
                    <div className="text-right font-medium text-gray-900 dark:text-gray-100">
                      {fmt(r.value)} ₺
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Brütten Nete Çeviri */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Brüt'ten Net'e Çeviri</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.</p>
            
            {/* Manuel Input Alanı */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Brüt Tutar Giriniz (Opsiyonel)
              </label>
              <input
                type="text"
                value={brutInputForNet}
                onChange={(e) => setBrutInputForNet(e.target.value)}
                placeholder={`Varsayılan: ${fmt(rows[rows.length - 1]?.value || 0)}`}
                className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Boş bırakırsanız yukarıdaki hesaplamanın son satırı kullanılır.
              </p>
            </div>
              
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-sm text-gray-600 dark:text-gray-400">Brüt İşe Başlatmama Tazminatı</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutForNetConversion)} ₺</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-sm text-red-600 dark:text-red-400">Damga Vergisi (Binde 7,59)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(brutForNetConversion * 0.00759)} ₺</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-base font-semibold text-green-700 dark:text-green-400">Net İşe Başlatmama Tazminatı</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(brutForNetConversion * (1 - 0.00759))} ₺</span>
              </div>
            </div>
          </div>

          {/* Notlar */}
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
              <p className="text-slate-600 dark:text-slate-300">
                İşe başlatmama tazminatının hesaplamasına ilişkin olarak hesaplama;
                (Yargıtay 9. Hukuk Dairesi 2019/2672 E., 2019/6911 K.) işe başlatmama
                tazminatı hesabında işçinin kıdemi esas alınmaktadır. Tazminat tutarı
                tercihleriniz ve hesaplamasını bu kriterlere göre tespit edebilirsiniz.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="ise-almama-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={iseAlmamaReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "İşe Başlatmama Tazminatı Rapor",
          copyTargetId: "ise-almama-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ise-almama-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ise-almama-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ise-almama-word-copy">
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
          onPdf: () => downloadPdfFromDOM("İşe Başlatmama Tazminatı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
