import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback } from "react";
import ReportPreviewButton from "./ReportPreviewButton";

type ActionButtonProps = {
  label: string;
  icon: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

type FooterActionsProps = {
  leftContent?: ReactNode;
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  className?: string;
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    buttonClassName?: string;
    onPdf?: () => Promise<void> | void;
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
        "w-full md:w-auto py-3 md:py-2 min-h-[44px] md:min-h-0",
        disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
        className
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
  previewButton,
}: FooterActionsProps) {
  if (!leftContent && !onPrint && !onSave && !previewButton) return null;

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
      return;
    }
    if (previewButton?.renderContent) {
      const content = previewButton.renderContent();
      if (content == null && onPrint) {
        onPrint();
        return;
      }
      if (content != null) {
        try {
          const tempContainer = document.createElement("div");
          const uniqueId = "temp-print-container-" + Date.now();
          tempContainer.id = uniqueId;
          tempContainer.style.cssText = "position:absolute;left:-10000px;top:0;width:900px;visibility:hidden;pointer-events:none;z-index:-1";
          document.body.appendChild(tempContainer);
          import("react-dom/client").then(({ createRoot }) => {
            const root = createRoot(tempContainer);
            root.render(previewButton.renderContent() as any);
            let done = false;
            const cleanup = () => {
              if (done) return;
              done = true;
              root.unmount();
              if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
            };
            const tryPrint = () => {
              const targetEl = tempContainer.querySelector("#" + previewButton.copyTargetId);
              if (targetEl && (targetEl as HTMLElement).innerHTML.trim().length > 100) {
                const contentHtml = (targetEl as HTMLElement).outerHTML;
                cleanup();
                const html = "<!doctype html><html><head><meta charset=\"utf-8\"/><title>" + previewButton.title + "</title><style>@page{size:A4 portrait;margin:15mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;font-size:12px}</style></head><body><div class=\"print-title\">" + previewButton.title + "</div>" + contentHtml + "</body></html>";
                const iframe = document.createElement("iframe");
                iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
                document.body.appendChild(iframe);
                const doc = iframe.contentWindow?.document;
                if (doc) {
                  doc.open();
                  doc.write(html);
                  doc.close();
                  iframe.onload = () => {
                    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
                    setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
                  };
                }
              }
            };
            setTimeout(() => tryPrint(), 100);
            setTimeout(() => cleanup(), 3000);
          }).catch(() => {
            if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
          });
        } catch {}
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
        className
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
            buttonClassName={previewButton.buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-3 md:py-2 rounded-md transition w-full md:w-auto"}
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
            className={clsx("bg-blue-600 hover:bg-blue-700 text-white", "text-xs sm:text-sm", "px-3 md:px-4", printButtonProps?.className)}
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
            className={clsx("bg-green-600 hover:bg-green-700 text-white", "text-xs sm:text-sm", "px-3 md:px-4", saveButtonProps?.className)}
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
