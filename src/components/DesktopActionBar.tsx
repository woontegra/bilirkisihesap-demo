import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import ReportPreviewButton from "./ReportPreviewButton";

type DesktopActionBarProps = {
  leftContent?: ReactNode;
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void;
    autoOpen?: boolean;
    hideWordDownload?: boolean;
  };
  onPrintClick: () => void;
  /** Yazdır butonu yerine gösterilecek buton (örn. Yeni Hesapla). Verilirse Yazdır gösterilmez. */
  replacePrintWith?: { label: string; onClick: () => void; disabled?: boolean };
};

const btnBase = "h-9 rounded-xl font-medium text-sm flex items-center justify-center gap-2 px-4 transition-colors disabled:opacity-70 disabled:cursor-not-allowed border border-transparent dark:border-gray-500";

export default function DesktopActionBar({
  leftContent,
  onPrint,
  onSave,
  printLabel = "Yazdır",
  saveLabel = "Kaydet",
  printButtonProps,
  saveButtonProps,
  previewButton,
  onPrintClick,
  replacePrintWith,
}: DesktopActionBarProps) {
  const showPrintSlot = replacePrintWith ? true : (onPrint || previewButton);
  return (
    <div className="hidden lg:flex fixed bottom-0 left-0 right-0 lg:left-56 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200/60 dark:border-gray-800/60 px-4 py-3 items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-shrink-0 min-w-0 overflow-x-auto scrollbar-hide">
        {leftContent}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {previewButton && (
          <ReportPreviewButton
            title={previewButton.title}
            copyTargetId={previewButton.copyTargetId}
            buttonClassName={clsx(
              btnBase,
              "bg-purple-600 hover:bg-purple-700 text-white"
            )}
            renderContent={previewButton.renderContent}
            onPdf={previewButton.onPdf}
            onButtonClick={previewButton.onButtonClick}
            autoOpen={previewButton.autoOpen}
            hideWordDownload={previewButton.hideWordDownload}
          />
        )}
        {showPrintSlot && replacePrintWith && (
          <button
            type="button"
            onClick={replacePrintWith.onClick}
            disabled={replacePrintWith.disabled}
            title={replacePrintWith.label}
            className={clsx(
              btnBase,
              "bg-blue-600 hover:bg-blue-700 text-white",
              replacePrintWith.disabled && "opacity-50 cursor-not-allowed"
            )}
            style={replacePrintWith.disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="whitespace-nowrap">{replacePrintWith.label}</span>
          </button>
        )}
        {showPrintSlot && !replacePrintWith && (onPrint || previewButton) && (
          <button
            type="button"
            onClick={onPrintClick}
            disabled={printButtonProps?.disabled}
            title={printButtonProps?.title ?? printLabel}
            className={clsx(
              btnBase,
              "bg-blue-600 hover:bg-blue-700 text-white",
              printButtonProps?.className
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            <span className="whitespace-nowrap">{printLabel}</span>
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveButtonProps?.disabled}
            title={saveButtonProps?.title ?? saveLabel}
            className={clsx(
              btnBase,
              "bg-green-600 hover:bg-green-700 text-white",
              saveButtonProps?.className
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span className="whitespace-nowrap">{saveLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
