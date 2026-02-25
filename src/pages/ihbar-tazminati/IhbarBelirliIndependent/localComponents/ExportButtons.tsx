import React, { useState } from "react";

type ExportButtonsProps = {
  onPrint?: () => void;
  onWord?: () => Promise<void> | void;
  onPdf?: () => Promise<void> | void;
  onClose?: () => void;
  wordBusy?: boolean;
  pdfBusy?: boolean;
  printLabel?: string;
  wordLabel?: string;
  pdfLabel?: string;
  closeLabel?: string;
  className?: string;
};

/**
 * Merkezi Word/PDF İndirme Butonları Component'i
 * Tüm sayfalarda aynı görünüm ve davranış için kullanılır
 */
export default function ExportButtons({
  onPrint,
  onWord,
  onPdf,
  onClose,
  wordBusy = false,
  pdfBusy = false,
  printLabel = "Yazdır",
  wordLabel = "📄 Word İndir",
  pdfLabel = "📕 PDF İndir",
  closeLabel = "Kapat",
  className = "",
}: ExportButtonsProps) {
  const [localWordBusy, setLocalWordBusy] = useState(false);
  const [localPdfBusy, setLocalPdfBusy] = useState(false);

  const handleWord = async () => {
    if (!onWord) return;
    try {
      setLocalWordBusy(true);
      await onWord();
    } catch (err) {
      console.error("Word export error:", err);
    } finally {
      setLocalWordBusy(false);
    }
  };

  const handlePdf = async () => {
    if (!onPdf) return;
    try {
      setLocalPdfBusy(true);
      await onPdf();
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setLocalPdfBusy(false);
    }
  };

  const isWordBusy = wordBusy || localWordBusy;
  const isPdfBusy = pdfBusy || localPdfBusy;

  const btnBase = {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as const;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {onPrint && (
        <button
          onClick={onPrint}
          style={{ ...btnBase, color: '#1f2937', backgroundColor: '#fff', border: '1px solid #d1d5db' }}
          title="Yazdır"
        >
          🖨️ {printLabel}
        </button>
      )}
      {onWord && (
        <button
          onClick={handleWord}
          disabled={isWordBusy}
          style={{ ...btnBase, color: '#1e40af', backgroundColor: '#dbeafe', border: '1px solid #93c5fd', cursor: isWordBusy ? 'wait' : 'pointer', opacity: isWordBusy ? 0.6 : 1 }}
          title="Word İndir"
        >
          📄 {isWordBusy ? 'İndiriliyor...' : 'Word'}
        </button>
      )}
      {onPdf && (
        <button
          onClick={handlePdf}
          disabled={isPdfBusy}
          style={{ ...btnBase, color: '#991b1b', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', cursor: isPdfBusy ? 'wait' : 'pointer', opacity: isPdfBusy ? 0.6 : 1 }}
          title="PDF İndir"
        >
          📕 {isPdfBusy ? 'İndiriliyor...' : 'PDF'}
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          aria-label={closeLabel}
          style={{ ...btnBase, color: '#374151', backgroundColor: '#fff', border: '1px solid #d1d5db' }}
        >
          {closeLabel}
        </button>
      )}
    </div>
  );
}
