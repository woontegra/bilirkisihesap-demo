import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { API_BASE_URL } from "@/utils/apiClient";

// İzole sistemler
import { useToast, ToastProvider, Toaster } from "./toast";
import { useHaftaTatiliState, type DateRange, type HaftaTatiliTableRow } from "./state";
import { handleLoadCalculation, prepareSaveData } from "./actions";
import { saveCalculation } from "./save";
// Constants - inline
const PAGE_TITLE = "Standart Hafta Tatili Alacağı";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };

// Tarih dosyaları tatil kontrolü için kullanılacak
import { nationalDays } from "./national-days";
import { officialHolidays } from "./official-holidays";
import { generalHolidays } from "./general-holidays";
import { religiousHolidays } from "./religious-holidays";
import HaftaTatiliExpiryBox from "./HaftaTatiliExpiryBox";
import HaftaTatiliNetConversion from "./HaftaTatiliNetConversion";
import HaftaTatiliExcludeDays from "./HaftaTatiliExcludeDays";
import HaftaTatiliKatsayiModal from "./HaftaTatiliKatsayiModal";
import { format } from "date-fns";
import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Helper fonksiyonlar - inline
const calculateWeekCount = (periodStart: string, periodEnd: string, excludedDays: any[] = []) => {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const diffTime = endDate.getTime() - startDate.getTime();
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const excludedDaysTotal = getExcludedDaysInPeriod(periodStart, periodEnd, excludedDays);
  const remainingDays = Math.max(0, totalDays - excludedDaysTotal);
  return Math.round(remainingDays / 7);
};

// Tarih aralığı çakışmasını hesapla (gün cinsinden)
const calculateDateRangeOverlap = (
  range1Start: string,
  range1End: string,
  range2Start: string,
  range2End: string
): number => {
  const start1 = new Date(range1Start);
  const end1 = new Date(range1End);
  const start2 = new Date(range2Start);
  const end2 = new Date(range2End);

  // Çakışma yoksa 0 dön
  if (end1 < start2 || end2 < start1) {
    return 0;
  }

  // Çakışan aralığı bul
  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;

  // Gün sayısını hesapla
  const diffTime = overlapEnd.getTime() - overlapStart.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, days);
};

// gg.aa formatındaki tarihi parse et (yıl yok)
const parseDayMonth = (dayMonthStr: string): { day: number; month: number } | null => {
  if (!dayMonthStr) return null;
  const parts = dayMonthStr.split(".");
  if (parts.length !== 2) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }
  return { day, month };
};

