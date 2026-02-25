import { AlertCircle, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateMessageProps {
  message?: string;
  showTenantWarning?: boolean;
  className?: string;
}

/**
 * Tenant-aware empty state component
 * Shows appropriate message based on whether data is missing or tenant mismatch
 */
export function EmptyStateMessage({ 
  message = "Henüz kayıt bulunmuyor",
  showTenantWarning = false,
  className 
}: EmptyStateMessageProps) {
  const tenantId = localStorage.getItem("tenant_id");
  
  // If no tenant ID, show critical error
  if (!tenantId) {
    return (
      <div className={cn(
        "w-full h-64 flex flex-col items-center justify-center gap-3",
        "text-red-600 dark:text-red-400",
        className
      )}>
        <AlertCircle className="w-12 h-12" />
        <div className="text-center">
          <p className="font-semibold">Tenant Bilgisi Eksik</p>
          <p className="text-sm mt-1">Lütfen yeniden giriş yapın</p>
        </div>
      </div>
    );
  }
  
  // If tenant warning is enabled, show potential mismatch warning
  if (showTenantWarning) {
    return (
      <div className={cn(
        "w-full h-64 flex flex-col items-center justify-center gap-3",
        "text-amber-600 dark:text-amber-400",
        className
      )}>
        <Database className="w-12 h-12" />
        <div className="text-center">
          <p className="font-semibold">Veri Erişim Sorunu</p>
          <p className="text-sm mt-1">
            Tenant uyuşmazlığı olabilir - Verilerinize erişilemiyor
          </p>
          <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
            Tenant ID: {tenantId}
          </p>
        </div>
      </div>
    );
  }
  
  // Normal empty state
  return (
    <div className={cn(
      "w-full h-64 flex flex-col items-center justify-center gap-3",
      "text-gray-500 dark:text-gray-400",
      className
    )}>
      <Database className="w-10 h-10" />
      <p>{message}</p>
    </div>
  );
}


