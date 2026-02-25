/**
 * Date segmentation core - Tarih aralıklarını asgari ücret dönemlerine göre böler
 */

import { normalizeLocalDate } from "./dateHelpers";

// Asgari ücret dönemleri
const ASGARI_UCRET_DONEMLERI: Record<number, Array<{ start: string; end: string }>> = {
  2005: [{ start: "01.01.2005", end: "31.12.2005" }],
  2006: [{ start: "01.01.2006", end: "31.12.2006" }],
  2007: [
    { start: "01.01.2007", end: "30.06.2007" },
    { start: "01.07.2007", end: "31.12.2007" }
  ],
  2008: [
    { start: "01.01.2008", end: "30.06.2008" },
    { start: "01.07.2008", end: "31.12.2008" }
  ],
  2009: [
    { start: "01.01.2009", end: "30.06.2009" },
    { start: "01.07.2009", end: "31.12.2009" }
  ],
  2010: [
    { start: "01.01.2010", end: "30.06.2010" },
    { start: "01.07.2010", end: "31.12.2010" }
  ],
  2011: [
    { start: "01.01.2011", end: "30.06.2011" },
    { start: "01.07.2011", end: "31.12.2011" }
  ],
  2012: [
    { start: "01.01.2012", end: "30.06.2012" },
    { start: "01.07.2012", end: "31.12.2012" }
  ],
  2013: [
    { start: "01.01.2013", end: "30.06.2013" },
    { start: "01.07.2013", end: "31.12.2013" }
  ],
  2014: [
    { start: "01.01.2014", end: "30.06.2014" },
    { start: "01.07.2014", end: "31.12.2014" }
  ],
  2015: [{ start: "01.01.2015", end: "31.12.2015" }],
  2016: [{ start: "01.01.2016", end: "31.12.2016" }],
  2017: [{ start: "01.01.2017", end: "31.12.2017" }],
  2018: [{ start: "01.01.2018", end: "31.12.2018" }],
  2019: [{ start: "01.01.2019", end: "31.12.2019" }],
  2020: [{ start: "01.01.2020", end: "31.12.2020" }],
  2021: [{ start: "01.01.2021", end: "31.12.2021" }],
  2022: [
    { start: "01.01.2022", end: "30.06.2022" },
    { start: "01.07.2022", end: "31.12.2022" }
  ],
  2023: [
    { start: "01.01.2023", end: "30.06.2023" },
    { start: "01.07.2023", end: "31.12.2023" }
  ],
  2024: [{ start: "01.01.2024", end: "31.12.2024" }],
  2025: [{ start: "01.01.2025", end: "31.12.2025" }],
  2026: [{ start: "01.01.2026", end: "31.12.2026" }]
};

const toISODateLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/**
 * Tarih aralığını asgari ücret dönemlerine göre böler
 */
export function splitByAsgariUcretPeriods(startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
  console.log('🔧 [SPLIT] Giriş:', startDate, '→', endDate);
  
  const result: Array<{ start: Date; end: Date }> = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  console.log('🔧 [SPLIT] Yıl aralığı:', startYear, '→', endYear);

  for (let year = startYear; year <= endYear; year++) {
    const yearPeriods = ASGARI_UCRET_DONEMLERI[year];
    
    console.log(`🔧 [SPLIT] ${year} yılı için dönemler:`, yearPeriods);

    if (!yearPeriods || yearPeriods.length === 0) {
      console.log(`⚠️ [SPLIT] ${year} için dönem yok, yıl bazlı segment ekleniyor`);
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const segStart = year === startYear ? startDate : yearStart;
      const segEnd = year === endYear ? endDate : yearEnd;
      if (segStart <= segEnd) {
        result.push({ start: new Date(segStart), end: new Date(segEnd) });
        console.log(`  ✅ Segment eklendi: ${toISODateLocal(segStart)} → ${toISODateLocal(segEnd)}`);
      }
      continue;
    }

    for (const period of yearPeriods) {
      const pStart = normalizeLocalDate(period.start);
      const pEnd = normalizeLocalDate(period.end);
      
      console.log(`  🔧 Dönem: ${period.start} → ${period.end}`);
      console.log(`  🔧 Normalize: ${pStart} → ${pEnd}`);
      
      if (!pStart || !pEnd) {
        console.log(`  ⚠️ Normalize başarısız`);
        continue;
      }

      const segStart = pStart > startDate ? pStart : startDate;
      const segEnd = pEnd < endDate ? pEnd : endDate;

      if (segStart <= segEnd) {
        result.push({ start: new Date(segStart), end: new Date(segEnd) });
        console.log(`  ✅ Segment eklendi: ${toISODateLocal(segStart)} → ${toISODateLocal(segEnd)}`);
      } else {
        console.log(`  ⏭️ Atlandı (segStart > segEnd)`);
      }
    }
  }

  console.log('🔧 [SPLIT] Segment sayısı (merge öncesi):', result.length);
  
  result.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // MERGE İŞLEMİNİ KALDIR!
  // Asgari ücret dönemlerine göre bölündüyse, her segment ayrı kalmalı
  // Yoksa 01.07.2024 ve 30.06.2024 ardışık olduğu için birleştirilir (YANLIŞ!)
  
  console.log('✅ [SPLIT] Final segment sayısı:', result.length);
  
  return result;
}

/**
 * overtimeResults'tan segmentleri oluşturur (yıl ve asgari ücret dönemlerine göre böler)
 */
export function segmentOvertimeResult(result: any): Array<{ start: string; end: string }> {
  const startISO = result.start || result.startDate || '';
  const endISO = result.end || result.endDate || '';
  
  console.log('🔍 [SEGMENT] Input startISO:', startISO, 'endISO:', endISO);
  
  if (!startISO || !endISO) {
    console.log('⚠️ [SEGMENT] Tarih yok, boş array döndürülüyor');
    return [];
  }
  
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  
  console.log('🔍 [SEGMENT] startDate:', startDate, 'endDate:', endDate);
  console.log('🔍 [SEGMENT] startYear:', startDate.getFullYear(), 'endYear:', endDate.getFullYear());
  
  if (startDate > endDate) {
    console.log('⚠️ [SEGMENT] startDate > endDate, boş array döndürülüyor');
    return [];
  }
  
  // Asgari ücret dönemlerine göre böl
  const segments = splitByAsgariUcretPeriods(startDate, endDate);
  
  console.log('✅ [SEGMENT] splitByAsgariUcretPeriods sonucu:', segments.length, 'segment');
  segments.forEach((seg, idx) => {
    console.log(`  Segment ${idx}: ${toISODateLocal(seg.start)} → ${toISODateLocal(seg.end)}`);
  });
  
  return segments.map(seg => ({
    start: toISODateLocal(seg.start),
    end: toISODateLocal(seg.end)
  }));
}
