import React, { useState } from "react";

interface KidemReportData {
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  calismaSuresi?: string;
  brutUcret?: number;
  prim?: number;
  ikramiye?: number;
  yemek?: number;
  yol?: number;
  diger?: number;
  extras?: Array<{ id: string; label: string; value: number }>;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: {
    toplam: number;
    yil: number;
    ay: number;
    gun: number;
  };
  damgaVergisi?: number;
  gelirVergisi?: number;
  muafiyetTutari?: number;
  gelirVergisiUygulanacak?: boolean;
  tavanUygulandi?: boolean;
  tavanDegeri?: number | null;
  warnings?: string[];
  kullanilacakBrutUcret?: number;
}

interface Kidem30ReportModalProps {
  open: boolean;
  onClose: () => void;
  data: KidemReportData;
}

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "0,00";
  }
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Kidem30ReportModal({
  open,
  onClose,
  data,
}: Kidem30ReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const totals = data.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 };
  
  // Aylık brüt ücret hesabı - tavan uygulandıysa tavan değerini kullan
  const aylikBrutUcret = data.kullanilacakBrutUcret || (totals.toplam > 0 
    ? totals.toplam 
    : (data.toplamBrut && (totals.yil > 0 || totals.ay > 0 || totals.gun > 0))
      ? data.toplamBrut / (totals.yil + totals.ay / 12 + totals.gun / 365)
      : 0);
  
  const yilTutar = aylikBrutUcret * totals.yil;
  const ayTutar = (aylikBrutUcret / 12) * totals.ay;
  const gunTutar = (aylikBrutUcret / 365) * totals.gun;
  
  // Ekstra Hesaplamalar'daki Toplam Brüt = tavan uygulanmadan önceki toplam brüt ücret
  // Tüm bileşenleri topla: brutUcret + prim + ikramiye + yemek + yol + diger + extras
  const extrasTotal = (data.extras || []).reduce((acc, item) => acc + (item.value || 0), 0);
  const toplamBrutUcret = (data.brutUcret || 0) + (data.prim || 0) + (data.ikramiye || 0) + (data.yemek || 0) + (data.yol || 0) + (data.diger || 0) + extrasTotal;

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kıdem Tazminatı Raporu</title>
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

  // Word indirme - Sayfa düzeni ile (PDF çıktısı gibi)
  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const content = document.getElementById("report-content");
      if (!content) return;
      
      // İçeriği klonla - tüm style'ları koru
      const clonedContent = content.cloneNode(true) as HTMLElement;
      
      // Word için uygun HTML formatı oluştur - PDF çıktısı gibi düzgün görünsün
      const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<meta name=ProgId content=Word.Document>
<meta name=Generator content='Microsoft Word 15'>
<meta name=Originator content='Microsoft Word 15'>
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
  <w:ValidateAgainstSchemas/>
  <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
  <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
  <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
  <w:DoNotPromoteQF/>
  <w:LidThemeOther>TR</w:LidThemeOther>
  <w:LidThemeAsian>X-NONE</w:LidThemeAsian>
  <w:LidThemeComplexScript>X-NONE</w:LidThemeComplexScript>
  <w:Compatibility>
   <w:BreakWrappedTables/>
   <w:SnapToGridInCell/>
   <w:WrapTextWithPunct/>
   <w:UseAsianBreakRules/>
   <w:DontGrowAutofit/>
   <w:SplitPgBreakAndParaMark/>
   <w:EnableOpenTypeKerning/>
   <w:DontFlipMirrorIndents/>
   <w:OverrideTableStyleHps/>
  </w:Compatibility>
 </w:WordDocument>
