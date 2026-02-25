import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TrendingUp, Users, Clock, Percent } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiGet } from "@/utils/apiClient";

interface CalculationItem {
  type: string;
  count: number;
}

interface Conversion {
  user_id: number;
  user_email: string;
  demo_activated_at: string;
  paid_activated_at: string;
  days_to_convert: number;
  calculations?: CalculationItem[];
}

interface DemoUserCalculation {
  user_id: number;
  tenant_id: number | null;
  user_email: string;
  demo_activated_at: string | null;
  calculations: CalculationItem[];
}

interface ConversionMetrics {
  total_demos: number;
  total_converted: number;
  conversion_rate: number;
  avg_conversion_time_days: number;
  conversions: Conversion[];
  demo_user_calculations?: DemoUserCalculation[];
}

export default function DemoConversionPage() {
  const { error } = useToast();
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30" | "90">("all");

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiGet("/api/admin/demo-conversion");

      if (!response.ok) {
        throw new Error("Failed to load conversion metrics");
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data);
      } else {
        throw new Error(data.error || "Failed to load metrics");
      }
    } catch (err: any) {
      console.error("Failed to load conversion metrics:", err);
      error(err.message || "Metrikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const filterConversions = (conversions: Conversion[]) => {
    if (dateFilter === "all") return conversions;

    const days = parseInt(dateFilter);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return conversions.filter((conv) => {
      const paidDate = new Date(conv.paid_activated_at);
      return paidDate >= cutoffDate;
    });
  };

  const filteredConversions = metrics ? filterConversions(metrics.conversions) : [];

  const formatCalculations = (calculations: CalculationItem[] | undefined) => {
    if (!calculations || calculations.length === 0) return "—";
    return calculations.map((c) => `${c.type} (${c.count})`).join(", ");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-full">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Metrikler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-full">
        <Alert variant="destructive">
          <AlertDescription>Metrikler yüklenemedi.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-3 max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Demo → Satış Dönüşüm Metrikleri
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Demo kullanıcılarının satın alma dönüşüm oranlarını ve sürelerini görüntüleyin
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Demo Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_demos}</div>
            <p className="text-xs text-muted-foreground">Demo lisansı olan kullanıcı sayısı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dönüşen Kullanıcı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_converted}</div>
            <p className="text-xs text-muted-foreground">Satın alan demo kullanıcı sayısı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dönüşüm Oranı</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversion_rate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Demo'dan satışa dönüşüm yüzdesi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ortalama Dönüşüm Süresi</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avg_conversion_time_days.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Gün cinsinden ortalama süre</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dönüşüm Detayları</CardTitle>
              <CardDescription>
                {filteredConversions.length} dönüşüm gösteriliyor
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as "all" | "7" | "30" | "90")}
                className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-sm"
              >
                <option value="all">Tüm Zamanlar</option>
                <option value="7">Son 7 Gün</option>
                <option value="30">Son 30 Gün</option>
                <option value="90">Son 90 Gün</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredConversions.length === 0 ? (
            <Alert>
              <AlertDescription>
                {dateFilter === "all" 
                  ? "Henüz dönüşüm kaydı bulunmuyor."
                  : "Seçilen tarih aralığında dönüşüm bulunamadı."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-b">
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Kullanıcı Email
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Demo Başlangıç
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Satın Alma Tarihi
                    </th>
                    <th className="p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Dönüşüm Süresi
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Yapılan hesaplamalar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversions.map((conversion, index) => {
                    const isFastConversion = conversion.days_to_convert <= 3;
                    
                    return (
                      <tr
                        key={`${conversion.user_id}-${index}`}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isFastConversion ? "bg-green-50 dark:bg-green-900/20" : ""
                        }`}
                      >
                        <td className="p-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {conversion.user_email}
                        </td>
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(conversion.demo_activated_at)}
                        </td>
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(conversion.paid_activated_at)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              isFastConversion
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            }
                          >
                            {conversion.days_to_convert} gün
                            {isFastConversion && " ⚡"}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                          {formatCalculations(conversion.calculations)}
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

      {/* Tüm demo kullanıcıları ve yaptıkları hesaplamalar — demo varsa her zaman göster */}
      {metrics.total_demos > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Demo kullanıcıları ve yaptıkları hesaplamalar</CardTitle>
            <CardDescription>
              Demo talep eden tüm kullanıcılar ve kaydettikleri hesaplama türleri
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.demo_user_calculations && metrics.demo_user_calculations.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 border-b">
                      <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Tenant No
                      </th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Kullanıcı Email
                      </th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Demo başlangıç
                      </th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Yapılan hesaplamalar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.demo_user_calculations.map((row, index) => (
                      <tr
                        key={`demo-${row.user_id}-${index}`}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                          {row.tenant_id ?? "—"}
                        </td>
                        <td className="p-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {row.user_email}
                        </td>
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                          {row.demo_activated_at ? formatDate(row.demo_activated_at) : "—"}
                        </td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                          {formatCalculations(row.calculations)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Hesaplama listesi alınamadı. Backend’in güncel sürümü çalışıyor mu kontrol edin; sunucuyu yeniden başlattıktan sonra sayfayı yenileyin.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
