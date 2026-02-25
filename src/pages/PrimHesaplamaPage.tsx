import { useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/utils/apiClient";

type Row = { id: string; principal: string; percent: string };

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

export default function PrimHesaplamaPage() {
  const [rows, setRows] = useState<Row[]>([
    { id: Math.random().toString(36).slice(2), principal: "", percent: "" },
  ]);

  const amounts = useMemo(() => rows.map(r => {
    const p = parseNum(r.principal);
    const pct = parseNum(r.percent);
    return Math.max(0, (p * pct) / 100);
  }), [rows]);

  const total = useMemo(() => amounts.reduce((a, b) => a + b, 0), [amounts]);

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `@media print { body * { visibility: hidden !important; } #prim-print, #prim-print * { visibility: visible !important; } #prim-print { position: absolute; left:0; top:0; width:100%; padding:0 12mm; } }`;
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
        type: "Prim Alacağı",
        brut_total: Number(total.toFixed(2)),
        net_total: Number(total.toFixed(2)),
        details: rows.map((r, i) => ({ index: i+1, principal: parseNum(r.principal), percent: parseNum(r.percent), amount: amounts[i] || 0 }))
      };
      await fetch(`${API_BASE_URL}/api/saved-cases`, { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) }, body: JSON.stringify(payload) });
      alert("Prim hesaplaması kaydedildi.");
    } catch {
      alert("Kayıt sırasında hata oluştu.");
    } finally { saving.current = false; }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center">Prim Hesaplama</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="prim-print" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const amount = amounts[idx] || 0;
              return (
                <div key={r.id} className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                    <label className="text-sm font-medium text-gray-700">Prime Esas Ana Para</label>
                    <input
                      value={r.principal}
                      onChange={(e)=> setRows(prev => prev.map(x => x.id===r.id? { ...x, principal: e.target.value }: x))}
                      placeholder="Örn: 50.000"
                      className="mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm w-full"
                    />
                  </div>
                  <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                    <label className="text-sm font-medium text-gray-700">Prime Hesap Yüzdesi %</label>
                    <input
                      value={r.percent}
                      onChange={(e)=> setRows(prev => prev.map(x => x.id===r.id? { ...x, percent: e.target.value }: x))}
                      placeholder="Örn: 10"
                      className="mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm w-full"
                    />
                  </div>
                  <div className="flex flex-col w-full sm:w-auto sm:min-w-[200px]">
                    <label className="text-sm font-medium text-gray-700">Prim Miktarı</label>
                    <input readOnly value={`₺${fmt(amount)}`} className="mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm bg-gray-50" />
                  </div>
                  <button
                    type="button"
                    onClick={()=> setRows(prev => prev.filter(x => x.id !== r.id))}
                    className="text-red-600 text-sm px-2 py-2"
                    aria-label="Satırı sil"
                  >
                    –
                  </button>
                </div>
              );
            })}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={()=> setRows(prev => [...prev, { id: Math.random().toString(36).slice(2), principal: "", percent: "" }])}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Ekle
              </button>
              <div className="text-sm text-gray-500">Toplam Prim</div>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm sm:text-base">
              <span className="font-medium text-gray-700">Toplam Prim:</span>
              <span className="font-semibold text-gray-900">₺{fmt(total)}</span>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={handlePrint} className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition">🖨️ Yazdır</button>
              <button onClick={handleSave} className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition">💾 Kaydet</button>
            </div>
          </div>
        </div>

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
            <div className="p-4 text-sm leading-6">
              <p className="text-slate-600 dark:text-slate-300">Bu sayfa, prime esas ana para üzerinden prim tutarlarını hesaplamak için kullanılır.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
