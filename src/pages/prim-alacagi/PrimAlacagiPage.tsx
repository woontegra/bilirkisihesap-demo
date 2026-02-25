/**
 * PrimAlacagiPage.tsx
 * SADECE UI + event bağlama.
 * Hesaplama, API, mantık YAPMAZ.
 * Butonlar sadece action çağırır.
 */

import { useMemo, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { Button } from "@/components/ui/button";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import "@/styles/soft-glow.css";

// State ve actions
import { usePrimState } from "./state";
import {
  handleCalculatePrim,
  handleLoadCalculation,
  handleValidateForm,
  prepareSaveData,
} from "./actions";
import { fmt, getBrutForNetConversion, calculateNetFromBrut, calculateDamgaVergisi, parseNum } from "./calculations";
import type { PrimRowRequest, PrimSavedData } from "./contract";

// Constants
const PAGE_TITLE = "Prim Alacağı Hesaplama";
const BUTTON_LABELS = {
  CALCULATE: "Prim Hesapla",
  SAVE: "Kaydet",
  PRINT: "Yazdır",
  RESET: "Sıfırla",
  ADD_ROW: "+ Satır Ekle",
  REMOVE_ROW: "Sil",
};
const FORM_LABELS = {
  PRINCIPAL: "Prim Matrahı (Brüt Ücret)",
  PERCENT: "Prim Oranı (%)",
  AMOUNT: "Prim Tutarı",
  PRIM_AMOUNT: "Prim Tutarı",
  TOTAL: "Toplam Prim Alacağı",
  TOTAL_PRIM: "Toplam Prim",
};
const NOTE_TEXT =
  "İş sözleşmesinde veya toplu iş sözleşmesinde belirlenen prim ödemeleri, işçinin çalışması karşılığında kazanılan haklardan olup, ödenmemesi halinde alacak olarak talep edilebilir. Primler genellikle performansa, satış rakamlarına veya belirli hedeflere ulaşılmasına bağlı olarak ödenir.";

export default function PrimAlacagiPage() {
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("prim-alacagi");

  // State
  const {
    rows,
    setRows,
    amounts,
    setAmounts,
    total,
    setTotal,
    brutInputForNet,
    setBrutInputForNet,
    currentRecordName,
    setCurrentRecordName,
    loadRanRef,
  } = usePrimState();

  // Brüt-net çevirisi için kullanılacak tutar
  const brutForNetConversion = useMemo(
    () => getBrutForNetConversion(brutInputForNet, total),
    [brutInputForNet, total]
  );

  // Rows değiştiğinde hesaplama yap
  useEffect(() => {
    if (rows.length > 0 && rows.some((r) => r.principal && r.percent)) {
      handleCalculatePrim(rows).then((result) => {
        if (result) {
          setAmounts(result.amounts);
          setTotal(result.total);
        } else {
          setAmounts([]);
          setTotal(0);
        }
      }).catch((err) => {
        console.error("Prim hesaplama hatası:", err);
        setAmounts([]);
        setTotal(0);
      });
    } else {
      setAmounts([]);
      setTotal(0);
    }
  }, [rows]);

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;

        const data = await handleLoadCalculation(id);

        if (!isMounted || !data) return;

        // Form alanlarını doldur
        const formData = data.formData;
        const form = (formData as any).form || (formData as any).data?.form || formData;

        // Rows verilerini yükle
        if (form.rows && Array.isArray(form.rows) && form.rows.length > 0) {
          const loadedRows: PrimRowRequest[] = form.rows.map((r: any) => ({
            id: r.id || Math.random().toString(36).slice(2),
            principal: r.principal ? String(r.principal) : "",
            percent: r.percent ? String(r.percent) : "",
          }));
          setRows(loadedRows);
        } else if ((formData as any).rows && Array.isArray((formData as any).rows) && (formData as any).rows.length > 0) {
          const loadedRows: PrimRowRequest[] = (formData as any).rows.map((r: any) => ({
            id: r.id || Math.random().toString(36).slice(2),
            principal: r.principal ? String(r.principal) : "",
            percent: r.percent ? String(r.percent) : "",
          }));
          setRows(loadedRows);
        }

        // brutInputForNet yükle
        if (form.brutInputForNet) {
          setBrutInputForNet(form.brutInputForNet);
        } else if ((formData as any).brutInputForNet) {
          setBrutInputForNet((formData as any).brutInputForNet);
        }

        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);

        success(`Kayıt yüklendi (#${id})`);
      } catch (err) {
        if (!isMounted) return;
        console.error("Kayıt yüklenirken hata oluştu:", err);
        showToastError("Kayıt yüklenemedi");
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Rapor config
  const primReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const damgaVergisi = calculateDamgaVergisi(brutForNetConversion);
    const netTotal = calculateNetFromBrut(brutForNetConversion);

    return {
      title: "Prim Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Toplam Prim Kalemi", value: rows.length.toString() },
        { label: "Toplam Prim Alacağı", value: total ? `${fmtLocal(total)} ₺` : "-" },
      ],
      periodData: {
        title: "Prim Alacağı Detayı",
        headers: ["#", "Prim Matrahı (Brüt Ücret)", "Prim Oranı (%)", "Prim Tutarı"],
        rows: rows.map((row, idx) => {
          const amount = amounts[idx] || 0;
          const principalNum = parseNum(row.principal);
          const percentNum = parseNum(row.percent);

          return [
            (idx + 1).toString(),
            principalNum > 0 ? `${fmtLocal(principalNum)} ₺` : "-",
            percentNum > 0 ? `%${fmtLocal(percentNum)}` : "-",
            `${fmtLocal(amount)} ₺`,
          ];
        }),
        footer: ["", "", "TOPLAM:", `${fmtLocal(total)} ₺`],
        alignRight: [1, 2, 3],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Prim Alacağı", value: `${fmtLocal(brutForNetConversion)} ₺` },
          {
            label: "Damga Vergisi (Binde 7,59)",
            value: `-${fmtLocal(damgaVergisi)} ₺`,
            isDeduction: true,
          },
          { label: "Net Prim Alacağı", value: `${fmtLocal(netTotal)} ₺`, isNet: true },
        ],
      },
    };
  }, [rows, amounts, total, brutForNetConversion]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = primReportConfig.infoRows || [];
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = primReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "prim-detay", title: pd.title || "Prim Alacağı Detayı", html: buildWordTable(n2.headers, n2.rows) });
    }

    const gnd = primReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: primReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [primReportConfig]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("prim-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = primReportConfig.title;
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
  }, [primReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = handleValidateForm(rows);
      if (!validation.isValid) {
        showToastError(validation.firstError || "Form hatası");
        return;
      }

      const saveData = prepareSaveData(rows, amounts, total, brutInputForNet);

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "prim_alacagi",
        veri: saveData,
        mevcutId: id,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `/prim-alacagi/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      const hasUnsavedChanges = rows.some((r) => r.principal || r.percent);

      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?"))
          return;
      }

      // Tüm state'leri temizle
      setRows([{ id: Math.random().toString(36).slice(2), principal: "", percent: "" }]);
      setBrutInputForNet("");
      setCurrentRecordName(null);
      loadRanRef.current = false;

      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/prim-alacagi";
      }
    } catch {}
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        principal: "",
        percent: "",
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((x) => x.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, field: "principal" | "percent", value: string) => {
    setRows((prev) =>
      prev.map((x) => (x.id === rowId ? { ...x, [field]: value } : x))
    );
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="Prim Alacağı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="prim"
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
      noBackgroundColor={true}
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

        <div className="w-full space-y-6">
          <div id="prim-print" className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
            <div className="space-y-2">
              {rows.map((r, idx) => {
                const amount = amounts[idx] || 0;
                return (
                  <div key={r.id} className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {FORM_LABELS.PRINCIPAL}
                      </label>
                      <input
                        value={r.principal}
                        onChange={(e) => handleUpdateRow(r.id, "principal", e.target.value)}
                        placeholder="Örn: 50.000"
                        className="mt-1 w-full rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm"
                      />
                    </div>
                    <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {FORM_LABELS.PERCENT}
                      </label>
                      <input
                        value={r.percent}
                        onChange={(e) => handleUpdateRow(r.id, "percent", e.target.value)}
                        placeholder="Örn: 10"
                        className="mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm"
                      />
                    </div>
                    <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {FORM_LABELS.PRIM_AMOUNT}
                      </label>
                      <input
                        readOnly
                        value={`${fmt(amount)} ₺`}
                        className="mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm bg-gray-50 dark:bg-gray-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(r.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm px-3 py-2 font-semibold rounded-full border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                      aria-label="Satırı sil"
                    >
                      {BUTTON_LABELS.REMOVE_ROW}
                    </button>
                  </div>
                );
              })}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-semibold rounded-full border border-blue-200 dark:border-blue-800 px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  {BUTTON_LABELS.ADD_ROW}
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400">{FORM_LABELS.TOTAL_PRIM}</div>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm sm:text-base pt-4 border-t border-gray-200 dark:border-gray-600">
                <span className="font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.TOTAL_PRIM}:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(total)} ₺</span>
              </div>
            </div>
          </div>

          {/* Brütten Nete Çeviri */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Brüt'ten Net'e Çeviri</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.
            </p>

            {/* Manuel Input Alanı */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Brüt Tutar Giriniz (Opsiyonel)
              </label>
              <input
                type="text"
                value={brutInputForNet}
                onChange={(e) => setBrutInputForNet(e.target.value)}
                placeholder={`Varsayılan: ${fmt(total)}`}
                className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Boş bırakırsanız toplam prim alacağı kullanılır.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-sm text-gray-600 dark:text-gray-400">Brüt Prim Alacağı</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutForNetConversion)} ₺</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-sm text-red-600 dark:text-red-400">Damga Vergisi (Binde 7,59)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{fmt(calculateDamgaVergisi(brutForNetConversion))} ₺
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-base font-semibold text-green-700 dark:text-green-400">Net Prim Alacağı</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">
                  {fmt(calculateNetFromBrut(brutForNetConversion))} ₺
                </span>
              </div>
            </div>
          </div>

          {/* Notlar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6 notes-content">
              <p className="text-slate-600 dark:text-slate-300">{NOTE_TEXT}</p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="prim-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={primReportConfig} />
      </div>

      <FooterActions
        pageKey="prim"
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Prim Alacağı Rapor",
          copyTargetId: "prim-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #prim-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #prim-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="prim-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Prim Alacağı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
