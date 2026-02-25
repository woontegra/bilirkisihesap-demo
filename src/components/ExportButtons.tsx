import React, { useState } from "react";

type ExportButtonsProps = {
  onPrint?: () => void;
  onWord?: () => Promise<void> | void;
  onCopyForWord?: () => Promise<void> | void;
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
  onCopyForWord,
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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {onCopyForWord && (
        <button
          onClick={onCopyForWord}
          className="text-sm border border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-600 rounded-md px-3 py-1.5 transition-colors"
        >
          Word'e Uygun Kopyala
        </button>
      )}
      {onPrint && (
        <button
          onClick={onPrint}
          className="text-sm border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-600 rounded-md px-3 py-1.5 transition-colors"
        >
          {printLabel}
        </button>
      )}
      {onWord && (
        <button
          onClick={handleWord}
          disabled={isWordBusy}
          className="text-sm bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isWordBusy ? "Oluşturuluyor..." : wordLabel}
        </button>
      )}
      {onPdf && (
        <button
          onClick={handlePdf}
          disabled={isPdfBusy}
          className="text-sm bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPdfBusy ? "Oluşturuluyor..." : pdfLabel}
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="text-sm border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md px-3 py-1.5 transition-colors"
        >
          {closeLabel}
        </button>
      )}
    </div>
  );
}
