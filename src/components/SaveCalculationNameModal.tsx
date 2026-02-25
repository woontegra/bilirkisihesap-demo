import React from "react";

export interface SaveCalculationNameModalProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  onSave: (name: string) => void;
  saving: boolean;
  /** Boş isimle kaydetmeye çalışıldığında çağrılır (örn. toast göstermek için) */
  onEmptyName?: () => void;
  /** Input placeholder - sayfaya göre özelleştirilebilir */
  placeholder?: string;
  /** Input id - erişilebilirlik için benzersiz olmalı */
  inputId?: string;
}

/**
 * Tüm hesaplama sayfalarında aynı görünüm ve davranış için kullanılan
 * "Hesaplamayı Kaydet" modalı. Kayıt adı girişi ve Kaydet/İptal butonları.
 */
export default function SaveCalculationNameModal({
  open,
  onClose,
  value,
  onChange,
  onSave,
  saving,
  onEmptyName,
  placeholder = "Örn: Ahmet Yılmaz - Hesaplama",
  inputId = "save-calculation-name-input",
}: SaveCalculationNameModalProps) {
  if (!open) return null;

  const handleSaveClick = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onEmptyName?.();
      return;
    }
    onSave(trimmed);
  };

  const handleBackdropClick = () => {
    if (!saving) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl sm:max-w-[425px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">
          Hesaplamayı Kaydet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Hesaplamanızı kaydetmek için bir isim giriniz.
        </p>
        <div className="py-2">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
          >
            Hesaplama Adı
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full mb-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSave(value.trim());
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            disabled={saving}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bu isim kaydedilen hesaplamalarınız sayfasında görünecektir.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving || !value.trim()}
            className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
