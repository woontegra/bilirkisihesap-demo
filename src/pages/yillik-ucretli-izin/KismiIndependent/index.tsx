import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
import { API_BASE_URL } from "@/utils/apiClient";
// Constants - inline (Kısmi Süreli)
const NOTE_ITEMS: string[] = ["Kısmi süreli çalışanlarda yıllık izin hakkı tam süreli çalışanlara göre orantılı olarak hesaplanır.", "Haftalık çalışma süresi 45 saatten az olan işçiler kısmi süreli sayılır."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Kısmi Süreli Yıllık Ücretli İzin Alacağı";
const PRINT_TITLE = "Kısmi Süreli Yıllık Ücretli İzin Hesaplama";
const PRINT_HEADING = "Kısmi Süreli Yıllık Ücretli İzin Hesaplama";
const REPORT_TITLE = "Yıllık Ücretli İzin";
type WorkPeriod = { id: string; iseGiris: string; istenCikis: string };
type UsedRow = { id: string; start: string; end: string; days: string };
const createEmptyRow = (): UsedRow => ({ id: Math.random().toString(36).slice(2), start: "", end: "", days: "" });
const createInitialRows = (count = 7): UsedRow[] => Array.from({ length: count }, () => createEmptyRow());
const toDays = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const validateSave = (data: { iseGiris: string; istenCikis: string; remainingDays: number; brutIzin: number }) => {
  if (!data.iseGiris?.trim()) return { isValid: false, message: "Giriş tarihi gerekli" };
  if (!data.istenCikis?.trim()) return { isValid: false, message: "Çıkış tarihi gerekli" };
  if (data.remainingDays < 0) return { isValid: false, message: "Geçerli izin günü giriniz" };
  if (data.brutIzin <= 0) return { isValid: false, message: "Brüt izin tutarı hesaplanamadı. Lütfen çıplak brüt ücreti kontrol edin." };
  return { isValid: true, message: "" };
};
import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

export default function YillikIzinPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("yillik-kismi");
  
  // Dates and duration - Multiple work periods support
  const [workPeriods, setWorkPeriods] = useState<WorkPeriod[]>([
    { id: "1", iseGiris: "", istenCikis: "" }
  ]);
  
  const addWorkPeriod = () => {
    setWorkPeriods((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), iseGiris: "", istenCikis: "" }
    ]);
  };

  const removeWorkPeriod = (id: string) => {
    if (workPeriods.length > 1) {
      setWorkPeriods((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const updateWorkPeriod = (id: string, patch: Partial<WorkPeriod>) => {
    setWorkPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  
  // Backward compatibility: first period as iseGiris/istenCikis
  const iseGiris = workPeriods[0]?.iseGiris || "";
  const istenCikis = workPeriods[workPeriods.length - 1]?.istenCikis || "";
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [employerPayment, setEmployerPayment] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Kaydet/İçe Aktar için state'ler
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: UsedRow[]; createdAt: string }[]>([]);
  
  // Special worker types
  const [is18Or50, setIs18Or50] = useState(false); // 18 yaş altı / 50 yaş üstü
  const [isUnderground, setIsUnderground] = useState(false); // Yeraltı işçisi

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (id: string, patch: Partial<UsedRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const [breakdown, setBreakdown] = useState({ y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
  const [usedTotal, setUsedTotal] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);

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
    const calculateFromBackend = async () => {
      try {
        const tenantId = localStorage.getItem("tenant_id") || "1";
        const response = await fetch(`${API_BASE_URL}/api/yillik-izin/kismi`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify({ 
            years: diff.yil, 
            brutUcret: brutUcret, 
            usedRows: rows, 
            exitYear: selectedYear,
            is18Or50: is18Or50,
            isUnderground: isUnderground
          })
        });
        
        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) errorMessage = errorData.error;
          } catch {}
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          setBreakdown(result.data.breakdown || { y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
          setUsedTotal(result.data.usedTotal || 0);
          setRemainingDays(result.data.remainingDays || 0);
          setBrutIzin(result.data.brutIzin || 0);
          setSgk(result.data.sgk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNetIzin(result.data.netIzin || 0);
        } else if (result.error) {
          showToastError(result.error);
        }
      } catch (error) { 
        console.error("Yıllık izin hesaplama hatası:", error);
        if (iseGiris && istenCikis && diff.yil > 0) {
          showToastError(`Hesaplama hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        }
      }
    };
    if (iseGiris && istenCikis && diff.yil >= 0) {
      calculateFromBackend();
    } else {
      setBreakdown({ y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
      setUsedTotal(0);
      setRemainingDays(0);
      setBrutIzin(0);
      setSgk(0);
      setIssizlik(0);
      setGelirVergisi(0);
      setGelirVergisiDilimleri("");
      setDamgaVergisi(0);
      setNetIzin(0);
    }
  }, [diff.yil, brutUcret, rows, selectedYear, is18Or50, isUnderground, iseGiris, istenCikis]);

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
        
        // Form alanlarını yükle - workPeriods
        const loadedIseGiris = form.iseGiris || form.ise_giris || formData.iseGiris || formData.ise_giris;
        const loadedIstenCikis = form.istenCikis || form.isten_cikis || formData.istenCikis || formData.isten_cikis;
        
        if (loadedIseGiris || loadedIstenCikis) {
          setWorkPeriods([{ id: "1", iseGiris: loadedIseGiris || "", istenCikis: loadedIstenCikis || "" }]);
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
  const kismiReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // İşveren ödemesi hesabı
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, '').replace(',', '.')) || 0;
    const mahsuplamaSonucu = Math.max(0, brutIzin - employerPaymentNum);

    // Çalışma dönemleri bilgisi
    const workPeriodsSummary = workPeriods.map(wp => {
      if (!wp.iseGiris || !wp.istenCikis) return null;
      return {
        start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
        end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
      };
    }).filter(Boolean);

    return {
      title: REPORT_TITLE,
      sections: {
        info: true,
        periodTable: false,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "Çalışma Süresi", value: diff.label || "-" },
        { label: "Brüt Ücret", value: brutUcret ? `${fmtLocal(Number(String(brutUcret).replace(/\./g, '').replace(',', '.')))}₺` : "-" },
      ],
      customSections: [
        {
          title: "Çalışma Dönemleri (Kısmi Süreli / Part Time)",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Başlangıç</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Bitiş</th>
                </tr>
              </thead>
              <tbody>
                {workPeriodsSummary.map((wp: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px' }}>{wp.start}</td>
                    <td style={{ padding: '8px' }}>{wp.end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          condition: workPeriodsSummary.length > 0,
        },
        {
          title: "Yıllık Ücretli İzin Hesaplama",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', border: '1px solid #999', fontSize: '10px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, border: '1px solid #999', backgroundColor: '#f9f9f9' }}>Alan</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600, border: '1px solid #999', backgroundColor: '#f9f9f9' }}>Değer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '5px 8px', border: '1px solid #999' }}>Kalan İzin Süresi</td>
                  <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #999', fontVariantNumeric: 'tabular-nums' }}>{remainingDays} gün</td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px', border: '1px solid #999' }}>Günlük Ücret (Toplam/30)</td>
                  <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #999', fontVariantNumeric: 'tabular-nums' }}>
                    ({fmtLocal(Number(String(brutUcret).replace(/\./g, '').replace(',', '.')) || 0)}₺ / 30 × {remainingDays} gün)
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                  <td style={{ padding: '5px 8px', border: '1px solid #999' }}>Yıllık Ücretli İzin Alacağı</td>
                  <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #999', fontVariantNumeric: 'tabular-nums' }}>{fmtLocal(brutIzin)}₺</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        {
          title: "Yıllık İzin Hak Edişi (Kısmi Süreli / Part Time)",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Dönem</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.y1 > 0 && breakdown.d1 > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px' }}>{breakdown.y1} yıl (1-5 yıl)</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{breakdown.y1} yıl × {(breakdown as any).daysPerYear1 ?? 14} gün = {breakdown.d1} gün</td>
                  </tr>
                )}
                {breakdown.y2 > 0 && breakdown.d2 > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px' }}>{breakdown.y2} yıl (5-15 yıl)</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{breakdown.y2} yıl × {(breakdown as any).daysPerYear2 ?? 20} gün = {breakdown.d2} gün</td>
                  </tr>
                )}
                {breakdown.y3 > 0 && breakdown.d3 > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px' }}>{breakdown.y3} yıl (15+ yıl)</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{breakdown.y3} yıl × {(breakdown as any).daysPerYear3 ?? 26} gün = {breakdown.d3} gün</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                  <td style={{ padding: '8px' }}>Toplam Hak Edilen</td>
                  <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{breakdown.total} gün</td>
                </tr>
                <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ padding: '8px' }}>Kullanılan İzin</td>
                  <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{usedTotal} gün</td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: '#dcfce7' }}>
                  <td style={{ padding: '8px' }}>Kalan İzin</td>
                  <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{remainingDays} gün</td>
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
          value: `${fmtLocal(mahsuplamaSonucu)}₺`,
        },
      },
    };
  }, [workPeriods, diff, brutUcret, breakdown, usedTotal, remainingDays, brutIzin, sgk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netIzin, employerPayment]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const workPeriodsSummary = workPeriods
      .filter((wp) => wp.iseGiris && wp.istenCikis)
      .map((wp) => [new Date(wp.iseGiris).toLocaleDateString("tr-TR"), new Date(wp.istenCikis).toLocaleDateString("tr-TR")]);

    if (kismiReportConfig.infoRows && kismiReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: kismiReportConfig.infoRows.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (workPeriodsSummary.length > 0) {
      const n2 = adaptToWordTable({ headers: ["Başlangıç", "Bitiş"], rows: workPeriodsSummary });
      sections.push({ id: "calisma-donemleri", title: "Çalışma Dönemleri (Kısmi Süreli / Part Time)", html: buildWordTable(n2.headers, n2.rows) });
    }

    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const calcRows = [
      ["Kalan İzin Süresi", `${remainingDays} gün`],
      ["Günlük Ücret (Toplam/30)", `(${fmtLocal(Number(String(brutUcret || "0").replace(/\./g, '').replace(',', '.')) || 0)}₺ / 30 × ${remainingDays} gün)`],
      ["Yıllık Ücretli İzin Alacağı", `${fmtLocal(brutIzin)}₺`],
    ];
    const n2b = adaptToWordTable({ headers: ["Alan", "Değer"], rows: calcRows });
    sections.push({ id: "yillik-ucretli-izin-hesaplama", title: "Yıllık Ücretli İzin Hesaplama", html: buildWordTable(n2b.headers, n2b.rows) });

    const hakRows: string[][] = [];
    const dp1 = (breakdown as any).daysPerYear1 ?? 14;
    const dp2 = (breakdown as any).daysPerYear2 ?? 20;
    const dp3 = (breakdown as any).daysPerYear3 ?? 26;
    if (breakdown.y1 > 0 && breakdown.d1 > 0) hakRows.push([`${breakdown.y1} yıl (1-5 yıl)`, `${breakdown.y1} yıl × ${dp1} gün = ${breakdown.d1} gün`]);
    if (breakdown.y2 > 0 && breakdown.d2 > 0) hakRows.push([`${breakdown.y2} yıl (5-15 yıl)`, `${breakdown.y2} yıl × ${dp2} gün = ${breakdown.d2} gün`]);
    if (breakdown.y3 > 0 && breakdown.d3 > 0) hakRows.push([`${breakdown.y3} yıl (15+ yıl)`, `${breakdown.y3} yıl × ${dp3} gün = ${breakdown.d3} gün`]);
    hakRows.push(["Toplam Hak Edilen", `${breakdown.total} gün`]);
    hakRows.push(["Kullanılan İzin", `${usedTotal} gün`]);
    hakRows.push(["Kalan İzin", `${remainingDays} gün`]);
    const n3 = adaptToWordTable({ headers: ["Dönem", "Gün Sayısı"], rows: hakRows });
    sections.push({ id: "yillik-izin-hak-edisi", title: "Yıllık İzin Hak Edişi (Kısmi Süreli / Part Time)", html: buildWordTable(n3.headers, n3.rows) });

    const gnd = kismiReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = kismiReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [kismiReportConfig, workPeriods, breakdown, usedTotal, remainingDays, brutUcret, brutIzin]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("kismi-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = kismiReportConfig.title;
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
  }, [kismiReportConfig.title]);

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

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "yillik_izin_kismi",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              iseGiris,
              istenCikis,
              brutUcret,
              rows,
              employerPayment,
            },
            results: {
              breakdown,
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
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutIzin.toFixed(2)),
          net_toplam: Number(netIzin.toFixed(2)),
          ise_giris: iseGiris || null,
          isten_cikis: istenCikis || null,
          eklentiler: { employer_payment: employerPayment }
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/yillik-izin/kismi/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = iseGiris || istenCikis || brutUcret || rows.some(r => r.start || r.end || r.days) || employerPayment;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setWorkPeriods([{ id: "1", iseGiris: "", istenCikis: "" }]);
      setBrutUcret("");
      setRows(() => createInitialRows(7));
      setEmployerPayment("");
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/yillik-izin/kismi";
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
      <div id="kismi-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={kismiReportConfig} />
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {videoLink && (
          <div className="mb-4 flex justify-end gap-2 px-4 sm:px-6 lg:px-8 pt-8">
            <Button
              onClick={() => window.open(videoLink, "_blank")}
              variant="outline"
              size="sm"
              className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            >
              <Youtube className="h-4 w-4" />
              Kullanım Videosu İzle
            </Button>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8">
              {/* Dates - Multiple work periods support */}
              <div className="space-y-3">
                {workPeriods.map((period, index) => (
                  <div key={period.id} className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çalışma Dönemi {index + 1}</span>
                      {workPeriods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorkPeriod(period.id)}
                          className="text-red-600 hover:text-red-800 transition"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">İşe Giriş Tarihi</label>
                        <input 
                          type="date" 
                          value={period.iseGiris} 
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
                            updateWorkPeriod(period.id, { iseGiris: value });
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(period.istenCikis)) {
                              const newDate = new Date(newValue);
                              const exitDate = new Date(period.istenCikis);
                              if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                                showToastError("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                              }
                            }
                          }}
                          className="w-full mt-1 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">İşten Çıkış Tarihi</label>
                        <input 
                          type="date" 
                          value={period.istenCikis} 
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
                            updateWorkPeriod(period.id, { istenCikis: value });
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(period.iseGiris)) {
                              const newDate = new Date(newValue);
                              const entryDate = new Date(period.iseGiris);
                              if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                                showToastError("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                                updateWorkPeriod(period.id, { istenCikis: period.iseGiris });
                              }
                            }
                          }}
                          className="w-full mt-1 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addWorkPeriod}
                  className="w-full text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                >
                  + Yeni Dönem Ekle
                </button>
              </div>

              {/* Total period summary */}
              <div className="mt-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çalışma Süresi</label>
                    
                    {/* Special Worker Type Checkboxes - Sağ tarafta */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={is18Or50}
                          onChange={(e) => setIs18Or50(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">18 yaş altı / 50 yaş üstü</span>
                      </label>
                      
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isUnderground}
                          onChange={(e) => setIsUnderground(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">Yeraltı İşçisi</span>
                      </label>
                    </div>
                  </div>
                  <input disabled value={diff.label} className="w-full rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium" />
                </div>
              </div>

              {/* Annual leave calculation */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Yıllık İzin Hesaplama</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                  <div>{breakdown.daysPerYear1 || 14} × {breakdown.y1} = <span className="font-semibold">{breakdown.d1} gün</span></div>
                  <div>{breakdown.daysPerYear2 || 20} × {breakdown.y2} = <span className="font-semibold">{breakdown.d2} gün</span></div>
                  <div>{breakdown.daysPerYear3 || 26} × {breakdown.y3} = <span className="font-semibold">{breakdown.d3} gün</span></div>
                  <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2 font-semibold text-gray-700 dark:text-gray-300">Toplam = {breakdown.total} gün</div>
                </div>
                <div className="mt-3 text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Toplam Yıllık İzin Hakkı: {breakdown.total} Gün</div>
              </div>

              {/* Accordion for used leaves */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
                  <button type="button" onClick={() => setAccordionOpen((s)=>!s)} className="flex items-center gap-2">
                    <span>Kullanılan İzinleri Dışla</span>
                    <svg className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExclusionSaveName("");
                        setShowExclusionSaveModal(true);
                      }}
                      disabled={rows.every(r => !r.start || !r.end)}
                      className="inline-flex items-center gap-1"
                    >
                      Kaydet
                      <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Girdiğiniz kullanılan izin günlerini bir isim vererek kaydedin. Başka hesaplamalarda tekrar kullanabilirsiniz.">ⓘ</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const sets = await getAllExclusionSets();
                        const setsWithCalculatedDays = sets.map(set => ({
                          ...set,
                          data: set.data.map(row => {
                            if (row.start && row.end && (!row.days || row.days === "0" || row.days === "")) {
                              const startDate = new Date(row.start);
                              const endDate = new Date(row.end);
                              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                return { ...row, days: String(diffDays) };
                              }
                            }
                            return row;
                          })
                        }));
                        setSavedExclusionSets(setsWithCalculatedDays);
                        setShowExclusionLoadModal(true);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      İçe Aktar
                      <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Daha önce kaydettiğiniz kullanılan izin günlerini yükleyin. Aynı davacı için farklı hesaplamalarda zaman kazandırır.">ⓘ</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRows(createInitialRows(7))} disabled={rows.every(r => !r.start && !r.end && !r.days)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200">
                      <Trash2 className="w-3.5 h-3.5" />
                      Tümünü Sil
                      <span className="cursor-help text-xs" title="Tüm kullanılan izin kayıtlarını silin.">ⓘ</span>
                    </Button>
                  </div>
                </div>
                {accordionOpen && (
                  <div className="px-3 pb-3">
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-700 dark:text-gray-300">
                            <th className="py-2 pr-2">İzin Başlangıç Tarihi</th>
                            <th className="py-2 pr-2">İzin Bitiş Tarihi</th>
                            <th className="py-2 pr-2">Kullanılan Gün</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2 pr-2"><input type="date" value={r.start} onChange={(e)=>setRow(r.id,{start:e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></td>
                              <td className="py-2 pr-2"><input type="date" value={r.end} onChange={(e)=>setRow(r.id,{end:e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></td>
                              <td className="py-2 pr-2"><input value={r.days} onChange={(e)=>setRow(r.id,{days:e.target.value})} placeholder="Örn: 5" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" /></td>
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
              <div className="mt-3 p-4 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çıplak Brüt Ücret</label>
                <input 
                  value={brutUcret} 
                  onChange={(e)=>setBrutUcret(e.target.value)} 
                  placeholder="Örn: 25.000,00" 
                  className={`w-full mt-1 rounded-xl h-11 border px-3 py-2 text-sm font-semibold bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    asgariUcretHatasi 
                      ? 'border-red-500 dark:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`} 
                />
                {asgariUcretHatasi && (
                  <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>
                )}
                
                {/* Brütten Nete Çevir - ZARİF */}
                <div className="mt-4 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
                  <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
                    Brütten Nete Çevir
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Brüt Yıllık İzin Ücreti</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutIzin)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(sgk)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(issizlik)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(gelirVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net Yıllık İzin Ücreti</span>
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(netIzin)}₺</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800/30">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödemedir</span>
                      <input
                        value={employerPayment}
                        onChange={(e)=>setEmployerPayment(e.target.value)}
                        placeholder="Örn: 10.000"
                        className="w-full sm:w-40 rounded-xl h-11 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notlar - ZARİF */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-900/30 dark:to-cyan-900/30 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notlar
              </h3>
            </div>
            <div className="p-6">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-3 text-base">Not: İş Kanunu – Yıllık İzin 14. Madde</div>
              <div className="space-y-3">
                {NOTE_ITEMS.map((note, index) => (
                  <div key={index} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-semibold">{index + 1}</span>
                    <p className="flex-1">{note}</p>
                  </div>
                ))}
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
          title: `Kısmi Süreli ${REPORT_TITLE} Rapor`,
          copyTargetId: "kismi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kismi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #kismi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="kismi-word-copy">
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
          onPdf: () => downloadPdfFromDOM(`Kısmi Süreli ${REPORT_TITLE} Rapor`, "report-content"),
        }}
      />

      {/* Kaydetme Modal */}
      {showExclusionSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionSaveModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan İzinleri Kaydet</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste Adı</label>
              <input
                type="text"
                placeholder="Örn: Davacı A - Kullanılan İzinler"
                value={exclusionSaveName}
                onChange={(e) => setExclusionSaveName(e.target.value)}
                className="mt-1 w-full rounded-xl h-11 border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExclusionSaveModal(false);
                  setExclusionSaveName("");
                }}
              >
                İptal
              </Button>
              <Button
                onClick={async () => {
                  if (!exclusionSaveName.trim()) {
                    showToastError("Lütfen bir isim girin.");
                    return;
                  }
                  const saved = await saveExclusionSet(exclusionSaveName.trim(), rows.filter(r => r.start && r.end));
                  if (saved) {
                    success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`);
                    setShowExclusionSaveModal(false);
                    setExclusionSaveName("");
                  } else {
                    showToastError("Kaydetme işlemi başarısız oldu.");
                  }
                }}
                disabled={!exclusionSaveName.trim()}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Yükleme Modal */}
      {showExclusionLoadModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionLoadModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı Kullanılan İzinler</h3>
            {savedExclusionSets.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {savedExclusionSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600">
                    <div>
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRows(set.data.length > 0 ? set.data : createInitialRows(7));
                          success(`"${set.name}" yüklendi!`);
                          setShowExclusionLoadModal(false);
                        }}
                      >
                        Yükle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) {
                            const deleted = await deleteExclusionSet(set.id);
                            if (deleted) {
                              success("Liste silindi.");
                              const updatedSets = await getAllExclusionSets();
                              setSavedExclusionSets(updatedSets);
                            } else {
                              showToastError("Silme işlemi başarısız oldu.");
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowExclusionLoadModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
}
