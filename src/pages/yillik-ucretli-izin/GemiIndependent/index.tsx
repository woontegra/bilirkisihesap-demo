import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
import { API_BASE_URL } from "@/utils/apiClient";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
// Constants - inline (Gemi)
const NOTE_ITEMS: string[] = ["Gemi adamları için yıllık ücretli izin hakkı 4857 sayılı İş Kanunu'na tabidir.", "Deniz taşıma işlerinde çalışanlar özel hesaplamaya tabidir."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Bilirkişi Hesaplama | Gemi Yıllık Ücretli İzin Alacağı";
const PRINT_TITLE = "Gemi Yıllık Ücretli İzin Hesaplama";
const PRINT_HEADING = "Gemi Yıllık Ücretli İzin Hesaplama";
const REPORT_TITLE = "Yıllık Ücretli İzin";
type UsedRow = { id: string; start: string; end: string; days: string };
type WorkPeriod = { id: string; iseGiris: string; istenCikis: string; haricTutulacakTarihler?: string; gunSayisi?: number };
const createEmptyRow = (): UsedRow => ({ id: Math.random().toString(36).slice(2), start: "", end: "", days: "" });
const createInitialRows = (count = 7): UsedRow[] => Array.from({ length: count }, () => createEmptyRow());
const toDays = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Gemi özel fonksiyonları
/**
 * İki tarih arasındaki gün sayısını hesapla (30 gün = 1 ay, 360 gün = 1 yıl)
 * ÖNEMLİ: Her ay 30 gün olarak hesaplanır (Şubat 28 değil 30, Ağustos 31 değil 30, Mart 31 değil 30)
 * Tüm aylar eşit uzunlukta (30 gün) kabul edilir.
 */
const calculateDaysBetween = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    
    // Yıl, ay ve gün bilgilerini al
    const startYear = start.getFullYear();
    const startMonth = start.getMonth(); // 0-11 (Ocak=0, Şubat=1, ..., Aralık=11)
    const startDay = start.getDate();
    
    const endYear = end.getFullYear();
    const endMonth = end.getMonth(); // 0-11
    const endDay = end.getDate();
    
    // Toplam ay sayısını hesapla (her ay 30 gün)
    // Yıl farkı × 12 ay + ay farkı
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    
    // Gün farkı
    const dayDiff = endDay - startDay;
    
    // Toplam gün = (toplam ay × 30) + gün farkı + 1 (başlangıç ve bitiş dahil)
    const totalDays = totalMonths * 30 + dayDiff + 1;
    
    return totalDays;
  } catch {
    return 0;
  }
};

/**
 * Birden fazla çalışma dönemi için toplam gün sayısını hesapla
 * Manuel girilmiş gün sayısı varsa onu kullan, yoksa tarihlerden hesapla
 */
const calculateTotalDays = (workPeriods: WorkPeriod[]): number => {
  return workPeriods.reduce((total, period) => {
    if (period.gunSayisi !== undefined) {
      // Manuel girilmiş gün sayısı varsa onu kullan
      return total + period.gunSayisi;
    } else if (period.iseGiris && period.istenCikis) {
      // Yoksa tarihlerden hesapla
      return total + calculateDaysBetween(period.iseGiris, period.istenCikis);
    }
    return total;
  }, 0);
};
/**
 * Toplam gün sayısını yıl/ay/gün formatına çevir
 * 1 ay = 30 gün, 1 yıl = 360 gün
 */
const formatTotalWorkDays = (totalDays: number): string => {
  if (totalDays === 0) {
    return "0 gün";
  }
  
  if (totalDays < 360) {
    // 1 yıldan az ise sadece ay ve gün göster
    const ay = Math.floor(totalDays / 30);
    const gun = totalDays % 30;
    return `${totalDays} gün / 30 = ${ay} ay ${gun} gün`;
  } else {
    // 1 yıl ve üzeri ise yıl, ay ve gün göster
    const yil = Math.floor(totalDays / 360);
    const kalanGun = totalDays % 360;
    const ay = Math.floor(kalanGun / 30);
    const gun = kalanGun % 30;
    return `${totalDays} gün / 360 = ${yil} yıl ${ay} ay ${gun} gün`;
  }
};
/**
 * Gemi Adamları Yıllık İzin Hesaplama Fonksiyonu
 * Deniz İş Kanunu 40. Madde'ye göre:
 * - Aynı takvim yılı içinde en az 6 ay (180 gün) çalışma gereklidir
 * - 180 gün altı çalışma: 0 gün
 * - 180 gün - 360 gün arası (aynı yıl içinde): 15 gün
 * - 360 gün ve üzeri: Her 360 gün için 30 gün
 * 
 * Hesaplama: 1 ay = 30 gün, 1 yıl = 360 gün
 */
// TAM AY HESAPLAMA: Başlangıç gününden bir ay sonraki aynı güne ulaşıldı mı?
const calculateFullMonthsInYear = (startDate: Date, endDate: Date, year: number): number => {
  const yearStart = year === startDate.getFullYear() ? startDate : new Date(year, 0, 1);
  const yearEnd = year === endDate.getFullYear() ? endDate : new Date(year, 11, 31);
  
  let fullMonths = 0;
  let currentDate = new Date(yearStart);
  
  while (true) {
    // Bir ay sonraki aynı gün
    const nextMonthSameDay = new Date(currentDate);
    nextMonthSameDay.setMonth(currentDate.getMonth() + 1);
    
    // Bir ay sonraki gün - 1 gün = tam ayın sonu
    const oneMonthLater = new Date(nextMonthSameDay);
    oneMonthLater.setDate(oneMonthLater.getDate() - 1);
    
    // Eğer yearEnd >= oneMonthLater ise tam 1 ay dolmuş demektir
    if (yearEnd >= oneMonthLater && oneMonthLater.getFullYear() === year) {
      fullMonths++;
      currentDate = nextMonthSameDay;
    } else {
      break;
    }
  }
  
  return fullMonths;
};

