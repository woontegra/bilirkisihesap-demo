import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/utils/apiClient";

type Notif = {
  id: number;
  title: string;
  created_at?: string;
  read?: boolean;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantId = useMemo(() => Number(localStorage.getItem("tenant_id") || "1"), []);

  const load = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const userId = Number(localStorage.getItem("user_id") || "0");
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { 
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Bildirimler alınamadı", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">🔔 Bildirimler</h1>
        <Link to="/profile" className="text-sm text-blue-600 hover:text-blue-800">Profille Dön</Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">Henüz bildiriminiz yok.</div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => {
              const d = n.created_at ? new Date(n.created_at) : null;
              return (
                <li key={n.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-900">{n.title}</div>
                    <div className="text-xs text-gray-500">{d ? d.toLocaleString("tr-TR") : ""}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