</xml><![endif]-->
<style>
@page {
  size: 21cm 29.7cm;
  margin: 1.5cm 1.5cm 1.5cm 1.5cm;
  mso-header-margin: 0.5cm;
  mso-footer-margin: 0.5cm;
}
body {
  font-family: 'Inter', 'Arial', sans-serif;
  font-size: 9pt;
  color: #111827;
  margin: 0;
  padding: 10px;
  background: white;
  line-height: 1.1;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  page-break-inside: avoid;
  border: 1px solid #999;
  table-layout: fixed;
}
thead {
  background: #f3f4f6;
}
th, td {
  border: 1px solid #999;
  padding: 2px 4px;
  font-size: 9pt;
  vertical-align: top;
  word-wrap: break-word;
  line-height: 1.1;
  mso-line-height-rule: exactly;
}
th {
  font-weight: 600;
}
tr {
  height: auto;
  line-height: 1.1;
  mso-line-height-rule: exactly;
}
/* Inline style'lar öncelikli olacak - genel hizalama kuralları kaldırıldı */
h2 {
  font-size: 10pt;
  font-weight: 700;
  margin: 0 0 4px 0;
  padding-bottom: 2px;
  border-bottom: 1px solid #e5e7eb;
  page-break-after: avoid;
  line-height: 1.1;
}
div {
  margin-bottom: 8px;
}
/* Tüm inline style'lar korunacak */
* {
  box-sizing: border-box;
}
</style>
</head>
<body>
${clonedContent.outerHTML}
</body>
</html>`;
      
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Kidem_Tazminati_${new Date().toISOString().slice(0, 10)}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme - html2pdf kullanarak
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      const content = document.getElementById("report-content");
      if (!content) return;

      // html2pdf kütüphanesini dinamik olarak yükle
      const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        // html2pdf ve html2canvas'ı yükle
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        
        // PDF seçenekleri
        const opt = {
          margin: [12, 12, 12, 12],
          filename: `Kidem_Tazminati_${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // PDF oluştur ve indir
        const html2pdf = (window as any).html2pdf;
        await html2pdf().set(opt).from(content).save();
      } catch (error) {
        console.error('PDF generation error:', error);
        // Fallback: window.print() kullan
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kıdem Tazminatı Raporu</title>
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
  </style>
</head>
<body>${content.outerHTML}</body>
</html>`;
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 250);
          };
        }
      }
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Kıdem Tazminatı Raporu – Rapor Görünümü</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Yazdır"
            >
              🖨️ Yazdır
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={wordBusy}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
              title="Word İndir"
            >
              📄 {wordBusy ? 'İndiriliyor...' : 'Word'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfBusy}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
              title="PDF İndir"
            >
              📕 {pdfBusy ? 'İndiriliyor...' : 'PDF'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl ml-2"
            >
              ×
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">
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
            marginBottom: '14px',
          }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '40%' }}>
                  İşe Giriş
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {data?.iseGirisTarihi || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  İşten Çıkış
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {data?.istenCikisTarihi || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Çalışma Süresi
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {data?.calismaSuresi || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Ekstra Hesaplamalar */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Ekstra Hesaplamalar
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
                  Çıplak Brüt
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {formatCurrency(data?.brutUcret)}₺
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Prim
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {formatCurrency(data?.prim)}₺
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  İkramiye
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {formatCurrency(data?.ikramiye)}₺
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                  Yemek
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {formatCurrency(data?.yemek)}₺
                </td>
              </tr>
              {(data?.yol || 0) > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Yol
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {formatCurrency(data?.yol)}₺
                  </td>
                </tr>
              )}
              {(data?.diger || 0) > 0 && (
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    Diğer
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {formatCurrency(data?.diger)}₺
                  </td>
                </tr>
              )}
              {data?.extras && data.extras.length > 0 && data.extras.map((extra) => (
                <tr key={extra.id}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    {extra.label || 'Ekstra'}
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {formatCurrency(extra.value)}₺
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  Toplam Brüt
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  {formatCurrency(toplamBrutUcret)}₺
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kıdem Tazminatı Hesaplama Detayları */}
        {data.totals && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Kıdem Tazminatı Hesaplama Detayları
            </h2>
            
            {/* Tavan Ücret Uyarısı */}
            {data.tavanUygulandi && data.warnings && data.warnings.length > 0 && (
              <div style={{ 
                border: '1px solid #fecaca', 
                backgroundColor: '#fef2f2', 
                borderRadius: '6px', 
                padding: '12px', 
                marginBottom: '12px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', margin: '0 0 4px 0' }}>
                      Tavan Ücret Uyarısı
                    </p>
                    <div style={{ fontSize: '10px', color: '#7f1d1d', lineHeight: '1.4' }}>
                      {data.warnings.map((warning, i) => (
                        <div key={i} style={{ marginBottom: i < data.warnings!.length - 1 ? '4px' : '0' }}>
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #999',
              fontSize: '10px',
            }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Hesaplama</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {totals.yil > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                      {formatCurrency(aylikBrutUcret)} × {totals.yil} yıl
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      {formatCurrency(yilTutar)}₺
                    </td>
                  </tr>
                )}
                {totals.ay > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                      {formatCurrency(aylikBrutUcret)} / 12 × {totals.ay} ay
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      {formatCurrency(ayTutar)}₺
                    </td>
                  </tr>
                )}
                {totals.gun > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                      {formatCurrency(aylikBrutUcret)} / 365 × {totals.gun} gün
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      {formatCurrency(gunTutar)}₺
                    </td>
                  </tr>
                )}
                {/* Gün değeri 0 olsa bile göster (görselde olduğu gibi) */}
                {totals.gun === 0 && totals.yil > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                      {formatCurrency(aylikBrutUcret)} / 365 × {totals.gun} gün
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      0,00₺
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#eff6ff', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#2563eb' }}>
                    Toplam Kıdem Tazminatı
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#2563eb' }}>
                    {formatCurrency(data.toplamBrut)}₺
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

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
                <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Brüt Kıdem Tazminatı</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                  {formatCurrency(data?.toplamBrut)}₺
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#dc2626' }}>
                  Damga Vergisi (Binde 7,59)
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>
                  -{formatCurrency(data?.damgaVergisi)}₺
                </td>
              </tr>
              <tr style={{ background: '#dcfce7', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px', color: '#16a34a' }}>Net Kıdem Tazminatı</td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#16a34a' }}>
                  {formatCurrency(data?.netTazminat)}₺
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}
