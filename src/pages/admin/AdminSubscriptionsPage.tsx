import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiClient";

interface User {
  id: number;
  name: string;
  email: string;
  subscriptionType: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  status: string;
}

export default function AdminSubscriptionsPage() {
  const { error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const errorRef = useRef(error);
  
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");
  
  // error fonksiyonunu ref'te sakla
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const url = `${API_BASE_URL}/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching subscriptions from:", url);
      
      const res = await fetch(url, {
        headers: {
          "x-tenant-id": String(tenantId),
          Authorization: `Bearer ${token}`,
          "x-user-role": "admin",
        },
      });

      console.log("Response status:", res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error(`Abonelikler yüklenemedi: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
      // error fonksiyonunu ref'ten kullan
      errorRef.current("Abonelikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tenantId, token]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Sayfa focus olduğunda veya görünür olduğunda yenile
  useEffect(() => {
    let isMounted = true;
    let lastLoadTime = 0;
    const MIN_LOAD_INTERVAL = 2000; // Minimum 2 saniye bekle
    
    const handleFocus = () => {
      const now = Date.now();
      if (isMounted && (now - lastLoadTime) > MIN_LOAD_INTERVAL) {
        lastLoadTime = now;
        loadSubscriptions();
      }
    };
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (!document.hidden && isMounted && (now - lastLoadTime) > MIN_LOAD_INTERVAL) {
        lastLoadTime = now;
        loadSubscriptions();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadSubscriptions]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const expiry = new Date(dateStr);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Aktif" },
      suspended: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Askıya Alındı" },
      deleted: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Silindi" },
    };
    const variant = variants[status] || variants.active;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getSubscriptionTypeBadge = (type: string | null) => {
    const variants: Record<string, { color: string; label: string }> = {
      annual: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Yıllık" },
      standard: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Standart" },
      pro: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", label: "Pro" },
      enterprise: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", label: "Enterprise" },
      "1_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "1 Günlük Demo" },
      "3_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "3 Günlük Demo" },
      "7_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "7 Günlük Demo" },
    };
    const defaultVariant = { color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", label: type || "Yok" };
    const variant = (type && variants[type]) ? variants[type] : defaultVariant;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  // Filter subscriptions expiring soon (within 7 days)
  const expiringSoon = users.filter((user) => {
    if (!user.subscriptionEndsAt || user.status !== "active") return false;
    const days = getDaysUntilExpiry(user.subscriptionEndsAt);
    return days !== null && days >= 0 && days <= 7;
  });

  // Filter expired subscriptions
  const expired = users.filter((user) => {
    if (!user.subscriptionEndsAt || user.status !== "active") return false;
    const days = getDaysUntilExpiry(user.subscriptionEndsAt);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Abonelik Yönetimi</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tüm abonelikleri görüntüleyin ve yönetin
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Abonelik</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {users.filter((u) => u.status === "active").length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Yakında Bitecek</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {expiringSoon.length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Süresi Dolmuş</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {expired.length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon Section */}
      {expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Yakında Bitecekler (7 gün içinde)
            </CardTitle>
            <CardDescription>
              Bu abonelikler yakında sona erecek
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringSoon.map((user) => {
                const days = getDaysUntilExpiry(user.subscriptionEndsAt);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-orange-200 dark:border-orange-900 rounded-lg bg-orange-50 dark:bg-orange-900/10"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {user.email}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        {days === 0 ? "Bugün" : `${days} gün`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(user.subscriptionEndsAt)}
                      </p>
                    </div>
                    <Link to={`/admin/users/${user.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Düzenle
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıya Alındı</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* All Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Tüm Abonelikler</CardTitle>
          <CardDescription>
            Toplam {users.length} abonelik bulundu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Abonelik bulunamadı
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Kullanıcı
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Abonelik Tipi
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Başlangıç Tarihi
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Bitiş Tarihi
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Deneme Bitiş
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Durum
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const days = getDaysUntilExpiry(user.subscriptionEndsAt);
                    const isExpiringSoon = days !== null && days >= 0 && days <= 7;
                    const isExpired = days !== null && days < 0;

                    return (
                      <tr
                        key={user.id}
                        className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isExpired ? "bg-red-50 dark:bg-red-900/10" : ""
                        } ${isExpiringSoon ? "bg-orange-50 dark:bg-orange-900/10" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {user.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getSubscriptionTypeBadge(user.subscriptionType)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(user.subscriptionStartsAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(user.subscriptionEndsAt)}
                          </div>
                          {days !== null && days >= 0 && days <= 7 && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              {days} gün kaldı
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Süresi doldu
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(user.trialEndsAt)}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end">
                            <Link to={`/admin/users/${user.id}/edit`}>
                              <Button variant="ghost" size="sm">
                                Düzenle
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

