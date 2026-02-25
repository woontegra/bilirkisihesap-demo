import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/utils/apiClient";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Trash2,
  Eye,
  Filter,
  Download,
} from "lucide-react";

interface Log {
  id: number;
  tenantId: number;
  userId: number | null;
  userEmail: string | null;
  level: string;
  type: string;
  action: string;
  message: string | null;
  details: any;
  stack: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface LogStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  last24hLogs: number;
  tenantStats: Array<{
    tenantId: number;
    _count: { id: number };
  }> | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });

  // Filtreler
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id") || "1";
  const isAdmin = tenantId === "1";

  useEffect(() => {
    loadStats();
    loadLogs();
  }, [pagination.page, levelFilter, typeFilter, tenantFilter, searchQuery]);

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs/stats`, {
        headers: {
          "x-tenant-id": tenantId,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        console.error("Failed to load stats:", await res.text());
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (levelFilter) params.append("level", levelFilter);
      if (typeFilter) params.append("type", typeFilter);
      if (tenantFilter) params.append("tenantFilter", tenantFilter);
      if (searchQuery) params.append("search", searchQuery);

      const endpoint = isAdmin ? "/api/logs/all" : "/api/logs/my-logs";
      const res = await fetch(`${API_BASE_URL}${endpoint}?${params}`, {
        headers: {
          "x-tenant-id": tenantId,
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
      } else {
        console.error("Failed to load logs:", await res.text());
        setLogs([]);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const clearOldLogs = async () => {
    if (!isAdmin) return;
    if (!confirm("90 günden eski logları silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/logs/clear-old`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days: 90 }),
      });

      if (res.ok) {
        alert("Eski loglar başarıyla silindi");
        loadStats();
        loadLogs();
      }
    } catch (error) {
      console.error("Failed to clear logs:", error);
      alert("Log silme işlemi başarısız oldu");
    }
  };

  const exportLogs = () => {
    const csv = [
      ["Tarih", "Seviye", "Tip", "Aksiyon", "Mesaj", "Tenant ID", "Email"].join(","),
      ...logs.map((log) =>
        [
          new Date(log.createdAt).toLocaleString("tr-TR"),
          log.level,
          log.type,
          log.action,
          `"${log.message || ""}"`,
          log.tenantId,
          log.userEmail || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  const getLevelIcon = (level: string) => {
    if (!level) return <Info className="w-4 h-4 text-gray-500" />;
    
    switch (level.toLowerCase()) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    if (!level) return <Badge variant="default" className="text-xs">UNKNOWN</Badge>;
    
    const levelLower = level.toLowerCase();
    const variants: any = {
      error: "destructive",
      warning: "warning",
      info: "default",
    };
    return (
      <Badge variant={variants[levelLower] || "default"} className="text-xs">
        {level.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sistem Logları</h1>
          <p className="text-gray-600 mt-1">
            {isAdmin
              ? "Tüm tenant'ların sistem loglarını görüntüleyin"
              : "Kendi sistem loglarınızı görüntüleyin"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            CSV İndir
          </Button>
          {isAdmin && (
            <Button onClick={clearOldLogs} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Eski Logları Sil
            </Button>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Toplam Log</div>
            <div className="text-2xl font-bold">{stats.totalLogs}</div>
          </Card>
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="text-sm text-red-600">Hatalar</div>
            <div className="text-2xl font-bold text-red-700">{stats.errorCount}</div>
          </Card>
          <Card className="p-4 border-yellow-200 bg-yellow-50">
            <div className="text-sm text-yellow-600">Uyarılar</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.warningCount}</div>
          </Card>
          <Card className="p-4 border-blue-200 bg-blue-50">
            <div className="text-sm text-blue-600">Bilgiler</div>
            <div className="text-2xl font-bold text-blue-700">{stats.infoCount}</div>
          </Card>
          <Card className="p-4 border-green-200 bg-green-50">
            <div className="text-sm text-green-600">Son 24 Saat</div>
            <div className="text-2xl font-bold text-green-700">{stats.last24hLogs}</div>
          </Card>
        </div>
      )}

      {/* Filtreler */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" />
          <span className="font-semibold">Filtreler</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Seviye</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Tümü</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Tip</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Tümü</option>
              <option value="api">API</option>
              <option value="auth">Auth</option>
              <option value="frontend">Frontend</option>
              <option value="calculation">Calculation</option>
              <option value="payment">Payment</option>
              <option value="system">System</option>
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Tenant</label>
              <Input
                type="number"
                placeholder="Tenant ID"
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ara</label>
            <Input
              placeholder="Mesaj, email, aksiyon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Log Listesi */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tarih
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seviye
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tip
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Aksiyon
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Mesaj
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tenant
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={isAdmin ? 8 : 7}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={isAdmin ? 8 : 7}>
                    Log bulunamadı
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(log.level)}
                        {getLevelBadge(log.level)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{log.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">{log.action}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {log.message}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary">T{log.tenantId}</Badge>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm">{log.userEmail || "-"}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t">
            <div className="text-sm text-gray-600">
              Toplam {pagination.total} kayıt (Sayfa {pagination.page} / {pagination.totalPages})
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Detay Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <Card
            className="max-w-3xl w-full max-h-[80vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold">Log Detayı</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Tarih:</span>
                  <p className="font-medium">
                    {new Date(selectedLog.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Seviye:</span>
                  <p className="font-medium">{getLevelBadge(selectedLog.level)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Tip:</span>
                  <p className="font-medium">{selectedLog.type}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Tenant ID:</span>
                  <p className="font-medium">{selectedLog.tenantId}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">User ID:</span>
                  <p className="font-medium">{selectedLog.userId || "-"}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Email:</span>
                  <p className="font-medium">{selectedLog.userEmail || "-"}</p>
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-600">Aksiyon:</span>
                <p className="font-mono text-sm mt-1">{selectedLog.action}</p>
              </div>

              {selectedLog.message && (
                <div>
                  <span className="text-sm text-gray-600">Mesaj:</span>
                  <p className="mt-1">{selectedLog.message}</p>
                </div>
              )}

              {selectedLog.details && (
                <div>
                  <span className="text-sm text-gray-600">Detaylar:</span>
                  <pre className="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.stack && isAdmin && (
                <div>
                  <span className="text-sm text-gray-600">Stack Trace:</span>
                  <pre className="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                    {selectedLog.stack}
                  </pre>
                </div>
              )}

              {selectedLog.ipAddress && (
                <div>
                  <span className="text-sm text-gray-600">IP Address:</span>
                  <p className="font-mono text-sm mt-1">{selectedLog.ipAddress}</p>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <span className="text-sm text-gray-600">User Agent:</span>
                  <p className="text-sm mt-1 break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LogsPage;

