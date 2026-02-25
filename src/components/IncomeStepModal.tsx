import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAccidentWizard } from "@/context/AccidentWizardContext";
import { API_BASE_URL } from "@/utils/apiClient";

type IncomeStepModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  caseId: number;
  onNext?: () => void;
  onBack?: () => void;
};

const wageData: Record<string, string> = {
  "2025": "22.104,67",
  "2024": "17.002,12",
  "2023 (1. Dönem)": "8.506,80",
  "2023 (2. Dönem)": "11.402,32",
  "2022 (1. Dönem)": "4.253,40",
  "2022 (2. Dönem)": "5.500,35",
  "2021": "2.825,90",
  "2020": "2.324,70",
  "2019": "2.020,90",
  "2018": "1.603,12",
  "2017": "1.404,06",
  "2016": "1.300,99",
  "2015 (1. Dönem)": "949,07",
  "2015 (2. Dönem)": "1.000,54",
  "2014 (1. Dönem)": "846,00",
  "2014 (2. Dönem)": "891,03",
  "2013 (1. Dönem)": "773,01",
  "2013 (2. Dönem)": "803,68",
  "2012 (1. Dönem)": "701,44",
  "2012 (2. Dönem)": "739,79",
  "2011 (1. Dönem)": "658,95",
  "2011 (2. Dönem)": "685,85",
  "2010 (1. Dönem)": "599,12",
  "2010 (2. Dönem)": "629,96",
};

const DEFAULT_YEAR = "2025";

export default function IncomeStepModal({
  open,
  setOpen,
  caseId,
  onNext,
  onBack,
}: IncomeStepModalProps) {
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [customIncome, setCustomIncome] = useState("");
  const { wizardData, updateWizardData } = useAccidentWizard();

  const minimumWage = useMemo(
    () => wageData[selectedYear] ?? wageData[DEFAULT_YEAR],
    [selectedYear]
  );

  const sortedYears = useMemo(
    () =>
      Object.keys(wageData).sort((a, b) => {
        const yearA = parseInt(a, 10);
        const yearB = parseInt(b, 10);

        if (!Number.isNaN(yearA) && !Number.isNaN(yearB)) {
          if (yearA !== yearB) {
            return yearB - yearA;
          }
          return a.localeCompare(b);
        }

        if (!Number.isNaN(yearA)) return -1;
        if (!Number.isNaN(yearB)) return 1;
        return b.localeCompare(a);
      }),
    []
  );

  useEffect(() => {
    if (!open || !caseId) return;
    const year = wizardData?.asgariUcretYili || DEFAULT_YEAR;
    const gelir = wizardData?.kullaniciGeliri || "";
    setSelectedYear(year);
    setCustomIncome(gelir);
    // keep backend in sync
    void autoSave("asgari_ucret_yili", year);
    void autoSave("asgari_ucret_tutari", wageData[year] ?? wageData[DEFAULT_YEAR]);
    void autoSave("gelir", gelir);
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

  const handleYearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const year = event.target.value;
    setSelectedYear(year);
    void autoSave("asgari_ucret_yili", year);
    void autoSave("asgari_ucret_tutari", wageData[year]);
    updateWizardData({ asgariUcretYili: year, asgariUcretTutari: wageData[year] });
  };

  const handleIncomeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomIncome(value);
    void autoSave("gelir", value);
    updateWizardData({ kullaniciGeliri: value });
  };

  const handleNext = () => {
    onNext?.();
    setOpen(false);
  };

  const handleReset = () => {
    // Reset only Step 2 fields locally and autosave clears
    setSelectedYear(DEFAULT_YEAR);
    setCustomIncome("");
    // Best-effort autosave clears
    void autoSave("asgari_ucret_yili", DEFAULT_YEAR);
    void autoSave("asgari_ucret_tutari", wageData[DEFAULT_YEAR]);
    void autoSave("gelir", "");
    updateWizardData({ asgariUcretYili: DEFAULT_YEAR, asgariUcretTutari: wageData[DEFAULT_YEAR], kullaniciGeliri: "" });
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
        <h2 className="text-lg font-semibold text-gray-900">Net Gelir Bilgileri</h2>
        <p className="text-sm text-gray-500 mb-4">
          Asgari ücret yılına veya dönemine göre otomatik doldurulur.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Asgari Ücret Yılı / Dönemi
            </label>
            <select
              value={selectedYear}
              onChange={handleYearChange}
              className="w-full mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {sortedYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Asgari Ücret (₺)</label>
            <input
              type="text"
              value={minimumWage}
              disabled
              className="w-full mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Kullanıcı Geliri (₺)</label>
            <input
              type="text"
              placeholder="Örnek: 25.750,50"
              value={customIncome}
              onChange={handleIncomeChange}
              className="w-full mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex justify-between items-center mt-auto">
          <button
            onClick={() => onBack?.()}
            className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium"
          >
            ← Geri
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Formu Sıfırla
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              İleri →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

