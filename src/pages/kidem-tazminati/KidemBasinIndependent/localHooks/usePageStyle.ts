/**
 * Bu sayfa için sabit sayfa stili (lokal).
 */
export interface PageStyle {
  color: string;
}

const KIDEM_BASIN_PAGE_STYLE: PageStyle = { color: "#1E88E5" };

export function usePageStyle(): PageStyle {
  return KIDEM_BASIN_PAGE_STYLE;
}
