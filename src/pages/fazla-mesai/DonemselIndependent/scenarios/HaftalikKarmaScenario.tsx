/**
 * HAFTALIK_KARMA Scenario - RAW DAILY ROWS GENERATOR
 * 
 * SADECE RAW GÜNLÜK SATIRLAR ÜRETIR
 * - Davacı için günlük satırlar (2 zaman bloğu)
 * - Tanıklar için günlük satırlar (2 zaman bloğu)
 * - TEK ARRAY'DE BİRLEŞTİRİLMİŞ
 * 
 * YAPMAZ:
 * - Tanık kesişimi
 * - Date segmentation
 * - fmPeriods hesaplama
 * 
 * Bunlar index.tsx'te STANDART ile AYNI zincirle yapılacak
 */

import { useMemo } from 'react';
import { addDays, eachDayOfInterval, format } from 'date-fns';

interface DayGroup {
  dayCount: number;
  startTime: string;
  endTime: string;
}

interface Witness {
  id: number;
  startDateISO: string;
  endDateISO: string;
  dayGroups: DayGroup[];
}

interface HaftalikKarmaScenarioProps {
  haftalikKarmaState: {
    weeklyStartDateISO: string;
    weeklyEndDateISO: string;
    dayGroups: DayGroup[];
    witnesses: Witness[];
  };
}

interface DailyRow {
  date: string;
  dateISO: string;
  in: string;
  out: string;
  type: 'davaci' | 'tanik';
  witnessId?: number;
}

export function useHaftalikKarmaScenario(props: HaftalikKarmaScenarioProps) {
  const { haftalikKarmaState } = props;

  const rawRows = useMemo((): DailyRow[] => {
    const { weeklyStartDateISO, weeklyEndDateISO, dayGroups, witnesses } = haftalikKarmaState;
    
    if (!weeklyStartDateISO || !weeklyEndDateISO) {
      return [];
    }
    
    if (dayGroups.length < 2) {
      return [];
    }
    
    const group1 = dayGroups[0];
    const group2 = dayGroups[1];
    
    if (!group1.startTime || !group1.endTime || !group2.startTime || !group2.endTime) {
      return [];
    }
    
    if (group1.dayCount === 0 && group2.dayCount === 0) {
      return [];
    }
    
    const allRows: DailyRow[] = [];
    
    const startDate = new Date(weeklyStartDateISO);
    const endDate = new Date(weeklyEndDateISO);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    allDays.forEach((day, dayIndex) => {
      const weekDay = dayIndex % 7;
      
      let dayGroup: DayGroup;
      if (weekDay < group1.dayCount) {
        dayGroup = group1;
      } else {
        dayGroup = group2;
      }
      
      const dateISO = format(day, 'yyyy-MM-dd');
      const dateFormatted = format(day, 'dd.MM.yyyy');
      
      allRows.push({
        date: dateFormatted,
        dateISO: dateISO,
        in: dayGroup.startTime,
        out: dayGroup.endTime,
        type: 'davaci'
      });
    });
    
    witnesses.forEach((witness, idx) => {
      if (!witness.startDateISO || !witness.endDateISO) {
        return;
      }
      if (!witness.dayGroups || witness.dayGroups.length === 0) {
        return;
      }
      
      const wGroup = witness.dayGroups[0];
      
      if (!wGroup.startTime || !wGroup.endTime) {
        return;
      }
      
      const wStartDate = new Date(witness.startDateISO);
      const wEndDate = new Date(witness.endDateISO);
      const wAllDays = eachDayOfInterval({ start: wStartDate, end: wEndDate });
      
      wAllDays.forEach((day) => {
        const dateISO = format(day, 'yyyy-MM-dd');
        const dateFormatted = format(day, 'dd.MM.yyyy');
        
        allRows.push({
          date: dateFormatted,
          dateISO: dateISO,
          in: wGroup.startTime,
          out: wGroup.endTime,
          type: 'tanik',
          witnessId: witness.id
        });
      });
    });
    
    return allRows;
  }, [
    haftalikKarmaState.weeklyStartDateISO,
    haftalikKarmaState.weeklyEndDateISO,
    haftalikKarmaState.dayGroups,
    haftalikKarmaState.witnesses
  ]);

  return rawRows;
}

