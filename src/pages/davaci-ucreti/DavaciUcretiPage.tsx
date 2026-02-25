/**
 * MODE: VENDOR / IMMUTABLE
 * STATUS: LOCKED
 *
 * This page is frozen.
 * Do NOT modify unless:
 * - Legal / business rules change
 * - Critical production bug exists
 */

/**
 * DavaciUcretiPage.tsx
 * SADECE UI + event bağlama.
 * Hesaplama, API, mantık YAPMAZ.
 * Butonlar sadece action çağırır.
 */

import { useMemo, useEffect, useCallback, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Save, Download, Trash2, Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast, ToastProvider, Toaster } from "./toast";
import { KaydetProvider, useKaydetContext } from "./localHooks/KaydetProvider";
import { usePageStyle } from "./localHooks/usePageStyle";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./storage";
import { getAsgariUcretByDate, getAsgariUcretByYearAndPeriod, hasTwoPeriods } from "./utils";
import { saveCalculation } from "./save";
import EklentiModal from "./EklentiModal";

// State ve actions
import { useDavaciUcretiState } from "./state";
import {
  handleLoadCalculation,
  handleCalculateTotalBrut,
  prepareSaveData,
} from "./actions";
import { computeNetFromGrossSingle, computeGrossFromNetSingle } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";
import { fmtCurrency, parseNum } from "./calculations";
import { fmtCurrency as fmt, parseNum as parseNumUtil } from "./utils";
import type { ExtraItem } from "./contract";

// Components
import { type ReportConfig } from "@/components/report";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";

// Constants
const PAGE_TITLE = "Davacı Ücreti Hesaplama";
const CALCULATION_TYPE = "davaci_ucreti";

// Scoped CSS for gradient hover animation
const gradientHoverStyles = `
  .davaci-btn-gradient-primary {
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  .davaci-btn-gradient-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.9) 0%, rgba(59, 130, 246, 1) 50%, rgba(96, 165, 250, 0.9) 100%);
    transform: translateX(100%);
    transition: transform 280ms ease-out;
    z-index: -1;
  }
  .davaci-btn-gradient-primary:hover::before {
    transform: translateX(0);
  }
  .davaci-btn-gradient-secondary {
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  .davaci-btn-gradient-secondary::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.25) 0%, rgba(59, 130, 246, 0.35) 50%, rgba(96, 165, 250, 0.25) 100%);
    transform: translateX(100%);
    transition: transform 280ms ease-out;
    z-index: -1;
  }
  .davaci-btn-gradient-secondary:hover::before {
    transform: translateX(0);
  }
  .davaci-btn-ghost {
    transition: all 250ms ease-out;
  }
  .davaci-btn-ghost:hover {
    transform: scale(1.02);
    box-shadow: 0 0 0 2px rgba(147, 51, 234, 0.3);
  }
`;

export default function DavaciUcretiPage() {
  return (
    <ToastProvider>
      <KaydetProvider>
        <style>{gradientHoverStyles}</style>
        <DavaciUcretiPageContent />
      </KaydetProvider>
    </ToastProvider>
  );
}

function DavaciUcretiPageContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();

  const { success, error: showToastError } = useToast();
  const { kaydetAc } = useKaydetContext();
  const [isSaving, setIsSaving] = useState(false);

  // State
  const {
    ciplakBrut,
    setCiplakBrut,
    extraItems,
    setExtraItems,
    notes,
    setNotes,
    currentRecordName,
    setCurrentRecordName,
    selectedYear,
    setSelectedYear,
    selectedPeriod,
    setSelectedPeriod,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    saveName,
    setSaveName,
    savedSets,
    setSavedSets,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    netFromGross,
    setNetFromGross,
    netForGross,
    setNetForGross,
    currentYear,
  } = useDavaciUcretiState();

  // Toplam brüt hesapla
  const totalBrut = useMemo(
    () => handleCalculateTotalBrut(ciplakBrut, extraItems),
    [ciplakBrut, extraItems]
  );

  // Rapor config – merkezi BaseReportModal (sürüklenebilir, 16cm)
  const davaciReportConfig = useMemo((): ReportConfig => {
    const fmtVal = (n: number) => fmt(n);
    const grossNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [];
    if (netFromGross && netFromGross.gross > 0) {
      grossNetRows.push(
        { label: "Brüt Ücret", value: `${fmtVal(netFromGross.gross)} ₺` },
        { label: "SGK Primi (%14)", value: `-${fmtVal(netFromGross.sgk)} ₺`, isDeduction: true },
        { label: "İşsizlik Primi (%1)", value: `-${fmtVal(netFromGross.issizlik)} ₺`, isDeduction: true }
      );
      if ((netFromGross.gelirVergisiIstisna ?? 0) > 0) {
        grossNetRows.push(
          { label: "Gelir Vergisi (Brüt)", value: `-${fmtVal(netFromGross.gelirVergisiBrut ?? 0)} ₺`, isDeduction: true },
          { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtVal(netFromGross.gelirVergisiIstisna)} ₺` },
          { label: "Net Gelir Vergisi", value: `-${fmtVal(netFromGross.gelirVergisi)} ₺`, isDeduction: true }
        );
      } else {
        grossNetRows.push({ label: `Gelir Vergisi ${netFromGross.gelirVergisiDilimleri || ""}`, value: `-${fmtVal(netFromGross.gelirVergisi)} ₺`, isDeduction: true });
      }
      if ((netFromGross.damgaVergisiIstisna ?? 0) > 0) {
        grossNetRows.push(
          { label: "Damga Vergisi (Brüt)", value: `-${fmtVal(netFromGross.damgaVergisiBrut ?? 0)} ₺`, isDeduction: true },
          { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtVal(netFromGross.damgaVergisiIstisna)} ₺` },
          { label: "Net Damga Vergisi", value: `-${fmtVal(netFromGross.damgaVergisi)} ₺`, isDeduction: true }
        );
      } else {
        grossNetRows.push({ label: "Damga Vergisi (binde 7,59)", value: `-${fmtVal(netFromGross.damgaVergisi)} ₺`, isDeduction: true });
      }
      grossNetRows.push({ label: "Net Ücret", value: `${fmtVal(netFromGross.net)} ₺`, isNet: true });
    }
    return {
      title: "Davacı Ücreti Raporu",
      sections: { info: true, periodTable: false, grossToNet: grossNetRows.length > 0, mahsuplasma: false },
      infoRows: [{ label: "Hesaplama Yılı", value: String(selectedYear) }],
      customSections: [
        {
          title: "Ücret Bileşenleri",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
              <tbody>
                <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Çıplak Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(parseNum(ciplakBrut))}₺</td>
                </tr>
                {extraItems.filter(item => parseNum(item.value) > 0).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{item.name || `Ek Kalem ${idx + 1}`}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(parseNum(item.value))}₺</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Giydirilmiş Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(totalBrut)}₺</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(notes && notes.trim() !== ""
          ? [{
              title: "Notlar",
              content: <div style={{ fontSize: '10px', color: '#374151', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb', padding: '8px', backgroundColor: '#f9fafb' }}>{notes}</div>,
            }]
          : []),
      ],
      grossToNetData: grossNetRows.length > 0 ? { title: "Brüt'ten Net'e Çeviri", rows: grossNetRows } : undefined,
    };
  }, [ciplakBrut, extraItems, totalBrut, netFromGross, selectedYear, notes]);

  // Bir yılda 2 dönem var mı kontrol et
  const hasTwoPeriodsForYear = useMemo(() => {
    return hasTwoPeriods(selectedYear);
  }, [selectedYear]);

  // Asgari ücret kontrolü
  const asgariUcretHatasi = useMemo(() => {
    if (!ciplakBrut || !selectedYear) return null;

    const brutValue = parseNum(ciplakBrut);
    if (!brutValue || brutValue === 0) return null;

    // Yıl ve döneme göre asgari ücreti al
    const minUcret = getAsgariUcretByYearAndPeriod(selectedYear, selectedPeriod);
    if (!minUcret) return null;

    const periodText = hasTwoPeriodsForYear 
      ? (selectedPeriod === 1 ? "1. dönem (Ocak-Haziran)" : "2. dönem (Temmuz-Aralık)")
      : "";

    if (brutValue < minUcret) {
      return `Girilen ücret, ${selectedYear} yılı${hasTwoPeriodsForYear ? ` ${periodText}` : ""} asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)} ₺).`;
    }

    return null;
  }, [ciplakBrut, selectedYear, selectedPeriod, hasTwoPeriodsForYear]);

  // Brütten Nete Çeviri - Tek aylık ücret, Ücret Alacağı ile aynı mantık (lokal, asgari ücret istisnaları dahil)
  useEffect(() => {
    if (totalBrut > 0) {
      const d = computeNetFromGrossSingle(totalBrut, selectedYear, selectedPeriod);
      setNetFromGross({
        gross: d.totalGross,
        sgk: d.totalSgk,
        issizlik: d.totalIssizlik,
        gelirVergisi: d.totalGelirVergisi,
        gelirVergisiDilimleri: "",
        damgaVergisi: d.totalDamgaVergisi,
        net: d.totalNet,
        gelirVergisiBrut: d.totalGelirVergisiBrut,
        gelirVergisiIstisna: d.totalGelirVergisiIstisna,
        damgaVergisiBrut: d.totalDamgaVergisiBrut,
        damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      });
    } else {
      setNetFromGross({
        gross: 0,
        sgk: 0,
        issizlik: 0,
        gelirVergisi: 0,
        gelirVergisiDilimleri: "",
        damgaVergisi: 0,
        net: 0,
      });
    }
  }, [totalBrut, selectedYear, selectedPeriod]);

  // Netten Brüte Çeviri - Lokal (Brütten Nete ile AYNI kurallar, asgari ücret istisnası dahil)
  const grossFromNet = useMemo(() => {
    const netVal = parseNum(netForGross);
    if (netVal <= 0) {
      return { net: 0, gross: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0 };
    }
    const d = computeGrossFromNetSingle(netVal, selectedYear, selectedPeriod);
    return {
      net: d.totalNet,
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
    };
  }, [netForGross, selectedYear, selectedPeriod]);

  // Bölüm bazlı Word tabloları
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const n1 = adaptToWordTable({
      headers: ["Hesaplama Yılı", "Tarih"],
      rows: [[String(selectedYear), new Date().toLocaleDateString("tr-TR")]],
    });
    sections.push({
      id: "ust-bilgiler",
      title: "Üst Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
    });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt Ücret", value: `${fmt(parseNum(ciplakBrut))}₺` },
    ];
    extraItems.filter((item) => parseNum(item.value) > 0).forEach((item, idx) => {
      bilesenData.push({ label: item.name || `Ek Kalem ${idx + 1}`, value: `${fmt(parseNum(item.value))}₺` });
    });
    bilesenData.push({ label: "Giydirilmiş Brüt Ücret", value: `${fmt(totalBrut)}₺` });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({
      id: "ana-hesap",
      title: "Ücret Bileşenleri",
      html: buildWordTable(n2.headers, n2.rows),
    });

    const grossNetRows = davaciReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n3 = adaptToWordTable(grossNetRows);
      sections.push({
        id: "brutten-nete",
        title: "Brüt'ten Net'e Çeviri",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }

    if (notes && notes.trim() !== "") {
      const n4 = adaptToWordTable({ headers: ["Notlar"], rows: [[notes.trim()]] });
      sections.push({
        id: "sonuc",
        title: "Notlar",
        html: buildWordTable(n4.headers, n4.rows),
      });
    }

    return sections;
  }, [davaciReportConfig, ciplakBrut, extraItems, totalBrut, selectedYear, notes]);

  // Veri yükleme
  const loadCalculation = useCallback(
    async (caseId: string) => {
      const result = await handleLoadCalculation(caseId);

      if (result) {
        const formData = result.formData;
        const form = formData.data?.form || formData.form || formData;

        if (form.ciplakBrut) {
          setCiplakBrut(String(form.ciplakBrut));
        }

        if (form.extraItems && Array.isArray(form.extraItems)) {
          const normalizedItems = form.extraItems.map((item: any) => ({
            id: item.id || Math.random().toString(36).slice(2),
            name: String(item.name || ""),
            value: item.value !== undefined && item.value !== null ? String(item.value) : "",
          }));
          setExtraItems(normalizedItems);
        }

        if (form.selectedYear) {
          const year = Number(form.selectedYear);
          setSelectedYear(year);
          // Eğer yılda 2 dönem yoksa, period'u 2'ye sıfırla
          if (!hasTwoPeriods(year)) {
            setSelectedPeriod(2);
          } else if (form.selectedPeriod) {
            setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
          }
        } else if (form.selectedPeriod) {
          setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
        }

        if (form.notes) {
          setNotes(String(form.notes));
        }

        // Load netFromGross if available
        const savedNetFromGross = formData.data?.netFromGross || formData.netFromGross;
        if (savedNetFromGross) {
          setNetFromGross({
            gross: savedNetFromGross.gross || 0,
            sgk: savedNetFromGross.sgk || 0,
            issizlik: savedNetFromGross.issizlik || 0,
            gelirVergisi: savedNetFromGross.gelirVergisi || 0,
            gelirVergisiDilimleri: String(savedNetFromGross.gelirVergisiDilimleri || ""),
            damgaVergisi: savedNetFromGross.damgaVergisi || 0,
            net: savedNetFromGross.net || 0,
            gelirVergisiBrut: savedNetFromGross.gelirVergisiBrut,
            gelirVergisiIstisna: savedNetFromGross.gelirVergisiIstisna,
            damgaVergisiBrut: savedNetFromGross.damgaVergisiBrut,
            damgaVergisiIstisna: savedNetFromGross.damgaVergisiIstisna,
          });
        }

        setCurrentRecordName(result.name || null);
        success(`Kayıt yüklendi`);
      }
    },
    [setCiplakBrut, setExtraItems, setSelectedYear, setSelectedPeriod, setNotes, setNetFromGross, setCurrentRecordName, success]
  );

  // ID değiştiğinde yükle
  useEffect(() => {
    if (effectiveId) {
      loadCalculation(effectiveId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  // Event handlers
  const handleSave = async () => {
    const saveData = prepareSaveData(
      ciplakBrut,
      extraItems,
      selectedYear,
      selectedPeriod,
      notes,
      totalBrut,
      netFromGross
    );

    kaydetAc({
      hesapTuru: CALCULATION_TYPE,
      veri: saveData,
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      onSuccess: (result) => {
        success("Hesaplama kaydedildi");
        setCurrentRecordName(result.name || null);
        if (result.id && !effectiveId) {
          navigate(`/davaci-ucreti/${result.id}`);
        }
      },
      onError: (err) => {
        showToastError(err.message || "Kaydetme hatası");
      },
    });
  };

  const handleNew = () => {
    if (effectiveId) {
      navigate("/davaci-ucreti");
    }
    setCiplakBrut("");
    setExtraItems([
      { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
      { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
    ]);
    setSelectedYear(currentYear);
    setSelectedPeriod(2);
    setNotes("");
    setNetFromGross({
      gross: 0,
      sgk: 0,
      issizlik: 0,
      gelirVergisi: 0,
      gelirVergisiDilimleri: "",
      damgaVergisi: 0,
      net: 0,
    });
    setCurrentRecordName(null);
  };

  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${PAGE_TITLE}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}h2{font-size:12px;margin:8px 0 6px 0;page-break-after:avoid}div{margin-bottom:10px}button{display:none!important}</style></head><body>${targetEl.outerHTML}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
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
    } catch (err) {
      console.error("Print error:", err);
    }
  };

  const handleRequestEklenti = (itemId: string) => {
    const fieldKey = `extra:${itemId}`;
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  };

  const handleApplyEklenti = (value: number, fieldKey: string) => {
    const itemId = fieldKey.replace("extra:", "");
    setExtraItems(
      extraItems.map((item) =>
        item.id === itemId
          ? { ...item, value: String(value.toFixed(2)).replace(".", ",") }
          : item
      )
    );
    setActiveModal(null);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }

    if (extraItems.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const saveResult = await saveExtraCalculationsSet(saveName.trim(), extraItems);
    if (saveResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
      const sets = await getAllExtraCalculationsSets();
      setSavedSets(sets);
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtraItems(data);
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
      const sets = await getAllExtraCalculationsSets();
      setSavedSets(sets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  const handleUpdateExtraItem = (itemId: string, field: "name" | "value", value: string) => {
    setExtraItems(
      extraItems.map((it) => (it.id === itemId ? { ...it, [field]: value } : it))
    );
  };

  const handleAddExtraItem = () => {
    setExtraItems([
      ...extraItems,
      { id: Math.random().toString(36).slice(2), name: "", value: "" },
    ]);
  };

  const handleRemoveExtraItem = (itemId: string) => {
    setExtraItems(extraItems.filter((it) => it.id !== itemId));
  };

  return (
    <>
      <div style={{ height: "4px", background: pageStyle?.color || "#6A1B9A" }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - sadece video butonu; Yeni Hesapla kart içinde + ikonu */}
          <div className="mb-8 flex justify-end">
            {getVideoLink("davaci-ucreti") && (
              <button
                onClick={() => window.open(getVideoLink("davaci-ucreti"), "_blank")}
                className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600 dark:hover:bg-gray-700 transition-all"
              >
                <Youtube className="w-4 h-4" />
                Kullanım Videosu İzle
              </button>
            )}
          </div>

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Form Section */}
            <div className="p-8 space-y-6 dark:bg-gray-800">
              {/* Temel Bilgiler */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">📅</div>
                  Temel Bilgiler
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hesaplama Yılı</label>
                    <select
                      id="year"
                      value={selectedYear}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        setSelectedYear(newYear);
                        if (!hasTwoPeriods(newYear)) setSelectedPeriod(2);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  {hasTwoPeriodsForYear && (
                    <div>
                      <label htmlFor="period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dönem</label>
                      <select
                        id="period"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(Number(e.target.value) as 1 | 2)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value={1}>1. Dönem (Ocak-Haziran)</option>
                        <option value={2}>2. Dönem (Temmuz-Aralık)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="ciplakBrut" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Çıplak Brüt Ücret</label>
                    <div className="relative">
                      <input
                        id="ciplakBrut"
                        type="text"
                        value={ciplakBrut}
                        onChange={(e) => setCiplakBrut(e.target.value)}
                        placeholder="Örn: 25.000,00"
                        className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-8 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${asgariUcretHatasi ? "border-red-500 dark:border-red-500" : "border-gray-200 dark:border-gray-600"}`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">₺</span>
                    </div>
                    {asgariUcretHatasi && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{asgariUcretHatasi}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ekstra Hesaplamalar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">₺</div>
                    Ekstra Hesaplamalar
                  </h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => getAllExtraCalculationsSets().then((sets) => { setSavedSets(sets); setShowImportModal(true); })}
                      className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      İçe Aktar
                    </button>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      disabled={extraItems.length === 0}
                      className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      Kaydet
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {extraItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.name}
                        onChange={(e) => handleUpdateExtraItem(item.id, "name", e.target.value)}
                        className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Kalem Adı"
                      />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={item.value}
                          onChange={(e) => handleUpdateExtraItem(item.id, "value", e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="Tutar"
                        />
                        <button
                          type="button"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                          onClick={() => handleRequestEklenti(item.id)}
                        >
                          Eklenti Hesapla
                          <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraItem(item.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400"
                        aria-label="Satırı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={handleAddExtraItem} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium px-4 py-2.5 rounded-full border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500">
                    + Ekle
                  </button>
                </div>
              </div>

              {/* Giydirilmiş Brüt Ücret */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Giydirilmiş Brüt Ücret</div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtCurrency(totalBrut)} ₺</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Çıplak Brüt + Ekstra Hesaplamalar</p>
              </div>

              {/* Brütten Nete & Netten Brüte Çeviri - Yan yana, aynı kurallar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brütten Nete */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white text-sm">₺</div>
                      Brütten Nete Çeviri
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tek aylık giydirilmiş brüt ücret üzerinden hesaplanır.</p>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Brüt Ücret</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{totalBrut > 0 ? fmtCurrency(netFromGross.gross) : "0,00"} ₺</span>
                    </div>
                    {totalBrut > 0 && (
                      <>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                          <span className="text-red-600 dark:text-red-400">SGK Primi (%14)</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.sgk)} ₺</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                          <span className="text-red-600 dark:text-red-400">İşsizlik Primi (%1)</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.issizlik)} ₺</span>
                        </div>
                        {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-red-600 dark:text-red-400">Gelir Vergisi (Brüt)</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.gelirVergisiBrut ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-green-600 dark:text-green-400">Asg. Üc. Gel. Vergi İst.</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">+{fmtCurrency(netFromGross.gelirVergisiIstisna ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-gray-600 dark:text-gray-400">Net Gelir Vergisi</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                            <span className="text-red-600 dark:text-red-400">Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                          </div>
                        )}
                        {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-red-600 dark:text-red-400">Damga Vergisi (Brüt)</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.damgaVergisiBrut ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-green-600 dark:text-green-400">Asg. Üc. Damga Vergi İst.</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">+{fmtCurrency(netFromGross.damgaVergisiIstisna ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-gray-600 dark:text-gray-400">Net Damga Vergisi</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                            <span className="text-red-600 dark:text-red-400">Damga Vergisi (binde 7,59)</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400">Net Ücret</span>
                          <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(netFromGross.net)} ₺</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Netten Brüte */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-sm">₺</div>
                      Netten Brüte Çeviri
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tek aylık net ücret üzerinden hesaplanır. Brütten nete ile aynı kurallar.</p>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div className="space-y-1 mb-3">
                      <label className="text-xs text-gray-600 dark:text-gray-400">Net Ücret Girin</label>
                      <div className="flex gap-2">
                        <input
                          value={netForGross}
                          onChange={(e) => setNetForGross(e.target.value)}
                          placeholder="Örn: 18.000,00"
                          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {netFromGross.net > 0 && (
                          <button
                            type="button"
                            onClick={() => setNetForGross(fmt(netFromGross.net))}
                            className="shrink-0 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors"
                          >
                            Sol panelin netini kullan
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Net Ücret</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{grossFromNet.net > 0 ? fmtCurrency(grossFromNet.net) : "0,00"} ₺</span>
                    </div>
                    {grossFromNet.gross > 0 && (
                      <>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                          <span className="text-red-600 dark:text-red-400">SGK Primi (%14)</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.sgk)} ₺</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                          <span className="text-red-600 dark:text-red-400">İşsizlik Primi (%1)</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.issizlik)} ₺</span>
                        </div>
                        {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-red-600 dark:text-red-400">Gelir Vergisi (Brüt)</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-green-600 dark:text-green-400">Asg. Üc. Gel. Vergi İst.</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-gray-600 dark:text-gray-400">Net Gelir Vergisi</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                            <span className="text-red-600 dark:text-red-400">Gelir Vergisi {grossFromNet.gelirVergisiDilimleri}</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span>
                          </div>
                        )}
                        {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-red-600 dark:text-red-400">Damga Vergisi (Brüt)</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-green-600 dark:text-green-400">Asg. Üc. Damga Vergi İst.</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)} ₺</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                              <span className="text-gray-600 dark:text-gray-400">Net Damga Vergisi</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-600">
                            <span className="text-red-600 dark:text-red-400">Damga Vergisi (binde 7,59)</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400">Brüt Ücret</span>
                          <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(grossFromNet.gross)} ₺</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notlar - bilgi metni + kullanıcının yazdığı notlar (textarea yok) */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">✏️</div>
                  Notlar
                </h2>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir. Prim, İkramiye gibi ücretlerin hesaplanmasında son 12 aylık bordroda yer alan tüm kalemler toplanır, toplam 360'a bölünür, 30 ile çarpılır.</p>
                  {notes && notes.trim() !== "" && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pt-2 border-t border-slate-200 dark:border-slate-600">{notes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kaydet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Ekstra Hesaplamaları Kaydet</h3>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Set adı girin"
              className="w-full mb-4 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveExtra();
                if (e.key === "Escape") setShowSaveModal(false);
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleSaveExtra}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İçe Aktar Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Kaydedilmiş Setleri İçe Aktar</h3>
            {savedSets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Henüz kaydedilmiş set bulunmuyor</p>
            ) : (
              <div className="space-y-2">
                {savedSets.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {set.data.length} kalem • {new Date(set.createdAt).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleImportExtra(set.name)}
                        className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-gray-600 dark:text-gray-400"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExtra(set.id)}
                        className="p-2 rounded-full border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eklenti Modal */}
      {activeModal && (
        <EklentiModal
          open={true}
          title="Eklenti Hesapla"
          onClose={closeModal}
          months={eklentiValues[activeModal] || Array(12).fill("")}
          onMonthsChange={(index, value) => {
            setEklentiValues((prev) => ({
              ...prev,
              [activeModal]:
                prev[activeModal]?.map((v, i) => (i === index ? value : v)) || Array(12).fill(""),
            }));
          }}
          onConfirm={(v) => handleApplyEklenti(v, activeModal)}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "davaci-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ maxHeight: "80vh", overflow: "auto", background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #davaci-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #davaci-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="davaci-word-copy">
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
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
        }}
      />

      {/* Report Content (hidden, for print) */}
      <div style={{ display: 'none' }}>
        <div id="report-content" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
                {/* Rapor Tarihi ve Hesaplama Yılı */}
                <div
                  style={{
                    marginBottom: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <p style={{ fontSize: "10px", color: "#6b7280", margin: 0 }}>
                    Hesaplama Yılı: {selectedYear}
                  </p>
                  <p style={{ fontSize: "10px", color: "#6b7280", margin: 0 }}>
                    Tarih: {new Date().toLocaleDateString("tr-TR")}
                  </p>
                </div>

                {/* Çıplak Brüt ve Ekstra Kalemler */}
                <div style={{ marginBottom: "14px" }}>
                  <h2
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      margin: "0 0 8px 0",
                      paddingBottom: "4px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Ücret Bileşenleri
                  </h2>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      border: "1px solid #999",
                      fontSize: "10px",
                    }}
                  >
                    <tbody>
                      <tr style={{ backgroundColor: "#f3f4f6", fontWeight: 600 }}>
                        <td style={{ border: "1px solid #999", padding: "5px 8px", width: "60%" }}>
                          Çıplak Brüt Ücret
                        </td>
                        <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>
                          {fmt(parseNum(ciplakBrut))}₺
                        </td>
                      </tr>
                      {extraItems
                        .filter((item) => parseNum(item.value) > 0)
                        .map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ border: "1px solid #999", padding: "5px 8px" }}>
                              {item.name || `Ek Kalem ${idx + 1}`}
                            </td>
                            <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>
                              {fmt(parseNum(item.value))}₺
                            </td>
                          </tr>
                        ))}
                      <tr style={{ backgroundColor: "#dbeafe", fontWeight: 600 }}>
                        <td style={{ border: "1px solid #999", padding: "5px 8px" }}>
                          Giydirilmiş Brüt Ücret
                        </td>
                        <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>
                          {fmt(totalBrut)}₺
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Brüt'ten Net'e Çeviri */}
                {netFromGross && netFromGross.gross > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <h2
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        margin: "0 0 8px 0",
                        paddingBottom: "4px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Brüt'ten Net'e Çeviri
                    </h2>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "1px solid #999",
                        fontSize: "10px",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #999", padding: "5px 8px", width: "60%" }}>
                            Brüt Ücret
                          </td>
                          <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right" }}>
                            {fmt(netFromGross.gross)} ₺
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #999", padding: "5px 8px" }}>SGK Primi (%14)</td>
                          <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>
                            -{fmt(netFromGross.sgk)} ₺
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #999", padding: "5px 8px" }}>İşsizlik Primi (%1)</td>
                          <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>
                            -{fmt(netFromGross.issizlik)} ₺
                          </td>
                        </tr>
                        {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Gelir Vergisi (Brüt)</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.gelirVergisiBrut ?? 0)} ₺</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Asg. Üc. Gelir Vergi İstisnası</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#16a34a" }}>+{fmt(netFromGross.gelirVergisiIstisna ?? 0)} ₺</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Net Gelir Vergisi</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.gelirVergisi)} ₺</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</td>
                            <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.gelirVergisi)} ₺</td>
                          </tr>
                        )}
                        {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Damga Vergisi (Brüt)</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.damgaVergisiBrut ?? 0)} ₺</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Asg. Üc. Damga Vergi İstisnası</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#16a34a" }}>+{fmt(netFromGross.damgaVergisiIstisna ?? 0)} ₺</td>
                            </tr>
                            <tr>
                              <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Net Damga Vergisi</td>
                              <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.damgaVergisi)} ₺</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Damga Vergisi (binde 7,59)</td>
                            <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(netFromGross.damgaVergisi)} ₺</td>
                          </tr>
                        )}
                        <tr style={{ backgroundColor: "#dcfce7", fontWeight: 600 }}>
                          <td style={{ border: "1px solid #999", padding: "5px 8px" }}>Net Ücret</td>
                          <td style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "right", color: "#16a34a" }}>
                            {fmt(netFromGross.net)} ₺
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notlar */}
                {notes && notes.trim() !== "" && (
                  <div style={{ marginBottom: "14px" }}>
                    <h2
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        margin: "0 0 8px 0",
                        paddingBottom: "4px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Notlar
                    </h2>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#374151",
                        whiteSpace: "pre-wrap",
                        border: "1px solid #e5e7eb",
                        padding: "8px",
                        backgroundColor: "#f9fafb",
                      }}
                    >
                      {notes}
                    </div>
                  </div>
                )}
        </div>
      </div>
      <Toaster />
    </>
  );
}
