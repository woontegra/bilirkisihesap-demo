/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of Bilirkisi1Independent page isolation
 */

const API_URL = import.meta.env.VITE_API_URL || "";

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function decodeTokenExpiry(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const decoded = JSON.parse(jsonPayload);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  
  const expiryTime = decodeTokenExpiry(accessToken);
  if (expiryTime) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  } else {
    const fallbackExpiry = Date.now() + (2 * 60 * 60 * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, fallbackExpiry.toString());
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem('current_user');
  localStorage.removeItem('email');
  localStorage.removeItem('licenseValid');
  localStorage.removeItem('professionalLicenseKey');
  localStorage.removeItem('professionalLicenseExpiry');
  localStorage.removeItem('professional_device_id');
  localStorage.removeItem('tenant_id');
}

export function isTokenExpired(): boolean {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) return true;
  
  const expiry = parseInt(expiryTime);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  return now >= (expiry - fiveMinutes);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.error('[REFRESH TOKEN] No refresh token found in localStorage');
    return null;
  }
  
  try {
    console.log('[REFRESH TOKEN] Attempting to refresh token...');
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[REFRESH TOKEN] Refresh failed:', response.status, errorData);
      throw new Error(errorData.error || 'Token refresh failed');
    }
    
    const data = await response.json();
    
    if (!data.accessToken || !data.refreshToken) {
      console.error('[REFRESH TOKEN] Invalid response - missing tokens');
      throw new Error('Invalid refresh response');
    }
    
    saveTokens(data.accessToken, data.refreshToken);
    
    if (data.user) {
      localStorage.setItem('current_user', JSON.stringify(data.user));
      localStorage.setItem('tenant_id', String(data.user.tenantId || '1'));
      localStorage.setItem('email', data.user.email);
    }
    
    console.log('[REFRESH TOKEN] Token refreshed successfully');
    return data.accessToken;
  } catch (error) {
    console.error('[REFRESH TOKEN] Token refresh error:', error);
    clearTokens();
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-id': localStorage.getItem('tenant_id') || '1',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    console.error('Logout API error:', error);
  } finally {
    clearTokens();
  }
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken = getAccessToken();
  
  if (isTokenExpired()) {
    accessToken = await refreshAccessToken();
    
    if (!accessToken) {
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'x-tenant-id': localStorage.getItem('tenant_id') || '1',
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    
    if (data.code === 'TOKEN_EXPIRED') {
      accessToken = await refreshAccessToken();
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        return fetch(url, { ...options, headers });
      } else {
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
    }
  }
  
  return response;
}

export async function login(email: string, password: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }
  
  const data = await response.json();
  
  saveTokens(data.accessToken, data.refreshToken);
  
  localStorage.setItem('current_user', JSON.stringify(data.user));
  localStorage.setItem('tenant_id', String(data.user.tenantId));
  localStorage.setItem('email', data.user.email);
  
  if (data.professionalLicenseValid) {
    localStorage.setItem('licenseValid', 'true');
    localStorage.setItem('professionalLicenseKey', data.professionalLicense?.license_key || '');
    localStorage.setItem('professionalLicenseExpiry', data.professionalLicense?.expires_at || '');
  } else {
    localStorage.setItem('licenseValid', 'false');
    localStorage.removeItem('professionalLicenseKey');
    localStorage.removeItem('professionalLicenseExpiry');
  }
  
  return data;
}
