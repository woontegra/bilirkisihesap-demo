/**
 * Video linkleri – bu sayfa için lokal config.
 * Sadece bu sayfada kullanılan "kidem-30isci" key'i tutulur.
 */

export const VIDEO_LINKS: Record<string, string> = {
  "kidem-30isci": "",
};

/**
 * Video linkini al.
 * @param pageKey - Sayfa anahtarı (örn: "kidem-30isci")
 */
export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
