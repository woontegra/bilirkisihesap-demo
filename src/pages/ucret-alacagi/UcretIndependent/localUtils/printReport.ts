import { formatForPrint, createReportDataFromDOM } from "./reportFormatter";

export interface PrintOptions {
  title: string;
  containerId?: string;
  copyTargetId?: string;
  sectionSelectors?: string[];
}

export function printReport(options: PrintOptions): void {
  try {
    const { title, containerId, copyTargetId, sectionSelectors } = options;
    let source: string | null = null;
    if (containerId && copyTargetId) {
      const container = document.getElementById(containerId);
      const targetEl = container?.querySelector("#" + copyTargetId);
      if (targetEl) source = (targetEl as HTMLElement).outerHTML;
    }
    if (!source && copyTargetId) {
      const targetEl = document.getElementById(copyTargetId);
      source = targetEl ? targetEl.outerHTML : null;
    }
    if (!source && containerId) {
      const container = document.getElementById(containerId);
      source = container ? container.innerHTML : null;
    }
    if (!source) {
      const rapor = document.getElementById("rapor-icerik");
      const modalWrap = document.getElementById("report-modal-content");
      source = rapor?.outerHTML || modalWrap?.outerHTML || "";
    }
    if (!source) return;
    let reportData: { title: string; sections: { type: string; html: string }[] };
    if (copyTargetId && source) {
      reportData = { title, sections: [{ type: "table", html: source }] };
    } else if (containerId) {
      reportData = createReportDataFromDOM(title, containerId, sectionSelectors);
      if (reportData.sections.length === 0 && source) {
        reportData = { title, sections: [{ type: "table", html: source }] };
      }
    } else {
      reportData = { title, sections: [{ type: "table", html: source }] };
    }
    const html = formatForPrint(reportData);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  } catch {}
}

export function printFromModal(title: string, copyTargetId?: string): void {
  printReport({ title, copyTargetId, containerId: "report-modal-content" });
}
