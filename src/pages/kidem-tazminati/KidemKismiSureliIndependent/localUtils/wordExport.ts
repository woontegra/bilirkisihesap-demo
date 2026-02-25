/**
 * Word export – sayfa görünümü (Print Layout) için HTML .doc
 */

import { formatForWord, createReportDataFromDOM } from "./reportFormatter";

export async function downloadWordDocument(
  title: string,
  containerId: string,
  fileName?: string
): Promise<void> {
  const dt = new Date().toISOString().slice(0, 10);
  const defaultFileName = fileName || `${title.replace(/\s+/g, "_")}_${dt}`;

  const container = document.getElementById(containerId);
  if (!container) throw new Error("Word export: Öğe bulunamadı: " + containerId);

  const reportData = createReportDataFromDOM(title, containerId);
  if (!reportData.sections || reportData.sections.length === 0) throw new Error("Word export: İçerik bulunamadı");

  const html = formatForWord(reportData);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFileName + ".doc";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
