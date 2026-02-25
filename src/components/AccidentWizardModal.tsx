import { useEffect, useState, ChangeEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAccidentWizard } from "@/context/AccidentWizardContext";
import { API_BASE_URL } from "@/utils/apiClient";

type AccidentWizardModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  caseId: number;
  onNext?: () => void;
  onPartiesChange?: (data: { taraf: { ad: string; soyad: string }; karsilar: { ad: string; soyad: string; tur?: string }[] }) => void;
};

type AccidentFormData = {
  tarafAd: string;
  tarafSoyad: string;
  karsiTaraflar: { ad: string; soyad: string; tur?: string }[];
  cinsiyet: string;
  dogum_tarihi: string;
  kaza_tarihi: string;
  rapor_tarihi: string;
};

const initialFormData: AccidentFormData = {
  tarafAd: "",
  tarafSoyad: "",
  karsiTaraflar: [{ ad: "", soyad: "", tur: "Gerçek Kişi" }],
  cinsiyet: "",
  dogum_tarihi: "",
  kaza_tarihi: "",
  rapor_tarihi: new Date().toISOString().split("T")[0],
};

export default function AccidentWizardModal({
  open,
  setOpen,
  caseId,
  onNext,
  onPartiesChange,
}: AccidentWizardModalProps) {
  const [formData, setFormData] = useState<AccidentFormData>(initialFormData);
  const { wizardData, updateWizardData } = useAccidentWizard();

  useEffect(() => {
    if (!open) return;
    // Prefill from context if available
    const prefilled: AccidentFormData = {
      tarafAd: wizardData?.taraf?.ad || "",
      tarafSoyad: wizardData?.taraf?.soyad || "",
      karsiTaraflar:
        (wizardData?.karsiTaraflar?.length
          ? wizardData.karsiTaraflar.map((k: any) => ({ ad: k.ad || "", soyad: k.soyad || "", tur: k.tur }))
          : [{ ad: "", soyad: "", tur: "Gerçek Kişi" }]) || [{ ad: "", soyad: "", tur: "Gerçek Kişi" }],
      cinsiyet: wizardData?.cinsiyet || "",
      dogum_tarihi: wizardData?.dogumTarihi || "",
      kaza_tarihi: wizardData?.kazaTarihi || "",
      rapor_tarihi: wizardData?.raporTarihi || new Date().toISOString().split("T")[0],
    };
    setFormData(prefilled);
    if (caseId) {
      void autoSave("rapor_tarihi", prefilled.rapor_tarihi);
    }
  }, [caseId, open]);

  const autoSave = async (field: string, value: string) => {
    if (!caseId) return;
    try {
      await fetch(`${API_BASE_URL}/api/cases/autosave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "1",
        },
        body: JSON.stringify({ caseId, field, value }),
      });
    } catch (error) {
      console.error("Autosave error:", error);
    }
  };

  const handleChange = (field: keyof AccidentFormData) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    void autoSave(field as string, value);
    // Mirror to Context
    if (field === "dogum_tarihi") updateWizardData({ dogumTarihi: value });
    if (field === "kaza_tarihi") updateWizardData({ kazaTarihi: value });
    if (field === "rapor_tarihi") updateWizardData({ raporTarihi: value });
    if (field === "cinsiyet") updateWizardData({ cinsiyet: value });
  };

  const handleKarsiTarafFieldChange = (
    index: number,
    field: "ad" | "soyad",
    value: string
  ) => {
    setFormData((prev) => {
      const list = prev.karsiTaraflar.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      void autoSave("karsi_taraflar", JSON.stringify(list));
      return { ...prev, karsiTaraflar: list };
    });
  };

  const handleKarsiTarafTurChange = (index: number, tur: string) => {
    setFormData((prev) => {
      const list = prev.karsiTaraflar.map((item, i) =>
        i === index ? { ...item, tur, ...(tur === "Tüzel Kişi" ? { soyad: "" } : {}) } : item
      );
      void autoSave("karsi_taraflar", JSON.stringify(list));
      return { ...prev, karsiTaraflar: list };
    });
  };

  const handleAddKarsiTaraf = () => {
    setFormData((prev) => {
      const list = [...prev.karsiTaraflar, { ad: "", soyad: "", tur: "Gerçek Kişi" }];
      void autoSave("karsi_taraflar", JSON.stringify(list));
      return { ...prev, karsiTaraflar: list };
    });
  };

  const handleRemoveKarsiTaraf = (index: number) => {
    setFormData((prev) => {
      const list = prev.karsiTaraflar.filter((_, i) => i !== index);
      void autoSave("karsi_taraflar", JSON.stringify(list));
      return { ...prev, karsiTaraflar: list };
    });
  };

  const handleNext = () => {
    onNext?.();
    setOpen(false);
  };

  const handleReset = async () => {
    // Reset only Step 1 related fields in Context
    updateWizardData({
      taraf: { ad: "", soyad: "" },
      karsiTaraflar: [{ ad: "", soyad: "", tur: "Gerçek Kişi" }],
      dogumTarihi: "",
      kazaTarihi: "",
      raporTarihi: "",
      cinsiyet: "",
    });
    // Reset local form
    const cleared: AccidentFormData = {
      tarafAd: "",
      tarafSoyad: "",
      karsiTaraflar: [{ ad: "", soyad: "", tur: "Gerçek Kişi" }],
      cinsiyet: "",
      dogum_tarihi: "",
      kaza_tarihi: "",
      rapor_tarihi: "",
    };
    setFormData(cleared);
    // Sync backend (best-effort)
    void autoSave("tarafAd", "");
    void autoSave("tarafSoyad", "");
    void autoSave("karsi_taraflar", JSON.stringify(cleared.karsiTaraflar));
    void autoSave("cinsiyet", "");
    void autoSave("dogum_tarihi", "");
    void autoSave("kaza_tarihi", "");
    void autoSave("rapor_tarihi", "");
  };

  // Emit parties to parent when party fields change
  useEffect(() => {
    onPartiesChange?.({
      taraf: { ad: formData.tarafAd || "", soyad: formData.tarafSoyad || "" },
      karsilar: formData.karsiTaraflar || [],
    });
    updateWizardData({
      taraf: { ad: formData.tarafAd || "", soyad: formData.tarafSoyad || "" },
      karsiTaraflar: formData.karsiTaraflar || [],
    });
  }, [formData.tarafAd, formData.tarafSoyad, formData.karsiTaraflar]);

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
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Temel Bilgiler</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Taraf Ad</label>
            <input
              type="text"
              value={formData.tarafAd}
              onChange={(e) => {
                setFormData((p) => ({ ...p, tarafAd: e.target.value }));
                void autoSave("tarafAd", e.target.value);
              }}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Taraf Soyad</label>
            <input
              type="text"
              value={formData.tarafSoyad}
              onChange={(e) => {
                setFormData((p) => ({ ...p, tarafSoyad: e.target.value }));
                void autoSave("tarafSoyad", e.target.value);
              }}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {formData.karsiTaraflar.map((kt, index) => (
            <div key={`ktblock-${index}`} className="col-span-2 grid grid-cols-2 gap-2 items-end border-b border-gray-100 pb-2 mb-2">
              <div className="col-span-2">
                <label className="text-sm text-gray-600 mb-1 block">Karşı Taraf Türü</label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white"
                  value={kt.tur || "Gerçek Kişi"}
                  onChange={(e) => handleKarsiTarafTurChange(index, e.target.value)}
                >
                  <option>Gerçek Kişi</option>
                  <option>Tüzel Kişi</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">Karşı Taraf Ad</label>
                <input
                  type="text"
                  value={kt.ad}
                  onChange={(e) => handleKarsiTarafFieldChange(index, "ad", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              {kt.tur !== "Tüzel Kişi" && (
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Karşı Taraf Soyad</label>
                  <input
                    type="text"
                    value={kt.soyad}
                    onChange={(e) => handleKarsiTarafFieldChange(index, "soyad", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              )}

              <div className="col-span-2 flex justify-end">
                {index === formData.karsiTaraflar.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleAddKarsiTaraf}
                    className="text-blue-600 text-sm hover:underline mr-2"
                  >
                    + Ekle
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveKarsiTaraf(index)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Sil 🗑️
                  </button>
                )}
              </div>
            </div>
          ))}

          <div>
            <label className="text-sm text-gray-600">Doğum Tarihi</label>
            <input
              type="date"
              value={formData.dogum_tarihi}
              onChange={handleChange("dogum_tarihi")}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Kaza Tarihi</label>
            <input
              type="date"
              value={formData.kaza_tarihi}
              onChange={handleChange("kaza_tarihi")}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Rapor Tarihi</label>
            <input
              type="date"
              value={formData.rapor_tarihi}
              onChange={handleChange("rapor_tarihi")}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Cinsiyet</label>
            <select
              value={formData.cinsiyet}
              onChange={handleChange("cinsiyet")}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Seçiniz</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
            </select>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex justify-end items-center mt-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Formu Sıfırla
            </button>
            <button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
            >
              İleri →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