// Yıl için mevsimsel tarih aralığını oluştur (gg.aa.YIL formatından)
const createSeasonalDateRange = (
  dayMonthStart: { day: number; month: number },
  dayMonthEnd: { day: number; month: number },
  year: number
): { start: string; end: string } | null => {
  try {
    const startDate = new Date(year, dayMonthStart.month - 1, dayMonthStart.day);
    const endDate = new Date(year, dayMonthEnd.month - 1, dayMonthEnd.day);
    
    // Geçersiz tarih kontrolü
    if (startDate.getDate() !== dayMonthStart.day || endDate.getDate() !== dayMonthEnd.day) {
      return null;
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  } catch {
    return null;
  }
};

// Hafta sayısını düşür (mevsimsel kullanım için - her yıl tekrar eden)
const adjustWeekCountForSeasonalUsage = (
  originalWeekCount: number,
  periodStart: string,
  periodEnd: string,
  seasonalStartDayMonth: string, // gg.aa formatı (opsiyonel)
  seasonalEndDayMonth: string, // gg.aa formatı (opsiyonel)
  gunSayisi: number
): number => {
  // Oranı belirle
  const oran = gunSayisi === 4 ? 1.00 : gunSayisi === 3 ? 0.75 : gunSayisi === 2 ? 0.50 : 0.25;

  // EĞER tarih girilmemişse → TÜM satır için oran uygula
  if (!seasonalStartDayMonth || !seasonalEndDayMonth) {
    // Oran 1.00 ise hiçbir değişiklik yapma
    if (oran === 1.00) {
      return originalWeekCount;
    }
    // TÜM hesaplama cetveli satırları için: yeni_hafta = eski_hafta × oran
    return Math.max(0, Math.round(originalWeekCount * oran * 100) / 100);
  }

  // EĞER tarih girilmişse → Mevsimsel dönem mantığı (oran 1.00 olsa bile çalışmalı)
  // gg.aa formatını parse et
  const startDayMonth = parseDayMonth(seasonalStartDayMonth);
  const endDayMonth = parseDayMonth(seasonalEndDayMonth);
  if (!startDayMonth || !endDayMonth) {
    // Parse edilemezse, tüm satır için oran uygula
    if (oran === 1.00) {
      return originalWeekCount;
    }
    return Math.max(0, Math.round(originalWeekCount * oran * 100) / 100);
  }

  // 2. kesisen_hafta hesapla (NORMAL TAKVİM HESABI - gün sayısı / 7)
  // 1 yıl = 52 hafta (365 gün / 7), 1 ay = ~4.33 hafta (30-31 gün / 7)
  // Ay bazlı 4 hafta kuralı kullanılmaz, gerçek gün sayısına göre hesaplanır

  // Satırın kapsadığı yılları tespit et
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  const startYear = periodStartDate.getFullYear();
  const endYear = periodEndDate.getFullYear();

  let toplamKesisenGun = 0;

  // Her yıl için mevsimsel dönemi kontrol et
  for (let year = startYear; year <= endYear; year++) {
    // Bu yıl için mevsimsel tarih aralığını oluştur (gg.aa.YIL – gg.aa.YIL)
    const seasonalRange = createSeasonalDateRange(startDayMonth, endDayMonth, year);
    if (!seasonalRange) continue;

    // Satır tarihleriyle kesişen kısmı bul
    const seasonalStart = new Date(seasonalRange.start);
    const seasonalEnd = new Date(seasonalRange.end);
    const overlapStart = new Date(Math.max(periodStartDate.getTime(), seasonalStart.getTime()));
    const overlapEnd = new Date(Math.min(periodEndDate.getTime(), seasonalEnd.getTime()));

    // Çakışma yoksa atla
    if (overlapStart > overlapEnd) continue;

    // Kesişen kısmın GÜN SAYISINI hesapla (normal takvim hesabı)
    const overlapTime = overlapEnd.getTime() - overlapStart.getTime();
    const overlapDays = Math.floor(overlapTime / (1000 * 60 * 60 * 24)) + 1; // +1 çünkü başlangıç ve bitiş dahil

    if (overlapDays > 0) {
      toplamKesisenGun += overlapDays;
    }
  }

  // kesisen_hafta = kesişen_gun / 7 (normal takvim hesabı)
  const kesisenHafta = toplamKesisenGun / 7;

  // 4. YENİ HAFTA SAYISI FORMÜLÜ:
  // SADECE mevsimsel dönem (15.07-15.10) ile kesişen haftalar kalmalı
  // Kesişmeyen kısımlar tamamen çıkarılır, sadece kesişen kısım kalır
  // Oran 1.00 ise: yeni_hafta = kesisen_hafta × 1.00 = kesisen_hafta (tam hafta sayısı)
  // Oran < 1.00 ise: yeni_hafta = kesisen_hafta × oran (oran uygulanır)
  const yeniHafta = kesisenHafta * oran;

  // Yuvarlama: 0.5'e kadar aşağı, 0.5 ve üstü yukarı
  // Örnek: 13.29 → 13, 13.5 → 14, 13.51 → 14
  const yuvarlanmisHafta = Math.round(yeniHafta);

  // Negatif olamaz
  return Math.max(0, yuvarlanmisHafta);
};

const getExcludedDaysInPeriod = (periodStart: string, periodEnd: string, excludedDays: any[] = []) => {
  if (excludedDays.length === 0) return 0;
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  let excludedDaysInPeriod = 0;
  excludedDays.forEach((exclude) => {
    const excludeStart = new Date(exclude.start);
    const excludeEnd = new Date(exclude.end);
    if (excludeEnd >= periodStartDate && excludeStart <= periodEndDate) {
      const overlapStart = excludeStart > periodStartDate ? excludeStart : periodStartDate;
      const overlapEnd = excludeEnd < periodEndDate ? excludeEnd : periodEndDate;
      const overlapTime = overlapEnd.getTime() - overlapStart.getTime();
      const overlapDays = Math.max(0, Math.floor(overlapTime / (1000 * 60 * 60 * 24)) + 1);
      excludedDaysInPeriod += exclude.days > 0 ? exclude.days : overlapDays;
    }
  });
  return excludedDaysInPeriod;
};

// API_BASE_URL already imported from @/utils/apiClient

// Tatil tipi
type HolidayType = "national" | "official" | "general" | "religious";

// Tatil veri tipi
interface Holiday {
  date: string;
  day: string;
  name: string;
  type: HolidayType;
}

// DateRange artık state.ts'den import ediliyor

// Sabit tatil listesi
interface StaticHoliday {
  id: string;
  name: string;
  days: number;
}

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

// Asgari ücret tablosu (BRÜT ÜCRETLER)
interface MinWageEntry {
  start: string;
  end: string;
  wage: number; // BRÜT ücret
}

const MIN_WAGE_TABLE: MinWageEntry[] = [
  // 2005-2021: Tek dönem (01.01-31.12)
  { start: "2005-01-01", end: "2005-12-31", wage: 488.70 },
  { start: "2006-01-01", end: "2006-12-31", wage: 531.00 },
  // 2007-2015: İki dönem
  { start: "2007-01-01", end: "2007-06-30", wage: 562.50 },
  { start: "2007-07-01", end: "2007-12-31", wage: 585.00 },
  { start: "2008-01-01", end: "2008-06-30", wage: 608.40 },
  { start: "2008-07-01", end: "2008-12-31", wage: 638.70 },
  { start: "2009-01-01", end: "2009-06-30", wage: 693.00 },
  { start: "2009-07-01", end: "2009-12-31", wage: 693.00 },
  { start: "2010-01-01", end: "2010-06-30", wage: 729.00 },
  { start: "2010-07-01", end: "2010-12-31", wage: 760.50 },
  { start: "2011-01-01", end: "2011-06-30", wage: 796.50 },
  { start: "2011-07-01", end: "2011-12-31", wage: 837.00 },
  { start: "2012-01-01", end: "2012-06-30", wage: 886.50 },
  { start: "2012-07-01", end: "2012-12-31", wage: 940.50 },
  { start: "2013-01-01", end: "2013-06-30", wage: 978.60 },
  { start: "2013-07-01", end: "2013-12-31", wage: 1021.50 },
  { start: "2014-01-01", end: "2014-06-30", wage: 1071.00 },
  { start: "2014-07-01", end: "2014-12-31", wage: 1134.00 },
  { start: "2015-01-01", end: "2015-06-30", wage: 1201.50 },
  { start: "2015-07-01", end: "2015-12-31", wage: 1273.50 },
  // 2016-2021: Tek dönem
  { start: "2016-01-01", end: "2016-12-31", wage: 1647.00 },
  { start: "2017-01-01", end: "2017-12-31", wage: 1777.50 },
  { start: "2018-01-01", end: "2018-12-31", wage: 2029.50 },
  { start: "2019-01-01", end: "2019-12-31", wage: 2558.40 },
  { start: "2020-01-01", end: "2020-12-31", wage: 2943.00 },
  { start: "2021-01-01", end: "2021-12-31", wage: 3577.50 },
  // 2022: İki dönem
  { start: "2022-01-01", end: "2022-06-30", wage: 5004.00 },
  { start: "2022-07-01", end: "2022-12-31", wage: 6471.00 },
  // 2023: İki dönem
  { start: "2023-01-01", end: "2023-06-30", wage: 10008.00 },
  { start: "2023-07-01", end: "2023-12-31", wage: 13414.50 },
  // 2024: Tek dönem
  { start: "2024-01-01", end: "2024-12-31", wage: 20002.50 },
  // 2025: Tek dönem
  { start: "2025-01-01", end: "2025-12-31", wage: 26005.50 },
  // 2026: Tek dönem
  { start: "2026-01-01", end: "2026-12-31", wage: 33030.00 },
];

// Hafta Tatili dönemlerini asgari ücret dönemlerine göre üret
function generateHaftaTatiliPeriods(workerStart: string, workerEnd: string): Array<{ start: string; end: string; wage: number }> {
  if (!workerStart || !workerEnd) return [];

  const workerStartDate = new Date(workerStart);
  const workerEndDate = new Date(workerEnd);
  const periods: Array<{ start: string; end: string; wage: number }> = [];

  // Her wage period için kontrol et
  MIN_WAGE_TABLE.forEach((wagePeriod) => {
    const wagePeriodStart = new Date(wagePeriod.start);
    const wagePeriodEnd = new Date(wagePeriod.end);

    // effectiveStart = max(workerStart, wagePeriod.start)
    const effectiveStart = workerStartDate > wagePeriodStart ? workerStartDate : wagePeriodStart;

    // effectiveEnd = min(workerEnd, wagePeriod.end)
    const effectiveEnd = workerEndDate < wagePeriodEnd ? workerEndDate : wagePeriodEnd;

    // Eğer effectiveStart <= effectiveEnd ise tabloya ekle
    if (effectiveStart <= effectiveEnd) {
      periods.push({
        start: effectiveStart.toISOString().split('T')[0],
        end: effectiveEnd.toISOString().split('T')[0],
        wage: wagePeriod.wage, // BRÜT ücret
      });
    }
  });

  return periods;
}

// Dışlanabilir günler hesaplaması artık calculations.ts'den import ediliyor

// Dönem için Hafta Tatili gün sayısını hesapla (dışlanabilir günler dahil)
function getHaftaTatiliDaysForPeriod(
  periodStart: string,
  periodEnd: string,
  selectedHolidayIds: string[],
  excludedDays: Array<{ start: string; end: string; days: number }> = []
): number {
  // Eğer selectedHolidayIds boşsa, tüm tatilleri kullan
  const allHolidayIds = [
    ...STATIC_HOLIDAYS.national.map(h => h.id),
    ...STATIC_HOLIDAYS.official.map(h => h.id),
    ...STATIC_HOLIDAYS.general.map(h => h.id),
    ...STATIC_HOLIDAYS.religious.map(h => h.id),
  ];
  const effectiveHolidayIds = selectedHolidayIds.length === 0 ? allHolidayIds : selectedHolidayIds;
  
  if (effectiveHolidayIds.length === 0) return 0;

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  
  // Dönem içindeki tüm yılları bul
  const startYear = periodStartDate.getFullYear();
  const endYear = periodEndDate.getFullYear();
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }

  // Tüm tatil verilerini birleştir (dini bayramlar için)
  const allHolidays: Holiday[] = [
    ...nationalDays,
    ...officialHolidays,
    ...generalHolidays,
    ...religiousHolidays,
  ];

  let totalDays = 0;

  // Seçili tatil ID'lerine göre kontrol et
  effectiveHolidayIds.forEach((selectedId) => {
    // STATIC_HOLIDAYS'den tatil bilgisini bul
    const allStaticHolidays = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ];
    
    const staticHoliday = allStaticHolidays.find((h) => h.id === selectedId);
    if (!staticHoliday) return;

    // Tatil tipini belirle
    let typeToMatch: HolidayType | null = null;
    if (STATIC_HOLIDAYS.national.some((h) => h.id === selectedId)) typeToMatch = "national";
    else if (STATIC_HOLIDAYS.official.some((h) => h.id === selectedId)) typeToMatch = "official";
    else if (STATIC_HOLIDAYS.general.some((h) => h.id === selectedId)) typeToMatch = "general";
    else if (STATIC_HOLIDAYS.religious.some((h) => h.id === selectedId)) typeToMatch = "religious";

    if (!typeToMatch) return;

    // Her yıl için tatil tarihini kontrol et
    years.forEach((year) => {
      let holidayDate: Date | null = null;

      // Milli, resmi veya genel tatil ise sabit ay-gün kullan
      if (typeToMatch === "national" || typeToMatch === "official" || typeToMatch === "general") {
        // Tatil adından ay ve günü çıkar
        let month = 0;
        let day = 0;

        if (selectedId === "28-ekim") {
          month = 9; // Ekim = 9 (0-based)
          day = 28;
        } else if (selectedId === "29-ekim") {
          month = 9;
          day = 29;
        } else if (selectedId === "23-nisan") {
          month = 3; // Nisan = 3
          day = 23;
        } else if (selectedId === "19-mayis") {
          month = 4; // Mayıs = 4
          day = 19;
        } else if (selectedId === "30-agustos") {
          month = 7; // Ağustos = 7
          day = 30;
        } else if (selectedId === "1-ocak") {
          month = 0; // Ocak = 0
          day = 1;
        } else if (selectedId === "1-mayis") {
          month = 4; // Mayıs = 4
          day = 1;
        } else if (selectedId === "15-temmuz") {
          month = 6; // Temmuz = 6
          day = 15;
        }

        if (day > 0) {
          holidayDate = new Date(year, month, day);
        }
      } else if (typeToMatch === "religious") {
        // Dini bayram için yıla özel tarihi bul
        // Tatil adından hangi dini bayram olduğunu belirle
        const holidayName = staticHoliday.name.toLowerCase();
        const isRamazan = holidayName.includes("ramazan");
        const isKurban = holidayName.includes("kurban");
        const isArife = holidayName.includes("arife");
        
        // Dini bayram verilerinden o yılın tarihini bul
        const yearHolidays = allHolidays.filter((h) => {
          const hYear = new Date(h.date).getFullYear();
          if (hYear !== year) return false;
          if (h.type !== "religious") return false;
          
          const hName = h.name.toLowerCase();
          if (isRamazan && !hName.includes("ramazan")) return false;
          if (isKurban && !hName.includes("kurban")) return false;
          if (isArife && !hName.includes("arife")) return false;
          if (!isArife && hName.includes("arife")) return false;
          
          // Gün numarasını kontrol et
          if (!isArife) {
            if (selectedId === "ramazan-1" && !hName.includes("1. gün")) return false;
            if (selectedId === "ramazan-2" && !hName.includes("2. gün")) return false;
            if (selectedId === "ramazan-3" && !hName.includes("3. gün")) return false;
            if (selectedId === "kurban-1" && !hName.includes("1. gün")) return false;
            if (selectedId === "kurban-2" && !hName.includes("2. gün")) return false;
            if (selectedId === "kurban-3" && !hName.includes("3. gün")) return false;
            if (selectedId === "kurban-4" && !hName.includes("4. gün")) return false;
          }
          
          return true;
        });

        if (yearHolidays.length > 0) {
          holidayDate = new Date(yearHolidays[0].date);
        }
      }

      // Eğer tatil tarihi bulundu ve dönem içindeyse ekle
      if (holidayDate) {
        if (holidayDate >= periodStartDate && holidayDate <= periodEndDate) {
          totalDays += staticHoliday.days;
        }
      }
    });
  });

  // Dışlanabilir günleri çıkar (calculations.ts'den import edilen fonksiyon kullanılıyor)
  const excludedDaysInPeriod = getExcludedDaysInPeriod(periodStart, periodEnd, excludedDays);

  // Hafta Tatili günlerinden dışlanabilir günleri çıkar (0'dan küçükse 0 yap)
  totalDays = Math.max(0, totalDays - excludedDaysInPeriod);

  return totalDays;
}

