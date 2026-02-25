export type WorkPeriod = { years: number; months: number; days: number; totalDays: number; label: string };

export function calcWorkPeriodBilirKisi(startISO?: string, endISO?: string): WorkPeriod {
  if (!startISO || !endISO) return { years: 0, months: 0, days: 0, totalDays: 0, label: "" };
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(+s) || Number.isNaN(+e) || e < s) return { years: 0, months: 0, days: 0, totalDays: 0, label: "" };

  let sDay = s.getDate();
  let sMonth = s.getMonth() + 1;
  let sYear = s.getFullYear();

  let eDay = e.getDate();
  let eMonth = e.getMonth() + 1;
  let eYear = e.getFullYear();

  if (sDay === 31) sDay = 30;
  if (eDay === 31) eDay = 30;

  if (eDay < sDay) {
    eDay += 30;
    eMonth -= 1;
  }
  if (eMonth < sMonth) {
    eMonth += 12;
    eYear -= 1;
  }

  let days = eDay - sDay;
  let months = eMonth - sMonth;
  let years = eYear - sYear;

  if (days >= 30) { days -= 30; months += 1; }
  if (months >= 12) { months -= 12; years += 1; }

  const label = `${years} yıl ${months} ay ${days} gün`;
  const totalDays = years * 365 + months * 30 + days;
  return { years, months, days, totalDays, label };
}

export function calculateWorkPeriod(startDate: Date | string, endDate: Date | string): string {
  const s = typeof startDate === 'string' ? startDate : (startDate as Date)?.toISOString().slice(0,10);
  const e = typeof endDate === 'string' ? endDate : (endDate as Date)?.toISOString().slice(0,10);
  const wp = calcWorkPeriodBilirKisi(s as string, e as string);
  return wp.label;
}
