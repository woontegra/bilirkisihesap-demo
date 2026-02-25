/**
 * Rapor formatlama utility'leri (lokal kopya – Word/PDF için).
 */
export interface ReportSection {
  title?: string;
  type: "table" | "text" | "summary";
  data?: any;
  html?: string;
}

export interface ReportData {
  title: string;
  sections: ReportSection[];
}

export function formatForWord(data: ReportData): string {
  const sectionsHTML = data.sections
    .map((section) => {
      if (section.html) return section.html;
      if (section.type === "table" && section.data) return formatTableForWord(section.data, section.title);
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="Microsoft Word" />
  <meta name="Originator" content="Microsoft Word" />
  <title>${data.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', 'Arial', sans-serif; color: #111827; line-height: 1.1 !important; font-size: 13px; padding: 0; margin: 0; background: #ffffff; }
    table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 8px; page-break-inside: avoid; table-layout: fixed; }
    tr { line-height: 1.1 !important; height: auto !important; }
    th, td { word-wrap: break-word; line-height: 1.1 !important; padding-top: 2px !important; padding-bottom: 2px !important; vertical-align: middle; }
    div, p { line-height: 1.2 !important; margin: 0; padding: 0; }
    @media print { body { margin: 0; padding: 0; } table { page-break-inside: avoid; } }
  </style>
</head>
<body>
  ${sectionsHTML}
</body>
</html>`;
}

function formatTableForWord(data: any, title?: string): string {
  if (typeof data === "string") return title ? `<div class="section-title">${title}</div>${data}` : data;
  if (data && data.outerHTML) return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  return "";
}

function sanitizeHTMLForWord(html: string): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("svg").forEach((el) => el.remove());
  temp.querySelectorAll("button").forEach((el) => el.remove());
  temp.querySelectorAll("script").forEach((el) => el.remove());
  temp.querySelectorAll("style").forEach((el) => el.remove());
  temp.querySelectorAll("*").forEach((el: any) => {
    if (el.style) {
      el.style.display = el.style.display === "flex" || el.style.display === "grid" ? "block" : el.style.display;
      ["flex", "flex-direction", "flex-wrap", "justify-content", "align-items", "gap", "grid", "grid-template-columns", "transform", "transition", "animation", "box-shadow", "text-shadow", "max-width", "min-width"].forEach((p) => el.style.removeProperty(p));
    }
    if (el.classList) {
      const keepClasses: string[] = [];
      el.classList.forEach((cls: string) => {
        if (!cls.includes(":") && !cls.includes("[") && !cls.includes("dark:")) keepClasses.push(cls);
      });
      el.className = keepClasses.join(" ");
    }
  });
  return temp.innerHTML;
}

export function createReportDataFromDOM(title: string, containerId: string, sectionSelectors?: string[]): ReportData {
  const container = document.getElementById(containerId);
  if (!container) return { title, sections: [] };
  const sections: ReportSection[] = [];
  if (sectionSelectors && sectionSelectors.length > 0) {
    sectionSelectors.forEach((selector) => {
      const element = container.querySelector(selector);
      if (element) {
        sections.push({ type: "table", html: sanitizeHTMLForWord((element as HTMLElement).outerHTML) });
      }
    });
  } else {
    const isTable = container.tagName === "TABLE";
    const containerHTML = isTable ? container.outerHTML : container.innerHTML;
    if (containerHTML.trim()) {
      sections.push({ type: "table", html: sanitizeHTMLForWord(containerHTML) });
    } else {
      container.querySelectorAll("table, div").forEach((element) => {
        sections.push({ type: "table", html: sanitizeHTMLForWord((element as HTMLElement).outerHTML) });
      });
    }
  }
  return { title, sections };
}
