/**
 * Rapor formatlama utility'leri (lokal kopya – Word/PDF için).
 */

export interface ReportSection {
  title?: string;
  type: 'table' | 'text' | 'summary';
  data?: any;
  html?: string;
}

export interface ReportData {
  title: string;
  sections: ReportSection[];
}

export function formatForWord(data: ReportData): string {
  const sectionsHTML = data.sections
    .map(section => {
      if (section.html) {
        return section.html;
      }
      if (section.type === 'table' && section.data) {
        return formatTableForWord(section.data, section.title);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="Microsoft Word" />
  <meta name="Originator" content="Microsoft Word" />
  <title>${data.title}</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 15mm 15mm 15mm 15mm; 
    }
    * { 
      box-sizing: border-box; 
    }
    body { 
      font-family: 'Inter', 'Arial', sans-serif; 
      color: #111827; 
      line-height: 1.1 !important;
      font-size: 13px;
      padding: 0;
      margin: 0;
      background: #ffffff;
    }
    table { 
      width: 100% !important; 
      max-width: 16cm !important;
      border-collapse: collapse; 
      margin-bottom: 8px;
      page-break-inside: avoid;
      table-layout: fixed;
    }
    tr {
      line-height: 1.1 !important;
      height: auto !important;
    }
    th, td {
      word-wrap: break-word;
      line-height: 1.1 !important;
      padding-top: 2px !important;
      padding-bottom: 2px !important;
      vertical-align: middle;
    }
    div, p {
      line-height: 1.2 !important;
      margin: 0;
      padding: 0;
    }
    @media print {
      body { margin: 0; padding: 0; }
      table { page-break-inside: avoid; }
    }
  </style>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
      <w:ValidateAgainstSchemas/>
      <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
      <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
      <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
      <w:DoNotPromoteQF/>
      <w:LidThemeOther>TR</w:LidThemeOther>
      <w:LidThemeAsian>X-NONE</w:LidThemeAsian>
      <w:LidThemeComplexScript>X-NONE</w:LidThemeComplexScript>
      <w:Compatibility>
        <w:BreakWrappedTables/>
        <w:SnapToGridInCell/>
        <w:WrapTextWithPunct/>
        <w:UseAsianBreakRules/>
        <w:DontGrowAutofit/>
        <w:SplitPgBreakAndParaMark/>
        <w:EnableOpenTypeKerning/>
        <w:DontFlipMirrorIndents/>
        <w:OverrideTableStyleHps/>
      </w:Compatibility>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>
  ${sectionsHTML}
</body>
</html>`;
}

export function formatForPrint(data: ReportData): string {
  const sectionsHTML = data.sections
    .map(section => {
      if (section.html) return section.html;
      if (section.type === 'table' && section.data) return formatTableForPrint(section.data, section.title);
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .print-sub { font-size: 12px; color: #374151; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap !important; text-align: left; }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="print-title">${data.title}</div>
  ${sectionsHTML}
</body>
</html>`;
}

function formatTableForWord(data: any, title?: string): string {
  if (typeof data === 'string') return title ? `<div class="section-title">${title}</div>${data}` : data;
  if (data && data.outerHTML) return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  return '';
}

function formatTableForPrint(data: any, title?: string): string {
  if (typeof data === 'string') return title ? `<div class="section-title">${title}</div>${data}` : data;
  if (data && data.outerHTML) return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  return '';
}

function sanitizeHTMLForWord(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('svg').forEach(el => el.remove());
  temp.querySelectorAll('button').forEach(el => el.remove());
  temp.querySelectorAll('script').forEach(el => el.remove());
  temp.querySelectorAll('style').forEach(el => el.remove());
  temp.querySelectorAll('*').forEach((el: any) => {
    if (el.style) {
      el.style.display = el.style.display === 'flex' || el.style.display === 'grid' ? 'block' : el.style.display;
      el.style.removeProperty('flex');
      el.style.removeProperty('flex-direction');
      el.style.removeProperty('flex-wrap');
      el.style.removeProperty('justify-content');
      el.style.removeProperty('align-items');
      el.style.removeProperty('gap');
      el.style.removeProperty('grid');
      el.style.removeProperty('grid-template-columns');
      el.style.removeProperty('transform');
      el.style.removeProperty('transition');
      el.style.removeProperty('animation');
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('text-shadow');
      el.style.removeProperty('max-width');
      el.style.removeProperty('min-width');
    }
    if (el.classList) {
      const keepClasses: string[] = [];
      el.classList.forEach((cls: string) => {
        if (!cls.includes(':') && !cls.includes('[') && !cls.includes('dark:')) keepClasses.push(cls);
      });
      el.className = keepClasses.join(' ');
    }
  });
  return temp.innerHTML;
}

export function createReportDataFromDOM(
  title: string,
  containerId: string,
  sectionSelectors?: string[]
): ReportData {
  const container = document.getElementById(containerId);
  if (!container) return { title, sections: [] };

  const sections: ReportSection[] = [];

  if (sectionSelectors && sectionSelectors.length > 0) {
    sectionSelectors.forEach(selector => {
      const element = container.querySelector(selector);
      if (element) {
        const cleanHTML = sanitizeHTMLForWord((element as HTMLElement).outerHTML);
        sections.push({ type: 'table', html: cleanHTML });
      }
    });
  } else {
    const isTable = container.tagName === 'TABLE';
    const containerHTML = isTable ? container.outerHTML : container.innerHTML;
    if (containerHTML.trim()) {
      const cleanHTML = sanitizeHTMLForWord(containerHTML);
      sections.push({ type: 'table', html: cleanHTML });
    } else {
      const sectionElements = container.querySelectorAll('table, div');
      sectionElements.forEach((element) => {
        const cleanHTML = sanitizeHTMLForWord((element as HTMLElement).outerHTML);
        sections.push({ type: 'table', html: cleanHTML });
      });
    }
  }

  return { title, sections };
}
