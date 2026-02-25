/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 * 
 * Simplified FooterActions for this page only
 */

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback } from "react";
import { usePageStyle, type PageKey } from "../localHooks/usePageStyle";

type ActionButtonProps = {
  label: string;
  icon: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

type FooterActionsProps = {
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  className?: string;
  pageKey?: PageKey;
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    buttonClassName?: string;
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void;
    autoOpen?: boolean;
  };
};

const ActionButton = ({ label, icon, onClick, disabled, className, title }: ActionButtonProps) => {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={clsx(
        "justify-center rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2",
        "shrink-0",
        disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};

export default function FooterActions({
  onPrint,
  onSave,
  printLabel = "Yazdır",
  saveLabel = "Kaydet",
  printButtonProps,
  saveButtonProps,
  className,
  pageKey,
  previewButton,
}: FooterActionsProps) {
  if (!onPrint && !onSave && !previewButton) return null;

  const handlePrint = useCallback(() => {
    if (previewButton && previewButton.renderContent) {
      const content = previewButton.renderContent();
      if (content === null || content === undefined) {
        if (onPrint) {
          onPrint();
        }
        return;
      }
      try {
        const tempContainer = document.createElement('div');
        const uniqueId = 'temp-print-container-' + Date.now();
        tempContainer.id = uniqueId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-10000px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '900px';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.zIndex = '-1';
        document.body.appendChild(tempContainer);
        
        import('react-dom/client').then(({ createRoot }) => {
          const root = createRoot(tempContainer);
          const content = previewButton.renderContent();
          root.render(content as any);
          
          let cleanupDone = false;
          let observerRef: MutationObserver | null = null;
          let timeoutId: NodeJS.Timeout | null = null;
          
          const cleanup = () => {
            if (cleanupDone) return;
            cleanupDone = true;
            try {
              if (observerRef) {
                observerRef.disconnect();
                observerRef = null;
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              root.unmount();
              if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
              }
            } catch (e) {
              console.error('Cleanup error:', e);
            }
          };
          
          const checkAndPrint = () => {
            const targetEl = tempContainer.querySelector(`#${previewButton.copyTargetId}`);
            if (targetEl && targetEl.innerHTML.trim().length > 100) {
              const contentHtml = targetEl.outerHTML;
              cleanup();
              
              setTimeout(() => {
                const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${previewButton.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap !important; text-align: left; }
  </style>
</head>
<body>
  <div class="print-title">${previewButton.title}</div>
  ${contentHtml}
</body>
</html>`;
                
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);
                
                const doc = iframe.contentWindow?.document;
                if (doc) {
                  doc.open();
                  doc.write(html);
                  doc.close();
                  iframe.onload = () => {
                    try {
                      iframe.contentWindow?.focus();
                      iframe.contentWindow?.print();
                    } catch (error) {
                      console.error('Yazdırma hatası:', error);
                    }
                    setTimeout(() => {
                      try {
                        document.body.removeChild(iframe);
                      } catch {}
                    }, 400);
                  };
                }
              }, 50);
              return true;
            }
            return false;
          };
          
          setTimeout(() => {
            if (checkAndPrint()) return;
          }, 100);
          
          const observer = new MutationObserver(() => {
            if (checkAndPrint()) {
            }
          });
          observerRef = observer;
          
          observer.observe(tempContainer, {
            childList: true,
            subtree: true,
            characterData: true
          });
          
          timeoutId = setTimeout(() => {
            if (cleanupDone) return;
            if (!checkAndPrint()) {
              console.warn('[Print] Timeout - forcing print with available content');
              cleanup();
            }
          }, 3000);
        }).catch((error) => {
          console.error('React render error:', error);
          if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
          }
        });
      } catch (error) {
        console.error('Print error:', error);
      }
    } else if (onPrint) {
      onPrint();
    }
  }, [previewButton, onPrint]);

  return (
    <div
      className={clsx(
        "fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-white dark:bg-gray-800",
        "h-[57px] sm:h-[61px]",
        "px-4 pt-0 pb-0",
        "flex flex-nowrap justify-end items-center gap-2 sm:gap-3 md:gap-4",
        "overflow-x-auto scrollbar-hide",
        "border-t border-gray-200 dark:border-gray-700 shadow-lg",
        className,
      )}
    >
      {previewButton && (
        <button
          type="button"
          onClick={previewButton.onButtonClick}
          className={previewButton.buttonClassName || "bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-500 dark:to-purple-600 hover:from-purple-700 hover:to-purple-800 dark:hover:from-purple-600 dark:hover:to-purple-700 text-white font-semibold text-xs sm:text-sm px-2.5 sm:px-3 md:px-4 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 min-w-[65px] sm:min-w-[80px] md:min-w-[100px] shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 ring-1 ring-purple-500/50 dark:ring-purple-400/50 no-underline"}
          style={{ textDecoration: 'none !important' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="whitespace-nowrap font-semibold" style={{ textDecoration: 'none !important' }}>Önizleme</span>
        </button>
      )}
      
      {(onPrint || previewButton) && (
        <ActionButton
          label={printLabel}
          onClick={handlePrint}
          disabled={printButtonProps?.disabled}
          title={printButtonProps?.title}
          className={clsx(
            "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white",
            "text-xs sm:text-sm",
            "px-2.5 sm:px-3 md:px-4 py-1.5",
            "min-w-[65px] sm:min-w-[80px] md:min-w-[100px]",
            "shrink-0",
            printButtonProps?.className,
          )}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          }
        />
      )}

      {onSave && (
        <ActionButton
          label={saveLabel}
          onClick={onSave}
          disabled={saveButtonProps?.disabled}
          title={saveButtonProps?.title}
          className={clsx(
            "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white",
            "text-xs sm:text-sm",
            "px-2.5 sm:px-3 md:px-4 py-1.5",
            "min-w-[65px] sm:min-w-[80px] md:min-w-[100px]",
            "shrink-0",
            saveButtonProps?.className,
          )}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          }
        />
      )}
    </div>
  );
}
