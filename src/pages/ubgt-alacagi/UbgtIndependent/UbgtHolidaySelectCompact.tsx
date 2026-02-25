import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";

const DROPDOWN_Z = 1100;

interface StaticHoliday {
  id: string;
  name: string;
  days: number;
}

const GROUPS: { title: string; key: "national" | "official" | "general" | "religious" }[] = [
  { title: "Ulusal Bayramlar", key: "national" },
  { title: "Resmi Tatiller", key: "official" },
  { title: "Genel Tatiller", key: "general" },
  { title: "Dini Bayramlar", key: "religious" },
];

interface UbgtHolidaySelectCompactProps {
  /** Kart başlığı (örn. "Davacı - Tatil Seçimi"); verilmezse "Tatil Seçimi" */
  title?: string;
  holidays: {
    national: StaticHoliday[];
    official: StaticHoliday[];
    general: StaticHoliday[];
    religious: StaticHoliday[];
  };
  selectedHolidayIds: string[];
  onSelectionChange: (id: string, checked: boolean) => void;
  onToggleAll: () => void;
  areAllSelected: boolean;
  getHolidayTooltip?: (id: string) => string | undefined;
  totalDays?: number;
}

export default function UbgtHolidaySelectCompact({
  title = "Tatil Seçimi",
  holidays,
  selectedHolidayIds,
  onSelectionChange,
  onToggleAll,
  areAllSelected,
  getHolidayTooltip,
  totalDays = 0,
}: UbgtHolidaySelectCompactProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });

  const groupsWithHolidays = GROUPS.map((g) => ({
    ...g,
    items: holidays[g.key],
  }));

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
    if (!open) return;
    updateDropdownRect();
    const onScrollOrResize = () => updateDropdownRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const selectedNames = selectedHolidayIds.map((id) => {
    for (const g of groupsWithHolidays) {
      const h = g.items.find((x) => x.id === id);
      if (h) return { id, label: `${h.name} (${h.days} gün)` };
    }
    return { id, label: id };
  });

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base fade-section">{title}</CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Hesaplamaya dahil edilecek tatilleri seçin
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto shrink-0 text-xs"
            onClick={onToggleAll}
          >
            {areAllSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="min-h-10 w-full flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-left cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {selectedNames.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Tatil seçmek için tıklayın</span>
            ) : (
              selectedNames.map(({ id, label }) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 text-xs font-medium"
                >
                  {label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectionChange(id, false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && onSelectionChange(id, false)}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-auto shrink-0" />
          </button>

          {open &&
            createPortal(
              <div
                className="fixed inset-0"
                style={{ zIndex: DROPDOWN_Z }}
                aria-hidden="true"
              >
                <div
                  role="presentation"
                  className="absolute inset-0 bg-black/10"
                  onClick={() => setOpen(false)}
                />
                <div
                  className="absolute rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 max-h-[min(70vh,320px)] overflow-y-auto"
                  style={{
                    top: dropdownRect.top,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                    minWidth: 280,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {groupsWithHolidays.map((group) => (
                <div key={group.key} className="px-3 py-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 sticky top-0 bg-white dark:bg-gray-800 py-0.5">
                    {group.title}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((h) => {
                      const checked = selectedHolidayIds.includes(h.id);
                      const tooltip = getHolidayTooltip?.(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          title={tooltip}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                          onClick={() => onSelectionChange(h.id, !checked)}
                        >
                          <span
                            className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                              checked
                                ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500 text-white"
                                : "border-gray-400 dark:border-gray-500"
                            }`}
                          >
                            {checked && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                              </svg>
                            )}
                          </span>
                          <span className="text-gray-900 dark:text-gray-100">
                            {h.name}
                            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">({h.days} gün)</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                  ))}
                </div>
              </div>,
              document.body
            )}
        </div>

        {selectedHolidayIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {selectedHolidayIds.length} tatil seçili
            </span>
            {totalDays > 0 && (
              <>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Toplam {totalDays} gün
                </span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
