import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UBGT_HOLIDAY_TYPES,
  UBGT_HOLIDAY_DAYS,
  getYearsFromDateRange,
  filterExcludedUbgtHolidaysByRules,
  type UbgtHolidayType,
  type UbgtExclusionRule,
  type UbgtDayEntry,
} from "@/pages/ubgt/utils/filterExcludedUbgtHolidays";
import { ChevronDown, X } from "lucide-react";

const DROPDOWN_Z = 1100;

const GROUPS: { title: string; values: UbgtHolidayType[] }[] = [
  { title: "Ulusal Bayramlar", values: ["OCT_28_HALF", "OCT_29"] },
  {
    title: "Genel Tatiller",
    values: ["APR_23", "MAY_19", "AUG_30", "JAN_1", "MAY_1", "JUL_15"],
  },
  {
    title: "Dini Bayramlar",
    values: [
      "RAMADAN_AREFE_HALF", "RAMADAN_1", "RAMADAN_2", "RAMADAN_3",
      "KURBAN_AREFE_HALF", "KURBAN_1", "KURBAN_2", "KURBAN_3", "KURBAN_4",
    ],
  },
];

const labelByType: Record<UbgtHolidayType, string> = Object.fromEntries(
  UBGT_HOLIDAY_TYPES.map((t) => [t.value, t.label])
) as Record<UbgtHolidayType, string>;

/** Etiketten " - 0.5 gün" / " - 1 gün" kaldırır (kısa gösterim) */
function shortLabel(type: UbgtHolidayType): string {
  return labelByType[type].replace(/\s*-\s*0\.5 gün|\s*-\s*1 gün/g, "").trim();
}

