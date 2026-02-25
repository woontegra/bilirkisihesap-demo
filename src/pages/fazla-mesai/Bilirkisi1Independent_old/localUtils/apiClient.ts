/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of Bilirkisi1Independent page isolation
 */

/**
 * API Client with automatic headers injection
 * Adds deviceUUID and tenantId to all requests
 */

import { getDeviceUUID } from "./deviceUUID";
import { isTokenExpired, refreshAccessToken, clearTokens } from "./authToken";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

interface RequestOptions extends RequestInit {
  skipDeviceUUID?: boolean;
  skipTenantId?: boolean;
}

/**
 * Enhanced fetch with automatic headers
 * FAIL-FAST: Tenant ID is REQUIRED for all requests (except public routes)
 */
export async function apiClient(endpoint: string, options: RequestOptions = {}) {
  const { skipDeviceUUID, skipTenantId, ...fetchOptions } = options;
  
  // Get token and tenant
  let token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id");
  
  // Check if token is expired or will expire soon - refresh proactively
  if (token && isTokenExpired()) {
    console.log("[API CLIENT] Token expired or expiring soon, refreshing proactively...");
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        token = newToken;
        console.log("[API CLIENT] Token refreshed successfully");
      } else {
        console.error("[API CLIENT] Token refresh failed");
      }
    } catch (error) {
      console.error("[API CLIENT] Token refresh error:", error);
    }
  }
  
  // Public routes that don't require tenant
  const publicRoutes = ['/api/auth/', '/api/health', '/api/debug/'];
  const isPublicRoute = publicRoutes.some(route => endpoint.includes(route));
  
  // FAIL-FAST: Tenant is REQUIRED (unless explicitly skipped or public route)
  if (!skipTenantId && !isPublicRoute && !tenantId) {
    console.error("[API CLIENT] TENANT_MISSING - Cannot make request without tenant ID");
    console.error("[API CLIENT] Endpoint:", endpoint);
    console.error("[API CLIENT] This is a critical error - tenant should be set during login");
    
    throw new Error(
      "TENANT_MISSING: Tenant ID is required for all API requests. " +
      "This usually means you're not logged in or the session is corrupted. " +
      "Please log in again."
    );
  }
  
  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  
  // Add authorization
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Add tenant ID (REQUIRED)
  if (!skipTenantId && !isPublicRoute) {
    if (!tenantId) {
      throw new Error("TENANT_MISSING: Tenant ID not found in localStorage");
    }
    headers.set("X-Tenant-Id", tenantId);
  }
  
  // Add device ID (critical for license validation)
  if (!skipDeviceUUID) {
    const deviceId = getDeviceUUID();
    headers.set("X-Device-Id", deviceId);
    headers.set("X-Device-UUID", deviceId);
  }
  
  // Add content type if not set and body is not FormData
  if (!headers.has("Content-Type") && fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  // Make request
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });
  
  // If token expired error (401), ALWAYS try to refresh and retry
  if (response.status === 401) {
    console.log("[API CLIENT] 401 Unauthorized - attempting token refresh...");
    
    let errorData = {};
    try {
      const clonedResponse = response.clone();
      errorData = await clonedResponse.json().catch(() => ({}));
    } catch (e) {
      // Response might not be JSON
    }
    
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      console.log("[API CLIENT] Token refreshed, retrying request...");
      headers.set("Authorization", `Bearer ${newToken}`);
      
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      
      if (response.status === 401) {
        console.error("[API CLIENT] Still 401 after refresh - redirecting to login");
        clearTokens();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
    } else {
      console.error("[API CLIENT] Token refresh failed - redirecting to login");
      clearTokens();
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
  }
  
  // Handle license errors
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    
    if (data.error === "DEMO_EXPIRED") {
      console.warn("[API] Demo expired - showing modal");
      window.dispatchEvent(new CustomEvent("demo-expired"));
    } else if (data.error === "DEVICE_LIMIT_EXCEEDED") {
      console.warn("[API] Device limit exceeded - showing blocking modal");
      window.dispatchEvent(new CustomEvent("device-limit-exceeded"));
    } else if (data.error === "activation_required") {
      console.warn("[API] License activation required");
      if (window.location.pathname !== "/professional-license-activation") {
        window.location.href = "/professional-license-activation";
      }
    } else if (data.error === "expired") {
      console.error("[API] License expired");
      window.location.href = "/professional-license-activation?expired=true";
    }
  }
  
  return response;
}

/**
 * GET request
 */
export async function apiGet(endpoint: string, options?: RequestOptions) {
  return apiClient(endpoint, { ...options, method: "GET" });
}

/**
 * POST request
 */
export async function apiPost(endpoint: string, data?: any, options?: RequestOptions) {
  return apiClient(endpoint, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut(endpoint: string, data?: any, options?: RequestOptions) {
  return apiClient(endpoint, {
    ...options,
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete(endpoint: string, options?: RequestOptions) {
  return apiClient(endpoint, { ...options, method: "DELETE" });
}
