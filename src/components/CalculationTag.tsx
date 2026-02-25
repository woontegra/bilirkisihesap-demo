import { X } from "lucide-react";

interface CalculationTagProps {
  id: string;
  color: string;
  label: string;
  onDelete: (id: string) => void;
}

// Renk tanımları
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  red: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700"
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-700"
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700"
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700"
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700"
  }
};

export default function CalculationTag({ id, color, label, onDelete }: CalculationTagProps) {
  const colorStyle = colorClasses[color] || colorClasses.blue;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border} transition-all hover:shadow-md cursor-default`}
      title={label}
    >
      <span className="whitespace-nowrap">{label}</span>
      <button
        onClick={() => onDelete(id)}
        className={`p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0`}
        title="Etiketi sil"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// Etiket oluşturma modalı için renk seçenekleri
export const tagColors = [
  { value: "red", label: "Kırmızı", className: "bg-red-500" },
  { value: "yellow", label: "Sarı", className: "bg-yellow-500" },
  { value: "green", label: "Yeşil", className: "bg-green-500" },
  { value: "blue", label: "Mavi", className: "bg-blue-500" },
  { value: "purple", label: "Mor", className: "bg-purple-500" }
];

