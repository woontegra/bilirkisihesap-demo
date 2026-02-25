import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy } from "lucide-react";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
// Constants (inline)
const NOTE_TEXT = `Basın Mesleğinde Çalışanlarla Çalıştıranlar Arasındaki Münasebetlerin Tanzimi Hakkında Kanun (Basın İş Kanunu) nun "Yıllık ücretli izin" başlıklı 21. Maddesi "(Değişik: 4/1/1961 - 212/1 md.)

Günlük bir mevkutede çalışan bir gazeteciye, en az bir yıl çalışmış olmak şartiyle, yılda dört hafta tam ücretli izin verilir. Gazetecilik mesleğindeki hizmeti on yıldan yukarı olan bir gazeteciye, altı hafta ücretli izin verilir. Gazetecinin kıdemi aynı gazetedeki hizmetine göre değil, meslekteki hizmet süresine göre hesaplanır.

Günlük olmayan mevkutelerde çalışan gazetecilere her altı aylık çalışma devresi için iki hafta ücretli izin verilir. Yıllık ücretli izinlerin hesabında bu Kanunun 1 inci maddesindeki "Gazeteci" tabirine girenlerin kıdemleri, iş akdinin devam etmiş veya fasılalarla yeniden inikat etmiş olmasına bakılmaksızın, gazetecilik mesleğinde geçirdikleri hizmet süresi nazara alınmak suretiyle tesbit edilir.

İzin hakkından feragat edilemez." Şeklinde düzenlenmiştir.`;
const REPORT_TITLE = "Yıllık Ücretli İzin Hesaplama - Basın (Günlük Olmayan)";
const SAVE_TYPE = "yillik_izin_basin_gunluk_olmayan";
const DOCUMENT_TITLE = "Yıllık Ücretli İzin Hesaplama";

// Helper functions & types (inline)
type UsedRow = { id: string; start: string; end: string; days: string };

const createEmptyRow = (): UsedRow => ({
  id: Math.random().toString(36).slice(2),
  start: "",
  end: "",
  days: "",
});

const createInitialRows = (count = 7): UsedRow[] =>
  Array.from({ length: count }, () => createEmptyRow());

const toDays = (value: string) =>
  Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const calculateUsedTotal = (rows: UsedRow[]) =>
  rows.reduce((acc, row) => acc + toDays(row.days), 0);

