import React from 'react';

interface SeasonalPattern {
  months: number[];
  startTime: string;
  endTime: string;
}

interface Witness {
  name?: string;
  dateIn: string;
  dateOut: string;
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
}

interface WitnessSeasonalEditorProps {
  witnesses: Witness[];
  onWitnessesUpdate: (witnesses: Witness[]) => void;
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

const WitnessSeasonalEditor: React.FC<WitnessSeasonalEditorProps> = ({
  witnesses,
  onWitnessesUpdate,
  isReadOnly = false,
}) => {
  const addWitness = () => {
    const newWitness: Witness = {
      dateIn: '',
      dateOut: '',
      summerPattern: { months: [6, 7, 8], startTime: '07:00', endTime: '18:00' },
      winterPattern: { months: [12, 1, 2], startTime: '08:00', endTime: '17:00' },
    };
    onWitnessesUpdate([...witnesses, newWitness]);
  };

  const removeWitness = (index: number) => {
    onWitnessesUpdate(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, updates: Partial<Witness>) => {
    const updated = witnesses.map((w, i) => (i === index ? { ...w, ...updates } : w));
    onWitnessesUpdate(updated);
  };

  const toggleMonth = (witnessIndex: number, season: 'summer' | 'winter', month: number) => {
    const witness = witnesses[witnessIndex];
    const pattern = season === 'summer' ? witness.summerPattern : witness.winterPattern;
    const otherPattern = season === 'summer' ? witness.winterPattern : witness.summerPattern;

    // Aynı ay diğer sezonda seçili mi kontrol et
    if (otherPattern.months.includes(month)) {
      alert(`${MONTHS.find(m => m.value === month)?.label} ayı diğer sezonda seçili. Bir ay sadece bir sezonda olabilir.`);
      return;
    }

    const newMonths = pattern.months.includes(month)
      ? pattern.months.filter(m => m !== month)
      : [...pattern.months, month].sort((a, b) => a - b);

    const updatedPattern = { ...pattern, months: newMonths };

    if (season === 'summer') {
      updateWitness(witnessIndex, { summerPattern: updatedPattern });
    } else {
      updateWitness(witnessIndex, { winterPattern: updatedPattern });
    }
  };

  const renderSeasonBlock = (
    witnessIndex: number,
    title: string,
    pattern: SeasonalPattern,
    season: 'summer' | 'winter'
  ) => {
    const witness = witnesses[witnessIndex];
    const otherPattern = season === 'summer' ? witness.winterPattern : witness.summerPattern;

    return (
      <div className="border rounded-lg p-4 bg-white">
        <h4 className="font-semibold text-base mb-3 text-gray-800">{title}</h4>

        {/* Ay Seçimi */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Aylar
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map(month => {
              const isSelected = pattern.months.includes(month.value);
              const isDisabledByOther = otherPattern.months.includes(month.value);

              return (
                <button
                  key={month.value}
                  type="button"
                  disabled={isReadOnly || isDisabledByOther}
                  onClick={() => toggleMonth(witnessIndex, season, month.value)}
                  className={`
                    px-2.5 py-1 rounded text-xs font-medium transition-colors
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
        </div>

        {/* Çalışma Saatleri */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Giriş Saati
            </label>
            <input
              type="time"
              value={pattern.startTime}
              onChange={(e) => {
                const updatedPattern = { ...pattern, startTime: e.target.value };
                if (season === 'summer') {
                  updateWitness(witnessIndex, { summerPattern: updatedPattern });
                } else {
                  updateWitness(witnessIndex, { winterPattern: updatedPattern });
                }
              }}
              disabled={isReadOnly}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Çıkış Saati
            </label>
            <input
              type="time"
              value={pattern.endTime}
              onChange={(e) => {
                const updatedPattern = { ...pattern, endTime: e.target.value };
                if (season === 'summer') {
                  updateWitness(witnessIndex, { summerPattern: updatedPattern });
                } else {
                  updateWitness(witnessIndex, { winterPattern: updatedPattern });
                }
              }}
              disabled={isReadOnly}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Her tanık için yaz ve kış aylarında farklı çalışma saatleri belirleyin.
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={addWitness}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 transition-colors"
          >
            + Tanık Ekle
          </button>
        )}
      </div>

      {witnesses.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Henüz tanık eklenmedi. "Tanık Ekle" butonuna tıklayarak tanık ekleyebilirsiniz.
        </div>
      )}

      {witnesses.map((witness, index) => {
        const totalMonths = witness.summerPattern.months.length + witness.winterPattern.months.length;
        const hasValidation = totalMonths < 12;

        return (
          <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={witness.name || `Tanık ${index + 1}`}
                  onChange={(e) => updateWitness(index, { name: e.target.value })}
                  disabled={isReadOnly}
                  placeholder={`Tanık ${index + 1}`}
                  className="text-lg font-semibold text-gray-800 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1 transition-colors disabled:cursor-not-allowed"
                />
              </div>
              {!isReadOnly && witnesses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWitness(index)}
                  className="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 transition-colors"
                >
                  Sil
                </button>
              )}
            </div>

            {/* Tarih Girişi */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    İşe Giriş Tarihi
                  </label>
                  <input
                    type="date"
                    value={witness.dateIn}
                    onChange={(e) => updateWitness(index, { dateIn: e.target.value })}
                    disabled={isReadOnly}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    İşten Çıkış Tarihi
                  </label>
                  <input
                    type="date"
                    value={witness.dateOut}
                    onChange={(e) => updateWitness(index, { dateOut: e.target.value })}
                    disabled={isReadOnly}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {hasValidation && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 mb-3">
                ⚠️ Tüm ayları seçmelisiniz. Şu an {12 - totalMonths} ay seçilmedi.
              </div>
            )}

            {/* Yaz/Kış Kartları */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {renderSeasonBlock(index, '🌞 Yaz Dönemi', witness.summerPattern, 'summer')}
              {renderSeasonBlock(index, '❄️ Kış Dönemi', witness.winterPattern, 'winter')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WitnessSeasonalEditor;
