import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import UbgtReportNetConversion from "./UbgtReportNetConversion";
import UbgtReportSettlement from "./UbgtReportSettlement";
import { safeNumber, safeCurrency, safeDays, safeCoefficient, safeValue } from "@/utils/safeFormat";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromBackend } from "@/utils/pdfExport";
import type { UbgtTableRow } from "./index"; // Import from parent

// Çalışma dönemi tipi
interface WorkerPeriod {
  id: string;
  start: string;
  end: string;
}

interface UbgtReportModalProps {
  open: boolean;
  onClose: () => void;
  ubgtTableData: UbgtTableRow[];
  workerPeriods: WorkerPeriod[];
  selectedHolidayCount: number;
  totalHolidayDays: number;
  ubgtExpiryStart: string | null;
  autoPrint?: boolean; // Otomatik yazdır
}

export default function UbgtReportModal({
  open,
  onClose,
  ubgtTableData,
  workerPeriods,
  selectedHolidayCount,
  totalHolidayDays,
  ubgtExpiryStart,
  autoPrint = false,
}: UbgtReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const ubgtRaporRef = useRef<HTMLDivElement>(null);

  // Yazdır fonksiyonu
  const handleUbgtPrint = () => {
    try {
      const targetEl = document.getElementById("ubgt-rapor-icerik");
      const source = targetEl ? targetEl.outerHTML : "";
      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>UBGT Alacağı</title>
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
            <div class="print-title">UBGT Alacağı – Rapor Görünümü</div>
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

  const handleUbgtDownloadWord = async () => {
    try {
      setWordBusy(true);
      
      // Element kontrolü
      const element = document.getElementById("ubgt-rapor-icerik");
      if (!element) {
        console.error('UBGT rapor içeriği bulunamadı');
        alert('Rapor içeriği bulunamadı. Lütfen modalı kapatıp tekrar açın.');
        return;
      }
      
      await downloadWordDocument(
        "UBGT Alacağı – Rapor Görünümü",
        "ubgt-rapor-icerik",
        `UBGT_Alacagi_${new Date().toISOString().slice(0, 10)}.docx`
      );
      setUbgtDlOpen(false);
    } catch (error) {
      console.error('Word export error:', error);
      alert('Word belgesi oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme fonksiyonu (DOM'dan direkt PDF oluştur)
  const handleUbgtDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      
      // Element kontrolü
      const element = document.getElementById("ubgt-rapor-icerik");
      if (!element) {
        console.error('UBGT rapor içeriği bulunamadı');
        alert('Rapor içeriği bulunamadı. Lütfen modalı kapatıp tekrar açın.');
        return;
      }
      
      // DOM'dan direkt PDF oluştur (backend yerine)
      const { downloadPdfFromDOM } = await import("@/utils/pdfExport");
      await downloadPdfFromDOM(
        "UBGT Alacağı – Rapor Görünümü",
        "ubgt-rapor-icerik",
        `UBGT_Alacagi_${new Date().toISOString().slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error("UBGT PDF generation error:", err);
      alert('PDF belgesi oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
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

  // Otomatik yazdırma
  useEffect(() => {
    if (open && autoPrint) {
      // Modal render olduktan sonra yazdır
      const timer = setTimeout(() => {
        handleUbgtPrint();
        // Yazdırma penceresi açıldıktan sonra modal'ı kapat
        setTimeout(() => {
          onClose();
        }, 500);
      }, 300); // DOM'un render olması için bekle
      return () => clearTimeout(timer);
    }
  }, [open, autoPrint]);

  // İşe giriş - çıkış tarihleri (ilk ve son) - HOOKS BEFORE RETURN!
  const ubgtFirstStart = workerPeriods.length > 0 ? workerPeriods[0].start : "";
  const ubgtLastEnd =
    workerPeriods.length > 0
      ? workerPeriods[workerPeriods.length - 1].end
      : "";

  // Toplam UBGT ücreti
  const ubgtTotalAmount = ubgtTableData.reduce((sum, row) => sum + row.ubgtTotal, 0);

  // İşten çıkış tarihine göre yıl belirleme (en son bitiş tarihi)
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

  // Early return AFTER all hooks - İçeriği her zaman render et ama görünmez yap
  // Bu sayede footer'dan yazdırma yaparken içerik hazır olur

  // Net hesap artık UbgtReportNetConversion component'i backend'den çekiyor

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      style={{
        backgroundColor: open ? 'rgba(0,0,0,0.4)' : 'transparent',
        pointerEvents: open ? 'auto' : 'none',
        visibility: open ? 'visible' : 'hidden'
      }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-[min(900px,95vw)] max-h-[90vh] overflow-auto rounded-lg shadow-lg"
        style={{
          position: "fixed",
          top: open ? "50%" : "-9999px",
          left: open ? "50%" : "-9999px",
          transform: "translate(-50%, -50%)",
          visibility: open ? "visible" : "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            UBGT Alacağı – Rapor Görünümü
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleUbgtPrint}
              className="text-sm border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-600"
            >
              Yazdır
            </Button>
            <Button
              variant="default"
              onClick={handleUbgtDownloadWord}
              disabled={wordBusy}
              className="text-sm bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wordBusy ? "Oluşturuluyor..." : "📄 Word İndir"}
            </Button>
            <Button
              variant="default"
              onClick={handleUbgtDownloadPDF}
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
          <div id="ubgt-rapor-icerik" ref={ubgtRaporRef as any}>
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
                    {ubgtFirstStart || "-"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>İşten Çıkış</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ubgtLastEnd || "-"}</div>
                </div>
                {ubgtExpiryStart && (
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Zamanaşımı Başlangıç</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(ubgtExpiryStart).toLocaleDateString("tr-TR")}
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
                    {workerPeriods.map((period, idx) => {
                      // Tarih kontrolü - geçerli tarih değilse "-" göster
                      const startDate = period.start ? new Date(period.start) : null;
                      const endDate = period.end ? new Date(period.end) : null;
                      const startValid = startDate && !isNaN(startDate.getTime());
                      const endValid = endDate && !isNaN(endDate.getTime());
                      
                      return (
                        <div key={period.id || idx}>
                          {startValid ? startDate.toLocaleDateString("tr-TR") : "-"} -{" "}
                          {endValid ? endDate.toLocaleDateString("tr-TR") : "-"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* UBGT Hesaplama Tablosu */}
              <div
                id="ubgt-calc-table"
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
                  UBGT Hesaplama Tablosu
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
                          Ücret (BRÜT)
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Katsayı
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          UBGT Günleri
                        </th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px" }}>
                          UBGT Ücreti
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ubgtTableData.map((row, i) => (
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
                            ₺{(row.wage ?? 0).toLocaleString("tr-TR", {
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
                            {row.coefficient ?? 1}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e5e7eb",
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{(row.dailyWage ?? 0).toLocaleString("tr-TR", {
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
                            {(row.ubgtDays ?? 0).toLocaleString("tr-TR", {
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
                            ₺{(row.ubgtTotal ?? 0).toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {ubgtTableData.length > 0 && (
                      <tfoot>
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              border: "1px solid #d1d5db",
                              textAlign: "right",
                              fontWeight: 600,
                              padding: "6px",
                            }}
                          >
                            Toplam UBGT Ücreti:
                          </td>
                          <td
                            style={{
                              border: "1px solid #d1d5db",
                              fontWeight: 600,
                              padding: "6px",
                              textAlign: "right",
                            }}
                          >
                            ₺{ubgtTotalAmount.toLocaleString("tr-TR", {
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
              <div style={{fontSize:18, fontWeight:700, marginBottom:12, marginTop:16}}>Brütten Nete Çevir</div>
              <UbgtReportNetConversion totalBrut={ubgtTotalAmount} selectedYear={selectedYear} />

              <div style={{fontSize:18, fontWeight:700, marginBottom:12, marginTop:16}}>Mahsuplaşma</div>
              <UbgtReportSettlement totalBrut={ubgtTotalAmount} selectedYear={selectedYear} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
