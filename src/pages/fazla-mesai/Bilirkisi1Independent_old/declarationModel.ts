/**
 * declarationModel.ts
 * Beyan (Declaration) veri modeli - Bilirkişi-1 sayfası için
 * 
 * AMAÇ: Davacı ve tanıklar için ortak kullanılacak beyan/dağıtım verisi
 * 
 * ⚠️ KESİN KURAL:
 * - Bu model SADECE VERİ YAPISI içindir
 * - HESAP YOK (FM, 270, zamanaşımı YOK)
 * - Sadece BEYAN / DAĞITIM verisi
 */

/**
 * PatternDay: Haftalık desen içindeki tek bir gün grubu
 * 
 * Örnek:
 * - 5 gün 09:00-18:00 (Pazartesi-Cuma)
 * - 1 gün 09:00-13:00 (Cumartesi)
 */
export interface PatternDay {
  /** Kaç gün bu deseni kullanıyor (örn: 5 gün, 1 gün) */
  dayCount: number;
  
  /** Başlangıç saati (HH:mm formatında, örn: "09:00") */
  startTime: string;
  
  /** Bitiş saati (HH:mm formatında, örn: "18:00") */
  endTime: string;
}

/**
 * WeeklyPattern: Haftalık çalışma deseni
 * 
 * İki tip desen var:
 * - SINGLE: Tüm günler aynı saat (örn: 6 gün 09:00-18:00)
 * - MIXED: Farklı günler farklı saatler (örn: 5 gün 09:00-18:00 + 1 gün 09:00-13:00)
 */
export interface WeeklyPattern {
  /** Desen tipi: tek tip mi, karışık mı? */
  patternType: "SINGLE" | "MIXED";
  
  /** Gün grupları (SINGLE için 1 eleman, MIXED için 2+ eleman) */
  days: PatternDay[];
}

/**
 * Period: Beyan içindeki tek bir dönem
 * 
 * Bir beyan birden fazla dönemden oluşabilir:
 * - Yaz dönemi (Nisan-Ekim): 6 gün 08:00-17:00
 * - Kış dönemi (Kasım-Mart): 5 gün 09:00-18:00
 */
export interface Period {
  /** Benzersiz ID */
  id: string;
  
  /** Başlangıç tarihi (ISO formatında: YYYY-MM-DD) */
  startDate: string;
  
  /** Bitiş tarihi (ISO formatında: YYYY-MM-DD) */
  endDate: string;
  
  /** Dönem etiketi (örn: "Yaz", "Kış", "Ocak 2020", "Serbest") */
  label: string;
  
  /** Dönem tipi: YAZ, KIŞ, veya SERBEST */
  periodType?: "YAZ" | "KIŞ" | "SERBEST";
  
  /** Bu dönemdeki haftalık çalışma deseni */
  weeklyPattern: WeeklyPattern;
}

/**
 * Declaration: Tek bir kişinin (davacı veya tanık) beyanı
 * 
 * Bir beyan:
 * - Kime ait? (davacı mı, hangi tanık mı?)
 * - Hangi dönemleri kapsıyor?
 * - Her dönemde nasıl çalışmış?
 */
export interface Declaration {
  /** Beyan kaynağı: davacı mı, tanık mı? */
  sourceType: "DAVACI" | "TANIK";
  
  /** Kaynak adı (tanık adı, davacı için null olabilir) */
  sourceName: string | null;
  
  /** Bu beyana ait dönemler */
  periods: Period[];
}

/**
 * ÖRNEK KULLANIM:
 * 
 * // Davacı beyanı - tek dönem, tek tip desen
 * const davaciBeyan: Declaration = {
 *   sourceType: "DAVACI",
 *   sourceName: null,
 *   periods: [
 *     {
 *       id: "period-1",
 *       startDate: "2020-01-01",
 *       endDate: "2023-12-31",
 *       label: "Tüm Dönem",
 *       weeklyPattern: {
 *         patternType: "SINGLE",
 *         days: [
 *           { dayCount: 6, startTime: "09:00", endTime: "18:00" }
 *         ]
 *       }
 *     }
 *   ]
 * };
 * 
 * // Tanık beyanı - iki dönem, karışık desen
 * const tanikBeyan: Declaration = {
 *   sourceType: "TANIK",
 *   sourceName: "Ahmet Yılmaz",
 *   periods: [
 *     {
 *       id: "period-1",
 *       startDate: "2020-04-01",
 *       endDate: "2020-10-31",
 *       label: "Yaz",
 *       weeklyPattern: {
 *         patternType: "MIXED",
 *         days: [
 *           { dayCount: 5, startTime: "08:00", endTime: "17:00" },
 *           { dayCount: 1, startTime: "08:00", endTime: "13:00" }
 *         ]
 *       }
 *     },
 *     {
 *       id: "period-2",
 *       startDate: "2020-11-01",
 *       endDate: "2021-03-31",
 *       label: "Kış",
 *       weeklyPattern: {
 *         patternType: "SINGLE",
 *         days: [
 *           { dayCount: 5, startTime: "09:00", endTime: "18:00" }
 *         ]
 *       }
 *     }
 *   ]
 * };
 */
