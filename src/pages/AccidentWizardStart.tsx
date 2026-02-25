import { useCallback, useState } from "react";
import AccidentWizardModal from "@/components/AccidentWizardModal";
import IncomeStepModal from "@/components/IncomeStepModal";
import DisabilityAndFaultStepModal from "@/components/DisabilityAndFaultStepModal";
import CompensationStepModal from "@/components/CompensationStepModal";
import AdditionalPaymentsStepModal from "@/components/AdditionalPaymentsStepModal";
import ReportPreviewStep from "@/components/ReportPreviewStep";
import { API_BASE_URL } from "@/utils/apiClient";

type AccidentSubtype = "olumlu" | "yaralanmali";

export default function AccidentWizardStart() {
  const [caseId, setCaseId] = useState<number | null>(null);
  const [taraflar, setTaraflar] = useState<{ taraf: { ad: string; soyad: string }; karsilar: { ad: string; soyad: string; tur?: string }[] }>({
    taraf: { ad: "", soyad: "" },
    karsilar: [{ ad: "", soyad: "", tur: "Gerçek Kişi" }],
  });
  const [isAccidentModalOpen, setAccidentModalOpen] = useState(false);
  const [isIncomeModalOpen, setIncomeModalOpen] = useState(false);
  const [isStep3Open, setStep3Open] = useState(false);
  const [isStep4Open, setStep4Open] = useState(false);
  const [isStep5Open, setStep5Open] = useState(false);
  const [isStep6Open, setStep6Open] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [selectedSubtype, setSelectedSubtype] = useState<AccidentSubtype | "">("");

  const createCase = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "1",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error("Yeni vaka oluşturulamadı. " + text);
      }

      const data: { caseId?: number } = await response.json();
      if (!data.caseId) {
        throw new Error("Geçersiz vaka yanıtı alındı.");
      }

      setCaseId(data.caseId);
      return data.caseId;
    } catch (error) {
      console.error("Vaka oluşturma hatası:", error);
      alert("Vaka oluşturulamadı: " + error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setSelectedSubtype("");
    setAccidentModalOpen(false);
    setIncomeModalOpen(false);
    setCaseId(null);
  };

  const handleSubtypeSelect = async (subtype: AccidentSubtype) => {
    setSelectedSubtype(subtype);
    const id = await createCase();
    if (id) {
      setAccidentModalOpen(true);
      setIncomeModalOpen(false);
    }
  };

  const handleAccidentNext = () => {
    setAccidentModalOpen(false);
    setIncomeModalOpen(true);
  };

  const handleIncomeNext = () => {
    setIncomeModalOpen(false);
    setStep3Open(true);
  };

  const handleIncomeBack = () => {
    setIncomeModalOpen(false);
    setAccidentModalOpen(true);
  };

  const handleStep3Next = () => {
    setStep3Open(false);
    setStep4Open(true);
  };

  const handleStep3Back = () => {
    setStep3Open(false);
    setIncomeModalOpen(true);
  };

  const handleStep4Next = () => {
    setStep4Open(false);
    setStep5Open(true);
  };

  const handleStep4Back = () => {
    setStep4Open(false);
    setStep3Open(true);
  };

  const handleStep5Next = () => {
    setStep5Open(false);
    setStep6Open(true);
  };

  const handleStep5Back = () => {
    setStep5Open(false);
    setStep4Open(true);
  };

  const handleStep6Back = () => {
    setStep6Open(false);
    setStep5Open(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white flex items-center justify-center px-8 py-16">
      <div className="w-full max-w-6xl rounded-3xl bg-white shadow-[0_35px_120px_rgba(15,23,42,0.12)] px-20 py-16 border border-slate-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Aktüerya Hesaplamalar
          </h1>
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-px bg-slate-200" />
            <div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,0.15)]" />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-16">
          <div className="relative flex items-start justify-center gap-32 w-full">
            <span className="absolute top-16 left-[18%] right-[18%] h-1 rounded-full bg-slate-200" />
            <span className="absolute top-[3.9rem] left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_0_8px_rgba(59,130,246,0.12)]" />

            <div className="relative flex flex-col items-center gap-8 min-h-[280px]">
              <button
                type="button"
                onClick={() => handleTypeSelect("trafik")}
                className={`min-w-[220px] rounded-2xl border bg-white px-8 py-5 text-base font-semibold shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all hover:shadow-[0_18px_55px_rgba(59,130,246,0.18)] ${
                  selectedType === "trafik"
                    ? "border-blue-200 ring-4 ring-blue-100 text-blue-700"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                Trafik Kazası
              </button>

              {selectedType === "trafik" ? (
                <>
                  <div className="h-16 w-px bg-slate-200" />
                  <div className="relative flex items-start gap-16 pt-10">
                    <span className="absolute top-0 left-0 right-0 h-1 rounded-full bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleSubtypeSelect("olumlu")}
                      className={`relative min-w-[160px] rounded-xl border bg-white px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-lg ${
                        selectedSubtype === "olumlu"
                          ? "border-red-200 ring-4 ring-red-100 text-red-600"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-slate-200" />
                      Ölümlü
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubtypeSelect("yaralanmali")}
                      className={`relative min-w-[160px] rounded-xl border bg-white px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-lg ${
                        selectedSubtype === "yaralanmali"
                          ? "border-emerald-200 ring-4 ring-emerald-100 text-emerald-600"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-slate-200" />
                      Yaralanmalı
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-16 w-px bg-transparent" />
              )}
            </div>

            <div className="relative flex flex-col items-center gap-8 min-h-[280px]">
              <button
                type="button"
                onClick={() => handleTypeSelect("is")}
                className={`min-w-[220px] rounded-2xl border bg-white px-8 py-5 text-base font-semibold shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all hover:shadow-[0_18px_55px_rgba(245,158,11,0.18)] ${
                  selectedType === "is"
                    ? "border-amber-200 ring-4 ring-amber-100 text-amber-700"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                İş Kazası
              </button>

              {selectedType === "is" ? (
                <>
                  <div className="h-16 w-px bg-slate-200" />
                  <div className="relative flex items-start gap-16 pt-10">
                    <span className="absolute top-0 left-0 right-0 h-1 rounded-full bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleSubtypeSelect("olumlu")}
                      className={`relative min-w-[160px] rounded-xl border bg-white px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-lg ${
                        selectedSubtype === "olumlu"
                          ? "border-red-200 ring-4 ring-red-100 text-red-600"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-slate-200" />
                      Ölümlü
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubtypeSelect("yaralanmali")}
                      className={`relative min-w-[160px] rounded-xl border bg-white px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-lg ${
                        selectedSubtype === "yaralanmali"
                          ? "border-emerald-200 ring-4 ring-emerald-100 text-emerald-600"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-slate-200" />
                      Yaralanmalı
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-16 w-px bg-transparent" />
              )}
            </div>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-slate-500">İşleminiz hazırlanıyor...</p>
        )}
      </div>

      {caseId && isAccidentModalOpen && (
        <AccidentWizardModal
          open={isAccidentModalOpen}
          setOpen={setAccidentModalOpen}
          caseId={caseId}
          onNext={handleAccidentNext}
          onPartiesChange={(d) => setTaraflar(d)}
        />
      )}

      {caseId && isIncomeModalOpen && (
        <IncomeStepModal
          open={isIncomeModalOpen}
          setOpen={setIncomeModalOpen}
          caseId={caseId}
          onNext={handleIncomeNext}
          onBack={handleIncomeBack}
        />
      )}

      {caseId && isStep3Open && (
        <DisabilityAndFaultStepModal
          open={isStep3Open}
          setOpen={setStep3Open}
          caseId={caseId}
          taraflar={taraflar}
          onNext={handleStep3Next}
          onBack={handleStep3Back}
        />
      )}

      {caseId && isStep4Open && (
        <CompensationStepModal
          open={isStep4Open}
          setOpen={setStep4Open}
          caseId={caseId}
          onNext={handleStep4Next}
          onBack={handleStep4Back}
        />
      )}

      {caseId && isStep5Open && (
        <AdditionalPaymentsStepModal
          open={isStep5Open}
          setOpen={setStep5Open}
          caseId={caseId}
          onNext={handleStep5Next}
          onBack={handleStep5Back}
        />
      )}

      {caseId && isStep6Open && (
        <ReportPreviewStep
          open={isStep6Open}
          setOpen={setStep6Open}
          caseId={caseId}
          onBack={handleStep6Back}
        />
      )}
    </div>
  );
}
