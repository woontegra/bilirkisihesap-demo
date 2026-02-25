import React, { useState, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

interface DraggableModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  headerActions?: ReactNode;
  maxWidth?: string;
}

export default function DraggableModal({
  open,
  onClose,
  title,
  children,
  headerActions,
  maxWidth = "900px"
}: DraggableModalProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Body overflow management
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Keyboard escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header-actions')) return;
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden"
        style={{
          position: 'fixed',
          top: isMaximized ? '0' : '50%',
          left: isMaximized ? '0' : '50%',
          transform: isMaximized
            ? 'none'
            : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          width: isMaximized ? '100vw' : `min(${maxWidth}, 95vw)`,
          height: isMaximized ? '100vh' : (isMinimized ? 'auto' : 'auto'),
          maxHeight: isMaximized ? '100vh' : '90vh',
          cursor: isDragging ? 'grabbing' : 'default',
          transition: isDragging ? 'none' : 'all 0.2s ease',
          resize: isMaximized ? 'none' : 'both',
          minWidth: '400px',
          minHeight: '300px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header – başlık veya sol alandan sürükleyerek taşınabilir */}
        <div
          className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900 select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          title="Taşımak için buradan sürükleyin"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0" style={{ minWidth: '200px' }}>
            <span className="text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" title="Sürükleyin">⋮⋮</span>
            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMinimize();
                }}
                className="w-6 h-6 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
                title={isMinimized ? "Genişlet" : "Küçült"}
              >
                {isMinimized ? '🔼' : '🔽'}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMaximize();
                }}
                className="w-6 h-6 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
                title={isMaximized ? "Küçült" : "Tam Ekran"}
              >
                {isMaximized ? '🗗' : '🗖'}
              </button>
            </div>
          </div>
          <div className="modal-header-actions flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none px-2"
              title="Kapat"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-4 text-sm overflow-auto" style={{ maxHeight: isMaximized ? 'calc(100vh - 60px)' : '80vh' }}>
            {children}
          </div>
        )}

        {/* Resize Handle */}
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
    </div>,
    document.body
  );
}
