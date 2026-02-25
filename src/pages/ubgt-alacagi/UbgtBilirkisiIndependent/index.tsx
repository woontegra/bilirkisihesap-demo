import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { safeNumber, safeCurrency, safeDays } from "@/utils/safeFormat";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
// Constants - inline (Bilirkişi UBGT)
const PAGE_TITLE = "Bilirkişi UBGT Alacağı";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };

// Tatil dosyaları backend'e taşındı
import UbgtExpiryBox from "./UbgtExpiryBox";
import UbgtNetConversion from "./UbgtNetConversion";
import UbgtExcludeDays from "./UbgtExcludeDays";
import UbgtExclusionCompactUI from "../UbgtIndependent/UbgtExclusionCompactUI";
import UbgtHolidaySelectCompact from "../UbgtIndependent/UbgtHolidaySelectCompact";
import {
  filterExcludedUbgtHolidaysByRules,
  BACKEND_ID_TO_UBGT_TYPE,
  type UbgtDayEntry,
  type UbgtExclusionRule,
  type UbgtHolidayType,
} from "@/pages/ubgt/utils/filterExcludedUbgtHolidays";
import UbgtKatsayiModal from "./UbgtKatsayiModal";
import UbgtReportNetConversion from "./UbgtReportNetConversion";
import UbgtReportSettlement from "./UbgtReportSettlement";
import { format } from "date-fns";
import "./soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// API_BASE_URL already imported from @/utils/apiClient

// Tatil tipi backend'e taşındı

// Tatil tipleri backend'e taşındı

// Tarih aralığı tipi
interface DateRange {
  id: string;
  start: string;
  end: string;
}

// Sabit tatil listesi
interface StaticHoliday {
  id: string;
  name: string;
  days: number;
}

// STATIC_HOLIDAYS - Frontend UI için (hesaplamalar backend'de)
const STATIC_HOLIDAYS: {
  national: StaticHoliday[];
  official: StaticHoliday[];
  general: StaticHoliday[];
  religious: StaticHoliday[];
} = {
  national: [
    { id: "28-ekim", name: "28 Ekim", days: 0.5 },
    { id: "29-ekim", name: "29 Ekim", days: 1 },
  ],
  official: [
    { id: "23-nisan", name: "23 Nisan", days: 1 },
    { id: "19-mayis", name: "19 Mayıs", days: 1 },
    { id: "30-agustos", name: "30 Ağustos", days: 1 },
  ],
  general: [
    { id: "1-ocak", name: "Yılbaşı", days: 1 },
    { id: "1-mayis", name: "1 Mayıs", days: 1 },
    { id: "15-temmuz", name: "15 Temmuz", days: 1 },
  ],
  religious: [
    { id: "ramazan-arife", name: "Ramazan Arife", days: 0.5 },
    { id: "ramazan-1", name: "Ramazan 1. Gün", days: 1 },
    { id: "ramazan-2", name: "Ramazan 2. Gün", days: 1 },
    { id: "ramazan-3", name: "Ramazan 3. Gün", days: 1 },
    { id: "kurban-arife", name: "Kurban Arife", days: 0.5 },
    { id: "kurban-1", name: "Kurban 1. Gün", days: 1 },
    { id: "kurban-2", name: "Kurban 2. Gün", days: 1 },
    { id: "kurban-3", name: "Kurban 3. Gün", days: 1 },
    { id: "kurban-4", name: "Kurban 4. Gün", days: 1 },
  ],
};

// MIN_WAGE_TABLE ve hesaplama fonksiyonları backend'e taşındı

// Hesaplama fonksiyonları backend'e taşındı

// Tatil interface'leri backend'e taşındı

// Tatil eşlemeleri ve geçerlilik kuralları backend'e taşındı

// extractHolidaysInRange ve getUbgtDaysForPeriod fonksiyonları backend'e taşındı
// Ancak frontend'de onChange event'lerinde anında hesaplama için basit bir versiyon gerekli

// Sabit tatillerin ay-gün eşlemesi
const FIXED_HOLIDAY_MAP: Record<string, { month: number; day: number }> = {
  "1-ocak": { month: 0, day: 1 },
  "23-nisan": { month: 3, day: 23 },
  "1-mayis": { month: 4, day: 1 },
  "19-mayis": { month: 4, day: 19 },
  "15-temmuz": { month: 6, day: 15 },
  "30-agustos": { month: 7, day: 30 },
  "28-ekim": { month: 9, day: 28 },
  "29-ekim": { month: 9, day: 29 },
};

// Tatil geçerlilik kuralları
const HOLIDAY_RULES: Record<string, (year: number) => boolean> = {
  "1-mayis": (year) => year >= 2009,
  "15-temmuz": (year) => year >= 2017,
  "1-ocak": () => true,
  "23-nisan": () => true,
  "19-mayis": () => true,
  "30-agustos": () => true,
  "29-ekim": () => true,
  "28-ekim": () => true,
};

