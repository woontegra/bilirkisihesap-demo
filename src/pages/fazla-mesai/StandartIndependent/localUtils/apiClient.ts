/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 * 
 * Simplified API client for this page only
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Simple API POST wrapper
 * Returns the Response object so caller can handle errors
 */
export async function apiPost(endpoint: string, data: any): Promise<Response> {
  const token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id");
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
    },
    body: JSON.stringify(data),
  });
  
  return response;
}
