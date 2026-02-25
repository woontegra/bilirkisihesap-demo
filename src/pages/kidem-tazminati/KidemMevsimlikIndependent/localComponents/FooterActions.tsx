import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

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
    onButtonClick?: () => void;
    autoOpen?: boolean;
  };
};

const ActionButton = ({ label, icon, onClick, disabled, className, title }: {
  label: string;
  icon: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) => {
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
  previewButton,
}: FooterActionsProps) {
  if (!leftContent && !onPrint && !onSave && !previewButton) return null;

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
        <button
          onClick={previewButton.onButtonClick}
          className={clsx(
            "bg-purple-600 hover:bg-purple-700 text-white",
            "text-xs sm:text-sm font-medium",
            "px-3 md:px-4 py-3 md:py-2 min-h-[44px] md:min-h-0",
            "rounded-lg transition-colors",
            "flex items-center justify-center gap-1.5 sm:gap-2",
            "w-full md:w-auto",
            previewButton.buttonClassName
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="whitespace-nowrap">Önizleme</span>
        </button>
      )}
      
      {onPrint && (
        <ActionButton
          label={printLabel}
          onClick={onPrint}
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
