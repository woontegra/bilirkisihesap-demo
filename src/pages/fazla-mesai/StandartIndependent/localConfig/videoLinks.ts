/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

export const VIDEO_LINKS: Record<string, string> = {
  "fazla-standart": "https://youtu.be/R12uCL5sb70",
};

export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
