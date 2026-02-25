import { useMemo, useRef, useState } from "react";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { API_BASE_URL } from "@/utils/apiClient";

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

export default function AyrimcilikTazminatiPage() {
  const [brut, setBrut] = useState("");
  const brutVal = useMemo(() => parseNum(brut), [brut]);

  const kats = [1, 2, 3, 4] as const;
  const values = useMemo(() => kats.map(k => ({ k, amount: (brutVal * k) })), [brutVal]);

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `@media print { body * { visibility: hidden !important; } #ayrimcilik-print, #ayrimcilik-print * { visibility: visible !important; } #ayrimcilik-print { position: absolute; left:0; top:0; width:100%; padding:0 12mm; } }`;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 800);
    } catch {}
  };

  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return; saving.current = true;
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const payload = {
        tenant_id: tenantId,
        type: "Ayrımcılık Tazminatı",
        brut_total: Number((values[values.length - 1]?.amount || 0).toFixed(2)),
        net_total: Number((values[values.length - 1]?.amount || 0).toFixed(2)),
        details: values.map(v => ({ kat: v.k, amount: v.amount }))
      };
      await fetch(`${API_BASE_URL}/api/saved-cases`, { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) }, body: JSON.stringify(payload) });
      alert("Ayrımcılık tazminatı hesaplaması kaydedildi.");
    } catch {
      alert("Kayıt sırasında hata oluştu.");
    } finally { saving.current = false; }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Ayrımcılık Tazminatı Hesaplama</h1>
          <ReportPreviewButton
            title="Ayrımcılık Tazminatı"
            copyTargetId="calc-table"
            buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
            renderContent={() => (
              <div>
                <div id="calc-table">
                  <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as React.CSSProperties}>
                    <thead style={{background:'#f3f4f6'}}>
                      <tr>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Kat</th>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'right'}}>Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {values.map(v => (
                        <tr key={v.k}>
                          <td style={{border:'1px solid #ccc', padding:'6px'}}>×{v.k}</td>
                          <td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{fmt(v.amount)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{background:'#f9fafb'}}>
                      <tr>
                        <td style={{border:'1px solid #999', textAlign:'right', fontWeight:600, padding:'6px'}}>En Yüksek</td>
                        <td style={{border:'1px solid #999', fontWeight:600, padding:'6px', textAlign:'right'}}>{fmt(values[values.length - 1]?.amount || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <div id="ayrimcilik-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="space-y-3" style={{ maxWidth: 400 }}>
            <div>
              <label className="text-sm font-medium text-gray-700">Çıplak Brüt Ücret</label>
              <input
                value={brut}
                onChange={(e)=> setBrut(e.target.value)}
                placeholder="Örn: 22.000"
                className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-2 space-y-1 text-sm sm:text-base">
              {values.map(v => (
                <p key={v.k} className="flex items-center justify-between">
                  <span>{v.k} Katı:</span>
                  <span className="font-medium">{fmt(v.amount)}</span>
                </p>
              ))}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={handlePrint} className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition">🖨️ Yazdır</button>
              <button onClick={handleSave} className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition">💾 Kaydet</button>
            </div>
          </div>
        </div>

        {/* Sağ: Not */}
        <div>
          <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6 notes-content">
              <p className="text-slate-600 dark:text-slate-300">Ayrımcılık tazminatı hakkında notlar buraya eklenecektir.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
