import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback } from "react";
import ReportPreviewButton from "./ReportPreviewButton";
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
  /** Sol tarafta gösterilecek içerik (örn. 270 Saat Düşüm, Zamanaşımı, Kat Sayı butonları) */
  leftContent?: ReactNode;
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  className?: string;
  pageKey?: PageKey; // Sayfa rengi için
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    buttonClassName?: string;
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void; // Özel buton tıklama callback'i
    autoOpen?: boolean; // Modal'ı otomatik aç
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
        "w-full md:w-auto py-3 md:py-2 min-h-[44px] md:min-h-0",
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
  leftContent,
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
  if (!leftContent && !onPrint && !onSave && !previewButton) return null;

  // Merkezi yazdırma fonksiyonu - Yazdır butonu her zaman doğrudan yazdırma (onPrint) kullanır
  const handlePrint = useCallback(() => {
    // Sayfa onPrint veriyorsa her zaman doğrudan yazdır (sayfa #kidem-print vb. ile window.print() yapar)
    if (onPrint) {
      onPrint();
      return;
    }
    // onPrint yoksa, previewButton içeriğini kullanarak yazdır (geriye dönük uyumluluk)
    if (previewButton && previewButton.renderContent) {
      // renderContent'in null döndürüp döndürmediğini kontrol et
      const content = previewButton.renderContent();
      if (content === null || content === undefined) {
        // renderContent null döndürüyorsa, onPrint prop'unu kullan
        if (onPrint) {
          onPrint();
        }
        return;
      }
      try {
        // Modal içeriğini geçici olarak DOM'a ekle
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
        
        // React render için import
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
              // İçerik hazır, içeriği al ve cleanup yap
              const contentHtml = targetEl.outerHTML;
              cleanup();
              
              // Yazdır
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
          
          // İlk kontrol
          setTimeout(() => {
            if (checkAndPrint()) return;
          }, 100);
          
          // MutationObserver ile içeriğin render edilmesini bekle
          const observer = new MutationObserver(() => {
            if (checkAndPrint()) {
              // checkAndPrint içinde cleanup yapılıyor
            }
          });
          observerRef = observer;
          
          observer.observe(tempContainer, {
            childList: true,
            subtree: true,
            characterData: true
          });
          
          // Timeout fallback
          timeoutId = setTimeout(() => {
            if (cleanupDone) return;
            if (!checkAndPrint()) {
              console.warn('[Print] Timeout - forcing print with available content');
              cleanup();
              const targetEl = tempContainer.querySelector(`#${previewButton.copyTargetId}`);
              if (targetEl) {
                const contentHtml = targetEl.outerHTML;
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
              }
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
    }
  }, [previewButton, onPrint]);

  return (
    <div
      className={clsx(
        "fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-white dark:bg-gray-800",
        "min-h-[57px] py-3 md:py-0 md:h-[57px] md:min-h-0",
        "px-4 pt-0 pb-0",
        "flex flex-col md:flex-row md:flex-nowrap justify-between items-stretch md:items-center gap-2 md:gap-4",
        "overflow-x-auto scrollbar-hide",
        "border-t border-gray-200 dark:border-gray-700 shadow-lg",
        className,
      )}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
        {leftContent}
      </div>
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 flex-shrink-0 w-full md:w-auto">
      {previewButton && (
        <ReportPreviewButton
          title={previewButton.title}
          copyTargetId={previewButton.copyTargetId}
          buttonClassName={previewButton.buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-3 md:py-2 rounded-md transition w-full md:w-auto flex items-center justify-center gap-1.5 sm:gap-2"}
          renderContent={previewButton.renderContent}
          onPdf={previewButton.onPdf}
          onButtonClick={previewButton.onButtonClick}
          autoOpen={previewButton.autoOpen}
        />
      )}
      
      {(onPrint || previewButton) && (
        <ActionButton
          label={printLabel}
          onClick={handlePrint}
          disabled={printButtonProps?.disabled}
          title={printButtonProps?.title}
          className={clsx(
            "bg-blue-600 hover:bg-blue-700 text-white",
            "text-xs sm:text-sm",
            "px-3 md:px-4",
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
            "bg-green-600 hover:bg-green-700 text-white",
            "text-xs sm:text-sm",
            "px-3 md:px-4",
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
    </div>
  );
}

