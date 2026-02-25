import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "../../localLib/utils";

const Dialog = DialogPrimitive.Root;
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
    <div className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen p-4">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 focus:outline-none transition-all duration-200",
          className
        )}
        {...props}
      />
    </div>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)} {...props} />
);
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)} {...props} />
));
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />
));

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
