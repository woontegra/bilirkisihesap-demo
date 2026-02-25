import { ChangeEvent, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAccidentWizard } from "@/context/AccidentWizardContext";
import { API_BASE_URL } from "@/utils/apiClient";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  caseId: number;
  onNext?: () => void;
  onBack?: () => void;
};

export default function CompensationStepModal({ open, setOpen, caseId, onNext, onBack }: Props) {
  const [sgk, setSgk] = useState<string>("");
  const [sgkDate, setSgkDate] = useState<string>("");
  const [sigorta, setSigorta] = useState<string>("");
  const [sigortaDate, setSigortaDate] = useState<string>("");
  const [avans, setAvans] = useState<string>("");
  const [avansDate, setAvansDate] = useState<string>("");
  const { wizardData, updateWizardData } = useAccidentWizard();

  useEffect(() => {
    if (!open || !caseId) return;
    // Prefill from context if present
    setSgk(wizardData?.sgkOdeme || "");
    setSgkDate(wizardData?.pesinSermayeTarihi || "");
    setSigorta(wizardData?.sigortaOdeme || "");
    setSigortaDate(wizardData?.sigortaTarihi || "");
    setAvans(wizardData?.avans || "");
    setAvansDate(wizardData?.avansTarihi || "");
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
    // Mirror into context
    if (field === "sgk_odeme") updateWizardData({ sgkOdeme: v });
    if (field === "sigorta_odeme") updateWizardData({ sigortaOdeme: v });
    if (field === "avans") updateWizardData({ avans: v });
  };

  const onDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSgkDate(v);
    void autoSave("pesin_sermaye_tarihi", v);
    updateWizardData({ pesinSermayeTarihi: v });
  };

  const handleNext = () => {
    onNext?.();
    setOpen(false);
  };

  const handleReset = () => {
    // Clear only Step 4 fields locally and autosave clears
    setSgk("");
    setSgkDate("");
    setSigorta("");
    setAvans("");
    void autoSave("sgk_odeme", "");
    void autoSave("pesin_sermaye_tarihi", "");
    void autoSave("sigorta_odeme", "");
    void autoSave("sigorta_tarihi", "");
    void autoSave("avans", "");
    void autoSave("avans_tarihi", "");
    updateWizardData({
      sgkOdeme: "",
      pesinSermayeTarihi: "",
      sigortaOdeme: "",
      sigortaTarihi: "",
      avans: "",
      avansTarihi: "",
    });
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
        <h2 className="text-lg font-semibold text-gray-900">SGK ve Tazminat Bilgileri</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Peşin Sermaye Değeri (₺)</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <input
                type="date"
                value={sgkDate}
                onChange={onDateChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Örnek: 12.345,67"
                value={sgk}
                onChange={onChange(setSgk, "sgk_odeme")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Sigorta Ödemesi (₺)</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <input
                type="date"
                value={sigortaDate}
                onChange={(e) => { const v = e.target.value; setSigortaDate(v); void autoSave("sigorta_tarihi", v); updateWizardData({ sigortaTarihi: v }); }}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Örnek: 12.345,67"
                value={sigorta}
                onChange={onChange(setSigorta, "sigorta_odeme")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Avans (₺)</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <input
                type="date"
                value={avansDate}
                onChange={(e) => { const v = e.target.value; setAvansDate(v); void autoSave("avans_tarihi", v); updateWizardData({ avansTarihi: v }); }}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Örnek: 1.234,56"
                value={avans}
                onChange={onChange(setAvans, "avans")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
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
