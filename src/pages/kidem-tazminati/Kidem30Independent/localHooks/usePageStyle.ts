/**
 * Bu sayfa için sabit sayfa stili (lokal – react-router-dom yok).
 */
export interface PageStyle {
  color: string;
}

const KIDEM_30_PAGE_STYLE: PageStyle = { color: "#1E88E5" };

export function usePageStyle(): PageStyle {
  return KIDEM_30_PAGE_STYLE;
}
