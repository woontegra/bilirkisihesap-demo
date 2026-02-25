import React from "react";

export type RecordDetailData = {
  calculation_type: string;
  total?: number | null;
  brut_total?: number | null;
  net_total?: number | null;
  ise_giris?: string | null;
  isten_cikis?: string | null;
  tavan?: number | null;
  inputs?: Record<string, any> | null;
  calisma_suresi?: string | null;
  eklentiler?: Record<string, any> | null; // aylık dağılım
  start_date?: string | null;
  end_date?: string | null;
  data?: any;
};

export default function RecordDetailModal({ data, onClose, onCopy }: { data: RecordDetailData | null; onClose: () => void; onCopy: () => void; }) {
  if (!data) return null;

  const formatTL = (value: any) =>
    value != null && value !== "" ? Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

  const formatCurrency = (value: any) =>
    value != null && value !== "" ? Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

  const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString("tr-TR") : "-";

  const details = (data as any)?.details ?? (data as any)?.data ?? (data as any)?.detay ?? null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="print-area bg-white border-2 border-gray-300 rounded-lg shadow-lg w-full max-w-[1000px] max-h-[90vh] overflow-y-auto p-8"
        style={{ fontFamily: 'Inter, Roboto, "Times New Roman", serif' }}
      >
        {/* Header section with branding */}
        <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
          <div className="border-b border-gray-400 pb-4 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 uppercase">
                Mercan Danışmanlık | Aktüerya Hesaplama Raporu
              </h1>
              <p className="text-sm text-gray-600">
                {data.calculation_type?.replaceAll("_", " ")} Hesaplama Özeti
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                Yazdır / PDF
              </button>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-semibold">Kapat ✕</button>
            </div>
          </div>
          <div className="text-xs text-gray-500">Rapor Özeti</div>
        </div>

        {/* Summary section */}
        <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
          <div className="text-sm font-semibold text-gray-700 mb-2">Özet Bilgiler</div>
          <div className="grid grid-cols-2 gap-6 text-sm text-gray-800 border border-gray-200 rounded-md p-4 bg-gray-50">
            <div>
              <p><b>İşe Giriş:</b> {formatDate(data.start_date ?? data.ise_giris ?? null)}</p>
              <p><b>İşten Çıkış:</b> {formatDate(data.end_date ?? data.isten_cikis ?? null)}</p>
              <p><b>Hesaplama Türü:</b> {data.calculation_type}</p>
            </div>
            <div>
              <p><b>Brüt Toplam:</b> ₺{formatCurrency(data.brut_total)}</p>
              <p><b>Net Toplam:</b> ₺{formatCurrency(data.net_total)}</p>
              <p><b>Tavan:</b> ₺{formatCurrency(data.tavan)}</p>
              <p><b>Toplam:</b> ₺{formatCurrency(data.total)}</p>
            </div>
          </div>
        </div>

        {/* Beyan Bilgileri */}
        {(details?.davaci || details?.davali || (Array.isArray(details?.taniklar) && details?.taniklar.length > 0)) && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Beyan Bilgileri</div>
            {details?.davaci && <p><b>Davacı Beyanı:</b> {details.davaci}</p>}
            {details?.davali && <p><b>Davalı Beyanı:</b> {details.davali}</p>}
            {Array.isArray(details?.taniklar) && details.taniklar.length > 0 && (
              <div className="mt-2">
                <b>Tanık Beyanları:</b>
                <ul className="list-disc ml-6">
                  {details.taniklar.map((t: any, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* İzin ve Rapor Dışlamaları */}
        {Array.isArray(details?.exclusions) && details.exclusions.length > 0 && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Yıllık İzin ve Rapor Dışlamaları</div>
            <table className="w-full border text-sm text-gray-700 border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-1 text-left">Tür</th>
                  <th className="border px-3 py-1 text-left">Başlangıç</th>
                  <th className="border px-3 py-1 text-left">Bitiş</th>
                  <th className="border px-3 py-1 text-right">Gün</th>
                </tr>
              </thead>
              <tbody>
                {details.exclusions.map((x: any, i: number) => (
                  <tr key={i}>
                    <td className="border px-3 py-1">{x.type}</td>
                    <td className="border px-3 py-1">{x.start}</td>
                    <td className="border px-3 py-1">{x.end}</td>
                    <td className="border px-3 py-1 text-right">{x.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Main calculation table */}
        {Array.isArray(details?.table) && details.table.length > 0 && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Hesaplama Cetveli</div>
            <table className="w-full border mt-2 text-sm text-gray-800 border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Tarih Aralığı</th>
                  <th className="border px-3 py-2 text-right">Hafta</th>
                  <th className="border px-3 py-2 text-right">Ücret</th>
                  <th className="border px-3 py-2 text-right">Fazla Mesai</th>
                </tr>
              </thead>
              <tbody>
                {details.table.map((row: any, i: number) => {
                  const weeks = row.weeks ?? row.hafta;
                  const salary = row.salary ?? row.ucret;
                  const fmTotal = row.total ?? row.fazla_mesai;
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border px-3 py-1">{row.period}</td>
                      <td className="border px-3 py-1 text-right">{weeks}</td>
                      <td className="border px-3 py-1 text-right">₺{formatCurrency(salary)}</td>
                      <td className="border px-3 py-1 text-right">₺{formatCurrency(fmTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sonuç Bilgileri */}
        <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
          <div className="text-sm font-semibold text-gray-700 mb-2">Sonuç Bilgileri</div>
          <p><b>Brüt Toplam:</b> ₺{formatCurrency(data.brut_total)}</p>
          <p><b>Net Toplam:</b> ₺{formatCurrency(data.net_total)}</p>
          <p><b>Tavan:</b> ₺{formatCurrency(data.tavan)}</p>
          <p><b>Toplam:</b> ₺{formatCurrency(data.total)}</p>
        </div>

        {/* Girilen Bilgiler */}
        {data.inputs && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Girilen Bilgiler</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 border rounded-lg p-3">
              {Object.entries(data.inputs).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-gray-500">{key}:</span>{" "}
                  <span className="font-medium">{String(value ?? "-")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Çalışma Süresi */}
        {data.calisma_suresi && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Çalışma Süresi</div>
            <p className="text-sm text-gray-700">{data.calisma_suresi}</p>
          </div>
        )}

        {/* Eklenti Dağılımı */}
        {data.eklentiler && (
          <div className="border border-gray-300 rounded-md p-4 mb-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-2">Eklenti Aylık Dağılımı</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.eklentiler).map(([key, months]) => (
                <div key={key} className="border rounded-lg p-2 bg-gray-50">
                  <h4 className="font-medium text-center text-gray-700 mb-1">{key}</h4>
                  <div className="grid grid-cols-3 text-xs text-center gap-1">
                    {Array.isArray(months) && months.map((val: any, i: number) => (
                      <div key={i} className={`p-1 rounded ${val ? "bg-green-50 text-gray-800" : "bg-gray-100 text-gray-400"}`}>
                        {i + 1}. Ay
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border border-gray-300 rounded-md p-4 mt-4 bg-white">
          <div className="text-xs text-gray-500 border-t pt-2 text-right">
            Rapor otomatik olarak oluşturulmuştur — {new Date().toLocaleDateString("tr-TR")}
          </div>
          <div className="flex justify-end mt-3 space-x-3">
            <button onClick={onCopy} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Panoya Kopyala</button>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Kapat</button>
          </div>
        </div>
      </div>
    </div>
  );
}
