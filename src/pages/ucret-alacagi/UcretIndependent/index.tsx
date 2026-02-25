import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Layout from "./localComponents/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "./localContext/ToastContext";
import { useKaydetContext } from "./localContext/KaydetProvider";
import { API_BASE_URL, apiGet } from "./localUtils/apiClient";
import { Youtube, Copy } from "lucide-react";
import { getVideoLink } from "./localConfig/videoLinks";
import { Card, CardContent, CardHeader, CardTitle } from "./localComponents/ui/card";
import { Input } from "./localComponents/ui/input";
import { Button } from "./localComponents/ui/button";
import { Label } from "./localComponents/ui/label";
import { asgariUcretler } from "./localUtils/asgariUcretler";
import { normalizeLocalDate } from "./localUtils/dateHelpers";
import { getDaysInMonth } from "date-fns";
import UbgtKatsayiModal from "./localComponents/UbgtKatsayiModal";
import { calcWorkPeriodBilirKisi } from "./localUtils/dateUtils";
import { calculateSegmentedNetFromRows } from "./localUtils/incomeTaxCore";
import { ToastProvider, Toaster } from "./localContext/ToastContext";
import { KaydetProvider } from "./localContext/KaydetProvider";

// Constants (inline)
const PAGE_TITLE = "Ücret Alacağı";
const FORM_LABELS = {
  START_DATE: "Çalışma dönemi başlangıcı",
  END_DATE: "Çalışma dönemi sonu",
  BRUT: "Çıplak Ücret",
  GROSS_TO_NET: "Brütten Nete Çevir",
  NET_TO_GROSS: "Netten Brüte Çevir",
  GROSS_SALARY: "Çıplak Brüt Ücret",
  NET_SALARY: "Net Ücret",
};
const NOTE_TEXT = "Bu alan bilgi amaçlıdır ve ileride güncellenecektir.";
import "./localStyles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "./localComponents/report/BaseReportModal";
import type { ReportConfig } from "./localComponents/report/BaseReportModal";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Helper functions (inline)
const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// Cetvel satır tipi
interface CetvelRow {
  id: string;
  rangeLabel: string;
  startISO: string;
  endISO: string;
  katsayi: number;
  ucret: number;
  gunSayisi: number;
  ayGunSayisi: number;
  ucretManual: boolean;
  odenenUcret: number;
}

// Tarih formatlama
const formatDateTR = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
};

// Dönem için asgari ücret bul
const getAsgariUcretForPeriod = (startISO: string): number => {
  const startDate = normalizeLocalDate(startISO);
  const found = asgariUcretler.find(a => {
    const aStart = normalizeLocalDate(a.start);
    const aEnd = normalizeLocalDate(a.end);
    return startDate >= aStart && startDate <= aEnd;
  });
  return found ? found.brut : asgariUcretler[asgariUcretler.length - 1].brut;
};

