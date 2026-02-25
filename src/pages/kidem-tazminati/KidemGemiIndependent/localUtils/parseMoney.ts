export const parseMoney = (value: string | number): number => {
  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
    return value;
  }
  if (!value || typeof value !== "string") return 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  return parsed;
};
