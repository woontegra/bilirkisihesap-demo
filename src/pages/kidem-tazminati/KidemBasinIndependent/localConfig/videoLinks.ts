/**
 * Video linkleri – bu sayfa için lokal config (Basın İş).
 */
export const VIDEO_LINKS: Record<string, string> = {
  "kidem-basin": "",
};

export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
