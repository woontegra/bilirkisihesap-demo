import { useState } from "react";
import { downloadWordDocument } from "../../localUtils/wordExport";
import { downloadPdfFromDOM } from "../../localUtils/pdfExport";

export function useReportExport(reportTitle: string, contentId: string = "report-content") {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const handlePrint = () => {
    try {
      const targetEl = document.getElementById(contentId);
      if (!targetEl) return;
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0 auto; font-size: 10px; max-width: 16cm; }
    table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid !important; table-layout: fixed; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
    button { display: none !important; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
</html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
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

  const handleDownloadWord = async () => {
    setWordBusy(true);
    try {
      const filename = `${reportTitle.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.doc`;
      await downloadWordDocument(reportTitle, contentId, filename.replace(".doc", ""));
    } catch (error) {
      console.error("Word export error:", error);
    } finally {
      setWordBusy(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfBusy(true);
    try {
      await downloadPdfFromDOM(reportTitle, contentId);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  return { wordBusy, pdfBusy, handlePrint, handleDownloadWord, handleDownloadPDF };
}
