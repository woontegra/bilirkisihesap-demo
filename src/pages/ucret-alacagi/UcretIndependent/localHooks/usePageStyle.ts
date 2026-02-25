import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import { FaWallet } from "react-icons/fa";

export type PageKey = "ucret";

export interface PageStyle {
  color: string;
  icon: IconType;
  pageKey: PageKey;
}

const PAGE_STYLES: Record<PageKey, PageStyle> = {
  ucret: {
    color: "#1E88E5",
    icon: FaWallet,
    pageKey: "ucret",
  },
};

export function usePageStyle(pageKey?: PageKey): PageStyle {
  const location = useLocation();
  return useMemo(() => {
    if (pageKey && PAGE_STYLES[pageKey]) return PAGE_STYLES[pageKey];
    const path = location.pathname.toLowerCase();
    if (path.includes("/ucret-alacagi") || path.includes("/ucret")) return PAGE_STYLES.ucret;
    return PAGE_STYLES.ucret;
  }, [location.pathname, pageKey]);
}
