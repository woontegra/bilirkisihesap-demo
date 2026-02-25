import { getDeviceUUID } from "./deviceUUID";
import { isTokenExpired, refreshAccessToken, clearTokens } from "./authToken";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

interface RequestOptions extends RequestInit {
  skipDeviceUUID?: boolean;
  skipTenantId?: boolean;
}

export async function apiClient(endpoint: string, options: RequestOptions = {}) {
  const { skipDeviceUUID, skipTenantId, ...fetchOptions } = options;
  let token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id");

  if (token && isTokenExpired()) {
    try {
      const newToken = await refreshAccessToken();
      if (newToken) token = newToken;
    } catch {}
  }

  const publicRoutes = ["/api/auth/", "/api/health", "/api/debug/"];
  const isPublicRoute = publicRoutes.some((route) => endpoint.includes(route));

  if (!skipTenantId && !isPublicRoute && !tenantId) {
    throw new Error(
      "TENANT_MISSING: Tenant ID is required for all API requests. Please log in again."
    );
  }

  const headers = new Headers(fetchOptions.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!skipTenantId && !isPublicRoute && tenantId) {
    headers.set("X-Tenant-Id", tenantId);
  }
  if (!skipDeviceUUID) {
    const deviceId = getDeviceUUID();
    headers.set("X-Device-Id", deviceId);
    headers.set("X-Device-UUID", deviceId);
  }
  if (!headers.has("Content-Type") && fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, { ...fetchOptions, headers });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, { ...fetchOptions, headers });
      if (response.status === 401) {
        clearTokens();
        window.location.href = "/login";
        throw new Error("Authentication required");
      }
    } else {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Authentication required");
    }
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.error === "DEMO_EXPIRED") {
      window.dispatchEvent(new CustomEvent("demo-expired"));
    } else if (data.error === "DEVICE_LIMIT_EXCEEDED") {
      window.dispatchEvent(new CustomEvent("device-limit-exceeded"));
    } else if (data.error === "activation_required" && window.location.pathname !== "/professional-license-activation") {
      window.location.href = "/professional-license-activation";
    } else if (data.error === "expired") {
      window.location.href = "/professional-license-activation?expired=true";
    }
  }

  return response;
}

export async function apiGet(endpoint: string, options?: RequestOptions) {
  return apiClient(endpoint, { ...options, method: "GET" });
}

export async function apiPost(endpoint: string, data?: any, options?: RequestOptions) {
  return apiClient(endpoint, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}