const calculateGemiIzin = (workPeriods: WorkPeriod[]): number => {
  if (!workPeriods || workPeriods.length === 0) return 0;
  
  try {
    // 1) Toplam çalışma günü hesapla (TÜM dönemler - takvim yılı sınırı YOK)
    const totalDaysOverall = calculateTotalDays(workPeriods);
    
    // 2) Her takvim yılında kaç gün çalışıldığını hesapla (takvim yılı kuralı için)
    const yearlyDays: Record<number, number> = {};
    
    workPeriods.forEach(period => {
      if (!period.iseGiris || !period.istenCikis) return;
      
      const startDate = new Date(period.iseGiris);
      const endDate = new Date(period.istenCikis);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
      
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      // Her yıl için o yıldaki gün sayısını hesapla
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        
        const daysInThisYear = calculateDaysBetween(
          yearStart.toISOString().split('T')[0],
          yearEnd.toISOString().split('T')[0]
        );
        
        yearlyDays[year] += daysInThisYear;
      }
    });
    
    // 3) Takvim yılı kuralına göre toplam gün (sadece 6 ay = 180 gün dolduran yıllar)
    let totalDaysForCalendarRule = 0;
    Object.entries(yearlyDays).forEach(([year, days]) => {
      console.log(`[FRONTEND] ${year}: ${days} gün`);
      if (days >= 180) { // Aynı takvim yılında 180 gün (6 ay) dolduran yıllar
        totalDaysForCalendarRule += days;
      }
    });
    
    console.log(`[FRONTEND calculateGemiIzin] Toplam çalışma: ${totalDaysOverall} gün, Takvim yılı kuralı: ${totalDaysForCalendarRule} gün`);
    
    // İzin hesaplama: Önce 1 yıl kontrolü (takvim yılı sınırı YOK), sonra 6 ay kontrolü (takvim yılı sınırı VAR)
    if (totalDaysOverall >= 360) {
      // 1 yıl ve üzeri: Her tam yıl için 30 gün
      const fullYears = Math.floor(totalDaysOverall / 360);
      console.log(`[FRONTEND] ${fullYears} tam yıl (${totalDaysOverall} gün) → ${fullYears * 30} gün`);
      return fullYears * 30;
    }
    
    if (totalDaysForCalendarRule >= 180) {
      // Aynı takvim yılında 180 gün (6 ay): 15 gün
      console.log("[FRONTEND] Takvim yılında 180+ gün → 15 gün");
      return 15;
    }
    
    // İzin hakkı yok
    console.log("[FRONTEND] İzin hakkı yok");
    return 0;
  } catch {
    return 0;
  }
};

/**
 * Gemi Adamları Yıllık İzin Breakdown Hesaplama
 * Eski formatı koruyarak yeni değerlerle gösterir
 * Aynı takvim yılı içinde 6 ay (180 gün) kuralına göre hesaplar
 * 1 ay = 30 gün, 1 yıl = 360 gün
 */
const calculateGemiBreakdown = (workPeriods: WorkPeriod[]) => {
  if (!workPeriods || workPeriods.length === 0) {
    return { d1: 0, d2: 0, total: 0, y1: 0, y2: 0 };
  }
  
  try {
    // 1) Toplam çalışma günü hesapla (TÜM dönemler - takvim yılı sınırı YOK)
    const totalDaysOverall = calculateTotalDays(workPeriods);
    
    // 2) Her takvim yılında kaç gün çalışıldığını hesapla (takvim yılı kuralı için)
    const yearlyDays: Record<number, number> = {};
    
    workPeriods.forEach(period => {
      if (!period.iseGiris || !period.istenCikis) return;
      
      const startDate = new Date(period.iseGiris);
      const endDate = new Date(period.istenCikis);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
      
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      // Her yıl için o yıldaki gün sayısını hesapla
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        
        const daysInThisYear = calculateDaysBetween(
          yearStart.toISOString().split('T')[0],
          yearEnd.toISOString().split('T')[0]
        );
        
        yearlyDays[year] += daysInThisYear;
      }
    });
    
    // 3) Takvim yılı kuralına göre toplam gün (sadece 180 gün dolduran yıllar)
    let totalDaysForCalendarRule = 0;
    Object.values(yearlyDays).forEach(days => {
      if (days >= 180) { // Aynı takvim yılında 180 gün dolduran yıllar
        totalDaysForCalendarRule += days;
      }
    });
    
    // İzin hesaplama: Önce 1 yıl kontrolü, sonra 6 ay kontrolü
    if (totalDaysOverall >= 360) {
      // 1 yıl ve üzeri: Her tam yıl için 30 gün
      const fullYears = Math.floor(totalDaysOverall / 360);
      return { y1: 0, y2: fullYears, d1: 0, d2: fullYears * 30, total: fullYears * 30 };
    }
    
    if (totalDaysForCalendarRule >= 180) {
      // Aynı takvim yılında 180 gün (6 ay): 15 gün
      return { y1: 1, y2: 0, d1: 15, d2: 0, total: 15 };
    }
    
    // İzin hakkı yok
    return { y1: 0, y2: 0, d1: 0, d2: 0, total: 0 };
  } catch {
    return { d1: 0, d2: 0, total: 0, y1: 0, y2: 0 };
  }
};
const calculateUsedTotal = (rows: UsedRow[]) => rows.reduce((acc, row) => acc + toDays(row.days), 0);
const calculateRemainingDays = (total: number, used: number) => Math.max(0, total - used);

const validateSave = (data: { iseGiris: string; istenCikis: string; remainingDays: number; brutIzin: number }) => {
  if (!data.iseGiris?.trim()) return { isValid: false, message: "Giriş tarihi gerekli" };
  if (!data.istenCikis?.trim()) return { isValid: false, message: "Çıkış tarihi gerekli" };
  if (data.remainingDays < 0) return { isValid: false, message: "Geçerli izin günü giriniz" };
  if (data.brutIzin <= 0) return { isValid: false, message: "Brüt izin tutarı hesaplanamadı. Lütfen çıplak brüt ücreti kontrol edin." };
  return { isValid: true, message: "" };
};

import "@/styles/soft-glow.css";
import "@/styles/soft-glow.css";

