/**
 * OVERTIME CALCULATION ENGINE
 * 
 * Centralized, pure calculation engine for all overtime calculations.
 * NO React, NO state, NO side effects - only pure functions.
 * 
 * All pages use this engine by passing inputs and config.
 * All fixes happen in ONE place.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Exclusion = {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer";
  start: string;
  end: string;
  days: number;
};

export type TableRow = {
  id: string;
  year: number;
  startISO: string;
  endISO: string;
  weeks: number;
  weekCount: number;
  originalWeekCount?: number;
  fmHours: number;
  brut: number;
  fm: number;
  net: number;
  fmManual?: boolean;
  isManual?: boolean;
  manual?: boolean;
  adjustedHours?: number;
};

export type OvertimeInput = {
  workPeriod: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    weeklyDays: number;
    hasWeeklyRest: boolean;
  };
  exclusions: Exclusion[];
  katSayi?: number;
};

export type OvertimeConfig = {
  include270: boolean;
  mode270: "none" | "simple" | "detailed";
  limitation: boolean;
  limitationDate?: string;
  underground: boolean;
  expertMode: boolean;
};

export type OvertimeResult = {
  rows: TableRow[];
  weeklyFmHour: number;
  rawWeeklyFm: number;
  fmText: string;
  totals: {
    totalWeeks: number;
    totalFmHours: number;
    totalBrut: number;
    totalNet: number;
  };
};

// ============================================================================
// CONSTANTS
// ============================================================================

const FAZLA_MESAI_DENOMINATOR = 225;
const FAZLA_MESAI_KATSAYI = 1.5;
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.20;
const WEEKLY_WORK_HOURS_LIMIT = 45;
const HOURS_270_PER_WEEK = 270 / 52;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0] || '0', 10),
    minutes: parseInt(parts[1] || '0', 10),
  };
}

function calculateDailyWorkHours(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  const diffMinutes = endMinutes >= startMinutes 
    ? endMinutes - startMinutes 
    : (24 * 60 - startMinutes) + endMinutes;
  
  return diffMinutes / 60;
}

function calculateWeeklyWorkHours(
  dailyWorkHours: number,
  weeklyDays: number,
  hasWeeklyRest: boolean
): number {
  const effectiveDays = hasWeeklyRest ? Math.max(0, weeklyDays - 1) : weeklyDays;
  return dailyWorkHours * effectiveDays;
}

function calculateRawWeeklyFm(weeklyWorkHours: number): number {
  return Math.max(0, weeklyWorkHours - WEEKLY_WORK_HOURS_LIMIT);
}

function apply270Simple(weeklyFmHour: number): number {
  return Math.max(0, weeklyFmHour - HOURS_270_PER_WEEK);
}

function calculateWeeksBetweenDates(
  startDate: string,
  endDate: string,
  exclusions: Exclusion[]
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate total days
  const diffTime = end.getTime() - start.getTime();
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Subtract exclusion days
  let excludedDays = 0;
  for (const excl of exclusions) {
    const exclStart = new Date(excl.start);
    const exclEnd = new Date(excl.end);
    
    // Check if exclusion overlaps with period
    if (exclEnd >= start && exclStart <= end) {
      const overlapStart = exclStart > start ? exclStart : start;
      const overlapEnd = exclEnd < end ? exclEnd : end;
      const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      excludedDays += overlapDays;
    }
  }
  
  const effectiveDays = Math.max(0, totalDays - excludedDays);
  return effectiveDays / 7;
}

function buildRowsFromPeriod(
  startDate: string,
  endDate: string,
  weeklyFmHour: number,
  exclusions: Exclusion[]
): TableRow[] {
  const rows: TableRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentYear = start.getFullYear();
  let periodStart = new Date(start);
  
  while (periodStart <= end) {
    const yearEnd = new Date(currentYear, 11, 31);
    const periodEnd = yearEnd < end ? yearEnd : end;
    
    const weeks = calculateWeeksBetweenDates(
      periodStart.toISOString().split('T')[0],
      periodEnd.toISOString().split('T')[0],
      exclusions
    );
    
    if (weeks > 0) {
      rows.push({
        id: `${currentYear}-${periodStart.toISOString()}`,
        year: currentYear,
        startISO: periodStart.toISOString().split('T')[0],
        endISO: periodEnd.toISOString().split('T')[0],
        weeks,
        weekCount: weeks,
        originalWeekCount: weeks,
        fmHours: weeklyFmHour,
        brut: 0, // Will be calculated later with asgari ücret
        fm: 0,
        net: 0,
      });
    }
    
    currentYear++;
    periodStart = new Date(currentYear, 0, 1);
  }
  
  return rows;
}

function apply270Detailed(
  rows: TableRow[],
  rawWeeklyFm: number,
  startDate: string,
  endDate: string,
  exclusions: Exclusion[]
): TableRow[] {
  // Calculate total weeks in period
  const totalWeeks = calculateWeeksBetweenDates(startDate, endDate, exclusions);
  
  // Calculate total 270 hours for the period
  const total270Hours = totalWeeks * HOURS_270_PER_WEEK;
  
  // Distribute 270 deduction across rows proportionally
  let remaining270 = total270Hours;
  
  return rows.map(row => {
    if (remaining270 <= 0) {
      return { ...row, fmHours: rawWeeklyFm };
    }
    
    const rowTotal270 = row.weeks * HOURS_270_PER_WEEK;
    const deduction = Math.min(remaining270, rowTotal270);
    remaining270 -= deduction;
    
    const deductionPerWeek = row.weeks > 0 ? deduction / row.weeks : 0;
    const adjustedFmHour = Math.max(0, rawWeeklyFm - deductionPerWeek);
    
    return { ...row, fmHours: adjustedFmHour };
  });
}

function applyLimitation(rows: TableRow[], limitationDate: string): TableRow[] {
  const limitDate = new Date(limitationDate);
  
  return rows
    .map(row => {
      const rowStart = new Date(row.startISO);
      const rowEnd = new Date(row.endISO);
      
      // Row completely before limitation date - remove
      if (rowEnd < limitDate) {
        return null;
      }
      
      // Row completely after limitation date - keep as is
      if (rowStart >= limitDate) {
        return row;
      }
      
      // Row spans limitation date - trim to limitation date
      const newWeeks = calculateWeeksBetweenDates(
        limitDate.toISOString().split('T')[0],
        row.endISO,
        []
      );
      
      return {
        ...row,
        startISO: limitDate.toISOString().split('T')[0],
        weeks: newWeeks,
        weekCount: newWeeks,
      };
    })
    .filter((row): row is TableRow => row !== null);
}

function calculateRowAmounts(
  rows: TableRow[],
  katSayi: number,
  asgariUcretMap: Map<number, number>
): TableRow[] {
  return rows.map(row => {
    const brut = asgariUcretMap.get(row.year) || 0;
    const weeks = row.weeks || 0;
    const fmHours = row.fmHours || 0;
    
    const hoursEffective = row.adjustedHours ?? (weeks * fmHours);
    const step3 = brut * katSayi * hoursEffective;
    const step4 = step3 / FAZLA_MESAI_DENOMINATOR;
    const step5 = step4 * FAZLA_MESAI_KATSAYI;
    const fm = Number(step5.toFixed(2));
    const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
    
    return { ...row, brut, fm, net };
  });
}

function buildFmText(
  weeklyFmHour: number,
  dailyWorkHours: number,
  weeklyDays: number,
  hasWeeklyRest: boolean
): string {
  const weeklyWorkHours = calculateWeeklyWorkHours(dailyWorkHours, weeklyDays, hasWeeklyRest);
  
  return `Haftalık çalışma süresi: ${weeklyWorkHours.toFixed(2)} saat
Haftalık fazla mesai: ${weeklyFmHour.toFixed(2)} saat
Günlük çalışma: ${dailyWorkHours.toFixed(2)} saat
Haftalık gün: ${weeklyDays} gün`;
}

function calculateTotals(rows: TableRow[]) {
  return rows.reduce(
    (acc, row) => ({
      totalWeeks: acc.totalWeeks + (row.weeks || 0),
      totalFmHours: acc.totalFmHours + ((row.weeks || 0) * (row.fmHours || 0)),
      totalBrut: acc.totalBrut + (row.fm || 0),
      totalNet: acc.totalNet + (row.net || 0),
    }),
    { totalWeeks: 0, totalFmHours: 0, totalBrut: 0, totalNet: 0 }
  );
}

// ============================================================================
// MAIN ENGINE FUNCTION
// ============================================================================

export function calculateOvertime(
  input: OvertimeInput,
  config: OvertimeConfig,
  asgariUcretMap: Map<number, number>
): OvertimeResult {
  console.log('🚀 [OVERTIME ENGINE] Starting calculation', { input, config });
  
  // 1️⃣ Calculate daily work hours
  const dailyWorkHours = calculateDailyWorkHours(
    input.workPeriod.startTime,
    input.workPeriod.endTime
  );
  
  // 2️⃣ Calculate weekly work hours
  const weeklyWorkHours = calculateWeeklyWorkHours(
    dailyWorkHours,
    input.workPeriod.weeklyDays,
    input.workPeriod.hasWeeklyRest
  );
  
  // 3️⃣ Calculate raw weekly overtime
  const rawWeeklyFm = calculateRawWeeklyFm(weeklyWorkHours);
  
  // 4️⃣ Apply 270 hours deduction
  let weeklyFmHour = rawWeeklyFm;
  let rows: TableRow[] = [];
  
  if (config.include270 && config.mode270 === "simple") {
    weeklyFmHour = apply270Simple(rawWeeklyFm);
  }
  
  // 5️⃣ Build initial rows from period
  rows = buildRowsFromPeriod(
    input.workPeriod.startDate,
    input.workPeriod.endDate,
    weeklyFmHour,
    input.exclusions
  );
  
  // 6️⃣ Apply 270 detailed mode
  if (config.include270 && config.mode270 === "detailed") {
    rows = apply270Detailed(
      rows,
      rawWeeklyFm,
      input.workPeriod.startDate,
      input.workPeriod.endDate,
      input.exclusions
    );
  }
  
  // 7️⃣ Apply limitation (zamanaşımı)
  if (config.limitation && config.limitationDate) {
    rows = applyLimitation(rows, config.limitationDate);
  }
  
  // 8️⃣ Calculate amounts with asgari ücret
  rows = calculateRowAmounts(rows, input.katSayi || 1, asgariUcretMap);
  
  // 9️⃣ Build FM text
  const fmText = buildFmText(
    weeklyFmHour,
    dailyWorkHours,
    input.workPeriod.weeklyDays,
    input.workPeriod.hasWeeklyRest
  );
  
  // 🔟 Calculate totals
  const totals = calculateTotals(rows);
  
  console.log('✅ [OVERTIME ENGINE] Calculation complete', { 
    rowCount: rows.length, 
    totals 
  });
  
  return {
    rows,
    weeklyFmHour,
    rawWeeklyFm,
    fmText,
    totals,
  };
}
