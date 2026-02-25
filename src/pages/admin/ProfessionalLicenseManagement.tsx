import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Plus, Loader2, Copy, AlertCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { API_BASE_URL } from "@/utils/apiClient";

interface ProfessionalLicense {
  id: string;
  license_key: string;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  max_devices: number;
  device_count: number;
  activated_devices: string[];
  expires_at: string;
  created_at: string;
}

export default function ProfessionalLicenseManagement() {
  const [licenses, setLicenses] = useState<ProfessionalLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Form state
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  
  const { success, error } = useToast();

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/api/admin/licenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
        },
      });

      if (response.status === 401) {
        setErrorMessage("Yetkisiz erişim: Lütfen tekrar giriş yapın.");
        return;
      }

      if (!response.ok) {
        setErrorMessage("Lisanslar yüklenemedi.");
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setLicenses(data);
      } else {
        setErrorMessage("Lisans verisi geçersiz.");
      }
    } catch (err) {
      setErrorMessage("Lisanslar yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const createLicense = async () => {
    if (!expiresAt) {
      error("Lütfen son kullanma tarihi seçin");
      return;
    }

    setCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/api/admin/licenses/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          max_devices: parseInt(String(maxDevices)),
          expires_at: expiresAt,
        }),
      });

      if (response.status === 401) {
        setErrorMessage("Yetkisiz işlem: Lütfen tekrar giriş yapın.");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Lisans oluşturulamadı.");
        return;
      }

      setSuccessMessage("Lisans başarıyla oluşturuldu!");
      setMaxDevices(1);
      setExpiresAt("");
      loadLicenses();
    } catch (err) {
      setErrorMessage("Lisans oluşturma sırasında hata oluştu.");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success("Lisans anahtarı kopyalandı");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Generation Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Yeni Profesyonel Lisans Oluştur
          </CardTitle>
          <CardDescription>
            Format: A12B-128J-14KM-GFR3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="max-devices">Maksimum Cihaz Sayısı</Label>
              <Input
                id="max-devices"
                type="number"
                min="1"
                max="10"
                value={maxDevices}
                onChange={(e) => setMaxDevices(parseInt(e.target.value) || 1)}
                disabled={creating}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="expires-at">Son Kullanma Tarihi *</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={creating}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <Button
            onClick={createLicense}
            disabled={creating || !expiresAt}
            className="w-full md:w-auto"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Lisans Oluştur
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Licenses List Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profesyonel Lisans Listesi</CardTitle>
          <CardDescription>
            Toplam {licenses.length} lisans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Lisanslar yükleniyor...</p>
            </div>
          ) : errorMessage ? (
            null
          ) : licenses.length === 0 ? (
            <Alert>
              <AlertDescription>Henüz lisans bulunmuyor</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-3 text-left text-sm font-semibold text-gray-700">
                      Lisans Anahtarı
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700">
                      Kullanıcı
                    </th>
                    <th className="p-3 text-center text-sm font-semibold text-gray-700">
                      Cihaz Kullanımı
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700">
                      Son Kullanma
                    </th>
                    <th className="p-3 text-center text-sm font-semibold text-gray-700">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => (
                    <tr
                      key={license.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      {/* License Key */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            {license.license_key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(license.license_key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                      {/* User */}
                      <td className="p-3 text-sm">
                        {license.user_email ? (
                          <div>
                            <div className="font-medium">{license.user_name || "-"}</div>
                            <div className="text-gray-500 text-xs">{license.user_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Atanmamış</span>
                        )}
                      </td>

                      {/* Device Usage */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          license.device_count >= license.max_devices
                            ? "bg-red-100 text-red-700"
                            : license.device_count > 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {license.device_count} / {license.max_devices}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="p-3 text-sm">
                        {formatDate(license.expires_at)}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(license.license_key)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Kopyala
                        </Button>
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

