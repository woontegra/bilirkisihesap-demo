import React, { useState } from "react";
import DraggableModal from "@/components/DraggableModal";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

interface UsedRow {
  id: string;
  start: string;
  end: string;
  days: string;
}

interface DiffData {
  label: string;
}

interface BreakdownData {
  y1: number;
  d1: number;
  y2: number;
  d2: number;
  y3: number;
  d3: number;
  total: number;
}

interface YillikIzinStandartReportModalProps {
  open: boolean;
  onClose: () => void;
  iseGiris: string;
  istenCikis: string;
  diff: DiffData;
  brutUcret: string;
  is18Or50: boolean;
  isUnderground: boolean;
  breakdown: BreakdownData;
  rows: UsedRow[];
  usedTotal: number;
  remainingDays: number;
  brutIzin: number;
  netIzin: number;
  sgkPrim: number;
  issizlikPrim: number;
  gelirVergisi: number;
  damgaVergisi: number;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function YillikIzinStandartReportModal({
  open,
  onClose,
  iseGiris,
  istenCikis,
  diff,
  brutUcret,
  is18Or50,
  isUnderground,
  breakdown,
  rows,
  usedTotal,
  remainingDays,
  brutIzin,
  netIzin,
  sgkPrim,
  issizlikPrim,
  gelirVergisi,
  damgaVergisi,
}: YillikIzinStandartReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const brutUcretNum = Number(String(brutUcret).replace(/\./g, '').replace(',', '.')) || 0;
  const validRows = rows.filter(r => r.start && r.end && r.days);

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Yıllık İzin Raporu</title>
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
        "Yıllık İzin Raporu",
        "report-content",
        `Yillik_Izin_${new Date().toISOString().slice(0, 10)}.docx`
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
      await downloadPdfFromDOM("Yıllık İzin Raporu", "report-content");
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
      title="Yıllık İzin Raporu – Rapor Görünümü"
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

        {/* Genel Bilgiler */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Genel Bilgiler
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
                  İşe Giriş
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {iseGiris || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  İşten Çıkış
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {istenCikis || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Çalışma Süresi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {diff.label}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Çıplak Brüt Ücret
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {fmt(brutUcretNum)}₺
                </td>
              </tr>
              {(is18Or50 || isUnderground) && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Özel Durum
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {is18Or50 && '18 yaş altı / 50 yaş üstü '}
                    {isUnderground && 'Yeraltı İşçisi'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* İzin Hakları Detayı */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Yıllık İzin Hakları
          </h2>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <thead style={{ background: '#f3f4f6' }}>
              <tr>
                <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Dönem</th>
                <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>Yıl Sayısı</th>
                <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>Gün/Yıl</th>
                <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Toplam Gün</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.y1 > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>0-5 yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.y1} yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.d1} gün</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    {breakdown.y1} × {breakdown.d1} = {breakdown.y1 * breakdown.d1} gün
                  </td>
                </tr>
              )}
              {breakdown.y2 > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>6-14 yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.y2} yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.d2} gün</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    {breakdown.y2} × {breakdown.d2} = {breakdown.y2 * breakdown.d2} gün
                  </td>
                </tr>
              )}
              {breakdown.y3 > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>15+ yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.y3} yıl</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'center' }}>{breakdown.d3} gün</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    {breakdown.y3} × {breakdown.d3} = {breakdown.y3 * breakdown.d3} gün
                  </td>
                </tr>
              )}
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td colSpan={3} style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                  Toplam Hak Edilen İzin:
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                  {breakdown.total} gün
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kullanılan İzinler */}
        {validRows.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Kullanılan İzinler
            </h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #999',
              fontSize: '10px',
            }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Başlangıç</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bitiş</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Gün</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row.start}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row.end}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{row.days}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <td colSpan={2} style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    Toplam Kullanılan:
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    {usedTotal} gün
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* İzin Hesabı */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            İzin Hesabı
          </h2>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <tbody>
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Toplam Hak Edilen İzin</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{breakdown.total} gün</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Kullanılan İzin</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>-{usedTotal} gün</td>
              </tr>
              <tr style={{ background: '#fff3cd', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Kalan İzin</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{remainingDays} gün</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Günlük Ücret</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(brutUcretNum / 30)}₺</td>
              </tr>
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Brüt İzin Alacağı</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(brutIzin)}₺</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Brüt'ten Net'e Çeviri */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Brüt'ten Net'e Çeviri
          </h2>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <tbody>
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Brüt İzin Alacağı</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(brutIzin)}₺</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#dc2626' }}>SGK Primi (%14)</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(sgkPrim)}₺</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#dc2626' }}>İşsizlik Primi (%1)</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(issizlikPrim)}₺</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#dc2626' }}>Gelir Vergisi</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(gelirVergisi)}₺</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#dc2626' }}>Damga Vergisi (Binde 7,59)</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(damgaVergisi)}₺</td>
              </tr>
              <tr style={{ background: '#dcfce7', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#16a34a' }}>Net İzin Alacağı</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#16a34a' }}>{fmt(netIzin)}₺</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DraggableModal>
  );
}
