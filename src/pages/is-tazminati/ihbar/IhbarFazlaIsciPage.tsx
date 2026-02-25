import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import KidemTazminatiForm from "../KidemTazminatiForm";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { API_BASE_URL } from "@/utils/apiClient";

export default function IhbarFazlaIsciPage() {
  const { success, error, info } = useToast();
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<number | undefined>(undefined);
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<any>(null);

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `
        @media print {
          body * { visibility: hidden !important; }
          #ihbar-print, #ihbar-print * { visibility: visible !important; }
          #ihbar-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
          #ihbar-print .grid { display: block !important; }
          #ihbar-print .lg\\:grid-cols-2 > * { width: 100% !important; }
          #ihbar-print button { display: none !important; }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 1000);
    } catch {}
  };

  // İhbar süresi (hafta) ve tutar hesaplama
  const weeks = (() => {
    const totalMonths = (totals.yil || 0) * 12 + (totals.ay || 0) + ((totals.gun || 0) > 0 ? 0.01 : 0);
    if (totalMonths < 6) return 2;
    if (totalMonths < 18) return 4;
    if (totalMonths < 36) return 6;
    return 8;
  })();
  const amount = (totals.toplam ? (totals.toplam / 30) * weeks * 7 : 0);
  const gelirVergisi = amount * 0.15;
  const damgaVergisi = amount * 0.00759;
  const net = amount - gelirVergisi - damgaVergisi;

  const location = useLocation();
  const navState = (location.state as any) || {};
  const initialBrut = useMemo(() => {
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar;
      const val = Number(isNaN(fromQuery) ? fromState : fromQuery);
      if (!val || !isFinite(val)) return undefined;
      return String(val.toFixed(2)).replace(".", ",");
    } catch { return undefined; }
  }, [location.search, location.state]);

  const links = [
    { to: "/ihbar/30-isciden-fazla", label: "İş Kanununa Göre İhbar Tazminatı" },
    { to: "/ihbar/borclar-kanunu", label: "Borçlar Kanunu İşçileri" },
    { to: "/ihbar/gemi-adam", label: "Gemi Adamları" },
    { to: "/ihbar/mevsimlik-isci", label: "Mevsimlik İşçiler" },
    { to: "/ihbar/basin-is", label: "Basın İş" },
    { to: "/ihbar/toplu-sozlesme", label: "Toplu İş Sözleşmesi" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">İHBAR TAZMİNATI HESAPLAMA</h1>
          <ReportPreviewButton
            title="İhbar Tazminatı"
            copyTargetId="calc-table"
            buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
            renderContent={() => (
              <div>
                <div id="calc-table">
                  <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as React.CSSProperties}>
                    <thead style={{background:'#f3f4f6'}}>
                      <tr>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Alan</th>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Değer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>İhbar Süresi</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{weeks} hafta</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Aylık Toplam</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totals.toplam)}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Brüt İhbar</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Gelir Vergisi (%15)</td><td style={{border:'1px solid #ccc', padding:'6px'}}>-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(gelirVergisi)}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Damga Vergisi (binde 7,59)</td><td style={{border:'1px solid #ccc', padding:'6px'}}>-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(damgaVergisi)}</td></tr>
                    </tbody>
                    <tfoot style={{background:'#f9fafb'}}>
                      <tr>
                        <td style={{border:'1px solid #999', textAlign:'right', fontWeight:600, padding:'6px'}}>Net İhbar Tazminatı</td>
                        <td style={{border:'1px solid #999', fontWeight:600, padding:'6px', textAlign:'right'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(net)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `px-3 py-1.5 rounded-full text-sm border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div id="ihbar-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <KidemTazminatiForm
            onTotalsChange={setTotals}
            appliedEklenti={appliedEklenti}
            initialBrut={initialBrut}
            showIhbarShortcut={false}
            initialIseGiris={navState?.iseGiris}
            initialIstenCikis={navState?.istenCikis}
            initialPrim={navState?.prim}
            initialIkramiye={navState?.ikramiye}
            initialYol={navState?.yol}
            initialYemek={navState?.yemek}
            onExitDateChange={setExitDate}
            onValuesChange={setFormValues}
          />

          <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2">İhbar Tazminatı</h3>
            <div className="text-sm sm:text-base space-y-1">
              <p className="flex items-center justify-between"><span>İhbar Süresi:</span> <span className="font-medium">{weeks} hafta</span></p>
              <p className="flex items-center justify-between"><span>Günlük Ücret (Toplam/30):</span> <span className="font-medium">({fmt(totals.toplam || 0)} ₺ / 30 × {weeks} × 7)</span></p>
              <hr className="my-2" />
              <p className="flex items-center justify-between"><span>Tutar:</span> <span className="font-semibold text-gray-900">{fmt(amount)}</span></p>
              <p className="text-xs text-gray-500 mt-2">İş Kanunu madde 17’ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2">Brüt’ten Net’e Çeviri</h3>
            <div className="space-y-1 text-sm sm:text-base">
              <p className="flex items-center justify-between"><span>Brüt İhbar Tazminatı:</span> <span className="font-medium">{fmt(amount)}</span></p>
              <p className="flex items-center justify-between"><span>Gelir Vergisi (%15):</span> <span className="font-medium text-red-600">-{fmt(gelirVergisi)}</span></p>
              <p className="flex items-center justify-between"><span>Damga Vergisi (Binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisi)}</span></p>
              <hr className="my-2" />
              <p className="flex items-center justify-between"><span>Net İhbar Tazminatı:</span> <span className="font-semibold text-green-700">{fmt(net)}</span></p>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button onClick={handlePrint} className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition">🖨️ Yazdır</button>
            <button
              title="Hesaplamayı kaydet"
              className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition"
              onClick={async () => {
                try {
                  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
                  const payload = { tenant_id: tenantId, type: "İhbar Tazminatı", brut_total: Number(amount.toFixed(2)), net_total: Number(net.toFixed(2)) };
                  const res = await fetch(`${API_BASE_URL}/api/saved-cases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  if (!res.ok) throw new Error("save_failed");
                  success("Hesaplama başarıyla kaydedildi.");
                } catch (e) { error("Hesaplama kaydedilirken bir hata oluştu."); }
              }}
            >
              💾 Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
