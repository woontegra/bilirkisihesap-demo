/**
 * Word export utility (lokal kopya).
 */

import { formatForWord, createReportDataFromDOM } from "./reportFormatter";

async function ensureDocxLibrary(): Promise<void> {
  if ((window as any).htmlDocx && (window as any).htmlDocx.asBlob) return;
  const load = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("html-docx-js load failed: " + src));
      document.body.appendChild(s);
    });
  try {
    await load("https://cdn.jsdelivr.net/npm/html-docx-js@0.4.1/dist/html-docx.js");
  } catch {
    await load("https://unpkg.com/html-docx-js@0.4.1/dist/html-docx.js");
  }
}

export async function downloadWordDocument(
  title: string,
  containerId: string,
  fileName?: string
): Promise<void> {
  const dt = new Date().toISOString().slice(0, 10);
  const defaultFileName = fileName || `${title.replace(/\s+/g, "_")}_${dt}`;

  try {
    const container = document.getElementById(containerId);
    if (!container) throw new Error("Word export: Element bulunamadı: " + containerId);

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
  } catch (error) {
    console.error("Word export error:", error);
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const textContent = container.innerText || container.textContent || "";
        const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFileName + ".txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      throw error;
    }
  }
}
