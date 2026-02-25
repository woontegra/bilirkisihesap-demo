const VIDEO_LINKS: Record<string, string> = {
  "kidem-gemi": "",
};

export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
