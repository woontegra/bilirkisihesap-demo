import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { Plus, Trash2, Youtube } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { API_BASE_URL } from "@/utils/apiClient";
// Constants - inline (Toplu Sözleşme)
const PAGE_TITLE = "Toplu Sözleşme Hafta Tatili Alacağı";
const BUTTON_LABELS = { CALCULATE: "Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };

// Tarih dosyaları tatil kontrolü için kullanılacak
import { nationalDays } from "./national-days";
import { officialHolidays } from "./official-holidays";
import { generalHolidays } from "./general-holidays";
import { religiousHolidays } from "./religious-holidays";
import HaftaTatiliExpiryBox from "./HaftaTatiliExpiryBox";
import HaftaTatiliNetConversion from "./HaftaTatiliNetConversion";
import HaftaTatiliExcludeDays from "./HaftaTatiliExcludeDays";
import HaftaTatiliReportModal from "./HaftaTatiliReportModal";
import HaftaTatiliKatsayiModal from "./HaftaTatiliKatsayiModal";
import { generateReport } from "@/utils/pdf";
import { format } from "date-fns";
import "@/styles/soft-glow.css";

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

// Tablo satırı tipi
interface HaftaTatiliTableRow {
  period: string;
  weekCount: number;
  wage: number;
  coefficient: number;
  dailyWage: number;
  haftaTatiliDays: number;
  haftaTatiliTotal: number;
  manual?: boolean;
  startISO?: string;
  endISO?: string;
}

export default function TopluSozlesmeIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError, info } = useToast();
  const { user } = useAuth();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("hafta-toplu-sozlesme");
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Tarih aralıkları state
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: Date.now().toString(), start: "", end: "" },
  ]);

  // Seçili tatil ID'leri state (unique id = date + type)
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);

  // Hafta Tatili Zamanaşımı state (haftaTatili prefix'li)
  const [haftaTatiliExpiryStart, setHaftaTatiliExpiryStart] = useState<string | null>(null);

  // Hafta Tatili Dışlanabilir günler state (haftaTatili prefix'li)
  const [haftaTatiliExcludedDays, setHaftaTatiliExcludedDays] = useState<
    Array<{ id: string; type: "Yıllık İzin" | "Rapor" | "Diğer"; start: string; end: string; days: number }>
  >([]);

  // Hafta Tatili Rapor modal state (haftaTatili prefix'li)
  const [showHaftaTatiliReportModal, setShowHaftaTatiliReportModal] = useState(false);

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
        const weekCount = calculateWeekCount(period.start, period.end, haftaTatiliExcludedDays);
        
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
    return allPeriodsWithStartDate.map(({ startDate, ...row }) => row);
  }, [dateRanges, selectedHolidayIds, haftaTatiliExpiryStart, haftaTatiliExcludedDays]);

  // Hafta Tatili Toplam Brüt Ücreti
  const haftaTatiliTotalBrut = useMemo(() => {
    return haftaTatiliTableData.reduce((sum, row) => sum + row.haftaTatiliTotal, 0);
  }, [haftaTatiliTableData]);

  // Düzenlenebilir satırlar (Hafta Tatili sayfasına özel)
  const [haftaTatiliRows, setHaftaTatiliRows] = useState<HaftaTatiliTableRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);

  // Net/mahsuplaşma özetleri (child'dan alınır)
  const [haftaTatiliNetSummary, setHaftaTatiliNetSummary] = useState<{ brut: number; ssk: number; gelir: number; damga: number; net: number; hakkaniyet: number; settleAmount: string }>({ brut: 0, ssk: 0, gelir: 0, damga: 0, net: 0, hakkaniyet: 0, settleAmount: "" });

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
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
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;
        
        const data = await loadCalculation(id);
        
        if (!isMounted) return;
        
        // Form alanlarını doldur
        const formData = data.formValues || data.data || {};
        
        // Veri yapısını kontrol et - hem yeni hem eski formatı destekle
        const workerPeriods = formData.workerPeriods || formData.data?.form?.workerPeriods || formData.form?.workerPeriods || formData.dateRanges;
        const selectedHolidays = formData.selectedHolidays || formData.data?.form?.selectedHolidays || formData.form?.selectedHolidays;
        const excludedDays = formData.excludedDays || formData.data?.form?.excludedDays || formData.form?.excludedDays;
        const zamanasimi = formData.zamanasimi || formData.data?.form?.zamanasimi || formData.form?.zamanasimi;
        const periods = formData.periods || formData.data?.form?.periods || formData.form?.periods;
        const settlement = formData.settlement || formData.data?.form?.settlement || formData.form?.settlement;
        
        if (workerPeriods && Array.isArray(workerPeriods) && workerPeriods.length > 0) {
          setDateRanges(workerPeriods);
        }
        if (selectedHolidays && Array.isArray(selectedHolidays)) {
          setSelectedHolidayIds(selectedHolidays);
        }
        if (excludedDays && Array.isArray(excludedDays)) {
          setHaftaTatiliExcludedDays(excludedDays);
        }
        if (zamanasimi?.start) {
          setHaftaTatiliExpiryStart(zamanasimi.start);
        }
        if (periods && Array.isArray(periods)) {
          setHaftaTatiliRows(periods);
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        success(`Kayıt yüklendi (#${id})`);
      } catch (err) {
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

  // Taban veriler değiştiğinde tabloyu yenile (kullanıcı düzenlemelerini sıfırlar)
  useEffect(() => {
    setHaftaTatiliRows(haftaTatiliTableData);
    setHasCustomKatsayi(false);
  }, [haftaTatiliTableData]);

  const recalcRow = (row: HaftaTatiliTableRow): HaftaTatiliTableRow => {
    const dailyWage = (row.wage * row.coefficient) / 30;
    const dailyWage50Zamli = Number((dailyWage * 1.5).toFixed(2)); // Günlük Brüt %50 Zamlı'yı 2 ondalık basamağa yuvarla
    const haftaTatiliTotal = dailyWage50Zamli * row.weekCount; // Hafta Tatili Ücreti = (Günlük Brüt %50 Zamlı yuvarlanmış) * Hafta Sayısı
    return { ...row, dailyWage, haftaTatiliTotal };
  };

  // Satır çoğaltma fonksiyonu
  const duplicateRow = useCallback((i: number) => {
    setHaftaTatiliRows((prev) => {
      const copy = [...prev];
      // Period'dan startISO ve endISO parse et (format: "01.01.2024-31.03.2024")
      const periodParts = copy[i].period.split("-");
      let startISO = copy[i].startISO || "";
      let endISO = copy[i].endISO || "";
      if (!startISO && periodParts.length >= 2) {
        const startParts = periodParts[0].trim().split(".");
        if (startParts.length === 3) {
          startISO = `${startParts[2]}-${startParts[1].padStart(2, "0")}-${startParts[0].padStart(2, "0")}`;
        }
      }
      if (!endISO && periodParts.length >= 2) {
        const endParts = periodParts[1].trim().split(".");
        if (endParts.length === 3) {
          endISO = `${endParts[2]}-${endParts[1].padStart(2, "0")}-${endParts[0].padStart(2, "0")}`;
        }
      }
      copy[i] = { ...copy[i], manual: true, startISO, endISO };
      const newRow = { ...copy[i], manual: true, startISO, endISO };
      copy.splice(i + 1, 0, newRow);
      return copy;
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
  const haftaTatiliTotalBrutFromRows = useMemo(() => haftaTatiliRows.reduce((s, r) => s + r.haftaTatiliTotal, 0), [haftaTatiliRows]);

  const handleCalculate = () => {
    if (dateRanges.every((r) => !r.start || !r.end)) {
      showToastError("Lütfen en az bir tarih aralığı girin");
      return;
    }
    success(`Hesaplama tamamlandı. Toplam: ${totalDays} gün`);
  };

  const handleSave = () => {
    try {
      const katsayi = haftaTatiliRows.length > 0 ? haftaTatiliRows[0].coefficient : 1;

      // Tarih aralığı özetleri
      const startDate = dateRanges
        .filter(r => r.start)
        .map(r => new Date(r.start).getTime())
        .sort((a,b)=>a-b)[0];
      const endDate = dateRanges
        .filter(r => r.end)
        .map(r => new Date(r.end).getTime())
        .sort((a,b)=>b-a)[0];

      const startDateStr = startDate ? new Date(startDate).toISOString().slice(0,10) : null;
      const endDateStr = endDate ? new Date(endDate).toISOString().slice(0,10) : null;

      const haftaTatiliData = {
        periods: haftaTatiliRows,
        totalBrut: haftaTatiliTotalBrutFromRows,
        totalNet: haftaTatiliNetSummary.net,
        netConversion: haftaTatiliNetSummary,
        settlement: {
          hakkaniyet: haftaTatiliNetSummary.hakkaniyet,
          settleAmount: haftaTatiliNetSummary.settleAmount,
          sonuc: Math.max(0, haftaTatiliNetSummary.brut - haftaTatiliNetSummary.hakkaniyet),
        },
        workerPeriods: dateRanges,
        selectedHolidays: selectedHolidayIds,
        calculatedHaftaTatiliDays: totalDays,
        katsayi,
        zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
        excludedDays: haftaTatiliExcludedDays,
        startDate: startDateStr,
        endDate: endDateStr,
        notes: "",
      };

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "hafta_tatili_toplu_sozlesme",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              workerPeriods: dateRanges,
              selectedHolidays: selectedHolidayIds,
              excludedDays: haftaTatiliExcludedDays,
              zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
              periods: haftaTatiliRows,
              katsayi,
              calculatedHaftaTatiliDays: totalDays,
              settlement: haftaTatiliData.settlement,
            },
            results: {
              totals: { brut: haftaTatiliTotalBrutFromRows, net: haftaTatiliNetSummary.net },
              brut: haftaTatiliTotalBrutFromRows,
              net: haftaTatiliNetSummary.net,
              netConversion: haftaTatiliNetSummary,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          start_date: startDateStr,
          end_date: endDateStr,
          brut_total: haftaTatiliTotalBrutFromRows,
          net_total: haftaTatiliNetSummary.net,
          notes: "",
          ...haftaTatiliData,
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/hafta-tatili-alacagi/toplu-sozlesme/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
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
      setHaftaTatiliRows([]);
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/hafta-tatili-alacagi/toplu-sozlesme";
      }
    } catch {}
  };

  const handlePrint = () => {
    window.print();
  };

  // Hafta Tatili Zamanaşımı iptal handler
  const handleHaftaTatiliExpiryCancel = () => {
    info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="Toplu İş Sözleşmesi Hafta Tatili Alacağı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="hafta-tatili"
      noBackgroundColor={true}
    >
      <div className="p-4 md:p-6 lg:p-8 min-h-screen w-full max-w-full overflow-x-hidden page-background">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Sol Bölüm - Ana İçerik (3/4) */}
          <div className="lg:col-span-3 w-full space-y-6 max-w-full">
            {/* Tarih Aralıkları */}
            <Card className="soft-card">
            <CardHeader>
              <div>
                <CardTitle className="text-xl fade-section">İşe Giriş - Çıkış Tarihleri</CardTitle>
                <CardDescription>Çalışma dönemlerinizi ekleyin</CardDescription>
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
                className="w-full sm:w-auto text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 dark:border-blue-700 dark:hover:border-blue-600"
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

          {/* Sağ Bölüm - Not Alanı (1/4) - Sadece Desktop */}
          <div className="hidden lg:block lg:col-span-1 w-full max-w-full overflow-x-hidden">
            <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
                    <span>Toplu sözleşme hafta tatili alacağı hesaplaması yapılır.</span>
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

        {/* Hafta Tatili Hesaplama Tablosu */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="lg:col-span-3 w-full max-w-full">
          <Card className="w-full soft-card">
            <CardHeader className="pb-3">
              <div className="w-full max-w-full">
                <CardTitle className="text-xl">Hafta Tatili Hesaplama Tablosu</CardTitle>
                <CardDescription className="text-red-600">
                  Katsayı hesapla butonu ile katsayınızı hesaplayabilirsiniz; bulunan katsayı otomatik olarak hesap tablosuna eklenecektir. Ücret (BRÜT) sütunu istenilirse ücretler bağımsız giriş yapılabilir.
                </CardDescription>
              </div>
              <div className="flex flex-wrap justify-end gap-2 mt-2 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  {videoLink && (
                    <Button
                      onClick={() => window.open(videoLink, "_blank")}
                      variant="outline"
                      className="gap-2 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 hover:text-red-700"
                    >
                      <Youtube className="h-4 w-4" />
                      Kullanım Videosu
                    </Button>
                  )}
                  <HaftaTatiliExpiryBox
                    haftaTatiliExpiryStart={haftaTatiliExpiryStart}
                    onHaftaTatiliExpiryStartChange={setHaftaTatiliExpiryStart}
                    onHaftaTatiliExpiryCancel={handleHaftaTatiliExpiryCancel}
                  />
                  <Button type="button" variant="outline" onClick={() => setShowKatsayiModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm w-full sm:w-auto">Kat Sayı Hesapla</Button>
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
              {haftaTatiliExpiryStart && haftaTatiliRows.length > 0 && (
                <div className="mb-4 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                  Zamanaşımı başlangıç tarihi: {format(new Date(haftaTatiliExpiryStart), "dd.MM.yyyy")} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
                </div>
              )}
              {haftaTatiliRows.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table
                    className="w-full border-collapse text-sm"
                    style={{ border: "1px solid #d2d2d2", tableLayout: "fixed" }}
                  >
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="text-left font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "22%" }}>
                          Tarih (Ücret Dönemi)
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "10%" }}>
                          Hafta Sayısı
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "12%" }}>
                          Ücret (BRÜT)
                        </th>
                        <th className="text-center font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "12%" }}>
                          Katsayı
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "14%" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "15%" }}>
                          Günlük Brüt Ücret %50 Zamlı
                        </th>
                        <th className="text-right font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2", width: "15%" }}>
                          Hafta Tatili Ücreti
                        </th>
                        <th className="border-0 bg-transparent w-8"></th>
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
                          <td className="text-gray-900 dark:text-gray-100" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <div className="flex gap-1 items-center">
                                <input
                                  type="date"
                                  value={row.startISO || ""}
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const endISO = r.endISO || "";
                                      const startFormatted = newStart ? new Date(newStart).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = endISO ? new Date(endISO).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      let newWeekCount = r.weekCount;
                                      if (newStart && endISO) {
                                        newWeekCount = calculateWeekCount(newStart, endISO, haftaTatiliExcludedDays);
                                      }
                                      const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                      const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                      return { ...r, startISO: newStart, period: newPeriod, weekCount: newWeekCount, haftaTatiliTotal };
                                    }));
                                  }}
                                  className="w-32 bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-xs"
                                />
                                <span>-</span>
                                <input
                                  type="date"
                                  value={row.endISO || ""}
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const startISO = r.startISO || "";
                                      const startFormatted = startISO ? new Date(startISO).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = newEnd ? new Date(newEnd).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      let newWeekCount = r.weekCount;
                                      if (startISO && newEnd) {
                                        newWeekCount = calculateWeekCount(startISO, newEnd, haftaTatiliExcludedDays);
                                      }
                                      const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                      const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                      return { ...r, endISO: newEnd, period: newPeriod, weekCount: newWeekCount, haftaTatiliTotal };
                                    }));
                                  }}
                                  className="w-32 bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-xs"
                                />
                              </div>
                            ) : row.period}
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <input
                                type="number"
                                value={row.weekCount}
                                onChange={(e) => {
                                  const newWeekCount = Number(e.target.value) || 0;
                                  setHaftaTatiliRows((prev) => prev.map((r, i) => {
                                    if (i !== index) return r;
                                    const dailyWage50Zamli = Number((r.dailyWage * 1.5).toFixed(2));
                                    const haftaTatiliTotal = dailyWage50Zamli * newWeekCount;
                                    return { ...r, weekCount: newWeekCount, haftaTatiliTotal };
                                  }));
                                }}
                                className="w-16 text-right bg-transparent outline-none border border-gray-300 rounded px-1 py-0.5 text-sm"
                              />
                            ) : row.weekCount}
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            <div className="flex items-center justify-end gap-0.5">
                              <input
                                type="text"
                                value={row.wage ? row.wage.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                                onChange={(e) => handleWageChange(index, e.target.value)}
                                className="w-full text-right bg-transparent outline-none border border-transparent focus:border-gray-300 rounded px-2 py-1"
                              />
                              <span className="text-gray-600 dark:text-gray-400"> ₺</span>
                            </div>
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-center" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.coefficient.toFixed(4)}
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.dailyWage.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {(row.dailyWage * 1.5).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className="font-semibold text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                            {row.haftaTatiliTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className="border-0 bg-transparent w-8 p-0">
                            {hoveredRow === index && (
                              <span className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer" onClick={() => duplicateRow(index)} title="Bu satırı kopyalayarak altına yeni bir satır ekler. Farklı dönemler için ayrı ayarlar kullanabilirsiniz.">+</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <td
                          colSpan={6}
                          className="text-gray-900 dark:text-gray-100 text-right"
                          style={{ padding: "8px", border: "1px solid #d2d2d2" }}
                        >
                          Toplam Hafta Tatili Ücreti:
                        </td>
                        <td className="text-gray-900 dark:text-gray-100 text-right" style={{ padding: "8px", border: "1px solid #d2d2d2" }}>
                          {haftaTatiliTotalBrutFromRows
                            .toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="border-0 bg-transparent w-8"></td>
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
          </div>
        </div>

        {/* Brütten Nete Çevir + Mahsuplaşma */}
        <div className="w-full mt-8 mb-24 md:mb-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-full">
          <div className="lg:col-span-3 w-full">
            <HaftaTatiliNetConversion 
              haftaTatiliBrutTotal={haftaTatiliTotalBrutFromRows} 
              tableData={haftaTatiliRows}
              dateRanges={dateRanges}
              onSummaryChange={setHaftaTatiliNetSummary} 
            />
          </div>
        </div>

        {/* Notlar Bölümü - Sadece Mobil/Tablet (En Altta) */}
        <div className="lg:hidden mt-8 mb-8">
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
                  <span>Toplu sözleşme hafta tatili alacağı hesaplaması yapılır.</span>
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
      
      {/* Hafta Tatili Rapor Modal */}
      <HaftaTatiliReportModal
        open={showHaftaTatiliReportModal}
        onClose={() => setShowHaftaTatiliReportModal(false)}
        haftaTatiliTableData={haftaTatiliRows}
        workerPeriods={dateRanges}
        selectedHolidayCount={selectedHolidayIds.length}
        totalHolidayDays={totalDays}
        haftaTatiliExpiryStart={haftaTatiliExpiryStart}
      />

      <HaftaTatiliKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <FooterActions 
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }} 
        onSave={handleSave}
        isSaving={isSaving}
        previewButton={{
          title: "Toplu İş Sözleşmesi Hafta Tatili Alacağı",
          copyTargetId: "hafta-tatili-rapor-icerik",
          buttonClassName: "bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition inline-flex items-center gap-2",
          renderContent: () => {
            // ReportPreviewButton'ın modal'ını kullanmıyoruz, HaftaTatiliReportModal'ı açmak için boş
            return null;
          },
          onPdf: async () => {
            await generateReport({
              type: "hafta_tatili_alacagi_toplu_sozlesme",
              form: {
                workerPeriods: dateRanges,
                haftaTatiliTableData: haftaTatiliRows,
                selectedHolidayCount: selectedHolidayIds.length,
                totalHolidayDays: totalDays,
                haftaTatiliExpiryStart,
              },
            });
          },
          onButtonClick: () => setShowHaftaTatiliReportModal(true),
        }}
      />
    </Layout>
  );
}