export default function YillikIzinPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("yillik-gemi");
  
  // Dates and duration
  const [workPeriods, setWorkPeriods] = useState<WorkPeriod[]>([
    { id: "1", iseGiris: "", istenCikis: "" }
  ]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Her dönem için gün sayısını hesapla (manuel değer varsa onu kullan, yoksa tarihlerden hesapla)
  const workPeriodDays = useMemo(() => {
    const daysMap: Record<string, number> = {};
    workPeriods.forEach(period => {
      if (period.gunSayisi !== undefined) {
        // Manuel girilmiş gün sayısı varsa onu kullan
        daysMap[period.id] = period.gunSayisi;
      } else if (period.iseGiris && period.istenCikis) {
        // Yoksa tarihlerden hesapla
        daysMap[period.id] = calculateDaysBetween(period.iseGiris, period.istenCikis);
      } else {
        daysMap[period.id] = 0;
      }
    });
    return daysMap;
  }, [workPeriods]);
  
  // Tarih değiştiğinde manuel gün sayısını sıfırla (otomatik hesaplama yapılsın)
  const handleDateChange = (periodId: string, field: 'iseGiris' | 'istenCikis', value: string) => {
    updateWorkPeriod(periodId, { [field]: value, gunSayisi: undefined });
  };
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(2));
  const [employerPayment, setEmployerPayment] = useState("");
  
  // Kaydet/İçe Aktar için state'ler
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: UsedRow[]; createdAt: string }[]>([]);

  // YENİ RAPOR SİSTEMİ: State

  const addWorkPeriod = () => {
    setWorkPeriods((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), iseGiris: "", istenCikis: "" }
    ]);
  };

  const removeWorkPeriod = (id: string) => {
    if (workPeriods.length > 1) {
      setWorkPeriods((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const updateWorkPeriod = (id: string, patch: Partial<WorkPeriod>) => {
    setWorkPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (id: string, patch: Partial<UsedRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Toplam çalışma günü (30 gün = 1 ay, 360 gün = 1 yıl)
  const totalWorkDays = useMemo(
    () => calculateTotalDays(workPeriods),
    [workPeriods]
  );

  // Gemi Adamları Yıllık İzin Hesaplama (Deniz İş Kanunu 40. Madde)
  const izinHakki = useMemo(
    () => calculateGemiIzin(workPeriods),
    [workPeriods]
  );

  // Breakdown hesaplama (görsel format için)
  const initialBreakdown = useMemo(
    () => calculateGemiBreakdown(workPeriods),
    [workPeriods]
  );

  // Manuel düzenlenebilir d1 ve d2 değerleri (sonuç kısmı)
  const [d1, setD1] = useState<string>("");
  const [d2, setD2] = useState<string>("");

  // Tarih değiştiğinde otomatik hesaplanan değerleri set et
  useEffect(() => {
    setD1(String(initialBreakdown.d1));
    setD2(String(initialBreakdown.d2));
  }, [initialBreakdown]);

  // Manuel değerlerle breakdown hesaplama
  const breakdown = useMemo(() => {
    const d1Num = Number(d1) || 0;
    const d2Num = Number(d2) || 0;
    const total = d1Num + d2Num;
    // y1 ve y2'yi geri hesapla (görüntüleme için)
    const y1 = d1Num > 0 ? Math.round(d1Num / 15) : 0;
    const y2 = d2Num > 0 ? Math.round(d2Num / 30) : 0;
    return { y1, y2, d1: d1Num, d2: d2Num, total };
  }, [d1, d2]);

  const usedTotal = useMemo(() => calculateUsedTotal(rows), [rows]);
  const remainingDays = useMemo(
    () => calculateRemainingDays(breakdown.total, usedTotal),
    [breakdown.total, usedTotal]
  );

  // Backend'den gelen tüm hesaplama sonuçları
  const [totalWorkDaysFromBackend, setTotalWorkDaysFromBackend] = useState(0);
  const [totalVacationDaysFromBackend, setTotalVacationDaysFromBackend] = useState(0);
  const [breakdownFromBackend, setBreakdownFromBackend] = useState<{ y1: number; y2: number; d1: number; d2: number; total: number }>({ y1: 0, y2: 0, d1: 0, d2: 0, total: 0 });
  const [remainingDaysFromBackend, setRemainingDaysFromBackend] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);
  
  // Backend'den değer gelene kadar frontend hesaplamasını fallback olarak kullan
  const displayTotalWorkDays = totalWorkDaysFromBackend || totalWorkDays;
  const displayBreakdown = breakdownFromBackend.total > 0 ? breakdownFromBackend : breakdown;
  const displayRemainingDays = remainingDaysFromBackend > 0 || brutIzin > 0 ? remainingDaysFromBackend : remainingDays;

  // Mor kart Tutar: Backend 0 dönerse lokal formül (çıplak brüt / 30 × kalan gün) ile hesapla
  const morKartTutar = useMemo(() => {
    if (brutIzin > 0) return brutIzin;
    const ucret = toDays(brutUcret);
    return (ucret / 30) * displayRemainingDays;
  }, [brutIzin, brutUcret, displayRemainingDays]);

  // İşten çıkış tarihine göre yıl belirleme (en son işten çıkış tarihi)
  const selectedYear = useMemo(() => {
    if (workPeriods && workPeriods.length > 0) {
      const exitDates = workPeriods
        .map(p => p.istenCikis)
        .filter(d => d && d.trim() !== "")
        .map(d => new Date(d!))
        .filter(d => !isNaN(d.getTime()));
      
      if (exitDates.length > 0) {
        const latestExit = exitDates.reduce((latest, current) => 
          current > latest ? current : latest
        );
        const year = latestExit.getFullYear();
        if (year >= 2010 && year <= 2030) {
          return year;
        }
      }
    }
    return new Date().getFullYear();
  }, [workPeriods]);

  // Brütten Nete: Backend 0 dönerse lokal hesaplama (SGK %14, İşsizlik %1, gelir vergisi dilimleri, damga binde 7,59)
  const bruttenNeteDisplay = useMemo(() => {
    const brut = brutIzin > 0 ? brutIzin : morKartTutar;
    if (brut <= 0) return { brut: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, net: 0 };
    if (brutIzin > 0) {
      return { brut, sgk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, net: netIzin };
    }
    const sgkVal = brut * 0.14;
    const issizlikVal = brut * 0.01;
    const matrah = Math.max(0, brut - sgkVal - issizlikVal);
    const gv = calculateIncomeTaxWithBrackets(selectedYear, matrah);
    const damgaVal = brut * 0.00759;
    const netVal = brut - sgkVal - issizlikVal - gv.tax - damgaVal;
    return { brut, sgk: sgkVal, issizlik: issizlikVal, gelirVergisi: gv.tax, gelirVergisiDilimleri: gv.brackets, damgaVergisi: damgaVal, net: netVal };
  }, [brutIzin, morKartTutar, sgk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netIzin, selectedYear]);

  const asgariUcretHatasi = useMemo(() => {
    if (!workPeriods || workPeriods.length === 0 || !brutUcret) return null;
    const exitDates = workPeriods
      .map(p => p.istenCikis)
      .filter(d => d && d.trim() !== "");
    if (exitDates.length === 0) return null;
    const latestExitDate = exitDates[exitDates.length - 1];
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(latestExitDate);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(latestExitDate).getFullYear();
      return { mesaj: `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺).`, asgariUcret: asgariUcret };
    }
    return null;
  }, [workPeriods, brutUcret]);

  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        const payload = {
          workPeriods: workPeriods.filter(p => p.iseGiris && p.istenCikis),
          brutUcret: toDays(brutUcret),
          usedDays: usedTotal,
          year: selectedYear
        };
        
        const tenantId = Number(localStorage.getItem("tenant_id") || "1");
        const response = await fetch(`${API_BASE_URL}/api/yillik-izin/gemi`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": String(tenantId),
          },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          const errMsg = result?.error || `HTTP ${response.status}`;
          console.error("Backend hesaplama hatası:", errMsg, "Payload:", payload);
          showToastError(errMsg);
          return;
        }
        
        if (result.success && result.data) {
          // Backend'den gelen TÜM değerleri kullan
          setTotalWorkDaysFromBackend(result.data.totalWorkDays || 0);
          setTotalVacationDaysFromBackend(result.data.totalVacationDays || 0);
          setBreakdownFromBackend(result.data.breakdown || { y1: 0, y2: 0, d1: 0, d2: 0, total: 0 });
          setRemainingDaysFromBackend(result.data.remainingDays || 0);
          setBrutIzin(result.data.brutIzin || 0);
          setSgk(result.data.sgk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNetIzin(result.data.netIzin || 0);
        }
      } catch (error) { 
        console.error("Backend hesaplama hatası:", error);
        showToastError(error instanceof Error ? error.message : "Hesaplama isteği başarısız.");
      }
    };
    
    if (brutUcret && toDays(brutUcret) > 0 && workPeriods.some(p => p.iseGiris && p.istenCikis)) {
      calculateFromBackend();
    } else {
      setTotalWorkDaysFromBackend(0);
      setTotalVacationDaysFromBackend(0);
      setBreakdownFromBackend({ y1: 0, y2: 0, d1: 0, d2: 0, total: 0 });
      setRemainingDaysFromBackend(0);
      setBrutIzin(0);
      setSgk(0);
      setIssizlik(0);
      setGelirVergisi(0);
      setGelirVergisiDilimleri("");
      setDamgaVergisi(0);
      setNetIzin(0);
    }
  }, [brutUcret, selectedYear, workPeriods, usedTotal]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const API_BASE = API_BASE_URL;
      
      const response = await fetch(`${API_BASE}/api/saved-cases/${loadId}`, {
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
        notes: data.notes || data.aciklama || "",
        brut_total: data.brut_total || payload.brut_total || payload.total,
        net_total: data.net_total || payload.net_total || payload.total,
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
        
        // Yeni format: data.form içinde form verileri
        const form = formData.form || formData.data?.form || formData;
        
        // Form alanlarını yükle
        if (form.workPeriods) {
          setWorkPeriods(form.workPeriods);
        } else if (formData.workPeriods) {
          setWorkPeriods(formData.workPeriods);
        } else if (formData.eklentiler?.workPeriods) {
          setWorkPeriods(formData.eklentiler.workPeriods);
        }
        
        if (form.brutUcret || form.brut_ucret) {
          setBrutUcret(form.brutUcret || form.brut_ucret);
        } else if (formData.brutUcret || formData.brut_ucret) {
          setBrutUcret(formData.brutUcret || formData.brut_ucret);
        }
        
        if (form.rows) {
          setRows(form.rows);
        } else if (formData.rows) {
          setRows(formData.rows);
        }
        
        if (form.employerPayment || form.employer_payment) {
          setEmployerPayment(form.employerPayment || form.employer_payment || "");
        } else if (formData.employerPayment || formData.employer_payment) {
          setEmployerPayment(formData.employerPayment || formData.employer_payment || "");
        } else if (formData.eklentiler?.employer_payment) {
          setEmployerPayment(formData.eklentiler.employer_payment || "");
        }
        
        if (form.d1) setD1(String(form.d1));
        if (form.d2) setD2(String(form.d2));
        
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

  // YENİ RAPOR SİSTEMİ: Config
  const gemiYillikReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brutForReport = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
    const netForReport = brutIzin > 0 ? netIzin : bruttenNeteDisplay.net;
    const sgkForReport = brutIzin > 0 ? sgk : bruttenNeteDisplay.sgk;
    const issizlikForReport = brutIzin > 0 ? issizlik : bruttenNeteDisplay.issizlik;
    const gelirVergisiForReport = brutIzin > 0 ? gelirVergisi : bruttenNeteDisplay.gelirVergisi;
    const damgaVergisiForReport = brutIzin > 0 ? damgaVergisi : bruttenNeteDisplay.damgaVergisi;
    const gelirVergisiDilimleriForReport = brutIzin > 0 ? gelirVergisiDilimleri : bruttenNeteDisplay.gelirVergisiDilimleri;

    // İşveren ödemesi hesabı
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, '').replace(',', '.')) || 0;
    const mahsuplamaSonucu = Math.max(0, brutForReport - employerPaymentNum);

    // Çalışma dönemleri bilgisi
    const workPeriodsSummary = workPeriods.map(wp => {
      if (!wp.iseGiris || !wp.istenCikis) return null;
      const days = wp.gunSayisi ?? calculateDaysBetween(wp.iseGiris, wp.istenCikis);
      return {
        start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
        end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
        days,
      };
    }).filter(Boolean) as { start: string; end: string; days: number }[];

    const validUsedRows = rows.filter(r => r.start || r.end || r.days).map(r => ({
      start: r.start,
      end: r.end,
      days: r.days || "0",
    }));
    const brutUcretNum = Number(String(brutUcret).replace(/\./g, '').replace(',', '.')) || 0;

    const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '16px', border: '1px solid #999', fontSize: '10px' };
    const thStyle = { padding: '5px 8px', fontWeight: 600, border: '1px solid #999', backgroundColor: '#f9fafb' };
    const tdStyle = { padding: '5px 8px', border: '1px solid #999' };
    const tdRightStyle = { ...tdStyle, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };

    return {
      title: REPORT_TITLE,
      sections: {
        info: true,
        periodTable: false,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: workPeriods[0]?.iseGiris ? new Date(workPeriods[0].iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: workPeriods[workPeriods.length - 1]?.istenCikis ? new Date(workPeriods[workPeriods.length - 1].istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Çıplak Brüt Ücret", value: brutUcret ? `${fmtLocal(brutUcretNum)}₺` : "-" },
        { label: "Toplam Çalışma Süresi", value: formatTotalWorkDays(displayTotalWorkDays) },
      ],
      customSections: [
        {
          title: "Çalışma Dönemleri",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Başlangıç</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Bitiş</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {workPeriodsSummary.map((wp, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}>{wp.start}</td>
                    <td style={tdStyle}>{wp.end}</td>
                    <td style={tdRightStyle}>{wp.days} gün</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          condition: workPeriodsSummary.length > 0,
        },
        {
          title: "Yıllık İzin Hak Edişi (Gemi Adamları)",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Dönem</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {displayBreakdown.y1 > 0 && displayBreakdown.d1 > 0 && (
                  <tr>
                    <td style={tdStyle}>{displayBreakdown.y1} yıl (İlk dönem - 15 gün/yıl)</td>
                    <td style={tdRightStyle}>{displayBreakdown.y1} yıl × 15 gün = {displayBreakdown.d1} gün</td>
                  </tr>
                )}
                {displayBreakdown.y2 > 0 && displayBreakdown.d2 > 0 && (
                  <tr>
                    <td style={tdStyle}>{displayBreakdown.y2} yıl (Sonraki dönem - 30 gün/yıl)</td>
                    <td style={tdRightStyle}>{displayBreakdown.y2} yıl × 30 gün = {displayBreakdown.d2} gün</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                  <td style={tdStyle}>Toplam Hak Edilen</td>
                  <td style={tdRightStyle}>{displayBreakdown.total} gün</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(validUsedRows.length > 0 ? [{
          title: "Kullanılan İzinler",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Başlangıç Tarihi</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Bitiş Tarihi</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {validUsedRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}>{row.start ? new Date(row.start).toLocaleDateString("tr-TR") : "-"}</td>
                    <td style={tdStyle}>{row.end ? new Date(row.end).toLocaleDateString("tr-TR") : "-"}</td>
                    <td style={tdRightStyle}>{row.days || "0"} gün</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                  <td colSpan={2} style={tdStyle}>Toplam Kullanılan</td>
                  <td style={tdRightStyle}>{usedTotal} gün</td>
                </tr>
              </tbody>
            </table>
          ),
        }] : []),
        {
          title: "Yıllık Ücretli İzin Hesaplama",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Alan</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Değer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Kalan İzin Süresi</td>
                  <td style={tdRightStyle}>{displayRemainingDays} gün</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Günlük Ücret (Toplam/30)</td>
                  <td style={tdRightStyle}>
                    ({fmtLocal(brutUcretNum)}₺ / 30 × {displayRemainingDays} gün)
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                  <td style={tdStyle}>Yıllık Ücretli İzin Alacağı</td>
                  <td style={tdRightStyle}>{fmtLocal(brutForReport)}₺</td>
                </tr>
              </tbody>
            </table>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutForReport)}₺` },
          { label: "SGK İşçi Primi (%14)", value: `-${fmtLocal(sgkForReport)}₺`, isDeduction: true },
          { label: "İşsizlik Sigortası Primi (%1)", value: `-${fmtLocal(issizlikForReport)}₺`, isDeduction: true },
          { label: `Gelir Vergisi ${gelirVergisiDilimleriForReport}`, value: `-${fmtLocal(gelirVergisiForReport)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisiForReport)}₺`, isDeduction: true },
          { label: "Net Yıllık İzin Alacağı", value: `${fmtLocal(netForReport)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutForReport)}₺` },
          { label: "İşveren Ödemesi", value: `-${fmtLocal(employerPaymentNum)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmtLocal(mahsuplamaSonucu)}₺`,
        },
      },
    };
  }, [workPeriods, brutUcret, displayTotalWorkDays, displayBreakdown, displayRemainingDays, rows, usedTotal, brutIzin, bruttenNeteDisplay, sgk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netIzin, employerPayment]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brutUcretNum = Number(String(brutUcret).replace(/\./g, '').replace(',', '.')) || 0;
    const brutForReport = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, '').replace(',', '.')) || 0;
    const validUsedRows = rows.filter(r => r.start || r.end || r.days).map(r => ({ start: r.start, end: r.end, days: r.days || "0" }));

    const workPeriodsSummary = workPeriods
      .filter(wp => wp.iseGiris && wp.istenCikis)
      .map(wp => ({
        start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
        end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
        days: wp.gunSayisi ?? calculateDaysBetween(wp.iseGiris, wp.istenCikis),
      }));

    if (gemiYillikReportConfig.infoRows && gemiYillikReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: gemiYillikReportConfig.infoRows.map(r => [r.label, String(r.value ?? "-")]) });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (workPeriodsSummary.length > 0) {
      const wpRows = workPeriodsSummary.map(wp => [wp.start, wp.end, `${wp.days} gün`]);
      const n2 = adaptToWordTable({ headers: ["Başlangıç", "Bitiş", "Gün Sayısı"], rows: wpRows });
      sections.push({ id: "calisma-donemleri", title: "Çalışma Dönemleri", html: buildWordTable(n2.headers, n2.rows) });
    }

    const hakRows: string[][] = [];
    if (displayBreakdown.y1 > 0 && displayBreakdown.d1 > 0) hakRows.push([`${displayBreakdown.y1} yıl (İlk dönem - 15 gün/yıl)`, `${displayBreakdown.y1} yıl × 15 gün = ${displayBreakdown.d1} gün`]);
    if (displayBreakdown.y2 > 0 && displayBreakdown.d2 > 0) hakRows.push([`${displayBreakdown.y2} yıl (Sonraki dönem - 30 gün/yıl)`, `${displayBreakdown.y2} yıl × 30 gün = ${displayBreakdown.d2} gün`]);
    hakRows.push(["Toplam Hak Edilen", `${displayBreakdown.total} gün`]);
    const n3 = adaptToWordTable({ headers: ["Dönem", "Gün Sayısı"], rows: hakRows });
    sections.push({ id: "yillik-izin-hak-edisi", title: "Yıllık İzin Hak Edişi (Gemi Adamları)", html: buildWordTable(n3.headers, n3.rows) });

    if (validUsedRows.length > 0) {
      const exclRows = validUsedRows.map(r => [r.start ? new Date(r.start).toLocaleDateString("tr-TR") : "-", r.end ? new Date(r.end).toLocaleDateString("tr-TR") : "-", `${r.days || "0"} gün`]);
      exclRows.push(["Toplam Kullanılan", "", `${usedTotal} gün`]);
      const n4 = adaptToWordTable({ headers: ["Başlangıç Tarihi", "Bitiş Tarihi", "Gün Sayısı"], rows: exclRows });
      sections.push({ id: "kullanilan-izinler", title: "Kullanılan İzinler", html: buildWordTable(n4.headers, n4.rows) });
    }

    const calcRows = [
      ["Kalan İzin Süresi", `${displayRemainingDays} gün`],
      ["Günlük Ücret (Toplam/30)", `(${fmtLocal(brutUcretNum)}₺ / 30 × ${displayRemainingDays} gün)`],
      ["Yıllık Ücretli İzin Alacağı", `${fmtLocal(brutForReport)}₺`],
    ];
    const n5 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: calcRows });
    sections.push({ id: "yillik-ucretli-izin-hesaplama", title: "Yıllık Ücretli İzin Hesaplama", html: buildWordTable(n5.headers, n5.rows) });

    const gnd = gemiYillikReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n6 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n6.headers, n6.rows) });
    }

    const md = gemiYillikReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n7 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n7.headers, n7.rows) });
    }

    return sections;
  }, [gemiYillikReportConfig, workPeriods, displayBreakdown, displayRemainingDays, rows, usedTotal, brutUcret, brutIzin, bruttenNeteDisplay, employerPayment]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("gemi-yillik-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = gemiYillikReportConfig.title;
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
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
    };
  }, [gemiYillikReportConfig.title]);

  const handleSave = () => {
    try {
      const brutForValidation = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
      const netForSave = brutIzin > 0 ? netIzin : bruttenNeteDisplay.net;
      const validation = validateSave({
        iseGiris: workPeriods[0]?.iseGiris || "",
        istenCikis: workPeriods[workPeriods.length - 1]?.istenCikis || "",
        remainingDays: displayRemainingDays,
        brutIzin: brutForValidation,
      });
      if (!validation.isValid) {
        showToastError(validation.message);
        return;
      }

      const sgkForSave = brutIzin > 0 ? sgk : bruttenNeteDisplay.sgk;
      const issizlikForSave = brutIzin > 0 ? issizlik : bruttenNeteDisplay.issizlik;
      const gelirVergisiForSave = brutIzin > 0 ? gelirVergisi : bruttenNeteDisplay.gelirVergisi;
      const damgaVergisiForSave = brutIzin > 0 ? damgaVergisi : bruttenNeteDisplay.damgaVergisi;
      const gelirVergisiDilimleriForSave = brutIzin > 0 ? gelirVergisiDilimleri : bruttenNeteDisplay.gelirVergisiDilimleri;

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "yillik_izin_gemi",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              workPeriods,
              brutUcret,
              rows,
              employerPayment,
              d1,
              d2,
            },
            results: {
              breakdown,
              usedTotal,
              remainingDays: displayRemainingDays,
              brutIzin: brutForValidation,
              sgk: sgkForSave,
              issizlik: issizlikForSave,
              gelirVergisi: gelirVergisiForSave,
              gelirVergisiDilimleri: gelirVergisiDilimleriForSave,
              damgaVergisi: damgaVergisiForSave,
              netIzin: netForSave,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutForValidation.toFixed(2)),
          net_toplam: Number(netForSave.toFixed(2)),
          ise_giris: workPeriods[0]?.iseGiris || null,
          isten_cikis: workPeriods[workPeriods.length - 1]?.istenCikis || null,
          eklentiler: { employer_payment: employerPayment, workPeriods }
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/yillik-izin/gemi/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = workPeriods.some(p => p.iseGiris || p.istenCikis) || brutUcret || rows.some(r => r.start || r.end || r.days) || employerPayment;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setWorkPeriods([{ id: "1", iseGiris: "", istenCikis: "" }]);
      setBrutUcret("");
      setRows(() => createInitialRows(2));
      setEmployerPayment("");
      setD1("");
      setD2("");
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/yillik-izin/gemi";
      }
    } catch {}
  };

  return (
    <Layout 
      fluid 
      hideHeader={true} 
      pageKey="yillik-izin" 
      noBackgroundColor={true}
    >
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="gemi-yillik-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={gemiYillikReportConfig} />
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {videoLink && (
          <div className="mb-4 flex justify-end gap-2">
            <Button
              onClick={() => window.open(videoLink, "_blank")}
              variant="outline"
              size="sm"
              className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            >
              <Youtube className="h-4 w-4" />
              Kullanım Videosu İzle
            </Button>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
              {/* Work Periods */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çalışma Dönemleri</label>
                </div>
                {workPeriods.map((period, index) => (
                  <div key={period.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Giriş Tarihi</label>
                        <input 
                          type="date" 
                          max="9999-12-31" 
                          value={period.iseGiris} 
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && value.includes('-')) {
                              const parts = value.split('-');
                              if (parts[0] && parts[0].length > 4) {
                                parts[0] = parts[0].substring(0, 4);
                                const correctedValue = parts.join('-');
                                handleDateChange(period.id, 'iseGiris', correctedValue);
                                return;
                              }
                            }
                            handleDateChange(period.id, 'iseGiris', value);
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(period.istenCikis)) {
                              const newDate = new Date(newValue);
                              const exitDate = new Date(period.istenCikis);
                              if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                                showToastError("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                                handleDateChange(period.id, 'iseGiris', period.istenCikis);
                              }
                            }
                          }}
                          className="w-full mt-1 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-w-0" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çıkış Tarihi</label>
                        <input 
                          type="date" 
                          max="9999-12-31" 
                          value={period.istenCikis} 
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && value.includes('-')) {
                              const parts = value.split('-');
                              if (parts[0] && parts[0].length > 4) {
                                parts[0] = parts[0].substring(0, 4);
                                const correctedValue = parts.join('-');
                                handleDateChange(period.id, 'istenCikis', correctedValue);
                                return;
                              }
                            }
                            handleDateChange(period.id, 'istenCikis', value);
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && period.iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(period.iseGiris)) {
                              const newDate = new Date(newValue);
                              const entryDate = new Date(period.iseGiris);
                              if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                                showToastError("Çıkış tarihi, giriş tarihinden önce olamaz.");
                                handleDateChange(period.id, 'istenCikis', period.iseGiris);
                              }
                            }
                          }}
                          className="w-full mt-1 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-w-0" 
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min="0"
                            value={workPeriodDays[period.id] || 0}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0;
                              updateWorkPeriod(period.id, { gunSayisi: value });
                            }}
                            className="w-16 rounded-xl border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-center font-semibold [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-10"
                            style={{
                              MozAppearance: 'textfield',
                            }}
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">≈ {workPeriodDays[period.id] || 0} gün</span>
                          {workPeriods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeWorkPeriod(period.id)}
                              className="text-red-600 hover:text-red-800 transition h-[38px] flex items-center"
                              title="Sil"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addWorkPeriod}
                  className="w-full text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-3 py-2 rounded-full border-2 border-blue-500 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                >
                  + Yeni Dönem Ekle
                </button>
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Toplam Çalışma Süresi</label>
                  <input disabled value={formatTotalWorkDays(displayTotalWorkDays)} className="w-full mt-1 rounded-xl h-11 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-medium" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Çıplak Brüt Ücret</label>
                  <input 
                    value={brutUcret} 
                    onChange={(e)=>setBrutUcret(e.target.value)} 
                    placeholder="Örn: 25.000,00" 
                    className={`w-full mt-1 rounded-xl h-11 border px-3 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 ${
                      asgariUcretHatasi 
                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                    }`} 
                  />
                  {asgariUcretHatasi && (
                    <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>
                  )}
                </div>
              </div>

              {/* Annual leave calculation */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Yıllık İzin Hesaplama</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                  <div className="flex items-center gap-2 flex-nowrap">
                    <span className="whitespace-nowrap">15 × {displayBreakdown.y1} =</span>
                    <input
                      type="number"
                      min="0"
                      value={d1}
                      onChange={(e) => setD1(e.target.value)}
                      className="w-[70px] min-w-[70px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm text-center font-semibold [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
                      style={{
                        MozAppearance: 'textfield',
                      }}
                    />
                    <span>gün</span>
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap">
                    <span className="whitespace-nowrap">30 × {displayBreakdown.y2} =</span>
                    <input
                      type="number"
                      min="0"
                      value={d2}
                      onChange={(e) => setD2(e.target.value)}
                      className="w-[70px] min-w-[70px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm text-center font-semibold [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
                      style={{
                        MozAppearance: 'textfield',
                      }}
                    />
                    <span>gün</span>
                  </div>
                  <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2 font-semibold text-gray-700 dark:text-gray-300">Toplam = {displayBreakdown.total} gün</div>
                </div>
                <div className="mt-3 text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Toplam Yıllık İzin Hakkı: {displayBreakdown.total} Gün</div>
              </div>

              {/* Accordion for used leaves */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                <div className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <button type="button" onClick={() => setAccordionOpen((s)=>!s)} className="flex items-center gap-2">
                    <span>Kullanılan İzinleri Dışla</span>
                    <svg className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExclusionSaveName("");
                        setShowExclusionSaveModal(true);
                      }}
                      disabled={rows.every(r => !r.start || !r.end)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      Kaydet
                      <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Girdiğiniz kullanılan izin günlerini bir isim vererek kaydedin. Başka hesaplamalarda tekrar kullanabilirsiniz.">ⓘ</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const sets = await getAllExclusionSets();
                        const setsWithCalculatedDays = sets.map(set => ({
                          ...set,
                          data: set.data.map(row => {
                            if (row.start && row.end && (!row.days || row.days === "0" || row.days === "")) {
                              const startDate = new Date(row.start);
                              const endDate = new Date(row.end);
                              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                return { ...row, days: String(diffDays) };
                              }
                            }
                            return row;
                          })
                        }));
                        setSavedExclusionSets(setsWithCalculatedDays);
                        setShowExclusionLoadModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      İçe Aktar
                      <span className="text-blue-800 hover:text-blue-900 cursor-help" title="Daha önce kaydettiğiniz kullanılan izin günlerini yükleyin. Aynı davacı için farklı hesaplamalarda zaman kazandırır.">ⓘ</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRows(createInitialRows(7))}
                      disabled={rows.every(r => !r.start && !r.end && !r.days)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Tümünü Sil
                      <span className="cursor-help text-xs" title="Tüm kullanılan izin kayıtlarını silin.">ⓘ</span>
                    </Button>
                  </div>
                </div>
                {accordionOpen && (
                  <div className="px-3 pb-3">
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-700 dark:text-gray-300">
                            <th className="py-2 pr-2 font-semibold">İzin Başlangıç Tarihi</th>
                            <th className="py-2 pr-2 font-semibold">İzin Bitiş Tarihi</th>
                            <th className="py-2 pr-2 font-semibold">Kullanılan Gün</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                          {rows.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2 pr-2">
                                <input 
                                  type="date" 
                                  max="9999-12-31" 
                                  value={r.start} 
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value && value.includes('-')) {
                                      const parts = value.split('-');
                                      if (parts[0] && parts[0].length > 4) {
                                        parts[0] = parts[0].substring(0, 4);
                                        setRow(r.id, { start: parts.join('-') });
                                        return;
                                      }
                                    }
                                    setRow(r.id, { start: value });
                                  }} 
                                  className="w-full rounded-xl h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input 
                                  type="date" 
                                  max="9999-12-31" 
                                  value={r.end} 
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value && value.includes('-')) {
                                      const parts = value.split('-');
                                      if (parts[0] && parts[0].length > 4) {
                                        parts[0] = parts[0].substring(0, 4);
                                        setRow(r.id, { end: parts.join('-') });
                                        return;
                                      }
                                    }
                                    setRow(r.id, { end: value });
                                  }} 
                                  className="w-full rounded-xl h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                                />
                              </td>
                              <td className="py-2 pr-2"><input value={r.days} onChange={(e)=>setRow(r.id,{days:e.target.value})} placeholder="Örn: 5" className="w-full rounded-xl h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" /></td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={3} className="pt-2">
                              <button type="button" onClick={addRow} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-semibold rounded-full px-3 py-1.5 border-2 border-blue-500 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition">+ Satır Ekle</button>
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} className="py-2 text-right font-medium">TOPLAM</td>
                            <td className="py-2 font-semibold">{usedTotal} gün</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-2 text-sm sm:text-base font-semibold">Kalan İzin Hakkı: {displayRemainingDays} Gün</div>
                  </div>
                )}
              </div>

              {/* Mor kart - Yıllık Ücretli İzin Hesaplama */}
              <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-l-4 border-purple-500 dark:border-purple-600 shadow-sm hover:shadow-md transition-all duration-200">
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-400 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Yıllık Ücretli İzin Hesaplama
                </h3>
                <div className="text-sm sm:text-base space-y-2">
                  <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30">
                    <span className="text-gray-700 dark:text-gray-300">Kalan İzin Süresi:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{displayRemainingDays} gün</span>
                  </p>
                  <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30">
                    <span className="text-gray-700 dark:text-gray-300">Günlük Ücret (Toplam/30):</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ({fmt(Number(String(brutUcret).replace(/\./g, '').replace(',', '.')) || 0)}₺ / 30 × {displayRemainingDays} gün)
                    </span>
                  </p>
                  <p className="flex items-center justify-between pt-2">
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">Yıllık Ücretli İzin Alacağı:</span>
                    <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{fmt(morKartTutar)}₺</span>
                  </p>
                </div>
              </div>

              {/* Gross to net */}
              <div className="mt-3 p-4 rounded-xl bg-transparent border-0">
                {/* Brütten Nete Çevir - ZARİF */}
                <div className="mt-4 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
                  <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
                    Brütten Nete Çevir
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Brüt Yıllık İzin Ücreti</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(bruttenNeteDisplay.brut)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(bruttenNeteDisplay.sgk)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(bruttenNeteDisplay.issizlik)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {bruttenNeteDisplay.gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(bruttenNeteDisplay.gelirVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(bruttenNeteDisplay.damgaVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net Yıllık İzin Ücreti</span>
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(bruttenNeteDisplay.net)}₺</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800/30">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödemedir</span>
                      <input
                        value={employerPayment}
                        onChange={(e)=>setEmployerPayment(e.target.value)}
                        placeholder="Örn: 10.000"
                        className="w-full sm:w-40 rounded-xl h-11 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notlar - tek kartın içinde */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Notlar
                </h3>
                <div className="font-bold text-slate-900 dark:text-slate-100 mb-3 text-base">Not: Deniz İş Kanunu – Yıllık Ücretli İzin 40. Madde</div>
                <div className="space-y-3">
                  {NOTE_ITEMS.map((note, index) => {
                    if (note === "") return <br key={index} />;
                    return (
                      <div key={index} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-semibold">⚓</span>
                        <p className="flex-1">{note}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: `Gemi ${REPORT_TITLE} Rapor`,
          copyTargetId: "gemi-yillik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #gemi-yillik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #gemi-yillik-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="gemi-yillik-word-copy">
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
          onPdf: () => downloadPdfFromDOM(`Gemi ${REPORT_TITLE} Rapor`, "report-content"),
        }}
      />

      {/* Kaydetme Modal */}
      {showExclusionSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionSaveModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan İzinleri Kaydet</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste Adı</label>
              <input
                type="text"
                placeholder="Örn: Davacı A - Kullanılan İzinler"
                value={exclusionSaveName}
                onChange={(e) => setExclusionSaveName(e.target.value)}
                className="mt-1 w-full rounded-xl h-11 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExclusionSaveModal(false);
                  setExclusionSaveName("");
                }}
              >
                İptal
              </Button>
              <Button
                onClick={async () => {
                  if (!exclusionSaveName.trim()) {
                    showToastError("Lütfen bir isim girin.");
                    return;
                  }
                  const saved = await saveExclusionSet(exclusionSaveName.trim(), rows.filter(r => r.start && r.end));
                  if (saved) {
                    success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`);
                    setShowExclusionSaveModal(false);
                    setExclusionSaveName("");
                  } else {
                    showToastError("Kaydetme işlemi başarısız oldu.");
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

      {/* Yükleme Modal */}
      {showExclusionLoadModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionLoadModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı Kullanılan İzinler</h3>
            {savedExclusionSets.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {savedExclusionSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600">
                    <div>
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRows(set.data.length > 0 ? set.data : createInitialRows(2));
                          success(`"${set.name}" yüklendi!`);
                          setShowExclusionLoadModal(false);
                        }}
                      >
                        Yükle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) {
                            const deleted = await deleteExclusionSet(set.id);
                            if (deleted) {
                              success("Liste silindi.");
                              const updatedSets = await getAllExclusionSets();
                              setSavedExclusionSets(updatedSets);
                            } else {
                              showToastError("Silme işlemi başarısız oldu.");
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
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
    </Layout>
  );
}
