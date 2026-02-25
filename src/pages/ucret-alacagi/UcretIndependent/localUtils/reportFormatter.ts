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
<title>${data.title}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
@page { size: A4 portrait; margin: 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Inter', 'Arial', sans-serif; color: #111827; line-height: 1.1 !important; font-size: 13px; padding: 0; margin: 0; }
table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 8px; page-break-inside: avoid; }
th, td { word-wrap: break-word; padding: 4px 6px; }
</style>
</head>
<body>${sectionsHTML}</body></html>`;
}

export function formatForPrint(data: ReportData): string {
  const sectionsHTML = data.sections
    .map((section) => {
      if (section.html) return section.html;
      if (section.type === "table" && section.data) return formatTableForPrint(section.data, section.title);
      return "";
    })
    .filter(Boolean)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${data.title}</title>
<style>@page { size: A4 portrait; margin: 15mm; } * { box-sizing: border-box; } body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; } .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; } table { width: 100%; border-collapse: collapse; } thead { background: #f3f4f6; } th, td { border: 1px solid #999; padding: 6px; font-size: 12px; } td:first-child { text-align: left; }</style></head><body><div class="print-title">${data.title}</div>${sectionsHTML}</body></html>`;
}

function formatTableForWord(data: any, title?: string): string {
  if (typeof data === "string") return title ? `<div class="section-title">${title}</div>${data}` : data;
  if (data?.outerHTML) return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  return "";
}

function formatTableForPrint(data: any, title?: string): string {
  if (typeof data === "string") return title ? `<div class="section-title">${title}</div>${data}` : data;
  if (data?.outerHTML) return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  return "";
}

function sanitizeHTMLForWord(html: string): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("svg, button, script, style").forEach((el) => el.remove());
  temp.querySelectorAll("*").forEach((el: any) => {
    if (el.style) {
      el.style.removeProperty("flex"); el.style.removeProperty("flex-direction"); el.style.removeProperty("transform");
      el.style.removeProperty("transition"); el.style.removeProperty("animation"); el.style.removeProperty("box-shadow");
    }
  });
  return temp.innerHTML;
}

export function createReportDataFromDOM(title: string, containerId: string, sectionSelectors?: string[]): ReportData {
  const container = document.getElementById(containerId);
  if (!container) return { title, sections: [] };
  const sections: ReportSection[] = [];
  if (sectionSelectors?.length) {
    sectionSelectors.forEach((selector) => {
      const el = container.querySelector(selector);
      if (el) sections.push({ type: "table", html: sanitizeHTMLForWord((el as HTMLElement).outerHTML) });
    });
  } else {
    const isTable = container.tagName === "TABLE";
    const containerHTML = isTable ? container.outerHTML : container.innerHTML;
    if (containerHTML.trim()) sections.push({ type: "table", html: sanitizeHTMLForWord(containerHTML) });
    else container.querySelectorAll("table, div").forEach((element) => sections.push({ type: "table", html: sanitizeHTMLForWord((element as HTMLElement).outerHTML) }));
  }
  return { title, sections };
}
