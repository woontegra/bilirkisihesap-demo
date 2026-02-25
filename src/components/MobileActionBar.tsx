import type { ButtonHTMLAttributes, ReactNode } from "react";
import ReportPreviewButton from "./ReportPreviewButton";

type MobileActionBarProps = {
  onSave?: () => void;
  saveLabel?: string;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  previewButton?: {
    hideWordDownload?: boolean;
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

export default function MobileActionBar({
  onSave,
  saveLabel = "Kaydet",
  saveButtonProps,
  previewButton,
}: MobileActionBarProps) {
  if (!previewButton && !onSave) return null;
  const hasBoth = !!previewButton && !!onSave;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200/60 dark:border-gray-800/60 px-4 py-3">
      <div className={`grid gap-3 ${hasBoth ? "grid-cols-2" : "grid-cols-1"}`}>
        {previewButton && (
          <div className={hasBoth ? "" : "w-full"}>
          <ReportPreviewButton
            title={previewButton.title}
            copyTargetId={previewButton.copyTargetId}
            buttonClassName={
              previewButton.buttonClassName ||
              "h-11 w-full rounded-xl font-medium text-sm flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            }
            renderContent={previewButton.renderContent}
            onPdf={previewButton.onPdf}
            onButtonClick={previewButton.onButtonClick}
            autoOpen={previewButton.autoOpen}
            hideWordDownload={previewButton.hideWordDownload}
          />
          </div>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveButtonProps?.disabled}
            title={saveButtonProps?.title ?? saveLabel}
            className={`h-11 w-full rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${saveButtonProps?.className ?? ""}`}
            style={saveButtonProps?.style}
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