function UcretIndependentContent() {
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("ucret-alacagi");
  
  // Form state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  // Cetvel state
  const [showCetvel, setShowCetvel] = useState<boolean>(false);
  const [cetvelRows, setCetvelRows] = useState<CetvelRow[]>([]);
  
  // Kat Sayı Hesapla modal state
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [globalKatsayi, setGlobalKatsayi] = useState<number>(1);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  
  // Dönüştürücüler
  const [grossForNet, setGrossForNet] = useState<string>("");
  const [netForGross, setNetForGross] = useState<string>("");
  
  // Kayıt state
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  const calcRequestIdRef = useRef(0);

  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    if (endDate && endDate.trim() !== "") {
      const exitDate = new Date(endDate);
      if (!isNaN(exitDate.getTime())) {
        const year = exitDate.getFullYear();
        if (year >= 2010 && year <= 2030) {
          return year;
        }
      }
    }
    return new Date().getFullYear();
  }, [endDate]);

  // Çalışma süresi hesaplama
  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);

  // Brütten Nete Çevir - Tamamen lokal hesaplama (backend çağrısı yok)
  const netFromGross = useMemo(() => {
    if (!cetvelRows.length) {
      return {
        gross: 0, sgk: 0, issizlik: 0,
        gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
        damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0,
        net: 0
      };
    }
    const d = calculateSegmentedNetFromRows(cetvelRows);
    return {
      gross: d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      net: d.totalNet
    };
  }, [cetvelRows]);

  // Netten Brüte Çevir - Backend (Brütten Nete ile aynı kurallar, asgari ücret istisnası dahil)
  const [grossFromNet, setGrossFromNet] = useState({
    net: 0, gross: 0, sgk: 0, issizlik: 0,
    gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
    damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0
  });
  const netVal = useMemo(() => parseNum(netForGross), [netForGross]);

  useEffect(() => {
    if (netVal > 0) {
      const tenantId = localStorage.getItem("tenant_id") || "1";
      fetch(`${API_BASE_URL}/api/ucret-alacagi/gross-from-net`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": String(tenantId) },
        body: JSON.stringify({ net: netVal, year: selectedYear })
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setGrossFromNet(result.data);
          }
        })
        .catch(err => console.error("Brüt hesaplama hatası:", err));
    } else {
      setGrossFromNet({ net: 0, gross: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0 });
    }
  }, [netVal, selectedYear]);

  // Toplam brüt ücret (her satır için: gün bazlı hesaplama, ödenen ücretler çıkarılır)
  const totalBrut = useMemo(() => {
    const brutToplam = cetvelRows.reduce((acc, row) => {
      const isFullMonth = row.gunSayisi === row.ayGunSayisi;
      const rowTotal = isFullMonth 
        ? row.ucret * row.katsayi 
        : (row.ucret / 30) * row.gunSayisi * row.katsayi;
      return acc + rowTotal;
    }, 0);
    const odenenToplam = cetvelRows.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
    return Math.max(0, brutToplam - odenenToplam);
  }, [cetvelRows]);

  // Katsayı uygulama fonksiyonu
  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    setGlobalKatsayi(katsayi);
    setHasCustomKatsayi(true);
    setCetvelRows(prev => prev.map(row => ({ ...row, katsayi: katsayi })));
  }, []);

  // Katsayı kaldırma fonksiyonu
  const removeGlobalCoefficient = useCallback(() => {
    setGlobalKatsayi(1);
    setHasCustomKatsayi(false);
    setCetvelRows(prev => prev.map(row => ({ ...row, katsayi: 1 })));
  }, []);

  // Cetvel hesapla (tarihler değişince çalışır) - BACKEND'DEN
  const generateCetvel = useCallback(async () => {
    calcRequestIdRef.current += 1;
    const currentRequestId = calcRequestIdRef.current;

    if (!startDate || !endDate) {
      if (currentRequestId !== calcRequestIdRef.current) return;
      setCetvelRows([]);
      setShowCetvel(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (start > end) return;

    try {
      console.log("[Ücret Alacağı] Backend'e gönderiliyor...");
      
      // İlk ortalama ücret hesabı için asgari ücret al (sayı olarak gönder)
      const avgUcret = getAsgariUcretForPeriod(startDate);
      const monthly = Number(avgUcret) || getAsgariUcretForPeriod(endDate);
      if (!monthly || monthly <= 0) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        showToastError("Seçilen dönem için asgari ücret bulunamadı. Lütfen tarih aralığını kontrol edin.");
        setCetvelRows([]);
        setShowCetvel(false);
        return;
      }

      const tenantId = localStorage.getItem("tenant_id") || "1";
      const response = await fetch(`${API_BASE_URL}/api/ucret-alacagi/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": String(tenantId)
        },
        body: JSON.stringify({
          startDate,
          endDate,
          monthly
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        const serverMessage = result?.error || `Sunucu hatası (${response.status})`;
        showToastError(serverMessage);
        setCetvelRows([]);
        setShowCetvel(false);
        return;
      }

      console.log("[Ücret Alacağı] Backend'den gelen sonuç:", result);

      if (result.success && result.data?.rows) {
        const newRows: CetvelRow[] = result.data.rows.map((row: any, idx: number) => ({
          id: `row-${idx}-${Date.now()}`,
          rangeLabel: `${formatDateTR(row.start)} – ${formatDateTR(row.end)}`,
          startISO: row.start,
          endISO: row.end,
          katsayi: globalKatsayi,
          ucret: getAsgariUcretForPeriod(row.start),
          gunSayisi: row.days,
          ayGunSayisi: getDaysInMonth(new Date(row.start)),
          ucretManual: false,
          odenenUcret: 0,
        }));

        if (currentRequestId !== calcRequestIdRef.current) return;
        setCetvelRows(newRows);
        setShowCetvel(true);
      } else {
        if (currentRequestId !== calcRequestIdRef.current) return;
        if (result.error) {
          showToastError(result.error);
        }
        setCetvelRows([]);
        setShowCetvel(false);
      }
    } catch (error) {
      console.error("[Ücret Alacağı] Hesaplama hatası:", error);
      if (currentRequestId !== calcRequestIdRef.current) return;
      showToastError("Hesaplama sırasında bir hata oluştu");
      setCetvelRows([]);
      setShowCetvel(false);
    }
  }, [startDate, endDate, globalKatsayi, showToastError]);

  // Tarihler değişince cetveli otomatik hesapla (kayıttan yükleme sırasında atla - loadRanRef)
  useEffect(() => {
    if (loadRanRef.current) return;
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    const timer = setTimeout(() => {
      generateCetvel();
    }, 300);

    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  // Ücret değişikliği - sadece blur'da kaydet
  const handleUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, ucret: numValue, ucretManual: true } : row
    ));
  }, []);

  // Katsayı değişikliği (satır bazlı) - sadece blur'da kaydet
  const handleKatsayiBlur = useCallback((rowId: string, newValue: string) => {
    const numValue = parseFloat(newValue.replace(",", ".")) || 1;
    setCetvelRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, katsayi: numValue } : row
    ));
  }, []);

  // Ödenen ücret değişikliği - blur'da kaydet
  const handleOdenenUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, odenenUcret: numValue } : row
    ));
  }, []);

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const response = await apiGet(`/api/saved-cases/${loadId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Yükleme işlemi başarısız");
      }
      
      let payload = {};
      if (data.data) {
        if (typeof data.data === 'string') {
          try { payload = JSON.parse(data.data); } catch { payload = {}; }
        } else {
          payload = data.data;
        }
      }
      const formValues = (payload as any).form ?? (payload as any).formValues ?? payload;
      return {
        data: payload,
        formValues,
        name: data.name || "",
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
        
        const payload = data.data ?? {};
        const form = data.formValues ?? payload;
        const formObj = (form as any)?.form ?? form;
        
        if (formObj?.startDate) setStartDate(formObj.startDate);
        if (formObj?.endDate) setEndDate(formObj.endDate);
        
        if (formObj?.globalKatsayi != null) {
          setGlobalKatsayi(formObj.globalKatsayi);
          setHasCustomKatsayi(formObj.globalKatsayi !== 1);
        }
        
        const rowsSource = formObj?.cetvelRows ?? formObj?.rows ?? (payload as any)?.results?.rows ?? (form as any)?.cetvelRows ?? (form as any)?.rows;
        if (rowsSource && Array.isArray(rowsSource)) {
          const mappedRows = rowsSource.map((r: any) => {
            const odenenRaw = r.odenenUcret ?? r.odenen_ucret ?? r.OdenenUcret ?? 0;
            const odenen = Number(odenenRaw) || 0;
            return { ...r, odenenUcret: odenen };
          });
          if (process.env.NODE_ENV === "development" && mappedRows.length > 0) {
            console.log("[UcretIndependent] Yüklenen satırlar, ilk satır odenenUcret:", mappedRows[0]?.odenenUcret, "ham veri:", rowsSource[0]);
          }
          setCetvelRows(mappedRows);
          setShowCetvel(true);
        }
        
        setCurrentRecordName(data.name || null);
        success(`Kayıt yüklendi (#${id})`);
      } catch (err) {
        if (!isMounted) return;
        showToastError("Kayıt yüklenemedi");
      }
    };
    
    fetchData();
    
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // YENİ RAPOR SİSTEMİ: Config
  const ucretReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Brütten Nete Çeviri tablosu satırları (netFromGross'tan)
    const grossToNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [
      { label: "Brüt Ücret", value: `${fmtLocal(netFromGross.gross)}₺` },
      { label: "SGK Primi (%14)", value: `-${fmtLocal(netFromGross.sgk)}₺`, isDeduction: true },
      { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(netFromGross.issizlik)}₺`, isDeduction: true },
    ];
    if (netFromGross.gelirVergisiIstisna > 0) {
      grossToNetRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.gelirVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtLocal(netFromGross.gelirVergisiIstisna)}₺` },
        { label: "Net Gelir Vergisi", value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push(
        { label: "Gelir Vergisi " + (netFromGross.gelirVergisiDilimleri || ""), value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    }
    if (netFromGross.damgaVergisiIstisna > 0) {
      grossToNetRows.push(
        { label: "Damga Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.damgaVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtLocal(netFromGross.damgaVergisiIstisna)}₺` },
        { label: "Net Damga Vergisi", value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push(
        { label: "Damga Vergisi (binde 7,59)", value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`, isDeduction: true }
      );
    }
    grossToNetRows.push({ label: "Net Ücret", value: `${fmtLocal(netFromGross.net)}₺`, isNet: true });

    return {
      title: "Ücret Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Çalışma Dönemi Başlangıcı", value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Dönemi Sonu", value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: workPeriod?.label || "-" },
        { label: "Katsayı", value: hasCustomKatsayi ? globalKatsayi.toString() : "1", condition: hasCustomKatsayi },
      ],
      periodData: {
        title: "Ücret Hesaplama Cetveli",
        fontSize: "10px",
        headers: ["Tarih Aralığı", "Gün Sayısı", "Katsayı", "Ücret (₺)", "Ödenen Ücret", "Toplam (₺)"],
        rows: cetvelRows.map(row => {
          const isFullMonth = row.gunSayisi === row.ayGunSayisi;
          const rowBrut = isFullMonth 
            ? row.ucret * row.katsayi 
            : (row.ucret / 30) * row.gunSayisi * row.katsayi;
          const rowNet = Math.max(0, rowBrut - (row.odenenUcret || 0));
          
          return [
            row.rangeLabel,
            row.gunSayisi.toString(),
            row.katsayi.toFixed(4).replace(".", ","),
            `${fmtLocal(row.ucret)}₺`,
            row.odenenUcret ? `${fmtLocal(row.odenenUcret)}₺` : "-",
            `${fmtLocal(rowNet)}₺`,
          ];
        }),
        footer: [
          "Toplam Brüt Ücret:",
          "",
          "",
          "",
          "",
          `${fmtLocal(totalBrut)}₺`,
        ],
        alignRight: [1, 2, 3, 4, 5],
      },
      grossToNetData: {
        title: "Brütten Nete Çeviri",
        fontSize: "10px",
        rows: grossToNetRows,
      },
    };
  }, [startDate, endDate, workPeriod, cetvelRows, totalBrut, hasCustomKatsayi, globalKatsayi, netFromGross]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (ucretReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = ucretReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "ucret-hesaplama", title: pd.title || "Ücret Hesaplama Cetveli", html: buildWordTable(n2.headers, n2.rows) });
    }

    const gnd = ucretReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: ucretReportConfig.grossToNetData?.title || "Brütten Nete Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [ucretReportConfig]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("ucret-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = ucretReportConfig.title;
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
  }, [ucretReportConfig.title]);

  const handleSave = () => {
    try {
      // Odaktaki input'tan çık - blur tetiklensin, değer DOM'da kalsın
      if (document.activeElement instanceof HTMLInputElement) {
        (document.activeElement as HTMLInputElement).blur();
      }

      const parseNum = (v: string) => {
        const clean = String(v || "").replace(/₺/g, "").replace(/\s/g, "").trim();
        return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
      };
      let rowsToSave = cetvelRows.map(r => ({ ...r }));

      const container = document.getElementById("ucret-print");
      const ucretInputs = (container || document).querySelectorAll<HTMLInputElement>('input[data-ucret-row]');
      ucretInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-ucret-row");
        if (rowId) {
          const num = parseNum(inp.value);
          const idx = rowsToSave.findIndex(r => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], ucret: num, ucretManual: true };
        }
      });

      const katsayiInputs = (container || document).querySelectorAll<HTMLInputElement>('input[data-katsayi-row]');
      katsayiInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-katsayi-row");
        if (rowId) {
          const num = parseFloat(String(inp.value || "").replace(",", ".")) || 1;
          const idx = rowsToSave.findIndex(r => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], katsayi: num };
        }
      });

      const odenenInputs = (container || document).querySelectorAll<HTMLInputElement>('input[data-odenen-row]');
      odenenInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-odenen-row");
        if (rowId) {
          const num = parseNum(inp.value);
          const idx = rowsToSave.findIndex(r => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], odenenUcret: num };
        }
      });

      const brutToplam = rowsToSave.reduce((acc, row) => {
        const isFullMonth = row.gunSayisi === row.ayGunSayisi;
        const rowBrut = isFullMonth ? row.ucret * row.katsayi : (row.ucret / 30) * row.gunSayisi * row.katsayi;
        return acc + rowBrut;
      }, 0);
      const odenenToplam = rowsToSave.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
      const finalTotal = Math.max(0, brutToplam - odenenToplam);

      setCetvelRows(rowsToSave);

      kaydetAc({
        hesapTuru: "ucret_alacagi",
        veri: {
          data: {
            form: { startDate, endDate, cetvelRows: rowsToSave, globalKatsayi },
            results: { total: finalTotal, rows: rowsToSave },
          },
          start_date: startDate,
          end_date: endDate,
          brut_total: Number(finalTotal.toFixed(2)),
          net_total: Number(finalTotal.toFixed(2)),
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `/ucret-alacagi/:id`,
      });
    } catch {
      showToastError("Kayıt yapılamadı.");
    }
  };

  const handleNewCalculation = () => {
    try {
      const hasUnsavedChanges = startDate || endDate || cetvelRows.length > 0;
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      setStartDate("");
      setEndDate("");
      setCetvelRows([]);
      setShowCetvel(false);
      setGlobalKatsayi(1);
      setHasCustomKatsayi(false);
      setCurrentRecordName(null);
      loadRanRef.current = false;
      if (id) window.location.href = "/ucret-alacagi";
    } catch {}
  };

  return (
    <Layout
      title={PAGE_TITLE}
      hideHeader={true}
      fluid={true}
      pageKey="ucret"
      noBackgroundColor={true}
      headerRight={
        videoLink ? (
          <Button onClick={() => window.open(videoLink, "_blank")} variant="outline" className="flex items-center gap-2 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 hover:text-red-700">
            <Youtube className="h-4 w-4" />
            Kullanım Videosu İzle
          </Button>
        ) : undefined
      }
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full space-y-6">
          {/* Form & Cetvel */}
          <div id="ucret-print" className="space-y-6">
            {/* Form Kartı */}
            <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-800">Tarih Bilgileri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{FORM_LABELS.START_DATE}</Label>
                    <Input
                      type="date"
                      max="9999-12-31"
                      className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      value={startDate}
                      onChange={(e) => {
                        loadRanRef.current = false;
                        setStartDate(e.target.value);
                      }}
                      className="rounded-lg border-gray-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{FORM_LABELS.END_DATE}</Label>
                    <Input
                      type="date"
                      max="9999-12-31"
                      className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      value={endDate}
                      onChange={(e) => {
                        loadRanRef.current = false;
                        setEndDate(e.target.value);
                      }}
                      className="rounded-lg border-gray-300"
                    />
                  </div>
                </div>

                {/* Çalışma Süresi Gösterimi */}
                {workPeriod && workPeriod.label && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Toplam Çalışma Süresi: <span className="font-semibold">{workPeriod.label}</span>
                    </p>
                  </div>
                )}

                {/* Kat Sayı Butonları */}
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowKatsayiModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                  >
                    Kat Sayı Hesapla
                  </Button>
                  {hasCustomKatsayi && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={removeGlobalCoefficient}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Kat Sayı Kaldır ({globalKatsayi.toFixed(4)})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ücret Hesaplama Cetveli */}
            {showCetvel && cetvelRows.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">Ücret Hesaplama Cetveli</h2>
                  <p className="text-sm text-gray-500 mt-1">Dönem bazlı ücret hesaplaması</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Tarih Aralığı</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Gün Sayısı</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">Katsayı</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">Ücret (₺)</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">Ödenen Ücret</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">Toplam (₺)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cetvelRows.map((row, idx) => {
                        const isFullMonth = row.gunSayisi === row.ayGunSayisi;
                        const rowBrut = isFullMonth 
                          ? row.ucret * row.katsayi 
                          : (row.ucret / 30) * row.gunSayisi * row.katsayi;
                        const rowNet = Math.max(0, rowBrut - (row.odenenUcret || 0));
                        return (
                          <tr 
                            key={row.id} 
                            className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors`}
                          >
                            <td className="px-4 py-3 text-gray-800 font-medium">{row.rangeLabel}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.gunSayisi}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="text"
                                key={`katsayi-${row.id}-${row.katsayi}`}
                                data-katsayi-row={row.id}
                                defaultValue={row.katsayi.toFixed(4).replace(".", ",")}
                                onBlur={(e) => handleKatsayiBlur(row.id, e.target.value)}
                                className="w-20 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="text"
                                key={`ucret-${row.id}-${row.ucret}`}
                                data-ucret-row={row.id}
                                defaultValue={`${fmtCurrency(row.ucret)}₺`}
                                onBlur={(e) => handleUcretBlur(row.id, e.target.value)}
                                className={`w-28 text-right border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  row.ucretManual ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="text"
                                key={`odenen-${row.id}`}
                                data-odenen-row={row.id}
                                defaultValue={row.odenenUcret ? fmtCurrency(row.odenenUcret) : ""}
                                placeholder="0"
                                onBlur={(e) => handleOdenenUcretBlur(row.id, e.target.value)}
                                className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {fmtCurrency(rowNet)}₺
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <td colSpan={5} className="px-4 py-4 text-right font-bold text-base">
                          Toplam Brüt Ücret:
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-lg">
                          {fmtCurrency(totalBrut)}₺
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 space-y-2">
                  <p className="text-xs text-amber-700">
                    <strong>Not:</strong> Ücret sütunundaki değerler varsayılan olarak ilgili dönemin resmi asgari brüt ücretini gösterir. 
                    İsterseniz bu değerleri manuel olarak değiştirebilirsiniz.
                  </p>
                  <p className="text-xs text-amber-700">
                    Brütten Nete çevirme kısmında hesaplamalar yukarıda yer alan aylık brüt ücretler tek tek hesaplanarak toplam veri tabloda yer almaktadır.
                  </p>
                </div>
              </div>
            )}

            {/* Hesaplama yapılmamış durumu */}
            {!showCetvel && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Hesaplama Bekleniyor</h3>
                <p className="text-sm text-gray-500">
                  Ücret hesaplaması için tarihleri girin. Tablo otomatik oluşturulacaktır.
                </p>
              </div>
            )}
          </div>

          {/* Dönüştürücüler - Yan Yana */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brütten Nete Çevir */}
            <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{FORM_LABELS.GROSS_TO_NET}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{FORM_LABELS.GROSS_SALARY}</Label>
                  <div className="h-8 text-sm flex items-center text-gray-600">
                    {cetvelRows.length > 0 ? `Cetvelden: ${fmtCurrency(totalBrut)}₺` : "Cetvel oluşturun"}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">Brüt Ücret</span>
                    <span className="font-semibold text-gray-900">{fmtCurrency(netFromGross.gross)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">SGK Primi (%14)</span>
                    <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.sgk)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">İşsizlik Primi (%1)</span>
                    <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.issizlik)}₺</span>
                  </div>
                  {netFromGross.gelirVergisiIstisna > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisiBrut)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                        <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.gelirVergisiIstisna)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Gelir Vergisi</span>
                        <span className="font-semibold text-gray-900">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                    </div>
                  )}
                  {netFromGross.damgaVergisiIstisna > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Damga Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisiBrut)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                        <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.damgaVergisiIstisna)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Damga Vergisi</span>
                        <span className="font-semibold text-gray-900">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-green-700">Net Ücret</span>
                    <span className="text-sm font-bold text-green-700">{fmtCurrency(netFromGross.net)}₺</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Netten Brüte Çevir */}
            <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{FORM_LABELS.NET_TO_GROSS}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{FORM_LABELS.NET_SALARY}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={netForGross}
                      onChange={(e) => setNetForGross(e.target.value)}
                      placeholder="Örn: 18.000,00"
                      className="h-8 text-sm flex-1"
                    />
                    {netFromGross.net > 0 && (
                      <button
                        type="button"
                        onClick={() => setNetForGross(fmtCurrency(netFromGross.net))}
                        className="shrink-0 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors h-8"
                      >
                        Sol panelin netini kullan
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">Net Ücret</span>
                    <span className="font-semibold text-gray-900">{fmtCurrency(grossFromNet.net)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">SGK Primi (%14)</span>
                    <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.sgk)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">İşsizlik Primi (%1)</span>
                    <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.issizlik)}₺</span>
                  </div>
                  {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                        <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Gelir Vergisi</span>
                        <span className="font-semibold text-gray-900">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Gelir Vergisi {grossFromNet.gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                    </div>
                  )}
                  {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Damga Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                        <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Damga Vergisi</span>
                        <span className="font-semibold text-gray-900">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-green-700">Brüt Ücret</span>
                    <span className="text-sm font-bold text-green-700">{fmtCurrency(grossFromNet.gross)}₺</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notlar */}
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
            <div className="p-4 notes-content">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{NOTE_TEXT}</p>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      {/* Kat Sayı Modal */}
      <UbgtKatsayiModal
        open={showKatsayiModal}
        onClose={() => setShowKatsayiModal(false)}
        onApply={applyGlobalCoefficient}
      />

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="ucret-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={ucretReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Ücret Alacağı Rapor",
          copyTargetId: "ucret-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ucret-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ucret-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ucret-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Ücret Alacağı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}

export default function UcretIndependent() {
  return (
    <ToastProvider>
      <Toaster />
      <KaydetProvider>
        <UcretIndependentContent />
      </KaydetProvider>
    </ToastProvider>
  );
}
