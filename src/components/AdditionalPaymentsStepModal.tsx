import { ChangeEvent, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { API_BASE_URL } from "@/utils/apiClient";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  caseId: number;
  onNext?: () => void;
  onBack?: () => void;
};

export default function AdditionalPaymentsStepModal({ open, setOpen, caseId, onNext, onBack }: Props) {
  const [bakim, setBakim] = useState<string>("");
  const [yol, setYol] = useState<string>("");
  const [saglik, setSaglik] = useState<string>("");

  useEffect(() => {
    if (!open || !caseId) return;
    setBakim("");
    setYol("");
    setSaglik("");
  }, [open, caseId]);

  const autoSave = async (field: string, value: string) => {
    if (!caseId) return;
    try {
      await fetch(`${API_BASE_URL}/api/cases/autosave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "1" },
        body: JSON.stringify({ caseId, field, value }),
      });
    } catch (e) {
      console.error("Autosave error:", e);
    }
  };

  const onChange = (setter: (v: string) => void, field: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setter(v);
    void autoSave(field, v);
  };

  const handleNext = () => {
    onNext?.();
    setOpen(false);
  };

  const handleReset = () => {
    setBakim("");
    setYol("");
    setSaglik("");
    void autoSave("bakim_ucreti", "");
    void autoSave("yol_ucreti", "");
    void autoSave("saglik_odeme", "");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full sm:max-w-[800px] bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-8 space-y-4">
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-red-500 transition-colors text-xl"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Ek Ödemeler (Opsiyonel)</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Bakım Ücreti (₺)</label>
            <input type="text" value={bakim} onChange={onChange(setBakim, "bakim_ucreti")} className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Yol Ücreti (₺)</label>
            <input type="text" value={yol} onChange={onChange(setYol, "yol_ucreti")} className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Sağlık Ödemesi (₺)</label>
            <input type="text" value={saglik} onChange={onChange(setSaglik, "saglik_odeme")} className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex justify-between items-center mt-auto">
          <button onClick={() => onBack?.()} className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium">← Geri</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleReset} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Formu Sıfırla</button>
            <button onClick={handleNext} className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">İleri →</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
