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
  taraflar?: { taraf: { ad: string; soyad: string }; karsilar: { ad: string; soyad: string; tur?: string }[] };
};

export default function DisabilityAndFaultStepModal({ open, setOpen, caseId, onNext, onBack, taraflar }: Props) {
  const [donemler, setDonemler] = useState<{ baslangic: string; bitis: string; gun: number }[]>([
    { baslangic: "", bitis: "", gun: 0 },
  ]);
  const [maluliyet, setMaluliyet] = useState<string>("");
  const [kusurDavaci, setKusurDavaci] = useState<string>("");
  const [kusurKarsiList, setKusurKarsiList] = useState<string[]>([""]);
  const [geciciDonem, setGeciciDonem] = useState<{ baslangic: string; bitis: string; gun: number }>({ baslangic: "", bitis: "", gun: 0 });
  const { wizardData, updateWizardData } = useAccidentWizard();

  useEffect(() => {
    if (!open || !caseId) return;
    // Prefill from context
    const wd = wizardData || {} as any;
    setDonemler(wd.raporDonemleri && wd.raporDonemleri.length ? wd.raporDonemleri : [{ baslangic: "", bitis: "", gun: 0 }]);
    setMaluliyet(wd.maluliyetOrani || "");
    // kusur oranları: taraf ve karşılar
    const tarafEntry = (wd.kusurOranlari || []).find((x: any) => x.taraf === "taraf");
    setKusurDavaci(tarafEntry?.oran || "");
    const karsiList: string[] = [];
    const klen = taraflar?.karsilar?.length ?? 0;
    for (let i = 0; i < klen; i++) {
      const found = (wd.kusurOranlari || []).find((x: any) => x.taraf === `karsi-${i}`);
      karsiList.push(found?.oran || "");
    }
    setKusurKarsiList(klen ? karsiList : [""]);
    // Prefill temporary disability period
    if (wd.geciciIsGoremezlikDonemi) {
      setGeciciDonem(wd.geciciIsGoremezlikDonemi);
    } else {
      setGeciciDonem({ baslangic: "", bitis: "", gun: 0 });
    }
  }, [open, caseId]);

  // Sync karşı taraf kusur list length with provided karşı taraflar
  useEffect(() => {
    if (!taraflar) return;
    const len = taraflar.karsilar?.length ?? 0;
    if (len <= 0) return;
    setKusurKarsiList((prev) => {
      const next = [...prev];
      if (next.length < len) {
        while (next.length < len) next.push("");
      } else if (next.length > len) {
        next.length = len;
      }
      return next;
    });
  }, [taraflar?.karsilar?.length]);

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
    if (field === "maluliyet_orani") updateWizardData({ maluliyetOrani: v });
  };

  // Rapor dönemleri: değişim, ekleme, silme ve autosave (JSON + toplam gün)
  const recalcAndSaveDonemler = (updated: { baslangic: string; bitis: string; gun: number }[]) => {
    // toplam gün
    const total = updated.reduce((acc, d) => acc + (Number(d.gun) || 0), 0);
    setDonemler(updated);
    void autoSave("rapor_donemleri", JSON.stringify(updated));
    void autoSave("raporlu_gun", String(total || ""));
    updateWizardData({ raporDonemleri: updated, raporluGun: String(total || "") });
  };

  // Geçici İş Görememezlik: tek dönem hesapla ve kaydet
  const handleGeciciChange = (field: "baslangic" | "bitis", value: string) => {
    const next = { ...geciciDonem, [field]: value } as { baslangic: string; bitis: string; gun: number };
    // gün hesabı
    const b = new Date(next.baslangic);
    const e = new Date(next.bitis);
    if (!Number.isNaN(Number(b)) && !Number.isNaN(Number(e)) && next.baslangic && next.bitis) {
      const diff = Math.ceil(Math.abs(Number(e) - Number(b)) / (1000 * 60 * 60 * 24)) + 1;
      next.gun = diff;
    } else {
      next.gun = 0;
    }
    setGeciciDonem(next);
    void autoSave("gecici_is_goremezlik_donemi", JSON.stringify(next));
    void autoSave("gecici_is_goremezlik_gun", String(next.gun || ""));
    updateWizardData({ geciciIsGoremezlikDonemi: next, geciciIsGoremezlikGun: String(next.gun || "") });
  };

  const handleDonemChange = (index: number, field: "baslangic" | "bitis", value: string) => {
    const updated = [...donemler];
    updated[index][field] = value;
    // gün hesabı
    const b = new Date(updated[index].baslangic);
    const e = new Date(updated[index].bitis);
    if (!Number.isNaN(Number(b)) && !Number.isNaN(Number(e)) && updated[index].baslangic && updated[index].bitis) {
      const diff = Math.ceil(Math.abs(Number(e) - Number(b)) / (1000 * 60 * 60 * 24)) + 1;
      updated[index].gun = diff;
    } else {
      updated[index].gun = 0;
    }
    recalcAndSaveDonemler(updated);
  };

  const handleAddDonem = () => {
    const updated = [...donemler, { baslangic: "", bitis: "", gun: 0 }];
    recalcAndSaveDonemler(updated);
  };

  const handleRemoveDonem = (index: number) => {
    const updated = donemler.filter((_, i) => i !== index);
    recalcAndSaveDonemler(updated.length ? updated : [{ baslangic: "", bitis: "", gun: 0 }]);
  };

  const saveKarsiList = (list: string[]) => {
    setKusurKarsiList(list);
    void autoSave("kusur_orani_karsi_list", JSON.stringify(list));
    // Geriye dönük uyumluluk için ilk öğeyi tekil alana da yaz
    const first = list[0] ?? "";
    void autoSave("kusur_orani_karsi", first);
    // Update context kusurOranlari merged
    const existing = (wizardData?.kusurOranlari || []).filter((x: any) => x.taraf !== "taraf" && !String(x.taraf || "").startsWith("karsi-"));
    const merged = [
      ...(wizardData?.kusurOranlari || []).filter((x: any) => !String(x.taraf || "").startsWith("karsi-")),
    ].filter((x: any) => x.taraf !== "taraf");
    const tarafEntry = { taraf: "taraf", oran: kusurDavaci || "" };
    const karsilarEntries = list.map((oran, i) => ({ taraf: `karsi-${i}`, oran: oran || "" }));
    updateWizardData({ kusurOranlari: [tarafEntry, ...karsilarEntries, ...existing] });
  };

  const handleReset = () => {
    // Clear local states
    const clearedDonemler = [{ baslangic: "", bitis: "", gun: 0 }];
    setDonemler(clearedDonemler);
    setMaluliyet("");
    setKusurDavaci("");
    const clearedKarsi = (taraflar?.karsilar?.length ?? 0) > 0 ? new Array(taraflar!.karsilar.length).fill("") : [""];
    setKusurKarsiList(clearedKarsi as string[]);

    // Update Context only for step 3 fields
    const karsilarEntries = (taraflar?.karsilar || []).map((_, i) => ({ taraf: `karsi-${i}`, oran: "" }));
    updateWizardData({
      maluliyetOrani: "",
      raporDonemleri: clearedDonemler,
      raporluGun: "",
      kusurOranlari: [{ taraf: "taraf", oran: "" }, ...karsilarEntries],
      geciciIsGoremezlikDonemi: { baslangic: "", bitis: "", gun: 0 },
      geciciIsGoremezlikGun: "",
    });

    // Best-effort autosave clears
    void autoSave("rapor_donemleri", JSON.stringify(clearedDonemler));
    void autoSave("raporlu_gun", "");
    void autoSave("maluliyet_orani", "");
    void autoSave("kusur_orani_davaci", "");
    void autoSave("kusur_orani_karsi_list", JSON.stringify(clearedKarsi));
    void autoSave("kusur_orani_karsi", "");
    void autoSave("gecici_is_goremezlik_donemi", JSON.stringify({ baslangic: "", bitis: "", gun: 0 }));
    void autoSave("gecici_is_goremezlik_gun", "");
  };

  const handleKarsiListChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const next = kusurKarsiList.map((item, i) => (i === index ? v : item));
    saveKarsiList(next);
  };

  const handleAddKarsi = () => {
    const next = [...kusurKarsiList, ""];
    saveKarsiList(next);
  };

  const handleRemoveKarsi = (index: number) => {
    const next = kusurKarsiList.filter((_, i) => i !== index);
    saveKarsiList(next.length ? next : [""]);
  };

  const handleNext = () => {
    onNext?.();
    setOpen(false);
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
        <h2 className="text-lg font-semibold text-gray-900">Raporlu Gün, Maluliyet ve Kusur</h2>

        <div className="space-y-2">
          <label className="block text-gray-700 text-sm font-medium">Rapor Dönemleri</label>
          {donemler.map((d, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 items-end border-b border-gray-100 pb-2">
              <div>
                <input
                  type="date"
                  value={d.baslangic}
                  onChange={(e) => handleDonemChange(i, "baslangic", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={d.bitis}
                  onChange={(e) => handleDonemChange(i, "bitis", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  readOnly
                  value={d.gun}
                  className="w-full border border-gray-300 rounded-lg p-2 bg-gray-100 text-gray-600"
                />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDonem(i)}
                    className="text-gray-400 hover:text-red-500"
                    title="Sil"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={handleAddDonem} type="button" className="text-blue-600 text-sm mt-1 hover:underline">+ Ekle</button>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Maluliyet Oranı (%)</label>
            <input
              type="number"
              value={maluliyet}
              onChange={onChange(setMaluliyet, "maluliyet_orani")}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Örn: 25"
            />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Taraf Kusur Oranları</h3>
              <div className="space-y-3">
                {taraflar && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{`${taraflar.taraf?.ad || ""} ${taraflar.taraf?.soyad || ""}`.trim()}</span>
                    <input
                      type="number"
                      className="w-20 text-right border border-gray-300 rounded-lg p-1 focus:ring-2 focus:ring-blue-500"
                      placeholder="%"
                      value={kusurDavaci}
                      onChange={(e) => {
                        const v = e.target.value;
                        setKusurDavaci(v);
                        void autoSave("kusur_orani_davaci", v);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Karşı Taraf Kusur Oranları</h3>
              <div className="space-y-3">
                {(taraflar?.karsilar || []).map((k, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-700">{`${k.ad || ""} ${k.soyad || ""}`.trim()}</span>
                    <input
                      type="number"
                      className="w-20 text-right border border-gray-300 rounded-lg p-1 focus:ring-2 focus:ring-blue-500"
                      placeholder="%"
                      value={kusurKarsiList[i] || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = kusurKarsiList.map((x, idx) => (idx === i ? v : x));
                        saveKarsiList(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">ATK vb. Geçici İş Görememezlik Dönemi</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="date"
              value={geciciDonem.baslangic}
              onChange={(e) => handleGeciciChange("baslangic", e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={geciciDonem.bitis}
              onChange={(e) => handleGeciciChange("bitis", e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={geciciDonem.gun || 0}
              readOnly
              className="w-full border border-gray-200 bg-gray-50 rounded-lg p-2 text-gray-600"
            />
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