// HaftaTatiliTableRow artık state.ts'den import ediliyor

function StandardIndependentContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("hafta-standard");
  
  // İzole state
  const {
    currentRecordName,
    setCurrentRecordName,
    dateRanges,
    setDateRanges,
    selectedHolidayIds,
    setSelectedHolidayIds,
    haftaTatiliExpiryStart,
    setHaftaTatiliExpiryStart,
    haftaTatiliExcludedDays,
    setHaftaTatiliExcludedDays,
    haftaTatiliKullanimBaslangic,
    setHaftaTatiliKullanimBaslangic,
    haftaTatiliKullanimBitis,
    setHaftaTatiliKullanimBitis,
    haftaTatiliKullanimGunSayisi,
    setHaftaTatiliKullanimGunSayisi,
    haftaTatiliRows,
    setHaftaTatiliRows,
    hoveredRow,
    setHoveredRow,
    showKatsayiModal,
    setShowKatsayiModal,
    hasCustomKatsayi,
    setHasCustomKatsayi,
    haftaTatiliNetSummary,
    setHaftaTatiliNetSummary,
    isSaving,
    setIsSaving,
  } = useHaftaTatiliState();
  
  const loadRanRef = useRef<boolean>(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");

  // Yeni tarih aralığı ekle
  const handleAddDateRange = () => {
    setDateRanges([
      ...dateRanges,
      { id: Date.now().toString(), start: "", end: "" },
    ]);
  };

  // Tarih aralığı sil
  const handleRemoveDateRange = (id: string) => {
    if (dateRanges.length > 1) {
      setDateRanges(dateRanges.filter((range) => range.id !== id));
    }
  };

  // Tarih aralığı güncelle
  const handleUpdateDateRange = (id: string, field: "start" | "end", value: string) => {
    // Yıl kısmını 4 karakterle sınırla
    if (value && value.length > 10) {
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

  // Tatil checkbox değişikliği
  const handleHolidayCheckboxChange = (holidayId: string, checked: boolean) => {
    if (checked) {
      setSelectedHolidayIds([...selectedHolidayIds, holidayId]);
    } else {
      setSelectedHolidayIds(selectedHolidayIds.filter((id) => id !== holidayId));
    }
  };

  // Seçili tatillerin toplam gün sayısı
  const totalDays = useMemo(() => {
    const allHolidays = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ];
    return allHolidays
      .filter((h) => selectedHolidayIds.includes(h.id))
      .reduce((sum, h) => sum + h.days, 0);
  }, [selectedHolidayIds]);

  // Hafta Tatili hesaplama tablosu (çoklu çalışma dönemlerini destekler)
  const haftaTatiliTableData = useMemo(() => {
    // Tüm dönemleri buraya toplayacağız
    const allPeriodsWithStartDate: Array<HaftaTatiliTableRow & { startDate: string }> = [];

    // Her çalışma dönemi (işe giriş–çıkış aralığı) için Hafta Tatili dönemlerini hesapla
    dateRanges.forEach((range) => {
      if (!range.start || !range.end) return;

      // Zamanaşımı aktifse: period.start = max(period.start, finalExpiryStartDate)
      // Zamanaşımı yoksa: period.start = range.start
      let effectiveStart: string;
      if (haftaTatiliExpiryStart) {
        const rangeStartDate = new Date(range.start);
        const expiryStartDate = new Date(haftaTatiliExpiryStart);
        // Zamanaşımı tarihinden önce başlayan aralıkları zamanaşımı tarihinden başlat
        effectiveStart = rangeStartDate > expiryStartDate 
          ? range.start 
          : haftaTatiliExpiryStart;
      } else {
        effectiveStart = range.start;
      }

      // generateHaftaTatiliPeriods tek bir aralık için çalışır
      // Her çalışma dönemi için ayrı ayrı çağırıyoruz
      const calculatedPeriods = generateHaftaTatiliPeriods(effectiveStart, range.end);

      // Her dönem için Hafta Tatili hesaplaması yap
      calculatedPeriods.forEach((period) => {
        const wage = period.wage; // BRÜT ücret
        const coefficient = 1; // Başlangıç katsayısı
        const dailyWage = (wage * coefficient) / 30; // Günlük Brüt Ücret = (brüt * katsayı) / 30
        
        // Hafta sayısını hesapla (dışlanabilir günleri de hesaba kat)
        // calculations.ts'den import edilen fonksiyon kullanılıyor
        const originalWeekCount = calculateWeekCount(period.start, period.end, haftaTatiliExcludedDays);
        
        // Mevsimsel kullanım varsa hafta sayısını düşür
        const weekCount = adjustWeekCountForSeasonalUsage(
          originalWeekCount,
          period.start,
          period.end,
          haftaTatiliKullanimBaslangic,
          haftaTatiliKullanimBitis,
          haftaTatiliKullanimGunSayisi
        );
        
        // Dışlanabilir günleri de hesaba kat
        const haftaTatiliDays = getHaftaTatiliDaysForPeriod(
          period.start,
          period.end,
          selectedHolidayIds,
          haftaTatiliExcludedDays
        );
        const dailyWage50Zamli = Number((dailyWage * 1.5).toFixed(2)); // Günlük Brüt %50 Zamlı'yı 2 ondalık basamağa yuvarla
        const haftaTatiliTotal = dailyWage50Zamli * weekCount; // Hafta Tatili Ücreti = (Günlük Brüt %50 Zamlı yuvarlanmış) * Hafta Sayısı

        allPeriodsWithStartDate.push({
          period: `${new Date(period.start).toLocaleDateString("tr-TR")} - ${new Date(period.end).toLocaleDateString("tr-TR")}`,
          weekCount,
          wage,
          coefficient,
          dailyWage,
          haftaTatiliDays,
          haftaTatiliTotal,
          startDate: period.start, // Sıralama için sakla
          startISO: period.start, // Manuel düzenleme için
          endISO: period.end, // Manuel düzenleme için
        });
      });
    });

    // Tüm dönemleri tarih sırasına göre sırala (başlangıç tarihine göre)
    // Aynı ücret dönemine denk gelenler birleştirilmeyecek, ayrı satır kalacak
    allPeriodsWithStartDate.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    });

    // startDate'i kaldır, sadece HaftaTatiliTableRow formatında dön
    return allPeriodsWithStartDate.map(({ startDate, ...row }) => ({
      ...row,
      manual: false, // Otomatik hesaplanan satırlar
    }));
  }, [dateRanges, selectedHolidayIds, haftaTatiliExpiryStart, haftaTatiliExcludedDays, haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi]);

  // Hafta Tatili Toplam Brüt Ücreti
  const haftaTatiliTotalBrut = useMemo(() => {
    return haftaTatiliTableData.reduce((sum, row) => sum + row.haftaTatiliTotal, 0);
  }, [haftaTatiliTableData]);

  // Taban veriler değiştiğinde tabloyu yenile (kullanıcı düzenlemelerini sıfırlar)
  useEffect(() => {
    setHaftaTatiliRows(haftaTatiliTableData);
    setHasCustomKatsayi(false);
  }, [haftaTatiliTableData]);

  // Kullanım bilgisi değiştiğinde mevcut satırların hafta sayılarını güncelle
  // Manuel override: Kullanıcı hafta sayısını manuel değiştirdiyse otomatik hesap DURMALI
  useEffect(() => {
    if (haftaTatiliRows.length === 0) return;
    
    // Ayda Kaç Gün 4 ise hiçbir değişiklik yapma
    if (haftaTatiliKullanimGunSayisi === 4) return;
    
    setHaftaTatiliRows((prevRows) => {
      return prevRows.map((row) => {
        // Manuel override: Kullanıcı hafta sayısını manuel değiştirdiyse otomatik hesap DURMALI
        if (row.manualWeekCount) {
          return row; // Manuel değiştirilmiş satırları atla
        }
        
        // Otomatik hesaplanan satırlar için
        // Satırın tarih aralığını al
        const rowStartISO = row.startISO || "";
        const rowEndISO = row.endISO || "";
        
        // Eğer tarih bilgisi yoksa, period'dan parse et
        let startISO = rowStartISO;
        let endISO = rowEndISO;
        
        if (!startISO || !endISO) {
          const periodParts = row.period.split(" - ");
          if (periodParts.length === 2) {
            const startParts = periodParts[0].trim().split(".");
            const endParts = periodParts[1].trim().split(".");
            if (startParts.length === 3) {
              startISO = `${startParts[2]}-${startParts[1].padStart(2, "0")}-${startParts[0].padStart(2, "0")}`;
            }
            if (endParts.length === 3) {
              endISO = `${endParts[2]}-${endParts[1].padStart(2, "0")}-${endParts[0].padStart(2, "0")}`;
            }
          }
        }
        
        if (!startISO || !endISO) {
          return row; // Tarih bilgisi yoksa değiştirme
        }
        
        // Orijinal hafta sayısını hesapla (kullanım bilgisi olmadan)
        const originalWeekCount = calculateWeekCount(startISO, endISO, haftaTatiliExcludedDays);
        
        // Mevsimsel kullanım varsa hafta sayısını düşür
        const adjustedWeekCount = adjustWeekCountForSeasonalUsage(
          originalWeekCount,
          startISO,
          endISO,
          haftaTatiliKullanimBaslangic,
          haftaTatiliKullanimBitis,
          haftaTatiliKullanimGunSayisi
        );
        
        // Sadece hafta sayısını ve toplamı güncelle, diğer alanlara dokunma
        const dailyWage50Zamli = Number((row.dailyWage * 1.5).toFixed(2));
        const haftaTatiliTotal = dailyWage50Zamli * adjustedWeekCount;
        
        return {
          ...row,
          weekCount: adjustedWeekCount,
          haftaTatiliTotal,
          startISO, // Tarih bilgisini sakla
          endISO, // Tarih bilgisini sakla
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi]);

  // Kayıt yükleme
  const loadCalculationData = useCallback(
    async (caseId: string) => {
      const result = await handleLoadCalculation(caseId);

      if (result) {
        const formData = result.formData;
        const form = formData.data?.form || formData.form || formData;

        // Veri yapısını kontrol et - hem yeni hem eski formatı destekle
        const workerPeriods = form.workerPeriods || formData.data?.form?.workerPeriods || formData.form?.workerPeriods || formData.dateRanges;
        const selectedHolidays = form.selectedHolidays || formData.data?.form?.selectedHolidays || formData.form?.selectedHolidays;
        const excludedDays = form.excludedDays || formData.data?.form?.excludedDays || formData.form?.excludedDays;
        const zamanasimi = form.zamanasimi || formData.data?.form?.zamanasimi || formData.form?.zamanasimi;
        const periods = form.periods || formData.data?.form?.periods || formData.form?.periods;
        
        if (workerPeriods && Array.isArray(workerPeriods) && workerPeriods.length > 0) {
          setDateRanges(workerPeriods);
        }
        if (selectedHolidays && Array.isArray(selectedHolidays)) {
          setSelectedHolidayIds(selectedHolidays);
        }
        if (excludedDays && Array.isArray(excludedDays)) {
          // ExcludedDays'i normalize et - type field'ını MUTLAKA koru
          const normalizedExcludedDays = excludedDays.map((day: any) => {
            // Type field'ını kontrol et - eğer varsa kullan, yoksa "Diğer" ata
            // Önce day.type'ı kontrol et, sonra day.type değerini kontrol et
            let typeValue = "Diğer";
            const originalType = day.type || (day as any).type;
            if (originalType !== undefined && originalType !== null && String(originalType).trim() !== "") {
              typeValue = String(originalType).trim();
            }
            return {
              id: day.id || Math.random().toString(36).slice(2),
              type: typeValue,
              start: day.start || "",
              end: day.end || "",
              days: day.days || 0,
            };
          });
          setHaftaTatiliExcludedDays(normalizedExcludedDays);
        }
        if (zamanasimi?.start) {
          setHaftaTatiliExpiryStart(zamanasimi.start);
        }
        const haftaTatiliKullanim = form.haftaTatiliKullanim || formData.data?.form?.haftaTatiliKullanim || formData.form?.haftaTatiliKullanim;
        if (haftaTatiliKullanim) {
          if (haftaTatiliKullanim.baslangic) {
            setHaftaTatiliKullanimBaslangic(haftaTatiliKullanim.baslangic);
          }
          if (haftaTatiliKullanim.bitis) {
            setHaftaTatiliKullanimBitis(haftaTatiliKullanim.bitis);
          }
          if (haftaTatiliKullanim.gunSayisi) {
            setHaftaTatiliKullanimGunSayisi(haftaTatiliKullanim.gunSayisi);
          }
        }
        if (periods && Array.isArray(periods)) {
          setHaftaTatiliRows(periods);
        }
        
        setCurrentRecordName(result.name || null);
        success(`Kayıt yüklendi`);
      }
    },
    [setDateRanges, setSelectedHolidayIds, setHaftaTatiliExcludedDays, setHaftaTatiliExpiryStart, setHaftaTatiliKullanimBaslangic, setHaftaTatiliKullanimBitis, setHaftaTatiliKullanimGunSayisi, setHaftaTatiliRows, setCurrentRecordName, success]
  );

  // ID değiştiğinde yükle
  useEffect(() => {
    if (id) {
      if (loadRanRef.current) return;
      loadRanRef.current = true;
      loadCalculationData(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  const recalcRow = (row: HaftaTatiliTableRow): HaftaTatiliTableRow => {
    const dailyWage = ((row.wage ?? 0) * (row.coefficient ?? 1)) / 30;
    const dailyWage50Zamli = Number((dailyWage * 1.5).toFixed(2)); // Günlük Brüt %50 Zamlı'yı 2 ondalık basamağa yuvarla
    const haftaTatiliTotal = dailyWage50Zamli * (row.weekCount ?? 0); // Hafta Tatili Ücreti = (Günlük Brüt %50 Zamlı yuvarlanmış) * Hafta Sayısı
    return { ...row, dailyWage, haftaTatiliTotal };
  };

  // Boş satır oluşturma (diğer sayfalarla aynı yapı)
  const createManualRow = useCallback((): HaftaTatiliTableRow => {
    return {
      period: "",
      weekCount: 0,
      wage: 0,
      coefficient: 1,
      dailyWage: 0,
      haftaTatiliDays: 0,
      haftaTatiliTotal: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
  }, []);

  // Altına yeni boş satır ekleme (satır kopyalamaz)
  const duplicateRow = useCallback((i: number) => {
    setHaftaTatiliRows((prev) => {
      const copy = [...prev];
      const newRow = recalcRow(createManualRow());
      copy.splice(i + 1, 0, newRow);
      return copy;
    });
  }, [createManualRow]);

  // Satır silme (en az 1 satır kalmalı)
  const deleteRow = useCallback((i: number) => {
    setHaftaTatiliRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  const handleWageChange = (index: number, value: string) => {
    // Binlik ayırıcıları ve virgülü kaldır, nokta varsa virgüle çevir
    const cleanValue = value.replace(/\./g, "").replace(",", ".");
    const wage = Number(cleanValue) || 0;
    setHaftaTatiliRows(prev => prev.map((r, i) => i === index ? recalcRow({ ...r, wage }) : r));
  };

  const applyGlobalCoefficient = (k: number) => {
    const fixed = Number(k.toFixed(4));
    setHaftaTatiliRows(prev => prev.map(r => recalcRow({ ...r, coefficient: fixed })));
    setHasCustomKatsayi(fixed !== 1);
  };

  const handleResetKatsayi = () => {
    setHaftaTatiliRows(prev => prev.map(r => recalcRow({ ...r, coefficient: 1 })));
    setHasCustomKatsayi(false);
  };

  // Toplamı düzenlenebilir satırlardan hesapla
  const haftaTatiliTotalBrutFromRows = useMemo(() => haftaTatiliRows.reduce((s, r) => s + (r.haftaTatiliTotal ?? 0), 0), [haftaTatiliRows]);

  const handleCalculate = () => {
    if (dateRanges.every((r) => !r.start || !r.end)) {
      showToastError("Lütfen en az bir tarih aralığı girin");
      return;
    }
    success(`Hesaplama tamamlandı. Toplam: ${totalDays} gün`);
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = 
        dateRanges.some(r => r.start || r.end) || 
        selectedHolidayIds.length > 0 || 
        haftaTatiliRows.length > 0;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setDateRanges([{ id: Date.now().toString(), start: "", end: "" }]);
      setSelectedHolidayIds([]);
      setHaftaTatiliExpiryStart(null);
      setHaftaTatiliExcludedDays([]);
      setHaftaTatiliKullanimBaslangic("");
      setHaftaTatiliKullanimBitis("");
      setHaftaTatiliKullanimGunSayisi(4);
      setHaftaTatiliRows([]);
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/hafta-tatili-alacagi/standard";
      }
    } catch {}
  };

  const handleSave = async (customName?: string) => {
    try {
      setIsSaving(true);
      const katsayi = haftaTatiliRows.length > 0 ? haftaTatiliRows[0].coefficient : 1;

      const saveData = prepareSaveData(
        dateRanges,
        selectedHolidayIds,
        haftaTatiliExcludedDays,
        haftaTatiliExpiryStart,
        haftaTatiliKullanimBaslangic,
        haftaTatiliKullanimBitis,
        haftaTatiliKullanimGunSayisi,
        haftaTatiliRows,
        haftaTatiliTotalBrutFromRows,
        haftaTatiliNetSummary,
        totalDays,
        katsayi
      );

      const kayitAdi = customName || currentRecordName || `Hafta Tatili Alacağı - ${new Date().toLocaleDateString("tr-TR")}`;
      const result = await saveCalculation(
        kayitAdi,
        "hafta_tatili_standart",
        saveData,
        id
      );

      if (result.success) {
        success("Hesaplama kaydedildi");
        setCurrentRecordName(result.name || null);
        if (result.id && !id) {
          navigate(`/hafta-tatili-alacagi/standard/${result.id}`);
        }
        // Modal'ı kapat
        setShowSaveNameModal(false);
        setSaveNameInput("");
      }
    } catch (err: any) {
      showToastError(err.message || "Kaydetme hatası");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    setShowSaveNameModal(true);
  };

  // YENİ RAPOR SİSTEMİ: Config
  const haftaTatiliReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const haftaTatiliTotalAmount = haftaTatiliNetSummary.brut || 0;
    const mahsuplasmaNum = Number(String(haftaTatiliNetSummary.settleAmount || "0").replace(/\./g, '').replace(',', '.').replace('₺', '').trim()) || 0;
    const mahsuplamaSonucu = Math.max(0, haftaTatiliTotalAmount - haftaTatiliNetSummary.hakkaniyet - mahsuplasmaNum);

    // İşe giriş-çıkış tarihlerini hesapla
    const validDateRanges = dateRanges.filter(r => r.start && r.end);
    const startDates = validDateRanges.map(r => new Date(r.start).getTime()).filter(t => !isNaN(t));
    const endDates = validDateRanges.map(r => new Date(r.end).getTime()).filter(t => !isNaN(t));
    const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
    const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates)) : null;

    return {
      title: "Standart Hafta Tatili Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: earliestStart ? earliestStart.toLocaleDateString("tr-TR") : "-", condition: !!earliestStart },
        { label: "İşten Çıkış Tarihi", value: latestEnd ? latestEnd.toLocaleDateString("tr-TR") : "-", condition: !!latestEnd },
        { label: "Zamanaşımı Başlangıç Tarihi", value: haftaTatiliExpiryStart ? new Date(haftaTatiliExpiryStart).toLocaleDateString("tr-TR") : "-", condition: !!haftaTatiliExpiryStart },
      ],
      customSections: [
        {
          title: "Dışlanabilir Günler",
          content: haftaTatiliExcludedDays.length > 0 ? (
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              marginBottom: '16px',
              border: '1px solid #d1d5db',
              fontSize: '10px'
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#f3f4f6',
                  borderBottom: '2px solid #d1d5db'
                }}>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '6px 8px', 
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db'
                  }}>Tür</th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '6px 8px', 
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db'
                  }}>Başlangıç</th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '6px 8px', 
                    fontWeight: 600,
                    border: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db'
                  }}>Bitiş</th>
                  <th style={{ 
                    textAlign: 'right', 
                    padding: '6px 8px', 
                    fontWeight: 600,
                    border: '1px solid #d1d5db'
                  }}>Gün</th>
                </tr>
              </thead>
              <tbody>
                {haftaTatiliExcludedDays.map((day, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: idx < haftaTatiliExcludedDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                  }}>
                    <td style={{ 
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRight: '1px solid #d1d5db'
                    }}>{day?.type || (day as any)?.type || "Diğer"}</td>
                    <td style={{ 
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRight: '1px solid #d1d5db'
                    }}>{new Date(day.start).toLocaleDateString("tr-TR")}</td>
                    <td style={{ 
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRight: '1px solid #d1d5db'
                    }}>{new Date(day.end).toLocaleDateString("tr-TR")}</td>
                    <td style={{ 
                      textAlign: 'right', 
                      padding: '6px 8px',
                      fontVariantNumeric: 'tabular-nums',
                      border: '1px solid #d1d5db'
                    }}>{day.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null,
          condition: haftaTatiliExcludedDays.length > 0,
        },
        {
          title: "Hafta Tatili Kullanım Bilgisi",
          content: haftaTatiliKullanimBaslangic && haftaTatiliKullanimBitis ? (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
              <p style={{ margin: '4px 0' }}><strong>Başlangıç:</strong> {haftaTatiliKullanimBaslangic}</p>
              <p style={{ margin: '4px 0' }}><strong>Bitiş:</strong> {haftaTatiliKullanimBitis}</p>
              <p style={{ margin: '4px 0' }}><strong>Ayda Kaç Gün:</strong> {haftaTatiliKullanimGunSayisi} gün</p>
            </div>
          ) : null,
          condition: !!(haftaTatiliKullanimBaslangic && haftaTatiliKullanimBitis),
        },
      ],
      periodData: {
        title: "Hafta Tatili Hesaplama Detayı",
        headers: ["Tarih (Ücret Dönemi)", "Hafta", "Ücret (BRÜT)", "Katsayı", "Günlük Brüt Ücret", "Günlük %50 Zamlı", "Hafta Tatili Ücreti"],
        rows: haftaTatiliRows.map(row => [
          row.period,
          row.weekCount.toString(),
          `${fmtLocal(row.wage)}₺`,
          row.coefficient.toFixed(4),
          `${fmtLocal(row.dailyWage)}₺`,
          `${fmtLocal(Number((row.dailyWage * 1.5).toFixed(2)))}₺`,
          `${fmtLocal(row.haftaTatiliTotal)}₺`,
        ]),
        footer: [
          "Toplam:",
          "",
          "",
          "",
          "",
          "",
          `${fmtLocal(haftaTatiliTotalAmount)}₺`,
        ],
        alignRight: [1, 2, 3, 4, 5, 6],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Hafta Tatili Alacağı", value: `${fmtLocal(haftaTatiliNetSummary.brut)}₺` },
          { label: "SGK İşçi Primi (%15)", value: `-${fmtLocal(haftaTatiliNetSummary.ssk)}₺`, isDeduction: true },
          { label: "Gelir Vergisi", value: `-${fmtLocal(haftaTatiliNetSummary.gelir)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(haftaTatiliNetSummary.damga)}₺`, isDeduction: true },
          { label: "Net Hafta Tatili Alacağı", value: `${fmtLocal(haftaTatiliNetSummary.net)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Net Hafta Tatili Alacağı", value: `${fmtLocal(haftaTatiliTotalAmount)}₺` },
          { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtLocal(haftaTatiliNetSummary.hakkaniyet)}₺`, isDeduction: true },
          { label: "Mahsuplaşma Miktarı", value: `-${fmtLocal(mahsuplasmaNum)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmtLocal(mahsuplamaSonucu)}₺`,
        },
      },
    };
  }, [haftaTatiliRows, haftaTatiliNetSummary, selectedHolidayIds, totalDays, haftaTatiliExpiryStart, haftaTatiliExcludedDays, haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi, dateRanges]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (haftaTatiliReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (haftaTatiliExcludedDays.length > 0) {
      const excludedRows = haftaTatiliExcludedDays.map((day) => [
        (day as any)?.type || day?.type || "Diğer",
        new Date(day.start).toLocaleDateString("tr-TR"),
        new Date(day.end).toLocaleDateString("tr-TR"),
        day.days.toString(),
      ]);
      const n2 = adaptToWordTable({
        headers: ["Tür", "Başlangıç", "Bitiş", "Gün"],
        rows: excludedRows,
      });
      sections.push({ id: "dislanabilir-gunler", title: "Dışlanabilir Günler", html: buildWordTable(n2.headers, n2.rows) });
    }

    if (haftaTatiliKullanimBaslangic && haftaTatiliKullanimBitis) {
      const n2b = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: [
          ["Başlangıç", haftaTatiliKullanimBaslangic],
          ["Bitiş", haftaTatiliKullanimBitis],
          ["Ayda Kaç Gün", `${haftaTatiliKullanimGunSayisi} gün`],
        ],
      });
      sections.push({ id: "hafta-tatili-kullanim", title: "Hafta Tatili Kullanım Bilgisi", html: buildWordTable(n2b.headers, n2b.rows) });
    }

    const pd = haftaTatiliReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n3 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "hafta-tatili-hesaplama", title: pd.title || "Hafta Tatili Hesaplama Detayı", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = haftaTatiliReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = haftaTatiliReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [haftaTatiliReportConfig, haftaTatiliExcludedDays, haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("standart-ht-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = haftaTatiliReportConfig.title;
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
  }, [haftaTatiliReportConfig.title]);

  // Hafta Tatili Zamanaşımı iptal handler
  const handleHaftaTatiliExpiryCancel = () => {
    info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
  };

  return (
    <>
      <style>{`
        input, select {
          box-sizing: border-box !important;
          height: 36px !important;
          line-height: 36px !important;
        }
        @media (max-width: 1024px) {
          input, select {
            display: flex !important;
            align-items: center !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            line-height: 1.2 !important;
            height: 40px !important;
          }
          input[type="date"] {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            line-height: 1.2 !important;
          }
          input[type="text"] {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>
      <Layout
        title={PAGE_TITLE}
        description="Standart Hafta Tatili Alacağı Hesaplama"
        hideHeader={true}
        fluid={true}
        pageKey="hafta-tatili"
        noBackgroundColor={true}
      >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full space-y-6 max-w-full">
          {/* Sol Bölüm - Ana İçerik */}
          <div className="space-y-6 w-full max-w-full">
            {/* Tarih Aralıkları */}
            <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <CardHeader>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">İşe Giriş - Çıkış Tarihleri</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Çalışma dönemlerinizi ekleyin</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dateRanges.map((range) => (
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
                        const value = e.target.value;
                        if (value && value.length > 10) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            e.target.value = parts.join('-');
                          }
                        }
                        handleUpdateDateRange(range.id, "start", e.target.value);
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
                        const value = e.target.value;
                        if (value && value.length > 10) {
                          const parts = value.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].substring(0, 4);
                            e.target.value = parts.join('-');
                          }
                        }
                        handleUpdateDateRange(range.id, "end", e.target.value);
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
                    onClick={() => handleRemoveDateRange(range.id)}
                    disabled={dateRanges.length <= 1}
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
                onClick={handleAddDateRange}
                className="w-full sm:w-auto font-semibold rounded-full text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 dark:border-blue-600 dark:hover:border-blue-500 dark:text-blue-400"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Tarih Aralığı Ekle
              </Button>
            </CardContent>
          </Card>

          {/* Dışlanabilir Günler */}
          <HaftaTatiliExcludeDays
            haftaTatiliExcludedDays={haftaTatiliExcludedDays}
            onHaftaTatiliExcludedDaysChange={setHaftaTatiliExcludedDays}
          />
          </div>

        </div>

        {/* Hafta Tatili Hesaplama Tablosu */}
        <div className="w-full mt-8 max-w-full">
          <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
          <CardHeader>
            <div className="w-full max-w-full">
              <CardTitle className="text-xl">Hafta Tatili Hesaplama Tablosu</CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400 mt-1">
                Katsayı hesapla butonu ile katsayınızı hesaplayabilirsiniz; bulunan katsayı otomatik olarak hesap tablosuna eklenecektir. Ücret (BRÜT) sütunu istenilirse ücretler bağımsız giriş yapılabilir.
              </CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-4 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  {videoLink && (
                    <Button
                      onClick={() => window.open(videoLink, "_blank")}
                      variant="outline"
                      className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      <Youtube className="h-4 w-4" />
                      Kullanım Videosu
                    </Button>
                  )}
                  <HaftaTatiliExpiryBox
                    haftaTatiliExpiryStart={haftaTatiliExpiryStart}
                    onHaftaTatiliExpiryStartChange={setHaftaTatiliExpiryStart}
                    onHaftaTatiliExpiryCancel={handleHaftaTatiliExpiryCancel}
                    iseGiris={dateRanges.map((r) => r.start).filter(Boolean).sort()[0] || undefined}
                  />
                  <Button type="button" variant="outline" onClick={() => setShowKatsayiModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full w-full sm:w-auto border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">Kat Sayı Hesapla</Button>
                  {hasCustomKatsayi && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleResetKatsayi}
                      className="ml-0 sm:ml-1 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 w-full sm:w-auto"
                    >
                      Kat Sayısını Kaldır
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Hafta Tatili Kullanım Bilgisi */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">
                  Hafta Tatili Kullanım Bilgisi
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <div className="min-h-[2.75rem] flex items-end mb-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 block">
                        Başlangıç Tarihi (Opsiyonel - gg.aa formatında, örn: 15.06)
                      </Label>
                    </div>
                    <Input
                      type="text"
                      placeholder="15.06 (boş bırakılabilir)"
                      value={haftaTatiliKullanimBaslangic}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        if (value === '' || /^\d{1,2}\.\d{1,2}$/.test(value) || /^\d{1,2}\.$/.test(value) || /^\d{1,2}$/.test(value)) {
                          setHaftaTatiliKullanimBaslangic(value);
                        }
                      }}
                      className="w-full h-11 rounded-xl font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      maxLength={5}
                    />
                    <p className="text-xs text-gray-500 mt-2">Boş bırakılırsa tüm yıl geçerlidir. Girilirse her yıl tekrar eden mevsimsel dönemdir.</p>
                  </div>
                  <div className="flex flex-col">
                    <div className="min-h-[2.75rem] flex items-end mb-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 block">
                        Bitiş Tarihi (Opsiyonel - gg.aa formatında, örn: 15.10)
                      </Label>
                    </div>
                    <Input
                      type="text"
                      placeholder="15.10 (boş bırakılabilir)"
                      value={haftaTatiliKullanimBitis}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        if (value === '' || /^\d{1,2}\.\d{1,2}$/.test(value) || /^\d{1,2}\.$/.test(value) || /^\d{1,2}$/.test(value)) {
                          setHaftaTatiliKullanimBitis(value);
                        }
                      }}
                      className="w-full h-11 rounded-xl font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      maxLength={5}
                    />
                    <p className="text-xs text-gray-500 mt-2">Boş bırakılırsa tüm yıl geçerlidir. Girilirse her yıl tekrar eden mevsimsel dönemdir.</p>
                  </div>
                  <div className="flex flex-col">
                    <div className="min-h-[2.75rem] flex items-end mb-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 block">
                        Ayda Kaç Gün Hafta Tatili Kullanılmadı?
                      </Label>
                    </div>
                    <select
                      value={haftaTatiliKullanimGunSayisi}
                      onChange={(e) => setHaftaTatiliKullanimGunSayisi(Number(e.target.value))}
                      className="w-full h-11 px-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={4}>4 (Varsayılan – hiçbir etki yapmaz)</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2 invisible select-none">Boş alan</p>
                  </div>
                </div>
              </div>

              {haftaTatiliExpiryStart && haftaTatiliRows.length > 0 && (
                <div className="mb-4 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                  Zamanaşımı başlangıç tarihi: {format(new Date(haftaTatiliExpiryStart), "dd.MM.yyyy")} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
                </div>
              )}
              {haftaTatiliRows.length > 0 ? (
                <>
                <div className="calc-table-wrapper">
                <table
                  style={{
                    border: "1px solid #d2d2d2"
                  }}
                >
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "left" }}>
                          Tarih (Ücret Dönemi)
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Hafta
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Ücret (BRÜT)
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "center" }}>
                          Katsayı
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Günlük %50 Zamlı
                        </th>
                        <th style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Hafta Tatili Ücreti
                        </th>
                        <th className="bg-transparent w-16" style={{ padding: "8px", border: "1px solid #d2d2d2", borderLeft: "none" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {haftaTatiliRows.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                          onMouseEnter={() => setHoveredRow(index)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <input
                                type="date"
                                value={row.startISO || (() => {
                                  const periodParts = row.period.split(" - ");
                                  if (periodParts.length >= 1) {
                                    const startParts = periodParts[0].trim().split(".");
                                    if (startParts.length === 3) {
                                      return `${startParts[2]}-${startParts[1].padStart(2, "0")}-${startParts[0].padStart(2, "0")}`;
                                    }
                                  }
                                  return "";
                                })()}
                                onChange={(e) => {
                                  const newStart = e.target.value;
                                  setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                    if (i !== index) return r;
                                    const endISO = r.endISO || (() => {
                                      const periodParts = r.period.split(" - ");
                                      if (periodParts.length >= 2) {
                                        const endParts = periodParts[1].trim().split(".");
                                        if (endParts.length === 3) {
                                          return `${endParts[2]}-${endParts[1].padStart(2, "0")}-${endParts[0].padStart(2, "0")}`;
                                        }
                                      }
                                      return "";
                                    })();
                                    const startFormatted = newStart ? new Date(newStart).toLocaleDateString("tr-TR") : "";
                                    const endFormatted = endISO ? new Date(endISO).toLocaleDateString("tr-TR") : "";
                                    const newPeriod = startFormatted && endFormatted ? `${startFormatted} - ${endFormatted}` : r.period;
                                    let newWeekCount = r.weekCount;
                                      if (newStart && endISO) {
                                        const originalWeekCount = calculateWeekCount(newStart, endISO, haftaTatiliExcludedDays);
                                        newWeekCount = adjustWeekCountForSeasonalUsage(
                                          originalWeekCount,
                                          newStart,
                                          endISO,
                                          haftaTatiliKullanimBaslangic,
                                          haftaTatiliKullanimBitis,
                                          haftaTatiliKullanimGunSayisi
                                        );
                                      }
                                    const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                    const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                    return { ...r, startISO: newStart, period: newPeriod, weekCount: newWeekCount, haftaTatiliTotal, manual: true };
                                  }));
                                }}
                                style={{ padding: "4px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px" }}
                              />
                              <span>-</span>
                              <input
                                type="date"
                                value={row.endISO || (() => {
                                  const periodParts = row.period.split(" - ");
                                  if (periodParts.length >= 2) {
                                    const endParts = periodParts[1].trim().split(".");
                                    if (endParts.length === 3) {
                                      return `${endParts[2]}-${endParts[1].padStart(2, "0")}-${endParts[0].padStart(2, "0")}`;
                                    }
                                  }
                                  return "";
                                })()}
                                onChange={(e) => {
                                  const newEnd = e.target.value;
                                  setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                    if (i !== index) return r;
                                    const startISO = r.startISO || (() => {
                                      const periodParts = r.period.split(" - ");
                                      if (periodParts.length >= 1) {
                                        const startParts = periodParts[0].trim().split(".");
                                        if (startParts.length === 3) {
                                          return `${startParts[2]}-${startParts[1].padStart(2, "0")}-${startParts[0].padStart(2, "0")}`;
                                        }
                                      }
                                      return "";
                                    })();
                                    const startFormatted = startISO ? new Date(startISO).toLocaleDateString("tr-TR") : "";
                                    const endFormatted = newEnd ? new Date(newEnd).toLocaleDateString("tr-TR") : "";
                                    const newPeriod = startFormatted && endFormatted ? `${startFormatted} - ${endFormatted}` : r.period;
                                    let newWeekCount = r.weekCount;
                                      if (startISO && newEnd) {
                                        const originalWeekCount = calculateWeekCount(startISO, newEnd, haftaTatiliExcludedDays);
                                        newWeekCount = adjustWeekCountForSeasonalUsage(
                                          originalWeekCount,
                                          startISO,
                                          newEnd,
                                          haftaTatiliKullanimBaslangic,
                                          haftaTatiliKullanimBitis,
                                          haftaTatiliKullanimGunSayisi
                                        );
                                      }
                                    const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                    const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                    return { ...r, endISO: newEnd, period: newPeriod, weekCount: newWeekCount, haftaTatiliTotal, manual: true };
                                  }));
                                }}
                                style={{ padding: "4px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px" }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                            <input
                              type="number"
                              step="1"
                              value={row.weekCount}
                              onChange={(e) => {
                                const newWeekCount = Number(e.target.value) || 0;
                                setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                  if (i !== index) return r;
                                  const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                  const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                  return { ...r, weekCount: newWeekCount, haftaTatiliTotal, manual: true, manualWeekCount: true };
                                }));
                              }}
                              style={{ width: "100%", padding: "4px", border: "1px solid #ccc", borderRadius: "4px", textAlign: "right", fontSize: "12px" }}
                            />
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                              <input
                                type="text"
                                key={`wage-${index}-${row.wage}`}
                                defaultValue={row.wage ? row.wage.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                                onFocus={(e) => {
                                  const raw = row.wage > 0 ? row.wage.toString().replace('.', ',') : '';
                                  e.target.value = raw;
                                }}
                                onBlur={(e) => {
                                  handleWageChange(index, e.target.value);
                                  const cleaned = e.target.value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                                  const wage = Number(cleaned) || 0;
                                  e.target.value = wage > 0 ? wage.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                                }}
                                style={{ flex: 1, padding: "4px", border: "1px solid transparent", borderRadius: "4px", textAlign: "right", fontSize: "12px" }}
                              />
                              <span>₺</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "center" }}>
                            {(row.coefficient ?? 1).toFixed(4)}
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                            {(row.dailyWage ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                            {((row.dailyWage ?? 0) * 1.5).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right", fontWeight: "600" }}>
                            {(row.haftaTatiliTotal ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          {/* Satır ekleme ve silme butonları - sadece hover'da görünür */}
                          <td className="bg-transparent w-16 p-0" style={{ borderTop: "1px solid #d2d2d2", borderBottom: "1px solid #d2d2d2", borderRight: "1px solid #d2d2d2" }}>
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
                                    if (haftaTatiliRows.length <= 1) return;
                                    deleteRow(index);
                                  }}
                                  style={{ opacity: haftaTatiliRows.length <= 1 ? 0.3 : 1, cursor: haftaTatiliRows.length <= 1 ? 'not-allowed' : 'pointer' }}
                                  title={haftaTatiliRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
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
                      <tr style={{ backgroundColor: '#f3f4f6', fontWeight: "600" }}>
                        <td colSpan={6} style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          Toplam Hafta Tatili Ücreti:
                        </td>
                        <td style={{ padding: "8px", border: "1px solid #d2d2d2", textAlign: "right" }}>
                          {haftaTatiliTotalBrutFromRows.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="bg-transparent w-16" style={{ padding: "8px", border: "1px solid #d2d2d2", borderLeft: "none" }}></td>
                      </tr>
                    </tfoot>
                </table>
                </div>
                {/* Bilgilendirme Metni */}
                {haftaTatiliKullanimGunSayisi !== 4 && (
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                    <p>
                      {haftaTatiliKullanimBaslangic && haftaTatiliKullanimBitis ? (
                        <>Her yıl {haftaTatiliKullanimBaslangic} – {haftaTatiliKullanimBitis} tarihleri arasında hafta tatilinin ayda {haftaTatiliKullanimGunSayisi} gün kullandırıldığı kabul edilerek hafta sayısı üzerinden hesaplama yapılmıştır.</>
                      ) : (
                        <>Tüm yıl boyunca hafta tatilinin ayda {haftaTatiliKullanimGunSayisi} gün kullandırıldığı kabul edilerek hafta sayısı üzerinden hesaplama yapılmıştır.</>
                      )}
                    </p>
                  </div>
                )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Hesaplama yapmak için lütfen tarih aralıkları girin ve tatilleri seçin.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Brütten Nete Çevir + Mahsuplaşma */}
        <div className="w-full mt-8 mb-24 md:mb-32 max-w-full">
          <div className="w-full">
            <HaftaTatiliNetConversion 
              haftaTatiliBrutTotal={haftaTatiliTotalBrutFromRows} 
              tableData={haftaTatiliRows}
              dateRanges={dateRanges}
              onSummaryChange={setHaftaTatiliNetSummary} 
            />
          </div>
        </div>

        {/* Notlar Bölümü - En Altta */}
        <div className="w-full mt-8 mb-8">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 notes-content">
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs">ℹ️</span>
                  <span>Hafta tatili alacağı hesaplaması yapılır.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs">⏱️</span>
                  <span>Tarih değişince hesaplamalar otomatik güncellenir.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs">📋</span>
                  <span>Tablo biçimi raporlara uygundur.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs">💱</span>
                  <span>Rakamlar TR formatında gösterilir.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="standart-ht-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={haftaTatiliReportConfig} />
      </div>

      <HaftaTatiliKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <FooterActions 
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }} 
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Standart Hafta Tatili Alacağı Rapor",
          copyTargetId: "standart-ht-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #standart-ht-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #standart-ht-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="standart-ht-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Standart Hafta Tatili Alacağı Rapor", "report-content"),
        }}
      />
      </Layout>

      {/* Kaydet Modal */}
      {showSaveNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Hesaplamaya İsim Ver</h3>
            <Input
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              placeholder="Hesaplama adı girin"
              className="mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveNameInput.trim()) {
                  handleSave(saveNameInput.trim());
                }
                if (e.key === "Escape") {
                  setShowSaveNameModal(false);
                  setSaveNameInput("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveNameModal(false);
                  setSaveNameInput("");
                }}
              >
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (saveNameInput.trim()) {
                    handleSave(saveNameInput.trim());
                  } else {
                    showToastError("Lütfen bir isim girin");
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </>
  );
}

export default function StandardIndependent() {
  return (
    <ToastProvider>
      <StandardIndependentContent />
    </ToastProvider>
  );
}
