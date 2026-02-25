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
    } finally {
      setLocalWordBusy(false);
    }
  };

  const handlePdf = async () => {
    if (!onPdf) return;
    try {
      setLocalPdfBusy(true);
      await onPdf();
    } finally {
      setLocalPdfBusy(false);
    }
  };

  const isWordBusy = wordBusy || localWordBusy;
  const isPdfBusy = pdfBusy || localPdfBusy;

  return (
    <div className={"flex items-center gap-2 " + className}>
      {onPrint && (
        <button onClick={onPrint} className="text-sm border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white rounded-md px-3 py-1.5 transition-colors">
          {printLabel}
        </button>
      )}
      {onWord && (
        <button onClick={handleWord} disabled={isWordBusy} className="text-sm bg-green-600 text-white hover:bg-green-700 rounded-md px-3 py-1.5 disabled:opacity-50 transition-colors">
          {isWordBusy ? "Oluşturuluyor..." : wordLabel}
        </button>
      )}
      {onPdf && (
        <button onClick={handlePdf} disabled={isPdfBusy} className="text-sm bg-red-600 text-white hover:bg-red-700 rounded-md px-3 py-1.5 disabled:opacity-50 transition-colors">
          {isPdfBusy ? "Oluşturuluyor..." : pdfLabel}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="text-sm border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-md px-3 py-1.5 transition-colors">
          {closeLabel}
        </button>
      )}
    </div>
  );
}
