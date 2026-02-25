import React, { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { printFromModal } from "../localUtils/printReport";
import ExportButtons from "./ExportButtons";
import { downloadWordDocument } from "../localUtils/wordExport";
import { downloadPdfFromDOM } from "../localUtils/pdfExport";

type Props = {
  title: string;
  renderContent: () => ReactNode;
  buttonClassName?: string;
  copyTargetId?: string;
  onPdf?: () => Promise<void> | void;
  onButtonClick?: () => void;
  autoOpen?: boolean;
};

export default function ReportPreviewButton({ title, renderContent, buttonClassName, copyTargetId, onPdf, onButtonClick, autoOpen }: Props) {
  const [open, setOpen] = useState(autoOpen || false);
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoOpen) {
      const t = setTimeout(() => setOpen(true), 100);
      return () => clearTimeout(t);
    }
  }, [autoOpen]);

  const hasContent = renderContent && typeof renderContent === "function";

  const handleButtonClick = () => {
    if (onButtonClick) onButtonClick();
    else setOpen(true);
  };

  const handlePrint = () => {
    printFromModal(title, copyTargetId);
  };

  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const containerId = copyTargetId || "report-modal-content";
      await downloadWordDocument(title, containerId);
    } finally {
      setWordBusy(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      if (onPdf) {
        await onPdf();
        return;
      }
      const containerId = copyTargetId || "report-modal-content";
      await downloadPdfFromDOM(title, containerId);
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (onButtonClick) onButtonClick();
      }
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onButtonClick]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition((prev) => ({ x: prev.x + (e.clientX - dragStart.x), y: prev.y + (e.clientY - dragStart.y) }));
      setDragStart({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
      setIsMinimized(false);
      setIsMaximized(false);
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".export-buttons")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const toggleMinimize = () => setIsMinimized(!isMinimized);
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (!isMaximized) setPosition({ x: 0, y: 0 });
  };

  return (
    <>
      <button
        type="button"
        className={buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap"}
        onClick={handleButtonClick}
      >
        🧾 Önizleme
      </button>
      {open && hasContent &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-black/40" role="dialog" aria-modal="true">
            <div
              ref={modalRef}
              className="bg-white rounded-lg shadow-2xl overflow-hidden"
              style={{
                position: "fixed",
                top: isMaximized ? "0" : "50%",
                left: isMaximized ? "0" : "50%",
                transform: isMaximized ? "none" : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                width: isMaximized ? "100vw" : "min(900px, 95vw)",
                height: isMaximized ? "100vh" : isMinimized ? "auto" : "auto",
                maxHeight: isMaximized ? "100vh" : "90vh",
                cursor: isDragging ? "grabbing" : "default",
                minWidth: "400px",
                minHeight: "300px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg select-none"
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
                onMouseDown={handleMouseDown}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{title || ""}</div>
                  <div className="flex gap-1 ml-2">
                    <button type="button" onClick={toggleMinimize} className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center">{isMinimized ? "🔼" : "🔽"}</button>
                    <button type="button" onClick={toggleMaximize} className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center">{isMaximized ? "🗗" : "🗖"}</button>
                  </div>
                </div>
                <div className="export-buttons">
                  <ExportButtons
                    onPrint={handlePrint}
                    onWord={handleDownloadWord}
                    onPdf={handleDownloadPDF}
                    onClose={() => { setOpen(false); if (onButtonClick) setTimeout(() => onButtonClick(), 100); }}
                    wordBusy={wordBusy}
                    pdfBusy={pdfBusy}
                  />
                </div>
              </div>
              {!isMinimized && hasContent && (
                <div className="p-4 text-sm overflow-auto" style={{ maxHeight: isMaximized ? "calc(100vh - 60px)" : "80vh" }}>
                  <div id="report-modal-content">{renderContent()}</div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
