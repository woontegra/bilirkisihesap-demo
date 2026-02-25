import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "@/utils/apiClient";

interface ProfessionalProtectedRouteProps {
  children: JSX.Element;
}

/**
 * Professional Protected Route with License Validation
 * Checks both authentication and license validity
 * Also checks if password change is required
 */
export default function ProfessionalProtectedRoute({ children }: ProfessionalProtectedRouteProps) {
  const token = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  const licenseValid = localStorage.getItem("licenseValid") === "true";
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const location = useLocation();
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Not logged in → redirect to login
  if (!token && !refreshToken) {
    console.log("[ProfessionalProtectedRoute] No tokens found, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if password change is required
  useEffect(() => {
    const checkPasswordChange = async () => {
      try {
        // Get email from localStorage (set during login)
        const storedUser = localStorage.getItem("current_user");
        const email = storedUser ? JSON.parse(storedUser).email : localStorage.getItem("email");
        
        if (!email) {
          console.error("[ProfessionalProtectedRoute] No email found, redirecting to login");
          setAuthError(true);
          setTimeout(() => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("current_user");
            localStorage.removeItem("tenant_id");
            window.location.href = "/login";
          }, 100);
          return;
        }
        
        // Backend requires email as query parameter
        // apiGet will automatically handle token refresh if needed
        const response = await apiGet(`/api/auth/me?email=${encodeURIComponent(email)}`);
        if (response.ok) {
          const userData = await response.json();
          setMustChangePassword(userData.mustChangePassword === true);
          setAuthError(false);
        } else if (response.status === 401) {
          // Token expired or invalid - try refresh first
          console.warn("[ProfessionalProtectedRoute] 401 received, token may be expired");
          
          // Import refresh function
          const { refreshAccessToken } = await import("@/utils/authToken");
          const newToken = await refreshAccessToken();
          
          if (newToken) {
            // Retry the request with new token
            const retryResponse = await apiGet(`/api/auth/me?email=${encodeURIComponent(email)}`);
            if (retryResponse.ok) {
              const userData = await retryResponse.json();
              setMustChangePassword(userData.mustChangePassword === true);
              setAuthError(false);
            } else {
              // Still failed after refresh - redirect to login
              console.error("[ProfessionalProtectedRoute] Still 401 after token refresh, redirecting to login");
              setAuthError(true);
              setTimeout(() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("current_user");
                localStorage.removeItem("tenant_id");
                window.location.href = "/login";
              }, 100);
              return;
            }
          } else {
            // Refresh failed - redirect to login
            console.error("[ProfessionalProtectedRoute] Token refresh failed, redirecting to login");
            setAuthError(true);
            setTimeout(() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("current_user");
              localStorage.removeItem("tenant_id");
              window.location.href = "/login";
            }, 100);
            return;
          }
        } else {
          // Other errors - assume no password change required
          console.warn("[ProfessionalProtectedRoute] /api/auth/me failed:", response.status);
          setMustChangePassword(false);
          setAuthError(false);
        }
      } catch (error) {
        console.error("Error checking password change requirement:", error);
        // If it's a network error or 401, try refresh first
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('TENANT_MISSING'))) {
          // Try refresh
          try {
            const { refreshAccessToken } = await import("@/utils/authToken");
            const newToken = await refreshAccessToken();
            if (!newToken) {
              // Refresh failed - redirect to login
              setAuthError(true);
              setTimeout(() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("current_user");
                localStorage.removeItem("tenant_id");
                window.location.href = "/login";
              }, 100);
              return;
            }
            // Retry after refresh
            setMustChangePassword(false);
            setAuthError(false);
          } catch (refreshError) {
            setAuthError(true);
            setTimeout(() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("current_user");
              localStorage.removeItem("tenant_id");
              window.location.href = "/login";
            }, 100);
            return;
          }
        } else {
          setMustChangePassword(false);
          setAuthError(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkPasswordChange();
  }, []);

  // If auth error, redirect to login (handled in useEffect)
  if (authError) {
    return null; // Will redirect in useEffect
  }

  // If still loading, show nothing (or a loading spinner)
  if (loading) {
    return null; // Or return a loading spinner
  }

  // If password change is required, block access to all pages except /change-password
  if (mustChangePassword === true && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Allow access to change-password page only if password change is required
  if (location.pathname === "/change-password" && mustChangePassword !== true) {
    // Password change not required, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Admin bypass (tenant_id = 1 always has access)
  if (tenantId === 1) {
    return children;
  }

  // Not licensed → redirect to professional license activation
  // Exception: allow access to the license activation page itself and change-password
  if (!licenseValid && location.pathname !== "/professional-license-activation" && location.pathname !== "/change-password") {
    return <Navigate to="/professional-license-activation" replace />;
  }

  // All checks passed → render page
  return children;
}

