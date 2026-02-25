import { useState } from "react";
import { X, Check } from "lucide-react";
import { tagColors } from "./CalculationTag";

interface AddTagModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (color: string, label: string) => void;
}

export default function AddTagModal({ open, onClose, onAdd }: AddTagModalProps) {
  const [selectedColor, setSelectedColor] = useState("blue");
  const [label, setLabel] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onAdd(selectedColor, label.trim());
      setLabel("");
      setSelectedColor("blue");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Etiket Ekle
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Renk Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Renk Seçin
            </label>
            <div className="flex gap-2">
              {tagColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-10 h-10 rounded-full ${color.className} transition-all hover:scale-110 flex items-center justify-center ${
                    selectedColor === color.value
                      ? "ring-2 ring-offset-2 ring-gray-400"
                      : ""
                  }`}
                  title={color.label}
                >
                  {selectedColor === color.value && (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Etiket Adı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Etiket Adı
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Örn: Önemli, Acil, Beklemede..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              autoFocus
              maxLength={30}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




