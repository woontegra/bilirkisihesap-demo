import React, { useState } from "react";
import DraggableModal from "@/components/DraggableModal";
import { 
  ReportTable, 
  BrutNetTable, 
  MahsuplasmaTable 
} from "@/components/reports/BaseReportLayout";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

interface FazlaMesaiRow {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fm: number;
}

interface FazlaMesaiStandartReportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  iseGiris: string;
  istenCikis: string;
  weeklyDays: number;
  haftalikMesai: number;
  totalBrut: number;
  fmText?: string;
  rows: FazlaMesaiRow[];
  brutYillik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  netYillik: number;
  mahsuplasmaMiktari: string;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function FazlaMesaiStandartReportModal({
  open,
  onClose,
  title,
  iseGiris,
  istenCikis,
  weeklyDays,
  haftalikMesai,
  totalBrut,
  fmText,
  rows,
  brutYillik,
  gelirVergisi,
  gelirVergisiDilimleri,
  damgaVergisi,
  netYillik,
  mahsuplasmaMiktari,
}: FazlaMesaiStandartReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // SGK ve İşsizlik Primi
  const sgkPrimi = Math.round(brutYillik * 0.14 * 100) / 100;
  const issizlikPrimi = Math.round(brutYillik * 0.01 * 100) / 100;

  // Mahsuplaşma hesabı
  const mahsuplasmaNum = Number(String(mahsuplasmaMiktari).replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
  const hakkaniyetIndirimi = Number(brutYillik || 0) / 3;
  const mahsuplamaSonucu = Math.max(0, brutYillik - hakkaniyetIndirimi - mahsuplasmaNum);

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
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
    pre { font-size: 9px; white-space: pre-wrap; background: #f9fafb; border: 1px solid #999; padding: 6px; margin: 8px 0; }
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
        title,
        "report-content",
        `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`
      );
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      await downloadPdfFromDOM(title, "report-content");
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
      title={`${title} – Rapor Görünümü`}
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

        {/* Özet Bilgiler */}
        <div style={{ marginBottom: '14px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '40%' }}>
                  İşe Giriş Tarihi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {iseGiris || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  İşten Çıkış Tarihi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {istenCikis || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Haftalık Gün
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {weeklyDays}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Haftalık Fazla Mesai
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {haftalikMesai.toFixed(2).replace('.', ',')} saat
                </td>
              </tr>
              <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  Toplam Fazla Mesai
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {fmt(totalBrut)}₺
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Metin Hesaplaması */}
        {fmText && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Metin Hesaplaması
            </h2>
            <pre style={{ fontSize: '9px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#f9fafb', border: '1px solid #999', padding: '6px', margin: 0 }}>
              {fmText}
            </pre>
          </div>
        )}

        {/* Fazla Mesai Hesaplama Cetveli */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Fazla Mesai Hesaplama Cetveli
          </h2>
          <ReportTable
            headers={["Tarih Aralığı", "Hafta Sayısı", "Ücret", "Kat Sayı Çarpanı", "FM Saati", "225", "1,5", "Fazla Mesai"]}
            rows={rows.map(r => [
              r.rangeLabel,
              r.weeks.toString(),
              `${fmt(r.brut)}₺`,
              r.katsayi.toFixed(4).replace('.', ','),
              r.fmHours.toFixed(2).replace('.', ','),
              "225",
              "1,5",
              `${fmt(r.fm)}₺`,
            ])}
            footer={[
              "Toplam Fazla Mesai:",
              "",
              "",
              "",
              "",
              "",
              "",
              `${fmt(totalBrut)}₺`,
            ]}
            alignRight={[2, 3, 4, 7]}
          />
        </div>

        {/* Brüt'ten Net'e Çeviri */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Brüt'ten Net'e Çeviri
          </h2>
          <BrutNetTable
            rows={[
              { label: "Brüt Fazla Mesai", value: `${fmt(brutYillik)}₺` },
              { label: "SGK Primi (%14)", value: `-${fmt(sgkPrimi)}₺`, isDeduction: true },
              { label: "İşsizlik Primi (%1)", value: `-${fmt(issizlikPrimi)}₺`, isDeduction: true },
              { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmt(gelirVergisi)}₺`, isDeduction: true },
              { label: "Damga Vergisi (binde 7,59)", value: `-${fmt(damgaVergisi)}₺`, isDeduction: true },
              { label: "Net Fazla Mesai", value: `${fmt(netYillik)}₺`, isNet: true },
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
              { label: "Toplam Fazla Mesai", value: `${fmt(brutYillik)}₺` },
              { label: "1/3 Hakkaniyet İndirimi", value: `-${fmt(hakkaniyetIndirimi)}₺`, isDeduction: true },
              { label: "Mahsuplaşma Miktarı", value: mahsuplasmaNum > 0 ? `-${fmt(mahsuplasmaNum)}₺` : '0,00₺', isDeduction: mahsuplasmaNum > 0 },
            ]}
            netRow={{
              label: "Mahsuplaşma Sonucu",
              value: `${fmt(mahsuplamaSonucu)}₺`,
            }}
          />
        </div>
      </div>
    </DraggableModal>
  );
}
