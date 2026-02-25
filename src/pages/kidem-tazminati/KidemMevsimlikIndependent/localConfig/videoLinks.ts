/**
 * Video Linkleri Yapılandırma Dosyası - LOCAL
 */

export const VIDEO_LINKS: Record<string, string> = {
  "kidem-mevsimlik": "",
};

/**
 * Helper function: Video linkini al
 * @param pageKey - Sayfa anahtarı
 * @returns Video linki varsa string, yoksa undefined
 */
export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
