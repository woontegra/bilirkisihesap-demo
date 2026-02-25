/**
 * Backend PDF rapor üretimi – API'ye istek atıp PDF indirir.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface GenerateReportOptions {
  type: string;
  form: Record<string, any>;
  results?: Record<string, any> | number | null;
  userId?: number;
}

export async function generateReport(options: GenerateReportOptions): Promise<void> {
  const { type, form, results, userId } = options;
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  const response = await fetch(`${API_BASE}/api/reports/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": String(tenantId),
    },
    body: JSON.stringify({ type, form, results, userId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `PDF oluşturulamadı (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapor_${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
