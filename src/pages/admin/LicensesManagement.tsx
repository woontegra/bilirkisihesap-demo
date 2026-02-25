import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/context/ToastContext";
import DeviceManagerModal from "@/components/modals/DeviceManagerModal";
import { API_BASE_URL } from "@/utils/apiClient";
import { 
  Key, 
  Plus, 
  Loader2, 
  Copy, 
  AlertCircle, 
  RefreshCw, 
  Trash2,
  UserPlus,
  UserMinus,
  Monitor
} from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
}

interface License {
  license_id: string;
  license_key: string;
  type: string;
  expires_at: string;
  status: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  device_id: string | null;
  activated_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  is_expired: boolean;
}

export default function LicensesManagement() {
  const { success, error } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  
  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  
  // Device manager modal state
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceModalLicenseId, setDeviceModalLicenseId] = useState<string | null>(null);
  const [deviceModalLicenseKey, setDeviceModalLicenseKey] = useState<string>("");

  useEffect(() => {
    loadLicenses();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id");
      
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId || "1"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const loadLicenses = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = localStorage.getItem("access_token");
      
      if (!token) {
        setErrorMessage("Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
        setLoading(false);
        return;
      }

      const tenantId = localStorage.getItem("tenant_id") || "1";
      
      const response = await fetch(`${API_BASE_URL}/api/admin/licenses`, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        }
      });

      if (response.status === 401) {
        setErrorMessage("Yetkisiz erişim. Lütfen tekrar giriş yapın.");
        // Token expired olabilir, kullanıcıyı login'e yönlendir
        setTimeout(() => {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }, 2000);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setErrorMessage(`Sunucu hatası: ${response.status}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      // Backend direkt array dönüyor, success field'ı yok
      if (Array.isArray(data)) {
        setLicenses(data);
      } else if (data.success) {
        setLicenses(data.licenses || []);
      } else {
        setErrorMessage("Lisanslar yüklenemedi");
      }
    } catch (err) {
      console.error("Lisans yükleme hatası:", err);
      setErrorMessage("Lisanslar yüklenirken hata oluştu");
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
          max_devices: Number(maxDevices),
          expires_at: expiresAt,
        }),
      });

      const data = await response.json();

      if (data.success) {
        success(data.message || "Lisans başarıyla oluşturuldu!");
        setMaxDevices(1);
        setExpiresAt("");
        loadLicenses();
      } else {
        setErrorMessage(data.error || "Lisans oluşturulamadı");
      }
    } catch (err) {
      setErrorMessage("Lisans oluşturma sırasında hata oluştu");
    } finally {
      setCreating(false);
    }
  };

  const openAssignModal = (licenseId: string) => {
    setSelectedLicenseId(licenseId);
    setSelectedUserId(null);
    setShowAssignModal(true);
  };

  const openDeviceModal = (licenseId: string, licenseKey: string) => {
    setDeviceModalLicenseId(licenseId);
    setDeviceModalLicenseKey(licenseKey);
    setShowDeviceModal(true);
  };

  const closeDeviceModal = () => {
    setShowDeviceModal(false);
    setDeviceModalLicenseId(null);
    setDeviceModalLicenseKey("");
  };

  const handleDeviceUpdate = () => {
    loadLicenses();
  };

  const handleResetDevices = async (licenseId: string, licenseKey: string) => {
    if (!confirm(`${licenseKey} lisansının tüm cihazlarını sıfırlamak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/api/admin/licenses/reset-devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          licenseKey: licenseKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        success(data.message || "Cihazlar sıfırlandı");
        loadLicenses();
      } else {
        error(data.error || "Cihazlar sıfırlanamadı");
      }
    } catch (err) {
      error("Cihaz sıfırlama sırasında hata oluştu");
    }
  };

  const handleAssignLicense = async () => {
    if (!selectedLicenseId || !selectedUserId) {
      error("Lütfen kullanıcı seçin");
      return;
    }

    setAssigning(true);

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";
      
      const payload = {
        license_id: selectedLicenseId,
        user_id: selectedUserId,
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/licenses/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        success(data.message || "Lisans kullanıcıya atandı");
        setShowAssignModal(false);
        loadLicenses();
      } else {
        const errorMsg = data.details 
          ? `${data.message || data.error}\n${data.details}`
          : data.message || data.error || "Lisans atanamadı";
        error(errorMsg);
      }
    } catch (err) {
      error("Lisans atama sırasında hata oluştu");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignLicense = async (licenseId: string) => {
    if (!confirm("Bu lisansın kullanıcı atamasını kaldırmak istediğinize emin misiniz?")) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/api/admin/licenses/unassign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          license_id: licenseId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        success(data.message || "Kullanıcı ataması kaldırıldı");
        loadLicenses();
      } else {
        error(data.error || "İşlem başarısız");
      }
    } catch (err) {
      error("İşlem sırasında hata oluştu");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success("Lisans anahtarı kopyalandı");
  };

  const getStatusBadge = (license: License) => {
    const isExpired = license.is_expired || (license.expires_at && new Date(license.expires_at) < new Date());
    
    if (isExpired) {
      return { text: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
    }
    
    if (license.status === "active") {
      return { text: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
    }
    
    if (license.status === "inactive") {
      return { text: "Inactive", className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" };
    }
    
    return { text: license.status || "Active", className: "bg-gray-100 text-gray-800" };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  // Filter licenses by search query
  const filteredLicenses = licenses.filter((license) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      license.license_key.toLowerCase().includes(query) ||
      (license.user_email && license.user_email.toLowerCase().includes(query)) ||
      (license.user_name && license.user_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="container mx-auto py-4 px-3 max-w-full">
      {/* Lisans Oluşturma Formu */}
      <Card className="mb-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="max-devices">Maksimum Cihaz Sayısı</Label>
              <select
                id="max-devices"
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
                disabled={creating}
              >
                <option value="1">1 cihaz</option>
                <option value="2">2 cihaz</option>
                <option value="3">3 cihaz</option>
                <option value="5">5 cihaz</option>
                <option value="10">10 cihaz</option>
              </select>
            </div>
            <div>
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

      {/* Lisans Listesi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lisanslar ve Aktif Cihazlar</CardTitle>
              <CardDescription>
                Toplam {licenses.length} lisans
              </CardDescription>
            </div>
            <div className="w-64">
              <Input
                placeholder="Email veya lisans anahtarı ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Lisanslar yükleniyor...</p>
            </div>
          ) : filteredLicenses.length === 0 ? (
            <Alert className="bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <AlertDescription className="text-gray-700 dark:text-gray-300">
                {searchQuery ? "Arama sonucu bulunamadı." : "Henüz lisans bulunmuyor."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-b">
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Kullanıcı Email
                    </th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Lisans Anahtarı
                    </th>
                    <th className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Tip
                    </th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Cihaz ID
                    </th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Aktif Edildi
                    </th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Son Görülme
                    </th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Bitiş Tarihi
                    </th>
                    <th className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => {
                    const statusBadge = getStatusBadge(license);
                    const isExpired = license.is_expired || (license.expires_at && new Date(license.expires_at) < new Date());
                    
                    return (
                      <tr
                        key={license.license_id}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isExpired ? "bg-red-50 dark:bg-red-900/20" : ""
                        }`}
                      >
                        {/* User Email */}
                        <td className="p-2 text-sm">
                          {license.user_email ? (
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {license.user_email}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Atanmamış
                            </span>
                          )}
                        </td>

                        {/* License Key */}
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-700">
                              {license.license_key}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(license.license_key)}
                              title="Kopyala"
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-2 text-center">
                          <Badge className={
                            license.type === 'demo' 
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }>
                            {license.type === 'demo' ? 'Demo' : 'Paid'}
                          </Badge>
                        </td>

                        {/* Device ID */}
                        <td className="p-2 text-sm">
                          {license.device_id ? (
                            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {license.device_id.substring(0, 8)}...
                            </code>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Aktif değil
                            </span>
                          )}
                        </td>

                        {/* Activated At */}
                        <td className="p-2 text-sm text-gray-700 dark:text-gray-300">
                          {formatDateTime(license.activated_at)}
                        </td>

                        {/* Last Seen */}
                        <td className="p-2 text-sm text-gray-700 dark:text-gray-300">
                          {formatDateTime(license.last_seen_at)}
                        </td>

                        {/* Expires At */}
                        <td className="p-2 text-sm">
                          <span className={isExpired ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-700 dark:text-gray-300"}>
                            {formatDate(license.expires_at)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-2 text-center">
                          <Badge className={
                            isExpired 
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : license.status === 'active'
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          }>
                            {isExpired ? 'Expired' : license.status || 'Active'}
                          </Badge>
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

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Lisansı Kullanıcıya Ata</CardTitle>
              <CardDescription>
                Bu lisansı hangi kullanıcıya atamak istiyorsunuz?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Kullanıcı Seçin</Label>
                  <select
                    className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    value={selectedUserId || ""}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    disabled={assigning}
                  >
                    <option value="">Seçin...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowAssignModal(false)}
                    disabled={assigning}
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleAssignLicense}
                    disabled={assigning || !selectedUserId}
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atanıyor...
                      </>
                    ) : (
                      "Ata"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Manager Modal */}
      {showDeviceModal && deviceModalLicenseId && (
        <DeviceManagerModal
          licenseId={deviceModalLicenseId}
          licenseKey={deviceModalLicenseKey}
          onClose={closeDeviceModal}
          onDeviceUpdate={handleDeviceUpdate}
        />
      )}
    </div>
  );
}
