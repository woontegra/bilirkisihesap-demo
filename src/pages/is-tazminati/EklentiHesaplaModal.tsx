import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (value: number) => void;
};

export default function EklentiHesaplaModal({ open, onClose, onApply }: Props) {
  const [months, setMonths] = useState<string[]>(Array.from({ length: 12 }, () => ""));

  const sum = useMemo(() =>
    months.reduce((acc, v) => acc + (Number(String(v).replace(/\./g, "").replace(",", ".")) || 0), 0),
  [months]);

  const result = useMemo(() => (sum / 360) * 30, [sum]);

  const handleChange = (i: number, v: string) => {
    setMonths((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fadeIn" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scaleIn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Eklenti Hesaplama</h3>
          <button onClick={onClose} className="text-gray-500 text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {months.map((v, i) => (
            <div key={i} className="space-y-1">
              <label className="text-xs text-gray-600">{i + 1}. Ay</label>
              <input
                value={v}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder="Örn: 1.250,00"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Formül: (aylık toplam / 360) × 30
        </div>

        <div className="mt-2 text-base font-medium text-gray-900">
          Sonuç: {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(result || 0)}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 text-sm">İptal</button>
          <button
            onClick={() => { onApply(result || 0); onClose(); }}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >Uygula</button>
        </div>
      </div>
    </div>
  );
}
