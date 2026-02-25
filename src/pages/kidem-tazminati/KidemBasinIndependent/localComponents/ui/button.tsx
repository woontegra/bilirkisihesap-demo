import * as React from "react";
import { cn } from "./cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-full md:w-auto",
      variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
      variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
      variant === "outline" && "border border-gray-300 bg-white hover:bg-gray-50 text-gray-900",
      variant === "secondary" && "bg-gray-100 text-gray-900 hover:bg-gray-200",
      variant === "ghost" && "hover:bg-gray-100 text-gray-900",
      variant === "link" && "text-blue-600 underline-offset-4 hover:underline",
      size === "default" && "min-h-[44px] px-4 py-3 md:py-2 md:px-5",
      size === "sm" && "min-h-[40px] rounded-md px-3 py-3 md:py-2 md:px-4",
      size === "lg" && "min-h-[48px] rounded-md px-6 py-3 md:py-2.5 md:px-8",
      size === "icon" && "min-h-[44px] min-w-0 md:min-w-[40px] p-2 md:p-2",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

export { Button };
