/**
 * toast.tsx
 * Lokal toast sistemi - SADECE bu sayfa için
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

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
    const item: ToastItem = { id, durationMs: 3000, variant: "info", ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) {
      setTimeout(() => dismiss(id), item.durationMs);
    }
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

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="space-y-2 w-[92%] max-w-sm pointer-events-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md shadow-lg border px-3 py-2 bg-white ${
              t.variant === "success" ? "border-green-300" : t.variant === "error" ? "border-red-300" : "border-gray-200"
            }`}
          >
            {t.title && <div className="text-sm font-semibold text-gray-900">{t.title}</div>}
            {t.description && <div className="text-sm text-gray-700 mt-0.5">{t.description}</div>}
            <div className="mt-2 flex justify-end">
              <button onClick={() => dismiss(t.id)} className="text-xs text-gray-500 hover:text-gray-700">Kapat</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
