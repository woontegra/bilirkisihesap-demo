import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "success" | "error" | "info";
  durationMs?: number;
};

type ToastContextType = {
  toasts: ToastItem[];
  show: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, durationMs: 1000, variant: "info", ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) setTimeout(() => dismiss(id), item.durationMs);
  }, [dismiss]);
  const success = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "success", durationMs: 3000 });
  }, [show]);
  const error = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "error", durationMs: 4000 });
  }, [show]);
  const info = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "info", durationMs: 3000 });
  }, [show]);
  const value = useMemo(() => ({ toasts, show, dismiss, success, error, info }), [toasts, show, dismiss, success, error, info]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[92%] max-w-md pointer-events-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`relative overflow-hidden rounded-xl shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 fade-in duration-300 ${
            t.variant === "success"
              ? "bg-white/95 dark:bg-gray-800/95 border-l-4 border-green-500"
              : t.variant === "error"
              ? "bg-white/95 dark:bg-gray-800/95 border-l-4 border-red-500"
              : "bg-white/95 dark:bg-gray-800/95 border-l-4 border-blue-500"
          }`}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>}
              {t.description && <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
