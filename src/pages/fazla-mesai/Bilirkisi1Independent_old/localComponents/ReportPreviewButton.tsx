/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of Bilirkisi1Independent page isolation
 */

import React, { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import ExportButtons from "./ExportButtons";

type Props = {
  title: string;
  renderContent: () => ReactNode;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  copyTargetId?: string;
  onPdf?: () => Promise<void> | void;
  onButtonClick?: () => void;
  hideButton?: boolean;
  autoOpen?: boolean;
};

export default function ReportPreviewButton({ title, renderContent, buttonClassName, buttonStyle, copyTargetId, onPdf, onButtonClick, hideButton, autoOpen }: Props) {
  const [open, setOpen] = useState(autoOpen || false);
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const raporRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (autoOpen) {
      const timeout = setTimeout(() => {
        setOpen(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [autoOpen]);
  
  const hasContent = renderContent && typeof renderContent === 'function';
  
  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick();
    } else {
      setOpen(true);
    }
  };

  const handlePrint = () => {
    const containerId = copyTargetId || 'report-modal-content';
    const element = document.getElementById(containerId);
    if (!element) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; }
            body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
            th { text-align: left; font-weight: 600; background: #f3f4f6; }
            td { text-align: right; }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      console.log('Word export not implemented in local copy');
    } catch (error) {
      console.error('Word export error:', error);
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
      
      console.log('PDF export not implemented in local copy');
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') {
        setOpen(false);
        if (onButtonClick) onButtonClick();
      }
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onButtonClick]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
    if ((e.target as HTMLElement).closest('.export-buttons')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (!isMaximized) {
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          className={buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap"}
          style={buttonStyle}
          onClick={handleButtonClick}
        >
          <span className="hidden sm:inline">🧾 Önizleme</span>
          <span className="sm:hidden">🧾 Önizleme</span>
        </button>
      )}
      {open && hasContent && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/40" role="dialog" aria-modal="true">
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{
              position: 'fixed',
              top: isMaximized ? '0' : '50%',
              left: isMaximized ? '0' : '50%',
              transform: isMaximized 
                ? 'none' 
                : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
              width: isMaximized ? '100vw' : 'min(900px, 95vw)',
              height: isMaximized ? '100vh' : (isMinimized ? 'auto' : 'auto'),
              maxHeight: isMaximized ? '100vh' : '90vh',
              cursor: isDragging ? 'grabbing' : 'default',
              transition: isDragging ? 'none' : 'all 0.2s ease',
              resize: isMaximized ? 'none' : 'both',
              minWidth: '400px',
              minHeight: '300px',
            }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div 
              className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-2">
                <div className="font-semibold">{title || ''}</div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMinimize();
                    }}
                    className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition"
                    title={isMinimized ? "Genişlet" : "Küçült"}
                  >
                    {isMinimized ? '🔼' : '🔽'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMaximize();
                    }}
                    className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition"
                    title={isMaximized ? "Küçült" : "Tam Ekran"}
                  >
                    {isMaximized ? '🗗' : '🗖'}
                  </button>
                </div>
              </div>
              <div className="export-buttons">
                <ExportButtons
                  onPrint={handlePrint}
                  onWord={handleDownloadWord}
                  onPdf={async () => {
                    try {
                      await handleDownloadPDF();
                    } catch (err) {
                      console.error("PDF generation error:", err);
                    }
                  }}
                  onClose={() => {
                    setOpen(false);
                    if (onButtonClick) {
                      setTimeout(() => onButtonClick(), 100);
                    }
                  }}
                  wordBusy={wordBusy}
                  pdfBusy={pdfBusy}
                />
              </div>
            </div>
            {!isMinimized && hasContent && (
              <div className="p-4 text-sm overflow-auto" style={{ maxHeight: isMaximized ? 'calc(100vh - 60px)' : '80vh' }}>
                <div id="report-modal-content" ref={raporRef as any}>
                  {renderContent()}
                </div>
              </div>
            )}
            
            {!isMaximized && !isMinimized && (
              <div 
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
                style={{
                  background: 'linear-gradient(135deg, transparent 50%, #cbd5e1 50%)',
                  borderBottomRightRadius: '0.5rem',
                }}
                title="Boyutlandırmak için sürükleyin"
              />
            )}
          </div>
        </div>, document.body)
      }
    </>
  );
}
