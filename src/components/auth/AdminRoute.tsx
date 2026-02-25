import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("[AdminRoute] Checking admin access...");
    console.log("[AdminRoute] User from context:", user);
    
    // Token kontrolü
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id");
    
    console.log("[AdminRoute] Token exists:", !!token);
    console.log("[AdminRoute] TenantId from localStorage:", tenantId);
    
    // Token yoksa admin değil
    if (!token) {
      console.log("[AdminRoute] No token - denying access");
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // TenantId kontrolü - localStorage'dan (backend ile senkron)
    const isTenant1 = tenantId === "1";
    console.log("[AdminRoute] Is tenant 1?", isTenant1);
    
    // User context'ten role kontrolü
    let userIsAdmin = false;
    let userTenantId = null;
    
    if (user) {
      userIsAdmin = user.role === "admin";
      userTenantId = (user as any).tenantId;
      console.log("[AdminRoute] User role:", user.role, "User tenantId:", userTenantId);
    }
    
    // Admin erişimi: tenantId === "1" (localStorage) VEYA user.role === "admin" VEYA user.tenantId === 1
    const hasAccess = isTenant1 || userIsAdmin || userTenantId === 1;
    console.log("[AdminRoute] Final decision - Has access?", hasAccess);
    
    setIsAdmin(hasAccess);
    setIsLoading(false);
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  // Token yoksa login'e yönlendir
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin-access-denied" replace />;
  }

  return <>{children}</>;
}

