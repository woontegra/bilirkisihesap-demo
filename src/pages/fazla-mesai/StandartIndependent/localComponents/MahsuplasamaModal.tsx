/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HaftaTatiliTableRow {
  period: string;
  weekCount: number;
  wage: number;
  coefficient: number;
  dailyWage: number;
  haftaTatiliDays: number;
  haftaTatiliTotal: number;
}

interface MahsuplasamaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableData: HaftaTatiliTableRow[];
  onSave: (total: number, data: { [year: number]: { [month: number]: number } }) => void;
  initialData?: { [year: number]: { [month: number]: number } };
}

export default function MahsuplasamaModal({
  open,
  onOpenChange,
  tableData,
  onSave,
  initialData,
}: MahsuplasamaModalProps) {
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    
    tableData.forEach((row) => {
      const parts = row.period.split(" - ");
      if (parts.length === 2) {
        const startDateStr = parts[0].trim();
        const endDateStr = parts[1].trim();
        
        const startDate = parseTurkishDate(startDateStr);
        const endDate = parseTurkishDate(endDateStr);
        
        if (startDate) {
          yearSet.add(startDate.getFullYear());
        }
        if (endDate) {
          yearSet.add(endDate.getFullYear());
        }
      }
    });
    
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [tableData]);

  function parseTurkishDate(dateStr: string): Date | null {
    try {
      const parts = dateStr.split(".");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    } catch (e) {
    }
    return null;
  }

  const [values, setValues] = useState<{ [year: number]: { [month: number]: number } }>(initialData || {});

  // Restore initialData when modal opens
  useEffect(() => {
    if (open && initialData) {
      setValues(initialData);
    }
  }, [open, initialData]);

  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];

  const handleValueChange = (year: number, month: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setValues((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] || {}),
        [month]: numValue,
      },
    }));
  };

  const getValue = (year: number, month: number): string => {
    return values[year]?.[month] ? String(values[year][month]) : "";
  };

  const total = useMemo(() => {
    let sum = 0;
    Object.keys(values).forEach((yearStr) => {
      const year = parseInt(yearStr, 10);
      if (values[year]) {
        Object.keys(values[year]).forEach((monthStr) => {
          const month = parseInt(monthStr, 10);
          sum += values[year][month] || 0;
        });
      }
    });
    return sum;
  }, [values]);

  const handleSave = () => {
    onSave(total, values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mahsuplaşma Ekle</DialogTitle>
          <DialogDescription>
            Ay ve yıl bazında mahsuplaşma miktarlarını girin. Tüm değerler toplanarak ana ekrana yazılacaktır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {years.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Hesaplama tablosunda veri bulunamadı. Lütfen önce hesaplama yapın.
            </p>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-sm text-gray-700 dark:text-gray-300">
                          Ay
                        </th>
                        {years.map((year) => (
                          <th
                            key={year}
                            className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center font-semibold text-sm text-gray-700 dark:text-gray-300"
                          >
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthNames.map((monthName, monthIndex) => {
                        const month = monthIndex + 1;
                        return (
                          <tr key={month} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              {monthName}
                            </td>
                            {years.map((year) => (
                              <td
                                key={`${year}-${month}`}
                                className="border border-gray-300 dark:border-gray-600 px-2 py-1"
                              >
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={getValue(year, month)}
                                  onChange={(e) => handleValueChange(year, month, e.target.value)}
                                  className="w-full text-sm text-center"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Label className="font-semibold text-gray-700 dark:text-gray-300">
                  Toplam:
                </Label>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {total.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₺
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={years.length === 0}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
