/**
 * DavaciDeclarationManager.tsx
 * Davacı için çoklu dönem beyan yönetimi
 * 
 * ⚠️ KESİN KURAL:
 * - SADECE UI + state
 * - HESAP YOK (FM, 270, zamanaşımı YOK)
 * - Tablo DEĞİŞMEYECEK
 */

import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Declaration, Period, WeeklyPattern, PatternDay } from "../declarationModel";

interface DavaciDeclarationManagerProps {
  /** Davacı beyanı (declarations array'inden DAVACI olanı) */
  declaration: Declaration | null;
  
  /** Beyan güncellendiğinde çağrılır */
  onUpdate: (declaration: Declaration) => void;
  
  /** Read-only mod (görüntüleme/print) */
  isReadOnly?: boolean;
  
  /** Hesaplama senaryosu - DONEMSEL = SINGLE only, DONEMSEL_HAFTALIK_KARMA = MIXED allowed */
  scenario?: "DONEMSEL" | "DONEMSEL_HAFTALIK_KARMA";
}

export default function DavaciDeclarationManager({
  declaration,
  onUpdate,
  isReadOnly = false,
  scenario = "DONEMSEL_HAFTALIK_KARMA"
}: DavaciDeclarationManagerProps) {
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  
  // DONEMSEL senaryosunda MIXED pattern'e izin verme
  const allowMixedPattern = scenario === "DONEMSEL_HAFTALIK_KARMA";

  // Yeni dönem ekle
  const handleAddPeriod = () => {
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

    const updatedDeclaration: Declaration = declaration
      ? { ...declaration, periods: [...declaration.periods, newPeriod] }
      : {
          sourceType: "DAVACI",
          sourceName: null,
          periods: [newPeriod]
        };

    onUpdate(updatedDeclaration);
  };

  // Dönem sil
  const handleRemovePeriod = (periodId: string) => {
    if (!declaration) return;
    
    const updatedPeriods = declaration.periods.filter(p => p.id !== periodId);
    onUpdate({ ...declaration, periods: updatedPeriods });
  };

  // Dönem güncelle
  const handleUpdatePeriod = (periodId: string, updates: Partial<Period>) => {
    if (!declaration) return;
    
    const updatedPeriods = declaration.periods.map(p =>
      p.id === periodId ? { ...p, ...updates } : p
    );
    onUpdate({ ...declaration, periods: updatedPeriods });
  };

  // PatternDay ekle
  const handleAddPatternDay = (periodId: string) => {
    if (!declaration) return;
    
    const updatedPeriods = declaration.periods.map(p => {
      if (p.id !== periodId) return p;
      
      const newDay: PatternDay = {
        dayCount: 1,
        startTime: "09:00",
        endTime: "18:00"
      };
      
      return {
        ...p,
        weeklyPattern: {
          ...p.weeklyPattern,
          days: [...p.weeklyPattern.days, newDay]
        }
      };
    });
    
    onUpdate({ ...declaration, periods: updatedPeriods });
  };

  // PatternDay sil
  const handleRemovePatternDay = (periodId: string, dayIndex: number) => {
    if (!declaration) return;
    
    const updatedPeriods = declaration.periods.map(p => {
      if (p.id !== periodId) return p;
      
      const updatedDays = p.weeklyPattern.days.filter((_, idx) => idx !== dayIndex);
      
      return {
        ...p,
        weeklyPattern: {
          ...p.weeklyPattern,
          days: updatedDays
        }
      };
    });
    
    onUpdate({ ...declaration, periods: updatedPeriods });
  };

  // PatternDay güncelle
  const handleUpdatePatternDay = (periodId: string, dayIndex: number, updates: Partial<PatternDay>) => {
    if (!declaration) return;
    
    const updatedPeriods = declaration.periods.map(p => {
      if (p.id !== periodId) return p;
      
      const updatedDays = p.weeklyPattern.days.map((day, idx) =>
        idx === dayIndex ? { ...day, ...updates } : day
      );
      
      return {
        ...p,
        weeklyPattern: {
          ...p.weeklyPattern,
          days: updatedDays
        }
      };
    });
    
    onUpdate({ ...declaration, periods: updatedPeriods });
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

  const periods = declaration?.periods || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Davacı Beyanı - Dönemler</h3>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddPeriod}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Dönem Ekle
          </button>
        )}
      </div>

      {/* Dönem listesi */}
      {periods.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-200">
          Henüz dönem eklenmedi. "Dönem Ekle" butonuna tıklayarak başlayın.
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period, periodIndex) => {
            const isExpanded = expandedPeriods.has(period.id);
            
            return (
              <div key={period.id} className="border border-gray-300 rounded-lg overflow-hidden">
                {/* Dönem başlığı */}
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => togglePeriod(period.id)}
                >
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-gray-600">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-gray-700">
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
                        handleRemovePeriod(period.id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Dönemi Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dönem detayları */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white">
                    {/* Tarih, dönem tipi ve etiket */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Başlangıç Tarihi
                        </label>
                        <input
                          type="date"
                          value={period.startDate}
                          onChange={(e) => handleUpdatePeriod(period.id, { startDate: e.target.value })}
                          disabled={isReadOnly}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bitiş Tarihi
                        </label>
                        <input
                          type="date"
                          value={period.endDate}
                          onChange={(e) => handleUpdatePeriod(period.id, { endDate: e.target.value })}
                          disabled={isReadOnly}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Dönem Tipi
                        </label>
                        <select
                          value={period.periodType || "YAZ"}
                          onChange={(e) => handleUpdatePeriod(period.id, { periodType: e.target.value as "YAZ" | "KIŞ" | "SERBEST" })}
                          disabled={isReadOnly}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                          onChange={(e) => handleUpdatePeriod(period.id, { label: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="Örn: Ocak 2020, İlkbahar vb."
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                                handleUpdatePeriod(period.id, {
                                  weeklyPattern: {
                                    patternType: "SINGLE",
                                    days: [{ dayCount: 6, startTime: "09:00", endTime: "18:00" }]
                                  }
                                });
                              }}
                              disabled={isReadOnly}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Tek Tip</span>
                          </label>
                          
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={period.weeklyPattern.patternType === "MIXED"}
                              onChange={() => {
                                if (isReadOnly) return;
                                handleUpdatePeriod(period.id, {
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
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Haftalık Karma</span>
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
                            onClick={() => handleAddPatternDay(period.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
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
                                onChange={(e) => handleUpdatePatternDay(period.id, dayIndex, {
                                  dayCount: parseInt(e.target.value) || 1
                                })}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-0.5">Giriş Saati</label>
                              <input
                                type="time"
                                value={day.startTime}
                                onChange={(e) => handleUpdatePatternDay(period.id, dayIndex, {
                                  startTime: e.target.value
                                })}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-0.5">Çıkış Saati</label>
                              <input
                                type="time"
                                value={day.endTime}
                                onChange={(e) => handleUpdatePatternDay(period.id, dayIndex, {
                                  endTime: e.target.value
                                })}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                          </div>
                          
                          {!isReadOnly && period.weeklyPattern.patternType === "MIXED" && period.weeklyPattern.days.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePatternDay(period.id, dayIndex)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
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
  );
}
