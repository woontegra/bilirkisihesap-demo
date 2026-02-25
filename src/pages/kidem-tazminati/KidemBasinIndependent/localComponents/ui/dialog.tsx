import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" onClick={() => onOpenChange?.(false)} aria-hidden />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen p-4" onClick={(e) => e.target === e.currentTarget && onOpenChange?.(false)}>
        {children}
      </div>
    </>,
    document.body
  );
}

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 focus:outline-none", className)} {...props} />
));
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
