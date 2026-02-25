const API_URL = import.meta.env.VITE_API_URL || "";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_KEY = "token_expiry";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function decodeTokenExpiry(token: string): number | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
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
    localStorage.setItem(
      TOKEN_EXPIRY_KEY,
      (Date.now() + 2 * 60 * 60 * 1000).toString()
    );
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem("current_user");
  localStorage.removeItem("email");
  localStorage.removeItem("licenseValid");
  localStorage.removeItem("professionalLicenseKey");
  localStorage.removeItem("professionalLicenseExpiry");
  localStorage.removeItem("professional_device_id");
  localStorage.removeItem("tenant_id");
}

export function isTokenExpired(): boolean {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) return true;
  const expiry = parseInt(expiryTime);
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= expiry - fiveMinutes;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Token refresh failed");
    }
    const data = await response.json();
    if (!data.accessToken || !data.refreshToken) throw new Error("Invalid refresh response");
    saveTokens(data.accessToken, data.refreshToken);
    if (data.user) {
      localStorage.setItem("current_user", JSON.stringify(data.user));
      localStorage.setItem("tenant_id", String(data.user.tenantId || "1"));
      localStorage.setItem("email", data.user.email);
    }
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}
