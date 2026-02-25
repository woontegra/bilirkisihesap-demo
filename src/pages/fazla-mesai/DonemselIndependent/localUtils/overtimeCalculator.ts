/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of Bilirkisi1Independent page isolation
 */

export interface Interval {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}

export interface SalaryPeriod {
  year: number;
  half?: 1 | 2;
  amount: number;
}

export interface OvertimeResult {
  start: string;
  end: string;
  weeklyOvertime: number;
  totalWeeks: number;
  hourlyRate: number;
  overtimePay: number;
}

export function calculateOvertime(
  intervals: Interval[],
  salaries: SalaryPeriod[],
  baseWeeklyHours = 45
): OvertimeResult[] {
  const results: OvertimeResult[] = [];

  for (const interval of intervals) {
    const startDate = new Date(interval.start);
    const endDate = new Date(interval.end);
    const weeks = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));

    const [sh, sm] = interval.startTime.split(":").map(Number);
    const [eh, em] = interval.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let diff = endMins - startMins;
    if (diff < 0) diff += 24 * 60;
    let totalHours = diff / 60;

    totalHours -= 1;

    const weeklyHours = totalHours * 6;

    const weeklyOvertime = Math.max(0, weeklyHours - baseWeeklyHours);

    const year = startDate.getFullYear();
    const salary = salaries.find(s => s.year === year);
    const hourlyRate = salary ? salary.amount / 225 : 0;
    const overtimePay = weeklyOvertime * weeks * hourlyRate * 1.5;

    results.push({
      start: interval.start,
      end: interval.end,
      weeklyOvertime: parseFloat(weeklyOvertime.toFixed(2)),
      totalWeeks: weeks,
      hourlyRate: parseFloat(hourlyRate.toFixed(2)),
      overtimePay: parseFloat(overtimePay.toFixed(2))
    });
  }

  return results;
}
