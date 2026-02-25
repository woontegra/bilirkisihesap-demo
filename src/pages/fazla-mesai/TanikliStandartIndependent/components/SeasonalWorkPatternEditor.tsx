import React from 'react';

interface SeasonalPattern {
  months: number[];
  startTime: string;
  endTime: string;
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

    // Aynı ay diğer sezonda seçili mi kontrol et
    if (otherPattern.months.includes(month)) {
      alert(`${MONTHS.find(m => m.value === month)?.label} ayı diğer sezonda seçili. Bir ay sadece bir sezonda olabilir.`);
      return;
    }

    const newMonths = pattern.months.includes(month)
      ? pattern.months.filter(m => m !== month)
      : [...pattern.months, month].sort((a, b) => a - b);

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
        <div className="grid grid-cols-2 gap-4">
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