// Frontend'de basit UBGT gün hesaplama (sadece sabit tatiller için)
// Dini bayramlar backend API'sinden gelir, bu yüzden burada sadece sabit tatilleri hesaplıyoruz
function getUbgtDaysForPeriod(
  periodStart: string,
  periodEnd: string,
  selectedHolidayIds: string[],
  excludedDays: Array<{ start: string; end: string }> = []
): number {
  if (!selectedHolidayIds || selectedHolidayIds.length === 0) {
    return 0;
  }

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  
  const startNormalized = new Date(periodStartDate.getFullYear(), periodStartDate.getMonth(), periodStartDate.getDate());
  const endNormalized = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());
  
  const startYear = startNormalized.getFullYear();
  const endYear = endNormalized.getFullYear();

  // Dışlanan tarihleri Set'e ekle
  const excludedDatesSet = new Set<string>();
  for (const excluded of excludedDays) {
    if (excluded.start && excluded.end) {
      const startDate = new Date(excluded.start);
      const endDate = new Date(excluded.end);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        excludedDatesSet.add(dateStr);
      }
    }
  }

  // Tatil günlerini topla
  const holidayDates = new Map<string, number>(); // date -> duration
  
  for (const selectedId of selectedHolidayIds) {
    // Sadece sabit tatilleri hesapla (dini bayramlar backend'den gelir)
    const staticHoliday = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
    ].find((h) => h.id === selectedId);
    
    if (!staticHoliday) continue; // Dini bayramlar için backend API'sine bağımlıyız
    
    const fixedHoliday = FIXED_HOLIDAY_MAP[selectedId];
    if (!fixedHoliday) continue;
    
    const rule = HOLIDAY_RULES[selectedId];
    if (!rule) continue;

    for (let year = startYear; year <= endYear; year++) {
      if (!rule(year)) continue;
      
      const holidayDate = new Date(year, fixedHoliday.month, fixedHoliday.day);
      const holidayDateNormalized = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
      
      if (holidayDateNormalized >= startNormalized && holidayDateNormalized <= endNormalized) {
        const dateStr = `${year}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
        
        // Dışlanan tarihlerde değilse ekle
        if (!excludedDatesSet.has(dateStr)) {
          const existing = holidayDates.get(dateStr);
          // Çakışma varsa daha uzun süreli olanı seç
          if (!existing || staticHoliday.days > existing) {
            holidayDates.set(dateStr, staticHoliday.days);
          }
        }
      }
    }
  }

  // Toplam UBGT günlerini hesapla
  let ubgtDays = 0;
  for (const duration of holidayDates.values()) {
    ubgtDays += duration;
  }

  return ubgtDays;
}

// Tablo satırı tipi
export interface UbgtTableRow {
  period: string;
  wage?: number; // Optional - varsayılan 0
  coefficient?: number; // Optional - varsayılan 1
  dailyWage?: number; // Optional - varsayılan 0
  ubgtDays?: number; // Optional - varsayılan 0
  ubgtTotal?: number; // Optional - varsayılan 0
  startISO?: string;
  endISO?: string;
  manual?: boolean;
}

export default function UbgtIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  const { user } = useAuth();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("ubgt-bilirkisi");
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  const isLoadingFromSavedRef = useRef<boolean>(false); // Yükleme sırasında otomatik hesaplamayı engellemek için
  
  // Yeni State Yapısı - Her tarih aralığının kendi tatil seçimleri var
  interface DateRangeWithHolidays {
    id: string;
    start: string;
    end: string;
    selectedHolidayIds: string[];
  }

  // Davacı için tarih aralıkları (her aralığın kendi tatilleri var)
  const [davaciDateRanges, setDavaciDateRanges] = useState<DateRangeWithHolidays[]>([
    { id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] },
  ]);

  // Tanıklar state (her tanığın tarih aralığının kendi tatilleri var)
  interface Witness {
    id: string;
    name: string;
    dateRange: DateRangeWithHolidays; // Tek tarih aralığı
  }
  const [witnesses, setWitnesses] = useState<Witness[]>([
    {
      id: Date.now().toString(),
      name: "Tanık 1",
      dateRange: { id: Date.now().toString() + "-1", start: "", end: "", selectedHolidayIds: [] },
    },
  ]);

  // Eski state'leri backend uyumluluğu için koruyoruz
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: Date.now().toString(), start: "", end: "" },
  ]);
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);

  // UBGT Zamanaşımı state (ubgt prefix'li)
  const [ubgtExpiryStart, setUbgtExpiryStart] = useState<string | null>(null);

  // UBGT Dışlanabilir günler state (ubgt prefix'li)
  const [ubgtExcludedDays, setUbgtExcludedDays] = useState<
    Array<{ id: string; type: "Yıllık İzin" | "Rapor" | "Diğer"; start: string; end: string; days: number }>
  >([]);

  /** Yıl + UBGT günü bazlı dışlama (Standart UBGT ile aynı; tanık sonrası nihai listede uygulanır) */
  const [ubgtExclusionRules, setUbgtExclusionRules] = useState<UbgtExclusionRule[]>([]);
  /** Hesaplanmış UBGT günleri listesi (dropdown ve tablo filtreleme için) */
  const [ubgtDayEntriesList, setUbgtDayEntriesList] = useState<UbgtDayEntry[]>([]);

  // Tatil akordiyon state - Her tarih aralığı için
  const [holidayAccordionOpen, setHolidayAccordionOpen] = useState<{ [key: string]: boolean }>({});
  
  // Global Hafta Tatili Dışlama - Tüm hesaplamalar için geçerli
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([]); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi

  // Davacı için tatil seçimleri (tüm aralıklar için ortak - UI'da tek akordiyon var)
  const davaciSelectedHolidayIds = useMemo(() => {
    // Tüm davacı aralıklarındaki tatillerin birleşimi
    const allIds = new Set<string>();
    davaciDateRanges.forEach(range => {
      if (range.selectedHolidayIds && Array.isArray(range.selectedHolidayIds)) {
        range.selectedHolidayIds.forEach(id => allIds.add(id));
      }
    });
    return Array.from(allIds);
  }, [davaciDateRanges]);

  // Tanıkların seçili tatillerini birleştir
  const witnessSelectedHolidayIds = useMemo(() => {
    const allIds = new Set<string>();
    witnesses.forEach(witness => {
      if (witness.dateRange?.selectedHolidayIds && Array.isArray(witness.dateRange.selectedHolidayIds)) {
        witness.dateRange.selectedHolidayIds.forEach(id => allIds.add(id));
      }
    });
    return Array.from(allIds);
  }, [witnesses]);

  // Davacı tarih aralığı ekle
  const handleAddDavaciDateRange = () => {
    setDavaciDateRanges([
      ...davaciDateRanges,
      { id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] },
    ]);
  };

  // Davacı tarih aralığı sil
  const handleRemoveDavaciDateRange = (id: string) => {
    if (davaciDateRanges.length > 1) {
      setDavaciDateRanges(davaciDateRanges.filter((range) => range.id !== id));
    }
  };

  // Davacı tarih aralığı güncelle
  const handleUpdateDavaciDateRange = (id: string, field: "start" | "end", value: string) => {
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
      }
    }

    setDavaciDateRanges(
      davaciDateRanges.map((range) =>
        range.id === id ? { ...range, [field]: value } : range
      )
    );
  };

  // Davacı tarih aralığı için tatil seçimi
  const handleDavaciRangeHolidayChange = (rangeId: string, holidayId: string, checked: boolean) => {
    setDavaciDateRanges(
      davaciDateRanges.map((range) =>
        range.id === rangeId
          ? {
              ...range,
              selectedHolidayIds: checked
                ? [...range.selectedHolidayIds, holidayId]
                : range.selectedHolidayIds.filter((id) => id !== holidayId),
            }
          : range
      )
    );
  };

  // Yeni tanık ekle
  const handleAddWitness = () => {
    const newWitnessNumber = witnesses.length + 1;
    setWitnesses([
      ...witnesses,
      {
        id: Date.now().toString(),
        name: `Tanık ${newWitnessNumber}`,
        dateRange: { id: Date.now().toString() + `-w${newWitnessNumber}`, start: "", end: "", selectedHolidayIds: [] },
      },
    ]);
  };

  // Tanık sil
  const handleRemoveWitness = (witnessId: string) => {
    setWitnesses(witnesses.filter((w) => w.id !== witnessId));
  };

  // Tanık adı güncelle (özel isim verebilmek için)
  const handleUpdateWitnessName = (witnessId: string, name: string) => {
    const trimmed = name.trim();
    const fallbackIndex = witnesses.findIndex((w) => w.id === witnessId) + 1;
    const newName = trimmed || `Tanık ${fallbackIndex}`;
    setWitnesses(
      witnesses.map((w) => (w.id === witnessId ? { ...w, name: newName } : w))
    );
  };

  // Tanık tarih aralığı güncelle
  const handleUpdateWitnessDateRange = (
    witnessId: string,
    dateRangeId: string,
    field: "start" | "end",
    value: string
  ) => {
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
      }
    }

    setWitnesses(
      witnesses.map((w) =>
        w.id === witnessId
          ? { ...w, dateRange: { ...w.dateRange, [field]: value } }
          : w
      )
    );
  };

  // Tanık için tatil seçimi
  const handleWitnessHolidayChange = (witnessId: string, holidayId: string, checked: boolean) => {
    setWitnesses(
      witnesses.map((w) =>
        w.id === witnessId
          ? {
              ...w,
              dateRange: {
                ...w.dateRange,
                selectedHolidayIds: checked
                  ? [...w.dateRange.selectedHolidayIds, holidayId]
                  : w.dateRange.selectedHolidayIds.filter((id) => id !== holidayId),
              },
            }
          : w
      )
    );
  };

  // UI için wrapper fonksiyonlar - Davacı Tek Tatil Seçimi (Tüm aralıklar için ortak)
  const handleDavaciHolidayCheckboxChange = (holidayId: string, checked: boolean) => {
    // Tüm davacı tarih aralıklarına aynı tatil seçimini uygula
    setDavaciDateRanges(
      davaciDateRanges.map((range) => ({
        ...range,
        selectedHolidayIds: checked
          ? [...range.selectedHolidayIds, holidayId]
          : range.selectedHolidayIds.filter((id) => id !== holidayId),
      }))
    );
  };

  // Davacı için tümünü seç/kaldır
  const handleDavaciToggleAllHolidays = () => {
    const allHolidays = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ].map(h => h.id);
    
    const allSelected = allHolidays.every(id => davaciSelectedHolidayIds.includes(id));
    
    setDavaciDateRanges(
      davaciDateRanges.map((range) => ({
        ...range,
        selectedHolidayIds: allSelected ? [] : allHolidays,
      }))
    );
  };

  // Tanık için tümünü seç/kaldır
  const handleWitnessToggleAllHolidays = (witnessId: string) => {
    const allHolidays = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ].map(h => h.id);
    
    const witness = witnesses.find(w => w.id === witnessId);
    if (!witness) return;
    
    const allSelected = allHolidays.every(id => witness.dateRange.selectedHolidayIds.includes(id));
    
    setWitnesses(
      witnesses.map((w) =>
        w.id === witnessId
          ? {
              ...w,
              dateRange: {
                ...w.dateRange,
                selectedHolidayIds: allSelected ? [] : allHolidays,
              },
            }
          : w
      )
    );
  };

  // UI için wrapper fonksiyonlar - Tanık Tatil Seçimi
  const handleWitnessHolidayCheckboxChange = (witnessId: string, rangeId: string, holidayId: string, checked: boolean) => {
    handleWitnessHolidayChange(witnessId, holidayId, checked);
  };

  // Global Hafta Günü Dışlama
  const handleWeekdayExclude = (weekday: number, checked: boolean) => {
    setExcludedWeekdays(
      checked
        ? [...excludedWeekdays, weekday]
        : excludedWeekdays.filter((d) => d !== weekday)
    );
  };

  // Backend'den gelen dışlanan tatil günleri listesi
  const [backendExcludedList, setBackendExcludedList] = useState<Array<{ date: string; name: string; duration: number; dayOfWeek: number }>>([]);

  // Dışlanan günlerin listesini backend'den alınan verilerle formatla
  const excludedDaysList = useMemo(() => {
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    
    return backendExcludedList.map(item => ({
      date: item.date,
      dayName: dayNames[item.dayOfWeek],
      holidayName: item.name,
      duration: item.duration,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [backendExcludedList]);

  // UBGT Hesaplama Fonksiyonu
  const handleCalculate = async (showSuccessMessage = true) => {
    // Davacı için en az bir geçerli tarih aralığı olmalı
    const hasValidDate = davaciDateRanges.some((r) => r.start && r.end);
    if (!hasValidDate) {
      if (showSuccessMessage) {
        showToastError("Lütfen davacı için en az bir tarih aralığı girin");
      }
      return;
    }

    try {
      // Backend payload hazırla - Hem Davacı hem Tanıklar için
      // 1. Davacı tarih aralıkları (person field ekle)
      const davaciRanges = davaciDateRanges
        .filter(range => range.start && range.end)
        .map(range => ({
          id: range.id,
          start: range.start,
          end: range.end,
          person: "Davacı" // Segmentasyon için person field'ı
        }));

      // Davacı'nın en erken ve en geç tarihlerini bul
      let davaciMinDate: Date | null = null;
      let davaciMaxDate: Date | null = null;
      
      if (davaciRanges.length > 0) {
        const allDavaciDates = davaciRanges.flatMap(r => [new Date(r.start), new Date(r.end)]);
        davaciMinDate = new Date(Math.min(...allDavaciDates.map(d => d.getTime())));
        davaciMaxDate = new Date(Math.max(...allDavaciDates.map(d => d.getTime())));
      }

      // 2. Tanık tarih aralıkları (person field + selectedHolidayIds ekle ve DAVACI ARALIĞIYLA KES)
      // ÖNEMLI: Davacı aralığı yoksa tanıkları da ekleme
      const tanikRanges = (davaciMinDate && davaciMaxDate) ? witnesses
        .filter(w => w.dateRange.start && w.dateRange.end)
        .map(w => {
          let start = w.dateRange.start;
          let end = w.dateRange.end;
          
          // ÖNEMLI KURAL: Tanık tarihleri Davacı aralığı ile sınırlıdır
          if (davaciMinDate && davaciMaxDate) {
            const tanikStart = new Date(w.dateRange.start);
            const tanikEnd = new Date(w.dateRange.end);
            
            // Tanık başlangıcı Davacı'dan önceyse, Davacı başlangıcına çek
            if (tanikStart < davaciMinDate) {
              start = davaciMinDate.toISOString().split('T')[0];
              console.log(`[Bilirkişi UBGT] ${w.name} başlangıcı Davacı aralığına çekildi: ${w.dateRange.start} → ${start}`);
            }
            
            // Tanık bitişi Davacı'dan sonraysa, Davacı bitişine çek
            if (tanikEnd > davaciMaxDate) {
              end = davaciMaxDate.toISOString().split('T')[0];
              console.log(`[Bilirkişi UBGT] ${w.name} bitişi Davacı aralığına çekildi: ${w.dateRange.end} → ${end}`);
            }
            
            // Eğer kesme sonrası start > end olursa, bu tanığı atla
            if (new Date(start) > new Date(end)) {
              console.warn(`[Bilirkişi UBGT] ${w.name} Davacı aralığıyla kesişmiyor, atlanıyor`);
              return null;
            }
          }
          
          // ÇOK ÖNEMLİ KURAL: Tanık SADECE Davacı'nın seçtiği tatillerden seçebilir!
          // Davacı'nın SEÇMEDİĞİ tatilleri tanık seçemez (üst sınır)
          const filteredHolidayIds = (w.dateRange.selectedHolidayIds || []).filter(holidayId => 
            davaciSelectedHolidayIds.includes(holidayId)
          );
          
          const originalCount = w.dateRange.selectedHolidayIds?.length || 0;
          const filteredCount = filteredHolidayIds.length;
          if (originalCount > filteredCount) {
            console.log(`[Bilirkişi UBGT] ${w.name}: ${originalCount - filteredCount} tatil Davacı tarafından seçilmediği için dışlandı`);
          }
          
          return {
            id: w.dateRange.id,
            start,
            end,
            person: w.name, // "Tanık 1", "Tanık 2" etc.
            selectedHolidayIds: filteredHolidayIds // Davacı'nın seçtikleriyle FİLTRELENMİŞ!
          };
        })
        .filter((r): r is { id: string; start: string; end: string; person: string; selectedHolidayIds: string[] } => r !== null)
        : []; // Davacı aralığı yoksa tanık ekleme

      // 3. ÖNEMLI KURAL: Davacı sadece tanıkların kanıtladığı dönemler için talep edebilir
      // Tanık yoksa veya tanık tarihi yoksa hesaplama yapma
      if (tanikRanges.length === 0) {
        console.warn("[Bilirkişi UBGT] Tanık beyanı yok, hesaplama yapılamaz");
        setUbgtRows([]);
        setUbgtTotalBrut(0);
        setTotalDays(0);
        return;
      }
      
      // SADECE tanık aralıklarını hesaplamaya gönder (Davacı aralığını DEĞİL!)
      // Çünkü Davacı sadece tanıklarla kanıtlayabildiği kadar talep edebilir
      // HER TANIĞIN TATİLLERİ Davacı'nın seçtikleriyle FİLTRELENMİŞ olarak gidiyor!
      const combinedDateRanges = tanikRanges;
      
      console.log("[Bilirkişi UBGT] Davacı'nın seçtiği tatil sayısı (üst sınır):", davaciSelectedHolidayIds.length);
      console.log("[Bilirkişi UBGT] Her tanık (Davacı'nın seçtikleriyle filtrelenmiş):", 
        tanikRanges.map(t => ({ person: t.person, holidays: t.selectedHolidayIds.length })));

      // 4. ARTIK GLOBAL selectedHolidayIds KULLANMIYORUZ!
      // Her tanığın kendi tatilleri dateRanges içinde
      const uniqueHolidayIds: string[] = [];

      const payload = {
        dateRanges: combinedDateRanges, // Her tanık kendi selectedHolidayIds ile
        selectedHolidayIds: uniqueHolidayIds, // Artık kullanılmıyor (boş array)
        ubgtExcludedDays,
        ubgtExpiryStart,
        excludedWeekdays, // Hafta tatili dışlaması
        year: new Date().getFullYear()
      };

      console.log("[Bilirkişi UBGT] Backend'e gönderiliyor (her tanık kendi tatilleriyle):", JSON.stringify(payload, null, 2));
      
      // apiPost kullan - otomatik olarak tenant ID ve diğer header'ları ekler
      const response = await apiPost('/api/ubgt/bilirkisi', payload);

      if (!response.ok) {
        // Backend'den hata mesajını al
        const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorResult.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("[Bilirkişi UBGT] Backend'den gelen sonuç:", result);

      if (result.success && result.data) {
        const periods = result.data.periods || [];
        const ubgtDayEntries = result.data.ubgtDayEntries || [];
        setBackendExcludedList(result.data.excludedWeekdayHolidays || []);
        // Tarih değişince yeniden hesaplamada kullanıcının girdiği kat sayıyı koru
        const currentKatsayi = hasCustomKatsayi && ubgtRows.length > 0 ? (ubgtRows[0].coefficient ?? 1) : undefined;
        const periodsWithKatsayi = currentKatsayi !== undefined
          ? periods.map((p: UbgtTableRow) => recalcRow({ ...p, coefficient: currentKatsayi }))
          : periods.map((p: UbgtTableRow) => recalcRow(p));

        if (ubgtDayEntries.length === 0) {
          setUbgtDayEntriesList([]);
          setUbgtRows(periodsWithKatsayi);
          setUbgtTotalBrut(result.data.toplamBrut || 0);
          setTotalDays(result.data.totalDays || 0);
          if (showSuccessMessage) {
            const tanikCount = witnesses.filter(w => w.dateRange.start && w.dateRange.end).length;
            const message = tanikCount > 0
              ? `Hesaplama tamamlandı (Davacı + ${tanikCount} Tanık). Toplam: ${result.data.totalDays || 0} gün`
              : `Hesaplama tamamlandı (Davacı). Toplam: ${result.data.totalDays || 0} gün`;
            success(message);
          }
        } else {
          const withType: UbgtDayEntry[] = ubgtDayEntries.map(
            (e: { date: string; holidayId: string; days: number; periodIndex: number }) => ({
              date: e.date,
              holidayType: BACKEND_ID_TO_UBGT_TYPE[e.holidayId] ?? (e.holidayId as UbgtHolidayType),
              days: e.days,
              periodIndex: e.periodIndex,
            })
          );
          setUbgtDayEntriesList(withType);
          const filtered = filterExcludedUbgtHolidaysByRules(withType, ubgtExclusionRules);
          const daysByPeriod: Record<number, number> = {};
          filtered.forEach((e) => {
            const idx = e.periodIndex ?? 0;
            daysByPeriod[idx] = (daysByPeriod[idx] ?? 0) + e.days;
          });
          const filteredUbgtDays = periodsWithKatsayi.map((row: UbgtTableRow, idx: number) => {
            const newUbgtDays = daysByPeriod[idx] ?? row.ubgtDays ?? 0;
            return recalcRow({ ...row, ubgtDays: newUbgtDays });
          });
          setUbgtRows(filteredUbgtDays);
          setUbgtTotalBrut(filteredUbgtDays.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0));
          setTotalDays(filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0));
          if (showSuccessMessage) {
            const tanikCount = witnesses.filter(w => w.dateRange.start && w.dateRange.end).length;
            const message = tanikCount > 0
              ? `Hesaplama tamamlandı (Davacı + ${tanikCount} Tanık). Toplam: ${filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0)} gün`
              : `Hesaplama tamamlandı (Davacı). Toplam: ${filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0)} gün`;
            success(message);
          }
        }
      } else {
        if (showSuccessMessage) {
          showToastError(result.error || "Hesaplama başarısız");
        }
      }
    } catch (error) {
      console.error("[Bilirkişi UBGT] Hesaplama hatası:", error);
      if (showSuccessMessage) {
        showToastError("Hesaplama sırasında bir hata oluştu");
      }
    }
  };

  // Otomatik hesaplama - Tarih, tatil veya hafta tatili değiştiğinde
  useEffect(() => {
    // Yükleme sırasında otomatik hesaplamayı engelle (kaydedilmiş verileri koru)
    if (isLoadingFromSavedRef.current) {
      return;
    }
    
    const hasValidDate = davaciDateRanges.some((r) => r.start && r.end) || 
                         witnesses.some((w) => w.dateRange.start && w.dateRange.end);
    if (hasValidDate) {
      handleCalculate(false); // Silent update (toast gösterme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaciDateRanges, davaciSelectedHolidayIds, witnesses, witnessSelectedHolidayIds, ubgtExcludedDays, ubgtExpiryStart, excludedWeekdays]);

  // Eski fonksiyonları koruyalım (backend uyumluluğu için)
  const handleAddDateRange = () => {
    setDateRanges([
      ...dateRanges,
      { id: Date.now().toString(), start: "", end: "" },
    ]);
  };

  const handleRemoveDateRange = (id: string) => {
    if (dateRanges.length > 1) {
      setDateRanges(dateRanges.filter((range) => range.id !== id));
    }
  };

  const handleUpdateDateRange = (id: string, field: "start" | "end", value: string) => {
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
      }
    }

    setDateRanges(
      dateRanges.map((range) =>
        range.id === id ? { ...range, [field]: value } : range
      )
    );
  };


  // Eski fonksiyon (backend uyumluluğu için)
  const handleHolidayCheckboxChange = (holidayId: string, checked: boolean) => {
    if (checked) {
      setSelectedHolidayIds([...selectedHolidayIds, holidayId]);
    } else {
      setSelectedHolidayIds(selectedHolidayIds.filter((id) => id !== holidayId));
    }
  };

  // Tüm tatilleri birleştir
  const allHolidaysList = useMemo(() => {
    return [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ];
  }, []);

  // Tüm checkbox değerlerini kontrol eden yardımcı fonksiyon
  const areAllSelected = useMemo(() => {
    return allHolidaysList.length > 0 && allHolidaysList.every(h => selectedHolidayIds.includes(h.id));
  }, [allHolidaysList, selectedHolidayIds]);

  // Tatil tooltip mesajı
  const getHolidayTooltip = (holidayId: string): string | undefined => {
    if (holidayId === "1-mayis") {
      return "Bu tatil 22.04.2009 sonrası yıllarda geçerlidir.";
    }
    
    if (holidayId === "15-temmuz") {
      return "Bu tatil 29.10.2016 sonrası yıllarda geçerlidir.";
    }
    
    return undefined;
  };

  // Tümünü seç / Tümünü kaldır
  const handleToggleAllHolidays = () => {
    const newValue = !areAllSelected;
    if (newValue) {
      // Tümünü seç
      setSelectedHolidayIds(allHolidaysList.map(h => h.id));
    } else {
      // Tümünü kaldır
      setSelectedHolidayIds([]);
    }
  };

  // Seçili tatillerin toplam gün sayısı
  // totalDays artık useState olarak tanımlandı ve backend'den geliyor

  // UBGT hesaplama tablosu (çoklu çalışma dönemlerini destekler)
  // Backend'den hesaplanmış veriler (hesapla butonuna basılınca doldurulur)
  const [totalDays, setTotalDays] = useState<number>(0);
  const [ubgtTotalBrut, setUbgtTotalBrut] = useState<number>(0);

  // Düzenlenebilir satırlar (UBGT sayfasına özel)
  const [ubgtRows, setUbgtRows] = useState<UbgtTableRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);

  // Net/mahsuplaşma özetleri (child'dan alınır)
  const [ubgtNetSummary, setUbgtNetSummary] = useState<{ brut: number; ssk: number; gelir: number; damga: number; net: number; hakkaniyet: number; settleAmount: string }>({ brut: 0, ssk: 0, gelir: 0, damga: 0, net: 0, hakkaniyet: 0, settleAmount: "" });
  
  // Mahsuplaşma modal verileri
  const [ubgtMahsuplasamaData, setUbgtMahsuplasamaData] = useState<{ [year: number]: { [holidayName: string]: number } }>({});

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      // Yükleme başladığında flag'i set et
      isLoadingFromSavedRef.current = true;
      
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      
      const response = await fetch(`${API_BASE_URL}/api/saved-cases/${loadId}`, {
        headers: {
          "x-tenant-id": String(tenantId)
        }
      });
      
      // Response'un JSON olup olmadığını kontrol et
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Kayıt bulunamadı (ID: ${loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
        }
        throw new Error(data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`);
      }
      
      // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
      // data field'ı JSON string olabilir veya object olabilir
      let payload = {};
      
      if (data.data) {
        // data field'ı string ise parse et
        if (typeof data.data === 'string') {
          try {
            payload = JSON.parse(data.data);
          } catch {
            payload = {};
          }
        } else {
          payload = data.data;
        }
      }
      
      return {
        data: payload, // Orijinal payload'ı da döndür
        formValues: payload.form || payload.formValues || payload,
        name: data.name || data.notes || data.aciklama || "",
        start_date: data.start_date || payload.start_date || payload.startDate,
        end_date: data.end_date || payload.end_date || payload.endDate,
        notes: data.notes || data.aciklama || "",
        brut_total: data.brut_total || payload.brut_total || payload.totalBrut,
        net_total: data.net_total || payload.net_total || payload.totalNet,
      };
    } catch (err: any) {
      console.error('Kayıt yükleme hatası:', err);
      throw err;
    }
  };

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    if (!id) return;
    // ID değiştiğinde (farklı kayıt veya yenileme) her zaman yükle
    loadRanRef.current = false;

    let isMounted = true;

    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;

        const data = await loadCalculation(id);
        if (!isMounted) return;

        // Form: backend data = { form, results, ... }; loadCalculation returns formValues = payload.form
        const rawPayload = data.data || {};
        const formData = data.formValues || rawPayload.form || rawPayload.data?.form || rawPayload.formValues || {};
        const loadedDavaciDateRanges = formData.davaciDateRanges || formData.workerPeriods;
        const loadedWitnesses = formData.witnesses || [];
        // excludedWeekdays: array of numbers (0=Pazar .. 6=Cumartesi), normalize from saved value
        const rawExcluded = formData.excludedWeekdays;
        const loadedExcludedWeekdays = Array.isArray(rawExcluded)
          ? rawExcluded.map((d: unknown) => Number(d)).filter((n: number) => !Number.isNaN(n) && n >= 0 && n <= 6)
          : [];
        const loadedExcludedWeekdayHolidays = formData.excludedWeekdayHolidays || [];
        const loadedUbgtExcludedDays = formData.ubgtExcludedDays || formData.excludedDays || [];
        const loadedUbgtExclusionRules = formData.ubgtExclusionRules || [];
        const loadedUbgtExpiryStart = formData.ubgtExpiryStart || formData.zamanasimi?.start || data.zamanasimi?.start || null;
        const loadedPeriods = formData.periods || data.periods || [];
        const loadedSettlement = formData.settlement || data.settlement || {};
        
        console.log("[Bilirkişi UBGT] Parsed data:", {
          loadedDavaciDateRanges,
          loadedWitnesses,
          loadedExcludedWeekdays,
          loadedUbgtExcludedDays,
          loadedUbgtExpiryStart,
          loadedPeriods
        });
        
        // State'leri güncelle - Eski kayıtlar için normalize et
        if (loadedDavaciDateRanges && Array.isArray(loadedDavaciDateRanges) && loadedDavaciDateRanges.length > 0) {
          // selectedHolidayIds yoksa ekle
          const normalizedRanges = loadedDavaciDateRanges.map(range => ({
            id: range.id || Date.now().toString(),
            start: range.start || "",
            end: range.end || "",
            selectedHolidayIds: range.selectedHolidayIds || []
          }));
          console.log("[Bilirkişi UBGT] Setting davaciDateRanges:", normalizedRanges);
          setDavaciDateRanges(normalizedRanges);
        } else {
          console.log("[Bilirkişi UBGT] No davaciDateRanges to load");
        }
        
        if (loadedWitnesses && Array.isArray(loadedWitnesses) && loadedWitnesses.length > 0) {
          // dateRange ve selectedHolidayIds yoksa ekle
          const normalizedWitnesses = loadedWitnesses.map((witness, idx) => ({
            id: witness.id || Date.now().toString() + `-w${idx}`,
            name: witness.name || `Tanık ${idx + 1}`,
            dateRange: {
              id: witness.dateRange?.id || Date.now().toString() + `-d${idx}`,
              start: witness.dateRange?.start || "",
              end: witness.dateRange?.end || "",
              selectedHolidayIds: witness.dateRange?.selectedHolidayIds || []
            }
          }));
          console.log("[Bilirkişi UBGT] Setting witnesses:", normalizedWitnesses);
          setWitnesses(normalizedWitnesses);
        } else {
          console.log("[Bilirkişi UBGT] No witnesses to load");
        }
        
        // Hafta tatilini dışla seçimleri (Cumartesi=6 vb.) - her zaman uygula
        setExcludedWeekdays(loadedExcludedWeekdays);
        // Dışlanan tatil günleri listesi (hesaplama sonrası backend'den gelen liste - sayfa yenileyince göstermek için)
        if (Array.isArray(loadedExcludedWeekdayHolidays) && loadedExcludedWeekdayHolidays.length > 0) {
          setBackendExcludedList(loadedExcludedWeekdayHolidays);
        }
        
        if (loadedUbgtExcludedDays && Array.isArray(loadedUbgtExcludedDays)) {
          console.log("[Bilirkişi UBGT] Setting ubgtExcludedDays:", loadedUbgtExcludedDays);
          setUbgtExcludedDays(loadedUbgtExcludedDays);
        }
        if (loadedUbgtExclusionRules && Array.isArray(loadedUbgtExclusionRules)) {
          setUbgtExclusionRules(loadedUbgtExclusionRules);
        }
        if (loadedUbgtExpiryStart) {
          console.log("[Bilirkişi UBGT] Setting ubgtExpiryStart:", loadedUbgtExpiryStart);
          setUbgtExpiryStart(loadedUbgtExpiryStart);
        }
        
        if (loadedPeriods && Array.isArray(loadedPeriods)) {
          console.log("[Bilirkişi UBGT] Setting ubgtRows:", loadedPeriods);
          setUbgtRows(loadedPeriods);
        }
        
        if (loadedSettlement && Object.keys(loadedSettlement).length > 0) {
          console.log("[Bilirkişi UBGT] Setting mahsuplasama:", loadedSettlement.mahsuplasamaData);
          setUbgtMahsuplasamaData(loadedSettlement.mahsuplasamaData || {});
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || null);
        
        // Yükleme tamamlandı, bir sonraki render'da flag'i false yap
        // (state güncellemelerinin tamamlanması için)
        setTimeout(() => {
          isLoadingFromSavedRef.current = false;
        }, 100);
        
        console.log("[Bilirkişi UBGT] Load completed successfully!");
        success(`Kayıt yüklendi (#${id})`);
      } catch (err) {
        // Hata durumunda da flag'i false yap
        isLoadingFromSavedRef.current = false;
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError("Kayıt yüklenemedi");
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Artık ubgtTableData yok, backend'den geldiğinde ubgtRows'u güncelleyeceğiz

  // İlk yüklemede localStorage'dan verileri al
  useEffect(() => {
    // LocalStorage yüklemesi kaldırıldı; veriler backend'den listeler sayfasında çekilecektir
  }, []);

  const recalcRow = (row: UbgtTableRow): UbgtTableRow => {
    const step1 = Number(((row.wage ?? 0) * (row.coefficient ?? 1)).toFixed(6));
    const dailyWage = Number((step1 / 30).toFixed(6));
    const step2 = Number((dailyWage * (row.ubgtDays ?? 0)).toFixed(6));
    const ubgtTotal = Number(step2.toFixed(2));
    return { ...row, dailyWage, ubgtTotal };
  };

  // Boş satır oluşturma (diğer sayfalarla aynı yapı)
  const createManualRow = useCallback((): UbgtTableRow => {
    return {
      period: "",
      wage: 0,
      coefficient: 1,
      dailyWage: 0,
      ubgtDays: 0,
      ubgtTotal: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
  }, []);

  // UBGT dışlama kuralları değişince nihai listeden yeniden filtrele (API çağrılmaz; tanık mantığı aynı kalır)
  useEffect(() => {
    if (ubgtDayEntriesList.length === 0) return;
    const filtered = filterExcludedUbgtHolidaysByRules(ubgtDayEntriesList, ubgtExclusionRules);
    const daysByPeriod: Record<number, number> = {};
    filtered.forEach((e) => {
      const idx = e.periodIndex ?? 0;
      daysByPeriod[idx] = (daysByPeriod[idx] ?? 0) + e.days;
    });
    setUbgtRows((prev) => {
      const next = prev.map((row, idx) =>
        recalcRow({ ...row, ubgtDays: daysByPeriod[idx] ?? row.ubgtDays ?? 0 })
      );
      const newTotalDays = next.reduce((s, r) => s + (r.ubgtDays ?? 0), 0);
      const newTotalBrut = next.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0);
      setTotalDays(newTotalDays);
      setUbgtTotalBrut(newTotalBrut);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubgtExclusionRules]);

  // Altına yeni boş satır ekleme (satır kopyalamaz)
  const duplicateRow = useCallback((i: number) => {
    setUbgtRows((prev) => {
      const copy = [...prev];
      const newRow = recalcRow(createManualRow());
      copy.splice(i + 1, 0, newRow);
      return copy;
    });
  }, [createManualRow]);

  // Satır silme (en az 1 satır kalmalı)
  const deleteRow = useCallback((i: number) => {
    setUbgtRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  const handleWageChange = (index: number, value: string) => {
    // TL işaretini, nokta ve virgülü temizle
    const cleaned = value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    const wage = Number(cleaned) || 0;
    setUbgtRows(prev => prev.map((r, i) => i === index ? recalcRow({ ...r, wage }) : r));
  };

  const applyGlobalCoefficient = (k: number) => {
    // Standart Fazla Mesai mantığı: Number((value).toFixed(4))
    const fixed = Number(k.toFixed(4));
    setUbgtRows(prev => prev.map(r => recalcRow({ ...r, coefficient: fixed })));
    setHasCustomKatsayi(fixed !== 1);
  };

  const handleResetKatsayi = () => {
    setUbgtRows(prev => prev.map(r => recalcRow({ ...r, coefficient: 1 })));
    setHasCustomKatsayi(false);
  };

  // Toplamı düzenlenebilir satırlardan hesapla
  const ubgtTotalBrutFromRows = useMemo(() => ubgtRows.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0), [ubgtRows]);

  const handleSave = () => {
    try {
      const katsayi = ubgtRows.length > 0 ? ubgtRows[0].coefficient : 1;

      // Tarih aralığı özetleri - Bilirkişi UBGT için davaciDateRanges ve witnesses kullan
      const allDateRanges = [
        ...davaciDateRanges,
        ...witnesses.map(w => w.dateRange)
      ];
      const startDate = allDateRanges
        .filter(r => r.start)
        .map(r => new Date(r.start).getTime())
        .sort((a,b)=>a-b)[0];
      const endDate = allDateRanges
        .filter(r => r.end)
        .map(r => new Date(r.end).getTime())
        .sort((a,b)=>b-a)[0];

      const startDateStr = startDate ? new Date(startDate).toISOString().slice(0,10) : null;
      const endDateStr = endDate ? new Date(endDate).toISOString().slice(0,10) : null;

      // Debug: Kaydedilecek verileri logla
      console.log("[Bilirkişi UBGT] Kaydediliyor:", {
        ubgtExpiryStart,
        ubgtRows: ubgtRows.map(r => ({
          period: r.period,
          wage: r.wage,
          coefficient: r.coefficient,
          dailyWage: r.dailyWage,
          ubgtDays: r.ubgtDays,
          ubgtTotal: r.ubgtTotal,
          startISO: r.startISO,
          endISO: r.endISO,
          manual: r.manual
        })),
        ubgtExcludedDays
      });

      const ubgtData = {
        periods: ubgtRows, // Manuel değişiklikler dahil tüm satırlar (wage, coefficient, ubgtDays, startISO, endISO, manual dahil)
        totalBrut: ubgtTotalBrutFromRows,
        totalNet: ubgtNetSummary.net,
        netConversion: ubgtNetSummary,
        settlement: {
          hakkaniyet: ubgtNetSummary.hakkaniyet,
          settleAmount: ubgtNetSummary.settleAmount,
          sonuc: Math.max(0, ubgtNetSummary.brut - ubgtNetSummary.hakkaniyet),
          mahsuplasamaData: ubgtMahsuplasamaData,
        },
        workerPeriods: allDateRanges, // Davacı ve tanık tarih aralıkları
        selectedHolidays: [], // Bilirkişi UBGT'de her tarih aralığının kendi tatilleri var
        calculatedUbgtDays: totalDays,
        katsayi,
        zamanasimi: { active: !!ubgtExpiryStart, start: ubgtExpiryStart }, // Zamanaşımı bilgisi
        excludedDays: ubgtExcludedDays,
        startDate: startDateStr,
        endDate: endDateStr,
        notes: "",
      };

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "ubgt_bilirkisi",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              davaciDateRanges,
              witnesses,
              excludedWeekdays,
              excludedWeekdayHolidays: backendExcludedList, // Dışlanan tatil günleri listesi (sayfa yenileyince göstermek için)
              ubgtExcludedDays,
              ubgtExclusionRules, // Yıl + UBGT günü dışlama kuralları
              ubgtExpiryStart,
              periods: ubgtRows,
              katsayi,
              calculatedUbgtDays: totalDays,
              settlement: ubgtData.settlement,
            },
            results: {
              totals: { brut: ubgtTotalBrutFromRows, net: ubgtNetSummary.net },
              brut: ubgtTotalBrutFromRows,
              net: ubgtNetSummary.net,
              netConversion: ubgtNetSummary,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          start_date: startDateStr,
          end_date: endDateStr,
          brut_total: ubgtTotalBrutFromRows,
          net_total: ubgtNetSummary.net,
          notes: "",
          ...ubgtData,
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/ubgt-bilirkisi/:id`,
      });
    } catch (e) {
      console.error("[Bilirkişi UBGT] Kayıt hatası:", e);
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = 
        davaciDateRanges.some(r => r.start || r.end) || 
        witnesses.some(w => w.dateRange.start || w.dateRange.end) ||
        ubgtRows.length > 0;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setDavaciDateRanges([{ id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] }]);
      setWitnesses([{
        id: Date.now().toString(),
        name: "Tanık 1",
        dateRange: { id: Date.now().toString() + "-1", start: "", end: "", selectedHolidayIds: [] },
      }]);
      setExcludedWeekdays([]);
      setUbgtExpiryStart(null);
      setUbgtExcludedDays([]);
      setUbgtRows([]);
      setUbgtMahsuplasamaData({});
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/ubgt-bilirkisi";
      }
    } catch {}
  };

  // handlePrint artık gerekli değil - FooterActions previewButton ile otomatik yazdırıyor

  // UBGT Zamanaşımı iptal handler
  const handleUbgtExpiryCancel = () => {
    info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
  };

  // YENİ RAPOR SİSTEMİ: BaseReportModal Config
  const ubgtBilirkisiReportConfig = useMemo((): ReportConfig => {
    const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ubgtFirstStart = dateRanges.length > 0 ? dateRanges[0].start : "";
    const ubgtLastEnd = dateRanges.length > 0 ? dateRanges[dateRanges.length - 1].end : "";
    const ubgtTotalAmount = ubgtRows.reduce((sum, row) => sum + row.ubgtTotal, 0);

    // Dışlanabilir Günler için tablo
    const excludedDaysRows = ubgtExcludedDays.map(day => [
      day.type,
      new Date(day.start).toLocaleDateString("tr-TR"),
      new Date(day.end).toLocaleDateString("tr-TR"),
      day.days.toString(),
    ]);

    return {
      title: "Bilirkişi UBGT Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: ubgtFirstStart || "-" },
        { label: "İşten Çıkış Tarihi", value: ubgtLastEnd || "-" },
        { label: "Seçilen Tatil Sayısı", value: `${selectedHolidayIds.length} adet`, condition: selectedHolidayIds.length > 0 },
        { label: "Toplam UBGT Günü", value: `${totalDays} gün`, condition: totalDays > 0 },
        { 
          label: "Zamanaşımı Başlangıç Tarihi", 
          value: ubgtExpiryStart ? new Date(ubgtExpiryStart).toLocaleDateString("tr-TR") : "-", 
          condition: !!ubgtExpiryStart 
        },
      ],
      customSections: ubgtExcludedDays.length > 0 ? [
        {
          title: "Dışlanabilir Günler",
          condition: true,
          content: (
            <>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #999',
                fontSize: '10px',
              }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Tür</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Başlangıç</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bitiş</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Gün Sayısı</th>
                  </tr>
                </thead>
                <tbody>
                  {excludedDaysRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[0]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[1]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[2]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <tr>
                    <td colSpan={3} style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      TOPLAM
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      {ubgtExcludedDays.reduce((sum, day) => sum + day.days, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          ),
        },
      ] : [],
      periodData: {
        title: "UBGT Hesaplama Cetveli",
        headers: ["Dönem", "Ücret (BRÜT)", "Katsayı", "Günlük Ücret", "UBGT Günleri", "UBGT Ücreti"],
        rows: ubgtRows.map(row => [
          row.period,
          `${fmt(row.wage || 0)} ₺`,
          (row.coefficient || 1).toFixed(4),
          `${fmt(row.dailyWage || 0)} ₺`,
          (row.ubgtDays || 0).toString(),
          `${fmt(row.ubgtTotal || 0)} ₺`,
        ]),
        footer: [
          "Toplam UBGT Ücreti:",
          "",
          "",
          "",
          "",
          `${fmt(ubgtTotalAmount)} ₺`,
        ],
        alignRight: [1, 2, 3, 4, 5],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt UBGT Alacağı", value: `${fmt(ubgtNetSummary.brut)} ₺` },
          { label: "SGK İşçi Primi (%15)", value: `-${fmt(ubgtNetSummary.ssk)} ₺`, isDeduction: true },
          { label: "Gelir Vergisi", value: `-${fmt(ubgtNetSummary.gelir)} ₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmt(ubgtNetSummary.damga)} ₺`, isDeduction: true },
          { label: "Net UBGT Alacağı", value: `${fmt(ubgtNetSummary.net)} ₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Net UBGT Alacağı", value: `${fmt(ubgtNetSummary.net)} ₺` },
          { label: "1/3 Hakkaniyet İndirimi", value: `-${fmt(ubgtNetSummary.hakkaniyet)} ₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmt(Math.max(0, ubgtNetSummary.net - ubgtNetSummary.hakkaniyet))} ₺`,
        },
      },
    };
  }, [ubgtRows, ubgtNetSummary, dateRanges, totalDays, ubgtExcludedDays, selectedHolidayIds, ubgtExpiryStart]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (ubgtBilirkisiReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (ubgtExcludedDays.length > 0) {
      const excludedRows = ubgtExcludedDays.map((day) => [
        day.type,
        new Date(day.start).toLocaleDateString("tr-TR"),
        new Date(day.end).toLocaleDateString("tr-TR"),
        day.days.toString(),
      ]);
      const n2 = adaptToWordTable({
        headers: ["Tür", "Başlangıç", "Bitiş", "Gün Sayısı"],
        rows: excludedRows,
      });
      sections.push({ id: "dislanabilir-gunler", title: "Dışlanabilir Günler", html: buildWordTable(n2.headers, n2.rows) });
    }

    const pd = ubgtBilirkisiReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n3 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "ubgt-hesaplama-cetveli", title: pd.title || "UBGT Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = ubgtBilirkisiReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = ubgtBilirkisiReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [ubgtBilirkisiReportConfig, ubgtExcludedDays]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("ubgt-bilirkisi-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = ubgtBilirkisiReportConfig.title;
    const contentHtml = targetEl.innerHTML;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${contentHtml}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  }, [ubgtBilirkisiReportConfig.title]);

  return (
    <Layout
      title={PAGE_TITLE}
      description="Bilirkişi UBGT Alacağı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="ubgt-bilirkisi"
      noBackgroundColor={true}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tam sayfa layout - tek sütun */}
        <div className="w-full space-y-6">
            {/* Tarih Aralıkları - Davacı ve Tanıklar */}
            <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <CardContent className="space-y-4 pt-2 pb-6">
              {/* Butonlar */}
              <div className="flex items-center justify-end gap-2">
                  {videoLink && (
                    <Button
                      onClick={() => window.open(videoLink, "_blank")}
                      variant="outline"
                      size="sm"
                      className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      <Youtube className="h-4 w-4" />
                      Kullanım Videosu İzle
                    </Button>
                  )}
                </div>

              {/* Davacı */}
              <div className="space-y-3">
                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">Davacı</h3>
                {davaciDateRanges.map((range) => (
                <div
                  key={range.id}
                  className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                      Başlangıç
                    </Label>
                    <Input
                      type="date"
                      className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      value={range.start}
                      onChange={(e) => {
                        let value = e.target.value;
                        // Yıl kısmını 4 karakterle sınırla
                        if (value && value.includes('-')) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            value = parts.join('-');
                            e.target.value = value;
                          }
                        }
                        handleUpdateDavaciDateRange(range.id, "start", value);
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        let value = target.value;
                        if (value && value.includes('-')) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            value = parts.join('-');
                            target.value = value;
                            handleUpdateDavaciDateRange(range.id, "start", value);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && range.end && /^\d{4}-\d{2}-\d{2}$/.test(range.end)) {
                          const newDate = new Date(newValue);
                          const endDate = new Date(range.end);
                          if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                            showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                          }
                        }
                      }}
                      max="9999-12-31"
                    />
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 mt-6">—</span>
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                      Bitiş
                    </Label>
                    <Input
                      type="date"
                      className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      value={range.end}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value && value.includes('-')) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            value = parts.join('-');
                            e.target.value = value;
                          }
                        }
                        handleUpdateDavaciDateRange(range.id, "end", value);
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        let value = target.value;
                        if (value && value.includes('-')) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            value = parts.join('-');
                            target.value = value;
                            handleUpdateDavaciDateRange(range.id, "end", value);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && range.start && /^\d{4}-\d{2}-\d{2}$/.test(range.start)) {
                          const newDate = new Date(newValue);
                          const startDate = new Date(range.start);
                          if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                            showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                          }
                        }
                      }}
                      max="9999-12-31"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDavaciDateRange(range.id)}
                    disabled={davaciDateRanges.length <= 1}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 mt-6"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                  onClick={handleAddDavaciDateRange}
                  className="w-full sm:w-auto font-semibold rounded-full text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 dark:border-blue-600 dark:hover:border-blue-500 dark:text-blue-400"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Tarih Aralığı Ekle
                </Button>
              </div>

              {/* Tanıklar */}
              {witnesses.map((witness, witnessIndex) => (
                <div key={witness.id} className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Input
                      value={witness.name}
                      onChange={(e) => handleUpdateWitnessName(witness.id, e.target.value)}
                      placeholder={`Tanık ${witnessIndex + 1}`}
                      className="font-semibold text-base max-w-[240px] h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveWitness(witness.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Sil
                    </Button>
                  </div>
                  
                  {/* Tanık için tek tarih aralığı */}
                  <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                        Başlangıç
                      </Label>
                      <Input
                        type="date"
                        className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        value={witness.dateRange.start}
                        onChange={(e) => handleUpdateWitnessDateRange(witness.id, witness.dateRange.id, "start", e.target.value)}
                        max="9999-12-31"
                      />
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 mt-6">—</span>
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                        Bitiş
                      </Label>
                      <Input
                        type="date"
                        className="rounded-xl h-11 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        value={witness.dateRange.end}
                        onChange={(e) => handleUpdateWitnessDateRange(witness.id, witness.dateRange.id, "end", e.target.value)}
                        max="9999-12-31"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Yeni Tanık Ekle Butonu */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddWitness}
                className="w-full sm:w-auto font-semibold rounded-full text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 dark:border-green-600 dark:hover:border-green-500 dark:text-green-400"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Tanık Ekle
              </Button>
            </CardContent>
          </Card>

          {/* Tatil Kategorileri - Akordiyon */}
          <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base fade-section">Tatil Seçimi</CardTitle>
              <CardDescription>Her kişi için ayrı tatil seçimi yapın</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Davacı Tatil Seçimi — Standart UBGT ile aynı kompakt UI */}
              <UbgtHolidaySelectCompact
                title="Davacı - Tatil Seçimi"
                holidays={STATIC_HOLIDAYS}
                selectedHolidayIds={davaciSelectedHolidayIds}
                onSelectionChange={(id, checked) => handleDavaciHolidayCheckboxChange(id, checked)}
                onToggleAll={handleDavaciToggleAllHolidays}
                areAllSelected={allHolidaysList.length > 0 && allHolidaysList.every((h) => davaciSelectedHolidayIds.includes(h.id))}
                getHolidayTooltip={getHolidayTooltip}
              />

              {/* Tanıklar Tatil Seçimi — Standart UBGT ile aynı kompakt UI */}
              {witnesses.map((witness) => (
                <UbgtHolidaySelectCompact
                  key={witness.id}
                  title={`${witness.name} - Tatil Seçimi`}
                  holidays={STATIC_HOLIDAYS}
                  selectedHolidayIds={witness.dateRange.selectedHolidayIds}
                  onSelectionChange={(id, checked) => handleWitnessHolidayChange(witness.id, id, checked)}
                  onToggleAll={() => handleWitnessToggleAllHolidays(witness.id)}
                  areAllSelected={allHolidaysList.length > 0 && allHolidaysList.every((h) => witness.dateRange.selectedHolidayIds.includes(h.id))}
                  getHolidayTooltip={getHolidayTooltip}
                />
              ))}

              {/* Global Hafta Tatilini Dışla */}
              <div className="border rounded-lg overflow-hidden mt-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Hafta Tatilini Dışla
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Seçilen günler tatil hesaplamalarından dışlanır (tüm tarih aralıkları için geçerli)
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900">
                  <div className="flex flex-wrap gap-3">
                    {[
                      { name: "Pazartesi", index: 1 },
                      { name: "Salı", index: 2 },
                      { name: "Çarşamba", index: 3 },
                      { name: "Perşembe", index: 4 },
                      { name: "Cuma", index: 5 },
                      { name: "Cumartesi", index: 6 },
                      { name: "Pazar", index: 0 },
                    ].map((day) => (
                      <label
                        key={day.index}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-all hover:border-amber-400 dark:hover:border-amber-600"
                      >
                        <Checkbox
                          checked={excludedWeekdays.includes(day.index)}
                          onCheckedChange={(checked) =>
                            handleWeekdayExclude(day.index, checked === true)
                          }
                        />
                        <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                          {day.name}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Dışlanan Tatil Günleri Listesi */}
                  {excludedDaysList.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Dışlanan Tatil Günleri ({excludedDaysList.reduce((sum, item) => sum + item.duration, 0)} gün)
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Hafta tatili dışlaması ile hesaplamadan çıkarılan günler (Ramazan ve Kurban bayramları dahil)
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {excludedDaysList.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded text-xs border border-red-200 dark:border-red-800"
                          >
                            <div className="flex-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {new Date(item.date + 'T00:00:00').toLocaleDateString('tr-TR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} - {item.dayName}
                              </span>
                              <span className="ml-2 text-blue-600 dark:text-blue-400">
                                ({item.holidayName})
                              </span>
                            </div>
                            <span className="text-red-600 dark:text-red-400 ml-2 font-semibold">
                              -{item.duration} gün
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toplam UBGT günü (hesaplama sonrası) */}
              {(davaciSelectedHolidayIds.length > 0 || witnesses.some((w) => w.dateRange.selectedHolidayIds.length > 0)) && totalDays > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Hesaplanan UBGT toplamı
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {totalDays} gün
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dışlanabilir Günler */}
          <UbgtExcludeDays
            ubgtExcludedDays={ubgtExcludedDays}
            onUbgtExcludedDaysChange={setUbgtExcludedDays}
          />

          {/* UBGT Hesabından Dışlanacak Günler (Yıl + UBGT günü; tanık sonrası nihai listede uygulanır) */}
          <UbgtExclusionCompactUI
            dateRanges={davaciDateRanges.map((r) => ({ start: r.start, end: r.end }))}
            ubgtDayEntries={ubgtDayEntriesList}
            ubgtExclusionRules={ubgtExclusionRules}
            setUbgtExclusionRules={setUbgtExclusionRules}
          />

        {/* UBGT Hesaplama Tablosu */}
          <Card className="w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="w-full max-w-full">
                <CardTitle className="text-xl fade-section">UBGT Hesaplama Tablosu</CardTitle>
                <CardDescription className="text-red-600">
                  Katsayı hesapla butonu ile katsayınızı hesaplayabilirsiniz; bulunan katsayı otomatik olarak hesap tablosuna eklenecektir. Ücret (BRÜT) sütunu istenilirse ücretler bağımsız giriş yapılabilir.
                  <br />
                  Hesaplama (ücret X katsayı / 30 X UBGT günleri = UBGT ücreti) olarak yapılıyor.
                </CardDescription>
              </div>
              {/* ZARİF BUTONLAR - HESAPLAMA KURALLARI */}
              <div className="flex flex-wrap justify-end gap-3 mt-4 w-full">
                <div className="flex items-center gap-3 flex-wrap">
                  <UbgtExpiryBox
                    ubgtExpiryStart={ubgtExpiryStart}
                    onUbgtExpiryStartChange={setUbgtExpiryStart}
                    onUbgtExpiryCancel={handleUbgtExpiryCancel}
                    iseGiris={davaciDateRanges.map((r) => r.start).filter(Boolean).sort()[0] || undefined}
                  />
                  {/* KATSAYI - ZARİF BUTON */}
                  <button
                    type="button"
                    onClick={() => setShowKatsayiModal(true)}
                    className={`inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                      hasCustomKatsayi
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md hover:from-green-600 hover:to-emerald-700"
                        : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50 hover:text-green-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-green-500 dark:hover:bg-gray-700"
                    }`}
                  >
                    {hasCustomKatsayi && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span>{hasCustomKatsayi ? "Katsayı" : "Kat Sayı Hesapla"}</span>
                  </button>
                  {hasCustomKatsayi && (
                    <button
                      type="button"
                      onClick={handleResetKatsayi}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Katsayıyı kaldır"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ubgtExpiryStart && ubgtRows.length > 0 && (
                <div className="mb-4 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                  Zamanaşımı başlangıç tarihi: {format(new Date(ubgtExpiryStart), "dd.MM.yyyy")} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
                </div>
              )}
              {ubgtRows.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table
                    className="w-full border-collapse text-sm"
                    style={{ border: "1px solid #d2d2d2" }}
                  >
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="text-left font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          Tarih (Ücret Dönemi)
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          Ücret (BRÜT) (₺)
                        </th>
                        <th className="text-center font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          Katsayı
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          UBGT Günleri
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          UBGT Ücreti
                        </th>
                        <th className="border-0 bg-transparent w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ubgtRows.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                          onMouseEnter={() => setHoveredRow(index)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <div className="flex gap-1 items-center">
                                <input
                                  type="date"
                                  value={row.startISO || ""}
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setUbgtRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const endISO = r.endISO || "";
                                      // Yeni period string'i oluştur
                                      const startFormatted = newStart ? new Date(newStart).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = endISO ? new Date(endISO).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      // UBGT günlerini yeniden hesapla
                                      let newUbgtDays = r.ubgtDays;
                                      if (newStart && endISO) {
                                        newUbgtDays = getUbgtDaysForPeriod(newStart, endISO, selectedHolidayIds, ubgtExcludedDays);
                                      }
                                      const ubgtTotal = Number((r.dailyWage * newUbgtDays).toFixed(2));
                                      return { ...r, startISO: newStart, period: newPeriod, ubgtDays: newUbgtDays, ubgtTotal };
                                    }));
                                  }}
                                  className="w-28 bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-xs"
                                />
                                <span>-</span>
                                <input
                                  type="date"
                                  value={row.endISO || ""}
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setUbgtRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const startISO = r.startISO || "";
                                      // Yeni period string'i oluştur
                                      const startFormatted = startISO ? new Date(startISO).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = newEnd ? new Date(newEnd).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      // UBGT günlerini yeniden hesapla
                                      let newUbgtDays = r.ubgtDays;
                                      if (startISO && newEnd) {
                                        newUbgtDays = getUbgtDaysForPeriod(startISO, newEnd, selectedHolidayIds, ubgtExcludedDays);
                                      }
                                      const ubgtTotal = Number((r.dailyWage * newUbgtDays).toFixed(2));
                                      return { ...r, endISO: newEnd, period: newPeriod, ubgtDays: newUbgtDays, ubgtTotal };
                                    }));
                                  }}
                                  className="w-28 bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-xs"
                                />
                              </div>
                            ) : (
                              row.period
                            )}
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            <span className="inline-flex items-center justify-end gap-1 w-full">
                              <input
                                type="text"
                                value={row.wage ? (row.wage.toString().replace('.', ',')) : ''}
                                onChange={(e) => {
                                  // Kullanıcı yazarken raw değeri al ve state'i anında güncelle
                                  // Virgülü noktaya çevir, noktaları kaldır (binlik ayırıcı), TL işaretini kaldır
                                  const raw = e.target.value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                                  handleWageChange(index, raw);
                                }}
                                className="flex-1 min-w-0 text-right bg-transparent outline-none border border-transparent focus:border-gray-300 rounded px-2 py-1"
                              />
                              <span className="text-gray-600 dark:text-gray-400 shrink-0">₺</span>
                            </span>
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-center" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {safeNumber(row.coefficient ?? 1, 4, 4)}
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {safeNumber(row.dailyWage ?? 0, 2)} ₺
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <input
                                type="number"
                                step="0.5"
                                value={row.ubgtDays}
                                onChange={(e) => {
                                  const newDays = Number(e.target.value) || 0;
                                  setUbgtRows((prev) => prev.map((r, i) => {
                                    if (i !== index) return r;
                                    const ubgtTotal = Number((r.dailyWage * newDays).toFixed(2));
                                    return { ...r, ubgtDays: newDays, ubgtTotal };
                                  }));
                                }}
                                className="w-16 text-right bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-sm"
                              />
                            ) : (
                              <>{safeDays(row.ubgtDays)} gün</>
                            )}
                          </td>
                          <td className="font-semibold text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {safeNumber(row.ubgtTotal ?? 0, 2)} ₺
                          </td>
                          {/* Satır ekleme ve silme butonları - sadece hover'da görünür */}
                          <td className="border-0 bg-transparent w-16 p-0">
                            {hoveredRow === index && (
                              <div className="flex gap-1 justify-center items-center">
                                <span
                                  className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer text-lg leading-none"
                                  onClick={() => duplicateRow(index)}
                                  title="Altına yeni boş satır ekle"
                                >
                                  +
                                </span>
                                <span
                                  className="row-delete-icon text-red-500 hover:text-red-600 cursor-pointer text-lg leading-none"
                                  onClick={() => {
                                    if (ubgtRows.length <= 1) return;
                                    deleteRow(index);
                                  }}
                                  style={{ opacity: ubgtRows.length <= 1 ? 0.3 : 1, cursor: ubgtRows.length <= 1 ? 'not-allowed' : 'pointer' }}
                                  title={ubgtRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                                >
                                  −
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <td
                          colSpan={5}
                          className="text-gray-900 dark:text-gray-100 text-right"
                          style={{ padding: "8px", border: "1px solid #d2d2d2" }}
                        >
                          Toplam UBGT Ücreti:
                        </td>
                        <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          {safeNumber(ubgtTotalBrutFromRows, 2)} ₺
                        </td>
                        <td className="border-0 bg-transparent w-16"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Hesaplama yapmak için lütfen tarih aralıkları girin ve tatilleri seçin.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brütten Nete Çevir + Mahsuplaşma - tablonun hemen altında */}
          <div className="w-full mt-8">
            <UbgtNetConversion 
              ubgtBrutTotal={ubgtTotalBrutFromRows} 
              tableData={ubgtRows}
              dateRanges={dateRanges}
              initialMahsuplasamaData={ubgtMahsuplasamaData}
              onSummaryChange={setUbgtNetSummary}
              onMahsuplasamaDataChange={setUbgtMahsuplasamaData}
            />
          </div>
        </div>

        {/* Not Alanı - tam sayfa genişliği */}
        <div className="w-full min-w-0 overflow-x-hidden mt-6 box-border">
          <div className="w-full min-w-0 box-border bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-900/30 dark:to-cyan-900/30 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notlar
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Ulusal Bayram ve Genel Tatil Günleri Hakkında Kanun</p>
            </div>
            <div className="p-6">
              <div className="notes-panel notes-content w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-words text-slate-700 dark:text-slate-300 leading-6" style={{ maxHeight: '500px' }}>
                <p className="mb-3">
                  <strong className="text-gray-900 dark:text-gray-100">Madde 1</strong> – 1923 yılında Cumhuriyetin ilan edildiği 29 Ekim günü Ulusal Bayramdır.
                </p>
                <p className="mb-3">
                  Türkiye'nin içinde ve dışında Devlet adına yalnız bugün tören yapılır. Bayram 28 Ekim günü saat 13.00'ten itibaren başlar ve 29 Ekim günü devam eder.
                </p>
                <p className="mb-3">
                  <strong className="text-gray-900 dark:text-gray-100">Madde 2</strong> – Aşağıda sayılan resmi ve dini bayram günleri ile yılbaşı günü, 1 Mayıs günü ve 15 Temmuz günü genel tatil günleridir.
                </p>
                <p className="mb-2">
                  <strong className="text-gray-900 dark:text-gray-100">A) Resmi bayram günleri şunlardır:</strong>
                </p>
                <p className="mb-3 pl-4">
                  1. (Değişik: 20/4/1983 - 2818/1 md.) 23 Nisan günü Ulusal Egemenlik ve Çocuk Bayramıdır.<br />
                  2. 19 Mayıs günü Atatürk'ü Anma ve Gençlik ve Spor Bayramı günüdür.<br />
                  3. 30 Ağustos günü Zafer Bayramıdır.
                </p>
                <p className="mb-2">
                  <strong className="text-gray-900 dark:text-gray-100">B) Dini bayramlar şunlardır:</strong>
                </p>
                <p className="mb-3 pl-4">
                  1. Ramazan Bayramı; Arefe günü saat 13.00'ten itibaren 3,5 gündür.<br />
                  2. Kurban Bayramı; Arefe günü saat 13.00'ten itibaren 4,5 gündür.
                </p>
                <p className="mb-3">
                  <strong className="text-gray-900 dark:text-gray-100">C)</strong> (Değişik: 25/10/2016-6752/2 md.) 1 Ocak günü yılbaşı tatili, 1 Mayıs günü Emek ve Dayanışma Günü ve 15 Temmuz günü Demokrasi ve Milli Birlik Günü tatilidir.
                </p>
                <p className="mb-3">
                  <strong className="text-gray-900 dark:text-gray-100">Madde -2</strong> – 22/4/2009 tarihli ve 5892 sayılı Kanunun 1 inci maddesiyle, "yılbaşı günü" ibarelerinden sonra gelmek üzere "ve 1 Mayıs günü" ibaresi eklenmiştir. 25/10/2016 tarihli ve 6752 sayılı Kanunun 2 nci maddesiyle, bu maddenin birinci fıkrasında yer alan "ve 1 Mayıs günü" ibareleri ", 1 Mayıs günü ve 15 Temmuz günü" olarak değiştirilmiştir.
                </p>
                <p className="mb-3">
                  <strong className="text-gray-900 dark:text-gray-100">D)</strong> (Değişik: 20/4/1983 - 2818/1 md.) Ulusal, resmi ve dini bayram günleri ile yılbaşı günü, 1 Mayıs günü ve 15 Temmuz günü resmi daire ve kuruluşlar tatil edilir.
                </p>
                <p className="mb-3">
                  Bu Kanunda belirtilen Ulusal Bayram ve genel tatil günleri; Cuma günü akşamı sona erdiğinde müteakip Cumartesi gününün tamamı tatil yapılır.
                </p>
                <p className="mb-3">
                  Mahiyetleri itibariyle sürekli görev yapması gereken kuruluşların özel kanunlarındaki hükümler saklıdır.
                </p>
                <p>
                  29 Ekim günü özel işyerlerinin kapanması zorunludur.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="ubgt-bilirkisi-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={ubgtBilirkisiReportConfig} />
      </div>

      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <FooterActions 
        onCalculate={handleCalculate}
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        isSaving={isSaving}
        previewButton={{
          title: "Bilirkişi UBGT Alacağı Rapor",
          copyTargetId: "ubgt-bilirkisi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ubgt-bilirkisi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ubgt-bilirkisi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ubgt-bilirkisi-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button type="button" className="copy-icon-btn" onClick={() => copySectionForWord(sec.id)} title="Word'e kopyala">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM("Bilirkişi UBGT Alacağı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