function formatDayValue(d: number): string {
  return d.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** Kural özeti: "2022 – 28 Ekim (0,5) + 29 Ekim (1) = 1,5 gün" veya tek "2022 – 28 Ekim (0,5 gün)" */
function formatRuleSummary(rule: UbgtExclusionRule): string {
  const yearStr =
    rule.startYear === rule.endYear
      ? String(rule.startYear)
      : `${rule.startYear}–${rule.endYear}`;
  const types = rule.excludedHolidayTypes;
  if (types.length === 0) return `${yearStr}`;
  const total = types.reduce((s, t) => s + (UBGT_HOLIDAY_DAYS[t] ?? 1), 0);
  if (types.length === 1) {
    const d = UBGT_HOLIDAY_DAYS[types[0]] ?? 1;
    return `${yearStr} – ${shortLabel(types[0])} (${formatDayValue(d)} gün)`;
  }
  const parts = types.map(
    (t) => `${shortLabel(t)} (${formatDayValue(UBGT_HOLIDAY_DAYS[t] ?? 1)})`
  );
  return `${yearStr} – ${parts.join(" + ")} = ${formatDayValue(total)} gün`;
}

interface UbgtExclusionCompactUIProps {
  dateRanges: Array<{ start: string; end: string }>;
  /** Hesaplanmış UBGT günleri; dropdown seçenekleri buradan türetilir (resmi + dini) */
  ubgtDayEntries: UbgtDayEntry[];
  ubgtExclusionRules: UbgtExclusionRule[];
  setUbgtExclusionRules: React.Dispatch<React.SetStateAction<UbgtExclusionRule[]>>;
}

export default function UbgtExclusionCompactUI({
  dateRanges = [],
  ubgtDayEntries = [],
  ubgtExclusionRules,
  setUbgtExclusionRules,
}: UbgtExclusionCompactUIProps) {
  const { rangeStart, rangeEnd, yearsForDropdown } = useMemo(() => {
    const ranges = dateRanges ?? [];
    const valid = ranges.filter((r) => r.start && r.end);
    if (valid.length === 0) {
      return { rangeStart: "", rangeEnd: "", yearsForDropdown: [] as number[] };
    }
    const starts = valid.map((r) => r.start);
    const ends = valid.map((r) => r.end);
    const rangeStart = starts.sort()[0];
    const rangeEnd = ends.sort().reverse()[0];
    const yearsForDropdown = getYearsFromDateRange(rangeStart, rangeEnd);
    return { rangeStart, rangeEnd, yearsForDropdown };
  }, [dateRanges]);

  const [draftYearState, setDraftYearState] = useState<number | null>(null);
  const draftYear =
    draftYearState ?? (yearsForDropdown.length > 0 ? yearsForDropdown[0] : new Date().getFullYear());
  const setDraftYear = (y: number) => setDraftYearState(y);

  /** Tabloyu besleyen NİHAİ liste (dışlama kuralları uygulanmış); mesaj ve dropdown tek kaynak. */
  const finalUbgtDays = useMemo(
    () => filterExcludedUbgtHolidaysByRules(ubgtDayEntries, ubgtExclusionRules),
    [ubgtDayEntries, ubgtExclusionRules]
  );

  /** Seçilen yılda tabloda gün var mı? finalUbgtDays.some(year === selectedYear && dayValue > 0) → "UBGT yok" gösterme, dropdown aktif. */
  const hasUbgtDaysForSelectedYear = useMemo(
    () =>
      finalUbgtDays.some(
        (d) =>
          d.date.length >= 4 &&
          parseInt(d.date.slice(0, 4), 10) === draftYear &&
          (d.days ?? 0) > 0
      ),
    [finalUbgtDays, draftYear]
  );

  /** Dropdown seçenekleri: nihai listeden (tabloyu besleyen) seçilen yıl + tarih aralığına göre unique tipler */
  const availableTypesForYear = useMemo(() => {
    if (!finalUbgtDays.length) return [];
    const types = new Set<UbgtHolidayType>();
    for (const day of finalUbgtDays) {
      const year = day.date.length >= 4 ? parseInt(day.date.slice(0, 4), 10) : 0;
      if (year !== draftYear || (day.days ?? 0) <= 0) continue;
      if (rangeStart && day.date < rangeStart) continue;
      if (rangeEnd && day.date > rangeEnd) continue;
      types.add(day.holidayType);
    }
    return UBGT_HOLIDAY_TYPES.map((t) => t.value).filter((v) =>
      types.has(v as UbgtHolidayType)
    ) as UbgtHolidayType[];
  }, [finalUbgtDays, draftYear, rangeStart, rangeEnd]);

  useEffect(() => {
    if (yearsForDropdown.length > 0 && (draftYearState === null || !yearsForDropdown.includes(draftYear))) {
      setDraftYearState(yearsForDropdown[0]);
    }
  }, [yearsForDropdown, draftYearState]);

  const [draftTypes, setDraftTypes] = useState<UbgtHolidayType[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setDraftTypes((prev) => prev.filter((t) => availableTypesForYear.includes(t)));
  }, [availableTypesForYear]);

  const updateDropdownRect = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    updateDropdownRect();
    const onScrollOrResize = () => updateDropdownRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dropdownOpen]);

  const toggleType = (t: UbgtHolidayType) => {
    setDraftTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const removeDraftType = (t: UbgtHolidayType, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTypes((prev) => prev.filter((x) => x !== t));
  };

  const onDisla = () => {
    if (draftTypes.length === 0) return;
    setUbgtExclusionRules((prev) => [
      ...prev,
      { startYear: draftYear, endYear: draftYear, excludedHolidayTypes: [...draftTypes] },
    ]);
    setDraftTypes([]);
  };

  const removeRule = (index: number) => {
    setUbgtExclusionRules((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base fade-section">UBGT Hesabından Dışlanacak Günler</CardTitle>
        <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
          Seçilen yıl için işaretlenen UBGT günleri hesaba dahil edilmez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 max-h-[72px]">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Yıl</span>
            <select
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 text-sm w-[5.5rem] text-gray-900 dark:text-gray-100 disabled:opacity-60"
              value={yearsForDropdown.includes(draftYear) ? draftYear : (yearsForDropdown[0] ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setDraftYear(parseInt(v, 10));
              }}
              disabled={yearsForDropdown.length === 0}
            >
              {yearsForDropdown.length === 0 ? (
                <option value="">—</option>
              ) : (
                yearsForDropdown.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))
              )}
            </select>
          </div>

          <div className="flex-1 min-w-0 relative max-h-9">
            <div
              ref={triggerRef}
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-disabled={yearsForDropdown.length === 0 || !hasUbgtDaysForSelectedYear}
              className="min-h-9 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 focus-within:ring-2 focus-within:ring-blue-500/30 w-full min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() =>
                yearsForDropdown.length > 0 && hasUbgtDaysForSelectedYear && setDropdownOpen((o) => !o)
              }
            >
              {draftTypes.length === 0 ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {yearsForDropdown.length === 0
                    ? "Önce tarih aralığı girin"
                    : hasUbgtDaysForSelectedYear
                      ? "UBGT Günleri"
                      : `${draftYear} için bu aralıkta UBGT günü yok`}
                </span>
              ) : (
                draftTypes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 text-xs"
                  >
                    {labelByType[t].replace(/\s*-\s*0\.5 gün|\s*-\s*1 gün/g, "").trim()}
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      onClick={(e) => removeDraftType(t, e)}
                      aria-label="Kaldır"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-auto shrink-0" />
            </div>

            {dropdownOpen &&
              createPortal(
                <div
                  className="fixed inset-0"
                  style={{ zIndex: DROPDOWN_Z }}
                  aria-hidden="true"
                >
                  <div
                    role="presentation"
                    className="absolute inset-0 bg-black/10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div
                    className="absolute rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 max-h-64 overflow-y-auto min-w-[280px] max-w-md"
                    style={{
                      top: dropdownRect.top,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {GROUPS.map((g) => {
                      const visibleInGroup = g.values.filter((v) => availableTypesForYear.includes(v));
                      if (visibleInGroup.length === 0) return null;
                      return (
                        <div key={g.title} className="px-3 py-1">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            {g.title}
                          </div>
                          {visibleInGroup.map((value) => {
                            const label = labelByType[value];
                            const selected = draftTypes.includes(value);
                            return (
                              <button
                                key={value}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                onClick={() => toggleType(value)}
                              >
                                <span
                                  className={`inline-block w-4 h-4 rounded border shrink-0 ${
                                    selected
                                      ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                                      : "border-gray-400 dark:border-gray-500"
                                  }`}
                                >
                                  {selected && (
                                    <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 12 12">
                                      <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                                    </svg>
                                  )}
                                </span>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>,
                document.body
              )}
          </div>

          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            onClick={onDisla}
            disabled={draftTypes.length === 0 || yearsForDropdown.length === 0}
          >
            Dışla
          </Button>
        </div>

        {ubgtExclusionRules.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {ubgtExclusionRules.length} kural uygulanıyor:
            </span>
            {ubgtExclusionRules.map((rule, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs"
              >
                {formatRuleSummary(rule)}
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={() => removeRule(idx)}
                  aria-label="Kuralı kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
