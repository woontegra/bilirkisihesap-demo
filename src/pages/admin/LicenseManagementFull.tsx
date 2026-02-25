import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/context/ToastContext";
import { API_BASE_URL } from "@/utils/apiClient";
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Mail, 
  Key, 
  Calendar,
  Users,
  Monitor
} from "lucide-react";

interface DeviceInfo {
  uuid: string;
  activatedAt: string;
}

interface License {
  id: string;
  license_key: string;
  user_id: number;
  user_name: string;
  user_email: string;
  status: string;
  max_devices: number;
  used_devices: number;
  activated_devices: DeviceInfo[];
  expires_at: string;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function LicenseManagementFull() {
  const { success, error } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedLicenseDevices, setSelectedLicenseDevices] = useState<License | null>(null);
  
  const token = localStorage.getItem("access_token");
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  useEffect(() => {
    loadLicenses();
    loadUsers();
  }, []);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
      });

      if (!res.ok) throw new Error("Failed to load licenses");

      const data = await res.json();
      setLicenses(data.licenses || []);
    } catch (err) {
      console.error("Failed to load licenses:", err);
      error("Lisanslar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
      });

      if (!res.ok) throw new Error("Failed to load users");

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleCreateLicense = async () => {
    if (!selectedUser) {
      error("Lütfen kullanıcı seçin");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({
          userId: selectedUser,
          maxDevices,
          expiresAt: expiryDate || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Lisans oluşturulamadı");
        return;
      }

      success(`Lisans oluşturuldu: ${data.licenseKey}`);
      setShowCreateForm(false);
      setSelectedUser(null);
      setMaxDevices(1);
      setExpiryDate("");
      loadLicenses();
    } catch (err) {
      console.error("Create license error:", err);
      error("Lisans oluşturma hatası");
    }
  };

  const handleIncreaseDevices = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/increase-devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({ licenseKey, amount: 1 }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Cihaz hakkı artırılamadı");
        return;
      }

      success("Cihaz hakkı +1 artırıldı");
      loadLicenses();
    } catch (err) {
      console.error("Increase devices error:", err);
      error("İşlem başarısız");
    }
  };

  const handleResetDevices = async (licenseKey: string) => {
    if (!confirm("Tüm cihazları sıfırlamak istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/reset-devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Cihazlar sıfırlanamadı");
        return;
      }

      success("Cihazlar sıfırlandı");
      loadLicenses();
    } catch (err) {
      console.error("Reset devices error:", err);
      error("İşlem başarısız");
    }
  };

  const handleRenew = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({ licenseKey, months: 12 }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Lisans yenilenemedi");
        return;
      }

      success("Lisans 1 yıl uzatıldı");
      loadLicenses();
    } catch (err) {
      console.error("Renew error:", err);
      error("İşlem başarısız");
    }
  };

  const handleCancel = async (licenseKey: string) => {
    if (!confirm("Lisansı iptal etmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Lisans iptal edilemedi");
        return;
      }

      success("Lisans iptal edildi");
      loadLicenses();
    } catch (err) {
      console.error("Cancel error:", err);
      error("İşlem başarısız");
    }
  };

  const handleResendEmail = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/licenses/resend-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": String(tenantId),
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await res.json();

      if (!data.success) {
        error(data.error || "Mail gönderilemedi");
        return;
      }

      success(data.message || "Mail gönderildi");
    } catch (err) {
      console.error("Resend email error:", err);
      error("İşlem başarısız");
    }
  };

  const filteredLicenses = licenses.filter(
    (lic) =>
      lic.license_key.toLowerCase().includes(search.toLowerCase()) ||
      lic.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      lic.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      expired: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Lisans Yönetimi</CardTitle>
              <CardDescription>Tüm lisansları yönetin</CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yeni Lisans
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {showCreateForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <h3 className="font-semibold mb-4">Yeni Lisans Oluştur</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kullanıcı</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={selectedUser || ""}
                    onChange={(e) => setSelectedUser(Number(e.target.value))}
                  >
                    <option value="">Seçin...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Maks. Cihaz</label>
                  <Input
                    type="number"
                    min="1"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Bitiş Tarihi</label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateLicense}>Oluştur</Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  İptal
                </Button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <Input
              placeholder="Lisans kodu, email veya isim ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-center py-8">Yükleniyor...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Lisans Kodu</th>
                    <th className="text-left py-3 px-4">Kullanıcı</th>
                    <th className="text-center py-3 px-4">Durum</th>
                    <th className="text-center py-3 px-4">Cihazlar</th>
                    <th className="text-center py-3 px-4">Bitiş</th>
                    <th className="text-right py-3 px-4">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((lic) => (
                    <tr key={lic.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 font-mono text-sm">{lic.license_key}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{lic.user_name}</div>
                        <div className="text-sm text-gray-500">{lic.user_email}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={getStatusBadge(lic.status)}>{lic.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold">
                          {lic.used_devices}/{lic.max_devices}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {new Date(lic.expires_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLicenseDevices(lic)}
                            title="Cihazları Görüntüle"
                          >
                            <Monitor className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleIncreaseDevices(lic.license_key)}
                            title="Cihaz Hakkı Artır"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetDevices(lic.license_key)}
                            title="Cihazları Sıfırla"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRenew(lic.license_key)}
                            title="Lisans Yenile (1 Yıl)"
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendEmail(lic.license_key)}
                            title="Maili Tekrar Gönder"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancel(lic.license_key)}
                            title="Lisansı İptal Et"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLicenses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Lisans bulunamadı
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Details Modal */}
      {selectedLicenseDevices && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Cihaz Detayları</CardTitle>
              <CardDescription>
                Lisans: {selectedLicenseDevices.license_key}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p><strong>Kullanıcı:</strong> {selectedLicenseDevices.user_name}</p>
                <p><strong>Email:</strong> {selectedLicenseDevices.user_email}</p>
                <p><strong>Kullanılan/Maks:</strong> {selectedLicenseDevices.used_devices}/{selectedLicenseDevices.max_devices}</p>
              </div>

              <h3 className="font-semibold mb-3">Kayıtlı Cihazlar:</h3>
              
              {selectedLicenseDevices.activated_devices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Henüz cihaz kaydedilmemiş</p>
              ) : (
                <div className="space-y-3">
                  {selectedLicenseDevices.activated_devices.map((device, index) => (
                    <div key={device.uuid} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            Cihaz #{index + 1}
                          </p>
                          <p className="font-mono text-xs mt-1 break-all">
                            {device.uuid}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Aktive Edildi: {new Date(device.activatedAt).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedLicenseDevices(null)}>
                  Kapat
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    handleResetDevices(selectedLicenseDevices.license_key);
                    setSelectedLicenseDevices(null);
                  }}
                >
                  Tüm Cihazları Sıfırla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

