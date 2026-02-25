import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { Plus, Search, Edit, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/utils/apiClient";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  subscriptionType: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  status: string;
  createdAt: string;
  licenseKey?: string | null;
  licenseExpiresAt?: string | null;
  licenseMaxDevices?: number;
  licenseDeviceCount?: number;
}

export default function AdminUsersPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLicense, setSelectedLicense] = useState<User | null>(null);
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const url = `${API_BASE_URL}/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching users from:", url);
      
      const res = await fetch(url, {
        headers: {
          "x-tenant-id": String(tenantId),
          Authorization: `Bearer ${token}`,
          "x-user-role": "admin", // Temporary for testing
        },
      });

      console.log("Response status:", res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        if (res.status === 403) {
          error("Admin erişimi gerekli");
          navigate("/admin-access-denied");
          return;
        }
        throw new Error(`Failed to load users: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load users:", err);
      error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadUsers();
  };

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Aktif" },
      suspended: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Askıya Alındı" },
      deleted: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Silindi" },
    };
    const variant = variants[status] || variants.active;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      admin: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", label: "Admin" },
      user: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Kullanıcı" },
    };
    const variant = variants[role] || variants.user;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kullanıcı Yönetimi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tüm kullanıcıları görüntüleyin ve yönetin
          </p>
        </div>
        <Link to="/admin/users/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Üyelik Aç
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="İsim veya email ile ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="active">Aktif</option>
                <option value="suspended">Askıya Alındı</option>
                <option value="trial">Deneme Süresi</option>
              </select>
              <Button onClick={handleSearch} variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtrele
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Listesi</CardTitle>
          <CardDescription>
            Toplam {users.length} kullanıcı bulundu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Kullanıcı bulunamadı
              </p>
              <Link to="/admin/users/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Kullanıcıyı Oluştur
                </Button>
              </Link>
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
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rol
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Abonelik
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Bitiş Tarihi
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
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {user.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {user.subscriptionType || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(user.subscriptionEndsAt)}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <Link to={`/admin/users/${user.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4 mr-2" />
                              Düzenle
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

