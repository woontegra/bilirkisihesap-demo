export function safeNumber(
  value: number | undefined | null,
  decimals: number = 2
): string {
  const num = value ?? 0;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function safeCurrency(
  value: number | undefined | null,
  decimals: number = 2
): string {
  return `₺${safeNumber(value, decimals)}`;
}

export function safeDays(
  days: number | undefined | null
): string {
  return `${safeNumber(days, 1)} gün`;
}
