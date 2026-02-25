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
  buttonStyle?: React.CSSProperties; // Buton için özel stil
  buttonIcon?: ReactNode; // İkon (göz vb.) – üstte gösterilir
  copyTargetId?: string; // element id whose outerHTML will be copied
  onPdf?: () => Promise<void> | void; // Backend PDF generation callback
  onButtonClick?: () => void; // Özel buton tıklama callback'i (modal açma yerine kullanılır)
  hideButton?: boolean; // Butonu gizle
  autoOpen?: boolean; // Modal'ı otomatik aç
};

export default function ReportPreviewButton({ title, renderContent, buttonClassName, buttonStyle, buttonIcon, copyTargetId, onPdf, onButtonClick, hideButton, autoOpen }: Props) {
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
  
  // autoOpen prop'u değiştiğinde modal'ı aç/kapat
  useEffect(() => {
    if (autoOpen) {
      // Verilerin render edilmesi için kısa bir gecikme
      const timeout = setTimeout(() => {
        setOpen(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [autoOpen]);
  
  // Eğer renderContent null ise modal açma özelliğini devre dışı bırak
  const hasContent = renderContent && typeof renderContent === 'function';
  
  // Buton tıklama handler'ı
  const handleButtonClick = () => {
    if (onButtonClick) {
      // Özel callback varsa onu çağır (modal açma yerine)
      onButtonClick();
    } else {
      // Yoksa normal modal açma davranışı
      setOpen(true);
    }
  };
  const handlePrint = () => {
    // Merkezi yazdırma utility'sini kullan
    printFromModal(title, copyTargetId);
  };

  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const containerId = copyTargetId || 'report-modal-content';
      await downloadWordDocument(title, containerId);
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      
      // Eğer onPdf callback'i varsa, backend PDF generation'ı kullan
      if (onPdf) {
        await onPdf();
        return;
      }
      
      // Frontend PDF generation - Merkezi utility kullan
      const containerId = copyTargetId || 'report-modal-content';
      await downloadPdfFromDOM(title, containerId);
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

  // Dragging logic
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

  // Reset position when modal opens
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
      setIsMinimized(false);
      setIsMaximized(false);
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Sadece başlık çubuğundan sürüklenebilir
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
      setPosition({ x: 0, y: 0 }); // Maximize olunca ortala
    }
  };

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          className={buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2"}
          style={buttonStyle}
          onClick={handleButtonClick}
        >
          {buttonIcon ? (
            <>
              {buttonIcon}
              <span className="whitespace-nowrap">{title}</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">🧾 Önizleme</span>
              <span className="sm:hidden">🧾 Önizleme</span>
            </>
          )}
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
            
            {/* Resize Handle - Sağ alt köşede */}
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
