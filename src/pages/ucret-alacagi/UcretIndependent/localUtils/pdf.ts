/**
 * PDF Report - Local copy for UcretIndependent isolation
 */

import { API_BASE_URL } from "./apiClient";

interface GenerateReportParams {
  type: string;
  form: Record<string, any>;
  results?: Record<string, any> | number | null;
  userId?: number;
}

export async function generateReport({
  type,
  form,
  results = null,
  userId,
}: GenerateReportParams): Promise<void> {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");
  let currentUserId = userId;
  if (!currentUserId) {
    try {
      const currentUserStr = localStorage.getItem("current_user");
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        currentUserId = currentUser?.id ? Number(currentUser.id) : 1;
      } else {
        currentUserId = 1;
      }
    } catch {
      currentUserId = 1;
    }
  }
  if (!currentUserId || isNaN(currentUserId) || currentUserId < 1) {
    currentUserId = 1;
  }

  const response = await fetch(`${API_BASE_URL}/api/reports/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": String(tenantId),
      Authorization: `Bearer ${token}`,
      "x-user-id": String(currentUserId),
      "x-user-role": localStorage.getItem("current_user")
        ? JSON.parse(localStorage.getItem("current_user") || "{}").role || "user"
        : "user",
    },
    body: JSON.stringify({ type, userId: currentUserId, form, results }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
    throw new Error(errorData.error || `PDF oluşturulamadı: ${response.status}`);
  }

  const blob = await response.blob();
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `aktüerya-raporu-${type}-${timestamp}.pdf`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
