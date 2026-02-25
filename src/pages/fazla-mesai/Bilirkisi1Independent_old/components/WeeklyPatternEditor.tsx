/**
 * WeeklyPatternEditor.tsx
 * Haftalık karma desen editörü - HAFTALIK_KARMA senaryosu için
 * 
 * ⚠️ KESİN KURAL:
 * - SADECE UI + state
 * - HESAP YOK (FM, 270, zamanaşımı YOK)
 * - Dönem YOK (sadece haftalık desen)
 */

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PatternDay } from "../declarationModel";

interface WeeklyPatternEditorProps {
  /** Haftalık desen günleri */
  days: PatternDay[];
  
  /** Günler güncellendiğinde çağrılır */
  onUpdate: (days: PatternDay[]) => void;
  
  /** Read-only mod */
  isReadOnly?: boolean;
}

export default function WeeklyPatternEditor({
  days,
  onUpdate,
  isReadOnly = false
}: WeeklyPatternEditorProps) {
  
  // Yeni gün ekle
  const handleAddDay = () => {
    const newDay: PatternDay = {
      dayCount: 1,
      startTime: "09:00",
      endTime: "18:00"
    };
    onUpdate([...days, newDay]);
  };

  // Gün sil
  const handleRemoveDay = (index: number) => {
    onUpdate(days.filter((_, idx) => idx !== index));
  };

  // Gün güncelle
  const handleUpdateDay = (index: number, updates: Partial<PatternDay>) => {
    onUpdate(days.map((day, idx) => 
      idx === index ? { ...day, ...updates } : day
    ));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">Haftalık Karma Desen</div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddDay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Gün Grubu Ekle
          </button>
        )}
      </div>

      {days.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-200">
          Henüz gün grubu eklenmedi. "Gün Grubu Ekle" butonuna tıklayarak başlayın.
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-3">
                {/* Gün Sayısı */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Gün Sayısı
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={day.dayCount}
                    onChange={(e) => handleUpdateDay(index, { dayCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Giriş Saati */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giriş Saati
                  </label>
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => handleUpdateDay(index, { startTime: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Çıkış Saati */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Çıkış Saati
                  </label>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => handleUpdateDay(index, { endTime: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Sil Butonu */}
              {!isReadOnly && days.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDay(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Gün grubunu sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toplam gün sayısı göstergesi */}
      <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
        <strong>Toplam:</strong> {days.reduce((sum, day) => sum + day.dayCount, 0)} gün/hafta
      </div>
    </div>
  );
}
