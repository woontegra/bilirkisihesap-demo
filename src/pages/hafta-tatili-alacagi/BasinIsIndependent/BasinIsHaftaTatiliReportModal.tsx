import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import BasinIsHaftaTatiliReportNetConversion from "./BasinIsHaftaTatiliReportNetConversion";
import BasinIsHaftaTatiliReportSettlement from "./BasinIsHaftaTatiliReportSettlement";
import { calculateIncomeTaxForYear } from "@/utils/incomeTaxCore";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromBackend } from "@/utils/pdfExport";

// Basın İş Hafta Tatili Tablo satırı tipi
interface BasinIsHaftaTatiliTableRow {
  period: string;
  weekCount: number;
  wage: number;
  coefficient: number;
  dailyWage: number;
  haftaTatiliDays: number;
  haftaTatiliTotal: number;
}

// Çalışma dönemi tipi
interface WorkerPeriod {
  id: string;
  start: string;
  end: string;
}

interface BasinIsHaftaTatiliReportModalProps {
  open: boolean;
  onClose: () => void;
  basinIsHaftaTatiliTableData: BasinIsHaftaTatiliTableRow[];
  workerPeriods: WorkerPeriod[];
  selectedHolidayCount: number;
  totalHolidayDays: number;
  basinIsHaftaTatiliExpiryStart: string | null;
}

