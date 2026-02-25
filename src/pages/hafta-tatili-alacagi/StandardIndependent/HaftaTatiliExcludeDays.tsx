import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { differenceInCalendarDays } from "date-fns";
import { useToast } from "@/context/ToastContext";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";

// Hafta Tatili için dışlanabilir gün tipi
type HaftaTatiliExcludeType = "Yıllık İzin" | "Rapor" | "Diğer";

interface HaftaTatiliExcludeDay {
  id: string;
  type: HaftaTatiliExcludeType;
  start: string;
  end: string;
  days: number;
}

interface HaftaTatiliExcludeDaysProps {
  haftaTatiliExcludedDays: HaftaTatiliExcludeDay[];
  onHaftaTatiliExcludedDaysChange: (days: HaftaTatiliExcludeDay[]) => void;
}

// Tarih string'ini Date'e çevir
function toUTC(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function HaftaTatiliExcludeDays({
  haftaTatiliExcludedDays,
  onHaftaTatiliExcludedDaysChange,
}: HaftaTatiliExcludeDaysProps) {
  const { error, success } = useToast();
  
  // Yıllık izin için geçici state
  const [haftaTatiliYilStart, setHaftaTatiliYilStart] = useState("");
  const [haftaTatiliYilEnd, setHaftaTatiliYilEnd] = useState("");
  const [haftaTatiliYilDays, setHaftaTatiliYilDays] = useState("");

  // Rapor için geçici state
  const [haftaTatiliRapStart, setHaftaTatiliRapStart] = useState("");
  const [haftaTatiliRapEnd, setHaftaTatiliRapEnd] = useState("");
  const [haftaTatiliRapDays, setHaftaTatiliRapDays] = useState("");
  
  // Dışlama kaydetme/yükleme için state
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: HaftaTatiliExcludeDay[]; createdAt: string }[]>([]);

  // Yıllık izin gününü otomatik hesapla
  useEffect(() => {
    if (haftaTatiliYilStart && haftaTatiliYilEnd) {
      try {
        const s = toUTC(haftaTatiliYilStart);
        const e = toUTC(haftaTatiliYilEnd);
        if (s && e) {
          const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
          setHaftaTatiliYilDays(String(days));
        }
      } catch {}
    }
  }, [haftaTatiliYilStart, haftaTatiliYilEnd]);

  // Rapor gününü otomatik hesapla
  useEffect(() => {
    if (haftaTatiliRapStart && haftaTatiliRapEnd) {
      try {
        const s = toUTC(haftaTatiliRapStart);
        const e = toUTC(haftaTatiliRapEnd);
        if (s && e) {
          const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
          setHaftaTatiliRapDays(String(days));
        }
      } catch {}
    }
  }, [haftaTatiliRapStart, haftaTatiliRapEnd]);

  // Yıllık izin ekle
  const handleHaftaTatiliAddYil = () => {
    if (!haftaTatiliYilStart || !haftaTatiliYilEnd) return;
    const newExclude: HaftaTatiliExcludeDay = {
      id: Math.random().toString(36).slice(2),
      type: "Yıllık İzin",
      start: haftaTatiliYilStart,
      end: haftaTatiliYilEnd,
      days: Number(haftaTatiliYilDays) || 0,
    };
    onHaftaTatiliExcludedDaysChange([...haftaTatiliExcludedDays, newExclude]);
    setHaftaTatiliYilStart("");
    setHaftaTatiliYilEnd("");
    setHaftaTatiliYilDays("");
  };

  // Rapor ekle
  const handleHaftaTatiliAddRap = () => {
    if (!haftaTatiliRapStart || !haftaTatiliRapEnd) return;
    const newExclude: HaftaTatiliExcludeDay = {
      id: Math.random().toString(36).slice(2),
      type: "Rapor",
      start: haftaTatiliRapStart,
      end: haftaTatiliRapEnd,
      days: Number(haftaTatiliRapDays) || 0,
    };
    onHaftaTatiliExcludedDaysChange([...haftaTatiliExcludedDays, newExclude]);
    setHaftaTatiliRapStart("");
    setHaftaTatiliRapEnd("");
    setHaftaTatiliRapDays("");
  };

  // Dışlanabilir gün sil
  const handleHaftaTatiliRemoveExclude = (id: string) => {
    onHaftaTatiliExcludedDaysChange(haftaTatiliExcludedDays.filter((ex) => ex.id !== id));
  };

  // Dışlanabilir gün güncelle
  const handleHaftaTatiliUpdateExclude = (id: string, field: keyof HaftaTatiliExcludeDay, value: string | number) => {
    onHaftaTatiliExcludedDaysChange(
      haftaTatiliExcludedDays.map((ex) =>
        ex.id === id ? { ...ex, [field]: value } : ex
      )
    );
  };

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Dışlanabilir Günler</CardTitle>
            <CardDescription>Yıllık izin ve rapor günlerini dışlayın</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setExclusionSaveName("");
                setShowExclusionSaveModal(true);
              }}
              disabled={haftaTatiliExcludedDays.length === 0}
              className="inline-flex items-center gap-1 font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              Kaydet
              <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Girdiğiniz dışlama günlerini bir isim vererek kaydedin. Başka hesaplamalarda tekrar kullanabilirsiniz.">ⓘ</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const sets = await getAllExclusionSets();
                setSavedExclusionSets(sets);
                setShowExclusionLoadModal(true);
              }}
              className="inline-flex items-center gap-1 font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              İçe Aktar
              <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Daha önce kaydettiğiniz dışlama günlerini yükleyin. Aynı davacı için farklı hesaplamalarda zaman kazandırır.">ⓘ</span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onHaftaTatiliExcludedDaysChange([]);
                setHaftaTatiliYilStart("");
                setHaftaTatiliYilEnd("");
                setHaftaTatiliYilDays("");
                setHaftaTatiliRapStart("");
                setHaftaTatiliRapEnd("");
                setHaftaTatiliRapDays("");
              }}
              disabled={haftaTatiliExcludedDays.length === 0}
              className="inline-flex items-center gap-1 font-semibold rounded-full border border-red-300 dark:border-red-600"
            >
              Tümünü Sil
              <span className="text-white hover:text-gray-100 cursor-help" title="Tüm dışlama kayıtlarını tek seferde silin.">ⓘ</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Yıllık İzin */}
        <div>
          <Label className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-2 block">
            Yıllık izin / Çalışılmayan raporlu günler dışlanabilir.
          </Label>
          <div className="grid grid-cols-12 gap-2 items-end">
            <Input
              type="date"
              className="col-span-4 h-[34px] min-h-[34px] max-h-[34px] rounded-md border border-gray-200 dark:border-gray-600 px-3 text-sm dark:bg-gray-700 dark:text-gray-100"
              placeholder="Başlangıç"
              value={haftaTatiliYilStart}
              onChange={(e) => setHaftaTatiliYilStart(e.target.value)}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && haftaTatiliYilEnd && /^\d{4}-\d{2}-\d{2}$/.test(haftaTatiliYilEnd)) {
                  const newDate = new Date(newValue);
                  const endDate = new Date(haftaTatiliYilEnd);
                  if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                    error("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                  }
                }
              }}
              max="9999-12-31"
            />
            <Input
              type="date"
              className="col-span-4 h-[34px] min-h-[34px] max-h-[34px] rounded-md border border-gray-200 dark:border-gray-600 px-3 text-sm dark:bg-gray-700 dark:text-gray-100"
              placeholder="Bitiş"
              value={haftaTatiliYilEnd}
              onChange={(e) => setHaftaTatiliYilEnd(e.target.value)}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && haftaTatiliYilStart && /^\d{4}-\d{2}-\d{2}$/.test(haftaTatiliYilStart)) {
                  const newDate = new Date(newValue);
                  const startDate = new Date(haftaTatiliYilStart);
                  if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                    error("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                  }
                }
              }}
              max="9999-12-31"
            />
            <Input
              className="col-span-3 h-[34px] min-h-[34px] max-h-[34px] rounded-md border border-gray-200 dark:border-gray-600 px-3 text-sm dark:bg-gray-700 dark:text-gray-100"
              placeholder="Gün"
              value={haftaTatiliYilDays}
              onChange={(e) => setHaftaTatiliYilDays(e.target.value)}
            />
            <Button
              className="col-span-1 text-xs border rounded-md px-2 h-[34px]"
              variant="outline"
              onClick={handleHaftaTatiliAddYil}
            >
              + Ekle
            </Button>
          </div>
        </div>

        {/* Dışlanabilir günler listesi */}
        {haftaTatiliExcludedDays.length > 0 && (
          <div className="mt-4">
            <div className="grid grid-cols-12 text-xs text-gray-600 dark:text-gray-400 font-medium px-2 mb-2">
              <div className="col-span-3">Tür</div>
              <div className="col-span-3">Başlangıç</div>
              <div className="col-span-3">Bitiş</div>
              <div className="col-span-2">Gün</div>
              <div className="col-span-1"></div>
            </div>
            {haftaTatiliExcludedDays.map((ex) => (
              <div key={ex.id} className="grid grid-cols-12 gap-2 items-center mt-2">
                <select
                  value={ex.type}
                  onChange={(e) =>
                    handleHaftaTatiliUpdateExclude(ex.id, "type", e.target.value as HaftaTatiliExcludeType)
                  }
                  className="col-span-3 h-[32px] min-h-[32px] max-h-[32px] rounded-md border border-gray-200 dark:border-gray-600 px-2 text-sm dark:bg-gray-700 dark:text-gray-100"
                >
                  <option>Yıllık İzin</option>
                  <option>Rapor</option>
                  <option>Diğer</option>
                </select>
                <Input
                  type="date"
                  value={ex.start}
                  onChange={(e) => handleHaftaTatiliUpdateExclude(ex.id, "start", e.target.value)}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && ex.end && /^\d{4}-\d{2}-\d{2}$/.test(ex.end)) {
                      const newDate = new Date(newValue);
                      const endDate = new Date(ex.end);
                      if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                        error("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                      }
                    }
                  }}
                  className="col-span-3 h-[32px] min-h-[32px] max-h-[32px] rounded-md border border-gray-200 dark:border-gray-600 px-2 text-sm dark:bg-gray-700 dark:text-gray-100"
                  max="9999-12-31"
                />
                <Input
                  type="date"
                  value={ex.end}
                  onChange={(e) => handleHaftaTatiliUpdateExclude(ex.id, "end", e.target.value)}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && ex.start && /^\d{4}-\d{2}-\d{2}$/.test(ex.start)) {
                      const newDate = new Date(newValue);
                      const startDate = new Date(ex.start);
                      if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                        error("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                      }
                    }
                  }}
                  className="col-span-3 h-[32px] min-h-[32px] max-h-[32px] rounded-md border border-gray-200 dark:border-gray-600 px-2 text-sm dark:bg-gray-700 dark:text-gray-100"
                  max="9999-12-31"
                />
                <Input
                  value={String(ex.days)}
                  onChange={(e) =>
                    handleHaftaTatiliUpdateExclude(ex.id, "days", Number(e.target.value) || 0)
                  }
                  className="col-span-2 h-[32px] min-h-[32px] max-h-[32px] rounded-md border border-gray-200 dark:border-gray-600 px-2 text-sm dark:bg-gray-700 dark:text-gray-100"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHaftaTatiliRemoveExclude(ex.id)}
                  className="col-span-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 h-[32px]"
                >
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Dışlama Kaydetme Modal */}
      {showExclusionSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionSaveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Dışlanabilir Günleri Kaydet</h3>
            <div className="mb-4">
              <Label htmlFor="exclusion-name" className="text-sm font-medium dark:text-gray-200">Kayıt Adı</Label>
              <Input
                id="exclusion-name"
                type="text"
                placeholder="Örn: Davacı A - Yıllık İzinler"
                value={exclusionSaveName}
                onChange={(e) => setExclusionSaveName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExclusionSaveModal(false)}>
                İptal
              </Button>
              <Button
                onClick={async () => {
                  if (!exclusionSaveName.trim()) {
                    error("Lütfen bir isim girin.");
                    return;
                  }
                  const saved = await saveExclusionSet(exclusionSaveName.trim(), haftaTatiliExcludedDays);
                  if (saved) {
                    success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`);
                    setShowExclusionSaveModal(false);
                  } else {
                    error("Kaydetme başarısız oldu.");
                  }
                }}
                disabled={!exclusionSaveName.trim()}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Dışlama Yükleme Modal */}
      {showExclusionLoadModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionLoadModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Kayıtlı Dışlanabilir Günler</h3>
            {savedExclusionSets.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {savedExclusionSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                    <div>
                      <div className="font-medium text-sm dark:text-white">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{set.data.length} gün</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (set.data && set.data.length > 0) {
                            // İçe aktarırken gün sayılarını tarih aralığından yeniden hesapla ve type field'ını normalize et
                            const normalizedData = set.data.map((item: any) => {
                              if (item.start && item.end) {
                                const start = toUTC(item.start);
                                const end = toUTC(item.end);
                                if (start && end) {
                                  // Gün sayısını tarih aralığından hesapla (hafta değil, gün)
                                  const calculatedDays = Math.max(0, differenceInCalendarDays(end, start) + 1);
                                  return {
                                    id: item.id || Math.random().toString(36).slice(2),
                                    type: (item.type && String(item.type).trim()) || "Diğer",
                                    start: item.start,
                                    end: item.end,
                                    days: calculatedDays,
                                  };
                                }
                              }
                              return {
                                id: item.id || Math.random().toString(36).slice(2),
                                type: (item.type && String(item.type).trim()) || "Diğer",
                                start: item.start || "",
                                end: item.end || "",
                                days: item.days || 0,
                              };
                            });
                            onHaftaTatiliExcludedDaysChange(normalizedData);
                            success(`"${set.name}" içe aktarıldı!`);
                            setShowExclusionLoadModal(false);
                          }
                        }}
                      >
                        Yükle
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (confirm(`"${set.name}" silinsin mi?`)) {
                            await deleteExclusionSet(set.id);
                            const newSets = await getAllExclusionSets();
                            setSavedExclusionSets(newSets);
                            success("Silindi!");
                          }
                        }}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowExclusionLoadModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Card>
  );
}
