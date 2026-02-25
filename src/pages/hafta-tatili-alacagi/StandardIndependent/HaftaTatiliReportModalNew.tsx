import React, { useState, useMemo } from "react";
import DraggableModal from "@/components/DraggableModal";
import { 
  ReportTable, 
  BrutNetTable, 
  MahsuplasmaTable 
} from "@/components/reports/BaseReportLayout";
import { calculateIncomeTaxForYear } from "@/utils/incomeTaxCore";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Hafta Tatili Tablo satırı tipi
interface HaftaTatiliTableRow {
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

// Dışlanabilir gün tipi
interface ExcludedDay {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer";
  start: string;
  end: string;
  days: number;
}

interface HaftaTatiliReportModalProps {
  open: boolean;
  onClose: () => void;
  haftaTatiliTableData: HaftaTatiliTableRow[];
  workerPeriods: WorkerPeriod[];
  selectedHolidayCount: number;
  totalHolidayDays: number;
  haftaTatiliExpiryStart: string | null;
  haftaTatiliExcludedDays?: ExcludedDay[];
  haftaTatiliKullanimBaslangic?: string;
  haftaTatiliKullanimBitis?: string;
  haftaTatiliKullanimGunSayisi?: number;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function HaftaTatiliReportModalNew({
  open,
  onClose,
  haftaTatiliTableData,
  workerPeriods,
  selectedHolidayCount,
  totalHolidayDays,
  haftaTatiliExpiryStart,
  haftaTatiliExcludedDays = [],
  haftaTatiliKullanimBaslangic = "",
  haftaTatiliKullanimBitis = "",
  haftaTatiliKullanimGunSayisi = 4,
}: HaftaTatiliReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Toplam Hafta Tatili ücreti
  const haftaTatiliTotalAmount = haftaTatiliTableData.reduce((sum, row) => sum + row.haftaTatiliTotal, 0);

  // İşten çıkış tarihine göre yıl belirleme
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

  // Net hesap
  const ssk = useMemo(() => haftaTatiliTotalAmount * 0.15, [haftaTatiliTotalAmount]);
  const gelirMatrahi = useMemo(() => Math.max(0, haftaTatiliTotalAmount - ssk), [haftaTatiliTotalAmount, ssk]);
  const gelir = useMemo(() => calculateIncomeTaxForYear(selectedYear, gelirMatrahi), [selectedYear, gelirMatrahi]);
  const damga = useMemo(() => haftaTatiliTotalAmount * 0.00759, [haftaTatiliTotalAmount]);
  const calculatedNet = useMemo(() => haftaTatiliTotalAmount - (ssk + gelir + damga), [haftaTatiliTotalAmount, ssk, gelir, damga]);

  // İşe giriş - çıkış tarihleri (ilk ve son)
  const haftaTatiliFirstStart = workerPeriods.length > 0 ? workerPeriods[0].start : "";
  const haftaTatiliLastEnd = workerPeriods.length > 0 ? workerPeriods[workerPeriods.length - 1].end : "";

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Standart Hafta Tatili Alacağı</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
    h2 { font-size: 12px; margin: 8px 0 6px 0; page-break-after: avoid; }
    div { margin-bottom: 10px; }
    button { display: none !important; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
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
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  // Word indirme
  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      await downloadWordDocument(
        "Standart Hafta Tatili Alacağı",
        "report-content",
        `Standart_Hafta_Tatili_Alacagi_${new Date().toISOString().slice(0, 10)}.docx`
      );
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme - Frontend'den oluştur (rapor görünümünden)
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      await downloadPdfFromDOM(
        "Standart Hafta Tatili Alacağı",
        "report-content"
      );
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return (
    <DraggableModal
      open={open}
      onClose={onClose}
      title="Standart Hafta Tatili Alacağı – Rapor Görünümü"
      headerActions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePrint}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1f2937',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Yazdır"
          >
            🖨️ Yazdır
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={wordBusy}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1e40af',
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              cursor: wordBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: wordBusy ? 0.6 : 1,
            }}
            title="Word İndir"
          >
            📄 {wordBusy ? 'İndiriliyor...' : 'Word'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#991b1b',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              cursor: pdfBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: pdfBusy ? 0.6 : 1,
            }}
            title="PDF İndir"
          >
            📕 {pdfBusy ? 'İndiriliyor...' : 'PDF'}
          </button>
        </div>
      }
    >
      <div id="report-content" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
        {/* Rapor Tarihi */}
        <div style={{ marginBottom: '12px', textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
            Tarih: {new Date().toLocaleDateString("tr-TR")}
          </p>
        </div>

        {/* Kimlik Bilgileri */}
        <div style={{ marginBottom: '14px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '30%' }}>
                  İşe Giriş Tarihi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {haftaTatiliFirstStart || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  İşten Çıkış Tarihi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {haftaTatiliLastEnd || "-"}
                </td>
              </tr>
              {totalHolidayDays > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Toplam Hafta Tatili Günü
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {totalHolidayDays} gün
                  </td>
                </tr>
              )}
              {haftaTatiliExpiryStart && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Hafta Tatili Tazminatı Talep Tarihi
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {haftaTatiliExpiryStart}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Hafta Tatili Kullanım Bilgisi (varsa) */}
        {haftaTatiliKullanimBaslangic && haftaTatiliKullanimBitis && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Hafta Tatili Kullanım Bilgisi
            </h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #999',
              fontSize: '10px',
            }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '40%' }}>
                    Başlangıç Tarihi
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {haftaTatiliKullanimBaslangic || "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Bitiş Tarihi
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {haftaTatiliKullanimBitis || "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Haftalık Kullanım Gün Sayısı
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {haftaTatiliKullanimGunSayisi} gün
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Dışlanabilir Günler (varsa) */}
        {haftaTatiliExcludedDays.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Dışlanabilir Günler
            </h2>
            <ReportTable
              headers={["Tür", "Başlangıç", "Bitiş", "Gün Sayısı"]}
              rows={haftaTatiliExcludedDays.map(day => [
                day.type,
                new Date(day.start).toLocaleDateString("tr-TR"),
                new Date(day.end).toLocaleDateString("tr-TR"),
                day.days.toString(),
              ])}
              footer={[
                "TOPLAM",
                "",
                "",
                haftaTatiliExcludedDays.reduce((sum, day) => sum + day.days, 0).toString(),
              ]}
              alignRight={[3]}
            />
          </div>
        )}

        {/* Hafta Tatili Hesaplama Detayı */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Hafta Tatili Hesaplama Detayı
          </h2>
          <ReportTable
            headers={["Tarih (Ücret Dönemi)", "Hafta", "Ücret (BRÜT)", "Katsayı", "Günlük Brüt Ücret", "Günlük %50 Zamlı", "Hafta Tatili Ücreti"]}
            rows={haftaTatiliTableData.map(row => [
              row.period,
              row.weekCount.toString(),
              `${fmt(row.wage)}₺`,
              row.coefficient.toFixed(4),
              `${fmt(row.dailyWage)}₺`,
              `${fmt(row.dailyWage * 1.5)}₺`,
              `${fmt(row.haftaTatiliTotal)}₺`,
            ])}
            footer={[
              "Toplam Hafta Tatili Ücreti:",
              "",
              "",
              "",
              "",
              "",
              `${fmt(haftaTatiliTotalAmount)}₺`,
            ]}
            alignRight={[2, 3, 4, 5, 6]}
          />
        </div>

        {/* Brüt'ten Net'e Çeviri */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Brüt'ten Net'e Çeviri
          </h2>
          <BrutNetTable
            rows={[
              { label: "Brüt Hafta Tatili Alacağı", value: `${fmt(haftaTatiliTotalAmount)}₺` },
              { label: "SGK İşçi Primi (%15)", value: `-${fmt(ssk)}₺`, isDeduction: true },
              { label: "Gelir Vergisi", value: `-${fmt(gelir)}₺`, isDeduction: true },
              { label: "Damga Vergisi (binde 7,59)", value: `-${fmt(damga)}₺`, isDeduction: true },
              { label: "Net Hafta Tatili Alacağı", value: `${fmt(calculatedNet)}₺`, isNet: true },
            ]}
          />
        </div>

        {/* Mahsuplaşma */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Mahsuplaşma
          </h2>
          <MahsuplasmaTable
            rows={[
              { label: "Net Hafta Tatili Alacağı", value: `${fmt(calculatedNet)}₺` },
              { label: "1/3 Hakkaniyet İndirimi", value: `-${fmt(calculatedNet / 3)}₺`, isDeduction: true },
            ]}
            netRow={{
              label: "Mahsuplaşma Sonucu",
              value: `${fmt(calculatedNet - (calculatedNet / 3))}₺`,
            }}
          />
        </div>
      </div>
    </DraggableModal>
  );
}
