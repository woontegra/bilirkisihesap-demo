import React, { useEffect, useState } from "react";
import axios from "axios";
import { useToast } from "@/context/ToastContext";

interface Hesaplama {
  id: number;
  hesaplama_turu: string;
  tarih: string;
  toplam_fazla_mesai: string;
  ayrintilar: string;
}

const FazlaMesaiRaporPage: React.FC = () => {
  const { success, error } = useToast();
  const [data, setData] = useState<Hesaplama[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/fazla-mesai/list");
      setData(res.data);
    } catch (err) {
      error("Kayıtlar alınamadı");
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: number) => {
    if (!window.confirm("Bu kaydı silmek istediğine emin misin?")) return;
    try {
      await axios.delete(`/api/fazla-mesai/${id}`);
      success("Kayıt silindi");
      fetchData();
    } catch (err) {
      error("Silme işlemi başarısız");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-3">Fazla Mesai Raporları</h2>
      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">ID</th>
              <th className="border p-2">Tür</th>
              <th className="border p-2">Tarih</th>
              <th className="border p-2">Toplam Saat</th>
              <th className="border p-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="border p-2">{item.id}</td>
                <td className="border p-2">{item.hesaplama_turu}</td>
                <td className="border p-2">{item.tarih}</td>
                <td className="border p-2">{item.toplam_fazla_mesai}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => deleteRecord(item.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FazlaMesaiRaporPage;