const validateSave = (data: any) => {
  const errors: string[] = [];
  if (!data.meslegeBaslangic) errors.push("Mesleğe başlangıç tarihi gerekli");
  if (!data.istenCikis) errors.push("İşten çıkış tarihi gerekli");
  if (!data.brutUcret || toDays(data.brutUcret) <= 0) errors.push("Geçerli bir brüt ücret giriniz");
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

export default function GunlukOlmayanYillikIzinPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Dates and duration
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [employerPayment, setEmployerPayment] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: UsedRow[]; createdAt: string }[]>([]);
  const loadRanRef = useRef<boolean>(false);

  // Gazeteci türü değiştiğinde yönlendirme
  const handleGazeteciTuruChange = useCallback((value: string) => {
    if (value === "gunluk") {
      navigate("/yillik-izin/basin");
    }
  }, [navigate]);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (id: string, patch: Partial<UsedRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // İşyerindeki çalışma süresi
  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  // Backend hesaplama
  const [izinHesaplama, setIzinHesaplama] = useState({ izinGun: 0, devre: 0, toplamAy: 0, hafta: 0 });
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);

  const usedTotal = useMemo(() => calculateUsedTotal(rows), [rows]);
  const totalEntitlement = izinHesaplama.izinGun || 0;

  const selectedYear = useMemo(() => {
    if (istenCikis) {
      const year = new Date(istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [istenCikis]);

  const asgariUcretHatasi = useMemo(() => {
    if (!istenCikis || !brutUcret) return null;
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(istenCikis);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(istenCikis).getFullYear();
      return { mesaj: `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺).`, asgariUcret: asgariUcret };
    }
    return null;
  }, [istenCikis, brutUcret]);

  useEffect(() => {
    if (iseGiris && istenCikis && toDays(brutUcret) > 0) {
      fetch(`${API_BASE_URL}/api/yillik-izin-basin-gunluk-olmayan/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meslegeBaslangic: iseGiris,
          istenCikis: istenCikis,
          brutUcret: toDays(brutUcret),
          usedDays: usedTotal,
          year: selectedYear
        })
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setIzinHesaplama({
              izinGun: result.data.izinGun,
              devre: result.data.devre,
              toplamAy: result.data.toplamAy,
              hafta: result.data.hafta
            });
            setRemainingDays(result.data.remainingDays);
            setBrutIzin(result.data.brutIzin);
            setSgk(result.data.sgk);
            setIssizlik(result.data.issizlik);
            setGelirVergisi(result.data.gelirVergisi);
            setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
            setDamgaVergisi(result.data.damgaVergisi);
            setNetIzin(result.data.netIzin);
          }
        })
        .catch(err => {
          console.error("Yıllık izin hesaplama hatası:", err);
          setIzinHesaplama({ izinGun: 0, devre: 0, toplamAy: 0, hafta: 0 });
          setRemainingDays(0);
          setBrutIzin(0);
          setSgk(0);
          setIssizlik(0);
          setGelirVergisi(0);
          setDamgaVergisi(0);
          setNetIzin(0);
        });
    } else {
      setIzinHesaplama({ izinGun: 0, devre: 0, toplamAy: 0, hafta: 0 });
      setRemainingDays(0);
      setBrutIzin(0);
      setSgk(0);
      setIssizlik(0);
      setGelirVergisi(0);
      setDamgaVergisi(0);
      setNetIzin(0);
    }
  }, [iseGiris, istenCikis, brutUcret, usedTotal, selectedYear]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const API_BASE = API_BASE_URL;
      
      const response = await fetch(`${API_BASE}/api/saved-cases/${loadId}`, {
        headers: {
          "x-tenant-id": String(tenantId)
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Kayıt bulunamadı (ID: ${loadId}).`);
        }
        throw new Error(data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`);
      }
      
      let payload = {};
      
      if (data.data) {
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
        data: payload,
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
        
        const formData = data.formValues || data.data || {};
        const form = formData.form || formData.data?.form || formData;
        
        if (form.iseGiris || form.ise_giris) {
          setIseGiris(form.iseGiris || form.ise_giris);
        } else if (formData.iseGiris || formData.ise_giris) {
          setIseGiris(formData.iseGiris || formData.ise_giris);
        }
        
        if (form.istenCikis || form.isten_cikis) {
          setIstenCikis(form.istenCikis || form.isten_cikis);
        } else if (formData.istenCikis || formData.isten_cikis) {
          setIstenCikis(formData.istenCikis || formData.isten_cikis);
        }
        
        if (form.brutUcret || form.brut_ucret) {
          setBrutUcret(form.brutUcret || form.brut_ucret);
        } else if (formData.brutUcret || formData.brut_ucret) {
          setBrutUcret(formData.brutUcret || formData.brut_ucret);
        }
        
        if (form.rows) {
          setRows(form.rows);
        } else if (formData.rows) {
          setRows(formData.rows);
        }
        
        if (form.employerPayment || form.employer_payment) {
          setEmployerPayment(form.employerPayment || form.employer_payment || "");
        } else if (formData.employerPayment || formData.employer_payment) {
          setEmployerPayment(formData.employerPayment || formData.employer_payment || "");
        } else if (formData.eklentiler?.employer_payment) {
          setEmployerPayment(formData.eklentiler.employer_payment || "");
        }
        
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
  const gunlukOlmayanReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, "").replace(",", ".")) || 0;
    const mahsuplasmaSonucu = Math.max(0, brutIzin - employerPaymentNum);

    return {
      title: "Yıllık Ücretli İzin",
      sections: {
        info: true,
        periodTable: false,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: diff.label || "-" },
        { label: "Gazete Türü", value: "Günlük Olmayan" },
        { label: "Brüt Ücret", value: brutUcret ? `${fmtLocal(toDays(brutUcret))}₺` : "-" },
      ],
      customSections: [
        {
          title: "Yıllık İzin Hak Edişi (Basın İşçileri - Günlük Olmayan)",
          content: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Dönem</th>
                  <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Gün/Hafta</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px" }}>2 Hafta × {izinHesaplama.devre} devre</td>
                  <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{izinHesaplama.hafta} hafta</td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={{ padding: "8px" }}>Toplam Hak Edilen</td>
                  <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{totalEntitlement} gün ({izinHesaplama.hafta} hafta)</td>
                </tr>
                <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                  <td style={{ padding: "8px" }}>Kullanılan İzin</td>
                  <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{usedTotal} gün</td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#dcfce7" }}>
                  <td style={{ padding: "8px" }}>Kalan İzin</td>
                  <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{remainingDays} gün</td>
                </tr>
              </tbody>
            </table>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutIzin)}₺` },
          { label: "SGK İşçi Primi (%14)", value: `-${fmtLocal(sgk)}₺`, isDeduction: true },
          { label: "İşsizlik Sigortası Primi (%1)", value: `-${fmtLocal(issizlik)}₺`, isDeduction: true },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net Yıllık İzin Alacağı", value: `${fmtLocal(netIzin)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutIzin)}₺` },
          { label: "İşveren Ödemesi", value: `-${fmtLocal(employerPaymentNum)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmtLocal(mahsuplasmaSonucu)}₺`,
        },
      },
    };
  }, [iseGiris, istenCikis, diff, brutUcret, izinHesaplama, totalEntitlement, usedTotal, remainingDays, brutIzin, sgk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netIzin, employerPayment]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    if (gunlukOlmayanReportConfig.infoRows && gunlukOlmayanReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: gunlukOlmayanReportConfig.infoRows.map((r) => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const hakRows: string[][] = [
      [`2 Hafta × ${izinHesaplama.devre} devre`, `${izinHesaplama.hafta} hafta`],
      ["Toplam Hak Edilen", `${totalEntitlement} gün (${izinHesaplama.hafta} hafta)`],
      ["Kullanılan İzin", `${usedTotal} gün`],
      ["Kalan İzin", `${remainingDays} gün`],
    ];
    const n2 = adaptToWordTable({ headers: ["Dönem", "Gün/Hafta"], rows: hakRows });
    sections.push({ id: "yillik-izin-hak-edisi", title: "Yıllık İzin Hak Edişi (Basın İşçileri - Günlük Olmayan)", html: buildWordTable(n2.headers, n2.rows) });

    const gnd = gunlukOlmayanReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    const md = gunlukOlmayanReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n4 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n4.headers, n4.rows) });
    }

    return sections;
  }, [gunlukOlmayanReportConfig, izinHesaplama, totalEntitlement, usedTotal, remainingDays]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("gunluk-olmayan-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = gunlukOlmayanReportConfig.title;
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
  }, [gunlukOlmayanReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = validateSave({
        iseGiris,
        istenCikis,
        remainingDays,
        brutIzin,
      });
      if (!validation.isValid) {
        showToastError(validation.message);
        return;
      }

      kaydetAc({
        hesapTuru: "yillik_izin_basin_gunluk_olmayan",
        veri: {
          data: {
            form: {
              iseGiris,
              istenCikis,
              brutUcret,
              rows,
              employerPayment,
            },
            results: {
              izinHesaplama,
              totalEntitlement,
              usedTotal,
              remainingDays,
              brutIzin,
              sgk,
              issizlik,
              gelirVergisi,
              damgaVergisi,
              netIzin,
            }
          },
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutIzin.toFixed(2)),
          net_toplam: Number(netIzin.toFixed(2)),
          ise_giris: iseGiris || null,
          isten_cikis: istenCikis || null,
          eklentiler: { employer_payment: employerPayment }
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `/yillik-izin/basin/gunluk-olmayan/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      const hasUnsavedChanges = iseGiris || istenCikis || brutUcret || rows.some(r => r.start || r.end || r.days) || employerPayment;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      setIseGiris("");
      setIstenCikis("");
      setBrutUcret("");
      setRows(() => createInitialRows(7));
      setEmployerPayment("");
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      if (id) {
        window.location.href = "/yillik-izin/basin/gunluk-olmayan";
      }
    } catch {}
  };

  return (
    <Layout 
      fluid 
      hideHeader={true} 
      pageKey="yillik-izin" 
      noBackgroundColor={true}
    >
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="gunluk-olmayan-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={gunlukOlmayanReportConfig} />
      </div>

      <div className="min-h-screen px-6 py-8 page-background">
        {/* Yeni Hesapla Butonu */}
        <div className="mb-4 flex justify-end">
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
        <div className="w-full space-y-6">
          <div className="space-y-6">
            <div className="soft-card" style={{ padding: '20px' }}>
              {/* Gazeteci Türü Dropdown */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700">Gazeteci Türü</label>
                <select
                  value="gunlukOlmayan"
                  onChange={(e) => handleGazeteciTuruChange(e.target.value)}
                  className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="gunluk">Günlük Gazete</option>
                  <option value="gunlukOlmayan">Günlük Olmayan</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">İşe Giriş Tarihi</label>
                  <input 
                    type="date" 
                    value={iseGiris} 
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
                      setIseGiris(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                        const newDate = new Date(newValue);
                        const exitDate = new Date(istenCikis);
                        if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                          showToastError("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">İşten Çıkış Tarihi</label>
                  <input 
                    type="date" 
                    value={istenCikis} 
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
                      setIstenCikis(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                        const newDate = new Date(newValue);
                        const entryDate = new Date(iseGiris);
                        if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                          showToastError("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" 
                  />
                </div>
              </div>

              {/* Çalışma Süresi */}
              <div className="mt-3">
                <label className="text-sm font-medium text-gray-700">Çalışma Süresi</label>
                <input disabled value={diff.label} className="w-full mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
              </div>

              {/* Annual leave calculation */}
              <div className="p-3 rounded-md border bg-gray-50 mt-6">
                <div className="text-sm text-gray-700 font-medium mb-2">Yıllık İzin Hesaplama</div>
                <div className="text-sm text-gray-800 space-y-1">
                  <div>2 Hafta × {izinHesaplama.devre || 0} = <span className="font-semibold">{izinHesaplama.hafta || 0} Hafta</span></div>
                  <div className="mt-2 border-t pt-2 font-semibold">Toplam = {izinHesaplama.izinGun} gün</div>
                </div>
                <div className="mt-3 text-base sm:text-lg font-semibold text-gray-900">Toplam Yıllık İzin Hakkı: {totalEntitlement} Gün</div>
              </div>

              {/* Accordion for used leaves */}
              <div className="border rounded-md">
                <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
                  <button type="button" onClick={() => setAccordionOpen((s)=>!s)} className="flex items-center gap-2">
                    <span>Kullanılan İzinleri Dışla</span>
                    <svg className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div className="flex gap-2 items-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setExclusionSaveName(""); setShowExclusionSaveModal(true); }} disabled={rows.every(r => !r.start || !r.end)} className="inline-flex items-center gap-1">Kaydet<span className="text-blue-800 hover:text-blue-900 cursor-help" title="Girdiğiniz kullanılan izin günlerini bir isim vererek kaydedin. Başka hesaplamalarda tekrar kullanabilirsiniz.">ⓘ</span></Button>
                    <Button type="button" variant="outline" size="sm" onClick={async () => { const sets = await getAllExclusionSets(); const setsWithCalculatedDays = sets.map(set => ({ ...set, data: set.data.map(row => { if (row.start && row.end && (!row.days || row.days === "0" || row.days === "")) { const startDate = new Date(row.start); const endDate = new Date(row.end); if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) { const diffTime = Math.abs(endDate.getTime() - startDate.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; return { ...row, days: String(diffDays) }; } } return row; }) })); setSavedExclusionSets(setsWithCalculatedDays); setShowExclusionLoadModal(true); }} className="inline-flex items-center gap-1">İçe Aktar<span className="text-blue-800 hover:text-blue-900 cursor-help" title="Daha önce kaydettiğiniz kullanılan izin günlerini yükleyin. Aynı davacı için farklı hesaplamalarda zaman kazandırır.">ⓘ</span></Button>
                  </div>
                </div>
                {accordionOpen && (
                  <div className="px-3 pb-3">
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600">
                            <th className="py-2 pr-2">İzin Başlangıç Tarihi</th>
                            <th className="py-2 pr-2">İzin Bitiş Tarihi</th>
                            <th className="py-2 pr-2">Kullanılan Gün</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2 pr-2">
                                <input 
                                  type="date" 
                                  value={r.start} 
                                  onChange={(e)=>setRow(r.id,{start:e.target.value})}
                                  onBlur={(e) => {
                                    const newValue = e.target.value;
                                    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && r.end && /^\d{4}-\d{2}-\d{2}$/.test(r.end)) {
                                      const newDate = new Date(newValue);
                                      const endDate = new Date(r.end);
                                      if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                                        showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                                      }
                                    }
                                  }}
                                  className="w-full rounded-md border border-gray-200 px-2 py-1" 
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input 
                                  type="date" 
                                  value={r.end} 
                                  onChange={(e)=>setRow(r.id,{end:e.target.value})}
                                  onBlur={(e) => {
                                    const newValue = e.target.value;
                                    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && r.start && /^\d{4}-\d{2}-\d{2}$/.test(r.start)) {
                                      const newDate = new Date(newValue);
                                      const startDate = new Date(r.start);
                                      if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                                        showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                                      }
                                    }
                                  }}
                                  className="w-full rounded-md border border-gray-200 px-2 py-1" 
                                />
                              </td>
                              <td className="py-2 pr-2"><input value={r.days} onChange={(e)=>setRow(r.id,{days:e.target.value})} placeholder="Örn: 5" className="w-full rounded-md border border-gray-200 px-2 py-1" /></td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={3} className="pt-2">
                              <button type="button" onClick={addRow} className="text-blue-600 hover:text-blue-800 text-sm font-medium">+ Satır Ekle</button>
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} className="py-2 text-right font-medium">TOPLAM</td>
                            <td className="py-2 font-semibold">{usedTotal} gün</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-2 text-sm sm:text-base font-semibold">Kalan İzin Hakkı: {remainingDays} Gün</div>
                  </div>
                )}
              </div>

              {/* Gross to net */}
              <div className="mt-3 p-4 rounded-lg bg-white border border-gray-200">
                <label className="text-sm font-medium text-gray-700">Çıplak Brüt Ücret</label>
                <input 
                  value={brutUcret} 
                  onChange={(e)=>setBrutUcret(e.target.value)} 
                  placeholder="Örn: 25.000,00" 
                  className={`w-full mt-1 rounded-md border px-3 py-2 text-sm ${
                    asgariUcretHatasi 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-200'
                  }`} 
                />
                {asgariUcretHatasi && (
                  <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>
                )}
                
                <div className="text-sm font-medium text-gray-700 mt-3 mb-2">Brütten Nete Çevir</div>
                <div className="space-y-2 pt-3 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">Brüt Yıllık İzin Ücreti</span>
                    <span className="font-semibold text-gray-900">{fmt(brutIzin)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">SGK Primi (%14)</span>
                    <span className="font-semibold text-red-600">-{fmt(sgk)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">İşsizlik Primi (%1)</span>
                    <span className="font-semibold text-red-600">-{fmt(issizlik)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">Gelir Vergisi {gelirVergisiDilimleri}</span>
                    <span className="font-semibold text-red-600">-{fmt(gelirVergisi)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                    <span className="font-semibold text-red-600">-{fmt(damgaVergisi)}₺</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-green-700">Net Yıllık İzin Ücreti</span>
                    <span className="text-sm font-bold text-green-700">{fmt(netIzin)}₺</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm sm:text-base">
                  <div className="flex items-center justify-between">
                    <span>Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödemedir</span>
                    <input
                      value={employerPayment}
                      onChange={(e)=>setEmployerPayment(e.target.value)}
                      placeholder="Örn: 10.000"
                      className="w-40 sm:w-56 rounded-md border border-gray-200 px-3 py-1 text-sm text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6 notes-content">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Not: Basın İş Kanunu – Yıllık İzin 21. Madde</div>
              <div className="space-y-2 text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {NOTE_TEXT}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: REPORT_TITLE,
          copyTargetId: "gunluk-olmayan-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #gunluk-olmayan-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #gunluk-olmayan-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="gunluk-olmayan-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Basın Günlük Olmayan Yıllık Ücretli İzin Rapor", "report-content"),
        }}
      />
      {showExclusionSaveModal && createPortal(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionSaveModal(false)}><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}><h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan İzinleri Kaydet</h3><div className="mb-4"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste Adı</label><input type="text" placeholder="Örn: Davacı A - Kullanılan İzinler" value={exclusionSaveName} onChange={(e) => setExclusionSaveName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm dark:bg-slate-700 dark:text-white" /></div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setShowExclusionSaveModal(false); setExclusionSaveName(""); }}>İptal</Button><Button onClick={async () => { if (!exclusionSaveName.trim()) { showToastError("Lütfen bir isim girin."); return; } const saved = await saveExclusionSet(exclusionSaveName.trim(), rows.filter(r => r.start && r.end)); if (saved) { success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`); setShowExclusionSaveModal(false); setExclusionSaveName(""); } else { showToastError("Kaydetme işlemi başarısız oldu."); } }} disabled={!exclusionSaveName.trim()}>Kaydet</Button></div></div></div>, document.body)}
      {showExclusionLoadModal && createPortal(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionLoadModal(false)}><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}><h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı Kullanılan İzinler</h3>{savedExclusionSets.length === 0 ? <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p> : <div className="max-h-60 overflow-y-auto space-y-2 mb-4">{savedExclusionSets.map((set) => <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600"><div><div className="font-medium text-sm text-slate-800 dark:text-slate-200">{set.name}</div><div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setRows(set.data.length > 0 ? set.data : createInitialRows(7)); success(`"${set.name}" yüklendi!`); setShowExclusionLoadModal(false); }}>Yükle</Button><Button size="sm" variant="outline" onClick={async () => { if (confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) { const deleted = await deleteExclusionSet(set.id); if (deleted) { success("Liste silindi."); const updatedSets = await getAllExclusionSets(); setSavedExclusionSets(updatedSets); } else { showToastError("Silme işlemi başarısız oldu."); } } }} className="text-red-600 hover:text-red-700 dark:text-red-400"><Trash2 className="w-4 h-4" /></Button></div></div>)}</div>}<div className="flex justify-end"><Button variant="outline" onClick={() => setShowExclusionLoadModal(false)}>Kapat</Button></div></div></div>, document.body)}
    </Layout>
  );
}
