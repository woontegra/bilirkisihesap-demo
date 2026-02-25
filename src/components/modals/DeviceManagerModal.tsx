import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/context/ToastContext";
import { API_BASE_URL } from "@/utils/apiClient";
import { 
  X, 
  Loader2, 
  Trash2, 
  Plus, 
  Monitor,
  AlertCircle 
} from "lucide-react";

interface Device {
  id: number;
  device_id: string;
  created_at: string;
  last_used: string;
}

interface DeviceManagerModalProps {
  licenseId: string;
  licenseKey: string;
  onClose: () => void;
  onDeviceUpdate: () => void;
}

export default function DeviceManagerModal({
  licenseId,
  licenseKey,
  onClose,
  onDeviceUpdate
}: DeviceManagerModalProps) {
  const { success, error } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingDeviceId, setProcessingDeviceId] = useState<number | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);

  useEffect(() => {
    loadDevices();
  }, [licenseId]);

  const loadDevices = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/admin/licenses/${licenseId}/devices`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (data.success) {
        setDevices(data.devices || []);
      } else {
        setErrorMessage(data.error || "Cihazlar yüklenemedi");
      }
    } catch (err) {
      setErrorMessage("Cihazlar yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: number) => {
    if (!confirm("Bu cihazı silmek istediğinize emin misiniz?")) {
      return;
    }

    setProcessingDeviceId(deviceId);

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/admin/licenses/${licenseId}/devices/${deviceId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (data.success) {
        success(data.message || "Cihaz başarıyla silindi");
        loadDevices();
        onDeviceUpdate();
      } else {
        error(data.error || "Cihaz silinemedi");
      }
    } catch (err) {
      error("Cihaz silme sırasında hata oluştu");
    } finally {
      setProcessingDeviceId(null);
    }
  };

  const handleAddSlot = async () => {
    setAddingSlot(true);

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/admin/licenses/${licenseId}/devices/add-slot`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (data.success) {
        success(data.message || "Yeni cihaz hakkı eklendi");
        onDeviceUpdate();
      } else {
        error(data.error || "Cihaz hakkı eklenemedi");
      }
    } catch (err) {
      error("Cihaz hakkı ekleme sırasında hata oluştu");
    } finally {
      setAddingSlot(false);
    }
  };

  const formatDate = (dateStr: string) => {
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

  const truncateUUID = (uuid: string) => {
    if (!uuid) return "-";
    return uuid.length > 8 ? `${uuid.substring(0, 8)}...` : uuid;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            Cihaz Yönetimi
          </CardTitle>
          <CardDescription>
            <code className="text-sm bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
              {licenseKey}
            </code>
          </CardDescription>
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
              <p className="text-gray-600 dark:text-gray-400">
                Cihazlar yükleniyor...
              </p>
            </div>
          ) : devices.length === 0 ? (
            <Alert className="bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <AlertDescription className="text-gray-700 dark:text-gray-300">
                Henüz kayıtlı cihaz bulunmuyor.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto border rounded-lg mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-b">
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Cihaz Adı
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      UUID
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Kayıt Tarihi
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Son Kullanım
                    </th>
                    <th className="p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device, index) => (
                    <tr
                      key={device.id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            Cihaz {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {truncateUUID(device.device_id)}
                        </code>
                        <span className="text-xs text-gray-500 ml-2" title={device.device_id}>
                          ({device.device_id})
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(device.created_at)}
                      </td>
                      <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(device.last_used)}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveDevice(device.id)}
                          disabled={processingDeviceId === device.id}
                        >
                          {processingDeviceId === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Toplam {devices.length} cihaz kayıtlı
            </div>
            <Button
              onClick={handleAddSlot}
              disabled={addingSlot}
              className="bg-green-600 hover:bg-green-700"
            >
              {addingSlot ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni Cihaz Hakkı Ekle
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








