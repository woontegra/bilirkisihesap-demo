import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Eye, Printer, Save } from "lucide-react";

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
    renderContent?: () => ReactNode;
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
          title={previewButton.title}
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
          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
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
          icon={<Printer className="h-4 w-4 sm:h-5 sm:w-5" />}
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
          icon={<Save className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      )}
      </div>
    </div>
  );
}