export default function BasinIsHaftaTatiliReportModal({
  open,
  onClose,
  basinIsHaftaTatiliTableData,
  workerPeriods,
  selectedHolidayCount,
  totalHolidayDays,
  basinIsHaftaTatiliExpiryStart,
}: BasinIsHaftaTatiliReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const basinIsHaftaTatiliRaporRef = useRef<HTMLDivElement>(null);

  // Yazdır fonksiyonu
  const handleBasinIsHaftaTatiliPrint = () => {
    try {
      const targetEl = document.getElementById("basin-is-hafta-tatili-rapor-icerik");
      const source = targetEl ? targetEl.outerHTML : "";
      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Basın İş Hafta Tatili Alacağı</title>
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              *{box-sizing:border-box}
              body{font-family: Inter, Arial, sans-serif; color:#111827; padding:0}
              .print-title{font-size:18px;font-weight:700;margin-bottom:8px}
              .print-sub{font-size:12px;color:#374151;margin-bottom:6px}
              table{width:100%; border-collapse:collapse}
              thead{background:#f3f4f6}
              th,td{border:1px solid #999; padding:6px; font-size:12px}
              th{text-align:left}
              td{text-align:right}
            </style>
          </head>
          <body>
            <div class="print-title">Basın İş Hafta Tatili Alacağı – Rapor Görünümü</div>
            ${source}
          </body>
        </html>`;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
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
    } catch {}
  };

  const handleBasinIsHaftaTatiliDownloadWord = async () => {
    try {
      setWordBusy(true);
      await downloadWordDocument(
        "Basın İş Hafta Tatili Alacağı – Rapor Görünümü",
        "basin-is-hafta-tatili-rapor-icerik",
        `Basin_Is_Hafta_Tatili_Alacagi_${new Date().toISOString().slice(0, 10)}.docx`
      );
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme fonksiyonu (backend PDF generation kullanır)
  const handleBasinIsHaftaTatiliDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      await downloadPdfFromBackend(
        "hafta_tatili_alacagi_basin_is",
        {
          workerPeriods,
          basinIsHaftaTatiliTableData,
          selectedHolidayCount,
          totalHolidayDays,
          basinIsHaftaTatiliExpiryStart,
        }
      );
    } catch (err) {
      console.error("Basın İş Hafta Tatili PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Toplam Hafta Tatili ücreti (early return öncesi)
  const basinIsHaftaTatiliTotalAmount = useMemo(() => 
    basinIsHaftaTatiliTableData.reduce((sum, row) => sum + row.haftaTatiliTotal, 0),
    [basinIsHaftaTatiliTableData]
  );

  // İşten çıkış tarihine göre yıl belirleme (early return öncesi)
  const selectedYear = useMemo(() => {
    if (workerPeriods && workerPeriods.length > 0) {
      const exitDates = workerPeriods
        .map(p => p.end)
        .filter(d => d && d.trim() !== "")
        .map(d => new Date(d))
        .filter(d => !isNaN(d.getTime()));
      
      if (exitDates.length > 0) {
        const latestExit = exitDates.reduce((latest, current) => 
          current > latest ? current : latest
        );
        const year = latestExit.getFullYear();
        if (year >= 2010 && year <= 2030) {
          return year;
        }
      }
    }
    return new Date().getFullYear();
  }, [workerPeriods]);

  // Net hesap: rapor içindeki nete çevir bileşenine de aktaracağız
  const ssk = useMemo(() => basinIsHaftaTatiliTotalAmount * 0.15, [basinIsHaftaTatiliTotalAmount]);
  const gelirMatrahi = useMemo(() => Math.max(0, basinIsHaftaTatiliTotalAmount - ssk), [basinIsHaftaTatiliTotalAmount, ssk]);
  const gelir = useMemo(() => calculateIncomeTaxForYear(selectedYear, gelirMatrahi), [selectedYear, gelirMatrahi]);
  const damga = useMemo(() => basinIsHaftaTatiliTotalAmount * 0.00759, [basinIsHaftaTatiliTotalAmount]);
  const calculatedNet = useMemo(() => basinIsHaftaTatiliTotalAmount - (ssk + gelir + damga), [basinIsHaftaTatiliTotalAmount, ssk, gelir, damga]);

  // Early return after all hooks
  if (!open) return null;

  // İşe giriş - çıkış tarihleri (ilk ve son)
  const basinIsHaftaTatiliFirstStart = workerPeriods.length > 0 ? workerPeriods[0].start : "";
  const basinIsHaftaTatiliLastEnd =
    workerPeriods.length > 0
      ? workerPeriods[workerPeriods.length - 1].end
      : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-[min(900px,95vw)] max-h-[90vh] overflow-auto rounded-lg shadow-lg"
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            Basın İş Hafta Tatili Alacağı – Rapor Görünümü
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBasinIsHaftaTatiliPrint}
              className="text-sm border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-600"
            >
              Yazdır
            </Button>
            <Button
              variant="default"
              onClick={handleBasinIsHaftaTatiliDownloadWord}
              disabled={wordBusy}
              className="text-sm bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wordBusy ? "Oluşturuluyor..." : "📄 Word İndir"}
            </Button>
            <Button
              variant="default"
              onClick={handleBasinIsHaftaTatiliDownloadPDF}
              disabled={pdfBusy}
              className="text-sm bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfBusy ? "Oluşturuluyor..." : "📕 PDF İndir"}
            </Button>
            <Button variant="outline" onClick={onClose} className="text-sm">
              Kapat
            </Button>
          </div>
        </div>
        <div className="p-4 text-sm">
          <div id="basin-is-hafta-tatili-rapor-icerik" ref={basinIsHaftaTatiliRaporRef as any}>
            <div
              style={{
                fontFamily: "Inter, Arial, sans-serif",
                color: "#111827",
              }}
            >
              {/* Başlık ve Tarih */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  marginBottom: 12,
                }}
              >
                <div style={{ textAlign: "right", fontSize: 12, color: "#374151" }}>
                  <div>Tarih: {new Date().toLocaleDateString("tr-TR")}</div>
                </div>
              </div>

              {/* Özet Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 12,
                  background: "#fafafa",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Davacı</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>-</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Davalı</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>-</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Seçilen Tatil Sayısı</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedHolidayCount} adet</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Toplam Tatil Günü</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{totalHolidayDays} gün</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>İşe Giriş</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {basinIsHaftaTatiliFirstStart || "-"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>İşten Çıkış</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{basinIsHaftaTatiliLastEnd || "-"}</div>
                </div>
                {basinIsHaftaTatiliExpiryStart && (
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Zamanaşımı Başlangıç</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(basinIsHaftaTatiliExpiryStart).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                )}
              </div>

              {/* Çalışma Dönemleri */}
              {workerPeriods.length > 0 && (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      background: "#f3f4f6",
                      padding: "8px 10px",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Çalışma Dönemleri
                  </div>
                  <div style={{ padding: "10px", fontSize: 12 }}>
                    {workerPeriods.map((period, idx) => (
                      <div key={period.id || idx}>
                        {new Date(period.start).toLocaleDateString("tr-TR")} -{" "}
                        {new Date(period.end).toLocaleDateString("tr-TR")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hafta Tatili Hesaplama Tablosu */}
              <div
                id="basin-is-hafta-tatili-calc-table"
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: "#f3f4f6",
                    padding: "8px 10px",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Hafta Tatili Hesaplama Tablosu
                </div>
                <div className="overflow-x-auto">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f9fafb" }}>
                      <tr>
                        <th
                          style={{
                            border: "1px solid #d1d5db",
                            padding: "6px",
                            textAlign: "left",
                          }}
                        >
                          Tarih (Ücret Dönemi)
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Hafta Sayısı
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Ücret (BRÜT)
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Katsayı
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Hafta Tatili Günleri
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Hafta Tatili Ücreti
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {basinIsHaftaTatiliTableData.map((row, i) => (
                        <tr key={i}>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "left",
                            }}
                          >
                            {row.period}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            {row.weekCount.toFixed(2)}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{row.wage.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            {row.coefficient}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{row.dailyWage.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            {row.haftaTatiliDays.toLocaleString("tr-TR", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{" "}
                            gün
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{row.haftaTatiliTotal.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {basinIsHaftaTatiliTableData.length > 0 && (
                      <tfoot>
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              border: "1px solid #d1d5db",
                              textAlign: "right",
                              fontWeight: 600,
                              padding: "6px",
                            }}
                          >
                            Toplam Hafta Tatili Ücreti:
                          </td>
                          <td
                            style={{
                              border: "1px solid #d1d5db",
                              fontWeight: 600,
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{basinIsHaftaTatiliTotalAmount.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Ek Bölümler: Brütten Nete Çevir ve Mahsuplaşma */}
              <hr />
              <h3 style={{ fontWeight: 600, margin: "8px 0" }}>Brütten Nete Çevir</h3>
              <BasinIsHaftaTatiliReportNetConversion totalBrut={basinIsHaftaTatiliTotalAmount} selectedYear={selectedYear} />

              <hr />
              <h3 style={{ fontWeight: 600, margin: "8px 0" }}>Mahsuplaşma</h3>
              <BasinIsHaftaTatiliReportSettlement totalNet={calculatedNet} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}




