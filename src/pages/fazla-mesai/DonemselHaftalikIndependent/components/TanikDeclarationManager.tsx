/**
 * TanikDeclarationManager.tsx
 * Tanıklar için çoklu dönem beyan yönetimi
 * 
 * ⚠️ KESİN KURAL:
 * - Tanık = hesap kaynağı DEĞİL
 * - Tanık = dağılım / ispat katmanı
 * - SADECE beyan verisi toplanır
 * - HESAP YOK (FM, 270, zamanaşımı YOK)
 */

import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, User } from "lucide-react";
import type { Declaration, Period, WeeklyPattern, PatternDay } from "../declarationModel";

interface TanikDeclarationManagerProps {
  /** Tanık beyanları (declarations array'inden TANIK olanlar) */
  declarations: Declaration[];
  
  /** Beyanlar güncellendiğinde çağrılır */
  onUpdate: (declarations: Declaration[]) => void;
  
  /** Read-only mod (görüntüleme/print) */
  isReadOnly?: boolean;
  
  /** Hesaplama senaryosu - DONEMSEL = SINGLE only, DONEMSEL_HAFTALIK_KARMA = MIXED allowed */
  scenario?: "DONEMSEL" | "DONEMSEL_HAFTALIK_KARMA";
}

export default function TanikDeclarationManager({
  declarations,
  onUpdate,
  isReadOnly = false,
  scenario = "DONEMSEL_HAFTALIK_KARMA"
}: TanikDeclarationManagerProps) {
  const [expandedWitnesses, setExpandedWitnesses] = useState<Set<string>>(new Set());
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  
  // DONEMSEL senaryosunda MIXED pattern'e izin verme
  const allowMixedPattern = scenario === "DONEMSEL_HAFTALIK_KARMA";

  // Yeni tanık ekle
  const handleAddWitness = () => {
    const newWitness: Declaration = {
      sourceType: "TANIK",
      sourceName: `Tanık ${declarations.length + 1}`,
      periods: []
    };

    onUpdate([...declarations, newWitness]);
  };

  // Tanık sil
  const handleRemoveWitness = (witnessIndex: number) => {
    const updated = declarations.filter((_, idx) => idx !== witnessIndex);
    onUpdate(updated);
  };

  // Tanık adını güncelle
  const handleUpdateWitnessName = (witnessIndex: number, name: string) => {
    const updated = declarations.map((w, idx) =>
      idx === witnessIndex ? { ...w, sourceName: name } : w
    );
    onUpdate(updated);
  };

  // Tanığa dönem ekle
  const handleAddPeriod = (witnessIndex: number) => {
    const newPeriod: Period = {
      id: `period-${Date.now()}`,
      startDate: "",
      endDate: "",
      label: "Yaz",
      weeklyPattern: {
        patternType: "SINGLE",
        days: [
          { dayCount: 6, startTime: "09:00", endTime: "18:00" }
        ]
      }
    };

    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? { ...w, periods: [...w.periods, newPeriod] }
        : w
    );
    onUpdate(updated);
  };

  // Dönem sil
  const handleRemovePeriod = (witnessIndex: number, periodId: string) => {
    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? { ...w, periods: w.periods.filter(p => p.id !== periodId) }
        : w
    );
    onUpdate(updated);
  };

  // Dönem güncelle
  const handleUpdatePeriod = (witnessIndex: number, periodId: string, updates: Partial<Period>) => {
    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? {
            ...w,
            periods: w.periods.map(p =>
              p.id === periodId ? { ...p, ...updates } : p
            )
          }
        : w
    );
    onUpdate(updated);
  };

  // PatternDay ekle
  const handleAddPatternDay = (witnessIndex: number, periodId: string) => {
    const newDay: PatternDay = {
      dayCount: 1,
      startTime: "09:00",
      endTime: "18:00"
    };

    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? {
            ...w,
            periods: w.periods.map(p =>
              p.id === periodId
                ? {
                    ...p,
                    weeklyPattern: {
                      ...p.weeklyPattern,
                      days: [...p.weeklyPattern.days, newDay]
                    }
                  }
                : p
            )
          }
        : w
    );
    onUpdate(updated);
  };

  // PatternDay sil
  const handleRemovePatternDay = (witnessIndex: number, periodId: string, dayIndex: number) => {
    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? {
            ...w,
            periods: w.periods.map(p =>
              p.id === periodId
                ? {
                    ...p,
                    weeklyPattern: {
                      ...p.weeklyPattern,
                      days: p.weeklyPattern.days.filter((_, dIdx) => dIdx !== dayIndex)
                    }
                  }
                : p
            )
          }
        : w
    );
    onUpdate(updated);
  };

  // PatternDay güncelle
  const handleUpdatePatternDay = (
    witnessIndex: number,
    periodId: string,
    dayIndex: number,
    updates: Partial<PatternDay>
  ) => {
    const updated = declarations.map((w, idx) =>
      idx === witnessIndex
        ? {
            ...w,
            periods: w.periods.map(p =>
              p.id === periodId
                ? {
                    ...p,
                    weeklyPattern: {
                      ...p.weeklyPattern,
                      days: p.weeklyPattern.days.map((day, dIdx) =>
                        dIdx === dayIndex ? { ...day, ...updates } : day
                      )
                    }
                  }
                : p
            )
          }
        : w
    );
    onUpdate(updated);
  };

  // Tanık açık/kapalı toggle
  const toggleWitness = (witnessIndex: number) => {
    setExpandedWitnesses(prev => {
      const next = new Set(prev);
      const key = `witness-${witnessIndex}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Dönem açık/kapalı toggle
  const togglePeriod = (periodId: string) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Tanık Beyanları - Dönemler</h3>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddWitness}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tanık Ekle
          </button>
        )}
      </div>

      {/* Tanık listesi */}
      {declarations.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-200">
          Henüz tanık eklenmedi. "Tanık Ekle" butonuna tıklayarak başlayın.
        </div>
      ) : (
        <div className="space-y-4">
          {declarations.map((witness, witnessIndex) => {
            const isWitnessExpanded = expandedWitnesses.has(`witness-${witnessIndex}`);
            
            return (
              <div key={witnessIndex} className="border-2 border-green-200 rounded-lg overflow-hidden bg-green-50/30">
                {/* Tanık başlığı */}
                <div className="flex items-center justify-between p-3 bg-green-100 border-b border-green-200">
                  <div className="flex items-center gap-3 flex-1">
                    <User className="w-4 h-4 text-green-700" />
                    <input
                      type="text"
                      value={witness.sourceName || ""}
                      onChange={(e) => handleUpdateWitnessName(witnessIndex, e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Tanık adı..."
                      className="flex-1 px-2 py-1 text-sm font-medium text-gray-800 bg-white border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => toggleWitness(witnessIndex)}
                      className="p-1 text-green-700 hover:bg-green-200 rounded transition-colors"
                    >
                      {isWitnessExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWitness(witnessIndex)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                      title="Tanığı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tanık detayları */}
                {isWitnessExpanded && (
                  <div className="p-4 bg-white space-y-3">
                    {/* Dönem ekle butonu */}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleAddPeriod(witnessIndex)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Dönem Ekle
                      </button>
                    )}

                    {/* Dönem listesi */}
                    {witness.periods.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-200">
                        Bu tanık için henüz dönem eklenmedi.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {witness.periods.map((period, periodIndex) => {
                          const isPeriodExpanded = expandedPeriods.has(period.id);
                          
                          return (
                            <div key={period.id} className="border border-gray-300 rounded-lg overflow-hidden">
                              {/* Dönem başlığı */}
                              <div
                                className="flex items-center justify-between p-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => togglePeriod(period.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <button type="button" className="text-gray-600">
                                    {isPeriodExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <span className="text-xs font-medium text-gray-700">
                                    Dönem {periodIndex + 1}: {period.label}
                                  </span>
                                  {period.startDate && period.endDate && (
                                    <span className="text-xs text-gray-500">
                                      ({period.startDate} - {period.endDate})
                                    </span>
                                  )}
                                </div>
                                
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemovePeriod(witnessIndex, period.id);
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Dönemi Sil"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Dönem detayları */}
                              {isPeriodExpanded && (
                                <div className="p-3 space-y-3 bg-white">
                                  {/* Tarih, dönem tipi ve etiket */}
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Başlangıç Tarihi
                                      </label>
                                      <input
                                        type="date"
                                        value={period.startDate}
                                        onChange={(e) => handleUpdatePeriod(witnessIndex, period.id, { startDate: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Bitiş Tarihi
                                      </label>
                                      <input
                                        type="date"
                                        value={period.endDate}
                                        onChange={(e) => handleUpdatePeriod(witnessIndex, period.id, { endDate: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Dönem Tipi
                                      </label>
                                      <select
                                        value={period.periodType || "YAZ"}
                                        onChange={(e) => handleUpdatePeriod(witnessIndex, period.id, { periodType: e.target.value as "YAZ" | "KIŞ" | "SERBEST" })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                                      >
                                        <option value="YAZ">Yaz</option>
                                        <option value="KIŞ">Kış</option>
                                        <option value="SERBEST">Serbest</option>
                                      </select>
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Dönem Etiketi (Opsiyonel)
                                      </label>
                                      <input
                                        type="text"
                                        value={period.label}
                                        onChange={(e) => handleUpdatePeriod(witnessIndex, period.id, { label: e.target.value })}
                                        disabled={isReadOnly}
                                        placeholder="Örn: Ocak 2020, İlkbahar vb."
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                                      />
                                    </div>
                                  </div>

                                  {/* Haftalık desen tipi */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                      Haftalık Çalışma Deseni
                                    </label>
                                    {!allowMixedPattern ? (
                                      <div className="text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded px-3 py-2">
                                        Tek Tip (DONEMSEL senaryosunda sadece tek tip saat kullanılır)
                                      </div>
                                    ) : (
                                      <div className="flex gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            checked={period.weeklyPattern.patternType === "SINGLE"}
                                            onChange={() => {
                                              if (isReadOnly) return;
                                              handleUpdatePeriod(witnessIndex, period.id, {
                                                weeklyPattern: {
                                                  patternType: "SINGLE",
                                                  days: [{ dayCount: 6, startTime: "09:00", endTime: "18:00" }]
                                                }
                                              });
                                            }}
                                            disabled={isReadOnly}
                                            className="w-4 h-4 text-green-600"
                                          />
                                          <span className="text-xs text-gray-700">Tek Tip</span>
                                        </label>
                                        
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            checked={period.weeklyPattern.patternType === "MIXED"}
                                            onChange={() => {
                                              if (isReadOnly) return;
                                              handleUpdatePeriod(witnessIndex, period.id, {
                                                weeklyPattern: {
                                                  patternType: "MIXED",
                                                  days: [
                                                    { dayCount: 5, startTime: "09:00", endTime: "18:00" },
                                                    { dayCount: 1, startTime: "09:00", endTime: "13:00" }
                                                  ]
                                                }
                                              });
                                            }}
                                            disabled={isReadOnly}
                                            className="w-4 h-4 text-green-600"
                                          />
                                          <span className="text-xs text-gray-700">Haftalık Karma</span>
                                        </label>
                                      </div>
                                    )}
                                  </div>

                                  {/* PatternDay listesi */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-medium text-gray-700">
                                        Gün Grupları
                                      </label>
                                      {!isReadOnly && period.weeklyPattern.patternType === "MIXED" && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddPatternDay(witnessIndex, period.id)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Gün Grubu Ekle
                                        </button>
                                      )}
                                    </div>

                                    {period.weeklyPattern.days.map((day, dayIndex) => (
                                      <div key={dayIndex} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <div className="flex-1 grid grid-cols-3 gap-2">
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-0.5">Gün Sayısı</label>
                                            <input
                                              type="number"
                                              min="1"
                                              max="7"
                                              value={day.dayCount}
                                              onChange={(e) => handleUpdatePatternDay(witnessIndex, period.id, dayIndex, {
                                                dayCount: parseInt(e.target.value) || 1
                                              })}
                                              disabled={isReadOnly}
                                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                                            />
                                          </div>
                                          
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-0.5">Giriş Saati</label>
                                            <input
                                              type="time"
                                              value={day.startTime}
                                              onChange={(e) => handleUpdatePatternDay(witnessIndex, period.id, dayIndex, {
                                                startTime: e.target.value
                                              })}
                                              disabled={isReadOnly}
                                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                                            />
                                          </div>
                                          
                                          <div>
                                            <label className="block text-xs text-gray-600 mb-0.5">Çıkış Saati</label>
                                            <input
                                              type="time"
                                              value={day.endTime}
                                              onChange={(e) => handleUpdatePatternDay(witnessIndex, period.id, dayIndex, {
                                                endTime: e.target.value
                                              })}
                                              disabled={isReadOnly}
                                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                                            />
                                          </div>
                                        </div>
                                        
                                        {!isReadOnly && period.weeklyPattern.patternType === "MIXED" && period.weeklyPattern.days.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePatternDay(witnessIndex, period.id, dayIndex)}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Gün Grubunu Sil"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
