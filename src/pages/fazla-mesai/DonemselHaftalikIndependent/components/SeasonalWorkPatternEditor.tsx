import React from 'react';

interface SeasonalPattern {
  months: number[];
  startTime: string;
  endTime: string;
  // Gün sayıları
  days1?: number;
  days2?: number;
  startTime2?: string;
  endTime2?: string;
  // Hafta tatili
  hasWeeklyHoliday?: boolean;
  weeklyHolidayRow?: number; // 1 veya 2
}

interface SeasonalWorkPatternEditorProps {
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
  onSummerUpdate: (pattern: SeasonalPattern) => void;
  onWinterUpdate: (pattern: SeasonalPattern) => void;
  dateIn: string;
  dateOut: string;
  onDateInChange: (date: string) => void;
  onDateOutChange: (date: string) => void;
  isReadOnly?: boolean;
}

const MONTHS = [
  { value: 1, label: 'Oca' },
  { value: 2, label: 'Şub' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Nis' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Haz' },
  { value: 7, label: 'Tem' },
  { value: 8, label: 'Ağu' },
  { value: 9, label: 'Eyl' },
  { value: 10, label: 'Eki' },
  { value: 11, label: 'Kas' },
  { value: 12, label: 'Ara' },
];

const SeasonalWorkPatternEditor: React.FC<SeasonalWorkPatternEditorProps> = ({
  summerPattern,
  winterPattern,
  onSummerUpdate,
  onWinterUpdate,
  dateIn,
  dateOut,
  onDateInChange,
  onDateOutChange,
  isReadOnly = false,
}) => {
  const toggleMonth = (season: 'summer' | 'winter', month: number) => {
    if (isReadOnly) return;

    const pattern = season === 'summer' ? summerPattern : winterPattern;
    const otherPattern = season === 'summer' ? winterPattern : summerPattern;
    const updateFn = season === 'summer' ? onSummerUpdate : onWinterUpdate;

    console.log(`🔄 [TOGGLE] Season: ${season}, Month: ${month}, Current months:`, pattern.months);

    // Aynı ay diğer sezonda seçili mi kontrol et
    if (otherPattern.months.includes(month)) {
      alert(`${MONTHS.find(m => m.value === month)?.label} ayı diğer sezonda seçili. Bir ay sadece bir sezonda olabilir.`);
      return;
    }

    const newMonths = pattern.months.includes(month)
      ? pattern.months.filter(m => m !== month)
      : [...pattern.months, month].sort((a, b) => a - b);

    console.log(`🔄 [TOGGLE] New months:`, newMonths);
    updateFn({ ...pattern, months: newMonths });
  };

  const renderSeasonBlock = (
    title: string,
    pattern: SeasonalPattern,
    season: 'summer' | 'winter',
    updateFn: (pattern: SeasonalPattern) => void
  ) => {
    // Tüm aylar seçilmiş mi kontrol et
    const allMonthsSelected = summerPattern.months.length + winterPattern.months.length === 12;
    const hasUnselectedMonths = pattern.months.length === 0;

    return (
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-lg mb-4 text-gray-800">{title}</h3>

        {/* Ay Seçimi */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aylar
          </label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map(month => {
              const isSelected = pattern.months.includes(month.value);
              const isDisabledByOther = (season === 'summer' ? winterPattern : summerPattern).months.includes(month.value);

              return (
                <button
                  key={month.value}
                  type="button"
                  disabled={isReadOnly || isDisabledByOther}
                  onClick={() => toggleMonth(season, month.value)}
                  className={`
                    px-3 py-1.5 rounded text-sm font-medium transition-colors
                    ${isSelected
                      ? season === 'summer'
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      : isDisabledByOther
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                    ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                  `}
                >
                  {month.label}
                </button>
              );
            })}
          </div>
          {hasUnselectedMonths && !allMonthsSelected && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ En az bir ay seçmelisiniz
            </p>
          )}
        </div>

        {/* Çalışma Saatleri */}
        <div className="space-y-3">
          {/* 1. Satır */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">Grup 1</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gün Sayısı
                </label>
              <input
                type="number"
                min="0"
                max={7 - (pattern.days2 || 0)}
                value={pattern.days1 || 0}
                onChange={(e) => {
                  const newDays1 = Math.min(7 - (pattern.days2 || 0), Math.max(0, parseInt(e.target.value) || 0));
                  updateFn({ ...pattern, days1: newDays1 });
                }}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giriş Saati
              </label>
              <input
                type="time"
                value={pattern.startTime}
                onChange={(e) => updateFn({ ...pattern, startTime: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Çıkış Saati
              </label>
              <input
                type="time"
                value={pattern.endTime}
                onChange={(e) => updateFn({ ...pattern, endTime: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            </div>
          </div>

          {/* 2. Satır - İkinci çalışma saati */}
          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Grup 2</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gün Sayısı
                </label>
              <input
                type="number"
                min="0"
                max={7 - (pattern.days1 || 0)}
                value={pattern.days2 || 0}
                onChange={(e) => {
                  const newDays2 = Math.min(7 - (pattern.days1 || 0), Math.max(0, parseInt(e.target.value) || 0));
                  updateFn({ ...pattern, days2: newDays2 });
                }}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giriş Saati
              </label>
              <input
                type="time"
                value={pattern.startTime2 || pattern.startTime}
                onChange={(e) => updateFn({ ...pattern, startTime2: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Çıkış Saati
              </label>
              <input
                type="time"
                value={pattern.endTime2 || pattern.endTime}
                onChange={(e) => updateFn({ ...pattern, endTime2: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            </div>
          </div>

          {/* Toplam gün uyarısı */}
          {((pattern.days1 || 0) + (pattern.days2 || 0)) > 7 && (
            <div className="text-xs text-red-600 mt-1">
              ⚠️ Toplam gün sayısı 7'yi geçemez
            </div>
          )}
          
          {/* Hafta Tatili Checkbox - Sadece toplam 7 gün olduğunda göster */}
          {((pattern.days1 || 0) + (pattern.days2 || 0)) === 7 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id={`weeklyHoliday-${season}`}
                  checked={pattern.hasWeeklyHoliday || false}
                  onChange={(e) => updateFn({ ...pattern, hasWeeklyHoliday: e.target.checked })}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor={`weeklyHoliday-${season}`} className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Hafta Tatili Var mı?
                </label>
              </div>
              
              {pattern.hasWeeklyHoliday && (
                <div className="ml-6">
                  <label className="block text-xs text-gray-600 mb-1">Hangi Gruba Dahil?</label>
                  <select
                    value={pattern.weeklyHolidayRow || 2}
                    onChange={(e) => updateFn({ ...pattern, weeklyHolidayRow: parseInt(e.target.value) })}
                    disabled={isReadOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value={1}>Grup 1</option>
                    <option value={2}>Grup 2</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Doğrulama: Tüm aylar seçilmiş mi?
  const totalSelectedMonths = summerPattern.months.length + winterPattern.months.length;
  const hasValidation = totalSelectedMonths < 12;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Yaz ve kış aylarında farklı çalışma saatleri belirleyin. Her ay sadece bir sezonda olabilir.
      </div>

      {/* İşe Giriş/Çıkış Tarihleri */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İşe Giriş Tarihi
            </label>
            <input
              type="date"
              value={dateIn}
              onChange={(e) => onDateInChange(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İşten Çıkış Tarihi
            </label>
            <input
              type="date"
              value={dateOut}
              onChange={(e) => onDateOutChange(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {hasValidation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Tüm ayları seçmelisiniz. Şu an {12 - totalSelectedMonths} ay seçilmedi.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderSeasonBlock('🌞 Yaz Dönemi', summerPattern, 'summer', onSummerUpdate)}
        {renderSeasonBlock('❄️ Kış Dönemi', winterPattern, 'winter', onWinterUpdate)}
      </div>
    </div>
  );
};

export default SeasonalWorkPatternEditor;
